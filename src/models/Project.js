const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        ownerId: {
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
            enum: ['ACTIVE', 'ON_HOLD', 'COMPLETED'],
            default: 'ACTIVE',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
