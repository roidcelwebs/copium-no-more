import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ExerciseLibrary } from "./ExerciseLibrary";

export function ExerciseLibraryPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/coach/library"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Library
      </Link>
      <ExerciseLibrary />
    </div>
  );
}
