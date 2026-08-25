// No More Copium — redeem-access-code
// Public (unauthenticated) but rate-limited. Validates a one-time access code,
// BURNS it instantly (redeemed_at + 30-min one-time ticket), and returns the ticket.
// The code itself is never reusable, even if the client abandons sign-up.
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@3.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 5;              // per code — locks further attempts
const WINDOW_ATTEMPTS = 15;          // per IP per 15 minutes
const WINDOW_SECONDS = 15 * 60;
const TICKET_TTL_SECONDS = 30 * 60;  // one-time sign-up ticket lifetime

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretKey = getSecretKey();
    if (!url || !secretKey) throw new HttpError("Cloud credentials are unavailable.", 503);
    const db = createDatabaseClient(url, secretKey);

    const ipHash = await sha256Hex(clientIp(request));
    const body = await request.json().catch(() => null);
    const code = normalizeCode(body?.code);
    if (!code) throw new HttpError("Enter your access code.", 400);
    if (!/^[A-Z0-9]{12}$/.test(code)) throw new HttpError("That code is not valid.", 401);

    // -- Per-IP throttle (shared login limiter: all attempts counted) --
    const { count } = await db
      .from("access_code_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("attempted_at", new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString());
    if ((count ?? 0) >= WINDOW_ATTEMPTS) {
      await logEvent(db, null, null, "rate_limited", `ip:${ipHash.slice(0, 8)}`, ipHash, "IP over 15 attempts / 15 min");
      throw new HttpError("Too many attempts. Try again later.", 429);
    }

    // -- Look up by display prefix, then bcrypt-compare the full code --
    const prefix = code.slice(0, 4);
    const { data: candidates, error: listError } = await db
      .from("access_codes")
      .select("id, code_prefix, code_hash, failed_attempts, expires_at, redeemed_at, used_at, revoked_at")
      .eq("code_prefix", prefix);
    if (listError) throw listError;

    let row: AccessCodeRow | null = null;
    for (const candidate of candidates ?? []) {
      if (await bcrypt.compare(code, candidate.code_hash)) {
        row = candidate as AccessCodeRow;
        break;
      }
    }

    if (!row) {
      await db.from("access_code_attempts").insert({ ip_hash: ipHash, outcome: "bad_code" });
      await logEvent(db, null, prefix, "failed", `ip:${ipHash.slice(0, 8)}`, ipHash, "code mismatch");
      throw new HttpError("That code is not valid.", 401);
    }

    // -- State checks (cheap fields first; same-wrong-code message hides the state) --
    if (row.revoked_at) throw new HttpError("This code has been cancelled.", 401);
    if (row.redeemed_at || row.used_at) throw new HttpError("This code was already used.", 401);
    if (row.failed_attempts >= MAX_ATTEMPTS) {
      throw new HttpError("This code is locked after too many wrong attempts.", 401);
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new HttpError("This code has expired. Ask your coach for a new one.", 401);
    }

    // -- Wrong code: count the failure, lock at the threshold --
    const nextAttempts = row.failed_attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await db.from("access_codes").update({ failed_attempts: nextAttempts }).eq("id", row.id);
      await db.from("access_code_attempts").insert({ ip_hash: ipHash, code_id: row.id, outcome: "locked" });
      await logEvent(db, row.id, row.code_prefix, "locked", `ip:${ipHash.slice(0, 8)}`, ipHash, `${nextAttempts} failed attempts`);
      throw new HttpError("This code is locked after too many wrong attempts.", 401);
    }

    // -- Success: burn the code, mint the one-time ticket --
    const ticket = randomHex(32);
    const ticketHash = await bcrypt.hash(ticket, 12);
    const { data: claimed, error: burnError } = await db
      .from("access_codes")
      .update({
        redeemed_at: new Date().toISOString(),
        ticket_hash: ticketHash,
        ticket_expires_at: new Date(Date.now() + TICKET_TTL_SECONDS * 1000).toISOString(),
      })
      .eq("id", row.id)
      .is("redeemed_at", null)
      .select("id")
      .maybeSingle();
    if (burnError) throw burnError;
    if (!claimed) throw new HttpError("This code was already used.", 409); // lost a race

    await db.from("access_code_attempts").insert({ ip_hash: ipHash, code_id: row.id, outcome: "ok" });
    await logEvent(db, row.id, row.code_prefix, "redeemed", `ip:${ipHash.slice(0, 8)}`, ipHash, "code burned, ticket issued");

    return json({ ok: true, ticket, expiresIn: TICKET_TTL_SECONDS });
  } catch (error) {
    console.error("redeem-access-code failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Your code could not be checked.";
    return json({ error: message }, status);
  }
});

type AccessCodeRow = {
  id: string;
  code_prefix: string;
  code_hash: string;
  failed_attempts: number;
  expires_at: string;
  redeemed_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
};

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
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

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

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
