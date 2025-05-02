const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

// Get environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Validate required environment variables
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Missing required environment variables: TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID');
    process.exit(1);
}

app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Rate limiting middleware
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;

app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, []);
    }
    
    const requests = rateLimit.get(ip).filter(time => now - time < RATE_LIMIT_WINDOW);
    requests.push(now);
    rateLimit.set(ip, requests);
    
    if (requests.length > MAX_REQUESTS) {
        return res.status(429).json({ 
            success: false, 
            error: 'Too many requests. Please try again later.' 
        });
    }
    
    next();
});

app.post('/api/report-issue', async (req, res) => {
    try {
        const { flagCode, flagName, issueType, issueDescription, userEmail } = req.body;

        // Input validation
        if (!flagCode || !flagName || !issueType || !issueDescription) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        // Sanitize inputs
        const sanitizedMessage = `
🚩 New Flag Issue Report

Flag: ${flagName.replace(/[<>]/g, '')} (${flagCode.replace(/[<>]/g, '')})
Issue Type: ${issueType.replace(/[<>]/g, '')}
Description: ${issueDescription.replace(/[<>]/g, '')}
${userEmail ? `Contact Email: ${userEmail.replace(/[<>]/g, '')}` : ''}
        `.trim();

        // Send to Telegram
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: sanitizedMessage,
            parse_mode: 'HTML'
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending report:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send report' 
        });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the site`);
}); 