// Content script for PromptPal
// Handles smart input detection, prompt injection, floating UI, and variable forms

console.log('PromptPal content script loaded');

// State
let floatingUI = null;
let currentInputElement = null;
let variableFormOverlay = null;
let previewTooltip = null;
let floatingEditModal = null;
let allFloatingPrompts = []; // Store all prompts for search filtering
let currentSearchTerm = ''; // Track search state

/**
 * Debounce utility for search input
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Inline VariableUtils for content script (can't import modules)
const ContentVariableUtils = {
    VARIABLE_REGEX: /\[([^\[\]]+)\]/g,

    hasVariables(content) {
        if (!content || typeof content !== 'string') return false;
        this.VARIABLE_REGEX.lastIndex = 0;
        return this.VARIABLE_REGEX.test(content);
    },

    replaceVariables(content, formData) {
        if (!content || typeof content !== 'string') return content;
        let result = content;
        Object.keys(formData).forEach(varName => {
            const value = formData[varName];
            const pattern = new RegExp(`\\[${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'gi');
            result = result.replace(pattern, () => value || '');
        });
        return result;
    },

    formatVariableName(name) {
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
    }
};

/**
 * Detect currently focused input element
 * Multi-strategy approach based on research
 */
function detectFocusedInput() {
    // Strategy 1: Standard focus-based detection
    let activeElement = document.activeElement;

    // Handle Shadow DOM
    while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
        activeElement = activeElement.shadowRoot.activeElement;
    }

    if (activeElement && isValidInput(activeElement)) {
        return createInputTarget(activeElement);
    }

    // Strategy 2: Site-specific selectors (for AI chatbots)
    const siteInput = findSiteSpecificInput();
    if (siteInput) {
        return createInputTarget(siteInput);
    }

    // Strategy 3: Contenteditable search (for rich editors)
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const el of editables) {
            if (el.contains(selection.anchorNode)) {
                return createInputTarget(el);
            }
        }
    }

    // Strategy 4: Role-based detection (ARIA)
    const textbox = document.querySelector('[role="textbox"]');
    if (textbox) {
        return createInputTarget(textbox);
    }

    // Strategy 5: Check iframes
    try {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const iframeActive = iframeDoc.activeElement;

                if (iframeActive && isValidInput(iframeActive)) {
                    const target = createInputTarget(iframeActive);
                    target.inIframe = true;
                    return target;
                }
            } catch (e) {
                // Cross-origin iframe, skip
            }
        }
    } catch (e) {
        console.warn('Error checking iframes:', e);
    }

    return null;
}

/**
 * Find input using site-specific selectors
 */
function findSiteSpecificInput() {
    const hostname = window.location.hostname;

    const siteSelectors = {
        'gemini.google.com': [
            'textarea[aria-label*="Enter a prompt"]',
            'textarea[placeholder*="Enter a prompt"]',
            '.ql-editor[contenteditable]',
            'div[contenteditable="true"]'
        ],
        'chat.openai.com': [
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'div[contenteditable="true"]'
        ],
        'claude.ai': [
            'div[contenteditable="true"]',
            '[role="textbox"]'
        ],
        'notion.so': [
            '[contenteditable="true"]',
            '[role="textbox"]'
        ]
    };

    const selectors = siteSelectors[hostname];
    if (selectors) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log(`[detectInput] Found via site selector: ${selector}`);
                return element;
            }
        }
    }

    return null;
}

/**
 * Check if element is valid input
 */
function isValidInput(element) {
    if (!element) return false;

    // Standard inputs
    if (element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'INPUT' &&
        ['text', 'search', 'email', 'url'].includes(element.type)) return true;

    // Contenteditable
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') return true;

    // ARIA textbox
    if (element.getAttribute('role') === 'textbox') return true;

    return false;
}

/**
 * Create input target object
 */
function createInputTarget(element) {
    const isContentEditable = element.isContentEditable ||
        element.getAttribute('contenteditable') === 'true' ||
        element.getAttribute('role') === 'textbox';

    return {
        element: element,
        type: isContentEditable ? 'contenteditable' : 'input',
        insertMethod: isContentEditable ? 'content' : 'value'
    };
}

/**
 * Insert text into detected input
 * @param {string} text - Text to insert
 * @param {Object} target - Target from detectFocusedInput()
 */
function insertText(text, target = null) {
    if (!target) {
        target = detectFocusedInput();
    }

    if (!target) {
        console.warn('No input element detected');
        return false;
    }

    const { element, type, insertMethod } = target;

    try {
        if (insertMethod === 'value') {
            // Standard input/textarea
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const currentValue = element.value;

            // Insert at cursor or replace selection
            const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
            element.value = newValue;

            // Restore cursor position
            const newCursorPos = start + text.length;
            element.selectionStart = newCursorPos;
            element.selectionEnd = newCursorPos;

            // Dispatch events for React/Vue reactivity
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

        } else if (target.type === 'contenteditable') {
            // ContentEditable elements (rich text editors)
            const element = target.element;
            element.focus();

            // Get selection safely
            const selection = window.getSelection();

            // Validate selection exists and has ranges
            if (!selection) {
                console.warn('[ContentEditable] No selection available');
                element.textContent = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }

            // Create or get range safely
            let range;
            if (selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
            } else {
                // No existing range, create a new one at the end of element
                range = document.createRange();
                range.selectNodeContents(element);
                range.collapse(false); // Collapse to end
                selection.removeAllRanges();
                selection.addRange(range);
            }

            // Delete existing content and insert text
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);

            // Move cursor to end of inserted text
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);

            // Dispatch input event
            element.dispatchEvent(new Event('input', { bubbles: true }));

            // Special handling for React
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLDivElement.prototype,
                'textContent'
            )?.set;

            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(element, element.textContent);
            }
        }

        // Trigger additional events for framework compatibility
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        element.dispatchEvent(new Event('focus', { bubbles: true }));

        return true;
    } catch (error) {
        console.error('Error inserting text:', error);
        return false;
    }
}

/**
 * Get current text selection
 * Renamed to avoid shadowing native window.getSelection()
 */
function getSelectedText() {
    try {
        const selection = window.getSelection();
        return selection ? selection.toString().trim() : '';
    } catch (error) {
        console.error('[PromptPal] Error getting selection:', error);
        return '';
    }
}

/**
 * Show floating prompt selector UI
 */
async function showFloatingUI() {
    // Check if input is focused
    const target = detectFocusedInput();

    if (!target) {
        showToast('Please focus an input field first', 'error');
        return;
    }

    currentInputElement = target;
    currentSearchTerm = ''; // Reset search

    // Remove existing UI if present
    if (floatingUI) {
        floatingUI.remove();
    }

    // Get prompts from background
    const response = await chrome.runtime.sendMessage({ action: 'get_prompts' });

    if (!response.success || response.prompts.length === 0) {
        showToast('No prompts saved yet', 'info');
        return;
    }

    // Create floating UI
    floatingUI = document.createElement('div');
    floatingUI.id = 'promptpal-floating-ui';
    floatingUI.className = 'promptpal-floating';

    // Store all prompts for search filtering
    allFloatingPrompts = response.prompts;

    // Get pinned + recent (max 10)
    const displayPrompts = getDisplayPrompts(allFloatingPrompts);

    // Build HTML with search and close button
    floatingUI.innerHTML = buildFloatingUIHTML(displayPrompts);

    // Add close button handler
    const closeBtn = floatingUI.querySelector('.promptpal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[PromptPal] Close button clicked');
            closeFloatingUI();
        });
    }

    // Setup search functionality
    setupSearchFunctionality();

    // Add styles
    addFloatingUIStyles();

    // Position near cursor or center
    positionFloatingUI(target.element);

    // Add to page
    document.body.appendChild(floatingUI);

    // Add event listeners for items
    setupFloatingUIListeners(displayPrompts);

    // Focus search input
    const searchInput = floatingUI.querySelector('#promptpal-search-input');
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
    }
}

/**
 * Get display prompts (pinned + recent, max 10)
 */
function getDisplayPrompts(prompts, searchTerm = '') {
    let filtered = prompts;

    // Apply search filter
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = prompts.filter(p =>
            p.title.toLowerCase().includes(term) ||
            p.content.toLowerCase().includes(term)
        );
    }

    // Sort: pinned first, then by lastUsed
    const pinned = filtered.filter(p => p.isPinned);
    const recent = filtered
        .filter(p => !p.isPinned)
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, 10 - pinned.length);

    return [...pinned, ...recent];
}

/**
 * Build floating UI HTML with search
 */
function buildFloatingUIHTML(displayPrompts) {
    let html = `
        <div class="promptpal-header">
            <span>Select Prompt</span>
            <button class="promptpal-close-btn" title="Close (Esc)">✕</button>
        </div>
        <div class="promptpal-search-container">
            <input type="text" 
                   id="promptpal-search-input" 
                   class="promptpal-search-input"
                   placeholder="Search prompts..." 
                   autocomplete="off"
                   aria-label="Search prompts">
            <button id="promptpal-search-clear" class="promptpal-search-clear" title="Clear search">×</button>
        </div>
        <div class="promptpal-list" id="promptpal-list">
    `;

    if (displayPrompts.length === 0) {
        html += `
            <div class="promptpal-no-results">
                <span>🔍</span>
                <p>No prompts found</p>
            </div>
        `;
    } else {
        displayPrompts.forEach((prompt, index) => {
            const truncatedTitle = prompt.title.length > 35
                ? prompt.title.substring(0, 32) + '...'
                : prompt.title;

            html += `
                <div class="promptpal-item" 
                     data-prompt-id="${prompt.id}" 
                     data-index="${index}"
                     role="option"
                     aria-selected="false"
                     tabindex="-1">
                    ${prompt.isPinned ? '<span class="pin-icon">📌</span>' : ''}
                    <span class="prompt-title">${escapeHtml(truncatedTitle)}</span>
                    <div class="promptpal-actions">
                        <button class="promptpal-action-btn" data-action="pin" title="${prompt.isPinned ? 'Unpin' : 'Pin'}">
                            ${prompt.isPinned ? '📌' : '📍'}
                        </button>
                        <button class="promptpal-action-btn" data-action="edit" title="Edit">
                            ✏️
                        </button>
                        <button class="promptpal-action-btn promptpal-action-delete" data-action="delete" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
    }

    html += '</div>';
    html += '<div class="promptpal-footer">ESC close • ↑↓ navigate • Enter/click insert • Dbl-click edit</div>';

    return html;
}

/**
 * Setup search functionality
 */
function setupSearchFunctionality() {
    const searchInput = floatingUI.querySelector('#promptpal-search-input');
    const clearBtn = floatingUI.querySelector('#promptpal-search-clear');

    if (!searchInput) return;

    // Debounced search handler
    const handleSearch = debounce((searchTerm) => {
        currentSearchTerm = searchTerm;
        const filtered = getDisplayPrompts(allFloatingPrompts, searchTerm);
        updatePromptList(filtered);
    }, 300);

    searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value);
        // Show/hide clear button
        if (clearBtn) {
            clearBtn.style.display = e.target.value ? 'block' : 'none';
        }
    });

    // Clear button handler
    if (clearBtn) {
        clearBtn.style.display = 'none';
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            searchInput.value = '';
            currentSearchTerm = '';
            clearBtn.style.display = 'none';
            const filtered = getDisplayPrompts(allFloatingPrompts, '');
            updatePromptList(filtered);
            searchInput.focus();
        });
    }

    // Prevent search input from closing on click
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

/**
 * Update prompt list after search
 */
function updatePromptList(prompts) {
    const listContainer = floatingUI.querySelector('#promptpal-list');
    if (!listContainer) return;

    let html = '';

    if (prompts.length === 0) {
        html = `
            <div class="promptpal-no-results">
                <span>🔍</span>
                <p>No prompts found</p>
            </div>
        `;
    } else {
        prompts.forEach((prompt, index) => {
            const truncatedTitle = prompt.title.length > 40
                ? prompt.title.substring(0, 37) + '...'
                : prompt.title;

            html += `
                <div class="promptpal-item" data-prompt-id="${prompt.id}" data-index="${index}">
                    ${prompt.isPinned ? '<span class="pin-icon">📌</span>' : ''}
                    <span class="prompt-title">${escapeHtml(truncatedTitle)}</span>
                    <span class="promptpal-edit-hint">✏️</span>
                </div>
            `;
        });
    }

    listContainer.innerHTML = html;

    // Re-attach event listeners
    setupFloatingUIListeners(prompts);

    // Select first item
    const firstItem = listContainer.querySelector('.promptpal-item');
    if (firstItem) {
        firstItem.classList.add('selected');
    }
}

/**
 * Position floating UI
 */
function positionFloatingUI(inputElement) {
    const rect = inputElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const uiHeight = 400; // Approximate
    const uiWidth = 400;

    let top, left;

    // Try to position below input
    if (rect.bottom + uiHeight < viewportHeight) {
        top = rect.bottom + window.scrollY + 10;
    } else if (rect.top - uiHeight > 0) {
        // Position above
        top = rect.top + window.scrollY - uiHeight - 10;
    } else {
        // Center vertically
        top = (viewportHeight - uiHeight) / 2 + window.scrollY;
    }

    // Center horizontally or align with input
    if (rect.left + uiWidth < viewportWidth) {
        left = rect.left + window.scrollX;
    } else {
        left = (viewportWidth - uiWidth) / 2 + window.scrollX;
    }

    floatingUI.style.top = `${top}px`;
    floatingUI.style.left = `${left}px`;
}

/**
 * Setup floating UI event listeners
 */
function setupFloatingUIListeners(prompts) {
    // ============================================
    // UNIFIED STATE MANAGEMENT
    // ============================================
    let selectedIndex = 0;
    let hoverDebounceTimer = null;
    const HOVER_DEBOUNCE_MS = 100;
    const CLICK_DOUBLE_DELAY = 200;

    // Get current items (re-query after search filtering)
    const getItems = () => Array.from(floatingUI.querySelectorAll('.promptpal-item'));
    const getPromptById = (id) => allFloatingPrompts.find(p => p.id === id);

    // ============================================
    // SELECTION STATE - SINGLE SOURCE OF TRUTH
    // ============================================
    function updateSelection(newIndex, options = {}) {
        const items = getItems();
        if (items.length === 0) return;

        // Clamp or wrap index
        if (options.wrap) {
            selectedIndex = ((newIndex % items.length) + items.length) % items.length;
        } else {
            selectedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
        }

        // Update visual state
        items.forEach((item, index) => {
            const isSelected = index === selectedIndex;
            item.classList.toggle('selected', isSelected);
            item.setAttribute('aria-selected', isSelected);
        });

        // Scroll into view
        const selectedItem = items[selectedIndex];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

            // Show preview for selected item (if not from rapid mouse movement)
            if (!options.skipPreview) {
                const promptId = selectedItem.getAttribute('data-prompt-id');
                const prompt = getPromptById(promptId);
                if (prompt) {
                    showPreviewTooltip(selectedItem, prompt);
                }
            }
        }
    }

    // Initialize first item as selected
    updateSelection(0, { skipPreview: true });

    // ============================================
    // EVENT DELEGATION ON LIST CONTAINER
    // ============================================
    const listContainer = floatingUI.querySelector('#promptpal-list');
    if (!listContainer) return;

    // Track pending actions
    let pendingClick = null;

    // --- MOUSE ENTER (hover) - debounced ---
    listContainer.addEventListener('mouseenter', (e) => {
        const item = e.target.closest('.promptpal-item');
        if (!item) return;

        // Debounce rapid mouse movements
        if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
        hoverDebounceTimer = setTimeout(() => {
            const index = parseInt(item.dataset.index, 10);
            if (!isNaN(index) && index !== selectedIndex) {
                updateSelection(index);
            }
        }, HOVER_DEBOUNCE_MS);
    }, true);

    // --- MOUSE LEAVE - hide preview ---
    listContainer.addEventListener('mouseleave', (e) => {
        const item = e.target.closest('.promptpal-item');
        if (item) {
            if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
            hidePreviewTooltip();
        }
    }, true);

    // --- CLICK - insert prompt (with double-click detection) ---
    listContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.promptpal-item');
        if (!item) return;

        // Check if clicked on action button
        const actionBtn = e.target.closest('.promptpal-action-btn');
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            handleQuickAction(actionBtn, item);
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const promptId = item.dataset.promptId;

        // Double-click detection
        if (pendingClick && pendingClick.promptId === promptId) {
            clearTimeout(pendingClick.timer);
            pendingClick = null;
            // Double click - open edit
            const prompt = getPromptById(promptId);
            if (prompt) {
                console.log('[PromptPal] Double-click: opening edit modal');
                openFloatingEditModal(prompt);
            }
            return;
        }

        // Schedule single click action
        pendingClick = {
            promptId,
            timer: setTimeout(() => {
                pendingClick = null;
                const prompt = getPromptById(promptId);
                if (prompt) {
                    handlePromptInsert(prompt);
                }
            }, CLICK_DOUBLE_DELAY)
        };
    });

    // --- RIGHT CLICK - context menu ---
    listContainer.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.promptpal-item');
        if (!item) return;

        e.preventDefault();
        e.stopPropagation();

        const promptId = item.dataset.promptId;
        const prompt = getPromptById(promptId);
        if (prompt) {
            showContextMenu(e.clientX, e.clientY, prompt, item);
        }
    });

    // ============================================
    // QUICK ACTION BUTTONS HANDLER
    // ============================================
    function handleQuickAction(btn, item) {
        const action = btn.dataset.action;
        const promptId = item.dataset.promptId;
        const prompt = getPromptById(promptId);
        if (!prompt) return;

        switch (action) {
            case 'pin':
                togglePin(prompt, item);
                break;
            case 'edit':
                openFloatingEditModal(prompt);
                break;
            case 'delete':
                deletePromptWithConfirm(prompt);
                break;
        }
    }

    async function togglePin(prompt, item) {
        try {
            const newPinState = !prompt.isPinned;
            await chrome.runtime.sendMessage({
                action: 'update_prompt',
                promptId: prompt.id,
                updates: { isPinned: newPinState }
            });

            // Update local state
            prompt.isPinned = newPinState;

            // Update pin icon
            const pinIcon = item.querySelector('.pin-icon');
            const pinBtn = item.querySelector('[data-action="pin"]');

            if (prompt.isPinned) {
                if (!pinIcon) {
                    const icon = document.createElement('span');
                    icon.className = 'pin-icon';
                    icon.textContent = '📌';
                    item.insertBefore(icon, item.firstChild);
                }
                if (pinBtn) pinBtn.textContent = '📌';
            } else {
                if (pinIcon) pinIcon.remove();
                if (pinBtn) pinBtn.textContent = '📍';
            }

            showToast(prompt.isPinned ? 'Pinned' : 'Unpinned', 'success');
        } catch (err) {
            console.error('[PromptPal] Pin toggle failed:', err);
            showToast('Failed to update', 'error');
        }
    }

    async function deletePromptWithConfirm(prompt) {
        if (!confirm(`Delete "${prompt.title}"?`)) return;

        try {
            await chrome.runtime.sendMessage({
                action: 'delete_prompt',
                promptId: prompt.id
            });

            // Remove from local array
            const idx = allFloatingPrompts.findIndex(p => p.id === prompt.id);
            if (idx > -1) allFloatingPrompts.splice(idx, 1);

            // Refresh list
            const filtered = getDisplayPrompts(allFloatingPrompts, currentSearchTerm);
            updatePromptList(filtered);

            showToast('Deleted', 'success');
        } catch (err) {
            console.error('[PromptPal] Delete failed:', err);
            showToast('Delete failed', 'error');
        }
    }

    // ============================================
    // CONTEXT MENU
    // ============================================
    let contextMenu = null;

    function showContextMenu(x, y, prompt, item) {
        hideContextMenu();

        contextMenu = document.createElement('div');
        contextMenu.className = 'promptpal-context-menu';
        contextMenu.innerHTML = `
            <button class="context-item" data-action="insert">📥 Insert</button>
            <button class="context-item" data-action="copy">📋 Copy</button>
            <div class="context-divider"></div>
            <button class="context-item" data-action="pin">${prompt.isPinned ? '📌 Unpin' : '📍 Pin to top'}</button>
            <button class="context-item" data-action="edit">✏️ Edit</button>
            <div class="context-divider"></div>
            <button class="context-item context-item-danger" data-action="delete">🗑️ Delete</button>
        `;

        // Position within viewport
        document.body.appendChild(contextMenu);
        const menuRect = contextMenu.getBoundingClientRect();
        const left = Math.min(x, window.innerWidth - menuRect.width - 10);
        const top = Math.min(y, window.innerHeight - menuRect.height - 10);
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;

        // Handle clicks
        contextMenu.addEventListener('click', (e) => {
            const btn = e.target.closest('.context-item');
            if (!btn) return;

            const action = btn.dataset.action;
            hideContextMenu();

            switch (action) {
                case 'insert':
                    handlePromptInsert(prompt);
                    break;
                case 'copy':
                    navigator.clipboard.writeText(prompt.content);
                    showToast('Copied!', 'success');
                    break;
                case 'pin':
                    togglePin(prompt, item);
                    break;
                case 'edit':
                    openFloatingEditModal(prompt);
                    break;
                case 'delete':
                    deletePromptWithConfirm(prompt);
                    break;
            }
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', hideContextMenu, { once: true });
        }, 10);
    }

    function hideContextMenu() {
        if (contextMenu) {
            contextMenu.remove();
            contextMenu = null;
        }
    }

    // ============================================
    // KEYBOARD NAVIGATION
    // ============================================
    if (window.floatingUIKeydownHandler) {
        document.removeEventListener('keydown', window.floatingUIKeydownHandler);
    }

    function handleFloatingUIKeydown(e) {
        if (!floatingUI || !document.body.contains(floatingUI)) {
            document.removeEventListener('keydown', handleFloatingUIKeydown);
            return;
        }

        // Allow typing in search except for nav keys
        const isSearchFocused = e.target.id === 'promptpal-search-input';
        if (isSearchFocused && !['Escape', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
            return;
        }

        const items = getItems();

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                hideContextMenu();
                document.removeEventListener('keydown', handleFloatingUIKeydown);
                hidePreviewTooltip();
                closeFloatingUI();
                break;

            case 'ArrowDown':
                e.preventDefault();
                if (items.length > 0) {
                    updateSelection(selectedIndex + 1, { wrap: true });
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (items.length > 0) {
                    updateSelection(selectedIndex - 1, { wrap: true });
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (items[selectedIndex]) {
                    hidePreviewTooltip();
                    const promptId = items[selectedIndex].dataset.promptId;
                    const prompt = getPromptById(promptId);
                    if (prompt) {
                        handlePromptInsert(prompt);
                    }
                }
                break;
        }
    }

    window.floatingUIKeydownHandler = handleFloatingUIKeydown;
    document.addEventListener('keydown', handleFloatingUIKeydown);

    // ============================================
    // CLICK OUTSIDE TO CLOSE
    // ============================================
    function handleOutsideClick(e) {
        // Don't close if clicking on context menu
        if (contextMenu && contextMenu.contains(e.target)) return;
        // Don't close if clicking on edit modal
        if (floatingEditModal && floatingEditModal.contains(e.target)) return;
        // Don't close if clicking on preview tooltip
        const tooltip = document.getElementById('promptpal-preview-tooltip');
        if (tooltip && tooltip.contains(e.target)) return;

        if (floatingUI && !floatingUI.contains(e.target)) {
            hidePreviewTooltip();
            hideContextMenu();
            closeFloatingUI();
            document.removeEventListener('click', handleOutsideClick);
        }
    }

    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

/**
 * Handle prompt insert action
 */
function handlePromptInsert(prompt) {
    if (!prompt) return;

    console.log('[PromptPal] Inserting prompt');
    hidePreviewTooltip();

    // Close UI FIRST before insertion - FORCE REMOVE
    const savedInputElement = currentInputElement;
    floatingUI = null;

    // Force remove by ID
    document.querySelectorAll('#promptpal-floating-ui').forEach(el => {
        el.remove();
    });

    // Now insert
    try {
        insertText(prompt.content, savedInputElement);
        showToast('Prompt inserted', 'success');
    } catch (err) {
        console.error('[PromptPal] Insert error:', err);
        showToast('Insert failed', 'error');
    }

    // Notify background
    chrome.runtime.sendMessage({
        action: 'insert_prompt',
        text: prompt.content,
        promptId: prompt.id
    }).catch(() => { });

    currentInputElement = null;
}

/**
 * Show preview tooltip for a prompt item
 */
function showPreviewTooltip(item, prompt) {
    // Cancel any pending hide
    if (hideTooltipTimer) {
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;
    }

    // Remove existing tooltip
    const existing = document.getElementById('promptpal-preview-tooltip');
    if (existing) existing.remove();

    // Create tooltip
    previewTooltip = document.createElement('div');
    previewTooltip.id = 'promptpal-preview-tooltip';
    previewTooltip.className = 'promptpal-preview-tooltip';

    // Format content with variable highlighting
    let contentHtml = escapeHtml(prompt.content);
    // Highlight [variables]
    contentHtml = contentHtml.replace(/\[([^\]]+)\]/g,
        '<span class="preview-variable">[$1]</span>');
    // Preserve line breaks
    contentHtml = contentHtml.replace(/\n/g, '<br>');

    previewTooltip.innerHTML = `
        <div class="preview-header">
            <strong>${escapeHtml(prompt.title)}</strong>
            ${prompt.isPinned ? '<span class="pin-badge">📌</span>' : ''}
        </div>
        <div class="preview-content">${contentHtml}</div>
        ${prompt.tags && prompt.tags.length > 0 ? `
            <div class="preview-tags">
                ${prompt.tags.map(t => `<span class="preview-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
        ` : ''}
    `;

    document.body.appendChild(previewTooltip);

    // Position the tooltip
    positionPreviewTooltip(item);

    // Fade in
    requestAnimationFrame(() => {
        previewTooltip.style.opacity = '1';
    });

    // Allow hovering on tooltip itself
    previewTooltip.addEventListener('mouseenter', () => {
        if (hideTooltipTimer) {
            clearTimeout(hideTooltipTimer);
            hideTooltipTimer = null;
        }
    });

    previewTooltip.addEventListener('mouseleave', () => {
        hidePreviewTooltip();
    });
}

/**
 * Position preview tooltip near the item
 */
function positionPreviewTooltip(item) {
    if (!previewTooltip) return;

    const itemRect = item.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const tooltipWidth = 320;
    const tooltipMaxHeight = 300;

    let left, top;

    // Try to position to the right of the floating UI
    if (itemRect.right + tooltipWidth + 15 < viewportWidth) {
        left = itemRect.right + 10;
    } else if (itemRect.left - tooltipWidth - 15 > 0) {
        // Position to the left
        left = itemRect.left - tooltipWidth - 10;
    } else {
        // Center below
        left = Math.max(10, (viewportWidth - tooltipWidth) / 2);
    }

    // Vertical positioning
    top = itemRect.top;
    if (top + tooltipMaxHeight > viewportHeight) {
        top = Math.max(10, viewportHeight - tooltipMaxHeight - 10);
    }

    previewTooltip.style.left = `${left}px`;
    previewTooltip.style.top = `${top}px`;
}

/**
 * Hide preview tooltip with small delay
 */
let hideTooltipTimer = null;
function hidePreviewTooltip() {
    hideTooltipTimer = setTimeout(() => {
        const tooltip = document.getElementById('promptpal-preview-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.remove(), 150);
        }
        previewTooltip = null;
        hideTooltipTimer = null;
    }, 100);
}

/**
 * Open floating edit modal
 */
function openFloatingEditModal(prompt) {
    if (!prompt) return;

    hidePreviewTooltip();

    // Create overlay
    floatingEditModal = document.createElement('div');
    floatingEditModal.id = 'promptpal-edit-overlay';
    floatingEditModal.className = 'promptpal-edit-overlay';

    floatingEditModal.innerHTML = `
        <div class="promptpal-edit-container">
            <div class="promptpal-edit-header">
                <h3>✏️ Edit Prompt</h3>
                <button class="promptpal-edit-close" title="Close">×</button>
            </div>
            <div class="promptpal-edit-body">
                <div class="promptpal-edit-field">
                    <label for="promptpal-edit-title">Title</label>
                    <input type="text" id="promptpal-edit-title" value="${escapeHtml(prompt.title)}" />
                </div>
                <div class="promptpal-edit-field">
                    <label for="promptpal-edit-content">Content</label>
                    <textarea id="promptpal-edit-content" rows="8">${escapeHtml(prompt.content)}</textarea>
                </div>
                <div class="promptpal-edit-field">
                    <label for="promptpal-edit-category">Category</label>
                    <input type="text" id="promptpal-edit-category" value="${escapeHtml(prompt.category || '')}" placeholder="Uncategorized" />
                </div>
                <div class="promptpal-edit-field">
                    <label for="promptpal-edit-tags">Tags</label>
                    <input type="text" id="promptpal-edit-tags" value="${escapeHtml((prompt.tags || []).join(', '))}" placeholder="Comma-separated" />
                </div>
            </div>
            <div class="promptpal-edit-footer">
                <button class="promptpal-edit-btn promptpal-edit-btn-secondary" id="promptpal-edit-cancel">Cancel</button>
                <button class="promptpal-edit-btn promptpal-edit-btn-primary" id="promptpal-edit-save">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(floatingEditModal);

    // Setup event listeners
    const closeBtn = floatingEditModal.querySelector('.promptpal-edit-close');
    const cancelBtn = floatingEditModal.querySelector('#promptpal-edit-cancel');
    const saveBtn = floatingEditModal.querySelector('#promptpal-edit-save');

    closeBtn.addEventListener('click', closeFloatingEditModal);
    cancelBtn.addEventListener('click', closeFloatingEditModal);

    saveBtn.addEventListener('click', () => saveFloatingEdit(prompt.id));

    // Close on overlay click
    floatingEditModal.addEventListener('click', (e) => {
        if (e.target === floatingEditModal) {
            closeFloatingEditModal();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', handleEditModalKeydown);

    function handleEditModalKeydown(e) {
        if (e.key === 'Escape' && floatingEditModal) {
            closeFloatingEditModal();
            document.removeEventListener('keydown', handleEditModalKeydown);
        }
    }

    // Focus title input
    setTimeout(() => {
        const titleInput = floatingEditModal.querySelector('#promptpal-edit-title');
        if (titleInput) titleInput.focus();
    }, 50);
}

/**
 * Save edit changes
 */
async function saveFloatingEdit(promptId) {
    if (!floatingEditModal) return;

    const title = floatingEditModal.querySelector('#promptpal-edit-title').value.trim();
    const content = floatingEditModal.querySelector('#promptpal-edit-content').value.trim();
    const category = floatingEditModal.querySelector('#promptpal-edit-category').value.trim() || 'Uncategorized';
    const tagsValue = floatingEditModal.querySelector('#promptpal-edit-tags').value;
    const tags = tagsValue.split(',').map(t => t.trim()).filter(Boolean);

    if (!title || !content) {
        showToast('Title and content are required', 'error');
        return;
    }

    try {
        // Send update to background
        const response = await chrome.runtime.sendMessage({
            action: 'update_prompt',
            promptId: promptId,
            updates: { title, content, category, tags }
        });

        if (response.success) {
            showToast('Prompt updated', 'success');
            closeFloatingEditModal();

            // Refresh the prompt list
            const newResponse = await chrome.runtime.sendMessage({ action: 'get_prompts' });
            if (newResponse.success) {
                allFloatingPrompts = newResponse.prompts;
                const filtered = getDisplayPrompts(allFloatingPrompts, currentSearchTerm);
                updatePromptList(filtered);
            }
        } else {
            showToast('Failed to update prompt', 'error');
        }
    } catch (error) {
        console.error('[PromptPal] Error saving edit:', error);
        showToast('Error saving changes', 'error');
    }
}

/**
 * Close floating edit modal
 */
function closeFloatingEditModal() {
    if (floatingEditModal) {
        floatingEditModal.remove();
        floatingEditModal = null;
    }
}

/**
 * Close floating UI - FORCE REMOVAL
 */
function closeFloatingUI() {
    console.log('[PromptPal] closeFloatingUI() called');

    // Clear variable reference
    floatingUI = null;
    currentInputElement = null;

    // Force remove ALL floating UI elements by ID
    document.querySelectorAll('#promptpal-floating-ui').forEach(el => {
        console.log('[PromptPal] Force removing floating UI element');
        el.remove();
    });

    // Also try by class as backup
    document.querySelectorAll('.promptpal-floating-container').forEach(el => {
        el.remove();
    });
}

/**
 * Add floating UI styles
 */
function addFloatingUIStyles() {
    if (document.getElementById('promptpal-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'promptpal-styles';
    style.textContent = `
    .promptpal-floating {
      position: absolute;
      z-index: 999999;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      width: 400px;
      min-height: 300px;
      max-height: 500px;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1f2937;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-floating {
        background: #1f2937;
        border-color: #374151;
        color: #f3f4f6;
      }
    }
    
    .promptpal-header {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .promptpal-close-btn {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #9ca3af;
      padding: 4px 8px;
      border-radius: 4px;
      line-height: 1;
      transition: all 0.15s;
    }
    
    .promptpal-close-btn:hover {
      background: #f3f4f6;
      color: #ef4444;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-header {
        border-bottom-color: #374151;
      }
      
      .promptpal-close-btn:hover {
        background: #374151;
        color: #f87171;
      }
    }
    
    .promptpal-list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
    
    .promptpal-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      transition: background-color 0.15s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .promptpal-item:hover,
    .promptpal-item.selected {
      background-color: #f3f4f6;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-item {
        border-bottom-color: #374151;
      }
      
      .promptpal-item:hover,
      .promptpal-item.selected {
        background-color: #374151;
      }
    }
    
    .promptpal-item:last-child {
      border-bottom: none;
    }
    
    .pin-icon {
      font-size: 12px;
    }
    
    .prompt-title {
      flex: 1;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    /* Quick action buttons - hidden by default */
    .promptpal-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.2s ease;
      margin-left: auto;
    }
    
    .promptpal-item:hover .promptpal-actions,
    .promptpal-item.selected .promptpal-actions {
      opacity: 1;
    }
    
    .promptpal-action-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 6px 8px;
      border-radius: 6px;
      opacity: 0.6;
      transition: all 0.15s ease;
      min-width: 36px;
      min-height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .promptpal-action-btn:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.05);
    }
    
    .promptpal-action-delete:hover {
      background: rgba(239, 68, 68, 0.1);
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .promptpal-action-delete:hover {
        background: rgba(239, 68, 68, 0.2);
      }
    }
    
    /* Context menu */
    .promptpal-context-menu {
      position: fixed;
      z-index: 1000002;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      padding: 6px;
      min-width: 160px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-context-menu {
        background: #1f2937;
        border-color: #374151;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      }
    }
    
    .context-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
      border-radius: 6px;
      transition: background 0.15s;
      text-align: left;
    }
    
    .context-item:hover {
      background: #f3f4f6;
    }
    
    @media (prefers-color-scheme: dark) {
      .context-item {
        color: #e5e7eb;
      }
      
      .context-item:hover {
        background: #374151;
      }
    }
    
    .context-item-danger {
      color: #dc2626;
    }
    
    .context-item-danger:hover {
      background: rgba(220, 38, 38, 0.1);
    }
    
    @media (prefers-color-scheme: dark) {
      .context-item-danger {
        color: #f87171;
      }
      
      .context-item-danger:hover {
        background: rgba(248, 113, 113, 0.15);
      }
    }
    
    .context-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 4px 8px;
    }
    
    @media (prefers-color-scheme: dark) {
      .context-divider {
        background: #374151;
      }
    }
    
    .promptpal-footer {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-footer {
        border-top-color: #374151;
        color: #9ca3af;
      }
    }
    
    /* Search styles */
    .promptpal-search-container {
      position: relative;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-search-container {
        border-bottom-color: #374151;
      }
    }
    
    .promptpal-search-input {
      width: 100%;
      padding: 10px 36px 10px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      background: #f9fafb;
      color: #1f2937;
      transition: all 0.2s;
      box-sizing: border-box;
    }
    
    .promptpal-search-input:focus {
      outline: none;
      border-color: #4F46E5;
      background: white;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    
    .promptpal-search-input::placeholder {
      color: #9ca3af;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-search-input {
        background: #111827;
        border-color: #374151;
        color: #f3f4f6;
      }
      
      .promptpal-search-input:focus {
        background: #1f2937;
        border-color: #6366f1;
      }
    }
    
    .promptpal-search-clear {
      position: absolute;
      right: 24px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      font-size: 20px;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;
      border-radius: 4px;
      transition: all 0.15s;
    }
    
    .promptpal-search-clear:hover {
      color: #ef4444;
      background: #fef2f2;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-search-clear:hover {
        background: #7f1d1d;
      }
    }
    
    /* No results state */
    .promptpal-no-results {
      padding: 40px 20px;
      text-align: center;
      color: #6b7280;
    }
    
    .promptpal-no-results span {
      font-size: 32px;
      display: block;
      margin-bottom: 12px;
    }
    
    .promptpal-no-results p {
      margin: 0;
      font-size: 14px;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-no-results {
        color: #9ca3af;
      }
    }
    
    /* Edit hint on hover */
    .promptpal-edit-hint {
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
      margin-left: auto;
    }
    
    .promptpal-item:hover .promptpal-edit-hint {
      opacity: 0.6;
    }
    
    /* Preview tooltip */
    .promptpal-preview-tooltip {
      position: fixed;
      z-index: 10000000;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      width: 320px;
      max-height: 300px;
      overflow-y: auto;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: promptpal-tooltip-fade 0.15s ease;
    }
    
    @keyframes promptpal-tooltip-fade {
      from { opacity: 0; transform: translateX(-5px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip {
        background: #1f2937;
        border-color: #374151;
        color: #f3f4f6;
      }
    }
    
    .promptpal-preview-tooltip .preview-header {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .promptpal-preview-tooltip .preview-header strong {
      font-size: 14px;
      color: #1f2937;
      flex: 1;
    }
    
    .promptpal-preview-tooltip .pin-badge {
      font-size: 11px;
      color: #6b7280;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-header {
        border-bottom-color: #374151;
      }
      
      .promptpal-preview-tooltip .preview-header strong {
        color: #f3f4f6;
      }
    }
    
    .promptpal-preview-tooltip .preview-content {
      padding: 12px 16px;
      font-size: 13px;
      line-height: 1.5;
      color: #4b5563;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-content {
        color: #d1d5db;
      }
    }
    
    .promptpal-preview-tooltip .preview-tags {
      padding: 0 16px 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .promptpal-preview-tooltip .preview-tag {
      font-size: 11px;
      background: #f3f4f6;
      color: #6b7280;
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-tag {
        background: #374151;
        color: #9ca3af;
      }
    }
    
    /* Edit modal overlay */
    .promptpal-edit-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000001;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: promptpal-fade-in 0.2s ease;
    }
    
    @keyframes promptpal-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .promptpal-edit-container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      width: 90%;
      max-width: 500px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: promptpal-slide-up 0.3s ease;
    }
    
    @keyframes promptpal-slide-up {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-edit-container {
        background: #1f2937;
      }
    }
    
    .promptpal-edit-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .promptpal-edit-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-edit-header {
        border-bottom-color: #374151;
      }
      
      .promptpal-edit-header h3 {
        color: #f3f4f6;
      }
    }
    
    .promptpal-edit-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      line-height: 1;
      transition: all 0.15s;
    }
    
    .promptpal-edit-close:hover {
      background: #f3f4f6;
      color: #ef4444;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-edit-close:hover {
        background: #374151;
      }
    }
    
    .promptpal-edit-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    
    .promptpal-edit-field {
      margin-bottom: 16px;
    }
    
    .promptpal-edit-field:last-child {
      margin-bottom: 0;
    }
    
    .promptpal-edit-field label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-edit-field label {
        color: #d1d5db;
      }
    }
    
    .promptpal-edit-field input,
    .promptpal-edit-field textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s;
      box-sizing: border-box;
      color: #1f2937;
      background: white;
    }
    
    .promptpal-edit-field input:focus,
    .promptpal-edit-field textarea:focus {
      outline: none;
      border-color: #4F46E5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    
    .promptpal-edit-field textarea {
      resize: vertical;
      min-height: 120px;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-edit-field input,
      .promptpal-edit-field textarea {
        background: #111827;
        border-color: #374151;
        color: #f3f4f6;
      }
      
      .promptpal-edit-field input:focus,
      .promptpal-edit-field textarea:focus {
        border-color: #6366f1;
      }
    }
    
    .promptpal-edit-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-edit-footer {
        background: #111827;
        border-top-color: #374151;
      }
    }
    
    .promptpal-edit-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    
    .promptpal-edit-btn-primary {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
    }
    
    .promptpal-edit-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
    
    .promptpal-edit-btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    
    .promptpal-edit-btn-secondary:hover {
      background: #e5e7eb;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-edit-btn-secondary {
        background: #374151;
        color: #f3f4f6;
      }
      
      .promptpal-edit-btn-secondary:hover {
        background: #4b5563;
      }
    }
    
    /* Preview Tooltip Styles */
    .promptpal-preview-tooltip {
      position: fixed;
      z-index: 1000001;
      width: 380px;
      max-height: 320px;
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: auto;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip {
        background: rgba(31, 41, 55, 0.98);
        border-color: #374151;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3);
      }
    }
    
    .promptpal-preview-tooltip .preview-header {
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f9fafb;
    }
    
    .promptpal-preview-tooltip .preview-header strong {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .promptpal-preview-tooltip .preview-header .pin-badge {
      font-size: 12px;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-header {
        background: #111827;
        border-bottom-color: #374151;
      }
      
      .promptpal-preview-tooltip .preview-header strong {
        color: #f3f4f6;
      }
    }
    
    .promptpal-preview-tooltip .preview-content {
      padding: 12px 16px;
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
      max-height: 220px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-content {
        color: #d1d5db;
      }
    }
    
    .promptpal-preview-tooltip .preview-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .promptpal-preview-tooltip .preview-content::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .promptpal-preview-tooltip .preview-content::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-content::-webkit-scrollbar-thumb {
        background: #4b5563;
      }
    }
    
    .promptpal-preview-tooltip .preview-variable {
      color: #7c3aed;
      background: rgba(124, 58, 237, 0.1);
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 500;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-variable {
        color: #a78bfa;
        background: rgba(167, 139, 250, 0.15);
      }
    }
    
    .promptpal-preview-tooltip .preview-tags {
      padding: 8px 16px 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      border-top: 1px solid #e5e7eb;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-tags {
        border-top-color: #374151;
      }
    }
    
    .promptpal-preview-tooltip .preview-tag {
      font-size: 11px;
      padding: 2px 8px;
      background: #e0e7ff;
      color: #4338ca;
      border-radius: 4px;
    }
    
    @media (prefers-color-scheme: dark) {
      .promptpal-preview-tooltip .preview-tag {
        background: rgba(99, 102, 241, 0.2);
        color: #a5b4fc;
      }
    }
  `;

    document.head.appendChild(style);
}

/**
 * Show variable fill form for a structured prompt
 * @param {Object} prompt - The prompt object with variables
 * @param {Object} inputTarget - The target input element
 */
function showVariableForm(prompt, inputTarget) {
    // Close any existing form
    closeVariableForm();

    if (!prompt.variables || prompt.variables.length === 0) {
        // No variables, insert directly
        insertText(prompt.content, inputTarget);
        showToast('Prompt inserted', 'success');
        return;
    }

    // Store the input target
    currentInputElement = inputTarget;

    // Add form styles
    addVariableFormStyles();

    // Create form overlay
    variableFormOverlay = document.createElement('div');
    variableFormOverlay.id = 'promptpal-variable-form';
    variableFormOverlay.className = 'promptpal-var-overlay';

    // Build form HTML
    let formHTML = `
        <div class="promptpal-var-container">
            <div class="promptpal-var-header">
                <h3>📝 Fill in Variables</h3>
                <button class="promptpal-var-close" title="Close">&times;</button>
            </div>
            <form class="promptpal-var-form" id="promptpal-var-form-inner">
    `;

    prompt.variables.forEach((variable, index) => {
        const fieldId = `promptpal-var-${variable.name}`;
        const label = ContentVariableUtils.formatVariableName(variable.name);

        formHTML += `<div class="promptpal-var-field">`;
        formHTML += `<label for="${fieldId}">${label}</label>`;

        if (variable.type === 'options' && variable.options && variable.options.length > 0) {
            // Select dropdown for options
            formHTML += `<select id="${fieldId}" name="${variable.name}" class="promptpal-var-input" ${variable.required ? 'required' : ''}>`;
            variable.options.forEach(opt => {
                const selected = opt === variable.default ? 'selected' : '';
                formHTML += `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
            });
            formHTML += `</select>`;
        } else if (variable.type === 'number') {
            // Number input
            const min = variable.min !== null ? `min="${variable.min}"` : '';
            const max = variable.max !== null ? `max="${variable.max}"` : '';
            const step = variable.step ? `step="${variable.step}"` : '';
            const defaultVal = variable.default || '';
            formHTML += `<input type="number" id="${fieldId}" name="${variable.name}" 
                class="promptpal-var-input" placeholder="${escapeHtml(variable.placeholder || '')}"
                value="${defaultVal}" ${min} ${max} ${step} ${variable.required ? 'required' : ''}>`;
            if (variable.min !== null || variable.max !== null) {
                formHTML += `<small class="promptpal-var-hint">Range: ${variable.min || '0'} - ${variable.max || '∞'}</small>`;
            }
        } else {
            // Text input (default)
            formHTML += `<input type="text" id="${fieldId}" name="${variable.name}" 
                class="promptpal-var-input" placeholder="${escapeHtml(variable.placeholder || '')}"
                ${variable.required ? 'required' : ''}>`;
        }

        // Example hint
        if (variable.example) {
            formHTML += `<small class="promptpal-var-example">📋 Example: ${escapeHtml(variable.example)}</small>`;
        }

        formHTML += `</div>`;
    });

    formHTML += `
            </form>
            <div class="promptpal-var-footer">
                <button type="button" class="promptpal-var-btn promptpal-var-btn-secondary" id="promptpal-var-cancel">Cancel</button>
                <button type="button" class="promptpal-var-btn promptpal-var-btn-primary" id="promptpal-var-submit">Insert Prompt</button>
            </div>
        </div>
    `;

    variableFormOverlay.innerHTML = formHTML;
    document.body.appendChild(variableFormOverlay);

    // Setup event listeners
    setupVariableFormListeners(prompt);

    // Focus first input
    const firstInput = variableFormOverlay.querySelector('.promptpal-var-input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

/**
 * Setup variable form event listeners
 */
function setupVariableFormListeners(prompt) {
    const closeBtn = variableFormOverlay.querySelector('.promptpal-var-close');
    const cancelBtn = variableFormOverlay.querySelector('#promptpal-var-cancel');
    const submitBtn = variableFormOverlay.querySelector('#promptpal-var-submit');
    const form = variableFormOverlay.querySelector('#promptpal-var-form-inner');

    // Close handlers
    closeBtn.addEventListener('click', closeVariableForm);
    cancelBtn.addEventListener('click', closeVariableForm);

    // Click outside to close
    variableFormOverlay.addEventListener('click', (e) => {
        if (e.target === variableFormOverlay) {
            closeVariableForm();
        }
    });

    // Escape key to close
    document.addEventListener('keydown', handleVariableFormKeydown);

    function handleVariableFormKeydown(e) {
        if (e.key === 'Escape' && variableFormOverlay) {
            closeVariableForm();
            document.removeEventListener('keydown', handleVariableFormKeydown);
        }
    }

    // Submit handler
    submitBtn.addEventListener('click', () => {
        const formData = {};
        const inputs = form.querySelectorAll('.promptpal-var-input');

        inputs.forEach(input => {
            formData[input.name] = input.value;
        });

        // Validate required fields
        let isValid = true;
        prompt.variables.forEach(variable => {
            if (variable.required && !formData[variable.name]?.trim()) {
                isValid = false;
                const input = form.querySelector(`[name="${variable.name}"]`);
                if (input) {
                    input.classList.add('promptpal-var-error');
                    input.focus();
                }
            }
        });

        if (!isValid) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        // Replace variables in content
        const finalContent = ContentVariableUtils.replaceVariables(prompt.content, formData);

        // Close form first
        closeVariableForm();

        // Insert the final content
        const success = insertText(finalContent, currentInputElement);
        if (success) {
            showToast('Prompt inserted', 'success');
        }

        // Notify background to increment usage
        chrome.runtime.sendMessage({
            action: 'insert_prompt',
            text: finalContent,
            promptId: prompt.id
        }).catch(() => { });

        currentInputElement = null;
    });

    // Enter key in last field submits
    const inputs = form.querySelectorAll('.promptpal-var-input');
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && index === inputs.length - 1) {
                e.preventDefault();
                submitBtn.click();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                inputs[index + 1]?.focus();
            }
        });

        // Clear error state on input
        input.addEventListener('input', () => {
            input.classList.remove('promptpal-var-error');
        });
    });
}

/**
 * Close variable form overlay
 */
function closeVariableForm() {
    if (variableFormOverlay) {
        variableFormOverlay.remove();
        variableFormOverlay = null;
    }
    document.querySelectorAll('#promptpal-variable-form').forEach(el => el.remove());
}

/**
 * Add variable form styles
 */
function addVariableFormStyles() {
    if (document.getElementById('promptpal-var-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'promptpal-var-styles';
    style.textContent = `
        .promptpal-var-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999999;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            animation: promptpal-fade-in 0.2s ease;
        }

        @keyframes promptpal-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .promptpal-var-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            width: 90%;
            max-width: 480px;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: promptpal-slide-up 0.3s ease;
        }

        @keyframes promptpal-slide-up {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .promptpal-var-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
        }

        .promptpal-var-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
        }

        .promptpal-var-close {
            background: none;
            border: none;
            font-size: 24px;
            color: #9ca3af;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            line-height: 1;
            transition: all 0.15s;
        }

        .promptpal-var-close:hover {
            background: #f3f4f6;
            color: #ef4444;
        }

        .promptpal-var-form {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }

        .promptpal-var-field {
            margin-bottom: 20px;
        }

        .promptpal-var-field:last-child {
            margin-bottom: 0;
        }

        .promptpal-var-field label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }

        .promptpal-var-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-size: 15px;
            font-family: inherit;
            transition: all 0.2s;
            box-sizing: border-box;
        }

        .promptpal-var-input:focus {
            outline: none;
            border-color: #4F46E5;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        .promptpal-var-input.promptpal-var-error {
            border-color: #ef4444;
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }

        .promptpal-var-input::placeholder {
            color: #9ca3af;
        }

        select.promptpal-var-input {
            cursor: pointer;
            background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;
            background-size: 16px;
            padding-right: 40px;
            appearance: none;
        }

        .promptpal-var-example,
        .promptpal-var-hint {
            display: block;
            font-size: 12px;
            color: #6b7280;
            margin-top: 6px;
        }

        .promptpal-var-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
            background: #f9fafb;
        }

        .promptpal-var-btn {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }

        .promptpal-var-btn-primary {
            background: linear-gradient(135deg, #4F46E5, #7C3AED);
            color: white;
        }

        .promptpal-var-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
        }

        .promptpal-var-btn-secondary {
            background: #f3f4f6;
            color: #374151;
        }

        .promptpal-var-btn-secondary:hover {
            background: #e5e7eb;
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
            .promptpal-var-container {
                background: #1f2937;
            }

            .promptpal-var-header {
                border-bottom-color: #374151;
            }

            .promptpal-var-header h3 {
                color: #f3f4f6;
            }

            .promptpal-var-close:hover {
                background: #374151;
            }

            .promptpal-var-field label {
                color: #e5e7eb;
            }

            .promptpal-var-input {
                background: #111827;
                border-color: #374151;
                color: #f3f4f6;
            }

            .promptpal-var-input:focus {
                border-color: #6366f1;
            }

            select.promptpal-var-input {
                background-color: #111827;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
            }

            .promptpal-var-example,
            .promptpal-var-hint {
                color: #9ca3af;
            }

            .promptpal-var-footer {
                background: #111827;
                border-top-color: #374151;
            }

            .promptpal-var-btn-secondary {
                background: #374151;
                color: #f3f4f6;
            }

            .promptpal-var-btn-secondary:hover {
                background: #4b5563;
            }
        }
    `;

    document.head.appendChild(style);
}

/**
 * Show toast notification
 * Types: 'success', 'error', 'warning', 'info'
 */
function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.promptpal-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `promptpal-toast promptpal-toast-${type}`;

    // Add ARIA attributes for accessibility
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');

    // Icon mapping for different types
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    // Color mapping
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#4F46E5'
    };

    toast.innerHTML = `
        <span class="promptpal-toast-icon">${icons[type] || icons.info}</span>
        <span class="promptpal-toast-message">${message}</span>
    `;

    const toastStyles = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        animation: promptpal-toast-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        max-width: 320px;
        word-break: break-word;
    `;

    toast.style.cssText = toastStyles;

    // Add animation styles if not already present
    if (!document.getElementById('promptpal-toast-animation')) {
        const animStyle = document.createElement('style');
        animStyle.id = 'promptpal-toast-animation';
        animStyle.textContent = `
            @keyframes promptpal-toast-slide-in {
                from {
                    transform: translateY(100px) scale(0.9);
                    opacity: 0;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }
            @keyframes promptpal-toast-slide-out {
                from {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
                to {
                    transform: translateY(20px) scale(0.95);
                    opacity: 0;
                }
            }
            .promptpal-toast-icon {
                font-size: 16px;
                flex-shrink: 0;
            }
            .promptpal-toast-message {
                line-height: 1.4;
            }
        `;
        document.head.appendChild(animStyle);
    }

    document.body.appendChild(toast);

    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
        toast.style.animation = 'promptpal-toast-slide-out 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Message listener
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ping') {
        sendResponse({ status: 'alive' });
        return true;
    }

    if (message.action === 'get_selection') {
        const text = getSelectedText();
        sendResponse({ text });
        return true;
    }

    if (message.action === 'inject_prompt') {
        const success = insertText(message.text);
        if (success) {
            showToast('Prompt inserted', 'success');
        }
        sendResponse({ success });
        return true;
    }

    // Handle structured prompts with variables
    if (message.action === 'inject_structured_prompt') {
        const prompt = message.prompt;
        const inputTarget = detectFocusedInput();

        if (!inputTarget) {
            showToast('Please focus an input field first', 'error');
            sendResponse({ success: false, error: 'No input focused' });
            return true;
        }

        // Show variable form
        showVariableForm(prompt, inputTarget);
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'show_floating_ui') {
        showFloatingUI();
        sendResponse({ success: true });
        return true;
    }

    // Handle feedback toast from background (for ALT+S save, etc.)
    if (message.action === 'show_feedback') {
        const { type, text } = message;
        showToast(text, type || 'info');
        sendResponse({ success: true });
        return true;
    }
});
