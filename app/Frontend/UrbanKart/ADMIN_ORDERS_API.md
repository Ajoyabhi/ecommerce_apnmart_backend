# Admin Order Management API Contract

## Overview

The Admin Order Management system provides secure, role-protected APIs for viewing, filtering, and managing all customer orders. All endpoints require admin authentication via JWT Bearer token and admin role verification.

---

## Authentication & Authorization

### Admin Authentication Flow

1. Admin logs in via `POST /api/v1/auth/admin/login` with email + password
2. Server returns a JWT token with `role: "ADMIN"` claim
3. All admin order endpoints require:
   - `Authorization: Bearer <token>` header
   - Token must contain `role: "ADMIN"`
4. Middleware chain: `verifyToken → verifyAdmin → handler`

### Role-Based Access Control

- **ADMIN**: Full read/write access to all orders, can update status, cancel, manage payments
- **USER**: Can only view their own orders via user dashboard endpoints (separate from admin)
- Unauthorized access returns `403 Forbidden`
- Missing/invalid token returns `401 Unauthorized`

---

## API Endpoints

### 1. List All Orders (with filters & pagination)

```
GET /api/v1/admin/orders
```

**Query Parameters:**

| Parameter  | Type     | Default   | Description                                           |
|------------|----------|-----------|-------------------------------------------------------|
| `page`     | integer  | `1`       | Page number (1-indexed)                               |
| `limit`    | integer  | `20`      | Items per page (max 100)                              |
| `search`   | string   | -         | Search by user name, email, or order number           |
| `status`   | string   | -         | Filter by order status (e.g., `PENDING`, `SHIPPED`)   |
| `dateFrom` | string   | -         | Filter orders created after this date (ISO 8601)      |
| `dateTo`   | string   | -         | Filter orders created before this date (ISO 8601)     |
| `sort`     | string   | `latest`  | Sort: `latest`, `oldest`, `amount_high`, `amount_low` |
| `userId`   | string   | -         | Filter orders by specific user ID                     |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "clx...",
        "orderNumber": "ORD-20260227-ABC123",
        "userId": "usr_...",
        "user": {
          "id": "usr_...",
          "email": "customer@example.com",
          "firstName": "John",
          "lastName": "Doe",
          "phone": "+919876543210"
        },
        "status": "CONFIRMED",
        "total": 2949.00,
        "subtotal": 2499.00,
        "shippingCost": 0,
        "tax": 450.00,
        "paymentMethod": "cod",
        "paymentStatus": "UNPAID",
        "trackingNumber": null,
        "shippingAddress": {
          "fullName": "John Doe",
          "phone": "+919876543210",
          "email": "customer@example.com",
          "addressLine1": "123 MG Road",
          "addressLine2": "Near City Mall",
          "pincode": "560001",
          "postOfficeName": "Bangalore GPO",
          "city": "Bangalore",
          "state": "Karnataka",
          "country": "India"
        },
        "billingAddress": null,
        "sameAsBilling": true,
        "items": [
          {
            "id": "item_...",
            "productId": "prod_...",
            "variantId": "var_...",
            "name": "Classic Oxford Shirt",
            "image": "https://...",
            "color": "White",
            "size": "M",
            "quantity": 1,
            "price": 2499.00
          }
        ],
        "adminNotes": null,
        "createdAt": "2026-02-27T10:30:00.000Z",
        "updatedAt": "2026-02-27T10:30:00.000Z",
        "deliveredAt": null,
        "returnEligible": false
      }
    ],
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### 2. Get Single Order Detail

```
GET /api/v1/admin/orders/:orderId
```

**Response (200 OK):** Same order object as in list response, single order.

**Response (404 Not Found):**

```json
{
  "success": false,
  "error": "Order not found"
}
```

### 3. Update Order Status

```
PATCH /api/v1/admin/orders/:orderId/status
```

**Request Body:**

```json
{
  "status": "SHIPPED",
  "trackingNumber": "TRACK123456789",
  "adminNotes": "Shipped via BlueDart"
}
```

| Field            | Type   | Required | Description                                              |
|------------------|--------|----------|----------------------------------------------------------|
| `status`         | string | Yes      | New status (must follow valid status transitions)        |
| `trackingNumber` | string | No       | Tracking number (recommended when status is `SHIPPED`)   |
| `adminNotes`     | string | No       | Internal note appended to the order                      |

**Valid Status Transitions:**

```
PENDING     → CONFIRMED, CANCELLED
CONFIRMED   → PROCESSING, CANCELLED
PROCESSING  → SHIPPED, CANCELLED
SHIPPED     → DELIVERED, RETURNED
DELIVERED   → RETURNED
RETURNED    → REFUNDED
CANCELLED   → (terminal state, no further transitions)
REFUNDED    → (terminal state, no further transitions)
```

**Response (200 OK):** Updated order object.

**Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid status transition from DELIVERED to PENDING"
}
```

### 4. Update Payment Status

```
PATCH /api/v1/admin/orders/:orderId/payment-status
```

**Request Body:**

```json
{
  "paymentStatus": "VERIFIED",
  "adminNotes": "Payment verified via bank statement"
}
```

| Field           | Type   | Required | Description                                      |
|-----------------|--------|----------|--------------------------------------------------|
| `paymentStatus` | string | Yes      | One of: `UNPAID`, `PAID`, `VERIFIED`, `REFUNDED`, `FAILED` |
| `adminNotes`    | string | No       | Internal note                                    |

**Response (200 OK):** Updated order object.

### 5. Cancel Order

```
POST /api/v1/admin/orders/:orderId/cancel
```

**Request Body:**

```json
{
  "reason": "Customer requested cancellation"
}
```

| Field    | Type   | Required | Description                    |
|----------|--------|----------|--------------------------------|
| `reason` | string | No       | Reason for cancellation        |

**Backend must:**
- Set order status to `CANCELLED`
- Restore inventory (add quantities back to variant stock)
- If payment was collected, initiate refund flow
- Append reason to `adminNotes`

**Response (200 OK):** Updated order object with `status: "CANCELLED"`.

**Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Order cannot be cancelled in current state (DELIVERED)"
}
```

### 6. Add Internal Note

```
POST /api/v1/admin/orders/:orderId/notes
```

**Request Body:**

```json
{
  "note": "Called customer to confirm address"
}
```

| Field  | Type   | Required | Description       |
|--------|--------|----------|-------------------|
| `note` | string | Yes      | Note text to add  |

**Backend should:** Append the note with timestamp to `adminNotes` field (e.g., `[2026-02-27 10:30] Called customer to confirm address`).

**Response (200 OK):** Updated order object.

---

## Order Status Flow

```
┌─────────┐    ┌───────────┐    ┌────────────┐    ┌─────────┐    ┌───────────┐
│ PENDING  │───>│ CONFIRMED │───>│ PROCESSING │───>│ SHIPPED │───>│ DELIVERED │
└────┬─────┘    └─────┬─────┘    └──────┬─────┘    └────┬────┘    └─────┬─────┘
     │                │                 │               │               │
     │                │                 │               │               │
     v                v                 v               v               v
┌───────────┐                                    ┌──────────┐    ┌──────────┐
│ CANCELLED │                                    │ RETURNED │───>│ REFUNDED │
└───────────┘                                    └──────────┘    └──────────┘
```

---

## Search Behavior

The `search` parameter performs a case-insensitive search across:
- `order.orderNumber` (partial match)
- `user.firstName + user.lastName` (partial match)
- `user.email` (partial match)

**Prisma example:**

```typescript
where: {
  OR: [
    { orderNumber: { contains: search, mode: 'insensitive' } },
    { user: { email: { contains: search, mode: 'insensitive' } } },
    { user: { firstName: { contains: search, mode: 'insensitive' } } },
    { user: { lastName: { contains: search, mode: 'insensitive' } } },
  ]
}
```

---

## Sorting

| Sort Value    | Prisma `orderBy`                  |
|---------------|-----------------------------------|
| `latest`      | `{ createdAt: 'desc' }`          |
| `oldest`      | `{ createdAt: 'asc' }`           |
| `amount_high` | `{ total: 'desc' }`              |
| `amount_low`  | `{ total: 'asc' }`               |

---

## Suggested Prisma Schema

```prisma
model Order {
  id              String      @id @default(cuid())
  orderNumber     String      @unique
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  status          OrderStatus @default(PENDING)
  total           Float
  subtotal        Float
  shippingCost    Float       @default(0)
  tax             Float       @default(0)
  paymentMethod   String?
  paymentStatus   String?     @default("UNPAID")
  trackingNumber  String?
  shippingAddress Json?
  billingAddress  Json?
  sameAsBilling   Boolean     @default(true)
  adminNotes      String?     @db.Text
  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  deliveredAt     DateTime?
  returnEligible  Boolean     @default(false)

  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@index([orderNumber])
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
  id         String  @id @default(cuid())
  orderId    String
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId  String
  variantId  String?
  name       String
  image      String?
  color      String?
  size       String?
  quantity   Int
  price      Float

  @@index([orderId])
}
```

---

## Error Handling

| Status Code | Scenario                                        |
|-------------|------------------------------------------------|
| `200`       | Success                                        |
| `400`       | Invalid request body, invalid status transition |
| `401`       | Missing or invalid JWT token                   |
| `403`       | Token valid but user is not ADMIN              |
| `404`       | Order not found                                |
| `422`       | Validation error (e.g., missing required field)|
| `500`       | Internal server error                          |

All error responses follow the format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

## Security Considerations

1. **Authentication**: All endpoints require valid JWT Bearer token
2. **Authorization**: Admin role verified via middleware before any handler executes
3. **Input validation**: All request bodies validated with Zod schemas on the backend
4. **Rate limiting**: Recommended to apply rate limiting to prevent abuse
5. **Audit trail**: Status changes and notes should be logged with timestamps
6. **Inventory safety**: Cancellations must atomically restore inventory within a database transaction
7. **CORS**: Only allow requests from the trusted frontend origin
8. **SQL injection**: Prisma ORM parameterizes all queries automatically
