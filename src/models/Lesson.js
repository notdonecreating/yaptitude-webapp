class Lesson {
    constructor(lessonData) {
        this.id = lessonData.id;
        this.title = lessonData.title;
        this.category = lessonData.category;
        this.description = lessonData.description;
        this.difficulty = lessonData.difficulty;
        this.estimatedTime = lessonData.estimated_time;
        this.prerequisite = lessonData.prerequisite;
        this.unlocks = lessonData.unlocks || [];
        this.levels = lessonData.levels;
        this.characterInstructions = lessonData.character_instructions;
    }

    /**
     * Check if user has met prerequisites for this lesson
     * @param {Object} userProgress - User's completed lessons
     * @returns {boolean}
     */
    isUnlocked(userProgress) {
        if (!this.prerequisite) return true;
        
        // Check if prerequisite lesson is completed at bronze level or higher
        const prereqProgress = userProgress[this.prerequisite];
        return prereqProgress && prereqProgress.highestLevel !== 'none';
    }

    /**
     * Check if a specific level is unlocked for the user
     * @param {string} level - bronze, silver, or gold
     * @param {Object} userProgress - User's progress for this lesson
     * @returns {boolean}
     */
    isLevelUnlocked(level, userProgress) {
        const levelOrder = ['bronze', 'silver', 'gold'];
        const targetIndex = levelOrder.indexOf(level);
        
        if (targetIndex === 0) return true; // Bronze always unlocked
        
        const previousLevel = levelOrder[targetIndex - 1];
        return userProgress.completedLevels && 
               userProgress.completedLevels.includes(previousLevel);
    }

    /**
     * Get the current level data
     * @param {string} level - bronze, silver, or gold
     * @returns {Object}
     */
    getLevelData(level) {
        return this.levels[level];
    }

    /**
     * Check if user has completed a level based on success criteria
     * @param {string} level - bronze, silver, or gold
     * @param {Array} conversationHistory - The practice conversation
     * @param {Object} coachAssessment - Coach's evaluation
     * @returns {boolean}
     */
    isLevelCompleted(level, conversationHistory, coachAssessment) {
        const levelData = this.levels[level];
        if (!levelData) return false;

        // Basic completion requirements
        const hasMinimumExchanges = conversationHistory.length >= 6; // At least 3 exchanges each
        const hasGoodAssessment = coachAssessment.overallGrade >= 0.7; // 70% or better
        
        // Level-specific requirements
        let levelSpecificMet = true;
        
        switch (level) {
            case 'bronze':
                levelSpecificMet = coachAssessment.skillDemonstrated && 
                                 coachAssessment.effortLevel >= 0.6;
                break;
            case 'silver':
                levelSpecificMet = coachAssessment.skillDemonstrated && 
                                 coachAssessment.effortLevel >= 0.7 &&
                                 coachAssessment.naturalness >= 0.6;
                break;
            case 'gold':
                levelSpecificMet = coachAssessment.skillDemonstrated && 
                                 coachAssessment.effortLevel >= 0.8 &&
                                 coachAssessment.naturalness >= 0.7 &&
                                 coachAssessment.mastery >= 0.7;
                break;
        }

        return hasMinimumExchanges && hasGoodAssessment && levelSpecificMet;
    }

    /**
     * Generate system prompt for AI character during this lesson
     * @param {Object} character - Character data from characters.json
     * @param {string} level - Current level being practiced
     * @returns {string}
     */
    generateCharacterPrompt(character, level) {
        const levelData = this.levels[level];
        
        return `You are ${character.name}, a ${character.core_traits.social_energy} ${character.gender} with a ${character.core_traits.persona} personality.

CORE PERSONALITY:
- Response style: ${character.core_traits.response_style}
- Comfort zone: ${character.core_traits.comfort_zone}  
- Social skill level: ${character.core_traits.social_skill_level}

YOUR INTERESTS: ${character.interests.join(', ')}

BEHAVIORAL RULES:
${character.behavioral_rules.map(rule => `- ${rule}`).join('\n')}

LESSON CONTEXT:
- Lesson: ${this.title} (${level} level)
- Learning objective: ${levelData.learning_objective}
- Your role: ${this.characterInstructions.role}
- Behavior instruction: ${this.characterInstructions.behavior}

RESPONSE FORMAT:
- Include emotional reaction in *asterisks* at start: *${this.getRandomMoodResponse(character, 'neutral')}*
- Then give your spoken response
- Example: "*looks interested* That's really cool, tell me more about that."

IMPORTANT: You are helping someone practice ${this.title.toLowerCase()}. ${this.characterInstructions.behavior}`;
    }

    /**
     * Get a random mood response for the character
     * @param {Object} character - Character data
     * @param {string} moodType - Type of mood to express
     * @returns {string}
     */
    getRandomMoodResponse(character, moodType = 'neutral') {
        const responses = character.mood_responses[moodType] || character.mood_responses['comfortable'] || ['nod'];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Get practice prompts for the current level
     * @param {string} level - bronze, silver, or gold
     * @returns {Array}
     */
    getPracticePrompts(level) {
        return this.levels[level].practice_prompts;
    }

    /**
     * Get coach focus areas for feedback
     * @param {string} level - bronze, silver, or gold
     * @returns {string}
     */
    getCoachFocus(level) {
        return this.levels[level].coach_focus;
    }

    /**
     * Calculate lesson progress as percentage
     * @param {Object} userProgress - User's progress for this lesson
     * @returns {number} - Percentage from 0 to 100
     */
    calculateProgress(userProgress) {
        if (!userProgress.completedLevels) return 0;
        
        const totalLevels = Object.keys(this.levels).length;
        const completedCount = userProgress.completedLevels.length;
        
        return Math.round((completedCount / totalLevels) * 100);
    }

    /**
     * Get next recommended level for user
     * @param {Object} userProgress - User's progress for this lesson
     * @returns {string} - Next level to attempt
     */
    getNextLevel(userProgress) {
        const levelOrder = ['bronze', 'silver', 'gold'];
        
        if (!userProgress.completedLevels || userProgress.completedLevels.length === 0) {
            return 'bronze';
        }
        
        for (let level of levelOrder) {
            if (!userProgress.completedLevels.includes(level)) {
                return level;
            }
        }
        
        return 'gold'; // All completed, can practice gold
    }
}

module.exports = Lesson;