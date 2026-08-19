const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./initDb');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const managementRoutes = require('./routes/managementRoutes');

dotenv.config();

const app = express();

// CORS — allow local dev and Vercel production frontend
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // allow any vercel.app subdomain
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);
        return callback(new Error('CORS: Origin not allowed - ' + origin));
    },
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check / root route
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: '✅ Management System API is running',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            management: '/api',
        },
    });
});

app.use('/api/auth', authRoutes);
app.use('/api', managementRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: err.message || 'Something went wrong' });
});

// DB init (runs once on cold start — works for Vercel serverless too)
let dbInitialized = false;
const ensureDB = async () => {
    if (dbInitialized) return;
    dbInitialized = true;
    try {
        await connectDB();
        await initializeDatabase();
    } catch (err) {
        console.warn('⚠️  MongoDB not available. Running in-memory mode.');
        console.warn('Error:', err.message);
    }
};

// For local development — start HTTP server
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5001;
    const HOST = process.env.HOST || '127.0.0.1';

    ensureDB().then(() => {
        const server = app.listen(PORT, HOST, () => {
            console.log(`✅ Backend running on http://${HOST}:${PORT}`);
            console.log(`📝 Admin: ${process.env.ADMIN_EMAIL || 'admin@company.com'}`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use.`);
                process.exit(1);
            }
            console.error('❌ Server failed to start:', err.message);
            process.exit(1);
        });
    });
} else {
    // Vercel serverless — init DB on first request
    ensureDB();
}

module.exports = app;

