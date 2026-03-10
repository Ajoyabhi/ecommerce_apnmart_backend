const { prisma } = require('../../config/database');
const { z } = require('zod');

const categorySchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    parentId: z.string().uuid().optional().nullable(),
    sortOrder: z.number().int().optional().default(0),
    isActive: z.boolean().optional().default(true)
});

exports.getCategories = async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany({
            where: { parentId: null },
            include: {
                children: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        children: {
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });

        res.status(200).json({ success: true, count: categories.length, data: categories });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/v1/categories/menu
 * Returns hierarchical category tree for navbar mega menu.
 * Shape: [{ id, name, slug, sortOrder, imageUrl?, subcategories: [{ id, name, slug, sortOrder, sub_subcategories: [{ id, name, slug }] }] }]
 * Only roots (parentId: null) are returned; children are included and mapped to subcategories / sub_subcategories.
 */
function toMenuShape(cat) {
    const node = {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder ?? 0,
        imageUrl: cat.imageUrl ?? null
    };
    if (cat.children && cat.children.length > 0) {
        node.subcategories = cat.children
            .filter((c) => c.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((child) => {
                const sub = {
                    id: child.id,
                    name: child.name,
                    slug: child.slug,
                    sortOrder: child.sortOrder ?? 0
                };
                if (child.children && child.children.length > 0) {
                    sub.sub_subcategories = child.children
                        .filter((c) => c.isActive !== false)
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((cc) => ({
                            id: cc.id,
                            name: cc.name,
                            slug: cc.slug
                        }));
                } else {
                    sub.sub_subcategories = [];
                }
                return sub;
            });
    } else {
        node.subcategories = [];
    }
    return node;
}

exports.getCategoriesMenu = async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany({
            where: { parentId: null, isActive: true },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        children: {
                            where: { isActive: true },
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            },
            orderBy: { sortOrder: 'asc' }
        });

        const menu = categories.map(toMenuShape);

        res.set('Cache-Control', 'public, max-age=300'); // 5 min cache
        res.status(200).json({ success: true, data: menu });
    } catch (error) {
        next(error);
    }
};

exports.createCategory = async (req, res, next) => {
    try {
        const validatedData = categorySchema.parse(req.body);

        const category = await prisma.category.create({
            data: validatedData
        });

        res.status(201).json({ success: true, data: category });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        next(error);
    }
};

exports.updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const validatedData = categorySchema.partial().parse(req.body);

        const category = await prisma.category.update({
            where: { id },
            data: validatedData
        });

        res.status(200).json({ success: true, data: category });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, errors: error.errors });
        }
        next(error);
    }
};

exports.deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if category has products
        const productCount = await prisma.product.count({
            where: { categoryId: id }
        });

        if (productCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with associated products'
            });
        }

        await prisma.category.delete({ where: { id } });

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};
