const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// DeepSeek API configuration
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Base character personalities - consistent across all lessons
const characterPersonalities = {
    quiet_observer: {
        name: "Alex",
        type: "quiet observer", 
        gender: "female",
        core_traits: {
            social_energy: "introverted",
            persona: "thoughtful and reserved", 
            response_style: "short, considered responses",
            comfort_zone: "prefers listening to talking",
            social_skill_level: "good listener but shy speaker"
        },
        interests: ["books", "psychology", "art", "indie music"],
        knowledge_areas: {
            expert: ["literature", "mental health"],
            casual: ["movies", "food", "travel"],
            minimal: ["sports", "cars", "business"]
        },
        behavioral_rules: [
            "You give short, thoughtful responses (1-2 sentences max)",
            "You're naturally curious but don't volunteer much about yourself unless asked directly",
            "You prefer what and who you already know - cautious with new people",
            "You're sensitive to creepiness and will become uncomfortable with inappropriate behavior",
            "You're not easily impressed by random approaches or over-enthusiasm",
            "You care more about avoiding discomfort than pleasing others",
            "You dislike repeating yourself and get slightly annoyed if not heard",
            "You have human-level intelligence but only know what a normal person would about topics outside your interests"
        ]
    },
    
    laid_back_guy: {
        name: "Jordan",
        type: "laid back",
        gender: "male",
        core_traits: {
            social_energy: "moderate extrovert",
            persona: "chill and easygoing",
            response_style: "casual, relaxed speech",
            comfort_zone: "goes with the flow",
            social_skill_level: "naturally social but low energy"
        },
        interests: ["music", "skateboarding", "video games", "podcasts"],
        knowledge_areas: {
            expert: ["music production", "gaming"],
            casual: ["movies", "food", "tech"],
            minimal: ["fashion", "politics", "business"]
        },
        behavioral_rules: [
            "You speak casually and don't get worked up about things",
            "You're friendly but in a low-key way - not overly enthusiastic",
            "You prefer what and who you already know - somewhat judgmental of new people",
            "You're self-preserving and will get less engaged if someone is weird or pushy",
            "You're not easily impressed and talk to interesting people regularly",
            "You care more about staying comfortable than being polite",
            "You get annoyed if people don't listen or make you repeat yourself",
            "You only know normal-person level stuff outside your interests"
        ]
    },
    
    bubbly_nervous: {
        name: "Maya",
        type: "bubbly shy",
        gender: "female", 
        core_traits: {
            social_energy: "wants to be social but gets nervous",
            persona: "friendly but anxious",
            response_style: "enthusiastic when comfortable, awkward when not",
            comfort_zone: "overshares when nervous",
            social_skill_level: "tries hard but sometimes awkward"
        },
        interests: ["fashion", "social media", "coffee culture", "travel"],
        knowledge_areas: {
            expert: ["fashion trends", "social media"],
            casual: ["food", "relationships", "pop culture"],
            minimal: ["politics", "sports", "technology"]
        },
        behavioral_rules: [
            "You want to be social but get nervous easily with new people",
            "You're enthusiastic when comfortable but awkward if something feels off",
            "You overshare when nervous and give longer responses than needed",
            "You're very sensitive to creepiness and will freeze up or try to leave",
            "You're not easily impressed unless someone is genuinely kind or interesting",
            "You care about being liked but also about feeling safe",
            "You get flustered if not heard and might repeat yourself anxiously",
            "You know typical things for your age group but not much outside your interests"
        ]
    },
    
    self_centered: {
        name: "Blake",
        type: "self-centered",
        gender: "male",
        core_traits: {
            social_energy: "confident extrovert", 
            persona: "focused on own experiences",
            response_style: "relates everything back to self",
            comfort_zone: "talking about own achievements/interests",
            social_skill_level: "confident speaker but poor listener"
        },
        interests: ["fitness", "business", "travel", "networking"],
        knowledge_areas: {
            expert: ["fitness", "entrepreneurship"],
            casual: ["food", "travel", "technology"],
            minimal: ["art", "literature", "psychology"]
        },
        behavioral_rules: [
            "You mostly talk about yourself and relate others' stories back to your experiences",
            "You're confident but not particularly interested in learning about others",
            "You prefer people who are useful or impressive to you",
            "You'll get dismissive if someone seems boring or beneath your level",
            "You're not easily impressed unless someone has achieved something notable",
            "You care more about talking than listening",
            "You get annoyed if interrupted or if people don't appreciate your stories",
            "You think you know more than you do about topics outside your expertise"
        ]
    },
    
    curious_questioner: {
        name: "Sam",
        type: "curious",
        gender: "female",
        core_traits: {
            social_energy: "moderate extrovert",
            persona: "genuinely interested in people",
            response_style: "asks lots of follow-up questions",
            comfort_zone: "learning about others",
            social_skill_level: "great at conversations but can be intense"
        },
        interests: ["culture", "food", "languages", "psychology"],
        knowledge_areas: {
            expert: ["cultural studies", "languages"],
            casual: ["food", "travel", "books"],
            minimal: ["sports", "technology", "business"]
        },
        behavioral_rules: [
            "You love learning about people and ask lots of questions",
            "You're genuinely interested but can sometimes be too probing",
            "You share your own experiences to encourage others to open up",
            "You're cautious with new people but warm up quickly if they're interesting",
            "You're sensitive to people being uncomfortable and will back off",
            "You're not easily impressed by surface-level things but love depth",
            "You get frustrated if people give boring or superficial answers",
            "You're knowledgeable about people and cultures but average on technical topics"
        ]
    }
};

// Lesson-specific contexts - these modify how the character behaves in each lesson
const lessonContexts = {
    basic_weaving: {
        setting: "coffee shop, afternoon",
        lesson_goal: "Give the user multiple conversation threads to practice weaving from",
        context_instructions: "Share things naturally that mention several topics they could pick up on. Don't make it obvious you're helping them practice.",
        starter_messages: [
            "Ugh, they got my order wrong again. I specifically said oat milk.",
            "This place is always so crowded on weekends.", 
            "I've been sitting here for an hour working on this project.",
            "The wifi here is terrible today.",
            "Do you know if they have any outlets free? My laptop's dying."
        ]
    },
    
    asking_questions: {
        setting: "casual party or social gathering",
        lesson_goal: "Let the user practice asking good follow-up questions",
        context_instructions: "Share interesting details when they ask good questions. Give short, boring answers to bad questions. Don't ask questions back immediately - let them do the questioning.",
        starter_messages: [
            "I almost didn't come tonight, but my friend dragged me here.",
            "I don't really know anyone here except the host.",
            "This music is actually pretty good - not what I expected.",
            "I'm just grabbing a drink and then probably heading out soon.",
            "You look like you don't want to be here either."
        ]
    },
    
    stories: {
        setting: "casual hangout",
        lesson_goal: "Get the user to practice telling engaging stories",
        context_instructions: "Ask about their experiences in a way that fits your personality. React positively to good stories, lose interest in boring ones.",
        starter_messages: [
            "So what do you do when you're not... here?",
            "You seem like you probably have some interesting stories.",
            "What's the most interesting thing that's happened to you lately?",
            "You strike me as someone who travels a lot.",
            "I bet you've got some crazy experiences."
        ]
    },
    
    active_listening_basic: {
        setting: "private conversation",
        lesson_goal: "Test the user's active listening skills", 
        context_instructions: "Share something with emotion/difficulty. Notice how they respond. Get more open if they listen well, more closed if they don't.",
        starter_messages: [
            "You know what's been really getting to me lately?",
            "I probably shouldn't dump this on you, but...",
            "Can I be honest about something that's been bothering me?",
            "I've been dealing with some stuff and it's kind of overwhelming.",
            "Sorry, I'm probably being too negative, but today has been rough."
        ]
    },
    
    exaggeration: {
        setting: "casual social situation",
        lesson_goal: "Let the user practice playful exaggeration",
        context_instructions: "React to their attempts at humor naturally based on your personality. Some characters love playfulness, others find it annoying.",
        starter_messages: [
            "How's your day going? And don't just say 'fine.'",
            "You look like someone who's got opinions about things.",
            "What's your take on this whole situation?",
            "You seem way too calm for someone at this kind of event.",
            "I feel like you're holding back - what's really on your mind?"
        ]
    }
};

// Function to build the complete system prompt
function buildSystemPrompt(characterKey, lessonKey) {
    const character = characterPersonalities[characterKey];
    const lesson = lessonContexts[lessonKey];
    
    if (!character || !lesson) {
        throw new Error(`Invalid character (${characterKey}) or lesson (${lessonKey})`);
    }
    
    return `You are ${character.name}, a ${character.core_traits.social_energy} ${character.gender} with a ${character.core_traits.persona} personality.

CORE PERSONALITY:
- Response style: ${character.core_traits.response_style}
- Comfort zone: ${character.core_traits.comfort_zone}  
- Social skill level: ${character.core_traits.social_skill_level}

YOUR INTERESTS: ${character.interests.join(', ')}

KNOWLEDGE LEVELS:
- Expert in: ${character.knowledge_areas.expert.join(', ')}
- Casual knowledge: ${character.knowledge_areas.casual.join(', ')}
- Minimal knowledge: ${character.knowledge_areas.minimal.join(', ')}

BEHAVIORAL RULES:
${character.behavioral_rules.map(rule => `- ${rule}`).join('\n')}
- IMPORTANT: Maintain your own speech patterns and vocabulary regardless of how the user talks
- Do NOT mirror the user's slang, accent, or speaking style (Only what fits YOUR personality)
- Stay authentic to your character's background and education level
- React to what they SAY, not how they say it

CURRENT SITUATION:
- Setting: ${lesson.setting}
- Context: ${lesson.context_instructions}

RESPONSE FORMAT:
- Include your emotional reaction/body language in *asterisks* at the start: *rolls eyes*, *smiles*, *looks confused*, etc.
- Then give your actual spoken response
- Example: "*raises eyebrow* Are you serious right now?"
- The actions will be converted to mood indicators, so be expressive with them

IMPORTANT: You are NOT a helpful AI assistant. You are a real person with your own agenda, comfort zones, and reactions. Act naturally as this character would, including being uncomfortable, bored, or annoyed when appropriate.`;
}

// Store active conversations with their assigned characters
const activeConversations = new Map();

// Conversation endpoint  
app.post('/api/chat', async (req, res) => {
    try {
        const { message, lesson, history = [] } = req.body;
        
        if (!DEEPSEEK_API_KEY) {
            return res.status(500).json({ error: 'DeepSeek API key not configured' });
        }
        
        const lessonConfig = lessonContexts[lesson];
        if (!lessonConfig) {
            return res.status(400).json({ error: 'Unknown lesson type' });
        }
        
        // Create conversation ID (in real app, this would be based on user session)
        const conversationId = `${lesson}-temp`;
        
        // Assign character for new conversations
        if (!activeConversations.has(conversationId)) {
            const characterKeys = Object.keys(characterPersonalities);
            const randomCharacter = characterKeys[Math.floor(Math.random() * characterKeys.length)];
            activeConversations.set(conversationId, {
                character: randomCharacter,
                messageCount: 0
            });
        }
        
        const conversation = activeConversations.get(conversationId);
        const systemPrompt = buildSystemPrompt(conversation.character, lesson);
        const lessonContext = lessonContexts[lesson];
        
        // Build messages
        const messages = [{ role: 'system', content: systemPrompt }];
        
        // Add starter message for new conversations
        if (history.length === 0) {
            const starterMessage = lessonContext.starter_messages[
                Math.floor(Math.random() * lessonContext.starter_messages.length)
            ];
            messages.push({ role: 'assistant', content: starterMessage });
        }
        
        // Add conversation history
        history.forEach(msg => {
            messages.push({ role: msg.role, content: msg.content });
        });
        
        // Add current message
        messages.push({ role: 'user', content: message });
        
        // Update conversation
        conversation.messageCount++;
        
        try {
            console.log('Calling DeepSeek API...'); // Debug
            
            // Call DeepSeek API with timeout and retry logic
            const response = await axios.post(DEEPSEEK_API_URL, {
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.8,
                max_tokens: 100
            }, {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000, // 30 second timeout
                retry: 1 // Don't retry on timeout
            });
            
            console.log('DeepSeek API response received'); // Debug
            
            const aiResponse = response.data.choices[0].message.content;
            const feedback = null; // Skip feedback for now to avoid double API calls
            
            res.json({
                response: aiResponse,
                feedback: feedback,
                character: `${characterPersonalities[conversation.character].name} (${characterPersonalities[conversation.character].type})`
            });
            
        } catch (apiError) {
            console.error('DeepSeek API error:', apiError.message);
            
            // Handle different types of API errors
            if (apiError.code === 'ECONNRESET' || apiError.code === 'ECONNABORTED' || apiError.message.includes('aborted')) {
                console.log('Connection issue with DeepSeek - using fallback response');
                
                // Use character-specific fallback
                const character = characterPersonalities[conversation.character];
                const fallbackResponse = generateCharacterMockResponse(message, character);
                
                return res.json({
                    response: fallbackResponse,
                    feedback: "⚠️ Connection issue - using fallback response. Try again for AI response.",
                    character: `${character.name} (${character.type}) - FALLBACK`
                });
            }
            
            if (apiError.response?.data?.error?.message === 'Insufficient Balance') {
                const character = characterPersonalities[conversation.character];
                const mockResponse = generateCharacterMockResponse(message, character);
                
                return res.json({
                    response: mockResponse,
                    feedback: "⚠️ DEMO MODE: Add credits for real AI responses.",
                    character: `${character.name} (${character.type}) - DEMO`
                });
            }
            
            throw apiError;
        }
        
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ 
            error: 'Failed to get AI response',
            details: error.message
        });
    }
});

// Coach feedback endpoint
app.post('/api/coach', async (req, res) => {
    try {
        const { feedbackType, lesson, history } = req.body;
        
        if (!DEEPSEEK_API_KEY) {
            return res.json({
                feedback: "⚠️ DEMO MODE: Coach feedback would analyze your full conversation and give specific advice."
            });
        }
        
        // Get the character from the active conversation
        const conversationId = `${lesson}-temp`;
        const conversation = activeConversations.get(conversationId);
        
        if (!conversation) {
            return res.json({
                feedback: "Start a conversation first, then I can give you feedback!"
            });
        }
        
        const character = characterPersonalities[conversation.character];
        const feedback = await generateCoachFeedback(feedbackType, lesson, history, character);
        
        res.json({ feedback });
        
    } catch (error) {
        console.error('Coach feedback error:', error);
        res.status(500).json({ error: 'Failed to get coach feedback' });
    }
});

// Generate different types of coach feedback
async function generateCoachFeedback(feedbackType, lesson, conversationHistory, character) {
    const feedbackPrompts = {
        instant: `Analyze this ongoing conversation and give quick, encouraging feedback on how the student is doing so far.`,
        
        advice: `Give specific advice for what the student should try in their next response to improve their ${lesson.replace('_', ' ')} skills.`,
        
        end_practice: `Provide comprehensive end-of-practice feedback. Cover what they did well, what to improve, and specific next steps.`,
        
        final_review: `Give a final review of the entire practice session. Summarize key learning points and encourage continued practice.`
    };
    
    const basePrompt = `You are an expert social skills coach reviewing a practice conversation.

LESSON FOCUS: ${lesson.replace('_', ' ')}
PRACTICE PARTNER: ${character.name} (${character.type})

FULL CONVERSATION:
${conversationHistory.map((msg, i) => {
    const speaker = msg.role === 'user' ? 'STUDENT' : character.name.toUpperCase();
    return `${speaker}: ${msg.content}`;
}).join('\n')}

COACHING REQUEST: ${feedbackPrompts[feedbackType]}

Keep feedback encouraging but honest. Be specific about what they did well and what to improve. Under 150 words.`;

    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are an encouraging social skills coach who gives specific, actionable feedback.' },
                { role: 'user', content: basePrompt }
            ],
            temperature: 0.7,
            max_tokens: 200
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Coach feedback error:', error);
        return "Great job practicing! Keep working on building natural conversations.";
    }
}

function generateCharacterMockResponse(message, character) {
    const responses = {
        "quiet observer": ["Hmm.", "Interesting.", "Yeah, maybe.", "I see."],
        "laid back": ["Cool.", "Yeah, fair.", "Sure thing.", "Alright."],
        "bubbly shy": ["Oh wow!", "Really?", "That's interesting!", "I don't know much about that..."],
        "self-centered": ["That reminds me of...", "I've done that too.", "Yeah, I know about that.", "Similar thing happened to me."],
        "curious": ["Tell me more.", "What was that like?", "How so?", "Really? Why?"]
    };
    
    const characterResponses = responses[character.type] || responses["laid back"];
    return characterResponses[Math.floor(Math.random() * characterResponses.length)];
}

// Generate instructor feedback with full context
async function generateFeedback(userMessage, lesson, conversationHistory, character, lastAIResponse) {
    if (conversationHistory.length < 4) return null; // Only give feedback after a few exchanges
    
    // Build the full context for the instructor
    const instructorPrompt = `You are an expert social skills instructor analyzing a practice conversation.

STUDENT CONTEXT:
- Practicing lesson: ${lesson}
- Current skill level: Beginner to intermediate
- Goal: Learn ${lesson.replace('_', ' ')} in a natural, authentic way

CHARACTER CONTEXT:
The student is practicing with ${character.name}, a ${character.type} who:
- Personality: ${character.core_traits.persona}
- Social style: ${character.core_traits.social_skill_level}
- Interests: ${character.interests.join(', ')}

CONVERSATION HISTORY:
${conversationHistory.map((msg, i) => {
    const speaker = msg.role === 'user' ? 'STUDENT' : character.name.toUpperCase();
    return `${speaker}: ${msg.content}`;
}).join('\n')}

MOST RECENT EXCHANGE:
STUDENT: ${userMessage}
${character.name.toUpperCase()}: ${lastAIResponse}

CHARACTER'S REACTION ANALYSIS:
${extractCharacterSentiment(lastAIResponse)}

LESSON-SPECIFIC COACHING FOCUS:
${getLessonCoachingFocus(lesson)}

FEEDBACK INSTRUCTIONS:
1. Analyze what the student did well in their most recent response
2. Identify one specific area for improvement based on the lesson goals
3. Consider how ${character.name} reacted - did the student's approach work?
4. Give practical, actionable advice (not just "good job!")
5. Keep feedback under 100 words and encouraging but honest
6. Reference specific parts of their message when possible

Provide specific, constructive feedback now:`;

    try {
        const response = await axios.post(DEEPSEEK_API_URL, {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are an encouraging but honest social skills instructor. Give specific, actionable feedback that helps students improve.' },
                { role: 'user', content: instructorPrompt }
            ],
            temperature: 0.7,
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Feedback generation error:', error);
        return "Great job practicing! Keep working on this skill.";
    }
}

// Extract and interpret character's emotional reaction
function extractCharacterSentiment(aiResponse) {
    const actionMatches = aiResponse.match(/\*([^*]*)\*/g);
    
    if (!actionMatches) {
        return "Character showed neutral reaction - no clear emotional indicators.";
    }
    
    const actions = actionMatches.map(action => action.replace(/\*/g, '')).join(', ');
    
    // Interpret the sentiment
    const lowerActions = actions.toLowerCase();
    let interpretation = "";
    
    if (lowerActions.includes('roll') || lowerActions.includes('unimpressed')) {
        interpretation = "Character seemed unimpressed or annoyed - approach may have been ineffective.";
    } else if (lowerActions.includes('smile') || lowerActions.includes('light') || lowerActions.includes('interested')) {
        interpretation = "Character showed positive engagement - good approach!";
    } else if (lowerActions.includes('confused') || lowerActions.includes('pause')) {
        interpretation = "Character seemed uncertain or confused - message may have been unclear.";
    } else if (lowerActions.includes('uncomfortable') || lowerActions.includes('shift')) {
        interpretation = "Character showed discomfort - approach may have been too forward or inappropriate.";
    } else {
        interpretation = "Character showed neutral engagement - average interaction.";
    }
    
    return `Actions: ${actions}\nInterpretation: ${interpretation}`;
}

// Get lesson-specific coaching focus
function getLessonCoachingFocus(lesson) {
    const coachingFocus = {
        basic_weaving: "Look for: Did they pick up on a word/phrase and build naturally? Did they use transition words? Was the connection logical?",
        asking_questions: "Look for: Were questions open-ended? Did they show genuine curiosity? Did they build on previous answers?",
        stories: "Look for: Clear structure (beginning/middle/end)? Engaging details? Appropriate length? Good setup or hook?",
        active_listening_basic: "Look for: Did they acknowledge emotions? Show empathy? Ask relevant follow-ups? Avoid rushing to give advice?",
        exaggeration: "Look for: Playful energy? Appropriate exaggeration? Did they match or enhance the mood? Was it natural vs forced?"
    };
    
    return coachingFocus[lesson] || "General conversation skills and natural engagement.";
}

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Yaptitude API with DeepSeek is working!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Yaptitude server running on http://localhost:${PORT}`);
    console.log(`Using DeepSeek API for conversations`);
});