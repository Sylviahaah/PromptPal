// i18n utility module for PromptPal
// Provides wrapper functions for Chrome i18n API and dynamic text updates

const I18n = {
    /**
     * Get translated message
     * @param {string} key - Message key from messages.json
     * @param {string|Array} substitutions - Optional substitution values
     * @returns {string} Translated message
     */
    getMessage(key, substitutions = null) {
        try {
            return chrome.i18n.getMessage(key, substitutions) || key;
        } catch (error) {
            console.error(`i18n error for key "${key}":`, error);
            return key;
        }
    },

    /**
     * Get current browser/extension language
     * @returns {string} Language code (e.g., 'en', 'zh_CN')
     */
    getCurrentLanguage() {
        return chrome.i18n.getUILanguage().replace('-', '_');
    },

    /**
     * Update all elements with data-i18n attributes
     * Searches for elements with:
     * - data-i18n: Text content
     * - data-i18n-placeholder: Placeholder attribute
     * - data-i18n-title: Title attribute
     * - data-i18n-aria-label: Aria-label attribute
     */
    updatePageText() {
        // Update text content
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                element.textContent = this.getMessage(key);
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (key) {
                element.placeholder = this.getMessage(key);
            }
        });

        // Update titles
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (key) {
                element.title = this.getMessage(key);
            }
        });

        // Update aria-labels
        document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
            const key = element.getAttribute('data-i18n-aria-label');
            if (key) {
                element.setAttribute('aria-label', this.getMessage(key));
            }
        });
    },

    /**
     * Change language preference and update UI
     * @param {string} lang - Language code ('auto', 'en', 'zh_CN')
     * Note: Chrome extensions can't dynamically change language at runtime.
     * This function saves the preference and requires extension reload.
     */
    async setLanguage(lang) {
        try {
            // Save to storage
            if (typeof Storage !== 'undefined') {
                await Storage.updateSettings({ language: lang });
            }

            // Note: Browser will use the language from _locales automatically
            // We can't force change without reload
            return true;
        } catch (error) {
            console.error('Error setting language:', error);
            return false;
        }
    },

    /**
     * Get user's preferred language from settings
     * Falls back to browser language if 'auto'
     * @returns {Promise<string>} Language code
     */
    async getPreferredLanguage() {
        try {
            if (typeof Storage !== 'undefined') {
                const settings = await Storage.getSettings();

                if (settings.language === 'auto') {
                    return this.getCurrentLanguage();
                }

                return settings.language;
            }

            return this.getCurrentLanguage();
        } catch (error) {
            console.error('Error getting preferred language:', error);
            return this.getCurrentLanguage();
        }
    },

    /**
     * Format message with substitutions
     * Helper for messages with placeholders
     * @param {string} key - Message key
     * @param {Object} substitutions - Key-value pairs for substitution
     * @returns {string} Formatted message
     */
    format(key, substitutions) {
        let message = this.getMessage(key);

        if (substitutions && typeof substitutions === 'object') {
            Object.keys(substitutions).forEach(subKey => {
                const placeholder = `$${subKey.toUpperCase()}$`;
                message = message.replace(placeholder, substitutions[subKey]);
            });
        }

        return message;
    },

    /**
     * Get all category names localized
     * @returns {Array<Object>} Array of {key, label} objects
     */
    getCategories() {
        return [
            { key: 'Uncategorized', label: this.getMessage('category_uncategorized') },
            { key: 'Writing', label: this.getMessage('category_writing') },
            { key: 'Coding', label: this.getMessage('category_coding') },
            { key: 'Analysis', label: this.getMessage('category_analysis') },
            { key: 'Marketing', label: this.getMessage('category_marketing') }
        ];
    },

    /**
     * Get localized category name
     * @param {string} categoryKey - Category key
     * @returns {string} Localized category name
     */
    getCategoryLabel(categoryKey) {
        const messageKey = `category_${categoryKey.toLowerCase()}`;
        return this.getMessage(messageKey);
    },

    /**
     * Initialize i18n on page load
     * Call this in DOMContentLoaded or similar
     */
    init() {
        // Update all text elements
        this.updatePageText();

        // Set lang attribute on html element
        document.documentElement.lang = this.getCurrentLanguage().split('_')[0];
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18n.init());
} else {
    I18n.init();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18n;
}
