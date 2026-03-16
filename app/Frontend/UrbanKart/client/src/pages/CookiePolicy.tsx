export default function CookiePolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Cookie Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: March 11, 2026
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. What Are Cookies?</h2>
          <p>
            Cookies are small text files that are stored on your device when you visit
            a website. They help us remember your preferences, understand how you use
            Anpamart, and improve your shopping experience.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">2. How We Use Cookies</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To keep you signed in and remember items in your cart.</li>
            <li>To save your language, region and display preferences.</li>
            <li>To understand traffic patterns and improve site performance.</li>
            <li>To show relevant offers and measure marketing campaigns.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">3. Types of Cookies</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="font-medium text-foreground">Essential cookies</span>{" "}
              – required for core functionality such as secure login and checkout.
            </li>
            <li>
              <span className="font-medium text-foreground">Performance cookies</span>{" "}
              – help us analyse how visitors use the site.
            </li>
            <li>
              <span className="font-medium text-foreground">Functional cookies</span>{" "}
              – remember your preferences to provide a more personalised experience.
            </li>
            <li>
              <span className="font-medium text-foreground">Advertising cookies</span>{" "}
              – used by us and our partners to deliver relevant ads.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            4. Managing Cookies
          </h2>
          <p className="mb-2">
            You can control cookies through your browser settings, including:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Blocking all cookies.</li>
            <li>Blocking cookies from specific sites.</li>
            <li>Deleting cookies that have already been set.</li>
          </ul>
          <p className="mt-2">
            If you block or delete certain cookies, some features of Anpamart may not
            work as intended.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">5. Contact</h2>
          <p>
            If you have any questions about how we use cookies, please contact us at{" "}
            <a
              href="mailto:support@anpamart.com"
              className="text-primary hover:underline"
            >
              support@anpamart.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

