const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const User = require('./src/models/User');

(async () => {
    try {
        console.log('Connecting to Mongo...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected!');
        const users = await User.find({}).lean();
        console.log('USERS:', users.map(u => ({ id: u._id, email: u.email, role: u.role, name: u.name })));
        await mongoose.disconnect();
        console.log('Disconnected!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();
