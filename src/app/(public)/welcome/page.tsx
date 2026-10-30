import type { Metadata } from "next";
import { PublicHome } from "@/features/public-site/public-home";
export const metadata: Metadata = {
  title: { absolute: "margin · A small social space for friends" },
  description:
    "Stay close to the lives you care about. Margin is a social space for friends, in development, with a finite feed, photographs and conversations.",
};
export default function Page() {
  return <PublicHome />;
}
