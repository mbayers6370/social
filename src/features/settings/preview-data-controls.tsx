"use client";
import { AccountDownload } from "./account-download";
import { Button } from "@/components/ui/button";
import { ChevronDown, Trash2 } from "lucide-react";
export function PreviewDataControls() {
  return (
    <div
      className="margin-setting-summary margin-settings-data"
      id="download-data"
    >
      <h3 className="sr-only">Your data</h3>
      <AccountDownload />
      <p className="margin-field-hint">
        Choose what to keep. Get a readable PDF or an archive with your original
        photographs.
      </p>
      <details className="margin-settings-record">
        <summary>
          <span>Account removal</span>
          <ChevronDown aria-hidden="true" strokeWidth={1.5} />
        </summary>
        <div>
          <p className="margin-field-hint" id="account-deletion-status">
            Full hosted account erasure is not connected in this preview.
            Deactivation alone does not erase your provider identity, backups or
            copies held by other people.
          </p>
          <Button
            variant="ghost"
            disabled
            aria-describedby="account-deletion-status"
          >
            <Trash2 aria-hidden="true" />
            Delete account · Not available yet
          </Button>
        </div>
      </details>
    </div>
  );
}
