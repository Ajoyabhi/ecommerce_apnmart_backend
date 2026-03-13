const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { ProductRichContent, CategoryFeedSection } = require('./src/models');
const { uploadFile, getBaseMediaUrl } = require('./src/services/b2Service');
const { compressImage, generateAugmentedVariants } = require('./src/services/mediaProcessor');
require('dotenv').config();

const prisma = new PrismaClient();

// ----- Media consistency -----
// DB can store (1) full URL or (2) path only (e.g. products/uuid.webp). Frontend uses getMediaUrl()
// so both work. Admin uploads store path only. Set SEED_MEDIA_AS_PATH=1 to store category image
// paths (e.g. categories/fashion.jpg) for consistency with blob; set VITE_MEDIA_BASE_URL in
// frontend so paths resolve. Product/feed seed media stay as full placeholder URLs unless you
// upload real assets and replace them.
const SEED_MEDIA_AS_PATH = process.env.SEED_MEDIA_AS_PATH === '1' || process.env.SEED_MEDIA_AS_PATH === 'true';

// ----- Static configuration -----

// 3‑level category tree: root → subcategory → sub‑subcategory (leaf)
const categoryTree = [
    {
        name: 'Fashion',
        slug: 'fashion',
        description: 'Trending fashion for men and women.',
        imageUrl: 'https://images.urbankart.dev/categories/fashion.jpg',
        children: [
            {
                name: 'Men',
                slug: 'fashion-men',
                description: 'Menswear for every occasion.',
                imageUrl: 'https://images.urbankart.dev/categories/fashion-men.jpg',
                children: [
                    {
                        name: 'T-Shirts & Polos',
                        slug: 'fashion-men-tshirts',
                        description: 'Casual tees and polos.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-men-tshirts.jpg'
                    },
                    {
                        name: 'Shirts',
                        slug: 'fashion-men-shirts',
                        description: 'Formal and casual shirts.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-men-shirts.jpg'
                    },
                    {
                        name: 'Jeans & Trousers',
                        slug: 'fashion-men-jeans',
                        description: 'Denims and chinos for men.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-men-jeans.jpg'
                    },
                    {
                        name: 'Footwear',
                        slug: 'fashion-men-footwear',
                        description: 'Casual and occasion footwear for men.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-men-footwear.jpg'
                    }
                ]
            },
            {
                name: 'Women',
                slug: 'fashion-women',
                description: 'Womenswear from ethnic to western.',
                imageUrl: 'https://images.urbankart.dev/categories/fashion-women.jpg',
                children: [
                    {
                        name: 'Ethnic Wear',
                        slug: 'fashion-women-ethnic',
                        description: 'Kurtas, sets and more.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-women-ethnic.jpg'
                    },
                    {
                        name: 'Dresses & Jumpsuits',
                        slug: 'fashion-women-dresses',
                        description: 'Casual and party dresses.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-women-dresses.jpg'
                    },
                    {
                        name: 'Activewear',
                        slug: 'fashion-women-activewear',
                        description: 'Gym, yoga and athleisure.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-women-activewear.jpg'
                    },
                    {
                        name: 'Footwear',
                        slug: 'fashion-women-footwear',
                        description: 'Heels, flats and everyday footwear for women.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-women-footwear.jpg'
                    }
                ]
            }
        ]
    },
    {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Mobiles, laptops, audio and more.',
        imageUrl: 'https://images.urbankart.dev/categories/electronics.jpg',
        children: [
            {
                name: 'Mobiles & Tablets',
                slug: 'electronics-mobiles',
                description: 'Smartphones and tablets.',
                imageUrl: 'https://images.urbankart.dev/categories/electronics-mobiles.jpg',
                children: [
                    {
                        name: 'Android Phones',
                        slug: 'electronics-mobiles-android',
                        description: 'Latest Android smartphones.',
                        imageUrl: 'https://images.urbankart.dev/categories/electronics-android.jpg'
                    },
                    {
                        name: 'iOS Phones',
                        slug: 'electronics-mobiles-ios',
                        description: 'Premium iOS devices.',
                        imageUrl: 'https://images.urbankart.dev/categories/electronics-ios.jpg'
                    }
                ]
            },
            {
                name: 'Laptops & Computers',
                slug: 'electronics-laptops',
                description: 'Work and gaming laptops.',
                imageUrl: 'https://images.urbankart.dev/categories/electronics-laptops.jpg',
                children: [
                    {
                        name: 'Ultrabooks',
                        slug: 'electronics-laptops-ultrabooks',
                        description: 'Thin and light laptops.',
                        imageUrl: 'https://images.urbankart.dev/categories/electronics-ultrabooks.jpg'
                    },
                    {
                        name: 'Gaming Laptops',
                        slug: 'electronics-laptops-gaming',
                        description: 'High performance gaming laptops.',
                        imageUrl: 'https://images.urbankart.dev/categories/electronics-gaming-laptops.jpg'
                    }
                ]
            },
            {
                name: 'Audio & Wearables',
                slug: 'electronics-audio',
                description: 'Headphones, speakers and wearables.',
                imageUrl: 'https://images.urbankart.dev/categories/electronics-audio.jpg',
                children: [
                    {
                        name: 'Headphones & Earbuds',
                        slug: 'electronics-audio-headphones',
                        description: 'Wireless and wired audio.',
                        imageUrl: 'https://images.urbankart.dev/categories/electronics-headphones.jpg'
                    },
                    {
                        name: 'Smartwatches',
                        slug: 'electronics-audio-smartwatches',
                        description: 'Smartwatches and fitness bands.',
                        imageUrl: 'https://images.urbankart.dev/categories/electronics-smartwatches.jpg'
                    }
                ]
            }
        ]
    },
    {
        name: 'Home & Living',
        slug: 'home',
        description: 'Decor, furnishing and kitchen essentials.',
        imageUrl: 'https://images.urbankart.dev/categories/home.jpg',
        children: [
            {
                name: 'Kitchen & Dining',
                slug: 'home-kitchen',
                description: 'Cookware and serveware.',
                imageUrl: 'https://images.urbankart.dev/categories/home-kitchen.jpg',
                children: [
                    {
                        name: 'Cookware Sets',
                        slug: 'home-kitchen-cookware',
                        description: 'Pots, pans and more.',
                        imageUrl: 'https://images.urbankart.dev/categories/home-cookware.jpg'
                    },
                    {
                        name: 'Serveware',
                        slug: 'home-kitchen-serveware',
                        description: 'Bowls, plates and serveware.',
                        imageUrl: 'https://images.urbankart.dev/categories/home-serveware.jpg'
                    }
                ]
            },
            {
                name: 'Home Decor',
                slug: 'home-decor',
                description: 'Wall art, lighting and accents.',
                imageUrl: 'https://images.urbankart.dev/categories/home-decor.jpg',
                children: [
                    {
                        name: 'Wall Art',
                        slug: 'home-decor-wall-art',
                        description: 'Paintings and frames.',
                        imageUrl: 'https://images.urbankart.dev/categories/home-wall-art.jpg'
                    },
                    {
                        name: 'Lighting',
                        slug: 'home-decor-lighting',
                        description: 'Lamps and decorative lighting.',
                        imageUrl: 'https://images.urbankart.dev/categories/home-lighting.jpg'
                    }
                ]
            },
            {
                name: 'Furnishing',
                slug: 'home-furnishing',
                description: 'Bedsheets, cushions and more.',
                imageUrl: 'https://images.urbankart.dev/categories/home-furnishing.jpg',
                children: [
                    {
                        name: 'Bedsheets',
                        slug: 'home-furnishing-bedsheets',
                        description: 'Bedsheets and bed linen.',
                        imageUrl: 'https://images.urbankart.dev/categories/home-bedsheets.jpg'
                    },
                    {
                        name: 'Cushions & Covers',
                        slug: 'home-furnishing-cushions',
                        description: 'Cushions and cushion covers.',
                        imageUrl: 'https://images.urbankart.dev/categories/home-cushions.jpg'
                    }
                ]
            }
        ]
    },
    {
        name: 'Beauty & Wellness',
        slug: 'beauty',
        description: 'Skincare, haircare and body essentials.',
        imageUrl: 'https://images.urbankart.dev/categories/beauty.jpg',
        children: [
            {
                name: 'Skin Care',
                slug: 'beauty-skin',
                description: 'Facewash, serums and more.',
                imageUrl: 'https://images.urbankart.dev/categories/beauty-skin.jpg',
                children: [
                    {
                        name: 'Cleansers & Facewash',
                        slug: 'beauty-skin-cleansers',
                        description: 'Daily face cleansers.',
                        imageUrl: 'https://images.urbankart.dev/categories/beauty-cleansers.jpg'
                    },
                    {
                        name: 'Serums & Treatments',
                        slug: 'beauty-skin-serums',
                        description: 'Targeted skincare serums.',
                        imageUrl: 'https://images.urbankart.dev/categories/beauty-serums.jpg'
                    }
                ]
            },
            {
                name: 'Hair Care',
                slug: 'beauty-hair',
                description: 'Shampoos and styling.',
                imageUrl: 'https://images.urbankart.dev/categories/beauty-hair.jpg',
                children: [
                    {
                        name: 'Shampoos & Conditioners',
                        slug: 'beauty-hair-shampoo',
                        description: 'Cleansing and conditioning.',
                        imageUrl: 'https://images.urbankart.dev/categories/beauty-shampoo.jpg'
                    },
                    {
                        name: 'Styling & Oils',
                        slug: 'beauty-hair-styling',
                        description: 'Hair oils and styling products.',
                        imageUrl: 'https://images.urbankart.dev/categories/beauty-styling.jpg'
                    }
                ]
            },
            {
                name: 'Bath & Body',
                slug: 'beauty-body',
                description: 'Body washes and fragrances.',
                imageUrl: 'https://images.urbankart.dev/categories/beauty-body.jpg',
                children: [
                    {
                        name: 'Bath & Shower',
                        slug: 'beauty-body-bath',
                        description: 'Body washes and soaps.',
                        imageUrl: 'https://images.urbankart.dev/categories/beauty-bath.jpg'
                    },
                    {
                        name: 'Fragrances & Mists',
                        slug: 'beauty-body-fragrance',
                        description: 'Perfumes and body mists.',
                        imageUrl: 'https://images.urbankart.dev/categories/beauty-fragrance.jpg'
                    }
                ]
            }
        ]
    }
];

const brandPools = {
    fashion: ['UrbanBasics', 'StreetLine', 'DailyWear', 'AthletiQ', 'Classic Tailor'],
    electronics: ['TechNest', 'VoltX', 'PixelWave', 'SoundScape', 'GearCore'],
    home: ['CasaCraft', 'Hearth&Home', 'LuxeLoom', 'CookMate'],
    beauty: ['GlowLab', 'HerbalHue', 'SilkSkin', 'AuraMist']
};

// Segment-specific variant options so frontend filters match DB (color/size selectors)
const segmentVariantOptions = {
    fashion: {
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['White', 'Black', 'Blue', 'Red', 'Green']
    },
    electronics: {
        sizes: ['128GB', '256GB', '512GB'],
        colors: ['Black', 'Silver', 'Blue']
    },
    home: {
        sizes: ['Set of 3', 'Set of 6', 'Single'],
        colors: ['White', 'Grey', 'Beige', 'Navy']
    },
    beauty: {
        sizes: ['50ml', '100ml', '200ml'],
        colors: ['Lavender', 'Rose', 'Unscented', 'Citrus']
    }
};

const productStyles = ['Essential', 'Premium', 'Deluxe', 'Limited Edition'];
let globalVariantCounter = 1;

// Build slug → display label for product names (e.g. "Men's T-Shirts & Polos", "Women's Ethnic Wear")
// so filtering by category / subcategory / sub_subcategory shows clearly men vs women products.
function buildSlugToProductLabelMap() {
    const map = {};
    function walk(nodes, parentName) {
        if (!nodes || !nodes.length) return;
        for (const node of nodes) {
            const hasChildren = node.children && node.children.length > 0;
            if (hasChildren) {
                walk(node.children, node.name);
            } else {
                // leaf category: "Men's T-Shirts" for fashion, "Mobiles & Tablets – Android Phones" for others
                const fashionParent = parentName && ['Men', 'Women', 'Kids'].includes(parentName);
                const label = parentName
                    ? (fashionParent ? `${parentName}'s ${node.name}` : `${parentName} – ${node.name}`)
                    : node.name;
                map[node.slug] = label;
            }
        }
    }
    walk(categoryTree, null);
    return map;
}

// Helper to reuse seed category images (from categoryTree) for content sections
function buildSlugToImageMap() {
    const map = {};
    function walk(nodes) {
        if (!nodes || !nodes.length) return;
        for (const node of nodes) {
            if (node.slug && node.imageUrl) {
                map[node.slug] = node.imageUrl;
            }
            if (node.children && node.children.length) {
                walk(node.children);
            }
        }
    }
    walk(categoryTree);
    return map;
}

// ----- Helpers -----

function titleCaseFromSlug(slug) {
    return slug
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

async function clearRelationalData() {
    console.log('🧹 Clearing relational (PostgreSQL) data...');
    // Order‑sensitive deletes to satisfy FK constraints
    await prisma.inventory.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.wishlistItem.deleteMany();
    await prisma.savedCard.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.address.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
}

async function clearMongoData() {
    console.log('🧹 Clearing Mongo content (products, category feeds)...');
    await ProductRichContent.deleteMany();
    await CategoryFeedSection.deleteMany();
}

async function clearProductMediaBlobs() {
    console.log('🧹 Clearing product media blobs...');
    if (typeof UPLOAD_METHOD === 'undefined') {
        console.log('ℹ️ UPLOAD_METHOD not configured yet; skipping blob deletion.');
        return;
    }
    if (UPLOAD_METHOD === 'local') {
        const productsDir = path.join(LOCAL_UPLOAD_PATH, 'products');
        try {
            await fs.rm(productsDir, { recursive: true, force: true });
            console.log('✅ Cleared local product media under uploads/products');
        } catch (err) {
            console.warn('⚠️ Failed to clear local product media:', err.message);
        }
    } else {
        console.log('ℹ️ UPLOAD_METHOD is not "local"; skipping blob deletion (implement B2 cleanup if needed).');
    }
}

async function createAdminUser() {
    console.log('👤 Creating admin user...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    const admin = await prisma.user.create({
        data: {
            email: 'admin@lifestyle.com',
            passwordHash,
            firstName: 'System',
            lastName: 'Admin',
            role: 'ADMIN',
            provider: 'local',
            isEmailVerified: true,
        }
    });

    return admin;
}

async function seedCategories() {
    console.log('📂 Creating category hierarchy...');
    const categorySlugIdMap = {};
    const leafCategorySlugs = [];
    let sortOrderCounter = 0;

    async function createNodes(nodes, parentId = null) {
        for (const node of nodes) {
            const imageUrl = SEED_MEDIA_AS_PATH
                ? `categories/${node.slug}.jpg`
                : node.imageUrl;

            const category = await prisma.category.create({
                data: {
                    name: node.name,
                    slug: node.slug,
                    description: node.description,
                    imageUrl,
                    parentId,
                    sortOrder: sortOrderCounter++,
                    isActive: true
                }
            });

            categorySlugIdMap[node.slug] = category.id;

            if (Array.isArray(node.children) && node.children.length > 0) {
                await createNodes(node.children, category.id);
            } else {
                leafCategorySlugs.push(node.slug);
            }
        }
    }

    await createNodes(categoryTree, null);
    console.log(`✅ Created ${Object.keys(categorySlugIdMap).length} categories (${leafCategorySlugs.length} leaf categories)`);

    return { categorySlugIdMap, leafCategorySlugs };
}

async function seedProducts(categorySlugIdMap, leafCategorySlugs, slugToProductLabel) {
    console.log('📦 Creating products, variants, inventory and rich content...');

    let totalProducts = 0;
    let totalVariants = 0;

    for (const catSlug of leafCategorySlugs) {
        const categoryId = categorySlugIdMap[catSlug];
        if (!categoryId) continue;

        const segmentKey = catSlug.split('-')[0]; // fashion / electronics / home / beauty
        const segmentBrands = brandPools[segmentKey] || ['UrbanKart'];
        const leafTitle = titleCaseFromSlug(catSlug.replace(`${segmentKey}-`, ''));
        // Use explicit "Men's ...", "Women's ...", "Kids' ..." etc. for filter clarity
        const productLabel = slugToProductLabel[catSlug] || leafTitle;

        for (let i = 0; i < productStyles.length; i++) {
            const style = productStyles[i];
            const styleKey = style.toLowerCase().replace(/\s+/g, '-');
            const skuBase = `${catSlug.toUpperCase().replace(/-/g, '')}-${String(i + 1).padStart(2, '0')}`;
            const productName = `${style} ${productLabel}`;
            const slug = `${catSlug}-${styleKey}`;
            const brand = segmentBrands[(totalProducts + i) % segmentBrands.length];

            let basePrice = 499 + i * 100;
            if (segmentKey === 'electronics') basePrice += 2500;
            if (segmentKey === 'home') basePrice += 300;
            if (segmentKey === 'beauty') basePrice = 299 + i * 80;

            const status = i <= 1 ? 'published' : i === 2 ? 'draft' : 'archived';
            const isFeatured = i === 0 || (totalProducts + i) % 5 === 0;

            const product = await prisma.product.create({
                data: {
                    sku: skuBase,
                    name: productName,
                    slug,
                    basePrice,
                    categoryId,
                    brand,
                    status,
                    isFeatured
                }
            });

            totalProducts++;

            // Variants & inventory — segment-specific options (fashion: size/color, electronics: storage/color, etc.)
            const variantOpts = segmentVariantOptions[segmentKey] || segmentVariantOptions.fashion;
            const sizes = variantOpts.sizes;
            const colors = variantOpts.colors;
            let variantIndexForProduct = 0;

            for (const size of sizes) {
                for (const color of colors) {
                    if (variantIndexForProduct >= 6) break;

                    const sku = `${skuBase}-${String(globalVariantCounter).padStart(3, '0')}`;
                    const variantName = `${color} / ${size}`;
                    const priceAdjustment =
                        segmentKey === 'fashion' && ['L', 'XL'].includes(size)
                            ? 100
                            : segmentKey === 'electronics' && size === '512GB'
                            ? 150
                            : segmentKey === 'beauty' && size === '100ml'
                            ? 80
                            : 0;
                    const quantity = 20 + 5 * i + 3 * variantIndexForProduct;

                    await prisma.productVariant.create({
                        data: {
                            productId: product.id,
                            sku,
                            name: variantName,
                            options: { color, size },
                            priceAdjustment,
                            inventory: {
                                create: {
                                    quantity,
                                    lowThreshold: 5,
                                    warehouseLoc: `WH-${segmentKey.toUpperCase()}-${(variantIndexForProduct % 3) + 1}`
                                }
                            }
                        }
                    });

                    variantIndexForProduct++;
                    globalVariantCounter++;
                    totalVariants++;
                }
                if (variantIndexForProduct >= 6) break;
            }

            // Rich content in Mongo
            const mediaGallery = [];

            const attributes = {
                material:
                    segmentKey === 'fashion'
                        ? '100% Cotton'
                        : segmentKey === 'home'
                        ? 'Premium blended fabric'
                        : segmentKey === 'electronics'
                        ? 'Aluminium and polycarbonate body'
                        : 'Dermatologically tested formula',
                dimensions:
                    segmentKey === 'electronics'
                        ? { l: 15 + i, w: 7 + i * 0.3, h: 0.8 + i * 0.1, unit: 'cm' }
                        : { l: 30 + i * 2, w: 25 + i * 1.5, h: 3 + i, unit: 'cm' },
                care_instructions:
                    segmentKey === 'fashion'
                        ? 'Machine wash cold, tumble dry low. Do not bleach.'
                        : segmentKey === 'home'
                        ? 'Gentle hand wash recommended. Keep away from direct sunlight.'
                        : segmentKey === 'electronics'
                        ? 'Keep away from liquids and extreme temperatures.'
                        : 'Store in a cool, dry place. Patch test recommended.'
            };

            await ProductRichContent.create({
                pg_id: product.id,
                description_html: `<p>${productName} from our ${productLabel} selection. Designed for everyday use with a focus on comfort and quality.</p>`,
                lifestyle_tags: [segmentKey, productLabel.toLowerCase().replace(/'s /g, ' '), style.toLowerCase()],
                attributes,
                media_gallery: mediaGallery,
                seo: {
                    meta_title: `${productName} | UrbanKart`,
                    meta_description: `Shop ${productName} in ${productLabel}. High-quality ${segmentKey} selection on UrbanKart.`,
                    structured_data: {
                        '@context': 'https://schema.org',
                        '@type': 'Product',
                        name: productName,
                        image: mediaGallery.map((m) => m.url),
                        brand,
                        category: productLabel
                    }
                },
                related_products: [],
                cross_sell: []
            });
        }
    }

    console.log(`✅ Created ${totalProducts} products with ${totalVariants} variants (each with inventory and rich media)`);
}

async function seedCategoryFeedSections(allCategorySlugs) {
    console.log('🎨 Creating category feed sections for categories...');

    const promoTitles = [
        'Hot Picks in {name}',
        'New Season {name}',
        'Top Rated {name}',
        'Limited Time {name} Deals',
        'Under Budget {name}',
        'Editor’s Picks in {name}',
        'Trending Now in {name}',
        '{name} Must‑Haves',
        'Premium {name} Collection',
        'Fresh {name} Arrivals'
    ];

    const badges = ['HOT', 'TRENDING', 'NEW', 'LIMITED', 'TOP PICK', 'EDITOR’S PICK'];
    const slugToImage = buildSlugToImageMap();
    let sectionCount = 0;

    for (const slug of allCategorySlugs) {
        const humanName = titleCaseFromSlug(slug.replace(/-/g, ' '));
        const sectionImage = slugToImage[slug] || null;

        // Clear any existing sections for this category so we can reseed
        await CategoryFeedSection.deleteMany({ categorySlug: slug.toLowerCase() });

        // Try to pull real products for this segment so feed items
        // show actual product names, prices and images.
        const likeSlug = slug.includes('-') ? slug : `${slug}-`;
        const products = await prisma.product.findMany({
            where: {
                status: 'published',
                category: {
                    slug: {
                        startsWith: likeSlug
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 48
        });

        if (!products.length) {
            // Skip feed for categories without products yet.
            continue;
        }

        const productIds = products.map((p) => p.id);
        const richDocs = await ProductRichContent.find(
            { pg_id: { $in: productIds } },
            { pg_id: 1, media_gallery: 1 }
        ).lean();
        const richById = new Map();
        richDocs.forEach((doc) => {
            if (doc && doc.pg_id) {
                richById.set(doc.pg_id, doc);
            }
        });

        const getPrimaryImage = (pid) => {
            const doc = richById.get(pid);
            if (!doc || !Array.isArray(doc.media_gallery) || !doc.media_gallery.length) return sectionImage;
            const primary =
                doc.media_gallery.find((m) => m && m.is_primary) || doc.media_gallery[0];
            return primary?.url || sectionImage;
        };

        // 8 carousel sections per category (within requested 7‑10 range)
        const sectionsPerCategory = 8;
        const itemCountPerSection = 6;

        for (let i = 0; i < sectionsPerCategory; i++) {
            const titleTemplate = promoTitles[i % promoTitles.length];
            const title = titleTemplate.replace('{name}', humanName);

            const items = [];
            for (let j = 0; j < itemCountPerSection; j++) {
                const productIndex = (i * itemCountPerSection + j) % products.length;
                const product = products[productIndex];
                const badge = badges[(i + j) % badges.length];
                const image = getPrimaryImage(product.id);

                items.push({
                    id: product.id,
                    name: product.name,
                    image,
                    price: product.basePrice,
                    slug: product.slug,
                    brand_id: undefined,
                    logo: undefined,
                    badge,
                    subtitle: product.brand || humanName,
                    link: `/product/${encodeURIComponent(product.slug)}`
                });
            }

            await CategoryFeedSection.create({
                categorySlug: slug.toLowerCase(),
                type: 'carousel',
                title,
                image: sectionImage,
                mobile_image: null,
                redirect_url: `/shop?category=${encodeURIComponent(slug)}`,
                displayOrder: i,
                isActive: true,
                items
            });

            sectionCount++;
        }
    }

    console.log(`✅ Created ${sectionCount} category feed sections (flashy carousel banners)`);
}

// ----- Shared helpers for extended seeders -----

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ----- Fashion CSV seeder (from scripts/seed-fashion.js, adapted) -----

const FASHION_CSV_PATH = process.env.FASHION_CSV || path.join(__dirname, 'product_images/fashion.csv');
const PRODUCT_IMAGES_BASE = process.env.PRODUCT_IMAGES_DIR || path.join(__dirname, 'product_images');
// Default to local uploads so seeded media stays on server storage unless explicitly set to "b2"
const UPLOAD_METHOD = (process.env.UPLOAD_METHOD || 'local').toLowerCase();
const LOCAL_UPLOAD_PATH = process.env.LOCAL_UPLOAD_PATH || path.join(__dirname, 'uploads');
const FASHION_SEED_LIMIT = process.env.FASHION_SEED_LIMIT ? parseInt(process.env.FASHION_SEED_LIMIT, 10) : null;

const FASHION_GENDER_TO_FOLDER = {
    Men: 'men_footwear_images_with_product_ids',
    Women: 'women_footwear_images_with_product_ids',
    Boys: 'boys_images_with_product_ids',
    Girls: 'girls_images_with_product_ids'
};

function fashionSlugify(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

function fashionParseCsv(content) {
    const lines = content.split(/\r?\n/).filter(Boolean);
    const header = lines[0];
    if (!header || !header.includes('ProductId')) {
        throw new Error('fashion.csv must have header with ProductId,Gender,Category,SubCategory,...');
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

function fashionBuildCategoryTree(rows) {
    const seen = new Set();
    const leafKeys = [];
    for (const r of rows) {
        const gender = String(r.gender || '').trim();
        const category = String(r.category || '').trim();
        const subCategory = String(r.subCategory || '').trim();
        const genderLower = gender.toLowerCase();
        const categoryLower = category.toLowerCase();
        const subLower = subCategory.toLowerCase();

        // Skip malformed header-like rows that would create a bogus "Gender / Category" branch
        if (genderLower === 'gender' || categoryLower === 'category' || subLower === 'subcategory') {
            continue;
        }

        const key = `${gender}|${category}|${subCategory}`;
        if (!seen.has(key)) {
            seen.add(key);
            leafKeys.push({ gender, category, subCategory });
        }
    }
    const root = { name: 'Fashion', slug: 'fashion', children: {} };
    for (const { gender, category, subCategory } of leafKeys) {
        const gSlug = fashionSlugify(gender);
        const cSlug = fashionSlugify(category);
        const sSlug = fashionSlugify(subCategory);
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

function fashionGetLeafSlug(row) {
    const gSlug = fashionSlugify(row.gender);
    const cSlug = fashionSlugify(row.category);
    const sSlug = fashionSlugify(row.subCategory);
    return `fashion-${gSlug}-${cSlug}-${sSlug}`;
}

function fashionPickRowsDistributedByCategory(rows, limit) {
    const byLeaf = new Map();
    for (const row of rows) {
        const genderLower = String(row.gender || '').toLowerCase().trim();
        const categoryLower = String(row.category || '').toLowerCase().trim();
        const subLower = String(row.subCategory || '').toLowerCase().trim();

        // Skip malformed header-like rows (Gender / Category / SubCategory)
        if (genderLower === 'gender' || categoryLower === 'category' || subLower === 'subcategory') {
            continue;
        }

        const slug = fashionGetLeafSlug(row);
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

async function fashionUploadToLocal(fileBuffer, relativePath) {
    const dir = path.join(LOCAL_UPLOAD_PATH, path.dirname(relativePath));
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(LOCAL_UPLOAD_PATH, relativePath);
    await fs.writeFile(fullPath, fileBuffer);
}

async function fashionResolveImageUrls(row) {
    const folder = FASHION_GENDER_TO_FOLDER[row.gender];
    if (!folder) return null;
    const imagePath = path.join(PRODUCT_IMAGES_BASE, folder, row.image);
    try {
        await fs.access(imagePath);
    } catch {
        return null;
    }
    const buf = await fs.readFile(imagePath);
    let sourceBuffer = buf;
    try {
        sourceBuffer = await compressImage(buf);
    } catch {
        // keep original
    }

    const allVariants = await generateAugmentedVariants(sourceBuffer);
    const variants = allVariants.slice(0, 2); // original + mirror
    const extension = 'webp';
    const basePath = `products/fashion/${row.productId}`;
    const urls = [];
    const baseLocal = process.env.SEED_MEDIA_BASE_URL || 'http://localhost:5001/uploads';
    for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const relativePath = `${basePath}${v.suffix}.${extension}`;
        if (UPLOAD_METHOD === 'local') {
            await fashionUploadToLocal(v.buffer, relativePath);
            urls.push({ url: `${baseLocal}/${relativePath}`, order: i + 1, is_primary: i === 0 });
        } else {
            await uploadFile(v.buffer, relativePath, 'image/webp');
            urls.push({ url: `${getBaseMediaUrl()}/${relativePath}`, order: i + 1, is_primary: i === 0 });
        }
    }
    return urls;
}

function fashionRandomPrice() {
    return Math.floor(100 + Math.random() * 3900);
}

function fashionBasePriceForRow(row) {
    const sub = (row.subCategory || '').toLowerCase();
    const pt = (row.productType || '').toLowerCase();

    const isFootwear =
        sub === 'shoes' ||
        sub === 'sandal' ||
        sub === 'sandals' ||
        sub === 'flip flops' ||
        sub.includes('footwear') ||
        pt.includes('shoe') ||
        pt.includes('shoes') ||
        pt.includes('sandal') ||
        pt.includes('flip flops') ||
        pt.includes('footwear');

    if (isFootwear) {
        // Footwear: price between 300 and 2000
        return Math.floor(300 + Math.random() * 1700);
    }

    // Default fashion pricing
    return fashionRandomPrice();
}

function fashionGenerateProductDescription(row) {
    const name = row.productTitle || `Product ${row.productId}`;
    const gender = row.gender.toLowerCase();
    const category = row.category;
    const subCategory = row.subCategory;
    const productType = row.productType;
    const colour = row.colour;
    const usage = row.usage;

    const intro = `${name} is a ${colour.toLowerCase()} ${productType.toLowerCase()} from our ${subCategory} collection, designed for ${gender}. Ideal for ${usage.toLowerCase()} wear, this ${category.toLowerCase()} piece fits seamlessly into your wardrobe.`;
    const detail = 'Crafted with attention to comfort and style, it pairs well with a variety of outfits. Easy to care for—follow the care label for best results.';

    return `<p>${escapeHtml(intro)}</p><p>${escapeHtml(detail)}</p>`;
}

function fashionGetSizesForProduct(row) {
    const pt = (row.productType || '').toLowerCase();
    const sub = (row.subCategory || '').toLowerCase();
    const gender = (row.gender || '').toLowerCase();

    if (
        sub === 'shoes' ||
        sub === 'sandal' ||
        sub === 'flip flops' ||
        pt.includes('shoes') ||
        pt.includes('sandals') ||
        pt.includes('flip flops')
    ) {
        return ['6', '7', '8', '9', '10'];
    }

    if (sub === 'socks' || pt.includes('socks') || pt.includes('booties') || pt.includes('vests')) {
        return ['S', 'M', 'L'];
    }

    if (sub === 'dress' || pt.includes('dress') || pt.includes('lehenga')) {
        return ['XS', 'S', 'M', 'L', 'XL'];
    }

    if (gender === 'boys' || gender === 'girls') {
        // Age-based sizing for kids
        return ['<1 year', '1-3 years', '3-5 years'];
    }

    if (
        sub === 'topwear' ||
        pt.includes('top') ||
        pt.includes('tshirt') ||
        pt.includes('shirt') ||
        pt.includes('kurtas') ||
        pt.includes('jacket') ||
        pt.includes('blazer') ||
        pt.includes('sweatshirt') ||
        pt.includes('waistcoat') ||
        pt.includes('rompers')
    ) {
        return ['S', 'M', 'L', 'XL', 'XXL'];
    }

    if (
        sub === 'bottomwear' ||
        pt.includes('jeans') ||
        pt.includes('trousers') ||
        pt.includes('capris') ||
        pt.includes('shorts') ||
        pt.includes('skirts') ||
        pt.includes('leggings') ||
        pt.includes('churidar') ||
        pt.includes('salwar')
    ) {
        return ['S', 'M', 'L', 'XL', 'XXL'];
    }

    if (sub === 'apparel set' || pt.includes('set')) {
        return ['S', 'M', 'L', 'XL'];
    }

    return ['S', 'M', 'L', 'XL'];
}

async function seedFashionFromCsv() {
    console.log('👟 Seeding fashion products from CSV...');
    const content = await fs.readFile(FASHION_CSV_PATH, 'utf8');
    const allRows = fashionParseCsv(content);
    console.log('Total rows in CSV:', allRows.length);

    const root = fashionBuildCategoryTree(allRows);
    const slugToId = {};
    let sortOrder = 0;

    async function upsertCategory(node, parentId = null) {
        const slug = node.slug;
        let existing = await prisma.category.findFirst({ where: { slug } });
        if (existing) {
            slugToId[slug] = existing.id;
        } else {
            const created = await prisma.category.create({
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
            existing = created;
            slugToId[slug] = created.id;
        }
        return existing.id;
    }

    const fashionRootId = await upsertCategory({ name: 'Fashion', slug: 'fashion' }, null);
    const genders = Object.values(root.children);
    for (const gNode of genders) {
        const genderId = await upsertCategory(gNode, fashionRootId);
        if (gNode.children && typeof gNode.children === 'object') {
            for (const cNode of Object.values(gNode.children)) {
                const catId = await upsertCategory(cNode, genderId);
                if (cNode.children && typeof cNode.children === 'object') {
                    for (const sNode of Object.values(cNode.children)) {
                        await upsertCategory(sNode, catId);
                    }
                }
            }
        }
    }

    const leafSlugs = Object.keys(slugToId).filter((s) => s.split('-').length >= 4);
    console.log('Fashion leaf categories ready:', leafSlugs.length);

    let rows = allRows;
    if (FASHION_SEED_LIMIT) {
        rows = fashionPickRowsDistributedByCategory(allRows, FASHION_SEED_LIMIT);
        console.log('Fashion limited to', rows.length, 'products distributed across categories');
    }

    let created = 0;
    let skipped = 0;
    const total = rows.length;
    const BATCH = 20;

    for (let i = 0; i < total; i++) {
        const row = rows[i];
        const leafSlug = fashionGetLeafSlug(row);
        const categoryId = slugToId[leafSlug];
        if (!categoryId) {
            skipped++;
            continue;
        }

        const imageUrls = await fashionResolveImageUrls(row);
        if (!imageUrls || imageUrls.length === 0) {
            skipped++;
            if (skipped <= 10) console.log('Fashion skip (no image):', row.productId, row.gender, row.image);
            continue;
        }

        const slug = `fashion-${row.productId}`;
        const sku = `FASH-${row.productId}`;
        const basePrice = fashionBasePriceForRow(row);
        const name = row.productTitle || `Product ${row.productId}`;
        const descriptionHtml = fashionGenerateProductDescription(row);

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
                    isFeatured: true
                }
            });

            const sizes = fashionGetSizesForProduct(row);
            let variantNum = 1;
            for (const size of sizes) {
                await prisma.productVariant.create({
                    data: {
                        productId: product.id,
                        sku: `${sku}-${String(variantNum).padStart(2, '0')}`,
                        name: `${row.colour} / ${size}`,
                        options: { color: row.colour, size },
                        priceAdjustment: 0,
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
            if (created % BATCH === 0 || created === total) {
                console.log(
                    `   ▶ Fashion seeding: ${created}/${total} products created (latest category: ${leafSlug})`
                );
            }
        } catch (err) {
            if (err.code === 'P2002') {
                skipped++;
                continue;
            }
            throw err;
        }
    }

    console.log('✅ Fashion seeding done. Created:', created, 'Skipped:', skipped);
}

// ----- Apparel image-based seeder (from scripts/seed-apparel.js, adapted) -----

const APPAREL_IMAGES_BASE = process.env.PRODUCT_IMAGES_DIR || path.join(__dirname, 'product_images');
const MEN_CLOTH_DIR = process.env.MEN_CLOTH_DIR || path.join(APPAREL_IMAGES_BASE, 'men_cloth/dataset_clean');
const WOMEN_CLOTH_DIR = process.env.WOMEN_CLOTH_DIR || path.join(APPAREL_IMAGES_BASE, 'women fashion');
const APPAREL_SEED_LIMIT_MEN = process.env.APPAREL_SEED_LIMIT_MEN ? parseInt(process.env.APPAREL_SEED_LIMIT_MEN, 10) : null;
const APPAREL_SEED_LIMIT_WOMEN = process.env.APPAREL_SEED_LIMIT_WOMEN ? parseInt(process.env.APPAREL_SEED_LIMIT_WOMEN, 10) : null;

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

function apparelSlugify(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

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
    if (
        lower.includes('dress') ||
        lower.includes('party') ||
        lower.includes('bodycon') ||
        lower.includes('sequin') ||
        lower.includes('midi') ||
        lower.includes('slip')
    )
        return 'dresses';
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

    const maxOrder = await prisma.category
        .findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })
        .then((c) => (c?.sortOrder ?? -1) + 1);
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
    slugToId.fashion = fashionId;

    const menId = await getOrCreateCategory('fashion-men', 'Men', fashionId, sortOrder++);
    for (const { folder, name } of MEN_SUBCATEGORIES) {
        const slug = `fashion-men-${apparelSlugify(folder)}`;
        await getOrCreateCategory(slug, name, menId, sortOrder++);
    }

    const womenId = await getOrCreateCategory('fashion-women', 'Women', fashionId, sortOrder++);
    for (const { slug: subSlug, name } of WOMEN_SUBCATEGORIES) {
        const slug = `fashion-women-${subSlug}`;
        await getOrCreateCategory(slug, name, womenId, sortOrder++);
    }

    return slugToId;
}

async function apparelUploadToLocal(fileBuffer, relativePath) {
    const dir = path.join(LOCAL_UPLOAD_PATH, path.dirname(relativePath));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(LOCAL_UPLOAD_PATH, relativePath), fileBuffer);
}

async function apparelResolveImageUrls(sourceBuffer, productSlug) {
    let buffer = sourceBuffer;
    try {
        buffer = await compressImage(sourceBuffer);
    } catch (e) {
        // use original
    }
    const allVariants = await generateAugmentedVariants(buffer);
    const variants = allVariants.slice(0, 2); // original + mirror
    const extension = 'webp';
    const basePath = `products/apparel/${productSlug}`;
    const urls = [];
    const baseLocal = process.env.SEED_MEDIA_BASE_URL || 'http://localhost:5001/uploads';
    for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const relativePath = `${basePath}${v.suffix}.${extension}`;
        if (UPLOAD_METHOD === 'local') {
            await apparelUploadToLocal(v.buffer, relativePath);
            urls.push({ url: `${baseLocal}/${relativePath}`, order: i + 1, is_primary: i === 0 });
        } else {
            await uploadFile(v.buffer, relativePath, 'image/webp');
            urls.push({ url: `${getBaseMediaUrl()}/${relativePath}`, order: i + 1, is_primary: i === 0 });
        }
    }
    return urls;
}

function apparelRandomPrice() {
    return Math.floor(299 + Math.random() * 3700);
}

// Use richer marketing-style names and descriptions for apparel products
const APPAREL_MEN_NAME_ADJECTIVES = [
    'Classic',
    'Everyday',
    'Relaxed Fit',
    'Signature',
    'Premium',
    'Street Fit',
    'Comfort Stretch',
    'Tailored'
];

const APPAREL_WOMEN_NAME_ADJECTIVES = [
    'Elegant',
    'Occasion',
    'Statement',
    'Everyday',
    'Festive',
    'Classic',
    'Draped',
    'Modern'
];

function pickApparelBrand(index) {
    const pool = brandPools.fashion || ['UrbanBasics', 'StreetLine', 'DailyWear', 'AthletiQ', 'Classic Tailor'];
    return pool[index % pool.length];
}

function buildApparelProductName(gender, subCategoryName, brand, index) {
    const adjectives = gender === 'women' ? APPAREL_WOMEN_NAME_ADJECTIVES : APPAREL_MEN_NAME_ADJECTIVES;
    const adjective = adjectives[index % adjectives.length];
    const base = `${brand} ${adjective} ${subCategoryName}`;
    return base.length > 120 ? `${base.slice(0, 117)}...` : base;
}

function generateApparelDescription(name, subCategoryName, gender) {
    const intro = `${name} comes from our ${subCategoryName.toLowerCase()} curation for ${gender}. Designed to balance comfort, style and everyday versatility.`;
    const fabric = 'Soft, breathable fabric with a focus on long-lasting color and shape retention.';
    const detail = 'Ideal for daily wear, casual outings and relaxed weekends. Follow the care label for best results.';
    return `<p>${escapeHtml(intro)}</p><p>${escapeHtml(fabric)}</p><p>${escapeHtml(detail)}</p>`;
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

async function listMenClothImages() {
    const out = [];
    for (const { folder } of MEN_SUBCATEGORIES) {
        const dir = path.join(MEN_CLOTH_DIR, folder);
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = entries.filter((e) => e.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(e.name)).map((e) => e.name);
            if (files.length) out.push({ folder, files });
        } catch (err) {
            console.warn('Skip men folder:', dir, err.message);
        }
    }
    return out;
}

async function listWomenClothImages() {
    try {
        const entries = await fs.readdir(WOMEN_CLOTH_DIR, { withFileTypes: true });
        return entries.filter((e) => e.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(e.name)).map((e) => e.name);
    } catch (err) {
        console.warn('Skip women folder:', WOMEN_CLOTH_DIR, err.message);
        return [];
    }
}

async function seedApparelFromImages() {
    console.log('👕 Seeding apparel products from local image folders...');
    console.log('Men cloth dir:', MEN_CLOTH_DIR);
    console.log('Women cloth dir:', WOMEN_CLOTH_DIR);
    console.log('Apparel seed: additive mode (will not delete existing categories or products).');

    const slugToId = {};
    await getOrCreateApparelCategories(slugToId);
    console.log('Apparel categories ready.');

    let createdMen = 0;
    let createdWomen = 0;

    const menByFolder = await listMenClothImages();
    console.log('   Men folders found:', menByFolder.map((m) => m.folder).join(', ') || 'none');
    let menIndex = 0;
    const menLimitPerFolder = APPAREL_SEED_LIMIT_MEN ? Math.ceil(APPAREL_SEED_LIMIT_MEN / menByFolder.length) : null;

    for (const { folder, files } of menByFolder) {
        const leafSlug = `fashion-men-${apparelSlugify(folder)}`;
        const categoryId = slugToId[leafSlug];
        if (!categoryId) continue;

        const subCatName = MEN_SUBCATEGORIES.find((s) => s.folder === folder).name;
        const toProcess = menLimitPerFolder ? files.slice(0, menLimitPerFolder) : files;

        for (let i = 0; i < toProcess.length; i++) {
            const imageName = toProcess[i];
            const imagePath = path.join(MEN_CLOTH_DIR, folder, imageName);
            let buf;
            try {
                buf = await fs.readFile(imagePath);
            } catch {
                continue;
            }

            const productSlug = `men-${folder}-${menIndex}`;
            const imageUrls = await apparelResolveImageUrls(buf, productSlug);
            if (!imageUrls.length) continue;

            const menBrand = pickApparelBrand(menIndex);
            const name = buildApparelProductName('men', subCatName, menBrand, menIndex);
            const sku = `MEN-${folder.toUpperCase().replace(/_/g, '-')}-${String(menIndex).padStart(4, '0')}`;
            const basePrice = apparelRandomPrice();
            const sizes = getSizesForMenSubcategory(folder);

            try {
                const product = await prisma.product.create({
                    data: {
                        sku,
                        name,
                        slug: productSlug,
                        basePrice,
                        categoryId,
                        brand: menBrand,
                        status: 'published',
                        isFeatured: true
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
                    description_html: generateApparelDescription(name, subCatName, 'men'),
                    lifestyle_tags: [folder, subCatName, menBrand],
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
                if (createdMen % 10 === 0 || createdMen === menLimitPerFolder * menByFolder.length) {
                    console.log(
                        `   ▶ Men apparel: ${createdMen} products created (folder: ${folder})`
                    );
                }
            } catch (err) {
                if (err.code === 'P2002') continue;
                throw err;
            }
            menIndex++;
        }
    }

    const womenFiles = await listWomenClothImages();
    console.log('   Women images found:', womenFiles.length);
    const toProcessWomen = APPAREL_SEED_LIMIT_WOMEN ? womenFiles.slice(0, APPAREL_SEED_LIMIT_WOMEN) : womenFiles;

    const totalWomen = toProcessWomen.length;

    for (let i = 0; i < totalWomen; i++) {
        const imageName = toProcessWomen[i];
        const imagePath = path.join(WOMEN_CLOTH_DIR, imageName);
        let buf;
        try {
            buf = await fs.readFile(imagePath);
        } catch {
            continue;
        }

        const subSlug = inferWomenSubcategory(imageName);
        const leafSlug = `fashion-women-${subSlug}`;
        const categoryId = slugToId[leafSlug];
        if (!categoryId) continue;

        const subCatName = WOMEN_SUBCATEGORIES.find((s) => s.slug === subSlug)?.name || 'Dresses';
        const productSlug = `women-${i}-${apparelSlugify(path.basename(imageName, path.extname(imageName))).slice(0, 50)}`;
        const imageUrls = await apparelResolveImageUrls(buf, productSlug);
        if (!imageUrls.length) continue;

        const womenBrand = pickApparelBrand(i);
        const name = buildApparelProductName('women', subCatName, womenBrand, i);
        const sku = `WOMEN-${subSlug.toUpperCase().replace(/-/g, '-')}-${String(i).padStart(4, '0')}`;
        const basePrice = apparelRandomPrice();
        const sizes = getSizesForWomenSubcategory(subSlug);

        try {
            const product = await prisma.product.create({
                data: {
                    sku,
                    name,
                    slug: productSlug,
                    basePrice,
                    categoryId,
                    brand: womenBrand,
                    status: 'published',
                    isFeatured: true
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
                description_html: generateApparelDescription(name, subCatName, 'women'),
                lifestyle_tags: [subSlug, subCatName, womenBrand],
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
            if (createdWomen % 10 === 0 || createdWomen === totalWomen) {
                console.log(
                    `   ▶ Women apparel: ${createdWomen}/${totalWomen} products created (sub: ${subSlug})`
                );
            }
        } catch (err) {
            if (err.code === 'P2002') continue;
            throw err;
        }
    }

    console.log('✅ Apparel seeding done. Men products:', createdMen, 'Women products:', createdWomen);
}

// ----- Beauty JSON seeder (from scripts/seed-beauty.js, adapted) -----

const BEAUTY_JSON_PATH = process.env.BEAUTY_JSON_PATH || path.join(__dirname, 'product_images/makeup_data.json');
const BEAUTY_SEED_LIMIT = process.env.BEAUTY_SEED_LIMIT ? parseInt(process.env.BEAUTY_SEED_LIMIT, 10) : null;
const HOME_DECOR_SEED_LIMIT = process.env.HOME_DECOR_SEED_LIMIT
    ? parseInt(process.env.HOME_DECOR_SEED_LIMIT, 10)
    : null;

function beautySlugify(str) {
    if (!str || typeof str !== 'string') return 'uncategorized';
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'uncategorized';
}

const BEAUTY_PRODUCT_TYPE_NAMES = {
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

function beautyToInrPrice(p) {
    const num = typeof p === 'number' && !Number.isNaN(p) ? p : parseFloat(String(p).replace(/[^0-9.]/g, ''), 10);
    if (!Number.isFinite(num) || num <= 0) return Math.floor(299 + Math.random() * 500);
    return Math.round(num * 83);
}

function beautyImageUrl(link, featured) {
    const url = (link && String(link).trim()) || (featured && String(featured).trim());
    if (!url) return null;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('http')) return url;
    return 'https://' + url.replace(/^\/+/, '');
}

async function deleteBeautyData() {
    const beautyCategories = await prisma.category.findMany({
        where: { OR: [{ slug: 'beauty' }, { slug: { startsWith: 'beauty-' } }] },
        select: { id: true, slug: true }
    });
    const beautyCatIds = beautyCategories.map((c) => c.id);
    if (beautyCatIds.length === 0) {
        console.log('No existing beauty categories to delete.');
        return;
    }

    const beautyProducts = await prisma.product.findMany({
        where: { categoryId: { in: beautyCatIds } },
        select: { id: true }
    });
    const productIds = beautyProducts.map((p) => p.id);
    if (productIds.length > 0) {
        await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });
        await prisma.product.deleteMany({ where: { id: { in: productIds } } });
        await ProductRichContent.deleteMany({ pg_id: { $in: productIds } });
        console.log('Deleted', productIds.length, 'beauty products and related data.');
    }

    const rootId = beautyCategories.find((c) => c.slug === 'beauty')?.id;
    const childIds = beautyCatIds.filter((id) => id !== rootId);
    for (const id of childIds) {
        await prisma.category.delete({ where: { id } }).catch(() => {});
    }
    if (rootId) await prisma.category.delete({ where: { id: rootId } }).catch(() => {});
    console.log('Deleted beauty categories.');
}

async function createBeautyCategories(slugToId) {
    let sortOrder = await prisma.category
        .findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } })
        .then((c) => (c?.sortOrder ?? -1) + 1);

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
    slugToId.beauty = beautyRoot.id;

    for (const [typeSlug, displayName] of Object.entries(BEAUTY_PRODUCT_TYPE_NAMES)) {
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

async function seedBeautyFromJson() {
    console.log('💄 Seeding beauty products from JSON...');
    const raw = await fs.readFile(BEAUTY_JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    const items = Array.isArray(data) ? data : data.products || data.items || [];
    console.log('Products in beauty JSON:', items.length);

    await deleteBeautyData();
    const slugToId = {};
    await createBeautyCategories(slugToId);
    console.log('Beauty categories created:', Object.keys(BEAUTY_PRODUCT_TYPE_NAMES).length, 'subcategories.');

    const toProcess = BEAUTY_SEED_LIMIT ? items.slice(0, BEAUTY_SEED_LIMIT) : items;
    const total = toProcess.length;
    let created = 0;
    let skipped = 0;
    const seenSlug = new Set();

    for (let i = 0; i < total; i++) {
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

        const basePrice = beautyToInrPrice(p.price);
        const sku = `BEAUTY-${p.id || i}-${String(i).padStart(4, '0')}`;
        const slugBase = beautySlugify(name).slice(0, 50);
        let slug = `beauty-${slugBase}-${i}`;
        let idx = 0;
        while (seenSlug.has(slug)) {
            slug = `beauty-${slugBase}-${i}-${idx++}`;
        }
        seenSlug.add(slug);

        const imgUrl = beautyImageUrl(p.image_link, p.api_featured_image);
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
                    isFeatured: true
                }
            });

            await prisma.productVariant.create({
                data: {
                    productId: product.id,
                    sku: `${sku}-01`,
                    name: 'One Size',
                    options: { size: 'One Size' },
                    priceAdjustment: 0,
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
            if (created % 25 === 0 || created === total) {
                console.log(
                    `   ▶ Beauty seeding: ${created}/${total} products created (type: ${productType})`
                );
            }
        } catch (err) {
            if (err.code === 'P2002') {
                skipped++;
                continue;
            }
            throw err;
        }
    }

    console.log('✅ Beauty seeding done. Created:', created, 'Skipped:', skipped);
}

// ----- Curated Home Decor seeder using local candle images -----

async function seedCuratedHomeDecor() {
    console.log('🏡 Seeding curated Home Decor products from candle_images...');

    const homeDecorCategory = await prisma.category.findFirst({
        where: { slug: 'home-decor' }
    });

    if (!homeDecorCategory) {
        console.log('   ⚠️ home-decor category not found, skipping curated Home Decor seed.');
        return;
    }

    const CANDLE_IMAGES_DIR =
        process.env.CANDLE_IMAGES_DIR || path.join(__dirname, 'product_images/candle_images');

    let files;
    try {
        const entries = await fs.readdir(CANDLE_IMAGES_DIR, { withFileTypes: true });
        files = entries
            .filter((e) => e.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(e.name))
            .map((e) => e.name);
    } catch (err) {
        console.log('   ⚠️ Could not read candle images directory:', CANDLE_IMAGES_DIR, err.message);
        return;
    }

    if (!files || !files.length) {
        console.log('   ⚠️ No candle images found in', CANDLE_IMAGES_DIR);
        return;
    }

    if (HOME_DECOR_SEED_LIMIT && files.length > HOME_DECOR_SEED_LIMIT) {
        files = files.slice(0, HOME_DECOR_SEED_LIMIT);
        console.log(
            `   ℹ️ HOME_DECOR_SEED_LIMIT=${HOME_DECOR_SEED_LIMIT} applied, using first ${files.length} candle images.`
        );
    }

    const homeBrands = brandPools.home || ['CasaCraft', 'Hearth&Home', 'LuxeLoom', 'CookMate'];
    const decorTypes = ['candle', 'light', 'vase', 'flower', 'pebbles'];

    let created = 0;

    for (let i = 0; i < files.length; i++) {
        const fileName = files[i];
        const decorType = decorTypes[i % decorTypes.length];
        const baseName = path.basename(fileName, path.extname(fileName));
        const humanBase =
            baseName
                .replace(/[_\-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim() || 'Decor Candle';

        const typeLabel =
            decorType === 'candle'
                ? 'Candle'
                : decorType === 'light'
                ? 'Light'
                : decorType === 'vase'
                ? 'Vase'
                : decorType === 'flower'
                ? 'Flower Arrangement'
                : 'Decor Pebbles';

        const name = `${humanBase} ${typeLabel}`;
        const safeName = name.slice(0, 255);

        // Price between 100 and 1000
        let price = 199 + i * 70;
        if (price > 999) price = 999;
        if (price < 100) price = 100;

        const slugBase = apparelSlugify(`${decorType}-${baseName}`.slice(0, 60));
        const slug = `home-decor-${slugBase || decorType}-${i}`;
        const sku = `HOME-DECOR-${decorType.toUpperCase()}-${String(i + 1).padStart(3, '0')}`;

        const existing = await prisma.product.findUnique({
            where: { slug }
        });
        if (existing) continue;

        const brand = homeBrands[i % homeBrands.length];

        const imagePath = path.join(CANDLE_IMAGES_DIR, fileName);
        let buf;
        try {
            buf = await fs.readFile(imagePath);
        } catch {
            continue;
        }

        const imageUrls = await apparelResolveImageUrls(buf, slug);
        if (!imageUrls.length) continue;

        try {
            const product = await prisma.product.create({
                data: {
                    sku,
                    name: safeName,
                    slug,
                    basePrice: price,
                    categoryId: homeDecorCategory.id,
                    brand,
                    status: 'published',
                    isFeatured: true
                }
            });

            await prisma.productVariant.create({
                data: {
                    productId: product.id,
                    sku: `${sku}-01`,
                    name: 'One Size',
                    options: { size: 'One Size' },
                    priceAdjustment: 0,
                    inventory: {
                        create: {
                            quantity: 40,
                            lowThreshold: 5,
                            warehouseLoc: 'WH-HOME-DECOR-1'
                        }
                    }
                }
            });

            const description = `<p>${escapeHtml(
                `${safeName} is part of our curated home decor collection, perfect for styling consoles, coffee tables and cosy corners.`
            )}</p><p>${escapeHtml(
                'Layer it with other candles, lights, vases, florals and pebbles to create a warm, inviting ambience.'
            )}</p>`;

            await ProductRichContent.create({
                pg_id: product.id,
                description_html: description,
                lifestyle_tags: ['home', 'decor', decorType, brand],
                attributes: {
                    segment: 'home',
                    decor_type: decorType
                },
                media_gallery: imageUrls.map(({ url, order, is_primary }) => ({
                    url,
                    type: 'image',
                    alt: safeName,
                    order,
                    is_primary: !!is_primary
                })),
                related_products: [],
                cross_sell: []
            });

            created++;
        } catch (err) {
            if (err.code === 'P2002') {
                continue;
            }
            throw err;
        }
    }

    console.log('✅ Curated Home Decor seeding done. Created:', created);
}

// ----- Main seeding routine -----

async function seed() {
    try {
        console.log('🌱 Starting seeding...');

        // 1. Optionally clear product media blobs + databases (dev‑only – this is destructive)
        // To enable full reset, set ALLOW_DESTRUCTIVE_SEED=1 in the environment.
        const allowDestructiveSeed =
            process.env.ALLOW_DESTRUCTIVE_SEED === '1' ||
            process.env.ALLOW_DESTRUCTIVE_SEED === 'true';

        if (allowDestructiveSeed) {
            await clearProductMediaBlobs();
            await clearRelationalData();
        }

        await mongoose.connect(process.env.MONGODB_URI);

        if (allowDestructiveSeed) {
            await clearMongoData();
        }

        // 2. Admin user
        const admin = await createAdminUser();
        console.log(`✅ Admin user created: ${admin.email}`);

        // 3. Category tree with subcategories & sub‑subcategories
        const { categorySlugIdMap, leafCategorySlugs } = await seedCategories();

        // 4. (Disabled) Demo products based on synthetic category tree
        // We only want real products that have actual source images (fashion CSV, apparel folders, beauty JSON),
        // so the generic seedProducts() step is intentionally skipped.

        // 5. Extended domain-specific seeders (real products with images)
        await seedFashionFromCsv();
        await seedApparelFromImages();
        await seedBeautyFromJson();
        await seedCuratedHomeDecor();

        // 6. Category‑specific feed sections (carousels powered by real products)
        const allCategorySlugs = Object.keys(categorySlugIdMap);
        await seedCategoryFeedSections(allCategorySlugs);

        console.log('🌱 Seeding completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await mongoose.disconnect();
    }
}

seed();

