import { redirect } from "next/navigation";
/** Preserve existing links into the old joining page. */
export default function JoinPage() {
  redirect("/sign-up");
}
