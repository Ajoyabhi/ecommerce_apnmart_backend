const express = require('express');
const passport = require('../../config/passport');
const authController = require('./auth.controller');
const {
    signupLimiter,
    verifyOtpLimiter,
    resendOtpLimiter,
    loginLimiter,
} = require('../../middleware/rateLimitAuth');
const {
    validateSignup,
    validateVerifyOtp,
    validateResendOtp,
    validateLogin,
} = require('../../middleware/authValidation');

const router = express.Router();

// ----- OTP-based signup & verify -----
router.post('/signup', signupLimiter, validateSignup, authController.signup);
router.post('/verify-otp', verifyOtpLimiter, validateVerifyOtp, authController.verifyOtp);
router.post('/resend-otp', resendOtpLimiter, validateResendOtp, authController.resendOtp);

// ----- Login -----
router.post('/login', loginLimiter, validateLogin, authController.login);

// ----- Google OAuth -----
router.get(
    '/google',
    (req, res, next) => {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.status(503).json({ success: false, message: 'Google sign-in is not configured' });
        }
        next();
    },
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
    '/google/callback',
    (req, res, next) => {
        passport.authenticate('google', { session: false }, (err, user, info) => {
            if (err) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_failed`);
            }
            if (!user) {
                const message = (info && info.message) ? encodeURIComponent(info.message) : 'google_failed';
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${message}`);
            }
            req.user = user;
            next();
        })(req, res, next);
    },
    authController.googleCallback
);

// ----- Legacy: register (redirect to OTP flow) -----
router.post('/register', authController.register);

module.exports = router;
