const faqs = [
  {
    question: "How do I track my order?",
    answer:
      "Once your order ships, we send you an email and SMS with a tracking link. You can also view tracking details under My Account → Orders after signing in.",
  },
  {
    question: "What is your return policy?",
    answer:
      "You can request a return or exchange within 7 days of delivery for most products, as long as they are unused, with all tags and original packaging. See the Returns & Exchanges page for full details.",
  },
  {
    question: "Which payment methods do you accept?",
    answer:
      "We currently accept major debit/credit cards, UPI and popular wallets via our secure payment partners.",
  },
  {
    question: "Do I need an account to place an order?",
    answer:
      "You can check out as a guest, but creating an account makes it easier to track orders, save addresses and view your order history.",
  },
  {
    question: "How do I contact support?",
    answer:
      "You can email us any time at support@apnamart.com. We aim to respond within 24 business hours.",
  },
];

export default function Faqs() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">
        FAQs
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Quick answers to the most common questions about shopping on Apnamart.
      </p>

      <div className="space-y-6">
        {faqs.map((item) => (
          <div
            key={item.question}
            className="rounded-2xl border border-border bg-card/50 p-5 md:p-6"
          >
            <h2 className="font-semibold text-foreground mb-2">
              {item.question}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

