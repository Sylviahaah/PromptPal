// Background service worker for PromptPal
// Handles context menus, keyboard shortcuts, and message passing

console.log('PromptPal background service worker starting...');

// Inline storage helpers (service workers can't importScripts external modules with chrome API)
const StorageHelper = {
    async savePrompt(prompt) {
        const prompts = await this.getAllPrompts();
        const newPrompt = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: prompt.title || this._generateTitle(prompt.content),
            content: prompt.content,
            tags: prompt.tags || [],
            category: prompt.category || 'Uncategorized',
            isPinned: false,
            lastUsed: Date.now(),
            usageCount: 0,
            createdAt: Date.now(),
            sourceUrl: prompt.sourceUrl || ''
        };
        prompts.push(newPrompt);
        await chrome.storage.local.set({ prompts });
        return newPrompt;
    },

    async getAllPrompts() {
        const result = await chrome.storage.local.get(['prompts']);
        return result.prompts || [];
    },

    async incrementUsage(id) {
        const prompts = await this.getAllPrompts();
        const prompt = prompts.find(p => p.id === id);
        if (prompt) {
            prompt.usageCount++;
            prompt.lastUsed = Date.now();
            await chrome.storage.local.set({ prompts });
        }
    },

    async getSettings() {
        const result = await chrome.storage.local.get(['settings']);
        return result.settings || { saveMode: 'quick', language: 'auto' };
    },

    async togglePin(id) {
        const prompts = await this.getAllPrompts();
        const prompt = prompts.find(p => p.id === id);
        if (prompt) {
            prompt.isPinned = !prompt.isPinned;
            await chrome.storage.local.set({ prompts });
            return prompt;
        }
        throw new Error('Prompt not found');
    },

    _generateTitle(content) {
        const firstLine = content.split('\n')[0];
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
    }
};

const MENU_IDS = {
    SAVE_SELECTION: 'save_selection',
    INSERT_PROMPT: 'insert_prompt',
    SEPARATOR: 'separator',
    OPEN_MANAGER: 'open_manager'
};

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('PromptPal installed:', details.reason);

    if (details.reason === 'install') {
        // Create sample prompts for new users
        await createSamplePrompts();

        // Open onboarding in new tab
        chrome.tabs.create({
            url: 'onboarding/onboarding.html'
        });

        // Show "NEW" badge
        chrome.action.setBadgeText({ text: 'NEW' });
        chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });

        // Clear badge after 60 seconds
        setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
        }, 60000);
    }


    // Create context menus
    createContextMenus();
});

/**
 * Keyboard command listener for Alt+S and Alt+P
 */
chrome.commands.onCommand.addListener(async (command) => {
    console.log('[Commands] Received command:', command);

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            console.error('[Commands] No active tab');
            return;
        }

        if (command === 'save_selection') {
            await handleAltSSave(tab);
        } else if (command === 'insert_prompt') {
            await handleInsertPrompt(tab);
        }
    } catch (error) {
        console.error(`[Commands] Error handling ${command}:`, error);
        showNotification('error', 'Shortcut failed: ' + error.message);
    }
});

/**
 * Create context menu items
 */
function createContextMenus() {
    // Remove existing menus first
    chrome.contextMenus.removeAll(() => {
        // Save selection (only visible when text is selected)
        chrome.contextMenus.create({
            id: MENU_IDS.SAVE_SELECTION,
            title: chrome.i18n.getMessage('context_menu_save'),
            contexts: ['selection']
        });

        // Insert prompt (always visible)
        chrome.contextMenus.create({
            id: MENU_IDS.INSERT_PROMPT,
            title: chrome.i18n.getMessage('context_menu_insert'),
            contexts: ['editable']
        });

        // Separator
        chrome.contextMenus.create({
            id: MENU_IDS.SEPARATOR,
            type: 'separator',
            contexts: ['all']
        });

        // Manage library
        chrome.contextMenus.create({
            id: MENU_IDS.OPEN_MANAGER,
            title: chrome.i18n.getMessage('context_menu_manage'),
            contexts: ['all']
        });
    });
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
        case MENU_IDS.SAVE_SELECTION:
            await handleSaveSelection(info, tab);
            break;

        case MENU_IDS.INSERT_PROMPT:
            await handleInsertPrompt(tab);
            break;

        case MENU_IDS.OPEN_MANAGER:
            await handleOpenManager();
            break;
    }
});

/**
 * Handle save selection from context menu
 */
async function handleSaveSelection(info, tab) {
    try {
        const selectedText = info.selectionText;
        console.log('Context menu save clicked, text length:', selectedText?.length);

        if (!selectedText || selectedText.trim().length === 0) {
            console.warn('No text selected');
            showNotification('error', 'Please select some text first');
            return;
        }

        console.log('Selected text:', selectedText.substring(0, 50) + '...');

        const settings = await StorageHelper.getSettings();
        console.log('Save mode:', settings.saveMode);

        if (settings.saveMode === 'quick') {
            // Quick save - no modal
            console.log('Quick saving prompt...');
            const prompt = await StorageHelper.savePrompt({
                content: selectedText,
                sourceUrl: tab.url
            });

            console.log('Prompt saved successfully:', prompt.id);

            // Show success notification
            showNotification('success', chrome.i18n.getMessage('toast_saved') || 'Prompt saved!');

            // Flash icon for visual feedback
            flashIcon();
        } else {
            // Detailed save - open popup with pre-filled data
            console.log('Opening detailed save modal...');
            // Send message to open save modal
            chrome.runtime.sendMessage({
                action: 'open_save_modal',
                data: {
                    content: selectedText,
                    sourceUrl: tab.url,
                    pageTitle: tab.title
                }
            });
        }
    } catch (error) {
        console.error('Error saving selection:', error);
        showNotification('error', chrome.i18n.getMessage('toast_error'));
    }
}

/**
 * Handle insert prompt from context menu
 */
async function handleInsertPrompt(tab) {
    try {
        // Inject content script if not already injected
        await ensureContentScript(tab.id);

        // Send message to show floating UI
        chrome.tabs.sendMessage(tab.id, {
            action: 'show_floating_ui'
        });
    } catch (error) {
        console.error('Error showing insert UI:', error);
    }
}

/**
 * Handle open manager
 */
async function handleOpenManager() {
    // Open manager in new tab
    chrome.tabs.create({
        url: chrome.runtime.getURL('popup/manager.html')
    });
}

/**
 * Handle keyboard shortcuts
 */
chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return;

    switch (command) {
        case 'save_selection':
            await handleQuickSave(tab);
            break;

        case 'insert_prompt':
            await handleInsertPrompt(tab);
            break;
    }
});

/**
 * Handle Alt+S quick save
 */
async function handleQuickSave(tab) {
    try {
        // Inject content script to get selection
        await ensureContentScript(tab.id);

        // Get selected text from page
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'get_selection'
        });

        if (!response || !response.text || response.text.trim().length === 0) {
            showNotification('error', 'Please select some text first');
            return;
        }

        // Check user's save mode preference
        const settings = await StorageHelper.getSettings();
        console.log('Alt+S save mode:', settings.saveMode);

        if (settings.saveMode === 'detailed') {
            // Detailed mode - open popup for editing
            console.log('Opening popup for detailed save...');
            await chrome.storage.local.set({
                pendingSave: {
                    content: response.text.trim(),
                    sourceUrl: tab.url,
                    timestamp: Date.now()
                }
            });
            chrome.action.openPopup();
        } else {
            // Quick mode - save directly (default)
            console.log('Quick saving directly...');
            const prompt = await StorageHelper.savePrompt({
                content: response.text.trim(),
                sourceUrl: tab.url
            });

            console.log('Saved prompt:', prompt.id);

            // Show success notification
            showNotification('success', chrome.i18n.getMessage('toast_saved'));

            // Flash icon
            flashIcon();
        }
    } catch (error) {
        console.error('Error in quick save:', error);
        showNotification('error', chrome.i18n.getMessage('toast_error'));
    }
}

/**
 * Handle messages from other parts of extension
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'save_prompt') {
        // Save prompt from popup or content script
        StorageHelper.savePrompt(message.data)
            .then(prompt => sendResponse({ success: true, prompt }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Async response
    }

    if (message.action === 'get_prompts') {
        // Get prompts for popup
        StorageHelper.getAllPrompts()
            .then(prompts => sendResponse({ success: true, prompts }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (message.action === 'insert_prompt') {
        // Insert prompt into active tab
        (async () => {
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]) {
                    await ensureContentScript(tabs[0].id);

                    // Send message to content script
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'inject_prompt',
                        text: message.text
                    });

                    // Increment usage
                    if (message.promptId) {
                        await StorageHelper.incrementUsage(message.promptId);
                    }

                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'No active tab found' });
                }
            } catch (error) {
                console.error('[Background] Insert prompt error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Async response
    }

    if (message.action === 'show_notification') {
        showNotification(message.type, message.message);
        sendResponse({ success: true });
        // No return true - this is synchronous
    }
});

/**
 * Ensure content script is injected
 */
async function ensureContentScript(tabId) {
    try {
        // Try to send a ping message
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('Content script already injected, response:', response);
        return true;
    } catch (error) {
        // Content script not injected, inject it now
        console.log('Content script not found, injecting...');
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content_script.js']
            });

            console.log('Content script injected successfully');

            // Wait a bit for script to initialize
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify injection worked
            try {
                await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                console.log('Content script verified');
                return true;
            } catch (verifyError) {
                console.error('Content script injection verification failed:', verifyError);
                throw verifyError;
            }
        } catch (injectError) {
            console.error('Error injecting content script:', injectError);
            console.error('Tab ID:', tabId);
            console.error('Error details:', injectError.message);
            throw new Error('Cannot inject content script. Make sure you are on a regular web page (not chrome://, edge://, or extension pages).');
        }
    }
}

/**
 * Show notification
 */
function showNotification(type, message) {
    const icons = {
        success: 'icons/icon-48.png',
        error: 'icons/icon-48.png',
        info: 'icons/icon-48.png'
    };

    chrome.notifications.create({
        type: 'basic',
        iconUrl: icons[type] || icons.info,
        title: 'PromptPal',
        message: message,
        priority: 1
    });

    // Auto-clear notification after 3 seconds
    setTimeout(() => {
        chrome.notifications.getAll((notifications) => {
            Object.keys(notifications).forEach(id => {
                chrome.notifications.clear(id);
            });
        });
    }, 3000);
}

/**
 * Flash extension icon for visual feedback
 */
function flashIcon() {
    const originalPath = {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
    };

    // Set badge
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });

    // Clear after 1 second
    setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
    }, 1000);
}

console.log('PromptPal background service worker loaded');
/**
 * Create sample prompts for first-time users
 */
async function createSamplePrompts() {
    console.log('Creating sample prompts...');

    const samplePrompts = [
        {
            title: "Professional Email Template",
            content: "Write a professional email to [recipient] regarding [topic]. Use a friendly but formal tone, include a clear call-to-action, and keep it concise (under 200 words).",
            category: "Writing",
            tags: ["email", "professional", "template"],
            isSample: true
        },
        {
            title: "Code Review Request",
            content: "Please review this code for:\n1. Best practices and design patterns\n2. Performance optimizations\n3. Security concerns\n4. Code readability and maintainability\n5. Potential bugs or edge cases\n\nProvide specific suggestions with examples.",
            category: "Coding",
            tags: ["code review", "development", "quality"],
            isSample: true
        },
        {
            title: "Meeting Summary Generator",
            content: "Summarize this meeting transcript into:\n- Key decisions made\n- Action items (who, what, when)\n- Important discussion points\n- Next steps\n\nFormat it as a clear, scannable list.",
            category: "Productivity",
            tags: ["meeting", "summary", "organization"],
            isSample: true
        },
        {
            title: "Content Brainstorm",
            content: "Generate 10 creative content ideas about [topic] for [audience]. Each idea should:\n- Be unique and engaging\n- Include a catchy title\n- Have a brief 1-sentence description\n- Align with current trends",
            category: "Writing",
            tags: ["brainstorm", "content", "ideas"],
            isSample: true
        },
        {
            title: "Debug Assistant",
            content: "Help me debug this issue:\n\nError: [error message]\nCode: [paste code]\nExpected: [expected behavior]\nActual: [what's happening]\n\nPlease:\n1. Identify the root cause\n2. Explain why it's happening\n3. Provide a fixed version\n4. Suggest how to prevent similar issues",
            category: "Coding",
            tags: ["debugging", "troubleshooting", "help"],
            isSample: true
        }
    ];

    try {
        for (const prompt of samplePrompts) {
            await StorageHelper.savePrompt({
                content: prompt.content,
                title: prompt.title,
                category: prompt.category,
                tags: prompt.tags,
                sourceUrl: 'chrome-extension://sample-prompts'
            });
        }

        console.log(`Created ${samplePrompts.length} sample prompts`);
    } catch (error) {
        console.error('Error creating sample prompts:', error);
    }
}
