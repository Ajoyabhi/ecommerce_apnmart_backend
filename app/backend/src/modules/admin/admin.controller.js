const { prisma } = require('../../config/database');
const { AdminLog, HeroBanner, CategoryFeedSection } = require('../../models');
const logger = require('../../utils/logger');
const { z } = require('zod');
const { sendOrderStatusChangeToUser } = require('../../services/orderEmail.service');

// ----- Admin Orders (ADMIN_ORDERS_API.md) -----
function decimalToNum(d) {
    if (d == null) return 0;
    if (typeof d === 'number') return d;
    const n = parseFloat(String(d));
    return Number.isFinite(n) ? n : 0;
}

function mapOrderToAdminDto(order) {
    const user = order.user;
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        user: user
            ? {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone ?? null,
            }
            : null,
        status: order.status,
        total: decimalToNum(order.total),
        subtotal: decimalToNum(order.subtotal),
        shippingCost: decimalToNum(order.shippingAmount),
        tax: decimalToNum(order.taxAmount),
        paymentMethod: order.paymentMethod ?? null,
        paymentStatus: (order.paymentStatus || 'unpaid').toUpperCase(),
        trackingNumber: order.trackingNumber ?? null,
        shippingAddress: order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : null,
        billingAddress: order.billingAddress && typeof order.billingAddress === 'object' ? order.billingAddress : null,
        sameAsBilling: order.sameAsBilling ?? true,
        items: (order.items || []).map((it) => ({
            id: it.id,
            productId: it.productId,
            variantId: it.variantId ?? null,
            name: it.productName,
            image: it.productImage ?? null,
            color: it.color ?? null,
            size: it.size ?? null,
            quantity: it.quantity,
            price: decimalToNum(it.unitPrice),
        })),
        adminNotes: order.adminNotes ?? null,
        createdAt: order.createdAt?.toISOString?.() ?? null,
        updatedAt: order.updatedAt?.toISOString?.() ?? null,
        deliveredAt: order.deliveredAt?.toISOString?.() ?? null,
        returnEligible: order.returnEligible ?? false,
    };
}

const VALID_STATUS_TRANSITIONS = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'RETURNED'],
    DELIVERED: ['RETURNED'],
    RETURNED: ['REFUNDED'],
    CANCELLED: [],
    REFUNDED: [],
};

exports.listOrders = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : null;
        const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : null;
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
        const sort = req.query.sort || 'latest';

        const where = {};

        if (status) where.status = status;
        if (userId) where.userId = userId;
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { user: { firstName: { contains: search, mode: 'insensitive' } } },
                { user: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const orderBy =
            sort === 'oldest'
                ? { createdAt: 'asc' }
                : sort === 'amount_high'
                ? { total: 'desc' }
                : sort === 'amount_low'
                ? { total: 'asc' }
                : { createdAt: 'desc' };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                    items: true,
                },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.order.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit) || 1;

        res.status(200).json({
            success: true,
            data: {
                orders: orders.map(mapOrderToAdminDto),
                total,
                page,
                limit,
                totalPages,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.getOrderById = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
                items: true,
            },
        });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        res.status(200).json({ success: true, data: mapOrderToAdminDto(order) });
    } catch (error) {
        next(error);
    }
};

const updateStatusSchema = z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED']),
    trackingNumber: z.string().optional(),
    adminNotes: z.string().optional(),
});

exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const payload = updateStatusSchema.parse(req.body);

        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const current = String(order.status).toUpperCase();
        const allowed = VALID_STATUS_TRANSITIONS[current];
        if (!allowed || !allowed.includes(payload.status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status transition from ${current} to ${payload.status}`,
            });
        }

        const updates = { status: payload.status };
        if (payload.trackingNumber !== undefined) updates.trackingNumber = payload.trackingNumber || null;
        if (payload.status === 'DELIVERED') updates.deliveredAt = new Date();
        if (payload.adminNotes) {
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            updates.adminNotes = order.adminNotes
                ? `${order.adminNotes}\n[${timestamp}] ${payload.adminNotes}`
                : `[${timestamp}] ${payload.adminNotes}`;
        }

        const updated = await prisma.order.update({
            where: { id: orderId },
            data: updates,
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } }, items: true },
        });

        // Send status change email only when status actually changed
        if (String(current) !== String(payload.status)) {
            sendOrderStatusChangeToUser(updated, payload.status, payload.trackingNumber ?? updated.trackingNumber);
        }

        res.status(200).json({ success: true, data: mapOrderToAdminDto(updated) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors[0]?.message || 'Validation failed' });
        }
        next(error);
    }
};

const updatePaymentStatusSchema = z.object({
    paymentStatus: z.enum(['UNPAID', 'PAID', 'VERIFIED', 'REFUNDED', 'FAILED']),
    adminNotes: z.string().optional(),
});

exports.updateOrderPaymentStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const payload = updatePaymentStatusSchema.parse(req.body);

        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const paymentStatus = payload.paymentStatus.toLowerCase();
        const updates = { paymentStatus };
        if (payload.adminNotes) {
            const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
            updates.adminNotes = order.adminNotes
                ? `${order.adminNotes}\n[${timestamp}] ${payload.adminNotes}`
                : `[${timestamp}] ${payload.adminNotes}`;
        }

        const updated = await prisma.order.update({
            where: { id: orderId },
            data: updates,
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } }, items: true },
        });

        res.status(200).json({ success: true, data: mapOrderToAdminDto(updated) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors[0]?.message || 'Validation failed' });
        }
        next(error);
    }
};

const cancelOrderSchema = z.object({
    reason: z.string().optional(),
});

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING'];

exports.cancelOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const payload = cancelOrderSchema.parse(req.body);

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true, items: true },
        });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const current = String(order.status).toUpperCase();
        if (!CANCELLABLE_STATUSES.includes(current)) {
            return res.status(400).json({
                success: false,
                error: `Order cannot be cancelled in current state (${current})`,
            });
        }

        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const noteLine = payload.reason ? `[${timestamp}] Cancelled: ${payload.reason}` : `[${timestamp}] Order cancelled`;

        await prisma.$transaction(async (tx) => {
            for (const item of order.items) {
                if (item.variantId) {
                    await tx.inventory.updateMany({
                        where: { variantId: item.variantId },
                        data: { quantity: { increment: item.quantity } },
                    });
                }
            }
            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'CANCELLED',
                    adminNotes: order.adminNotes ? `${order.adminNotes}\n${noteLine}` : noteLine,
                },
            });
        });

        const updated = await prisma.order.findUnique({
            where: { id: orderId },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } }, items: true },
        });

        if (updated && String(order.status) !== 'CANCELLED') {
            sendOrderStatusChangeToUser(updated, 'CANCELLED', null);
        }

        res.status(200).json({ success: true, data: mapOrderToAdminDto(updated) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors[0]?.message || 'Validation failed' });
        }
        next(error);
    }
};

const addNoteSchema = z.object({
    note: z.string().min(1, 'Note is required'),
});

exports.addOrderNote = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const payload = addNoteSchema.parse(req.body);

        const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const newNote = `[${timestamp}] ${payload.note}`;
        const adminNotes = order.adminNotes ? `${order.adminNotes}\n${newNote}` : newNote;

        const updated = await prisma.order.update({
            where: { id: orderId },
            data: { adminNotes },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } }, items: true },
        });

        res.status(200).json({ success: true, data: mapOrderToAdminDto(updated) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors[0]?.message || 'Validation failed' });
        }
        next(error);
    }
};

// ----- End Admin Orders -----

exports.getInventory = async (req, res, next) => {
    try {
        const inventory = await prisma.inventory.findMany({
            include: {
                variant: {
                    include: { product: true }
                }
            }
        });
        res.status(200).json({ success: true, count: inventory.length, data: inventory });
    } catch (error) {
        next(error);
    }
};

// image/mobile_image can be full URL or stored path (e.g. products/uuid.webp from upload)
const heroBannerSchema = z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    image: z.string().min(1),
    mobile_image: z.string().optional().nullable(),
    redirect_url: z.string().optional().nullable(),
    color: z.string().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().optional(),
    priority: z.number().optional(),
    validFrom: z.string().datetime().optional().nullable(),
    validTo: z.string().datetime().optional().nullable(),
});

exports.getHeroBannersAdmin = async (req, res, next) => {
    try {
        const banners = await HeroBanner.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
        res.status(200).json({
            success: true,
            count: banners.length,
            data: banners.map((b) => ({
                id: b._id.toString(),
                title: b.title,
                subtitle: b.subtitle,
                image: b.image,
                mobile_image: b.mobile_image,
                redirect_url: b.redirect_url,
                color: b.color || 'text-white',
                isActive: b.isActive,
                sortOrder: b.sortOrder ?? 0,
                priority: b.priority ?? 0,
                validFrom: b.validFrom,
                validTo: b.validTo,
            }))
        });
    } catch (error) {
        next(error);
    }
};

exports.createHeroBanner = async (req, res, next) => {
    try {
        const payload = heroBannerSchema.parse(req.body);
        const banner = await HeroBanner.create({
            title: payload.title,
            subtitle: payload.subtitle,
            image: payload.image,
            mobile_image: payload.mobile_image ?? undefined,
            redirect_url: payload.redirect_url ?? undefined,
            color: payload.color || 'text-white',
            isActive: payload.isActive ?? true,
            sortOrder: payload.sortOrder ?? 0,
            priority: payload.priority ?? 0,
            validFrom: payload.validFrom ? new Date(payload.validFrom) : undefined,
            validTo: payload.validTo ? new Date(payload.validTo) : undefined,
        });

        res.status(201).json({
            success: true,
            data: {
                id: banner._id.toString(),
                title: banner.title,
                subtitle: banner.subtitle,
                image: banner.image,
                mobile_image: banner.mobile_image,
                redirect_url: banner.redirect_url,
                color: banner.color,
                isActive: banner.isActive,
                sortOrder: banner.sortOrder,
                priority: banner.priority,
                validFrom: banner.validFrom,
                validTo: banner.validTo,
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        next(error);
    }
};

exports.updateHeroBanner = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payload = heroBannerSchema.partial().parse(req.body);
        const set = { ...payload };
        if (payload.validFrom !== undefined) set.validFrom = payload.validFrom ? new Date(payload.validFrom) : null;
        if (payload.validTo !== undefined) set.validTo = payload.validTo ? new Date(payload.validTo) : null;

        const banner = await HeroBanner.findByIdAndUpdate(
            id,
            { $set: set },
            { new: true }
        );

        if (!banner) {
            return res.status(404).json({ success: false, message: 'Hero banner not found' });
        }

        res.status(200).json({
            success: true,
            data: {
                id: banner._id.toString(),
                title: banner.title,
                subtitle: banner.subtitle,
                image: banner.image,
                mobile_image: banner.mobile_image,
                redirect_url: banner.redirect_url,
                color: banner.color,
                isActive: banner.isActive,
                sortOrder: banner.sortOrder,
                priority: banner.priority,
                validFrom: banner.validFrom,
                validTo: banner.validTo,
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        next(error);
    }
};

exports.deleteHeroBanner = async (req, res, next) => {
    try {
        const { id } = req.params;
        const banner = await HeroBanner.findByIdAndDelete(id);

        if (!banner) {
            return res.status(404).json({ success: false, message: 'Hero banner not found' });
        }

        res.status(200).json({ success: true, message: 'Hero banner deleted' });
    } catch (error) {
        next(error);
    }
};

exports.updateStock = async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const { quantity } = req.body;

        const inventory = await prisma.inventory.update({
            where: { variantId },
            data: { quantity }
        });

        // Audit Log in MongoDB
        await AdminLog.create({
            admin_id: req.user.id,
            action: 'UPDATE_STOCK',
            entity_type: 'inventory',
            entity_id: variantId,
            changes: { after: { quantity } },
            ip_address: req.ip
        });

        res.status(200).json({ success: true, data: inventory });
    } catch (error) {
        next(error);
    }
};

exports.getDashboardStats = async (req, res, next) => {
    try {
        const totalOrders = await prisma.order.count();
        const totalRevenue = await prisma.order.aggregate({
            _sum: { total: true },
            where: { status: { not: 'CANCELLED' } }
        });
        const lowStockCount = await prisma.inventory.count({
            where: { quantity: { lte: prisma.inventory.lowThreshold } } // Note: This logic might need raw query or specific check
        });

        res.status(200).json({
            success: true,
            data: {
                totalOrders,
                totalRevenue: totalRevenue._sum.total || 0,
                lowStockCount
            }
        });
    } catch (error) {
        next(error);
    }
};

const categoryFeedSectionSchema = z.object({
    categorySlug: z.string().min(1),
    type: z.enum(['carousel', 'product_grid', 'brand_slider', 'banner', 'product_slider']),
    title: z.string().min(1),
    image: z.string().url().optional(),
    mobile_image: z.string().url().optional(),
    redirect_url: z.string().url().optional(),
    displayOrder: z.number().optional(),
    isActive: z.boolean().optional(),
    items: z.array(z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        image: z.string().optional(),
        price: z.number().optional(),
        slug: z.string().optional(),
        brand_id: z.string().optional(),
        logo: z.string().optional(),
    })).optional(),
});

exports.getCategoryFeedSectionsAdmin = async (req, res, next) => {
    try {
        const { categorySlug } = req.query;
        const filter = categorySlug ? { categorySlug: String(categorySlug).toLowerCase() } : {};
        const sections = await CategoryFeedSection.find(filter).sort({ displayOrder: 1 }).lean();
        res.status(200).json({ success: true, count: sections.length, data: sections.map((s) => ({ ...s, id: s._id.toString() })) });
    } catch (error) {
        next(error);
    }
};

exports.createCategoryFeedSection = async (req, res, next) => {
    try {
        const payload = categoryFeedSectionSchema.parse(req.body);
        const section = await CategoryFeedSection.create({
            categorySlug: payload.categorySlug.toLowerCase(),
            type: payload.type,
            title: payload.title,
            image: payload.image,
            mobile_image: payload.mobile_image,
            redirect_url: payload.redirect_url,
            displayOrder: payload.displayOrder ?? 0,
            isActive: payload.isActive ?? true,
            items: payload.items ?? [],
        });
        res.status(201).json({ success: true, data: { id: section._id.toString(), ...section.toObject() } });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ success: false, errors: error.errors });
        next(error);
    }
};

exports.updateCategoryFeedSection = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payload = categoryFeedSectionSchema.partial().parse(req.body);
        if (payload.categorySlug) payload.categorySlug = payload.categorySlug.toLowerCase();
        const section = await CategoryFeedSection.findByIdAndUpdate(id, { $set: payload }, { new: true });
        if (!section) return res.status(404).json({ success: false, message: 'Category feed section not found' });
        res.status(200).json({ success: true, data: { id: section._id.toString(), ...section.toObject() } });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ success: false, errors: error.errors });
        next(error);
    }
};

exports.deleteCategoryFeedSection = async (req, res, next) => {
    try {
        const { id } = req.params;
        const section = await CategoryFeedSection.findByIdAndDelete(id);
        if (!section) return res.status(404).json({ success: false, message: 'Category feed section not found' });
        res.status(200).json({ success: true, message: 'Category feed section deleted' });
    } catch (error) {
        next(error);
    }
};
