import { createFileRoute } from "@tanstack/react-router";
import { ProgramManager } from "@/components/coach/ProgramManager";

export const Route = createFileRoute("/coach/programs/")({
  head: () => ({
    meta: [
      { title: "Program Manager — No More Copium" },
      {
        name: "description",
        content: "Program Manager for coaches in No More Copium.",
      },
      { property: "og:title", content: "Program Manager — No More Copium" },
      {
        property: "og:description",
        content: "Program Manager for coaches in No More Copium.",
      },
    ],
  }),
  component: ProgramManagerPage,
});

function ProgramManagerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Program Manager</h1>
      <ProgramManager />
    </div>
  );
}
