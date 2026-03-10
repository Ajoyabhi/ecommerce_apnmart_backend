import { AccountLayout } from "@/components/account/AccountLayout";
import { useWishlist, useRemoveFromWishlist } from "@/hooks/use-user";
import { useCart } from "@/store/use-cart";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, getMediaUrl } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Heart,
  ShoppingBag,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";

export default function Wishlist() {
  const { data: items, isLoading } = useWishlist();
  const removeFromWishlist = useRemoveFromWishlist();
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleMoveToCart = (item: (typeof items extends (infer U)[] | undefined ? U : never)) => {
    if (!item?.product) return;
    addItem({
      product: item.product,
      quantity: 1,
      selectedColor: item.product.colors?.[0],
      selectedSize: item.product.sizes?.[0],
    });
    removeFromWishlist.mutate(item.id);
    toast({ title: "Moved to cart", description: `${item.product.name} added to your cart.` });
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">Wishlist</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items?.length ?? 0} saved item{(items?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !items ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">Unable to load wishlist. Please try again later.</p>
            </CardContent>
          </Card>
        ) : !items.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-pink-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Your wishlist is empty</h3>
              <p className="text-muted-foreground text-sm mb-4">Save items you love to buy them later.</p>
              <Link href="/shop">
                <Button data-testid="button-browse-products">Browse Products</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden group" data-testid={`card-wishlist-${item.id}`}>
                <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden">
                  <Link href={`/product/${item.product.slug}`}>
                    <img
                      src={getMediaUrl(item.product.images?.[0]) || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80"}
                      alt={item.product.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </Link>
                  <button
                    className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-destructive hover:bg-white shadow-sm transition-colors z-10"
                    onClick={() => removeFromWishlist.mutate(item.id)}
                    data-testid={`button-remove-wishlist-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <CardContent className="p-4">
                  {item.product.category && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {typeof item.product.category === "object" && "name" in item.product.category
                        ? item.product.category.name
                        : "Product"}
                    </p>
                  )}
                  <Link href={`/product/${item.product.slug}`}>
                    <h3 className="font-display font-semibold text-foreground line-clamp-1 mb-2 hover:text-primary transition-colors">
                      {item.product.name}
                    </h3>
                  </Link>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="font-display font-bold text-lg">{formatPrice(item.product.price)}</span>
                    {item.product.strikePrice != null && item.product.strikePrice > item.product.price && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(item.product.strikePrice)}
                      </span>
                    )}
                    {item.product.discount != null && item.product.discount > 0 && (
                      <span className="text-xs font-semibold text-green-600">{item.product.discount}% OFF</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => handleMoveToCart(item)}
                      data-testid={`button-move-to-cart-${item.id}`}
                    >
                      <ShoppingBag className="w-4 h-4 mr-1.5" />
                      Move to Cart
                    </Button>
                    <Link href={`/product/${item.product.slug}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-product-${item.id}`}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
