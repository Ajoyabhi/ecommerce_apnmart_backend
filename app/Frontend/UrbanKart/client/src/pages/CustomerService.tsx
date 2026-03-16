export default function CustomerService() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Customer Service
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        We&apos;re here to help with anything related to your Anpamart orders and
        account.
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">
            1. Contact Channels
          </h2>
          <ul className="space-y-1">
            <li>
              <span className="font-medium text-foreground">Email:</span>{" "}
              <a
                href="mailto:support@anpamart.com"
                className="text-primary hover:underline"
              >
                support@anpamart.com
              </a>
            </li>
            <li>
              <span className="font-medium text-foreground">Support hours:</span>{" "}
              Monday – Saturday, 10:00 AM – 7:00 PM (IST)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            2. Common Requests
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Order status and tracking information.</li>
            <li>Help with returns, exchanges and refunds.</li>
            <li>Size, fit or product detail questions.</li>
            <li>Account and login issues.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            3. Response Times
          </h2>
          <p>
            We aim to respond to all queries within 24 business hours. During
            peak sale periods, responses may take slightly longer, but we&apos;ll
            do our best to get back to you quickly.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            4. Feedback &amp; Complaints
          </h2>
          <p>
            Your feedback helps us improve. If you&apos;d like to share a
            suggestion or raise a complaint, please email{" "}
            <a
              href="mailto:support@anpamart.com"
              className="text-primary hover:underline"
            >
              support@anpamart.com
            </a>{" "}
            with &quot;Feedback&quot; or &quot;Complaint&quot; in the subject line.
          </p>
        </section>
      </div>
    </div>
  );
}

