import { KeyRound, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AccessCodeExpiryHours,
  type AccessCodeSummary,
  createAccessCode,
  deriveAccessCodeStatus,
  listAccessCodes,
  revokeAccessCode,
} from "@/lib/access-codes";
import { cn } from "@/lib/utils";
import { CodeRevealDialog } from "./CodeRevealDialog";

const EXPIRY_OPTIONS: { value: AccessCodeExpiryHours; label: string }[] = [
  { value: 24, label: "24 hours" },
  { value: 72, label: "72 hours" },
  { value: 168, label: "7 days" },
  { value: 720, label: "30 days" },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  redeemed: "Redeemed — account pending",
  used: "Used",
  expired: "Expired",
  revoked: "Revoked",
  locked: "Locked",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AccessCodesPage() {
  const [codes, setCodes] = useState<AccessCodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expiryHours, setExpiryHours] = useState<AccessCodeExpiryHours>(72);
  const [revealed, setRevealed] = useState<{ code: string; note: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCodes(await listAccessCodes());
    } catch (nextError) {
      console.error(nextError);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Access codes could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    const trimmedNote = note.trim();
    try {
      const created = await createAccessCode({
        note: trimmedNote,
        expiryHours,
      });
      setNote("");
      await load();
      setRevealed({ code: created.code, note: trimmedNote });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The access code could not be generated.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (code: AccessCodeSummary) => {
    if (revokingId) return;
    if (!window.confirm(`Revoke code ${code.prefix}-…? Clients can no longer use it.`)) return;
    setRevokingId(code.id);
    setError(null);
    try {
      await revokeAccessCode(code.id);
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The access code could not be revoked.",
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Access Codes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time codes that let clients sign in. Generate one per client after
          they pay you, send it in the DM, then approve them from Messaging or
          their client page.
        </p>
      </div>

      <section aria-labelledby="generate-heading" className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <h2 id="generate-heading" className="text-lg font-semibold text-foreground">
            Generate access code
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The code appears once — copy it and send it to your client.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="access-code-note">Note (optional)</Label>
            <Input
              id="access-code-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder="e.g. WhatsApp, paid $29"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access-code-expiry">Expires after</Label>
            <Select
              value={String(expiryHours)}
              onValueChange={(value) => setExpiryHours(Number(value) as AccessCodeExpiryHours)}
            >
              <SelectTrigger id="access-code-expiry" className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={generating}
            onClick={() => void generate()}
            className="min-h-12 rounded-xl text-[1rem] font-semibold"
          >
            <KeyRound className="mr-2 h-5 w-5" aria-hidden="true" />
            {generating ? "Generating…" : "Generate access code"}
          </Button>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-[1rem] leading-5 text-destructive" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="codes-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="codes-heading" className="text-lg font-semibold text-foreground">
            Codes
          </h2>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void load()}
            className="min-h-10 rounded-xl text-[1rem]"
            aria-label="Refresh access codes"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        ) : codes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <KeyRound className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 text-[1.125rem] font-medium leading-tight text-foreground">
              No access codes yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-[1rem] leading-6 text-muted-foreground">
              Generate one above to let a client in.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border rounded-xl border border-border">
            {codes.map((code) => {
              const status = deriveAccessCodeStatus(code);
              const revocable = status === "active";
              return (
                <li key={code.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[0.8125rem] font-semibold tracking-wider text-foreground">
                        {code.prefix}-…
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[0.75rem] font-medium",
                          status === "active" && "border-[#E50910]/40 bg-[#E50910]/10 text-[#E50910]",
                          status === "used" && "border-border text-muted-foreground",
                          (status === "expired" || status === "revoked" || status === "locked") &&
                            "border-destructive/30 bg-destructive/5 text-destructive",
                          status === "redeemed" && "border-primary/40 bg-primary/10 text-primary",
                        )}
                      >
                        {STATUS_LABEL[status] ?? status}
                      </span>
                      {code.failedAttempts > 0 && status !== "locked" && (
                        <span className="text-[0.75rem] text-muted-foreground">
                          {code.failedAttempts} failed attempt{code.failedAttempts === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {code.note && (
                      <p className="mt-1 truncate text-[1rem] text-foreground">{code.note}</p>
                    )}
                    <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">
                      {code.usedAt
                        ? `Used ${formatDateTime(code.usedAt)}`
                        : code.redeemedAt
                          ? `Redeemed ${formatDateTime(code.redeemedAt)} — awaiting account`
                          : `Created ${formatDateTime(code.createdAt)}`}
                      {" · "}expires {formatDateTime(code.expiresAt)}
                    </p>
                    {code.events.length > 0 && (
                      <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">
                        {code.events
                          .slice(0, 2)
                          .map((event) => `${event.event} ${formatDateTime(event.createdAt as string)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  {revocable && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={revokingId === code.id}
                      onClick={() => void revoke(code)}
                      className="min-h-10 shrink-0 rounded-xl text-[1rem] text-destructive"
                    >
                      {revokingId === code.id ? "Revoking…" : "Revoke"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {revealed && (
        <CodeRevealDialog
          code={revealed.code}
          note={revealed.note}
          onClose={() => setRevealed(null)}
        />
      )}
    </section>
  );
}
