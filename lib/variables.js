// Variable utilities for PromptPal Structured Prompts
// Handles detection, extraction, and replacement of [variable] patterns

const VariableUtils = {
    // Regex pattern for detecting variables: [variableName]
    VARIABLE_REGEX: /\[([^\[\]]+)\]/g,

    /**
     * Detect all variables in content
     * @param {string} content - Prompt content to scan
     * @returns {Array} Array of unique variable names found
     */
    detectVariableNames(content) {
        if (!content || typeof content !== 'string') {
            return [];
        }

        const variables = [];
        const seen = new Set();
        let match;

        // Reset regex lastIndex
        this.VARIABLE_REGEX.lastIndex = 0;

        while ((match = this.VARIABLE_REGEX.exec(content)) !== null) {
            const varName = match[1].trim();

            // Skip if empty or already seen
            if (!varName || seen.has(varName.toLowerCase())) {
                continue;
            }

            seen.add(varName.toLowerCase());
            variables.push(varName);
        }

        return variables;
    },

    /**
     * Check if content has any variables
     * @param {string} content - Prompt content to check
     * @returns {boolean} True if has variables
     */
    hasVariables(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }
        this.VARIABLE_REGEX.lastIndex = 0;
        return this.VARIABLE_REGEX.test(content);
    },

    /**
     * Extract variable definitions from content
     * Merges with existing variable configs to preserve user settings
     * @param {string} content - Prompt content
     * @param {Array} existingVariables - Previously configured variables
     * @returns {Array} Updated variable definitions
     */
    extractVariablesForPrompt(content, existingVariables = []) {
        const detectedNames = this.detectVariableNames(content);

        if (detectedNames.length === 0) {
            return [];
        }

        // Create lookup for existing variable configs
        const existingMap = new Map();
        existingVariables.forEach(v => {
            existingMap.set(v.name.toLowerCase(), v);
        });

        // Build variables array, preserving existing configs
        return detectedNames.map(name => {
            const existing = existingMap.get(name.toLowerCase());

            if (existing) {
                // Preserve existing config but ensure name matches current
                return { ...existing, name };
            }

            // Create default variable config
            return this.createDefaultVariable(name);
        });
    },

    /**
     * Create default variable configuration
     * @param {string} name - Variable name
     * @returns {Object} Default variable config
     */
    createDefaultVariable(name) {
        return {
            name: name,
            type: 'text',
            placeholder: `Enter ${this._formatVariableName(name)}`,
            example: '',
            description: '',
            required: true,
            // For 'options' type
            options: [],
            default: '',
            // For 'number' type
            min: null,
            max: null,
            step: 1
        };
    },

    /**
     * Replace variables in content with values from form data
     * @param {string} content - Original content with [variables]
     * @param {Object} formData - Key-value pairs of variable values
     * @returns {string} Content with variables replaced
     */
    replaceVariables(content, formData) {
        if (!content || typeof content !== 'string') {
            return content;
        }

        let result = content;

        Object.keys(formData).forEach(varName => {
            const value = formData[varName];
            // Replace all occurrences of [varName] with value
            // Using a function to handle special replacement characters
            const pattern = new RegExp(`\\[${this._escapeRegex(varName)}\\]`, 'gi');
            result = result.replace(pattern, () => value || '');
        });

        return result;
    },

    /**
     * Validate form data against variable definitions
     * @param {Array} variables - Variable definitions
     * @param {Object} formData - Submitted form data
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validateFormData(variables, formData) {
        const errors = [];

        variables.forEach(variable => {
            const value = formData[variable.name];

            // Check required
            if (variable.required && (!value || value.toString().trim() === '')) {
                errors.push({
                    field: variable.name,
                    message: `${this._formatVariableName(variable.name)} is required`
                });
                return;
            }

            // Skip further validation if empty and not required
            if (!value || value.toString().trim() === '') {
                return;
            }

            // Type-specific validation
            if (variable.type === 'number') {
                const numValue = parseFloat(value);

                if (isNaN(numValue)) {
                    errors.push({
                        field: variable.name,
                        message: `${this._formatVariableName(variable.name)} must be a number`
                    });
                    return;
                }

                if (variable.min !== null && numValue < variable.min) {
                    errors.push({
                        field: variable.name,
                        message: `${this._formatVariableName(variable.name)} must be at least ${variable.min}`
                    });
                }

                if (variable.max !== null && numValue > variable.max) {
                    errors.push({
                        field: variable.name,
                        message: `${this._formatVariableName(variable.name)} must be at most ${variable.max}`
                    });
                }
            }

            if (variable.type === 'options' && variable.options.length > 0) {
                if (!variable.options.includes(value)) {
                    errors.push({
                        field: variable.name,
                        message: `Invalid option for ${this._formatVariableName(variable.name)}`
                    });
                }
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Generate preview of content with example values
     * @param {string} content - Original content
     * @param {Array} variables - Variable definitions with examples
     * @returns {string} Preview content
     */
    generatePreview(content, variables) {
        const previewData = {};

        variables.forEach(v => {
            if (v.example) {
                previewData[v.name] = v.example;
            } else if (v.default) {
                previewData[v.name] = v.default;
            } else if (v.type === 'options' && v.options.length > 0) {
                previewData[v.name] = v.options[0];
            } else {
                previewData[v.name] = `[${v.name}]`;
            }
        });

        return this.replaceVariables(content, previewData);
    },

    // ========== HELPERS ==========

    /**
     * Format variable name for display
     * Converts snake_case or camelCase to Title Case
     * @param {string} name - Variable name
     * @returns {string} Formatted name
     */
    _formatVariableName(name) {
        return name
            // Add space before capital letters (camelCase)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Replace underscores and hyphens with spaces
            .replace(/[_-]/g, ' ')
            // Capitalize first letter of each word
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
    },

    /**
     * Escape special regex characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Count variables in content
     * @param {string} content - Prompt content
     * @returns {number} Number of unique variables
     */
    countVariables(content) {
        return this.detectVariableNames(content).length;
    },

    /**
     * Get variable positions in content (for highlighting)
     * @param {string} content - Prompt content
     * @returns {Array} Array of { name, start, end } objects
     */
    getVariablePositions(content) {
        if (!content || typeof content !== 'string') {
            return [];
        }

        const positions = [];
        let match;

        this.VARIABLE_REGEX.lastIndex = 0;

        while ((match = this.VARIABLE_REGEX.exec(content)) !== null) {
            positions.push({
                name: match[1].trim(),
                start: match.index,
                end: match.index + match[0].length,
                fullMatch: match[0]
            });
        }

        return positions;
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VariableUtils;
}
