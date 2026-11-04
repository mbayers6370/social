"use client";

import { useEffect, useState } from "react";

export type SettingFeedback = {
  key: string;
  state: "saving" | "saved";
} | null;

export function useSettingFeedback() {
  const [feedback, setFeedback] = useState<SettingFeedback>(null);
  useEffect(() => {
    if (feedback?.state !== "saved") return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);
  return [feedback, setFeedback] as const;
}

export function SettingSaveStatus({
  setting,
  feedback,
}: {
  setting: string;
  feedback?: SettingFeedback;
}) {
  return (
    <span
      role={feedback?.key === setting ? "status" : undefined}
      className="margin-setting-save-status"
    >
      {feedback?.key === setting
        ? feedback.state === "saving"
          ? "Saving…"
          : "Saved"
        : ""}
    </span>
  );
}
