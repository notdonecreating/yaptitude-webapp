const express = require('express');
const router = express.Router();

// Load data
const scenariosData = require('../data/scenarios.json');
const charactersData = require('../data/characters.json');

// Get all available scenarios
router.get('/', async (req, res) => {
    try {
        const sessionId = req.sessionId;
        const userProgress = await req.progressService.getUserProgress(sessionId);
        
        // Check if user has completed at least one lesson
        const hasCompletedLesson = Object.values(userProgress.lessonProgress).some(
            progress => progress.completedLevels && progress.completedLevels.length > 0
        );

        const scenarios = [];
        for (const [scenarioId, scenarioData] of Object.entries(scenariosData.scenarios)) {
            scenarios.push({
                id: scenarioId,
                name: scenarioData.name,
                description: scenarioData.description,
                icon: scenarioData.icon,
                mood: scenarioData.mood,
                difficulty: scenarioData.difficulty,
                isUnlocked: hasCompletedLesson,
                charactersAvailable: scenarioData.characters_present.length,
                goodForPracticing: scenarioData.good_for_practicing
            });
        }

        res.json({ scenarios });
    } catch (error) {
        console.error('Error getting scenarios:', error);
        res.status(500).json({ error: 'Failed to load scenarios' });
    }
});

// Get characters available for a scenario
router.get('/:scenarioId/characters', (req, res) => {
    try {
        const { scenarioId } = req.params;
        
        const scenarioData = scenariosData.scenarios[scenarioId];
        if (!scenarioData) {
            return res.status(404).json({ error: 'Scenario not found' });
        }

        const characters = scenarioData.characters_present.map(characterId => {
            const character = charactersData[characterId];
            return {
                id: characterId,
                name: character.name,
                type: character.type,
                description: character.description,
                avatar: character.avatar,
                personality: character.core_traits.persona
            };
        });

        res.json({ characters });
    } catch (error) {
        console.error('Error getting scenario characters:', error);
        res.status(500).json({ error: 'Failed to load characters' });
    }
});

// Get available missions for scenarios
router.get('/missions', (req, res) => {
    try {
        const missions = [];
        for (const [missionId, missionData] of Object.entries(scenariosData.missions)) {
            missions.push({
                id: missionId,
                name: missionData.name,
                description: missionData.description,
                difficulty: missionData.difficulty,
                successCriteria: missionData.success_criteria
            });
        }

        res.json({ missions });
    } catch (error) {
        console.error('Error getting missions:', error);
        res.status(500).json({ error: 'Failed to load missions' });
    }
});

// Start scenario practice
router.post('/:scenarioId/start', async (req, res) => {
    try {
        const { scenarioId } = req.params;
        const { characterId, mission = null } = req.body;
        const sessionId = req.sessionId;

        // Rate limiting check
        const rateLimit = req.sessionService.checkRateLimit(sessionId, 'conversation_start');
        if (!rateLimit.allowed) {
            return res.status(429).json({ 
                error: 'Too many conversations started',
                resetTime: rateLimit.resetTime
            });
        }

        // Validate scenario
        const scenarioData = scenariosData.scenarios[scenarioId];
        if (!scenarioData) {
            return res.status(404).json({ error: 'Scenario not found' });
        }

        // Check if scenarios are unlocked for user
        const userProgress = await req.progressService.getUserProgress(sessionId);
        const hasCompletedLesson = Object.values(userProgress.lessonProgress).some(
            progress => progress.completedLevels && progress.completedLevels.length > 0
        );

        if (!hasCompletedLesson) {
            return res.status(403).json({ 
                error: 'Complete at least one lesson before accessing scenarios' 
            });
        }

        // Validate character
        if (!characterId) {
            return res.status(400).json({ error: 'Character ID required' });
        }

        const character = charactersData[characterId];
        if (!character || !scenarioData.characters_present.includes(characterId)) {
            return res.status(400).json({ error: 'Invalid character for this scenario' });
        }

        // Validate mission if provided
        let missionData = null;
        if (mission) {
            missionData = scenariosData.missions[mission];
            if (!missionData) {
                return res.status(400).json({ error: 'Invalid mission' });
            }
        }

        // Start conversation
        const conversationId = req.sessionService.startConversation(sessionId, 'scenario', {
            scenario: scenarioData,
            characterId,
            character,
            mission: missionData
        });

        // Generate contextual starter message
        const starters = scenarioData.conversation_starters;
        const contextualStarter = starters[Math.floor(Math.random() * starters.length)];
        
        // Character-specific greeting with context
        const greetings = {
            quiet_observer: `*glances up briefly* ${contextualStarter}`,
            laid_back_guy: `*relaxed* Hey. ${contextualStarter}`,
            bubbly_nervous: `*smiles nervously* Hi! ${contextualStarter}`,
            self_centered: `*confident* ${contextualStarter}`,
            curious_questioner: `*looks interested* ${contextualStarter}`
        };

        const starterMessage = greetings[characterId] || `*notices you* ${contextualStarter}`;

        // Add starter message to conversation
        req.sessionService.addMessage(conversationId, {
            role: 'assistant',
            content: starterMessage
        });

        res.json({
            conversationId,
            starterMessage,
            scenario: {
                id: scenarioId,
                name: scenarioData.name,
                description: scenarioData.description,
                mood: scenarioData.mood,
                timeOfDay: scenarioData.time_of_day,
                backgroundDescription: scenarioData.background_description,
                socialNorms: scenarioData.social_norms,
                conversationStarters: scenarioData.conversation_starters,
                difficulty: scenarioData.difficulty
            },
            character: {
                id: characterId,
                name: character.name,
                type: character.type,
                avatar: character.avatar,
                description: character.description
            },
            mission: missionData ? {
                id: mission,
                name: missionData.name,
                description: missionData.description,
                successCriteria: missionData.success_criteria,
                difficulty: missionData.difficulty
            } : null,
            rateLimit: {
                remaining: rateLimit.remaining
            }
        });

    } catch (error) {
        console.error('Error starting scenario:', error);
        res.status(500).json({ error: 'Failed to start scenario' });
    }
});

// Send message in scenario
router.post('/:scenarioId/message', async (req, res) => {
    try {
        const { scenarioId } = req.params;
        const { conversationId, message } = req.body;
        const sessionId = req.sessionId;

        // Rate limiting check
        const rateLimit = req.sessionService.checkRateLimit(sessionId, 'message');
        if (!rateLimit.allowed) {
            return res.status(429).json({ 
                error: 'Too many messages sent',
                resetTime: rateLimit.resetTime
            });
        }

        // Validate input
        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        if (message.length > 500) {
            return res.status(400).json({ error: 'Message too long (max 500 characters)' });
        }

        // Get conversation
        const conversation = req.sessionService.getConversation(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Verify conversation belongs to this session
        if (conversation.sessionId !== sessionId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check if conversation is still active
        if (conversation.status !== 'active') {
            return res.status(400).json({ error: 'Conversation is not active' });
        }

        // Add user message
        req.sessionService.addMessage(conversationId, {
            role: 'user',
            content: message.trim()
        });

        // Get conversation history (limit to recent messages)
        const history = req.sessionService.getConversationHistory(conversationId, 16);

        // Generate AI response
        const aiResult = await req.aiService.generateResponse({
            userMessage: message.trim(),
            conversationHistory: history,
            character: conversation.character,
            context: 'scenario',
            contextData: conversation.config
        });

        if (!aiResult.success) {
            console.error('AI service failed:', aiResult.error);
            // Return character-specific fallback
            const fallbacks = {
                quiet_observer: "*looks confused* Sorry, what?",
                laid_back_guy: "*shrugs* Didn't catch that.",
                bubbly_nervous: "*laughs nervously* Um, sorry, can you say that again?",
                self_centered: "*distracted* What was that?",
                curious_questioner: "*tilts head* Could you repeat that?"
            };
            
            const fallbackResponse = fallbacks[conversation.character.id] || "Sorry, I didn't understand that.";
            
            req.sessionService.addMessage(conversationId, {
                role: 'assistant',
                content: fallbackResponse
            });

            return res.json({
                response: fallbackResponse,
                mood: '😐',
                character: conversation.character.name,
                conversationId,
                warning: 'Using fallback response',
                rateLimit: {
                    remaining: rateLimit.remaining
                }
            });
        }

        // Add AI response to conversation
        req.sessionService.addMessage(conversationId, {
            role: 'assistant',
            content: aiResult.response
        });

        // Check mission progress if applicable
        let missionProgress = null;
        if (conversation.config.mission) {
            missionProgress = checkMissionProgress(conversation, history);
        }

        // Update conversation stats
        const stats = req.sessionService.getConversationStats(conversationId);

        res.json({
            response: aiResult.response,
            mood: aiResult.mood,
            character: conversation.character.name,
            conversationId,
            missionProgress,
            stats: {
                messageCount: stats.messageCount,
                duration: stats.duration
            },
            rateLimit: {
                remaining: rateLimit.remaining
            }
        });

    } catch (error) {
        console.error('Error processing scenario message:', error);
        res.status(500).json({ 
            error: 'Failed to process message',
            response: 'Sorry, I had trouble understanding. Can you try again?',
            mood: '😐'
        });
    }
});

// End scenario practice
router.post('/:scenarioId/end', async (req, res) => {
    try {
        const { scenarioId } = req.params;
        const { conversationId } = req.body;
        const sessionId = req.sessionId;

        const conversation = req.sessionService.getConversation(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Verify conversation belongs to this session
        if (conversation.sessionId !== sessionId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const history = req.sessionService.getConversationHistory(conversationId);
        
        // Calculate performance metrics
        const performance = {
            duration: Date.now() - conversation.startTime,
            messageCount: conversation.messageCount,
            userMessageCount: history.filter(msg => msg.role === 'user').length,
            averageResponseLength: 0
        };

        const userMessages = history.filter(msg => msg.role === 'user');
        if (userMessages.length > 0) {
            performance.averageResponseLength = Math.round(
                userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length
            );
        }

        // Check mission completion if applicable
        let missionResult = null;
        if (conversation.config.mission) {
            missionResult = checkMissionProgress(conversation, history);
            performance.missionCompleted = missionResult.completed;
        }

        // Record scenario progress
        await req.progressService.recordScenarioProgress(
            sessionId,
            scenarioId,
            conversation.character.id,
            performance
        );

        // End conversation and get summary
        const summary = req.sessionService.endConversation(conversationId);

        // Generate brief feedback
        let feedback = "Great conversation practice! ";
        if (performance.messageCount >= 8) {
            feedback += "You kept the conversation going well. ";
        }
        if (performance.averageResponseLength > 20) {
            feedback += "Your responses were detailed and engaging. ";
        }
        if (missionResult && missionResult.completed) {
            feedback += `Mission "${conversation.config.mission.name}" completed successfully! `;
        }

        res.json({
            summary: {
                duration: Math.round(performance.duration / 1000), // Convert to seconds
                messageCount: performance.messageCount,
                userMessageCount: performance.userMessageCount,
                averageResponseLength: performance.averageResponseLength,
                character: conversation.character.name,
                scenario: scenariosData.scenarios[scenarioId].name
            },
            missionResult,
            feedback,
            performance: {
                rating: calculatePerformanceRating(performance),
                strengths: identifyStrengths(performance, history),
                suggestions: generateSuggestions(performance, history)
            }
        });

    } catch (error) {
        console.error('Error ending scenario:', error);
        res.status(500).json({ error: 'Failed to end scenario' });
    }
});

// Helper function to check mission progress
function checkMissionProgress(conversation, history) {
    if (!conversation.config.mission) return null;

    const mission = conversation.config.mission;
    const userMessages = history.filter(msg => msg.role === 'user');
    
    // Basic mission progress tracking
    const progress = {
        missionId: mission.id,
        criteria: mission.success_criteria,
        completed: false,
        progress: 0
    };

    // Simple heuristics for different mission types
    switch (mission.id) {
        case 'get_contact_info':
            progress.completed = userMessages.some(msg => 
                msg.content.toLowerCase().includes('number') || 
                msg.content.toLowerCase().includes('contact') ||
                msg.content.toLowerCase().includes('reach you')
            );
            break;
        case 'make_plans':
            progress.completed = userMessages.some(msg => 
                msg.content.toLowerCase().includes('want to') || 
                msg.content.toLowerCase().includes('should we') ||
                msg.content.toLowerCase().includes('let\'s')
            );
            break;
        case 'give_compliment':
            progress.completed = userMessages.some(msg => 
                msg.content.toLowerCase().includes('love') || 
                msg.content.toLowerCase().includes('great') ||
                msg.content.toLowerCase().includes('nice') ||
                msg.content.toLowerCase().includes('awesome')
            );
            break;
    }

    progress.progress = progress.completed ? 100 : Math.min(90, userMessages.length * 20);
    
    return progress;
}

// Helper function to calculate performance rating
function calculatePerformanceRating(performance) {
    let score = 0;
    
    // Message count scoring (0-40 points)
    if (performance.messageCount >= 10) score += 40;
    else if (performance.messageCount >= 6) score += 30;
    else if (performance.messageCount >= 3) score += 20;
    else score += 10;
    
    // Response length scoring (0-30 points)
    if (performance.averageResponseLength >= 30) score += 30;
    else if (performance.averageResponseLength >= 15) score += 20;
    else if (performance.averageResponseLength >= 5) score += 10;
    
    // Duration scoring (0-20 points) - sweet spot is 3-10 minutes
    const durationMinutes = performance.duration / (1000 * 60);
    if (durationMinutes >= 3 && durationMinutes <= 10) score += 20;
    else if (durationMinutes >= 1) score += 10;
    
    // Mission completion bonus (0-10 points)
    if (performance.missionCompleted) score += 10;
    
    // Convert to rating
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'needs_improvement';
}

// Helper function to identify strengths
function identifyStrengths(performance, history) {
    const strengths = [];
    
    if (performance.messageCount >= 8) {
        strengths.push('Maintained conversation well');
    }
    
    if (performance.averageResponseLength > 25) {
        strengths.push('Provided detailed, thoughtful responses');
    }
    
    const userMessages = history.filter(msg => msg.role === 'user');
    const questionCount = userMessages.filter(msg => msg.content.includes('?')).length;
    if (questionCount >= 2) {
        strengths.push('Asked engaging questions');
    }
    
    if (performance.missionCompleted) {
        strengths.push('Successfully completed mission objective');
    }
    
    return strengths.length > 0 ? strengths : ['Participated in conversation practice'];
}

// Helper function to generate suggestions
function generateSuggestions(performance, history) {
    const suggestions = [];
    
    if (performance.messageCount < 6) {
        suggestions.push('Try to keep conversations going longer');
    }
    
    if (performance.averageResponseLength < 15) {
        suggestions.push('Add more detail to your responses');
    }
    
    const userMessages = history.filter(msg => msg.role === 'user');
    const questionCount = userMessages.filter(msg => msg.content.includes('?')).length;
    if (questionCount < 2) {
        suggestions.push('Ask more questions to show interest');
    }
    
    if (!performance.missionCompleted && performance.missionCompleted !== undefined) {
        suggestions.push('Focus on completing the mission objective');
    }
    
    return suggestions.length > 0 ? suggestions : ['Keep practicing to improve your skills'];
}

module.exports = router;