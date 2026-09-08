const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        date: {
            type: String,
            required: true,
        },
        checkIn: {
            type: String,
            default: '',
        },
        checkOut: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'EARLY_CHECKOUT'],
            default: 'PRESENT',
        },
        shift: {
            type: String,
            default: 'Standard (9:00 AM - 6:00 PM)',
        },
        delayMinutes: {
            type: Number,
            default: 0,
        },
        workingHours: {
            type: Number,
            default: 0,
        },
        overtimeHours: {
            type: Number,
            default: 0,
        },
        notes: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
