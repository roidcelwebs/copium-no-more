import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "program-covers";
const MAX_BYTES = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROGRAM_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
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
    if (!url || !secretKey) throw new HttpError("Cloud storage credentials are unavailable.", 503);

    const database = createDatabaseClient(url, secretKey);
    const storage = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const authUserId = await requireAuthenticatedUser(database, request);

    const form = await request.formData();
    const coachId = stringField(form, "coachId");
    const programId = stringField(form, "programId");
    const file = form.get("file");
    if (!UUID_PATTERN.test(coachId)) return json({ error: "Invalid Coach ID" }, 400);
    if (!PROGRAM_ID_PATTERN.test(programId)) return json({ error: "Invalid program ID" }, 400);
    if (!(file instanceof File)) return json({ error: "A WebP cover image is required" }, 400);
    if (file.size < 1 || file.size > MAX_BYTES) {
      return json({ error: "The optimized cover must be 1 MB or smaller" }, 413);
    }
    if (file.type.toLowerCase() !== "image/webp") {
      return json({ error: "Only WebP cover images are accepted" }, 415);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isWebP(bytes)) return json({ error: "The cover is not a valid WebP image" }, 415);

    await requireOwnedCoach(database, coachId, authUserId);
    const path = `${programId}/cover.webp`;
    const { error } = await storage.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: true,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ path, byteSize: bytes.byteLength, width: 850, height: 1150 });
  } catch (error) {
    console.error("Program cover request failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    return json(
      { error: error instanceof Error ? error.message : "Unexpected cover upload error" },
      status,
    );
  }
});

async function requireAuthenticatedUser(
  database: DatabaseClient,
  request: Request,
): Promise<string> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new HttpError("Authentication required.", 401);
  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken || accessToken.split(".").length !== 3) {
    throw new HttpError("A valid session is required.", 401);
  }
  const { data, error } = await database.auth.getUser(accessToken);
  if (error || !data.user) throw new HttpError("Your session is invalid or expired.", 401);
  return data.user.id;
}

async function requireOwnedCoach(
  database: DatabaseClient,
  coachId: string,
  authUserId: string,
): Promise<void> {
  const { data, error } = await database
    .from("app_accounts")
    .select("id")
    .eq("id", coachId)
    .eq("auth_user_id", authUserId)
    .eq("role", "coach")
    .eq("is_preview", false)
    .maybeSingle();
  if (error || !data) throw new HttpError("Coach access is required.", 403);
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

function stringField(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function isWebP(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
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
