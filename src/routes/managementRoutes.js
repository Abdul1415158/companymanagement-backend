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

// 1. Dashboard (All authenticated roles receive tailored data)
router.get('/dashboard/summary', authMiddleware, getDashboardSummary);

// 2. Users Directory & Account Management (Internal Staff only; CANDIDATE blocked)
router.get('/users', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getUsers);
router.post('/users', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), createInternalUser);
router.patch('/users/:id', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), updateUser);
router.delete('/users/:id', authMiddleware, authorize('SUPER_ADMIN', 'CEO'), deleteUser);

// 3. Profile (All authenticated roles can view/edit their own profile)
router.get('/profile/me', authMiddleware, getProfile);
router.put('/profile/me', authMiddleware, updateProfile);

// 4. Departments (Internal Staff only)
router.get('/departments', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getDepartments);
router.post('/departments', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), createDepartment);

// 5. Attendance (Internal Staff only; CANDIDATE blocked; controller enforces data scope)
router.get('/attendance', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getAttendance);
router.post('/attendance/checkin', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), checkIn);
router.post('/attendance/checkout', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), checkOut);

// 6. Tasks (Internal Staff only; controller enforces scope & Rule 2: no self-approval)
router.get('/tasks', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getTasks);
router.post('/tasks', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER'), createTask);
router.patch('/tasks/:id/status', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), updateTaskStatus);

// 7. Leaves (Internal Staff only; controller enforces scope & Rule 1: no self-approval)
router.get('/leaves', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getLeaves);
router.post('/leaves', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), createLeave);
router.patch('/leaves/:id/status', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER'), updateLeaveStatus);

// 8. Candidates & Recruitment (Candidate views own applications; HR/CEO/Admin manage pipeline)
router.get('/candidates', authMiddleware, getCandidates);
router.post('/candidates', authMiddleware, createCandidate);
router.patch('/candidates/:id/status', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), updateCandidateStatus);
router.post('/candidates/:id/invite', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), sendCandidateInvitation);
router.post('/candidates/:id/onboard', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), onboardCandidate);

// 9. Payroll (Controller scopes: Employees/Interns/Managers/CTO/CMO see ONLY their own; HR/CEO/Admin manage)
router.get('/payroll', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'HR', 'MANAGER', 'EMPLOYEE', 'INTERN'), getPayroll);
router.post('/payroll', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'HR'), createPayroll);

// 10. Projects (Internal Staff only; controller scopes by department/role)
router.get('/projects', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'MANAGER', 'EMPLOYEE', 'INTERN'), getProjects);
router.post('/projects', authMiddleware, authorize('SUPER_ADMIN', 'CEO', 'CTO', 'CMO', 'MANAGER'), createProject);

// 11. System Settings (Restricted to Super Admin & CEO)
router.get('/system-settings', authMiddleware, authorize('SUPER_ADMIN', 'CEO'), getSystemSettings);
router.post('/system-settings', authMiddleware, authorize('SUPER_ADMIN', 'CEO'), updateSystemSettings);

module.exports = router;
