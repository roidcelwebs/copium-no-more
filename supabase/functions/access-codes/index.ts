// No More Copium — access-codes (coach-only)
// create / list / revoke one-time access codes. Requires a Coach session.
// The plaintext code is returned exactly once at creation and is stored only
// as a bcrypt hash; list/revoke never return hashes or plaintext.
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@3.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — 32 chars
const CODE_LENGTH = 12;
const VALID_EXPIRY_HOURS = [24, 72, 168, 720];
const DEFAULT_EXPIRY_HOURS = 72;
const NOTE_MAX_LENGTH = 200;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretKey = getSecretKey();
    if (!url || !secretKey) throw new HttpError("Cloud credentials are unavailable.", 503);
    const db = createDatabaseClient(url, secretKey);

    const user = await requireSessionUser(db, request);
    const coach = await requireCoach(db, user.id);

    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action === "create") {
      const note = typeof body?.note === "string" ? body.note.trim().slice(0, NOTE_MAX_LENGTH) : "";
      const requestedExpiry = Number(body?.expiryHours);
      const expiryHours = VALID_EXPIRY_HOURS.includes(requestedExpiry)
        ? requestedExpiry
        : DEFAULT_EXPIRY_HOURS;

      const code = generateCode();
      const codeHash = await bcrypt.hash(code, 12);
      const { data, error } = await db
        .from("access_codes")
        .insert({
          code_hash: codeHash,
          code_prefix: code.slice(0, 4),
          note,
          created_by: coach.id,
          expires_at: new Date(Date.now() + expiryHours * 3600 * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      await logEvent(db, data.id, code.slice(0, 4), "created", "coach", null, `${expiryHours}h${note ? ` — ${note}` : ""}`);
      // Plaintext returned exactly once — the UI shows it in a modal, then discards.
      return json({ ok: true, id: data.id, code });
    }

    if (action === "list") {
      const { data: codes, error: listError } = await db
        .from("access_codes")
        .select("id, code_prefix, note, created_at, expires_at, failed_attempts, redeemed_at, used_at, revoked_at, used_by, created_by")
        .order("created_at", { ascending: false })
        .limit(100);
      if (listError) throw listError;

      const { data: events, error: eventsError } = await db
        .from("access_code_events")
        .select("code_id, event, actor, created_at, detail")
        .order("created_at", { ascending: false })
        .limit(500);
      if (eventsError) throw eventsError;

      const eventsByCode: Record<string, unknown[]> = {};
      for (const event of events ?? []) {
        if (!event.code_id) continue;
        const list = (eventsByCode[event.code_id] ??= []);
        if (list.length < 5) {
          list.push({ event: event.event, actor: event.actor, createdAt: event.created_at, detail: event.detail });
        }
      }

      return json({
        ok: true,
        codes: (codes ?? []).map((c) => ({
          id: c.id,
          prefix: c.code_prefix,
          note: c.note,
          createdAt: c.created_at,
          expiresAt: c.expires_at,
          failedAttempts: c.failed_attempts,
          redeemedAt: c.redeemed_at,
          usedAt: c.used_at,
          revokedAt: c.revoked_at,
          events: eventsByCode[c.id] ?? [],
        })),
      });
    }

    if (action === "revoke") {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) throw new HttpError("Code id is required.", 400);
      const { data: row, error: rowError } = await db
        .from("access_codes")
        .select("id, code_prefix, used_at, revoked_at")
        .eq("id", id)
        .maybeSingle();
      if (rowError) throw rowError;
      if (!row) throw new HttpError("Code was not found.", 404);
      if (row.revoked_at) return json({ ok: true }); // idempotent
      if (row.used_at) throw new HttpError("This code was already used and cannot be revoked.", 409);

      const { error: revokeError } = await db
        .from("access_codes")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (revokeError) throw revokeError;

      await logEvent(db, id, row.code_prefix, "revoked", "coach", null, null);
      return json({ ok: true });
    }

    throw new HttpError("Unknown action.", 400);
  } catch (error) {
    console.error("access-codes failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Access codes could not be managed.";
    return json({ error: message }, status);
  }
});

function generateCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    chars.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]); // 256 % 32 = 0 → unbiased
  }
  const raw = chars.join("");
  return raw.match(/.{1,4}/g)!.join("-"); // XXXX-XXXX-XXXX
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

async function requireSessionUser(db: DatabaseClient, request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError("Authentication required.", 401);
  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) throw new HttpError("A valid session is required.", 401);

  const { data, error } = await db.auth.getUser(token);
  const user = data.user;
  if (error || !user) throw new HttpError("Your session is invalid or expired.", 401);
  if (!user.email_confirmed_at) throw new HttpError("Confirm your email before continuing.", 403);
  return user;
}

async function requireCoach(db: DatabaseClient, authUserId: string): Promise<{ id: string }> {
  const { data } = await db
    .from("app_accounts")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("role", "coach")
    .eq("is_preview", false)
    .maybeSingle();
  if (!data) throw new HttpError("A Coach account is required.", 403);
  return data;
}

async function logEvent(
  db: DatabaseClient,
  codeId: string | null,
  prefix: string | null,
  event: string,
  actor: string,
  ipHash: string | null,
  detail: string | null,
): Promise<void> {
  try {
    await db.from("access_code_events").insert({
      code_id: codeId,
      code_prefix: prefix,
      event,
      actor,
      ip_hash: ipHash,
      detail,
    });
  } catch (error) {
    console.error("Event log write failed (non-fatal)", error);
  }
}

function createDatabaseClient(url: string, secretKey: string) {
  return createClient(url, secretKey, {
    global: { fetch: createDatabaseFetch(secretKey) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSecretKey(): string | undefined {
  const standard = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (standard) return standard;
  const bundled = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!bundled) return undefined;
  try {
    const keys = JSON.parse(bundled) as Record<string, unknown>;
    if (typeof keys.default === "string") return keys.default;
    if (typeof keys.service_role === "string") return keys.service_role;
  } catch {
    return undefined;
  }
  return undefined;
}

function createDatabaseFetch(secretKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (headers.get("Authorization") === `Bearer ${secretKey}`) headers.delete("Authorization");
    headers.set("apikey", secretKey);
    return fetch(input, { ...init, headers });
  };
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
