const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    lastActive: { type: Date, default: Date.now, index: -1 }
});

// Remove duplicate index - phone already has unique: true which creates an index
// ContactSchema.index({ phone: 1 }); // Removed - duplicate

module.exports = mongoose.model('Contact', ContactSchema);

