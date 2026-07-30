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
import bcrypt from "bcryptjs";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
}

export interface AuthResult {
  user: User | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
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

      // Hash password & insert user
      const passwordHash = await hashPassword(password);
      const userRows = await sql`
        INSERT INTO users (email, password_hash, name, company_name)
        VALUES (${normalizedEmail}, ${passwordHash}, ${name.trim()}, ${
          companyName?.trim() || null
        })
        RETURNING id, email, name, company_name
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

      return {
        user: {
          id: userId,
          email: String(newUser.email),
          name: String(newUser.name),
          companyName: newUser.company_name ? String(newUser.company_name) : null,
        },
      };
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
        SELECT id, email, password_hash, name, company_name
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

      return {
        user: {
          id: String(u.id),
          email: String(u.email),
          name: String(u.name),
          companyName: u.company_name ? String(u.company_name) : null,
        },
      };
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
        SELECT id, email, name, company_name
        FROM users
        WHERE id = ${session.user_id}
      `;
      if (rows.length === 0) return null;

      const u = rows[0];
      return {
        id: String(u.id),
        email: String(u.email),
        name: String(u.name),
        companyName: u.company_name ? String(u.company_name) : null,
      };
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
