import { SignIn } from "@clerk/nextjs";
import { SiteHeader } from "@/components/layout/site-header";

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="flex justify-center px-6 py-16"
        tabIndex={-1}
      >
        <SignIn routing="path" path="/sign-in" />
      </main>
    </>
  );
}
