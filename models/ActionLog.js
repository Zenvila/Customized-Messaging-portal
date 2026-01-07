const mongoose = require('mongoose');

const ActionLogSchema = new mongoose.Schema({
    action: { type: String, required: true },
    details: { type: String, required: true },
    status: { type: String, enum: ['success', 'error'], required: true },
    timestamp: { type: Date, default: Date.now }
});

ActionLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ActionLog', ActionLogSchema);

