import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "No More Copium" },
      {
        name: "description",
        content: "You made it, brother. Welcome to No More Copium.",
      },
      { property: "og:title", content: "No More Copium" },
      {
        property: "og:description",
        content: "You made it, brother. Welcome to No More Copium.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#080808] px-6 text-center">
      <div className="w-full max-w-md">
        <h1 className="text-[clamp(2.25rem,9vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-white">
          You made it, brother.
        </h1>
        <p className="mt-4 text-[clamp(1.05rem,4.5vw,1.4rem)] font-medium leading-7 tracking-[-0.02em] text-white/78">
          Welcome to <span className="font-semibold text-[#E50910]">No More Copium</span>
        </p>
        <Link
          to="/access"
          className="mt-10 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#E50910] px-6 text-[1rem] font-semibold text-white transition-transform hover:bg-[#ff141d] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E50910] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
        >
          Continue
        </Link>
        <p className="mt-4 text-[0.8125rem] font-medium uppercase tracking-[0.18em] text-white/45">
          Exclusive access only
        </p>
      </div>
    </main>
  );
}
