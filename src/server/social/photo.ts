import "server-only";
import sharp from "sharp";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  assertStillPhoto,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_MAX_PIXELS,
} from "@/lib/media-policy";
import { getPrivateStorage } from "@/server/storage";
import { SocialError } from "./errors";

export interface PrivatePhotoStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
// No public URL, ACL, signed bearer URL, or image-optimizer path is produced.
export const privatePhotoStore: PrivatePhotoStore = {
  async put(key, bytes) {
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
