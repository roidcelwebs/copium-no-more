import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkoutHistoryList } from "@/components/workout-history/WorkoutHistoryList";
import {
  approveClientWithProgram,
  createAccessCode,
  publishClientProgram,
} from "@/lib/access-codes";
import { type AppAccount, fetchAccount, updateCloudClientAssignment } from "@/lib/cloud-accounts";
import { type ProgramSummary, loadPrograms } from "@/lib/coach-programs";
import { CodeRevealDialog } from "./CodeRevealDialog";

const NO_PROGRAM_VALUE = "__no_program__";

export function ClientManagement({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<AppAccount | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState<{ code: string; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAccount(clientId), Promise.resolve(loadPrograms())])
      .then(([nextClient, nextPrograms]) => {
        setClient(nextClient?.role === "client" ? nextClient : null);
        setPrograms(nextPrograms);
      })
      .catch((nextError: unknown) => {
        console.error(nextError);
        setError("Client data could not be loaded from this device.");
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  const assignedProgram = useMemo(
    () => programs.find((program) => program.id === client?.assignedProgramId),
    [client?.assignedProgramId, programs],
  );

  if (loading) return null;

  if (!client) {
    return (
      <section className="space-y-6">
        <BackToDashboard />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Client not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ?? "This client account is not available on this device."}
          </p>
        </div>
      </section>
    );
  }

  const selectedValue = assignedProgram?.id ?? NO_PROGRAM_VALUE;

  const changeAssignment = async (value: string) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCloudClientAssignment(
        client.id,
        value === NO_PROGRAM_VALUE ? undefined : value,
      );
      setClient(updated);
    } catch (nextError) {
      console.error(nextError);
      setError("The program assignment could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const issueCode = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const created = await createAccessCode({
        note: `Client: @${client.username}`,
        expiryHours: 72,
      });
      setRevealed({ code: created.code, note: `Client: @${client.username}` });
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

  const refreshProgram = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setApproveMessage(null);
    setError(null);
    try {
      await publishClientProgram(client.id);
      setApproveMessage(
        `${client.name}'s program snapshot is up to date.`,
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The program snapshot could not be refreshed.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const approve = async () => {
    if (approving) return;
    if (!client.assignedProgramId) return;
    setApproving(true);
    setApproveMessage(null);
    setError(null);
    try {
      await approveClientWithProgram(client.id);
      const updated = await fetchAccount(client.id);
      if (updated) setClient(updated);
      setApproveMessage(
        `${client.name} is approved. They now have full access to their program and chat.`,
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The client could not be approved.",
      );
    } finally {
      setApproving(false);
    }
  };

  return (
    <section className="space-y-6">
      <BackToDashboard />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {client.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">@{client.username}</p>
      </div>

      <section aria-labelledby="program-assignment-heading" className="space-y-3">
        <div>
          <h2 id="program-assignment-heading" className="text-lg font-semibold text-foreground">
            Program assignment
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign, change, or clear this client&apos;s training program.
          </p>
        </div>

        {programs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">No programs are available yet.</p>
            <Link
              to="/coach/programs"
              className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Go to Program Manager
            </Link>
          </div>
        ) : (
          <div className="max-w-sm space-y-2">
            <label htmlFor="client-program" className="text-sm font-medium text-foreground">
              Training program
            </label>
            <Select
              value={selectedValue}
              disabled={saving}
              onValueChange={(value) => void changeAssignment(value)}
            >
              <SelectTrigger id="client-program" className="h-10" aria-label="Training program">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROGRAM_VALUE}>No program assigned</SelectItem>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {saving ? "Saving…" : "Changes save automatically."}
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="client-access-heading" className="space-y-3">
        <div>
          <h2 id="client-access-heading" className="text-lg font-semibold text-foreground">
            Access &amp; approval
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Issue a one-time code so the client can sign in, then approve them
            once their first payment is confirmed.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            {client.approvedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[0.8125rem] font-semibold text-primary">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E50910]/40 bg-[#E50910]/10 px-2.5 py-1 text-[0.8125rem] font-semibold text-[#E50910]">
                Awaiting approval
              </span>
            )}
            {client.approvedAt && (
              <p className="text-sm text-muted-foreground">
                Approved {new Date(client.approvedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {approveMessage && (
            <p
              className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-[1rem] leading-5 text-primary"
              role="status"
            >
              {approveMessage}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={generating}
              onClick={() => void issueCode()}
              className="min-h-11 rounded-xl text-[1rem] font-semibold"
            >
              <KeyRound className="mr-2 h-5 w-5" aria-hidden="true" />
              {generating ? "Generating…" : "Issue access code"}
            </Button>
            {!client.approvedAt && (
              <Button
                type="button"
                disabled={approving || !client.assignedProgramId}
                onClick={() => void approve()}
                className="min-h-11 rounded-xl text-[1rem] font-semibold"
                title={
                  client.assignedProgramId
                    ? "Approve this client"
                    : "Assign a training program before approving"
                }
              >
                <BadgeCheck className="mr-2 h-5 w-5" aria-hidden="true" />
                {approving ? "Approving…" : "Approve client"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={refreshing || !client.assignedProgramId}
              onClick={() => void refreshProgram()}
              className="min-h-11 rounded-xl text-[1rem] font-semibold"
              title="Re-publish this client's program snapshot after you edit the library"
            >
              <RefreshCw className="mr-2 h-5 w-5" aria-hidden="true" />
              {refreshing ? "Refreshing…" : "Refresh client program"}
            </Button>
          </div>

          {!client.approvedAt && !client.assignedProgramId && (
            <p className="text-sm text-muted-foreground">
              Assign a training program above before you can approve this client.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="client-workout-history-heading" className="space-y-3">
        <div>
          <h2 id="client-workout-history-heading" className="text-lg font-semibold text-foreground">
            Workout history
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review completed sessions and notes this client sent to you.
          </p>
        </div>
        <WorkoutHistoryList clientId={client.id} />
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

function BackToDashboard() {
  return (
    <Link
      to="/coach/dashboard"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Dashboard
    </Link>
  );
}
