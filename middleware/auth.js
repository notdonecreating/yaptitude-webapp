const ProgressService = require('../src/services/progressService');
const SessionService = require('../src/services/sessionService');

const progressService = new ProgressService();
const sessionService = new SessionService();

/**
 * Session middleware - identifies users and creates/loads their sessions
 */
async function sessionMiddleware(req, res, next) {
    try {
        // Get client IP and generate device fingerprint
        const clientIP = sessionService.getClientIP(req);
        const deviceFingerprint = sessionService.generateDeviceFingerprint(req);
        
        // Get or create user session
        const userSession = await progressService.getOrCreateSession(clientIP, deviceFingerprint);
        
        // Add session info to request
        req.sessionId = userSession.sessionId;
        req.userSession = userSession;
        req.clientIP = clientIP;
        req.deviceFingerprint = deviceFingerprint;
        
        next();
    } catch (error) {
        console.error('Session middleware error:', error);
        
        // Generate fallback session ID for this request
        const crypto = require('crypto');
        req.sessionId = crypto.randomBytes(16).toString('hex');
        req.userSession = null;
        
        next();
    }
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
    console.error('API Error:', err);

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: err.details || err.message
        });
    }

    if (err.name === 'RateLimitError') {
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: err.retryAfter
        });
    }

    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        return res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable',
            retryAfter: 30
        });
    }

    // Generic server error
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
    const start = Date.now();
    
    // Log request
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
}

/**
 * Input validation middleware
 */
function validateInput(req, res, next) {
    // Basic XSS protection
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                  .replace(/javascript:/gi, '')
                  .replace(/on\w+\s*=/gi, '');
    };

    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = sanitizeString(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };

    // Sanitize request body
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }

    next();
}

/**
 * CORS middleware with proper configuration
 */
function corsMiddleware(req, res, next) {
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
    ];

    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
}

/**
 * Rate limiting middleware (basic implementation)
 */
function rateLimitMiddleware(req, res, next) {
    // Use session service for rate limiting
    if (req.sessionId) {
        const rateLimit = sessionService.checkRateLimit(req.sessionId, 'api_request');
        
        if (!rateLimit.allowed) {
            const error = new Error('Rate limit exceeded');
            error.name = 'RateLimitError';
            error.retryAfter = Math.ceil((rateLimit.resetTime - new Date()) / 1000);
            return next(error);
        }

        // Add rate limit headers
        res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
        if (rateLimit.resetTime) {
            res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime.getTime() / 1000));
        }
    }

    next();
}

/**
 * Health check middleware
 */
function healthCheck(req, res, next) {
    if (req.path === '/health' || req.path === '/api/health') {
        return res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0'
        });
    }
    next();
}

module.exports = {
    sessionMiddleware,
    errorHandler,
    requestLogger,
    validateInput,
    corsMiddleware,
    rateLimitMiddleware,
    healthCheck
};