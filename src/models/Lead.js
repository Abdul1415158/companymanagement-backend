const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            default: '',
            lowercase: true,
            trim: true,
        },
        company: {
            type: String,
            default: '',
        },
        source: {
            type: String,
            default: 'Website',
        },
        status: {
            type: String,
            enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED'],
            default: 'NEW',
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
