const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const sessionManager = require('./sessionManager');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Supabase (Global Admin Client)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log(`Initializing Bot Server...`);
console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Using Service Key: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

// Logger Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Initialize Session Manager
sessionManager.initialize(supabaseUrl, supabaseKey);

// Routes
app.post('/sessions/start', async (req, res) => {
    console.log('Received start session request:', req.body);
    const { establishmentId } = req.body;
    if (!establishmentId) return res.status(400).json({ error: 'Missing establishmentId' });

    try {
        await sessionManager.startSession(establishmentId);
        res.json({ success: true, message: 'Session initialization started' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

app.post('/sessions/stop', async (req, res) => {
    const { establishmentId } = req.body;
    if (!establishmentId) return res.status(400).json({ error: 'Missing establishmentId' });

    try {
        await sessionManager.stopSession(establishmentId);
        res.json({ success: true, message: 'Session stopped' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to stop session' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', active_sessions: sessionManager.sessions.size });
});

app.listen(port, () => {
    console.log(`Bot Server listening at http://localhost:${port}`);
});
