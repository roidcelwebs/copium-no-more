import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EXERCISE_DESCRIPTION_MAX_LENGTH,
  EXERCISE_NAME_MAX_LENGTH,
  parseTagsInput,
} from "@/lib/coach-exercises";

export type ExerciseFormValues = {
  name: string;
  tags: string[];
  description?: string;
};

export function ExerciseFormDialog({
  open,
  onOpenChange,
  onCreate,
  title = "Add exercise",
  description = "Name it now. Tags and a description are optional.",
  submitLabel = "Add exercise",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: ExerciseFormValues) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (!open) {
      setName("");
      setTagsRaw("");
      setDescriptionText("");
      setError(null);
    }
  }, [open]);

  const parsedTags = useMemo(() => parseTagsInput(tagsRaw), [tagsRaw]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Please enter an exercise name.");
      return;
    }
    if (trimmed.length > EXERCISE_NAME_MAX_LENGTH) {
      setError(`Keep the name to ${EXERCISE_NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (descriptionText.length > EXERCISE_DESCRIPTION_MAX_LENGTH) {
      setError(`Description must be ${EXERCISE_DESCRIPTION_MAX_LENGTH} characters or fewer.`);
      return;
    }
    onCreate({
      name: trimmed,
      tags: parsedTags,
      description: descriptionText.trim() || undefined,
    });
  };

  const disabled = name.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nameRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="exercise-form-name">Name</Label>
            <Input
              id="exercise-form-name"
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Barbell Back Squat"
              maxLength={EXERCISE_NAME_MAX_LENGTH + 20}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exercise-form-tags">Tags</Label>
            <Input
              id="exercise-form-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="quads, glutes, barbell"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Separate with commas, slashes, or new lines.
            </p>
            {parsedTags.length > 0 && (
              <ul className="flex flex-wrap gap-1" aria-label="Parsed tags preview">
                {parsedTags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="exercise-form-description">Description (optional)</Label>
            <Textarea
              id="exercise-form-description"
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              placeholder="Cues, setup notes, or coaching reminders."
              maxLength={EXERCISE_DESCRIPTION_MAX_LENGTH + 50}
              rows={3}
            />
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
