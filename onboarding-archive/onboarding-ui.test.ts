import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("onboarding UI overhaul", () => {
  test("onboarding chat uses large touch targets and reduced blob corners", () => {
    const onboarding = read("./ClientOnboardingChat.tsx");
    // Should use rounded-xl not rounded-2xl blob
    expect(onboarding).not.toMatch(/rounded-2xl/);
    expect(onboarding).toMatch(/rounded-xl/);
    expect(onboarding).toMatch(/min-h-12/);
    expect(onboarding).toMatch(/text-\[1rem\]/);
    // Safe-area handling
    expect(onboarding).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(onboarding).toMatch(/env\(safe-area-inset-top\)/);
    // Error messages explain what happened why what to do next
    expect(onboarding).toMatch(/local chat storage is unavailable/);
    expect(onboarding).toMatch(/Check device storage/);
    expect(onboarding).not.toMatch(/\p{Extended_Pictographic}/u);
    // No colored gradients
    const grads = onboarding.split(/\s+/).map(t=>t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g,"")).filter(t=>/^(?:from|via|to)-/.test(t));
    expect(grads.filter(t=>!t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
  });

  test("preserves exact Mirin spelling requirement in onboarding spec docs", () => {
    const spec = read("../docs/ONBOARDING_DISCUSSION_SPEC.md");
    expect(spec).toMatch(/Mirin/);
  });
});
