export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Terms of Service
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: March 11, 2026
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Agreement</h2>
          <p>
            By accessing or using the Apnamart website and placing an order, you
            agree to be bound by these Terms of Service and our Privacy Policy.
            If you do not agree, please do not use our services.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            2. Use of Our Store
          </h2>
          <p className="mb-2">
            You agree to use our website only for lawful purposes and in a way
            that does not infringe the rights of others or restrict or inhibit
            their enjoyment of the site.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>No fraudulent or abusive behaviour.</li>
            <li>No attempts to interfere with or disrupt our systems.</li>
            <li>No unauthorised use of our content or trademarks.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            3. Orders &amp; Payments
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              All orders are subject to acceptance and product availability.
            </li>
            <li>
              Pricing, offers and availability are subject to change without
              notice.
            </li>
            <li>
              We reserve the right to cancel any order (for example in case of
              pricing errors, suspected fraud or stock issues). In such cases,
              any payment already made will be refunded.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            4. Shipping, Returns &amp; Refunds
          </h2>
          <p>
            Shipping timelines, return eligibility and refund conditions are
            described in our separate Returns &amp; Exchanges policy. By placing
            an order, you agree to that policy as part of these Terms.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            5. Intellectual Property
          </h2>
          <p>
            All content on Apnamart, including logos, graphics, product images
            and text, is owned by or licensed to us and protected by applicable
            intellectual property laws. You may not copy, modify, distribute or
            use our content without our prior written consent, except where
            permitted by law for personal, non‑commercial use.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            6. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, Apnamart will not be liable
            for any indirect, incidental or consequential damages arising from
            your use of the site or purchase of products. Our total liability
            for any claim related to a purchase will not exceed the amount you
            paid for that order.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            7. Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. The latest version will
            always be available on this page. Your continued use of the website
            after changes become effective constitutes your acceptance of the
            revised Terms.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            8. Contact Information
          </h2>
          <p>
            For questions about these Terms, please contact us at{" "}
            <a
              href="mailto:support@apnamart.com"
              className="text-primary hover:underline"
            >
              support@apnamart.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

