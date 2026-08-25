import { createFileRoute } from "@tanstack/react-router";
import { LibraryHub } from "@/components/coach/LibraryHub";

export const Route = createFileRoute("/coach/library/")({
  head: () => ({
    meta: [
      { title: "Library — No More Copium" },
      { name: "description", content: "Coach exercise and workout libraries." },
    ],
  }),
  component: LibraryHub,
});
