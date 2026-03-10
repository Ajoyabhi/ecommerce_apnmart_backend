const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { ProductRichContent, CategoryFeedSection } = require('./src/models');
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
        description: 'Trending fashion for men, women and kids.',
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
                    }
                ]
            },
            {
                name: 'Kids',
                slug: 'fashion-kids',
                description: 'Comfortable clothing for kids.',
                imageUrl: 'https://images.urbankart.dev/categories/fashion-kids.jpg',
                children: [
                    {
                        name: 'Boys Clothing',
                        slug: 'fashion-kids-boys-clothing',
                        description: 'Everyday wear for boys.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-kids-boys.jpg'
                    },
                    {
                        name: 'Girls Clothing',
                        slug: 'fashion-kids-girls-clothing',
                        description: 'Everyday wear for girls.',
                        imageUrl: 'https://images.urbankart.dev/categories/fashion-kids-girls.jpg'
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
// so filtering by category / subcategory / sub_subcategory shows clearly men vs women vs kids products.
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
                : node.imageUrl && node.imageUrl.includes('images.urbankart.dev')
                    ? `https://picsum.photos/seed/category-${node.slug}/800/400`
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
            const mediaGallery = [
                {
                    url: `https://picsum.photos/seed/product-${segmentKey}-${catSlug}-${styleKey}-1/800/800`,
                    type: 'image',
                    alt: `${productName} front view`,
                    order: 1,
                    is_primary: true
                },
                {
                    url: `https://picsum.photos/seed/product-${segmentKey}-${catSlug}-${styleKey}-2/800/800`,
                    type: 'image',
                    alt: `${productName} detail view`,
                    order: 2,
                    is_primary: false
                },
                {
                    url: `https://picsum.photos/seed/product-${segmentKey}-${catSlug}-${styleKey}-3/1200/800`,
                    type: 'image',
                    alt: `${productName} lifestyle shot`,
                    order: 3,
                    is_primary: false
                }
            ];

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
    let sectionCount = 0;

    for (const slug of allCategorySlugs) {
        const humanName = titleCaseFromSlug(slug.replace(/-/g, ' '));

        // 8 carousel sections per category (within requested 7‑10 range)
        const sectionsPerCategory = 8;
        for (let i = 0; i < sectionsPerCategory; i++) {
            const titleTemplate = promoTitles[i % promoTitles.length];
            const title = titleTemplate.replace('{name}', humanName);

            const itemCount = 6;
            const items = [];
            for (let j = 0; j < itemCount; j++) {
                const badge = badges[(i + j) % badges.length];
                const basePrice = 399 + (i * 50 + j * 75);

                items.push({
                    id: `${slug}-sec${i + 1}-item${j + 1}`,
                    name: `${humanName} Drop ${j + 1}`,
                    image: `https://picsum.photos/seed/feed-${slug}-${i + 1}-${j + 1}/600/800`,
                    price: basePrice,
                    slug: undefined,
                    brand_id: undefined,
                    logo: undefined,
                    badge,
                    subtitle: 'Flash deals · Limited time only',
                    link: `/shop?category=${encodeURIComponent(slug)}`
                });
            }

            await CategoryFeedSection.create({
                categorySlug: slug.toLowerCase(),
                type: 'carousel',
                title,
                image: `https://picsum.photos/seed/feed-hero-${slug}-${i + 1}/1600/600`,
                mobile_image: `https://picsum.photos/seed/feed-hero-${slug}-${i + 1}-mobile/800/600`,
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

// ----- Main seeding routine -----

async function seed() {
    try {
        console.log('🌱 Starting seeding...');

        // 1. Clear databases (dev‑only – this is destructive)
        await clearRelationalData();

        await mongoose.connect(process.env.MONGODB_URI);
        await clearMongoData();

        // 2. Admin user
        const admin = await createAdminUser();
        console.log(`✅ Admin user created: ${admin.email}`);

        // 3. Category tree with subcategories & sub‑subcategories
        const { categorySlugIdMap, leafCategorySlugs } = await seedCategories();

        // 4. Products (assigned to leaf categories: men/women/kids under fashion, etc.) for filter testing
        const slugToProductLabel = buildSlugToProductLabelMap();
        await seedProducts(categorySlugIdMap, leafCategorySlugs, slugToProductLabel);

        // 5. Category‑specific feed sections (7‑10 style carousels per category)
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

