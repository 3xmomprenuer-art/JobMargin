import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to JobMargin
      </Link>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">
        Terms of Service
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Last updated: January 2026
      </p>

      <div className="prose prose-sm prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            1. What JobMargin Is
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            JobMargin is a job estimation and invoicing tool built for solo
            contractors — plumbers, electricians, landscapers, handymen, and
            other tradespeople. It helps you create estimates, track actual job
            costs, and send invoices to your clients.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            2. Your Responsibilities
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            You are responsible for the accuracy of every estimate, invoice, and
            piece of client data you enter into JobMargin. We provide the
            platform; you provide the numbers. If an estimate is wrong, an
            invoice is incorrect, or a client disputes a charge, that&rsquo;s
            between you and your client — JobMargin is not a party to those
            agreements.
          </p>
          <p className="text-sm leading-relaxed text-gray-600">
            You are also responsible for your own tax obligations, business
            licenses, insurance, and compliance with local, state, and federal
            laws. JobMargin does not provide tax, legal, or accounting advice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            3. Payment Processing
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Payment processing on JobMargin is handled by Stripe, a trusted
            third-party payment processor. JobMargin does not store, process, or
            transmit your clients&rsquo; credit card numbers, bank account
            details, or other payment method information. All payment data is
            handled directly by Stripe under their own terms of service and
            privacy policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            4. Platform &ldquo;As Is&rdquo;
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            JobMargin is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without any warranty of any kind. We do not
            guarantee that the platform will always be available, error-free, or
            fit for any particular purpose. We work hard to keep it running
            smoothly, but things happen — we&rsquo;re not liable for downtime,
            data loss, or any damages arising from your use of the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            5. Limitation of Liability
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            To the fullest extent permitted by law, JobMargin is not liable for
            any disputes between you and your clients, any financial losses,
            missed payments, or any indirect, incidental, or consequential
            damages arising from your use of the platform. If you&rsquo;re
            unhappy with the service, your remedy is to stop using it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            6. Changes to These Terms
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            We may update these terms from time to time. When we do, we&rsquo;ll
            post the updated version on this page. Continued use of JobMargin
            after changes means you accept the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. Contact</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Questions about these terms? Reach us at{" "}
            <a
              href="mailto:support@jobmargin.app"
              className="text-indigo-600 hover:text-indigo-500 underline"
            >
              support@jobmargin.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
