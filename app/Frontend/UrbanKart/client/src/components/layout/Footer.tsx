import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10">
          
          <div className="lg:col-span-2">
            <div className="font-display font-black text-2xl tracking-tighter flex items-center gap-2 mb-3">
              <img
                src="https://res.cloudinary.com/dbmlo1jox/image/upload/v1773637331/bgremove_dyvwcm.png"
                alt="Anpamart"
                className="w-10 h-10 object-cover"
              />
              Anpamart
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              A brand by <span className="font-semibold text-foreground">Shrivatsam Projects Private Limited</span>
            </p>
            <p className="text-muted-foreground mb-4 max-w-sm text-sm">
              Your premium destination for fashion, lifestyle, and beauty. Curated collections for the modern aesthetic.
            </p>
            <div className="mb-6 text-sm text-muted-foreground space-y-0.5">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">Registered Address</p>
              <p>First Floor, 80A Indira Nagar</p>
              <p>Shrivatsam Projects Private Limited</p>
              <p>Taramandal Road, R/O Bilandpur</p>
              <p>Taramandal, Gorakhpur</p>
              <p>Uttar Pradesh — 273001</p>
              <p className="mt-2">
                <a href="tel:+919616060593" className="hover:text-primary transition-colors">
                  +91 96160 60593
                </a>
              </p>
            </div>
            <div className="flex gap-4">
              {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* About Us */}
          <div>
            <h4 className="font-display font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-muted-foreground text-sm">
              <li>
                <Link href="/about-us" className="hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/about-us#mission" className="hover:text-primary transition-colors">
                  Our Mission
                </Link>
              </li>
              <li>
                <Link href="/customer-service" className="hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faqs" className="hover:text-primary transition-colors">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-6">Shop</h4>
            <ul className="space-y-4 text-muted-foreground text-sm">
              <li>
                <Link href="/shop?category=fashion-women" className="hover:text-primary transition-colors">
                  Women&apos;s Fashion
                </Link>
              </li>
              <li>
                <Link href="/shop?category=fashion-men" className="hover:text-primary transition-colors">
                  Men&apos;s Fashion
                </Link>
              </li>
              <li>
                <Link href="/shop?category=beauty" className="hover:text-primary transition-colors">
                  Beauty &amp; Accessories
                </Link>
              </li>
              <li>
                <Link href="/shop?sort=newest" className="hover:text-primary transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="/shop?featured=true" className="hover:text-primary transition-colors">
                  Sale &amp; Offers
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-6">Policies</h4>
            <ul className="space-y-4 text-muted-foreground text-sm">
              <li>
                <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="hover:text-primary transition-colors">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-primary transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/refund-cancellation-policy" className="hover:text-primary transition-colors">
                  Refund and Cancellation Policy
                </Link>
              </li>
              <li>
                <Link href="/returns-exchanges" className="hover:text-primary transition-colors">
                  Return Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold mb-6">Newsletter</h4>
            <p className="text-muted-foreground text-sm mb-4">
              Subscribe to get special offers, free giveaways, and updates.
            </p>
            <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="bg-muted border-transparent px-4 py-3 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button className="bg-primary text-primary-foreground px-4 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-md">
                Subscribe
              </button>
            </form>
          </div>

        </div>
        
        <div className="border-t border-border mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 Anpamart by Shrivatsam Projects Private Limited. All rights reserved.</p>
          <div className="flex gap-6 flex-wrap justify-center md:justify-end">
            <Link href="/about-us" className="hover:text-primary">
              About Us
            </Link>
            <Link href="/account/orders" className="hover:text-primary">
              Track Order
            </Link>
            <Link href="/customer-service" className="hover:text-primary">
              Customer Service
            </Link>
            <Link href="/faqs" className="hover:text-primary">
              FAQs
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
