import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type AppAccount,
  readLocalAccounts,
  readActiveAccountId,
  storeActiveAccountId,
  createAccount,
  resetLocalAccounts,
} from "@/lib/cloud-accounts";
import { hydrateCloudCache } from "@/lib/cloud-cache";
import { hydratePaymentSettings } from "@/lib/payment-settings";

type AccountContextValue = {
  account: AppAccount | null;
  accounts: AppAccount[];
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  completeAccessCodeAccount: (name: string, username: string, ticket: string) => Promise<AppAccount>;
  loginCoach: (password: string) => Promise<AppAccount>;
  login: (account: AppAccount) => void;
  refresh: () => Promise<void>;
  switchAccount: (account: AppAccount) => void;
  createLocalClient: (name: string, username?: string) => Promise<AppAccount>;
  resetToDefaults: () => void;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [accounts, setAccounts] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const all = readLocalAccounts();
      setAccounts(all);
      const activeId = readActiveAccountId();
      let active = all.find((acc) => acc.id === activeId) ?? null;
      if (!active && all.length > 0) {
        active = all.find((acc) => acc.role === "coach") ?? all[0];
        storeActiveAccountId(active.id);
      }
      setAccount(active);
      try {
        await hydrateCloudCache();
        await hydratePaymentSettings();
      } catch {
        // hydration is best-effort in prototype mode
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback((next: AppAccount) => {
    storeActiveAccountId(next.id);
    setAccount(next);
    const all = readLocalAccounts();
    setAccounts(all);
    try {
      void hydrateCloudCache();
      void hydratePaymentSettings();
    } catch {
      // local prototype hydration
    }
  }, []);

  const switchAccount = useCallback(
    (next: AppAccount) => {
      login(next);
    },
    [login],
  );

  const createLocalClient = useCallback(
    async (name: string, username?: string): Promise<AppAccount> => {
      const uName =
        username?.trim() ||
        `client_${name.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now().toString().slice(-4)}`;
      const created = await createAccount({
        name: name.trim(),
        username: uName,
        role: "client",
      });
      login(created);
      return created;
    },
    [login],
  );

  const resetToDefaults = useCallback(() => {
    const defaults = resetLocalAccounts();
    setAccounts(defaults);
    const coach = defaults.find((acc) => acc.role === "coach") ?? defaults[0];
    login(coach);
  }, [login]);

  const signOut = useCallback(async () => {
    storeActiveAccountId(null);
    setAccount(null);
  }, []);

  // Stubs for legacy interfaces
  const signInWithGoogle = useCallback(async () => {
    const all = readLocalAccounts();
    const client = all.find((acc) => acc.role === "client") ?? all[0];
    login(client);
  }, [login]);

  const completeAccessCodeAccount = useCallback(
    async (name: string, username: string, _ticket: string): Promise<AppAccount> => {
      return createLocalClient(name, username);
    },
    [createLocalClient],
  );

  const loginCoach = useCallback(
    async (_password: string): Promise<AppAccount> => {
      const all = readLocalAccounts();
      const coach = all.find((acc) => acc.role === "coach") ?? all[0];
      login(coach);
      return coach;
    },
    [login],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      account,
      accounts,
      loading,
      configured: true,
      signInWithGoogle,
      completeAccessCodeAccount,
      loginCoach,
      login,
      refresh,
      switchAccount,
      createLocalClient,
      resetToDefaults,
      signOut,
    }),
    [
      account,
      accounts,
      loading,
      signInWithGoogle,
      completeAccessCodeAccount,
      loginCoach,
      login,
      refresh,
      switchAccount,
      createLocalClient,
      resetToDefaults,
      signOut,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside AccountProvider");
  return value;
}
