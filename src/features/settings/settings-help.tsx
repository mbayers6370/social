import Link from "next/link";
import { publicDemo } from "@/lib/public-demo";
import { ChevronRight } from "@/components/margin-icons";
export function SettingsHelp() {
  if (publicDemo) return null;
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
