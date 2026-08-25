import { Link } from "@tanstack/react-router";
import { ChevronRight, Dumbbell, Library } from "lucide-react";

const SECTIONS = [
  {
    to: "/coach/library/exercises" as const,
    title: "Exercise Library",
    description: "Browse and manage exercises.",
    icon: Dumbbell,
  },
  {
    to: "/coach/library/workouts" as const,
    title: "Workout Library",
    description: "Create and manage universal workout templates.",
    icon: Library,
  },
];

export function LibraryHub() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Exercises and workout templates.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ to, title, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-36 flex-col rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-auto pt-6">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
