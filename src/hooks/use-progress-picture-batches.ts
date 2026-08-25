import { useCallback, useEffect, useState } from "react";
import { fetchProgressPictureBatches } from "@/lib/cloud-progress-pictures";
import { LOCAL_PROGRESS_PICTURES_CHANGED_EVENT } from "@/lib/local-events";
import type { ProgressPictureBatch } from "@/lib/progress-pictures";

export function useProgressPictureBatches(clientId: string | undefined) {
  const [batches, setBatches] = useState<ProgressPictureBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (showLoading = false) => {
      if (!clientId) {
        setBatches([]);
        setLoading(false);
        return;
      }
      if (showLoading) setLoading(true);
      setError(null);
      try {
        setBatches(await fetchProgressPictureBatches(clientId));
      } catch (nextError) {
        console.error("Failed to load local progress pictures", nextError);
        setError("Progress pictures could not be loaded from this device.");
      } finally {
        setLoading(false);
      }
    },
    [clientId],
  );

  useEffect(() => {
    void refresh(true);
    const onChange = () => void refresh();
    window.addEventListener(LOCAL_PROGRESS_PICTURES_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(LOCAL_PROGRESS_PICTURES_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refresh]);

  return { batches, loading, error, refresh: () => refresh(true) };
}
