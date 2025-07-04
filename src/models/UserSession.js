class UserSession {
    constructor(sessionId, deviceFingerprint = null) {
        this.sessionId = sessionId;
        this.deviceFingerprint = deviceFingerprint;
        this.createdAt = new Date();
        this.lastActiveAt = new Date();
        
        // Progress tracking
        this.lessonProgress = {};
        this.scenarioProgress = {};
        this.totalPracticeTime = 0;
        this.conversationCount = 0;
        
        // User preferences
        this.preferences = {
            speechEnabled: false,
            difficulty: 'medium',
            pace: 'normal',
            feedbackStyle: 'encouraging'
        };
        
        // Achievement tracking
        this.achievements = [];
        this.streaks = {
            dailyPractice: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastPracticeDate: null
        };
    }

    /**
     * Update user activity timestamp
     */
    updateActivity() {
        this.lastActiveAt = new Date();
        this.updateDailyStreak();
    }

    /**
     * Update daily practice streak
     */
    updateDailyStreak() {
        const today = new Date().toDateString();
        const lastPractice = this.streaks.lastPracticeDate;
        
        if (lastPractice !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastPractice === yesterday.toDateString()) {
                // Consecutive day
                this.streaks.currentStreak++;
            } else if (lastPractice !== today) {
                // Broken streak
                this.streaks.currentStreak = 1;
            }
            
            this.streaks.lastPracticeDate = today;
            this.streaks.longestStreak = Math.max(
                this.streaks.longestStreak, 
                this.streaks.currentStreak
            );
        }
    }

    /**
     * Record lesson progress
     * @param {string} lessonId - The lesson identifier
     * @param {string} level - bronze, silver, or gold
     * @param {boolean} completed - Whether level was successfully completed
     * @param {Object} performance - Performance metrics
     */
    recordLessonProgress(lessonId, level, completed, performance = {}) {
        if (!this.lessonProgress[lessonId]) {
            this.lessonProgress[lessonId] = {
                attempts: 0,
                completedLevels: [],
                highestLevel: 'none',
                totalTime: 0,
                lastAttempt: null,
                performances: []
            };
        }

        const lesson = this.lessonProgress[lessonId];
        lesson.attempts++;
        lesson.lastAttempt = new Date();
        lesson.totalTime += performance.duration || 0;
        lesson.performances.push({
            level,
            completed,
            timestamp: new Date(),
            ...performance
        });

        if (completed && !lesson.completedLevels.includes(level)) {
            lesson.completedLevels.push(level);
            
            // Update highest level
            const levelOrder = ['bronze', 'silver', 'gold'];
            const highestIndex = Math.max(
                ...lesson.completedLevels.map(l => levelOrder.indexOf(l))
            );
            lesson.highestLevel = levelOrder[highestIndex];
            
            // Check for achievements
            this.checkForAchievements(lessonId, level);
        }

        this.conversationCount++;
    }

    /**
     * Record scenario practice
     * @param {string} scenarioId - The scenario identifier  
     * @param {string} characterId - Character practiced with
     * @param {Object} performance - Performance metrics
     */
    recordScenarioProgress(scenarioId, characterId, performance = {}) {
        if (!this.scenarioProgress[scenarioId]) {
            this.scenarioProgress[scenarioId] = {
                attempts: 0,
                charactersPracticed: [],
                totalTime: 0,
                lastAttempt: null,
                performances: []
            };
        }

        const scenario = this.scenarioProgress[scenarioId];
        scenario.attempts++;
        scenario.lastAttempt = new Date();
        scenario.totalTime += performance.duration || 0;
        scenario.performances.push({
            characterId,
            timestamp: new Date(),
            ...performance
        });

        if (!scenario.charactersPracticed.includes(characterId)) {
            scenario.charactersPracticed.push(characterId);
        }

        this.conversationCount++;
    }

    /**
     * Check for and award achievements
     * @param {string} lessonId - Recently completed lesson
     * @param {string} level - Recently completed level
     */
    checkForAchievements(lessonId, level) {
        const achievements = [];

        // First completion achievements
        if (level === 'bronze' && !this.hasAchievement('first_bronze')) {
            achievements.push('first_bronze');
        }
        if (level === 'gold' && !this.hasAchievement('first_gold')) {
            achievements.push('first_gold');
        }

        // Conversation count milestones
        const milestones = [10, 25, 50, 100];
        for (const milestone of milestones) {
            const achievementId = `conversations_${milestone}`;
            if (this.conversationCount >= milestone && !this.hasAchievement(achievementId)) {
                achievements.push(achievementId);
            }
        }

        // Streak achievements
        const streakMilestones = [3, 7, 14, 30];
        for (const milestone of streakMilestones) {
            const achievementId = `streak_${milestone}`;
            if (this.streaks.currentStreak >= milestone && !this.hasAchievement(achievementId)) {
                achievements.push(achievementId);
            }
        }

        // Category completion achievements
        const categoryProgress = this.getCategoryProgress();
        for (const [category, progress] of Object.entries(categoryProgress)) {
            if (progress.completionRate >= 100) {
                const achievementId = `${category}_master`;
                if (!this.hasAchievement(achievementId)) {
                    achievements.push(achievementId);
                }
            }
        }

        // Add new achievements
        for (const achievement of achievements) {
            this.achievements.push({
                id: achievement,
                unlockedAt: new Date(),
                seen: false
            });
        }

        return achievements;
    }

    /**
     * Check if user has specific achievement
     * @param {string} achievementId - Achievement to check
     * @returns {boolean}
     */
    hasAchievement(achievementId) {
        return this.achievements.some(a => a.id === achievementId);
    }

    /**
     * Get overall progress statistics
     * @returns {Object}
     */
    getOverallProgress() {
        const lessonCount = Object.keys(this.lessonProgress).length;
        const completedLessons = Object.values(this.lessonProgress)
            .filter(l => l.completedLevels.length > 0).length;
        
        const totalLevels = lessonCount * 3; // 3 levels per lesson
        const completedLevels = Object.values(this.lessonProgress)
            .reduce((sum, l) => sum + l.completedLevels.length, 0);

        return {
            lessonsStarted: lessonCount,
            lessonsCompleted: completedLessons,
            completionRate: lessonCount > 0 ? Math.round((completedLessons / lessonCount) * 100) : 0,
            levelsCompleted: completedLevels,
            totalLevels: totalLevels,
            levelCompletionRate: totalLevels > 0 ? Math.round((completedLevels / totalLevels) * 100) : 0,
            conversationCount: this.conversationCount,
            totalPracticeTime: this.totalPracticeTime,
            currentStreak: this.streaks.currentStreak,
            achievementCount: this.achievements.length
        };
    }

    /**
     * Get progress by category
     * @returns {Object}
     */
    getCategoryProgress() {
        const categories = {
            chat: { lessons: [], completed: 0 },
            yap: { lessons: [], completed: 0 },
            vibe: { lessons: [], completed: 0 },
            play: { lessons: [], completed: 0 }
        };

        // This would need to be populated with actual lesson data
        // For now, return structure for frontend to fill
        return categories;
    }

    /**
     * Get recommended next actions for user
     * @returns {Array}
     */
    getRecommendations() {
        const recommendations = [];

        // If no lessons started, recommend basic weaving
        if (Object.keys(this.lessonProgress).length === 0) {
            recommendations.push({
                type: 'lesson',
                id: 'basic_weaving',
                reason: 'Start with the fundamentals',
                priority: 'high'
            });
            return recommendations;
        }

        // Find incomplete lessons
        for (const [lessonId, progress] of Object.entries(this.lessonProgress)) {
            if (progress.completedLevels.length < 3) {
                const nextLevel = ['bronze', 'silver', 'gold']
                    .find(level => !progress.completedLevels.includes(level));
                
                recommendations.push({
                    type: 'lesson_level',
                    lessonId,
                    level: nextLevel,
                    reason: `Continue ${lessonId} progress`,
                    priority: 'medium'
                });
            }
        }

        // Recommend scenario practice if they have some completed lessons
        const hasCompletedLesson = Object.values(this.lessonProgress)
            .some(l => l.completedLevels.length > 0);
        
        if (hasCompletedLesson) {
            recommendations.push({
                type: 'scenario',
                id: 'coffee_shop',
                reason: 'Practice your skills in real scenarios',
                priority: 'medium'
            });
        }

        return recommendations.slice(0, 3); // Return top 3 recommendations
    }

    /**
     * Export session data for storage
     * @returns {Object}
     */
    toJSON() {
        return {
            sessionId: this.sessionId,
            deviceFingerprint: this.deviceFingerprint,
            createdAt: this.createdAt,
            lastActiveAt: this.lastActiveAt,
            lessonProgress: this.lessonProgress,
            scenarioProgress: this.scenarioProgress,
            totalPracticeTime: this.totalPracticeTime,
            conversationCount: this.conversationCount,
            preferences: this.preferences,
            achievements: this.achievements,
            streaks: this.streaks
        };
    }

    /**
     * Load session data from storage
     * @param {Object} data - Stored session data
     * @returns {UserSession}
     */
    static fromJSON(data) {
        const session = new UserSession(data.sessionId, data.deviceFingerprint);
        Object.assign(session, {
            ...data,
            createdAt: new Date(data.createdAt),
            lastActiveAt: new Date(data.lastActiveAt)
        });
        return session;
    }
}

module.exports = UserSession;