import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppInteractionGuards } from "../components/AppInteractionGuards";
import { AccountProvider } from "../components/account/AccountProvider";
import { ChatProvider } from "../components/chat/ChatProvider";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-6" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-left">
        <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-3 text-[1rem] font-medium leading-6 text-foreground">
          What happened: This page didn't load because something unexpected happened while opening it.
        </p>
        <p className="mt-2 text-[1rem] leading-6 text-muted-foreground">
          Why: This can happen if the browser's local data is temporarily unavailable, a recent change didn't load correctly, or device storage is full. Your No More Copium data stays only in this browser — nothing was sent.
        </p>
        <p className="mt-2 text-[1rem] leading-6 text-muted-foreground">
          What to do next: Try again first. If it still doesn't load, go to your account picker. If that still fails, go back to the landing page and open the app again. If the problem continues, clear the site data from browser settings or use Export/Import backup in Settings if you have a backup.
        </p>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <button
            onClick={() => {
              try {
                router.invalidate();
              } catch {}
              reset();
              // Fallback hard reload if TanStack reset doesn't recover
              setTimeout(() => {
                if (typeof window !== "undefined" && document.visibilityState === "visible") {
                  window.location.reload();
                }
              }, 250);
            }}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-[1rem] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
          <a
            href="/access"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-[1rem] font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go to account picker
          </a>
          <a
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-input bg-background px-5 py-2.5 text-[1rem] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
          >
            Go to landing page
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "No More Copium" },
      {
        name: "description",
        content: "Build your dream physique with clear direction, personal programming, and no more copium.",
      },
      { name: "application-name", content: "No More Copium" },
      { name: "apple-mobile-web-app-title", content: "No More Copium" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#0f172a" },
      { property: "og:title", content: "No More Copium" },
      {
        property: "og:description",
        content: "Build your dream physique with clear direction, personal programming, and no more copium.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "No More Copium" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "No More Copium" },
      { name: "twitter:description", content: "Build your dream physique with clear direction, personal programming, and no more copium." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c9112ac7-695c-48a4-af65-26723a2c076f/id-preview-40fa8242--f054710e-1f71-4698-9896-4fc7a91969eb.lovable.app-1785241421260.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c9112ac7-695c-48a4-af65-26723a2c076f/id-preview-40fa8242--f054710e-1f71-4698-9896-4fc7a91969eb.lovable.app-1785241421260.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <ChatProvider>
          <AppInteractionGuards />
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </ChatProvider>
      </AccountProvider>
    </QueryClientProvider>
  );
}
