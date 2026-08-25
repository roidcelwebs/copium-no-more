import { supabase } from "@/integrations/supabase/client";
import { type AppAccount } from "./cloud-accounts";
import { supabaseLoose } from "./supabase-loose-client";

/**
 * One-time access codes (voucher flow).
 *
 * Lifecycle (server-enforced in the `access-codes` / `redeem-access-code` /
 * `create-client-account` edge functions + DB):
 *   created → (client submits valid code) → redeemed + 30-min one-time ticket
 *   → (client finishes Google sign-up + name/username) → used (dead forever).
 * States that end a code early: locked (5 wrong attempts), expired (72h), revoked.
 *
 * The browser only ever sees: the plaintext at generation (one-time reveal),
 * and the 64-hex ticket after redeeming. Codes are stored bcrypt-hashed.
 */

export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_RAW_LENGTH = 12;
export const ACCESS_CODE_GROUP_LENGTH = 4;
export const ACCESS_CODE_MAX_ATTEMPTS = 5;
export const ACCESS_CODE_DEFAULT_EXPIRY_HOURS = 72;
export const ACCESS_CODE_TICKET_TTL_SECONDS = 1800;
export const ACCESS_CODE_TICKET_STORAGE_KEY = "no-more-copium:access-ticket:v1";

export type AccessCodeExpiryHours = 24 | 72 | 168 | 720;

export type AccessCodeStatus =
  | "active"
  | "redeemed"
  | "used"
  | "expired"
  | "revoked"
  | "locked";

export type AccessCodeEvent = {
  event: string;
  actor: string;
  createdAt: string;
  detail?: string;
};

export type AccessCodeSummary = {
  id: string;
  prefix: string;
  note: string;
  createdAt: string;
  expiresAt: string;
  status: AccessCodeStatus;
  failedAttempts: number;
  redeemedAt?: string;
  usedAt?: string;
  revokedAt?: string;
  events: AccessCodeEvent[];
};

export type RedeemAccessCodeResult = {
  ticket: string;
  expiresInSeconds: number;
};

/** Strip separators/whitespace and upper-case (client-side nicety; server normalizes too). */
export function normalizeAccessCode(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** "7F2KQ9Z4M8XT" → "7F2K-Q9Z4-M8XT" (does not mutate stored value). */
export function formatAccessCode(value: string): string {
  const normalized = normalizeAccessCode(value);
  return normalized.replace(
    new RegExp(`(.{${ACCESS_CODE_GROUP_LENGTH}})(?=.)`, "g"),
    "$1-",
  );
}

/** True only for exactly 12 chars drawn from the unambiguous alphabet. */
export function isValidAccessCodeFormat(value: string): boolean {
  const normalized = normalizeAccessCode(value);
  return new RegExp(`^[${ACCESS_CODE_ALPHABET}]{${ACCESS_CODE_RAW_LENGTH}}$`).test(
    normalized,
  );
}

/**
 * Client name rule (chosen by the client at sign-up):
 * 1–80 chars after collapsing whitespace; numbers and spaces allowed;
 * control characters rejected.
 */
export function validateName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return "Enter your name.";
  if (name.length > 80) return "Your name must be 80 characters or less.";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(name)) {
    return "Your name contains characters that are not allowed.";
  }
  return null;
}

/** Client-side status derivation mirror for the coach list (server is authoritative). */
export function deriveAccessCodeStatus(input: {
  expiresAt: string;
  failedAttempts: number;
  redeemedAt?: string;
  usedAt?: string;
  revokedAt?: string;
}): AccessCodeStatus {
  if (input.revokedAt) return "revoked";
  if (input.usedAt) return "used";
  if (input.redeemedAt) return "redeemed";
  if (input.failedAttempts >= ACCESS_CODE_MAX_ATTEMPTS) return "locked";
  if (new Date(input.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

function invokeError(data: { error?: string; message?: string } | null, fallback: string): Error {
  return new Error(data?.error ?? data?.message ?? fallback);
}

function edgeError(
  error: { message: string; context?: { message?: string } },
  fallback: string,
): Error {
  const message = error.context?.message ?? error.message;
  return new Error(message || fallback);
}

/** Step 1 of the client flow: submit the code → cloud validates and burns it, returns a ticket. */
export async function redeemAccessCode(code: string): Promise<RedeemAccessCodeResult> {
  const { data, error } = await supabase.functions.invoke("redeem-access-code", {
    body: { code },
  });
  if (error) throw edgeError(error, "That code could not be checked. Try again.");
  if (!data?.ok || typeof data.ticket !== "string") {
    throw invokeError(data, "That code could not be checked. Try again.");
  }
  return {
    ticket: data.ticket,
    expiresInSeconds: Number(data.expiresIn ?? ACCESS_CODE_TICKET_TTL_SECONDS),
  };
}

/** Step 2 of the client flow: after Google sign-up, create the account with the ticket. */
export async function createClientAccount(input: {
  name: string;
  username: string;
  ticket: string;
}): Promise<AppAccount> {
  const { data, error } = await supabase.functions.invoke("create-client-account", {
    body: input,
  });
  if (error) throw edgeError(error, "Your account could not be created.");
  if (!data?.ok || !data?.account?.id) {
    throw invokeError(data, "Your account could not be created.");
  }
  return data.account as AppAccount;
}

/** Coach: create a code. The plaintext code is returned exactly once. */
export async function createAccessCode(input: {
  note?: string;
  expiryHours: AccessCodeExpiryHours;
}): Promise<{ id: string; code: string }> {
  const { data, error } = await supabase.functions.invoke("access-codes", {
    body: { action: "create", ...input },
  });
  if (error) throw edgeError(error, "The access code could not be generated.");
  if (!data?.ok || typeof data.code !== "string") {
    throw invokeError(data, "The access code could not be generated.");
  }
  return { id: String(data.id), code: data.code };
}

/** Coach: list codes with status (never contains plaintext or hashes). */
export async function listAccessCodes(): Promise<AccessCodeSummary[]> {
  const { data, error } = await supabase.functions.invoke("access-codes", {
    body: { action: "list" },
  });
  if (error) throw edgeError(error, "Access codes could not be loaded.");
  if (!data?.ok || !Array.isArray(data.codes)) {
    throw invokeError(data, "Access codes could not be loaded.");
  }
  return data.codes as AccessCodeSummary[];
}

/** Coach: revoke an active code. */
export async function revokeAccessCode(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("access-codes", {
    body: { action: "revoke", id },
  });
  if (error) throw edgeError(error, "The access code could not be revoked.");
  if (!data?.ok) throw invokeError(data, "The access code could not be revoked.");
}

/** Coach: master-password login (replaces the old Google-based coach identity). */
export async function loginCoach(password: string): Promise<{
  session: { access_token: string; refresh_token: string };
  account: AppAccount;
}> {
  const { data, error } = await supabase.functions.invoke("coach-login", {
    body: { password },
  });
  if (error) throw edgeError(error, "Sign in failed.");
  if (!data?.ok || !data?.session?.access_token || !data?.account?.id) {
    throw invokeError(data, "Sign in failed.");
  }
  return data as { session: { access_token: string; refresh_token: string }; account: AppAccount };
}

/**
 * One-time sign-up ticket storage (sessionStorage — dies with the tab).
 * The ticket survives the Google OAuth detour so the client can finish
 * account creation after the code was already burned.
 */

type StoredAccessTicket = { ticket: string; expiresAt: number };

export function storeAccessTicket(ticket: string, expiresInSeconds: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      ACCESS_CODE_TICKET_STORAGE_KEY,
      JSON.stringify({ ticket, expiresAt: Date.now() + expiresInSeconds * 1000 }),
    );
  } catch {
    // sessionStorage unavailable — account creation will fail with a clear error
  }
}

/** Returns the ticket if present and unexpired (and removes it if expired). */
export function readAccessTicket(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACCESS_CODE_TICKET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAccessTicket;
    if (typeof parsed?.ticket !== "string" || Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(ACCESS_CODE_TICKET_STORAGE_KEY);
      return null;
    }
    return parsed.ticket;
  } catch {
    return null;
  }
}

export function clearAccessTicket(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ACCESS_CODE_TICKET_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Coach: publish the client's program snapshot from the library (B1 RPC). */
export async function publishClientProgram(clientId: string): Promise<void> {
  const { error } = await supabaseLoose.rpc("publish_client_program", { p_client_id: clientId });
  if (error) throw new Error(error.message || "The program snapshot could not be published.");
}

/** Coach: approve a client (requires a program assignment) — unlocks full access (B1 RPC). */
export async function approveClient(clientId: string): Promise<void> {
  const { error } = await supabaseLoose.rpc("approve_client", { p_client_id: clientId });
  if (error) throw new Error(error.message || "The client could not be approved.");
}

/** Coach: approve a client AND publish their program snapshot (single action). */
export async function approveClientWithProgram(clientId: string): Promise<void> {
  await publishClientProgram(clientId);
  await approveClient(clientId);
}
