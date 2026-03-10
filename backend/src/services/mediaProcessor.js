const sharp = require('sharp');

async function compressImage(buffer) {
    return sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
}

/**
 * Generate augmented variants of an image for product gallery (same image, different dimensions/transforms).
 * Returns array of { buffer, suffix } where suffix is used in filename (e.g. '', '-flip', '-portrait').
 * We use 3 variants only: primary, flip, and portrait. A 4th "zoom" center crop was dropped as it often looked odd.
 */
async function generateAugmentedVariants(sourceBuffer) {
    const metadata = await sharp(sourceBuffer).metadata();
    const w = metadata.width || 800;
    const h = metadata.height || 1000;
    const variants = [];

    const primary = await sharp(sourceBuffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    variants.push({ buffer: primary, suffix: '' });

    const flip = await sharp(sourceBuffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .flop()
        .webp({ quality: 80 })
        .toBuffer();
    variants.push({ buffer: flip, suffix: '-flip' });

    const pSide = Math.min(w, h);
    const pW = Math.min(w, Math.floor((pSide * 4) / 5));
    const pH = Math.min(h, Math.floor((pSide * 5) / 4));
    const pl = Math.max(0, Math.floor((w - pW) / 2));
    const pt = Math.max(0, Math.floor((h - pH) / 2));
    const portrait = await sharp(sourceBuffer)
        .extract({ left: pl, top: pt, width: Math.min(pW, w - pl), height: Math.min(pH, h - pt) })
        .resize(800, 1000, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
    variants.push({ buffer: portrait, suffix: '-portrait' });

    return variants;
}

module.exports = { compressImage, generateAugmentedVariants };
