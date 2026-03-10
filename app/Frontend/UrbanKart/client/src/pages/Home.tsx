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

const API_BASE = import.meta.env.VITE_API_URL || "";

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

  // Curated collections powered by seeded categories
  const { data: menFashionData } = useProducts({
    category: "fashion-men",
    status: "published",
    limit: 8,
  });
  const menFashion = menFashionData?.list ?? [];

  const { data: womenDressesData } = useProducts({
    category: "fashion-women-dresses",
    status: "published",
    limit: 8,
  });
  const womenDresses = womenDressesData?.list ?? [];

  const { data: beautyPicksData } = useProducts({
    // Use the root beauty category so we always get a good mix
    // of lipsticks, foundations and other makeup products.
    category: "beauty",
    status: "published",
    limit: 8,
  });
  const beautyPicks = beautyPicksData?.list ?? [];

  // Kids / teens fashion (boys & girls)
  const { data: boysFashionData } = useProducts({
    category: "fashion-boys",
    status: "published",
    limit: 8,
  });
  const { data: girlsFashionData } = useProducts({
    category: "fashion-girls",
    status: "published",
    limit: 8,
  });
  const kidsFashion = [
    ...(boysFashionData?.list ?? []),
    ...(girlsFashionData?.list ?? []),
  ].slice(0, 8);

  // Home decor (candles, lights, vases, florals, pebbles)
  const { data: homeDecorData } = useProducts({
    category: "home-decor",
    status: "published",
    limit: 8,
  });
  const homeDecor = homeDecorData?.list ?? [];

  // Footwear (men & women) – query dedicated footwear categories
  const { data: menFootwearData } = useProducts({
    category: "fashion-men-footwear",
    status: "published",
    limit: 8,
  });
  const { data: womenFootwearData } = useProducts({
    category: "fashion-women-footwear",
    status: "published",
    limit: 8,
  });
  const footwear = [
    ...(menFootwearData?.list ?? []),
    ...(womenFootwearData?.list ?? []),
  ].slice(0, 8);

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
        <h2 className="font-display font-bold text-3xl mb-10 text-center">
          Shop by Category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[
            {
              name: "Men's Fashion",
              icon: "11-men-clothing.png",
              href: "/shop?category=fashion-men",
            },
            {
              name: "Women's Fashion",
              icon: "12-women-clothing.png",
              href: "/shop?category=fashion-women",
            },
            {
              name: "Beauty & Makeup",
              icon: "26-makeup.png",
              href: "/shop?category=beauty",
            },
            {
              name: "Home Decor",
              icon: "09-home-decor.png",
              href: "/shop?category=home-decor",
            },
          ].map((cat, i) => (
            <Link
              key={i}
              href={cat.href}
              className="group relative aspect-square rounded-full md:rounded-[2rem] overflow-hidden"
            >
              <div className="w-full h-full bg-card flex flex-col items-center justify-center gap-3 group-hover:bg-primary/5 transition-colors duration-300">
                <img
                  src={`${API_BASE}/static/ecommerce-icons/${cat.icon}`}
                  alt={cat.name}
                  className="w-16 h-16 md:w-20 md:h-20 object-contain"
                />
                <h3 className="text-sm md:text-base font-medium text-center px-4">
                  {cat.name}
                </h3>
              </div>
            </Link>
          ))}
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

      {/* Rich curated collections */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 space-y-20">
        {/* Men's fashion */}
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display font-bold text-3xl">
                Men&apos;s Fashion
              </h2>
              <p className="text-muted-foreground mt-2">
                Solid tees, shirts and everyday pieces from the men&apos;s collection.
              </p>
            </div>
            <Link
              href="/shop?category=fashion-men-casual_shirts"
              className="text-primary font-medium hover:underline flex items-center gap-1"
            >
              Shop Men&apos;s Collection <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {menFashion.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {menFashion.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Men&apos;s casual products will appear here once seeded.
            </div>
          )}
        </div>

        {/* Women's fashion */}
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display font-bold text-3xl">
                Women&apos;s Fashion
              </h2>
              <p className="text-muted-foreground mt-2">
                Dresses, occasionwear and statement looks from the women&apos;s collection.
              </p>
            </div>
            <Link
              href="/shop?category=fashion-women-dresses"
              className="text-primary font-medium hover:underline flex items-center gap-1"
            >
              Shop Women&apos;s Collection <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {womenDresses.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {womenDresses.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Women&apos;s dress products will appear here once seeded.
            </div>
          )}
        </div>

        {/* Boys & Girls fashion */}
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display font-bold text-3xl">
                Boys &amp; Girls Fashion
              </h2>
              <p className="text-muted-foreground mt-2">
                Playful, everyday looks for boys and girls.
              </p>
            </div>
            <Link
              href="/shop?category=fashion-boys"
              className="text-primary font-medium hover:underline flex items-center gap-1"
            >
              Shop Kids Fashion <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {kidsFashion.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {kidsFashion.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Kids&apos; fashion products will appear here once seeded.
            </div>
          )}
        </div>

        {/* Beauty & makeup */}
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display font-bold text-3xl">
                Beauty &amp; Makeup
              </h2>
              <p className="text-muted-foreground mt-2">
                Lipsticks, foundations and more from the beauty collection.
              </p>
            </div>
            <Link
              href="/shop?category=beauty-lipstick"
              className="text-primary font-medium hover:underline flex items-center gap-1"
            >
              Shop Beauty <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {beautyPicks.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {beautyPicks.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Beauty products will appear here once seeded.
            </div>
          )}
        </div>

        {/* Footwear */}
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display font-bold text-3xl">
                Footwear
              </h2>
              <p className="text-muted-foreground mt-2">
                Sneakers, shoes and sandals to complete your look.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/shop?category=fashion-men-footwear"
                className="text-primary font-medium hover:underline flex items-center gap-1"
              >
                Shop Men&apos;s Footwear <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop?category=fashion-women-footwear"
                className="text-primary font-medium hover:underline flex items-center gap-1"
              >
                Shop Women&apos;s Footwear <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {footwear.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {footwear.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Footwear products will appear here once seeded.
            </div>
          )}
        </div>

        {/* Home decor */}
        <div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-display font-bold text-3xl">
                Home Decor
              </h2>
              <p className="text-muted-foreground mt-2">
                Candles, lights, vases, florals and decorative pebbles for cosy corners.
              </p>
            </div>
            <Link
              href="/shop?category=home-decor"
              className="text-primary font-medium hover:underline flex items-center gap-1"
            >
              Shop Home Decor <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {homeDecor.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {homeDecor.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Home decor products will appear here once seeded.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
