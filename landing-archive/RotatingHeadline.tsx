import { useEffect, useState } from "react";

const PHRASES = [
  "Heightmax",
  "Dream physique",
  "Bigger hands and wrist",
  "Fix asymmetries",
  "Prevent injuries",
  "Fix posture",
] as const;

const HOLD_MS = 1000;
const TRANSITION_MS = 500;

export function RotatingHeadline() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        if (nextIndex === null) {
          setNextIndex((currentIndex + 1) % PHRASES.length);
        } else {
          setCurrentIndex(nextIndex);
          setNextIndex(null);
        }
      },
      nextIndex === null ? HOLD_MS : TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [currentIndex, nextIndex]);

  return (
    <div
      className="relative mx-auto min-h-[2.35em] w-full max-w-[94vw] overflow-hidden"
      aria-label={`${PHRASES.join(", ")}. All with No More Copium.`}
    >
      <span
        className={`absolute inset-0 flex items-center justify-center text-center ${
          nextIndex === null ? "" : "landing-headline-out"
        }`}
        aria-hidden="true"
      >
        {PHRASES[currentIndex]}
      </span>
      {nextIndex !== null && (
        <span
          key={nextIndex}
          className="landing-headline-in absolute inset-0 flex items-center justify-center text-center"
          aria-hidden="true"
        >
          {PHRASES[nextIndex]}
        </span>
      )}
    </div>
  );
}
