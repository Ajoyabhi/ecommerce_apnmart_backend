const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const logger = require('./utils/logger');

const app = express();

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
app.use(cors(corsOptions)); // Enable CORS with allowed origins
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
const uploadMethod = (process.env.UPLOAD_METHOD || 'b2').toLowerCase();
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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin', uploadRoutes);

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
