require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

const app = express();

// --- CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- SESSION CONFIGURATION ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'prestige-sms-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// --- DATABASE CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prestigeSMS';
mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ DB Error:", err));

// --- MODELS ---
const Message = require('./models/Message');
const Contact = require('./models/Contact');
const ActionLog = require('./models/ActionLog');

// --- BUSINESS LINES CONFIGURATION (from .env) ---
const BUSINESS_LINES = [
    { 
        name: 'HU Main', 
        number: process.env.HU_MAIN_NUMBER || '+36204515510',
        messagingProfileId: process.env.HU_MAIN_PROFILE_ID || null
    },
    { 
        name: 'HU Sec', 
        number: process.env.HU_SEC_NUMBER || '+36304733451',
        messagingProfileId: process.env.HU_SEC_PROFILE_ID || null
    },
    { 
        name: 'US Line', 
        number: process.env.US_LINE_NUMBER || '+16692856302',
        messagingProfileId: process.env.US_LINE_PROFILE_ID || null // US number is attached to messaging profile
    }
];

// --- PIN CONFIGURATION ---
const SEND_PIN = process.env.SEND_PIN || '1234'; // Default PIN, change in .env

// --- HELPER FUNCTIONS ---

// Auto-save or update contact
async function saveOrUpdateContact(phone, name = '') {
    try {
        const contact = await Contact.findOneAndUpdate(
            { phone },
            { 
                $set: { lastActive: new Date() },
                $setOnInsert: { name: name || phone }
            },
            { upsert: true, new: true }
        );
        return contact;
    } catch (error) {
        console.error('Error saving contact:', error);
        return null;
    }
}

// Log action to ActionLog collection
async function logAction(action, details, status) {
    try {
        await ActionLog.create({
            action,
            details,
            status
        });
    } catch (error) {
        console.error('Error logging action:', error);
    }
}

// Middleware to check if user is authenticated (PIN verified)
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    return res.status(401).json({ error: 'Authentication required. Please verify PIN.' });
}

// Helper function to determine recommended line based on phone number
function getRecommendedLine(phoneNumber) {
    if (!phoneNumber) return BUSINESS_LINES[0];
    
    // Hungarian numbers start with +36
    if (phoneNumber.startsWith('+36')) {
        // Default to HU Main, but could be either HU line
        return BUSINESS_LINES[0]; // HU Main
    }
    
    // US numbers start with +1
    if (phoneNumber.startsWith('+1')) {
        return BUSINESS_LINES[2]; // US Line
    }
    
    // Default to first line
    return BUSINESS_LINES[0];
}

// --- ROUTES ---

// Login page
app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/');
    }
    res.render('login', { error: null });
});

// Verify PIN and create session
app.post('/login', async (req, res) => {
    const { pin } = req.body;
    
    if (pin === SEND_PIN) {
        req.session.authenticated = true;
        req.session.loginTime = new Date();
        await logAction('LOGIN', 'User authenticated successfully', 'success');
        res.json({ success: true, message: 'Authentication successful' });
    } else {
        await logAction('LOGIN', 'Failed PIN attempt', 'error');
        res.status(401).json({ error: 'Invalid PIN. Access denied.' });
    }
});

// Logout
app.post('/logout', async (req, res) => {
    await logAction('LOGOUT', 'User logged out', 'success');
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.json({ success: true });
    });
});

// Dashboard - Main route (protected)
app.get('/', async (req, res) => {
    // Check authentication
    if (!req.session || !req.session.authenticated) {
        return res.redirect('/login');
    }
    try {
        // Get all contacts sorted by lastActive (most recent first)
        const contacts = await Contact.find().sort({ lastActive: -1 }).limit(100);
        
        // Get selected contact from query or default to first contact
        const selectedPhone = req.query.contact || (contacts.length > 0 ? contacts[0].phone : null);
        
        // Get messages for selected contact
        let messages = [];
        if (selectedPhone) {
            messages = await Message.find({
                $or: [
                    { from: selectedPhone },
                    { to: selectedPhone }
                ]
            }).sort({ timestamp: 1 });
        }
        
        // Get recent action logs
        const logs = await ActionLog.find().sort({ timestamp: -1 }).limit(50);
        
        // Add recommended line to each contact
        const contactsWithLines = contacts.map(contact => {
            const recommendedLine = getRecommendedLine(contact.phone);
            return {
                ...contact.toObject(),
                recommendedLine: recommendedLine.name,
                recommendedLineNumber: recommendedLine.number
            };
        });
        
        res.render('dashboard', {
            contacts: contactsWithLines,
            selectedPhone,
            messages,
            logs,
            businessLines: BUSINESS_LINES,
            getRecommendedLine: getRecommendedLine
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// API: Get messages for a contact
app.get('/api/messages/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const messages = await Message.find({
            $or: [
                { from: phone },
                { to: phone }
            ]
        }).sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// API: Get action logs
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await ActionLog.find().sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Send SMS (Protected with PIN)
app.post('/send', requireAuth, async (req, res) => {
    const { from_number, to_number, message_content } = req.body;
    
    if (!from_number || !to_number || !message_content) {
        await logAction('SEND_SMS', 'Missing required fields', 'error');
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate phone number format
    if (!to_number.match(/^\+[1-9]\d{1,14}$/)) {
        await logAction('SEND_SMS', `Invalid destination number format: ${to_number}`, 'error');
        return res.status(400).json({ 
            error: 'Invalid destination number format. Must include country code (e.g., +923156780274)' 
        });
    }
    
    try {
        // Find the sender line name
        const senderLine = BUSINESS_LINES.find(l => l.number === from_number);
        const senderLineName = senderLine ? senderLine.name : from_number;
        
        // Validate from_number is a valid phone number
        if (!from_number.startsWith('+') || !from_number.match(/^\+[1-9]\d{1,14}$/)) {
            await logAction('SEND_SMS', `Invalid source number format: ${from_number}`, 'error');
            return res.status(400).json({ 
                error: `Invalid source number (${from_number}). Must be a valid phone number in E.164 format (e.g., +36204515510)` 
            });
        }
        
        // Prepare Telnyx API payload
        // IMPORTANT: When a phone number is attached to a messaging profile in Telnyx:
        // - If the profile is configured for "alphanumeric sender IDs only", you'll get an error
        // - The profile must allow phone numbers as sender IDs
        // - Solution: In Telnyx Portal, edit the messaging profile to allow phone number sender IDs
        const telnyxPayload = {
            from: from_number,
            to: to_number,
            text: message_content
        };
        
        // Note: We use the phone number directly in the 'from' field
        // Telnyx will automatically detect and use the messaging profile associated with that number
        // If you get "alphanumeric sender ID" error, the profile needs to be reconfigured in Telnyx Portal
        
        // Call Telnyx API
        const response = await axios.post('https://api.telnyx.com/v2/messages', telnyxPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Get Telnyx message ID for tracking
        const telnyxMessageId = response.data?.data?.id || null;
        
        // Save message to database with pending status
        const savedMessage = await Message.create({
            from: from_number,
            to: to_number,
            text: message_content,
            direction: 'outbound',
            senderLine: senderLineName,
            telnyxId: telnyxMessageId,
            status: 'sent' // Will be updated by webhook
        });
        
        // Update contact
        await saveOrUpdateContact(to_number);
        
        // Log success
        await logAction('SEND_SMS', `Sent SMS from ${senderLineName} (${from_number}) to ${to_number}`, 'success');
        
        res.json({ success: true, message: 'SMS sent successfully' });
    } catch (error) {
        // Enhanced error handling
        let errorMessage = 'Unknown error';
        let errorDetails = '';
        
        if (error.response) {
            // Telnyx API error response
            const telnyxError = error.response.data;
            console.error('Telnyx API Error:', JSON.stringify(telnyxError, null, 2));
            
            if (telnyxError.errors && telnyxError.errors.length > 0) {
                const firstError = telnyxError.errors[0];
                errorMessage = firstError.detail || firstError.title || 'API Error';
                errorDetails = `Telnyx API Error: ${errorMessage}`;
                
                // Provide helpful messages for common errors
                if (errorMessage.includes('Invalid source number') || errorMessage.includes('source number')) {
                    errorMessage = `Invalid source number (${from_number}). Please verify in Telnyx Portal:\n` +
                        `1. Go to Numbers section and verify the number is active\n` +
                        `2. Check that the number is enabled for SMS messaging\n` +
                        `3. Ensure the number is not attached to a messaging profile that only supports alphanumeric\n` +
                        `4. If attached to a profile, ensure the profile allows phone number as sender ID`;
                } else if (errorMessage.includes('alphanumeric sender ID') || errorMessage.includes('messaging profile')) {
                    errorMessage = `Messaging Profile Error for ${from_number}:\n` +
                        `The number is attached to a messaging profile that's configured for alphanumeric sender IDs only.\n\n` +
                        `SOLUTION: In Telnyx Portal:\n` +
                        `1. Go to Messaging > Messaging Profiles\n` +
                        `2. Find the profile attached to ${from_number}\n` +
                        `3. Edit the profile and ensure it allows phone numbers as sender IDs\n` +
                        `4. OR remove the number from the messaging profile\n` +
                        `5. OR create a new profile that supports phone numbers`;
                } else if (errorMessage.includes('destination') || errorMessage.includes('to')) {
                    errorMessage = `Invalid destination number (${to_number}). Please check the number format.`;
                } else if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
                    errorMessage = 'Insufficient balance in Telnyx account. Please add credits.';
                } else if (errorMessage.includes('rate limit') || errorMessage.includes('throttle')) {
                    errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
                }
            } else {
                errorMessage = telnyxError.message || 'Telnyx API error';
                errorDetails = `Telnyx API Error: ${errorMessage}`;
            }
        } else if (error.request) {
            errorMessage = 'No response from Telnyx API. Please check your internet connection and API key.';
            errorDetails = `Network error: ${error.message}`;
        } else {
            errorMessage = error.message || 'Unknown error occurred';
            errorDetails = `Error: ${errorMessage}`;
        }
        
        const fullErrorDetails = `Failed to send SMS from ${from_number} to ${to_number}: ${errorDetails}`;
        
        // Log error with full details
        await logAction('SEND_SMS', fullErrorDetails, 'error');
        
        console.error('Sending Failed - Full Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            from: from_number,
            to: to_number
        });
        
        res.status(error.response?.status || 500).json({ 
            error: errorMessage,
            details: errorDetails,
            from: from_number,
            to: to_number
        });
    }
});

// Webhook: Receive inbound SMS and delivery status updates
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body.data;
        const eventType = data?.event_type;
        
        // Handle inbound messages
        if (eventType === 'message.received') {
            const payload = data.payload;
            const fromNumber = payload.from?.phone_number;
            const toNumber = payload.to?.[0]?.phone_number;
            const text = payload.text || '';
            
            if (!fromNumber || !toNumber) {
                await logAction('WEBHOOK', 'Invalid webhook payload - missing phone numbers', 'error');
                return res.status(400).send('Invalid payload');
            }
            
            // Find which line received the message
            const receivingLine = BUSINESS_LINES.find(l => l.number === toNumber);
            const lineName = receivingLine ? receivingLine.name : 'Unknown Line';
            
            // Save message
            await Message.create({
                from: fromNumber,
                to: toNumber,
                text: text,
                direction: 'inbound',
                senderLine: lineName,
                status: 'delivered' // Inbound messages are always delivered
            });
            
            // Auto-save contact
            await saveOrUpdateContact(fromNumber);
            
            // Log success
            await logAction('WEBHOOK', `Received SMS from ${fromNumber} on ${lineName}`, 'success');
        }
        // Handle delivery status updates for outbound messages
        else if (eventType === 'message.finalized' || eventType === 'message.sent' || eventType === 'message.failed') {
            const payload = data.payload;
            const telnyxId = payload.id;
            
            if (!telnyxId) {
                return res.status(200).send('OK'); // Not an error, just no ID
            }
            
            let status = 'sent';
            if (eventType === 'message.finalized') {
                status = 'delivered';
            } else if (eventType === 'message.failed') {
                status = 'failed';
            } else if (eventType === 'message.sent') {
                status = 'sent';
            }
            
            // Update message status by Telnyx ID
            const updated = await Message.findOneAndUpdate(
                { telnyxId: telnyxId },
                { 
                    status: status,
                    statusUpdated: new Date()
                },
                { new: true }
            );
            
            if (updated) {
                await logAction('WEBHOOK', `Message ${telnyxId} status updated to: ${status}`, 'success');
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        await logAction('WEBHOOK', `Webhook processing error: ${error.message}`, 'error');
        res.status(500).send('Error processing webhook');
    }
});

// Save/Update contact manually (Protected)
app.post('/api/contact', requireAuth, async (req, res) => {
    try {
        const { phone, name } = req.body;
        
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        
        // Validate phone number format (basic validation)
        if (!phone.match(/^\+[1-9]\d{1,14}$/)) {
            return res.status(400).json({ error: 'Invalid phone number format. Must include country code (e.g., +36201234567)' });
        }
        
        const contact = await Contact.findOneAndUpdate(
            { phone },
            { name: name || phone, lastActive: new Date() },
            { upsert: true, new: true }
        );
        
        await logAction('SAVE_CONTACT', `Saved/Updated contact: ${phone} (${name || 'No name'})`, 'success');
        res.json(contact);
    } catch (error) {
        console.error('Error saving contact:', error);
        await logAction('SAVE_CONTACT', `Error saving contact: ${error.message}`, 'error');
        res.status(500).json({ error: 'Failed to save contact' });
    }
});

// Delete contact (Protected)
app.delete('/api/contact/:phone', requireAuth, async (req, res) => {
    try {
        const phone = decodeURIComponent(req.params.phone);
        
        const contact = await Contact.findOneAndDelete({ phone });
        
        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        // Optionally delete all messages with this contact
        await Message.deleteMany({
            $or: [
                { from: phone },
                { to: phone }
            ]
        });
        
        await logAction('DELETE_CONTACT', `Deleted contact: ${phone} and all associated messages`, 'success');
        res.json({ success: true, message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Error deleting contact:', error);
        await logAction('DELETE_CONTACT', `Error deleting contact: ${error.message}`, 'error');
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Prestige SMS Server running on http://localhost:${PORT}`);
});
