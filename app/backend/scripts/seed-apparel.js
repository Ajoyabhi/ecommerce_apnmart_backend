/**
 * Seed apparel products from local image folders:
 *   - Men's clothing: backend/product_images/men_cloth/dataset_clean/
 *     (readme.md: 8 classes — Casual Shirts, Formal Shirts, Formal Pants, Jeans, Men Cargos, Printed Hoodies, Printed T-Shirts, Solid T-Shirts)
 *   - Women's clothing: backend/product_images/women fashion/
 *     (flat folder; categories inferred from image filenames)
 *
 * Does NOT delete existing data. Safe to run after seed:fashion — only adds apparel categories (if missing) and products from men_cloth and women fashion. Existing categories and products from seed:fashion are left unchanged.
 *
 * Categories created/found: Fashion → Men → Apparel → [8 subcategories], Fashion → Women → Apparel → [8 subcategories]
 * Each product gets one source image augmented into 3 variants (original, flip, portrait), uploaded to B2 or local.
 *
 * Usage:
 *   npm run seed:apparel
 *   APPAREL_SEED_LIMIT_MEN=50 APPAREL_SEED_LIMIT_WOMEN=20 UPLOAD_METHOD=local npm run seed:apparel
 *
 * Env: DATABASE_URL, MONGODB_URI, UPLOAD_METHOD (b2|local)
 *      For B2: B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME
 *      For local: LOCAL_UPLOAD_PATH (default ./uploads), optional SEED_MEDIA_BASE_URL
 *      Optional: MEN_CLOTH_DIR, WOMEN_CLOTH_DIR, APPAREL_SEED_LIMIT_MEN, APPAREL_SEED_LIMIT_WOMEN
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

const IMAGES_BASE = process.env.PRODUCT_IMAGES_DIR || path.join(__dirname, '../product_images');
const MEN_CLOTH_DIR = process.env.MEN_CLOTH_DIR || path.join(IMAGES_BASE, 'men_cloth/dataset_clean');
const WOMEN_CLOTH_DIR = process.env.WOMEN_CLOTH_DIR || path.join(IMAGES_BASE, 'women fashion');
// Default to local uploads so seeded media stays on server storage unless explicitly set to "b2"
const UPLOAD_METHOD = (process.env.UPLOAD_METHOD || 'local').toLowerCase();
const LOCAL_UPLOAD_PATH = process.env.LOCAL_UPLOAD_PATH || path.join(__dirname, '../uploads');
const SEED_LIMIT_MEN = process.env.APPAREL_SEED_LIMIT_MEN ? parseInt(process.env.APPAREL_SEED_LIMIT_MEN, 10) : null;
const SEED_LIMIT_WOMEN = process.env.APPAREL_SEED_LIMIT_WOMEN ? parseInt(process.env.APPAREL_SEED_LIMIT_WOMEN, 10) : null;

// Men's subcategories: folder name (in dataset_clean) → display name (from readme)
const MEN_SUBCATEGORIES = [
    { folder: 'casual_shirts', name: 'Casual Shirts' },
    { folder: 'formal_shirts', name: 'Formal Shirts' },
    { folder: 'formal_pants', name: 'Formal Pants' },
    { folder: 'jeans', name: 'Jeans' },
    { folder: 'men_cargos', name: 'Men Cargos' },
    { folder: 'printed_hoodies', name: 'Printed Hoodies' },
    { folder: 'printed_tshirts', name: 'Printed T-Shirts' },
    { folder: 'solid_tshirts', name: 'Solid T-Shirts' }
];

// Women's subcategories: slug → display name (inference from filenames)
const WOMEN_SUBCATEGORIES = [
    { slug: 'sarees', name: 'Sarees' },
    { slug: 'anarkali-suits', name: 'Anarkali Suits' },
    { slug: 'salwar-kameez', name: 'Salwar Kameez' },
    { slug: 'gowns', name: 'Gowns' },
    { slug: 'jumpsuits', name: 'Jumpsuits' },
    { slug: 'blazers-suits', name: 'Blazers & Suits' },
    { slug: 'tops-skirts', name: 'Tops & Skirts' },
    { slug: 'dresses', name: 'Dresses' }
];

function slugify(str) {
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

/**
 * Infer women's apparel subcategory from image filename (lowercase).
 * Returns slug from WOMEN_SUBCATEGORIES; default 'dresses'.
 */
function inferWomenSubcategory(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('saree')) return 'sarees';
    if (lower.includes('anarkali')) return 'anarkali-suits';
    if (lower.includes('salwar') || lower.includes('kameez')) return 'salwar-kameez';
    if (lower.includes('gown')) return 'gowns';
    if (lower.includes('jumpsuit')) return 'jumpsuits';
    if (lower.includes('blazer') || lower.includes('coat') || (lower.includes('well-fitted') && lower.includes('suit'))) return 'blazers-suits';
    if (lower.includes('double-breasted') && lower.includes('suit')) return 'blazers-suits';
    if (lower.includes('bustier') || (lower.includes('top') && (lower.includes('skirt') || lower.includes('trousers')))) return 'tops-skirts';
    if (lower.includes('top') && lower.includes('trousers')) return 'tops-skirts';
    if (lower.includes('dress') || lower.includes('party') || lower.includes('bodycon') || lower.includes('sequin') || lower.includes('midi') || lower.includes('slip')) return 'dresses';
    return 'dresses';
}

async function getOrCreateApparelCategories(slugToId) {
    async function findBySlug(slug) {
        const c = await prisma.category.findFirst({ where: { slug } });
        return c ? c.id : null;
    }

    async function getOrCreateCategory(slug, name, parentId, sortOrder) {
        let id = await findBySlug(slug);
        if (id) {
            slugToId[slug] = id;
            return id;
        }
        const cat = await prisma.category.create({
            data: {
                name,
                slug,
                description: null,
                imageUrl: null,
                parentId,
                sortOrder,
                isActive: true
            }
        });
        slugToId[slug] = cat.id;
        return cat.id;
    }

    const maxOrder = await prisma.category.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }).then(c => (c?.sortOrder ?? -1) + 1);
    let sortOrder = maxOrder;

    let fashionId = await findBySlug('fashion');
    if (!fashionId) {
        const fashion = await prisma.category.create({
            data: {
                name: 'Fashion',
                slug: 'fashion',
                description: 'Fashion for Men and Women.',
                imageUrl: null,
                parentId: null,
                sortOrder: sortOrder++,
                isActive: true
            }
        });
        fashionId = fashion.id;
    }
    slugToId['fashion'] = fashionId;

    const menId = await getOrCreateCategory('fashion-men', 'Men', fashionId, sortOrder++);
    const menApparelId = await getOrCreateCategory('fashion-men-apparel', 'Apparel', menId, sortOrder++);
    for (const { folder, name } of MEN_SUBCATEGORIES) {
        const slug = `fashion-men-apparel-${slugify(folder)}`;
        await getOrCreateCategory(slug, name, menApparelId, sortOrder++);
    }

    const womenId = await getOrCreateCategory('fashion-women', 'Women', fashionId, sortOrder++);
    const womenApparelId = await getOrCreateCategory('fashion-women-apparel', 'Apparel', womenId, sortOrder++);
    for (const { slug: subSlug, name } of WOMEN_SUBCATEGORIES) {
        const slug = `fashion-women-apparel-${subSlug}`;
        await getOrCreateCategory(slug, name, womenApparelId, sortOrder++);
    }

    return slugToId;
}

async function uploadToLocal(fileBuffer, relativePath) {
    const dir = path.join(LOCAL_UPLOAD_PATH, path.dirname(relativePath));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(LOCAL_UPLOAD_PATH, relativePath), fileBuffer);
}

async function resolveImageUrls(sourceBuffer, productSlug) {
    let buffer = sourceBuffer;
    try {
        buffer = await compressImage(sourceBuffer);
    } catch (e) {
        // use original
    }
    const variants = await generateAugmentedVariants(buffer);
    const extension = 'webp';
    const basePath = `products/apparel/${productSlug}`;
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
    return Math.floor(299 + Math.random() * 3700);
}

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateProductDescription(name, subCategoryName, gender) {
    const intro = `${name} is from our ${subCategoryName} collection for ${gender}. Comfortable and stylish for everyday wear.`;
    const detail = `Crafted with attention to fit and durability. Follow the care label for best results.`;
    return `<p>${escapeHtml(intro)}</p><p>${escapeHtml(detail)}</p>`;
}

function getSizesForMenSubcategory(folder) {
    if (folder === 'formal_pants' || folder === 'jeans' || folder === 'men_cargos') {
        return ['28', '30', '32', '34', '36'];
    }
    if (folder.includes('shirt')) {
        return ['S', 'M', 'L', 'XL', 'XXL'];
    }
    return ['S', 'M', 'L', 'XL', 'XXL'];
}

function getSizesForWomenSubcategory(slug) {
    if (slug === 'blazers-suits' || slug === 'tops-skirts') return ['S', 'M', 'L', 'XL'];
    return ['XS', 'S', 'M', 'L', 'XL'];
}

/**
 * List all image files from men_cloth/dataset_clean/{folder}/.
 * Returns { folder, files[] }. Optionally limit total per folder when SEED_LIMIT_MEN is set (distribute across folders).
 */
async function listMenClothImages() {
    const out = [];
    for (const { folder } of MEN_SUBCATEGORIES) {
        const dir = path.join(MEN_CLOTH_DIR, folder);
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = entries.filter(e => e.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(e.name)).map(e => e.name);
            if (files.length) out.push({ folder, files });
        } catch (err) {
            console.warn('Skip men folder:', dir, err.message);
        }
    }
    return out;
}

/**
 * List all image files from women fashion folder.
 */
async function listWomenClothImages() {
    try {
        const entries = await fs.readdir(WOMEN_CLOTH_DIR, { withFileTypes: true });
        return entries.filter(e => e.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(e.name)).map(e => e.name);
    } catch (err) {
        console.warn('Skip women folder:', WOMEN_CLOTH_DIR, err.message);
        return [];
    }
}

async function run() {
    console.log('Men cloth dir:', MEN_CLOTH_DIR);
    console.log('Women cloth dir:', WOMEN_CLOTH_DIR);
    console.log('Apparel seed: additive mode (will not delete existing categories or products).');

    await mongoose.connect(process.env.MONGODB_URI);
    const slugToId = {};
    await getOrCreateApparelCategories(slugToId);
    console.log('Categories ready.');

    let createdMen = 0;
    let createdWomen = 0;

    // ---------- Men's products ----------
    const menByFolder = await listMenClothImages();
    let menIndex = 0;
    const menLimitPerFolder = SEED_LIMIT_MEN ? Math.ceil(SEED_LIMIT_MEN / menByFolder.length) : null;

    for (const { folder, files } of menByFolder) {
        const leafSlug = `fashion-men-apparel-${slugify(folder)}`;
        const categoryId = slugToId[leafSlug];
        if (!categoryId) continue;

        const subCatName = MEN_SUBCATEGORIES.find(s => s.folder === folder).name;
        const toProcess = menLimitPerFolder ? files.slice(0, menLimitPerFolder) : files;

        for (let i = 0; i < toProcess.length; i++) {
            const imageName = toProcess[i];
            const imagePath = path.join(MEN_CLOTH_DIR, folder, imageName);
            let buf;
            try {
                buf = await fs.readFile(imagePath);
            } catch (err) {
                continue;
            }

            const productSlug = `men-${folder}-${menIndex}`;
            const imageUrls = await resolveImageUrls(buf, productSlug);
            if (!imageUrls.length) continue;

            const name = `${subCatName} ${menIndex + 1}`;
            const sku = `MEN-${folder.toUpperCase().replace(/_/g, '-')}-${String(menIndex).padStart(4, '0')}`;
            const basePrice = randomPrice();
            const sizes = getSizesForMenSubcategory(folder);

            try {
                const product = await prisma.product.create({
                    data: {
                        sku,
                        name,
                        slug: productSlug,
                        basePrice,
                        categoryId,
                        brand: null,
                        status: 'published',
                        isFeatured: false
                    }
                });

                let variantNum = 1;
                for (const size of sizes) {
                    await prisma.productVariant.create({
                        data: {
                            productId: product.id,
                            sku: `${sku}-${String(variantNum).padStart(2, '0')}`,
                            name: size,
                            options: { size },
                            priceAdjustment: 0,
                            isActive: true,
                            inventory: {
                                create: {
                                    quantity: 50,
                                    lowThreshold: 5,
                                    warehouseLoc: 'WH-APPAREL-1'
                                }
                            }
                        }
                    });
                    variantNum++;
                }

                await ProductRichContent.create({
                    pg_id: product.id,
                    description_html: generateProductDescription(name, subCatName, 'men'),
                    lifestyle_tags: [folder, subCatName],
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

                createdMen++;
                if (createdMen % 50 === 0) console.log('Men products created:', createdMen);
            } catch (err) {
                if (err.code === 'P2002') continue;
                throw err;
            }
            menIndex++;
        }
    }

    // ---------- Women's products ----------
    const womenFiles = await listWomenClothImages();
    const toProcessWomen = SEED_LIMIT_WOMEN ? womenFiles.slice(0, SEED_LIMIT_WOMEN) : womenFiles;

    for (let i = 0; i < toProcessWomen.length; i++) {
        const imageName = toProcessWomen[i];
        const imagePath = path.join(WOMEN_CLOTH_DIR, imageName);
        let buf;
        try {
            buf = await fs.readFile(imagePath);
        } catch (err) {
            continue;
        }

        const subSlug = inferWomenSubcategory(imageName);
        const leafSlug = `fashion-women-apparel-${subSlug}`;
        const categoryId = slugToId[leafSlug];
        if (!categoryId) continue;

        const subCatName = WOMEN_SUBCATEGORIES.find(s => s.slug === subSlug)?.name || 'Dresses';
        const productSlug = `women-${i}-${slugify(path.basename(imageName, path.extname(imageName))).slice(0, 50)}`;
        const imageUrls = await resolveImageUrls(buf, productSlug);
        if (!imageUrls.length) continue;

        const name = `${subCatName} ${i + 1}`;
        const sku = `WOMEN-${subSlug.toUpperCase().replace(/-/g, '-')}-${String(i).padStart(4, '0')}`;
        const basePrice = randomPrice();
        const sizes = getSizesForWomenSubcategory(subSlug);

        try {
            const product = await prisma.product.create({
                data: {
                    sku,
                    name,
                    slug: productSlug,
                    basePrice,
                    categoryId,
                    brand: null,
                    status: 'published',
                    isFeatured: false
                }
            });

            let variantNum = 1;
            for (const size of sizes) {
                await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        sku: `${sku}-${String(variantNum).padStart(2, '0')}`,
                        name: size,
                        options: { size },
                        priceAdjustment: 0,
                        isActive: true,
                        inventory: {
                            create: {
                                quantity: 50,
                                lowThreshold: 5,
                                warehouseLoc: 'WH-APPAREL-1'
                            }
                        }
                    }
                });
                variantNum++;
            }

            await ProductRichContent.create({
                pg_id: product.id,
                description_html: generateProductDescription(name, subCatName, 'women'),
                lifestyle_tags: [subSlug, subCatName],
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

            createdWomen++;
        } catch (err) {
            if (err.code === 'P2002') continue;
            throw err;
        }
    }

    console.log('Done. Men products:', createdMen, 'Women products:', createdWomen);
    await prisma.$disconnect();
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
