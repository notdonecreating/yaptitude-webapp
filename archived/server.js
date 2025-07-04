const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import services
const AIService = require('./src/services/aiService');
const ProgressService = require('./src/services/progressService');
const SessionService = require('./src/services/sessionService');
const SpeechService = require('./src/services/speechService');

// Import routes
const lessonsRoutes = require('./routes/lessons');
const scenariosRoutes = require('./routes/scenarios');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const aiService = new AIService();
const progressService = new ProgressService();
const sessionService = new SessionService();
const speechService = new SpeechService();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for audio uploads
app.use(express.static('public'));

// Session middleware - attach session info to requests
app.use(async (req, res, next) => {
    try {
        // Get client info
        const clientIP = sessionService.getClientIP(req);
        const deviceFingerprint = sessionService.generateDeviceFingerprint(req);
        
        // Get or create session
        const session = await progressService.getOrCreateSession(clientIP, deviceFingerprint);
        
        // Attach services and session to request
        req.sessionId = session.sessionId;
        req.userSession = session;
        req.aiService = aiService;
        req.progressService = progressService;
        req.sessionService = sessionService;
        req.speechService = speechService;
        
        next();
    } catch (error) {
        console.error('Session middleware error:', error);
        next(); // Continue even if session creation fails
    }
});

// API Routes
app.use('/api/lessons', lessonsRoutes);
app.use('/api/scenarios', scenariosRoutes);

// Progress and user data routes
app.get('/api/progress', async (req, res) => {
    try {
        const progress = await req.progressService.getUserProgress(req.sessionId);
        res.json(progress);
    } catch (error) {
        console.error('Error getting progress:', error);
        res.status(500).json({ error: 'Failed to get progress' });
    }
});

app.post('/api/preferences', async (req, res) => {
    try {
        const { preferences } = req.body;
        const success = await req.progressService.updateUserPreferences(req.sessionId, preferences);
        res.json({ success });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// Speech routes (for future cloud integration)
app.get('/api/speech/voices', (req, res) => {
    try {
        const voices = req.speechService.getAvailableVoices();
        res.json(voices);
    } catch (error) {
        console.error('Error getting voices:', error);
        res.status(500).json({ error: 'Failed to get voices' });
    }
});

app.post('/api/speech/tts', async (req, res) => {
    try {
        const { text, characterId } = req.body;
        const result = await req.speechService.textToSpeech(text, characterId);
        res.json(result);
    } catch (error) {
        console.error('Error with TTS:', error);
        res.status(500).json({ error: 'Text-to-speech failed' });
    }
});

// Health check and stats
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        services: {
            ai: !!process.env.DEEPSEEK_API_KEY,
            progress: true,
            sessions: true,
            speech: true
        },
        stats: {
            sessions: sessionService.getServiceStats(),
            speech: speechService.getServiceStats()
        }
    });
});

// Test endpoint (for development)
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Yaptitude API is working!',
        session: req.sessionId,
        timestamp: new Date()
    });
});

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/lessons', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lessons.html'));
});

app.get('/scenarios', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scenarios.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    sessionService.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    sessionService.destroy();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🦋 Yaptitude server running on http://localhost:${PORT}`);
    console.log(`✅ Services initialized`);
    console.log(`🤖 AI Service: ${process.env.DEEPSEEK_API_KEY ? 'Connected' : 'No API key'}`);
    console.log(`📊 Progress tracking: Enabled`);
    console.log(`🎤 Speech services: Ready`);
});