import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Check, RotateCw } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import { useProgressPictureBatches } from "@/hooks/use-progress-picture-batches";
import { setProgressPicturePreview } from "@/lib/cloud-progress-pictures";
import { formatProgressPictureDate } from "@/lib/progress-pictures";
import { ProgressPictureTile } from "./ProgressPictureTile";

export function ProgressPictureBatchPage({ batchId }: { batchId: string }) {
  const { account } = useAccount();
  const clientId = account?.role === "client" ? account.id : undefined;
  const progressPictures = useProgressPictureBatches(clientId);
  const batch = progressPictures.batches.find((candidate) => candidate.id === batchId);
  const [previewPictureId, setPreviewPictureId] = useState("");
  const [savingPictureId, setSavingPictureId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setPreviewPictureId(batch?.previewPictureId ?? "");
  }, [batch?.previewPictureId]);

  if (progressPictures.loading) {
    return (
      <section className="space-y-6">
        <BackToProgressPictures />
        <p className="text-sm text-muted-foreground">Loading progress pictures…</p>
      </section>
    );
  }

  if (progressPictures.error) {
    return (
      <section className="space-y-6">
        <BackToProgressPictures />
        <div className="rounded-lg border border-destructive/40 p-4">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {progressPictures.error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => void progressPictures.refresh()}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </Button>
        </div>
      </section>
    );
  }

  if (!batch || !clientId) {
    return (
      <section className="space-y-6">
        <BackToProgressPictures />
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Progress pictures unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This daily progress-picture batch could not be found.
          </p>
        </div>
      </section>
    );
  }

  const choosePreview = async (pictureId: string) => {
    if (pictureId === previewPictureId || savingPictureId) return;
    const previous = previewPictureId;
    setPreviewPictureId(pictureId);
    setSavingPictureId(pictureId);
    setSaveError(null);
    try {
      await setProgressPicturePreview({ clientId, batchId: batch.id, pictureId });
      await progressPictures.refresh();
    } catch (error) {
      console.error("Failed to update progress-picture preview", error);
      setPreviewPictureId(previous);
      setSaveError("The preview could not be updated. Try again.");
    } finally {
      setSavingPictureId(null);
    }
  };

  return (
    <section className="space-y-6">
      <BackToProgressPictures />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Progress Pictures
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {formatProgressPictureDate(batch.captureDate, "long")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the picture used as this day&apos;s preview.
        </p>
      </div>

      {saveError && (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {saveError}
        </p>
      )}

      <ul role="list" className="grid list-none grid-cols-3 gap-2 p-0">
        {batch.pictures.map((picture) => {
          const selected = picture.id === previewPictureId;
          const saving = picture.id === savingPictureId;
          return (
            <li key={picture.id}>
              <ProgressPictureTile
                imageUrl={picture.imageUrl}
                alt={`Progress picture from ${formatProgressPictureDate(batch.captureDate, "long")}`}
                footer={
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    disabled={savingPictureId !== null}
                    onClick={() => void choosePreview(picture.id)}
                    className="h-7 w-full gap-1 px-1 text-[10px]"
                  >
                    {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                    {saving ? "Saving…" : "Preview"}
                  </Button>
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BackToProgressPictures() {
  return (
    <Link
      to="/client/progress-pictures"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Progress Pictures
    </Link>
  );
}
