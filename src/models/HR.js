const mongoose = require('mongoose');

const hrSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        department: {
            type: String,
            default: 'Human Resources',
        },
        recruitment: {
            type: [String],
            default: [],
        },
        attendancePolicy: {
            type: String,
            default: 'Standard office policy',
        },
        employeeRecordsCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('HR', hrSchema);
