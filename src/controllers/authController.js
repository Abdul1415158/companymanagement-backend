const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const { generateToken, validatePassword } = require('../utils/auth');

const sanitizeUser = (user) => ({
    id: user._id ? user._id.toString() : (user.id || ''),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    phone: user.phone || '',
    profilePicture: user.profilePicture || '',
    status: user.status,
    isOnline: user.isOnline || false,
    lastLogin: user.lastLogin || null,
    lastActive: user.lastActive || null,
});

const isMongoReady = () => mongoose.connection.readyState === 1;

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        if (!isMongoReady()) {
            return res.status(503).json({
                message: 'Database connection is currently unavailable. Please check your network/database connection and retry.'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        if (user.status === 'TERMINATED' || user.status === 'INACTIVE') {
            return res.status(403).json({
                message: 'Your account has been deactivated or offboarded. Please contact company administration.'
            });
        }

        const now = new Date();
        user.isOnline = true;
        user.lastLogin = now;
        user.lastActive = now;
        await user.save();

        const token = generateToken(user);
        return res.json({
            token,
            user: sanitizeUser(user),
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Login service encountered an error. Please try again.' });
    }
};

const register = async (req, res) => {
    try {
        const { name, email, password, department, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required.' });
        }

        // Enforce strong password requirements
        const pwValidation = validatePassword(password);
        if (!pwValidation.isValid) {
            return res.status(400).json({ message: pwValidation.message });
        }

        if (!isMongoReady()) {
            return res.status(503).json({
                message: 'Database connection is currently unavailable. Please check your network/database connection.'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: normalizedEmail });

        if (existing) {
            return res.status(409).json({ message: 'A user with this email already exists. Please log in.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        // Security Requirement: Public registration is strictly CANDIDATE role only.
        const userRole = 'CANDIDATE';
        const now = new Date();

        const user = await User.create({
            name: name.trim(),
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
        });

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
        console.error('Registration error:', err);
        return res.status(500).json({ message: 'Registration service encountered an error. Please try again.' });
    }
};

// Accept Portal Invitation & Set Password (Flow B)
const acceptInvitation = async (req, res) => {
    try {
        const { token, email, password } = req.body;

        if (!token || !email || !password) {
            return res.status(400).json({ message: 'Invitation token, email, and password are required.' });
        }

        const pwValidation = validatePassword(password);
        if (!pwValidation.isValid) {
            return res.status(400).json({ message: pwValidation.message });
        }

        if (!isMongoReady()) {
            return res.status(503).json({
                message: 'Database connection is currently unavailable. Please try again in a moment.'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const candidate = await Candidate.findOne({
            email: normalizedEmail,
            invitationToken: token,
            invitationExpiresAt: { $gt: new Date() }
        });

        if (!candidate) {
            return res.status(400).json({ message: 'Invalid or expired invitation link. Please request a new invitation from HR.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const now = new Date();

        // Check if a User record already exists or create new
        let user = await User.findOne({ email: normalizedEmail });
        if (user) {
            user.password = passwordHash;
            user.status = 'ACTIVE';
            user.isOnline = true;
            user.lastLogin = now;
            user.lastActive = now;
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
        console.error('Accept invitation error:', err);
        return res.status(500).json({ message: 'Failed to activate portal account. Please try again.' });
    }
};

// Verify invitation token before displaying set password form
const verifyInvitation = async (req, res) => {
    try {
        const { token, email } = req.query;

        if (!token || !email) {
            return res.status(400).json({ valid: false, message: 'Token and email parameters are required.' });
        }

        if (!isMongoReady()) {
            return res.status(503).json({ valid: false, message: 'Database connection temporarily unavailable.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const candidate = await Candidate.findOne({
            email: normalizedEmail,
            invitationToken: token,
            invitationExpiresAt: { $gt: new Date() }
        }).lean();

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
    } catch (err) {
        console.error('Verify invitation error:', err);
        return res.status(500).json({ valid: false, message: 'Server error while verifying invitation.' });
    }
};

const logout = async (req, res) => {
    try {
        const userId = req.user?.id;
        const now = new Date();

        if (userId && isMongoReady() && mongoose.Types.ObjectId.isValid(userId)) {
            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastActive: now,
            });
        }

        return res.json({ message: 'Logged out successfully.' });
    } catch (err) {
        console.error('Logout error:', err);
        return res.json({ message: 'Logged out.' });
    }
};

module.exports = {
    login,
    register,
    acceptInvitation,
    verifyInvitation,
    logout
};
