# AnpaMart E-Commerce Platform

## Overview
Frontend-only React e-commerce platform that connects to an external Express + Prisma backend at `/api/v1`. Built with TypeScript, Tailwind CSS, Shadcn UI, Zustand, React Query, and Framer Motion.

## Architecture
- **Frontend only** — No local backend/server directory. Vite serves the client via `start.js`.
- **External API** — All data is fetched from the user's local Express+Prisma backend via `/api/v1`.
- **API Client** — `client/src/api/client.ts` handles all HTTP calls with auto Bearer token injection. Base URL configurable via `VITE_API_URL` env var.
- **Data Mapping** — `client/src/api/mappers.ts` transforms Prisma entities into UI-friendly types.
- **State** — Zustand for cart/wishlist (`use-cart.ts`) and auth (`use-auth.ts`), React Query for server data.
- **Auth** — JWT Bearer token auth. Login via `/api/v1/auth/login`. Token stored in localStorage via Zustand persist. Admin routes require ADMIN role.

## Key Directories
```
client/src/
├── api/              # API client, types, mappers (connects to external backend)
├── components/
│   ├── admin/        # AdminLayout sidebar, AdminGuard (auth protection)
│   ├── cart/         # CartDrawer
│   ├── layout/       # Header, Footer (storefront)
│   ├── product/      # ProductCard
│   └── ui/           # Shadcn components
├── hooks/
│   ├── use-shop.ts   # Storefront data hooks (products, categories)
│   ├── use-admin.ts  # Admin CRUD hooks (products, categories, inventory, banners)
│   └── use-user.ts   # User dashboard hooks (profile, orders, addresses, wishlist, notifications)
├── pages/
│   ├── account/      # User dashboard: Overview, Profile, Orders, Wishlist, Addresses, Payments, Returns, Notifications
│   ├── admin/        # Login, Dashboard, Products, Categories, Inventory, Banners
│   ├── Home.tsx      # Storefront homepage
│   ├── Shop.tsx      # Product listing with filters
│   └── ProductDetail.tsx
├── store/
│   ├── use-cart.ts   # Cart & wishlist state
│   └── use-auth.ts   # Auth state (user, tokens)
└── lib/              # Utils, queryClient
```

## Routes
### Storefront (public)
- `/` — Homepage
- `/shop` — Product listing with filters (breadcrumbs, collapsible sidebar, filter chips)
- `/category/:slug` — Category feed page (Men/Women landing with subcategories, trending, new arrivals, feed sections)
- `/product/:slug` — Product detail page

### Navigation
- Navbar: New Arrivals, Trending, Women, Men, Kids, Accessories, Beauty, Sale
- **Mega Menu**: Hover on Men/Women shows dropdown with subcategories + sub-subcategories; clicking subcategory → `/shop?category=slug`
- **Category Feed**: Clicking Men/Women → `/category/men` or `/category/women` (rich landing page)
- **Mobile**: Slide-out drawer with expand/collapse for category hierarchy

### Checkout (protected, requires login)
- `/checkout` — Full checkout page with shipping/billing address, pincode API (India), order summary, payment method selection, place order

### Admin Order Management
- `/admin/orders` — Full order management: search (name/email/order ID), status filter, date range, sorting, pagination, expandable rows, slide-out detail panel with status/payment updates, cancel order, internal notes

### User Dashboard (protected, requires login)
- `/account` — Dashboard overview (stats, recent orders, quick links)
- `/account/profile` — Edit name, phone, change password
- `/account/orders` — Order history with pagination, detail modal, tracking, return requests
- `/account/wishlist` — Saved products with move-to-cart
- `/account/addresses` — CRUD address book with set-default
- `/account/payments` — View/delete saved payment cards
- `/account/returns` — Returns & refunds tracking
- `/account/notifications` — Notification feed with mark-read

### Admin (protected, requires ADMIN role)
- `/admin/login` — Admin login page (public)
- `/admin` — Dashboard with stats
- `/admin/products` — Product management (CRUD)
- `/admin/categories` — Category management (CRUD)
- `/admin/inventory` — Inventory/stock management
- `/admin/banners` — Hero banner management (CRUD)
- `/admin/feed-sections` — Category feed section management (CRUD per category slug)

## Auth Flow
1. Users navigate to `/account/*` → redirected to `/signin` if not logged in (UserGuard)
2. Admin navigates to `/admin` → redirected to `/admin/login` if not authenticated
2. Logs in with email/password → `POST /api/v1/auth/login`
3. Backend returns `{ user, accessToken, refreshToken }` → stored in Zustand (localStorage)
4. All subsequent API calls include `Authorization: Bearer <accessToken>` header
5. If backend returns 401, user is automatically logged out
6. AdminGuard checks `isAuthenticated()` && `isAdmin()` before rendering protected pages

## API Contract (External Backend)
### Public
- `GET /api/v1/products` — List products (query: category, featured, status)
- `GET /api/v1/products/:slug` — Single product with variants & richContent
- `GET /api/v1/categories` — List categories with children
- `GET /api/v1/content/hero-banners` — Active hero banners for storefront

### Auth
- `POST /api/v1/auth/register` — Create user
- `POST /api/v1/auth/login` — Sign in (returns user + tokens)

### Admin (Bearer + ADMIN role)
- `POST /api/v1/products` — Create product
- `PUT /api/v1/products/:id` — Update product
- `DELETE /api/v1/products/:id` — Delete product
- `POST /api/v1/categories` — Create category
- `PUT /api/v1/categories/:id` — Update category
- `DELETE /api/v1/categories/:id` — Delete category
- `GET /api/v1/admin/dashboard/stats` — Dashboard stats
- `GET /api/v1/admin/inventory` — List inventory
- `PATCH /api/v1/admin/inventory/:variantId` — Update stock
- `GET/POST /api/v1/admin/hero-banners` — List/create banners
- `PATCH/DELETE /api/v1/admin/hero-banners/:id` — Update/delete banner

Response shape: `{ success: boolean, data?: T, count?: number, message?: string }`

## Backend Entity Types
- Products use Prisma Decimal for `basePrice`, have `variants` array with inventory, and `richContent` with `media_gallery`
- Categories support parent/child hierarchy via `parentId`
- Product/Category IDs are strings (UUIDs from Prisma)
- User roles: CUSTOMER, ADMIN

## Styling
- Font: DM Sans (body), Outfit (headings)
- Theme: Premium retail palette with coral accent
- CSS: Tailwind with Shadcn theming variables in `index.css`

## Running
- Workflow: `node start.js` (Vite dev server on port 5000 with allowedHosts: true)
- No local database or server — purely frontend
