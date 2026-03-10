import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format price in Indian Rupees (backend stores INR). */
export function formatPrice(rupees: number | string | undefined | null) {
  if (rupees === undefined || rupees === null) return "₹0.00";
  const n = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(n)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

const MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE_URL || "";

/**
 * Resolve media path to full URL for display.
 * If value is already an absolute URL (http/https), returns as-is.
 * Otherwise prepends VITE_MEDIA_BASE_URL for B2/CDN.
 */
export function getMediaUrl(pathOrUrl: string | undefined | null): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  if (!MEDIA_BASE) return pathOrUrl;
  const base = MEDIA_BASE.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}
