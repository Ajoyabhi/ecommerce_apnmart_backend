import { useEffect, useState } from "react";
import { useHeroBanners, useProducts } from "@/hooks/use-shop";
import { ProductCard } from "@/components/product/ProductCard";
import { Link } from "wouter";
import {
  ArrowRight,
  Zap,
  Star,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { getMediaUrl } from "@/lib/utils";

const FALLBACK_HERO = {
  id: "fallback",
  title: "Summer Collection '24",
  subtitle: "Up to 50% Off on Selected Styles",
  image:
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1920&q=80",
  color: "text-white",
};

export default function Home() {
  const { data: heroBanners = [] } = useHeroBanners();
  const { data: featuredData, isLoading: loadingFeatured } =
    useProducts({ featured: true, status: "published" });
  const featuredProducts = featuredData?.list ?? [];

  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);

  const featured = featuredProducts.slice(0, 4);
  const newArrivals = featuredProducts.slice(0, 8);

  const slides = heroBanners.length > 0 ? heroBanners : [FALLBACK_HERO];

  useEffect(() => {
    if (!carouselApi || slides.length <= 1) return;

    const interval = setInterval(() => {
      if (!carouselApi) return;
      if (carouselApi.canScrollNext()) {
        carouselApi.scrollNext();
      } else {
        carouselApi.scrollTo(0);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [carouselApi, slides.length]);

  return (
    <div className="min-h-screen pb-20">
      <section className="relative bg-muted">
        <Carousel
          className="relative"
          opts={{ loop: true }}
          setApi={setCarouselApi}
        >
          <CarouselContent className="h-full">
            {slides.map((hero) => {
              const mediaSrc = getMediaUrl(hero.image);
              const isVideo =
                typeof hero.image === "string" &&
                (hero.image.toLowerCase().endsWith(".mp4") ||
                  hero.image.toLowerCase().endsWith(".webm") ||
                  hero.image.toLowerCase().endsWith(".mov") ||
                  hero.image.includes("/video/"));

              return (
                <CarouselItem key={hero.id} className="h-full">
                  <div className="h-[60vh] md:h-[70vh] relative overflow-hidden">
                    {isVideo ? (
                      <video
                        src={mediaSrc}
                        className="absolute inset-0 w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={mediaSrc}
                        alt={hero.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                    <div className="absolute inset-0 flex items-center">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                        <div className="max-w-xl space-y-6">
                          {hero.subtitle && (
                            <p
                              className={`font-semibold tracking-wider uppercase ${
                                hero.color ?? "text-white"
                              } opacity-90`}
                            >
                              {hero.subtitle}
                            </p>
                          )}
                          <h1
                            className={`font-display font-black text-5xl md:text-7xl ${
                              hero.color ?? "text-white"
                            } leading-tight`}
                          >
                            {hero.title}
                          </h1>
                          <Link
                            href="/shop"
                            className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-xl"
                          >
                            Shop Now
                            <ArrowRight className="w-5 h-5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </section>

      <section className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: Truck,
                title: "Free Shipping",
                desc: "On orders over ₹2,000",
              },
              {
                icon: ShieldCheck,
                title: "Secure Payment",
                desc: "100% secure checkout",
              },
              { icon: Zap, title: "Fast Delivery", desc: "Within 2-3 business days" },
              {
                icon: Star,
                title: "Premium Quality",
                desc: "Top brands & materials",
              },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center shrink-0">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-3xl flex items-center gap-3">
              <Zap className="w-8 h-8 text-accent fill-accent" />
              Featured Picks
            </h2>
            <p className="text-muted-foreground mt-2">
              Handpicked products for you.
            </p>
          </div>
          <Link
            href="/shop?featured=true"
            className="text-primary font-medium hover:underline flex items-center gap-1 hidden sm:flex"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-muted aspect-[4/5] rounded-2xl"
              />
            ))}
          </div>
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="bg-muted/50 rounded-3xl p-12 text-center text-muted-foreground">
            No featured products yet. Check back later!
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <h2 className="font-display font-bold text-3xl mb-10 text-center">
          Shop by Category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[
            {
              name: "Women's Fashion",
              image:
                "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&q=80",
            },
            {
              name: "Men's Style",
              image:
                "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=500&q=80",
            },
            {
              name: "Accessories",
              image:
                "https://images.unsplash.com/photo-1523206489230-c012c64b2b48?w=500&q=80",
            },
            {
              name: "Beauty",
              image:
                "https://images.unsplash.com/photo-1596462502278-27bf85033e5a?w=500&q=80",
            },
          ].map((cat, i) => (
            <Link
              key={i}
              href={`/shop?category=${cat.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="group relative aspect-square rounded-full md:rounded-[2rem] overflow-hidden"
            >
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-white font-display font-bold text-lg md:text-2xl text-center px-4">
                  {cat.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-card border-y border-border mt-24 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-display font-bold text-3xl">Trending Now</h2>
            <Link
              href="/shop?featured=true"
              className="text-primary font-medium hover:underline flex items-center gap-1"
            >
              Explore All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingFeatured ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-muted aspect-[4/5] rounded-2xl"
                />
              ))}
            </div>
          ) : featured.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              No trending products right now.
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-4xl mb-4">
            New Arrivals
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover the latest additions to our collection.
          </p>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-muted aspect-[4/5] rounded-2xl"
              />
            ))}
          </div>
        ) : newArrivals.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            No new arrivals to show.
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-8 py-4 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            View Entire Collection
          </Link>
        </div>
      </section>
    </div>
  );
}
