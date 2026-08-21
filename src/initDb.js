const bcrypt = require('bcryptjs');
const User = require('./models/User');
const SystemSetting = require('./models/SystemSetting');

const initializeDatabase = async () => {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD || 'Bakr1234@!';
        const adminEmail    = (process.env.ADMIN_EMAIL || 'admin@company.com').toLowerCase().trim();
        const adminName     = process.env.ADMIN_NAME     || 'Super Admin';

        const adminExists = await User.findOne({ role: 'SUPER_ADMIN' });

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
            console.log(`✅ Super Admin created in MongoDB: ${adminEmail}`);
        } else {
            // Already exists — sync email, name, and password from environment variables
            const passwordHash = await bcrypt.hash(adminPassword, 10);
            adminExists.email = adminEmail;
            adminExists.name = adminName;
            adminExists.password = passwordHash;
            adminExists.status = 'ACTIVE';
            await adminExists.save();
            console.log(`🔄 Super Admin credentials synced with MongoDB: ${adminEmail}`);
        }

        await SystemSetting.findOneAndUpdate(
            { key: 'company_name' },
            { key: 'company_name', value: 'Management System' },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('Database initialization error:', err.message);
    }

    return true;
};

module.exports = { initializeDatabase };
