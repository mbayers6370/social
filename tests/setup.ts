import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest doesn't run Next's static-image loader. Mirror its metadata contract;
// Playwright verifies the real loader, optimized image responses, and rendering.
vi.mock("@/assets/fixtures/coffee-shop.jpg", () => ({
  default: {
    src: "/_next/static/media/coffee-shop.test.jpg",
    width: 640,
    height: 1138,
  },
}));
vi.mock("@/assets/fixtures/life-happens.jpg", () => ({
  default: {
    src: "/_next/static/media/life-happens.test.jpg",
    width: 640,
    height: 427,
  },
}));
vi.mock("@/assets/fixtures/usual-company.jpg", () => ({
  default: {
    src: "/_next/static/media/usual-company.test.jpg",
    width: 640,
    height: 960,
  },
}));
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
vi.mock("@/assets/fixtures/Theo-profile.jpg", () => ({
  default: {
    src: "/_next/static/media/Theo-profile.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/Theo-Roma-Walk.jpg", () => ({
  default: {
    src: "/_next/static/media/Theo-Roma-Walk.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/Theo-football.jpg", () => ({
  default: {
    src: "/_next/static/media/Theo-football.test.jpg",
    width: 640,
    height: 360,
  },
}));
vi.mock("@/assets/fixtures/mara-profile.jpg", () => ({
  default: {
    src: "/_next/static/media/mara-profile.test.jpg",
    width: 640,
    height: 427,
  },
}));
vi.mock("@/assets/fixtures/mara-photography.jpg", () => ({
  default: {
    src: "/_next/static/media/mara-photography.test.jpg",
    width: 640,
    height: 427,
  },
}));
vi.mock("@/assets/fixtures/mara-photography-2.jpg", () => ({
  default: {
    src: "/_next/static/media/mara-photography-2.test.jpg",
    width: 640,
    height: 853,
  },
}));

vi.mock("@/assets/fixtures/Haddad.jpg", () => ({
  default: {
    src: "/_next/static/media/Haddad.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/Haddad-2.jpg", () => ({
  default: {
    src: "/_next/static/media/Haddad-2.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/Haddad-3.jpg", () => ({
  default: {
    src: "/_next/static/media/Haddad-3.test.jpg",
    width: 640,
    height: 960,
  },
}));
vi.mock("@/assets/fixtures/Haddad-concert.jpg", () => ({
  default: {
    src: "/_next/static/media/Haddad-concert.test.jpg",
    width: 640,
    height: 427,
  },
}));

afterEach(cleanup);
