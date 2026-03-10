const crypto = require('crypto');

const OTP_EXPIRY_MINUTES = 10;
const OTP_DIGITS = 6;
const MAX_OTP_ATTEMPTS = 5;
const OTP_BLOCK_MINUTES = 15;
const MAX_RESEND_PER_HOUR = 3;
const RESEND_WINDOW_MS = 60 * 60 * 1000;

/**
 * Generate a 6-digit numeric OTP.
 */
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP with SHA-256 before storing (never store plain OTP).
 */
function hashOtp(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify plain OTP against stored hash.
 */
function verifyOtp(plainOtp, storedHash) {
    if (!storedHash || !plainOtp) return false;
    const hash = hashOtp(plainOtp);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * OTP expiry timestamp (now + 10 minutes).
 */
function getOtpExpiry() {
    const d = new Date();
    d.setMinutes(d.getMinutes() + OTP_EXPIRY_MINUTES);
    return d;
}

/**
 * Check if user is blocked due to too many failed attempts (15 min block).
 */
function isOtpBlocked(otpAttempts, updatedAt) {
    if (otpAttempts < MAX_OTP_ATTEMPTS) return false;
    if (!updatedAt) return true;
    const blockUntil = new Date(updatedAt);
    blockUntil.setMinutes(blockUntil.getMinutes() + OTP_BLOCK_MINUTES);
    return new Date() < blockUntil;
}

/**
 * Check if resend is allowed (max 3 per hour).
 */
function canResendOtp(otpResendCount, otpResendWindowStart) {
    if (!otpResendWindowStart) return true;
    const windowStart = new Date(otpResendWindowStart);
    const now = new Date();
    if (now - windowStart >= RESEND_WINDOW_MS) return true; // new window
    return otpResendCount < MAX_RESEND_PER_HOUR;
}

module.exports = {
    OTP_EXPIRY_MINUTES,
    MAX_OTP_ATTEMPTS,
    OTP_BLOCK_MINUTES,
    MAX_RESEND_PER_HOUR,
    RESEND_WINDOW_MS,
    generateOtp,
    hashOtp,
    verifyOtp,
    getOtpExpiry,
    isOtpBlocked,
    canResendOtp,
};
