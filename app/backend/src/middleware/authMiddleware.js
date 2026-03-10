const { verifyAccessToken } = require('../services/authService');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

exports.protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
        }

        try {
            // Verify token
            const decoded = verifyAccessToken(token);

            // Check if user still exists
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, email: true, role: true, isActive: true }
            });

            if (!user || !user.isActive) {
                return res.status(401).json({ success: false, message: 'User no longer exists or is inactive' });
            }

            // Add user to request object
            req.user = user;
            next();
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Auth token is invalid or expired' });
        }
    } catch (error) {
        next(error);
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};
