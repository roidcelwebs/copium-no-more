import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("classic workout mode UI overhaul", () => {
  test("ClassicSetRow uses reduced corners and large touch targets", () => {
    const file = read("./WorkoutPreview.tsx");
    // Should have rounded-xl for set rows, not just rounded-md blob? The row itself is rounded-xl now
    expect(file).toMatch(/ClassicSetRow/);
    expect(file).toMatch(/rounded-xl border p-4/);
    // Chips should be rounded-md not rounded-full
    expect(file).toMatch(/rounded-md border border-border bg-muted px-2\.5 py-1 text-\[0\.75rem\]/);
    // Should have min-h-12 for inputs
    expect(file).toMatch(/min-h-12 rounded-xl/);
    expect(file).toMatch(/text-\[1rem\]/);
    // No emojis
    expect(file).not.toMatch(/\p{Extended_Pictographic}/u);
    // No colored gradients
    const grads = file.split(/\s+/).map(t=>t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g,"")).filter(t=>/^(?:from|via|to)-/.test(t));
    expect(grads.filter(t=>!t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
  });

  test("PreviewHeader and ModeChooser use 1rem and large touch targets", () => {
    const file = read("./WorkoutPreview.tsx");
    expect(file).toMatch(/min-h-11 min-w-11 rounded-xl/);
    expect(file).toMatch(/text-\[1\.125rem\]/);
    expect(file).toMatch(/text-\[1rem\]/);
  });
});
