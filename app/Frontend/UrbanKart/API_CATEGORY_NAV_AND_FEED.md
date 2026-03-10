# Category Navigation & Dynamic Feed – Backend API

This document describes the backend support for **mega menu**, **category feed pages**, **carousel/banner media**, and **dynamic product filtering**. All endpoints are implemented and ready for frontend integration.

---

## 1. Structured Category Data (Mega Menu)

### GET `/api/v1/categories/menu`

Returns a hierarchical tree suitable for mega dropdowns (Men / Women with subcategories and sub-subcategories).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Men",
      "slug": "men",
      "sortOrder": 0,
      "subcategories": [
        {
          "id": "uuid",
          "name": "Clothing",
          "slug": "clothing",
          "sortOrder": 0,
          "sub_subcategories": [
            { "id": "uuid", "name": "T-Shirts", "slug": "t-shirts" },
            { "id": "uuid", "name": "Shirts", "slug": "shirts" }
          ]
        }
      ]
    }
  ]
}
```

- **Cache:** `Cache-Control: public, max-age=300`
- Only **active** categories are included; order by `sortOrder` then tree depth.

---

## 2. Category Feed Page (Men / Women Landing)

### GET `/api/v1/content/category-feed/:categorySlug`

Returns dynamic sections for a category landing page (e.g. `men`, `women`). Each section has a type, title, optional image/banner, and optional items (products or brands).

**Example:** `GET /api/v1/content/category-feed/men`

**Response (200):**
```json
{
  "success": true,
  "category": "men",
  "sections": [
    {
      "type": "carousel",
      "title": "Trending Now",
      "image": "https://cdn.example.com/banner1.jpg",
      "mobile_image": "https://cdn.example.com/banner1-mobile.jpg",
      "redirect_url": "/men/clothing",
      "displayOrder": 0,
      "items": [
        { "id": "prod-uuid", "name": "Product A", "image": "...", "price": 1999, "slug": "product-a" }
      ]
    },
    {
      "type": "brand_slider",
      "title": "Top Brands",
      "items": [
        { "brand_id": "nike", "name": "Nike", "logo": "https://..." }
      ]
    }
  ]
}
```

**Section types:** `carousel` | `product_grid` | `brand_slider` | `banner` | `product_slider`

- **Cache:** `Cache-Control: public, max-age=120`

**Admin (configure sections):**
- `GET /api/v1/admin/category-feed-sections?categorySlug=men`
- `POST /api/v1/admin/category-feed-sections` — body: `{ categorySlug, type, title, image?, mobile_image?, redirect_url?, displayOrder?, isActive?, items? }`
- `PATCH /api/v1/admin/category-feed-sections/:id`
- `DELETE /api/v1/admin/category-feed-sections/:id`

---

## 3. Hero Banners & Carousel Media

### GET `/api/v1/content/hero-banners`

Returns active hero banners with optional mobile image, redirect URL, priority, and validity window.

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "mongoId",
      "title": "Summer Sale",
      "subtitle": "Up to 50% off",
      "image": "https://cdn.example.com/hero-desktop.jpg",
      "mobile_image": "https://cdn.example.com/hero-mobile.jpg",
      "redirect_url": "/men/clothing",
      "color": "text-white",
      "priority": 1
    }
  ]
}
```

- Banners with `validFrom` / `validTo` are only returned when current time is within that range.
- Sorted by `priority` (desc), then `sortOrder` (asc).

**Admin:** Create/update hero banners with optional `mobile_image`, `redirect_url`, `priority`, `validFrom` (ISO date), `validTo` (ISO date) via existing `/api/v1/admin/hero-banners` endpoints.

---

## 4. Dynamic Product Filtering (Query Parameters)

### GET `/api/v1/products`

Supports multi-filter combination, pagination, and sort.

| Query Param       | Type   | Description |
|-------------------|--------|-------------|
| `category`        | string | Top-level category slug (e.g. `men`, `women`) |
| `subcategory`     | string | Subcategory slug (e.g. `clothing`) |
| `sub_subcategory`| string | Sub-subcategory slug (e.g. `t-shirts`) — takes precedence over `subcategory` |
| `brand`           | string | Product brand (exact match; requires `brand` on Product) |
| `price_min`       | number | Min base price |
| `price_max`       | number | Max base price |
| `size`            | string | Variant option `size` (e.g. `M`, `L`) |
| `color`           | string | Variant option `color` (e.g. `Red`) |
| `sort`            | string | `newest` \| `price_asc` \| `price_low` \| `price_desc` \| `price_high` |
| `page`            | number | Page number (default 1) |
| `limit`            | number | Items per page (default 20, max 100) |
| `featured`        | boolean| Filter featured products |
| `status`          | string | Usually `published` (default) |

**Category resolution:** If `sub_subcategory` is set, it is used as the category slug; else `subcategory`; else `category`. Products are returned for that category **and all its descendants** (so e.g. `category=men` includes products in Men > Clothing > T-Shirts).

**Response (200):**
```json
{
  "success": true,
  "count": 20,
  "total": 45,
  "page": 1,
  "limit": 20,
  "data": [ /* product objects with category ref */ ]
}
```

- **Cache:** `Cache-Control: public, max-age=60`

**Example:**  
`/products?category=men&subcategory=clothing&type=t-shirts&brand=nike&sort=price_low&page=1&limit=20`  
Note: `type` is not a separate backend param; use `sub_subcategory=t-shirts` for sub-subcategory.

---

## 5. Database / Schema Notes

- **Product.brand:** Optional field added on `Product` (Prisma). Run migration:  
  `npx prisma migrate dev --name add_product_brand`
- **Category feed sections:** Stored in MongoDB collection `category_feed_sections`.
- **Hero banners:** MongoDB `hero_banners`; new fields: `mobile_image`, `redirect_url`, `priority`, `validFrom`, `validTo` (optional).

---

## 6. Performance & Caching

- **Categories menu:** 5 min cache.
- **Category feed:** 2 min cache.
- **Hero banners:** 1 min cache.
- **Products list:** 1 min cache.

Ensure DB indexes: `Category.slug`, `Product.categoryId`, `Product.brand`, `Product.basePrice`, and variant `options` (JSON) if your DB supports it for efficient filtering.

---

## Summary Checklist for Frontend

- [x] **Hierarchical category data** — `GET /api/v1/categories/menu` (subcategories + sub_subcategories).
- [x] **Category feed API** — `GET /api/v1/content/category-feed/:categorySlug` (sections with type, title, image, items).
- [x] **Banner/carousel media** — Hero banners include `mobile_image`, `redirect_url`, `priority`, validity.
- [x] **Query-based filtering** — `category`, `subcategory`, `sub_subcategory`, `brand`, `price_min`, `price_max`, `size`, `color`, `sort`, `page`, `limit`.
