"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreview } from "@/features/local-preview/provider";
import { previewMessage } from "@/features/local-preview/model";
import { Avatar } from "@/features/feed/post-content";
import { reportReasons } from "./model";
export function SafetySettings() {
  const preview = usePreview();
  const [error, setError] = useState("");
  const blocked = preview.state.friendships
    .filter(
      (pair) =>
        pair.status === "blocked" &&
        pair.blockedBy === preview.bootstrap.viewerId,
    )
    .map((pair) =>
      preview.state.profiles.find(
        (profile) =>
          profile.person.id ===
          pair.people.find((id) => id !== preview.bootstrap.viewerId),
      ),
    )
    .filter((profile) => !!profile);
  return (
    <div id="safety-settings" className="margin-settings-safety">
      <details className="margin-settings-record">
        <summary>
          <span>Blocked people</span>
          <span>{blocked.length}</span>
          <ChevronDown aria-hidden="true" strokeWidth={1.5} />
        </summary>
        <div>
          <p className="margin-field-hint">
            Blocking prevents new requests and messages. Unblocking does not
            restore the friendship.
          </p>
          {!blocked.length ? (
            <p>No blocked people.</p>
          ) : (
            <ul className="margin-blocked-people">
              {blocked.map((profile) => (
                <li key={profile.person.id}>
                  <Avatar person={profile.person} />
                  <span>{profile.person.name}</span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        preview.changeFriend(profile.person.id, "unblock");
                        setError("");
                      } catch (error) {
                        setError(previewMessage(error));
                      }
                    }}
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </details>
      <details className="margin-settings-record">
        <summary>
          <span>Your reports</span>
          <span>{preview.reports.length}</span>
          <ChevronDown aria-hidden="true" strokeWidth={1.5} />
        </summary>
        <div>
          <p className="margin-field-hint">
            Reports saved in this tab are included in your download. Live review
            is not connected.
          </p>
          {!preview.reports.length ? (
            <p>No reports saved in this tab.</p>
          ) : (
            <ul className="margin-saved-reports">
              {preview.reports.map((report) => (
                <li key={report.id}>
                  <strong>{report.target.label}</strong>
                  <span>
                    {
                      reportReasons.find(
                        (reason) => reason.value === report.reason,
                      )?.label
                    }
                  </span>
                  <span className="margin-field-hint">
                    Saved locally ·{" "}
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
