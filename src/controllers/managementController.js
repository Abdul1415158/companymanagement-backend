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
const { validatePassword } = require('../utils/auth');
const { connectDB } = require('../config/db');

const isMongoReady = async () => {
    if (mongoose.connection.readyState === 1) return true;
    try {
        await connectDB();
        return mongoose.connection.readyState === 1;
    } catch {
        return false;
    }
};

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

// Common department mappings for executive scopes
const TECH_DEPTS = ['Engineering', 'Technology', 'IT', 'Development', 'Software'];
const MKTG_DEPTS = ['Marketing', 'Creative', 'Design', 'Content', 'Social Media'];

// 1. Dashboard summary with real-time statistics tailored by role (SRS specifications)
const getDashboardSummary = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting. Please refresh in a moment.' });
        }

        const userRole = req.user?.role || 'CANDIDATE';
        const userId = req.user?.id;
        const userDept = req.user?.department || 'General';
        const todayStr = new Date().toISOString().slice(0, 10);

        // Fetch common base data
        const activeUsersList = await User.find({ isOnline: true })
            .select('name email role department profilePicture isOnline lastLogin')
            .lean();

        // 1. CANDIDATE Dashboard Metrics
        if (userRole === 'CANDIDATE') {
            const userEmail = req.user?.email ? req.user.email.toLowerCase().trim() : '';
            const myApps = await Candidate.find({
                $or: [
                    { userId: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
                    { email: userEmail }
                ]
            }).sort({ createdAt: -1 }).lean();

            return res.json({
                userRole,
                myApplicationsCount: myApps.length,
                myApplications: myApps.map(app => formatCandidate(app, true)),
                latestApplication: myApps[0] ? formatCandidate(myApps[0], true) : null,
                activeUsersCount: activeUsersList.length,
                activeUsers: activeUsersList.map(formatUser),
            });
        }

        // 2. EMPLOYEE & INTERN Dashboard Metrics (SRS Page 30 & 61)
        if (userRole === 'EMPLOYEE' || userRole === 'INTERN') {
            const [myTasks, myTodayAttendance, myLeaves, myPayrollCount, totalProjects] = await Promise.all([
                Task.find({ assignedTo: userId }).sort({ createdAt: -1 }).lean(),
                Attendance.findOne({ userId, date: todayStr }).lean(),
                Leave.find({ userId }).sort({ createdAt: -1 }).lean(),
                Payroll.countDocuments({ userId }),
                Project.countDocuments({ $or: [{ department: userDept }, { ownerId: userId }] })
            ]);

            const pendingTasks = myTasks.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length;
            const submittedTasks = myTasks.filter(t => ['SUBMITTED', 'UNDER_REVIEW', 'REVIEW'].includes(t.status)).length;
            const revisionTasks = myTasks.filter(t => t.status === 'REVISION_REQUIRED').length;
            const completedTasks = myTasks.filter(t => ['APPROVED', 'DONE', 'COMPLETED'].includes(t.status)).length;

            return res.json({
                userRole,
                myTasksCount: myTasks.length,
                pendingTasks,
                submittedTasks,
                revisionTasks,
                completedTasks,
                myTasks: myTasks.slice(0, 5),
                myTodayAttendance: myTodayAttendance ? {
                    checkIn: myTodayAttendance.checkIn,
                    checkOut: myTodayAttendance.checkOut,
                    status: myTodayAttendance.status,
                } : null,
                myLeavesCount: myLeaves.length,
                myPendingLeaves: myLeaves.filter(l => l.status === 'PENDING').length,
                myPayrollCount,
                totalProjects,
                activeUsersCount: activeUsersList.length,
                activeUsers: activeUsersList.map(formatUser),
            });
        }

        // 3. CTO Dashboard Metrics (SRS Page 29 & 30: Tech Projects, Technical Tasks, Active Developers, Tasks Due Today, Overdue Tech Tasks, Intern Progress)
        if (userRole === 'CTO') {
            const techDeptRegex = new RegExp(TECH_DEPTS.join('|'), 'i');
            const [
                techProjects,
                techTasks,
                activeDevs,
                internsList,
                todayAttendanceList
            ] = await Promise.all([
                Project.find({ department: techDeptRegex }).lean(),
                Task.find({ department: techDeptRegex }).populate('assignedTo', 'name email role department').lean(),
                User.find({ department: techDeptRegex, role: { $in: ['EMPLOYEE', 'MANAGER', 'INTERN'] } }).lean(),
                User.find({ department: techDeptRegex, role: 'INTERN' }).lean(),
                Attendance.find({ date: todayStr }).populate('userId', 'name email role department').lean()
            ]);

            const techAttendance = todayAttendanceList.filter(att => 
                att.userId && (techDeptRegex.test(att.userId.department) || TECH_DEPTS.includes(att.userId.department))
            );

            const openTasks = techTasks.filter(t => ['OPEN', 'ASSIGNED'].includes(t.status)).length;
            const inProgressTasks = techTasks.filter(t => t.status === 'IN_PROGRESS').length;
            const awaitingReviewTasks = techTasks.filter(t => ['SUBMITTED', 'UNDER_REVIEW', 'REVIEW'].includes(t.status)).length;
            const completedTasks = techTasks.filter(t => ['APPROVED', 'DONE', 'COMPLETED'].includes(t.status)).length;

            const now = new Date();
            const overdueTasks = techTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && !['APPROVED', 'DONE', 'COMPLETED'].includes(t.status)).length;

            return res.json({
                userRole,
                totalProjects: techProjects.length,
                totalTasks: techTasks.length,
                openTasks,
                inProgressTasks,
                awaitingReviewTasks,
                completedTasks,
                overdueTasks,
                activeDevelopersCount: activeDevs.length,
                internsCount: internsList.length,
                todayAttendanceCount: techAttendance.length,
                todayAttendance: techAttendance.map(att => ({
                    id: att._id.toString(),
                    userName: att.userId?.name || 'Developer',
                    userRole: att.userId?.role || 'EMPLOYEE',
                    department: att.userId?.department || 'Engineering',
                    checkIn: att.checkIn,
                    checkOut: att.checkOut,
                    status: att.status,
                })),
                activeUsersCount: activeUsersList.filter(u => techDeptRegex.test(u.department)).length,
                activeUsers: activeUsersList.filter(u => techDeptRegex.test(u.department)).map(formatUser),
            });
        }

        // 4. CMO Dashboard Metrics (SRS Page 29: Marketing Tasks Today, Designs Pending, Revisions, Awaiting Approval, Active Campaigns, Overdue Tasks)
        if (userRole === 'CMO') {
            const mktgDeptRegex = new RegExp(MKTG_DEPTS.join('|'), 'i');
            const [
                mktgProjects,
                mktgTasks,
                mktgTeam,
                todayAttendanceList
            ] = await Promise.all([
                Project.find({ department: mktgDeptRegex }).lean(),
                Task.find({ department: mktgDeptRegex }).populate('assignedTo', 'name email role department').lean(),
                User.find({ department: mktgDeptRegex }).lean(),
                Attendance.find({ date: todayStr }).populate('userId', 'name email role department').lean()
            ]);

            const mktgAttendance = todayAttendanceList.filter(att => 
                att.userId && (mktgDeptRegex.test(att.userId.department) || MKTG_DEPTS.includes(att.userId.department))
            );

            const designsPending = mktgTasks.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length;
            const awaitingApproval = mktgTasks.filter(t => ['SUBMITTED', 'UNDER_REVIEW', 'REVIEW'].includes(t.status)).length;
            const revisionsRequested = mktgTasks.filter(t => t.status === 'REVISION_REQUIRED').length;
            const completedTasks = mktgTasks.filter(t => ['APPROVED', 'DONE', 'COMPLETED'].includes(t.status)).length;

            const now = new Date();
            const overdueTasks = mktgTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && !['APPROVED', 'DONE', 'COMPLETED'].includes(t.status)).length;

            return res.json({
                userRole,
                totalProjects: mktgProjects.length,
                totalTasks: mktgTasks.length,
                designsPending,
                awaitingApproval,
                revisionsRequested,
                completedTasks,
                overdueTasks,
                mktgTeamCount: mktgTeam.length,
                todayAttendanceCount: mktgAttendance.length,
                todayAttendance: mktgAttendance.map(att => ({
                    id: att._id.toString(),
                    userName: att.userId?.name || 'Marketer',
                    userRole: att.userId?.role || 'EMPLOYEE',
                    department: att.userId?.department || 'Marketing',
                    checkIn: att.checkIn,
                    checkOut: att.checkOut,
                    status: att.status,
                })),
                activeUsersCount: activeUsersList.filter(u => mktgDeptRegex.test(u.department)).length,
                activeUsers: activeUsersList.filter(u => mktgDeptRegex.test(u.department)).map(formatUser),
            });
        }

        // 5. HR Dashboard Metrics (SRS Page 29: Total Employees, Present Today, Absent, Late, On Leave, New Applicants, Interviews, Interns, Payroll Pending)
        if (userRole === 'HR') {
            const [
                totalEmployees,
                todayAttendanceList,
                pendingLeaves,
                candidates,
                internsCount,
                payrollCount
            ] = await Promise.all([
                User.countDocuments({ role: { $ne: 'CANDIDATE' } }),
                Attendance.find({ date: todayStr }).populate('userId', 'name email role department').lean(),
                Leave.countDocuments({ status: 'PENDING' }),
                Candidate.find({}).lean(),
                User.countDocuments({ role: 'INTERN' }),
                Payroll.countDocuments()
            ]);

            const presentToday = todayAttendanceList.length;
            const absentToday = Math.max(0, totalEmployees - presentToday);
            const interviewsCount = candidates.filter(c => c.status === 'INTERVIEW').length;
            const activeApplicants = candidates.filter(c => !['HIRED', 'REJECTED'].includes(c.status)).length;

            return res.json({
                userRole,
                totalEmployees,
                presentToday,
                absentToday,
                pendingLeaves,
                totalCandidates: candidates.length,
                activeApplicants,
                interviewsCount,
                internsCount,
                payrollRecords: payrollCount,
                todayAttendanceCount: todayAttendanceList.length,
                todayAttendance: todayAttendanceList.map(att => ({
                    id: att._id.toString(),
                    userName: att.userId?.name || 'Staff Member',
                    userRole: att.userId?.role || 'EMPLOYEE',
                    department: att.userId?.department || 'General',
                    checkIn: att.checkIn,
                    checkOut: att.checkOut,
                    status: att.status,
                })),
                activeUsersCount: activeUsersList.length,
                activeUsers: activeUsersList.map(formatUser),
            });
        }

        // 6. MANAGER Dashboard Metrics (Department level visibility)
        if (userRole === 'MANAGER') {
            const [
                deptMembers,
                deptTasks,
                deptProjects,
                deptLeaves,
                todayAttendanceList
            ] = await Promise.all([
                User.find({ department: userDept }).lean(),
                Task.find({ department: userDept }).populate('assignedTo', 'name email role department').lean(),
                Project.find({ department: userDept }).lean(),
                Leave.find({}).populate('userId', 'name email department').lean(),
                Attendance.find({ date: todayStr }).populate('userId', 'name email role department').lean()
            ]);

            const teamLeaves = deptLeaves.filter(l => l.userId?.department === userDept && l.status === 'PENDING');
            const teamAttendance = todayAttendanceList.filter(att => att.userId?.department === userDept);
            const pendingTasks = deptTasks.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length;
            const reviewTasks = deptTasks.filter(t => ['SUBMITTED', 'UNDER_REVIEW', 'REVIEW'].includes(t.status)).length;

            return res.json({
                userRole,
                department: userDept,
                teamMembersCount: deptMembers.length,
                totalTasks: deptTasks.length,
                pendingTasks,
                reviewTasks,
                totalProjects: deptProjects.length,
                pendingLeaves: teamLeaves.length,
                todayAttendanceCount: teamAttendance.length,
                todayAttendance: teamAttendance.map(att => ({
                    id: att._id.toString(),
                    userName: att.userId?.name || 'Team Member',
                    userRole: att.userId?.role || 'EMPLOYEE',
                    department: att.userId?.department || userDept,
                    checkIn: att.checkIn,
                    checkOut: att.checkOut,
                    status: att.status,
                })),
                activeUsersCount: activeUsersList.filter(u => u.department === userDept).length,
                activeUsers: activeUsersList.filter(u => u.department === userDept).map(formatUser),
            });
        }

        // 7. SUPER_ADMIN & CEO Dashboard Metrics (Full Organization Visibility - SRS Page 28 & 62)
        const [
            totalUsers,
            totalAttendance,
            totalLeaves,
            totalTasks,
            totalPayroll,
            totalCandidates,
            totalProjects,
            totalDepartments,
            todayAttendanceList,
            candidatesList,
            allTasksList,
            internsCount
        ] = await Promise.all([
            User.countDocuments(),
            Attendance.countDocuments(),
            Leave.countDocuments({ status: 'PENDING' }),
            Task.countDocuments(),
            Payroll.countDocuments(),
            Candidate.countDocuments(),
            Project.countDocuments(),
            Department.countDocuments(),
            Attendance.find({ date: todayStr }).populate('userId', 'name email role department').lean(),
            Candidate.find({}).lean(),
            Task.find({}).lean(),
            User.countDocuments({ role: 'INTERN' })
        ]);

        const presentToday = todayAttendanceList.length;
        const totalEmployeesCount = await User.countDocuments({ role: { $ne: 'CANDIDATE' } });
        const absentToday = Math.max(0, totalEmployeesCount - presentToday);
        const interviewsScheduled = candidatesList.filter(c => c.status === 'INTERVIEW').length;

        const now = new Date();
        const pendingTasks = allTasksList.filter(t => !['APPROVED', 'DONE', 'COMPLETED'].includes(t.status)).length;
        const overdueTasks = allTasksList.filter(t => t.dueDate && new Date(t.dueDate) < now && !['APPROVED', 'DONE', 'COMPLETED'].includes(t.status)).length;

        return res.json({
            userRole,
            totalUsers,
            totalEmployees: totalEmployeesCount,
            totalAttendance,
            presentToday,
            absentToday,
            internsCount,
            totalLeaves,
            totalTasks,
            pendingTasks,
            overdueTasks,
            totalPayroll,
            totalCandidates,
            interviewsScheduled,
            totalProjects,
            totalDepartments,
            activeUsersCount: activeUsersList.length,
            activeUsers: activeUsersList.map(formatUser),
            todayAttendanceCount: todayAttendanceList.length,
            todayAttendance: todayAttendanceList.map(att => ({
                id: att._id.toString(),
                userName: att.userId?.name || 'Staff Member',
                userRole: att.userId?.role || 'EMPLOYEE',
                department: att.userId?.department || 'General',
                checkIn: att.checkIn,
                checkOut: att.checkOut,
                status: att.status,
            })),
        });
    } catch (err) {
        console.error('Mongo getDashboardSummary error:', err);
        return res.status(500).json({ message: 'Error retrieving dashboard summary.' });
    }
};

// 2. Users Directory (Scoped by Role & Department)
const getUsers = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting. Please refresh in a moment.' });
        }

        const userRole = req.user?.role;
        const userDept = req.user?.department;

        let query = {};
        if (userRole === 'CTO') {
            query = { department: new RegExp(TECH_DEPTS.join('|'), 'i') };
        } else if (userRole === 'CMO') {
            query = { department: new RegExp(MKTG_DEPTS.join('|'), 'i') };
        } else if (userRole === 'MANAGER') {
            query = { department: userDept };
        }

        const users = await User.find(query).sort({ createdAt: -1 }).lean();
        return res.json(users.map(formatUser));
    } catch (err) {
        console.error('Mongo getUsers error:', err);
        return res.status(500).json({ message: 'Failed to fetch users.' });
    }
};

// Create Internal User (Super Admin, CEO & HR)
const createInternalUser = async (req, res) => {
    try {
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
        } else if (!['SUPER_ADMIN', 'CEO'].includes(creatorRole)) {
            return res.status(403).json({ message: 'Only Super Admin, CEO and HR can create internal accounts.' });
        }

        // Enforce password requirements
        const pwValidation = validatePassword(password);
        if (!pwValidation.isValid) {
            return res.status(400).json({ message: pwValidation.message });
        }

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database connection unavailable. Please check connection.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: normalizedEmail });

        if (existing) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            name: name.trim(),
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
        });

        return res.status(201).json({
            message: `Internal user ${name} (${role}) created successfully.`,
            user: formatUser(user),
        });
    } catch (err) {
        console.error('Mongo createInternalUser error:', err);
        return res.status(500).json({ message: 'Failed to create internal user account.' });
    }
};

// Update user role or status (for Super Admin, CEO, HR)
const updateUser = async (req, res) => {
    try {
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

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID or database disconnected.' });
        }

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
        if (!updated) return res.status(404).json({ message: 'User not found' });
        return res.json(formatUser(updated));
    } catch (err) {
        console.error('Mongo updateUser error:', err);
        return res.status(500).json({ message: 'Failed to update user profile.' });
    }
};

// Offboard / Delete User (Restricted to Super Admin & CEO)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const requesterRole = req.user?.role;

        if (!['SUPER_ADMIN', 'CEO'].includes(requesterRole)) {
            return res.status(403).json({ message: 'Only Super Admin or CEO can remove/offboard users from system.' });
        }

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID or database disconnected.' });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Prevent deleting root super admin
        if (targetUser.role === 'SUPER_ADMIN' && requesterRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Cannot offboard Super Admin.' });
        }

        await User.findByIdAndDelete(id);
        return res.json({ message: `User ${targetUser.name} offboarded successfully.` });
    } catch (err) {
        console.error('Mongo deleteUser error:', err);
        return res.status(500).json({ message: 'Failed to delete user.' });
    }
};

// Profile
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user or database disconnected.' });
        }
        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ message: 'User profile not found.' });
        return res.json(formatUser(user));
    } catch (err) {
        console.error('Mongo getProfile error:', err);
        return res.status(500).json({ message: 'Failed to retrieve profile.' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, profilePicture, password } = req.body;

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user or database disconnected.' });
        }

        const updateData = {};
        if (name) updateData.name = name.trim();
        if (phone !== undefined) updateData.phone = phone.trim();
        if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

        if (password) {
            const pwValidation = validatePassword(password);
            if (!pwValidation.isValid) {
                return res.status(400).json({ message: pwValidation.message });
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updated = await User.findByIdAndUpdate(userId, updateData, { new: true });
        return res.json({ message: 'Profile updated successfully.', user: formatUser(updated) });
    } catch (err) {
        console.error('Mongo updateProfile error:', err);
        return res.status(500).json({ message: 'Failed to update profile.' });
    }
};

// Departments
const getDepartments = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }
        const departments = await Department.find({}).sort({ createdAt: -1 }).lean();
        return res.json(departments.map(d => ({ ...d, id: d._id ? d._id.toString() : d.id })));
    } catch (err) {
        console.error('Mongo getDepartments error:', err);
        return res.status(500).json({ message: 'Failed to fetch departments.' });
    }
};

const createDepartment = async (req, res) => {
    try {
        const { name, description, headId } = req.body;
        if (!name) return res.status(400).json({ message: 'Department name is required.' });

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

        const department = await Department.create({
            name: name.trim(),
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
        console.error('Mongo createDepartment error:', err);
        return res.status(500).json({ message: 'Failed to create department.' });
    }
};

// 3. Attendance (Scoped by Role)
const getAttendance = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }

        const userRole = req.user?.role;
        const userId = req.user?.id;
        const userDept = req.user?.department;

        let query = {};
        // Employee & Intern only see their own attendance
        if (['EMPLOYEE', 'INTERN'].includes(userRole)) {
            query = { userId };
        }

        const rows = await Attendance.find(query)
            .populate('userId', 'name email role department profilePicture')
            .sort({ date: -1, createdAt: -1 })
            .lean();

        // Scope attendance by department for managers / CTO / CMO
        const filteredRows = rows.filter(row => {
            if (['SUPER_ADMIN', 'CEO', 'HR', 'EMPLOYEE', 'INTERN'].includes(userRole)) return true;
            const dept = row.userId?.department || row.department;
            if (userRole === 'CTO') {
                return TECH_DEPTS.some(d => new RegExp(d, 'i').test(dept));
            }
            if (userRole === 'CMO') {
                return MKTG_DEPTS.some(d => new RegExp(d, 'i').test(dept));
            }
            if (userRole === 'MANAGER') {
                return dept === userDept;
            }
            return true;
        });

        return res.json(filteredRows.map((row) => ({
            ...row,
            id: row._id ? row._id.toString() : (row.id || ''),
            userName: row.userId?.name || row.userName || 'Staff Member',
            userEmail: row.userId?.email || row.userEmail || '',
            userRole: row.userId?.role || row.userRole || 'EMPLOYEE',
            department: row.userId?.department || row.department || 'General',
            userId: row.userId?._id ? row.userId._id.toString() : (row.userId ? row.userId.toString() : ''),
        })));
    } catch (err) {
        console.error('Mongo getAttendance error:', err);
        return res.status(500).json({ message: 'Failed to fetch attendance.' });
    }
};

const checkIn = async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const userId = req.user.id;
        const now = new Date().toISOString();

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

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
        console.error('Mongo checkIn error:', err);
        return res.status(500).json({ message: 'Database error during check-in: ' + err.message });
    }
};

const checkOut = async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const userId = req.user.id;
        const now = new Date().toISOString();

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

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
        console.error('Mongo checkOut error:', err);
        return res.status(500).json({ message: 'Database error during check-out: ' + err.message });
    }
};

// 4. Tasks & Work Assignments (Scoped by Role & Department)
const getTasks = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }

        const userRole = req.user?.role;
        const userId = req.user?.id;
        const userDept = req.user?.department;

        let query = {};
        if (['EMPLOYEE', 'INTERN'].includes(userRole)) {
            query = { assignedTo: userId };
        } else if (userRole === 'CTO') {
            query = { department: new RegExp(TECH_DEPTS.join('|'), 'i') };
        } else if (userRole === 'CMO') {
            query = { department: new RegExp(MKTG_DEPTS.join('|'), 'i') };
        } else if (userRole === 'MANAGER') {
            query = { department: userDept };
        }

        const tasks = await Task.find(query)
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
        console.error('Mongo getTasks error:', err);
        return res.status(500).json({ message: 'Failed to fetch tasks.' });
    }
};

const createTask = async (req, res) => {
    try {
        const { title, description, assignedTo, dueDate, department, priority } = req.body;
        const userRole = req.user?.role;
        const userDept = req.user?.department;

        if (!title) return res.status(400).json({ message: 'Task title is required.' });

        // Scoped department assignment
        let resolvedDept = department || 'General';
        if (userRole === 'CTO' && !department) resolvedDept = 'Engineering';
        if (userRole === 'CMO' && !department) resolvedDept = 'Marketing';
        if (userRole === 'MANAGER' && !department) resolvedDept = userDept || 'General';

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

        const task = await Task.create({
            title: title.trim(),
            description: description || '',
            assignedTo: assignedTo && mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null,
            assignedBy: req.user.id && mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : null,
            department: resolvedDept,
            priority: priority || 'NORMAL',
            dueDate: dueDate || null,
            status: 'ASSIGNED',
        });

        return res.status(201).json({
            id: task._id.toString(),
            title: task.title,
            description: task.description,
            assignedTo: task.assignedTo,
            dueDate: task.dueDate,
            priority: task.priority,
            status: task.status,
            message: 'Task created and assigned successfully.',
        });
    } catch (err) {
        console.error('Mongo createTask error:', err);
        return res.status(500).json({ message: 'Failed to create task.' });
    }
};

// Update task status with Rule 2 enforcement: Employees cannot approve their own work
const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, submissionNotes, proofUrl, feedback } = req.body;
        const userRole = req.user?.role;

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid task ID or database unavailable.' });
        }

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ message: 'Task not found.' });

        // Rule 2 Check: Employees/Interns cannot approve their own work
        if (['EMPLOYEE', 'INTERN'].includes(userRole)) {
            if (['APPROVED', 'DONE', 'COMPLETED'].includes(status)) {
                return res.status(403).json({
                    message: 'Forbidden: Rule 2 Violation — Employees cannot approve their own work. Please submit work for management/lead review.'
                });
            }
        }

        const updateData = {};
        if (status) updateData.status = status;
        if (submissionNotes !== undefined) updateData.submissionNotes = submissionNotes;
        if (proofUrl !== undefined) updateData.proofUrl = proofUrl;
        if (feedback !== undefined) updateData.feedback = feedback;

        if (status === 'REVISION_REQUIRED') {
            updateData.revisionsCount = (task.revisionsCount || 0) + 1;
        }

        const updated = await Task.findByIdAndUpdate(id, updateData, { new: true });
        return res.json({
            id: updated._id.toString(),
            status: updated.status,
            revisionsCount: updated.revisionsCount,
            message: `Task status updated to ${updated.status}.`
        });
    } catch (err) {
        console.error('Mongo updateTaskStatus error:', err);
        return res.status(500).json({ message: 'Failed to update task status.' });
    }
};

// 5. Leaves (Scoped by Role & Rule 1: No self-approval)
const getLeaves = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }

        const userRole = req.user?.role;
        const userId = req.user?.id;
        const userDept = req.user?.department;

        let query = {};
        if (['EMPLOYEE', 'INTERN'].includes(userRole)) {
            query = { userId };
        }

        const rows = await Leave.find(query)
            .populate('userId', 'name email department role')
            .populate('approvedBy', 'name email role')
            .sort({ createdAt: -1 })
            .lean();

        // Scope leaves by department for managers / CTO / CMO
        const filteredRows = rows.filter(row => {
            if (['SUPER_ADMIN', 'CEO', 'HR', 'EMPLOYEE', 'INTERN'].includes(userRole)) return true;
            const dept = row.userId?.department;
            if (userRole === 'CTO') {
                return TECH_DEPTS.some(d => new RegExp(d, 'i').test(dept));
            }
            if (userRole === 'CMO') {
                return MKTG_DEPTS.some(d => new RegExp(d, 'i').test(dept));
            }
            if (userRole === 'MANAGER') {
                return dept === userDept;
            }
            return true;
        });

        return res.json(filteredRows.map((row) => ({
            ...row,
            id: row._id ? row._id.toString() : (row.id || ''),
            userName: row.userId?.name || 'Employee',
            userEmail: row.userId?.email || '',
            department: row.userId?.department || 'General',
            userId: row.userId?._id ? row.userId._id.toString() : (row.userId || ''),
            approverName: row.approvedBy?.name || null,
        })));
    } catch (err) {
        console.error('Mongo getLeaves error:', err);
        return res.status(500).json({ message: 'Failed to fetch leaves.' });
    }
};

const createLeave = async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason } = req.body;
        if (!leaveType || !startDate || !endDate) {
            return res.status(400).json({ message: 'Leave type, start date, and end date are required.' });
        }

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(req.user.id)) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

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
        console.error('Mongo createLeave error:', err);
        return res.status(500).json({ message: 'Failed to submit leave request.' });
    }
};

// Update leave status with Rule 1 enforcement: Employees cannot approve their own leaves
const updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const approverId = req.user.id;

        const validStatuses = ['APPROVED', 'REJECTED', 'PENDING'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid leave status.' });
        }

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid leave ID or database unavailable.' });
        }

        const leave = await Leave.findById(id);
        if (!leave) return res.status(404).json({ message: 'Leave record not found.' });

        // Rule 1 Check: Employees cannot approve their own leave requests
        if (leave.userId && leave.userId.toString() === approverId.toString()) {
            return res.status(403).json({
                message: 'Forbidden: Rule 1 Violation — You cannot approve or reject your own leave request.'
            });
        }

        leave.status = status;
        leave.approvedBy = approverId;
        await leave.save();

        return res.json({ id: leave._id.toString(), status: leave.status, message: `Leave application ${status.toLowerCase()}.` });
    } catch (err) {
        console.error('Mongo updateLeaveStatus error:', err);
        return res.status(500).json({ message: 'Failed to update leave status.' });
    }
};

// 6. Candidates & Recruitment (Scoped by Role)
const getCandidates = async (req, res) => {
    try {
        const isCandidate = req.user?.role === 'CANDIDATE';
        const userRole = req.user?.role;
        const userId = req.user?.id;
        const userEmail = req.user?.email;

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }

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
        } else if (['EMPLOYEE', 'INTERN'].includes(userRole)) {
            return res.status(403).json({ message: 'Forbidden: Candidate records are restricted to talent acquisition and management.' });
        } else if (userRole === 'CTO') {
            query = { positionApplied: new RegExp(TECH_DEPTS.join('|') + '|Developer|Engineer', 'i') };
        } else if (userRole === 'CMO') {
            query = { positionApplied: new RegExp(MKTG_DEPTS.join('|') + '|Marketing|Designer|Writer', 'i') };
        }

        const rows = await Candidate.find(query).sort({ createdAt: -1 }).lean();
        return res.json(rows.map((row) => formatCandidate(row, isCandidate)));
    } catch (err) {
        console.error('Mongo getCandidates error:', err);
        return res.status(500).json({ message: 'Failed to fetch candidate applications.' });
    }
};

const createCandidate = async (req, res) => {
    try {
        const { fullName, email, phone, positionApplied, roleApplied, source, status } = req.body;
        if (!fullName || !email) {
            return res.status(400).json({ message: 'Full name and email are required.' });
        }

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const resolvedPosition = positionApplied || roleApplied || 'General';
        const requesterRole = req.user?.role;
        const isCandidateSubmitter = requesterRole === 'CANDIDATE';

        // Determine linked user and portal access status
        let linkedUserId = null;
        let initialPortalAccess = 'NOT_INVITED';

        if (isCandidateSubmitter) {
            linkedUserId = req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : null;
            initialPortalAccess = 'ACTIVE';
        } else {
            const existingUser = await User.findOne({ email: normalizedEmail }).lean();
            if (existingUser) {
                linkedUserId = existingUser._id;
                initialPortalAccess = 'ACTIVE';
            }
        }

        const candidate = await Candidate.create({
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
        });

        return res.status(201).json({
            id: candidate._id.toString(),
            candidate: formatCandidate(candidate, isCandidateSubmitter),
            message: isCandidateSubmitter
                ? 'Your job application has been submitted successfully!'
                : `Applicant ${fullName} added to recruitment pipeline successfully. (No login password required)`
        });
    } catch (err) {
        console.error('Mongo createCandidate error:', err);
        return res.status(500).json({ message: 'Failed to register candidate.' });
    }
};

const updateCandidateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'HIRED', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid candidate stage status.' });
        }

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid candidate ID or database disconnected.' });
        }

        const updated = await Candidate.findByIdAndUpdate(id, { status }, { new: true });
        if (!updated) return res.status(404).json({ message: 'Candidate not found.' });
        return res.json({ id: updated._id.toString(), status: updated.status, message: `Candidate stage updated to ${status}.` });
    } catch (err) {
        console.error('Mongo updateCandidateStatus error:', err);
        return res.status(500).json({ message: 'Failed to update candidate status.' });
    }
};

// Send Candidate Portal Invitation
const sendCandidateInvitation = async (req, res) => {
    try {
        const { id } = req.params;

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid candidate ID or database disconnected.' });
        }

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate applicant not found.' });
        }

        if (candidate.portalAccess === 'ACTIVE') {
            return res.status(400).json({ message: 'This candidate already has an active portal account.' });
        }

        const invitationToken = crypto.randomBytes(32).toString('hex');
        const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days validity
        const portalAccess = 'INVITATION_SENT';

        candidate.invitationToken = invitationToken;
        candidate.invitationExpiresAt = invitationExpiresAt;
        candidate.portalAccess = portalAccess;
        await candidate.save();

        const invitationLink = `/set-password?token=${invitationToken}&email=${encodeURIComponent(candidate.email)}`;

        return res.json({
            message: `Portal invitation generated for ${candidate.fullName}. The candidate can now set their password.`,
            invitationToken,
            invitationLink,
            portalAccess: 'INVITATION_SENT',
        });
    } catch (err) {
        console.error('Mongo sendCandidateInvitation error:', err);
        return res.status(500).json({ message: 'Failed to generate invitation.' });
    }
};

// Onboard Candidate to Staff Roster (HR, CEO, Super Admin)
const onboardCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const { internalRole, department, phone, temporaryPassword } = req.body;
        const assignerRole = req.user?.role;

        const targetRole = internalRole || 'EMPLOYEE';
        if (['SUPER_ADMIN', 'CEO', 'CTO', 'CMO'].includes(targetRole) && assignerRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Only Super Admin can onboard into executive roles.' });
        }

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid candidate ID or database disconnected.' });
        }

        const candidate = await Candidate.findById(id);
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
        let staffUser = await User.findOne({ email: normalizedEmail });

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
        console.error('Mongo onboardCandidate error:', err);
        return res.status(500).json({ message: 'Failed to onboard candidate.' });
    }
};

// 7. Payroll (Scoped: Employees, Interns, Managers, CTO, CMO see ONLY their own payslips; HR & CEO & Super Admin see all)
const getPayroll = async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id;
        const isExecutiveOrHR = ['SUPER_ADMIN', 'HR', 'CEO'].includes(userRole);

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }

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
        console.error('Mongo getPayroll error:', err);
        return res.status(500).json({ message: 'Failed to fetch payroll records.' });
    }
};

const createPayroll = async (req, res) => {
    try {
        const { userId, month, basicSalary, allowances, deductions } = req.body;
        if (!userId || !month || !basicSalary) {
            return res.status(400).json({ message: 'User, month and basic salary are required.' });
        }

        if (!await isMongoReady() || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

        const netSalary = Number(basicSalary) + Number(allowances || 0) - Number(deductions || 0);
        const disburserId = req.user?.id;

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
        console.error('Mongo createPayroll error:', err);
        return res.status(500).json({ message: 'Failed to disburse payroll.' });
    }
};

// 8. Projects (Scoped by Department & Role)
const getProjects = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }

        const userRole = req.user?.role;
        const userDept = req.user?.department;

        let query = {};
        if (userRole === 'CTO') {
            query = { department: new RegExp(TECH_DEPTS.join('|'), 'i') };
        } else if (userRole === 'CMO') {
            query = { department: new RegExp(MKTG_DEPTS.join('|'), 'i') };
        } else if (userRole === 'MANAGER') {
            query = { department: userDept };
        } else if (['EMPLOYEE', 'INTERN'].includes(userRole)) {
            query = { department: userDept };
        }

        const rows = await Project.find(query)
            .populate('ownerId', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        return res.json(rows.map((row) => ({
            ...row,
            id: row._id ? row._id.toString() : (row.id || ''),
            ownerName: row.ownerId?.name || 'Lead',
        })));
    } catch (err) {
        console.error('Mongo getProjects error:', err);
        return res.status(500).json({ message: 'Failed to fetch projects.' });
    }
};

const createProject = async (req, res) => {
    try {
        const { name, description, ownerId, department, status } = req.body;
        const userRole = req.user?.role;
        const userDept = req.user?.department;

        if (!name) return res.status(400).json({ message: 'Project name is required.' });

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

        let resolvedDept = department || 'General';
        if (userRole === 'CTO' && !department) resolvedDept = 'Engineering';
        if (userRole === 'CMO' && !department) resolvedDept = 'Marketing';
        if (userRole === 'MANAGER' && !department) resolvedDept = userDept || 'General';

        const project = await Project.create({
            name: name.trim(),
            description: description || '',
            ownerId: ownerId && mongoose.Types.ObjectId.isValid(ownerId) ? ownerId : (mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : null),
            department: resolvedDept,
            status: status || 'ACTIVE',
        });

        return res.status(201).json({
            id: project._id.toString(),
            name: project.name,
            description: project.description,
            ownerId: project.ownerId,
            department: project.department,
            status: project.status,
            message: 'Project created successfully.',
        });
    } catch (err) {
        console.error('Mongo createProject error:', err);
        return res.status(500).json({ message: 'Failed to create project.' });
    }
};

// 9. System Settings (Restricted to Super Admin & CEO)
const getSystemSettings = async (req, res) => {
    try {
        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database is connecting.' });
        }
        const settings = await SystemSetting.find({}).lean();
        return res.json(settings.map((row) => ({ ...row, id: row._id ? row._id.toString() : (row.id || '') })));
    } catch (err) {
        console.error('Mongo getSystemSettings error:', err);
        return res.status(500).json({ message: 'Failed to fetch settings.' });
    }
};

const updateSystemSettings = async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || !value) {
            return res.status(400).json({ message: 'Setting key and value are required.' });
        }

        if (!await isMongoReady()) {
            return res.status(503).json({ message: 'Database connection unavailable.' });
        }

        const setting = await SystemSetting.findOneAndUpdate(
            { key },
            { value },
            { upsert: true, new: true }
        );
        return res.json({ id: setting._id.toString(), key: setting.key, value: setting.value, message: 'System setting updated.' });
    } catch (err) {
        console.error('Mongo updateSystemSettings error:', err);
        return res.status(500).json({ message: 'Failed to update system setting.' });
    }
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
