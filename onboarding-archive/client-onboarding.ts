import { appendLocalChatMessages, ensureChatThread, fetchCoachAccount } from "../src/lib/chat";
import { fetchAccount, updateLocalAccount } from "../src/lib/cloud-accounts";

export const ONBOARDING_FINAL_MESSAGE =
  "Just complete the payment and you'll get instant access to your personalized training program. I can't wait to talk to you and personalize it even more.";

/** Marker body for the payment-box message rendered inside the chat. */
export const ONBOARDING_PAYMENT_BOX_BODY = "\u0000NMC_PAYMENT_BOX\u0000";

export const PAYMENT_DONE_PROMPT = "Are you done with the payment?";

export const PAYMENT_VERIFY_MESSAGE = "Please wait for me to verify your payment.";

export type ClientOnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ClientOnboardingState = {
  threadId: string;
  step: ClientOnboardingStep;
  completedAt?: string;
};

export type ClientOnboardingQuestion = {
  prompt: string;
  options: readonly string[];
};

export const CLIENT_ONBOARDING_QUESTIONS: Record<
  1 | 2 | 3 | 4 | 5 | 6,
  ClientOnboardingQuestion
> = {
  1: {
    prompt: "How many times a week do you usually train?",
    options: ["0–2 times a week", "3–4 times a week", "5–6 times a week"],
  },
  2: {
    prompt: "Do you work out at the gym or at home with no equipment?",
    options: ["Gym", "Home"],
  },
  3: {
    prompt: "How long is your usual workout?",
    options: ["Below 30 minutes", "Around one hour", "1.5–2 hours"],
  },
  4: {
    prompt: "How is your exercise technique/form?",
    options: ["Beginner / not the best", "Experienced / correct form and technique"],
  },
  5: {
    prompt: "Are you ready for the unfair advantage?",
    options: ["Hell yeah"],
  },
  6: {
    prompt: PAYMENT_DONE_PROMPT,
    options: ["Yes"],
  },
};

const READINESS_MESSAGE =
  "Can't wait to see your progress very, very soon, brother. So, are you ready to join No More Copium and get your personalized, unique training system? We can even modify your training program based on anything you let me know later on.";

const RESPONSE_BY_ANSWER: Record<string, string | undefined> = {
  "0–2 times a week":
    "Love your honesty, brother. It doesn't matter if you're struggling with consistency. It doesn't matter if you've never worked out a day in your life. The unique program I'll send you will make sure you start small and slowly turn this into a habit.",
  "3–4 times a week":
    "Three to four times a week is actually enough for you to achieve your goals. Proud of you, brother. We'll still try to progress toward training five to six times a week. However, we'll stick to three to four times a week if that's most convenient for you. After all, your training program will be uniquely personalized to you.",
  "5–6 times a week":
    "Damn, brother. I'm proud and excited to work with you already. Mirin the consistency.",
  Gym: undefined,
  Home: "I've helped clients who could only work out at home, but I still really recommend that you go to the gym. You don't have to stop working out and wait for the gym, though, because I have something really special for you.",
  "Below 30 minutes": "At least you show up, brother. We all start by just showing up.",
  "Around one hour":
    "That's perfect. You'll progress to working out for longer, but one hour is still enough if that's the only convenient option for you.",
  "1.5–2 hours":
    "That's perfect. After all, transforming your body in so many areas will make your workouts long.",
  "Beginner / not the best":
    "We all start with the most atrocious form on every exercise. This is not a problem at all.",
  "Experienced / correct form and technique": "Perfect. That will help you progress even faster.",
};

export async function initializeClientOnboarding(clientId: string): Promise<ClientOnboardingState> {
  const client = await requireClient(clientId);
  const coach = await requireCoach();
  const threadId = await ensureChatThread(clientId);
  if (client.onboardingStep === 0 && !client.onboardingCompletedAt) {
    const now = Date.now();
    await appendLocalChatMessages([
      coachMessage(
        clientId,
        "greeting",
        threadId,
        coach.id,
        `Welcome to No More Copium, ${client.name}.`,
        now,
      ),
      coachMessage(
        clientId,
        "question-1",
        threadId,
        coach.id,
        CLIENT_ONBOARDING_QUESTIONS[1].prompt,
        now + 1,
      ),
    ]);
    await updateLocalAccount(clientId, { onboardingStep: 1 });
    return { threadId, step: 1 };
  }
  return {
    threadId,
    step: normalizeStep(client.onboardingStep),
    completedAt: client.onboardingCompletedAt,
  };
}

export async function answerClientOnboarding(
  clientId: string,
  answer: string,
): Promise<ClientOnboardingState> {
  const client = await requireClient(clientId);
  const coach = await requireCoach();
  const step = normalizeStep(client.onboardingStep);
  if (client.onboardingCompletedAt) throw new Error("Onboarding is already complete.");
  if (step < 1 || step > 6) throw new Error("This onboarding answer is not expected.");
  const question = CLIENT_ONBOARDING_QUESTIONS[step as 1 | 2 | 3 | 4 | 5 | 6];
  if (!question.options.includes(answer)) throw new Error("Choose one of the available options.");

  const threadId = await ensureChatThread(clientId);
  const now = Date.now();
  const messages = [clientMessage(clientId, `answer-${step}`, threadId, answer, now)];

  if (step <= 4) {
    const response = RESPONSE_BY_ANSWER[answer];
    if (response) {
      messages.push(
        coachMessage(
          clientId,
          `response-${step}`,
          threadId,
          coach.id,
          response,
          now + messages.length,
        ),
      );
    }
    if (step === 4) {
      messages.push(
        coachMessage(
          clientId,
          "readiness",
          threadId,
          coach.id,
          READINESS_MESSAGE,
          now + messages.length,
        ),
        coachMessage(
          clientId,
          "question-5",
          threadId,
          coach.id,
          CLIENT_ONBOARDING_QUESTIONS[5].prompt,
          now + messages.length + 1,
        ),
      );
    } else {
      const nextStep = (step + 1) as 2 | 3 | 4;
      messages.push(
        coachMessage(
          clientId,
          `question-${nextStep}`,
          threadId,
          coach.id,
          CLIENT_ONBOARDING_QUESTIONS[nextStep].prompt,
          now + messages.length,
        ),
      );
    }
  } else if (step === 5) {
    // "Hell yeah" → fixed final message + payment box (not coach-editable anymore).
    messages.push(
      coachMessage(
        clientId,
        "final-message",
        threadId,
        coach.id,
        ONBOARDING_FINAL_MESSAGE,
        now + messages.length,
      ),
      coachMessage(
        clientId,
        "payment-box",
        threadId,
        coach.id,
        ONBOARDING_PAYMENT_BOX_BODY,
        now + messages.length + 1,
      ),
    );
  } else if (step === 6) {
    // "Yes" → verification wait message.
    messages.push(
      coachMessage(
        clientId,
        "payment-verify",
        threadId,
        coach.id,
        PAYMENT_VERIFY_MESSAGE,
        now + messages.length,
      ),
    );
  }

  await appendLocalChatMessages(messages);
  const nextStep = (step + 1) as ClientOnboardingStep;
  await updateLocalAccount(clientId, { onboardingStep: nextStep });
  return { threadId, step: nextStep };
}

function coachMessage(
  clientId: string,
  key: string,
  threadId: string,
  coachId: string,
  body: string,
  timestamp: number,
) {
  return {
    id: `onboarding:${clientId}:${key}`,
    threadId,
    senderAccountId: coachId,
    body,
    createdAt: new Date(timestamp).toISOString(),
  };
}

function clientMessage(
  clientId: string,
  key: string,
  threadId: string,
  body: string,
  timestamp: number,
) {
  return {
    id: `onboarding:${clientId}:${key}`,
    threadId,
    senderAccountId: clientId,
    body,
    createdAt: new Date(timestamp).toISOString(),
  };
}

function normalizeStep(value: number): ClientOnboardingStep {
  return Math.max(0, Math.min(7, Math.floor(value || 0))) as ClientOnboardingStep;
}

async function requireClient(clientId: string) {
  const client = await fetchAccount(clientId);
  if (!client || client.role !== "client") throw new Error("Local Client account was not found.");
  return client;
}

async function requireCoach() {
  const coach = await fetchCoachAccount();
  if (!coach) throw new Error("Create a local Coach account before Client onboarding.");
  return coach;
}
