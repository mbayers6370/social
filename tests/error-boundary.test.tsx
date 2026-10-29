// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import GlobalError from "@/app/global-error";

it("renders a recovery action without exposing raw exception details", () => {
  const markup = renderToStaticMarkup(
    <GlobalError
      error={new Error("database-password-sensitive")}
      retry={vi.fn()}
    />,
  );
  expect(markup).toContain("Try again");
  expect(markup).toContain("<html");
  expect(markup).not.toContain("database-password-sensitive");
  expect(markup).not.toContain("stack");
});
