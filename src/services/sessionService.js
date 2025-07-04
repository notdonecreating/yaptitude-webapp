const crypto = require('crypto');

class SessionService {
    constructor() {
        // Map to store active conversations
        this.activeConversations = new Map();
        
        // Session cleanup interval (every 30 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveSessions();
        }, 30 * 60 * 1000);
    }

    /**
     * Generate device fingerprint from request headers
     * @param {Object} req - Express request object
     * @returns {string} Device fingerprint
     */
    generateDeviceFingerprint(req) {
        const components = [
            req.get('User-Agent') || '',
            req.get('Accept-Language') || '',
            req.get('Accept-Encoding') || '',
            req.ip || '',
            // Add more headers as needed for uniqueness
            req.get('Accept') || ''
        ];

        const fingerprint = crypto
            .createHash('md5')
            .update(components.join('|'))
            .digest('hex');

        return fingerprint;
    }

    /**
     * Extract IP address from request
     * @param {Object} req - Express request object
     * @returns {string} IP address
     */
    getClientIP(req) {
        return (
            req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
            '127.0.0.1'
        ).replace('::ffff:', ''); // Remove IPv6 prefix
    }

    /**
     * Start a new conversation session
     * @param {string} sessionId - User session ID
     * @param {string} type - 'lesson' or 'scenario'
     * @param {Object} config - Conversation configuration
     * @returns {string} Conversation ID
     */
    startConversation(sessionId, type, config) {
        const conversationId = this.generateConversationId(sessionId, type);
        
        const conversation = {
            id: conversationId,
            sessionId,
            type, // 'lesson' or 'scenario'
            config, // lesson/scenario data, character, level, etc.
            startTime: new Date(),
            lastActivity: new Date(),
            messageCount: 0,
            history: [],
            character: this.selectCharacter(type, config),
            status: 'active' // active, paused, completed, abandoned
        };

        this.activeConversations.set(conversationId, conversation);
        
        return conversationId;
    }

    /**
     * Add message to conversation
     * @param {string} conversationId - Conversation ID
     * @param {Object} message - Message object
     * @returns {boolean} Success status
     */
    addMessage(conversationId, message) {
        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) {
            return false;
        }

        conversation.history.push({
            ...message,
            timestamp: new Date()
        });

        conversation.messageCount++;
        conversation.lastActivity = new Date();

        return true;
    }

    /**
     * Get conversation data
     * @param {string} conversationId - Conversation ID
     * @returns {Object|null} Conversation data
     */
    getConversation(conversationId) {
        return this.activeConversations.get(conversationId) || null;
    }

    /**
     * Update conversation status
     * @param {string} conversationId - Conversation ID
     * @param {string} status - New status
     * @param {Object} metadata - Additional metadata
     * @returns {boolean} Success status
     */
    updateConversationStatus(conversationId, status, metadata = {}) {
        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) {
            return false;
        }

        conversation.status = status;
        conversation.lastActivity = new Date();
        
        if (status === 'completed') {
            conversation.endTime = new Date();
            conversation.duration = conversation.endTime - conversation.startTime;
        }

        // Add any additional metadata
        Object.assign(conversation, metadata);

        return true;
    }

    /**
     * End conversation and return summary
     * @param {string} conversationId - Conversation ID
     * @returns {Object|null} Conversation summary
     */
    endConversation(conversationId) {
        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) {
            return null;
        }

        this.updateConversationStatus(conversationId, 'completed');

        const summary = {
            id: conversationId,
            sessionId: conversation.sessionId,
            type: conversation.type,
            config: conversation.config,
            character: conversation.character,
            startTime: conversation.startTime,
            endTime: conversation.endTime,
            duration: conversation.duration,
            messageCount: conversation.messageCount,
            history: conversation.history
        };

        // Remove from active conversations after a delay to allow final operations
        setTimeout(() => {
            this.activeConversations.delete(conversationId);
        }, 5000);

        return summary;
    }

    /**
     * Get conversation history for API calls
     * @param {string} conversationId - Conversation ID
     * @param {number} limit - Maximum messages to return
     * @returns {Array} Message history
     */
    getConversationHistory(conversationId, limit = 20) {
        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) {
            return [];
        }

        // Return recent messages in API format
        return conversation.history
            .slice(-limit)
            .map(msg => ({
                role: msg.role,
                content: msg.content
            }));
    }

    /**
     * Get active conversations for a user session
     * @param {string} sessionId - User session ID
     * @returns {Array} Active conversations
     */
    getUserConversations(sessionId) {
        const userConversations = [];
        
        for (const conversation of this.activeConversations.values()) {
            if (conversation.sessionId === sessionId && conversation.status === 'active') {
                userConversations.push({
                    id: conversation.id,
                    type: conversation.type,
                    startTime: conversation.startTime,
                    messageCount: conversation.messageCount,
                    character: conversation.character
                });
            }
        }

        return userConversations;
    }

    /**
     * Pause conversation
     * @param {string} conversationId - Conversation ID
     * @returns {boolean} Success status
     */
    pauseConversation(conversationId) {
        return this.updateConversationStatus(conversationId, 'paused');
    }

    /**
     * Resume conversation
     * @param {string} conversationId - Conversation ID
     * @returns {boolean} Success status
     */
    resumeConversation(conversationId) {
        return this.updateConversationStatus(conversationId, 'active');
    }

    /**
     * Abandon conversation
     * @param {string} conversationId - Conversation ID
     * @returns {boolean} Success status
     */
    abandonConversation(conversationId) {
        return this.updateConversationStatus(conversationId, 'abandoned');
    }

    /**
     * Get conversation statistics
     * @param {string} conversationId - Conversation ID
     * @returns {Object} Conversation stats
     */
    getConversationStats(conversationId) {
        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) {
            return null;
        }

        const now = new Date();
        const duration = now - conversation.startTime;
        const userMessages = conversation.history.filter(msg => msg.role === 'user');
        const aiMessages = conversation.history.filter(msg => msg.role === 'assistant');

        return {
            duration: Math.round(duration / 1000), // seconds
            messageCount: conversation.messageCount,
            userMessageCount: userMessages.length,
            aiMessageCount: aiMessages.length,
            averageUserMessageLength: userMessages.length > 0 
                ? Math.round(userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length)
                : 0,
            startTime: conversation.startTime,
            lastActivity: conversation.lastActivity,
            character: conversation.character.name || conversation.character.id
        };
    }

    /**
     * Rate limit check
     * @param {string} sessionId - User session ID
     * @param {string} action - Action type ('message', 'conversation_start')
     * @returns {Object} Rate limit status
     */
    checkRateLimit(sessionId, action = 'message') {
        // For MVP, implement simple rate limiting
        const rateLimits = {
            message: { count: 100, window: 60 * 60 * 1000 }, // 100 messages per hour
            conversation_start: { count: 10, window: 60 * 60 * 1000 } // 10 conversations per hour
        };

        const limit = rateLimits[action];
        if (!limit) {
            return { allowed: true, remaining: Infinity };
        }

        // This is a simplified implementation
        // In production, you'd want to use Redis or a proper rate limiting service
        const key = `${sessionId}_${action}`;
        const now = Date.now();

        if (!this.rateLimitTracker) {
            this.rateLimitTracker = new Map();
        }

        let userActions = this.rateLimitTracker.get(key) || [];
        
        // Remove old actions outside the window
        userActions = userActions.filter(timestamp => now - timestamp < limit.window);
        
        if (userActions.length >= limit.count) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: new Date(userActions[0] + limit.window)
            };
        }

        // Add current action
        userActions.push(now);
        this.rateLimitTracker.set(key, userActions);

        return {
            allowed: true,
            remaining: limit.count - userActions.length
        };
    }

    // Private helper methods

    /**
     * Generate unique conversation ID
     * @param {string} sessionId - User session ID
     * @param {string} type - Conversation type
     * @returns {string} Conversation ID
     */
    generateConversationId(sessionId, type) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${type}_${sessionId.substring(0, 8)}_${timestamp}_${random}`;
    }

    /**
     * Select character for conversation
     * @param {string} type - Conversation type
     * @param {Object} config - Configuration
     * @returns {Object} Selected character
     */
    selectCharacter(type, config) {
        if (type === 'lesson') {
            // For lessons, use the practice partner from config if provided, or default
            if (config.character) {
                return config.character; // Use the full character object passed in
            }
            
            // Fallback: load from file
            const charactersData = require('../../data/characters.json');
            return charactersData.practice_partner;
        } else if (type === 'scenario') {
            // For scenarios, character should be specified in config
            if (config.characterId) {
                const charactersData = require('../../data/characters.json');
                return charactersData[config.characterId];
            }
            
            // Fallback: select random character from scenario's available characters
            const scenarioData = config.scenario;
            if (scenarioData && scenarioData.characters_present) {
                const randomIndex = Math.floor(Math.random() * scenarioData.characters_present.length);
                const characterId = scenarioData.characters_present[randomIndex];
                const charactersData = require('../../data/characters.json');
                return charactersData[characterId];
            }
        }
    
        // Ultimate fallback
        const charactersData = require('../../data/characters.json');
        return charactersData.practice_partner;
    }

    /**
     * Clean up inactive sessions periodically
     */
    cleanupInactiveSessions() {
        const now = new Date();
        const inactiveThreshold = 2 * 60 * 60 * 1000; // 2 hours

        for (const [conversationId, conversation] of this.activeConversations.entries()) {
            if (now - conversation.lastActivity > inactiveThreshold) {
                if (conversation.status === 'active') {
                    conversation.status = 'abandoned';
                }
                
                // Remove very old conversations
                if (now - conversation.lastActivity > 24 * 60 * 60 * 1000) { // 24 hours
                    this.activeConversations.delete(conversationId);
                }
            }
        }

        // Clean up rate limit tracker
        if (this.rateLimitTracker) {
            const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours
            for (const [key, actions] of this.rateLimitTracker.entries()) {
                const recentActions = actions.filter(timestamp => timestamp > cutoff);
                if (recentActions.length === 0) {
                    this.rateLimitTracker.delete(key);
                } else {
                    this.rateLimitTracker.set(key, recentActions);
                }
            }
        }

        console.log(`Session cleanup completed. Active conversations: ${this.activeConversations.size}`);
    }

    /**
     * Get service statistics
     * @returns {Object} Service stats
     */
    getServiceStats() {
        const now = new Date();
        let activeCount = 0;
        let pausedCount = 0;
        let completedCount = 0;

        for (const conversation of this.activeConversations.values()) {
            switch (conversation.status) {
                case 'active':
                    activeCount++;
                    break;
                case 'paused':
                    pausedCount++;
                    break;
                case 'completed':
                    completedCount++;
                    break;
            }
        }

        return {
            totalConversations: this.activeConversations.size,
            activeConversations: activeCount,
            pausedConversations: pausedCount,
            completedConversations: completedCount,
            rateLimitEntries: this.rateLimitTracker ? this.rateLimitTracker.size : 0,
            uptime: now - this.startTime || now
        };
    }

    /**
     * Destroy service and cleanup resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.activeConversations.clear();
        
        if (this.rateLimitTracker) {
            this.rateLimitTracker.clear();
        }
    }
}

module.exports = SessionService;