import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("chat system UI overhaul", () => {
  test("message bubbles use reduced corners and 1rem text", () => {
    const bubble = read("./ChatMessageBubble.tsx");
    // Should not have rounded-2xl blob corners for bubbles
    expect(bubble).not.toMatch(/rounded-2xl/);
    expect(bubble).toMatch(/rounded-xl/);
    expect(bubble).toMatch(/text-\[1rem\]/);
    expect(bubble).not.toMatch(/\p{Extended_Pictographic}/u);
    // No colored gradients
    const grads = bubble.split(/\s+/).map(t=>t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g,"")).filter(t=>/^(?:from|via|to)-/.test(t));
    expect(grads.filter(t=>!t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
  });

  test("conversation composer has large touch targets and informative errors", () => {
    const conv = read("./ChatConversation.tsx");
    expect(conv).toMatch(/min-h-12/);
    expect(conv).toMatch(/rounded-xl/);
    // Error should explain what happened why what to do next
    expect(conv).toMatch(/local storage is unavailable or full/);
    expect(conv).toMatch(/Check device storage/);
    expect(conv).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("inbox and chat button badges use reduced corners not rounded-full", () => {
    const inbox = read("./CoachChatInbox.tsx");
    const button = read("./ChatButton.tsx");
    const messaging = read("./CoachMessagingPage.tsx");
    // Inbox badge was rounded-full, now rounded-md
    expect(inbox).toMatch(/rounded-md/);
    expect(inbox).not.toMatch(/Min-w.*rounded-full.*bg-destructive.*text-\[10px\]/);
    expect(button).toMatch(/rounded-md/);
    expect(button).toMatch(/min-h-11/);
    // Messaging tabs should have min-h-11 and 1rem text
    expect(messaging).toMatch(/min-h-11/);
    expect(messaging).toMatch(/text-\[1rem\]/);
  });

  test("no emojis in chat system files", () => {
    ["./ChatMessageBubble.tsx","./ChatConversation.tsx","./CoachChatInbox.tsx","./ChatButton.tsx","./CoachMessagingPage.tsx"].forEach(rel=>{
      const content = read(rel);
      expect(content).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  });
});
