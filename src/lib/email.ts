/**
 * Minimal email helper for JobMargin server code.
 *
 * TODO(email): wire this up to a real transactional email provider (e.g.
 * Resend/SES/SendGrid). The team's inbox is jobmargin-e7ac6af8@ctomail.io.
 * Until then, `sendEmail` logs the message to the server console so it can be
 * recovered from Vercel function logs, and callers may surface the reset link
 * directly to the operator for manual delivery.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(message: EmailMessage): Promise<{ ok: boolean }> {
  // TODO(email): POST to the email provider API here.
  console.log(
    `[sendEmail] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
  );
  return { ok: true };
}
