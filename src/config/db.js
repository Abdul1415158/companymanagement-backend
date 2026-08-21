const mongoose = require('mongoose');

let connectionPromise = null;

/**
 * Robust MongoDB Connection Manager
 * Automatically handles reconnections, serverless pooling, and connection state checks.
 */
const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error('MONGO_URI is not defined in environment variables');
    }

    // 1. If already connected, return existing connection immediately
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // 2. If already in the process of connecting, await the pending promise
    if (mongoose.connection.readyState === 2 && connectionPromise) {
        return connectionPromise;
    }

    // 3. If disconnected (0) or disconnecting (3), initiate a fresh connection
    connectionPromise = (async () => {
        try {
            const conn = await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 10000,
                maxPoolSize: 10,
                minPoolSize: 1,
                heartbeatFrequencyMS: 10000,
                autoIndex: true,
                family: 4,
            });

            console.log('✅ MongoDB connected successfully to host:', mongoose.connection.host);
            return conn.connection;
        } catch (error) {
            connectionPromise = null;
            console.error('❌ MongoDB connection error:', error.message);
            throw error;
        }
    })();

    return connectionPromise;
};

// Set up connection event listeners
mongoose.connection.on('connected', () => {
    console.log('📡 Mongoose: connection active');
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ Mongoose: disconnected from database. Auto-reconnection active for incoming requests.');
    connectionPromise = null;
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose: connection error:', err.message);
    connectionPromise = null;
});

const isDbConnected = () => mongoose.connection.readyState === 1;

module.exports = {
    connectDB,
    isDbConnected,
};
