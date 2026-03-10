const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');
const { generateAccessToken, generateRefreshToken } = require('../../services/authService');
const { sendOtpEmail } = require('../../services/brevo.service');
const {
    generateOtp,
    hashOtp,
    verifyOtp,
    getOtpExpiry,
    isOtpBlocked,
    canResendOtp,
    MAX_OTP_ATTEMPTS,
    RESEND_WINDOW_MS,
} = require('../../services/otp.service');
const logger = require('../../utils/logger');

// ----- Helpers -----

function toUserDto(user) {
    const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    return {
        id: user.id,
        email: user.email,
        name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        provider: user.provider,
    };
}

function issueTokens(res, user) {
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    return res.status(200).json({
        success: true,
        data: {
            user: toUserDto(user),
            accessToken,
            refreshToken,
        },
    });
}

// ----- Signup (OTP flow) -----

exports.signup = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'User with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const otp = generateOtp();
        const otpHash = hashOtp(otp);
        const otpExpiry = getOtpExpiry();

        const parts = (name || '').trim().split(/\s+/);
        const firstName = parts[0] || name || 'User';
        const lastName = parts.slice(1).join(' ') || '';

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name: name.trim(),
                firstName,
                lastName,
                provider: 'local',
                isEmailVerified: false,
                emailOtpHash: otpHash,
                otpExpiry,
                otpAttempts: 0,
                otpResendCount: 0,
                otpResendWindowStart: new Date(),
            },
        });

        await sendOtpEmail({ to: email, otp });
        logger.info(`OTP sent to ${email} for signup`);

        return res.status(200).json({
            success: true,
            message: 'OTP sent to email',
            data: { email },
        });
    } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        if (status !== undefined) {
            logger.warn(`Brevo email failed (${status}): ${data?.message || err.message}`);
            if (status === 401) {
                return res.status(503).json({
                    success: false,
                    message: 'Email service is misconfigured. Please try again later or contact support.',
                });
            }
            return res.status(503).json({
                success: false,
                message: data?.message || 'Could not send verification email. Please try again later.',
            });
        }
        next(err);
    }
};

// ----- Verify OTP -----

exports.verifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified. You can log in.' });
        }

        if (!user.emailOtpHash || !user.otpExpiry) {
            return res.status(400).json({ success: false, message: 'No pending verification. Request a new OTP.' });
        }

        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        if (isOtpBlocked(user.otpAttempts, user.updatedAt)) {
            return res.status(429).json({
                success: false,
                message: `Too many failed attempts. Try again after 15 minutes.`,
            });
        }

        if (!verifyOtp(otp, user.emailOtpHash)) {
            await prisma.user.update({
                where: { id: user.id },
                data: { otpAttempts: user.otpAttempts + 1 },
            });
            const remaining = MAX_OTP_ATTEMPTS - (user.otpAttempts + 1);
            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Verification temporarily blocked for 15 minutes.'}`,
            });
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                emailOtpHash: null,
                otpExpiry: null,
                otpAttempts: 0,
            },
        });

        return issueTokens(res, updated);
    } catch (err) {
        next(err);
    }
};

// ----- Resend OTP -----

exports.resendOtp = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified. You can log in.' });
        }

        const now = new Date();
        const windowStart = user.otpResendWindowStart ? new Date(user.otpResendWindowStart) : null;
        const isNewWindow = !windowStart || (now - windowStart >= RESEND_WINDOW_MS);
        const resendCount = isNewWindow ? 0 : user.otpResendCount;

        if (!canResendOtp(resendCount, windowStart)) {
            return res.status(429).json({
                success: false,
                message: 'Maximum resends per hour reached. Please try again later.',
            });
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp);
        const otpExpiry = getOtpExpiry();

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailOtpHash: otpHash,
                otpExpiry,
                otpAttempts: 0,
                otpResendCount: isNewWindow ? 1 : user.otpResendCount + 1,
                otpResendWindowStart: isNewWindow ? now : windowStart,
            },
        });

        await sendOtpEmail({ to: email, otp });
        logger.info(`OTP resent to ${email}`);

        return res.status(200).json({
            success: true,
            message: 'New OTP sent',
            data: { email },
        });
    } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        if (status !== undefined) {
            logger.warn(`Brevo resend failed (${status}): ${data?.message || err.message}`);
            if (status === 401) {
                return res.status(503).json({
                    success: false,
                    message: 'Email service is misconfigured. Please try again later or contact support.',
                });
            }
            return res.status(503).json({
                success: false,
                message: data?.message || 'Could not send verification email. Please try again later.',
            });
        }
        next(err);
    }
};

// ----- Login -----

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.provider === 'google') {
            return res.status(400).json({
                success: false,
                message: 'This account uses Google sign-in. Please use the Google button to log in.',
            });
        }

        if (!user.passwordHash) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Admin users can sign in without email verification; customers must verify first
        if (!user.isEmailVerified && user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Email not verified. Please verify your email with the OTP sent to you.',
            });
        }

        return issueTokens(res, user);
    } catch (err) {
        next(err);
    }
};

// ----- Google OAuth: callback issues JWT -----

exports.googleCallback = async (req, res, next) => {
    try {
        const user = req.user; // set by passport
        if (!user) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_failed`);
        }
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
        res.redirect(`${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
    } catch (err) {
        next(err);
    }
};

// ----- Legacy register: redirect to OTP flow (optional, or keep for backward compat) -----

exports.register = async (req, res, next) => {
    return res.status(400).json({
        success: false,
        message: 'Use POST /auth/signup to register. After signup, verify your email with the OTP sent to you.',
    });
};
