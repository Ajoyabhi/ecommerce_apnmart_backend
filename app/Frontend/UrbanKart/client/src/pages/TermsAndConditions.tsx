export default function TermsAndConditions() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        Terms and Conditions
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="space-y-8 text-sm md:text-base text-muted-foreground">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Introduction</h2>
          <p>
            Welcome to Anpamart. By accessing our website and using our services, you agree to be bound by 
            these Terms and Conditions and our Privacy Policy. If you do not agree with any part of these terms, 
            you are prohibited from using or accessing this site. All visitors, users, and others who access 
            or use the Service must comply with these terms.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">2. Products and Services</h2>
          <p className="mb-2">
            Certain products or services may be available exclusively online through the website. These products 
            or services may have limited quantities and are subject to return or exchange only according to our Return Policy.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>We have made every effort to display the colors and images of our products accurately.</li>
            <li>We reserve the right to limit the sales of our products or Services to any person, geographic region, or jurisdiction.</li>
            <li>All descriptions of products or product pricing are subject to change at any time without notice, at the sole discretion of us.</li>
            <li>We reserve the right to discontinue any product at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">3. Accuracy of Billing and Account Information</h2>
          <p>
            We reserve the right to refuse any order you place with us. We may, in our sole discretion, 
            limit or cancel quantities purchased per person, per household, or per order. In the event that we make a change 
            to or cancel an order, we may attempt to notify you by contacting the e-mail and/or billing address/phone 
            number provided at the time the order was made.
          </p>
          <p className="mt-2">
            You agree to provide current, complete, and accurate purchase and account information for all purchases 
            made at our store. You agree to promptly update your account and other information, including your email address 
            and credit card numbers and expiration dates, so that we can complete your transactions and contact you as needed.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">4. User Comments, Feedback, and Other Submissions</h2>
          <p>
            If, at our request, you send certain specific submissions (for example contest entries) or without a request 
            from us, you send creative ideas, suggestions, proposals, plans, or other materials, whether online, by email, 
            by postal mail, or otherwise (collectively, "comments"), you agree that we may, at any time, without restriction, 
            edit, copy, publish, distribute, translate, and otherwise use in any medium any comments that you forward to us.
          </p>
          <p className="mt-2">
            We are and shall be under no obligation (1) to maintain any comments in confidence; (2) to pay compensation 
            for any comments; or (3) to respond to any comments.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">5. Prohibited Uses</h2>
          <p className="mb-2">
            In addition to other prohibitions set forth in the Terms and Conditions, you are prohibited from using 
            the site or its content:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>For any unlawful purpose or to solicit others to perform or participate in any unlawful acts.</li>
            <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances.</li>
            <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others.</li>
            <li>To upload or transmit viruses or any other type of malicious code that will or may be used in any way that will affect the functionality or operation of the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
          <p>
            In no case shall Anpamart, our directors, officers, employees, affiliates, agents, contractors, interns, 
            suppliers, service providers, or licensors be liable for any injury, loss, claim, or any direct, indirect, incidental, 
            punitive, special, or consequential damages of any kind, including, without limitation lost profits, lost revenue, 
            lost savings, loss of data, replacement costs, or any similar damages, whether based in contract, tort (including negligence), 
            strict liability or otherwise, arising from your use of any of the service or any products procured using the service.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">7. Changes to Terms and Conditions</h2>
          <p>
            You can review the most current version of the Terms and Conditions at any time at this page. 
            We reserve the right, at our sole discretion, to update, change, or replace any part of these Terms 
            and Conditions by posting updates and changes to our website. It is your responsibility to check our website 
            periodically for changes.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">8. Governing Law</h2>
          <p>
            These Terms and Conditions and any separate agreements whereby we provide you Services shall be governed by
            and construed in accordance with the laws of India. Any disputes arising out of or in connection with
            these Terms shall be subject to the exclusive jurisdiction of the courts at Gorakhpur, Uttar Pradesh, India.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">9. Contact Information</h2>
          <p>
            Questions about the Terms and Conditions should be sent to us at{" "}
            <a href="mailto:support@anpamart.com" className="text-primary hover:underline">
              support@anpamart.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
