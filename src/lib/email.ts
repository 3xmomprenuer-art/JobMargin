import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY || "",
);

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const { data, error } = await resend.emails.send({
    from: "JobMargin <noreply@job-margin.com>",
    to: [to],
    subject,
    text: body,
  });

  if (error) {
    console.error("Failed to send email:", error);
    return { success: false, error };
  }

  return { success: true, data };
}
