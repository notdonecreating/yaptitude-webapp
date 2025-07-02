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
        
        // Add AI response
        addMessage('ai', data.response);
        
        // Add to conversation history
        conversationHistory.push({ role: 'assistant', content: data.response });
        
        // Show feedback after a few exchanges
        if (conversationHistory.length >= 6) {
            showFeedback(data.feedback || "Great job practicing! You're getting better at this.");
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