import { useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function GoogleSignInButton({
  variant = "default",
  className,
  tabIndex,
}: {
  variant?: "default" | "landing";
  className?: string;
  tabIndex?: number;
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/access` },
      });
      // The page redirects to Google; nothing else to do here.
    } catch (nextError) {
      setSigningIn(false);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Google sign-in could not be started. What happened: OAuth failed. Why: the Google provider may not be configured. What to do: check Auth → Google in Lovable Cloud settings.",
      );
    }
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={signingIn}
        tabIndex={tabIndex}
        className={cn(
          "inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-70",
          variant === "landing"
            ? "border border-black/10 bg-white text-[#1f1f1f] shadow-sm hover:bg-[#f8f8f8] active:scale-[0.98] focus-visible:ring-white focus-visible:ring-offset-black"
            : "rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-background",
          className,
        )}
      >
        {signingIn ? (
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleIcon />
        )}
        {signingIn ? "Opening Google…" : "Log in with Google"}
      </button>
      {error && (
        <div
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-[1rem] leading-5 text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{error}</p>
        </div>
      )}
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.86Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.36-2.29V6.62H1.27a12 12 0 0 0 0 10.76l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 1.27 6.62l4 3.09C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}
