const rateLimit = require('express-rate-limit');

/**
 * Rate limit for signup: prevent abuse (e.g. 5 per 15 min per IP).
 */
const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many signup attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limit for verify-otp: prevent brute force (e.g. 10 per 15 min per IP).
 */
const verifyOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many verification attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limit for resend-otp: align with "max 3 per hour" per user (this is per IP as extra layer).
 */
const resendOtpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many resend requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General auth rate limit for login (prevent brute force).
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    signupLimiter,
    verifyOtpLimiter,
    resendOtpLimiter,
    loginLimiter,
};
