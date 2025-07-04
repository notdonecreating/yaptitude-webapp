// Scenarios functionality
class ScenariosApp {
    constructor() {
        this.currentConversationId = null;
        this.currentScenario = null;
        this.selectedCharacter = null;
        this.selectedMission = null;
        this.messageCount = 0;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadScenarios();
    }

    initializeElements() {
        // Main containers
        this.scenarioSelector = document.getElementById('scenarioSelector');
        this.characterSelector = document.getElementById('characterSelector');
        this.scenarioPractice = document.getElementById('scenarioPractice');
        this.loadingOverlay = document.getElementById('scenarioLoadingOverlay');
        this.errorMessage = document.getElementById('scenarioErrorMessage');
        
        // Header elements
        this.backButton = document.getElementById('backButton');
        this.backToScenarios = document.getElementById('backToScenarios');
        
        // Scenario selection
        this.scenariosGrid = document.getElementById('scenariosGrid');
        this.selectedScenarioName = document.getElementById('selectedScenarioName');
        this.selectedScenarioDescription = document.getElementById('selectedScenarioDescription');
        
        // Character selection
        this.charactersGrid = document.getElementById('charactersGrid');
        this.missionsGrid = document.getElementById('missionsGrid');
        this.startScenario = document.getElementById('startScenario');
        
        // Practice elements
        this.scenarioBadge = document.getElementById('scenarioBadge');
        this.timeBadge = document.getElementById('timeBadge');
        this.moodBadge = document.getElementById('moodBadge');
        this.missionIndicator = document.getElementById('missionIndicator');
        this.missionText = document.getElementById('missionText');
        this.missionProgress = document.getElementById('missionProgress');
        
        // Scene description
        this.sceneDescription = document.getElementById('sceneDescription');
        this.sceneText = document.getElementById('sceneText');
        this.hideScene = document.getElementById('hideScene');
        
        // Character info
        this.practiceCharacterAvatar = document.getElementById('practiceCharacterAvatar');
        this.practiceCharacterName = document.getElementById('practiceCharacterName');
        this.practiceCharacterMood = document.getElementById('practiceCharacterMood');
        
        // Chat elements
        this.scenarioChatMessages = document.getElementById('scenarioChatMessages');
        this.scenarioMessageInput = document.getElementById('scenarioMessageInput');
        this.sendScenarioMessage = document.getElementById('sendScenarioMessage');
        this.scenarioCharacterLimit = document.getElementById('scenarioCharacterLimit');
        
        // Control buttons
        this.endScenario = document.getElementById('endScenario');
        
        // Results modal
        this.scenarioResultsModal = document.getElementById('scenarioResultsModal');
        this.scenarioSummary = document.getElementById('scenarioSummary');
        this.performanceFeedback = document.getElementById('performanceFeedback');
        this.tryScenarioAgain = document.getElementById('tryScenarioAgain');
        this.newScenario = document.getElementById('newScenario');
        this.backToScenariosFromResults = document.getElementById('backToScenariosFromResults');
        
        // Error elements
        this.scenarioErrorText = document.getElementById('scenarioErrorText');
        this.scenarioRetryButton = document.getElementById('scenarioRetryButton');
    }

    attachEventListeners() {
        // Navigation
        this.backButton.addEventListener('click', () => this.goHome());
        this.backToScenarios.addEventListener('click', () => this.showScenarioSelector());
        this.hideScene.addEventListener('click', () => {
            this.sceneDescription.style.display = 'none';
        });
        
        // Scenario selection
        this.startScenario.addEventListener('click', () => this.startSelectedScenario());
        
        // Chat functionality
        this.sendScenarioMessage.addEventListener('click', () => this.sendUserMessage());
        this.scenarioMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendUserMessage();
            }
        });
        this.scenarioMessageInput.addEventListener('input', () => this.updateCharacterCount());
        
        // Control buttons
        this.endScenario.addEventListener('click', () => this.endCurrentScenario());
        
        // Results modal
        this.tryScenarioAgain.addEventListener('click', () => this.restartScenario());
        this.newScenario.addEventListener('click', () => this.showScenarioSelector());
        this.backToScenariosFromResults.addEventListener('click', () => this.showScenarioSelector());
        
        // Error handling
        this.scenarioRetryButton.addEventListener('click', () => this.loadScenarios());
    }

    async loadScenarios() {
        this.showLoading('Loading scenarios...');
        
        try {
            const [scenariosResponse, missionsResponse] = await Promise.all([
                fetch('/api/scenarios'),
                fetch('/api/scenarios/missions')
            ]);
            
            const scenariosData = await scenariosResponse.json();
            const missionsData = await missionsResponse.json();
            
            if (scenariosResponse.ok && missionsResponse.ok) {
                this.scenarios = scenariosData.scenarios;
                this.missions = missionsData.missions;
                this.displayScenarios(scenariosData.scenarios);
                this.hideError();
            } else {
                throw new Error(scenariosData.error || missionsData.error || 'Failed to load data');
            }
        } catch (error) {
            this.showError('Failed to load scenarios: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayScenarios(scenarios) {
        this.scenariosGrid.innerHTML = '';
        
        scenarios.forEach(scenario => {
            const card = this.createScenarioCard(scenario);
            this.scenariosGrid.appendChild(card);
        });
    }

    createScenarioCard(scenario) {
        const card = document.createElement('div');
        card.className = `scenario-card ${scenario.difficulty} ${scenario.isUnlocked ? 'unlocked' : 'locked'}`;
        
        card.innerHTML = `
            <div class="scenario-header">
                <div class="scenario-icon">${scenario.icon}</div>
                <div class="scenario-mood ${scenario.mood}">${scenario.mood}</div>
            </div>
            <h3 class="scenario-title">${scenario.name}</h3>
            <p class="scenario-description">${scenario.description}</p>
            <div class="scenario-info">
                <span class="difficulty-badge ${scenario.difficulty}">${scenario.difficulty}</span>
                <span class="characters-count">${scenario.charactersAvailable} characters</span>
            </div>
            <div class="scenario-skills">
                <small>Good for: ${scenario.goodForPracticing.join(', ')}</small>
            </div>
            <button class="scenario-select-btn ${scenario.isUnlocked ? '' : 'disabled'}" 
                    ${scenario.isUnlocked ? '' : 'disabled'}
                    data-scenario-id="${scenario.id}">
                ${scenario.isUnlocked ? 'Select' : 'Complete a lesson first'}
            </button>
        `;
        
        if (scenario.isUnlocked) {
            const selectBtn = card.querySelector('.scenario-select-btn');
            selectBtn.addEventListener('click', () => {
                this.selectScenario(scenario);
            });
        }
        
        return card;
    }

    async selectScenario(scenario) {
        this.currentScenario = scenario;
        this.showLoading('Loading characters...');
        
        try {
            const response = await fetch(`/api/scenarios/${scenario.id}/characters`);
            const data = await response.json();
            
            if (response.ok) {
                this.displayCharacterSelection(scenario, data.characters);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showError('Failed to load characters: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    displayCharacterSelection(scenario, characters) {
        // Update scenario info
        this.selectedScenarioName.textContent = scenario.name;
        this.selectedScenarioDescription.textContent = scenario.description;
        
        // Display characters
        this.charactersGrid.innerHTML = '';
        characters.forEach(character => {
            const card = this.createCharacterCard(character);
            this.charactersGrid.appendChild(card);
        });
        
        // Display missions
        this.displayMissionSelection();
        
        // Show character selector
        this.showCharacterSelector();
    }

    createCharacterCard(character) {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.dataset.characterId = character.id;
        
        card.innerHTML = `
            <div class="character-avatar">${character.avatar}</div>
            <h4 class="character-name">${character.name}</h4>
            <p class="character-type">${character.type}</p>
            <p class="character-personality">${character.personality}</p>
        `;
        
        card.addEventListener('click', () => this.selectCharacter(character, card));
        
        return card;
    }

    displayMissionSelection() {
        // Clear existing missions except the "no mission" option
        const existingMissions = this.missionsGrid.querySelectorAll('.mission-card:not(.no-mission)');
        existingMissions.forEach(card => card.remove());
        
        // Add available missions
        this.missions.forEach(mission => {
            const card = this.createMissionCard(mission);
            this.missionsGrid.appendChild(card);
        });
    }

    createMissionCard(mission) {
        const card = document.createElement('div');
        card.className = 'mission-card';
        card.dataset.missionId = mission.id;
        
        const difficultyIcons = {
            easy: '⭐',
            medium: '⭐⭐',
            hard: '⭐⭐⭐'
        };
        
        card.innerHTML = `
            <div class="mission-icon">${difficultyIcons[mission.difficulty] || '⭐'}</div>
            <h4 class="mission-name">${mission.name}</h4>
            <p class="mission-description">${mission.description}</p>
            <div class="mission-difficulty ${mission.difficulty}">${mission.difficulty}</div>
        `;
        
        card.addEventListener('click', () => this.selectMission(mission, card));
        
        return card;
    }

    selectCharacter(character, cardElement) {
        // Remove previous selection
        this.charactersGrid.querySelectorAll('.character-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Select this character
        cardElement.classList.add('selected');
        this.selectedCharacter = character;
        
        this.updateStartButton();
    }

    selectMission(mission, cardElement) {
        // Remove previous selection
        this.missionsGrid.querySelectorAll('.mission-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Select this mission
        cardElement.classList.add('selected');
        this.selectedMission = mission.id === undefined ? null : mission;
        
        this.updateStartButton();
    }

    updateStartButton() {
        const canStart = this.selectedCharacter !== null;
        this.startScenario.disabled = !canStart;
        
        if (canStart) {
            const missionText = this.selectedMission ? ` (${this.selectedMission.name})` : '';
            this.startScenario.textContent = `Start with ${this.selectedCharacter.name}${missionText}`;
        } else {
            this.startScenario.textContent = 'Select a character';
        }
    }

    async startSelectedScenario() {
        if (!this.selectedCharacter) return;
        
        this.showLoading('Starting scenario...');
        
        try {
            const requestBody = {
                characterId: this.selectedCharacter.id
            };
            
            if (this.selectedMission) {
                requestBody.mission = this.selectedMission.id;
            }
            
            const response = await fetch(`/api/scenarios/${this.currentScenario.id}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.initializePractice(data);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showError('Failed to start scenario: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    initializePractice(data) {
        this.currentConversationId = data.conversationId;
        this.messageCount = 0;
        
        // Update scenario context
        this.scenarioBadge.textContent = `${data.scenario.icon} ${data.scenario.name}`;
        this.timeBadge.textContent = data.scenario.timeOfDay;
        this.moodBadge.textContent = data.scenario.mood;
        
        // Setup mission if present
        if (data.mission) {
            this.missionIndicator.style.display = 'block';
            this.missionText.textContent = `Mission: ${data.mission.name}`;
            this.missionProgress.style.width = '0%';
        } else {
            this.missionIndicator.style.display = 'none';
        }
        
        // Update character info
        this.practiceCharacterAvatar.textContent = data.character.avatar;
        this.practiceCharacterName.textContent = data.character.name;
        this.practiceCharacterMood.textContent = '😊';
        
        // Setup scene description
        this.sceneText.textContent = data.scenario.backgroundDescription;
        this.sceneDescription.style.display = 'block';
        
        // Clear chat and add starter message
        this.scenarioChatMessages.innerHTML = '';
        this.addMessage('ai', data.starterMessage);
        
        // Show practice view
        this.showPracticeView();
    }

    async sendUserMessage() {
        const message = this.scenarioMessageInput.value.trim();
        if (!message || !this.currentConversationId) return;
        
        // Validate message length
        if (message.length > 500) {
            this.showError('Message too long (max 500 characters)');
            return;
        }
        
        // Add user message to chat
        this.addMessage('user', message);
        this.scenarioMessageInput.value = '';
        this.updateCharacterCount();
        this.messageCount++;
        
        // Disable input while processing
        this.setInputEnabled(false);
        
        // Show typing indicator
        this.addTypingIndicator();
        
        try {
            const response = await fetch(`/api/scenarios/${this.currentScenario.id}/message`, {
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
                
                // Update mission progress if applicable
                if (data.missionProgress) {
                    this.updateMissionProgress(data.missionProgress);
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
            this.scenarioMessageInput.focus();
        }
    }

    async endCurrentScenario() {
        if (!this.currentConversationId) return;
        
        this.showLoading('Ending scenario...');
        
        try {
            const response = await fetch(`/api/scenarios/${this.currentScenario.id}/end`, {
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
                throw new Error(data.error);
            }
        } catch (error) {
            this.showError('Failed to end scenario: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // UI Helper Methods
    addMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = content;
        
        this.scenarioChatMessages.appendChild(messageDiv);
        this.scenarioChatMessages.scrollTop = this.scenarioChatMessages.scrollHeight;
    }

    addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message ai typing';
        indicator.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
        indicator.id = 'scenarioTypingIndicator';
        this.scenarioChatMessages.appendChild(indicator);
        this.scenarioChatMessages.scrollTop = this.scenarioChatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('scenarioTypingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    updateCharacterCount() {
        const length = this.scenarioMessageInput.value.length;
        this.scenarioCharacterLimit.textContent = `${length}/500`;
        this.scenarioCharacterLimit.className = length > 450 ? 'character-limit warning' : 'character-limit';
    }

    updateCharacterMood(mood) {
        this.practiceCharacterMood.textContent = mood;
    }

    updateMissionProgress(missionProgress) {
        if (missionProgress && this.missionIndicator.style.display !== 'none') {
            this.missionProgress.style.width = `${missionProgress.progress}%`;
            
            if (missionProgress.completed) {
                this.missionText.textContent = `Mission Complete: ${missionProgress.missionId}`;
                this.missionText.classList.add('completed');
            }
        }
    }

    setInputEnabled(enabled) {
        this.scenarioMessageInput.disabled = !enabled;
        this.sendScenarioMessage.disabled = !enabled;
    }

    showResults(data) {
        // Display summary
        let summaryContent = `
            <div class="conversation-stats">
                <h4>Conversation Summary</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Duration:</span>
                        <span class="stat-value">${Math.floor(data.summary.duration / 60)}m ${data.summary.duration % 60}s</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Messages:</span>
                        <span class="stat-value">${data.summary.messageCount}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Character:</span>
                        <span class="stat-value">${data.summary.character}</span>
                    </div>
                </div>
            </div>
        `;
        
        if (data.missionResult) {
            summaryContent += `
                <div class="mission-result ${data.missionResult.completed ? 'completed' : 'incomplete'}">
                    <h4>${data.missionResult.completed ? '🎉 Mission Completed!' : '📝 Mission Progress'}</h4>
                    <div class="mission-progress-bar">
                        <div class="progress-fill" style="width: ${data.missionResult.progress}%"></div>
                    </div>
                    <p>${data.missionResult.progress}% complete</p>
                </div>
            `;
        }
        
        this.scenarioSummary.innerHTML = summaryContent;
        
        // Display performance feedback
        let feedbackContent = `
            <div class="general-feedback">
                <p>${data.feedback}</p>
            </div>
        `;
        
        if (data.performance) {
            feedbackContent += `
                <div class="performance-details">
                    <div class="performance-rating ${data.performance.rating}">
                        <h4>Performance: ${data.performance.rating.replace('_', ' ')}</h4>
                    </div>
            `;
            
            if (data.performance.strengths.length > 0) {
                feedbackContent += `
                    <div class="strengths">
                        <h5>✅ Strengths:</h5>
                        <ul>${data.performance.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
                    </div>
                `;
            }
            
            if (data.performance.suggestions.length > 0) {
                feedbackContent += `
                    <div class="suggestions">
                        <h5>💡 Suggestions:</h5>
                        <ul>${data.performance.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
                    </div>
                `;
            }
            
            feedbackContent += '</div>';
        }
        
        this.performanceFeedback.innerHTML = feedbackContent;
        this.scenarioResultsModal.style.display = 'block';
    }

    restartScenario() {
        this.scenarioResultsModal.style.display = 'none';
        this.startSelectedScenario();
    }

    // Navigation Methods
    showScenarioSelector() {
        this.scenarioResultsModal.style.display = 'none';
        this.characterSelector.style.display = 'none';
        this.scenarioPractice.style.display = 'none';
        this.scenarioSelector.style.display = 'block';
        
        // Reset selections
        this.selectedCharacter = null;
        this.selectedMission = null;
        this.currentConversationId = null;
        
        // Refresh scenarios
        this.loadScenarios();
    }

    showCharacterSelector() {
        this.scenarioSelector.style.display = 'none';
        this.characterSelector.style.display = 'block';
    }

    showPracticeView() {
        this.characterSelector.style.display = 'none';
        this.scenarioPractice.style.display = 'block';
        this.scenarioMessageInput.focus();
    }

    showLoading(text) {
        document.getElementById('scenarioLoadingText').textContent = text;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    showError(message) {
        console.error('Scenarios error:', message);
        this.scenarioErrorText.textContent = message;
        this.errorMessage.style.display = 'block';
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    showWarning(message) {
        console.warn('Scenarios warning:', message);
    }

    goHome() {
        window.location.href = '/';
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScenariosApp();
});