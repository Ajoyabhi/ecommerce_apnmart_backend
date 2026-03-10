export default function ReturnsExchanges() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Returns &amp; Exchanges
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: March 11, 2026
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Our Promise</h2>
          <p>
            We want you to love everything you buy from Apnamart. If something
            isn&apos;t right, we&apos;re here to help with a simple and transparent
            returns process.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">2. Return Window</h2>
          <p>
            You can request a return or exchange within{" "}
            <span className="font-medium text-foreground">7 days</span> of the
            delivery date. Items returned after this period may not be accepted.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">3. Eligibility</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Items must be unused, unwashed and in original condition.</li>
            <li>All tags, labels and packaging must be intact.</li>
            <li>A valid order ID / invoice is required for all returns.</li>
          </ul>
          <p className="mt-2">
            Certain items may be non‑returnable for hygiene or customisation reasons
            (for example, innerwear, cosmetics once opened, or personalised products).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">4. How to Request a Return</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Email us at{" "}
              <a
                href="mailto:support@apnamart.com"
                className="text-primary hover:underline"
              >
                support@apnamart.com
              </a>{" "}
              with your order ID and item details.
            </li>
            <li>Tell us whether you prefer a refund, exchange or store credit.</li>
            <li>
              Follow the return instructions and pickup/address details we share
              with you.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">5. Refunds</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Once we receive and inspect your return, we&apos;ll notify you of the
              approval or rejection.
            </li>
            <li>
              Approved refunds are processed to the original payment method whenever
              possible.
            </li>
            <li>
              Original shipping charges are normally non‑refundable, except in cases
              of damaged, defective or wrong products received.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">
            6. Damaged / Wrong Items
          </h2>
          <p>
            If you receive a damaged, defective or incorrect item, please contact us
            within 48 hours of delivery with photos and your order ID. We will
            prioritise a free replacement or full refund, as appropriate.
          </p>
        </section>
      </div>
    </div>
  );
}

