const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    text: { type: String, required: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    senderLine: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    telnyxId: { type: String }, // Telnyx message ID for tracking
    status: { 
        type: String, 
        enum: ['sent', 'delivered', 'failed', 'pending'],
        default: 'pending'
    },
    statusUpdated: { type: Date }
});

MessageSchema.index({ from: 1, to: 1, timestamp: -1 });
MessageSchema.index({ timestamp: -1 });
MessageSchema.index({ telnyxId: 1 });

module.exports = mongoose.model('Message', MessageSchema);

