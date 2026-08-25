import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  WEIGHT_UNIT_LONG_FORM_MAX_LENGTH,
  WEIGHT_UNIT_SHORT_FORM_MAX_LENGTH,
  type WeightUnit,
  createCustomWeightUnit,
  getWeightUnit,
} from "@/lib/coach-weight-units";
import { cn } from "@/lib/utils";

export function WeightUnitSelector({
  value,
  units,
  onChange,
  onCreate,
  compact = false,
  embedded = false,
  disabled = false,
}: {
  value: string;
  units: WeightUnit[];
  onChange: (unitId: string) => void;
  onCreate: (unit: WeightUnit) => void;
  compact?: boolean;
  embedded?: boolean;
  disabled?: boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const selectedUnit = getWeightUnit(units, value);

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={`Weight unit ${selectedUnit.longForm}`}
            className={cn(
              "shrink-0 font-normal",
              compact ? "h-7 gap-1 px-2 text-xs" : "h-9",
              embedded &&
                "absolute inset-y-0 right-0 h-full rounded-l-none border-y-0 border-r-0 px-2 text-xs shadow-none",
            )}
          >
            <span className="max-w-16 truncate">{selectedUnit.shortForm}</span>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <div role="listbox" aria-label="Weight unit" className="space-y-1">
            {units.map((unit) => {
              const selected = unit.id === selectedUnit.id;
              return (
                <button
                  key={unit.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(unit.id);
                    setPopoverOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected && "bg-accent",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{unit.longForm}</span>
                    <span className="block text-xs text-muted-foreground">
                      {unit.shortForm} · increment {unit.increment}
                    </span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setPopoverOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add custom unit
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <CreateWeightUnitDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingUnits={units}
        onCreate={(unit) => {
          onCreate(unit);
          onChange(unit.id);
          setCreateOpen(false);
        }}
      />
    </>
  );
}

function CreateWeightUnitDialog({
  open,
  onOpenChange,
  existingUnits,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingUnits: WeightUnit[];
  onCreate: (unit: WeightUnit) => void;
}) {
  const [longForm, setLongForm] = useState("");
  const [shortForm, setShortForm] = useState("");
  const [increment, setIncrement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const longFormRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const shortFormErrorId = useId();

  useEffect(() => {
    if (!open) {
      setLongForm("");
      setShortForm("");
      setIncrement("");
      setError(null);
    }
  }, [open]);

  const cleanLong = longForm.trim().replace(/\s+/g, " ");
  const cleanShort = shortForm.trim().replace(/\s+/g, " ");
  const parsedIncrement = Number(increment);
  const shortFormTooLong = cleanShort.length > WEIGHT_UNIT_SHORT_FORM_MAX_LENGTH;
  const incrementValid =
    increment.trim().length > 0 && Number.isFinite(parsedIncrement) && parsedIncrement > 0;
  const canSubmit =
    cleanLong.length > 0 && cleanShort.length > 0 && !shortFormTooLong && incrementValid;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!cleanLong || !cleanShort) {
      setError("Enter a long form and a short form.");
      return;
    }
    if (shortFormTooLong) return;
    if (!incrementValid) {
      setError("Increment must be a number greater than zero.");
      return;
    }
    const duplicate = existingUnits.some(
      (unit) =>
        unit.longForm.toLowerCase() === cleanLong.toLowerCase() ||
        unit.shortForm.toLowerCase() === cleanShort.toLowerCase(),
    );
    if (duplicate) {
      setError("A unit with that long form or short form already exists.");
      return;
    }
    onCreate(createCustomWeightUnit(cleanLong, cleanShort, parsedIncrement));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          longFormRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add custom unit</DialogTitle>
          <DialogDescription>
            The increment controls how much Weight Done changes when its up or down button is
            pressed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="weight-unit-long-form">Long form</Label>
            <Input
              id="weight-unit-long-form"
              ref={longFormRef}
              value={longForm}
              onChange={(event) => {
                setLongForm(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Resistance band level"
              maxLength={WEIGHT_UNIT_LONG_FORM_MAX_LENGTH}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight-unit-short-form">Short form</Label>
            <Input
              id="weight-unit-short-form"
              value={shortForm}
              onChange={(event) => {
                setShortForm(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. band"
              aria-invalid={shortFormTooLong || undefined}
              aria-describedby={shortFormTooLong ? shortFormErrorId : undefined}
            />
            {shortFormTooLong && (
              <p id={shortFormErrorId} role="alert" className="text-xs text-destructive">
                Short form cannot be longer than {WEIGHT_UNIT_SHORT_FORM_MAX_LENGTH} characters.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight-unit-increment">Increment</Label>
            <Input
              id="weight-unit-increment"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={increment}
              onChange={(event) => {
                setIncrement(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. 2.5"
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
            <Button type="submit" disabled={!canSubmit}>
              Add unit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
