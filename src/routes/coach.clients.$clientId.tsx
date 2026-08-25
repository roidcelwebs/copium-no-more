import { createFileRoute } from "@tanstack/react-router";
import { ClientManagement } from "@/components/coach/ClientManagement";

export const Route = createFileRoute("/coach/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client Management — No More Copium" },
      { name: "description", content: "Manage a local client in No More Copium." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientManagementPage,
});

function ClientManagementPage() {
  const { clientId } = Route.useParams();
  return <ClientManagement clientId={clientId} />;
}
