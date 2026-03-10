const { z } = require('zod');

// Email format
const emailSchema = z.string().email('Invalid email format').toLowerCase().trim();

// Strong password: min 8 chars, at least one letter and one number
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one number');

const signupSchema = z.object({
    name: z.string().min(1, 'Name is required').max(120).trim(),
    email: emailSchema,
    password: passwordSchema,
});

const verifyOtpSchema = z.object({
    email: emailSchema,
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

const resendOtpSchema = z.object({
    email: emailSchema,
});

const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

function validateSignup(req, res, next) {
    try {
        req.body = signupSchema.parse(req.body);
        next();
    } catch (e) {
        if (e instanceof z.ZodError) {
            const msg = e.errors.map((err) => err.message).join('; ');
            return res.status(400).json({ success: false, message: msg, errors: e.errors });
        }
        next(e);
    }
}

function validateVerifyOtp(req, res, next) {
    try {
        req.body = verifyOtpSchema.parse(req.body);
        next();
    } catch (e) {
        if (e instanceof z.ZodError) {
            const msg = e.errors.map((err) => err.message).join('; ');
            return res.status(400).json({ success: false, message: msg, errors: e.errors });
        }
        next(e);
    }
}

function validateResendOtp(req, res, next) {
    try {
        req.body = resendOtpSchema.parse(req.body);
        next();
    } catch (e) {
        if (e instanceof z.ZodError) {
            const msg = e.errors.map((err) => err.message).join('; ');
            return res.status(400).json({ success: false, message: msg, errors: e.errors });
        }
        next(e);
    }
}

function validateLogin(req, res, next) {
    try {
        req.body = loginSchema.parse(req.body);
        next();
    } catch (e) {
        if (e instanceof z.ZodError) {
            const msg = e.errors.map((err) => err.message).join('; ');
            return res.status(400).json({ success: false, message: msg, errors: e.errors });
        }
        next(e);
    }
}

module.exports = {
    validateSignup,
    validateVerifyOtp,
    validateResendOtp,
    validateLogin,
    emailSchema,
    passwordSchema,
};
