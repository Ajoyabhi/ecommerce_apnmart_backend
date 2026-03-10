# User Dashboard — Backend API Reference

This document describes all the API endpoints the frontend User Dashboard expects.
All endpoints require a valid JWT Bearer token in the `Authorization` header (except where noted).

**Base URL:** `/api/v1`

---

## Authentication

All user dashboard endpoints must verify the JWT Bearer token passed as:
```
Authorization: Bearer <accessToken>
```

The token is obtained from `POST /api/v1/auth/login` or `POST /api/v1/auth/register` (already configured).

**Standard Response Shape:**
```json
{
  "success": true,
  "data": { ... },
  "message": "optional message"
}
```

For paginated responses:
```json
{
  "success": true,
  "data": [ ... ],
  "total": 42,
  "page": 1,
  "limit": 10
}
```

---

## 1. Dashboard Overview

### `GET /api/v1/user/dashboard`

Returns summary stats for the logged-in user.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 12,
    "wishlistCount": 5,
    "addressCount": 3,
    "unreadNotifications": 2,
    "recentOrders": [
      {
        "id": "order-uuid",
        "orderNumber": "ORD-2024-001",
        "status": "DELIVERED",
        "total": 129.99,
        "items": [
          {
            "id": "item-uuid",
            "productId": "prod-uuid",
            "productName": "Classic White T-Shirt",
            "productImage": "https://...",
            "quantity": 2,
            "price": 29.99
          }
        ],
        "createdAt": "2024-06-15T10:30:00Z"
      }
    ]
  }
}
```

`recentOrders` should return the 3 most recent orders.

---

## 2. User Profile

### `GET /api/v1/user/profile`

Returns the current user's profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1 555 000 0000",
    "avatar": null,
    "role": "USER",
    "createdAt": "2024-01-10T08:00:00Z"
  }
}
```

### `PATCH /api/v1/user/profile`

Updates the user's profile (name, phone only — email is not editable).

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1 555 123 4567"
}
```

**Response:** Same as `GET /api/v1/user/profile`.

### `POST /api/v1/user/change-password`

Changes the user's password.

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Errors:**
- `401` — Current password is incorrect
- `400` — New password too short (min 6 characters)

---

## 3. Orders

### `GET /api/v1/user/orders?page=1&limit=10`

Returns the user's orders, paginated, newest first.

**Query Parameters:**
| Param  | Type   | Default | Description       |
|--------|--------|---------|-------------------|
| page   | number | 1       | Page number       |
| limit  | number | 10      | Items per page    |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-uuid",
      "orderNumber": "ORD-2024-001",
      "status": "DELIVERED",
      "total": 129.99,
      "subtotal": 119.99,
      "shippingCost": 5.00,
      "tax": 5.00,
      "paymentMethod": "card",
      "paymentStatus": "PAID",
      "trackingNumber": "TRK123456",
      "returnEligible": true,
      "items": [
        {
          "id": "item-uuid",
          "productId": "prod-uuid",
          "productName": "Classic White T-Shirt",
          "productImage": "https://...",
          "sku": "CWT-001-M",
          "quantity": 2,
          "price": 29.99,
          "color": "White",
          "size": "M"
        }
      ],
      "shippingAddress": {
        "id": "addr-uuid",
        "fullName": "John Doe",
        "addressLine1": "123 Main St",
        "city": "New York",
        "state": "NY",
        "postalCode": "10001",
        "country": "US",
        "phone": "+1 555 000 0000"
      },
      "createdAt": "2024-06-15T10:30:00Z",
      "updatedAt": "2024-06-17T14:00:00Z",
      "deliveredAt": "2024-06-17T14:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 10
}
```

**Order Status Values:** `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `RETURNED`, `REFUNDED`

### `GET /api/v1/user/orders/:orderId`

Returns a single order with full details.

**Response:** Same shape as a single item in the orders list above.

### `POST /api/v1/user/orders/:orderId/return`

Requests a return for a delivered order.

**Request Body:**
```json
{
  "reason": "Item doesn't fit"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Return request submitted"
}
```

**Rules:**
- Only orders with `status: "DELIVERED"` and `returnEligible: true` can be returned
- Should update order status to `RETURNED`

---

## 4. Address Book

### `GET /api/v1/user/addresses`

Returns all saved addresses for the user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "addr-uuid",
      "userId": "user-uuid",
      "fullName": "John Doe",
      "phone": "+1 555 000 0000",
      "addressLine1": "123 Main St",
      "addressLine2": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "US",
      "isDefault": true,
      "label": "Home"
    }
  ]
}
```

### `POST /api/v1/user/addresses`

Creates a new address.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "phone": "+1 555 000 0000",
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "US",
  "isDefault": false,
  "label": "Home"
}
```

**Response:** Returns the created address object.

### `PATCH /api/v1/user/addresses/:addressId`

Updates an existing address.

**Request Body:** Same as `POST`, all fields optional.

**Response:** Returns the updated address object.

### `DELETE /api/v1/user/addresses/:addressId`

Deletes an address.

**Response:**
```json
{
  "success": true,
  "message": "Address deleted"
}
```

### `PATCH /api/v1/user/addresses/:addressId/default`

Sets an address as the default. Should also unset the previous default.

**Response:** Returns the updated address object.

---

## 5. Wishlist

### `GET /api/v1/user/wishlist`

Returns all wishlist items with full product data.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "wish-uuid",
      "productId": "prod-uuid",
      "product": {
        "id": "prod-uuid",
        "sku": "CWT-001",
        "name": "Classic White T-Shirt",
        "slug": "classic-white-t-shirt",
        "price": 29.99,
        "strikePrice": 49.99,
        "discount": 40,
        "images": ["https://..."],
        "description": "...",
        "colors": ["White", "Black"],
        "sizes": ["S", "M", "L"],
        "stock": 50,
        "isFeatured": false,
        "category": { "name": "T-Shirts", "slug": "t-shirts" }
      },
      "addedAt": "2024-06-10T08:00:00Z"
    }
  ]
}
```

The `product` object should match the frontend's `Product` interface (same shape as products from `GET /api/v1/products`).

### `POST /api/v1/user/wishlist`

Adds a product to the wishlist.

**Request Body:**
```json
{
  "productId": "prod-uuid"
}
```

**Response:** Returns the created wishlist item.

### `DELETE /api/v1/user/wishlist/:wishlistItemId`

Removes a product from the wishlist.

**Response:**
```json
{
  "success": true,
  "message": "Removed from wishlist"
}
```

---

## 6. Saved Payment Cards

### `GET /api/v1/user/saved-cards`

Returns the user's saved payment cards (tokenized, NOT raw card data).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "card-uuid",
      "cardType": "visa",
      "last4": "4242",
      "expiryMonth": 12,
      "expiryYear": 2026,
      "holderName": "John Doe",
      "isDefault": true
    }
  ]
}
```

### `DELETE /api/v1/user/saved-cards/:cardId`

Removes a saved card.

**Response:**
```json
{
  "success": true,
  "message": "Card removed"
}
```

---

## 7. Notifications

### `GET /api/v1/user/notifications`

Returns all notifications for the user, newest first.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-uuid",
      "type": "ORDER",
      "title": "Order Shipped",
      "message": "Your order #ORD-2024-001 has been shipped!",
      "isRead": false,
      "link": "/account/orders?id=order-uuid",
      "createdAt": "2024-06-16T12:00:00Z"
    }
  ]
}
```

**Notification Types:** `ORDER`, `PROMO`, `SYSTEM`, `RETURN`

### `PATCH /api/v1/user/notifications/:notifId/read`

Marks a single notification as read.

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### `PATCH /api/v1/user/notifications/read-all`

Marks all notifications as read.

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

## Data Models (Prisma Suggestions)

Below are suggested Prisma models to support these endpoints:

```prisma
model Address {
  id           String  @id @default(uuid())
  userId       String
  user         User    @relation(fields: [userId], references: [id])
  fullName     String
  phone        String
  addressLine1 String
  addressLine2 String?
  city         String
  state        String
  postalCode   String
  country      String  @default("US")
  isDefault    Boolean @default(false)
  label        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Order {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  orderNumber     String      @unique
  status          OrderStatus @default(PENDING)
  subtotal        Decimal     @db.Decimal(10,2)
  shippingCost    Decimal     @db.Decimal(10,2) @default(0)
  tax             Decimal     @db.Decimal(10,2) @default(0)
  total           Decimal     @db.Decimal(10,2)
  paymentMethod   String?
  paymentStatus   String?
  trackingNumber  String?
  shippingAddress Json?
  returnEligible  Boolean     @default(true)
  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  deliveredAt     DateTime?
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  RETURNED
  REFUNDED
}

model OrderItem {
  id            String  @id @default(uuid())
  orderId       String
  order         Order   @relation(fields: [orderId], references: [id])
  productId     String
  productName   String
  productImage  String?
  sku           String?
  quantity      Int
  price         Decimal @db.Decimal(10,2)
  color         String?
  size          String?
}

model WishlistItem {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  addedAt   DateTime @default(now())

  @@unique([userId, productId])
}

model SavedCard {
  id          String  @id @default(uuid())
  userId      String
  user        User    @relation(fields: [userId], references: [id])
  cardType    String
  last4       String
  expiryMonth Int
  expiryYear  Int
  holderName  String
  isDefault   Boolean @default(false)
  createdAt   DateTime @default(now())
}

model Notification {
  id        String           @id @default(uuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  type      NotificationType
  title     String
  message   String
  isRead    Boolean          @default(false)
  link      String?
  createdAt DateTime         @default(now())
}

enum NotificationType {
  ORDER
  PROMO
  SYSTEM
  RETURN
}
```

**User model additions:**
```prisma
model User {
  // ... existing fields ...
  phone     String?
  avatar    String?
  addresses Address[]
  orders    Order[]
  wishlist  WishlistItem[]
  savedCards SavedCard[]
  notifications Notification[]
}
```

---

## Endpoint Summary

| Method | Endpoint                                   | Description                    |
|--------|--------------------------------------------|--------------------------------|
| GET    | `/api/v1/user/dashboard`                   | Dashboard overview stats       |
| GET    | `/api/v1/user/profile`                     | Get user profile               |
| PATCH  | `/api/v1/user/profile`                     | Update profile                 |
| POST   | `/api/v1/user/change-password`             | Change password                |
| GET    | `/api/v1/user/orders?page=1&limit=10`      | List orders (paginated)        |
| GET    | `/api/v1/user/orders/:orderId`             | Get order details              |
| POST   | `/api/v1/user/orders/:orderId/return`      | Request return                 |
| GET    | `/api/v1/user/addresses`                   | List addresses                 |
| POST   | `/api/v1/user/addresses`                   | Create address                 |
| PATCH  | `/api/v1/user/addresses/:addressId`        | Update address                 |
| DELETE | `/api/v1/user/addresses/:addressId`        | Delete address                 |
| PATCH  | `/api/v1/user/addresses/:addressId/default`| Set default address            |
| GET    | `/api/v1/user/wishlist`                    | List wishlist items            |
| POST   | `/api/v1/user/wishlist`                    | Add to wishlist                |
| DELETE | `/api/v1/user/wishlist/:itemId`            | Remove from wishlist           |
| GET    | `/api/v1/user/saved-cards`                 | List saved cards               |
| DELETE | `/api/v1/user/saved-cards/:cardId`         | Delete saved card              |
| GET    | `/api/v1/user/notifications`               | List notifications             |
| PATCH  | `/api/v1/user/notifications/:id/read`      | Mark notification read         |
| PATCH  | `/api/v1/user/notifications/read-all`      | Mark all notifications read    |

All endpoints require `Authorization: Bearer <token>` header.
All endpoints return `{ success: boolean, data?: T, message?: string }`.
