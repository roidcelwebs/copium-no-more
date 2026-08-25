import { createFileRoute } from "@tanstack/react-router";
import { AccountAccess } from "@/components/account/AccountAccess";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Sign in — No More Copium" },
      {
        name: "description",
        content: "Create an account with your access code or sign in to No More Copium.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-semibold tracking-tight">No More Copium</h1>
        <p className="mt-3 text-[1rem] leading-6 text-muted-foreground">
          Create an account with your access code, or sign in with Google.
        </p>
        <div className="mt-8">
          <AccountAccess />
        </div>
      </div>
    </main>
  );
}
