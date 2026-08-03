/**
 * Stripe SDK singleton — server-side only.
 *
 * Reads the secret key from the environment. STRIPE_SECRET_KEY is set in .env
 * locally and forwarded to Vercel by go-live.sh.
 */

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia",
});
