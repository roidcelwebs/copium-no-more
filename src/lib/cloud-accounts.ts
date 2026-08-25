import { LOCAL_CHAT_CHANGED_EVENT, emitLocalEvent } from "./local-events";

export type AccountRole = "coach" | "client" | "payment_manager";

export type AppAccount = {
  id: string;
  name: string;
  username: string;
  role: AccountRole;
  isPreview: boolean;
  onboardingStep: number;
  onboardingCompletedAt?: string;
  approvedAt?: string;
  assignedProgramId?: string;
  createdAt: string;
};

export const ACTIVE_ACCOUNT_STORAGE_KEY = "no-more-copium:active-account:v3";
export const LOCAL_ACCOUNTS_STORAGE_KEY = "no-more-copium:accounts:v3";
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const DEFAULT_PROTOTYPE_ACCOUNTS: AppAccount[] = [
  {
    id: "coach-hal",
    name: "Hal",
    username: "coach",
    role: "coach",
    isPreview: true,
    onboardingStep: 0,
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: "client-bobby",
    name: "Bobby",
    username: "bobby_07",
    role: "client",
    isPreview: true,
    onboardingStep: 5,
    onboardingCompletedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    assignedProgramId: "sample-program-1",
    createdAt: new Date().toISOString(),
  },
  {
    id: "client-marcus",
    name: "Marcus",
    username: "marcus_fit",
    role: "client",
    isPreview: true,
    onboardingStep: 5,
    onboardingCompletedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    assignedProgramId: "sample-program-1",
    createdAt: new Date().toISOString(),
  },
  {
    id: "client-dylan",
    name: "Dylan",
    username: "dylan_lift",
    role: "client",
    isPreview: true,
    onboardingStep: 1,
    approvedAt: undefined,
    createdAt: new Date().toISOString(),
  },
  {
    id: "pm-jakub",
    name: "Jakub",
    username: "jakub_pm",
    role: "payment_manager",
    isPreview: true,
    onboardingStep: 0,
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export function normalizeUsername(value: string): string {
  return value.trim();
}

export function usernameKey(value: string): string {
  return normalizeUsername(value).toLowerCase();
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Use only lowercase letters (a–z), numbers, and underscores.";
  }
  return null;
}

export function readLocalAccounts(): AppAccount[] {
  if (typeof window === "undefined") return DEFAULT_PROTOTYPE_ACCOUNTS;
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      writeLocalAccounts(DEFAULT_PROTOTYPE_ACCOUNTS);
      return DEFAULT_PROTOTYPE_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeLocalAccounts(DEFAULT_PROTOTYPE_ACCOUNTS);
      return DEFAULT_PROTOTYPE_ACCOUNTS;
    }
    return parsed as AppAccount[];
  } catch {
    return DEFAULT_PROTOTYPE_ACCOUNTS;
  }
}

export function writeLocalAccounts(accounts: AppAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    emitLocalEvent(LOCAL_CHAT_CHANGED_EVENT);
  } catch (error) {
    console.error("Could not write local accounts", error);
  }
}

export function resetLocalAccounts(): AppAccount[] {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LOCAL_ACCOUNTS_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
  }
  writeLocalAccounts(DEFAULT_PROTOTYPE_ACCOUNTS);
  return DEFAULT_PROTOTYPE_ACCOUNTS;
}

export async function fetchAccount(accountId: string): Promise<AppAccount | null> {
  const accounts = readLocalAccounts();
  return accounts.find((acc) => acc.id === accountId) ?? null;
}

export async function fetchAccounts(): Promise<AppAccount[]> {
  return readLocalAccounts();
}

export async function fetchPublicCoachAccount(): Promise<AppAccount | null> {
  const accounts = readLocalAccounts();
  return accounts.find((acc) => acc.role === "coach") ?? DEFAULT_PROTOTYPE_ACCOUNTS[0];
}

export class NoAccountError extends Error {
  readonly code = "no_account";
  constructor(
    message = "No account has been created with this Google account. Create an account first.",
  ) {
    super(message);
    this.name = "NoAccountError";
  }
}

export async function bootstrapAccount(): Promise<AppAccount> {
  const activeId = readActiveAccountId();
  const accounts = readLocalAccounts();
  if (activeId) {
    const found = accounts.find((acc) => acc.id === activeId);
    if (found) return found;
  }
  // Default to coach if none active
  const coach = accounts.find((acc) => acc.role === "coach") ?? accounts[0];
  storeActiveAccountId(coach.id);
  return coach;
}

export async function createAccount(input: {
  name: string;
  username: string;
  role: AccountRole;
}): Promise<AppAccount> {
  const accounts = readLocalAccounts();
  const normUser = normalizeUsername(input.username).toLowerCase();
  if (accounts.some((acc) => acc.username.toLowerCase() === normUser)) {
    throw new Error("That username is already taken. Please pick another.");
  }
  const newAccount: AppAccount = {
    id: `local-${input.role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim() || "Lifter",
    username: normUser || `lifter_${Date.now().toString().slice(-4)}`,
    role: input.role,
    isPreview: true,
    onboardingStep: input.role === "client" ? 1 : 0,
    approvedAt: input.role === "coach" || input.role === "payment_manager" ? new Date().toISOString() : undefined,
    createdAt: new Date().toISOString(),
  };
  const nextList = [...accounts, newAccount];
  writeLocalAccounts(nextList);
  storeActiveAccountId(newAccount.id);
  return newAccount;
}

export async function updateCloudClientAssignment(
  clientId: string,
  assignedProgramId: string | undefined,
): Promise<AppAccount> {
  return updateLocalAccount(clientId, { assignedProgramId });
}

export async function updateLocalAccount(
  accountId: string,
  updates: Partial<
    Pick<
      AppAccount,
      "onboardingStep" | "onboardingCompletedAt" | "approvedAt" | "assignedProgramId" | "name"
    >
  >,
): Promise<AppAccount> {
  const accounts = readLocalAccounts();
  const index = accounts.findIndex((acc) => acc.id === accountId);
  if (index === -1) {
    throw new Error("Account not found.");
  }
  const current = accounts[index];
  const updated: AppAccount = {
    ...current,
    ...updates,
  };
  accounts[index] = updated;
  writeLocalAccounts(accounts);
  return updated;
}

export function readActiveAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
}

export function storeActiveAccountId(accountId: string | null): void {
  if (typeof window === "undefined") return;
  if (accountId) window.localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
  else window.localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
}
