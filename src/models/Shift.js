const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        shiftCode: {
            type: String,
            default: () => `SH-${Date.now().toString().slice(-4)}`,
            unique: true,
        },
        startTime: {
            type: String, // e.g. "08:00 PM"
            required: true,
        },
        endTime: {
            type: String, // e.g. "01:30 AM"
            required: true,
        },
        graceMinutes: {
            type: Number,
            default: 10,
        },
        halfDayHours: {
            type: Number,
            default: 4,
        },
        expectedHours: {
            type: Number,
            default: 5.5,
        },
        department: {
            type: String,
            default: 'All',
        },
        isNightShift: {
            type: Boolean,
            default: false,
        },
        description: {
            type: String,
            default: '',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Shift', shiftSchema);
