export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Privacy Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: March 11, 2026
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Overview</h2>
          <p>
            At Apnamart, we care deeply about your privacy. This Policy explains
            what information we collect when you use our website, how we use it,
            and the choices you have.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            2. Information We Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Contact details such as your name, email address, phone number and
              shipping / billing address.
            </li>
            <li>
              Order information including the products you buy, payment status,
              and delivery details.
            </li>
            <li>
              Technical data like IP address, device type, browser and pages
              visited, collected via cookies and similar technologies.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            3. How We Use Your Information
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To process and deliver your orders and provide invoices.</li>
            <li>To manage your account and your interactions with us.</li>
            <li>
              To improve our store, products and user experience through
              analytics.
            </li>
            <li>
              To send you service emails (order updates, security notices) and,
              if you opt in, marketing messages you can unsubscribe from at any
              time.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            4. Sharing Your Information
          </h2>
          <p>
            We never sell your personal data. We only share it with trusted
            third parties who help us run Apnamart, such as payment providers,
            logistics partners, analytics and email service providers. These
            partners only receive the minimum data necessary to perform their
            services and must protect it appropriately.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            5. Cookies &amp; Tracking
          </h2>
          <p>
            We use cookies and similar technologies to keep you signed in,
            remember your cart and preferences, and understand how our store is
            used. You can control cookies through your browser settings, but
            disabling some cookies may affect site functionality. See our
            Cookie Policy for more details.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            6. Your Rights &amp; Choices
          </h2>
          <p className="mb-2">
            Depending on your location, you may have the right to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you.</li>
            <li>Request corrections to inaccurate or incomplete data.</li>
            <li>Request deletion of your data, subject to legal obligations.</li>
            <li>Opt out of marketing communications at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">7. Security</h2>
          <p>
            We use industry‑standard security measures to protect your
            information, including encryption where appropriate. However, no
            method of transmission or storage is completely secure, and we
            cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            8. Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy or our data
            practices, please contact us at{" "}
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

