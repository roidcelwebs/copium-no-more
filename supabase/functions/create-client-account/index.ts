// No More Copium — create-client-account
// Requires an authenticated session (Google sign-up) + the one-time ticket issued
// by redeem-access-code. Validates the client's chosen name/username and creates
// the app_accounts row (role=client, approved_at=NULL). Burns the ticket.
// Clients are NEVER created via Supabase admin API — the auth user already exists
// from Google OAuth; this function only links the app account to it.
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@3.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
const ACCOUNT_SELECT =
  "id, name, username, role, is_preview, onboarding_step, onboarding_completed_at, approved_at, assigned_program_id, created_at";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretKey = getSecretKey();
    if (!url || !secretKey) throw new HttpError("Cloud credentials are unavailable.", 503);
    const db = createDatabaseClient(url, secretKey);

    const user = await requireSessionUser(db, request);
    const body = await request.json().catch(() => null);
    const name = normalizeName(body?.name);
    const username = normalizeUsername(body?.username);
    const ticket = typeof body?.ticket === "string" ? body.ticket.trim() : "";

    // Already have an account? (e.g. re-login after creation) → just return it.
    const { data: existing } = await db
      .from("app_accounts")
      .select(ACCOUNT_SELECT)
      .eq("auth_user_id", user.id)
      .eq("is_preview", false)
      .maybeSingle();
    if (existing) {
      await burnTicketIfPresent(db, ticket, existing.id);
      return json({ ok: true, account: existing, alreadyExisting: true });
    }

    if (!ticket) throw new HttpError("Your sign-up link is missing. Enter a new access code.", 410);

    // -- Find the code whose ticket matches (bcrypt compare) --
    const { data: candidates, error: listError } = await db
      .from("access_codes")
      .select("id, code_prefix, ticket_hash, ticket_expires_at, used_at, redeemed_at")
      .not("ticket_hash", "is", null)
      .gte("ticket_expires_at", new Date().toISOString())
      .is("used_at", null)
      .not("redeemed_at", "is", null);
    if (listError) throw listError;

    let codeRow: TicketCodeRow | null = null;
    for (const candidate of candidates ?? []) {
      if (candidate.ticket_hash && (await bcrypt.compare(ticket, candidate.ticket_hash))) {
        codeRow = candidate as TicketCodeRow;
        break;
      }
    }
    if (!codeRow) {
      throw new HttpError("Your sign-up link has expired. Enter a new access code.", 410);
    }

    // -- Create the account (id generated here so the code claim targets it) --
    const accountId = crypto.randomUUID();
    const { data: created, error: createError } = await db
      .from("app_accounts")
      .insert({
        id: accountId,
        auth_user_id: user.id,
        name,
        username,
        role: "client",
        is_preview: false,
      })
      .select(ACCOUNT_SELECT)
      .single();
    if (createError) {
      if (createError.code === "23505") {
        // Username already taken (or a duplicate auth_user_id race) — the code
        // is NOT burned, so the client can retry with a different username.
        throw new HttpError("That username is already taken.", 409);
      }
      throw createError;
    }

    // -- Burn the ticket/code (idempotent; a lost race just leaves it used) --
    const { error: burnError } = await db
      .from("access_codes")
      .update({ used_at: new Date().toISOString(), used_by: accountId, ticket_hash: null, ticket_expires_at: null })
      .eq("id", codeRow.id)
      .is("used_at", null);
    if (burnError) console.error("Ticket burn failed (non-fatal)", burnError);
    await logEvent(db, codeRow.id, codeRow.code_prefix, "account_created", `ip:${(await sha256Hex(clientIp(request))).slice(0, 8)}`, null, `account ${accountId}, username ${username}`);

    return json({ ok: true, account: created }, 201);
  } catch (error) {
    console.error("create-client-account failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Your account could not be created.";
    return json({ error: message }, status);
  }
});

type TicketCodeRow = {
  id: string;
  code_prefix: string;
  ticket_hash: string | null;
  ticket_expires_at: string | null;
  used_at: string | null;
  redeemed_at: string | null;
};

async function burnTicketIfPresent(db: DatabaseClient, ticket: string, accountId: string): Promise<void> {
  if (!ticket) return;
  try {
    const { data: candidates } = await db
      .from("access_codes")
      .select("id, ticket_hash, used_at")
      .not("ticket_hash", "is", null)
      .is("used_at", null);
    for (const candidate of candidates ?? []) {
      if (candidate.ticket_hash && (await bcrypt.compare(ticket, candidate.ticket_hash))) {
        await db.from("access_codes").update({ used_at: new Date().toISOString(), used_by: accountId }).eq("id", candidate.id);
        return;
      }
    }
  } catch (error) {
    console.error("Ticket cleanup failed (non-fatal)", error);
  }
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") throw new HttpError("Enter your name.", 400);
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new HttpError("Your name must be between 1 and 80 characters.", 400);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(name)) {
    throw new HttpError("Your name contains characters that are not allowed.", 400);
  }
  return name;
}

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") throw new HttpError("Enter a username.", 400);
  const username = value.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpError(
      "Username can only use lowercase letters (a–z), numbers, and underscores, and must be 3–30 characters.",
      400,
    );
  }
  return username;
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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
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
