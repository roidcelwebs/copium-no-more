import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "progress-pictures";
const MAX_BYTES = Math.floor(2.5 * 1024 * 1024);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      if (form.get("action") !== "upload") return json({ error: "Invalid action" }, 400);
      const clientId = stringField(form, "clientId");
      const batchId = stringField(form, "batchId");
      const pictureId = stringField(form, "pictureId");
      const file = form.get("file");
      validateUuid(clientId, "client ID");
      validateUuid(batchId, "batch ID");
      validateUuid(pictureId, "picture ID");
      if (!(file instanceof File)) return json({ error: "A WebP image is required" }, 400);
      if (file.size < 1 || file.size > MAX_BYTES) {
        return json({ error: "The optimized image must be 2.5 MB or smaller" }, 413);
      }
      if (file.type.toLowerCase() !== "image/webp") {
        return json({ error: "Only WebP images are accepted" }, 415);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isWebP(bytes)) {
        return json({ error: "The uploaded file is not a valid WebP image" }, 415);
      }
      await requireOwnedClient(database, clientId, authUserId);

      const path = storagePath(clientId, batchId, pictureId);
      const { error } = await storage.storage.from(BUCKET).upload(path, bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ path, byteSize: bytes.byteLength });
    }

    const body = (await request.json()) as {
      action?: unknown;
      clientId?: unknown;
      paths?: unknown;
    };
    if (body.action !== "cleanup") return json({ error: "Invalid action" }, 400);
    if (typeof body.clientId !== "string") return json({ error: "Client ID is required" }, 400);
    validateUuid(body.clientId, "client ID");
    await requireOwnedClient(database, body.clientId, authUserId);
    if (!Array.isArray(body.paths) || body.paths.length < 1 || body.paths.length > 6) {
      return json({ error: "Cleanup requires between 1 and 6 paths" }, 400);
    }
    const paths = body.paths.map((path) => {
      if (typeof path !== "string" || !isOwnedPath(path, body.clientId as string)) {
        throw new Error("Invalid cleanup path");
      }
      return path;
    });
    const { error } = await storage.storage.from(BUCKET).remove(paths);
    if (error) return json({ error: error.message }, 400);
    return json({ removed: paths.length });
  } catch (error) {
    console.error("Progress-picture media request failed", error);
    const status = error instanceof HttpError ? error.status : 400;
    return json(
      { error: error instanceof Error ? error.message : "Unexpected upload error" },
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

async function requireOwnedClient(
  database: DatabaseClient,
  clientId: string,
  authUserId: string,
): Promise<void> {
  const { data, error } = await database
    .from("app_accounts")
    .select("id")
    .eq("id", clientId)
    .eq("auth_user_id", authUserId)
    .eq("role", "client")
    .maybeSingle();
  if (error || !data) throw new HttpError("This Client account is not yours.", 403);
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

function validateUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error(`Invalid ${label}`);
}

function storagePath(clientId: string, batchId: string, pictureId: string): string {
  return `${clientId}/${batchId}/${pictureId}.webp`;
}

function isOwnedPath(path: string, clientId: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === clientId &&
    UUID_PATTERN.test(parts[1]) &&
    UUID_PATTERN.test(parts[2].replace(/\.webp$/i, "")) &&
    parts[2].toLowerCase().endsWith(".webp")
  );
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
