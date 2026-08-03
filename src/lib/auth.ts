/**
 * JobMargin auth module — custom cookie-based sessions + bcryptjs + Postgres.
 *
 * All server functions (signup, login, logout, getCurrentUser) run only on the
 * server and use the `createServerFn` primitive from TanStack Start.
 *
 * `requireAuth` is a plain helper that calls `getCurrentUser` and throws a
 * redirect to `/login` when the caller is not authenticated. Use it inside
 * loaders to protect routes.
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { hashSync, compareSync } from "bcryptjs";
import { sql } from "~/db";
import { sendEmail } from "~/lib/email";

// Base URL used to build password-reset links. Overridable via APP_URL so the
// deployed environment can point at its own public origin.
const RESET_BASE_URL =
  process.env.APP_URL || "https://site-n3gnbjvdd-4xmomprenuer.vercel.app";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  subscriptionStatus: string;
  trialStartedAt: string;
  stripeCustomerId: string | null;
  subscriptionEndsAt: string | null;
}

// Subscriptions that require the user to fix billing before using the app.
export const SUBSCRIPTION_ATTENTION_STATUSES = [
  "past_due",
  "canceled",
  "incomplete_expired",
] as const;

// Free trial length in milliseconds (7 days).
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function toUser(u: Record<string, unknown>): User {
  return {
    id: String(u.id),
    email: String(u.email),
    name: String(u.name),
    companyName: u.company_name ? String(u.company_name) : null,
    subscriptionStatus: String(u.subscription_status ?? "trialing"),
    trialStartedAt: u.trial_started_at ? String(u.trial_started_at) : new Date(0).toISOString(),
    stripeCustomerId: u.stripe_customer_id ? String(u.stripe_customer_id) : null,
    subscriptionEndsAt: u.subscription_ends_at ? String(u.subscription_ends_at) : null,
  };
}

export interface AuthResult {
  user: User | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): string {
  return hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return compareSync(plain, hash);
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

async function createSession(userId: string): Promise<{ token: string }> {
  const token = crypto.randomUUID();
  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, NOW() + interval '7 days')
  `;
  return { token };
}

async function deleteSessionByToken(token: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

async function getSessionByToken(
  token: string,
): Promise<{ user_id: string; expires_at: string } | null> {
  const rows = await sql`
    SELECT user_id, expires_at FROM sessions WHERE token = ${token}
  `;
  if (rows.length === 0) return null;
  return {
    user_id: String(rows[0].user_id),
    expires_at: String(rows[0].expires_at),
  };
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const signup = createServerFn({ method: "POST" })
  .validator(
    (data: { name: string; email: string; password: string; companyName?: string }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const { name, email, password, companyName } = data;

      // Validate
      if (!name?.trim()) return { user: null, error: "Name is required." };
      if (!email?.trim()) return { user: null, error: "Email is required." };
      if (!password || password.length < 6)
        return {
          user: null,
          error: "Password must be at least 6 characters.",
        };

      const normalizedEmail = email.trim().toLowerCase();

      // Check uniqueness
      const existing = await sql`
        SELECT id FROM users WHERE email = ${normalizedEmail}
      `;
      if (existing.length > 0) {
        return { user: null, error: "An account with that email already exists." };
      }

      // Hash password & insert user — every new account starts a 7-day free
      // trial (subscription_status = 'trialing', trial_started_at = NOW()).
      const passwordHash = await hashPassword(password);
      const userRows = await sql`
        INSERT INTO users (email, password_hash, name, company_name, subscription_status, trial_started_at)
        VALUES (${normalizedEmail}, ${passwordHash}, ${name.trim()}, ${
          companyName?.trim() || null
        }, 'trialing', NOW())
        RETURNING id, email, name, company_name, subscription_status, trial_started_at, stripe_customer_id, subscription_ends_at
      `;
      const newUser = userRows[0];
      const userId = String(newUser.id);

      // Claim orphaned data — only if this is the first user
      const userCount = await sql`SELECT COUNT(*)::int AS cnt FROM users`;
      if (Number(userCount[0].cnt) === 1) {
        await sql`UPDATE clients    SET user_id = ${userId} WHERE user_id IS NULL`;
        await sql`UPDATE estimates  SET user_id = ${userId} WHERE user_id IS NULL`;
        await sql`UPDATE jobs       SET user_id = ${userId} WHERE user_id IS NULL`;
        await sql`UPDATE invoices   SET user_id = ${userId} WHERE user_id IS NULL`;
      }

      // Create session & set cookie
      const { token } = await createSession(userId);
      setCookie("session_token", token, cookieOptions);

      return { user: toUser(newUser as Record<string, unknown>) };
    } catch {
      return { user: null, error: "Something went wrong. Please try again." };
    }
  });

export const login = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { email, password } = data;

      if (!email?.trim() || !password) {
        return { user: null, error: "Invalid email or password." };
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Look up user
      const rows = await sql`
        SELECT id, email, password_hash, name, company_name, subscription_status, trial_started_at, stripe_customer_id, subscription_ends_at
        FROM users
        WHERE email = ${normalizedEmail}
      `;
      if (rows.length === 0) {
        return { user: null, error: "Invalid email or password." };
      }

      const u = rows[0];

      // Verify password
      const valid = await verifyPassword(password, String(u.password_hash));
      if (!valid) {
        return { user: null, error: "Invalid email or password." };
      }

      // Create session & set cookie
      const { token } = await createSession(String(u.id));
      setCookie("session_token", token, cookieOptions);

      return { user: toUser(u as Record<string, unknown>) };
    } catch {
      return { user: null, error: "Something went wrong. Please try again." };
    }
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const token = getCookie("session_token");
    if (token) {
      await deleteSessionByToken(token);
    }
    deleteCookie("session_token", { path: "/" });
    return { success: true };
  } catch {
    return { success: true };
  }
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<User | null> => {
    try {
      const token = getCookie("session_token");
      if (!token) return null;

      const session = await getSessionByToken(token);
      if (!session) return null;

      // Check expiry
      if (new Date(session.expires_at) < new Date()) {
        await deleteSessionByToken(token);
        return null;
      }

      const rows = await sql`
        SELECT id, email, name, company_name, subscription_status, trial_started_at, stripe_customer_id, subscription_ends_at
        FROM users
        WHERE id = ${session.user_id}
      `;
      if (rows.length === 0) return null;

      return toUser(rows[0] as Record<string, unknown>);
    } catch {
      return null;
    }
  },
);

// ---------------------------------------------------------------------------
// Route protection helper (not a server fn — use in loaders)
// ---------------------------------------------------------------------------

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw redirect({ to: "/login" });
  }
  return user;
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    try {
      const email = (data.email ?? "").trim().toLowerCase();
      if (!email) return { success: true };

      const rows = await sql`
        SELECT id, email FROM users WHERE email = ${email}
      `;

      if (rows.length > 0) {
        const userId = String(rows[0].id);
        const token = crypto.randomUUID();

        await sql`
          INSERT INTO password_reset_tokens (user_id, token, expires_at)
          VALUES (${userId}, ${token}, NOW() + interval '1 hour')
        `;

        const resetLink = `${RESET_BASE_URL}/reset-password?token=${token}`;
        await sendEmail({
          to: email,
          subject: "Reset your JobMargin password",
          body:
            "We received a request to reset your JobMargin password.\n\n" +
            `Open this link to choose a new password (valid for 1 hour):\n${resetLink}\n\n` +
            "If you didn't request this, you can safely ignore this email.",
        });
      }

      // Always report success so we never reveal whether an email exists.
      return { success: true };
    } catch {
      return { success: true };
    }
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator((data: { token: string; newPassword: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { token, newPassword } = data;

      if (!token) {
        return { success: false, error: "Invalid or expired reset link." };
      }
      if (!newPassword || newPassword.length < 6) {
        return {
          success: false,
          error: "Password must be at least 6 characters.",
        };
      }

      const rows = await sql`
        SELECT user_id, expires_at, used
        FROM password_reset_tokens
        WHERE token = ${token}
      `;
      if (rows.length === 0) {
        return { success: false, error: "Invalid or expired reset link." };
      }

      const resetToken = rows[0];
      if (resetToken.used) {
        return {
          success: false,
          error: "This reset link has already been used. Request a new one.",
        };
      }
      if (new Date(String(resetToken.expires_at)) < new Date()) {
        return {
          success: false,
          error: "This reset link has expired. Request a new one.",
        };
      }

      const userId = String(resetToken.user_id);
      const passwordHash = hashSync(newPassword, 10);

      await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
      await sql`
        UPDATE password_reset_tokens SET used = true WHERE token = ${token}
      `;
      // Force logout everywhere: kill every session for this user.
      await sql`DELETE FROM sessions WHERE user_id = ${userId}`;

      return { success: true };
    } catch {
      return {
        success: false,
        error: "Something went wrong. Please try again.",
      };
    }
  });
