const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');
const { ProductRichContent } = require('../../models');
const { z } = require('zod');
const { verifyCodOtp, createAndSendCodOtp } = require('../../services/codOtp.service');
const { onOrderPlaced } = require('../../services/orderEmail.service');

// Helpers
function decimalToNumber(d) {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  return Number(d);
}

function mapAddressToDto(address) {
  if (!address) return null;
  return {
    id: address.id,
    userId: address.userId,
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
    label: address.label ?? null,
  };
}

function mapOrderItemToDto(item) {
  const variant = item.variant;
  let color = null;
  let size = null;
  if (variant && variant.options) {
    try {
      const opts = variant.options;
      color = opts.color ?? null;
      size = opts.size ?? null;
    } catch {
      // ignore malformed options
    }
  }

  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage ?? null,
    sku: item.sku,
    quantity: item.quantity,
    price: decimalToNumber(item.unitPrice),
    color: item.color ?? color,
    size: item.size ?? size,
  };
}

function mapOrderToDto(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    total: decimalToNumber(order.total),
    subtotal: decimalToNumber(order.subtotal),
    shippingCost: decimalToNumber(order.shippingAmount),
    tax: decimalToNumber(order.taxAmount),
    paymentMethod: order.paymentMethod ?? (order.paymentIntentId ? 'card' : null),
    paymentStatus: order.paymentStatus ?? 'unpaid',
    shippingAddress: order.shippingAddress && typeof order.shippingAddress === 'object'
      ? order.shippingAddress
      : null,
    trackingNumber: order.trackingNumber ?? null,
    items: order.items ? order.items.map(mapOrderItemToDto) : [],
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt?.toISOString?.() ?? undefined,
    deliveredAt: order.deliveredAt?.toISOString?.() ?? null,
    returnEligible: order.returnEligible,
  };
}

// 1. Dashboard overview
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [orders, totalOrders, wishlistCount, addressCount, unreadNotifications] =
      await Promise.all([
        prisma.order.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            items: {
              include: {
                variant: true,
              },
            },
          },
        }),
        prisma.order.count({ where: { userId } }),
        prisma.wishlistItem.count({ where: { userId } }),
        prisma.address.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

    const recentOrders = orders.map(mapOrderToDto);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        wishlistCount,
        addressCount,
        unreadNotifications,
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2. User profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
        avatar: user.avatar ?? null,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
});

exports.updateProfile = async (req, res, next) => {
  try {
    const payload = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName: payload.firstName ?? undefined,
        lastName: payload.lastName ?? undefined,
        phone: payload.phone ?? undefined,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
        avatar: user.avatar ?? null,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

// 3. Orders
exports.getOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              variant: true,
            },
          },
        },
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    const data = orders.map(mapOrderToDto);

    res.status(200).json({
      success: true,
      data,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            variant: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({
      success: true,
      data: mapOrderToDto(order),
    });
  } catch (error) {
    next(error);
  }
};

// Request COD OTP — POST /api/v1/user/orders/request-cod-otp
exports.requestCodOtp = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { otpId, expiresAt } = await createAndSendCodOtp(userId, null);
    res.status(200).json({
      success: true,
      message: 'OTP sent to your registered email. Valid for 5 minutes.',
      data: { otpId, expiresAt: expiresAt.toISOString() },
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.status === 429) {
      return res.status(429).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// Checkout — POST /api/v1/user/orders/checkout (see CHECKOUT_API.md)
const TAX_RATE = 0.0;
const FREE_SHIPPING_THRESHOLD = 500;
const SHIPPING_COST = 50;

const checkoutAddressSchema = z.object({
  fullName: z.string().min(1, 'fullName is required'),
  phone: z.string().min(1, 'phone is required'),
  email: z.string().email('Invalid email'),
  addressLine1: z.string().min(1, 'addressLine1 is required'),
  addressLine2: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  postOfficeName: z.string().optional(),
  city: z.string().min(1, 'city is required'),
  state: z.string().min(1, 'state is required'),
  country: z.string().min(1, 'country is required'),
});

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  productImage: z.string().optional(),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number(), // ignored; backend recalculates from DB
  color: z.string().optional(),
  size: z.string().optional(),
});

const checkoutBodySchema = z.object({
  shippingAddress: checkoutAddressSchema,
  billingAddress: checkoutAddressSchema.optional(),
  sameAsBilling: z.boolean().optional().default(true),
  paymentMethod: z.enum(['cod', 'card', 'upi', 'netbanking']).optional(),
  codOtp: z.string().length(6).optional(), // required when paymentMethod === 'cod'
  items: z.array(checkoutItemSchema).min(1, 'Cart is empty'),
  subtotal: z.number().optional(),
  shippingCost: z.number().optional(),
  tax: z.number().optional(),
  total: z.number().optional(),
});

function parseDecimal(d) {
  if (d == null) return 0;
  if (typeof d === 'number') return d;
  const n = parseFloat(String(d));
  return Number.isFinite(n) ? n : 0;
}

exports.checkout = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = checkoutBodySchema.parse(req.body);

    if (!payload.items || payload.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const shippingAddress = payload.shippingAddress;
    const phoneDigits = (shippingAddress.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address: phone must have at least 10 digits',
      });
    }

    let billingAddress = payload.sameAsBilling ? { ...shippingAddress } : payload.billingAddress;
    if (!payload.sameAsBilling && billingAddress) {
      const billingDigits = (billingAddress.phone || '').replace(/\D/g, '');
      if (billingDigits.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Billing address: phone must have at least 10 digits',
        });
      }
    }
    if (!billingAddress) billingAddress = { ...shippingAddress };

    const validatedItems = [];
    let calculatedSubtotal = 0;

    for (const it of payload.items) {
      const product = await prisma.product.findUnique({
        where: { id: it.productId },
        include: {
          variants: {
            where: { isActive: true },
            include: { inventory: true },
          },
        },
      });

      if (!product) {
        return res.status(422).json({
          success: false,
          message: `Product not found: ${it.productId}. Your cart may contain items from an older session—please clear your cart and add products again.`,
        });
      }

      if (product.status !== 'published') {
        return res.status(422).json({
          success: false,
          message: `Product is not available: ${product.name}`,
        });
      }

      let unitPrice = parseDecimal(product.basePrice);
      let variantId = null;
      let variantName = null;
      let inventoryQty = 0;
      const isProductSku = it.sku === product.sku;

      if (it.sku && !isProductSku) {
        const variant = product.variants.find((v) => v.sku === it.sku);
        if (!variant || !variant.isActive) {
          return res.status(422).json({
            success: false,
            message: `Variant not found or inactive: ${it.sku}. Please refresh the product and add to cart again with a valid option.`,
          });
        }
        unitPrice = parseDecimal(product.basePrice) + parseDecimal(variant.priceAdjustment);
        variantId = variant.id;
        variantName = variant.name;
        inventoryQty = variant.inventory ? variant.inventory.quantity - (variant.inventory.reservedQty || 0) : 0;
      } else {
        const totalVariantStock = product.variants.reduce((sum, v) => {
          const inv = v.inventory;
          return sum + (inv ? inv.quantity - (inv.reservedQty || 0) : 0);
        }, 0);
        inventoryQty = totalVariantStock;
        if (product.variants.length > 0) {
          const first = product.variants[0];
          variantName = first.name;
        }
      }

      if (inventoryQty < it.quantity) {
        return res.status(422).json({
          success: false,
          message: `Insufficient stock for: ${product.name}`,
        });
      }

      const itemTotal = unitPrice * it.quantity;
      calculatedSubtotal += itemTotal;
      validatedItems.push({
        productId: product.id,
        productName: product.name,
        productImage: it.productImage || null,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice,
        totalPrice: itemTotal,
        variantId,
        variantName,
        color: it.color || null,
        size: it.size || null,
      });
    }

    const taxAmount = 0;
    const shippingAmount =
      calculatedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = Math.round((calculatedSubtotal + shippingAmount) * 100) / 100;

    const paymentMethod = payload.paymentMethod || 'cod';
    const initialStatus =
      paymentMethod === 'cod' ? 'CONFIRMED' : 'PENDING';
    const paymentStatus = paymentMethod === 'cod' ? 'paid' : 'unpaid';

    if (paymentMethod === 'cod') {
      const codOtp = payload.codOtp;
      if (!codOtp || !/^\d{6}$/.test(codOtp)) {
        return res.status(400).json({
          success: false,
          message: 'COD requires a 6-digit OTP. Request OTP first via POST /api/v1/user/orders/request-cod-otp',
        });
      }
      const verification = await verifyCodOtp(userId, codOtp);
      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          message: verification.error || 'Invalid or expired OTP',
        });
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const prefix = `ORD-${year}-`;
      const last = await tx.order.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      const nextNum = last
        ? parseInt(last.orderNumber.slice(prefix.length), 10) + 1
        : 1;
      const orderNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: initialStatus,
          paymentStatus,
          paymentMethod,
          subtotal: calculatedSubtotal,
          taxAmount,
          shippingAmount,
          total,
          shippingAddress: shippingAddress,
          billingAddress: billingAddress,
          sameAsBilling: !!payload.sameAsBilling,
          returnEligible: true,
        },
      });

      for (const it of validatedItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: it.productId,
            variantId: it.variantId,
            productName: it.productName,
            productImage: it.productImage,
            variantName: it.variantName,
            sku: it.sku,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
            color: it.color,
            size: it.size,
          },
        });

        if (it.variantId) {
          await tx.inventory.updateMany({
            where: { variantId: it.variantId },
            data: {
              quantity: { decrement: it.quantity },
            },
          });
        } else {
          const variants = await tx.productVariant.findMany({
            where: { productId: it.productId },
            include: { inventory: true },
          });
          let remaining = it.quantity;
          for (const v of variants) {
            if (remaining <= 0 || !v.inventory) continue;
            const available = v.inventory.quantity - (v.inventory.reservedQty || 0);
            const deduct = Math.min(remaining, available);
            if (deduct > 0) {
              await tx.inventory.updateMany({
                where: { variantId: v.id },
                data: { quantity: { decrement: deduct } },
              });
              remaining -= deduct;
            }
          }
          if (remaining > 0) {
            throw new Error(`Insufficient stock for product ${it.productId}`);
          }
        }
      }

      return newOrder;
    });

    // Non-blocking: send order confirmation to user + admin emails
    const orderWithUserAndItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        items: true,
      },
    });
    if (orderWithUserAndItems) {
      onOrderPlaced(orderWithUserAndItems);
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: decimalToNumber(order.total),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.errors[0];
      const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed';
      return res.status(400).json({ success: false, message: msg, errors: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(500).json({ success: false, message: 'Order creation failed' });
    }
    next(error);
  }
};

const returnRequestSchema = z.object({
  reason: z.string().min(1),
});

exports.requestReturn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { reason } = returnRequestSchema.parse(req.body);

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'DELIVERED' || !order.returnEligible) {
      return res.status(400).json({
        success: false,
        message: 'Order is not eligible for return',
      });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'RETURNED',
        returnEligible: false,
        // In a full implementation, you might persist the reason in a separate model.
      },
    });

    res.status(200).json({
      success: true,
      message: 'Return request submitted',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

// 4. Addresses
const addressSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(5),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  isDefault: z.boolean().optional(),
  label: z.string().optional(),
});

exports.getAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({
      success: true,
      data: addresses.map(mapAddressToDto),
    });
  } catch (error) {
    next(error);
  }
};

exports.createAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = addressSchema.parse(req.body);

    const isDefault = payload.isDefault ?? false;

    const result = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      const address = await tx.address.create({
        data: {
          userId,
          fullName: payload.fullName,
          phone: payload.phone,
          addressLine1: payload.addressLine1,
          addressLine2: payload.addressLine2 ?? null,
          city: payload.city,
          state: payload.state,
          postalCode: payload.postalCode,
          country: payload.country,
          isDefault,
          label: payload.label ?? null,
        },
      });

      return address;
    });

    res.status(201).json({
      success: true,
      data: mapAddressToDto(result),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

exports.updateAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;
    const payload = addressSchema.partial().parse(req.body);

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const isDefault = payload.isDefault;

    const result = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      const updated = await tx.address.update({
        where: { id: addressId },
        data: {
          fullName: payload.fullName ?? undefined,
          phone: payload.phone ?? undefined,
          addressLine1: payload.addressLine1 ?? undefined,
          addressLine2: payload.addressLine2 ?? undefined,
          city: payload.city ?? undefined,
          state: payload.state ?? undefined,
          postalCode: payload.postalCode ?? undefined,
          country: payload.country ?? undefined,
          isDefault: isDefault ?? undefined,
          label: payload.label ?? undefined,
        },
      });

      return updated;
    });

    res.status(200).json({
      success: true,
      data: mapAddressToDto(result),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    res.status(200).json({
      success: true,
      message: 'Address deleted',
    });
  } catch (error) {
    next(error);
  }
};

exports.setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });

    res.status(200).json({
      success: true,
      data: mapAddressToDto(updated),
    });
  } catch (error) {
    next(error);
  }
};

// 5. Wishlist
exports.getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const items = await prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        product: {
          include: {
            category: { select: { name: true, slug: true } },
            variants: true,
          },
        },
      },
    });

    const productIds = items.map((item) => item.productId);
    const richById = new Map();

    if (productIds.length) {
      const richDocs = await ProductRichContent.find(
        { pg_id: { $in: productIds } },
        { pg_id: 1, description_html: 1, media_gallery: 1 }
      ).lean();

      richDocs.forEach((doc) => {
        if (doc && doc.pg_id) {
          richById.set(String(doc.pg_id), doc);
        }
      });
    }

    const data = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      addedAt: item.addedAt.toISOString(),
      product: {
        ...item.product,
        richContent: richById.get(String(item.productId)) || null,
      },
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const wishlistSchema = z.object({
  productId: z.string().min(1),
});

exports.addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = wishlistSchema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { name: true, slug: true } },
        variants: true,
      },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const item = await prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      create: {
        userId,
        productId,
      },
      update: {},
      include: {
        product: {
          include: {
            category: { select: { name: true, slug: true } },
            variants: true,
          },
        },
      },
    });

    const richDoc = await ProductRichContent.findOne(
      { pg_id: productId },
      { pg_id: 1, description_html: 1, media_gallery: 1 }
    ).lean();

    res.status(201).json({
      success: true,
      data: {
        id: item.id,
        productId: item.productId,
        addedAt: item.addedAt.toISOString(),
        product: {
          ...item.product,
          richContent: richDoc || null,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

exports.removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const existing = await prisma.wishlistItem.findFirst({
      where: { id: itemId, userId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Wishlist item not found' });
    }

    await prisma.wishlistItem.delete({
      where: { id: itemId },
    });

    res.status(200).json({
      success: true,
      message: 'Removed from wishlist',
    });
  } catch (error) {
    next(error);
  }
};

// 6. Saved cards
exports.getSavedCards = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cards = await prisma.savedCard.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    const data = cards.map((card) => ({
      id: card.id,
      cardType: card.cardType,
      last4: card.last4,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      holderName: card.holderName,
      isDefault: card.isDefault,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteSavedCard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { cardId } = req.params;

    const existing = await prisma.savedCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    await prisma.savedCard.delete({
      where: { id: cardId },
    });

    res.status(200).json({
      success: true,
      message: 'Card removed',
    });
  } catch (error) {
    next(error);
  }
};

// 7. Notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const data = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      link: n.link ?? null,
      createdAt: n.createdAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notifId } = req.params;

    const existing = await prisma.notification.findFirst({
      where: { id: notifId, userId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

