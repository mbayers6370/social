type MpfSegment = { start: number; end: number };
type JpegImage = { end: number; mpf?: MpfSegment };
type JpegLimits = { maxDimension: number; maxPixels: number };

function invalid(): never {
  throw new Error("Invalid JPEG structure");
}

/** Walk markers, skipping bounded metadata (which may contain EXIF thumbnails). */
function readJpeg(
  bytes: Uint8Array,
  start: number,
  end: number,
  limits: JpegLimits,
): JpegImage {
  if (end > bytes.length || bytes[start] !== 0xff || bytes[start + 1] !== 0xd8)
    invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = start + 2;
  let inScan = false;
  let scanned = false;
  let frame = false;
  let mpf: MpfSegment | undefined;
  while (cursor < end) {
    if (bytes[cursor++] !== 0xff) {
      if (inScan) continue;
      invalid();
    }
    while (cursor < end && bytes[cursor] === 0xff) cursor++;
    if (cursor >= end) invalid();
    const marker = bytes[cursor++];
    if (inScan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7)))
      continue;
    if (marker === 0xd9) {
      if (!scanned || !frame) invalid();
      return { end: cursor, mpf };
    }
    if (marker === 1) continue; // Standalone temporary marker.
    if (marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7))
      invalid();
    inScan = false;
    if (cursor + 2 > end) invalid();
    const length = view.getUint16(cursor);
    if (length < 2 || cursor + length > end) invalid();
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      if (frame || length < 11) invalid();
      const components = bytes[cursor + 7];
      if (!components || components > 4 || length !== 8 + 3 * components)
        invalid();
      const height = view.getUint16(cursor + 3);
      const width = view.getUint16(cursor + 5);
      if (
        !width ||
        !height ||
        width > limits.maxDimension ||
        height > limits.maxDimension ||
        width * height > limits.maxPixels
      )
        invalid();
      frame = true;
    }
    if (marker === 0xda) {
      const components = bytes[cursor + 2];
      if (
        !frame ||
        !components ||
        components > 4 ||
        length !== 6 + 2 * components
      )
        invalid();
      inScan = true;
      scanned = true;
    }
    if (
      marker === 0xe2 &&
      length >= 6 &&
      bytes[cursor + 2] === 0x4d &&
      bytes[cursor + 3] === 0x50 &&
      bytes[cursor + 4] === 0x46 &&
      bytes[cursor + 5] === 0
    ) {
      if (mpf) invalid();
      mpf = { start: cursor + 6, end: cursor + length };
    }
    cursor += length;
  }
  return invalid();
}

/** MPF offsets are relative to its TIFF header, except the primary image's zero offset. */
function readMpf(bytes: Uint8Array, segment: MpfSegment) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const base = segment.start;
  const bounded = (offset: number, length: number) => {
    if (offset < base || offset + length > segment.end) invalid();
    return offset;
  };
  const order = view.getUint16(bounded(base, 8));
  if (order !== 0x4949 && order !== 0x4d4d) invalid();
  const little = order === 0x4949;
  const u16 = (offset: number) => view.getUint16(bounded(offset, 2), little);
  const u32 = (offset: number) => view.getUint32(bounded(offset, 4), little);
  if (u16(base + 2) !== 42 || u32(base + 4) < 8) invalid();
  const directory = base + u32(base + 4);
  const entries = u16(directory);
  const directoryEnd = directory + 2 + entries * 12 + 4;
  bounded(directory, directoryEnd - directory);
  let count: number | undefined;
  let table = 0;
  let tableBytes = 0;
  for (let entry = directory + 2; entry < directoryEnd - 4; entry += 12) {
    const tag = u16(entry);
    if (tag === 0xb001) {
      if (count !== undefined || u16(entry + 2) !== 4 || u32(entry + 4) !== 1)
        invalid();
      count = u32(entry + 8);
    } else if (tag === 0xb002) {
      if (table || u16(entry + 2) !== 7) invalid();
      tableBytes = u32(entry + 4);
      table = base + u32(entry + 8);
    }
  }
  // Bounded still-image auxiliaries, not arbitrary concatenated JPEG/video streams.
  if (
    count === undefined ||
    count < 2 ||
    count > 8 ||
    !table ||
    tableBytes !== count * 16
  )
    invalid();
  if (table < directoryEnd) invalid();
  bounded(table, tableBytes);
  return Array.from({ length: count }, (_, index) => {
    const entry = table + index * 16;
    if ((u32(entry) & 0x07000000) !== 0) invalid(); // JPEG image format only.
    const offset = u32(entry + 8);
    if (index === 0 && offset !== 0) invalid();
    return { start: index === 0 ? 0 : base + offset, size: u32(entry + 4) };
  });
}

/** HDR JPEGs may contain MPF-indexed auxiliary still images; no video trailer is allowed. */
export function isStillJpeg(bytes: Uint8Array, limits: JpegLimits): boolean {
  try {
    const primary = readJpeg(bytes, 0, bytes.length, limits);
    // Motion-photo XMP can survive a still export, so flags alone cannot reject it.
    if (primary.end === bytes.length) return true;
    if (!primary.mpf) return false;
    const images = readMpf(bytes, primary.mpf);
    if (images[0].size !== primary.end) return false;
    let cursor = primary.end;
    for (const image of images.slice(1)) {
      if (image.start < cursor || image.start + image.size > bytes.length)
        return false;
      if (bytes.subarray(cursor, image.start).some((byte) => byte !== 0))
        return false;
      const secondary = readJpeg(
        bytes,
        image.start,
        image.start + image.size,
        limits,
      );
      if (secondary.end !== image.start + image.size) return false;
      cursor = secondary.end;
    }
    return cursor === bytes.length;
  } catch {
    return false;
  }
}
