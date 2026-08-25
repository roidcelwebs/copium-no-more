import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("workout history UI overhaul - list and calendar", () => {
  test("list and calendar views use reduced corners and large touch targets", () => {
    const file = read("./WorkoutHistoryList.tsx");
    expect(file).toMatch(/rounded-xl/);
    expect(file).toMatch(/min-h-11/);
    expect(file).toMatch(/min-h-\[72px\]/);
    expect(file).toMatch(/text-\[1rem\]/);
    expect(file).toMatch(/CalendarDays/);
    // Should have both view modes
    expect(file).toMatch(/list/);
    expect(file).toMatch(/calendar/);
    // Badge should be rounded-md not rounded-full blob for count
    expect(file).toMatch(/rounded-md bg-primary/);
    expect(file).not.toMatch(/rounded-full border border-border bg-muted px-2 py-0\.5 text-\[10px\]/);
    expect(file).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("no colored gradients in history", () => {
    const file = read("./WorkoutHistoryList.tsx");
    const grads = file.split(/\s+/).map(t=>t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g,"")).filter(t=>/^(?:from|via|to)-/.test(t));
    expect(grads.filter(t=>!t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
  });
});
