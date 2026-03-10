import { fetchApi } from "./client";
import type { ApiResponse, HeroBanner } from "./types";

export async function getHeroBanners(): Promise<HeroBanner[]> {
  const res = await fetchApi<HeroBanner[]>("/content/hero-banners");
  if (!res.success || !res.data) return [];
  return res.data;
}

