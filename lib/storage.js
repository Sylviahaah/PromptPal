// Storage abstraction layer for PromptPal
// Provides complete CRUD operations for prompts, settings, and premium data

const Storage = {
    // Default settings structure
    DEFAULT_SETTINGS: {
        language: 'auto', // 'auto', 'en', 'zh_CN'
        saveMode: 'quick', // 'detailed' or 'quick'
        defaultCategory: 'Uncategorized',
        shortcutConflictResolved: false,
        autoTaggingUsed: 0, // Trial counter (0-3)
        theme: 'auto' // 'auto', 'light', 'dark'
    },

    DEFAULT_PREMIUM: {
        activated: false,
        licenseKey: '',
        expiresAt: null,
        features: [],
        lastModalDismissed: null
    },

    // ========== PROMPTS ==========

    /**
     * Save a new prompt
     * @param {Object} prompt - Prompt data (content, title optional)
     * @returns {Promise<Object>} Saved prompt with generated ID
     */
    async savePrompt(prompt) {
        try {
            const prompts = await this.getAllPrompts();

            const newPrompt = {
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: prompt.title || this._generateTitle(prompt.content),
                content: prompt.content,
                tags: prompt.tags || [],
                category: prompt.category || 'Uncategorized',
                autoTags: [],
                autoCategory: '',
                isPinned: false,
                lastUsed: Date.now(),
                usageCount: 0,
                createdAt: Date.now(),
                sourceUrl: prompt.sourceUrl || ''
            };

            prompts.push(newPrompt);
            await chrome.storage.local.set({ prompts });

            return newPrompt;
        } catch (error) {
            console.error('Error saving prompt:', error);
            throw error;
        }
    },

    /**
     * Get all prompts, sorted by lastUsed descending
     * @returns {Promise<Array>} All prompts
     */
    async getAllPrompts() {
        try {
            const result = await chrome.storage.local.get(['prompts']);
            return result.prompts || [];
        } catch (error) {
            console.error('Error getting prompts:', error);
            return [];
        }
    },

    /**
     * Get recent prompts (most recently used)
     * @param {number} limit - Number of prompts to return
     * @returns {Promise<Array>} Recent prompts
     */
    async getRecentPrompts(limit = 3) {
        const prompts = await this.getAllPrompts();
        return prompts
            .filter(p => !p.isPinned)
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, limit);
    },

    /**
     * Get pinned prompts
     * @returns {Promise<Array>} Pinned prompts
     */
    async getPinnedPrompts() {
        const prompts = await this.getAllPrompts();
        return prompts
            .filter(p => p.isPinned)
            .sort((a, b) => b.lastUsed - a.lastUsed);
    },

    /**
     * Update an existing prompt
     * @param {string} id - Prompt ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated prompt
     */
    async updatePrompt(id, updates) {
        try {
            const prompts = await this.getAllPrompts();
            const index = prompts.findIndex(p => p.id === id);

            if (index === -1) {
                throw new Error('Prompt not found');
            }

            prompts[index] = { ...prompts[index], ...updates };
            await chrome.storage.local.set({ prompts });

            return prompts[index];
        } catch (error) {
            console.error('Error updating prompt:', error);
            throw error;
        }
    },

    /**
     * Delete a prompt
     * @param {string} id - Prompt ID
     * @returns {Promise<boolean>} Success status
     */
    async deletePrompt(id) {
        try {
            const prompts = await this.getAllPrompts();
            const filtered = prompts.filter(p => p.id !== id);

            if (filtered.length === prompts.length) {
                throw new Error('Prompt not found');
            }

            await chrome.storage.local.set({ prompts: filtered });
            return true;
        } catch (error) {
            console.error('Error deleting prompt:', error);
            throw error;
        }
    },

    /**
     * Increment usage count and update lastUsed timestamp
     * @param {string} id - Prompt ID
     * @returns {Promise<Object>} Updated prompt
     */
    async incrementUsage(id) {
        const prompts = await this.getAllPrompts();
        const prompt = prompts.find(p => p.id === id);

        if (prompt) {
            return await this.updatePrompt(id, {
                usageCount: prompt.usageCount + 1,
                lastUsed: Date.now()
            });
        }

        throw new Error('Prompt not found');
    },

    /**
     * Toggle pin status
     * @param {string} id - Prompt ID
     * @returns {Promise<Object>} Updated prompt
     */
    async togglePin(id) {
        const prompts = await this.getAllPrompts();
        const prompt = prompts.find(p => p.id === id);

        if (prompt) {
            return await this.updatePrompt(id, {
                isPinned: !prompt.isPinned
            });
        }

        throw new Error('Prompt not found');
    },

    // ========== SETTINGS ==========

    /**
     * Get all settings with defaults
     * @returns {Promise<Object>} Settings object
     */
    async getSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            return { ...this.DEFAULT_SETTINGS, ...result.settings };
        } catch (error) {
            console.error('Error getting settings:', error);
            return this.DEFAULT_SETTINGS;
        }
    },

    /**
     * Update settings (partial update)
     * @param {Object} updates - Settings to update
     * @returns {Promise<Object>} Updated settings
     */
    async updateSettings(updates) {
        try {
            const currentSettings = await this.getSettings();
            const newSettings = { ...currentSettings, ...updates };
            await chrome.storage.local.set({ settings: newSettings });
            return newSettings;
        } catch (error) {
            console.error('Error updating settings:', error);
            throw error;
        }
    },

    /**
     * Reset settings to defaults
     * @returns {Promise<Object>} Default settings
     */
    async resetSettings() {
        await chrome.storage.local.set({ settings: this.DEFAULT_SETTINGS });
        return this.DEFAULT_SETTINGS;
    },

    // ========== PREMIUM ==========

    /**
     * Get premium status
     * @returns {Promise<Object>} Premium data
     */
    async getPremiumStatus() {
        try {
            const result = await chrome.storage.local.get(['premium']);
            return { ...this.DEFAULT_PREMIUM, ...result.premium };
        } catch (error) {
            console.error('Error getting premium status:', error);
            return this.DEFAULT_PREMIUM;
        }
    },

    /**
     * Update premium status
     * @param {Object} updates - Premium data to update
     * @returns {Promise<Object>} Updated premium status
     */
    async updatePremiumStatus(updates) {
        try {
            const currentPremium = await this.getPremiumStatus();
            const newPremium = { ...currentPremium, ...updates };
            await chrome.storage.local.set({ premium: newPremium });
            return newPremium;
        } catch (error) {
            console.error('Error updating premium status:', error);
            throw error;
        }
    },

    /**
     * Increment auto-tagging usage count
     * @returns {Promise<number>} New usage count
     */
    async incrementAutoTagUsage() {
        const settings = await this.getSettings();
        const newCount = settings.autoTaggingUsed + 1;
        await this.updateSettings({ autoTaggingUsed: newCount });
        return newCount;
    },

    // ========== DATA MANAGEMENT ==========

    /**
     * Export all data as JSON
     * @returns {Promise<Object>} All extension data
     */
    async exportData() {
        try {
            const prompts = await this.getAllPrompts();
            const settings = await this.getSettings();

            return {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                prompts,
                settings: {
                    ...settings,
                    // Don't export autoTaggingUsed counter
                    autoTaggingUsed: 0
                }
            };
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    },

    /**
     * Import data from JSON
     * @param {Object} data - Imported data
     * @param {boolean} merge - If true, merge with existing data; if false, replace
     * @returns {Promise<Object>} Import result with counts
     */
    async importData(data, merge = true) {
        try {
            // Validate data structure
            if (!data.prompts || !Array.isArray(data.prompts)) {
                throw new Error('Invalid import data format');
            }

            let finalPrompts;

            if (merge) {
                const existingPrompts = await this.getAllPrompts();
                const existingIds = new Set(existingPrompts.map(p => p.id));

                // Add only new prompts (by ID)
                const newPrompts = data.prompts.filter(p => !existingIds.has(p.id));
                finalPrompts = [...existingPrompts, ...newPrompts];
            } else {
                finalPrompts = data.prompts;
            }

            await chrome.storage.local.set({ prompts: finalPrompts });

            // Optionally import settings (always merge, never replace)
            if (data.settings) {
                const currentSettings = await this.getSettings();
                await this.updateSettings({ ...currentSettings, ...data.settings });
            }

            return {
                success: true,
                promptsImported: merge ?
                    finalPrompts.length - (await this.getAllPrompts()).length + data.prompts.length :
                    data.prompts.length,
                totalPrompts: finalPrompts.length
            };
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    },

    /**
     * Clear all data (prompts, settings, premium)
     * @returns {Promise<boolean>} Success status
     */
    async clearAllData() {
        try {
            await chrome.storage.local.clear();
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            throw error;
        }
    },

    // ========== HELPERS ==========

    /**
     * Generate title from content
     * @param {string} content - Prompt content
     * @returns {string} Generated title
     */
    _generateTitle(content) {
        // Take first line or first 50 chars
        const firstLine = content.split('\n')[0];
        return firstLine.length > 50 ?
            firstLine.substring(0, 47) + '...' :
            firstLine;
    },

    /**
     * Get storage usage info
     * @returns {Promise<Object>} Storage usage statistics
     */
    async getStorageInfo() {
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse();
            const prompts = await this.getAllPrompts();

            return {
                bytesInUse,
                promptCount: prompts.length,
                quotaBytes: chrome.storage.local.QUOTA_BYTES || 5242880, // 5MB default
                percentUsed: (bytesInUse / (chrome.storage.local.QUOTA_BYTES || 5242880)) * 100
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return null;
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
