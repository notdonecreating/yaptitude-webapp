// Get DOM elements
const lessonSelect = document.getElementById('lessonSelect');
const startLessonBtn = document.getElementById('startLesson');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessage');
const endLessonBtn = document.getElementById('endLesson');
const feedbackPanel = document.getElementById('feedbackPanel');
const feedbackContent = document.getElementById('feedbackContent');
const continuePracticeBtn = document.getElementById('continuePractice');
const currentLessonTitle = document.getElementById('currentLesson');

// Current lesson data
let currentLesson = '';
let conversationHistory = [];

// Start lesson event
startLessonBtn.addEventListener('click', startLesson);
sendMessageBtn.addEventListener('click', sendMessage);
endLessonBtn.addEventListener('click', endLesson);
continuePracticeBtn.addEventListener('click', hideFeedback);

// Allow Enter key to send messages
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Start a lesson
function startLesson() {
    currentLesson = lessonSelect.value;
    currentLessonTitle.textContent = `Lesson: ${formatLessonName(currentLesson)}`;
    
    // Hide lesson selector, show chat
    document.querySelector('.lesson-selector').style.display = 'none';
    chatContainer.style.display = 'flex';
    
    // Clear previous conversation
    chatMessages.innerHTML = '';
    conversationHistory = [];
    
    // Add welcome message
    addMessage('ai', `Welcome to ${formatLessonName(currentLesson)} practice! I'm your conversation partner. Let's start chatting!`);
    
    // Focus on input
    messageInput.focus();
}

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage('user', message);
    
    // Clear input
    messageInput.value = '';
    
    // Add to conversation history
    conversationHistory.push({ role: 'user', content: message });
    
    // Show typing indicator
    addMessage('ai', 'Thinking...', 'typing');
    
    try {
        // Send to backend
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                lesson: currentLesson,
                history: conversationHistory
            })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        removeTypingMessage();
        
        // Process the AI response to separate message and mood
        const processedResponse = processAIResponse(data.response);
        
        // Add cleaned AI response to chat
        addMessage('ai', processedResponse.cleanMessage);
        
        // Update mood indicator
        updateMoodIndicator(processedResponse.emoji, data.character);
        
        // Add cleaned message to conversation history
        conversationHistory.push({ role: 'assistant', content: processedResponse.cleanMessage });
        
        // Show feedback after a few exchanges
        if (conversationHistory.length >= 6 && data.feedback) {
            showFeedback(data.feedback);
        }
        
    } catch (error) {
        console.error('Error:', error);
        removeTypingMessage();
        addMessage('ai', 'Sorry, I had trouble understanding. Can you try again?');
    }
}

// Add message to chat
function addMessage(sender, content, type = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender} ${type}`;
    messageDiv.textContent = content;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove typing message
function removeTypingMessage() {
    const typingMessage = document.querySelector('.message.typing');
    if (typingMessage) {
        typingMessage.remove();
    }
}

// Show feedback
function showFeedback(feedback) {
    feedbackContent.textContent = feedback;
    feedbackPanel.style.display = 'block';
}

// Hide feedback
function hideFeedback() {
    feedbackPanel.style.display = 'none';
}

// End lesson
function endLesson() {
    // Show lesson selector, hide chat
    document.querySelector('.lesson-selector').style.display = 'block';
    chatContainer.style.display = 'none';
    feedbackPanel.style.display = 'none';
    
    // Reset conversation
    conversationHistory = [];
}

// Format lesson name for display
function formatLessonName(lessonKey) {
    return lessonKey.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Test API connection on page load
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/api/test');
        const data = await response.json();
        console.log('API Test:', data.message);
    } catch (error) {
        console.error('API connection failed:', error);
    }
});

// Process AI response to extract mood and clean message
function processAIResponse(rawResponse) {
    console.log('Raw AI response:', rawResponse); // DEBUG - let's see what we're getting
    
    // FIRST: Extract emotion from the *action* parts before removing them
    const emoji = extractMoodEmoji(rawResponse);
    console.log('Extracted emoji:', emoji); // DEBUG
    
    // THEN: Remove all *action* parts
    let cleanMessage = rawResponse.replace(/\*[^*]*\*/g, '').trim();
    
    // Clean up extra spaces and punctuation
    cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();
    
    // Remove quotes if the whole message is wrapped in them
    if (cleanMessage.startsWith('"') && cleanMessage.endsWith('"')) {
        cleanMessage = cleanMessage.slice(1, -1);
    }
    
    console.log('Clean message:', cleanMessage); // DEBUG
    
    return {
        cleanMessage: cleanMessage,
        emoji: emoji
    };
}

// Extract mood from the original response and convert to emoji
function extractMoodEmoji(rawResponse) {
    // Look specifically inside *action* parts
    const actionMatches = rawResponse.match(/\*([^*]*)\*/g);
    
    if (!actionMatches) {
        return '😐'; // Default if no actions found
    }
    
    // Combine all action text
    const allActions = actionMatches.join(' ').toLowerCase();
    console.log('Action text found:', allActions); // DEBUG
    
    const moodMappings = {
        // Negative emotions
        'eye roll': '🙄',
        'roll': '🙄',
        'eyebrow': '🤨', 
        'raises eyebrow': '🤨',
        'unimpressed': '😑',
        'annoyed': '😤',
        'frustrated': '😠',
        'uncomfortable': '😬',
        'nervous': '😰',
        'confused': '😕',
        'suspicious': '🤔',
        'bored': '😴',
        'dismissive': '🙄',
        'skeptical': '🤨',
        'scoffs': '😤',
        'sighs': '😔',
        
        // Positive emotions  
        'smile': '😊',
        'smiles': '😊',
        'grin': '😁',
        'grins': '😁',
        'laugh': '😄',
        'laughs': '😄',
        'excited': '😃',
        'happy': '😊',
        'interested': '🤔',
        'curious': '🧐',
        'impressed': '😮',
        'surprised': '😲',
        'amused': '😏',
        'lights up': '😊',
        
        // Neutral/thoughtful
        'nod': '😌',
        'nods': '😌',
        'thoughtful': '🤔',
        'thinks': '🤔',
        'considering': '🤔',
        'pause': '😐',
        'pauses': '😐',
        'shrug': '🤷',
        'shrugs': '🤷',
        
        // Physical actions that imply emotion
        'sip': '😌',
        'sips': '😌',
        'takes a sip': '😌',
        'lean': '🤔',
        'leans': '🤔',
        'cross arms': '😤',
        'crosses arms': '😤',
        'look away': '😑',
        'looks away': '😑',
        'turns away': '😑'
    };
    
    // Find matching mood keywords (check longest matches first)
    const sortedKeywords = Object.keys(moodMappings).sort((a, b) => b.length - a.length);
    
    for (const keyword of sortedKeywords) {
        if (allActions.includes(keyword)) {
            console.log('Matched keyword:', keyword, '→', moodMappings[keyword]); // DEBUG
            return moodMappings[keyword];
        }
    }
    
    // Fallback: check the main message tone
    const lowerResponse = rawResponse.toLowerCase();
    if (lowerResponse.includes('?')) return '🤔';
    if (lowerResponse.includes('!')) return '😊';
    if (lowerResponse.includes('...')) return '😐';
    if (lowerResponse.includes('uh') || lowerResponse.includes('um')) return '😕';
    
    // Default neutral
    return '😐';
}

// Update the mood indicator
function updateMoodIndicator(emoji, characterInfo) {
    const moodElement = document.getElementById('characterMood');
    const nameElement = document.getElementById('characterName');
    
    if (moodElement) {
        moodElement.textContent = emoji;
    }
    
    if (nameElement && characterInfo) {
        // Extract just the name from "Name (type)" format
        const name = characterInfo.split(' (')[0];
        nameElement.textContent = name;
    }
}
