const axios = require('axios');
const Lesson = require('../models/Lesson');

class AIService {
    constructor() {
        this.apiUrl = 'https://api.deepseek.com/chat/completions';
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.timeout = 30000; // 30 seconds
        this.maxRetries = 2;
    }

    /**
     * Generate a conversation response from AI character
     * @param {Object} options - Configuration object
     * @param {string} options.userMessage - What the user said
     * @param {Array} options.conversationHistory - Previous messages
     * @param {Object} options.character - Character data from characters.json
     * @param {string} options.context - 'lesson' or 'scenario'
     * @param {Object} options.contextData - Lesson or scenario specific data
     * @returns {Promise<Object>} AI response with metadata
     */
    async generateResponse(options) {
        const { userMessage, conversationHistory, character, context, contextData } = options;
    
        try {
            console.log('DEBUG: generateResponse called with:');
            console.log('- userMessage:', userMessage);
            console.log('- conversationHistory:', conversationHistory);
            console.log('- character:', character ? character.name : 'MISSING');
            console.log('- context:', context);
            console.log('- contextData:', contextData);
    
            console.log('DEBUG: About to build system prompt...');
            const systemPrompt = this.buildSystemPrompt(character, context, contextData);
            console.log('DEBUG: System prompt built successfully');
    
            console.log('DEBUG: About to build message history...');
            const messages = this.buildMessageHistory(systemPrompt, conversationHistory, userMessage);
            console.log('DEBUG: Message history built successfully');
    
            console.log('DEBUG: About to call DeepSeek API...');
            const response = await this.callDeepSeekAPI(messages, {
                temperature: 0.8,
                max_tokens: 150
            });
    
            const processedResponse = this.processAIResponse(response, character);
    
            return {
                success: true,
                response: processedResponse.cleanMessage,
                rawResponse: response,
                mood: processedResponse.mood,
                characterState: processedResponse.characterState,
                metadata: {
                    characterId: character.id,
                    context,
                    timestamp: new Date(),
                    tokensUsed: response.usage?.total_tokens || 0
                }
            };
    
        } catch (error) {
            console.error('AI Service Error:', error.message);
            console.error('Error stack:', error.stack);
            
            // Return fallback response
            return {
                success: false,
                response: this.getFallbackResponse(character, userMessage),
                mood: '😐',
                characterState: 'neutral',
                error: error.message,
                metadata: {
                    characterId: character.id,
                    context,
                    timestamp: new Date(),
                    fallback: true
                }
            };
        }
    }

    /**
     * Generate coach feedback for lesson practice
     * @param {Object} options - Feedback configuration
     * @param {string} options.feedbackType - 'instant', 'advice', 'end_practice', 'final_review'
     * @param {string} options.lessonId - Current lesson
     * @param {string} options.level - Current level (bronze/silver/gold)
     * @param {Array} options.conversationHistory - Full conversation
     * @param {Object} options.character - Character they practiced with
     * @returns {Promise<Object>} Coach feedback and assessment
     */
    async generateCoachFeedback(options) {
        const { feedbackType, lessonId, level, conversationHistory, character } = options;

        try {
            const lesson = new Lesson(require('../../data/lessons.json').lessons[lessonId]);
            const systemPrompt = this.buildCoachPrompt(lesson, level, character, feedbackType);
            const conversationSummary = this.summarizeConversation(conversationHistory, character);

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: conversationSummary }
            ];

            const response = await this.callDeepSeekAPI(messages, {
                temperature: 0.7,
                max_tokens: 200
            });

            const assessment = this.generateAssessment(conversationHistory, lesson, level);

            return {
                success: true,
                feedback: response,
                assessment,
                recommendations: this.generateRecommendations(assessment, lesson, level),
                metadata: {
                    feedbackType,
                    lessonId,
                    level,
                    timestamp: new Date()
                }
            };

        } catch (error) {
            console.error('Coach Feedback Error:', error.message);
            
            return {
                success: false,
                feedback: this.getFallbackCoachFeedback(feedbackType),
                assessment: this.getBasicAssessment(),
                error: error.message
            };
        }
    }

    /**
     * Call DeepSeek API with retry logic
     * @param {Array} messages - Message history
     * @param {Object} options - API options
     * @returns {Promise<string>} AI response content
     */
    async callDeepSeekAPI(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('DeepSeek API key not configured');
        }

        const requestBody = {
            model: 'deepseek-chat',
            messages,
            temperature: options.temperature || 0.8,
            max_tokens: options.max_tokens || 150,
            stream: false
        };

        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await axios.post(this.apiUrl, requestBody, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                });

                if (response.data?.choices?.[0]?.message?.content) {
                    return response.data.choices[0].message.content;
                }

                throw new Error('Invalid API response format');

            } catch (error) {
                lastError = error;
                
                // Don't retry certain errors
                if (error.response?.status === 401 || error.response?.status === 429) {
                    break;
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }

        throw lastError;
    }

    /**
     * Build system prompt for character conversation
     * @param {Object} character - Character data
     * @param {string} context - 'lesson' or 'scenario'
     * @param {Object} contextData - Additional context
     * @returns {string} System prompt
     */
    buildSystemPrompt(character, context, contextData) {
        let basePrompt = `You are ${character.name}, a ${character.core_traits.social_energy} ${character.gender} with a ${character.core_traits.persona} personality.
    
    CORE PERSONALITY:
    - Response style: ${character.core_traits.response_style}
    - Comfort zone: ${character.core_traits.comfort_zone}
    - Social skill level: ${character.core_traits.social_skill_level}
    
    YOUR INTERESTS: ${character.interests.join(', ')}
    
    BEHAVIORAL RULES:
    ${character.behavioral_rules.map(rule => `- ${rule}`).join('\n')}`;
    
        // Add context-specific instructions
        if (context === 'lesson') {
            const lesson = contextData.lesson;
            const level = contextData.level;
            
            // Get level data safely
            const levelData = lesson.levels && lesson.levels[level] ? lesson.levels[level] : null;
            const characterInstructions = lesson.character_instructions || {};
            
            basePrompt += `
    
    LESSON CONTEXT:
    - You're helping someone practice: ${lesson.title} (${level} level)`;
    
            if (levelData) {
                basePrompt += `
    - Learning objective: ${levelData.learning_objective}`;
            }
    
            basePrompt += `
    - Your role: ${characterInstructions.role || 'conversation partner'}
    - Behavior: ${characterInstructions.behavior || 'Help them practice this skill'}`;
    
        } else if (context === 'scenario') {
            const scenario = contextData.scenario;
            
            basePrompt += `
    
    SCENARIO CONTEXT:
    - Setting: ${scenario.name} - ${scenario.description}
    - Mood: ${scenario.mood}
    - Time: ${scenario.time_of_day}
    - Social norms: ${scenario.social_norms.join(', ')}`;
    
            // Add mission if present
            if (contextData.mission) {
                basePrompt += `
    - Mission: The user is trying to ${contextData.mission.description}`;
            }
        }
    
        basePrompt += `
    
    RESPONSE FORMAT:
    - Start with emotional reaction in *asterisks*: *smiles*, *looks confused*, *rolls eyes*, etc.
    - Then give your spoken response
    - Example: "*raises eyebrow* Are you serious right now?"
    - Keep responses natural and appropriately short for your personality
    
    IMPORTANT: Stay true to your character. React authentically - be uncomfortable if someone is creepy, bored if they're uninteresting, engaged if they're compelling.`;
    
        return basePrompt;
    }

    /**
     * Build coach system prompt
     * @param {Lesson} lesson - Lesson object
     * @param {string} level - Current level
     * @param {Object} character - Character data
     * @param {string} feedbackType - Type of feedback
     * @returns {string} Coach prompt
     */
    buildCoachPrompt(lesson, level, character, feedbackType) {
        const levelData = lesson.getLevelData(level);
        
        let prompt = `You are an expert social skills coach providing ${feedbackType} feedback.

LESSON CONTEXT:
- Lesson: ${lesson.title} (${level} level)
- Learning objective: ${levelData.learning_objective}
- Success criteria: ${levelData.success_criteria.join(', ')}
- Coach focus: ${levelData.coach_focus}

PRACTICE PARTNER:
- Character: ${character.name} (${character.type})
- Personality: ${character.core_traits.persona}
- How they typically react: ${character.behavioral_rules.slice(0, 3).join(', ')}

FEEDBACK INSTRUCTIONS:`;

        const feedbackInstructions = {
            instant: 'Give quick, encouraging feedback on how they\'re doing so far. Be specific about what\'s working.',
            advice: 'Give specific advice for their next response. What should they try to improve their skill?',
            end_practice: 'Provide comprehensive feedback. What did they do well? What should they work on? Specific next steps.',
            final_review: 'Summarize the entire practice session. Key learning points and encouragement for continued practice.'
        };

        prompt += `
${feedbackInstructions[feedbackType]}

Keep feedback:
- Encouraging but honest
- Specific with examples from their conversation
- Under 150 words
- Focused on the lesson objectives
- Actionable for their next practice`;

        return prompt;
    }

    /**
     * Build message history for API call
     * @param {string} systemPrompt - System prompt
     * @param {Array} conversationHistory - Previous messages
     * @param {string} currentMessage - Current user message
     * @returns {Array} Formatted message array
     */
    buildMessageHistory(systemPrompt, conversationHistory, currentMessage) {
        const messages = [{ role: 'system', content: systemPrompt }];
    
        // DEBUG: Log what we're getting
        console.log('DEBUG: conversationHistory received:', JSON.stringify(conversationHistory, null, 2));
    
        // Add conversation history (limit to last 10 exchanges to save tokens)
        const recentHistory = conversationHistory.slice(-20); // Last 10 exchanges = 20 messages
        
        // DEBUG: Check each message
        recentHistory.forEach((msg, index) => {
            if (!msg || !msg.role || !msg.content) {
                console.error(`DEBUG: Invalid message at index ${index}:`, msg);
            }
        });
        
        messages.push(...recentHistory);
    
        // Add current message
        if (currentMessage) {
            messages.push({ role: 'user', content: currentMessage });
        }
    
        console.log('DEBUG: Final messages array:', JSON.stringify(messages, null, 2));
        return messages;
    }

    /**
     * Process raw AI response to extract mood and clean message
     * @param {string} rawResponse - Raw AI response
     * @param {Object} character - Character data
     * @returns {Object} Processed response
     */
    processAIResponse(rawResponse, character) {
        // Extract mood from *action* parts
        const moodEmoji = this.extractMoodEmoji(rawResponse);
        const characterState = this.determineCharacterState(rawResponse);
        
        // Clean message by removing *actions*
        let cleanMessage = rawResponse.replace(/\*[^*]*\*/g, '').trim();
        cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();
        
        // Remove surrounding quotes if present
        if (cleanMessage.startsWith('"') && cleanMessage.endsWith('"')) {
            cleanMessage = cleanMessage.slice(1, -1);
        }

        return {
            cleanMessage,
            mood: moodEmoji,
            characterState
        };
    }

    /**
     * Extract mood emoji from action text
     * @param {string} rawResponse - Raw response with *actions*
     * @returns {string} Appropriate emoji
     */
    extractMoodEmoji(rawResponse) {
        const actionMatches = rawResponse.match(/\*([^*]*)\*/g);
        
        if (!actionMatches) return '😐';
        
        const allActions = actionMatches.join(' ').toLowerCase();
        
        const moodMappings = {
            // Positive emotions
            'smile': '😊', 'grin': '😁', 'laugh': '😄', 'excited': '😃',
            'happy': '😊', 'interested': '🤔', 'curious': '🧐',
            'impressed': '😮', 'surprised': '😲', 'amused': '😏',
            'lights up': '😊', 'nod': '😌',
            
            // Negative emotions
            'roll': '🙄', 'eyebrow': '🤨', 'unimpressed': '😑',
            'annoyed': '😤', 'frustrated': '😠', 'uncomfortable': '😬',
            'nervous': '😰', 'confused': '😕', 'suspicious': '🤔',
            'bored': '😴', 'dismissive': '🙄', 'skeptical': '🤨',
            'scoff': '😤', 'sigh': '😔',
            
            // Physical actions implying emotion
            'lean forward': '🤔', 'step back': '😬', 'cross arms': '😤',
            'look away': '😑', 'check phone': '😴'
        };

        // Find matching mood (check longest matches first)
        const sortedKeywords = Object.keys(moodMappings).sort((a, b) => b.length - a.length);
        
        for (const keyword of sortedKeywords) {
            if (allActions.includes(keyword)) {
                return moodMappings[keyword];
            }
        }

        return '😐'; // Default neutral
    }

    /**
     * Determine character's emotional state from response
     * @param {string} rawResponse - Raw AI response
     * @returns {string} Character state
     */
    determineCharacterState(rawResponse) {
        const lowerResponse = rawResponse.toLowerCase();
        
        if (lowerResponse.includes('uncomfortable') || lowerResponse.includes('step back')) {
            return 'uncomfortable';
        }
        if (lowerResponse.includes('excited') || lowerResponse.includes('light up')) {
            return 'excited';
        }
        if (lowerResponse.includes('bored') || lowerResponse.includes('check phone')) {
            return 'bored';
        }
        if (lowerResponse.includes('confused') || lowerResponse.includes('pause')) {
            return 'confused';
        }
        
        return 'neutral';
    }

    /**
     * Generate assessment of user's performance
     * @param {Array} conversationHistory - Full conversation
     * @param {Lesson} lesson - Lesson object
     * @param {string} level - Current level
     * @returns {Object} Performance assessment
     */
    generateAssessment(conversationHistory, lesson, level) {
        const userMessages = conversationHistory.filter(msg => msg.role === 'user');
        const levelData = lesson.getLevelData(level);
        
        // Basic metrics
        const messageCount = userMessages.length;
        const averageLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / messageCount;
        
        // Skill-specific assessment based on lesson
        let skillDemonstrated = false;
        let effortLevel = 0.5;
        let naturalness = 0.5;
        let mastery = 0.5;

        // Simple heuristics for different skills
        switch (lesson.id) {
            case 'basic_weaving':
                skillDemonstrated = this.assessWeaving(userMessages);
                break;
            case 'asking_questions':
                skillDemonstrated = this.assessQuestions(userMessages);
                break;
            case 'stories':
                skillDemonstrated = this.assessStories(userMessages);
                break;
            case 'active_listening_basic':
                skillDemonstrated = this.assessListening(userMessages);
                break;
            case 'exaggeration':
                skillDemonstrated = this.assessExaggeration(userMessages);
                break;
        }

        // Adjust scores based on level requirements
        effortLevel = Math.min(0.9, 0.4 + (messageCount / 10));
        naturalness = averageLength > 10 ? Math.min(0.8, averageLength / 100) : 0.3;
        mastery = skillDemonstrated ? (level === 'gold' ? 0.8 : 0.6) : 0.3;

        const overallGrade = (effortLevel + naturalness + mastery) / 3;

        return {
            skillDemonstrated,
            effortLevel,
            naturalness,
            mastery,
            overallGrade,
            messageCount,
            averageLength,
            completed: lesson.isLevelCompleted(level, conversationHistory, {
                skillDemonstrated,
                effortLevel,
                naturalness,
                mastery,
                overallGrade
            })
        };
    }

    /**
     * Assess weaving skills in conversation
     * @param {Array} userMessages - User's messages
     * @returns {boolean} Whether weaving was demonstrated
     */
    assessWeaving(userMessages) {
        const weavingIndicators = [
            'speaking of', 'that reminds me', 'on the topic of', 'by the way',
            'while we\'re', 'in relation to', 'talking about', 'this brings'
        ];
        
        return userMessages.some(msg => 
            weavingIndicators.some(indicator => 
                msg.content.toLowerCase().includes(indicator)
            )
        );
    }

    /**
     * Assess questioning skills
     * @param {Array} userMessages - User's messages
     * @returns {boolean} Whether good questions were asked
     */
    assessQuestions(userMessages) {
        const questionCount = userMessages.filter(msg => msg.content.includes('?')).length;
        const openEndedStarters = ['how', 'what', 'why', 'when', 'where', 'tell me'];
        
        const openEndedCount = userMessages.filter(msg =>
            openEndedStarters.some(starter => 
                msg.content.toLowerCase().startsWith(starter)
            )
        ).length;

        return questionCount >= 2 && openEndedCount >= 1;
    }

    /**
     * Assess storytelling skills
     * @param {Array} userMessages - User's messages
     * @returns {boolean} Whether stories were told
     */
    assessStories(userMessages) {
        const storyIndicators = ['so', 'then', 'after that', 'finally', 'first', 'next'];
        const longMessages = userMessages.filter(msg => msg.content.length > 50);
        
        return longMessages.length >= 1 && 
               longMessages.some(msg => 
                   storyIndicators.some(indicator => 
                       msg.content.toLowerCase().includes(indicator)
                   )
               );
    }

    /**
     * Assess listening skills
     * @param {Array} userMessages - User's messages
     * @returns {boolean} Whether active listening was demonstrated
     */
    assessListening(userMessages) {
        const listeningIndicators = [
            'that sounds', 'i can imagine', 'wow', 'oh no', 'that\'s',
            'it sounds like', 'you seem', 'i understand'
        ];
        
        return userMessages.some(msg =>
            listeningIndicators.some(indicator =>
                msg.content.toLowerCase().includes(indicator)
            )
        );
    }

    /**
     * Assess exaggeration/playfulness
     * @param {Array} userMessages - User's messages
     * @returns {boolean} Whether playfulness was demonstrated
     */
    assessExaggeration(userMessages) {
        const playfulIndicators = [
            'absolutely', 'totally', 'completely', 'definitely', 'obviously',
            'literally', 'seriously', 'no way', 'are you kidding'
        ];
        
        return userMessages.some(msg =>
            playfulIndicators.some(indicator =>
                msg.content.toLowerCase().includes(indicator)
            )
        );
    }

    /**
     * Generate recommendations based on assessment
     * @param {Object} assessment - Performance assessment
     * @param {Lesson} lesson - Current lesson
     * @param {string} level - Current level
     * @returns {Array} Recommendations
     */
    generateRecommendations(assessment, lesson, level) {
        const recommendations = [];

        if (!assessment.skillDemonstrated) {
            recommendations.push(`Focus on practicing the core ${lesson.title.toLowerCase()} technique`);
        }

        if (assessment.naturalness < 0.6) {
            recommendations.push('Try to make your responses feel more natural and conversational');
        }

        if (assessment.effortLevel < 0.6) {
            recommendations.push('Try engaging more actively in the conversation');
        }

        if (assessment.completed) {
            const nextLevel = level === 'bronze' ? 'silver' : level === 'silver' ? 'gold' : null;
            if (nextLevel) {
                recommendations.push(`Great job! Ready to try ${nextLevel} level`);
            } else {
                recommendations.push('Excellent! Try practicing this skill in scenarios');
            }
        }

        return recommendations;
    }

    /**
     * Summarize conversation for coach analysis
     * @param {Array} conversationHistory - Full conversation
     * @param {Object} character - Character data
     * @returns {string} Conversation summary
     */
    summarizeConversation(conversationHistory, character) {
        const summary = conversationHistory.map((msg, i) => {
            const speaker = msg.role === 'user' ? 'STUDENT' : character.name.toUpperCase();
            return `${speaker}: ${msg.content}`;
        }).join('\n');

        return `CONVERSATION TO ANALYZE:\n${summary}\n\nProvide specific, constructive feedback:`;
    }

    /**
     * Get fallback response when AI fails
     * @param {Object} character - Character data
     * @param {string} userMessage - User's message
     * @returns {string} Fallback response
     */
    getFallbackResponse(character, userMessage) {
        const fallbackResponses = {
            "quiet_observer": ["Hmm.", "I see.", "Interesting."],
            "laid_back": ["Cool.", "Yeah, fair.", "Alright."],
            "bubbly_nervous": ["Oh wow!", "Really?", "That's interesting!"],
            "self_centered": ["That reminds me of...", "I've done that too."],
            "curious": ["Tell me more.", "How so?", "Really?"],
            "practice_partner": ["Good try! Keep practicing.", "Let's try that again.", "You're doing well!"]
        };

        const responses = fallbackResponses[character.type] || fallbackResponses["practice_partner"];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Get fallback coach feedback
     * @param {string} feedbackType - Type of feedback requested
     * @returns {string} Fallback feedback
     */
    getFallbackCoachFeedback(feedbackType) {
        const fallbacks = {
            instant: "You're doing great! Keep practicing and stay engaged.",
            advice: "Try to use the specific technique we're working on in your next response.",
            end_practice: "Good practice session! Focus on the main skill and keep working on it.",
            final_review: "Great job practicing! Keep working on these skills in real conversations."
        };

        return fallbacks[feedbackType] || fallbacks.end_practice;
    }

    /**
     * Get basic assessment when AI analysis fails
     * @returns {Object} Basic assessment
     */
    getBasicAssessment() {
        return {
            skillDemonstrated: true,
            effortLevel: 0.6,
            naturalness: 0.6,
            mastery: 0.5,
            overallGrade: 0.6,
            messageCount: 0,
            averageLength: 0,
            completed: false
        };
    }
}

module.exports = AIService;