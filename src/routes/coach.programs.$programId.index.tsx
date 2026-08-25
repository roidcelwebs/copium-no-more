import { createFileRoute } from "@tanstack/react-router";
import { ProgramDetail } from "@/components/coach/ProgramDetail";

export const Route = createFileRoute("/coach/programs/$programId/")({
  head: () => ({
    meta: [
      { title: "Program — No More Copium" },
      {
        name: "description",
        content: "Program detail in No More Copium.",
      },
      { property: "og:title", content: "Program — No More Copium" },
      {
        property: "og:description",
        content: "Program detail in No More Copium.",
      },
    ],
  }),
  component: ProgramDetailPage,
});

function ProgramDetailPage() {
  const { programId } = Route.useParams();
  return <ProgramDetail programId={programId} />;
}
