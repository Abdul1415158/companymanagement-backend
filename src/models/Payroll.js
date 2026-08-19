const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        month: {
            type: String,
            required: true,
        },
        basicSalary: {
            type: Number,
            required: true,
        },
        allowances: {
            type: Number,
            default: 0,
        },
        deductions: {
            type: Number,
            default: 0,
        },
        netSalary: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['PAID', 'PENDING'],
            default: 'PAID',
        },
        disbursedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payroll', payrollSchema);
