import { emitLocalEvent } from "./local-events";

export type FinalSequenceLineType = "text" | "external_link" | "popup_link";

export type FinalSequenceLine = {
  id: string;
  type: FinalSequenceLineType;
  text: string;
  url?: string;
};

export type FinalSequenceMessage = {
  id: string;
  lines: FinalSequenceLine[];
};

export type FinalSequenceConfig = {
  version: number;
  updatedAt: string;
  messages: FinalSequenceMessage[];
};

export const FINAL_SEQUENCE_CHANGED_EVENT = "no-more-copium:final-sequence-changed";
export const FINAL_SEQUENCE_STORAGE_KEY = "no-more-copium:final-sequence:v1";
export const FINAL_SEQUENCE_MESSAGE_PREFIX = "__nmc_final_sequence_v1__:";
export const MAX_FINAL_SEQUENCE_MESSAGES = 20;
export const MAX_FINAL_SEQUENCE_LINES = 20;
export const MAX_FINAL_SEQUENCE_TEXT_LENGTH = 2000;
export const MAX_FINAL_SEQUENCE_URL_LENGTH = 2048;

export function createDefaultFinalSequence(): FinalSequenceConfig {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    messages: [
      {
        id: createId(),
        lines: [
          { id: createId(), type: "text", text: "placeholder" },
          { id: createId(), type: "popup_link", text: "placeholder" },
        ],
      },
    ],
  };
}

export function loadFinalSequence(): FinalSequenceConfig {
  if (typeof window === "undefined") return createDefaultFinalSequence();
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(FINAL_SEQUENCE_STORAGE_KEY) ?? "null",
    );
    return isFinalSequenceConfig(parsed) ? parsed : createDefaultFinalSequence();
  } catch {
    return createDefaultFinalSequence();
  }
}

export function saveFinalSequence(messages: FinalSequenceMessage[]): FinalSequenceConfig {
  const error = validateFinalSequence(messages);
  if (error) throw new Error(error);
  const previous = loadFinalSequence();
  const next: FinalSequenceConfig = {
    version: previous.version + 1,
    updatedAt: new Date().toISOString(),
    messages: structuredClone(messages),
  };
  window.localStorage.setItem(FINAL_SEQUENCE_STORAGE_KEY, JSON.stringify(next));
  emitLocalEvent(FINAL_SEQUENCE_CHANGED_EVENT, next);
  return next;
}

export function validateFinalSequence(messages: FinalSequenceMessage[]): string | null {
  if (messages.length < 1) return "Add at least one final-sequence message.";
  if (messages.length > MAX_FINAL_SEQUENCE_MESSAGES) {
    return `Use no more than ${MAX_FINAL_SEQUENCE_MESSAGES} messages.`;
  }
  for (const [messageIndex, message] of messages.entries()) {
    if (message.lines.length < 1) return `Message ${messageIndex + 1} needs at least one line.`;
    if (message.lines.length > MAX_FINAL_SEQUENCE_LINES) {
      return `Message ${messageIndex + 1} has too many lines.`;
    }
    for (const line of message.lines) {
      const text = line.text.trim();
      if (!text) return `Every line in message ${messageIndex + 1} needs visible text.`;
      if (text.length > MAX_FINAL_SEQUENCE_TEXT_LENGTH) {
        return `A line in message ${messageIndex + 1} is too long.`;
      }
      if (line.type === "external_link") {
        const urlError = validateExternalUrl(line.url ?? "");
        if (urlError) return `Message ${messageIndex + 1}: ${urlError}`;
      }
    }
  }
  return null;
}

export function validateExternalUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return "External links need a destination URL.";
  if (candidate.length > MAX_FINAL_SEQUENCE_URL_LENGTH) return "The destination URL is too long.";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? null : "Only secure https:// links are allowed.";
  } catch {
    return "Enter a valid https:// destination URL.";
  }
}

export function encodeFinalSequenceMessage(message: FinalSequenceMessage): string {
  return `${FINAL_SEQUENCE_MESSAGE_PREFIX}${JSON.stringify(message)}`;
}

export function decodeFinalSequenceMessage(value: string): FinalSequenceMessage | null {
  if (!value.startsWith(FINAL_SEQUENCE_MESSAGE_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(value.slice(FINAL_SEQUENCE_MESSAGE_PREFIX.length));
    return isFinalSequenceMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createFinalSequenceMessage(): FinalSequenceMessage {
  return { id: createId(), lines: [{ id: createId(), type: "text", text: "" }] };
}

export function createFinalSequenceLine(type: FinalSequenceLineType): FinalSequenceLine {
  return { id: createId(), type, text: "", url: type === "external_link" ? "" : undefined };
}

function isFinalSequenceConfig(value: unknown): value is FinalSequenceConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<FinalSequenceConfig>;
  return (
    typeof config.version === "number" &&
    typeof config.updatedAt === "string" &&
    Array.isArray(config.messages) &&
    config.messages.length > 0 &&
    config.messages.every(isFinalSequenceMessage)
  );
}

function isFinalSequenceMessage(value: unknown): value is FinalSequenceMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<FinalSequenceMessage>;
  return (
    typeof message.id === "string" &&
    Array.isArray(message.lines) &&
    message.lines.length > 0 &&
    message.lines.every((line) => {
      if (!line || typeof line !== "object") return false;
      const candidate = line as Partial<FinalSequenceLine>;
      return (
        typeof candidate.id === "string" &&
        (candidate.type === "text" ||
          candidate.type === "external_link" ||
          candidate.type === "popup_link") &&
        typeof candidate.text === "string" &&
        (candidate.url === undefined || typeof candidate.url === "string")
      );
    })
  );
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sequence_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
