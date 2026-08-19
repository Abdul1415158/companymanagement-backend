const bcrypt = require('bcryptjs');
const User = require('./models/User');
const SystemSetting = require('./models/SystemSetting');

const initializeDatabase = async () => {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@company.com';
        const adminName     = process.env.ADMIN_NAME     || 'Super Admin';

        const adminExists = await User.findOne({ role: 'SUPER_ADMIN' }).lean();

        if (!adminExists) {
            // First time — create the super admin account
            const passwordHash = await bcrypt.hash(adminPassword, 10);
            await User.create({
                name: adminName,
                email: adminEmail,
                password: passwordHash,
                role: 'SUPER_ADMIN',
                department: 'Administration',
                phone: '9999999999',
                status: 'ACTIVE',
            });
            console.log(`✅ Super Admin created: ${adminEmail}`);
        } else {
            // Already exists — sync email, name, and password from env vars
            // This ensures Vercel env variable changes take effect immediately
            const passwordHash = await bcrypt.hash(adminPassword, 10);
            await User.findOneAndUpdate(
                { role: 'SUPER_ADMIN' },
                {
                    email: adminEmail,
                    name: adminName,
                    password: passwordHash,
                    status: 'ACTIVE',
                },
                { new: true }
            );
            console.log(`🔄 Super Admin credentials synced from environment: ${adminEmail}`);
        }

        await SystemSetting.findOneAndUpdate(
            { key: 'company_name' },
            { key: 'company_name', value: 'Management System' },
            { upsert: true, new: true }
        );
    } catch (err) {
        // Silently fail - in-memory DB will handle it
        console.log('Database initialization skipped (using in-memory fallback):', err.message);
    }

    return true;
};

module.exports = { initializeDatabase };
