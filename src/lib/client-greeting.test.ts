import { describe, expect, test } from "bun:test";
import { getClientGreeting } from "./client-greeting";
import { readFileSync } from "node:fs";

describe("client greeting overhaul", () => {
  test("preserves exact Fighting crime? phrase for 1-5 AM", () => {
    const date = new Date("2026-01-15T03:30:00");
    expect(getClientGreeting("Mike", date)).toBe("Fighting crime? Mike");
  });

  test("uses timezone-aware local hours via Date", () => {
    const morning = new Date("2026-01-15T08:00:00");
    const greeting = getClientGreeting("Alex", morning);
    expect(greeting).toMatch(/Alex/);
    expect(greeting.toLowerCase()).toMatch(/morning|rise/);
  });

  test("does not contain emojis", () => {
    const file = readFileSync(new URL("./client-greeting.ts", import.meta.url), "utf8");
    expect(file).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("client dashboard UI - badge corners and gradients", () => {
  test("Client Preview and Coach Mode badges use reduced corners", () => {
    const clientShell = readFileSync(
      new URL("../components/client/ClientShell.tsx", import.meta.url),
      "utf8",
    );
    const coachShell = readFileSync(
      new URL("../components/coach/CoachShell.tsx", import.meta.url),
      "utf8",
    );
    // Should not have rounded-full for the mode badges
    expect(clientShell).not.toMatch(/Client Preview[\s\S]*?rounded-full/);
    expect(coachShell).not.toMatch(/Coach Mode[\s\S]*?rounded-full/);
    // Should use rounded-md for those badges
    expect(clientShell).toMatch(/rounded-md/);
    expect(coachShell).toMatch(/rounded-md/);
  });

  test("Client dashboard has no colored gradients and large touch targets", () => {
    const dashboard = readFileSync(
      new URL("../components/client/ClientDashboard.tsx", import.meta.url),
      "utf8",
    );
    const progress = readFileSync(
      new URL(
        "../components/client/progress-pictures/ProgressPicturesDashboardSection.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const combined = dashboard + "\n" + progress;
    // No colored Tailwind gradients except black/transparent
    const gradientTokens = combined
      .split(/\s+/)
      .map((t) => t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g, ""))
      .filter((t) => /^(?:from|via|to)-/.test(t));
    expect(gradientTokens.filter((t) => !t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);

    // Large touch targets: min-h-12 or min-h-[56px] present
    expect(combined).toMatch(/min-h-12/);

    // No emojis in dashboard files
    expect(dashboard).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(progress).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
