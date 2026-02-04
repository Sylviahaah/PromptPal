// Popup logic for PromptPal
// Handles quick save, prompt display, and insertion

console.log('PromptPal popup loaded');

// DOM elements
const quickSaveInput = document.getElementById('quick-save-input');
const saveBtn = document.getElementById('save-btn');
const promptsList = document.getElementById('prompts-list');
const emptyState = document.getElementById('empty-state');
const settingsBtn = document.getElementById('settings-btn');
const viewAllLink = document.getElementById('view-all-link');

// State
let prompts = [];

/**
 * Initialize popup
 */
async function init() {
    console.log('Initializing PromptPal popup...');

    // Set initial button state (disabled until text is entered)
    saveBtn.disabled = true;

    // Check for pending save from Alt+S shortcut
    await checkPendingSave();

    // Load and display prompts
    await loadPrompts();

    // Setup event listeners
    setupEventListeners();

    // Focus quick save input
    quickSaveInput.focus();

    console.log('PromptPal popup initialized successfully');
}

/**
 * Check if there's a pending save from Alt+S shortcut
 */
async function checkPendingSave() {
    try {
        const { pendingSave } = await chrome.storage.local.get('pendingSave');

        if (pendingSave && pendingSave.text) {
            // Check if not too old (within 5 seconds)
            const age = Date.now() - (pendingSave.timestamp || 0);
            if (age < 5000) {
                console.log('[Popup] Found pending save, prefilling...');
                quickSaveInput.value = pendingSave.text;
                saveBtn.disabled = false;

                // Clear pending save
                await chrome.storage.local.remove('pendingSave');

                console.log('[Popup] Text prefilled from Alt+S');
            } else {
                // Too old, clean up
                await chrome.storage.local.remove('pendingSave');
            }
        }
    } catch (error) {
        console.error('[Popup] Error checking pending save:', error);
    }
}

/**
 * Load prompts from storage
 */
async function loadPrompts() {
    try {
        prompts = await Storage.getAllPrompts();
        console.log('Loaded prompts:', prompts.length);
        renderPrompts();
    } catch (error) {
        console.error('Error loading prompts:', error);
    }
}

/**
 * Render prompts (pinned + recent, max 3 total)
 */
function renderPrompts() {
    promptsList.innerHTML = '';

    if (prompts.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    // Get pinned prompts
    const pinned = prompts.filter(p => p.isPinned);

    // Get recent prompts (non-pinned)
    const recent = prompts
        .filter(p => !p.isPinned)
        .sort((a, b) => b.lastUsed - a.lastUsed);

    // Combine: pinned first, then recent (max 3 total)
    const displayPrompts = [...pinned, ...recent].slice(0, 3);

    displayPrompts.forEach(prompt => {
        const card = createPromptCard(prompt);
        promptsList.appendChild(card);
    });
}

/**
 * Create prompt card element
 */
function createPromptCard(prompt) {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.promptId = prompt.id;

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'prompt-content';

    const title = document.createElement('div');
    title.className = 'prompt-title';
    title.textContent = truncate(prompt.title, 40);

    const preview = document.createElement('div');
    preview.className = 'prompt-preview';
    preview.textContent = truncate(prompt.content, 60);

    content.appendChild(title);
    content.appendChild(preview);

    // Action buttons container (shown on hover)
    const actions = document.createElement('div');
    actions.className = 'prompt-actions';

    // Pin button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'action-btn';
    pinBtn.innerHTML = prompt.isPinned ? '📌' : '📍';
    pinBtn.title = prompt.isPinned ? 'Unpin' : 'Pin';
    pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await togglePin(prompt.id);
    });

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openInlineEdit(prompt, card);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn action-btn-danger';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deletePrompt(prompt.id);
    });

    actions.appendChild(pinBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    // Double-click detection for edit
    let clickTimer = null;
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking action buttons or inside edit form
        if (e.target.closest('.prompt-actions')) return;
        if (e.target.closest('.inline-edit-form')) return;

        // Skip if in edit mode
        if (currentEditId !== null) return;

        if (clickTimer) {
            // Double click detected
            clearTimeout(clickTimer);
            clickTimer = null;
            openInlineEdit(prompt, card);
        } else {
            // Wait for potential double click
            clickTimer = setTimeout(async () => {
                clickTimer = null;
                // Double-check not in edit mode before inserting
                if (currentEditId === null) {
                    await insertPrompt(prompt);
                }
            }, 300);
        }
    });

    card.appendChild(content);
    card.appendChild(actions);

    // Add structured indicator for prompts with variables
    if (prompt.isStructured || (prompt.variables && prompt.variables.length > 0)) {
        const badge = document.createElement('span');
        badge.className = 'structured-indicator';
        badge.textContent = `📝 ${prompt.variables.length}`;
        badge.title = `Structured prompt with ${prompt.variables.length} variable${prompt.variables.length !== 1 ? 's' : ''}`;
        card.insertBefore(badge, content);
        card.classList.add('has-variables');
    }

    return card;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Quick save button
    saveBtn.addEventListener('click', handleQuickSave);

    // Enter key in textarea (Ctrl+Enter to save)
    quickSaveInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            handleQuickSave();
        }
    });

    // Input validation with debouncing
    let validationTimeout;
    quickSaveInput.addEventListener('input', () => {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
            const text = quickSaveInput.value.trim();
            const hasText = text.length > 0;
            saveBtn.disabled = !hasText;
            console.log(`Input length: ${text.length}, Button enabled: ${hasText}`);
        }, 100); // 100ms debounce
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
    });

    // View all link
    viewAllLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/manager.html') });
    });

    // Help button
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (window.HelpSystem) {
                HelpSystem.show('popup');
            }
        });
    }
}

/**
 * Handle quick save
 */
async function handleQuickSave() {
    const text = quickSaveInput.value.trim();
    console.log('Save button clicked, text length:', text.length);

    // Allow any text length - removed 10 char minimum
    if (text.length === 0) {
        console.warn('No text to save');
        showFeedback('error', 'Please enter some text first');
        return;
    }

    try {
        // Disable button
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        console.log('Saving prompt to storage...');

        // Save prompt
        const savedPrompt = await Storage.savePrompt({
            content: text
        });

        console.log('Prompt saved successfully:', savedPrompt.id);

        // Success feedback
        showFeedback('success', I18n.getMessage('toast_saved'));

        // Clear input
        quickSaveInput.value = '';

        // Reload prompts
        await loadPrompts();
        console.log('Prompts reloaded, count:', prompts.length);

        // Reset button
        saveBtn.textContent = I18n.getMessage('save_button');
        saveBtn.disabled = true; // Keep disabled until new text entered

    } catch (error) {
        console.error('Error saving prompt:', error);
        showFeedback('error', I18n.getMessage('toast_error'));
        saveBtn.disabled = false;
        saveBtn.textContent = I18n.getMessage('save_button');
    }
}

/**
 * Insert prompt into active tab
 */
async function insertPrompt(prompt) {
    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            showFeedback('error', 'No active tab found');
            return;
        }

        // Check if this is a structured prompt with variables
        const isStructured = prompt.isStructured || (prompt.variables && prompt.variables.length > 0);

        if (isStructured) {
            // Send structured prompt to content script to show variable form
            await chrome.runtime.sendMessage({
                action: 'insert_structured_prompt',
                prompt: prompt
            });

            // Close popup - form will appear in content script
            showFeedback('success', 'Fill in the variables');
            setTimeout(() => {
                window.close();
            }, 300);
        } else {
            // Regular prompt - insert directly
            await chrome.runtime.sendMessage({
                action: 'insert_prompt',
                text: prompt.content,
                promptId: prompt.id
            });

            // Show success (brief)
            showFeedback('success', I18n.getMessage('toast_inserted'));

            // Close popup after short delay
            setTimeout(() => {
                window.close();
            }, 500);
        }

    } catch (error) {
        console.error('Error inserting prompt:', error);
        showFeedback('error', I18n.getMessage('toast_error'));
    }
}

/**
 * Toggle pin status
 */
async function togglePin(promptId) {
    try {
        await Storage.togglePin(promptId);
        await loadPrompts();
    } catch (error) {
        console.error('Error toggling pin:', error);
    }
}

// Track current edit state
let currentEditId = null;
let editForm = null;

/**
 * Open inline edit form for a prompt
 */
function openInlineEdit(prompt, card) {
    // Close any existing edit form
    if (editForm) {
        closeInlineEdit();
    }

    currentEditId = prompt.id;

    // Create edit form
    editForm = document.createElement('div');
    editForm.className = 'inline-edit-form';
    editForm.innerHTML = `
        <div class="edit-field">
            <label>Title</label>
            <input type="text" class="edit-input" id="edit-title" value="${escapeHtml(prompt.title)}" />
        </div>
        <div class="edit-field">
            <label>Content</label>
            <textarea class="edit-textarea" id="edit-content" rows="4">${escapeHtml(prompt.content)}</textarea>
        </div>
        <div class="edit-actions">
            <button class="edit-btn edit-btn-secondary" id="edit-cancel">Cancel</button>
            <button class="edit-btn edit-btn-primary" id="edit-save">Save</button>
        </div>
        <div class="edit-hint">Ctrl+Enter save • ESC cancel</div>
    `;

    // Hide card content, show edit form
    card.classList.add('editing');
    card.appendChild(editForm);

    // Stop clicks inside form from bubbling to card
    editForm.addEventListener('click', (e) => e.stopPropagation());

    // Setup event listeners
    const titleInput = editForm.querySelector('#edit-title');
    const contentInput = editForm.querySelector('#edit-content');
    const editSaveBtn = editForm.querySelector('#edit-save');
    const cancelBtn = editForm.querySelector('#edit-cancel');

    editSaveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveInlineEdit(prompt.id);
    });
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeInlineEdit();
    });

    // Keyboard shortcuts
    editForm.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeInlineEdit();
        }
        if (e.ctrlKey && e.key === 'Enter') {
            e.stopPropagation();
            saveInlineEdit(prompt.id);
        }
    });

    // Focus title
    setTimeout(() => titleInput.focus(), 50);
}

/**
 * Close inline edit form
 */
function closeInlineEdit() {
    if (editForm) {
        const card = editForm.closest('.prompt-card');
        if (card) {
            card.classList.remove('editing');
        }
        editForm.remove();
        editForm = null;
    }
    currentEditId = null;
}

/**
 * Save inline edit changes
 */
async function saveInlineEdit(promptId) {
    const titleInput = editForm.querySelector('#edit-title');
    const contentInput = editForm.querySelector('#edit-content');

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !content) {
        showFeedback('error', 'Title and content required');
        return;
    }

    try {
        await chrome.runtime.sendMessage({
            action: 'update_prompt',
            promptId: promptId,
            updates: { title, content }
        });

        showFeedback('success', 'Saved!');
        closeInlineEdit();
        await loadPrompts();
    } catch (error) {
        console.error('Error saving edit:', error);
        showFeedback('error', 'Save failed');
    }
}

/**
 * Delete prompt with confirmation
 */
async function deletePrompt(promptId) {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;

    if (!confirm(`Delete "${prompt.title}"?`)) return;

    try {
        await chrome.runtime.sendMessage({
            action: 'delete_prompt',
            promptId: promptId
        });

        showFeedback('success', 'Deleted');
        await loadPrompts();
    } catch (error) {
        console.error('Error deleting prompt:', error);
        showFeedback('error', 'Delete failed');
    }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * Show feedback message
 */
function showFeedback(type, message) {
    if (type === 'success') {
        saveBtn.classList.add('success');
        setTimeout(() => {
            saveBtn.classList.remove('success');
        }, 500);
    }

    // Show actual toast notification
    const existingToast = document.querySelector('.feedback-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `feedback-toast feedback-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#10B981' : '#EF4444'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);

    console.log(`[${type}] ${message}`);
}

/**
 * Truncate text
 */
function truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
