const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('../config/database');

const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

if (googleClientID && googleClientSecret) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: googleClientID,
                clientSecret: googleClientSecret,
                callbackURL: `${process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`}/api/v1/auth/google/callback`,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    if (!email) return done(new Error('No email from Google'), null);

                    const name = profile.displayName || email.split('@')[0];
                    const parts = name.trim().split(/\s+/);
                    const firstName = parts[0] || 'User';
                    const lastName = parts.slice(1).join(' ') || '';
                    const providerId = profile.id;

                    let user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { providerId, provider: 'google' },
                                { email },
                            ],
                        },
                    });

                    if (user) {
                        if (user.provider !== 'google') {
                            return done(null, null, { message: 'Email already registered with password. Please log in with password.' });
                        }
                        if (!user.providerId) {
                            user = await prisma.user.update({
                                where: { id: user.id },
                                data: { providerId, provider: 'google', isEmailVerified: true },
                            });
                        }
                        return done(null, user);
                    }

                    user = await prisma.user.create({
                        data: {
                            email,
                            name,
                            firstName,
                            lastName,
                            provider: 'google',
                            providerId,
                            isEmailVerified: true,
                            passwordHash: null,
                        },
                    });

                    return done(null, user);
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, firstName: true, lastName: true, name: true, role: true, isActive: true, provider: true, isEmailVerified: true },
        });
        done(null, user || null);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
