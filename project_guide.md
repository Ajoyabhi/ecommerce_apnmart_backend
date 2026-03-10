# Lifestyle E-Commerce Platform (MVP)

A modern, full-stack e-commerce application built for lifestyle products. Features a monolithic architecture with Node.js/Express backend, React frontend, and hybrid database design (PostgreSQL + MongoDB).

**Status:** MVP (Minimum Viable Product)  
**Version:** 1.0.0

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [API Documentation](#api-documentation)
- [Admin Panel Guide](#admin-panel-guide)
- [Development Guidelines](#development-guidelines)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

## 🎯 Overview

This platform specializes in curated lifestyle products including:
- Home decor & furniture
- Fashion accessories
- Wellness & personal care
- Sustainable living products
- Artisan crafts

### Key Features

**Customer Features:**
- Browse products by categories
- Advanced product search with filters
- Shopping cart with persistent sessions
- Secure checkout with Stripe/PayPal
- Order tracking and history
- User profile management

**Admin Features:**
- **Dashboard:** Sales analytics, order statistics, low stock alerts
- **Category Management:** Create, edit, delete product categories
- **Product Management:** Add/edit products, manage variants, upload images
- **Order Management:** View orders, update status, process refunds
- **Inventory Management:** Track stock levels, manage suppliers
- **User Management:** View customers, manage permissions
- **Content Management:** Manage homepage banners, promotional content

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  React Web  │  │  React Admin│  │                 │ │
│  │  (Customer) │  │   Panel     │  │                 │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────┘ │
└─────────┼────────────────┼──────────────────────────────┘
          │                │
          └────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│              MONOLITHIC APPLICATION                      │
│              (Node.js + Express)                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Product   │  │    Order    │  │     User        │ │
│  │   Module    │  │   Module    │  │    Module       │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Cart      │  │   Payment   │  │   Category      │ │
│  │   Module    │  │   Module    │  │    Module       │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Inventory  │  │   Admin     │  │   Analytics     │ │
│  │   Module    │  │   Module    │  │    Module       │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│                   DATA LAYER                             │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │   PostgreSQL      │      │       MongoDB           │  │
│  │ (Relational Data)│      │  (Documents/Search)       │  │
│  │  - Users          │      │  - Product Details      │  │
│  │  - Orders         │      │  - Reviews              │  │
│  │  - Categories     │      │  - Activity Logs        │  │
│  │  - Products       │      │  - Admin Logs           │  │
│  │  - Inventory      │      │                         │  │
│  └─────────────────┘      └─────────────────────────┘  │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │     Redis       │      │    AWS S3 / Local       │  │
│  │   (Caching)     │      │    (File Storage)         │  │
│  └─────────────────┘      └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20 LTS | Runtime environment |
| Express.js | 4.x | Web framework |
| Prisma ORM | 5.x | Database ORM |
| PostgreSQL | 15 | Primary relational database |
| MongoDB | 6 | Document storage & search |
| Redis | 7 | Caching & session store |
| JWT | - | Authentication |
| Multer | - | File upload handling |
| Winston | - | Logging |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI library |
| Vite | 5 | Build tool |
| Redux Toolkit | 2.x | State management |
| React Query | 5.x | Server state management |
| React Router | 6.x | Routing |
| Tailwind CSS | 3.x | Styling |
| Recharts | - | Analytics charts |
| React Hook Form | - | Form handling |
| Axios | - | HTTP client |

### File Storage
- **Development:** Cloudinary (recommended) or local filesystem (`/uploads` directory)
- **Production:** Cloudinary

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **PostgreSQL** >= 15 ([Download](https://www.postgresql.org/download/))
- **MongoDB** >= 6.0 ([Download](https://www.mongodb.com/try/download/community))
- **Redis** >= 7.0 ([Download](https://redis.io/download))
- **npm** >= 9.0 or **yarn** >= 1.22

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/lifestyle-ecommerce.git
cd lifestyle-ecommerce
```

#### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies (customer)
cd ../frontend
npm install

# Install admin panel dependencies
cd ../admin
npm install
```

#### 3. Database Setup

**PostgreSQL Setup:**
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE lifestyle_db;
CREATE USER lifestyle_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE lifestyle_db TO lifestyle_user;

# Exit
\q
```

**MongoDB Setup:**
```bash
# Start MongoDB service (if not running)
# MongoDB will automatically create the database when you first connect
```

**Redis Setup:**
```bash
# Start Redis server (if not running)
redis-server
```

#### 4. Environment Configuration

Create `.env` file in the `backend` directory:

```env
# ==========================================
# SERVER CONFIGURATION
# ==========================================
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000

# ==========================================
# DATABASE - POSTGRESQL
# ==========================================
DATABASE_URL="postgresql://lifestyle_user:your_password@localhost:5432/lifestyle_db"

# ==========================================
# DATABASE - MONGODB
# ==========================================
MONGODB_URI="mongodb://localhost:27017/lifestyle_content"

# ==========================================
# REDIS
# ==========================================
REDIS_URL="redis://localhost:6379"

# ==========================================
# JWT AUTHENTICATION
# ==========================================
JWT_ACCESS_SECRET=your_super_secret_access_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_in_production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ==========================================
# PAYMENT - STRIPE
# ==========================================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# ==========================================
# FILE STORAGE
# ==========================================
# For MVP: Use local storage
UPLOAD_METHOD=local
LOCAL_UPLOAD_PATH=./uploads

# For Production: Use Cloudinary (uncomment when ready)
# UPLOAD_METHOD=cloudinary
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret

# ==========================================
# EMAIL SERVICE
# ==========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@lifestylestore.com
FROM_NAME=Lifestyle Store

# ==========================================
# FRONTEND URLS
# ==========================================
CUSTOMER_FRONTEND_URL=http://localhost:5173
ADMIN_FRONTEND_URL=http://localhost:5174
```

Create `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_publishable_key
```

Create `.env` file in the `admin` directory:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

#### 5. Database Migration & Seeding

```bash
cd backend

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed database with initial data (admin user, default categories)
npm run seed
```

**Default Admin Credentials (created by seed):**
- Email: `admin@lifestyle.com`
- Password: `admin123`

> ⚠️ **Important:** Change the default admin password immediately after first login!

#### 6. Start Development Servers

You need to run three terminals simultaneously:

**Terminal 1 - Backend API:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Customer Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Admin Panel:**
```bash
cd admin
npm run dev
```

**Access Points:**
- Customer Store: http://localhost:5173
- Admin Panel: http://localhost:5174
- API Endpoint: http://localhost:5000

## 📁 Project Structure

### Backend (`/backend`)
```
backend/
├── src/
│   ├── config/                 # Configuration
│   │   ├── database.js         # PostgreSQL & MongoDB setup
│   │   ├── redis.js            # Redis client
│   │   ├── upload.js           # File upload config
│   │   └── env.js              # Environment validation
│   │
│   ├── modules/                # Feature modules
│   │   ├── auth/               # Authentication
│   │   ├── users/              # User management
│   │   ├── categories/         # Category management ⭐
│   │   ├── products/           # Product management ⭐
│   │   ├── orders/             # Order processing
│   │   ├── cart/               # Shopping cart
│   │   ├── payments/           # Payment handling
│   │   ├── inventory/          # Stock management
│   │   ├── admin/              # Admin specific APIs ⭐
│   │   └── analytics/          # Dashboard statistics ⭐
│   │
│   ├── shared/
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── utils/              # Helpers, formatters
│   │   └── services/           # Email, SMS, file storage
│   │
│   ├── jobs/                   # Background jobs
│   ├── uploads/                # Local file storage (MVP)
│   ├── app.js                  # Express setup
│   └── server.js               # Entry point
│
├── prisma/
│   └── schema.prisma           # Database schema
└── package.json
```

### Customer Frontend (`/frontend`)
```
frontend/
├── src/
│   ├── components/             # Reusable UI components
│   ├── pages/                  # Route pages
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API integration
│   └── store/                  # Redux store
└── package.json
```

### Admin Panel (`/admin`) ⭐
```
admin/
├── src/
│   ├── components/             # Admin UI components
│   │   ├── Layout/             # Sidebar, Header, Navigation
│   │   ├── Dashboard/          # Stats cards, Charts
│   │   ├── Categories/         # Category forms, Tree view
│   │   ├── Products/           # Product forms, Tables
│   │   ├── Orders/             # Order management UI
│   │   └── Common/             # Data tables, Forms, Modals
│   │
│   ├── pages/                  # Admin pages
│   │   ├── Dashboard.jsx       # Overview page
│   │   ├── Categories/
│   │   │   ├── List.jsx        # All categories
│   │   │   ├── Create.jsx      # Add new category
│   │   │   └── Edit.jsx        # Edit category
│   │   ├── Products/
│   │   │   ├── List.jsx        # Product grid
│   │   │   ├── Create.jsx      # Add product
│   │   │   └── Edit.jsx        # Edit product
│   │   ├── Orders/
│   │   └── Settings/
│   │
│   ├── hooks/                  # Admin-specific hooks
│   ├── services/               # Admin API services
│   └── store/                  # Admin state management
└── package.json
```

## 🗄️ Database Design

### PostgreSQL Schema

**Core Tables:**

```sql
-- Users (Customers & Admins)
users (id, email, password, role, profile_data, timestamps)

-- Categories (Hierarchical)
categories (id, name, slug, parent_id, image, description, sort_order, is_active)

-- Products
products (id, sku, name, slug, description, category_id, base_price, 
          status, featured, seo_data, timestamps)

-- Product Variants (Size, Color, etc.)
product_variants (id, product_id, sku, variant_name, options, 
                  price_adjustment, is_active)

-- Inventory
inventory (id, variant_id, quantity, reserved_qty, low_stock_alert)

-- Orders
orders (id, order_number, user_id, status, payment_status, 
        addresses, totals, timestamps)

-- Order Items
order_items (id, order_id, product_id, variant_id, quantity, price)

-- Media (Images)
product_media (id, product_id, url, type, order, is_primary)
```

### Postgres db ER diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS MODULE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │      users       │         │  user_addresses  │                         │
│  ├──────────────────┤         ├──────────────────┤                         │
│  │ PK id (UUID)     │◄────────┤ PK id (UUID)     │                         │
│  │    email         │    1:M  │ FK user_id       │                         │
│  │    password_hash │         │    type          │                         │
│  │    first_name    │         │    street        │                         │
│  │    last_name     │         │    city          │                         │
│  │    phone         │         │    state         │                         │
│  │    role          │         │    postal_code   │                         │
│  │    is_active     │         │    country       │                         │
│  │    created_at    │         │    is_default    │                         │
│  └──────────────────┘         └──────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           CATEGORIES MODULE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │    categories    │                                                       │
│  ├──────────────────┤                                                       │
│  │ PK id (UUID)     │                                                       │
│  │    name          │                                                       │
│  │    slug (unique) │                                                       │
│  │    description   │                                                       │
│  │ FK parent_id ───────┐  ← Self-referencing (hierarchical)                 │
│  │    image_url     │  │                                                    │
│  │    is_active     │  │                                                    │
│  │    sort_order    │  │                                                    │
│  │    created_at    │  │                                                    │
│  └──────────────────┘  │                                                    │
│         ▲              │                                                    │
│         └──────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTS MODULE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │     products     │         │ product_variants │                         │
│  ├──────────────────┤         ├──────────────────┤                         │
│  │ PK id (UUID)     │◄────────┤ PK id (UUID)     │                         │
│  │    sku (unique)  │    1:M  │ FK product_id    │                         │
│  │    name          │         │    sku (unique)  │                         │
│  │    slug (unique) │         │    variant_name  │                         │
│  │    description   │         │    options (JSON)│                         │
│  │ FK category_id ──┼────┐    │    price_adj     │                         │
│  │    base_price    │    │    │    is_active     │                         │
│  │    compare_price │    │    └────────┬─────────┘                         │
│  │    cost_price    │    │             │                                   │
│  │    tax_class     │    │             │  ┌──────────────────┐             │
│  │    weight        │    │             └──┤    inventory     │             │
│  │    dimensions    │    │                ├──────────────────┤             │
│  │    is_active     │    │                │ PK id (UUID)     │             │
│  │    is_featured   │    │                │ FK variant_id    │             │
│  │    tags[]        │    │                │    quantity      │             │
│  │ FK created_by    │    │                │    reserved_qty  │             │
│  │    created_at    │    │                │    low_threshold │             │
│  └──────────────────┘    │                │    warehouse_loc │             │
│                          │                └──────────────────┘             │
│                          │                                                 │
│                          │  ┌──────────────────┐                          │
│                          └──┤  product_media   │                          │
│                             ├──────────────────┤                          │
│                             │ PK id (UUID)     │                          │
│                             │ FK product_id    │                          │
│                             │    url           │                          │
│                             │    type          │                          │
│                             │    order         │                          │
│                             │    is_primary    │                          │
│                             └──────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORDERS MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │      orders      │         │   order_items    │                         │
│  ├──────────────────┤         ├──────────────────┤                         │
│  │ PK id (UUID)     │◄────────┤ PK id (UUID)     │                         │
│  │    order_num     │    1:M  │ FK order_id      │                         │
│  │ FK user_id ──────┼────┐    │ FK product_id ───┼────┐                    │
│  │    status        │    │    │ FK variant_id ───┼────┼────┐               │
│  │    payment_stat  │    │    │    product_name  │    │    │               │
│  │    ship_address  │    │    │    variant_name  │    │    │               │
│  │    bill_address  │    │    │    sku           │    │    │               │
│  │    subtotal      │    │    │    quantity      │    │    │               │
│  │    tax_amount    │    │    │    unit_price    │    │    │               │
│  │    ship_amount   │    │    │    total_price   │    │    │               │
│  │    discount      │    │    │    tax_amount    │    │    │               │
│  │    total         │    │    └──────────────────┘    │    │               │
│  │    currency      │    │                            │    │               │
│  │    notes         │    │                            │    │               │
│  └────────┬─────────┘    │                            │    │               │
│           │              │                            │    │               │
│           │              │      ┌──────────────────┐  │    │               │
│           │              │      │    shipments     │  │    │               │
│           │              │      ├──────────────────┤  │    │               │
│           │              │      │ PK id (UUID)     │  │    │               │
│           │              └──────┤ FK order_id      │  │    │               │
│           │                     │    carrier       │  │    │               │
│           │                     │    tracking_num  │  │    │               │
│           │                     │    status        │  │    │               │
│           │                     │    est_delivery  │  │    │               │
│           │                     │    tracking_data │  │    │               │
│           │                     └──────────────────┘  │    │               │
│           │                                           │    │               │
│           │              ┌──────────────────┐         │    │               │
│           └──────────────┤    payments      │         │    │               │
│                          ├──────────────────┤         │    │               │
│                          │ PK id (UUID)     │         │    │               │
│                          │ FK order_id      │         │    │               │
│                          │ FK user_id       │         │    │               │
│                          │    amount        │         │    │               │
│                          │    currency      │         │    │               │
│                          │    method        │         │    │               │
│                          │    transaction_id│         │    │               │
│                          │    status        │         │    │               │
│                          │    gateway_resp  │         │    │               │
│                          └──────────────────┘         │    │               │
│                                                       │    │               │
└───────────────────────────────────────────────────────┼────┼───────────────┘
                                                        │    │
┌───────────────────────────────────────────────────────┼────┼───────────────┐
│                         CART MODULE                  │    │               │
├───────────────────────────────────────────────────────┼────┼───────────────┤
│                                                       │    │               │
│  ┌──────────────────┐         ┌──────────────────┐   │    │               │
│  │      carts       │         │   cart_items     │   │    │               │
│  ├──────────────────┤         ├──────────────────┤   │    │               │
│  │ PK id (UUID)     │◄────────┤ PK id (UUID)     │   │    │               │
│  │ FK user_id ──────┼────┐    │ FK cart_id       │   │    │               │
│  │    session_id    │    │    │ FK product_id ───┼───┘    │               │
│  │    status        │    │    │ FK variant_id ───┼────────┘               │
│  │    created_at    │    │    │    quantity      │                        │
│  └──────────────────┘    │    │    added_at      │                        │
│                          │    └──────────────────┘                        │
│                          │                                                 │
│                          │  ┌──────────────────┐                          │
│                          └──┤    wishlists     │                          │
│                             ├──────────────────┤                          │
│                             │ PK id (UUID)     │                          │
│                             │ FK user_id       │                          │
│                             │ FK product_id    │                          │
│                             └──────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROMOTIONS MODULE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │     coupons      │                                                       │
│  ├──────────────────┤                                                       │
│  │ PK id (UUID)     │                                                       │
│  │    code (unique) │                                                       │
│  │    type          │                                                       │
│  │    value         │                                                       │
│  │    min_purchase  │                                                       │
│  │    max_discount  │                                                       │
│  │    usage_limit   │                                                       │
│  │    usage_count   │                                                       │
│  │    valid_from    │                                                       │
│  │    valid_until   │                                                       │
│  │    is_active     │                                                       │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        REVIEWS MODULE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │     reviews      │                                                       │
│  ├──────────────────┤                                                       │
│  │ PK id (UUID)     │                                                       │
│  │ FK product_id    │                                                       │
│  │ FK user_id       │                                                       │
│  │    rating        │                                                       │
│  │    title         │                                                       │
│  │    is_verified   │                                                       │
│  │    is_approved   │                                                       │
│  │    helpful_count │                                                       │
│  │    created_at    │                                                       │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

```

### MongoDB Collections

```javascript
// Product rich content
products: {
  pg_id,                    // Reference to PostgreSQL
  description_html,         // Rich text content
  specifications,           // Technical details
  lifestyle_tags,           // ["minimalist", "sustainable"]
  media_gallery,            // Additional images/videos
  seo_content,              // Meta tags, structured data
  related_products          // Cross-sell recommendations
}

// Admin activity logs
admin_logs: {
  admin_id,
  action,                   // "created_product", "updated_category"
  entity_type,
  entity_id,
  changes,                  // Diff of changes
  ip_address,
  timestamp
}
```

### Mongodb er diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MONGODB COLLECTIONS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    products (Rich Content)                          │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  {                                                                  │   │
│  │    _id: ObjectId,                                                   │   │
│  │    pg_id: "uuid-from-postgres",  ←── Links to PostgreSQL            │   │
│  │    description_html: "<p>Rich text...</p>",                         │   │
│  │    lifestyle_tags: ["minimalist", "sustainable", "artisan"],        │   │
│  │    attributes: {                                                    │   │
│  │      material: "Full-grain leather",                                │   │
│  │      dimensions: { l: 10, w: 5, h: 2, unit: "cm" },                 │   │
│  │      care_instructions: "Wipe with damp cloth"                      │   │
│  │    },                                                               │   │
│  │    media_gallery: [                                                 │   │
│  │      { type: "image", url: "...", alt: "...", order: 1 },           │   │
│  │      { type: "video", url: "...", thumbnail: "...", duration: 30 }  │   │
│  │    ],                                                               │   │
│  │    seo: {                                                           │   │
│  │      meta_title: "...",                                             │   │
│  │      meta_description: "...",                                       │   │
│  │      structured_data: {...}                                         │   │
│  │    },                                                               │   │
│  │    related_products: ["uuid1", "uuid2"],                            │   │
│  │    cross_sell: ["uuid3"],                                           │   │
│  │    created_at: ISODate                                              │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      reviews (Detailed)                             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  {                                                                  │   │
│  │    _id: ObjectId,                                                   │   │
│  │    pg_id: "uuid-from-postgres",                                     │   │
│  │    product_id: "uuid",                                              │   │
│  │    user: {                                                          │   │
│  │      id: "uuid",                                                    │   │
│  │      name: "Sarah Johnson",                                         │   │
│  │      avatar: "https://...",                                         │   │
│  │      verified_purchaser: true                                       │   │
│  │    },                                                               │   │
│  │    rating: 5,                                                       │   │
│  │    title: "Exceeded expectations!",                                 │   │
│  │    content: "The quality is incredible...",                         │   │
│  │    images: [                                                        │   │
│  │      { url: "...", caption: "Perfect fit!" }                        │   │
│  │    ],                                                               │   │
│  │    attribute_ratings: {                                             │   │   
│  │      quality: 5, value: 4, shipping: 5                              │   │
│  │    },                                                               │   │
│  │    likes: 24,                                                       │   │
│  │    replies: [                                                       │   │
│  │      { user_id: "vendor-uuid", content: "Thank you!", ... }         │   │
│  │    ],                                                               │   │
│  │    created_at: ISODate                                              │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    search_index (Denormalized)                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  {                                                                  │   │
│  │    _id: ObjectId,                                                   │   │
│  │    product_id: "uuid",                                              │   │
│  │    search_text: "minimalist leather watch tan brown handcrafted",   │   │
│  │    category_path: ["Accessories", "Watches", "Leather"],            │   │
│  │    price_range: "50-100",                                           │   │
│  │    attributes: {                                                    │   │
│  │      color: ["tan", "brown"],                                       │   │
│  │      material: ["leather"],                                         │   │
│  │      style: ["minimalist"]                                          │   │
│  │    },                                                               │   │
│  │    popularity_score: 8.5,                                           │   │
│  │    in_stock: true,                                                  │   │
│  │    last_updated: ISODate                                            │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    activity_logs (Analytics)                        │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  {                                                                  │   │
│  │    _id: ObjectId,                                                   │   │
│  │    user_id: "uuid",                                                 │   │
│  │    session_id: "sess_123",                                          │   │
│  │    event_type: "product_view",  // cart_add, purchase, search       │   │
│  │    metadata: {                                                      │   │
│  │      product_id: "prod-123",                                        │   │
│  │      category: "watches",                                           │   │
│  │      referrer: "google",                                            │   │
│  │      query: "leather watch"                                         │   │
│  │    },                                                               │   │
│  │    device: { type: "mobile", os: "iOS 17", browser: "Safari" },     │   │
│  │    geo: { country: "US", city: "New York" },                        │   │
│  │    timestamp: ISODate                                               │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    admin_logs (Audit Trail)                         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  {                                                                  │   │
│  │    _id: ObjectId,                                                   │   │
│  │    admin_id: "uuid",                                                │   │
│  │    action: "PRODUCT_CREATED",  // CATEGORY_UPDATED, ORDER_REFUNDED  │   │
│  │    entity_type: "product",                                          │   │
│  │    entity_id: "prod-uuid",                                          │   │
│  │    changes: {                                                       │   │
│  │      before: { name: "Old Name", price: 50 },                       │   │
│  │      after: { name: "New Name", price: 75 }                         │   │
│  │    },                                                               │   │
│  │    ip_address: "192.168.1.1",                                       │   │
│  │    user_agent: "Mozilla/5.0...",                                    │   │
│  │    timestamp: ISODate                                               │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Relationship Summary
PostgreSQL Relationships (Foreign Keys)

| Relationship                     | Type     | Description                              |
| -------------------------------- | -------- | ---------------------------------------- |
| `users` → `user_addresses`       | 1:M      | One user has many addresses              |
| `users` → `orders`               | 1:M      | One user has many orders                 |
| `users` → `carts`                | 1:1      | One user has one active cart             |
| `categories` → `categories`      | Self 1:M | Parent-child category hierarchy          |
| `categories` → `products`        | 1:M      | Category contains many products          |
| `products` → `product_variants`  | 1:M      | Product has size/color variants          |
| `products` → `product_media`     | 1:M      | Product has images/videos                |
| `products` → `reviews`           | 1:M      | Product has customer reviews             |
| `product_variants` → `inventory` | 1:1      | Each variant has one inventory record    |
| `orders` → `order_items`         | 1:M      | Order contains multiple items            |
| `orders` → `payments`            | 1:M      | Order may have multiple payment attempts |
| `orders` → `shipments`           | 1:M      | Order may have multiple shipments        |
| `carts` → `cart_items`           | 1:M      | Cart contains multiple items             |

Cross-Database Relationships (PostgreSQL ↔ MongoDB)

| PostgreSQL Table | MongoDB Collection | Link Field | Sync Strategy               |
| ---------------- | ------------------ | ---------- | --------------------------- |
| `products`       | `products`         | `pg_id`    | Dual write on create/update |
| `reviews`        | `reviews`          | `pg_id`    | Async write after PG commit |
| `users`          | `activity_logs`    | `user_id`  | Event-driven logging        |
| `users` (admin)  | `admin_logs`       | `admin_id` | Middleware logging          |


## 📡 API Documentation

### Public APIs (Customer)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List products with filters |
| GET | `/api/v1/products/:slug` | Product details |
| GET | `/api/v1/categories` | All categories tree |
| POST | `/api/v1/cart` | Add to cart |
| POST | `/api/v1/orders` | Create order |

### Admin APIs ⭐

**Authentication:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/auth/login` | Admin login |
| POST | `/api/v1/admin/auth/logout` | Logout |

**Categories:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/categories` | List all categories |
| POST | `/api/v1/admin/categories` | Create category |
| PUT | `/api/v1/admin/categories/:id` | Update category |
| DELETE | `/api/v1/admin/categories/:id` | Delete category |
| POST | `/api/v1/admin/categories/reorder` | Reorder categories |

**Products:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/products` | List products (admin view) |
| POST | `/api/v1/admin/products` | Create product |
| PUT | `/api/v1/admin/products/:id` | Update product |
| DELETE | `/api/v1/admin/products/:id` | Delete product |
| POST | `/api/v1/admin/products/:id/images` | Upload images |
| PUT | `/api/v1/admin/products/:id/inventory` | Update stock |

**Orders:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/orders` | All orders with filters |
| GET | `/api/v1/admin/orders/:id` | Order details |
| PUT | `/api/v1/admin/orders/:id/status` | Update order status |
| POST | `/api/v1/admin/orders/:id/refund` | Process refund |

**Dashboard:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/dashboard/stats` | Sales statistics |
| GET | `/api/v1/admin/dashboard/recent-orders` | Recent orders |
| GET | `/api/v1/admin/dashboard/low-stock` | Low stock alerts |

## 🎛️ Admin Panel Guide

### Accessing Admin Panel

1. Navigate to http://localhost:5174
2. Login with admin credentials
3. You'll see the Dashboard with overview statistics

### Category Management

**Creating a Category:**
1. Go to **Catalog → Categories**
2. Click **"Add New Category"**
3. Fill in:
   - **Name:** Category name (e.g., "Home Decor")
   - **Slug:** URL-friendly identifier (auto-generated)
   - **Parent Category:** Select parent for subcategories (optional)
   - **Description:** SEO description
   - **Image:** Upload category thumbnail
   - **Sort Order:** Display position
4. Click **Save**

**Managing Subcategories:**
- To create a subcategory (e.g., "Living Room" under "Home Decor"):
  - Select "Home Decor" as Parent Category
  - The category tree will show nesting

**Editing/Deleting:**
- Click the **Edit** icon on any category
- Use **Delete** button (warns if products exist in category)

### Product Management

**Adding a New Product:**

1. Go to **Catalog → Products**
2. Click **"Add Product"**
3. **Basic Information:**
   - Product Name
   - SKU (auto-generated or custom)
   - Category (select from dropdown)
   - Short Description
   - Full Description (rich text editor)

4. **Pricing:**
   - Base Price
   - Compare-at Price (for sales)
   - Cost Price (for margin calculation)

5. **Variants** (Optional):
   - Click **"Add Variant"** for size/color options
   - Example: Size (S, M, L) + Color (Red, Blue)
   - Each variant gets unique SKU and price adjustment

6. **Inventory:**
   - Track quantity for each variant
   - Set low stock alert threshold
   - Enable/Disable "Continue selling when out of stock"

7. **Images:**
   - Upload up to 10 images
   - Drag to reorder
   - First image is primary

8. **SEO:**
   - Meta Title
   - Meta Description
   - URL Slug

9. **Additional:**
   - Tags (comma separated)
   - Featured product toggle
   - Weight & Dimensions (for shipping)

10. Click **Publish** or **Save as Draft**

**Managing Products:**
- **Grid View:** See all products with filters
- **Quick Edit:** Inline editing for price/stock
- **Bulk Actions:** Delete multiple, change category, update status
- **Search:** Find by name, SKU, or category

**Inventory Management:**
- Go to **Catalog → Inventory**
- View stock levels across all variants
- Export inventory report
- Bulk update quantities via CSV

### Order Management

**Processing Orders:**
1. **New Orders** appear in **Orders → Pending**
2. Click order to view details:
   - Customer info
   - Items ordered
   - Payment status
   - Shipping address

3. **Actions:**
   - **Confirm:** Move to processing
   - **Add Tracking:** Enter carrier and tracking number
   - **Mark Shipped:** Customer gets email notification
   - **Mark Delivered:** Complete order
   - **Cancel:** With reason (inventory restored)
   - **Refund:** Partial or full refund

**Order Filters:**
- Filter by status, date range, payment method
- Export orders to CSV
- Print packing slips

### Dashboard Overview

**Widgets:**
- **Total Sales:** Revenue today/this week/this month
- **Orders:** New, processing, shipped counts
- **Low Stock:** Products needing restock
- **Recent Activity:** Latest orders and admin actions
- **Top Products:** Best sellers this month

**Charts:**
- Sales trend (line chart)
- Orders by status (pie chart)
- Category performance (bar chart)

## 💻 Development Guidelines

### Code Standards

**Backend:**
- Use **async/await** for asynchronous operations
- Validate all inputs using **Joi** schemas
- Use **Prisma transactions** for multi-table operations
- Log all admin actions for audit trail
- Write **Jest** tests for critical paths

**Frontend:**
- Use **functional components** with hooks
- Implement **React Query** for server state
- Use **React Hook Form** for all forms
- Follow **Tailwind** utility-first approach
- Implement **loading states** and **error boundaries**

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/admin-category-crud

# Make atomic commits
git commit -m "feat: add category creation API"
git commit -m "feat: add category form UI"
git commit -m "fix: handle duplicate category slug"

# Push and create PR
git push origin feature/admin-category-crud
```

### Adding New Admin Features

**Step 1: Backend API**
```javascript
// src/modules/categories/category.controller.js
exports.createCategory = async (req, res) => {
  const { name, parentId, description } = req.body;
  
  const slug = generateSlug(name);
  
  const category = await prisma.category.create({
    data: {
      name,
      slug,
      parentId,
      description,
      createdBy: req.user.id
    }
  });
  
  // Log admin action
  await logAdminAction(req.user.id, 'CATEGORY_CREATED', category);
  
  res.status(201).json({ success: true, data: category });
};
```

**Step 2: Frontend Page**
```jsx
// admin/src/pages/Categories/Create.jsx
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { categoryAPI } from '../../services/category.service';

export const CreateCategory = () => {
  const { register, handleSubmit } = useForm();
  const mutation = useMutation(categoryAPI.create);
  
  const onSubmit = (data) => {
    mutation.mutate(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} placeholder="Category Name" />
      <button type="submit">Create</button>
    </form>
  );
};
```

**Step 3: Add to Navigation**
```javascript
// admin/src/components/Layout/Sidebar.jsx
const menuItems = [
  { icon: Dashboard, label: 'Dashboard', path: '/' },
  { icon: Category, label: 'Categories', path: '/categories' },
  { icon: Inventory, label: 'Products', path: '/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' }
];
```

## 🚀 Deployment (MVP)

### Production Preparation

1. **Environment Setup:**
   - Set `NODE_ENV=production`
   - Use strong JWT secrets
   - Configure production database URLs
   - Set up production file storage (S3)

2. **Build Applications:**
   ```bash
   # Build backend
   cd backend
   npm install --production
   npm run build

   # Build customer frontend
   cd ../frontend
   npm run build

   # Build admin panel
   cd ../admin
   npm run build
   ```

3. **Database:**
   ```bash
   # Run production migrations
   npx prisma migrate deploy
   
   # Optional: Seed admin user
   npm run seed:production
   ```

4. **Process Management:**
   ```bash
   # Install PM2 globally
   npm install -g pm2
   
   # Start backend with PM2
   pm2 start backend/src/server.js --name "lifestyle-api"
   
   # Serve frontend builds with PM2 or Nginx
   pm2 serve frontend/dist 3000 --name "lifestyle-store"
   pm2 serve admin/dist 3001 --name "lifestyle-admin"
   ```

