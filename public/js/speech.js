// Speech utilities for Yaptitude
class SpeechManager {
    constructor() {
        this.speechSynthesis = window.speechSynthesis;
        this.speechRecognition = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.voices = [];
        this.characterVoices = {};
        
        this.init();
    }

    async init() {
        // Initialize speech recognition
        this.initSpeechRecognition();
        
        // Load voices
        await this.loadVoices();
        
        // Get character voice mappings from server
        await this.loadCharacterVoices();
    }

    initSpeechRecognition() {
        // Check for speech recognition support
        if ('webkitSpeechRecognition' in window) {
            this.speechRecognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.speechRecognition = new SpeechRecognition();
        } else {
            console.warn('Speech recognition not supported in this browser');
            return;
        }

        if (this.speechRecognition) {
            this.speechRecognition.continuous = false;
            this.speechRecognition.interimResults = false;
            this.speechRecognition.lang = 'en-US';
            
            this.speechRecognition.onstart = () => {
                this.isListening = true;
                this.onListeningStart?.();
            };
            
            this.speechRecognition.onend = () => {
                this.isListening = false;
                this.onListeningEnd?.();
            };
            
            this.speechRecognition.onresult = (event) => {
                const result = event.results[0][0].transcript;
                this.onSpeechResult?.(result);
            };
            
            this.speechRecognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isListening = false;
                this.onSpeechError?.(event.error);
            };
        }
    }

    async loadVoices() {
        return new Promise((resolve) => {
            const getVoices = () => {
                this.voices = this.speechSynthesis.getVoices();
                if (this.voices.length > 0) {
                    resolve(this.voices);
                } else {
                    // Try again after a short delay
                    setTimeout(getVoices, 100);
                }
            };

            if (this.speechSynthesis.onvoiceschanged !== undefined) {
                this.speechSynthesis.onvoiceschanged = getVoices;
            }
            
            getVoices();
        });
    }

    async loadCharacterVoices() {
        try {
            const response = await fetch('/api/speech/voices');
            const data = await response.json();
            this.characterVoices = data.characters || {};
        } catch (error) {
            console.error('Error loading character voices:', error);
            // Use default voice mapping
            this.characterVoices = {
                practice_partner: { name: 'neutral', pitch: 1.0, rate: 1.0 },
                quiet_observer: { name: 'soft', pitch: 1.1, rate: 0.9 },
                laid_back_guy: { name: 'casual', pitch: 0.9, rate: 0.85 },
                bubbly_nervous: { name: 'energetic', pitch: 1.2, rate: 1.1 },
                self_centered: { name: 'confident', pitch: 0.95, rate: 1.05 },
                curious_questioner: { name: 'warm', pitch: 1.05, rate: 1.0 }
            };
        }
    }

    // Text-to-Speech methods
    async speak(text, characterId = 'practice_partner', options = {}) {
        if (this.isSpeaking) {
            this.stop();
        }

        const voiceConfig = this.characterVoices[characterId] || this.characterVoices.practice_partner;
        
        return new Promise((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Try to find a suitable voice
            const voice = this.findBestVoice(voiceConfig.name);
            if (voice) {
                utterance.voice = voice;
            }
            
            // Apply voice configuration
            utterance.pitch = voiceConfig.pitch || 1.0;
            utterance.rate = voiceConfig.rate || 1.0;
            utterance.volume = options.volume || 0.8;
            
            utterance.onstart = () => {
                this.isSpeaking = true;
                this.onSpeechStart?.(text, characterId);
            };
            
            utterance.onend = () => {
                this.isSpeaking = false;
                this.onSpeechEnd?.(text, characterId);
                resolve();
            };
            
            utterance.onerror = (event) => {
                this.isSpeaking = false;
                this.onSpeechError?.(event.error);
                reject(event.error);
            };
            
            this.speechSynthesis.speak(utterance);
        });
    }

    findBestVoice(voiceName) {
        if (!this.voices.length) return null;
        
        // Voice mapping based on character types
        const voicePreferences = {
            neutral: ['Samantha', 'Alex', 'Microsoft Zira', 'Google US English'],
            soft: ['Vicki', 'Microsoft Hazel', 'Google UK English Female'],
            casual: ['Fred', 'Microsoft Mark', 'Google US English'],
            energetic: ['Princess', 'Microsoft Zoe', 'Google UK English Female'],
            confident: ['Ralph', 'Microsoft David', 'Google US English'],
            warm: ['Kathy', 'Microsoft Zira', 'Google UK English Female']
        };
        
        const preferences = voicePreferences[voiceName] || voicePreferences.neutral;
        
        // Try to find preferred voices
        for (const preference of preferences) {
            const voice = this.voices.find(v => v.name.includes(preference));
            if (voice) return voice;
        }
        
        // Fallback to English voices
        const englishVoice = this.voices.find(v => v.lang.startsWith('en'));
        return englishVoice || this.voices[0];
    }

    stop() {
        if (this.isSpeaking) {
            this.speechSynthesis.cancel();
            this.isSpeaking = false;
        }
        
        if (this.isListening) {
            this.speechRecognition?.stop();
            this.isListening = false;
        }
    }

    // Speech-to-Text methods
    startListening() {
        if (!this.speechRecognition) {
            this.onSpeechError?.('Speech recognition not supported');
            return false;
        }
        
        if (this.isListening) {
            return false;
        }
        
        try {
            this.speechRecognition.start();
            return true;
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.onSpeechError?.(error.message);
            return false;
        }
    }

    stopListening() {
        if (this.speechRecognition && this.isListening) {
            this.speechRecognition.stop();
        }
    }

    // Utility methods
    isSupported() {
        return {
            speechSynthesis: 'speechSynthesis' in window,
            speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
        };
    }

    getAvailableVoices() {
        return this.voices.map(voice => ({
            name: voice.name,
            lang: voice.lang,
            gender: voice.name.toLowerCase().includes('female') ? 'female' : 'male'
        }));
    }

    // Event handlers (to be overridden)
    onSpeechStart = null;
    onSpeechEnd = null;
    onSpeechError = null;
    onListeningStart = null;
    onListeningEnd = null;
    onSpeechResult = null;
}

// Voice Button Component
class VoiceButton {
    constructor(buttonElement, inputElement, options = {}) {
        this.button = buttonElement;
        this.input = inputElement;
        this.speechManager = options.speechManager || window.speechManager;
        this.isRecording = false;
        
        this.init();
    }

    init() {
        if (!this.speechManager) {
            console.warn('SpeechManager not available');
            return;
        }

        this.button.addEventListener('click', () => {
            this.toggleRecording();
        });

        // Set up speech manager callbacks
        this.speechManager.onListeningStart = () => {
            this.setRecordingState(true);
        };

        this.speechManager.onListeningEnd = () => {
            this.setRecordingState(false);
        };

        this.speechManager.onSpeechResult = (text) => {
            if (this.input) {
                this.input.value = text;
                // Trigger input event for any listeners
                this.input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };

        this.speechManager.onSpeechError = (error) => {
            this.setRecordingState(false);
            console.error('Speech error:', error);
            // Could show user-friendly error message
        };

        // Check if speech recognition is supported
        const support = this.speechManager.isSupported();
        if (!support.speechRecognition) {
            this.button.style.display = 'none';
        }
    }

    toggleRecording() {
        if (this.isRecording) {
            this.speechManager.stopListening();
        } else {
            this.speechManager.startListening();
        }
    }

    setRecordingState(recording) {
        this.isRecording = recording;
        
        if (recording) {
            this.button.textContent = '⏹️';
            this.button.style.background = '#dc3545';
            this.button.setAttribute('title', 'Stop recording');
        } else {
            this.button.textContent = '🎤';
            this.button.style.background = '#28a745';
            this.button.setAttribute('title', 'Start recording');
        }
    }
}

// Text-to-Speech Button Component
class SpeechButton {
    constructor(buttonElement, options = {}) {
        this.button = buttonElement;
        this.speechManager = options.speechManager || window.speechManager;
        this.characterId = options.characterId || 'practice_partner';
        
        this.init();
    }

    init() {
        if (!this.speechManager) {
            console.warn('SpeechManager not available');
            return;
        }

        this.button.addEventListener('click', () => {
            const text = this.getTextToSpeak();
            if (text) {
                this.speak(text);
            }
        });

        // Check if speech synthesis is supported
        const support = this.speechManager.isSupported();
        if (!support.speechSynthesis) {
            this.button.style.display = 'none';
        }
    }

    async speak(text) {
        try {
            this.setSpeakingState(true);
            await this.speechManager.speak(text, this.characterId);
        } catch (error) {
            console.error('Speech error:', error);
        } finally {
            this.setSpeakingState(false);
        }
    }

    getTextToSpeak() {
        // Override this method to specify what text to speak
        return '';
    }

    setSpeakingState(speaking) {
        if (speaking) {
            this.button.textContent = '⏸️';
            this.button.setAttribute('title', 'Stop speaking');
        } else {
            this.button.textContent = '🔊';
            this.button.setAttribute('title', 'Read aloud');
        }
        
        this.button.disabled = speaking;
    }
}

// Initialize global speech manager
window.speechManager = new SpeechManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpeechManager, VoiceButton, SpeechButton };
}