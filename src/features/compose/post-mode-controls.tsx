"use client";

import { useId, type ReactNode } from "react";

export type PostingAllowance = {
  timeZone?: string;
  regularRemaining: number;
  linkAllowed: boolean;
};

export function PostModeControls({
  mode,
  onChange,
  allowance,
  disabled = false,
  dayLabel = "today",
  unavailable = false,
  statusId,
  avatar,
}: {
  mode: "post" | "link";
  onChange: (mode: "post" | "link") => void;
  allowance?: PostingAllowance;
  disabled?: boolean;
  dayLabel?: string;
  unavailable?: boolean;
  statusId?: string;
  avatar?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="margin-compose-type">
      <div className="margin-compose-avatar">{avatar}</div>
      <div
        className="margin-compose-modes"
        role="group"
        aria-label="Post type"
        data-mode={mode}
      >
        {(["post", "link"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={mode === kind}
            aria-describedby={
              kind === "link" && allowance && !allowance.linkAllowed
                ? `${id}-reason`
                : undefined
            }
            disabled={
              disabled ||
              !allowance ||
              (kind === "link" && !allowance.linkAllowed)
            }
            onClick={() => onChange(kind)}
          >
            {kind === "post" ? "Post" : "Link"}
          </button>
        ))}
      </div>
      <div className="margin-compose-posting-status">
        <p id={statusId} className="margin-field-hint" aria-live="polite">
          {allowance
            ? mode === "link"
              ? `Your only post ${dayLabel}`
              : `${allowance.regularRemaining} left ${dayLabel}`
            : unavailable
              ? "Today’s allowance is unavailable."
              : "Checking today’s allowance…"}
        </p>
      </div>
      {allowance && !allowance.linkAllowed && (
        <p
          id={`${id}-reason`}
          className="margin-compose-limit-reason margin-field-hint"
        >
          {dayLabel === "today"
            ? "You’ve posted today, so links open again tomorrow."
            : `A link must be your only post ${dayLabel}.`}
        </p>
      )}
    </div>
  );
}
