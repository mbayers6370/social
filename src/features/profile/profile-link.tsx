"use client";

import { useEffect, useRef, useState } from "react";
import { Link as LinkIcon } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewHref } from "@/lib/public-demo";
import { sharedProfilePath } from "@/lib/profile-links";
export function ProfileLink({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="margin-profile-link">
      <Button
        variant="outline"
        aria-label="Copy profile link"
        title="Copy profile link"
        onClick={async () => {
          const link = new URL(
            previewHref(sharedProfilePath(username)),
            window.location.origin,
          ).href;
          setCopied(false);
          clearTimeout(timer.current);
          try {
            await navigator.clipboard.writeText(link);
            setManualLink("");
            setCopied(true);
            timer.current = setTimeout(() => setCopied(false), 2000);
          } catch {
            setManualLink(link);
          }
        }}
      >
        <LinkIcon aria-hidden="true" />
        Copy profile link
      </Button>
      <span role="status" className="margin-field-hint">
        {copied
          ? "Link copied."
          : manualLink
            ? "Select and copy your profile link."
            : ""}
      </span>
      {manualLink && (
        <Input
          aria-label="Profile link"
          value={manualLink}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
