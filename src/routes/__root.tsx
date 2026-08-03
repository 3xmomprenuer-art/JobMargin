import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { getCurrentUser, SUBSCRIPTION_ATTENTION_STATUSES, TRIAL_DURATION_MS } from "~/lib/auth";
import type { User } from "~/lib/auth";
import appCss from "~/styles/app.css?url";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/clients", label: "Clients", icon: ClientsIcon },
  { to: "/estimates", label: "Estimates", icon: EstimatesIcon },
  { to: "/jobs", label: "Jobs", icon: JobsIcon },
] as const;

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/share",
  "/terms",
  "/privacy",
  "/blog",
];

// Trial/subscription enforcement — redirects users whose trial has expired or
// whose subscription needs attention to /pricing. Exempts /pricing and /logout
// so users can always reach the page that fixes their state.
function enforceSubscription(user: User, pathname: string): void {
  if (pathname === "/pricing" || pathname === "/logout") return;

  if (user.subscriptionStatus === "trialing") {
    const trialEnd = new Date(user.trialStartedAt).getTime() + TRIAL_DURATION_MS;
    if (Date.now() > trialEnd) {
      throw redirect({
        to: "/pricing",
        search: { success: undefined, canceled: undefined, trial_expired: "true" },
      });
    }
  }

  if (
    (SUBSCRIPTION_ATTENTION_STATUSES as readonly string[]).includes(
      user.subscriptionStatus,
    )
  ) {
    throw redirect({ to: "/pricing", search: { success: undefined, canceled: undefined, trial_expired: undefined } });
  }
}

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const isPublic = PUBLIC_PATHS.some((p) =>
      location.pathname.startsWith(p),
    );
    if (location.pathname === "/") {
      const user = await getCurrentUser();
      if (!user) return;
      enforceSubscription(user, location.pathname);
      return { user };
    }
    if (isPublic) return;

    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
    enforceSubscription(user, location.pathname);
    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JobMargin — Job Profit Tracking for Contractors" },
      {
        name: "description",
        content:
          "Mobile-first job estimation, cost tracking, and invoicing for solo contractors. Know your real profit on every job.",
      },
      {
        property: "og:title",
        content: "JobMargin — Job Profit Tracking for Contractors",
      },
      {
        property: "og:description",
        content:
          "Mobile-first job estimation, cost tracking, and invoicing for solo contractors. Know your real profit on every job.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  const loc = useLocation();
  const isSharePage = loc.pathname.startsWith("/share");
  const ctx = Route.useRouteContext();
  const user = ctx?.user;

  return (
    <RootDocument>
      <div className="flex min-h-dvh flex-col">
        {!isSharePage && <UserBar user={user} />}
        <main className={isSharePage ? "flex-1" : user ? "flex-1 pb-20" : "flex-1"}>
          <Outlet />
        </main>
        {!isSharePage && (
          <>
            <AppFooter />
            {user && <BottomNav />}
          </>
        )}
      </div>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
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

function UserBar({ user }: { user: User | undefined }) {
  if (!user) return null;
  const needsUpgrade = user.subscriptionStatus !== "active";
  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-lg items-center justify-end gap-3 px-4 py-1.5 text-xs text-gray-500">
        {needsUpgrade && (
          <Link
            to="/pricing"
            search={{ success: undefined, canceled: undefined, trial_expired: undefined }}
            className="font-semibold text-indigo-600 underline-offset-2 transition-colors hover:text-indigo-500 hover:underline"
          >
            Upgrade
          </Link>
        )}
        <span className="max-w-[40vw] truncate">{user.name}</span>
        <span className="text-gray-300">•</span>
        <Link
          to="/logout"
          className="font-medium text-gray-400 underline-offset-2 transition-colors hover:text-gray-600 hover:underline"
        >
          Log out
        </Link>
      </div>
    </div>
  );
}

function BottomNav() {
  const loc = useLocation();
  const pathname = loc.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.to === "/"
              ? pathname === "/"
              : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                isActive
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <item.icon active={isActive} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// --- SVG Icons (inline for zero-dependency) ---

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "currentColor" : "currentColor"}
      strokeWidth={active ? 2 : 1.5}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ClientsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.5}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function EstimatesIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.5}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function JobsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.5}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <circle cx="12" cy="14" r="2" />
    </svg>
  );
}

function AppFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white py-4">
      <div className="mx-auto flex max-w-lg items-center justify-center gap-4 px-4 text-xs text-gray-400">
        <span>&copy; 2026 JobMargin</span>
        <Link
          to="/terms"
          className="hover:text-gray-600 transition-colors"
        >
          Terms
        </Link>
        <Link
          to="/privacy"
          className="hover:text-gray-600 transition-colors"
        >
          Privacy
        </Link>
      </div>
    </footer>
  );
}
