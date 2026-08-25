import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { LANDING_TESTIMONIALS } from "./landing-content";

const EXPECTED_TESTIMONIALS = [
  {
    quote: "Hal saved my life",
    name: "Tushar",
  },
  {
    quote:
      "Holy shit I haven’t trained in 2 weeks and my wrists are still 18 cm when I measured. It's not just swelling.",
    name: "Garret",
  },
  {
    quote: "5' 5 - 5' 10 with No More Copium 1-1 coaching. Every dollar was worth it",
    name: "Dylan",
  },
];

describe("landing overhaul content", () => {
  test("preserves all approved testimonials in order", () => {
    expect(LANDING_TESTIMONIALS).toEqual(EXPECTED_TESTIMONIALS);
  });

  test("contains no emojis", () => {
    const content = [
      "LandingPage.tsx",
      "TransformationSection.tsx",
      "RotatingHeadline.tsx",
      "landing-content.ts",
    ]
      .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
      .join("\n");

    expect(content).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("uses no colored Tailwind gradients", () => {
    const content = ["LandingPage.tsx", "TransformationSection.tsx"]
      .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
      .join("\n");
    const gradientTokens = content
      .split(/\s+/)
      .map((token) => token.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g, ""))
      .filter((token) => /^(?:from|via|to)-/.test(token));

    expect(
      gradientTokens.filter(
        (token) => !token.startsWith("from-transparent") && !token.includes("black"),
      ),
    ).toEqual([]);
  });
});
