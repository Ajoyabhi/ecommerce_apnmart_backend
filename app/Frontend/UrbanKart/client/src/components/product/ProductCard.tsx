import { Link } from "wouter";
import { Heart, ShoppingBag } from "lucide-react";
import { formatPrice, cn, getMediaUrl } from "@/lib/utils";
import { RatingStars } from "@/components/ui/Icons";
import { useCart } from "@/store/use-cart";
import { useWishlistState } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/api/types";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlistState();
  const { toast } = useToast();
  const isWished = isInWishlist(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addItem({
      product,
      quantity: 1,
      selectedColor: product.colors?.[0],
      selectedSize: product.sizes?.[0],
    });

    toast({
      title: "Added to Cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const imageUrl = getMediaUrl(
    product.images?.[0] ||
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80"
  );

  return (
    <Link
      href={`/product/${product.slug}`}
      className={cn(
        "group block bg-card rounded-2xl overflow-hidden border border-border/50 hover:shadow-xl hover:border-border transition-all duration-300",
        className
      )}
    >
      <div className="relative aspect-[4/5] bg-gray-100 overflow-hidden">
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {product.discount != null && product.discount > 0 ? (
            <span className="bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              {product.discount}% OFF
            </span>
          ) : null}
          {product.isFeatured && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              FEATURED
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 translate-x-10 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={handleWishlist}
            className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-foreground hover:bg-white hover:text-accent shadow-sm transition-colors"
          >
            <Heart
              className={cn(
                "w-5 h-5 transition-colors",
                isWished && "fill-accent text-accent"
              )}
            />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-10">
          <button
            onClick={handleAddToCart}
            className="w-full bg-primary/95 backdrop-blur text-primary-foreground py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary transition-colors shadow-lg"
          >
            <ShoppingBag className="w-4 h-4" />
            Add to Cart
          </button>
        </div>

        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </div>

      <div className="p-4">
        {product.category && (
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {typeof product.category === "object" && "name" in product.category
              ? product.category.name
              : "Product"}
          </p>
        )}

        <h3 className="font-display font-semibold text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {(product.reviewsCount ?? 0) > 0 && product.rating != null ? (
          <div className="flex items-center gap-1.5 mb-2">
            <RatingStars rating={Number(product.rating)} className="w-3 h-3" />
            <span className="text-xs text-muted-foreground">
              ({product.reviewsCount})
            </span>
          </div>
        ) : (
          <div className="h-4 mb-2" />
        )}

        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold text-lg text-foreground">
            {formatPrice(product.price)}
          </span>
          {product.strikePrice != null &&
            product.strikePrice > product.price && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.strikePrice)}
              </span>
            )}
        </div>
      </div>
    </Link>
  );
}
