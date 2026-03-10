const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const logger = require('../utils/logger');

// PostgreSQL / Prisma
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// MongoDB Connection
const connectMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Successfully connected to MongoDB');
    } catch (error) {
        logger.error('Error connecting to MongoDB:', error.message);
        process.exit(1);
    }
};

// Redis Client
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));

const connectRedis = async () => {
    try {
        await redisClient.connect();
        logger.info('Successfully connected to Redis');
    } catch (error) {
        logger.error('Error connecting to Redis:', error.message);
    }
};

module.exports = {
    prisma,
    connectMongoDB,
    redisClient,
    connectRedis
};
