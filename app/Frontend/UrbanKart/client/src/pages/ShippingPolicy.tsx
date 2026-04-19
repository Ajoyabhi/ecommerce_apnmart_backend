export default function ShippingPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Shipping Policy
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Order Processing Time</h2>
          <p>
            All orders are processed within 1 to 3 business days (excluding weekends and holidays) after 
            receiving your order confirmation email. You will receive another notification when your order 
            has shipped.
          </p>
          <p className="mt-2 text-xs italic">
            Please note that there may be potential delays due to a high volume of orders or postal service 
            issues that are outside of our control.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">2. Domestic Shipping Rates and Estimates</h2>
          <p className="mb-2">
            Shipping charges for your order will be calculated and displayed at checkout. 
            We offer the following shipping options for domestic deliveries:
          </p>
          <div className="overflow-x-auto mt-4 mb-4">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-foreground">Shipping Option</th>
                  <th className="px-4 py-2 text-left font-semibold text-foreground">Estimated Delivery Time</th>
                  <th className="px-4 py-2 text-left font-semibold text-foreground">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-2">Standard Shipping</td>
                  <td className="px-4 py-2">3-5 Business Days</td>
                  <td className="px-4 py-2">Free for orders over $50.00</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Expedited Shipping</td>
                  <td className="px-4 py-2">1-2 Business Days</td>
                  <td className="px-4 py-2">$15.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">3. International Shipping</h2>
          <p>
            We offer international shipping to select countries. Shipping charges for your order will be 
            calculated and displayed at checkout based on your delivery destination and the weight of your order.
          </p>
          <p className="mt-2">
            Your order may be subject to import duties and taxes (including VAT), which are incurred once 
            a shipment reaches your destination country. Anpamart is not responsible for these charges if 
            they are applied and are your responsibility as the customer.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">4. How do I check the status of my order?</h2>
          <p>
            When your order has shipped, you will receive an email notification from us which will include 
            a tracking number you can use to check its status. Please allow 48 hours for the tracking 
            information to become available.
          </p>
          <p className="mt-2">
            If you haven’t received your order within 7 days of receiving your shipping confirmation email, 
            please contact us at support@anpamart.com with your name and order number, and we will look 
            into it for you.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">5. Damages and Missing Packages</h2>
          <p>
            In the event that your order arrives damaged in any way, please email us as soon as possible 
            at support@anpamart.com with your order number and a photo of the item’s condition. We 
            address these on a case-by-case basis but will try our best to work towards a satisfactory solution.
          </p>
          <p className="mt-2">
            If a package is marked as delivered by the carrier but you have not received it, please check with 
            your neighbors and surrounding areas. If it is still missing after 3 business days, please reach out 
            to our customer service team.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">6. Contact Information</h2>
          <p>
            If you have any further questions about our shipping policy, please contact us at{" "}
            <a href="mailto:support@anpamart.com" className="text-primary hover:underline">
              support@anpamart.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
