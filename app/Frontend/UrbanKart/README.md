# E-commerce Backend API

Express backend for the e-commerce app. This README documents all API endpoints for **frontend integration**.

---

## Base URL & config

- **Base path:** `/api/v1`
- **Example:** `http://localhost:5009/api/v1/...`
- **Content-Type:** `application/json`
- **Credentials:** Use `credentials: "include"` (cookies) and send **Bearer token** for protected routes (see [Auth](#auth)).

### Frontend env

```env
VITE_API_URL=http://localhost:5009
```

Backend must allow your frontend origin in `CORS_ORIGIN` (comma-separated), e.g. `http://localhost:5173`.

---

## Common response shape

- **Success:** `{ success: true, data?: T, count?: number, message?: string }`
- **Error:** `{ success: false, message: string, errors?: array }` (validation: `errors` array)
- **Status:** `200`/`201` success, `400` validation, `401` unauthorized, `403` forbidden, `404` not found, `500` server error

---

## Auth

Protected routes require:

```http
Authorization: Bearer <accessToken>
```

After **login** or **register**, the response includes `data.accessToken`. Store it (e.g. localStorage) and send it on every request to protected endpoints.

---

## Endpoints

### Health

| Method | Path        | Auth | Description   |
|--------|-------------|------|---------------|
| GET    | `/health`   | No   | Health check  |

**Response:** `{ status: "OK", timestamp: string }`

---

### Auth — `/api/v1/auth`

| Method | Path        | Auth | Description   |
|--------|-------------|------|---------------|
| POST   | `/register` | No   | Create user   |
| POST   | `/login`    | No   | Sign in       |

#### POST `/api/v1/auth/register`

**Body:**

```json
{
  "email": "user@example.com",
  "password": "min6chars",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "CUSTOMER"
    },
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

**Errors:** `400` — User already exists / validation (`errors` array).

---

#### POST `/api/v1/auth/login`

**Body:**

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):** Same shape as register (`user`, `accessToken`, `refreshToken`).

**Errors:** `401` — Invalid credentials.

---

### Categories — `/api/v1/categories`

| Method | Path     | Auth  | Description      |
|--------|----------|-------|------------------|
| GET    | `/`      | No    | List categories  |
| POST   | `/`      | Admin | Create category  |
| PUT    | `/:id`   | Admin | Update category  |
| DELETE | `/:id`   | Admin | Delete category  |

#### GET `/api/v1/categories`

**Response (200):**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "uuid",
      "name": "Women",
      "slug": "women",
      "description": null,
      "imageUrl": null,
      "parentId": null,
      "sortOrder": 0,
      "isActive": true,
      "children": []
    }
  ]
}
```

#### POST `/api/v1/categories` (Admin)

**Body:**

```json
{
  "name": "Women",
  "slug": "women",
  "description": "Optional",
  "imageUrl": "https://...",
  "parentId": null,
  "sortOrder": 0,
  "isActive": true
}
```

**Response (201):** `{ success: true, data: category }`

---

### Products — `/api/v1/products`

| Method | Path      | Auth  | Description     |
|--------|-----------|-------|-----------------|
| GET    | `/`       | No    | List products   |
| GET    | `/:slug`  | No    | Product by slug |
| POST   | `/`       | Admin | Create product  |

#### GET `/api/v1/products`

**Query:**

- `category` (string) — Category slug
- `featured` (boolean) — `true` for featured
- `status` (string) — Default `published`; optional `draft` / `archived`

**Example:** `GET /api/v1/products?category=women&featured=true`

**Response (200):**

```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "uuid",
      "sku": "SKU-001",
      "name": "Product Name",
      "slug": "product-name",
      "basePrice": 29.99,
      "categoryId": "uuid",
      "category": { "name": "Women", "slug": "women" },
      "status": "published",
      "isFeatured": true,
      "variants": []
    }
  ]
}
```

#### GET `/api/v1/products/:slug`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "SKU-001",
    "name": "Product Name",
    "slug": "product-name",
    "basePrice": 29.99,
    "categoryId": "uuid",
    "category": { ... },
    "status": "published",
    "isFeatured": true,
    "variants": [
      {
        "id": "uuid",
        "productId": "uuid",
        "sku": "SKU-001-RED-M",
        "name": "Red / M",
        "options": { "color": "Red", "size": "M" },
        "priceAdjustment": 0,
        "inventory": { "quantity": 10, ... }
      }
    ],
    "richContent": {
      "pg_id": "uuid",
      "description_html": "<p>...</p>",
      "media_gallery": [],
      ...
    }
  }
}
```

**Errors:** `404` — Product not found.

#### POST `/api/v1/products` (Admin)

**Body:**

```json
{
  "sku": "SKU-001",
  "name": "Product Name",
  "slug": "product-name",
  "basePrice": 29.99,
  "categoryId": "uuid",
  "status": "draft",
  "isFeatured": false,
  "descriptionHtml": "<p>...</p>",
  "lifestyleTags": ["summer"],
  "attributes": {},
  "mediaGallery": []
}
```

**Response (201):** `{ success: true, data: product }`

---

### Cart — `/api/v1/cart` (all routes require **Bearer** auth)

| Method | Path           | Auth | Description     |
|--------|----------------|------|-----------------|
| GET    | `/`            | Yes  | Get cart        |
| POST   | `/items`       | Yes  | Add to cart     |
| DELETE | `/items/:sku`  | Yes  | Remove from cart|

#### GET `/api/v1/cart`

**Response (200):**

```json
{
  "success": true,
  "data": [
    { "sku": "SKU-001-RED-M", "quantity": 2 },
    { "sku": "SKU-002-BLUE-L", "quantity": 1 }
  ]
}
```

#### POST `/api/v1/cart/items`

**Body:**

```json
{
  "sku": "SKU-001-RED-M",
  "quantity": 2
}
```

**Response (200):** `{ success: true, message: "Item added to cart" }`

#### DELETE `/api/v1/cart/items/:sku`

**Response (200):** `{ success: true, message: "Item removed from cart" }`

---

### Payments — `/api/v1/payments`

| Method | Path        | Auth | Description           |
|--------|-------------|------|------------------------|
| POST   | `/checkout` | Yes  | Create Stripe session  |
| POST   | `/webhook`  | No* | Stripe webhook         |

\*Webhook is called by Stripe (signature verification); frontend does not call it.

#### POST `/api/v1/payments/checkout`

**Headers:** `Authorization: Bearer <accessToken>`

**Body:** none (cart from Redis for current user).

**Response (200):**

```json
{
  "success": true,
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_..."
}
```

Redirect the user to `url` for payment. Success/cancel URLs are configured on the server (`CUSTOMER_FRONTEND_URL`).

**Errors:** `400` — Cart is empty / insufficient stock.

---

### Content (public) — `/api/v1/content`

| Method | Path             | Auth | Description        |
|--------|------------------|------|--------------------|
| GET    | `/hero-banners`  | No   | Homepage hero slides |

#### GET `/api/v1/content/hero-banners`

Returns only **active** banners, sorted by `sortOrder` then `createdAt`.

**Response (200):**

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "mongoId",
      "title": "Winter Essentials '25",
      "subtitle": "Cozy styles for the cold season",
      "image": "https://...jpg",
      "color": "text-white"
    }
  ]
}
```

- `image` can be an image URL (jpg, png, etc.) or a **video** URL (e.g. `.mp4`). Frontend can detect video by extension or path and render `<video>` with `autoPlay muted loop playsInline`.

---

### Admin — `/api/v1/admin` (all routes require **Bearer** + role **ADMIN**)

| Method | Path                    | Description            |
|--------|-------------------------|------------------------|
| GET    | `/inventory`            | List inventory         |
| PATCH  | `/inventory/:variantId` | Update stock           |
| GET    | `/dashboard/stats`      | Dashboard stats        |
| GET    | `/hero-banners`         | List all hero banners  |
| POST   | `/hero-banners`         | Create hero banner     |
| PATCH  | `/hero-banners/:id`     | Update hero banner     |
| DELETE | `/hero-banners/:id`     | Delete hero banner     |

#### GET `/api/v1/admin/hero-banners`

**Response (200):** Same shape as content hero-banners, but includes **all** banners and extra fields: `isActive`, `sortOrder`.

#### POST `/api/v1/admin/hero-banners`

**Body:**

```json
{
  "title": "Summer Sale",
  "subtitle": "Up to 50% off",
  "image": "https://...jpg",
  "color": "text-white",
  "isActive": true,
  "sortOrder": 0
}
```

**Response (201):** `{ success: true, data: { id, title, subtitle, image, color, isActive, sortOrder } }`

#### PATCH `/api/v1/admin/hero-banners/:id`

**Body:** Any subset of `title`, `subtitle`, `image`, `color`, `isActive`, `sortOrder`.

**Response (200):** `{ success: true, data: banner }`

**Errors:** `404` — Banner not found.

#### DELETE `/api/v1/admin/hero-banners/:id`

**Response (200):** `{ success: true, message: "Hero banner deleted" }`

**Errors:** `404` — Banner not found.

#### GET `/api/v1/admin/inventory`

**Response (200):** `{ success: true, count: n, data: [ { variantId, variant: { product }, quantity, ... } ] }`

#### PATCH `/api/v1/admin/inventory/:variantId`

**Body:** `{ "quantity": 25 }`

**Response (200):** `{ success: true, data: inventory }`

#### GET `/api/v1/admin/dashboard/stats`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "totalOrders": 100,
    "totalRevenue": 15000,
    "lowStockCount": 3
  }
}
```

---

## Summary for frontend

1. **Base URL:** `VITE_API_URL` + `/api/v1` (e.g. `http://localhost:5009/api/v1`).
2. **Auth:** Send `Authorization: Bearer <accessToken>` for cart, checkout, and all `/admin` routes. Store `accessToken` from login/register.
3. **CORS:** Backend must list frontend origin in `CORS_ORIGIN`; use `credentials: "include"` if sending cookies.
4. **Content:** Use `GET /content/hero-banners` for the homepage carousel; support both image and video URLs in `image`.
5. **Errors:** Check `success`, `message`, and optionally `errors` (validation); use HTTP status for 401/403/404.
