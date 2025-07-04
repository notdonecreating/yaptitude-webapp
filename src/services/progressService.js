const fs = require('fs').promises;
const path = require('path');
const UserSession = require('../models/UserSession');

class ProgressService {
    constructor() {
        this.storageDir = path.join(__dirname, '../../storage');
        this.sessionsFile = path.join(this.storageDir, 'sessions.json');
        this.backupDir = path.join(this.storageDir, 'backups');
        
        // In-memory cache for active sessions
        this.sessionCache = new Map();
        
        // Ensure storage directory exists
        this.initializeStorage();
    }

    /**
     * Initialize storage directories and files
     */
    async initializeStorage() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
            
            // Create sessions file if it doesn't exist
            try {
                await fs.access(this.sessionsFile);
            } catch {
                await fs.writeFile(this.sessionsFile, JSON.stringify({}));
            }
        } catch (error) {
            console.error('Failed to initialize storage:', error);
        }
    }

    /**
     * Get or create user session by IP/device fingerprint
     * @param {string} ipAddress - User's IP address
     * @param {string} deviceFingerprint - Device fingerprint (optional)
     * @returns {Promise<UserSession>} User session
     */
    async getOrCreateSession(ipAddress, deviceFingerprint = null) {
        const sessionId = this.generateSessionId(ipAddress, deviceFingerprint);
        
        // Check cache first
        if (this.sessionCache.has(sessionId)) {
            const session = this.sessionCache.get(sessionId);
            session.updateActivity();
            return session;
        }

        // Load from storage
        try {
            const sessions = await this.loadSessions();
            
            if (sessions[sessionId]) {
                const session = UserSession.fromJSON(sessions[sessionId]);
                session.updateActivity();
                this.sessionCache.set(sessionId, session);
                return session;
            }
        } catch (error) {
            console.error('Error loading session:', error);
        }

        // Create new session
        const newSession = new UserSession(sessionId, deviceFingerprint);
        this.sessionCache.set(sessionId, newSession);
        await this.saveSession(newSession);
        
        return newSession;
    }

    /**
     * Save user session to storage
     * @param {UserSession} session - Session to save
     * @returns {Promise<boolean>} Success status
     */
    async saveSession(session) {
        try {
            const sessions = await this.loadSessions();
            sessions[session.sessionId] = session.toJSON();
            
            await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
            
            // Update cache
            this.sessionCache.set(session.sessionId, session);
            
            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    }

    /**
     * Record lesson progress for a user
     * @param {string} sessionId - User session ID
     * @param {string} lessonId - Lesson identifier
     * @param {string} level - Level attempted (bronze/silver/gold)
     * @param {boolean} completed - Whether level was completed
     * @param {Object} performance - Performance metrics
     * @returns {Promise<Object>} Updated progress and any new achievements
     */
    async recordLessonProgress(sessionId, lessonId, level, completed, performance = {}) {
        try {
            const session = this.sessionCache.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            const newAchievements = session.recordLessonProgress(lessonId, level, completed, performance);
            await this.saveSession(session);

            return {
                success: true,
                progress: session.lessonProgress[lessonId],
                newAchievements,
                overallProgress: session.getOverallProgress(),
                recommendations: session.getRecommendations()
            };

        } catch (error) {
            console.error('Error recording lesson progress:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Record scenario practice for a user
     * @param {string} sessionId - User session ID
     * @param {string} scenarioId - Scenario identifier
     * @param {string} characterId - Character practiced with
     * @param {Object} performance - Performance metrics
     * @returns {Promise<Object>} Updated progress
     */
    async recordScenarioProgress(sessionId, scenarioId, characterId, performance = {}) {
        try {
            const session = this.sessionCache.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            session.recordScenarioProgress(scenarioId, characterId, performance);
            await this.saveSession(session);

            return {
                success: true,
                progress: session.scenarioProgress[scenarioId],
                overallProgress: session.getOverallProgress()
            };

        } catch (error) {
            console.error('Error recording scenario progress:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's complete progress data
     * @param {string} sessionId - User session ID
     * @returns {Promise<Object>} Complete progress data
     */
    async getUserProgress(sessionId) {
        try {
            const session = this.sessionCache.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            const lessonsData = require('../../data/lessons.json');
            const scenariosData = require('../../data/scenarios.json');

            return {
                success: true,
                sessionInfo: {
                    sessionId: session.sessionId,
                    createdAt: session.createdAt,
                    lastActiveAt: session.lastActiveAt,
                    totalPracticeTime: session.totalPracticeTime,
                    conversationCount: session.conversationCount
                },
                lessonProgress: this.enrichLessonProgress(session.lessonProgress, lessonsData),
                scenarioProgress: session.scenarioProgress,
                overallProgress: session.getOverallProgress(),
                achievements: session.achievements,
                streaks: session.streaks,
                preferences: session.preferences,
                recommendations: session.getRecommendations(),
                availableLessons: this.getAvailableLessons(session.lessonProgress, lessonsData),
                availableScenarios: this.getAvailableScenarios(session.lessonProgress, scenariosData)
            };

        } catch (error) {
            console.error('Error getting user progress:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update user preferences
     * @param {string} sessionId - User session ID
     * @param {Object} preferences - Updated preferences
     * @returns {Promise<boolean>} Success status
     */
    async updateUserPreferences(sessionId, preferences) {
        try {
            const session = this.sessionCache.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            Object.assign(session.preferences, preferences);
            await this.saveSession(session);

            return true;
        } catch (error) {
            console.error('Error updating preferences:', error);
            return false;
        }
    }

    /**
     * Mark achievements as seen
     * @param {string} sessionId - User session ID
     * @param {Array} achievementIds - Achievement IDs to mark as seen
     * @returns {Promise<boolean>} Success status
     */
    async markAchievementsSeen(sessionId, achievementIds) {
        try {
            const session = this.sessionCache.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            session.achievements.forEach(achievement => {
                if (achievementIds.includes(achievement.id)) {
                    achievement.seen = true;
                }
            });

            await this.saveSession(session);
            return true;

        } catch (error) {
            console.error('Error marking achievements as seen:', error);
            return false;
        }
    }

    /**
     * Get leaderboard data (anonymized)
     * @param {string} category - 'conversations', 'streaks', 'achievements'
     * @param {number} limit - Number of top entries to return
     * @returns {Promise<Array>} Leaderboard entries
     */
    async getLeaderboard(category = 'conversations', limit = 10) {
        try {
            const sessions = await this.loadSessions();
            const entries = [];

            for (const [sessionId, sessionData] of Object.entries(sessions)) {
                let score = 0;
                let label = '';

                switch (category) {
                    case 'conversations':
                        score = sessionData.conversationCount || 0;
                        label = `${score} conversations`;
                        break;
                    case 'streaks':
                        score = sessionData.streaks?.longestStreak || 0;
                        label = `${score} day streak`;
                        break;
                    case 'achievements':
                        score = sessionData.achievements?.length || 0;
                        label = `${score} achievements`;
                        break;
                }

                if (score > 0) {
                    entries.push({
                        id: this.anonymizeSessionId(sessionId),
                        score,
                        label,
                        rank: 0 // Will be set after sorting
                    });
                }
            }

            // Sort and assign ranks
            entries.sort((a, b) => b.score - a.score);
            entries.forEach((entry, index) => {
                entry.rank = index + 1;
            });

            return entries.slice(0, limit);

        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        }
    }

    /**
     * Export user data for download
     * @param {string} sessionId - User session ID
     * @returns {Promise<Object>} Exportable user data
     */
    async exportUserData(sessionId) {
        try {
            const session = this.sessionCache.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            return {
                exportDate: new Date(),
                sessionInfo: {
                    createdAt: session.createdAt,
                    totalPracticeTime: session.totalPracticeTime,
                    conversationCount: session.conversationCount
                },
                progress: {
                    lessons: session.lessonProgress,
                    scenarios: session.scenarioProgress,
                    achievements: session.achievements,
                    streaks: session.streaks
                },
                preferences: session.preferences
            };

        } catch (error) {
            console.error('Error exporting user data:', error);
            throw error;
        }
    }

    /**
     * Delete user data (GDPR compliance)
     * @param {string} sessionId - User session ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteUserData(sessionId) {
        try {
            // Remove from cache
            this.sessionCache.delete(sessionId);

            // Remove from storage
            const sessions = await this.loadSessions();
            delete sessions[sessionId];
            await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));

            return true;

        } catch (error) {
            console.error('Error deleting user data:', error);
            return false;
        }
    }

    /**
     * Create backup of all user data
     * @returns {Promise<string>} Backup filename
     */
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `sessions-backup-${timestamp}.json`;
            const backupPath = path.join(this.backupDir, backupFilename);

            const sessions = await this.loadSessions();
            await fs.writeFile(backupPath, JSON.stringify(sessions, null, 2));

            // Clean up old backups (keep last 30)
            await this.cleanupOldBackups();

            return backupFilename;

        } catch (error) {
            console.error('Error creating backup:', error);
            throw error;
        }
    }

    /**
     * Get analytics data (aggregated, anonymized)
     * @returns {Promise<Object>} Analytics data
     */
    async getAnalytics() {
        try {
            const sessions = await this.loadSessions();
            const analytics = {
                totalUsers: Object.keys(sessions).length,
                totalConversations: 0,
                totalPracticeTime: 0,
                lessonCompletions: {},
                scenarioPopularity: {},
                averageStreak: 0,
                achievementDistribution: {},
                userRetention: {
                    day1: 0,
                    day7: 0,
                    day30: 0
                }
            };

            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            for (const sessionData of Object.values(sessions)) {
                analytics.totalConversations += sessionData.conversationCount || 0;
                analytics.totalPracticeTime += sessionData.totalPracticeTime || 0;

                // Lesson completions
                if (sessionData.lessonProgress) {
                    for (const [lessonId, progress] of Object.entries(sessionData.lessonProgress)) {
                        if (!analytics.lessonCompletions[lessonId]) {
                            analytics.lessonCompletions[lessonId] = { bronze: 0, silver: 0, gold: 0 };
                        }
                        if (progress.completedLevels) {
                            progress.completedLevels.forEach(level => {
                                analytics.lessonCompletions[lessonId][level]++;
                            });
                        }
                    }
                }

                // Scenario popularity
                if (sessionData.scenarioProgress) {
                    for (const scenarioId of Object.keys(sessionData.scenarioProgress)) {
                        analytics.scenarioPopularity[scenarioId] = 
                            (analytics.scenarioPopularity[scenarioId] || 0) + 1;
                    }
                }

                // Streaks
                if (sessionData.streaks?.longestStreak) {
                    analytics.averageStreak += sessionData.streaks.longestStreak;
                }

                // Achievements
                if (sessionData.achievements) {
                    sessionData.achievements.forEach(achievement => {
                        analytics.achievementDistribution[achievement.id] = 
                            (analytics.achievementDistribution[achievement.id] || 0) + 1;
                    });
                }

                // Retention
                const lastActive = new Date(sessionData.lastActiveAt);
                if (lastActive > oneDayAgo) analytics.userRetention.day1++;
                if (lastActive > sevenDaysAgo) analytics.userRetention.day7++;
                if (lastActive > thirtyDaysAgo) analytics.userRetention.day30++;
            }

            // Calculate averages
            analytics.averageStreak = analytics.totalUsers > 0 ? 
                analytics.averageStreak / analytics.totalUsers : 0;

            return analytics;

        } catch (error) {
            console.error('Error getting analytics:', error);
            return {};
        }
    }

    // Private helper methods

    /**
     * Generate session ID from IP and device fingerprint
     * @param {string} ipAddress - User's IP
     * @param {string} deviceFingerprint - Device fingerprint
     * @returns {string} Session ID
     */
    generateSessionId(ipAddress, deviceFingerprint) {
        const crypto = require('crypto');
        const combined = `${ipAddress}_${deviceFingerprint || 'unknown'}`;
        return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
    }

    /**
     * Load sessions from storage
     * @returns {Promise<Object>} Sessions data
     */
    async loadSessions() {
        try {
            const data = await fs.readFile(this.sessionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading sessions:', error);
            return {};
        }
    }

    /**
     * Enrich lesson progress with metadata
     * @param {Object} lessonProgress - Raw lesson progress
     * @param {Object} lessonsData - Lessons metadata
     * @returns {Object} Enriched progress
     */
    enrichLessonProgress(lessonProgress, lessonsData) {
        const enriched = {};

        for (const [lessonId, progress] of Object.entries(lessonProgress)) {
            const lessonData = lessonsData.lessons[lessonId];
            if (!lessonData) continue;

            enriched[lessonId] = {
                ...progress,
                lessonInfo: {
                    title: lessonData.title,
                    category: lessonData.category,
                    difficulty: lessonData.difficulty,
                    estimatedTime: lessonData.estimated_time
                },
                progressPercentage: this.calculateLessonProgressPercentage(progress),
                nextLevel: this.getNextLevel(progress),
                isCompleted: progress.completedLevels?.length === 3
            };
        }

        return enriched;
    }

    /**
     * Calculate lesson progress percentage
     * @param {Object} progress - Lesson progress
     * @returns {number} Percentage (0-100)
     */
    calculateLessonProgressPercentage(progress) {
        if (!progress.completedLevels) return 0;
        return Math.round((progress.completedLevels.length / 3) * 100);
    }

    /**
     * Get next level to attempt
     * @param {Object} progress - Lesson progress
     * @returns {string} Next level
     */
    getNextLevel(progress) {
        const levels = ['bronze', 'silver', 'gold'];
        if (!progress.completedLevels) return 'bronze';
        
        for (const level of levels) {
            if (!progress.completedLevels.includes(level)) {
                return level;
            }
        }
        return 'gold'; // All completed, can practice gold
    }

    /**
     * Get available lessons for user
     * @param {Object} lessonProgress - User's lesson progress
     * @param {Object} lessonsData - Lessons metadata
     * @returns {Array} Available lessons
     */
    getAvailableLessons(lessonProgress, lessonsData) {
        const available = [];

        for (const [lessonId, lessonData] of Object.entries(lessonsData.lessons)) {
            const isUnlocked = this.isLessonUnlocked(lessonId, lessonData, lessonProgress);
            const userProgress = lessonProgress[lessonId];

            available.push({
                id: lessonId,
                title: lessonData.title,
                category: lessonData.category,
                difficulty: lessonData.difficulty,
                estimatedTime: lessonData.estimated_time,
                isUnlocked,
                progress: userProgress ? this.calculateLessonProgressPercentage(userProgress) : 0,
                nextLevel: userProgress ? this.getNextLevel(userProgress) : 'bronze',
                prerequisite: lessonData.prerequisite
            });
        }

        return available;
    }

    /**
     * Check if lesson is unlocked for user
     * @param {string} lessonId - Lesson ID
     * @param {Object} lessonData - Lesson metadata
     * @param {Object} lessonProgress - User's progress
     * @returns {boolean} Whether lesson is unlocked
     */
    isLessonUnlocked(lessonId, lessonData, lessonProgress) {
        if (!lessonData.prerequisite) return true;
        
        const prereqProgress = lessonProgress[lessonData.prerequisite];
        return prereqProgress && prereqProgress.completedLevels && prereqProgress.completedLevels.length > 0;
    }

    /**
     * Get available scenarios for user
     * @param {Object} lessonProgress - User's lesson progress
     * @param {Object} scenariosData - Scenarios metadata
     * @returns {Array} Available scenarios
     */
    getAvailableScenarios(lessonProgress, scenariosData) {
        const available = [];

        // User needs at least one completed lesson to access scenarios
        const hasCompletedLesson = Object.values(lessonProgress).some(
            progress => progress.completedLevels && progress.completedLevels.length > 0
        );

        for (const [scenarioId, scenarioData] of Object.entries(scenariosData.scenarios)) {
            available.push({
                id: scenarioId,
                name: scenarioData.name,
                description: scenarioData.description,
                icon: scenarioData.icon,
                difficulty: scenarioData.difficulty,
                mood: scenarioData.mood,
                isUnlocked: hasCompletedLesson,
                charactersAvailable: scenarioData.characters_present.length,
                goodForPracticing: scenarioData.good_for_practicing
            });
        }

        return available;
    }

    /**
     * Anonymize session ID for leaderboards
     * @param {string} sessionId - Original session ID
     * @returns {string} Anonymized ID
     */
    anonymizeSessionId(sessionId) {
        return `User${sessionId.substring(0, 4)}`;
    }

    /**
     * Clean up old backup files
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('sessions-backup-'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    stats: null
                }));

            // Get file stats and sort by creation time
            for (const file of backupFiles) {
                file.stats = await fs.stat(file.path);
            }

            backupFiles.sort((a, b) => b.stats.mtime - a.stats.mtime);

            // Delete old backups (keep newest 30)
            const filesToDelete = backupFiles.slice(30);
            for (const file of filesToDelete) {
                await fs.unlink(file.path);
            }

        } catch (error) {
            console.error('Error cleaning up backups:', error);
        }
    }
}

module.exports = ProgressService;