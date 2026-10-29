import type { Metadata } from "next";
import { PublicHome } from "@/features/public-site/public-home";
export const metadata: Metadata = {
  title: { absolute: "margin · A little less, a little closer." },
  description:
    "A social space for friends. Share a thought, a photograph, a little of your day. Catch up with your people, then get back to living.",
};
export default function Page() {
  return <PublicHome />;
}
