import { supabase } from "@/integrations/supabase/client";
import {
  type AppAccount,
  fetchAccount,
  fetchAccounts,
  fetchPublicCoachAccount,
} from "./cloud-accounts";
import { decodeFinalSequenceMessage } from "./final-sequence";
import { emitLocalEvent, LOCAL_CHAT_CHANGED_EVENT } from "./local-events";
import type { ProcessedProgressPicture } from "./progress-picture-processing";
import { supabaseLoose } from "./supabase-loose-client";

export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export type ChatImageAttachment = {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
  imageUrl?: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderAccountId: string;
  body: string;
  attachments?: ChatImageAttachment[];
  createdAt: string;
};

export type CoachChatConversation = {
  client: AppAccount;
  threadId?: string;
  lastMessageBody?: string;
  lastMessageSenderId?: string;
  lastMessageAt?: string;
  unreadMessages: number;
};

export type ChatUnreadSummary = {
  unreadMessages: number;
  unreadClientCount: number;
  byClientId: Record<string, number>;
};

type CloudChatRow = {
  id: string;
  thread_id: string;
  sender_account_id: string;
  body: string;
  created_at: string;
};

function mapMessage(row: CloudChatRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderAccountId: row.sender_account_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function fetchChatUnreadSummary(accountId: string): Promise<ChatUnreadSummary> {
  const { data, error } = await supabaseLoose.rpc("unread_counts", {
    p_account_id: accountId,
  });
  if (error) {
    console.error("Unread summary failed", error);
    return { unreadMessages: 0, unreadClientCount: 0, byClientId: {} };
  }
  const rows = (data ?? []) as unknown as Array<{
    thread_id: string;
    client_id: string;
    unread: number;
  }>;
  const byClientId: Record<string, number> = {};
  for (const row of rows) {
    byClientId[row.client_id] = (byClientId[row.client_id] ?? 0) + Number(row.unread ?? 0);
  }
  return {
    unreadMessages: Object.values(byClientId).reduce((sum, count) => sum + count, 0),
    unreadClientCount: Object.keys(byClientId).length,
    byClientId,
  };
}

export async function fetchCoachChatInbox(coachId: string): Promise<CoachChatConversation[]> {
  const accounts = await fetchAccounts();
  const unread = await fetchChatUnreadSummary(coachId);

  const { data: threads } = await supabase
    .from("chat_threads")
    .select("id, client_id")
    .eq("coach_id", coachId);
  const threadByClient = new Map<string, string>();
  for (const thread of threads ?? []) {
    threadByClient.set(String(thread.client_id), String(thread.id));
  }

  const threadIds = [...threadByClient.values()];
  const lastByThread = new Map<string, CloudChatRow>();
  if (threadIds.length > 0) {
    const { data: latest } = await supabase
      .from("chat_messages")
      .select("id, thread_id, sender_account_id, body, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false })
      .limit(threadIds.length * 2);
    for (const message of latest ?? []) {
      const key = String(message.thread_id);
      if (!lastByThread.has(key)) lastByThread.set(key, message as CloudChatRow);
    }
  }

  return accounts
    .filter((account) => account.role === "client")
    .map((client) => {
      const threadId = threadByClient.get(client.id);
      const latest = threadId ? lastByThread.get(threadId) : undefined;
      return {
        client,
        threadId,
        lastMessageBody: latest ? summarizeMessage(mapMessage(latest)) : undefined,
        lastMessageSenderId: latest?.sender_account_id,
        lastMessageAt: latest?.created_at,
        unreadMessages: unread.byClientId[client.id] ?? 0,
      };
    })
    .sort(
      (left, right) =>
        right.lastMessageAt?.localeCompare(left.lastMessageAt ?? "") ||
        left.client.name.localeCompare(right.client.name),
    );
}

export async function fetchCoachAccount(): Promise<AppAccount | null> {
  return fetchPublicCoachAccount();
}

export async function ensureChatThread(clientId: string): Promise<string> {
  const client = await fetchAccount(clientId);
  const coach = await fetchPublicCoachAccount();
  if (!client || client.role !== "client") throw new Error("Client account was not found.");
  if (!coach) throw new Error("Create a Coach account first.");

  const { data: existing } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return String(existing.id);

  const { data: created, error } = await supabase
    .from("chat_threads")
    .insert({ client_id: clientId, coach_id: coach.id })
    .select("id")
    .maybeSingle();
  if (error || !created) {
    // Race: another tab may have created it — re-read.
    const { data: retry } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (retry) return String(retry.id);
    throw new Error("Chat thread could not be created.");
  }
  return String(created.id);
}

export async function fetchChatMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, thread_id, sender_account_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Chat messages could not be loaded", error);
    return [];
  }
  return (data ?? []).map((row) => mapMessage(row as CloudChatRow));
}

export async function sendChatMessage({
  senderAccountId,
  clientId,
  body,
  messageId = createChatMessageId(),
}: {
  senderAccountId: string;
  clientId: string;
  body: string;
  messageId?: string;
}): Promise<string> {
  const normalized = body.trim();
  if (!normalized || normalized.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error(`Messages must be 1–${MAX_CHAT_MESSAGE_LENGTH} characters.`);
  }
  const sender = await fetchAccount(senderAccountId);
  if (!sender) throw new Error("Sender account was not found.");
  const threadId = await ensureChatThread(clientId);
  const { error } = await supabase.from("chat_messages").insert({
    id: messageId,
    thread_id: threadId,
    sender_account_id: senderAccountId,
    body: normalized,
  });
  if (error) throw new Error("Your message could not be sent.");
  await touchThreadLastMessage(threadId, senderAccountId, normalized);
  emitLocalEvent(LOCAL_CHAT_CHANGED_EVENT);
  return messageId;
}

/**
 * Seeds the single onboarding greeting server-side (idempotent):
 *   "Welcome to No More Copium, {name}. How many times a week do you usually
 *   work out right now, brother?"
 * Sent as the coach in the client's thread; no-op if already seeded.
 */
export async function appendOnboardingGreeting(clientId: string): Promise<void> {
  const { error } = await supabaseLoose.rpc("append_onboarding_greeting", {
    p_client_id: clientId,
  });
  if (error) throw new Error(error.message || "Your welcome message could not be sent.");
}

export async function sendChatImages(_options: {
  senderAccountId: string;
  clientId: string;
  pictures: ProcessedProgressPicture[];
  onProgress?: (completed: number, total: number) => void;
}): Promise<string> {
  throw new Error(
    "Chat images are not supported in the cloud build yet. What happened: image upload was disabled. Why: chat media needs a storage bucket. What to do: use text messages for now.",
  );
}

/**
 * Appends onboarding script messages (both the client's answer and the
 * coach's scripted replies) through the SECURITY DEFINER RPC so the client
 * can write to their own onboarding thread.
 */
export async function appendLocalChatMessages(messages: ChatMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const { data: session } = await supabase.auth.getSession();
  const clientId = messages[0].senderAccountId;
  const clientAccount = await fetchAccount(clientId);
  if (!clientAccount || clientAccount.role !== "client") {
    throw new Error("Onboarding messages require a Client account.");
  }
  const payload = messages.map((message) => ({
    sender: message.senderAccountId,
    body: message.body,
    created_at: message.createdAt,
  }));
  const { error } = await supabaseLoose.rpc("append_onboarding_messages", {
    p_client: clientId,
    p_messages: payload,
  });
  if (error) {
    console.error("Onboarding messages could not be appended", error);
    throw new Error("Your onboarding messages could not be saved.");
  }
  void session;
  emitLocalEvent(LOCAL_CHAT_CHANGED_EVENT);
}

export async function markChatRead(accountId: string, clientId: string): Promise<void> {
  const threadId = await ensureChatThread(clientId);
  const { error } = await supabase.from("chat_reads").upsert(
    {
      thread_id: threadId,
      account_id: accountId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "thread_id,account_id" },
  );
  if (error) console.error("Chat read state could not be saved", error);
}

export function createChatMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `message_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function touchThreadLastMessage(
  threadId: string,
  senderAccountId: string,
  body: string,
): Promise<void> {
  await supabase
    .from("chat_threads")
    .update({
      last_message_body: body.slice(0, 2000),
      last_message_sender_id: senderAccountId,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", threadId);
}

function summarizeMessage(message: ChatMessage): string {
  const structured = decodeFinalSequenceMessage(message.body);
  const structuredText = structured?.lines.map((line) => line.text).join(" · ");
  if (structuredText) return structuredText;
  if (message.body) return message.body;
  const count = message.attachments?.length ?? 0;
  return count ? `Sent ${count} image${count === 1 ? "" : "s"}` : "Message";
}
