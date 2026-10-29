import type { Metadata } from "next";
import { PublicDocument } from "@/features/public-site/public-document";
import { publicDocuments } from "@/features/public-site/documents";
const document = publicDocuments["privacy"];
export const metadata: Metadata = {
  title: document.title,
  description: document.intro,
};
export default function Page() {
  return <PublicDocument document={document} />;
}
