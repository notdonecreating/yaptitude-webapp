// Lessons functionality
class LessonsApp {
    constructor() {
        this.currentConversationId = null;
        this.currentLesson = null;
        this.currentLevel = 'bronze';
        this.messageCount = 0;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadLessons();
    }

    initializeElements() {
        // Main containers
        this.lessonSelector = document.getElementById('lessonSelector');
        this.practiceContainer = document.getElementById('practiceContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Header elements
        this.backButton = document.getElementById('backButton');
        this.currentLessonTitle = document.getElementById('currentLessonTitle');
        this.currentLevel = document.getElementById('currentLevel');
        this.lessonObjective = document.getElementById('lessonObjective');
        
        // Instructions
        this.lessonInstructions = document.getElementById('lessonInstructions');
        this.practicePrompts = document.getElementById('practicePrompts');
        this.hideInstructions = document.getElementById('hideInstructions');
        
        // Character info
        this.characterAvatar = document.getElementById('characterAvatar');
        this.characterName = document.getElementById('characterName');
        this.characterMood = document.getElementById('characterMood');
        
        // Chat elements
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessage = document.getElementById('sendMessage');
        this.characterLimit = document.getElementById('characterLimit');
        
        // Coach elements
        this.callCoach = document.getElementById('callCoach');
        this.coachPanel = document.getElementById('coachPanel');
        this.closeCoach = document.getElementById('closeCoach');
        this.getInstantFeedback = document.getElementById('getInstantFeedback');
        this.getAdvice = document.getElementById('getAdvice');
        this.endPracticeFeedback = document.getElementById('endPracticeFeedback');
        
        // Control buttons
        this.endLesson = document.getElementById('endLesson');
        
        // Modals
        this.feedbackModal = document.getElementById('feedbackModal');
        this.resultsModal = document.getElementById('resultsModal');
        this.feedbackContent = document.getElementById('feedbackContent');
        this.resultsContent = document.getElementById('resultsContent');
        
        // Modal controls
        this.closeFeedback = document.getElementById('closeFeedback');
        this.continuePractice = document.getElementById('continuePractice');
        this.tryAgain = document.getElementById('tryAgain');
        this.nextLevel = document.getElementById('nextLevel');
        this.backToLessons = document.getElementById('backToLessons');
    }

    attachEventListeners() {
        // Navigation
        this.backButton.addEventListener('click', () => this.goHome());
        
        // Instructions
        this.hideInstructions.addEventListener('click', () => {
            this.lessonInstructions.style.display = 'none';
        });
        
        // Chat functionality
        this.sendMessage.addEventListener('click', () => this.sendUserMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendUserMessage();
            }
        });
        this.messageInput.addEventListener('input', () => this.updateCharacterCount());
        
        // Coach functionality
        this.callCoach.addEventListener('click', () => this.toggleCoachPanel());
        this.closeCoach.addEventListener('click', () => this.hideCoachPanel());
        this.getInstantFeedback.addEventListener('click', () => this.requestFeedback('instant'));
        this.getAdvice.addEventListener('click', () => this.requestFeedback('advice'));
        this.endPracticeFeedback.addEventListener('click', () => this.requestFeedback('end_practice'));
        
        // Control buttons
        this.endLesson.addEventListener('click', () => this.endCurrentLesson());
        
        // Modal controls
        this.closeFeedback.addEventListener('click', () => this.hideFeedbackModal());
        this.continuePractice.addEventListener('click', () => this.hideFeedbackModal());
        this.tryAgain.addEventListener('click', () => this.restartLesson());
        this.nextLevel.addEventListener('click', () => this.tryNextLevel());
        this.backToLessons.addEventListener('click', () => this.showLessonSelector());
    }

    async loadLessons() {
        this.showLoading('Loading lessons...');
        
        try {
            const response = await fetch('/api/lessons');
            const data = await response.json();
            
            if (response.ok) {
                this.displayLessons(data.lessons);
            } else {
                this.showError('Failed to load lessons: ' + data.error);
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayLessons(lessons) {
        const grid = document.getElementById('lessonsGrid');
        grid.innerHTML = '';
        
        lessons.forEach(lesson => {
            const card = this.createLessonCard(lesson);
            grid.appendChild(card);
        });
    }

    createLessonCard(lesson) {
        const card = document.createElement('div');
        card.className = `lesson-card ${lesson.category} ${lesson.isUnlocked ? 'unlocked' : 'locked'}`;
        
        const progressWidth = lesson.progress || 0;
        const levelBadges = this.createLevelBadges(lesson);
        
        card.innerHTML = `
            <div class="lesson-header">
                <div class="lesson-category">${lesson.category}</div>
                <div class="lesson-difficulty ${lesson.difficulty}">${lesson.difficulty}</div>
            </div>
            <h3 class="lesson-title">${lesson.title}</h3>
            <p class="lesson-description">${lesson.description}</p>
            <div class="lesson-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressWidth}%"></div>
                </div>
                <span class="progress-text">${progressWidth}% complete</span>
            </div>
            <div class="lesson-levels">
                ${levelBadges}
            </div>
            <div class="lesson-footer">
                <span class="lesson-time">~${lesson.estimatedTime}</span>
                <button class="lesson-start-btn ${lesson.isUnlocked ? '' : 'disabled'}" 
                        ${lesson.isUnlocked ? '' : 'disabled'}
                        data-lesson-id="${lesson.id}" 
                        data-next-level="${lesson.nextLevel}">
                    ${lesson.isUnlocked ? `Start ${lesson.nextLevel}` : 'Locked'}
                </button>
            </div>
        `;
        
        if (lesson.isUnlocked) {
            const startBtn = card.querySelector('.lesson-start-btn');
            startBtn.addEventListener('click', () => {
                this.startLesson(lesson.id, lesson.nextLevel);
            });
        }
        
        return card;
    }

    createLevelBadges(lesson) {
        const levels = ['bronze', 'silver', 'gold'];
        const currentProgress = lesson.progress || 0;
        
        return levels.map(level => {
            let status = 'locked';
            if (currentProgress >= (levels.indexOf(level) + 1) * 33.33) {
                status = 'completed';
            } else if (level === lesson.nextLevel) {
                status = 'current';
            }
            
            return `<span class="level-badge ${level} ${status}">${level}</span>`;
        }).join('');
    }

    async startLesson(lessonId, level) {
        this.showLoading('Starting lesson...');
        
        try {
            const response = await fetch(`/api/lessons/${lessonId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.initializePractice(data);
            } else {
                this.showError('Failed to start lesson: ' + data.error);
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    initializePractice(data) {
        this.currentConversationId = data.conversationId;
        this.currentLesson = data.lesson;
        this.messageCount = 0;
        
        // Update header
        this.currentLessonTitle.textContent = data.lesson.title;
        this.currentLevel.textContent = data.lesson.level.charAt(0).toUpperCase() + data.lesson.level.slice(1);
        this.currentLevel.className = `level-badge ${data.lesson.level}`;
        this.lessonObjective.textContent = data.lesson.objective;
        
        // Update character info
        this.characterAvatar.textContent = data.character.avatar;
        this.characterName.textContent = data.character.name;
        this.characterMood.textContent = '😊';
        
        // Setup instructions
        this.practicePrompts.innerHTML = data.lesson.prompts
            .map(prompt => `<li>${prompt}</li>`)
            .join('');
        this.lessonInstructions.style.display = 'block';
        
        // Clear chat and add starter message
        this.chatMessages.innerHTML = '';
        this.addMessage('ai', data.starterMessage);
        
        // Show practice view
        this.showPracticeView();
    }

    async sendUserMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.currentConversationId) return;
        
        // Validate message length
        if (message.length > 500) {
            this.showError('Message too long (max 500 characters)');
            return;
        }
        
        // Add user message to chat
        this.addMessage('user', message);
        this.messageInput.value = '';
        this.updateCharacterCount();
        this.messageCount++;
        
        // Disable input while processing
        this.setInputEnabled(false);
        
        // Show typing indicator
        this.addTypingIndicator();
        
        try {
            const response = await fetch(`/api/lessons/${this.currentLesson.id}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: this.currentConversationId,
                    message: message
                })
            });
            
            const data = await response.json();
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            if (response.ok) {
                this.addMessage('ai', data.response);
                this.updateCharacterMood(data.mood);
                
                // Show automatic feedback after several exchanges
                if (this.messageCount >= 6 && this.messageCount % 4 === 0) {
                    setTimeout(() => this.requestFeedback('instant'), 1000);
                }
            } else {
                this.addMessage('ai', data.response || 'Sorry, I had trouble understanding.');
                if (data.warning) {
                    this.showWarning(data.warning);
                }
            }
        } catch (error) {
            this.removeTypingIndicator();
            this.addMessage('ai', 'Sorry, I had trouble connecting. Can you try again?');
            this.showError('Network error: ' + error.message);
        } finally {
            this.setInputEnabled(true);
            this.messageInput.focus();
        }
    }

    async requestFeedback(feedbackType) {
        if (!this.currentConversationId) return;
        
        this.hideCoachPanel();
        this.showLoading('Getting feedback...');
        
        try {
            const response = await fetch(`/api/lessons/${this.currentLesson.id}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: this.currentConversationId,
                    feedbackType: feedbackType
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showFeedback(data.feedback, data.assessment, data.recommendations);
            } else {
                this.showFeedback(data.feedback || 'Great job practicing!', null, []);
            }
        } catch (error) {
            this.showFeedback('Keep up the great work!', null, []);
        } finally {
            this.hideLoading();
        }
    }

    async endCurrentLesson() {
        if (!this.currentConversationId) return;
        
        this.showLoading('Ending lesson...');
        
        try {
            const response = await fetch(`/api/lessons/${this.currentLesson.id}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: this.currentConversationId
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showResults(data);
            } else {
                this.showError('Failed to end lesson: ' + data.error);
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // UI Helper Methods
    addMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        if (sender === 'coach') {
            messageDiv.innerHTML = `<span class="coach-icon">🏆</span> ${content}`;
        } else {
            messageDiv.textContent = content;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message ai typing';
        indicator.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
        indicator.id = 'typingIndicator';
        this.chatMessages.appendChild(indicator);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    updateCharacterCount() {
        const length = this.messageInput.value.length;
        this.characterLimit.textContent = `${length}/500`;
        this.characterLimit.className = length > 450 ? 'character-limit warning' : 'character-limit';
    }

    updateCharacterMood(mood) {
        this.characterMood.textContent = mood;
    }

    setInputEnabled(enabled) {
        this.messageInput.disabled = !enabled;
        this.sendMessage.disabled = !enabled;
    }

    toggleCoachPanel() {
        const isVisible = this.coachPanel.style.display === 'block';
        this.coachPanel.style.display = isVisible ? 'none' : 'block';
    }

    hideCoachPanel() {
        this.coachPanel.style.display = 'none';
    }

    showFeedback(feedback, assessment, recommendations) {
        let content = `<div class="feedback-text">${feedback}</div>`;
        
        if (recommendations && recommendations.length > 0) {
            content += `<div class="recommendations">
                <h4>Recommendations:</h4>
                <ul>${recommendations.map(rec => `<li>${rec}</li>`).join('')}</ul>
            </div>`;
        }
        
        this.feedbackContent.innerHTML = content;
        this.feedbackModal.style.display = 'block';
    }

    hideFeedbackModal() {
        this.feedbackModal.style.display = 'none';
    }

    showResults(data) {
        let content = `
            <div class="results-summary">
                <h4>${data.completed ? '🎉 Level Completed!' : '📝 Practice Summary'}</h4>
                <p>${data.feedback}</p>
            </div>
        `;
        
        if (data.assessment) {
            content += `
                <div class="assessment-details">
                    <div class="assessment-grid">
                        <div class="assessment-item">
                            <span class="label">Overall Grade:</span>
                            <span class="value">${Math.round(data.assessment.overallGrade * 100)}%</span>
                        </div>
                        <div class="assessment-item">
                            <span class="label">Messages:</span>
                            <span class="value">${data.assessment.messageCount}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (data.newAchievements && data.newAchievements.length > 0) {
            content += `
                <div class="new-achievements">
                    <h4>🏆 New Achievements!</h4>
                    ${data.newAchievements.map(achievement => 
                        `<div class="achievement">${achievement}</div>`
                    ).join('')}
                </div>
            `;
        }
        
        this.resultsContent.innerHTML = content;
        
        // Show appropriate buttons
        if (data.completed) {
            this.nextLevel.style.display = 'inline-block';
        } else {
            this.nextLevel.style.display = 'none';
        }
        
        this.resultsModal.style.display = 'block';
    }

    restartLesson() {
        this.resultsModal.style.display = 'none';
        this.startLesson(this.currentLesson.id, this.currentLesson.level);
    }

    tryNextLevel() {
        this.resultsModal.style.display = 'none';
        const nextLevel = this.currentLesson.level === 'bronze' ? 'silver' : 'gold';
        this.startLesson(this.currentLesson.id, nextLevel);
    }

    showLessonSelector() {
        this.resultsModal.style.display = 'none';
        this.practiceContainer.style.display = 'none';
        this.lessonSelector.style.display = 'block';
        this.loadLessons(); // Refresh progress
    }

    showPracticeView() {
        this.lessonSelector.style.display = 'none';
        this.practiceContainer.style.display = 'block';
        this.messageInput.focus();
    }

    showLoading(text) {
        document.getElementById('loadingText').textContent = text;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    showError(message) {
        // Simple error handling for now
        console.error('Lessons error:', message);
        alert('Error: ' + message);
    }

    showWarning(message) {
        console.warn('Lessons warning:', message);
    }

    goHome() {
        window.location.href = '/';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LessonsApp();
});