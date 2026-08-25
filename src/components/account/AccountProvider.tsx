import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/config";
import {
  type AppAccount,
  NoAccountError,
  bootstrapAccount,
} from "@/lib/cloud-accounts";
import { createClientAccount, loginCoach as loginCoachRequest } from "@/lib/access-codes";
import { hydrateCloudCache } from "@/lib/cloud-cache";
import { hydratePaymentSettings } from "@/lib/payment-settings";

type AccountContextValue = {
  account: AppAccount | null;
  accounts: AppAccount[];
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Redeem a code is handled by the caller; this links the burned code's
   *  ticket to a Google identity after sign-up by creating the app account. */
  completeAccessCodeAccount: (name: string, username: string, ticket: string) => Promise<AppAccount>;
  /** Coach master-password sign-in (replaces the old Google coach identity). */
  loginCoach: (password: string) => Promise<AppAccount>;
  login: (account: AppAccount) => void;
  refresh: () => Promise<void>;
  switchAccount: (account: AppAccount) => void;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  const refresh = useCallback(async () => {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      setAccounts([]);
      setAccount(null);
      setLoading(false);
      return;
    }
    try {
      // Bootstrap returns the existing account or a structured no_account error.
      const next = await bootstrapAccount();
      // Load coach-authored content + payment settings BEFORE the account is
      // visible so components read hydrated data on first render.
      await hydrateCloudCache();
      await hydratePaymentSettings();
      setAccount(next);
      setAccounts([next]);
    } catch (error) {
      if (error instanceof NoAccountError) {
        // Signed in but no app account yet — the access page drives creation.
        console.warn("Signed-in identity has no app account yet:", error.message);
      } else {
        console.error("Account bootstrap failed", error);
      }
      setAccount(null);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    void refresh();
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void refresh();
      } else if (event === "SIGNED_OUT") {
        setAccount(null);
        setAccounts([]);
        setLoading(false);
      }
    });
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [configured, refresh]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/access` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) throw error;
    // OAuth redirects away; on return, AccountAccess resumes the flow.
  }, []);

  const completeAccessCodeAccount = useCallback(
    async (name: string, username: string, ticket: string): Promise<AppAccount> => {
      const next = await createClientAccount({ name, username, ticket });
      setAccount(next);
      setAccounts([next]);
      return next;
    },
    [],
  );

  const loginCoach = useCallback(
    async (password: string): Promise<AppAccount> => {
      const result = await loginCoachRequest(password);
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      setAccount(result.account);
      setAccounts([result.account]);
      try {
        await hydrateCloudCache();
        await hydratePaymentSettings();
      } catch {
        // hydration is best-effort; the account is already usable
      }
      return result.account;
    },
    [],
  );

  const login = useCallback((next: AppAccount) => {
    setAccount(next);
    setAccounts([next]);
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      account,
      accounts,
      loading,
      configured,
      signInWithGoogle,
      completeAccessCodeAccount,
      loginCoach,
      login,
      refresh,
      switchAccount: login,
      signOut: async () => {
        await supabase.auth.signOut();
        setAccount(null);
        setAccounts([]);
      },
    }),
    [
      account,
      accounts,
      loading,
      configured,
      signInWithGoogle,
      completeAccessCodeAccount,
      loginCoach,
      login,
      refresh,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

// The provider and hook intentionally share this small module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside AccountProvider");
  return value;
}
