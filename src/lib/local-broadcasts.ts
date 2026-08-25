import { appendLocalChatMessages, ensureChatThread, type ChatImageAttachment } from "./chat";
import { type AppAccount, fetchAccount } from "./cloud-accounts";
import {
  type FinalSequenceLine,
  type FinalSequenceMessage,
  encodeFinalSequenceMessage,
  validateExternalUrl,
} from "./final-sequence";
import { emitLocalEvent } from "./local-events";
import { putLocalBlob } from "./local-media";
import type { ProcessedProgressPicture } from "./progress-picture-processing";

export type LocalBroadcastRecord = {
  id: string;
  coachId: string;
  recipientIds: string[];
  recipientCount: number;
  sentAt: string;
  summary: string;
};

export const LOCAL_BROADCASTS_CHANGED_EVENT = "no-more-copium:local-broadcasts-changed";
const STORAGE_KEY = "no-more-copium:broadcasts:v1";

export async function sendLocalBroadcast({
  coachId,
  recipientIds,
  text,
  links,
  pictures,
  onProgress,
}: {
  coachId: string;
  recipientIds: string[];
  text: string;
  links: Array<{ id: string; text: string; url: string }>;
  pictures: ProcessedProgressPicture[];
  onProgress?: (completed: number, total: number) => void;
}): Promise<LocalBroadcastRecord> {
  const coach = await fetchAccount(coachId);
  if (!coach || coach.role !== "coach") throw new Error("A local Coach account is required.");
  const uniqueRecipientIds = [...new Set(recipientIds)];
  if (uniqueRecipientIds.length < 1) throw new Error("Choose at least one Client.");
  if (pictures.length > 6) throw new Error("Use no more than six images per broadcast.");

  const normalizedText = text.trim();
  const lines: FinalSequenceLine[] = [];
  if (normalizedText) lines.push({ id: createId(), type: "text", text: normalizedText });
  for (const link of links) {
    const visibleText = link.text.trim();
    if (!visibleText) throw new Error("Every broadcast link needs visible text.");
    const urlError = validateExternalUrl(link.url);
    if (urlError) throw new Error(urlError);
    lines.push({ id: link.id, type: "external_link", text: visibleText, url: link.url.trim() });
  }
  if (!lines.length && !pictures.length) throw new Error("Add text, a link, or an image.");

  const recipients: AppAccount[] = [];
  for (const recipientId of uniqueRecipientIds) {
    const recipient = await fetchAccount(recipientId);
    if (!recipient || recipient.role !== "client")
      throw new Error("A selected Client no longer exists.");
    recipients.push(recipient);
  }

  const broadcastId = createId();
  const sentAt = new Date().toISOString();
  const attachments: ChatImageAttachment[] = [];
  for (let index = 0; index < pictures.length; index += 1) {
    const picture = pictures[index];
    const storageKey = `broadcast-image:${broadcastId}:${picture.id}`;
    await putLocalBlob(storageKey, picture.blob);
    attachments.push({
      id: picture.id,
      storageKey,
      width: picture.width,
      height: picture.height,
      byteSize: picture.byteSize,
      createdAt: sentAt,
    });
    onProgress?.(index + 1, pictures.length);
  }

  const structured: FinalSequenceMessage | null = lines.length
    ? { id: `broadcast-content:${broadcastId}`, lines }
    : null;
  for (const recipient of recipients) {
    const threadId = await ensureChatThread(recipient.id);
    await appendLocalChatMessages([
      {
        id: `broadcast:${broadcastId}:${recipient.id}`,
        threadId,
        senderAccountId: coachId,
        body: structured ? encodeFinalSequenceMessage(structured) : "",
        attachments,
        createdAt: sentAt,
      },
    ]);
  }

  const record: LocalBroadcastRecord = {
    id: broadcastId,
    coachId,
    recipientIds: recipients.map((recipient) => recipient.id),
    recipientCount: recipients.length,
    sentAt,
    summary:
      normalizedText ||
      links[0]?.text.trim() ||
      `Sent ${pictures.length} image${pictures.length === 1 ? "" : "s"}`,
  };
  const history = readHistory();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...history].slice(0, 50)));
  emitLocalEvent(LOCAL_BROADCASTS_CHANGED_EVENT, record);
  return record;
}

export function fetchLocalBroadcastHistory(): LocalBroadcastRecord[] {
  return readHistory();
}

function readHistory(): LocalBroadcastRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as LocalBroadcastRecord[]) : [];
  } catch {
    return [];
  }
}

export function createBroadcastLink(): { id: string; text: string; url: string } {
  return { id: createId(), text: "", url: "" };
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `broadcast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
