const crypto = require('crypto');
const { prisma } = require('../config/database');
const { sendCodOtpEmail } = require('./brevo.service');
const logger = require('../utils/logger');
const OTP_EXPIRY_MS = 5 * 60 * 1000;       // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;      // 1 per 60 seconds
const MAX_VERIFY_ATTEMPTS = 3;

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

function verifyOtpHash(plainOtp, hash) {
    const a = Buffer.from(hashOtp(plainOtp), 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Create COD OTP for user, send email. Rate limited per user (1 per 60s).
 * @param {string} userId
 * @param {string|null} orderId - optional temp order reference
 * @returns {{ otpId: string, expiresAt: Date }}
 */
async function createAndSendCodOtp(userId, orderId = null) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
    });
    if (!user || !user.email) {
        const err = new Error('User not found or has no email');
        err.status = 404;
        throw err;
    }

    const now = new Date();
    const latest = await prisma.codOtp.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { resendAt: true },
    });
    if (latest?.resendAt && new Date(latest.resendAt) > now) {
        const err = new Error('Please wait 60 seconds before requesting a new OTP');
        err.status = 429;
        throw err;
    }

    const otp = generateOtp();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
    const resendAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);

    const record = await prisma.codOtp.create({
        data: {
            userId,
            orderId,
            otpHash: hashOtp(otp),
            expiresAt,
            resendAt,
            attempts: 0,
            isVerified: false,
        },
    });

    try {
        await sendCodOtpEmail({ to: user.email, otp });
        await prisma.emailLog.create({
            data: { emailType: 'cod_otp', recipient: user.email, status: 'sent' },
        });
    } catch (err) {
        await prisma.emailLog.create({
            data: { emailType: 'cod_otp', recipient: user.email, status: 'failed', error: err.message },
        });
        throw err;
    }
    logger.info(`COD OTP created for user ${userId}, expires ${expiresAt.toISOString()}`);

    return { otpId: record.id, expiresAt };
}

/**
 * Verify COD OTP. Increments attempts. Returns true if valid.
 * @param {string} userId
 * @param {string} otp - plain 6-digit OTP
 * @param {string} [otpId] - optional specific CodOtp id to verify (else latest unverified for user)
 */
async function verifyCodOtp(userId, otp, otpId = null) {
    const where = { userId, isVerified: false };
    if (otpId) where.id = otpId;

    const record = await prisma.codOtp.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
    });

    if (!record) {
        return { valid: false, error: 'Invalid or expired OTP' };
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        return { valid: false, error: 'Maximum OTP attempts exceeded. Please request a new OTP.' };
    }

    if (new Date() > record.expiresAt) {
        return { valid: false, error: 'OTP has expired. Please request a new OTP.' };
    }

    // Increment attempts before checking (so we count this attempt)
    await prisma.codOtp.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
    });

    if (!verifyOtpHash(otp, record.otpHash)) {
        return { valid: false, error: 'Invalid OTP' };
    }

    await prisma.codOtp.update({
        where: { id: record.id },
        data: { isVerified: true },
    });

    return { valid: true, codOtpId: record.id };
}

module.exports = {
    createAndSendCodOtp,
    verifyCodOtp,
    OTP_EXPIRY_MS,
    RESEND_COOLDOWN_MS,
    MAX_VERIFY_ATTEMPTS,
};
