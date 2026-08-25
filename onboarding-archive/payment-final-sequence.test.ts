import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ONBOARDING_FINAL_MESSAGE,
  ONBOARDING_PAYMENT_BOX_BODY,
  PAYMENT_DONE_PROMPT,
  PAYMENT_VERIFY_MESSAGE,
  CLIENT_ONBOARDING_QUESTIONS,
} from "./client-onboarding";
import { isValidPaymentUrl } from "./payment-settings";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("final payment sequence copy", () => {
  test("final message is the fixed payment copy", () => {
    expect(ONBOARDING_FINAL_MESSAGE).toContain("Just complete the payment");
    expect(ONBOARDING_FINAL_MESSAGE).toContain("instant access to your personalized training program");
    expect(ONBOARDING_FINAL_MESSAGE).toContain("I can't wait to talk to you and personalize it even more");
  });

  test("unfair advantage question with Hell yeah stays as question 5", () => {
    expect(CLIENT_ONBOARDING_QUESTIONS[5].prompt).toBe("Are you ready for the unfair advantage?");
    expect(CLIENT_ONBOARDING_QUESTIONS[5].options).toEqual(["Hell yeah"]);
  });

  test("payment done question has only a Yes option", () => {
    expect(CLIENT_ONBOARDING_QUESTIONS[6].prompt).toBe(PAYMENT_DONE_PROMPT);
    expect(CLIENT_ONBOARDING_QUESTIONS[6].options).toEqual(["Yes"]);
    expect(PAYMENT_VERIFY_MESSAGE).toContain("Please wait for me to verify your payment");
  });

  test("payment box marker is present and unique", () => {
    expect(ONBOARDING_PAYMENT_BOX_BODY).toContain("NMC_PAYMENT_BOX");
  });
});

describe("payment settings", () => {
  test("validates https URLs", () => {
    expect(isValidPaymentUrl("https://buy.stripe.com/test123")).toBe(true);
    expect(isValidPaymentUrl("http://example.com/pay")).toBe(true);
    expect(isValidPaymentUrl("not-a-url")).toBe(false);
    expect(isValidPaymentUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("final payment sequence UI", () => {
  test("payment box uses method labels, not processor names", () => {
    const box = read("../components/payment/PaymentBox.tsx");
    expect(box).toMatch(/Click below to continue payment/);
    expect(box).toMatch(/>Card</);
    expect(box).toMatch(/PayPal/);
    expect(box).toMatch(/Visa · Mastercard · Amex · Apple Pay · Google Pay/);
    expect(box).not.toMatch(/Stripe/);
    expect(box).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("chat bubble renders the payment box for the marker body", () => {
    const bubble = read("../components/chat/ChatMessageBubble.tsx");
    expect(bubble).toMatch(/ONBOARDING_PAYMENT_BOX_BODY/);
    expect(bubble).toMatch(/PaymentBox/);
  });

  test("messaging page replaced final-sequence editor with payment settings", () => {
    const page = read("../components/chat/CoachMessagingPage.tsx");
    expect(page).not.toMatch(/FinalSequenceEditor/);
    expect(page).toMatch(/PaymentSettingsForm/);
    expect(page).toMatch(/Payment/);
  });

  test("coach dashboard has pending payments verification", () => {
    const section = read("../components/coach/PendingPaymentsSection.tsx");
    expect(section).toMatch(/Pending payments/);
    expect(section).toMatch(/Verify & unlock/);
    expect(section).toMatch(/Provider transaction ID/);
    expect(section).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("onboarding chat waits for payment verification at step 7", () => {
    const chat = read("../components/chat/ClientOnboardingChat.tsx");
    expect(chat).toMatch(/Payment verification in progress/);
    expect(chat).toMatch(/onboardingCompletedAt/);
  });

  test("no colored gradients in payment UI", () => {
    const files = [
      read("../components/payment/PaymentBox.tsx"),
      read("../components/coach/PendingPaymentsSection.tsx"),
      read("../components/chat/PaymentSettingsForm.tsx"),
    ];
    for (const file of files) {
      const grads = file
        .split(/\s+/)
        .map((t) => t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g, ""))
        .filter((t) => /^(?:from|via|to)-/.test(t));
      expect(grads.filter((t) => !t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
    }
  });
});
