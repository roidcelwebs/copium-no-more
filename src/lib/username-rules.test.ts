import { describe, expect, test } from "bun:test";
import {
  normalizeUsername,
  usernameKey,
  validateUsername,
} from "./cloud-accounts";

describe("username rules — lowercase a–z, 0–9, underscore ONLY", () => {
  test("accepts lowercase letters, numbers, and underscores", () => {
    expect(validateUsername("john")).toBeNull();
    expect(validateUsername("john_doe")).toBeNull();
    expect(validateUsername("abc123")).toBeNull();
    expect(validateUsername("_underscore_")).toBeNull();
    expect(validateUsername("a1_b2c3")).toBeNull();
  });

  test("rejects UPPERCASE letters (new rule)", () => {
    expect(validateUsername("John")).not.toBeNull();
    expect(validateUsername("ABC123")).not.toBeNull();
    expect(validateUsername("a1_b2C3")).not.toBeNull();
    expect(validateUsername("JOHN_1")).not.toBeNull();
  });

  test("rejects spaces, symbols, and non-English characters", () => {
    expect(validateUsername("john doe")).not.toBeNull();
    expect(validateUsername("john-doe")).not.toBeNull();
    expect(validateUsername("john@doe")).not.toBeNull();
    expect(validateUsername("john.doe")).not.toBeNull();
    expect(validateUsername("আব্দুল")).not.toBeNull();
    expect(validateUsername("héllo")).not.toBeNull();
  });

  test("enforces 3–30 length", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("")).not.toBeNull();
    expect(validateUsername("a".repeat(31))).not.toBeNull();
    expect(validateUsername("a".repeat(30))).toBeNull();
  });

  test("normalize trims but preserves case; key is case-insensitive", () => {
    expect(normalizeUsername("  john_1  ")).toBe("john_1");
    expect(usernameKey("John_1")).toBe("john_1");
    expect(usernameKey("JOHN_1")).toBe("john_1");
    expect(usernameKey("john_1")).toBe("john_1");
  });
});
