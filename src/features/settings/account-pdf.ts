import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { AccountArchive } from "./account-export";
export type ExportFile = {
  name: string;
  bytes: Uint8Array;
  mime: string;
  description: string;
  preview?: Uint8Array;
};
export async function createAccountPdf(
  archive: AccountArchive,
  fontBytes: Uint8Array,
  files: ExportFile[] = [],
) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(fontBytes, { subset: true });
  const glyphs = new Set(font.getCharacterSet());
  const text = (value: string) =>
    [...value]
      .map((character) =>
        /[\n\r\t]/.test(character) || glyphs.has(character.codePointAt(0)!)
          ? character
          : "?",
      )
      .join("");
  const ink = rgb(48 / 255, 56 / 255, 61 / 255),
    olive = rgb(69 / 255, 77 / 255, 36 / 255);
  let page!: PDFPage,
    y = 0;
  const newPage = () => {
    page = document.addPage([595.28, 841.89]);
    y = 785;
    page.drawText("margin", { x: 48, y: 808, size: 14, font, color: olive });
  };
  const write = (value: string, size = 10.5, color = ink) => {
    const safe = text(value).replace(/\t/g, "    ");
    for (const paragraph of safe.split(/\r?\n/)) {
      const words = paragraph.split(/\s+/);
      let line = "";
      const lines: string[] = [];
      for (let word of words) {
        // Long URLs and unbroken text must wrap without leaving the page.
        while (word && font.widthOfTextAtSize(word, size) > 490) {
          let split = 1;
          while (
            split < word.length &&
            font.widthOfTextAtSize(word.slice(0, split + 1), size) <= 490
          )
            split++;
          if (line) {
            lines.push(line);
            line = "";
          }
          lines.push(word.slice(0, split));
          word = word.slice(split);
        }
        if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > 490) {
          lines.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      lines.push(line);
      for (const line of lines) {
        if (y < 64) newPage();
        page.drawText(line, { x: 48, y, size, font, color });
        y -= size * 1.6;
      }
    }
  };
  newPage();
  write("Your Margin account", 26, olive);
  y -= 12;
  write(`Prepared ${new Date(archive.exportedAt).toISOString().slice(0, 10)}`);
  y -= 12;
  write(
    "Your selected account information. Complete original text is preserved in the attached account-data.json, including symbols this document font cannot display.",
  );
  y -= 14;
  for (const notice of archive.unavailable) write(notice, 9);
  y -= 24;
  const label = (key: string) =>
    key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  const render = (value: unknown, depth = 0) => {
    if (value === null || value === undefined) {
      write("None");
      return;
    }
    if (Array.isArray(value)) {
      if (!value.length) write("No records.");
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          y -= 8;
          write(`Record ${index + 1}`, 10, olive);
        }
        render(item, depth + 1);
      });
      return;
    }
    if (typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (typeof item === "object" && item !== null) {
          write(label(key), 11, olive);
          render(item, depth + 1);
        } else write(`${label(key)}: ${String(item ?? "None")}`);
      }
      return;
    }
    write(String(value));
  };
  for (const [key, value] of Object.entries(archive.data)) {
    if (y < 150) newPage();
    write(label(key), 18, olive);
    y -= 10;
    render(value);
    y -= 24;
  }
  for (const file of files) {
    await document.attach(file.bytes, file.name, {
      mimeType: file.mime,
      description: file.description,
    });
    if (file.preview) {
      newPage();
      write(file.description, 13, olive);
      y -= 12;
      const image = await document.embedPng(file.preview);
      const scale = Math.min(490 / image.width, 660 / image.height);
      page.drawImage(image, {
        x: 48,
        y: y - image.height * scale,
        width: image.width * scale,
        height: image.height * scale,
      });
    }
  }
  await document.attach(
    new TextEncoder().encode(JSON.stringify(archive, null, 2)),
    "account-data.json",
    {
      mimeType: "application/json",
      description: "Complete selected account data",
    },
  );
  for (const [index, item] of document.getPages().entries())
    item.drawText(`${index + 1} / ${document.getPageCount()}`, {
      x: 490,
      y: 28,
      size: 9,
      font,
      color: olive,
    });
  document.setTitle("Your Margin account");
  document.setAuthor("Margin");
  return document.save();
}
