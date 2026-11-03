import Link from "next/link";
import { Button } from "@/components/ui/button";
export function MessagingOff() {
  return (
    <section
      className="margin-settings-page"
      aria-labelledby="messaging-off-title"
    >
      <header className="margin-settings-opening">
        <h1 id="messaging-off-title">Messaging is off.</h1>
        <p>
          You can turn it back on in Settings to return to your available
          conversations and Notebook.
        </p>
      </header>
      <Button asChild>
        <Link href="/app/settings#messaging-settings">Messaging settings</Link>
      </Button>
    </section>
  );
}
