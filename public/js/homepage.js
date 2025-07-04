// Homepage functionality
class HomePage {
    constructor() {
        this.userProgress = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadUserProgress();
        this.updateUI();
    }

    bindEvents() {
        // Navigation buttons
        document.getElementById('lessonsCard')?.addEventListener('click', () => {
            window.location.href = '/lessons';
        });

        document.getElementById('scenariosCard')?.addEventListener('click', () => {
            const button = document.getElementById('scenariosButton');
            if (!button.disabled) {
                window.location.href = '/scenarios';
            }
        });

        // Retry button
        document.getElementById('retryButton')?.addEventListener('click', () => {
            this.loadUserProgress();
        });

        // Achievement notification close
        document.getElementById('achievementClose')?.addEventListener('click', () => {
            this.hideAchievementNotification();
        });
    }

    async loadUserProgress() {
        try {
            this.showLoading(true);
            this.hideError();

            const response = await fetch('/api/progress');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.userProgress = await response.json();
            
            // Check for new achievements
            this.checkForNewAchievements();

        } catch (error) {
            console.error('Error loading progress:', error);
            this.showError('Failed to load your progress. Please check your connection and try again.');
        } finally {
            this.showLoading(false);
        }
    }

    updateUI() {
        if (!this.userProgress || !this.userProgress.success) {
            return;
        }

        const data = this.userProgress;
        
        // Update progress overview
        this.updateProgressOverview(data.overallProgress);
        
        // Update navigation cards
        this.updateNavigationCards(data);
        
        // Update quick stats
        this.updateQuickStats(data);
        
        // Show sections
        this.showProgressSections();
    }

    updateProgressOverview(progress) {
        if (!progress) return;

        // Update conversation count
        const conversationEl = document.getElementById('conversationCount');
        if (conversationEl) {
            this.animateNumber(conversationEl, progress.conversationCount || 0);
        }

        // Update streak
        const streakEl = document.getElementById('currentStreak');
        if (streakEl) {
            this.animateNumber(streakEl, progress.currentStreak || 0);
        }

        // Update lessons completed
        const lessonsEl = document.getElementById('lessonsCompleted');
        if (lessonsEl) {
            this.animateNumber(lessonsEl, progress.lessonsCompleted || 0);
        }
    }

    updateNavigationCards(data) {
        // Update lessons card
        const lessonsProgress = data.overallProgress?.levelCompletionRate || 0;
        const lessonsProgressEl = document.getElementById('lessonsProgress');
        const lessonsProgressTextEl = document.getElementById('lessonsProgressText');
        
        if (lessonsProgressEl) {
            lessonsProgressEl.style.width = `${lessonsProgress}%`;
        }
        
        if (lessonsProgressTextEl) {
            if (lessonsProgress === 0) {
                lessonsProgressTextEl.textContent = 'Get started';
            } else if (lessonsProgress === 100) {
                lessonsProgressTextEl.textContent = 'All complete!';
            } else {
                lessonsProgressTextEl.textContent = `${lessonsProgress}% complete`;
            }
        }

        // Update scenarios card
        const hasCompletedLesson = data.overallProgress?.lessonsCompleted > 0;
        const scenariosButton = document.getElementById('scenariosButton');
        const scenariosProgressText = document.getElementById('scenariosProgressText');
        
        if (scenariosButton) {
            scenariosButton.disabled = !hasCompletedLesson;
        }
        
        if (scenariosProgressText) {
            if (hasCompletedLesson) {
                scenariosProgressText.textContent = 'Ready to practice';
            } else {
                scenariosProgressText.textContent = 'Complete a lesson first';
            }
        }

        // Scenarios progress (if available)
        if (data.scenarioProgress && hasCompletedLesson) {
            const scenarioCount = Object.keys(data.scenarioProgress).length;
            const scenariosProgressEl = document.getElementById('scenariosProgress');
            if (scenariosProgressEl && scenarioCount > 0) {
                scenariosProgressEl.style.width = `${Math.min(100, scenarioCount * 20)}%`;
            }
        }
    }

    updateQuickStats(data) {
        // Practice time
        const practiceTimeEl = document.getElementById('practiceTime');
        if (practiceTimeEl && data.sessionInfo) {
            const minutes = Math.round((data.sessionInfo.totalPracticeTime || 0) / 60000);
            practiceTimeEl.textContent = `${minutes} min`;
        }

        // Favorite character (mock for now)
        const favoriteCharacterEl = document.getElementById('favoriteCharacter');
        if (favoriteCharacterEl) {
            favoriteCharacterEl.textContent = 'Riley'; // Could be calculated from scenario data
        }

        // Next lesson
        const nextLessonEl = document.getElementById('nextLesson');
        if (nextLessonEl && data.recommendations) {
            const nextRecommendation = data.recommendations.find(r => r.type === 'lesson' || r.type === 'lesson_level');
            if (nextRecommendation) {
                nextLessonEl.textContent = this.formatLessonName(nextRecommendation.lessonId || nextRecommendation.id);
            }
        }

        // Achievement count
        const achievementCountEl = document.getElementById('achievementCount');
        if (achievementCountEl && data.achievements) {
            this.animateNumber(achievementCountEl, data.achievements.length);
        }
    }

    showProgressSections() {
        // Show progress overview if user has any activity
        const progressOverview = document.getElementById('progressOverview');
        const quickStats = document.getElementById('quickStats');
        
        if (this.userProgress?.overallProgress?.conversationCount > 0) {
            if (progressOverview) progressOverview.style.display = 'block';
            if (quickStats) quickStats.style.display = 'block';
        }
    }

    async checkForNewAchievements() {
        if (!this.userProgress?.achievements) return;

        const newAchievements = this.userProgress.achievements.filter(a => !a.seen);
        if (newAchievements.length > 0) {
            // Show first new achievement
            this.showAchievementNotification(newAchievements[0]);
            
            // Mark achievements as seen
            try {
                await fetch('/api/achievements/seen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        achievementIds: newAchievements.map(a => a.id) 
                    })
                });
            } catch (error) {
                console.error('Error marking achievements as seen:', error);
            }
        }
    }

    showAchievementNotification(achievement) {
        const notification = document.getElementById('achievementNotification');
        const description = document.getElementById('achievementDescription');
        
        if (notification && description) {
            description.textContent = this.getAchievementDescription(achievement.id);
            notification.style.display = 'block';
            notification.classList.add('fade-in');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.hideAchievementNotification();
            }, 5000);
        }
    }

    hideAchievementNotification() {
        const notification = document.getElementById('achievementNotification');
        if (notification) {
            notification.style.display = 'none';
            notification.classList.remove('fade-in');
        }
    }

    getAchievementDescription(achievementId) {
        const descriptions = {
            'first_bronze': 'Completed your first lesson!',
            'first_gold': 'Mastered a skill at gold level!',
            'conversations_10': 'Had 10 practice conversations!',
            'conversations_25': 'Had 25 practice conversations!',
            'conversations_50': 'Had 50 practice conversations!',
            'conversations_100': 'Had 100 practice conversations!',
            'streak_3': 'Practiced 3 days in a row!',
            'streak_7': 'Practiced 7 days in a row!',
            'streak_14': 'Practiced 14 days in a row!',
            'streak_30': 'Practiced 30 days in a row!',
            'chat_master': 'Mastered all Chat lessons!',
            'yap_master': 'Mastered all Yap lessons!',
            'vibe_master': 'Mastered all Vibe lessons!',
            'play_master': 'Mastered all Play lessons!'
        };
        return descriptions[achievementId] || 'Great achievement!';
    }

    animateNumber(element, targetNumber) {
        const startNumber = parseInt(element.textContent) || 0;
        const duration = 1000; // 1 second
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out animation
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentNumber = Math.round(startNumber + (targetNumber - startNumber) * easeOut);
            
            element.textContent = currentNumber;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    formatLessonName(lessonId) {
        if (!lessonId) return 'Basic Weaving';
        
        return lessonId
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const mainContent = document.querySelector('.main-nav');
        
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
        if (mainContent) {
            mainContent.style.display = show ? 'none' : 'block';
        }
    }

    showError(message) {
        const errorEl = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const mainContent = document.querySelector('.main-nav');
        
        if (errorEl) {
            errorEl.style.display = 'block';
        }
        if (errorText) {
            errorText.textContent = message;
        }
        if (mainContent) {
            mainContent.style.display = 'none';
        }
    }

    hideError() {
        const errorEl = document.getElementById('errorMessage');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }
}

// Initialize homepage when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HomePage();
});

// Add some helper functions for potential future use
window.YaptitudeHomepage = {
    refreshProgress: async function() {
        if (window.homepage) {
            await window.homepage.loadUserProgress();
            window.homepage.updateUI();
        }
    },
    
    showNotification: function(message, type = 'info') {
        // Could be used for general notifications
        console.log(`${type.toUpperCase()}: ${message}`);
    }
};