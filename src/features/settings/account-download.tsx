"use client";
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePreview } from "@/features/local-preview/provider";
import {
  createAccountArchive,
  accountPhotographs,
  exportSections,
  type ExportSection,
} from "./account-export";
import type { ExportFile } from "./account-pdf";

export function AccountDownload({
  conversationId,
  iconOnly = false,
}: {
  conversationId?: string;
  iconOnly?: boolean;
}) {
  const preview = usePreview();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExportSection[]>(
    conversationId ? ["messages"] : exportSections.map((section) => section.id),
  );
  const [format, setFormat] = useState("archive");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const active = urls.current;
    return () => {
      controller.current?.abort();
      active.forEach((timer, url) => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      });
      active.clear();
    };
  }, []);
  async function download() {
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const archive = createAccountArchive(
        {
          state: preview.state,
          viewerId: preview.bootstrap.viewerId,
          preferences: preview.preferences,
          interactions: preview.interactions,
          notifications: preview.notifications,
          notificationRows: preview.allNotifications,
          threads: preview.threads,
          messageAdditions: preview.messageAdditions,
          messageDrafts: preview.messageDrafts,
          notebookNotes: preview.notebookNotes,
          draft: preview.draft,
          reports: preview.reports,
        },
        selected,
        conversationId,
      );
      let json = JSON.stringify(archive, null, 2);
      let bytes: Uint8Array, mime: string, extension: string;
      if (format === "json") {
        bytes = strToU8(json);
        mime = "application/json";
        extension = "json";
      } else {
        const files: ExportFile[] = [];
        if (selected.includes("photographs")) {
          const photos = accountPhotographs(
            preview.state,
            preview.bootstrap.viewerId,
          );
          for (const [index, photo] of photos.entries()) {
            const src = photo.image.src;
            if (
              !src.startsWith("blob:") &&
              !/^\/_next\/static\/media\/[\w.-]+$/.test(src)
            )
              throw Error("A photograph is unavailable for download.");
            const response = await fetch(src, { signal: abort.signal });
            if (!response.ok)
              throw Error(`Couldn’t read photograph ${index + 1}. Try again.`);
            const blob = await response.blob();
            const ext = blob.type.includes("png")
              ? "png"
              : blob.type.includes("webp")
                ? "webp"
                : "jpg";
            const image = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            const scale = Math.min(
              1,
              1200 / Math.max(image.width, image.height),
            );
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext("2d");
            if (!context) throw Error("Photograph rendering is unavailable.");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            image.close();
            const png = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob(
                (value) =>
                  value
                    ? resolve(value)
                    : reject(Error("Couldn’t prepare a photograph.")),
                "image/png",
              ),
            );
            files.push({
              name: `photographs/${String(index + 1).padStart(3, "0")}-${photo.id}.${ext}`,
              bytes: new Uint8Array(await blob.arrayBuffer()),
              mime: blob.type,
              description: photo.description,
              preview: new Uint8Array(await png.arrayBuffer()),
            });
          }
        }
        if (selected.includes("photographs")) {
          archive.data.originalFiles = files.map(
            ({ name, mime, description }) => ({ name, mime, description }),
          );
          json = JSON.stringify(archive, null, 2);
        }
        const font = await fetch("/fonts/NotoSans-Regular.ttf", {
          signal: abort.signal,
        });
        if (!font.ok)
          throw Error("Couldn’t load the document font. Try again.");
        const { createAccountPdf } = await import("./account-pdf");
        const pdf = await createAccountPdf(
          archive,
          new Uint8Array(await font.arrayBuffer()),
          files,
        );
        if (format === "pdf") {
          bytes = pdf;
          mime = "application/pdf";
          extension = "pdf";
        } else {
          bytes = zipSync(
            {
              "account-data.json": strToU8(json),
              "Your Margin account.pdf": pdf,
              ...Object.fromEntries(
                files.map((file) => [file.name, file.bytes]),
              ),
            },
            { level: 0 },
          );
          mime = "application/zip";
          extension = "zip";
        }
      }
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: mime }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `margin-account-${new Date().toISOString().slice(0, 10)}.${extension}`;
      document.body.append(link);
      link.click();
      link.remove();
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }, 1000);
      urls.current.set(url, timer);
      setOpen(false);
    } catch (error) {
      if (!abort.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Your download couldn’t be prepared. Try again.",
        );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) controller.current?.abort();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={
            iconOnly
              ? "margin-account-export-icon"
              : "margin-settings-action-button"
          }
          aria-label={
            conversationId ? "Export conversation" : "Download your data"
          }
        >
          <Download aria-hidden="true" />
          {!iconOnly && "Download your data"}
        </Button>
      </DialogTrigger>
      <DialogContent className="margin-account-download">
        <DialogTitle>
          {conversationId
            ? "Download this conversation"
            : "Take your account with you"}
        </DialogTitle>
        <DialogDescription>
          Choose what to keep. PDF includes complete data and photographs as
          attachments. ZIP also saves those files separately.
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void download();
          }}
        >
          <fieldset disabled={busy}>
            <legend>Information to include</legend>
            <div className="margin-export-selection-actions">
              <Button
                variant="ghost"
                onClick={() =>
                  setSelected(exportSections.map((section) => section.id))
                }
              >
                Select all
              </Button>
              <Button variant="ghost" onClick={() => setSelected([])}>
                Clear all
              </Button>
            </div>
            <div className="margin-export-categories">
              {exportSections.map((section) => (
                <label key={section.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(section.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, section.id]
                          : current.filter((item) => item !== section.id),
                      )
                    }
                  />
                  <span>
                    <strong>{section.label}</strong>
                    <span>
                      {conversationId && section.id === "messages"
                        ? "Only the conversation you opened this download from."
                        : section.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={busy} className="margin-export-format">
            <legend>Download format</legend>
            {[
              { value: "archive", label: "Complete archive (.zip)" },
              { value: "pdf", label: "PDF with original files attached" },
              { value: "json", label: "JSON records only" },
            ].map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="export-format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={() => setFormat(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <p className="margin-field-hint">
            This workspace contains account preview data. Hosted sign-in and
            server records are not connected. Your download includes the
            selected information available here.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="margin-account-download-footer">
            <Button
              variant="ghost"
              onClick={() => {
                controller.current?.abort();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !selected.length}>
              {busy ? "Preparing download…" : "Download"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
