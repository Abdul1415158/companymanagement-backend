const express = require('express');
const {
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
} = require('../controllers/managementController');
const { authMiddleware, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Management system API running' });
});

// Dashboard
router.get('/dashboard/summary', authMiddleware, getDashboardSummary);

// Users Directory & Internal Creation (Restricted to Internal Staff; CANDIDATE cannot access)
router.get('/users', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getUsers);
router.post('/users', authMiddleware, authorize('SUPER_ADMIN', 'HR'), createInternalUser);
router.patch('/users/:id', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), updateUser);
router.delete('/users/:id', authMiddleware, authorize('SUPER_ADMIN'), deleteUser);

// Profile
router.get('/profile/me', authMiddleware, getProfile);
router.put('/profile/me', authMiddleware, updateProfile);

// Departments (Internal Staff only)
router.get('/departments', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getDepartments);
router.post('/departments', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), createDepartment);

// Attendance (Internal Staff only)
router.get('/attendance', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getAttendance);
router.post('/attendance/checkin', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), checkIn);
router.post('/attendance/checkout', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), checkOut);

// Tasks (Internal Staff only)
router.get('/tasks', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getTasks);
router.post('/tasks', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER'), createTask);
router.patch('/tasks/:id/status', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), updateTaskStatus);

// Leaves (Internal Staff only)
router.get('/leaves', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getLeaves);
router.post('/leaves', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), createLeave);
router.patch('/leaves/:id/status', authMiddleware, authorize('SUPER_ADMIN', 'HR', 'CEO', 'MANAGER'), updateLeaveStatus);

// Candidates & Recruitment (Candidates view their applications/apply, HR/Admins manage)
router.get('/candidates', authMiddleware, getCandidates);
router.post('/candidates', authMiddleware, createCandidate);
router.patch('/candidates/:id/status', authMiddleware, authorize('SUPER_ADMIN', 'HR', 'CEO', 'CMO'), updateCandidateStatus);
router.post('/candidates/:id/invite', authMiddleware, authorize('SUPER_ADMIN', 'HR'), sendCandidateInvitation);
router.post('/candidates/:id/onboard', authMiddleware, authorize('SUPER_ADMIN', 'HR'), onboardCandidate);

// Payroll (Internal Staff only: HR/Admin manage & disburse, employees view own payslips)
router.get('/payroll', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getPayroll);
router.post('/payroll', authMiddleware, authorize('SUPER_ADMIN', 'HR'), createPayroll);

// Projects (Internal Staff only)
router.get('/projects', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getProjects);
router.post('/projects', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'MANAGER'), createProject);

// System Settings (Super Admin only)
router.get('/system-settings', authMiddleware, authorize('SUPER_ADMIN'), getSystemSettings);
router.post('/system-settings', authMiddleware, authorize('SUPER_ADMIN'), updateSystemSettings);

module.exports = router;
