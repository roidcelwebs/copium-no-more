import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("guided workout mode UI overhaul", () => {
  test("PerformPanel and RestPanel use reduced corners and large touch targets", () => {
    const file = read("./WorkoutPreview.tsx");
    expect(file).toMatch(/PerformPanel/);
    expect(file).toMatch(/min-h-12/);
    expect(file).toMatch(/rounded-xl/);
    expect(file).toMatch(/text-\[1rem\]/);
    expect(file).not.toMatch(/rounded-full border border-border bg-muted px-2 py-0\.5 text-\[10px\]/);
    expect(file).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
