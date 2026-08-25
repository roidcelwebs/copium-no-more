import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("loading state - shimmer wave", () => {
  test("skeleton component uses shimmer class with slow steady wave", () => {
    const skeleton = read("./skeleton.tsx");
    expect(skeleton).toMatch(/skeleton-shimmer/);
    expect(skeleton).toMatch(/relative overflow-hidden/);
    expect(skeleton).not.toMatch(/animate-pulse/);
  });

  test("styles.css defines shimmer keyframes slow steady left-to-right and respects reduced-motion", () => {
    const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/skeleton-shimmer/);
    expect(css).toMatch(/@keyframes skeleton-shimmer-wave/);
    expect(css).toMatch(/translateX\(-100%\)/);
    expect(css).toMatch(/translateX\(100%\)/);
    expect(css).toMatch(/1\.8s linear infinite/);
    expect(css).toMatch(/prefers-reduced-motion/);
    // No fast animation
    expect(css).not.toMatch(/animation:.*0\.5s/);
  });

  test("loading surfaces use skeleton-shimmer not plain text", () => {
    const chatConv = read("../chat/ChatConversation.tsx");
    const onboarding = read("../../../onboarding-archive/ClientOnboardingChat.tsx");
    const inbox = read("../chat/CoachChatInbox.tsx");
    const history = read("../workout-history/WorkoutHistoryList.tsx");
    const account = read("../account/AccountAccess.tsx");

    [chatConv, onboarding, inbox, history, account].forEach((content) => {
      expect(content).toMatch(/skeleton-shimmer/);
    });
  });
});
