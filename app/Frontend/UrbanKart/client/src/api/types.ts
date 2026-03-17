/**
 * Types aligned with the separate backend API (Express + Prisma).
 * Base path: /api/v1
 * Response shape: { success: boolean, data?: T, count?: number, message?: string }
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
  category?: string;
  sections?: CategoryFeedSection[];
}

// ---- Backend (Prisma) entities ----

export interface BackendCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  children?: BackendCategory[];
}

export interface BackendCategoryRef {
  name: string;
  slug: string;
}

// ---- Menu category structure (GET /api/v1/categories/menu) ----

export interface MenuSubSubcategory {
  id: string;
  name: string;
  slug: string;
}

export interface MenuSubcategory {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  sub_subcategories?: MenuSubSubcategory[];
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  imageUrl?: string | null;
  subcategories?: MenuSubcategory[];
}

export interface BackendProductVariant {
  id: string;
  productId: string;
  sku: string;
  name?: string | null;
  options: Record<string, string>;
  priceAdjustment: number | string;
  isActive: boolean;
  inventory?: {
    quantity: number;
    reservedQty?: number;
    lowThreshold?: number;
  } | null;
}

export interface BackendProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  basePrice: number | string;
  categoryId: string;
  category?: BackendCategoryRef | BackendCategory | null;
  brand?: string | null;
  status: string;
  isFeatured: boolean;
  /** Whether product is marked as trending (separate from featured) */
  isTrending?: boolean;
  /** Whether product is marked as New Arrival (separate from featured/trending) */
  isNewArrival?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Optional aggregate review stats from backend */
  rating?: number | null;
  reviewsCount?: number | null;
  /** Optional list of reviews for product detail page */
  reviews?: ProductReview[] | null;
  /** Rating distribution + fit/quality opinion percentages */
  ratingSummary?: ProductRatingSummary | null;
  variants?: BackendProductVariant[];
  richContent?: ProductRichContent | null;
}

export interface ProductRatingSummary {
  ratingDistribution: Record<number, number>;
  /** Omitted for beauty products (fit not applicable) */
  fitOpinion?: Record<string, number> | null;
  qualityOpinion: Record<string, number>;
}

export interface ProductReview {
  id?: string | null;
  user?: { name?: string; avatar?: string; verified_purchaser?: boolean } | null;
  rating: number;
  title?: string | null;
  content?: string | null;
  createdAt?: string;
  likes?: number;
}

export interface ProductRichContent {
  pg_id?: string;
  description_html?: string;
  lifestyle_tags?: string[];
  attributes?: Record<string, unknown>;
  media_gallery?: Array<{
    url: string;
    type?: string;
    alt?: string;
    order?: number;
    is_primary?: boolean;
  }>;
}

// ---- Unified UI product type (derived from backend) ----

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  strikePrice?: number | null;
  discount?: number | null;
  category?: BackendCategoryRef | BackendCategory | null;
  brand?: string | null;
  images: string[];
  description: string;
  colors: string[];
  sizes: string[];
  rating?: number;
  reviewsCount?: number;
  /** Reviews list (when loaded from product detail API) */
  reviews?: ProductReview[] | null;
  ratingSummary?: ProductRatingSummary | null;
  stock: number;
  isFeatured: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  variants?: BackendProductVariant[];
  richContent?: ProductRichContent | null;
}

export type Category = BackendCategory;

// ---- Content / hero banners ----

export interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  image: string;
  mobile_image?: string | null;
  redirect_url?: string | null;
  color?: string | null;
  priority?: number;
}

// ---- Category feed sections (GET /api/v1/content/category-feed/:slug) ----

export interface CategoryFeedSection {
  type: "carousel" | "product_grid" | "brand_slider" | "banner" | "product_slider";
  title: string;
  image?: string | null;
  mobile_image?: string | null;
  redirect_url?: string | null;
  displayOrder?: number;
  items?: CategoryFeedItem[];
}

export interface CategoryFeedItem {
  id?: string;
  brand_id?: string;
  name: string;
  image?: string | null;
  logo?: string | null;
  price?: number | null;
  slug?: string | null;
  link?: string | null;
  badge?: string | null;
  subtitle?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string;
  role: string;
  isEmailVerified?: boolean;
  provider?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Backend OTP signup: name + email + password → OTP sent */
export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}

/** Backend verify OTP → returns tokens */
export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

/** Backend resend OTP */
export interface ResendOtpPayload {
  email: string;
}

// ---- User Dashboard types ----

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  role: string;
  createdAt?: string;
}

export interface UserAddress {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  label?: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImage?: string | null;
  sku?: string | null;
  quantity: number;
  price: number;
  color?: string | null;
  size?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "REFUNDED";
  total: number;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  shippingAddress?: UserAddress | null;
  trackingNumber?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string | null;
  returnEligible?: boolean;
}

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  addedAt: string;
}

export interface SavedCard {
  id: string;
  cardType: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  holderName: string;
  isDefault: boolean;
}

export interface UserNotification {
  id: string;
  type: "ORDER" | "PROMO" | "SYSTEM" | "RETURN";
  title: string;
  message: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export interface DashboardOverview {
  totalOrders: number;
  wishlistCount: number;
  addressCount: number;
  recentOrders: Order[];
  unreadNotifications: number;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface CreateAddressPayload {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
  label?: string;
}

// ---- Admin Order types ----

export interface AdminOrderUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  userId?: string | null;
  user?: AdminOrderUser | null;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "REFUNDED";
  total: number;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  trackingNumber?: string | null;
  shippingAddress?: Record<string, string> | null;
  billingAddress?: Record<string, string> | null;
  sameAsBilling?: boolean;
  items: OrderItem[];
  adminNotes?: string | null;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string | null;
  returnEligible?: boolean;
}

export interface AdminOrdersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  userId?: string;
}

export interface UpdateOrderStatusPayload {
  status: string;
  trackingNumber?: string;
  adminNotes?: string;
}

export interface UpdatePaymentStatusPayload {
  paymentStatus: string;
  adminNotes?: string;
}

// ---- Checkout types ----

export interface CheckoutAddress {
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  pincode: string;
  postOfficeName?: string;
  city: string;
  state: string;
  country: string;
}

export interface CheckoutOrderItem {
  productId: string;
  productName: string;
  productImage?: string;
  sku?: string;
  quantity: number;
  price: number;
  color?: string;
  size?: string;
}

export interface PlaceOrderPayload {
  shippingAddress: CheckoutAddress;
  billingAddress: CheckoutAddress;
  sameAsBilling: boolean;
  paymentMethod: string;
  /** Required when paymentMethod is "cod": 6-digit OTP received by email */
  codOtp?: string;
  items: CheckoutOrderItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
}

export interface PlaceOrderResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
}

export interface PostalPinCodeResponse {
  Message: string;
  Status: string;
  PostOffice: PostOfficeInfo[] | null;
}

export interface PostOfficeInfo {
  Name: string;
  Description: string | null;
  BranchType: string;
  DeliveryStatus: string;
  Circle: string;
  District: string;
  Division: string;
  Region: string;
  Block: string;
  State: string;
  Country: string;
  Pincode: string;
}

// Query params for GET /api/v1/products
export interface ProductsQueryParams {
  category?: string;
  subcategory?: string;
  sub_subcategory?: string;
  brand?: string;
  price_min?: number;
  price_max?: number;
  size?: string;
  color?: string;
  featured?: boolean;
  newArrivals?: boolean;
  trending?: boolean;
  rating?: number;
  status?: string;
  sort?: string;
  page?: number;
  limit?: number;
  /** Site-wide search query (searches name, slug, SKU, brand) */
  search?: string;
  /** Seed for random sort (0–1) for consistent pagination */
  seed?: number;
}
