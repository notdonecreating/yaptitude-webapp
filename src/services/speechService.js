const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class SpeechService {
    constructor() {
        // For MVP, we'll use browser APIs primarily
        // These server-side methods are for future cloud-based speech processing
        this.textToSpeechProvider = process.env.TTS_PROVIDER || 'browser'; // 'browser', 'elevenlabs', 'openai'
        this.speechToTextProvider = process.env.STT_PROVIDER || 'browser'; // 'browser', 'openai', 'google'
        
        // Voice settings for different characters
        this.characterVoices = {
            practice_partner: {
                name: 'neutral',
                pitch: 1.0,
                rate: 1.0,
                voice: 'alloy' // OpenAI voice
            },
            quiet_observer: {
                name: 'soft',
                pitch: 1.1,
                rate: 0.9,
                voice: 'nova'
            },
            laid_back_guy: {
                name: 'casual',
                pitch: 0.9,
                rate: 0.85,
                voice: 'onyx'
            },
            bubbly_nervous: {
                name: 'energetic',
                pitch: 1.2,
                rate: 1.1,
                voice: 'shimmer'
            },
            self_centered: {
                name: 'confident',
                pitch: 0.95,
                rate: 1.05,
                voice: 'fable'
            },
            curious_questioner: {
                name: 'warm',
                pitch: 1.05,
                rate: 1.0,
                voice: 'alloy'
            }
        };

        // Audio storage for caching
        this.audioCache = new Map();
        this.cacheDir = path.join(__dirname, '../../storage/audio');
        this.initializeAudioStorage();
    }

    /**
     * Initialize audio storage directory
     */
    async initializeAudioStorage() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.error('Failed to initialize audio storage:', error);
        }
    }

    /**
     * Convert text to speech
     * @param {string} text - Text to convert
     * @param {string} characterId - Character ID for voice selection
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Audio data or instructions for browser
     */
    async textToSpeech(text, characterId = 'practice_partner', options = {}) {
        try {
            const voiceConfig = this.characterVoices[characterId] || this.characterVoices.practice_partner;
            
            // Check cache first
            const cacheKey = this.generateCacheKey(text, characterId);
            if (this.audioCache.has(cacheKey)) {
                return {
                    success: true,
                    cached: true,
                    audioData: this.audioCache.get(cacheKey)
                };
            }

            // For MVP, return browser TTS instructions
            if (this.textToSpeechProvider === 'browser') {
                return {
                    success: true,
                    provider: 'browser',
                    instructions: {
                        text: text,
                        voice: voiceConfig.name,
                        pitch: voiceConfig.pitch,
                        rate: voiceConfig.rate,
                        volume: options.volume || 0.8
                    }
                };
            }

            // Cloud TTS providers (for future implementation)
            switch (this.textToSpeechProvider) {
                case 'openai':
                    return await this.openAITextToSpeech(text, voiceConfig, options);
                case 'elevenlabs':
                    return await this.elevenLabsTextToSpeech(text, voiceConfig, options);
                default:
                    throw new Error(`Unsupported TTS provider: ${this.textToSpeechProvider}`);
            }

        } catch (error) {
            console.error('Text-to-speech error:', error);
            return {
                success: false,
                error: error.message,
                fallback: {
                    provider: 'browser',
                    instructions: {
                        text: text,
                        voice: 'default',
                        pitch: 1.0,
                        rate: 1.0,
                        volume: 0.8
                    }
                }
            };
        }
    }

    /**
     * Convert speech to text (placeholder for cloud services)
     * @param {Buffer} audioBuffer - Audio data
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} Transcription result
     */
    async speechToText(audioBuffer, options = {}) {
        try {
            // For MVP, this will be handled by browser APIs
            // This server method is for future cloud-based processing
            
            if (this.speechToTextProvider === 'browser') {
                return {
                    success: true,
                    provider: 'browser',
                    message: 'Speech-to-text should be handled by browser APIs'
                };
            }

            // Cloud STT providers (for future implementation)
            switch (this.speechToTextProvider) {
                case 'openai':
                    return await this.openAISpeechToText(audioBuffer, options);
                case 'google':
                    return await this.googleSpeechToText(audioBuffer, options);
                default:
                    throw new Error(`Unsupported STT provider: ${this.speechToTextProvider}`);
            }

        } catch (error) {
            console.error('Speech-to-text error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get voice configuration for character
     * @param {string} characterId - Character ID
     * @returns {Object} Voice configuration
     */
    getVoiceConfig(characterId) {
        return this.characterVoices[characterId] || this.characterVoices.practice_partner;
    }

    /**
     * Get all available voices for frontend
     * @returns {Object} Available voices by character
     */
    getAvailableVoices() {
        return {
            characters: this.characterVoices,
            browserSupported: true,
            cloudProviders: {
                openai: !!process.env.OPENAI_API_KEY,
                elevenlabs: !!process.env.ELEVENLABS_API_KEY,
                google: !!process.env.GOOGLE_CLOUD_KEY
            }
        };
    }

    /**
     * Validate audio file format
     * @param {Buffer} audioBuffer - Audio data
     * @returns {Object} Validation result
     */
    validateAudioFormat(audioBuffer) {
        try {
            // Basic validation - check file headers
            const header = audioBuffer.slice(0, 12);
            
            // WAV file
            if (header.slice(0, 4).toString() === 'RIFF' && header.slice(8, 12).toString() === 'WAVE') {
                return { valid: true, format: 'wav', mimeType: 'audio/wav' };
            }
            
            // MP3 file
            if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
                return { valid: true, format: 'mp3', mimeType: 'audio/mpeg' };
            }
            
            // WebM audio
            if (header.slice(0, 4).toString('hex') === '1a45dfa3') {
                return { valid: true, format: 'webm', mimeType: 'audio/webm' };
            }
            
            return { valid: false, error: 'Unsupported audio format' };

        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get speech service statistics
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        return {
            provider: {
                tts: this.textToSpeechProvider,
                stt: this.speechToTextProvider
            },
            cache: {
                size: this.audioCache.size,
                characters: Object.keys(this.characterVoices).length
            },
            capabilities: {
                browserTTS: true,
                browserSTT: true,
                cloudTTS: this.textToSpeechProvider !== 'browser',
                cloudSTT: this.speechToTextProvider !== 'browser'
            }
        };
    }

    // Private cloud provider methods (for future implementation)

    /**
     * OpenAI Text-to-Speech (future implementation)
     * @param {string} text - Text to convert
     * @param {Object} voiceConfig - Voice configuration
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Audio result
     */
    async openAITextToSpeech(text, voiceConfig, options) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const response = await axios.post(
                'https://api.openai.com/v1/audio/speech',
                {
                    model: 'tts-1',
                    input: text,
                    voice: voiceConfig.voice || 'alloy',
                    speed: voiceConfig.rate || 1.0
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer'
                }
            );

            const audioData = Buffer.from(response.data);
            const cacheKey = this.generateCacheKey(text, voiceConfig.voice);
            
            // Cache the result
            this.audioCache.set(cacheKey, {
                data: audioData,
                mimeType: 'audio/mpeg',
                timestamp: new Date()
            });

            return {
                success: true,
                provider: 'openai',
                audioData: audioData,
                mimeType: 'audio/mpeg'
            };

        } catch (error) {
            throw new Error(`OpenAI TTS error: ${error.message}`);
        }
    }

    /**
     * ElevenLabs Text-to-Speech (future implementation)
     * @param {string} text - Text to convert
     * @param {Object} voiceConfig - Voice configuration
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Audio result
     */
    async elevenLabsTextToSpeech(text, voiceConfig, options) {
        if (!process.env.ELEVENLABS_API_KEY) {
            throw new Error('ElevenLabs API key not configured');
        }

        // ElevenLabs implementation would go here
        throw new Error('ElevenLabs TTS not yet implemented');
    }

    /**
     * OpenAI Speech-to-Text (future implementation)
     * @param {Buffer} audioBuffer - Audio data
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} Transcription result
     */
    async openAISpeechToText(audioBuffer, options) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const FormData = require('form-data');
            const form = new FormData();
            
            form.append('file', audioBuffer, {
                filename: 'audio.wav',
                contentType: 'audio/wav'
            });
            form.append('model', 'whisper-1');
            
            if (options.language) {
                form.append('language', options.language);
            }

            const response = await axios.post(
                'https://api.openai.com/v1/audio/transcriptions',
                form,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        ...form.getHeaders()
                    }
                }
            );

            return {
                success: true,
                provider: 'openai',
                transcript: response.data.text,
                confidence: 1.0 // OpenAI doesn't provide confidence scores
            };

        } catch (error) {
            throw new Error(`OpenAI STT error: ${error.message}`);
        }
    }

    /**
     * Google Speech-to-Text (future implementation)
     * @param {Buffer} audioBuffer - Audio data
     * @param {Object} options - Transcription options
     * @returns {Promise<Object>} Transcription result
     */
    async googleSpeechToText(audioBuffer, options) {
        if (!process.env.GOOGLE_CLOUD_KEY) {
            throw new Error('Google Cloud API key not configured');
        }

        // Google Cloud Speech-to-Text implementation would go here
        throw new Error('Google STT not yet implemented');
    }

    /**
     * Generate cache key for audio
     * @param {string} text - Text content
     * @param {string} voice - Voice identifier
     * @returns {string} Cache key
     */
    generateCacheKey(text, voice) {
        const crypto = require('crypto');
        return crypto
            .createHash('md5')
            .update(`${text}_${voice}`)
            .digest('hex');
    }

    /**
     * Clear audio cache
     * @param {number} maxAge - Maximum age in milliseconds (default: 7 days)
     */
    clearAudioCache(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const now = new Date();
        let clearedCount = 0;

        for (const [key, data] of this.audioCache.entries()) {
            if (now - data.timestamp > maxAge) {
                this.audioCache.delete(key);
                clearedCount++;
            }
        }

        console.log(`Cleared ${clearedCount} cached audio files`);
        return clearedCount;
    }

    /**
     * Save audio to file (for debugging/testing)
     * @param {Buffer} audioData - Audio buffer
     * @param {string} filename - Output filename
     * @returns {Promise<string>} File path
     */
    async saveAudioFile(audioData, filename) {
        try {
            const filePath = path.join(this.cacheDir, filename);
            await fs.writeFile(filePath, audioData);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to save audio file: ${error.message}`);
        }
    }

    /**
     * Load audio from file
     * @param {string} filename - Audio filename
     * @returns {Promise<Buffer>} Audio buffer
     */
    async loadAudioFile(filename) {
        try {
            const filePath = path.join(this.cacheDir, filename);
            return await fs.readFile(filePath);
        } catch (error) {
            throw new Error(`Failed to load audio file: ${error.message}`);
        }
    }
}

module.exports = SpeechService;