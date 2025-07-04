const express = require('express');
const router = express.Router();
const Lesson = require('../src/models/Lesson');

// Load data
const lessonsData = require('../data/lessons.json');
const charactersData = require('../data/characters.json');

// Add this test route right after your requires
router.get('/test', (req, res) => {
    res.json({ message: 'Lessons route is working!' });
});

// In routes/lessons.js, update the debug route:
router.get('/debug/:lessonId', async (req, res) => {
    try {
        console.log('Debug route called');
        console.log('Session ID:', req.sessionId);
        
        // Use the practice partner character for testing
        const charactersData = require('../data/characters.json');
        const testCharacter = charactersData.practice_partner;
        
        // Test AI service with proper character
        const testResult = await req.aiService.generateResponse({
            userMessage: "Hello",
            conversationHistory: [],
            character: testCharacter,  // Use real character data
            context: 'test',
            contextData: {}  // Add empty contextData
        });
        
        res.json({
            services: {
                ai: !!req.aiService,
                progress: !!req.progressService,
                session: !!req.sessionService
            },
            character: testCharacter.name,
            aiTest: testResult
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Get all available lessons
router.get('/', async (req, res) => {
    try {
        const sessionId = req.sessionId; // Set by middleware
        const userProgress = await req.progressService.getUserProgress(sessionId);
        
        const lessons = [];
        for (const [lessonId, lessonData] of Object.entries(lessonsData.lessons)) {
            const lesson = new Lesson(lessonData);
            const progress = userProgress.lessonProgress[lessonId];
            
            lessons.push({
                id: lessonId,
                title: lesson.title,
                category: lesson.category,
                description: lesson.description,
                difficulty: lesson.difficulty,
                estimatedTime: lesson.estimatedTime,
                isUnlocked: lesson.isUnlocked(userProgress.lessonProgress),
                progress: progress ? lesson.calculateProgress(progress) : 0,
                nextLevel: progress ? lesson.getNextLevel(progress) : 'bronze'
            });
        }

        res.json({ lessons });
    } catch (error) {
        console.error('Error getting lessons:', error);
        res.status(500).json({ error: 'Failed to load lessons' });
    }
});

// Start lesson practice
router.post('/:lessonId/start', async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { level = 'bronze' } = req.body;
        const sessionId = req.sessionId;

        // Rate limiting check
        const rateLimit = req.sessionService.checkRateLimit(sessionId, 'conversation_start');
        if (!rateLimit.allowed) {
            return res.status(429).json({ 
                error: 'Too many conversations started',
                resetTime: rateLimit.resetTime
            });
        }

        // Validate lesson exists
        const lessonData = lessonsData.lessons[lessonId];
        if (!lessonData) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        const lesson = new Lesson(lessonData);
        
        // Validate level
        if (!['bronze', 'silver', 'gold'].includes(level)) {
            return res.status(400).json({ error: 'Invalid level' });
        }

        // Check if lesson is unlocked
        const userProgress = await req.progressService.getUserProgress(sessionId);
        if (!lesson.isUnlocked(userProgress.lessonProgress)) {
            return res.status(403).json({ error: 'Lesson not unlocked' });
        }

        // Check if level is unlocked
        const lessonProgress = userProgress.lessonProgress[lessonId];
        if (!lesson.isLevelUnlocked(level, lessonProgress)) {
            return res.status(403).json({ error: 'Level not unlocked' });
        }

        const practiceCharacter = charactersData.practice_partner;

        // Start conversation
        const conversationId = req.sessionService.startConversation(sessionId, 'lesson', {
            lesson: lessonData,
            level,
            character: practiceCharacter
        });

        // Generate starter message
        const starterMessages = [
            `Hi! I'm ${practiceCharacter.name}, and I'm here to help you practice ${lesson.title.toLowerCase()}. Ready to get started?`,
            `Welcome to ${lesson.title} practice! I'll help you work on this skill. Let's begin!`,
            `Hey there! Time to practice ${lesson.title.toLowerCase()}. I'll be your practice partner today.`
        ];
        const starterMessage = starterMessages[Math.floor(Math.random() * starterMessages.length)];

        // Add starter message to conversation
        req.sessionService.addMessage(conversationId, {
            role: 'assistant',
            content: starterMessage
        });

        // Get lesson instructions
        const levelData = lesson.getLevelData(level);
        const prompts = lesson.getPracticePrompts(level);

        res.json({
            conversationId,
            starterMessage,
            lesson: {
                id: lessonId,
                title: lesson.title,
                level,
                objective: levelData.learning_objective,
                description: levelData.description,
                prompts,
                successCriteria: levelData.success_criteria
            },
            character: {
                id: practiceCharacter.id,
                name: practiceCharacter.name,
                avatar: practiceCharacter.avatar,
                type: practiceCharacter.type
            },
            rateLimit: {
                remaining: rateLimit.remaining
            }
        });

    } catch (error) {
        console.error('Error starting lesson:', error);
        res.status(500).json({ error: 'Failed to start lesson' });
    }
});

// Send message in lesson
router.post('/:lessonId/message', async (req, res) => {
    try {
        const { lessonId } = req.params;
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
            context: 'lesson',
            contextData: conversation.config
        });

        if (!aiResult.success) {
            console.error('AI service failed:', aiResult.error);
            // Return fallback response
            const fallbackResponse = `I had trouble processing that. Can you try rephrasing?`;
            
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

        // Update conversation stats
        const stats = req.sessionService.getConversationStats(conversationId);

        res.json({
            response: aiResult.response,
            mood: aiResult.mood,
            character: conversation.character.name,
            conversationId,
            stats: {
                messageCount: stats.messageCount,
                duration: stats.duration
            },
            rateLimit: {
                remaining: rateLimit.remaining
            }
        });

    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ 
            error: 'Failed to process message',
            response: 'Sorry, I had trouble understanding. Can you try again?',
            mood: '😐'
        });
    }
});

// Get coach feedback
router.post('/:lessonId/feedback', async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { conversationId, feedbackType = 'instant' } = req.body;
        const sessionId = req.sessionId;

        // Validate feedback type
        const validTypes = ['instant', 'advice', 'end_practice', 'final_review'];
        if (!validTypes.includes(feedbackType)) {
            return res.status(400).json({ error: 'Invalid feedback type' });
        }

        const conversation = req.sessionService.getConversation(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Verify conversation belongs to this session
        if (conversation.sessionId !== sessionId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const history = req.sessionService.getConversationHistory(conversationId);
        
        // Need at least one user message for feedback
        const userMessages = history.filter(msg => msg.role === 'user');
        if (userMessages.length === 0) {
            return res.json({
                feedback: "Start practicing first, then I can give you feedback!",
                assessment: null,
                recommendations: ["Begin the conversation to get personalized feedback"]
            });
        }
        
        const feedbackResult = await req.aiService.generateCoachFeedback({
            feedbackType,
            lessonId,
            level: conversation.config.level,
            conversationHistory: history,
            character: conversation.character
        });

        // If AI feedback fails, provide basic feedback
        if (!feedbackResult.success) {
            const basicFeedback = {
                instant: "You're doing well! Keep practicing the core techniques.",
                advice: "Try to focus on the main skill for this lesson in your next response.",
                end_practice: "Good practice session! Review the lesson objectives and keep working on them.",
                final_review: "Great job practicing! Continue working on these skills in real conversations."
            };

            return res.json({
                feedback: basicFeedback[feedbackType],
                assessment: feedbackResult.assessment || null,
                recommendations: ["Keep practicing", "Review lesson materials"],
                warning: "Basic feedback provided due to AI service issue"
            });
        }

        res.json({
            feedback: feedbackResult.feedback,
            assessment: feedbackResult.assessment,
            recommendations: feedbackResult.recommendations,
            conversationStats: req.sessionService.getConversationStats(conversationId)
        });

    } catch (error) {
        console.error('Error getting coach feedback:', error);
        res.status(500).json({ 
            error: 'Failed to get feedback',
            feedback: 'Great job practicing! Keep working on your skills.',
            assessment: null,
            recommendations: ["Continue practicing"]
        });
    }
});

// End lesson practice
router.post('/:lessonId/end', async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { conversationId } = req.body;
        const sessionId = req.sessionId;

        const conversation = req.sessionService.getConversation(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get final assessment
        const history = req.sessionService.getConversationHistory(conversationId);
        const feedbackResult = await req.aiService.generateCoachFeedback({
            feedbackType: 'final_review',
            lessonId,
            level: conversation.config.level,
            conversationHistory: history,
            character: conversation.character
        });

        // Record progress
        const completed = feedbackResult.assessment.completed;
        const performance = {
            duration: Date.now() - conversation.startTime,
            messageCount: conversation.messageCount,
            assessment: feedbackResult.assessment
        };

        const progressResult = await req.progressService.recordLessonProgress(
            sessionId,
            lessonId,
            conversation.config.level,
            completed,
            performance
        );

        // End conversation
        req.sessionService.endConversation(conversationId);

        res.json({
            completed,
            feedback: feedbackResult.feedback,
            assessment: feedbackResult.assessment,
            progress: progressResult.progress,
            newAchievements: progressResult.newAchievements || [],
            recommendations: progressResult.recommendations || []
        });

    } catch (error) {
        console.error('Error ending lesson:', error);
        res.status(500).json({ error: 'Failed to end lesson' });
    }
});

module.exports = router;