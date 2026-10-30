// @vitest-environment node
import { expect, it } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRawStream,
  PDFString,
  PDFHexString,
  decodePDFRawStream,
} from "pdf-lib";
import { createAccountPdf } from "@/features/settings/account-pdf";
it("creates a paginated PDF with lossless account JSON and original-file attachments", async () => {
  const archive = {
    version: 2,
    scope: "account-preview",
    exportedAt: "2026-10-30T12:00:00Z",
    included: ["profile", "posts"] as ("profile" | "posts")[],
    unavailable: ["Sample account preview."],
    data: {
      profile: { name: "Inès Alvarez", bio: "Morning walks. Good company. 🪴" },
      posts: Array.from({ length: 5 }, (_, index) => ({
        id: `post-${index}`,
        text: "A little of the day, with room for everything else.\nA thought worth keeping. ".repeat(
          10,
        ),
      })),
    },
  };
  const original = new TextEncoder().encode("Original file bytes");
  const bytes = await createAccountPdf(
    archive,
    new Uint8Array(await readFile("public/fonts/NotoSans-Regular.ttf")),
    [
      {
        name: "photographs/original.txt",
        bytes: original,
        mime: "text/plain",
        description: "Original attachment",
      },
    ],
  );
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  const names = pdf.catalog
    .lookup(PDFName.of("Names"), PDFDict)
    .lookup(PDFName.of("EmbeddedFiles"), PDFDict)
    .lookup(PDFName.of("Names"), PDFArray);
  const files = new Map<string, Uint8Array>();
  for (let index = 0; index < names.size(); index += 2) {
    const spec = names.lookup(index + 1, PDFDict);
    const filename = spec.lookup(PDFName.of("F"));
    if (!(filename instanceof PDFString || filename instanceof PDFHexString))
      throw Error("Missing filename");
    const raw = spec.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"));
    if (!(raw instanceof PDFRawStream)) throw Error("Missing attachment");
    files.set(filename.decodeText(), decodePDFRawStream(raw).decode());
  }
  expect(new TextDecoder().decode(files.get("photographs/original.txt"))).toBe(
    "Original file bytes",
  );
  expect(
    JSON.parse(new TextDecoder().decode(files.get("account-data.json"))),
  ).toEqual(archive);
  if (process.env.MARGIN_PDF_SAMPLE === "1") {
    await mkdir("tmp/pdfs", { recursive: true });
    await writeFile("tmp/pdfs/account-sample.pdf", bytes);
  }
});
