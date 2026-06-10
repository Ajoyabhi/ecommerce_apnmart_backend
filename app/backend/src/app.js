const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const logger = require('./utils/logger');

const app = express();

// Trust Nginx reverse proxy — required for express-rate-limit and correct IP detection
app.set('trust proxy', 1);

// Serve ecommerce icon set as static assets so frontend can use them
app.use(
    '/static/ecommerce-icons',
    express.static(path.join(__dirname, '..', 'product_images', 'ecommerce-icons'))
);

// Serve brand logo assets (e.g. Apnamart logo) as static files
app.use(
    '/static/brand_logo',
    express.static(path.join(__dirname, '..', 'product_images', 'brand_logo'))
);

// CORS: allow frontend origin (required when frontend uses credentials: "include")
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

// Middlewares
// Security headers (allow images/static assets to be loaded from other origins like Vite dev server)
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
);

// Single CORS middleware — open policy for HDFC server-to-server callbacks, strict for everything else
const HDFC_CALLBACK_PATHS = [
    '/api/v1/payments/hdfc/return',    // card/netbanking return
    '/api/v1/payments/hdfc/pg-notify', // UPI accuzpay callback
    '/api/v1/payments/hdfc/webhook',   // generic webhook
];
app.use((req, res, next) => {
    if (HDFC_CALLBACK_PATHS.includes(req.path)) {
        return cors({ origin: true, credentials: false })(req, res, next);
    }
    return cors(corsOptions)(req, res, next);
});
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true }));

// Logging HTTP requests
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Passport (for Google OAuth)
const passport = require('./config/passport');
app.use(passport.initialize());

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Serve local uploads when UPLOAD_METHOD=local (so frontend can use VITE_MEDIA_BASE_URL=http://localhost:5001/uploads)
// Default to local uploads if not explicitly configured
const uploadMethod = (process.env.UPLOAD_METHOD || 'local').toLowerCase();
const localUploadPath = process.env.LOCAL_UPLOAD_PATH || './uploads';
if (uploadMethod === 'local') {
    app.use('/uploads', express.static(localUploadPath));
}

// API Routes
const authRoutes = require('./modules/auth/auth.routes');
const categoryRoutes = require('./modules/categories/category.routes');
const productRoutes = require('./modules/products/product.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const contentRoutes = require('./modules/content/content.routes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./modules/user/user.routes');
const pincodeRoutes = require('./routes/pincodeRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin', uploadRoutes);
app.use('/api/v1/pincode', pincodeRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

module.exports = app;
