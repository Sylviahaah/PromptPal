// Content script for PromptPal
// Handles smart input detection, prompt injection, and floating UI

console.log('PromptPal content script loaded');

// State
let floatingUI = null;
let currentInputElement = null;

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
 * Get current text selection (with recursion guard)
 */
let isGettingSelection = false;
function getSelection() {
    // Recursion guard
    if (isGettingSelection) {
        console.warn('[PromptPal] Recursive getSelection call blocked');
        return '';
    }

    isGettingSelection = true;
    try {
        const selection = window.getSelection();
        return selection ? selection.toString().trim() : '';
    } finally {
        isGettingSelection = false;
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

    // Get pinned + recent (max 10)
    const pinned = response.prompts.filter(p => p.isPinned);
    const recent = response.prompts
        .filter(p => !p.isPinned)
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, 10 - pinned.length);

    const displayPrompts = [...pinned, ...recent];

    // Build HTML with close button
    let html = '<div class="promptpal-header"><span>Select Prompt</span><button class="promptpal-close-btn" title="Close (Esc)">✕</button></div>';
    html += '<div class="promptpal-list">';

    displayPrompts.forEach((prompt, index) => {
        const truncatedTitle = prompt.title.length > 40
            ? prompt.title.substring(0, 37) + '...'
            : prompt.title;

        html += `
      <div class="promptpal-item" data-prompt-id="${prompt.id}" data-index="${index}">
        ${prompt.isPinned ? '<span class="pin-icon">📌</span>' : ''}
        <span class="prompt-title">${escapeHtml(truncatedTitle)}</span>
      </div>
    `;
    });

    html += '</div>';
    html += '<div class="promptpal-footer">ESC to close • ↑↓ to navigate • Enter to select</div>';

    floatingUI.innerHTML = html;

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

    // Add styles
    addFloatingUIStyles();

    // Position near cursor or center
    positionFloatingUI(target.element);

    // Add to page
    document.body.appendChild(floatingUI);

    // Add event listeners
    setupFloatingUIListeners(displayPrompts);

    // Focus first item
    const firstItem = floatingUI.querySelector('.promptpal-item');
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
    // Click on item
    floatingUI.querySelectorAll('.promptpal-item').forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('[PromptPal] Prompt item clicked');

            const promptId = item.getAttribute('data-prompt-id');
            const prompt = prompts.find(p => p.id === promptId);

            if (prompt) {
                // Close UI FIRST before insertion - FORCE REMOVE
                console.log('[PromptPal] Closing UI before insertion');
                floatingUI = null;

                // Force remove by ID (multiple attempts)
                document.querySelectorAll('#promptpal-floating-ui').forEach(el => {
                    console.log('[PromptPal] Force removing element');
                    el.remove();
                });

                // Now insert
                try {
                    insertText(prompt.content, currentInputElement);
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
        });
    });

    // Keyboard navigation
    let selectedIndex = 0;
    const items = Array.from(floatingUI.querySelectorAll('.promptpal-item'));

    document.addEventListener('keydown', handleFloatingUIKeydown);

    function handleFloatingUIKeydown(e) {
        if (!floatingUI || !document.body.contains(floatingUI)) {
            document.removeEventListener('keydown', handleFloatingUIKeydown);
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            document.removeEventListener('keydown', handleFloatingUIKeydown);
            closeFloatingUI();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            items[selectedIndex]?.click();
        }
    }

    function updateSelection() {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });

        // Scroll into view
        items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }

    // Click outside to close
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);

    function handleOutsideClick(e) {
        if (floatingUI && !floatingUI.contains(e.target)) {
            closeFloatingUI();
            document.removeEventListener('click', handleOutsideClick);
        }
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
      max-height: 500px;
      overflow: hidden;
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
      max-height: 400px;
      overflow-y: auto;
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
  `;

    document.head.appendChild(style);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `promptpal-toast promptpal-toast-${type}`;
    toast.textContent = message;

    const toastStyles = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999999;
    background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#4F46E5'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    animation: promptpal-slide-in 0.3s ease;
  `;

    toast.style.cssText = toastStyles;

    // Add animation
    if (!document.getElementById('promptpal-toast-animation')) {
        const animStyle = document.createElement('style');
        animStyle.id = 'promptpal-toast-animation';
        animStyle.textContent = `
      @keyframes promptpal-slide-in {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
        document.head.appendChild(animStyle);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';

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
        const text = getSelection();
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

    if (message.action === 'show_floating_ui') {
        showFloatingUI();
        sendResponse({ success: true });
        return true;
    }
});
