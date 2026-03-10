require('dotenv').config();
const app = require('./app');
const { connectMongoDB, connectRedis, prisma } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Connect to Databases
        await connectMongoDB();
        await connectRedis();

        // Verify PostgreSQL connection via prisma
        logger.info('Connecting to PostgreSQL...');
        await prisma.$connect();
        logger.info('Successfully connected to PostgreSQL via Prisma');

        const server = app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        });
        server.on('error', (err) => {
            logger.error('Server listen error:', err.message);
            if (err.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use. Set PORT in .env or stop the process using it.`);
            }
            process.exit(1);
        });
    } catch (error) {
        logger.error('Failed to start server:', error.message || error);
        if (error.stack) logger.error(error.stack);
        if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${PORT} is already in use. Try another PORT in .env or stop the process using the port.`);
        }
        process.exit(1);
    }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    process.exit(1);
});

startServer();
