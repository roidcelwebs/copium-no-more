import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProgramWorkoutsSection } from "./ProgramWorkoutsSection";

export function WorkoutLibrary() {
  return (
    <section className="space-y-6">
      <Link
        to="/coach/library"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Library
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workout Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Universal workouts available to every training program.
        </p>
      </div>
      <ProgramWorkoutsSection showHeading={false} />
    </section>
  );
}
