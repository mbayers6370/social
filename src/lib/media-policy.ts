import { isStillJpeg } from "./jpeg-policy";

/** Shared by local selection and future server ingestion. Never trust accept/MIME alone. */
export const PHOTO_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 10_000;
export const PHOTO_MAX_PIXELS = 40_000_000;
export class PhotoPolicyError extends Error {}
const unsupported = () =>
  new PhotoPolicyError(
    "Choose a JPEG, PNG, or WebP photograph. This file type isn’t supported.",
  );
const invalid = () =>
  new PhotoPolicyError(
    "That photograph couldn’t be verified. Export it as a new JPEG or PNG and try again.",
  );
const animated = () =>
  new PhotoPolicyError(
    "Animated images aren’t allowed. Choose a still JPEG, PNG, or WebP photograph.",
  );

export function assertStillPhoto(
  bytes: Uint8Array,
  type: string,
  name: string,
) {
  if (!bytes.length || bytes.length > PHOTO_MAX_BYTES)
    throw new PhotoPolicyError("Choose a photograph smaller than 8 MB.");
  // Phone/file pickers can omit MIME or use the legacy JPEG aliases. Bytes and
  // matching extensions are still checked; an explicitly conflicting MIME fails.
  type = type.trim().toLowerCase();
  if (type.startsWith("video/"))
    throw new PhotoPolicyError(
      "Video files aren’t allowed. Choose a still photograph.",
    );
  if (["image/heic", "image/heif"].includes(type) || /\.hei[cf]$/i.test(name))
    throw new PhotoPolicyError(
      "Export this HEIC/HEIF photograph as a JPEG or PNG and try again.",
    );
  const generic = !type || type === "application/octet-stream";
  if (
    /\.jpe?g$/i.test(name) &&
    (generic || ["image/jpg", "image/pjpeg"].includes(type))
  )
    type = "image/jpeg";
  if (generic && /\.png$/i.test(name)) type = "image/png";
  if (generic && /\.webp$/i.test(name)) type = "image/webp";
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (
    text(4, 4) === "ftyp" &&
    /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(text(8, 4))
  )
    throw new PhotoPolicyError(
      "Export this HEIC/HEIF photograph as a JPEG or PNG and try again.",
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    type === "image/png" &&
    /\.png$/i.test(name) &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
  ) {
    let cursor = 8;
    let image = false;
    while (cursor + 12 <= bytes.length) {
      const length = view.getUint32(cursor);
      const kind = text(cursor + 4, 4);
      if (["acTL", "fcTL", "fdAT"].includes(kind)) throw animated();
      if (length > bytes.length - cursor - 12) throw invalid();
      if (cursor === 8 && (kind !== "IHDR" || length !== 13)) throw invalid();
      if (kind === "IDAT") image = true;
      cursor += length + 12;
      if (kind === "IEND") {
        if (length === 0 && cursor === bytes.length && image) return;
        throw invalid();
      }
    }
  } else if (
    type === "image/webp" &&
    /\.webp$/i.test(name) &&
    bytes.length >= 20 &&
    text(0, 4) === "RIFF" &&
    text(8, 4) === "WEBP" &&
    view.getUint32(4, true) + 8 === bytes.length
  ) {
    let cursor = 12;
    let image = false;
    while (cursor + 8 <= bytes.length) {
      const kind = text(cursor, 4);
      const length = view.getUint32(cursor + 4, true);
      if (
        ["ANIM", "ANMF"].includes(kind) ||
        (kind === "VP8X" && (bytes[cursor + 8] & 2) !== 0)
      )
        throw animated();
      if (length > bytes.length - cursor - 8) throw invalid();
      if (["VP8 ", "VP8L"].includes(kind)) image = true;
      cursor += 8 + length + (length % 2);
    }
    if (cursor === bytes.length && image) return;
  } else if (
    type === "image/jpeg" &&
    /\.jpe?g$/i.test(name) &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    if (
      isStillJpeg(bytes, {
        maxDimension: PHOTO_MAX_DIMENSION,
        maxPixels: PHOTO_MAX_PIXELS,
      })
    )
      return;
    throw new PhotoPolicyError(
      "This JPEG contains unsupported or unreadable image data. Export a still JPEG or PNG from your photo library and try again.",
    );
  }
  throw unsupported();
}
