process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:1/unset';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.HOTEL_TIMEZONE = 'Asia/Kolkata';
process.env.AUTO_CONFIRM_BOOKINGS = 'false';
