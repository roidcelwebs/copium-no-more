import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("error state final audit", () => {
  test("error page tells what happened why what to do next and has large touch targets", () => {
    const page = read("./error-page.ts");
    expect(page).toMatch(/What happened:/);
    expect(page).toMatch(/Why:/);
    expect(page).toMatch(/What to do next:/);
    expect(page).toMatch(/min-height: 48px/);
    expect(page).toMatch(/rounded.*12px/);
    expect(page).toMatch(/role="alert"/);
    expect(page).not.toMatch(/Something went wrong on our end\. You can try refreshing/); // old vague
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("AccountAccess has inline validation, character counts, and informative errors", () => {
    const file = read("../components/account/AccountAccess.tsx");
    expect(file).toMatch(/validateName/);
    expect(file).toMatch(/validateUsername/);
    expect(file).toMatch(/name.length\/80/);
    expect(file).toMatch(/username.length\/30/);
    expect(file).toMatch(/What happened:/);
    expect(file).toMatch(/Why:/);
    expect(file).toMatch(/What to do:/);
    expect(file).toMatch(/aria-invalid/);
    expect(file).toMatch(/aria-describedby/);
    expect(file).toMatch(/rounded-xl/);
  });

  test("payment settings and pending payments use informative errors with what/why/next", () => {
    const settings = read("../../onboarding-archive/PaymentSettingsForm.tsx");
    const pending = read("../components/coach/PendingPaymentsSection.tsx");
    const broadcast = read("../components/chat/BroadcastComposer.tsx");
    [settings, pending, broadcast].forEach((content) => {
      expect(content).toMatch(/What happened:/);
      expect(content).toMatch(/Why:/);
      expect(content).toMatch(/What to do:/);
    });
    expect(pending).toMatch(/min-h-12/);
    expect(broadcast).toMatch(/min-h-11/);
  });

  test("no raw backend errors exposed in UI - no stack traces", () => {
    const files = [
      "../components/account/AccountAccess.tsx",
      "../components/chat/BroadcastComposer.tsx",
      "../../onboarding-archive/PaymentSettingsForm.tsx",
      "../components/coach/PendingPaymentsSection.tsx",
      "../components/chat/ChatConversation.tsx",
      "../components/chat/CoachChatInbox.tsx",
    ]
      .map(read)
      .join("\n");
    // Should not contain direct raw error.message without wrapping? We allow wrapping but should not have bare technical stack
    expect(files).not.toMatch(/supabase|postgres.*error|stack/iu);
  });

  test("removed prototype features leave no residues", () => {
    // Files deleted with the feature must not exist.
    expect(existsSync(new URL("../components/account/LocalPrototypeTools.tsx", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../lib/local-backup.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../lib/local-prototype-tools.ts", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../components/chat/FinalSequenceEditor.tsx", import.meta.url))).toBe(false);
    // No lingering references in the codebase.
    const sources = [
      "../components/account/SettingsMenu.tsx",
      "../components/chat/CoachMessagingPage.tsx",
      "../lib/chat.ts",
      "../lib/local-media.ts",
    ]
      .map(read)
      .join("\n");
    expect(sources).not.toMatch(/LocalPrototypeTools/);
    expect(sources).not.toMatch(/FinalSequenceEditor/);
    expect(sources).not.toMatch(/resetLocalClientChat/);
    expect(sources).not.toMatch(/clearLocalBlobs/);
    expect(sources).not.toMatch(/Switch local account/);
  });
});
