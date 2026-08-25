import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_MAX_ATTEMPTS,
  formatAccessCode,
  isValidAccessCodeFormat,
  normalizeAccessCode,
  validateName,
  deriveAccessCodeStatus,
} from "./access-codes";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("access-code format helpers", () => {
  test("normalize strips separators and uppercases", () => {
    expect(normalizeAccessCode("7F2K-Q9Z4-M8XT")).toBe("7F2KQ9Z4M8XT");
    expect(normalizeAccessCode("7f2k q9z4 m8xt")).toBe("7F2KQ9Z4M8XT");
    expect(normalizeAccessCode("  7F2KQ9Z4M8XT  ")).toBe("7F2KQ9Z4M8XT");
  });

  test("format groups the raw code into 4-4-4", () => {
    expect(formatAccessCode("7F2KQ9Z4M8XT")).toBe("7F2K-Q9Z4-M8XT");
    expect(formatAccessCode("7F2K-Q9Z4-M8XT")).toBe("7F2K-Q9Z4-M8XT");
    expect(formatAccessCode("7f2kq9z4m8xt")).toBe("7F2K-Q9Z4-M8XT");
  });

  test("valid only for exactly 12 characters from the unambiguous alphabet", () => {
    expect(isValidAccessCodeFormat("7F2K-Q9Z4-M8XT")).toBe(true);
    expect(isValidAccessCodeFormat("7F2KQ9Z4M8XT")).toBe(true);
    expect(isValidAccessCodeFormat("7F2KQ9Z4M8X")).toBe(false); // 11
    expect(isValidAccessCodeFormat("7F2KQ9Z4M8XT1")).toBe(false); // 13
    expect(isValidAccessCodeFormat("")).toBe(false);
    // 0, O, 1, I are excluded from the alphabet (readability)
    expect(isValidAccessCodeFormat("0O1I7F2KQ9Z4M")).toBe(false);
    // pasting with stray separators is fine — they normalize away
    expect(isValidAccessCodeFormat("7F2K-Q9Z4-M8XT-")).toBe(true);
  });

  test("alphabet has exactly 32 unambiguous characters", () => {
    expect(ACCESS_CODE_ALPHABET.length).toBe(32);
    expect(ACCESS_CODE_ALPHABET).not.toMatch(/[0O1I]/);
  });

  test("lock threshold is 5 failed attempts", () => {
    expect(ACCESS_CODE_MAX_ATTEMPTS).toBe(5);
  });
});

describe("client name rule", () => {
  test("accepts names with numbers and spaces", () => {
    expect(validateName("Bobby 07")).toBeNull();
    expect(validateName("  Bobby   07  ")).toBeNull(); // collapsed to "Bobby 07"
    expect(validateName("a".repeat(80))).toBeNull();
  });

  test("rejects empty, too long, and control characters", () => {
    expect(validateName("")).not.toBeNull();
    expect(validateName("   ")).not.toBeNull();
    expect(validateName("a".repeat(81))).not.toBeNull();
    expect(validateName("Bobby\u0007")).not.toBeNull();
    // newlines/tabs are allowed input and collapse to a single space
    expect(validateName("Bobby\n07")).toBeNull();
  });
});

describe("access-code status derivation", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  test("order: revoked > used > redeemed > locked > expired > active", () => {
    expect(deriveAccessCodeStatus({ expiresAt: future, failedAttempts: 0, revokedAt: past })).toBe("revoked");
    expect(deriveAccessCodeStatus({ expiresAt: future, failedAttempts: 0, usedAt: past })).toBe("used");
    expect(deriveAccessCodeStatus({ expiresAt: future, failedAttempts: 0, redeemedAt: past })).toBe("redeemed");
    expect(deriveAccessCodeStatus({ expiresAt: future, failedAttempts: 5 })).toBe("locked");
    expect(deriveAccessCodeStatus({ expiresAt: past, failedAttempts: 0 })).toBe("expired");
    expect(deriveAccessCodeStatus({ expiresAt: future, failedAttempts: 0 })).toBe("active");
  });
});

describe("B1 migration guards (server-side security must stay)", () => {
  const migration = read("../../supabase/migrations/20260825000000_access_codes_manual_onboarding.sql");

  test("creates the four new tables", () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.access_codes/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.access_code_attempts/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.access_code_events/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.client_program_bundles/);
  });

  test("codes are never readable by anon/authenticated — service role only", () => {
    expect(migration).toMatch(/REVOKE ALL ON public\.access_codes FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON public\.access_code_attempts FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON public\.access_code_events FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON public\.client_program_bundles FROM PUBLIC, anon, authenticated/);
    // Codes/attempts/events: no grants to anon/authenticated at all.
    expect(migration).not.toMatch(/GRANT [A-Z, ]+ ON public\.access_codes TO/);
    expect(migration).not.toMatch(/GRANT [A-Z, ]+ ON public\.access_code_attempts TO/);
    expect(migration).not.toMatch(/GRANT [A-Z, ]+ ON public\.access_code_events TO/);
    // Bundles: only a SELECT grant (own row read backstop); no write grants.
    expect(migration).toMatch(/GRANT SELECT ON public\.client_program_bundles TO authenticated/);
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[A-Z, ]* ON public\.client_program_bundles TO/);
  });

  test("owner-only lock stays: no UPDATE grant on approved_at / onboarding for clients", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS approved_at timestamptz/);
    expect(migration).toMatch(/REVOKE UPDATE \(onboarding_step, onboarding_completed_at\) ON public\.app_accounts FROM authenticated/);
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Clients can update their own onboarding"/);
  });

  test("username CHECK enforces lowercase-only rule", () => {
    expect(migration).toMatch(/username ~ '\^\[a-z0-9_\]\+\$'/);
    expect(migration).toMatch(/DISABLE TRIGGER app_accounts_identity_immutable/);
    expect(migration).toMatch(/ENABLE TRIGGER app_accounts_identity_immutable/);
  });

  test("defines the four SECURITY DEFINER RPCs and grants EXECUTE to authenticated only", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.approve_client\(p_client_id uuid\)/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.publish_client_program\(p_client_id uuid\)/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.get_client_program_bundle\(\)/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.append_onboarding_greeting\(p_client_id uuid\)/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.approve_client\(uuid\) FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.approve_client\(uuid\) TO authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_client_program_bundle\(\) FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_client_program_bundle\(\) TO authenticated/);
  });

  test("approve_client requires a program assignment before approval", () => {
    expect(migration).toMatch(/Assign a training program before approving this client\./);
  });

  test("onboarding greeting is exactly one idempotent server-side message", () => {
    expect(migration).toMatch(/Welcome to No More Copium, ' \|\| v_client_name/);
    expect(migration).toMatch(
      /\. How many times a week do you usually work out right now, brother\?/,
    );
    expect(migration).toMatch(/existing\.body LIKE 'Welcome to No More Copium,%'/);
  });

  test("chat thread creation is hardened against ambiguous column names (v_thread_id / v_coach_id)", () => {
    expect(migration).toMatch(/v_thread_id uuid/);
    expect(migration).toMatch(/v_coach_id  uuid/);
    expect(migration).toMatch(/VALUES \(v_thread_id, p_client_id\), \(v_thread_id, v_coach_id\)/);
    expect(migration).not.toMatch(/VALUES \(thread_id, p_client_id\)/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_or_create_chat_thread\(uuid\) TO authenticated/);
  });
});

describe("B2 edge function guards (security invariants stay)", () => {
  const fn = (name: string) => read(`../../supabase/functions/${name}/index.ts`);

  test("redeem-access-code burns codes and never issues a session", () => {
    const src = fn("redeem-access-code");
    expect(src).toMatch(/redeemed_at/);
    expect(src).toMatch(/ticket_hash/);
    expect(src).toMatch(/bcrypt\.compare/);
    expect(src).toMatch(/Too many attempts/);
    expect(src).toMatch(/This code was already used/);
    expect(src).not.toMatch(/access_token/); // never returns a session
    expect(src).not.toMatch(/\.insert\(\{[^}]*code_hash/); // never writes a raw code
  });

  test("create-client-account enforces rules and never touches auth.users", () => {
    const src = fn("create-client-account");
    expect(src).toMatch(/USERNAME_PATTERN = \/\^\[a-z0-9_\]\{3,30\}\$/);
    expect(src).toMatch(/Your sign-up link has expired/);
    expect(src).toMatch(/That username is already taken/);
    expect(src).toMatch(/approved_at/);
    expect(src).toMatch(/role: "client"/);
    expect(src).not.toMatch(/admin\.createUser/); // clients never admin-created
    expect(src).not.toMatch(/signInWithOAuth/);
  });

  test("coach-login compares against the COACH_ACCESS_HASH secret only", () => {
    const src = fn("coach-login");
    expect(src).toMatch(/COACH_ACCESS_HASH/);
    expect(src).toMatch(/bcrypt\.compare\(password, coachPasswordHash\)/);
    expect(src).toMatch(/coach_login_ok/);
    expect(src).toMatch(/coach@nomorecopium\.app/);
    expect(src).not.toMatch(/COACH_GOOGLE_EMAIL/);
  });

  test("access-codes returns plaintext exactly once and stores only hashes", () => {
    const src = fn("access-codes");
    expect(src).toMatch(/code_hash/);
    expect(src).toMatch(/bcrypt\.hash\(code, 12\)/);
    expect(src).toMatch(/return json\(\{ ok: true, id: data\.id, code \}\)/); // 1st: plaintext
    expect(src).toMatch(/code_prefix/);
    expect(src).not.toMatch(/code_hash: c\./); // list never returns hashes
    expect(src).toMatch(/A Coach account is required/);
  });

  test("account-bootstrap is lookup-only (no account creation path)", () => {
    const src = fn("account-bootstrap");
    expect(src).toMatch(/no_account/);
    expect(src).toMatch(/No account has been created with this Google account/);
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).not.toMatch(/COACH_GOOGLE_EMAIL/);
    expect(src).not.toMatch(/ensurePreviewAccount/);
  });
});

describe("B3 coach UI guards", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

  test("Access Codes page: generate, reveal-once modal, list, revoke", () => {
    const page = read("../components/coach/AccessCodesPage.tsx");
    expect(page).toMatch(/Generate access code/);
    expect(page).toMatch(/listAccessCodes/);
    expect(page).toMatch(/revokeAccessCode/);
    expect(page).toMatch(/CodeRevealDialog/);
    expect(page).toMatch(/The code appears once/);
  });

  test("reveal dialog never re-requests the code and warns it works once", () => {
    const dialog = read("../components/coach/CodeRevealDialog.tsx");
    expect(dialog).toMatch(/works once and/);
    expect(dialog).toMatch(/shown only once/);
    expect(dialog).not.toMatch(/listAccessCodes/);
    expect(dialog).not.toMatch(/fetch/);
    expect(dialog).toMatch(/Copy code/);
  });

  test("coach shell links to Access Codes and the route exists", () => {
    const shell = read("../components/coach/CoachShell.tsx");
    expect(shell).toMatch(/\/coach\/access-codes/);
    expect(shell).toMatch(/Access Codes/);
    const route = read("../routes/coach.access-codes.tsx");
    expect(route).toMatch(/createFileRoute\("\/coach\/access-codes"\)/);
    expect(route).toMatch(/AccessCodesPage/);
  });

  test("dashboard marks unapproved clients as Awaiting approval", () => {
    const dashboard = read("../components/coach/CoachDashboard.tsx");
    expect(dashboard).toMatch(/Awaiting approval/);
    expect(dashboard).toMatch(/approvedAt/);
  });

  test("client management: issue code + approve (program-required) + revealed dialog", () => {
    const page = read("../components/coach/ClientManagement.tsx");
    expect(page).toMatch(/Issue access code/);
    expect(page).toMatch(/Approve client/);
    expect(page).toMatch(/Assign a training program before approving|Assign a training program above/);
    expect(page).toMatch(/CodeRevealDialog/);
    expect(page).toMatch(/approveClientWithProgram/);
  });

  test("conversation: coach sees awaiting-approval card and can approve with program", () => {
    const conversation = read("../components/chat/ChatConversation.tsx");
    expect(conversation).toMatch(/Awaiting approval/);
    expect(conversation).toMatch(/approveClientWithProgram/);
    expect(conversation).toMatch(/Approving…|Approve client/);
    expect(conversation).toMatch(/Assign a training program on the client page/);
  });
});

describe("B4 client access guards", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

  test("AccountAccess offers Create account (code), Login (Google), and Coach password", () => {
    const access = read("../components/account/AccountAccess.tsx");
    expect(access).toMatch(/Create account/);
    expect(access).toMatch(/GoogleSignInButton/);
    expect(access).toMatch(/Coach\? Sign in with your account password/);
    expect(access).toMatch(/redeemAccessCode/);
    expect(access).toMatch(/No account has been created with this Google account/);
    expect(access).toMatch(/NoAccountError/);
    expect(access).toMatch(/storeAccessTicket/);
    expect(access).toMatch(/readAccessTicket/);
    expect(access).not.toMatch(/Coach Mode/);
    expect(access).not.toMatch(/Create a new local account/);
  });

  test("AccountProvider wires the code-ticket flow, coach password, and /access redirect", () => {
    const provider = read("../components/account/AccountProvider.tsx");
    expect(provider).toMatch(/completeAccessCodeAccount/);
    expect(provider).toMatch(/loginCoach/);
    expect(provider).toMatch(/window.location.origin\}\/access/);
    expect(provider).toMatch(/NoAccountError/);
    expect(provider).not.toMatch(/completeNewAccount/);
  });

  test("Google sign-in returns to /access (not the root)", () => {
    const button = read("../components/account/GoogleSignInButton.tsx");
    expect(button).toMatch(/\/access/);
    expect(button).toMatch(/Continue with Google/);
    expect(button).toMatch(/signInWithOAuth/);
  });

  test("cloud-accounts distinguishes no_account for the create-account flow", () => {
    const accounts = read("../lib/cloud-accounts.ts");
    expect(accounts).toMatch(/class NoAccountError/);
    expect(accounts).toMatch(/code === "no_account"/);
    expect(accounts).toMatch(/No account has been created with this Google account/);
  });

  test("one-time ticket helpers only keep an unexpired ticket", () => {
    const lib = read("../lib/access-codes.ts");
    expect(lib).toMatch(/storeAccessTicket/);
    expect(lib).toMatch(/readAccessTicket/);
    expect(lib).toMatch(/clearAccessTicket/);
    expect(lib).toMatch(/sessionStorage/);
    expect(lib).toMatch(/ACCESS_CODE_TICKET_STORAGE_KEY/);
  });
});

describe("B5 manual onboarding guards", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

  test("onboarding route uses the live chat screen and gates on approval", () => {
    const route = read("../routes/onboarding.tsx");
    expect(route).toMatch(/ClientOnboardingScreen/);
    expect(route).not.toMatch(/ClientOnboardingChat/);
    expect(route).toMatch(/account\.approvedAt/);
  });

  test("onboarding screen = live chat + single server greeting + approval polling", () => {
    const screen = read("../components/chat/ClientOnboardingScreen.tsx");
    expect(screen).toMatch(/appendOnboardingGreeting/);
    expect(screen).toMatch(/Waiting for approval/);
    expect(screen).toMatch(/ChatConversation clientId=\{account.id\} hideBack/);
    expect(screen).toMatch(/fetchAccount\(account\.id\)/);
    expect(screen).toMatch(/navigate\(\{ to: "\/client\/dashboard", replace: true \}\)/);
    expect(screen).not.toMatch(/CLIENT_ONBOARDING_QUESTIONS/);
    expect(screen).not.toMatch(/options/);
  });

  test("chat.ts: free texting before approval + server-side greeting RPC wrapper", () => {
    const chat = read("../lib/chat.ts");
    expect(chat).not.toMatch(/Complete onboarding before sending free-form messages/);
    expect(chat).toMatch(/append_onboarding_greeting/);
    expect(chat).toMatch(/p_client_id/);
  });

  test("client shell and access routing use approvedAt (not onboardingCompletedAt)", () => {
    const shell = read("../components/client/ClientShell.tsx");
    expect(shell).toMatch(/!account\.approvedAt/);
    expect(shell).not.toMatch(/onboardingCompletedAt/);
    const access = read("../components/account/AccountAccess.tsx");
    expect(access).toMatch(/if \(account\.approvedAt\) return "\/client\/dashboard"/);
    expect(access).not.toMatch(/onboardingCompletedAt/);
  });

  test("old scripted onboarding + payment box are archived, not deleted", () => {
    for (const file of [
      "client-onboarding.ts",
      "ClientOnboardingChat.tsx",
      "PaymentBox.tsx",
      "PaymentSettingsForm.tsx",
    ]) {
      expect(read(`../../onboarding-archive/${file}`).length).toBeGreaterThan(100);
    }
    const archived = read("../../onboarding-archive/client-onboarding.ts");
    expect(archived).toMatch(/CLIENT_ONBOARDING_QUESTIONS/);
    expect(archived).toMatch(/PAYMENT_DONE_PROMPT/);
  });

  test("live chat bubble and coach messaging no longer reference the payment box", () => {
    const bubble = read("../components/chat/ChatMessageBubble.tsx");
    expect(bubble).not.toMatch(/ONBOARDING_PAYMENT_BOX_BODY/);
    expect(bubble).not.toMatch(/PaymentBox/);
    const messaging = read("../components/chat/CoachMessagingPage.tsx");
    expect(messaging).not.toMatch(/PaymentSettingsForm/);
    expect(messaging).not.toMatch(/value="payment"/);
  });
});

describe("B6 data isolation guards", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

  test("data-isolation migration locks app_state + program-covers to coach only", () => {
    const migration = read("../../supabase/migrations/20260826000000_data_isolation.sql");
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Authenticated users can read app state"/);
    expect(migration).toMatch(/CREATE POLICY "Coach can read app state"/);
    expect(migration).toMatch(/USING \(public\.is_app_coach\(\)\)/);
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Authenticated users can read program covers"/);
    expect(migration).toMatch(/CREATE POLICY "Coach can read program covers"/);
    expect(migration).not.toMatch(/auth\.uid\(\) IS NOT NULL\b/);
  });

  test("cloud cache hydrates clients from their own bundle first (isolation)", () => {
    const cache = read("../lib/cloud-cache.ts");
    expect(cache).toMatch(/get_client_program_bundle/);
    expect(cache).toMatch(/programs: \[bundle\.program\]/);
    expect(cache).toMatch(/bundle\.workouts/);
    expect(cache).toMatch(/bundle\.exercises/);
    expect(cache).toMatch(/bundle\.weight_units/);
    expect(cache).toMatch(/hydratePromise = null/); // re-fetch after approval
    expect(cache).not.toMatch(/from\("app_state"\)[\s\S]*maybeSingle\(\)[\s\S]*get_client_program_bundle/);
  });

  test("approval path re-hydrates the fresh bundle before entering the app", () => {
    const screen = read("../components/chat/ClientOnboardingScreen.tsx");
    expect(screen).toMatch(/invalidateCloudCache\(\)/);
    expect(screen).toMatch(/hydrateCloudCache\(\)/);
    expect(screen).toMatch(/navigate\(\{ to: "\/client\/dashboard", replace: true \}\)/);
  });

  test("client management can re-publish a client's program snapshot", () => {
    const page = read("../components/coach/ClientManagement.tsx");
    expect(page).toMatch(/Refresh client program/);
    expect(page).toMatch(/publishClientProgram/);
    expect(page).toMatch(/refreshProgram/);
  });
});
