import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Share layout route — standalone client-facing pages without the app shell
 * (no bottom nav, no internal navigation).
 */
export const Route = createFileRoute("/share")({
  component: ShareLayout,
});

function ShareLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <svg
                className="h-4 w-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <circle cx="12" cy="14" r="2" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-gray-900">
              JobMargin
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-lg px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4">
        <p className="text-center text-xs text-gray-400">
          Powered by{" "}
          <span className="font-semibold text-gray-500">JobMargin</span>
        </p>
      </footer>
    </div>
  );
}
