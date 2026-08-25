import { fetchAccount, updateLocalAccount } from "./cloud-accounts";
import { emitLocalEvent } from "./local-events";

export type JoinRequestStatus = "pending" | "approved";

export type LocalJoinRequest = {
  clientId: string;
  threadId: string;
  status: JoinRequestStatus;
  requestedAt: string;
  approvedAt?: string;
  approvedByCoachId?: string;
  imageCount: number;
};

export const LOCAL_JOIN_REQUESTS_CHANGED_EVENT = "no-more-copium:local-join-requests-changed";
const STORAGE_KEY = "no-more-copium:join-requests:v1";

export async function fetchJoinRequests(): Promise<LocalJoinRequest[]> {
  return readRequests().sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
}

export async function fetchPendingJoinRequests(): Promise<LocalJoinRequest[]> {
  return (await fetchJoinRequests()).filter((request) => request.status === "pending");
}

export async function fetchJoinRequest(clientId: string): Promise<LocalJoinRequest | null> {
  return readRequests().find((request) => request.clientId === clientId) ?? null;
}

export async function recordJoinRequestImage({
  clientId,
  threadId,
  imageCount,
}: {
  clientId: string;
  threadId: string;
  imageCount: number;
}): Promise<LocalJoinRequest> {
  const client = await fetchAccount(clientId);
  if (!client || client.role !== "client" || client.onboardingStep < 6) {
    throw new Error("Finish the Final Sequence before sending Join Request images.");
  }
  const requests = readRequests();
  const existing = requests.find((request) => request.clientId === clientId);
  const request: LocalJoinRequest = existing
    ? { ...existing, imageCount: existing.imageCount + imageCount }
    : {
        clientId,
        threadId,
        status: "pending",
        requestedAt: new Date().toISOString(),
        imageCount,
      };
  writeRequests([...requests.filter((candidate) => candidate.clientId !== clientId), request]);
  return request;
}

export function removeLocalJoinRequest(clientId: string): void {
  writeRequests(readRequests().filter((request) => request.clientId !== clientId));
}

export async function approveJoinRequest({
  clientId,
  coachId,
}: {
  clientId: string;
  coachId: string;
}): Promise<LocalJoinRequest> {
  const coach = await fetchAccount(coachId);
  if (!coach || coach.role !== "coach") throw new Error("A local Coach account is required.");
  const requests = readRequests();
  const existing = requests.find((request) => request.clientId === clientId);
  if (!existing) throw new Error("Join Request was not found on this device.");
  if (existing.status === "approved") return existing;
  const approvedAt = new Date().toISOString();
  const approved: LocalJoinRequest = {
    ...existing,
    status: "approved",
    approvedAt,
    approvedByCoachId: coachId,
  };
  await updateLocalAccount(clientId, { onboardingStep: 6, onboardingCompletedAt: approvedAt });
  writeRequests([...requests.filter((request) => request.clientId !== clientId), approved]);
  return approved;
}

function readRequests(): LocalJoinRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as LocalJoinRequest[]) : [];
  } catch {
    return [];
  }
}

function writeRequests(requests: LocalJoinRequest[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  emitLocalEvent(LOCAL_JOIN_REQUESTS_CHANGED_EVENT);
}
