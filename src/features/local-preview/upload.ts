import { PreviewError } from "./model";
import {
  assertStillPhoto,
  PhotoPolicyError,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_DIMENSION,
  PHOTO_MAX_PIXELS,
} from "@/lib/media-policy";
export async function validateLocalPhoto(file: File, description: string) {
  if (!description.trim() || description.trim().length > 300)
    throw new PreviewError("Describe the photograph in 1–300 characters.");
  if (!file.size || file.size > PHOTO_MAX_BYTES)
    throw new PreviewError("Choose a photograph smaller than 8 MB.");
  try {
    assertStillPhoto(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
      file.name,
    );
  } catch (error) {
    throw new PreviewError(
      error instanceof PhotoPolicyError
        ? error.message
        : "That photograph couldn’t be read.",
    );
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PreviewError(
      "That image couldn’t be read. Try another photograph.",
    );
  }
  const { width, height } = bitmap;
  bitmap.close();
  if (
    !width ||
    !height ||
    width > PHOTO_MAX_DIMENSION ||
    height > PHOTO_MAX_DIMENSION ||
    width * height > PHOTO_MAX_PIXELS
  )
    throw new PreviewError(
      "Choose an image up to 10,000 pixels per side and 40 megapixels.",
    );
  return { width, height };
}
