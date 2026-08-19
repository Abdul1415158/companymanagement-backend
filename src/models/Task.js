const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        department: {
            type: String,
            default: 'General',
        },
        status: {
            type: String,
            enum: ['OPEN', 'IN_PROGRESS', 'REVIEW', 'DONE'],
            default: 'OPEN',
        },
        dueDate: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
