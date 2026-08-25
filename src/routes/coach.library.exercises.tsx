import { createFileRoute } from "@tanstack/react-router";
import { ExerciseLibraryPage } from "@/components/coach/ExerciseLibraryPage";

export const Route = createFileRoute("/coach/library/exercises")({
  head: () => ({
    meta: [
      { title: "Exercise Library — No More Copium" },
      { name: "description", content: "Exercise Library for coaches in No More Copium." },
    ],
  }),
  component: ExerciseLibraryPage,
});
