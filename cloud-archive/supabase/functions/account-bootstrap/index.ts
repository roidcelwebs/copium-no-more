import { createClient } from "npm:@supabase/supabase-js@2";

const USERNAME_PATTERN = /^[a-z0-9]+(?: [a-z0-9]+)*$/;
const RESERVED_PREVIEW_USERNAME = "client preview";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretKey = getSecretKey();
    const coachEmail = Deno.env.get("COACH_GOOGLE_EMAIL")?.trim().toLowerCase();
    if (!url || !secretKey) throw new HttpError("Cloud credentials are unavailable.", 503);
    if (!coachEmail) throw new HttpError("The Coach Google identity is not configured.", 503);

    const database = createDatabaseClient(url, secretKey);
    const user = await requireGoogleUser(database, request);
    const body = (await request.json()) as { name?: unknown; username?: unknown };
    const name = normalizeName(body.name);
    const username = normalizeUsername(body.username);

    const { data: existing, error: existingError } = await database
      .from("app_accounts")
      .select("id, name, username, role, is_preview, assigned_program_id, created_at")
      .eq("auth_user_id", user.id)
      .eq("is_preview", false)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.role === "coach") await ensurePreviewAccount(database, user.id);
      return json({ ok: true, account: existing });
    }

    const isCoachIdentity = user.email?.trim().toLowerCase() === coachEmail;
    if (isCoachIdentity) {
      const { data: assignedCoach, error: coachError } = await database
        .from("app_accounts")
        .select("auth_user_id")
        .eq("role", "coach")
        .maybeSingle();
      if (coachError) throw coachError;
      if (assignedCoach && assignedCoach.auth_user_id !== user.id) {
        throw new HttpError("The Coach account has already been assigned.", 409);
      }
    }

    const { data: created, error: createError } = await database
      .from("app_accounts")
      .insert({
        auth_user_id: user.id,
        name,
        username,
        role: isCoachIdentity ? "coach" : "client",
        is_preview: false,
      })
      .select("id, name, username, role, is_preview, assigned_program_id, created_at")
      .single();
    if (createError) {
      if (createError.code === "23505") {
        throw new HttpError("That username is already taken.", 409);
      }
      throw createError;
    }

    if (created.role === "coach") await ensurePreviewAccount(database, user.id);
    return json({ ok: true, account: created }, 201);
  } catch (error) {
    console.error("Authenticated account bootstrap failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Unexpected account creation error";
    return json({ error: message }, status);
  }
});

async function requireGoogleUser(database: DatabaseClient, request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError("Authentication required.", 401);
  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken || accessToken.split(".").length !== 3) {
    throw new HttpError("A valid Google session is required.", 401);
  }

  const { data, error } = await database.auth.getUser(accessToken);
  const user = data.user;
  if (error || !user) throw new HttpError("Your Google session is invalid or expired.", 401);
  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
  const isGoogle = user.app_metadata?.provider === "google" || providers.includes("google");
  if (!isGoogle || !user.email || !user.email_confirmed_at) {
    throw new HttpError("Continue with a verified Google account.", 403);
  }
  return user;
}

async function ensurePreviewAccount(database: DatabaseClient, authUserId: string): Promise<void> {
  const { data: existing, error: existingError } = await database
    .from("app_accounts")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("is_preview", true)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return;

  const { error } = await database.from("app_accounts").insert({
    auth_user_id: authUserId,
    name: "Client Preview",
    username: RESERVED_PREVIEW_USERNAME,
    role: "client",
    is_preview: true,
  });
  if (error) throw error;
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") throw new HttpError("Enter your name.", 400);
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) {
    throw new HttpError("Your name must be between 1 and 80 characters.", 400);
  }
  return name;
}

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") throw new HttpError("Enter a username.", 400);
  const username = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (username.length < 3 || username.length > 30 || !USERNAME_PATTERN.test(username)) {
    throw new HttpError(
      "Username must be 3–30 characters using lowercase letters, numbers, and spaces only.",
      400,
    );
  }
  if (username === RESERVED_PREVIEW_USERNAME) {
    throw new HttpError("That username is unavailable.", 409);
  }
  return username;
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
