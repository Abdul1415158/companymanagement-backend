// In-memory database fallback when MongoDB is not available
let users = [
    {
        _id: '1',
        id: '1',
        name: 'Super Admin',
        email: 'admin@company.com',
        password: '$2a$10$0I7Ynm.K2Rf4O.jLqQcPrOI7Ynm.K2Rf4O.jLqQcPrOI7Ynm.K2Rf4', // admin123
        role: 'SUPER_ADMIN',
        department: 'Administration',
        phone: '+92-300-0000000',
        profilePicture: '',
        status: 'ACTIVE',
        isOnline: false,
        lastLogin: null,
        lastActive: null,
        createdAt: new Date(),
    },
    {
        _id: '2',
        id: '2',
        name: 'Sara Khan (HR Manager)',
        email: 'hr@company.com',
        password: '$2a$10$0I7Ynm.K2Rf4O.jLqQcPrOI7Ynm.K2Rf4O.jLqQcPrOI7Ynm.K2Rf4',
        role: 'HR',
        department: 'Human Resources',
        phone: '+92-301-1112233',
        profilePicture: '',
        status: 'ACTIVE',
        isOnline: false,
        lastLogin: null,
        lastActive: null,
        createdAt: new Date(),
    },
    {
        _id: '3',
        id: '3',
        name: 'Ali Raza (Senior Engineer)',
        email: 'ali@company.com',
        password: '$2a$10$0I7Ynm.K2Rf4O.jLqQcPrOI7Ynm.K2Rf4O.jLqQcPrOI7Ynm.K2Rf4',
        role: 'EMPLOYEE',
        department: 'Engineering',
        phone: '+92-302-3334455',
        profilePicture: '',
        status: 'ACTIVE',
        isOnline: false,
        lastLogin: null,
        lastActive: null,
        createdAt: new Date(),
    },
];

let attendance = [
    {
        _id: 'att-1',
        id: 'att-1',
        userId: '1',
        userName: 'Super Admin',
        userEmail: 'admin@company.com',
        userRole: 'SUPER_ADMIN',
        department: 'Administration',
        date: new Date().toISOString().slice(0, 10),
        checkIn: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        checkOut: '',
        status: 'PRESENT',
        notes: '',
        createdAt: new Date(),
    }
];

let tasks = [
    {
        _id: 'task-1',
        id: 'task-1',
        title: 'Complete System Architecture Review',
        description: 'Review modules, API endpoints and security restrictions.',
        assignedTo: '3',
        assignedUser: 'Ali Raza (Senior Engineer)',
        assignedBy: '1',
        department: 'Engineering',
        status: 'IN_PROGRESS',
        dueDate: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
        createdAt: new Date(),
    }
];

let leaves = [
    {
        _id: 'leave-1',
        id: 'leave-1',
        userId: '3',
        userName: 'Ali Raza (Senior Engineer)',
        userEmail: 'ali@company.com',
        department: 'Engineering',
        leaveType: 'CASUAL',
        startDate: new Date(Date.now() + 2 * 86400 * 1000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString().slice(0, 10),
        reason: 'Family event',
        status: 'PENDING',
        createdAt: new Date(),
    }
];

let candidates = [
    {
        _id: 'cand-1',
        id: 'cand-1',
        userId: null,
        fullName: 'Hamza Tariq',
        email: 'hamza@example.com',
        phone: '+92-333-7778899',
        positionApplied: 'Frontend Developer',
        roleApplied: 'Frontend Developer',
        source: 'LinkedIn',
        status: 'SHORTLISTED',
        portalAccess: 'NOT_INVITED',
        invitationToken: null,
        invitationExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    }
];

let payroll = [
    {
        _id: 'pay-1',
        id: 'pay-1',
        userId: '3',
        userName: 'Ali Raza (Senior Engineer)',
        userEmail: 'ali@company.com',
        month: new Date().toISOString().slice(0, 7),
        basicSalary: 150000,
        allowances: 15000,
        deductions: 5000,
        netSalary: 160000,
        status: 'PAID',
        disbursedBy: '2',
        disbursedByName: 'Sara Khan (HR Manager)',
        disbursedByRole: 'HR',
        createdAt: new Date(),
    }
];

let projects = [
    {
        _id: 'proj-1',
        id: 'proj-1',
        name: 'Enterprise ERP System',
        description: 'Core company management and reporting platform.',
        ownerId: '1',
        department: 'Engineering',
        status: 'ACTIVE',
        createdAt: new Date(),
    }
];

let departments = [
    {
        _id: 'dept-1',
        id: 'dept-1',
        name: 'Administration',
        description: 'Executive and operations management',
        headId: '1',
    },
    {
        _id: 'dept-2',
        id: 'dept-2',
        name: 'Engineering',
        description: 'Software development, DevOps and QA',
        headId: '3',
    },
    {
        _id: 'dept-3',
        id: 'dept-3',
        name: 'Human Resources',
        description: 'Recruitment, payroll and talent operations',
        headId: '2',
    }
];

let systemSettings = [
    {
        _id: 'set-1',
        key: 'company_name',
        value: 'Management System',
    }
];

module.exports = {
    users,
    attendance,
    tasks,
    leaves,
    candidates,
    payroll,
    projects,
    departments,
    systemSettings,
};

