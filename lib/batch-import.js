// Batch Import Module for PromptPal
// Provides stream processing, category detection, and duplicate handling

const BatchImporter = {
    // Configuration
    CHUNK_SIZE: 100,  // Lines per processing chunk
    BATCH_SIZE: 50,   // Prompts per storage write

    // Category detection keywords
    CATEGORY_KEYWORDS: {
        '写作': ['写作', '文案', '标题', '小红书', '文章', '博客', '创作', '内容'],
        '编程': ['代码', '程序', '开发', '编程', 'python', 'javascript', 'code', 'function', '函数', 'API'],
        '营销': ['营销', '推广', '广告', '销售', '转化', '品牌', '市场'],
        '翻译': ['翻译', '英文', '中文', 'translate', '语言'],
        '分析': ['分析', '数据', '报告', '总结', '评估', '研究'],
        '教育': ['教学', '学习', '课程', '教育', '培训', '讲解']
    },

    /**
     * Main entry point for batch import
     * @param {string} text - Raw text to import
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async processText(text, options = {}) {
        const {
            skipDuplicates = true,
            overwriteDuplicates = false,
            defaultCategory = '默认分类',
            autoExtractCategory = true,
            onProgress = null,
            onPreviewUpdate = null
        } = options;

        // Get existing prompts for duplicate detection
        const existingPrompts = await Storage.getAllPrompts();
        const existingContentSet = new Set(
            existingPrompts.map(p => p.content.trim().toLowerCase())
        );

        // Parse lines
        const lines = text.split('\n').filter(line => line.trim());
        const total = lines.length;

        if (total === 0) {
            return { success: false, error: '没有找到有效内容' };
        }

        // Results tracking
        const results = {
            newPrompts: [],
            duplicates: [],
            newCategories: new Set(),
            processed: 0,
            total
        };

        // Process in chunks for responsive UI
        for (let i = 0; i < total; i += this.CHUNK_SIZE) {
            const chunk = lines.slice(i, i + this.CHUNK_SIZE);

            for (const line of chunk) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                results.processed++;

                // Check duplicate
                const contentLower = trimmed.toLowerCase();
                const isDuplicate = existingContentSet.has(contentLower);

                if (isDuplicate) {
                    results.duplicates.push({ content: trimmed, index: results.processed });
                    if (skipDuplicates && !overwriteDuplicates) {
                        continue;
                    }
                }

                // Extract category
                let category = defaultCategory;
                let content = trimmed;

                if (autoExtractCategory) {
                    const extracted = this.extractCategory(trimmed);
                    if (extracted) {
                        category = extracted.category;
                        content = extracted.content;
                    } else {
                        // Try auto-detection
                        const detected = this.detectCategory(trimmed);
                        if (detected) {
                            category = detected;
                        }
                    }
                }

                // Track new categories
                const existingCategories = new Set(existingPrompts.map(p => p.category));
                if (!existingCategories.has(category)) {
                    results.newCategories.add(category);
                }

                // Create prompt object
                const prompt = {
                    id: this.generateId(),
                    title: this.generateTitle(content),
                    content: content,
                    category: category,
                    tags: [],
                    variables: [],
                    isStructured: false,
                    isPinned: false,
                    lastUsed: Date.now(),
                    usageCount: 0,
                    createdAt: Date.now(),
                    source: 'batch_import'
                };

                // Auto-detect variables
                if (typeof VariableUtils !== 'undefined') {
                    prompt.variables = VariableUtils.extractVariablesForPrompt(content, []);
                    prompt.isStructured = prompt.variables.length > 0;
                }

                results.newPrompts.push(prompt);

                // If overwriting duplicates, mark for removal
                if (isDuplicate && overwriteDuplicates) {
                    existingContentSet.delete(contentLower);
                }
            }

            // Progress callback
            if (onProgress) {
                onProgress(results.processed, total);
            }

            // Preview callback
            if (onPreviewUpdate) {
                onPreviewUpdate({
                    newCount: results.newPrompts.length,
                    duplicateCount: results.duplicates.length,
                    newCategories: Array.from(results.newCategories),
                    sample: results.newPrompts.slice(-5)
                });
            }

            // Yield to main thread
            await this.yieldToUI();
        }

        return {
            success: true,
            prompts: results.newPrompts,
            duplicates: results.duplicates,
            newCategories: Array.from(results.newCategories),
            stats: {
                total: results.total,
                new: results.newPrompts.length,
                duplicateCount: results.duplicates.length
            }
        };
    },

    /**
     * Commit processed prompts to storage
     * @param {Array} prompts - Prompts to save
     * @param {Object} options - Save options
     * @returns {Promise<Object>} Commit result
     */
    async commitToStorage(prompts, options = {}) {
        const { overwriteDuplicates = false, onProgress = null } = options;

        if (!prompts || prompts.length === 0) {
            return { success: true, added: 0 };
        }

        try {
            const existing = await Storage.getAllPrompts();
            let finalPrompts;

            if (overwriteDuplicates) {
                // Create a map for deduplication
                const contentMap = new Map();
                existing.forEach(p => contentMap.set(p.content.trim().toLowerCase(), p));
                prompts.forEach(p => contentMap.set(p.content.trim().toLowerCase(), p));
                finalPrompts = Array.from(contentMap.values());
            } else {
                finalPrompts = [...existing, ...prompts];
            }

            // Save in batches
            await chrome.storage.local.set({ prompts: finalPrompts });

            if (onProgress) {
                onProgress(prompts.length, prompts.length);
            }

            return {
                success: true,
                added: prompts.length,
                total: finalPrompts.length
            };
        } catch (error) {
            console.error('[BatchImporter] Storage error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Extract category from [分类] prefix
     */
    extractCategory(line) {
        const match = line.match(/^\[([^\]]+)\]\s*(.+)/);
        if (match && match[1] && match[2]) {
            return {
                category: match[1].trim(),
                content: match[2].trim()
            };
        }
        return null;
    },

    /**
     * Auto-detect category from content keywords
     */
    detectCategory(content) {
        const lowerContent = content.toLowerCase();

        for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
            for (const keyword of keywords) {
                if (lowerContent.includes(keyword.toLowerCase())) {
                    return category;
                }
            }
        }

        return null;
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Generate title from content
     */
    generateTitle(content) {
        const firstLine = content.split('\n')[0];
        if (firstLine.length <= 30) {
            return firstLine;
        }
        return firstLine.substring(0, 27) + '...';
    },

    /**
     * Yield to UI thread
     */
    yieldToUI() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 0);
            });
        });
    },

    /**
     * Parse TXT file
     */
    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'UTF-8');
        });
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BatchImporter;
}
