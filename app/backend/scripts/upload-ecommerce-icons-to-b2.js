/* Upload all ecommerce icon PNGs to B2 under static/ecommerce-icons/.
 *
 * Usage (from app/backend):
 *   UPLOAD_METHOD=b2 node scripts/upload-ecommerce-icons-to-b2.js
 *
 * Expects B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME to be set in .env.
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');

const { uploadFile, getBaseMediaUrl, requireB2Config } = require('../src/services/b2Service');

async function main() {
    requireB2Config();

    const iconsDir = path.join(__dirname, '..', 'product_images', 'ecommerce-icons');
    console.log('🔍 Uploading ecommerce icons from:', iconsDir);

    let entries;
    try {
        entries = await fs.readdir(iconsDir, { withFileTypes: true });
    } catch (err) {
        console.error('❌ Failed to read ecommerce-icons directory:', err.message);
        process.exit(1);
    }

    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    if (!files.length) {
        console.log('ℹ️ No files found in ecommerce-icons directory. Nothing to upload.');
        return;
    }

    const uploaded = [];

    for (const fileName of files) {
        const fullPath = path.join(iconsDir, fileName);
        const relPath = `static/ecommerce-icons/${fileName}`;
        const mimeType = mime.lookup(fileName) || 'image/png';

        console.log(`⬆️  Uploading ${fileName} → ${relPath} (${mimeType}) ...`);
        let buffer;
        try {
            buffer = await fs.readFile(fullPath);
        } catch (err) {
            console.warn(`   ⚠️ Skipping ${fileName} (read error):`, err.message);
            continue;
        }

        try {
            await uploadFile(buffer, relPath, mimeType);
            uploaded.push(relPath);
        } catch (err) {
            console.warn(`   ⚠️ Failed to upload ${fileName}:`, err.message);
        }
    }

    if (!uploaded.length) {
        console.log('❌ No icons were successfully uploaded.');
        return;
    }

    let baseUrl;
    try {
        baseUrl = getBaseMediaUrl();
    } catch (err) {
        console.warn('⚠️ Could not resolve base media URL from B2:', err.message);
        baseUrl = null;
    }

    console.log('\n✅ Uploaded ecommerce icons:');
    for (const relPath of uploaded) {
        if (baseUrl) {
            console.log(` - ${baseUrl}/${relPath}`);
        } else {
            console.log(` - ${relPath}`);
        }
    }

    console.log('\nYou can serve these in the frontend via VITE_MEDIA_BASE_URL + "/static/ecommerce-icons/<icon-file>".');
}

main().catch((err) => {
    console.error('❌ Unexpected error while uploading ecommerce icons:', err);
    process.exit(1);
});

