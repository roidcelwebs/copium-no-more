import { Fragment, useCallback, useState } from "react";
import { ChevronDown, Dumbbell, MessageSquareText, TrendingUp } from "lucide-react";
import { useVerticalSectionPager } from "@/hooks/use-vertical-section-pager";
import { GoogleSignInButton } from "@/components/account/GoogleSignInButton";
import { RotatingHeadline } from "./RotatingHeadline";
import { TransformationSection } from "./TransformationSection";
import { LANDING_TESTIMONIALS } from "./landing-content";

const SECTION_COUNT = 7;

export function LandingPage() {
  const [transformationComplete, setTransformationComplete] = useState(false);
  const canNavigate = useCallback(
    (fromIndex: number, toIndex: number) =>
      !(fromIndex === 4 && toIndex === 5 && !transformationComplete),
    [transformationComplete],
  );
  const pager = useVerticalSectionPager(SECTION_COUNT, canNavigate);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-sans text-white">
      <header
        className="absolute inset-x-0 top-0 z-50 flex items-end border-b border-white/8 bg-[#070707] px-4 pb-2.5"
        style={{ height: "calc(2.75rem + env(safe-area-inset-top))" }}
      >
        <span className="text-sm font-semibold tracking-[-0.02em] text-white">No More Copium</span>
      </header>

      <main
        ref={pager.viewportRef}
        {...pager.interactionProps}
        className="absolute inset-x-0 bottom-0 overflow-hidden bg-black text-white outline-none touch-none overscroll-none"
        style={{ top: "calc(2.75rem + env(safe-area-inset-top))" }}
        tabIndex={0}
        aria-label={`No More Copium landing page, section ${pager.index + 1} of ${SECTION_COUNT}`}
      >
        <div ref={pager.trackRef} className="h-full will-change-transform">
          <IntroTestimonialSection
            testimonial={LANDING_TESTIMONIALS[0]}
            align="right"
            active={pager.index === 0}
            onContinue={() => pager.goTo(1)}
          />
          <IntroTestimonialSection
            testimonial={LANDING_TESTIMONIALS[1]}
            align="right"
            active={pager.index === 1}
            onContinue={() => pager.goTo(2)}
          />
          <IntroTestimonialSection
            testimonial={LANDING_TESTIMONIALS[2]}
            align="right"
            active={pager.index === 2}
            onContinue={() => pager.goTo(3)}
          />
          <HeroSection active={pager.index === 3} onContinue={() => pager.goTo(4)} />
          <TransformationSection
            active={pager.index === 4}
            onTransformed={() => setTransformationComplete(true)}
            onContinue={() => pager.goTo(5)}
          />
          <HandsSection active={pager.index === 5} onContinue={() => pager.goTo(6)} />
          <ValueSection active={pager.index === 6} />
        </div>
      </main>
    </div>
  );
}

function IntroTestimonialSection({
  testimonial,
  align,
  active,
  onContinue,
}: {
  testimonial: { quote: string; name: string };
  align: "left" | "right";
  active: boolean;
  onContinue: () => void;
}) {
  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-black" aria-hidden={!active}>
      <div className="absolute inset-0 bg-[#080808]" />
      <div className="absolute inset-0 flex flex-col">
        <div className="flex flex-1 items-center justify-center px-6 sm:px-8">
          <div
            className={`w-full max-w-2xl ${active ? "testimonial-blur-in" : "opacity-0"}`}
            style={{ willChange: "filter, opacity, transform" }}
          >
            <blockquote className="relative">
              <p className="text-[clamp(1.75rem,7vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
                <span className="text-[#E50910]" aria-hidden="true">
                  “
                </span>
                {testimonial.quote}
                <span className="text-[#E50910]" aria-hidden="true">
                  ”
                </span>
              </p>
              <footer
                className={`mt-6 flex ${align === "right" ? "justify-end" : "justify-start"}`}
              >
                <cite className="not-italic text-[clamp(1rem,3.5vw,1.25rem)] font-semibold leading-[1.15] tracking-[-0.01em] text-[#E50910]">
                  — {testimonial.name}
                </cite>
              </footer>
            </blockquote>
          </div>
        </div>

        <div className="flex h-[22%] shrink-0 items-center justify-center pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onContinue}
            tabIndex={active ? 0 : -1}
            className="group flex w-fit flex-col items-center gap-0.5 rounded-full px-5 py-1.5 text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E50910] active:scale-[0.97]"
            aria-label="Continue to the next section"
          >
            <ChevronDown className="landing-swipe-chevron h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em]">Swipe down</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function HeroSection({ active, onContinue }: { active: boolean; onContinue: () => void }) {
  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-black" aria-hidden={!active}>
      <div className="absolute inset-x-0 top-0 h-[62%] bg-[#0d0d0d]" />
      <div className="landing-image-fade pointer-events-none absolute inset-x-0 top-[32%] h-[34%]" />

      <aside
        className="absolute inset-x-0 top-0 z-[1] h-[49%] px-5"
        aria-label="Client testimonials"
      >
        <div className="mx-auto grid h-full w-full max-w-xl content-center gap-[clamp(0.25rem,0.8dvh,0.5rem)] py-[clamp(0.5rem,1.5dvh,0.9rem)]">
          {LANDING_TESTIMONIALS.map((testimonial) => (
            <blockquote key={testimonial.name} className="border-l-2 border-[#E50910]/80 pl-3">
              <p className="text-[clamp(1rem,3.8vw,1.08rem)] font-medium leading-[1.15] tracking-[-0.015em] text-white">
                <span className="text-[#E50910]">“</span>
                {testimonial.quote}
                <span className="text-[#E50910]">”</span>
              </p>
              <footer className="mt-1 font-semibold leading-[1.15] text-[#E50910]">
                <cite className="not-italic">— {testimonial.name}</cite>
              </footer>
            </blockquote>
          ))}
        </div>
      </aside>

      <div className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] top-[48%] z-[2] grid grid-rows-3 px-5">
        <div className="flex min-h-0 items-center justify-center">
          <div className="landing-display w-full text-[clamp(2.15rem,10vw,5.25rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-white">
            <RotatingHeadline />
          </div>
        </div>

        <div className="flex min-h-0 items-center justify-center">
          <p className="text-center text-[clamp(1rem,4.5vw,1.4rem)] font-medium tracking-[-0.02em] text-white/78">
            All with <span className="text-[#E50910]">No More Copium</span>
          </p>
        </div>

        <div className="flex min-h-0 items-center justify-center">
          <button
            type="button"
            onClick={onContinue}
            tabIndex={active ? 0 : -1}
            className="group flex w-fit flex-col items-center gap-0.5 rounded-full px-5 py-1.5 text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E50910] active:scale-[0.97]"
            aria-label="Continue to the next section"
          >
            <ChevronDown className="landing-swipe-chevron h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em]">Swipe down</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function HandsSection({ active, onContinue }: { active: boolean; onContinue: () => void }) {
  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-black" aria-hidden={!active}>
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden bg-black">
        <img
          src="/landing/hands-comparison.webp?v=4"
          alt="Before and after comparison of hand and wrist development from 15 cm to 17 cm"
          loading="eager"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[41%] h-[34%] bg-gradient-to-b from-transparent via-black/80 to-black" />

      <div className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] top-[58%] grid grid-rows-3 px-6 text-center">
        <div className="flex min-h-0 items-center justify-center">
          <blockquote className="mx-auto max-w-2xl text-[clamp(1.85rem,8.5vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-white">
            “You can&apos;t naturally thicken wrist and hands.”
          </blockquote>
        </div>

        <div className="flex min-h-0 items-center justify-center">
          <p className="text-[clamp(1rem,4.5vw,1.35rem)] font-semibold tracking-[-0.02em] text-[#E50910]">
            JFL, look at this.
          </p>
        </div>

        <div className="flex min-h-0 items-center justify-center">
          <button
            type="button"
            onClick={onContinue}
            tabIndex={active ? 0 : -1}
            className="flex w-fit flex-col items-center gap-0.5 rounded-full px-5 py-1.5 text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E50910] active:scale-[0.97]"
            aria-label="Continue to the final section"
          >
            <ChevronDown className="landing-swipe-chevron h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em]">Swipe down</span>
          </button>
        </div>
      </div>
    </section>
  );
}

const VALUE_ITEMS = [
  {
    icon: "no-ai",
    lead: "No AIslop",
    body: "Handmade personalized training program unique to You.",
  },
  {
    icon: "chat",
    lead: "1-1 Access to Hal",
    body: "I'll even modify your training program as you go. I'll even personally support you as you go.",
  },
  {
    icon: "bones",
    lead: "Growth Plates Closed?",
    body: "This method is built to work at any age.",
  },
  {
    icon: "dumbbell",
    lead: "Beginner? Struggling to stay consistent?",
    body: "The app is built to slowly build up your consistency, no matter where you are. We'll build your new lifestyle together, brick by brick.",
  },
  { icon: "progress", lead: "Best Progress Tracking", body: "" },
  { icon: "guided", lead: "Guided Workouts", body: "" },
] as const;

type ValueIconName = (typeof VALUE_ITEMS)[number]["icon"];

function ValueSection({ active }: { active: boolean }) {
  return (
    <section
      data-section-scroll
      className="landing-value-section h-full min-h-0 overflow-y-auto overscroll-contain bg-[#080808] px-4"
      aria-hidden={!active}
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col pb-[calc(1.4rem+env(safe-area-inset-bottom))] pt-[clamp(0.9rem,2.6dvh,1.8rem)]">
        <h2 className="text-[clamp(2rem,9vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
          All this for just <span className="mt-1 block text-[#E50910]"> $29/month</span>
        </h2>

        <ul className="mt-[clamp(0.75rem,2dvh,1.3rem)] grid gap-[clamp(0.45rem,1.1dvh,0.7rem)]">
          {VALUE_ITEMS.map((item, index) => (
            <Fragment key={item.lead}>
              <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-[clamp(0.55rem,1.25dvh,0.8rem)]">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E50910]/25 bg-[#E50910]/10 text-[#E50910]"
                  aria-hidden="true"
                >
                  <ValueIcon name={item.icon} />
                </span>
                <p className="min-w-0 leading-[1.25]">
                  <span className="block font-semibold text-[#E50910]">{item.lead}</span>
                  {item.body && <span className="mt-0.5 block text-white/62">{item.body}</span>}
                </p>
              </li>

              {index === 1 && (
                <li>
                  <GoogleSignInButton variant="landing" tabIndex={active ? 0 : -1} />
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      </div>
    </section>
  );
}


function ValueIcon({ name }: { name: ValueIconName }) {
  if (name === "chat") return <MessageSquareText className="h-5 w-5" strokeWidth={1.8} />;
  if (name === "dumbbell") return <Dumbbell className="h-5 w-5" strokeWidth={1.8} />;
  if (name === "progress") return <TrendingUp className="h-5 w-5" strokeWidth={1.8} />;
  if (name === "bones") return <BonesIcon />;
  if (name === "guided") return <GuidedWorkoutIcon />;
  return <NoAiIcon />;
}

function NoAiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" />
      <text
        x="12"
        y="14.5"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
      >
        AI
      </text>
      <path d="M18.5 5.5 5.5 18.5" />
    </svg>
  );
}

function BonesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M5 8.2c-1.5-1.2-.1-3.5 1.5-2.5l1 .7h9l1-.7c1.6-1 3 1.3 1.5 2.5l-1 .8-1-.2h-10l-1 .2-1-.8Z" />
      <path d="M5 15.8c-1.5 1.2-.1 3.5 1.5 2.5l1-.7h9l1 .7c1.6 1 3-1.3 1.5-2.5l-1-.8-1 .2h-10l-1-.2-1 .8Z" />
    </svg>
  );
}

function GuidedWorkoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M12 3a9 9 0 1 1-6.36 2.64" />
      <path d="m8.5 9 6.5 3-6.5 3V9Z" />
    </svg>
  );
}
