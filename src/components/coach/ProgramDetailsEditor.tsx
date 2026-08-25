import { useRef, useState } from "react";
import { ImageIcon, LoaderCircle, Upload } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProgramCoverUrls } from "@/hooks/use-program-cover-urls";
import {
  PROGRAM_COVER_HEIGHT,
  PROGRAM_COVER_WIDTH,
  PROGRAM_LONG_DESCRIPTION_MAX_LENGTH,
  PROGRAM_NAME_MAX_LENGTH,
  PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH,
  type ProgramSummary,
} from "@/lib/coach-programs";
import { processProgramCover, releaseProgramCover } from "@/lib/program-cover-processing";
import { uploadProgramCover } from "@/lib/program-covers";

export function ProgramDetailsEditor({
  program,
  onChange,
}: {
  program: ProgramSummary;
  onChange: (updates: Partial<ProgramSummary>) => void;
}) {
  const { account } = useAccount();
  const covers = useProgramCoverUrls([program]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeCover = async (file: File | undefined) => {
    if (!file || processing || account?.role !== "coach") return;
    setProcessing(true);
    setError(null);
    let processed: Awaited<ReturnType<typeof processProgramCover>> | null = null;
    try {
      processed = await processProgramCover(file);
      const coverImagePath = await uploadProgramCover({
        coachId: account.id,
        programId: program.id,
        cover: processed,
      });
      onChange({ coverImagePath, coverUpdatedAt: new Date().toISOString() });
    } catch (nextError) {
      console.error("Failed to update program cover", nextError);
      setError(nextError instanceof Error ? nextError.message : "The cover could not be updated.");
    } finally {
      releaseProgramCover(processed);
      setProcessing(false);
    }
  };

  return (
    <section aria-labelledby="program-details-heading" className="space-y-4">
      <div>
        <h1 id="program-details-heading" className="text-2xl font-semibold tracking-tight">
          {program.name}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Program details save automatically.</p>
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[9rem_1fr]">
        <div className="space-y-2">
          <div className="flex aspect-[17/23] w-32 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 sm:w-36">
            {covers.urls[program.id] ? (
              <img
                src={covers.urls[program.id]}
                alt="Program cover"
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void changeCover(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
            className="w-32 sm:w-36"
          >
            {processing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            {program.coverImagePath ? "Change cover" : "Add cover"}
          </Button>
          <p className="w-32 text-[10px] leading-snug text-muted-foreground sm:w-36">
            Best fit: {PROGRAM_COVER_WIDTH} × {PROGRAM_COVER_HEIGHT} px · 17:23
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`program-name-${program.id}`}>Program name</Label>
            <Input
              id={`program-name-${program.id}`}
              value={program.name}
              maxLength={PROGRAM_NAME_MAX_LENGTH}
              onChange={(event) => {
                if (event.target.value.trim()) onChange({ name: event.target.value });
              }}
              onBlur={() => onChange({ name: program.name.trim() })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`program-short-${program.id}`}>Short description</Label>
            <Textarea
              id={`program-short-${program.id}`}
              value={program.shortDescription}
              maxLength={PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH}
              rows={3}
              placeholder="Add a concise program summary"
              className="min-h-20 resize-y"
              onChange={(event) => onChange({ shortDescription: event.target.value })}
            />
            <CharacterCount
              value={program.shortDescription}
              maximum={PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`program-long-${program.id}`}>Long description</Label>
            <Textarea
              id={`program-long-${program.id}`}
              value={program.longDescription}
              maxLength={PROGRAM_LONG_DESCRIPTION_MAX_LENGTH}
              rows={6}
              placeholder="Describe the program’s goals, structure, and intended experience"
              onChange={(event) => onChange({ longDescription: event.target.value })}
            />
            <CharacterCount
              value={program.longDescription}
              maximum={PROGRAM_LONG_DESCRIPTION_MAX_LENGTH}
            />
          </div>
        </div>
      </div>

      {(error || covers.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? covers.error}
        </p>
      )}
    </section>
  );
}

function CharacterCount({ value, maximum }: { value: string; maximum: number }) {
  return (
    <p className="text-right text-xs text-muted-foreground">
      {value.length}/{maximum}
    </p>
  );
}
