/**
 * Seed Beauty category and products from makeup_data.json.
 *
 * 1. Deletes existing beauty products and beauty categories only (leaves Fashion/other data intact).
 * 2. Reads: backend/product_images/makeup_data.json
 * 3. Builds category tree: Beauty (root) → one subcategory per product_type (Blush, Bronzer, Eyebrow, Eyeliner, Eyeshadow, Foundation, Lip Liner, Lipstick, Mascara, Nail Polish).
 * 4. Creates products with: name, brand, price (converted to INR), description, image_link, tag_list, product_colors in attributes.
 *
 * Usage:
 *   npm run seed:beauty
 *   BEAUTY_JSON_PATH=./product_images/makeup_data.json BEAUTY_SEED_LIMIT=100 npm run seed:beauty
 *
 * Env: DATABASE_URL, MONGODB_URI
 *      Optional: BEAUTY_JSON_PATH, BEAUTY_SEED_LIMIT (max products to create)
 */

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { ProductRichContent } = require('../src/models');
require('dotenv').config();

const prisma = new PrismaClient();

const JSON_PATH = process.env.BEAUTY_JSON_PATH || path.join(__dirname, '../product_images/makeup_data.json');
const SEED_LIMIT = process.env.BEAUTY_SEED_LIMIT ? parseInt(process.env.BEAUTY_SEED_LIMIT, 10) : null;

function slugify(str) {
    if (!str || typeof str !== 'string') return 'uncategorized';
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'uncategorized';
}

/** product_type slug -> display name */
const PRODUCT_TYPE_NAMES = {
    blush: 'Blush',
    bronzer: 'Bronzer',
    eyebrow: 'Eyebrow',
    eyeliner: 'Eyeliner',
    eyeshadow: 'Eyeshadow',
    foundation: 'Foundation',
    lip_liner: 'Lip Liner',
    lipstick: 'Lipstick',
    mascara: 'Mascara',
    nail_polish: 'Nail Polish'
};

/** Price to INR (JSON has $, CAD, etc.) */
function toInrPrice(p) {
    const num = typeof p === 'number' && !Number.isNaN(p) ? p : parseFloat(String(p).replace(/[^0-9.]/g, ''), 10);
    if (!Number.isFinite(num) || num <= 0) return Math.floor(299 + Math.random() * 500);
    return Math.round(num * 83);
}

/** Normalize image URL (support protocol-relative //) */
function imageUrl(link, featured) {
    const url = (link && String(link).trim()) || (featured && String(featured).trim());
    if (!url) return null;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('http')) return url;
    return 'https://' + url.replace(/^\/+/, '');
}

/** Delete only beauty products and beauty categories */
async function deleteBeautyData() {
    const beautyCategories = await prisma.category.findMany({
        where: { OR: [{ slug: 'beauty' }, { slug: { startsWith: 'beauty-' } }] },
        select: { id: true, slug: true }
    });
    const beautyCatIds = beautyCategories.map(c => c.id);
    if (beautyCatIds.length === 0) {
        console.log('No existing beauty categories to delete.');
        return;
    }

    const beautyProducts = await prisma.product.findMany({
        where: { categoryId: { in: beautyCatIds } },
        select: { id: true }
    });
    const productIds = beautyProducts.map(p => p.id);
    if (productIds.length > 0) {
        await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.product.deleteMany({ where: { id: { in: productIds } } });
        await ProductRichContent.deleteMany({ pg_id: { $in: productIds } });
        console.log('Deleted', productIds.length, 'beauty products and related data.');
    }

    const rootId = beautyCategories.find(c => c.slug === 'beauty')?.id;
    const childIds = beautyCatIds.filter(id => id !== rootId);
    for (const id of childIds) {
        await prisma.category.delete({ where: { id } }).catch(() => {});
    }
    if (rootId) await prisma.category.delete({ where: { id: rootId } }).catch(() => {});
    console.log('Deleted beauty categories.');
}

/** Build Beauty → product_type subcategories; return slugToId */
async function createBeautyCategories(slugToId) {
    let sortOrder = await prisma.category.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }).then(c => (c?.sortOrder ?? -1) + 1);

    const beautyRoot = await prisma.category.create({
        data: {
            name: 'Beauty',
            slug: 'beauty',
            description: 'Makeup and beauty products.',
            imageUrl: null,
            parentId: null,
            sortOrder: sortOrder++,
            isActive: true
        }
    });
    slugToId['beauty'] = beautyRoot.id;

    for (const [typeSlug, displayName] of Object.entries(PRODUCT_TYPE_NAMES)) {
        const leafSlug = `beauty-${typeSlug}`;
        const cat = await prisma.category.create({
            data: {
                name: displayName,
                slug: leafSlug,
                description: null,
                imageUrl: null,
                parentId: beautyRoot.id,
                sortOrder: sortOrder++,
                isActive: true
            }
        });
        slugToId[leafSlug] = cat.id;
    }

    return slugToId;
}

async function run() {
    console.log('Reading JSON:', JSON_PATH);
    const raw = fs.readFileSync(JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : (data.products || data.items || []);
    console.log('Products in JSON:', items.length);

    await mongoose.connect(process.env.MONGODB_URI);

    await deleteBeautyData();
    const slugToId = {};
    await createBeautyCategories(slugToId);
    console.log('Beauty categories created:', Object.keys(PRODUCT_TYPE_NAMES).length, 'subcategories.');

    const toProcess = SEED_LIMIT ? items.slice(0, SEED_LIMIT) : items;
    let created = 0;
    let skipped = 0;
    const seenSlug = new Set();

    for (let i = 0; i < toProcess.length; i++) {
        const p = toProcess[i];
        const productType = (p.product_type || '').trim().toLowerCase().replace(/\s+/g, '_') || 'lipstick';
        const leafSlug = `beauty-${productType}`;
        const categoryId = slugToId[leafSlug];
        if (!categoryId) {
            skipped++;
            continue;
        }

        const name = (p.name || `Beauty Product ${i + 1}`).trim().slice(0, 255);
        if (!name) {
            skipped++;
            continue;
        }

        const basePrice = toInrPrice(p.price);
        const sku = `BEAUTY-${p.id || i}-${String(i).padStart(4, '0')}`;
        const slugBase = slugify(name).slice(0, 50);
        let slug = `beauty-${slugBase}-${i}`;
        let idx = 0;
        while (seenSlug.has(slug)) {
            slug = `beauty-${slugBase}-${i}-${idx++}`;
        }
        seenSlug.add(slug);

        const imgUrl = imageUrl(p.image_link, p.api_featured_image);
        const mediaGallery = imgUrl
            ? [{ url: imgUrl, type: 'image', alt: name, order: 1, is_primary: true }]
            : [];

        const desc = (p.description || '').trim();
        const descriptionHtml = desc
            ? `<p>${desc.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;')}</p>`
            : `<p>${name}. Premium quality.</p>`;

        const attributes = {};
        if (p.tag_list && (Array.isArray(p.tag_list) ? p.tag_list.length : 0)) {
            attributes.tags = Array.isArray(p.tag_list) ? p.tag_list.join(', ') : String(p.tag_list);
        }
        if (p.product_colors && p.product_colors.length) {
            attributes.colors = JSON.stringify(p.product_colors.slice(0, 20));
        }
        if (p.category) attributes.category = p.category;

        try {
            const product = await prisma.product.create({
                data: {
                    sku,
                    name,
                    slug,
                    basePrice,
                    categoryId,
                    brand: p.brand ? String(p.brand).slice(0, 120) : null,
                    status: 'published',
                    isFeatured: false
                }
            });

            await prisma.productVariant.create({
                data: {
                    productId: product.id,
                    sku: `${sku}-01`,
                    name: 'One Size',
                    options: { size: 'One Size' },
                    priceAdjustment: 0,
                    isActive: true,
                    inventory: {
                        create: { quantity: 100, lowThreshold: 10, warehouseLoc: 'WH-BEAUTY-1' }
                    }
                }
            });

            await ProductRichContent.create({
                pg_id: product.id,
                description_html: descriptionHtml,
                lifestyle_tags: [p.product_type, p.brand, p.category].filter(Boolean),
                attributes,
                media_gallery: mediaGallery,
                related_products: [],
                cross_sell: []
            });

            created++;
            if (created % 100 === 0) console.log('Products created:', created);
        } catch (err) {
            if (err.code === 'P2002') {
                skipped++;
                continue;
            }
            throw err;
        }
    }

    console.log('Done. Created:', created, 'Skipped:', skipped);
    await prisma.$disconnect();
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
