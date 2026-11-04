import "server-only";
import sharp from "sharp";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {
  assertStillPhoto,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_MAX_PIXELS,
} from "@/lib/media-policy";
import { getPrivateStorage } from "@/server/storage";
import { SocialError } from "./errors";
// Keep the private filesystem adapter out of production bundles/traces entirely.
const developmentStore =
  process.env.NODE_ENV === "development"
    ? import("./local-photo-store").then(({ localPhotoStore }) =>
        localPhotoStore(),
      )
    : null;
function isLocalStoreEnabled() {
  if (process.env.MARGIN_LOCAL_PHOTO_STORE !== "1") return false;
  if (process.env.NODE_ENV !== "development")
    throw Error("Local photo storage is development-only");
  return true;
}

export interface PrivatePhotoStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  list?(
    after?: string,
    limit?: number,
  ): Promise<{
    objects: { key: string; lastModified: Date }[];
    hasMore: boolean;
  }>;
}
// No public URL, ACL, signed bearer URL, or image-optimizer path is produced.
export const privatePhotoStore: PrivatePhotoStore = {
  async list(after, limit = 100) {
    if (isLocalStoreEnabled())
      return (await developmentStore!).list!(after, limit);
    const { client, bucket } = getPrivateStorage();
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "social/",
        StartAfter: after,
        MaxKeys: Math.min(100, Math.max(1, limit)),
      }),
      { abortSignal: AbortSignal.timeout(10_000) },
    );
    return {
      objects: (page.Contents ?? []).map((object) => {
        if (!object.Key || !object.LastModified)
          throw Error("Invalid private object listing");
        return { key: object.Key, lastModified: object.LastModified };
      }),
      hasMore: Boolean(page.IsTruncated),
    };
  },
  async put(key, bytes) {
    if (isLocalStoreEnabled()) return (await developmentStore!).put(key, bytes);
    const { client, bucket } = getPrivateStorage();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: "image/webp",
        CacheControl: "private, no-store",
      }),
      { abortSignal: AbortSignal.timeout(10_000) },
    );
  },
  async get(key) {
    if (isLocalStoreEnabled()) return (await developmentStore!).get(key);
    const { client, bucket } = getPrivateStorage();
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: AbortSignal.timeout(10_000) },
    );
    if (
      !object.Body ||
      !object.ContentLength ||
      object.ContentLength > PHOTO_MAX_BYTES
    )
      throw new Error("Invalid stored photo");
    return object.Body.transformToByteArray();
  },
  async delete(key) {
    if (isLocalStoreEnabled()) return (await developmentStore!).delete(key);
    const { client, bucket } = getPrivateStorage();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(10_000),
    });
  },
};

export async function normalizePhoto(bytes: Uint8Array, type: string) {
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[type];
  if (!extension)
    throw new SocialError(415, "Choose a JPEG, PNG, or WebP photograph");
  try {
    assertStillPhoto(bytes, type, `photo.${extension}`);
    const decoder = sharp(bytes, {
      limitInputPixels: PHOTO_MAX_PIXELS,
      failOn: "warning",
    }).timeout({ seconds: 5 });
    const metadata = await decoder.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > PHOTO_MAX_DIMENSION ||
      metadata.height > PHOTO_MAX_DIMENSION ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error("Invalid dimensions");
    // Decode fully and re-encode; sharp strips EXIF/GPS/XMP by default.
    const { data, info } = await decoder
      .rotate()
      .webp({ quality: 85, effort: 3 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > PHOTO_MAX_BYTES) throw new Error("Output too large");
    return {
      bytes: data,
      width: info.width,
      height: info.height,
      byteLength: data.length,
    };
  } catch {
    throw new SocialError(400, "Photograph could not be verified");
  }
}
