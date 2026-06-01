import { Shield, Truck, RefreshCw, HeadphonesIcon, MapPin, Phone, Mail } from "lucide-react";

const VALUES = [
  {
    icon: Shield,
    title: "Authenticity Guaranteed",
    description: "Every product on Anpamart is carefully sourced and verified. No counterfeits, no compromises.",
  },
  {
    icon: Truck,
    title: "Fast & Reliable Delivery",
    description: "We partner with trusted logistics providers to ensure your order reaches you safely and on time.",
  },
  {
    icon: RefreshCw,
    title: "Hassle-Free Returns",
    description: "Not satisfied? We offer easy returns and exchanges so you can shop with complete confidence.",
  },
  {
    icon: HeadphonesIcon,
    title: "Dedicated Customer Support",
    description: "Our team is here to help you — before, during, and after your purchase.",
  },
];

export default function AboutUs() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">

      {/* Hero */}
      <div className="mb-14">
        <h1 className="font-display font-bold text-3xl md:text-4xl mb-4">About Anpamart</h1>
        <p className="text-muted-foreground text-sm mb-1">
          A brand by <span className="font-semibold text-foreground">Shrivatsam Projects Private Limited</span>
        </p>
      </div>

      {/* Who We Are */}
      <section className="mb-14">
        <h2 className="font-display font-bold text-xl md:text-2xl mb-4">Who We Are</h2>
        <div className="space-y-4 text-muted-foreground text-sm md:text-base leading-relaxed">
          <p>
            Anpamart is an Indian e-commerce platform dedicated to bringing you the best in fashion,
            lifestyle, and beauty — curated for the modern consumer. We believe style should be
            accessible, authentic, and delivered to your doorstep without compromise.
          </p>
          <p>
            Anpamart is owned and operated by <strong className="text-foreground">Shrivatsam Projects Private Limited</strong>,
            a company registered in Uttar Pradesh, India. Founded with the vision of making quality
            fashion accessible across India, we carefully select every product to ensure it meets
            our standards of quality and value.
          </p>
          <p>
            From women's ethnic wear to contemporary Western styles, men's fashion, accessories, and
            beauty — Anpamart is your one-stop destination for a premium shopping experience at
            honest prices.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section id="mission" className="mb-14 bg-muted/40 rounded-2xl p-8 border border-border">
        <h2 className="font-display font-bold text-xl md:text-2xl mb-3">Our Mission</h2>
        <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
          To be India's most trusted fashion destination — where every customer finds something
          they love, at a price they can afford, delivered with the care and reliability they deserve.
        </p>
      </section>

      {/* Values */}
      <section className="mb-14">
        <h2 className="font-display font-bold text-xl md:text-2xl mb-8">What We Stand For</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {VALUES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-4 p-5 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Corporate Details */}
      <section className="mb-14">
        <h2 className="font-display font-bold text-xl md:text-2xl mb-6">Corporate Information</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          {[
            ["Legal Entity",      "Shrivatsam Projects Private Limited"],
            ["CIN",               "U46593UP2023PTC185334"],
            ["GSTIN",             "09ABLCS2165H2Z0"],
            ["Brand Name",        "Anpamart"],
            ["Business Type",     "Private Limited Company"],
            ["Industry",          "E-Commerce — Fashion, Lifestyle & Beauty"],
            ["Country",           "India"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center px-5 py-3.5 border-b border-border last:border-b-0 odd:bg-muted/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-48 shrink-0 mb-1 sm:mb-0">{label}</span>
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section>
        <h2 className="font-display font-bold text-xl md:text-2xl mb-6">Get In Touch</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <a
            href="mailto:support@anpamart.com"
            className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:shadow-sm hover:border-primary/30 transition-all text-center"
          >
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Email</p>
              <p className="text-sm font-medium">support@anpamart.com</p>
            </div>
          </a>

          <a
            href="tel:+919616060593"
            className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:shadow-sm hover:border-primary/30 transition-all text-center"
          >
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Phone</p>
              <p className="text-sm font-medium">+91 96160 60593</p>
            </div>
          </a>

          <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card text-center">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Registered Office</p>
              <p className="text-sm font-medium leading-relaxed">
                First Floor, 80A Indira Nagar<br />
                Taramandal Road, Bilandpur<br />
                Gorakhpur, UP — 273001
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
