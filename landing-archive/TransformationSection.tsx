import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Phase = "before" | "transforming" | "after";

const BEFORE_STATS = ["5′5″ manlet", "Depressed", "Lonely"] as const;
const AFTER_STATS = ["5′10″", "Happiness begins"] as const;

export function TransformationSection({
  active,
  onTransformed,
  onContinue,
}: {
  active: boolean;
  onTransformed: () => void;
  onContinue: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("before");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const transform = () => {
    if (phase !== "before") return;
    setPhase("transforming");
    const transitionMs = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650;
    timerRef.current = window.setTimeout(() => {
      setPhase("after");
      onTransformed();
      timerRef.current = null;
    }, transitionMs);
  };

  const afterVisible = phase !== "before";

  return (
    <section
      className="landing-transformation-section relative h-full min-h-0 overflow-hidden bg-black"
      aria-hidden={!active}
    >
      <div className="absolute inset-x-0 top-0 h-[61%] overflow-hidden bg-[#0b0b0b]">
        <img
          src="/landing/transformation-before.webp"
          alt="Physique before the transformation"
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover object-top transition-[opacity,transform] duration-500 ease-out ${
            afterVisible ? "scale-[0.985] opacity-0" : "scale-100 opacity-100"
          }`}
        />
        <img
          src="/landing/transformation-after.webp"
          alt="Physique three months after the transformation"
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover object-top transition-[opacity,transform] duration-500 ease-out ${
            afterVisible ? "scale-100 opacity-100" : "scale-[1.025] opacity-0"
          }`}
        />
        {phase === "transforming" && (
          <div className="landing-transform-wipe pointer-events-none absolute inset-y-0 w-1 bg-[#E50910]/80" />
        )}
      </div>

      <div className="landing-image-fade pointer-events-none absolute inset-x-0 top-[32%] h-[34%]" />

      <div className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] top-[61%] z-[2] grid grid-rows-[24fr_44fr_32fr] px-5">
        <div className="flex min-h-0 items-center justify-center text-center" aria-live="polite">
          {phase === "after" ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] leading-tight text-[#E50910]">
              <span className="block">3 months later</span>
              <span className="block">(All natural)</span>
            </p>
          ) : (
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#E50910]">Before</p>
          )}
        </div>

        <div className="flex min-h-0 items-center justify-center">
          <ul
            className={`w-full max-w-md space-y-1.5 transition-[opacity,transform] duration-500 ease-out ${
              phase === "transforming" ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
            }`}
          >
            {(phase === "after" ? AFTER_STATS : BEFORE_STATS).map((stat) => (
              <li
                key={stat}
                className="flex items-center gap-3 text-[clamp(1.1rem,5vw,1.45rem)] font-medium tracking-[-0.025em] text-white"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E50910]" aria-hidden="true" />
                {stat}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-0 items-center justify-center">
          {phase !== "after" ? (
            <button
              type="button"
              onClick={transform}
              disabled={phase === "transforming"}
              tabIndex={active ? 0 : -1}
              className="inline-flex min-h-12 w-full max-w-md items-center justify-center rounded-full bg-[#E50910] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#E50910] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E50910] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-70"
            >
              {phase === "transforming" ? "Transforming…" : "Transform"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              tabIndex={active ? 0 : -1}
              className="landing-after-swipe flex w-full max-w-md flex-col items-center gap-0.5 rounded-full py-1.5 text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E50910] active:scale-[0.98]"
              aria-label="Continue to the next section"
            >
              <ChevronDown className="landing-swipe-chevron h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
                Swipe down
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
