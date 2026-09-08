const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        userName: {
            type: String,
            default: 'System',
        },
        userRole: {
            type: String,
            default: 'SYSTEM',
        },
        action: {
            type: String,
            required: true,
            trim: true,
        },
        module: {
            type: String,
            enum: ['ATTENDANCE', 'USERS', 'PAYROLL', 'LEAVES', 'TASKS', 'REPORTS', 'ASSETS', 'POSTS', 'INTERVIEWS', 'SYSTEM'],
            required: true,
        },
        recordId: {
            type: String,
            default: '',
        },
        previousValue: {
            type: String,
            default: '',
        },
        newValue: {
            type: String,
            default: '',
        },
        details: {
            type: String,
            required: true,
        },
        ipAddress: {
            type: String,
            default: '127.0.0.1',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
