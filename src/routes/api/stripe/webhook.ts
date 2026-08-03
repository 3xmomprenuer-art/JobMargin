/**
 * Stripe webhook — server route (no UI component).
 *
 * Receives events from Stripe and updates the user's subscription state.
 * Stripe posts the raw JSON body + `stripe-signature` header to
 * POST /api/stripe/webhook; we verify the signature and apply the event.
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/db";
import { stripe } from "~/lib/stripe";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });
        const body = await request.text();

        let event;
        try {
          event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!,
          );
        } catch (err: any) {
          return new Response(`Webhook Error: ${err.message}`, { status: 400 });
        }

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as any;
            if (session.customer_email && session.customer) {
              await sql`
                UPDATE users
                SET subscription_status = 'active', stripe_customer_id = ${session.customer as string}
                WHERE email = ${session.customer_email}
              `;
            }
            break;
          }
          case "customer.subscription.updated": {
            const sub = event.data.object as any;
            await sql`
              UPDATE users
              SET subscription_status = ${sub.status}, subscription_ends_at = to_timestamp(${sub.current_period_end})
              WHERE stripe_customer_id = ${sub.customer as string}
            `;
            break;
          }
          case "customer.subscription.deleted": {
            const sub = event.data.object as any;
            await sql`
              UPDATE users
              SET subscription_status = 'canceled'
              WHERE stripe_customer_id = ${sub.customer as string}
            `;
            break;
          }
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 });
      },
    },
  },
});
