import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  type AppAccount,
  NoAccountError,
  bootstrapAccount,
  normalizeUsername,
  validateUsername,
} from "@/lib/cloud-accounts";
import {
  clearAccessTicket,
  formatAccessCode,
  isValidAccessCodeFormat,
  normalizeAccessCode,
  readAccessTicket,
  redeemAccessCode,
  storeAccessTicket,
  validateName,
} from "@/lib/access-codes";
import { useAccount } from "./AccountProvider";
import { GoogleSignInButton } from "./GoogleSignInButton";

type Phase = "loading" | "entry" | "details" | "coach" | "error";

function enterRouteFor(account: AppAccount): string {
  if (account.role === "coach") return "/coach/dashboard";
  if (account.approvedAt) return "/client/dashboard";
  return "/onboarding";
}

export function AccountAccess() {
  const navigate = useNavigate();
  const { login, loginCoach, completeAccessCodeAccount, configured, signInWithGoogle } =
    useAccount();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [noAccountError, setNoAccountError] = useState<string | null>(null);

  // Code (Create account) dialog
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Post-Google name + username
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [usernameServerError, setUsernameServerError] = useState<string | null>(null);

  // Coach password
  const [coachPassword, setCoachPassword] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  /**
   * Runs after a session exists: routes existing accounts, or drives the
   * post-Google creation flow when a ticket (burned code) is pending.
   */
  const continueWithSession = useCallback(async (): Promise<void> => {
    try {
      const account = await bootstrapAccount();
      if (account) {
        const ticket = readAccessTicket();
        if (ticket) {
          // Identity already has an account (e.g. re-login) — burn the ticket
          // server-side so the code can never be reused.
          try {
            await completeAccessCodeAccount(account.name, account.username, ticket);
          } catch {
            // best-effort; the code is burned lazily by the edge function
          }
          clearAccessTicket();
        }
        login(account);
        void navigate({ to: enterRouteFor(account) as never });
        return;
      }
      setPhase("entry");
    } catch (nextError) {
      if (nextError instanceof NoAccountError) {
        const ticket = readAccessTicket();
        if (ticket) {
          setPhase("details");
        } else {
          setNoAccountError(
            "No account has been created with this Google account. Create an account first.",
          );
          setPhase("entry");
        }
        return;
      }
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Your account could not be loaded. What happened: sign-in check failed. Why: the session may be incomplete. What to do: refresh the page and try again.",
      );
      setPhase("error");
    }
  }, [completeAccessCodeAccount, login, navigate]);

  useEffect(() => {
    if (!configured) {
      setPhase("error");
      setError(
        "Cloud is not connected. What happened: Supabase environment variables are missing. Why: Lovable Cloud is not enabled for this project. What to do: enable Lovable Cloud and rebuild.",
      );
      return;
    }
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setPhase("entry");
        return;
      }
      await continueWithSession();
    })();
  }, [configured, continueWithSession]);

  const submitCode = async () => {
    if (codeBusy) return;
    setCodeError(null);
    const normalized = normalizeAccessCode(code);
    if (!isValidAccessCodeFormat(normalized)) {
      setCodeError("Enter the 12-character access code your coach sent you.");
      return;
    }
    setCodeBusy(true);
    try {
      const { ticket, expiresInSeconds } = await redeemAccessCode(normalized);
      storeAccessTicket(ticket, expiresInSeconds);
      setCodeModalOpen(false);
      setCode("");
      setNoAccountError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await continueWithSession();
      } else {
        await signInWithGoogle(); // redirects to Google; ticket stays in sessionStorage
      }
    } catch (nextError) {
      setCodeError(
        nextError instanceof Error
          ? nextError.message
          : "That code could not be checked. What happened: the code check failed. Why: the cloud may be busy. What to do: try again in a moment.",
      );
    } finally {
      setCodeBusy(false);
    }
  };

  const nameError = nameTouched ? validateName(name) : null;
  const usernameError =
    usernameTouched ? (usernameServerError ?? validateUsername(username)) : null;

  const submitDetails = async () => {
    setNameTouched(true);
    setUsernameTouched(true);
    const nErr = validateName(name);
    const uErr = validateUsername(username);
    if (nErr || uErr) {
      setDetailsError(nErr ?? uErr ?? null);
      return;
    }
    const ticket = readAccessTicket();
    if (!ticket) {
      setDetailsError(
        "Your sign-up link has expired. What happened: the one-time link from your access code ran out after 30 minutes. Why: account creation must finish in one sitting. What to do: enter a new access code from your coach.",
      );
      setCodeModalOpen(true);
      return;
    }
    setDetailsBusy(true);
    setDetailsError(null);
    try {
      const account = await completeAccessCodeAccount(
        name.trim().replace(/\s+/g, " "),
        normalizeUsername(username),
        ticket,
      );
      clearAccessTicket();
      void navigate({ to: enterRouteFor(account) as never });
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Your account could not be created. What happened: creation failed. Why: the cloud may be busy. What to do: try again in a moment.";
      if (/username/i.test(message)) {
        setUsernameServerError(message);
        setDetailsError(null);
      } else if (/expired|link/i.test(message)) {
        clearAccessTicket();
        setDetailsError(message);
      } else {
        setDetailsError(message);
      }
    } finally {
      setDetailsBusy(false);
    }
  };

  const submitCoach = async () => {
    if (coachBusy || !coachPassword.trim()) return;
    setCoachBusy(true);
    setCoachError(null);
    try {
      await loginCoach(coachPassword);
      void navigate({ to: "/coach/dashboard" });
    } catch (nextError) {
      setCoachError(
        nextError instanceof Error
          ? nextError.message
          : "Coach sign-in failed. What happened: the password was not accepted. Why: it may be typed incorrectly. What to do: check the coach master password and try again.",
      );
    } finally {
      setCoachBusy(false);
    }
  };

  const switchGoogleAccount = async () => {
    setNoAccountError(null);
    await supabase.auth.signOut();
    setPhase("entry");
  };

  if (phase === "loading") {
    return (
      <div className="space-y-3" aria-label="Loading your account">
        <div className="h-12 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        <div className="h-14 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        <div className="h-10 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
      </div>
    );
  }

  if (phase === "entry") {
    return (
      <div className="space-y-4">
        {noAccountError && (
          <div className="space-y-3">
            <div
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 break-words">{noAccountError}</p>
            </div>
            <Button
              type="button"
              onClick={() => setCodeModalOpen(true)}
              className="min-h-12 w-full rounded-xl text-[1rem] font-semibold"
            >
              Create an account
            </Button>
          </div>
        )}

        <GoogleSignInButton />

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[0.8125rem] uppercase tracking-wide text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setCodeModalOpen(true)}
          className="min-h-12 w-full rounded-xl text-[1rem] font-semibold border-border hover:bg-muted/40"
        >
          <KeyRound className="mr-2 h-5 w-5" aria-hidden="true" />
          Create account
        </Button>

        <p className="text-center text-[0.875rem] leading-5 text-muted-foreground">
          Already have an account? Sign in with the same Google account you used
          when you joined.
        </p>

        <button
          type="button"
          onClick={() => setPhase("coach")}
          className="mx-auto block text-[0.875rem] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Coach? Sign in with your account password
        </button>

        <CodeEntryDialog
          open={codeModalOpen}
          onOpenChange={setCodeModalOpen}
          code={code}
          setCode={setCode}
          busy={codeBusy}
          error={codeError}
          onSubmit={() => void submitCode()}
        />
      </div>
    );
  }

  if (phase === "details") {
    return (
      <form onSubmit={(event) => { event.preventDefault(); void submitDetails(); }} className="space-y-5" noValidate>
        <div className="space-y-1.5 text-left">
          <Label htmlFor="access-account-name">Your name</Label>
          <Input
            id="access-account-name"
            value={name}
            onChange={(event) => { setName(event.target.value); setDetailsError(null); }}
            onBlur={() => setNameTouched(true)}
            maxLength={80}
            placeholder="Your name"
            autoFocus
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "access-name-error access-name-count" : "access-name-count"}
            aria-required="true"
          />
          <div className="flex items-center justify-between gap-2">
            {nameError ? (
              <p id="access-name-error" className="flex items-start gap-1.5 text-[1rem] leading-5 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{nameError}</span>
              </p>
            ) : null}
            <span id="access-name-count" className="ml-auto shrink-0 text-[0.8125rem] tabular-nums text-muted-foreground" aria-live="polite">
              {name.length}/80
            </span>
          </div>
        </div>
        <div className="space-y-1.5 text-left">
          <Label htmlFor="access-account-username">Your username</Label>
          <Input
            id="access-account-username"
            value={username}
            onChange={(event) => { setUsername(event.target.value); setUsernameServerError(null); setDetailsError(null); }}
            onBlur={() => setUsernameTouched(true)}
            placeholder="Your username"
            maxLength={30}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!usernameError}
            aria-describedby={usernameError ? "access-username-error access-username-hint access-username-count" : "access-username-hint access-username-count"}
            aria-required="true"
          />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {usernameError ? (
                <p id="access-username-error" className="flex items-start gap-1.5 text-[1rem] leading-5 text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{usernameError}</span>
                </p>
              ) : (
                <p id="access-username-hint" className="text-[1rem] leading-5 text-muted-foreground">
                  3–30 lowercase letters (a–z), numbers, and underscores. Unique.
                </p>
              )}
            </div>
            <span id="access-username-count" className="shrink-0 text-[0.8125rem] tabular-nums text-muted-foreground" aria-live="polite">
              {username.length}/30
            </span>
          </div>
        </div>
        {detailsError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 break-words">{detailsError}</p>
          </div>
        )}
        <Button
          type="submit"
          className="min-h-12 w-full rounded-xl text-[1rem] font-semibold"
          disabled={detailsBusy}
        >
          {detailsBusy ? "Creating account…" : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full rounded-xl text-[1rem]"
          disabled={detailsBusy}
          onClick={() => void switchGoogleAccount()}
        >
          Use a different Google account
        </Button>

        <CodeEntryDialog
          open={codeModalOpen}
          onOpenChange={setCodeModalOpen}
          code={code}
          setCode={setCode}
          busy={codeBusy}
          error={codeError}
          onSubmit={() => void submitCode()}
        />
      </form>
    );
  }

  if (phase === "coach") {
    return (
      <form onSubmit={(event) => { event.preventDefault(); void submitCoach(); }} className="space-y-5" noValidate>
        <div className="space-y-1.5 text-left">
          <Label htmlFor="coach-password">Coach password</Label>
          <Input
            id="coach-password"
            type="password"
            value={coachPassword}
            onChange={(event) => setCoachPassword(event.target.value)}
            placeholder="Coach master password"
            autoComplete="current-password"
            autoFocus
            aria-required="true"
            aria-describedby={coachError ? "coach-password-error" : undefined}
            aria-invalid={!!coachError}
          />
          {coachError && (
            <p id="coach-password-error" className="flex items-start gap-1.5 text-[1rem] leading-5 text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{coachError}</span>
            </p>
          )}
        </div>
        <Button
          type="submit"
          className="min-h-12 w-full rounded-xl text-[1rem] font-semibold"
          disabled={coachBusy || !coachPassword.trim()}
        >
          {coachBusy ? "Signing in…" : "Sign in as Coach"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full rounded-xl text-[1rem]"
          disabled={coachBusy}
          onClick={() => { setPhase("entry"); setCoachPassword(""); setCoachError(null); }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive" role="alert">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 break-words">{error}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-12 w-full rounded-xl text-[1rem]"
        onClick={() => { setError(null); setPhase("loading"); void (async () => {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) { setPhase("entry"); return; }
          await continueWithSession();
        })(); }}
      >
        Try again
      </Button>
    </div>
  );
}

function CodeEntryDialog({
  open,
  onOpenChange,
  code,
  setCode,
  busy,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-[1.25rem] font-semibold tracking-tight text-foreground">
            Enter your access code
          </DialogTitle>
          <DialogDescription className="text-[1rem] leading-6 text-muted-foreground">
            Your coach sent you a code after your first payment. It works once.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5 text-left">
            <Label htmlFor="access-code-input">Access code</Label>
            <Input
              id="access-code-input"
              value={code}
              onChange={(event) => setCode(formatAccessCode(event.target.value).slice(0, 14))}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              maxLength={14}
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? "access-code-error" : "access-code-hint"}
            />
            {error ? (
              <p id="access-code-error" className="flex items-start gap-1.5 text-[1rem] leading-5 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : (
              <p id="access-code-hint" className="text-[1rem] leading-5 text-muted-foreground">
                Pasting works. The code is checked once and then expires.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-12 flex-1 rounded-xl text-[1rem]"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-12 flex-1 rounded-xl text-[1rem] font-semibold"
              disabled={busy || !code.trim()}
            >
              {busy ? "Checking…" : "Submit code"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
