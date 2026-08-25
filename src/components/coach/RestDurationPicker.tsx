import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEFAULT_REST_SECONDS } from "@/lib/coach-workouts";
import { cn } from "@/lib/utils";

const MINUTES = Array.from({ length: 61 }, (_, index) => index);
const SECONDS = Array.from({ length: 60 }, (_, index) => index);

function formatRestDuration(totalSeconds: number | undefined): string {
  const normalized = Math.max(0, Math.floor(totalSeconds ?? DEFAULT_REST_SECONDS));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function RestDurationPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (seconds: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!open) return;
    const normalized = Math.max(0, Math.floor(value ?? DEFAULT_REST_SECONDS));
    setMinutes(Math.min(60, Math.floor(normalized / 60)));
    setSeconds(normalized % 60);
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between px-3 font-normal"
          aria-label={`Rest duration ${formatRestDuration(value)}`}
        >
          <span>{formatRestDuration(value)}</span>
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rest duration</DialogTitle>
          <DialogDescription>Scroll or tap to choose minutes and seconds.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3" aria-label="Rest duration picker">
          <WheelColumn
            label="Minutes"
            unit="m"
            values={MINUTES}
            value={minutes}
            onChange={setMinutes}
          />
          <WheelColumn
            label="Seconds"
            unit="s"
            values={SECONDS}
            value={seconds}
            onChange={setSeconds}
          />
        </div>

        <p className="text-center text-sm font-medium tabular-nums text-foreground">
          {minutes}m {seconds.toString().padStart(2, "0")}s
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onChange(minutes * 60 + seconds);
              setOpen(false);
            }}
          >
            Set rest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WheelColumn({
  label,
  unit,
  values,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const valueSet = useMemo(() => new Set(values), [values]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selected = container.querySelector<HTMLElement>(`[data-wheel-value="${value}"]`);
    selected?.scrollIntoView({ block: "center" });
  }, [value]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const selectNearest = () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const center = container.getBoundingClientRect().top + container.clientHeight / 2;
      let nearest = value;
      let distance = Number.POSITIVE_INFINITY;
      for (const element of container.querySelectorAll<HTMLElement>("[data-wheel-value]")) {
        const rect = element.getBoundingClientRect();
        const candidateDistance = Math.abs(rect.top + rect.height / 2 - center);
        if (candidateDistance < distance) {
          distance = candidateDistance;
          nearest = Number(element.dataset.wheelValue);
        }
      }
      if (valueSet.has(nearest) && nearest !== value) onChange(nearest);
    });
  };

  const move = (delta: number) => {
    const index = values.indexOf(value);
    onChange(values[Math.max(0, Math.min(values.length - 1, index + delta))]);
  };

  return (
    <div>
      <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{label}</p>
      <div
        ref={containerRef}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={selectNearest}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            move(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className="h-48 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md border border-border bg-muted/20 py-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {values.map((option) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={option === value}
            data-wheel-value={option}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-10 w-full snap-center items-center justify-center text-base tabular-nums transition-colors",
              option === value
                ? "bg-primary/10 font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
            <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
