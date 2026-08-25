import { describe, expect, test } from "bun:test";
import { resolveLandingSectionDrag, resolveLandingSectionWheel } from "./landing-section-scroll";

describe("landing final-section drag ownership", () => {
  test("scrolls deeper when an upward finger drag starts at the top", () => {
    expect(resolveLandingSectionDrag(0, 500, -120)).toEqual({
      scrollTop: 120,
      handToPager: false,
    });
  });

  test("does not jump sections in the gesture that reaches the top", () => {
    expect(resolveLandingSectionDrag(60, 500, 180)).toEqual({
      scrollTop: 0,
      handToPager: false,
    });
  });

  test("hands a separate downward drag at the top to the section pager", () => {
    expect(resolveLandingSectionDrag(0, 500, 80)).toEqual({
      scrollTop: 0,
      handToPager: true,
    });
  });
});

describe("landing final-section wheel ownership", () => {
  test("scrolls down inside the final section", () => {
    expect(resolveLandingSectionWheel(20, 500, 100)).toEqual({
      scrollTop: 120,
      handToPager: false,
    });
  });

  test("first reaches the top without changing sections", () => {
    expect(resolveLandingSectionWheel(20, 500, -100)).toEqual({
      scrollTop: 0,
      handToPager: false,
    });
  });

  test("hands a later upward event at the top to the pager", () => {
    expect(resolveLandingSectionWheel(0, 500, -100)).toEqual({
      scrollTop: 0,
      handToPager: true,
    });
  });
});
