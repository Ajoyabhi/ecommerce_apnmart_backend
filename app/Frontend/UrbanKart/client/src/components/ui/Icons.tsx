import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_STAR_SIZE = "w-5 h-5";

export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  const sizeClass = className?.match(/\bw-\d+\s+h-\d+\b/)?.[0] ?? DEFAULT_STAR_SIZE;
  const wrapperClass = className?.replace(/\bw-\d+\s+h-\d+\b/g, "").trim();

  return (
    <div className={cn("flex items-center gap-0.5 shrink-0", wrapperClass)} aria-label={`Rating: ${rating} out of 5`}>
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className={cn(sizeClass, "fill-amber-400 text-amber-400 shrink-0")} strokeWidth={1.5} />
      ))}
      {hasHalfStar && <StarHalf className={cn(sizeClass, "fill-amber-400 text-amber-400 shrink-0")} strokeWidth={1.5} />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className={cn(sizeClass, "text-amber-200 dark:text-amber-900/50 shrink-0")} strokeWidth={1.5} />
      ))}
    </div>
  );
}
