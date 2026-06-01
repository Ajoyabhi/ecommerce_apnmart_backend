import { Link } from "wouter";
import { ShoppingBag, Home, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-display font-black text-primary mb-4">404</p>
        <h1 className="text-2xl font-display font-bold mb-3">Page Not Found</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved or the link might be incorrect.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/shop">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Browse Shop
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/customer-service">
              <HeadphonesIcon className="w-4 h-4 mr-2" />
              Contact Us
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
