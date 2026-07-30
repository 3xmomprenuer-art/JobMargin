import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
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
        Privacy Policy
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Last updated: January 2026
      </p>

      <div className="prose prose-sm prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            1. What We Store
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            To provide the JobMargin service, we store the following information
            that you enter into the platform:
          </p>
          <ul className="list-disc pl-5 text-sm leading-relaxed text-gray-600 space-y-1">
            <li>
              <strong>Client contact information</strong> — names, email
              addresses, phone numbers, and physical addresses for the clients
              you work with.
            </li>
            <li>
              <strong>Estimate details</strong> — line items, pricing, notes,
              and the status of each estimate you create.
            </li>
            <li>
              <strong>Job details</strong> — materials used, their costs, time
              entries, labor costs, and job status for each job you track.
            </li>
            <li>
              <strong>Invoice records</strong> — amounts, dates, payment status,
              and links to Stripe payment pages for invoices you send.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            2. What We Don&rsquo;t Store
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Payment information — credit card numbers, bank account details, and
            payment method data — is never stored, processed, or transmitted by
            JobMargin. All payment processing is handled by Stripe, our
            third-party payment processor. Stripe handles that data under their
            own privacy policy and security practices (PCI DSS Level 1
            certified).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            3. How We Use Your Data
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            The data you enter into JobMargin is used for one purpose only: to
            provide you with the estimation, job tracking, and invoicing service
            you signed up for. We do not sell your data. We do not share it with
            third parties. We do not use it for advertising, marketing, or any
            purpose other than running the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            4. Data Retention
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Your data is kept for as long as your JobMargin account remains
            active. If you stop using the service, you can request deletion of
            your data by contacting us. We may retain certain records as
            required by law or for legitimate business purposes (such as
            resolving disputes or enforcing our terms).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            5. No Tracking or Cookies
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            JobMargin does not use analytics services, advertising cookies, or
            any form of user tracking. We don&rsquo;t have a Facebook pixel, a
            Google Analytics tag, or any other tracking technology. The only
            cookies we set are strictly necessary for the app to function (such
            as session cookies for authentication).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            6. Data Security
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            We take reasonable measures to protect your data — including
            encryption in transit (HTTPS) and at rest — but no online service
            can guarantee absolute security. You are responsible for keeping
            your login credentials secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            7. Your Clients&rsquo; Data
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            When you enter your clients&rsquo; contact information into
            JobMargin, you are responsible for ensuring you have their consent
            to do so. JobMargin acts as a data processor on your behalf — we
            only handle that data to provide the service to you, not for our own
            purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            8. Changes to This Policy
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            We may update this privacy policy from time to time. When we do,
            we&rsquo;ll post the updated version on this page. Continued use of
            JobMargin after changes means you accept the new policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">9. Contact</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Questions or concerns about privacy? Reach us at{" "}
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
