# Checkout — Backend API Reference

This document describes the checkout API endpoint and the full order-creation flow the frontend expects.
All checkout endpoints require a valid JWT Bearer token.

**Base URL:** `/api/v1`

---

## Authentication

The checkout endpoint requires:
```
Authorization: Bearer <accessToken>
```

The backend MUST:
1. Validate the JWT token
2. Extract `userId` from the token
3. Associate the created order with that `userId`
4. Reject checkout if the token is invalid/expired (return 401)

---

## 1. Place Order (Checkout)

### `POST /api/v1/user/orders/checkout`

Creates a new order from the user's cart.

**Request Body:**
```json
{
  "shippingAddress": {
    "fullName": "Rahul Sharma",
    "phone": "+91 98765 43210",
    "email": "rahul@example.com",
    "addressLine1": "A-42, Sector 62",
    "addressLine2": "Near Metro Station",
    "pincode": "201301",
    "postOfficeName": "Noida Sector 62",
    "city": "Gautam Buddha Nagar",
    "state": "Uttar Pradesh",
    "country": "India"
  },
  "billingAddress": {
    "fullName": "Rahul Sharma",
    "phone": "+91 98765 43210",
    "email": "rahul@example.com",
    "addressLine1": "A-42, Sector 62",
    "addressLine2": "Near Metro Station",
    "pincode": "201301",
    "postOfficeName": "Noida Sector 62",
    "city": "Gautam Buddha Nagar",
    "state": "Uttar Pradesh",
    "country": "India"
  },
  "sameAsBilling": true,
  "paymentMethod": "cod",
  "items": [
    {
      "productId": "prod-uuid-1",
      "productName": "Classic White T-Shirt",
      "productImage": "https://...",
      "sku": "CWT-001-M",
      "quantity": 2,
      "price": 29.99,
      "color": "White",
      "size": "M"
    },
    {
      "productId": "prod-uuid-2",
      "productName": "Denim Jacket",
      "productImage": "https://...",
      "sku": "DJ-001-L",
      "quantity": 1,
      "price": 79.99,
      "color": "Blue",
      "size": "L"
    }
  ],
  "subtotal": 139.97,
  "shippingCost": 0,
  "tax": 25.19,
  "total": 165.16
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "orderId": "order-uuid",
    "orderNumber": "ORD-2024-00042",
    "status": "PENDING",
    "total": 165.16
  }
}
```

**Error Responses:**
| Status | Scenario |
|--------|----------|
| 401 | Invalid/missing token |
| 400 | Missing required fields, invalid address |
| 400 | Empty items array |
| 422 | Product not found, out of stock, or price mismatch |
| 500 | Server error during order creation |

---

## 2. Backend Validation Requirements

The backend MUST NOT trust frontend-submitted prices. The order creation flow should:

### Step 1: Authenticate User
- Verify JWT Bearer token
- Extract `userId`

### Step 2: Validate Items
For each item in `items[]`:
- Verify `productId` exists in the database
- Verify the product is active (`status: 'ACTIVE'`)
- **Re-fetch the current price from the database** (do NOT use the `price` from the request)
- Verify stock availability (quantity <= available inventory)
- If a `sku` is provided, validate the variant exists and is active

### Step 3: Recalculate Totals
```
subtotal = SUM(each item's DB price * quantity)
tax = subtotal * TAX_RATE (e.g., 0.18 for 18% GST)
shippingCost = calculate based on business rules (e.g., free above threshold)
total = subtotal + tax + shippingCost
```

### Step 4: Validate Address
- `fullName` is not empty
- `phone` has at least 10 digits
- `email` is valid format
- `addressLine1` is not empty
- `pincode` is exactly 6 digits
- `city`, `state`, `country` are not empty

### Step 5: Create Order
In a database transaction:
1. Create `Order` record with `userId`, calculated totals, shipping/billing addresses, payment method
2. Generate unique `orderNumber` (e.g., `ORD-YYYY-NNNNN`)
3. Create `OrderItem` records for each item (using DB-verified prices)
4. Deduct inventory (reduce stock for each item/variant)
5. Set initial status based on payment method:
   - `cod` → `CONFIRMED`
   - `card`, `upi`, `netbanking` → `PENDING` (awaiting payment confirmation)

### Step 6: Return Response
Return the `orderId`, `orderNumber`, `status`, and `total`.

---

## 3. Cart-to-Order Conversion Logic

The frontend sends cart items directly in the checkout request. The backend should:

1. **NOT rely on a server-side cart** — the items come from the frontend Zustand cart store
2. **Validate each item** against the products table
3. **Use database prices** to prevent price manipulation
4. **Check inventory** before creating the order
5. **Atomically deduct inventory** within the order creation transaction

---

## 4. Address Handling

### Shipping Address
Stored as a JSON column or in a related `OrderAddress` table. Fields:
- `fullName`, `phone`, `email`
- `addressLine1`, `addressLine2`
- `pincode`, `postOfficeName`
- `city` (from District field of postal API)
- `state`, `country`

### Billing Address
- If `sameAsBilling: true`, copy shipping address to billing
- If `sameAsBilling: false`, store separate billing address

### Pincode Integration (Frontend Only)
The frontend calls `https://api.postalpincode.in/pincode/{PINCODE}` to auto-fill city/state/country.
- The backend does NOT need to call this API
- Backend should store whatever address the frontend submits after validation
- Backend validates that pincode is 6 digits, city/state/country are not empty

---

## 5. Payment Integration Flow

Current implementation supports payment method selection only. For production:

| Method | Flow |
|--------|------|
| `cod` | Order created immediately with `CONFIRMED` status |
| `card` | Integrate Razorpay/Stripe: create payment intent → confirm on frontend → verify on backend → update order status |
| `upi` | Similar to card: create intent → collect VPA → verify → update |
| `netbanking` | Redirect-based: create session → redirect → callback → update |

For MVP, all methods can create orders with `PENDING` status and handle payment confirmation separately.

---

## 6. Database Schema Updates

### Order Table (additions for checkout)
```prisma
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
  paymentStatus   String?     @default("UNPAID")
  trackingNumber  String?
  returnEligible  Boolean     @default(true)

  // Address stored as JSON
  shippingAddress Json
  billingAddress  Json
  sameAsBilling   Boolean     @default(true)

  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  deliveredAt     DateTime?
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
```

### Address JSON Structure (stored in `shippingAddress` / `billingAddress`)
```json
{
  "fullName": "Rahul Sharma",
  "phone": "+91 98765 43210",
  "email": "rahul@example.com",
  "addressLine1": "A-42, Sector 62",
  "addressLine2": "Near Metro Station",
  "pincode": "201301",
  "postOfficeName": "Noida Sector 62",
  "city": "Gautam Buddha Nagar",
  "state": "Uttar Pradesh",
  "country": "India"
}
```

---

## 7. Error Handling Scenarios

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| No auth token | 401 | `{ success: false, message: "Authentication required" }` |
| Invalid/expired token | 401 | `{ success: false, message: "Invalid or expired token" }` |
| Empty items array | 400 | `{ success: false, message: "Cart is empty" }` |
| Invalid product ID | 422 | `{ success: false, message: "Product not found: {id}" }` |
| Product out of stock | 422 | `{ success: false, message: "Insufficient stock for: {name}" }` |
| Invalid address | 400 | `{ success: false, message: "Shipping address: {field} is required" }` |
| Invalid pincode format | 400 | `{ success: false, message: "Invalid pincode format" }` |
| Price mismatch (log) | - | Log warning but use DB price (do not reject) |
| Database error | 500 | `{ success: false, message: "Order creation failed" }` |

---

## 8. Security Considerations

1. **Never trust frontend prices** — always recalculate from database
2. **Validate JWT on every request** — extract userId from token
3. **Rate limit checkout endpoint** — prevent order spam (e.g., 5 orders/minute per user)
4. **Use database transactions** — ensure atomicity of order + items + inventory deduction
5. **Sanitize all inputs** — prevent SQL injection, XSS in address fields
6. **Log all orders** — maintain audit trail
7. **Idempotency key** (optional) — prevent duplicate orders from double-clicks

---

## 9. Frontend Pincode Integration Details

### API Used
```
GET https://api.postalpincode.in/pincode/{6_DIGIT_PINCODE}
```

### Response Format
```json
[
  {
    "Message": "Number of pincode(s) found: 5",
    "Status": "Success",
    "PostOffice": [
      {
        "Name": "Alpha Greater Noida",
        "BranchType": "Sub Post Office",
        "District": "Gautam Buddha Nagar",
        "State": "Uttar Pradesh",
        "Country": "India",
        "Pincode": "201310"
      }
    ]
  }
]
```

### Frontend Logic
1. User enters 6-digit pincode
2. Frontend debounces (600ms) then calls the API
3. If `Status === "Success"` and `PostOffice` array has items:
   - If 1 post office: auto-select and auto-fill city/state/country
   - If multiple: show dropdown with `{Name} - {BranchType}` options
   - On selection: `District → City`, `State → State`, `Country → Country`
4. If API fails or returns no results: show "Invalid or unsupported Pincode" error
5. Post Office selection is required before placing order

### Mapping
```
selectedPostOffice.District  → city field
selectedPostOffice.State     → state field
selectedPostOffice.Country   → country field
selectedPostOffice.Name      → postOfficeName field
```

---

## Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/user/orders/checkout` | Place order (creates order from cart items) |

All other order-related endpoints (list, detail, return) are documented in `USER_DASHBOARD_API.md`.
