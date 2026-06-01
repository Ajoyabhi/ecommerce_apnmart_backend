export default function RefundCancellationPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Refund and Cancellation Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Cancellation Policy</h2>
          <p>
            You can cancel your order within 24 hours of placing it. If the order has already been processed or shipped, it cannot be cancelled.
          </p>
          <p className="mt-2">
            To request a cancellation, please contact us immediately at support@anpamart.com with your order number.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">2. Refund Policy</h2>
          <p>
            We offer refunds for products returned within 14 days of delivery. To be eligible for a return and refund, your item must be unused, in the same condition that you received it, and in its original packaging.
          </p>
          <p className="mt-2">
            Once we receive and inspect your returned item, we will notify you of the approval or rejection of your refund. If approved, your refund will be processed within <strong>5–7 business days</strong>, and a credit will automatically be applied to your original method of payment.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">3. Non-Refundable Items</h2>
          <p>
            Certain items cannot be refunded, including but not limited to:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Gift cards</li>
            <li>Downloadable software products</li>
            <li>Some health and personal care items</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">4. Late or Missing Refunds</h2>
          <p>
            If you haven’t received a refund yet, first check your bank account again. Then contact your credit card company, as it may take some time before your refund is officially posted.
          </p>
          <p className="mt-2">
            Next, contact your bank. There is often some processing time before a refund is posted. If you’ve done all of this and you still have not received your refund yet, please contact us at support@anpamart.com.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">5. Contact Information</h2>
          <p>
            If you have any further questions about our Refund and Cancellation Policy, please contact us at{" "}
            <a href="mailto:support@anpamart.com" className="text-primary hover:underline">
              support@anpamart.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
