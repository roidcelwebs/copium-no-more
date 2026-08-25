// No More Copium — account-bootstrap (SESSION LOOKUP ONLY)
// Returns the app account linked to the current Supabase session.
// Account creation no longer happens here: clients are created by
// create-client-account (code ticket), the coach by coach-login (master password).
// If no account exists for this identity → structured no_account (UI tells the
// user to create an account, and offers the code flow).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const { data: account, error } = await db
      .from("app_accounts")
      .select(ACCOUNT_SELECT)
      .eq("auth_user_id", user.id)
      .eq("is_preview", false)
      .maybeSingle();
    if (error) throw error;

    if (!account) {
      return json(
        {
          ok: false,
          code: "no_account",
          message:
            "No account has been created with this Google account. Create an account first.",
        },
        404,
      );
    }

    return json({ ok: true, account });
  } catch (error) {
    console.error("Account bootstrap failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Unexpected account loading error";
    return json({ ok: false, code: status === 401 ? "unauthorized" : "error", error: message }, status);
  }
});

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
