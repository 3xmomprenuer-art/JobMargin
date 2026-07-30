import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { logout } from "~/lib/auth";

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function doLogout() {
      await logout();
      if (!cancelled) {
        navigate({ to: "/login" });
      }
    }
    doLogout();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <svg
          className="h-8 w-8 animate-spin text-indigo-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm font-medium text-gray-500">Logging out...</p>
      </div>
    </div>
  );
}
