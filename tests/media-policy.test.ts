// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { assertStillPhoto, PhotoPolicyError } from "@/lib/media-policy";
import { imageSchema } from "@/features/feed/schema";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZmcAAAAASUVORK5CYII=",
  "base64",
);
const jpeg = readFileSync(
  new URL("../src/assets/fixtures/fog.jpg", import.meta.url),
);
// Locally generated 2x2 progressive JPEG, with multiple scans and no personal metadata.
const progressive = Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wgARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAVAQEBAAAAAAAAAAAAAAAAAAACA//aAAwDAQACEAMQAAABsCR//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/AP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Qf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Qf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Qf//Z",
  "base64",
);
function jpegSegment(marker: number, payload: Buffer) {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}
function withMetadata(payload: string) {
  return Buffer.concat([
    jpeg.subarray(0, 2),
    jpegSegment(0xe1, Buffer.from(payload)),
    jpeg.subarray(2),
  ]);
}
function mpfPhoto(little: boolean) {
  const payload = Buffer.alloc(86);
  payload.write("MPF\0");
  payload.write(little ? "II" : "MM", 4);
  const u16 = (value: number, at: number) =>
    little
      ? payload.writeUInt16LE(value, at)
      : payload.writeUInt16BE(value, at);
  const u32 = (value: number, at: number) =>
    little
      ? payload.writeUInt32LE(value, at)
      : payload.writeUInt32BE(value, at);
  u16(42, 6);
  u32(8, 8);
  u16(3, 12);
  u16(0xb000, 14);
  u16(7, 16);
  u32(4, 18);
  payload.write("0100", 22);
  u16(0xb001, 26);
  u16(4, 28);
  u32(1, 30);
  u32(2, 34);
  u16(0xb002, 38);
  u16(7, 40);
  u32(32, 42);
  u32(50, 46);
  const primarySize = jpeg.length + payload.length + 4;
  u32(0x00030000, 54);
  u32(primarySize, 58);
  u32(jpeg.length, 74);
  u32(primarySize - 10, 78); // TIFF header starts at byte ten of the full file.
  return Buffer.concat([
    jpeg.subarray(0, 2),
    jpegSegment(0xe2, payload),
    jpeg.subarray(2),
    jpeg,
  ]);
}
it("accepts supported still photos and rejects video, disguised files, and appended payloads", () => {
  expect(() => assertStillPhoto(png, "image/png", "photo.png")).not.toThrow();
  expect(() => assertStillPhoto(jpeg, "image/jpeg", "photo.jpg")).not.toThrow();
  for (const [bytes, type, name] of [
    [png, "video/mp4", "photo.mp4"],
    [png, "image/png", "photo.mov"],
    [Buffer.from("ftypisom VIDEO"), "image/jpeg", "video.jpg"],
    [
      Buffer.concat([jpeg, Buffer.from("ftypisom VIDEO")]),
      "image/jpeg",
      "motion.jpg",
    ],
    [Buffer.concat([png, Buffer.from("VIDEO")]), "image/png", "photo.png"],
    [Buffer.from("GIF89a"), "image/gif", "photo.gif"],
  ] as const)
    expect(() => assertStillPhoto(bytes, type, name)).toThrow(PhotoPolicyError);
  expect(
    imageSchema.safeParse({
      src: "/_next/static/media/clip.mp4",
      width: 100,
      height: 100,
    }).success,
  ).toBe(false);
});
it("rejects APNG, animated WebP, and malformed JPEG data", () => {
  const animation = Buffer.alloc(20);
  animation.writeUInt32BE(8);
  animation.write("acTL", 4);
  const apng = Buffer.concat([
    png.subarray(0, 33),
    animation,
    png.subarray(33),
  ]);
  const webp = Buffer.alloc(30);
  webp.write("RIFF");
  webp.writeUInt32LE(22, 4);
  webp.write("WEBP", 8);
  webp.write("VP8X", 12);
  webp.writeUInt32LE(10, 16);
  webp[20] = 2;
  const motion = Buffer.concat([
    Buffer.from([255, 216, 255, 225]),
    Buffer.from("MotionPhoto"),
  ]);
  expect(() => assertStillPhoto(apng, "image/png", "animated.png")).toThrow(
    /Animated/,
  );
  expect(() => assertStillPhoto(webp, "image/webp", "animated.webp")).toThrow(
    /Animated/,
  );
  expect(() => assertStillPhoto(motion, "image/jpeg", "motion.jpg")).toThrow();
});

it("accepts still JPEG exports with retained motion-photo metadata, but never a video trailer", () => {
  for (const metadata of [
    '<rdf:Description xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" GCamera:MotionPhoto="0" />',
    '<rdf:Description GCamera:MotionPhoto="1" GCamera:MicroVideoOffset="1234" />',
    "<Camera:MicroVideo>0</Camera:MicroVideo>",
  ]) {
    const still = withMetadata(`http://ns.adobe.com/xap/1.0/\0${metadata}`);
    expect(() =>
      assertStillPhoto(still, "image/jpeg", "phone.jpeg"),
    ).not.toThrow();
    expect(() =>
      assertStillPhoto(
        Buffer.concat([still, Buffer.from("ftypisom VIDEO")]),
        "image/jpeg",
        "phone.jpeg",
      ),
    ).toThrow(/Export a still JPEG/);
  }
});

it("accepts phone picker JPEG MIME aliases and absent MIME only with matching extension and contents", () => {
  for (const type of [
    "",
    "application/octet-stream",
    "image/jpg",
    "image/pjpeg",
    " IMAGE/JPEG ",
  ])
    expect(() => assertStillPhoto(jpeg, type, "phone.JPEG")).not.toThrow();
  expect(() => assertStillPhoto(png, "", "photo.png")).not.toThrow();
  expect(() => assertStillPhoto(jpeg, "image/png", "photo.jpg")).toThrow();
  expect(() => assertStillPhoto(png, "", "photo.jpeg")).toThrow();
  expect(() => assertStillPhoto(jpeg, "video/mp4", "photo.jpg")).toThrow(
    /Video files/,
  );
  expect(() => assertStillPhoto(jpeg, "image/heic", "photo.heic")).toThrow(
    /HEIC\/HEIF/,
  );
});

it("accepts MPF-indexed auxiliary JPEG still images in both byte orders", () => {
  for (const little of [false, true])
    expect(() =>
      assertStillPhoto(mpfPhoto(little), "image/jpeg", "hdr.jpeg"),
    ).not.toThrow();
  const thumbnail = Buffer.concat([
    jpeg.subarray(0, 2),
    jpegSegment(0xe1, Buffer.concat([Buffer.from("Exif\0\0"), progressive])),
    jpeg.subarray(2),
  ]);
  expect(() =>
    assertStillPhoto(thumbnail, "image/jpeg", "photo.jpeg"),
  ).not.toThrow();
});

it("accepts progressive JPEG scans and rejects truncated image data", () => {
  expect(() =>
    assertStillPhoto(progressive, "image/jpeg", "photo.jpeg"),
  ).not.toThrow();
  expect(() =>
    assertStillPhoto(progressive.subarray(0, -2), "image/jpeg", "photo.jpeg"),
  ).toThrow();
});

it("rejects concatenated JPEG streams, invalid MPF offsets/counts/sizes, and video hidden behind an MPF index", () => {
  const valid = mpfPhoto(false);
  const primarySize = valid.length - jpeg.length;
  const corruptions: Buffer[] = [
    Buffer.concat([jpeg, jpeg]),
    Buffer.concat([valid, Buffer.from("ftypisom VIDEO")]),
    valid.subarray(0, valid.length - 1),
  ];
  for (const [at, value] of [
    [40, 1000], // Too many indexed images.
    [52, 0xfffffff0], // Index table outside the APP2 segment.
    [64, primarySize - 1], // Incorrect primary size.
    [80, jpeg.length + 1], // Incorrect auxiliary size.
    [84, 0], // Auxiliary overlaps the primary image.
  ]) {
    const corrupt = Buffer.from(valid);
    corrupt.writeUInt32BE(value, at);
    corruptions.push(corrupt);
  }
  const video = Buffer.from(valid);
  video.write("ftypisom", primarySize);
  corruptions.push(video);
  const huge = Buffer.from(valid);
  const auxiliaryFrame = huge.indexOf(Buffer.from([0xff, 0xc0]), primarySize);
  huge.writeUInt16BE(0xffff, auxiliaryFrame + 5);
  corruptions.push(huge);
  for (const bytes of corruptions)
    expect(() => assertStillPhoto(bytes, "image/jpeg", "hdr.jpeg")).toThrow(
      /Export a still JPEG/,
    );
});
