import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ImageIcon, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createDefaultProgram,
  loadPrograms,
  savePrograms,
} from "@/lib/coach-programs";
import {
  type ProcessedProgramCover,
  processProgramCover,
  releaseProgramCover,
} from "@/lib/program-cover-processing";
import { uploadProgramCover } from "@/lib/program-covers";

export function ProgramManager() {
  const { account } = useAccount();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const covers = useProgramCoverUrls(programs);

  useEffect(() => {
    setPrograms(loadPrograms());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) savePrograms(programs);
  }, [programs, hydrated]);

  const handleCreate = async (values: ProgramCreateValues): Promise<string | null> => {
    if (account?.role !== "coach") return "A Coach account is required.";
    const program = createDefaultProgram(values);
    try {
      const nextProgram = values.cover
        ? {
            ...program,
            coverImagePath: await uploadProgramCover({
              coachId: account.id,
              programId: program.id,
              cover: values.cover,
            }),
            coverUpdatedAt: new Date().toISOString(),
          }
        : program;
      setPrograms((previous) => [...previous, nextProgram]);
      setDialogOpen(false);
      return null;
    } catch (error) {
      console.error("Failed to create program cover", error);
      return error instanceof Error ? error.message : "The program cover could not be uploaded.";
    }
  };

  return (
    <>
      {covers.error && <p className="mb-3 text-sm text-destructive">{covers.error}</p>}
      <ul role="list" className="-mx-2 grid list-none grid-cols-3 gap-2 p-0 sm:mx-0">
        {programs.map((program) => (
          <li key={program.id} className="contents">
            <ProgramCard program={program} coverUrl={covers.urls[program.id]} />
          </li>
        ))}
        <li className="contents">
          <CreateProgramTile onClick={() => setDialogOpen(true)} />
        </li>
      </ul>

      <CreateProgramDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreate} />
    </>
  );
}

function ProgramCard({ program, coverUrl }: { program: ProgramSummary; coverUrl?: string }) {
  return (
    <Link
      to="/coach/programs/$programId"
      params={{ programId: program.id }}
      aria-label={`Open ${program.name}`}
      className="group relative flex aspect-[17/23] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-accent/70"
    >
      {coverUrl ? (
        <>
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2.5 pb-2.5 pt-8 text-white sm:px-3 sm:pb-3">
            <h3 className="overflow-hidden break-words text-sm font-semibold leading-tight [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] sm:text-base">
              {program.name}
            </h3>
          </div>
        </>
      ) : (
        <h3 className="overflow-hidden break-words p-2.5 text-sm font-medium leading-tight [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:7] sm:p-3 sm:text-base">
          {program.name}
        </h3>
      )}
    </Link>
  );
}

function CreateProgramTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create new program"
      className="flex aspect-[17/23] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-muted/70"
    >
      <Plus className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

type ProgramCreateValues = {
  name: string;
  shortDescription: string;
  longDescription: string;
  cover: ProcessedProgramCover | null;
};

function CreateProgramDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: ProgramCreateValues) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [cover, setCover] = useState<ProcessedProgramCover | null>(null);
  const coverRef = useRef<ProcessedProgramCover | null>(null);
  const [processingCover, setProcessingCover] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  coverRef.current = cover;

  useEffect(() => {
    if (open || processingCover || submitting) return;
    setName("");
    setShortDescription("");
    setLongDescription("");
    setCover((current) => {
      releaseProgramCover(current);
      return null;
    });
    setError(null);
  }, [open, processingCover, submitting]);

  useEffect(
    () => () => {
      releaseProgramCover(coverRef.current);
    },
    [],
  );

  const chooseCover = async (file: File | undefined) => {
    if (!file || processingCover || submitting) return;
    setProcessingCover(true);
    setError(null);
    try {
      const processed = await processProgramCover(file);
      setCover((current) => {
        releaseProgramCover(current);
        return processed;
      });
    } catch (nextError) {
      console.error("Failed to process program cover", nextError);
      setError(
        nextError instanceof Error ? nextError.message : "The cover could not be processed.",
      );
    } finally {
      setProcessingCover(false);
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Please enter a program name.";
    if (name.trim().length > PROGRAM_NAME_MAX_LENGTH)
      return `Keep the name to ${PROGRAM_NAME_MAX_LENGTH} characters or fewer.`;
    if (!shortDescription.trim()) return "Please enter a short description.";
    if (shortDescription.trim().length > PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH)
      return `Keep the short description to ${PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
    if (!longDescription.trim()) return "Please enter a long description.";
    if (longDescription.trim().length > PROGRAM_LONG_DESCRIPTION_MAX_LENGTH)
      return `Keep the long description to ${PROGRAM_LONG_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const nextError = await onCreate({
      name: name.trim(),
      shortDescription: shortDescription.trim(),
      longDescription: longDescription.trim(),
      cover,
    });
    setSubmitting(false);
    if (nextError) setError(nextError);
  };

  const invalid =
    !name.trim() ||
    !shortDescription.trim() ||
    !longDescription.trim() ||
    name.trim().length > PROGRAM_NAME_MAX_LENGTH ||
    shortDescription.trim().length > PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH ||
    longDescription.trim().length > PROGRAM_LONG_DESCRIPTION_MAX_LENGTH;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!processingCover && !submitting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Create program</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="program-name">Program name</Label>
            <Input
              id="program-name"
              ref={inputRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder="e.g. Upper Body Strength"
              maxLength={PROGRAM_NAME_MAX_LENGTH + 20}
              autoComplete="off"
            />
            <CharacterCount value={name} maximum={PROGRAM_NAME_MAX_LENGTH} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="program-short-description">Short description</Label>
            <Textarea
              id="program-short-description"
              value={shortDescription}
              onChange={(event) => {
                setShortDescription(event.target.value);
                setError(null);
              }}
              placeholder="A concise summary shown beside the program cover"
              rows={2}
              maxLength={PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH + 20}
              className="min-h-16 resize-y"
            />
            <CharacterCount
              value={shortDescription}
              maximum={PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="program-long-description">Long description</Label>
            <Textarea
              id="program-long-description"
              value={longDescription}
              onChange={(event) => {
                setLongDescription(event.target.value);
                setError(null);
              }}
              placeholder="Explain the program’s goals, structure, and intended experience"
              rows={5}
              maxLength={PROGRAM_LONG_DESCRIPTION_MAX_LENGTH + 100}
            />
            <CharacterCount value={longDescription} maximum={PROGRAM_LONG_DESCRIPTION_MAX_LENGTH} />
          </div>

          <div className="space-y-2">
            <div>
              <Label>Program cover (optional)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Best fit: {PROGRAM_COVER_WIDTH} × {PROGRAM_COVER_HEIGHT} px · 17:23 portrait
              </p>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void chooseCover(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {cover ? (
              <div className="flex items-start gap-3">
                <img
                  src={cover.previewUrl}
                  alt="Program cover preview"
                  className="aspect-[17/23] w-28 rounded-lg border border-border object-cover"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={processingCover || submitting}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Change cover
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={processingCover || submitting}
                    onClick={() => {
                      releaseProgramCover(cover);
                      setCover(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={processingCover || submitting}
                onClick={() => coverInputRef.current?.click()}
              >
                {processingCover ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                )}
                {processingCover ? "Optimizing cover…" : "Choose cover image"}
              </Button>
            )}
          </div>

          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={processingCover || submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={invalid || processingCover || submitting}>
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Create program
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CharacterCount({ value, maximum }: { value: string; maximum: number }) {
  const over = value.trim().length > maximum;
  return (
    <p className={`text-right text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
      {value.trim().length}/{maximum}
    </p>
  );
}
