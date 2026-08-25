// No More Copium — coach-login
// The Coach signs in with a master password (bcrypt-hashed in the
// COACH_ACCESS_HASH secret). Replaces the old Google coach identity.
// Ensures the coach auth user + app_accounts row exist, then mints a session.
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@3.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COACH_EMAIL = "coach@nomorecopium.app";
const COACH_USERNAME = "coach";
const WINDOW_ATTEMPTS = 15;
const WINDOW_SECONDS = 15 * 60;
const ACCOUNT_SELECT =
  "id, name, username, role, is_preview, onboarding_step, onboarding_completed_at, approved_at, assigned_program_id, created_at";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretKey = getSecretKey();
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    const coachPasswordHash = Deno.env.get("COACH_ACCESS_HASH");
    const coachDisplayName = Deno.env.get("COACH_DISPLAY_NAME") ?? "Hal";
    if (!url || !secretKey || !anonKey) throw new HttpError("Cloud credentials are unavailable.", 503);
    if (!coachPasswordHash) throw new HttpError("Coach login is not configured.", 503);

    const serviceDb = createDatabaseClient(url, secretKey);
    const anonDb = createClient(url, anonKey, {
      global: { fetch: createDatabaseFetch(anonKey) },
      auth: { persistSession: false },
    });

    const ipHash = await sha256Hex(clientIp(request));
    const body = await request.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) throw new HttpError("Enter your coach password.", 400);

    // -- Per-IP throttle --
    const { count } = await serviceDb
      .from("access_code_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("attempted_at", new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString());
    if ((count ?? 0) >= WINDOW_ATTEMPTS) {
      await logEvent(serviceDb, null, null, "coach_login_fail", `ip:${ipHash.slice(0, 8)}`, ipHash, "rate limited");
      throw new HttpError("Too many attempts. Try again later.", 429);
    }

    // -- Verify the master password --
    const passwordOk = await bcrypt.compare(password, coachPasswordHash);
    if (!passwordOk) {
      await logEvent(serviceDb, null, null, "coach_login_fail", `ip:${ipHash.slice(0, 8)}`, ipHash, "wrong password");
      throw new HttpError("Incorrect password.", 401);
    }

    // -- Ensure the coach auth user exists (create with the master password so
    //    the password sign-in below works; on password change, update it) --
    let signIn = await anonDb.auth.signInWithPassword({ email: COACH_EMAIL, password });
    if (signIn.error) {
      const { data: created, error: createError } = await serviceDb.auth.admin.createUser({
        email: COACH_EMAIL,
        password,
        email_confirm: true,
      });
      if (createError) {
        // User exists but with a different password (master password was changed).
        const { data: userList } = await serviceDb.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const coachAuthUser = (userList?.users ?? []).find((u) => u.email === COACH_EMAIL);
        if (!coachAuthUser) throw createError;
        const { error: updateError } = await serviceDb.auth.admin.updateUserById(coachAuthUser.id, {
          password,
        });
        if (updateError) throw updateError;
      } else if (created?.user) {
        // Fresh coach user — ensure the app account row exists.
        await ensureCoachAccount(serviceDb, created.user.id, coachDisplayName);
      }
      signIn = await anonDb.auth.signInWithPassword({ email: COACH_EMAIL, password });
    }
    if (signIn.error) throw new HttpError("Coach sign-in failed.", 401);

    // -- Load the coach account row (create it if the user existed before B2) --
    let { data: account } = await serviceDb
      .from("app_accounts")
      .select(ACCOUNT_SELECT)
      .eq("auth_user_id", signIn.data.user.id)
      .eq("role", "coach")
      .eq("is_preview", false)
      .maybeSingle();
    if (!account) {
      account = await ensureCoachAccount(serviceDb, signIn.data.user.id, coachDisplayName);
    }

    await logEvent(serviceDb, null, null, "coach_login_ok", "coach", ipHash, null);
    return json({
      ok: true,
      session: {
        access_token: signIn.data.session.access_token,
        refresh_token: signIn.data.session.refresh_token,
      },
      account,
    });
  } catch (error) {
    console.error("coach-login failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Coach sign-in failed.";
    return json({ error: message }, status);
  }
});

async function ensureCoachAccount(
  db: DatabaseClient,
  authUserId: string,
  displayName: string,
): Promise<CoachAccount> {
  const { data, error } = await db
    .from("app_accounts")
    .insert({
      auth_user_id: authUserId,
      name: displayName,
      username: COACH_USERNAME,
      role: "coach",
      is_preview: false,
    })
    .select(ACCOUNT_SELECT)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      // A coach row already exists (single-coach unique index) — load it.
      const { data: existing } = await db
        .from("app_accounts")
        .select(ACCOUNT_SELECT)
        .eq("role", "coach")
        .eq("is_preview", false)
        .maybeSingle();
      if (existing) return existing;
    }
    throw error;
  }
  return data as CoachAccount;
}

type CoachAccount = {
  id: string;
  name: string;
  username: string;
  role: string;
  is_preview: boolean;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  approved_at: string | null;
  assigned_program_id: string | null;
  created_at: string;
};

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

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
