"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zipSync, strToU8 } from "fflate";
import { ChevronDown, Download, Trash } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSpaceClient } from "@/features/spaces/client";
import {
  exportSections,
  type AccountArchive,
  type ExportSection,
} from "@/features/settings/account-export";
import { requestMember } from "./member-client";
import { SettingsHelp } from "@/features/settings/settings-help";

type SavedExport = {
  exportedAt: string;
  profile: Record<string, unknown>;
  messages: { senderId: string; recipientId: string; [key: string]: unknown }[];
  photos: { id: string; description: string }[];
} & Record<string, unknown>;
const sections = exportSections.filter((section) => section.id !== "drafts");
export function MemberDataControls() {
  const client = useSpaceClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState("archive");
  const [selected, setSelected] = useState<ExportSection[]>(
    sections.map((section) => section.id),
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [removing, setRemoving] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const url = useRef<string | null>(null);
  async function download() {
    if (working) return;
    setWorking(true);
    setError("");
    setStatus("");
    try {
      const saved = await requestMember<SavedExport>(
        client,
        "/api/member/export",
      );
      const data: Record<string, unknown> = {};
      const fields: Partial<Record<ExportSection, string[]>> = {
        posts: ["posts"],
        photographs: ["photos", "gallery"],
        comments: ["comments", "likes"],
        friendships: ["friendships", "blocked"],
        notifications: ["notifications"],
        reports: ["reports"],
      };
      for (const key of selected)
        for (const field of fields[key] ?? []) data[field] = saved[field];
      if (selected.includes("profile"))
        data.profile = {
          displayName: saved.profile.displayName,
          username: saved.profile.username,
          bio: saved.profile.bio,
          portraitPhotoId: saved.profile.portraitPhotoId,
          music: saved.music,
        };
      if (selected.includes("preferences"))
        data.preferences = Object.fromEntries(
          [
            "readingSize",
            "motion",
            "notifyComments",
            "notifyFriends",
            "notifyLikes",
            "notifyMessages",
            "messagingEnabled",
          ].map((key) => [key, saved.profile[key]]),
        );
      if (selected.includes("messages"))
        data.messages = saved.messages.filter(
          (message) => message.senderId !== message.recipientId,
        );
      if (selected.includes("notebook"))
        data.notebook = saved.messages.filter(
          (message) => message.senderId === message.recipientId,
        );
      const archive: AccountArchive = {
        version: 1,
        scope: "authenticated-member",
        exportedAt: saved.exportedAt,
        included: selected,
        unavailable: [
          "Unpublished drafts stay in your browser tab and are excluded. This export contains available account records.",
        ],
        data,
      };
      const files: Record<string, Uint8Array> = {
        "account-data.json": strToU8(JSON.stringify(archive, null, 2)),
      };
      if (format === "archive" && selected.includes("photographs")) {
        let total = 0;
        for (const photo of saved.photos) {
          const response = await client.request(client.photoSrc(photo.id), {
            cache: "no-store",
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok)
            throw Error(
              "A photograph is unavailable. Reload your gallery or download without photographs.",
            );
          const bytes = new Uint8Array(await response.arrayBuffer());
          total += bytes.length;
          if (total > 100 * 1024 * 1024)
            throw Error(
              "This photograph archive needs an assisted export. Contact support@margin.social.",
            );
          files[`photographs/${photo.id}.webp`] = bytes;
        }
      }
      let bytes: Uint8Array;
      let mime: string;
      let extension: string;
      if (format === "pdf") {
        const font = await fetch("/fonts/NotoSans-Regular.ttf");
        if (!font.ok)
          throw Error("Couldn’t load the document font. Try again.");
        const { createAccountPdf } =
          await import("@/features/settings/account-pdf");
        bytes = await createAccountPdf(
          archive,
          new Uint8Array(await font.arrayBuffer()),
        );
        mime = "application/pdf";
        extension = "pdf";
      } else {
        bytes = zipSync(files);
        mime = "application/zip";
        extension = "zip";
      }
      if (url.current) URL.revokeObjectURL(url.current);
      const href = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: mime }),
      );
      url.current = href;
      const link = document.createElement("a");
      link.href = href;
      link.download = `margin-account-${saved.exportedAt.slice(0, 10)}.${extension}`;
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(href);
        if (url.current === href) url.current = null;
      }, 60_000);
      setStatus("Your download is ready.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your download could not be prepared.",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <div
      className="margin-setting-summary margin-settings-data"
      id="download-data"
    >
      <h3 className="sr-only">Your data</h3>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!working) setOpen(value);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline">
            <Download aria-hidden="true" />
            Download your data
          </Button>
        </DialogTrigger>
        <DialogContent showCloseButton={!working}>
          <DialogTitle>Download your data</DialogTitle>
          <DialogDescription>
            Choose what to keep. Get a readable PDF or an archive with your
            photographs.
          </DialogDescription>
          <fieldset disabled={working}>
            <legend>Include</legend>
            {sections.map((section) => (
              <label
                className="margin-notification-preference"
                key={section.id}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(section.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, section.id]
                        : current.filter((id) => id !== section.id),
                    )
                  }
                />
                <span>
                  <strong>{section.label}</strong>
                  <span>{section.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Label htmlFor="member-export-format">Format</Label>
          <select
            id="member-export-format"
            value={format}
            disabled={working}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="archive">Archive with photographs (.zip)</option>
            <option value="pdf">Readable document (.pdf)</option>
          </select>
          <p className="margin-field-hint">
            Unpublished drafts stay in this tab and are excluded.
          </p>
          {error && <p role="alert">{error}</p>}
          <p role="status">{working ? "Preparing your download…" : status}</p>
          <Button
            disabled={working || !selected.length}
            onClick={() => void download()}
          >
            Prepare download
          </Button>
        </DialogContent>
      </Dialog>
      <SettingsHelp />
      <details className="margin-settings-record">
        <summary>
          <span>Account removal</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div>
          <p className="margin-field-hint">
            Deactivation immediately ends access to Margin and removes your
            shared content from view. It does not erase your Clerk identity or
            backups. Contact support@margin.social for complete account erasure.
          </p>
          <Button variant="ghost" onClick={() => setRemoving(true)}>
            <Trash aria-hidden="true" />
            Deactivate account
          </Button>
        </div>
      </details>
      <Dialog
        open={removing}
        onOpenChange={(value) => {
          if (!working) setRemoving(value);
        }}
      >
        <DialogContent role="alertdialog" showCloseButton={!working}>
          <DialogTitle>Deactivate your account?</DialogTitle>
          <DialogDescription>
            Your posts, photographs, messages, and account access will become
            unavailable. This is separate from deleting your Clerk identity and
            backups.
          </DialogDescription>
          <Label htmlFor="deactivate-confirmation">
            Type DEACTIVATE to continue
          </Label>
          <Input
            id="deactivate-confirmation"
            value={confirmation}
            disabled={working}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
          <div className="margin-form-actions">
            <Button
              variant="outline"
              disabled={working}
              onClick={() => setRemoving(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={working || confirmation !== "DEACTIVATE"}
              onClick={async () => {
                setWorking(true);
                setError("");
                try {
                  await requestMember(client, "/api/account", {
                    method: "DELETE",
                  });
                  router.replace("/onboarding");
                  router.refresh();
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Couldn’t deactivate this account.",
                  );
                } finally {
                  setWorking(false);
                }
              }}
            >
              Deactivate account
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
