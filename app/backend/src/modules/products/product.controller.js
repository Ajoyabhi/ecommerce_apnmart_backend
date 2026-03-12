const { prisma } = require('../../config/database');
const { ProductRichContent } = require('../../models');
const { z } = require('zod');
const logger = require('../../utils/logger');

const productSchema = z.object({
    sku: z.string().min(3),
    name: z.string().min(2),
    slug: z.string().min(2),
    basePrice: z.number().positive(),
    categoryId: z.string().uuid(),
    brand: z.string().optional().nullable(),
    status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
    isFeatured: z.boolean().optional().default(false),
    initialStock: z.number().int().nonnegative().optional().default(0),
    // Rich Content (Mongo)
    descriptionHtml: z.string().optional(),
    lifestyleTags: z.array(z.string()).optional(),
    attributes: z.any().optional(),
    mediaGallery: z.array(z.any()).optional(),
    variants: z
        .array(
            z.object({
                size: z.string().optional(),
                color: z.string().optional(),
                stock: z.number().int().nonnegative().optional()
            })
        )
        .optional()
});

const updateProductSchema = productSchema.partial();

exports.createProduct = async (req, res, next) => {
    try {
        const validatedData = productSchema.parse(req.body);

        // 1. Create in PostgreSQL (Master Data)
        const pgProduct = await prisma.product.create({
            data: {
                sku: validatedData.sku,
                name: validatedData.name,
                slug: validatedData.slug,
                basePrice: validatedData.basePrice,
                categoryId: validatedData.categoryId,
                brand: validatedData.brand ?? undefined,
                status: validatedData.status,
                isFeatured: validatedData.isFeatured
            }
        });

        // 2. Create in MongoDB (Rich Content)
        try {
            await ProductRichContent.create({
                pg_id: pgProduct.id,
                description_html: validatedData.descriptionHtml,
                lifestyle_tags: validatedData.lifestyleTags,
                attributes: validatedData.attributes,
                media_gallery: validatedData.mediaGallery
            });

            // 3. Create variants + inventory so product appears in inventory admin
            const variantsInput = Array.isArray(validatedData.variants) ? validatedData.variants : [];
            if (variantsInput.length) {
                let idx = 1;
                for (const v of variantsInput) {
                    const size = v.size;
                    const color = v.color;
                    const nameParts = [];
                    if (color) nameParts.push(color);
                    if (size) nameParts.push(size);
                    const name = nameParts.length ? nameParts.join(' / ') : 'Default';
                    const sku = `${validatedData.sku}-${String(idx).padStart(2, '0')}`;
                    const options = {};
                    if (color) options.color = color;
                    if (size) options.size = size;

                    await prisma.productVariant.create({
                        data: {
                            productId: pgProduct.id,
                            sku,
                            name,
                            options,
                            priceAdjustment: 0,
                            inventory: {
                                create: {
                                    quantity:
                                        typeof v.stock === 'number'
                                            ? v.stock
                                            : validatedData.initialStock ?? 0,
                                    lowThreshold: 5
                                }
                            }
                        }
                    });
                    idx += 1;
                }
            } else {
                // Fallback: single default variant
                await prisma.productVariant.create({
                    data: {
                        productId: pgProduct.id,
                        sku: validatedData.sku,
                        name: 'Default',
                        options: {},
                        priceAdjustment: 0,
                        inventory: {
                            create: {
                                quantity: validatedData.initialStock ?? 0,
                                lowThreshold: 5
                            }
                        }
                    }
                });
            }
        } catch (mongoError) {
            // Rollback PG if Mongo fails for atomicity
            await prisma.product.delete({ where: { id: pgProduct.id } });
            throw mongoError;
        }

        res.status(201).json({ success: true, data: pgProduct });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        next(error);
    }
};

exports.updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const validatedData = updateProductSchema.parse(req.body);

        // Update core product fields in PostgreSQL
        const pgUpdateData = {};
        if (validatedData.sku !== undefined) pgUpdateData.sku = validatedData.sku;
        if (validatedData.name !== undefined) pgUpdateData.name = validatedData.name;
        if (validatedData.slug !== undefined) pgUpdateData.slug = validatedData.slug;
        if (validatedData.basePrice !== undefined) pgUpdateData.basePrice = validatedData.basePrice;
        if (validatedData.categoryId !== undefined) pgUpdateData.categoryId = validatedData.categoryId;
        if (validatedData.brand !== undefined) pgUpdateData.brand = validatedData.brand ?? undefined;
        if (validatedData.status !== undefined) pgUpdateData.status = validatedData.status;
        if (validatedData.isFeatured !== undefined) pgUpdateData.isFeatured = validatedData.isFeatured;

        const pgProduct = Object.keys(pgUpdateData).length
            ? await prisma.product.update({
                  where: { id },
                  data: pgUpdateData
              })
            : existing;

        // Update rich content in MongoDB (description, media, attributes, etc.)
        const richUpdate = {};
        if (validatedData.descriptionHtml !== undefined) {
            richUpdate.description_html = validatedData.descriptionHtml;
        }
        if (validatedData.lifestyleTags !== undefined) {
            richUpdate.lifestyle_tags = validatedData.lifestyleTags;
        }
        if (validatedData.attributes !== undefined) {
            richUpdate.attributes = validatedData.attributes;
        }
        if (validatedData.mediaGallery !== undefined) {
            richUpdate.media_gallery = validatedData.mediaGallery;
        }

        if (Object.keys(richUpdate).length) {
            await ProductRichContent.findOneAndUpdate(
                { pg_id: pgProduct.id },
                { $set: richUpdate },
                { upsert: true, new: true }
            );
        }

        res.status(200).json({ success: true, data: pgProduct });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        next(error);
    }
};

function getSegmentPriorityFromSlug(slug) {
    if (!slug || typeof slug !== 'string') return 99;
    const s = slug.toLowerCase();
    if (s === 'fashion' || s.startsWith('fashion-')) return 0;
    if (s === 'beauty' || s.startsWith('beauty-')) return 1;
    return 2;
}

exports.getProducts = async (req, res, next) => {
    try {
        const {
            category,
            subcategory,
            sub_subcategory,
            brand,
            price_min,
            price_max,
            size,
            color,
            sort,
            page,
            limit,
            featured,
            status,
            q
        } = req.query;

        const where = {};
        if (status) where.status = status;
        else where.status = 'published';
        if (featured !== undefined && featured !== '') where.isFeatured = featured === 'true';

        // Site-wide text search: name, slug, SKU, brand (case-insensitive)
        const searchTerm = typeof q === 'string' ? q.trim() : '';
        if (searchTerm) {
            where.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { slug: { contains: searchTerm, mode: 'insensitive' } },
                { sku: { contains: searchTerm, mode: 'insensitive' } },
                { brand: { contains: searchTerm, mode: 'insensitive' } }
            ];
        }

        const categorySlug = sub_subcategory || subcategory || category;
        if (categorySlug) {
            const cat = await prisma.category.findFirst({
                where: { slug: String(categorySlug).toLowerCase() },
                include: {
                    children: {
                        include: { children: { select: { id: true } } }
                    }
                }
            });
            if (cat) {
                const ids = [cat.id];
                if (cat.children && cat.children.length) {
                    cat.children.forEach((child) => {
                        ids.push(child.id);
                        if (child.children && child.children.length) {
                            child.children.forEach((cc) => ids.push(cc.id));
                        }
                    });
                }
                where.categoryId = { in: ids };
            } else {
                where.categoryId = { in: [] };
            }
        }

        if (brand !== undefined && brand !== '') {
            where.brand = String(brand).trim();
        }

        const priceCond = {};
        if (price_min !== undefined && price_min !== '') {
            const min = parseFloat(price_min);
            if (!Number.isNaN(min)) priceCond.gte = min;
        }
        if (price_max !== undefined && price_max !== '') {
            const max = parseFloat(price_max);
            if (!Number.isNaN(max)) priceCond.lte = max;
        }
        if (Object.keys(priceCond).length) where.basePrice = priceCond;

        const variantConds = [];
        if (size !== undefined && size !== '') {
            variantConds.push({ options: { path: ['size'], equals: String(size) } });
        }
        if (color !== undefined && color !== '') {
            variantConds.push({ options: { path: ['color'], equals: String(color) } });
        }
        if (variantConds.length) {
            where.variants = { some: variantConds.length === 1 ? variantConds[0] : { AND: variantConds } };
        }

        const orderBy = [];
        switch (sort) {
            case 'price_asc':
            case 'price_low':
                orderBy.push({ basePrice: 'asc' });
                break;
            case 'price_desc':
            case 'price_high':
                orderBy.push({ basePrice: 'desc' });
                break;
            case 'random':
                // Handled below with seeded shuffle + pagination
                break;
            case 'newest':
            default:
                orderBy.push({ createdAt: 'desc' });
                break;
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const maxLimit = searchTerm ? 1000 : 100; // no constraint on search results page
        const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || (searchTerm ? 1000 : 24)));
        const skip = (pageNum - 1) * limitNum;

        const total = await prisma.product.count({ where });

        let products;
        if (sort === 'random' && !searchTerm) {
            // Random order with optional seed for consistent pagination (max 10k ids in memory)
            const RANDOM_MAX_IDS = 10000;
            if (total > RANDOM_MAX_IDS) {
                // Fall back to newest when too many products
                products = await prisma.product.findMany({
                    where,
                    include: { category: { select: { name: true, slug: true } } },
                    orderBy: [{ createdAt: 'desc' }],
                    skip,
                    take: limitNum
                });
            } else {
                const seedParam = req.query.seed;
                const seed = seedParam !== undefined && seedParam !== '' ? parseFloat(seedParam) : 0.5;
                const allIds = await prisma.product.findMany({
                    where,
                    select: { id: true },
                    orderBy: [{ id: 'asc' }]
                });
                const ids = allIds.map((p) => p.id);
                // Seeded shuffle (deterministic for same seed)
                const seededShuffle = (arr, s) => {
                    const a = [...arr];
                    let m = a.length;
                    const random = () => {
                        s = Math.sin(s * 9999) * 10000;
                        return s - Math.floor(s);
                    };
                    while (m) {
                        const i = Math.floor(random() * m--);
                        [a[m], a[i]] = [a[i], a[m]];
                    }
                    return a;
                };
                const shuffled = seededShuffle(ids, seed);
                const pageIds = shuffled.slice(skip, skip + limitNum);
                if (pageIds.length === 0) {
                    products = [];
                } else {
                    const byId = new Map(pageIds.map((id, i) => [id, i]));
                    const found = await prisma.product.findMany({
                        where: { id: { in: pageIds } },
                        include: { category: { select: { name: true, slug: true } } }
                    });
                    products = found.sort((a, b) => byId.get(a.id) - byId.get(b.id));
                }
            }
        } else {
            products = await prisma.product.findMany({
                where,
                include: { category: { select: { name: true, slug: true } } },
                orderBy: orderBy.length ? orderBy : [{ createdAt: 'desc' }],
                skip,
                take: limitNum
            });
        }

        // Reorder so that Fashion products come first, then Beauty, then others,
        // while preserving the original order within each segment.
        if (Array.isArray(products) && products.length > 1) {
            const indexed = products.map((p, idx) => ({
                p,
                idx,
                seg: getSegmentPriorityFromSlug(p.category?.slug)
            }));
            indexed.sort((a, b) => {
                if (a.seg !== b.seg) return a.seg - b.seg;
                return a.idx - b.idx;
            });
            products = indexed.map((x) => x.p);
        }

        // Attach primary rich content (images, description) for listing cards
        const productIds = products.map((p) => p.id);
        let productsWithRich = products;
        if (productIds.length) {
            const richDocs = await ProductRichContent.find(
                { pg_id: { $in: productIds } },
                { pg_id: 1, description_html: 1, media_gallery: 1 }
            ).lean();

            const richById = new Map();
            richDocs.forEach((doc) => {
                if (doc && doc.pg_id) {
                    richById.set(doc.pg_id, doc);
                }
            });

            productsWithRich = products.map((p) => ({
                ...p,
                richContent: richById.get(p.id) || null
            }));
        }

        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({
            success: true,
            count: products.length,
            total,
            page: pageNum,
            limit: limitNum,
            data: productsWithRich
        });
    } catch (error) {
        next(error);
    }
};

exports.getProductBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const pgProduct = await prisma.product.findUnique({
            where: { slug },
            include: {
                category: true,
                variants: {
                    include: { inventory: true }
                }
            }
        });

        if (!pgProduct) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Fetch rich content from MongoDB
        const mongoContent = await ProductRichContent.findOne({ pg_id: pgProduct.id });

        res.status(200).json({
            success: true,
            data: {
                ...pgProduct,
                richContent: mongoContent
            }
        });
    } catch (error) {
        next(error);
    }
};
