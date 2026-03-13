const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { validateFileType } = require('../middleware/fileValidation');
const { compressImage } = require('../services/mediaProcessor');
const { uploadFile, requireB2Config } = require('../services/b2Service');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
// Default to local uploads unless explicitly set to "b2"
const UPLOAD_METHOD = (process.env.UPLOAD_METHOD || 'local').toLowerCase();
const LOCAL_UPLOAD_PATH = process.env.LOCAL_UPLOAD_PATH || './uploads';

// Use in-memory storage so we can compress / send buffers directly to B2 or write locally
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max per file
});

// All upload routes require authenticated admin
router.use(protect, authorize('ADMIN'));

async function uploadToLocal(fileBuffer, relativePath) {
    const dir = path.join(LOCAL_UPLOAD_PATH, path.dirname(relativePath));
    await fs.mkdir(dir, { recursive: true });
    const fullPath = path.join(LOCAL_UPLOAD_PATH, relativePath);
    await fs.writeFile(fullPath, fileBuffer);
}

router.post('/upload-media', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files provided'
            });
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            validateFileType(file);

            let fileBuffer = file.buffer;
            let mimeType = file.mimetype;
            let extension = (mimeType.split('/')[1] || 'bin').replace(/\+.*$/, '');

            // Compress only images; videos are stored as-is
            if (mimeType.startsWith('image/')) {
                fileBuffer = await compressImage(file.buffer);
                mimeType = 'image/webp';
                extension = 'webp';
            }

            const uniqueName = `products/${uuidv4()}.${extension}`;

            if (UPLOAD_METHOD === 'local') {
                await uploadToLocal(fileBuffer, uniqueName);
            } else {
                try {
                    requireB2Config();
                    await uploadFile(fileBuffer, uniqueName, mimeType);
                } catch (b2Error) {
                    const msg = (b2Error && b2Error.message) || '';
                    if (/invalid accountId or applicationKeyId/i.test(msg)) {
                        return res.status(400).json({
                            success: false,
                            message: 'Backblaze B2 credentials are invalid. In .env set B2_KEY_ID to the Application Key ID and B2_APPLICATION_KEY to the secret from B2 Console → App Keys. Or set UPLOAD_METHOD=local to save files to disk.'
                        });
                    }
                    throw b2Error;
                }
            }

            uploadedFiles.push({ path: uniqueName });
        }

        res.status(200).json({
            success: true,
            files: uploadedFiles
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Upload error', error);
        res.status(error.status || 400).json({
            success: false,
            message: error.message || 'Upload failed'
        });
    }
});

module.exports = router;

