import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { sendEmail } from "~/lib/email";

interface ContactInput {
  name: string;
  email: string;
  message: string;
}

const sendContactMessage = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const input = data as Partial<ContactInput>;
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!name) throw new Error("Name is required.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (!message) throw new Error("Message is required.");
    return { name, email, message } satisfies ContactInput;
  })
  .handler(async ({ data }) => {
    try {
      const result = await sendEmail({
        to: "team@jobmargin.app",
        subject: `JobMargin Contact: ${data.name}`,
        body: `Name: ${data.name}\nEmail: ${data.email}\n\nMessage:\n${data.message}`,
      });
      if (!result.success) return { success: false, error: "We couldn't send your message. Please try again." };
      return { success: true };
    } catch (error) {
      console.error("Contact form submission failed:", error);
      return { success: false, error: "We couldn't send your message. Please try again." };
    }
  });

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us | JobMargin" },
      { name: "description", content: "Have questions about JobMargin? We'd love to hear from you." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await sendContactMessage({ data: { name, email, message } });
      if (!result.success) {
        setError(result.error);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <a href="/" className="text-lg font-bold tracking-tight">Job<span className="text-blue-400">Margin</span></a>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <a href="/blog" className="rounded-lg px-2 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white sm:px-3">Blog</a>
          <a href="/profit-calculator" className="rounded-lg px-2 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white sm:px-3">Calculator</a>
          <a href="/pricing" className="rounded-lg px-2 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white sm:px-3">Pricing</a>
          <a href="/login" className="rounded-lg px-2 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white sm:px-3">Log in</a>
        </nav>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-20 pt-12 sm:px-6 sm:pt-20">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Get in touch</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Contact us</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">Have a question about JobMargin? Send us a note and we’ll be happy to help.</p>
        </div>
        {sent ? (
          <div className="mt-10 rounded-2xl border border-green-400/30 bg-green-400/10 p-8 text-center text-green-100">
            <h2 className="text-xl font-semibold">Thanks, we'll get back to you.</h2>
            <p className="mt-2 text-sm text-green-200/80">We’ll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-10 space-y-5 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
            <Field label="Name" value={name} onChange={setName} required />
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <label className="block text-sm font-medium text-slate-700">Message
              <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="mt-2 block w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-6 text-base font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "Sending…" : "Send message"}
            </button>
            <p className="text-center text-xs text-slate-500">We'll get back to you within 24 hours.</p>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, required }: { label: string; type?: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></label>;
}
