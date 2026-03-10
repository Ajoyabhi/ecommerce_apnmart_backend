const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
];

function validateFileType(file) {
    if (!allowedMimeTypes.includes(file.mimetype)) {
        const error = new Error('Invalid file type. Only images and videos allowed.');
        error.status = 400;
        throw error;
    }
}

module.exports = { validateFileType, allowedMimeTypes };

