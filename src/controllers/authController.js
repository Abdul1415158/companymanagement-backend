const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const { generateToken, validatePassword } = require('../utils/auth');
const inMemoryDB = require('../inMemoryDB');

const isMongoReady = () => mongoose.connection.readyState === 1;

const sanitizeUser = (user) => ({
    id: user._id ? user._id.toString() : (user.id || ''),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    phone: user.phone,
    profilePicture: user.profilePicture,
    status: user.status,
    isOnline: user.isOnline || false,
    lastLogin: user.lastLogin || null,
    lastActive: user.lastActive || null,
});

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = null;
    let isMongoDBUser = false;

    // Try MongoDB first if connected
    if (isMongoReady()) {
        try {
            user = await User.findOne({ email: normalizedEmail });
            if (user) isMongoDBUser = true;
        } catch (err) {
            console.error('MongoDB findOne error during login:', err.message);
        }
    }

    // Fallback to in-memory if not found in MongoDB
    if (!user) {
        user = inMemoryDB.users.find(u => u.email === normalizedEmail);
    }

    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Special handling for in-memory admin user
    let isValid = false;
    if (user._id === '1' && user.email === 'admin@company.com' && password === 'admin123') {
        isValid = true;
    } else {
        try {
            isValid = await bcrypt.compare(password, user.password);
        } catch (bcryptErr) {
            console.error('bcrypt error:', bcryptErr.message);
            isValid = false;
        }
    }

    if (!isValid) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.status === 'TERMINATED' || user.status === 'INACTIVE') {
        return res.status(403).json({ message: 'Your account has been deactivated or offboarded. Please contact company administration.' });
    }

    const now = new Date();
    user.isOnline = true;
    user.lastLogin = now;
    user.lastActive = now;

    if (isMongoDBUser) {
        try {
            await User.findByIdAndUpdate(user._id, {
                isOnline: true,
                lastLogin: now,
                lastActive: now,
            });
        } catch (updateErr) {
            console.error('Failed to update online status in Mongo:', updateErr.message);
        }
    }

    const token = generateToken(user);
    return res.json({
        token,
        user: sanitizeUser(user),
    });
};

const register = async (req, res) => {
    const { name, email, password, department, phone } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    // Enforce strong password requirements
    const pwValidation = validatePassword(password);
    if (!pwValidation.isValid) {
        return res.status(400).json({ message: pwValidation.message });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let existing = null;

    if (isMongoReady()) {
        try {
            existing = await User.findOne({ email: normalizedEmail });
        } catch (err) {
            console.error('MongoDB findOne error during register:', err.message);
            existing = inMemoryDB.users.find(u => u.email === normalizedEmail);
        }
    } else {
        existing = inMemoryDB.users.find(u => u.email === normalizedEmail);
    }

    if (existing) {
        return res.status(409).json({ message: 'A user with this email already exists. Please log in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Security Requirement: Public registration is strictly CANDIDATE role only. Any role sent from client is ignored.
    const userRole = 'CANDIDATE';
    const now = new Date();

    const userData = {
        name,
        email: normalizedEmail,
        password: passwordHash,
        role: userRole,
        department: department || 'Recruitment',
        phone: phone || '',
        profilePicture: '',
        status: 'ACTIVE',
        isOnline: true,
        lastLogin: now,
        lastActive: now,
    };

    let createdUser = null;

    if (isMongoReady()) {
        try {
            const user = await User.create(userData);
            createdUser = user;

            // Link any pre-existing candidate applicant records for this email
            await Candidate.updateMany(
                { email: normalizedEmail },
                { userId: user._id, portalAccess: 'ACTIVE', invitationToken: null, invitationExpiresAt: null }
            );

            const token = generateToken(user);
            return res.status(201).json({
                token,
                user: sanitizeUser(user),
            });
        } catch (err) {
            console.error('MongoDB User.create error:', err.message);
        }
    }

    // Fallback to in-memory storage only if MongoDB is unavailable
    const inMemoryUser = {
        _id: new mongoose.Types.ObjectId().toString(),
        id: new mongoose.Types.ObjectId().toString(),
        ...userData,
        createdAt: now,
    };
    inMemoryDB.users.push(inMemoryUser);

    // Update in-memory candidates
    inMemoryDB.candidates.forEach(c => {
        if (c.email && c.email.toLowerCase() === normalizedEmail) {
            c.userId = inMemoryUser.id;
            c.portalAccess = 'ACTIVE';
            c.invitationToken = null;
            c.invitationExpiresAt = null;
        }
    });

    const token = generateToken(inMemoryUser);
    return res.status(201).json({
        token,
        user: sanitizeUser(inMemoryUser),
    });
};

// Accept Portal Invitation & Set Password (Flow B)
const acceptInvitation = async (req, res) => {
    const { token, email, password } = req.body;

    if (!token || !email || !password) {
        return res.status(400).json({ message: 'Invitation token, email, and password are required.' });
    }

    const pwValidation = validatePassword(password);
    if (!pwValidation.isValid) {
        return res.status(400).json({ message: pwValidation.message });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let candidate = null;

    if (isMongoReady()) {
        try {
            candidate = await Candidate.findOne({
                email: normalizedEmail,
                invitationToken: token,
                invitationExpiresAt: { $gt: new Date() }
            });
        } catch (err) {
            console.error('Mongo acceptInvitation lookup error:', err.message);
        }
    }

    if (!candidate) {
        candidate = inMemoryDB.candidates.find(c =>
            c.email && c.email.toLowerCase() === normalizedEmail &&
            c.invitationToken === token &&
            (!c.invitationExpiresAt || new Date(c.invitationExpiresAt) > new Date())
        );
    }

    if (!candidate) {
        return res.status(400).json({ message: 'Invalid or expired invitation link. Please request a new invitation from HR.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    // Check if a User record exists or create new
    let user = null;
    if (isMongoReady()) {
        try {
            user = await User.findOne({ email: normalizedEmail });
            if (user) {
                user.password = passwordHash;
                user.status = 'ACTIVE';
                user.isOnline = true;
                user.lastLogin = now;
                await user.save();
            } else {
                user = await User.create({
                    name: candidate.fullName,
                    email: normalizedEmail,
                    password: passwordHash,
                    role: 'CANDIDATE',
                    department: 'Recruitment',
                    phone: candidate.phone || '',
                    profilePicture: '',
                    status: 'ACTIVE',
                    isOnline: true,
                    lastLogin: now,
                    lastActive: now,
                });
            }

            // Update candidate status
            await Candidate.updateMany(
                { email: normalizedEmail },
                { userId: user._id, portalAccess: 'ACTIVE', invitationToken: null, invitationExpiresAt: null }
            );

            const jwtToken = generateToken(user);
            return res.json({
                message: 'Portal account activated successfully! Welcome to your candidate dashboard.',
                token: jwtToken,
                user: sanitizeUser(user),
            });
        } catch (err) {
            console.error('Mongo acceptInvitation creation error:', err.message);
        }
    }

    // In-memory fallback
    user = inMemoryDB.users.find(u => u.email === normalizedEmail);
    if (user) {
        user.password = passwordHash;
        user.status = 'ACTIVE';
        user.isOnline = true;
        user.lastLogin = now;
    } else {
        user = {
            _id: new mongoose.Types.ObjectId().toString(),
            id: new mongoose.Types.ObjectId().toString(),
            name: candidate.fullName,
            email: normalizedEmail,
            password: passwordHash,
            role: 'CANDIDATE',
            department: 'Recruitment',
            phone: candidate.phone || '',
            profilePicture: '',
            status: 'ACTIVE',
            isOnline: true,
            lastLogin: now,
            lastActive: now,
            createdAt: now,
        };
        inMemoryDB.users.push(user);
    }

    candidate.userId = user.id || user._id;
    candidate.portalAccess = 'ACTIVE';
    candidate.invitationToken = null;
    candidate.invitationExpiresAt = null;

    const jwtToken = generateToken(user);
    return res.json({
        message: 'Portal account activated successfully! Welcome to your candidate dashboard.',
        token: jwtToken,
        user: sanitizeUser(user),
    });
};

// Verify invitation token before displaying set password form
const verifyInvitation = async (req, res) => {
    const { token, email } = req.query;

    if (!token || !email) {
        return res.status(400).json({ valid: false, message: 'Token and email parameters are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let candidate = null;

    if (isMongoReady()) {
        try {
            candidate = await Candidate.findOne({
                email: normalizedEmail,
                invitationToken: token,
                invitationExpiresAt: { $gt: new Date() }
            }).lean();
        } catch (err) {
            console.error('Mongo verifyInvitation error:', err.message);
        }
    }

    if (!candidate) {
        candidate = inMemoryDB.candidates.find(c =>
            c.email && c.email.toLowerCase() === normalizedEmail &&
            c.invitationToken === token &&
            (!c.invitationExpiresAt || new Date(c.invitationExpiresAt) > new Date())
        );
    }

    if (!candidate) {
        return res.status(400).json({ valid: false, message: 'This invitation link is invalid or has expired.' });
    }

    return res.json({
        valid: true,
        candidate: {
            fullName: candidate.fullName,
            email: candidate.email,
            positionApplied: candidate.positionApplied || candidate.roleApplied || 'General',
        }
    });
};

const logout = async (req, res) => {
    const userId = req.user?.id;
    const now = new Date();

    if (userId) {
        if (isMongoReady() && mongoose.Types.ObjectId.isValid(userId)) {
            try {
                await User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastActive: now,
                });
            } catch (err) {
                console.error('MongoDB logout update error:', err.message);
            }
        }
        
        const user = inMemoryDB.users.find(u => (u._id || u.id) === userId);
        if (user) {
            user.isOnline = false;
            user.lastActive = now;
        }
    }

    return res.json({ message: 'Logged out successfully.' });
};

module.exports = {
    login,
    register,
    acceptInvitation,
    verifyInvitation,
    logout
};
