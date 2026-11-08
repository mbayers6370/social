import { z } from "zod";

export const portraitCropSchema = z.strictObject({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  zoom: z.number().finite().min(1).max(3),
});
// A cache version includes framing numbers as well as the source photograph ID.
export const portraitVersionSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_:.-]+$/);
export type PortraitCrop = z.infer<typeof portraitCropSchema>;
export const DEFAULT_PORTRAIT_CROP: PortraitCrop = { x: 0.5, y: 0.5, zoom: 1 };

export function readPortraitCrop(value: unknown): PortraitCrop {
  const result = portraitCropSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_PORTRAIT_CROP;
}

/** Coordinates describe travel across the spare image, keeping every crop filled. */
export function portraitCropBounds(
  width: number,
  height: number,
  crop: PortraitCrop,
) {
  const side = Math.max(1, Math.floor(Math.min(width, height) / crop.zoom));
  return {
    left: Math.round((width - side) * crop.x),
    top: Math.round((height - side) * crop.y),
    width: side,
    height: side,
  };
}

export function portraitCropVersion(value: unknown) {
  const crop = readPortraitCrop(value);
  return crop.x === 0.5 && crop.y === 0.5 && crop.zoom === 1
    ? ""
    : `:${crop.x}:${crop.y}:${crop.zoom}`;
}
