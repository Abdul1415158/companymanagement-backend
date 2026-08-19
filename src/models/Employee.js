const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        employeeId: {
            type: String,
            required: true,
            unique: true,
        },
        designation: {
            type: String,
            default: 'Employee',
        },
        department: {
            type: String,
            default: 'General',
        },
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);
