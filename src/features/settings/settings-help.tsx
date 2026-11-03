import Link from "next/link";
import { ChevronRight } from "@/components/margin-icons";
export function SettingsHelp() {
  return (
    <p className="margin-settings-help">
      Something you’re looking for?
      <Link href="/help">
        Help &amp; safety
        <ChevronRight aria-hidden="true" />
      </Link>
    </p>
  );
}
