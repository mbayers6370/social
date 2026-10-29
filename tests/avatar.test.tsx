import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Avatar } from "@/features/feed/post-content";

it.each([false, true])(
  "includes the centered circular crop in server markup before image load or stylesheet arrival (small: %s)",
  (small) => {
    const html = renderToStaticMarkup(
      <Avatar
        small={small}
        person={{
          id: "ines",
          name: "Ines",
          initials: "IA",
          tone: "paper",
          photo: {
            src: "/_next/static/media/portrait.test.jpg",
            width: 640,
            height: 960,
          },
        }}
      />,
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const frame = document.querySelector<HTMLElement>(".margin-avatar")!;
    const image = frame.querySelector("img")!;
    // These are actual server-rendered styles; no stylesheet, hydration or load event is involved.
    expect(frame.style.width).toBe(
      `var(--margin-avatar-size, ${small ? 29 : 40}px)`,
    );
    expect(frame.style.height).toBe(frame.style.width);
    expect(frame.style.position).toBe("relative");
    expect(frame.style.overflow).toBe("hidden");
    expect(frame.style.borderRadius).toBe("50%");
    expect(frame.style.clipPath).toBe("circle(50%)");
    expect(image.style.borderRadius).toBe("50%");
    expect(image.style.clipPath).toBe("circle(50%)");
    expect(image.style.objectFit).toBe("cover");
    expect(image.style.objectPosition).toBe("center");
    expect(image.getAttribute("data-nimg")).toBe("fill");
  },
);
