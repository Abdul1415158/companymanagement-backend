const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const Leave = require('../models/Leave');
const Candidate = require('../models/Candidate');
const Payroll = require('../models/Payroll');
const Project = require('../models/Project');
const SystemSetting = require('../models/SystemSetting');
const inMemoryDB = require('../inMemoryDB');
const { validatePassword } = require('../utils/auth');

const isMongoReady = () => mongoose.connection.readyState === 1;

// Helper to sanitize and format user objects
const formatUser = (user) => ({
    id: user._id ? user._id.toString() : (user.id || ''),
    name: user.name || 'User',
    email: user.email,
    role: user.role || 'EMPLOYEE',
    department: user.department || 'General',
    phone: user.phone || '',
    profilePicture: user.profilePicture || '',
    status: user.status || 'ACTIVE',
    isOnline: user.isOnline || false,
    lastLogin: user.lastLogin || null,
    lastActive: user.lastActive || null,
    createdAt: user.createdAt,
});

// Helper to sanitize candidate objects
const formatCandidate = (c, isCandidateView = false) => {
    const formatted = {
        id: c._id ? c._id.toString() : (c.id || ''),
        fullName: c.fullName,
        email: c.email,
        phone: c.phone || '',
        positionApplied: c.positionApplied || c.roleApplied || 'General',
        roleApplied: c.positionApplied || c.roleApplied || 'General',
        source: c.source || 'Website',
        status: c.status || 'APPLIED',
        portalAccess: c.portalAccess || (c.userId ? 'ACTIVE' : 'NOT_INVITED'),
        userId: c.userId ? (c.userId._id ? c.userId._id.toString() : c.userId.toString()) : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
    if (!isCandidateView) {
        formatted.invitationToken = c.invitationToken || null;
        formatted.invitationExpiresAt = c.invitationExpiresAt || null;
    }
    return formatted;
};

// Dashboard summary with real-time active users and statistics
const getDashboardSummary = async (req, res) => {
    if (isMongoReady()) {
        try {
            const [
                totalUsers,
                totalAttendance,
                totalLeaves,
                totalTasks,
                totalPayroll,
                totalCandidates,
                totalProjects,
                totalDepartments,
                activeUsersList,
                todayAttendanceList
            ] = await Promise.all([
                User.countDocuments(),
                Attendance.countDocuments(),
                Leave.countDocuments(),
                Task.countDocuments(),
                Payroll.countDocuments(),
                Candidate.countDocuments(),
                Project.countDocuments(),
                Department.countDocuments(),
                User.find({ isOnline: true }).select('name email role department profilePicture isOnline lastLogin').lean(),
                Attendance.find({ date: new Date().toISOString().slice(0, 10) }).populate('userId', 'name email role department').lean()
            ]);

            return res.json({
                totalUsers,
                totalAttendance,
                totalLeaves,
                totalTasks,
                totalPayroll,
                totalCandidates,
                totalProjects,
                totalDepartments,
                activeUsersCount: activeUsersList.length,
                activeUsers: activeUsersList.map(formatUser),
                todayAttendanceCount: todayAttendanceList.length,
                todayAttendance: todayAttendanceList.map(att => ({
                    id: att._id ? att._id.toString() : (att.id || ''),
                    userName: att.userId?.name || 'Staff Member',
                    userRole: att.userId?.role || 'EMPLOYEE',
                    department: att.userId?.department || 'General',
                    checkIn: att.checkIn,
                    checkOut: att.checkOut,
                    status: att.status,
                })),
            });
        } catch (err) {
            console.error('Mongo getDashboardSummary error:', err.message);
        }
    }

    // In-memory fallback
    const activeUsersList = inMemoryDB.users.filter(u => u.isOnline);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAttendanceList = inMemoryDB.attendance.filter(a => a.date === todayStr);

    return res.json({
        totalUsers: inMemoryDB.users.length,
        totalAttendance: inMemoryDB.attendance.length,
        totalLeaves: inMemoryDB.leaves.length,
        totalTasks: inMemoryDB.tasks.length,
        totalPayroll: inMemoryDB.payroll.length,
        totalCandidates: inMemoryDB.candidates.length,
        totalProjects: inMemoryDB.projects.length,
        totalDepartments: inMemoryDB.departments.length,
        activeUsersCount: activeUsersList.length,
        activeUsers: activeUsersList.map(formatUser),
        todayAttendanceCount: todayAttendanceList.length,
        todayAttendance: todayAttendanceList.map(att => {
            const user = inMemoryDB.users.find(u => (u._id || u.id) === att.userId);
            return {
                id: att._id || att.id,
                userName: att.userName || user?.name || 'Staff Member',
                userRole: att.userRole || user?.role || 'EMPLOYEE',
                department: att.department || user?.department || 'General',
                checkIn: att.checkIn,
                checkOut: att.checkOut,
                status: att.status,
            };
        }),
    });
};

// Users Directory
const getUsers = async (req, res) => {
    if (isMongoReady()) {
        try {
            const users = await User.find({}).sort({ createdAt: -1 }).lean();
            return res.json(users.map(formatUser));
        } catch (err) {
            console.error('Mongo getUsers error:', err.message);
        }
    }
    return res.json(inMemoryDB.users.map(formatUser));
};

// Create Internal User (Super Admin & HR)
const createInternalUser = async (req, res) => {
    const { name, email, password, role, department, phone } = req.body;
    const creatorRole = req.user?.role;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }

    const allowedRolesForHR = ['MANAGER', 'EMPLOYEE', 'INTERN'];
    const allInternalRoles = ['CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN', 'SUPER_ADMIN'];

    if (!allInternalRoles.includes(role)) {
        return res.status(400).json({ message: `Invalid internal role: ${role}` });
    }

    // Role restrictions for creator
    if (creatorRole === 'HR') {
        if (!allowedRolesForHR.includes(role)) {
            return res.status(403).json({ message: 'HR is only authorized to create Manager, Employee, or Intern accounts.' });
        }
    } else if (creatorRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Only Super Admin and HR can create internal accounts.' });
    }

    // Enforce password requirements
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
            existing = inMemoryDB.users.find(u => u.email === normalizedEmail);
        }
    } else {
        existing = inMemoryDB.users.find(u => u.email === normalizedEmail);
    }

    if (existing) {
        return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const userData = {
        name,
        email: normalizedEmail,
        password: passwordHash,
        role,
        department: department || 'General',
        phone: phone || '',
        profilePicture: '',
        status: 'ACTIVE',
        isOnline: false,
        lastLogin: null,
        lastActive: null,
    };

    if (isMongoReady()) {
        try {
            const user = await User.create(userData);
            return res.status(201).json({
                message: `Internal user ${name} (${role}) created successfully.`,
                user: formatUser(user),
            });
        } catch (err) {
            console.error('Mongo createInternalUser error:', err.message);
        }
    }

    const inMemoryUser = {
        _id: new mongoose.Types.ObjectId().toString(),
        id: new mongoose.Types.ObjectId().toString(),
        ...userData,
        createdAt: now,
    };
    inMemoryDB.users.push(inMemoryUser);
    return res.status(201).json({
        message: `Internal user ${name} (${role}) created successfully.`,
        user: formatUser(inMemoryUser),
    });
};

// Update user role or status (for Super Admin, CEO, HR)
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { role, status, department } = req.body;
    const updaterRole = req.user?.role;

    // Role assignment restrictions
    if (role) {
        if (['SUPER_ADMIN', 'CEO', 'CTO', 'CMO'].includes(role) && updaterRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Only Super Admin can assign Executive or Super Admin roles.' });
        }
        if (updaterRole === 'HR' && !['MANAGER', 'EMPLOYEE', 'INTERN'].includes(role)) {
            return res.status(403).json({ message: 'HR can only assign Manager, Employee, or Intern roles.' });
        }
    }

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            const updateData = {};
            if (role) updateData.role = role;
            if (status) {
                updateData.status = status;
                if (status === 'TERMINATED' || status === 'INACTIVE') {
                    updateData.isOnline = false;
                }
            }
            if (department) updateData.department = department;

            const updated = await User.findByIdAndUpdate(id, updateData, { new: true });
            if (updated) return res.json(formatUser(updated));
        } catch (err) {
            console.error('Mongo updateUser error:', err.message);
        }
    }

    const user = inMemoryDB.users.find(u => (u._id || u.id) === id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (role) user.role = role;
    if (status) {
        user.status = status;
        if (status === 'TERMINATED' || status === 'INACTIVE') {
            user.isOnline = false;
        }
    }
    if (department) user.department = department;
    return res.json(formatUser(user));
};

// Offboard / Delete User (Restricted to Super Admin)
const deleteUser = async (req, res) => {
    const { id } = req.params;
    const requesterRole = req.user?.role;

    if (requesterRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Only Super Admin can remove/offboard users from system.' });
    }

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            await User.findByIdAndDelete(id);
            return res.json({ message: 'User removed / offboarded successfully.' });
        } catch (err) {
            console.error('Mongo deleteUser error:', err.message);
        }
    }

    const index = inMemoryDB.users.findIndex(u => (u._id || u.id) === id);
    if (index !== -1) {
        inMemoryDB.users.splice(index, 1);
        return res.json({ message: 'User removed / offboarded successfully.' });
    }
    return res.status(404).json({ message: 'User not found.' });
};

// Profile
const getProfile = async (req, res) => {
    const userId = req.user.id;
    if (isMongoReady() && mongoose.Types.ObjectId.isValid(userId)) {
        try {
            const user = await User.findById(userId).lean();
            if (user) return res.json(formatUser(user));
        } catch (err) {
            console.error('Mongo getProfile error:', err.message);
        }
    }

    const user = inMemoryDB.users.find(u => (u._id || u.id) === userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(formatUser(user));
};

const updateProfile = async (req, res) => {
    const userId = req.user.id;
    const { name, phone, department, profilePicture } = req.body;

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(userId)) {
        try {
            const updated = await User.findByIdAndUpdate(
                userId,
                { name, phone, department, profilePicture },
                { new: true }
            );
            if (updated) return res.json(formatUser(updated));
        } catch (err) {
            console.error('Mongo updateProfile error:', err.message);
        }
    }

    const user = inMemoryDB.users.find(u => (u._id || u.id) === userId);
    if (user) {
        if (name) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (department) user.department = department;
        if (profilePicture !== undefined) user.profilePicture = profilePicture;
    }
    return res.json(formatUser(user || { id: userId, name, email: req.user.email }));
};

// Departments
const getDepartments = async (req, res) => {
    if (isMongoReady()) {
        try {
            const departments = await Department.find({}).sort({ createdAt: -1 }).lean();
            return res.json(departments.map(d => ({ ...d, id: d._id ? d._id.toString() : d.id })));
        } catch (err) {
            console.error('Mongo getDepartments error:', err.message);
        }
    }
    return res.json(inMemoryDB.departments.map(d => ({ ...d, id: d._id || d.id })));
};

const createDepartment = async (req, res) => {
    const { name, description, headId } = req.body;
    if (!name) return res.status(400).json({ message: 'Department name is required.' });

    if (isMongoReady()) {
        try {
            const department = await Department.create({
                name,
                description: description || '',
                headId: headId && mongoose.Types.ObjectId.isValid(headId) ? headId : null,
            });
            return res.status(201).json({
                id: department._id.toString(),
                name: department.name,
                description: department.description,
                headId: department.headId,
            });
        } catch (err) {
            console.error('Mongo createDepartment error:', err.message);
        }
    }

    const newDept = {
        _id: 'dept-' + Date.now().toString(),
        id: 'dept-' + Date.now().toString(),
        name,
        description: description || '',
        headId: headId || null,
    };
    inMemoryDB.departments.push(newDept);
    return res.status(201).json(newDept);
};

// Attendance (Shared visibility)
const getAttendance = async (req, res) => {
    if (isMongoReady()) {
        try {
            const rows = await Attendance.find({})
                .populate('userId', 'name email role department profilePicture')
                .sort({ date: -1, createdAt: -1 })
                .lean();

            return res.json(rows.map((row) => ({
                ...row,
                id: row._id ? row._id.toString() : (row.id || ''),
                userName: row.userId?.name || row.userName || 'Staff Member',
                userEmail: row.userId?.email || row.userEmail || '',
                userRole: row.userId?.role || row.userRole || 'EMPLOYEE',
                department: row.userId?.department || row.department || 'General',
                userId: row.userId?._id ? row.userId._id.toString() : (row.userId ? row.userId.toString() : ''),
            })));
        } catch (err) {
            console.error('Mongo getAttendance error:', err.message);
        }
    }

    return res.json(inMemoryDB.attendance.map((row) => {
        const user = inMemoryDB.users.find(u => (u._id || u.id) === (row.userId?._id || row.userId));
        return {
            ...row,
            id: row._id || row.id,
            userName: row.userName || user?.name || 'Staff Member',
            userEmail: row.userEmail || user?.email || '',
            userRole: user?.role || 'EMPLOYEE',
            department: row.department || user?.department || 'General',
            userId: row.userId?._id ? row.userId._id.toString() : (row.userId ? row.userId.toString() : ''),
        };
    }));
};

const checkIn = async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const userId = req.user.id;
    const now = new Date().toISOString();

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(userId)) {
        try {
            const existing = await Attendance.findOne({ userId, date: today });
            if (existing) {
                return res.status(400).json({ message: 'Attendance already marked for today.' });
            }

            const attendance = await Attendance.create({
                userId,
                date: today,
                checkIn: now,
                status: 'PRESENT',
            });

            return res.status(201).json({ id: attendance._id.toString(), message: 'Checked in successfully.' });
        } catch (err) {
            console.error('Mongo checkIn error:', err.message);
            return res.status(500).json({ message: 'Database error during check-in: ' + err.message });
        }
    }

    // In-memory fallback
    const existing = inMemoryDB.attendance.find(a => (String(a.userId) === String(userId) || String(a.userId?._id) === String(userId) || (a.userEmail && a.userEmail === req.user.email)) && a.date === today);
    if (existing) {
        return res.status(400).json({ message: 'Attendance already marked for today.' });
    }

    const user = inMemoryDB.users.find(u => (u._id || u.id) === userId);
    const newAttendance = {
        _id: 'att-' + Date.now().toString(),
        id: 'att-' + Date.now().toString(),
        userId,
        userName: user?.name || req.user.name || 'User',
        userEmail: user?.email || req.user.email || '',
        userRole: user?.role || req.user.role || 'EMPLOYEE',
        department: user?.department || 'General',
        date: today,
        checkIn: now,
        checkOut: '',
        status: 'PRESENT',
        notes: '',
        createdAt: new Date(),
    };
    inMemoryDB.attendance.unshift(newAttendance);

    return res.status(201).json({ id: newAttendance.id, message: 'Checked in successfully.' });
};

const checkOut = async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const userId = req.user.id;
    const now = new Date().toISOString();

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(userId)) {
        try {
            const updated = await Attendance.findOneAndUpdate(
                { userId, date: today },
                { checkOut: now, status: 'PRESENT' },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ message: 'No check-in record found for today.' });
            }

            return res.json({ message: 'Checked out successfully.', data: updated });
        } catch (err) {
            console.error('Mongo checkOut error:', err.message);
            return res.status(500).json({ message: 'Database error during check-out: ' + err.message });
        }
    }

    // In-memory fallback
    const record = inMemoryDB.attendance.find(a => (String(a.userId) === String(userId) || String(a.userId?._id) === String(userId) || (a.userEmail && a.userEmail === req.user.email)) && a.date === today);
    if (record) {
        record.checkOut = now;
        return res.json({ message: 'Checked out successfully.', data: record });
    }
    return res.status(404).json({ message: 'No check-in record found for today.' });
};

// Tasks & Work Assignments
const getTasks = async (req, res) => {
    if (isMongoReady()) {
        try {
            const tasks = await Task.find({})
                .populate('assignedTo', 'name email role department')
                .populate('assignedBy', 'name email role')
                .sort({ createdAt: -1 })
                .lean();

            return res.json(tasks.map((task) => ({
                ...task,
                id: task._id ? task._id.toString() : (task.id || ''),
                assignedUser: task.assignedTo?.name || null,
                assignedToId: task.assignedTo?._id ? task.assignedTo._id.toString() : (task.assignedTo || ''),
                assignedByName: task.assignedBy?.name || 'Management',
            })));
        } catch (err) {
            console.error('Mongo getTasks error:', err.message);
        }
    }

    return res.json(inMemoryDB.tasks.map((task) => {
        const assigned = inMemoryDB.users.find(u => (u._id || u.id) === (task.assignedTo?._id || task.assignedTo));
        const creator = inMemoryDB.users.find(u => (u._id || u.id) === (task.assignedBy?._id || task.assignedBy));
        return {
            ...task,
            id: task._id || task.id,
            assignedUser: task.assignedUser || assigned?.name || 'Unassigned',
            assignedToId: task.assignedTo,
            assignedByName: creator?.name || 'Management',
        };
    }));
};

const createTask = async (req, res) => {
    const { title, description, assignedTo, dueDate, department } = req.body;
    if (!title) return res.status(400).json({ message: 'Task title is required.' });

    if (isMongoReady()) {
        try {
            const task = await Task.create({
                title,
                description: description || '',
                assignedTo: assignedTo && mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null,
                assignedBy: req.user.id && mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : null,
                department: department || 'General',
                dueDate: dueDate || null,
                status: 'OPEN',
            });

            return res.status(201).json({
                id: task._id.toString(),
                title: task.title,
                description: task.description,
                assignedTo: task.assignedTo,
                dueDate: task.dueDate,
                status: task.status,
            });
        } catch (err) {
            console.error('Mongo createTask error:', err.message);
        }
    }

    const assigned = inMemoryDB.users.find(u => (u._id || u.id) === assignedTo);
    const newTask = {
        _id: 'task-' + Date.now().toString(),
        id: 'task-' + Date.now().toString(),
        title,
        description: description || '',
        assignedTo: assignedTo || null,
        assignedUser: assigned?.name || 'Unassigned',
        assignedBy: req.user.id,
        department: department || 'General',
        dueDate: dueDate || null,
        status: 'OPEN',
        createdAt: new Date(),
    };
    inMemoryDB.tasks.unshift(newTask);
    return res.status(201).json(newTask);
};

const updateTaskStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid task status.' });
    }

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            const updated = await Task.findByIdAndUpdate(id, { status }, { new: true });
            if (updated) return res.json({ id: updated._id.toString(), status: updated.status, message: 'Task status updated.' });
        } catch (err) {
            console.error('Mongo updateTaskStatus error:', err.message);
        }
    }

    const task = inMemoryDB.tasks.find(t => (t._id || t.id) === id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    task.status = status;
    return res.json({ id: task.id || task._id, status: task.status, message: 'Task status updated.' });
};

// Leaves
const getLeaves = async (req, res) => {
    if (isMongoReady()) {
        try {
            const rows = await Leave.find({})
                .populate('userId', 'name email department role')
                .sort({ createdAt: -1 })
                .lean();

            return res.json(rows.map((row) => ({
                ...row,
                id: row._id ? row._id.toString() : (row.id || ''),
                userName: row.userId?.name || 'Employee',
                userEmail: row.userId?.email || '',
                department: row.userId?.department || 'General',
                userId: row.userId?._id ? row.userId._id.toString() : (row.userId || ''),
            })));
        } catch (err) {
            console.error('Mongo getLeaves error:', err.message);
        }
    }

    return res.json(inMemoryDB.leaves.map((row) => {
        const user = inMemoryDB.users.find(u => (u._id || u.id) === row.userId);
        return {
            ...row,
            id: row._id || row.id,
            userName: row.userName || user?.name || 'Employee',
            userEmail: row.userEmail || user?.email || '',
            department: row.department || user?.department || 'General',
        };
    }));
};

const createLeave = async (req, res) => {
    const { leaveType, startDate, endDate, reason } = req.body;
    if (!leaveType || !startDate || !endDate) {
        return res.status(400).json({ message: 'Leave type, start date, and end date are required.' });
    }

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(req.user.id)) {
        try {
            const leave = await Leave.create({
                userId: req.user.id,
                leaveType,
                startDate,
                endDate,
                reason: reason || '',
                status: 'PENDING',
            });
            return res.status(201).json({ id: leave._id.toString(), message: 'Leave request submitted successfully.' });
        } catch (err) {
            console.error('Mongo createLeave error:', err.message);
        }
    }

    const user = inMemoryDB.users.find(u => (u._id || u.id) === req.user.id);
    const newLeave = {
        _id: 'leave-' + Date.now().toString(),
        id: 'leave-' + Date.now().toString(),
        userId: req.user.id,
        userName: user?.name || req.user.name || 'Employee',
        userEmail: user?.email || req.user.email || '',
        department: user?.department || 'General',
        leaveType,
        startDate,
        endDate,
        reason: reason || '',
        status: 'PENDING',
        createdAt: new Date(),
    };
    inMemoryDB.leaves.unshift(newLeave);
    return res.status(201).json({ id: newLeave.id, message: 'Leave request submitted successfully.' });
};

const updateLeaveStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['APPROVED', 'REJECTED', 'PENDING'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid leave status.' });
    }

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            const updated = await Leave.findByIdAndUpdate(id, { status }, { new: true });
            if (updated) return res.json({ id: updated._id.toString(), status: updated.status, message: `Leave ${status.toLowerCase()}.` });
        } catch (err) {
            console.error('Mongo updateLeaveStatus error:', err.message);
        }
    }

    const leave = inMemoryDB.leaves.find(l => (l._id || l.id) === id);
    if (!leave) return res.status(404).json({ message: 'Leave record not found.' });
    leave.status = status;
    return res.json({ id: leave.id || leave._id, status: leave.status, message: `Leave ${status.toLowerCase()}.` });
};

// Candidates & Recruitment
const getCandidates = async (req, res) => {
    const isCandidate = req.user?.role === 'CANDIDATE';
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (isMongoReady()) {
        try {
            let query = {};
            if (isCandidate) {
                const orConditions = [];
                if (mongoose.Types.ObjectId.isValid(userId)) {
                    orConditions.push({ userId });
                }
                if (userEmail) {
                    orConditions.push({ email: userEmail.toLowerCase().trim() });
                }
                if (orConditions.length > 0) {
                    query = { $or: orConditions };
                }
            }

            const rows = await Candidate.find(query).sort({ createdAt: -1 }).lean();
            return res.json(rows.map((row) => formatCandidate(row, isCandidate)));
        } catch (err) {
            console.error('Mongo getCandidates error:', err.message);
        }
    }

    let rows = inMemoryDB.candidates;
    if (isCandidate) {
        rows = inMemoryDB.candidates.filter(c => 
            String(c.userId) === String(userId) ||
            (c.email && userEmail && c.email.toLowerCase() === userEmail.toLowerCase())
        );
    }

    return res.json(rows.map((row) => formatCandidate(row, isCandidate)));
};

const createCandidate = async (req, res) => {
    const { fullName, email, phone, positionApplied, roleApplied, source, status } = req.body;
    if (!fullName || !email) {
        return res.status(400).json({ message: 'Full name and email are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const resolvedPosition = positionApplied || roleApplied || 'General';
    const requesterRole = req.user?.role;
    const isCandidateSubmitter = requesterRole === 'CANDIDATE';

    // Determine linked user and portal access status
    let linkedUserId = null;
    let initialPortalAccess = 'NOT_INVITED';

    if (isCandidateSubmitter) {
        linkedUserId = req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : (req.user?.id || null);
        initialPortalAccess = 'ACTIVE';
    } else {
        // If HR/Admin adds applicant manually, check if user already has an active User account
        if (isMongoReady()) {
            try {
                const existingUser = await User.findOne({ email: normalizedEmail }).lean();
                if (existingUser) {
                    linkedUserId = existingUser._id;
                    initialPortalAccess = 'ACTIVE';
                }
            } catch (uErr) {
                console.error('User lookup in createCandidate:', uErr.message);
            }
        } else {
            const existingUser = inMemoryDB.users.find(u => u.email === normalizedEmail);
            if (existingUser) {
                linkedUserId = existingUser.id || existingUser._id;
                initialPortalAccess = 'ACTIVE';
            }
        }
    }

    const candidateData = {
        userId: linkedUserId,
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone ? phone.trim() : '',
        positionApplied: resolvedPosition,
        roleApplied: resolvedPosition,
        source: source || (isCandidateSubmitter ? 'Candidate Portal' : 'Direct / Recruitment'),
        status: status || 'APPLIED',
        portalAccess: initialPortalAccess,
        invitationToken: null,
        invitationExpiresAt: null,
    };

    if (isMongoReady()) {
        try {
            const candidate = await Candidate.create(candidateData);
            return res.status(201).json({
                id: candidate._id.toString(),
                candidate: formatCandidate(candidate, isCandidateSubmitter),
                message: isCandidateSubmitter
                    ? 'Your job application has been submitted successfully!'
                    : `Applicant ${fullName} added to recruitment pipeline successfully. (No login password required)`
            });
        } catch (err) {
            console.error('Mongo createCandidate error:', err.message);
        }
    }

    const newCandidate = {
        _id: 'cand-' + Date.now().toString(),
        id: 'cand-' + Date.now().toString(),
        ...candidateData,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    inMemoryDB.candidates.unshift(newCandidate);
    return res.status(201).json({
        id: newCandidate.id,
        candidate: formatCandidate(newCandidate, isCandidateSubmitter),
        message: isCandidateSubmitter
            ? 'Your job application has been submitted successfully!'
            : `Applicant ${fullName} added to recruitment pipeline successfully. (No login password required)`
    });
};

const updateCandidateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid candidate stage status.' });
    }

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            const updated = await Candidate.findByIdAndUpdate(id, { status }, { new: true });
            if (updated) return res.json({ id: updated._id.toString(), status: updated.status, message: `Candidate stage updated to ${status}.` });
        } catch (err) {
            console.error('Mongo updateCandidateStatus error:', err.message);
        }
    }

    const candidate = inMemoryDB.candidates.find(c => (c._id || c.id) === id);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found.' });
    candidate.status = status;
    return res.json({ id: candidate.id || candidate._id, status: candidate.status, message: `Candidate stage updated to ${status}.` });
};

// Send Candidate Portal Invitation (Generates secure token so candidate can set their own password)
const sendCandidateInvitation = async (req, res) => {
    const { id } = req.params;

    let candidate = null;
    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            candidate = await Candidate.findById(id);
        } catch (err) {
            console.error('Mongo sendCandidateInvitation lookup error:', err.message);
        }
    }

    if (!candidate) {
        candidate = inMemoryDB.candidates.find(c => (c._id || c.id) === id);
    }

    if (!candidate) {
        return res.status(404).json({ message: 'Candidate applicant not found.' });
    }

    if (candidate.portalAccess === 'ACTIVE') {
        return res.status(400).json({ message: 'This candidate already has an active portal account.' });
    }

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days validity
    const portalAccess = 'INVITATION_SENT';

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            candidate.invitationToken = invitationToken;
            candidate.invitationExpiresAt = invitationExpiresAt;
            candidate.portalAccess = portalAccess;
            await candidate.save();
        } catch (err) {
            console.error('Mongo sendCandidateInvitation save error:', err.message);
        }
    } else {
        candidate.invitationToken = invitationToken;
        candidate.invitationExpiresAt = invitationExpiresAt;
        candidate.portalAccess = portalAccess;
    }

    const invitationLink = `/set-password?token=${invitationToken}&email=${encodeURIComponent(candidate.email)}`;

    return res.json({
        message: `Portal invitation generated for ${candidate.fullName}. The candidate can now set their password.`,
        invitationToken,
        invitationLink,
        portalAccess: 'INVITATION_SENT',
    });
};

// Onboard Hired Candidate as an Internal Employee / Staff Profile
const onboardCandidate = async (req, res) => {
    const { id } = req.params;
    const { internalRole, department, phone, temporaryPassword } = req.body;
    const assignerRole = req.user?.role;

    const targetRole = internalRole || 'EMPLOYEE';
    if (['SUPER_ADMIN', 'CEO', 'CTO', 'CMO'].includes(targetRole) && assignerRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Only Super Admin can onboard into executive roles.' });
    }

    let candidate = null;
    if (isMongoReady() && mongoose.Types.ObjectId.isValid(id)) {
        try {
            candidate = await Candidate.findById(id);
        } catch (err) {
            console.error('Mongo onboardCandidate lookup error:', err.message);
        }
    }
    if (!candidate) {
        candidate = inMemoryDB.candidates.find(c => (c._id || c.id) === id);
    }
    if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found.' });
    }

    let passwordHash = null;
    if (temporaryPassword) {
        const pwValidation = validatePassword(temporaryPassword);
        if (!pwValidation.isValid) {
            return res.status(400).json({ message: pwValidation.message });
        }
        passwordHash = await bcrypt.hash(temporaryPassword, 10);
    }

    const normalizedEmail = candidate.email.toLowerCase().trim();
    const now = new Date();
    let staffUser = null;

    if (isMongoReady()) {
        try {
            staffUser = await User.findOne({ email: normalizedEmail });
            if (staffUser) {
                staffUser.role = targetRole;
                staffUser.department = department || 'General';
                staffUser.status = 'ACTIVE';
                if (passwordHash) staffUser.password = passwordHash;
                if (phone) staffUser.phone = phone;
                await staffUser.save();
            } else {
                if (!passwordHash) {
                    passwordHash = await bcrypt.hash('StaffPass123!', 10);
                }
                staffUser = await User.create({
                    name: candidate.fullName,
                    email: normalizedEmail,
                    password: passwordHash,
                    role: targetRole,
                    department: department || 'General',
                    phone: phone || candidate.phone || '',
                    status: 'ACTIVE',
                    isOnline: false,
                    lastLogin: null,
                    lastActive: null,
                });
            }

            candidate.status = 'HIRED';
            candidate.portalAccess = 'ACTIVE';
            candidate.userId = staffUser._id;
            await candidate.save();

            return res.json({
                message: `Candidate ${candidate.fullName} successfully onboarded as ${targetRole} in ${department || 'General'} department.`,
                user: formatUser(staffUser),
            });
        } catch (err) {
            console.error('Mongo onboardCandidate error:', err.message);
        }
    }

    // In-memory fallback
    staffUser = inMemoryDB.users.find(u => u.email === normalizedEmail);
    if (staffUser) {
        staffUser.role = targetRole;
        staffUser.department = department || 'General';
        staffUser.status = 'ACTIVE';
        if (passwordHash) staffUser.password = passwordHash;
        if (phone) staffUser.phone = phone;
    } else {
        if (!passwordHash) {
            passwordHash = await bcrypt.hash('StaffPass123!', 10);
        }
        staffUser = {
            _id: new mongoose.Types.ObjectId().toString(),
            id: new mongoose.Types.ObjectId().toString(),
            name: candidate.fullName,
            email: normalizedEmail,
            password: passwordHash,
            role: targetRole,
            department: department || 'General',
            phone: phone || candidate.phone || '',
            status: 'ACTIVE',
            isOnline: false,
            lastLogin: null,
            lastActive: null,
            createdAt: now,
        };
        inMemoryDB.users.push(staffUser);
    }

    candidate.status = 'HIRED';
    candidate.portalAccess = 'ACTIVE';
    candidate.userId = staffUser.id || staffUser._id;

    return res.json({
        message: `Candidate ${candidate.fullName} successfully onboarded as ${targetRole} in ${department || 'General'} department.`,
        user: formatUser(staffUser),
    });
};

// Payroll (Role-governed: HR & Super Admin create/disburse with disburser tracking)
const getPayroll = async (req, res) => {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isExecutiveOrHR = ['SUPER_ADMIN', 'HR', 'CEO'].includes(userRole);

    if (isMongoReady()) {
        try {
            let query = {};
            if (!isExecutiveOrHR && mongoose.Types.ObjectId.isValid(userId)) {
                query = { userId };
            }

            const rows = await Payroll.find(query)
                .populate('userId', 'name email role department')
                .populate('disbursedBy', 'name email role')
                .sort({ createdAt: -1 })
                .lean();

            return res.json(rows.map((row) => ({
                ...row,
                id: row._id ? row._id.toString() : (row.id || ''),
                userName: row.userId?.name || 'Employee',
                userEmail: row.userId?.email || '',
                userRole: row.userId?.role || 'EMPLOYEE',
                department: row.userId?.department || 'General',
                userId: row.userId?._id ? row.userId._id.toString() : (row.userId ? row.userId.toString() : ''),
                disbursedByName: row.disbursedBy?.name || row.disbursedByName || 'HR / Super Admin',
                disbursedByRole: row.disbursedBy?.role || row.disbursedByRole || 'HR',
                disbursedByEmail: row.disbursedBy?.email || '',
            })));
        } catch (err) {
            console.error('Mongo getPayroll error:', err.message);
        }
    }

    let rows = inMemoryDB.payroll;
    if (!isExecutiveOrHR) {
        rows = inMemoryDB.payroll.filter(p => String(p.userId) === String(userId) || String(p.userId?._id) === String(userId));
    }

    return res.json(rows.map((row) => {
        const user = inMemoryDB.users.find(u => (u._id || u.id) === (row.userId?._id || row.userId));
        const disburser = inMemoryDB.users.find(u => (u._id || u.id) === (row.disbursedBy?._id || row.disbursedBy));
        return {
            ...row,
            id: row._id || row.id,
            userName: row.userName || user?.name || 'Employee',
            userEmail: row.userEmail || user?.email || '',
            userRole: user?.role || 'EMPLOYEE',
            department: user?.department || 'General',
            userId: row.userId?._id ? row.userId._id.toString() : (row.userId ? row.userId.toString() : ''),
            disbursedByName: row.disbursedByName || disburser?.name || 'HR / Super Admin',
            disbursedByRole: row.disbursedByRole || disburser?.role || 'HR',
            disbursedByEmail: disburser?.email || '',
        };
    }));
};

const createPayroll = async (req, res) => {
    const { userId, month, basicSalary, allowances, deductions } = req.body;
    if (!userId || !month || !basicSalary) {
        return res.status(400).json({ message: 'User, month and basic salary are required.' });
    }

    const netSalary = Number(basicSalary) + Number(allowances || 0) - Number(deductions || 0);
    const disburserId = req.user?.id;
    const disburserName = req.user?.name || 'HR / Admin';
    const disburserRole = req.user?.role || 'HR';

    if (isMongoReady() && mongoose.Types.ObjectId.isValid(userId)) {
        try {
            const payroll = await Payroll.create({
                userId,
                month,
                basicSalary: Number(basicSalary),
                allowances: Number(allowances || 0),
                deductions: Number(deductions || 0),
                netSalary,
                status: 'PAID',
                disbursedBy: mongoose.Types.ObjectId.isValid(disburserId) ? disburserId : null,
            });
            return res.status(201).json({ id: payroll._id.toString(), message: 'Payroll disbursed and recorded successfully.' });
        } catch (err) {
            console.error('Mongo createPayroll error:', err.message);
        }
    }

    const user = inMemoryDB.users.find(u => (u._id || u.id) === userId);
    const newPayroll = {
        _id: 'pay-' + Date.now().toString(),
        id: 'pay-' + Date.now().toString(),
        userId,
        userName: user?.name || 'Employee',
        userEmail: user?.email || '',
        month,
        basicSalary: Number(basicSalary),
        allowances: Number(allowances || 0),
        deductions: Number(deductions || 0),
        netSalary,
        status: 'PAID',
        disbursedBy: disburserId,
        disbursedByName: disburserName,
        disbursedByRole: disburserRole,
        createdAt: new Date(),
    };
    inMemoryDB.payroll.unshift(newPayroll);
    return res.status(201).json({ id: newPayroll.id, message: 'Payroll disbursed and recorded successfully.' });
};

// Projects
const getProjects = async (req, res) => {
    if (isMongoReady()) {
        try {
            const rows = await Project.find({})
                .populate('ownerId', 'name email')
                .sort({ createdAt: -1 })
                .lean();

            return res.json(rows.map((row) => ({
                ...row,
                id: row._id ? row._id.toString() : (row.id || ''),
                ownerName: row.ownerId?.name || 'Lead',
            })));
        } catch (err) {
            console.error('Mongo getProjects error:', err.message);
        }
    }

    return res.json(inMemoryDB.projects.map((row) => {
        const owner = inMemoryDB.users.find(u => (u._id || u.id) === (row.ownerId?._id || row.ownerId));
        return {
            ...row,
            id: row._id || row.id,
            ownerName: owner?.name || 'Lead',
        };
    }));
};

const createProject = async (req, res) => {
    const { name, description, ownerId, department, status } = req.body;
    if (!name) return res.status(400).json({ message: 'Project name is required.' });

    if (isMongoReady()) {
        try {
            const project = await Project.create({
                name,
                description: description || '',
                ownerId: ownerId && mongoose.Types.ObjectId.isValid(ownerId) ? ownerId : (mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : null),
                department: department || 'General',
                status: status || 'ACTIVE',
            });
            return res.status(201).json({
                id: project._id.toString(),
                name: project.name,
                description: project.description,
                ownerId: project.ownerId,
                department: project.department,
                status: project.status,
            });
        } catch (err) {
            console.error('Mongo createProject error:', err.message);
        }
    }

    const newProject = {
        _id: 'proj-' + Date.now().toString(),
        id: 'proj-' + Date.now().toString(),
        name,
        description: description || '',
        ownerId: ownerId || req.user.id,
        department: department || 'General',
        status: status || 'ACTIVE',
        createdAt: new Date(),
    };
    inMemoryDB.projects.unshift(newProject);
    return res.status(201).json(newProject);
};

// System Settings
const getSystemSettings = async (req, res) => {
    if (isMongoReady()) {
        try {
            const settings = await SystemSetting.find({}).lean();
            return res.json(settings.map((row) => ({ ...row, id: row._id ? row._id.toString() : (row.id || '') })));
        } catch (err) {
            console.error('Mongo getSystemSettings error:', err.message);
        }
    }
    return res.json(inMemoryDB.systemSettings.map((row) => ({ ...row, id: row._id || row.id })));
};

const updateSystemSettings = async (req, res) => {
    const { key, value } = req.body;
    if (!key || !value) {
        return res.status(400).json({ message: 'Setting key and value are required.' });
    }

    if (isMongoReady()) {
        try {
            const setting = await SystemSetting.findOneAndUpdate(
                { key },
                { value },
                { upsert: true, new: true }
            );
            return res.json({ id: setting._id.toString(), key: setting.key, value: setting.value, message: 'System setting updated.' });
        } catch (err) {
            console.error('Mongo updateSystemSettings error:', err.message);
        }
    }

    let setting = inMemoryDB.systemSettings.find(s => s.key === key);
    if (!setting) {
        setting = { _id: Date.now().toString(), key, value };
        inMemoryDB.systemSettings.push(setting);
    } else {
        setting.value = value;
    }
    return res.json({ id: setting._id, key: setting.key, value: setting.value, message: 'System setting updated.' });
};

module.exports = {
    getDashboardSummary,
    getUsers,
    createInternalUser,
    updateUser,
    deleteUser,
    getProfile,
    updateProfile,
    getDepartments,
    createDepartment,
    getAttendance,
    checkIn,
    checkOut,
    getTasks,
    createTask,
    updateTaskStatus,
    getLeaves,
    createLeave,
    updateLeaveStatus,
    getCandidates,
    createCandidate,
    updateCandidateStatus,
    sendCandidateInvitation,
    onboardCandidate,
    getPayroll,
    createPayroll,
    getProjects,
    createProject,
    getSystemSettings,
    updateSystemSettings,
};
