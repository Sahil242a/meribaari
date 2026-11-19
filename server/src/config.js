const env = process.env;

export const config = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 4000,
  mongoUrl: env.MONGO_URL || 'mongodb://127.0.0.1:27017/meribaari',
  jwtSecret: env.JWT_SECRET || 'dev-only-change-me',
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  publicUrl: env.PUBLIC_URL || 'http://localhost:5173',
  timezone: env.TZ_NAME || 'Asia/Kolkata',
  // notifications: "console" (dev), "twilio-sms", "twilio-whatsapp"
  notifyProvider: env.NOTIFY_PROVIDER || 'console',
  twilio: {
    sid: env.TWILIO_ACCOUNT_SID,
    token: env.TWILIO_AUTH_TOKEN,
    from: env.TWILIO_FROM,
  },
};

export const isProd = config.env === 'production';

if (isProd && config.jwtSecret === 'dev-only-change-me') {
  throw new Error('Set JWT_SECRET in production');
}
