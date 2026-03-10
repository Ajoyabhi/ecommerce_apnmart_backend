/**
 * Seed fashion products from backend/product_images/fashion.csv
 *
 * - Deletes all existing products and categories (and related cart, orders, wishlist, variants, inventory, ProductRichContent, CategoryFeedSection)
 * - Builds categories: Fashion → Gender (Men/Women/Boys/Girls) → Category (Apparel/Footwear) → SubCategory (leaf)
 * - Image folders (under product_images/): men_footwear_images_with_product_ids, women_footwear_images_with_product_ids, boys_images_with_product_ids, girls_images_with_product_ids. Image filename = CSV "Image" column (e.g. 42419.jpg), matched by ProductId.
 * - For each product, the single source image is augmented into 3 variants (original, flip, portrait), all uploaded; product media_gallery contains all 3 so the detail page shows multiple views.
 *
 * Usage:
 *   npm run seed:fashion
 *   FASHION_SEED_LIMIT=10 UPLOAD_METHOD=local npm run seed:fashion   # test with 10 products, local uploads
 *
 * Env: DATABASE_URL, MONGODB_URI, UPLOAD_METHOD (b2|local)
 *      For B2: B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME
 *      For local: LOCAL_UPLOAD_PATH (default ./uploads), optional SEED_MEDIA_BASE_URL (e.g. http://localhost:5001/uploads)
 *      Optional: FASHION_CSV, PRODUCT_IMAGES_DIR, FASHION_SEED_LIMIT (max products to create; when set, products are distributed across different categories so e.g. 12 products come from up to 12 categories)
 */

const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { ProductRichContent, CategoryFeedSection } = require('../src/models');
const { uploadFile, getBaseMediaUrl } = require('../src/services/b2Service');
const { compressImage, generateAugmentedVariants } = require('../src/services/mediaProcessor');
require('dotenv').config();

const prisma = new PrismaClient();

const CSV_PATH = process.env.FASHION_CSV || path.join(__dirname, '../product_images/fashion.csv');
const IMAGES_BASE = process.env.PRODUCT_IMAGES_DIR || path.join(__dirname, '../product_images');
const UPLOAD_METHOD = (process.env.UPLOAD_METHOD || 'b2').toLowerCase();
const LOCAL_UPLOAD_PATH = process.env.LOCAL_UPLOAD_PATH || path.join(__dirname, '../uploads');
const SEED_LIMIT = process.env.FASHION_SEED_LIMIT ? parseInt(process.env.FASHION_SEED_LIMIT, 10) : null;

// Gender → folder name (under IMAGES_BASE)
const GENDER_TO_FOLDER = {
    Men: 'men_footwear_images_with_product_ids',
    Women: 'women_footwear_images_with_product_ids',
    Boys: 'boys_images_with_product_ids',
    Girls: 'girls_images_with_product_ids'
};

function slugify(str) {
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

function parseCsv(content) {
    const lines = content.split(/\r?\n/).filter(Boolean);
    const header = lines[0];
    if (!header || !header.includes('ProductId')) {
        throw new Error('CSV must have header with ProductId,Gender,Category,SubCategory,...');
    }
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 10) continue;
        rows.push({
            productId: String(parts[0]).trim(),
            gender: String(parts[1]).trim(),
            category: String(parts[2]).trim(),
            subCategory: String(parts[3]).trim(),
            productType: String(parts[4]).trim(),
            colour: String(parts[5]).trim(),
            usage: String(parts[6]).trim(),
            productTitle: String(parts[7]).trim(),
            image: String(parts[8]).trim(),
            imageUrl: String(parts[9]).trim()
        });
    }
    return rows;
}

function buildCategoryTree(rows) {
    const seen = new Set();
    const leafKeys = [];
    for (const r of rows) {
        const key = `${r.gender}|${r.category}|${r.subCategory}`;
        if (!seen.has(key)) {
            seen.add(key);
            leafKeys.push({ gender: r.gender, category: r.category, subCategory: r.subCategory });
        }
    }
    // Build tree: root Fashion → Gender → Category → SubCategory (leaf)
    const root = { name: 'Fashion', slug: 'fashion', children: {} };
    for (const { gender, category, subCategory } of leafKeys) {
        const gSlug = slugify(gender);
        const cSlug = slugify(category);
        const sSlug = slugify(subCategory);
        if (!root.children[gender]) {
            root.children[gender] = { name: gender, slug: `fashion-${gSlug}`, children: {} };
        }
        const gNode = root.children[gender];
        if (!gNode.children[category]) {
            gNode.children[category] = { name: category, slug: `fashion-${gSlug}-${cSlug}`, children: {} };
        }
        const cNode = gNode.children[category];
        if (!cNode.children[subCategory]) {
            cNode.children[subCategory] = {
                name: subCategory,
                slug: `fashion-${gSlug}-${cSlug}-${sSlug}`,
                leaf: true
            };
        }
    }
    return root;
}

function getLeafSlug(row) {
    const gSlug = slugify(row.gender);
    const cSlug = slugify(row.category);
    const sSlug = slugify(row.subCategory);
    return `fashion-${gSlug}-${cSlug}-${sSlug}`;
}

/**
 * When SEED_LIMIT is set, pick up to `limit` rows so that products come from different categories.
 * Groups rows by leaf category, then round-robins across categories so we get at least one product
 * from many categories (e.g. 12 products from 12 different categories when possible).
 */
function pickRowsDistributedByCategory(rows, limit) {
    const byLeaf = new Map();
    for (const row of rows) {
        const slug = getLeafSlug(row);
        if (!byLeaf.has(slug)) byLeaf.set(slug, []);
        byLeaf.get(slug).push(row);
    }
    const categories = Array.from(byLeaf.keys());
    const out = [];
    let index = 0;
    while (out.length < limit && categories.length > 0) {
        const cat = categories[index % categories.length];
        const list = byLeaf.get(cat);
        if (list && list.length > 0) {
            out.push(list.shift());
            if (list.length === 0) {
                byLeaf.delete(cat);
                categories.splice(categories.indexOf(cat), 1);
            }
        }
        index++;
        if (index > 10000) break;
    }
    return out;
}

async function clearData() {
    console.log('Clearing existing products and categories...');
    await prisma.inventory.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.wishlistItem.deleteMany();
    await prisma.product.deleteMany();
    // Delete categories children-first to satisfy parentId self-reference FK
    await prisma.category.deleteMany({ where: { parentId: { not: null } } });
    await prisma.category.deleteMany({ where: { parentId: null } });
    await ProductRichContent.deleteMany();
    await CategoryFeedSection.deleteMany();
    console.log('Cleared.');
}

async function createCategories(root) {
    const slugToId = {};
    let sortOrder = 0;

    async function createNode(node, parentId = null) {
        const slug = node.slug;
        const category = await prisma.category.create({
            data: {
                name: node.name,
                slug,
                description: null,
                imageUrl: null,
                parentId,
                sortOrder: sortOrder++,
                isActive: true
            }
        });
        slugToId[slug] = category.id;

        if (node.children && typeof node.children === 'object' && !node.leaf) {
            const entries = Object.values(node.children);
            for (const child of entries) {
                await createNode(child, category.id);
            }
        }
        return category.id;
    }

    // Create root "Fashion" then its children (Gender → Category → SubCategory)
    const fashion = await prisma.category.create({
        data: {
            name: 'Fashion',
            slug: 'fashion',
            description: 'Fashion for Men, Women, Boys and Girls.',
            imageUrl: null,
            parentId: null,
            sortOrder: sortOrder++,
            isActive: true
        }
    });
    slugToId['fashion'] = fashion.id;
    const genders = Object.values(root.children);
    for (const gNode of genders) {
        await createNode(gNode, fashion.id);
    }
    return slugToId;
}

async function uploadToLocal(fileBuffer, relativePath) {
    const dir = path.join(LOCAL_UPLOAD_PATH, path.dirname(relativePath));
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(LOCAL_UPLOAD_PATH, relativePath);
    await fs.writeFile(fullPath, fileBuffer);
}

async function resolveImageUrls(row) {
    const folder = GENDER_TO_FOLDER[row.gender];
    if (!folder) return null;
    const imagePath = path.join(IMAGES_BASE, folder, row.image);
    try {
        await fs.access(imagePath);
    } catch {
        return null;
    }
    const buf = await fs.readFile(imagePath);
    let sourceBuffer = buf;
    try {
        sourceBuffer = await compressImage(buf);
    } catch (e) {
        // use original
    }

    const variants = await generateAugmentedVariants(sourceBuffer);
    const extension = 'webp';
    const basePath = `products/fashion/${row.productId}`;
    const urls = [];
    const baseLocal = process.env.SEED_MEDIA_BASE_URL || 'http://localhost:5001/uploads';
    for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const relativePath = `${basePath}${v.suffix}.${extension}`;
        if (UPLOAD_METHOD === 'local') {
            await uploadToLocal(v.buffer, relativePath);
            urls.push({ url: `${baseLocal}/${relativePath}`, order: i + 1, is_primary: i === 0 });
        } else {
            await uploadFile(v.buffer, relativePath, 'image/webp');
            urls.push({ url: `${getBaseMediaUrl()}/${relativePath}`, order: i + 1, is_primary: i === 0 });
        }
    }
    return urls;
}

function randomPrice() {
    return Math.floor(100 + Math.random() * 3900);
}

/**
 * Generate a product description based on CSV row. Returns HTML-safe string (paragraphs).
 */
function generateProductDescription(row) {
    const name = row.productTitle || `Product ${row.productId}`;
    const gender = row.gender.toLowerCase();
    const category = row.category;
    const subCategory = row.subCategory;
    const productType = row.productType;
    const colour = row.colour;
    const usage = row.usage;

    const intro = `${name} is a ${colour.toLowerCase()} ${productType.toLowerCase()} from our ${subCategory} collection, designed for ${gender}. Ideal for ${usage.toLowerCase()} wear, this ${category.toLowerCase()} piece fits seamlessly into your wardrobe.`;
    const detail = `Crafted with attention to comfort and style, it pairs well with a variety of outfits. Easy to care for—follow the care label for best results.`;

    return `<p>${escapeHtml(intro)}</p><p>${escapeHtml(detail)}</p>`;
}

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Return size options for the product based on ProductType and SubCategory.
 * Used to create one variant per size so the storefront shows all available sizes.
 */
function getSizesForProduct(row) {
    const pt = (row.productType || '').toLowerCase();
    const sub = (row.subCategory || '').toLowerCase();
    const gender = (row.gender || '').toLowerCase();

    // Footwear: numeric sizes (India/UK)
    if (sub === 'shoes' || sub === 'sandal' || sub === 'flip flops' || pt.includes('shoes') || pt.includes('sandals') || pt.includes('flip flops')) {
        return ['6', '7', '8', '9', '10'];
    }

    // Socks, booties, innerwear: small size range or one size
    if (sub === 'socks' || pt.includes('socks') || pt.includes('booties') || pt.includes('vests')) {
        return ['S', 'M', 'L'];
    }

    // Dresses, lehenga: XS–XL
    if (sub === 'dress' || pt.includes('dress') || pt.includes('lehenga')) {
        return ['XS', 'S', 'M', 'L', 'XL'];
    }

    // Kids (Boys, Girls): smaller range
    if (gender === 'boys' || gender === 'girls') {
        return ['S', 'M', 'L', 'XL'];
    }

    // Topwear: Tops, Tshirts, Shirts, Kurtas, Jackets, Blazers, etc.
    if (sub === 'topwear' || pt.includes('top') || pt.includes('tshirt') || pt.includes('shirt') || pt.includes('kurtas') || pt.includes('jacket') || pt.includes('blazer') || pt.includes('sweatshirt') || pt.includes('waistcoat') || pt.includes('rompers')) {
        return ['S', 'M', 'L', 'XL', 'XXL'];
    }

    // Bottomwear: Jeans, Trousers, Capris, Shorts, Skirts, Leggings, etc.
    if (sub === 'bottomwear' || pt.includes('jeans') || pt.includes('trousers') || pt.includes('capris') || pt.includes('shorts') || pt.includes('skirts') || pt.includes('leggings') || pt.includes('churidar') || pt.includes('salwar')) {
        return ['S', 'M', 'L', 'XL', 'XXL'];
    }

    // Apparel set, kurta set, clothing set
    if (sub === 'apparel set' || pt.includes('set')) {
        return ['S', 'M', 'L', 'XL'];
    }

    // Default: standard apparel sizes
    return ['S', 'M', 'L', 'XL'];
}

async function run() {
    console.log('Reading CSV:', CSV_PATH);
    const content = await fs.readFile(CSV_PATH, 'utf8');
    const allRows = parseCsv(content);
    console.log('Total rows in CSV:', allRows.length);

    await mongoose.connect(process.env.MONGODB_URI);
    await clearData();

    // Build category tree from FULL CSV so all categories/subcategories exist regardless of SEED_LIMIT
    const root = buildCategoryTree(allRows);
    const slugToId = await createCategories(root);
    const leafSlugs = Object.keys(slugToId).filter(s => s.split('-').length >= 4);
    console.log('Categories created. Leaf categories:', leafSlugs.length);

    // Decide which rows to process: full list or limited with distribution across categories
    let rows = allRows;
    if (SEED_LIMIT) {
        rows = pickRowsDistributedByCategory(allRows, SEED_LIMIT);
        console.log('Limited to', rows.length, 'products distributed across categories');
    }

    let created = 0;
    let skipped = 0;
    const BATCH = 50;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const leafSlug = getLeafSlug(row);
        const categoryId = slugToId[leafSlug];
        if (!categoryId) {
            skipped++;
            continue;
        }

        const imageUrls = await resolveImageUrls(row);
        if (!imageUrls || imageUrls.length === 0) {
            skipped++;
            if (skipped <= 10) console.log('Skip (no image):', row.productId, row.gender, row.image);
            continue;
        }

        const slug = `fashion-${row.productId}`;
        const sku = `FASH-${row.productId}`;
        const basePrice = randomPrice();
        const name = row.productTitle || `Product ${row.productId}`;
        const descText = generateProductDescription(row);
        const descriptionHtml = descText;

        try {
            const product = await prisma.product.create({
                data: {
                    sku,
                    name,
                    slug,
                    basePrice,
                    categoryId,
                    brand: null,
                    status: 'published',
                    isFeatured: false
                }
            });

            const sizes = getSizesForProduct(row);
            let variantNum = 1;
            for (const size of sizes) {
                await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        sku: `${sku}-${String(variantNum).padStart(2, '0')}`,
                        name: `${row.colour} / ${size}`,
                        options: { color: row.colour, size },
                        priceAdjustment: 0,
                        isActive: true,
                        inventory: {
                            create: {
                                quantity: 50,
                                lowThreshold: 5,
                                warehouseLoc: 'WH-FASHION-1'
                            }
                        }
                    }
                });
                variantNum++;
            }

            await ProductRichContent.create({
                pg_id: product.id,
                description_html: descriptionHtml,
                lifestyle_tags: [row.gender, row.category, row.subCategory, row.colour],
                attributes: {},
                media_gallery: imageUrls.map(({ url, order, is_primary }) => ({
                    url,
                    type: 'image',
                    alt: name,
                    order,
                    is_primary: !!is_primary
                })),
                related_products: [],
                cross_sell: []
            });

            created++;
            if (created % BATCH === 0) console.log('Products created:', created);
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
