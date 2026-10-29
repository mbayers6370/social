import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest doesn't run Next's static-image loader. Mirror its metadata contract;
// Playwright verifies the real loader, optimized image responses, and rendering.
vi.mock("@/assets/fixtures/fog.jpg", () => ({
  default: { src: "/_next/static/media/fog.test.jpg", width: 640, height: 853 },
}));
vi.mock("@/assets/fixtures/dog.jpg", () => ({
  default: { src: "/_next/static/media/dog.test.jpg", width: 640, height: 427 },
}));
vi.mock("@/assets/fixtures/tea.jpg", () => ({
  default: { src: "/_next/static/media/tea.test.jpg", width: 640, height: 960 },
}));
vi.mock("@/assets/fixtures/Ines_Coffee.jpg", () => ({
  default: {
    src: "/_next/static/media/Ines_Coffee.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/architecture_Mexico.jpg", () => ({
  default: {
    src: "/_next/static/media/architecture_Mexico.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/morning_beach.jpg", () => ({
  default: {
    src: "/_next/static/media/morning_beach.test.jpg",
    width: 640,
    height: 427,
  },
}));
vi.mock("@/assets/fixtures/long-way-round.jpg", () => ({
  default: {
    src: "/_next/static/media/long-way-round.test.jpg",
    width: 640,
    height: 992,
  },
}));
vi.mock("@/assets/fixtures/Okafor-profile.jpg", () => ({
  default: {
    src: "/_next/static/media/Okafor-profile.test.jpg",
    width: 640,
    height: 785,
  },
}));
vi.mock("@/assets/fixtures/Okafor-post.jpg", () => ({
  default: {
    src: "/_next/static/media/Okafor-post.test.jpg",
    width: 640,
    height: 959,
  },
}));
vi.mock("@/assets/fixtures/park-1.jpg", () => ({
  default: {
    src: "/_next/static/media/park-1.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/park-2.jpg", () => ({
  default: {
    src: "/_next/static/media/park-2.test.jpg",
    width: 640,
    height: 427,
  },
}));

afterEach(cleanup);
