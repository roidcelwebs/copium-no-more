import { useEffect, useMemo, useState } from "react";
import type { ProgramSummary } from "@/lib/coach-programs";
import { fetchProgramCoverUrls } from "@/lib/program-covers";

export function useProgramCoverUrls(programs: readonly ProgramSummary[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const coverKey = useMemo(
    () =>
      programs
        .map(
          (program) =>
            `${program.id}:${program.coverImagePath ?? ""}:${program.coverUpdatedAt ?? ""}`,
        )
        .join("|"),
    [programs],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchProgramCoverUrls(programs)
      .then((next) => {
        if (!cancelled) setUrls(next);
      })
      .catch((nextError: unknown) => {
        console.error("Failed to load program covers", nextError);
        if (!cancelled) setError("Program covers could not be loaded from this device.");
      });
    return () => {
      cancelled = true;
    };
    // coverKey deliberately reduces the dependency to cover identity/version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverKey]);

  return { urls, error };
}
