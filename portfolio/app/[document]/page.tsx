import { notFound } from "next/navigation";
import { PortfolioShell } from "@/features/public-demo/public-shell";
import { PublicDocument } from "@/features/public-site/public-document";
import { portfolioDocuments } from "@/features/public-demo/documents";
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(portfolioDocuments).map((document) => ({ document }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const key = (await params).document;
  const doc = portfolioDocuments[key];
  return {
    title: doc?.title,
    description: doc?.intro,
    alternates: { canonical: `/${key}/` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const document = portfolioDocuments[(await params).document];
  if (!document) notFound();
  return (
    <PortfolioShell>
      <PublicDocument document={document} />
    </PortfolioShell>
  );
}
