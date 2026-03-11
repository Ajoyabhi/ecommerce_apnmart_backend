import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          
          <div className="lg:col-span-2">
            <div className="font-display font-black text-2xl tracking-tighter flex items-center gap-2 mb-6">
              <img
                src="https://res.cloudinary.com/dbmlo1jox/image/upload/v1773217272/Untitled_pkxap0.png"
                alt="Apnamart"
                className="w-10 h-10 object-cover"
              />
              Apnamart
            </div>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Your premium destination for fashion, lifestyle, and beauty. Curated collections for the modern aesthetic.
            </p>
            <div className="flex gap-4">
              {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
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
            <h4 className="font-display font-bold mb-6">Help & Support</h4>
            <ul className="space-y-4 text-muted-foreground text-sm">
              <li>
                <Link href="/account/orders" className="hover:text-primary transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/returns-exchanges" className="hover:text-primary transition-colors">
                  Returns &amp; Exchanges
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-primary transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href="/customer-service" className="hover:text-primary transition-colors">
                  Customer Service
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
          <p>© 2024 Apnamart. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-primary">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="hover:text-primary">
              Terms of Service
            </Link>
            <Link href="/cookie-policy" className="hover:text-primary">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
