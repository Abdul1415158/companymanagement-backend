const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./initDb');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const managementRoutes = require('./routes/managementRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api', managementRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong' });
});

(async () => {
    try {
        await connectDB();
        await initializeDatabase();
    } catch (err) {
        console.warn('⚠️  MongoDB not available. Running in-memory mode.');
        console.warn('Error:', err.message);
    }

    const server = app.listen(PORT, HOST, () => {
        console.log(`✅ Backend running on http://${HOST}:${PORT}`);
        console.log(`📝 Login: admin@company.com / admin123`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use. Stop old process and retry.`);
            process.exit(1);
        }
        if (err.code === 'EPERM') {
            console.error(`❌ Permission denied binding ${HOST}:${PORT}. Try another port or run unsandboxed.`);
            process.exit(1);
        }
        console.error('❌ Server failed to start:', err.message);
        process.exit(1);
    });
})();

module.exports = app;
