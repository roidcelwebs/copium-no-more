import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Grid2X2, ImageIcon, List, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/account/AccountProvider";
import {
  PROGRESS_PICTURE_VIEW_STORAGE_KEY,
  type ProgressPictureBatch,
  formatProgressPictureDate,
  formatProgressPictureMonth,
  getProgressPicturePreview,
  groupProgressPictureBatchesByMonth,
  sortProgressPictureBatches,
} from "@/lib/progress-pictures";
import { cn } from "@/lib/utils";
import { useProgressPictureBatches } from "@/hooks/use-progress-picture-batches";
import { ProgressPictureTile } from "./ProgressPictureTile";
import { ProgressPictureUploadDialog } from "./ProgressPictureUploadDialog";

type ProgressPictureView = "list" | "grid";

export function ProgressPicturesPage() {
  const { account } = useAccount();
  const progressPictures = useProgressPictureBatches(
    account?.role === "client" ? account.id : undefined,
  );
  const [view, setView] = useState<ProgressPictureView>("list");
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(PROGRESS_PICTURE_VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  if (!account || account.role !== "client") return null;

  const changeView = (next: ProgressPictureView) => {
    setView(next);
    window.localStorage.setItem(PROGRESS_PICTURE_VIEW_STORAGE_KEY, next);
  };

  return (
    <section className="space-y-6">
      <Link
        to="/client/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Dashboard
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Progress Pictures
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review your pictures and choose each day&apos;s preview.
          </p>
        </div>
        <div
          role="group"
          aria-label="Progress picture view"
          className="flex shrink-0 overflow-hidden rounded-md border border-border"
        >
          <ViewButton label="List view" active={view === "list"} onClick={() => changeView("list")}>
            <List className="h-4 w-4" aria-hidden="true" />
          </ViewButton>
          <ViewButton label="Grid view" active={view === "grid"} onClick={() => changeView("grid")}>
            <Grid2X2 className="h-4 w-4" aria-hidden="true" />
          </ViewButton>
        </div>
      </div>

      {progressPictures.loading ? (
        <p className="text-sm text-muted-foreground">Loading progress pictures…</p>
      ) : progressPictures.error ? (
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
      ) : progressPictures.batches.length === 0 ? (
        <EmptyProgressPictures onAdd={() => setUploadOpen(true)} />
      ) : view === "list" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            <AddProgressPicturesTile onClick={() => setUploadOpen(true)} />
          </div>
          <ProgressPictureList batches={progressPictures.batches} />
        </div>
      ) : (
        <ProgressPictureGrid batches={progressPictures.batches} onAdd={() => setUploadOpen(true)} />
      )}

      <ProgressPictureUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientId={account.id}
        batches={progressPictures.batches}
        allowDateSelection
        onUploaded={progressPictures.refresh}
      />
    </section>
  );
}

function ViewButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-10 items-center justify-center text-muted-foreground transition-colors first:border-r first:border-border hover:bg-accent hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active &&
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyProgressPictures({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <h2 className="mt-3 text-base font-medium text-foreground">No progress pictures yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Add pictures for today or choose an earlier date to begin your progress history.
      </p>
      <Button type="button" variant="outline" className="mt-5" onClick={onAdd}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add progress pictures
      </Button>
    </div>
  );
}

function ProgressPictureList({ batches }: { batches: ProgressPictureBatch[] }) {
  const months = groupProgressPictureBatchesByMonth(batches);
  return (
    <div className="space-y-8">
      {months.map((month) => (
        <section key={month.monthKey} aria-labelledby={`month-${month.monthKey}`}>
          <h2 id={`month-${month.monthKey}`} className="text-lg font-semibold text-foreground">
            {formatProgressPictureMonth(month.monthKey)}
          </h2>
          <div className="mt-3 divide-y divide-border border-y border-border">
            {month.batches.map((batch) => (
              <section key={batch.id} className="py-4 first:pt-3 last:pb-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {formatProgressPictureDate(batch.captureDate, "long")}
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {batch.pictures.map((picture) => (
                    <Link
                      key={picture.id}
                      to="/client/progress-pictures/$batchId"
                      params={{ batchId: batch.id }}
                      aria-label={`Open progress pictures from ${formatProgressPictureDate(batch.captureDate, "long")}`}
                      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ProgressPictureTile
                        imageUrl={picture.imageUrl}
                        alt={`Progress picture from ${formatProgressPictureDate(batch.captureDate, "long")}`}
                        className="transition-colors hover:border-primary/50"
                      />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProgressPictureGrid({
  batches,
  onAdd,
}: {
  batches: ProgressPictureBatch[];
  onAdd: () => void;
}) {
  return (
    <ul role="list" className="grid list-none grid-cols-3 gap-2 p-0">
      <li>
        <AddProgressPicturesTile onClick={onAdd} />
      </li>
      {sortProgressPictureBatches(batches).map((batch) => {
        const preview = getProgressPicturePreview(batch);
        const longDate = formatProgressPictureDate(batch.captureDate, "long");
        return (
          <li key={batch.id} className="contents">
            <Link
              to="/client/progress-pictures/$batchId"
              params={{ batchId: batch.id }}
              aria-label={`Open progress pictures from ${longDate}`}
              className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ProgressPictureTile
                imageUrl={preview?.imageUrl}
                alt={`Preview progress picture from ${longDate}`}
                className="transition-colors group-hover:border-primary/50"
                footer={
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {formatProgressPictureDate(batch.captureDate, "short")}
                    </p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Preview
                    </p>
                  </div>
                }
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AddProgressPicturesTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-[17/23] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-2 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
      <span className="text-[10px] font-medium">Add pictures</span>
    </button>
  );
}
