import { createFileRoute } from "@tanstack/react-router";
import { ProgressPictureBatchPage } from "@/components/client/progress-pictures/ProgressPictureBatchPage";

export const Route = createFileRoute("/client/progress-pictures/$batchId")({
  head: () => ({
    meta: [
      { title: "Progress Picture Batch — No More Copium" },
      { name: "description", content: "Choose a progress-picture preview." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProgressPictureBatchRoute,
});

function ProgressPictureBatchRoute() {
  const { batchId } = Route.useParams();
  return <ProgressPictureBatchPage batchId={batchId} />;
}
