import { notFound, redirect } from "next/navigation";
export const metadata = {
  title: "Spaces preview",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  if ((await searchParams).feed === "1") redirect("/");
  const { SpacesPreview } = await import("@/features/spaces/preview");
  return <SpacesPreview />;
}
