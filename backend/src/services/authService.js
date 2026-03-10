const jwt = require('jsonwebtoken');

const accessSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
const accessExpiry = process.env.JWT_SECRET ? '15m' : (process.env.JWT_ACCESS_EXPIRATION || '60m');

const generateAccessToken = (userId) => {
    return jwt.sign({ id: userId }, accessSecret, {
        expiresIn: accessExpiry
    });
};

const generateRefreshToken = (userId) => {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || accessSecret;
    return jwt.sign({ id: userId }, secret, {
        expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d'
    });
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, accessSecret);
};

const verifyRefreshToken = (token) => {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || accessSecret;
    return jwt.verify(token, secret);
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};
