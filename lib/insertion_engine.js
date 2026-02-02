// Smart Insertion Engine for PromptPal
// Multi-layer insertion strategies for modern frameworks

/**
 * Smart Insertion Engine - Multi-layer insertion strategies
 */
class SmartInsertionEngine {
    constructor() {
        this.siteStrategies = new Map();
        this.env = this.detectEnvironment();
    }

    /**
     * Detect framework and browser environment
     */
    detectEnvironment() {
        return {
            isReact: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            isVue: !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__ || !!window.__VUE__,
            isAngular: !!window.ng || !!window.getAllAngularRootElements,
            hasShadowDOM: 'attachShadow' in Element.prototype,
            hasClipboardAccess: 'clipboard' in navigator && window.isSecureContext,
            isSecureContext: window.isSecureContext
        };
    }

    /**
     * Main insertion method - tries strategies in order
     */
    async insert(element, text) {
        if (!element || !text) {
            console.warn('[SmartInsertion] Invalid element or text');
            return false;
        }

        // Recursion guard to prevent stack overflow
        if (!this.canInsert(element)) {
            console.error('[SmartInsertion] Recursion limit reached - aborting');
            return false;
        }

        this.beginInsertion(element);

        try {
            const hostname = window.location.hostname;
            console.log(`[SmartInsertion] Inserting into ${hostname}`, this.env);

            // Try cached strategy first
            if (this.siteStrategies.has(hostname)) {
                const cachedStrategy = this.siteStrategies.get(hostname);
                console.log(`[SmartInsertion] Trying cached: ${cachedStrategy}`);

                const result = await this.tryStrategy(cachedStrategy, element, text);
                if (result) {
                    console.log(`[SmartInsertion] ✓ Cached worked: ${cachedStrategy}`);
                    return true;
                }
            }

            // Try all strategies
            const strategies = this.getStrategiesForSite(hostname);

            for (const strategy of strategies) {
                console.log(`[SmartInsertion] Trying: ${strategy}`);

                const result = await this.tryStrategy(strategy, element, text);
                if (result) {
                    console.log(`[SmartInsertion] ✓ Success: ${strategy}`);
                    this.siteStrategies.set(hostname, strategy);
                    return true;
                }
            }

            console.error('[SmartInsertion] ✗ All strategies failed');
            return false;
        } finally {
            this.endInsertion(element);
        }
    }

    /**
     * Recursion guard methods (prevents stack overflow)
     */
    canInsert(element) {
        if (!this.insertionCounts) {
            this.insertionCounts = new WeakMap();
        }
        const count = this.insertionCounts.get(element) || 0;
        return count < 5; // Max 5 nested insertions
    }

    beginInsertion(element) {
        if (!this.insertionCounts) {
            this.insertionCounts = new WeakMap();
        }
        const count = this.insertionCounts.get(element) || 0;
        this.insertionCounts.set(element, count + 1);
    }

    endInsertion(element) {
        if (!this.insertionCounts) {
            this.insertionCounts = new WeakMap();
        }
        const count = this.insertionCounts.get(element) || 0;
        this.insertionCounts.set(element, Math.max(0, count - 1));
    }

    /**
     * Get ordered strategies for site
     */
    getStrategiesForSite(hostname) {
        const siteStrategies = {
            'chat.openai.com': ['react', 'typing', 'standard'],
            'claude.ai': ['react', 'typing', 'clipboard'],
            'gemini.google.com': ['react', 'clipboard', 'standard'],
            'notion.so': ['typing', 'clipboard', 'standard'],
            'github.com': ['standard', 'typing'],
            'docs.google.com': ['typing', 'clipboard'],
        };

        if (siteStrategies[hostname]) {
            return siteStrategies[hostname];
        }

        // Default order
        const defaultOrder = ['standard'];
        if (this.env.isReact) defaultOrder.push('react');
        if (this.env.isVue) defaultOrder.push('vue');
        defaultOrder.push('typing');
        if (this.env.hasClipboardAccess) defaultOrder.push('clipboard');
        defaultOrder.push('bypass');

        return defaultOrder;
    }

    /**
     * Try specific strategy
     */
    async tryStrategy(strategy, element, text) {
        try {
            switch (strategy) {
                case 'standard':
                    return this.standardInsert(element, text);
                case 'react':
                    return this.reactInsert(element, text);
                case 'vue':
                    return this.vueInsert(element, text);
                case 'typing':
                    return await this.simulateTyping(element, text);
                case 'clipboard':
                    return await this.clipboardInsert(element, text);
                case 'bypass':
                    return this.mutationBypassInsert(element, text);
                default:
                    return false;
            }
        } catch (error) {
            console.debug(`[SmartInsertion] ${strategy} error:`, error.message);
            return false;
        }
    }

    /**
     * Strategy 1: Standard DOM insertion
     */
    standardInsert(element, text) {
        const insertMethod = this.getInsertMethod(element);

        try {
            if (insertMethod === 'value') {
                const start = element.selectionStart || 0;
                const end = element.selectionEnd || 0;
                const currentValue = element.value || '';

                element.value = currentValue.substring(0, start) + text + currentValue.substring(end);
                element.selectionStart = element.selectionEnd = start + text.length;

                this.dispatchEvents(element, ['input', 'change']);
            } else if (insertMethod === 'content') {
                element.focus();

                const selection = window.getSelection();

                // Validate selection
                if (!selection) {
                    console.debug('[StandardInsert] No selection available');
                    return false;
                }

                let range;
                if (selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);
                } else {
                    // If no selection, create a range at the end of the element
                    range = document.createRange();
                    range.selectNodeContents(element);
                }

                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);

                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);

                this.dispatchEvents(element, ['input']);
            }

            return this.verifyInsertion(element, text);
        } catch (error) {
            console.debug('[StandardInsert] Failed:', error);
            return false;
        }
    }

    /**
     * Strategy 2: React-specific insertion (FIXED based on research)
     */
    reactInsert(element, text) {
        try {
            // Determine correct prototype based on element type
            const prototype = element.tagName === 'TEXTAREA'
                ? window.HTMLTextAreaElement.prototype
                : element.tagName === 'INPUT'
                    ? window.HTMLInputElement.prototype
                    : null;

            if (!prototype) {
                console.debug('[ReactInsert] Not a textarea or input');
                return false;
            }

            // Get native value setter
            const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

            if (!nativeValueSetter) {
                console.debug('[ReactInsert] No native setter found');
                return false;
            }

            // Call native setter (bypasses React's value tracking)
            nativeValueSetter.call(element, text);

            // Dispatch both input AND change events (critical for React)
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            // Additional events for full framework compatibility
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            element.dispatchEvent(new Event('focus', { bubbles: true }));

            console.log('[ReactInsert] ✓ Successfully inserted via native setter');
            return this.verifyInsertion(element, text);
        } catch (error) {
            console.debug('[ReactInsert] Failed:', error);
            return false;
        }
    }

    /**
     * Strategy 3: Vue-specific insertion
     */
    vueInsert(element, text) {
        try {
            if (element.__vue__ || element.__vueParentComponent) {
                element.value = text;
                this.dispatchEvents(element, ['input', 'change', 'blur']);
                return this.verifyInsertion(element, text);
            }

            return false;
        } catch (error) {
            console.debug('[VueInsert] Failed:', error);
            return false;
        }
    }

    /**
     * Strategy 4: Realistic typing simulation
     */
    async simulateTyping(element, text, delay = 5) {
        try {
            element.focus();

            if (this.getInsertMethod(element) === 'value') {
                element.select();
                element.value = '';
            }

            for (let i = 0; i < text.length; i++) {
                const char = text[i];

                element.dispatchEvent(new KeyboardEvent('keydown', {
                    key: char,
                    bubbles: true,
                    cancelable: true
                }));

                if (this.getInsertMethod(element) === 'value') {
                    const start = element.selectionStart || 0;
                    const current = element.value || '';
                    element.value = current.substring(0, start) + char + current.substring(start);
                    element.selectionStart = element.selectionEnd = start + 1;
                } else {
                    document.execCommand('insertText', false, char);
                }

                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new KeyboardEvent('keyup', {
                    key: char,
                    bubbles: true
                }));

                if (delay > 0 && i < text.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            this.dispatchEvents(element, ['change', 'blur']);
            return true;
        } catch (error) {
            console.debug('[TypingSimulation] Failed:', error);
            return false;
        }
    }

    /**
     * Strategy 5: Clipboard insertion
     */
    async clipboardInsert(element, text) {
        if (!this.env.hasClipboardAccess) {
            return false;
        }

        try {
            let previousClipboard = '';
            try {
                previousClipboard = await navigator.clipboard.readText();
            } catch (e) { }

            await navigator.clipboard.writeText(text);

            element.focus();
            element.select();

            const pasteResult = document.execCommand('paste');

            if (!pasteResult) {
                element.dispatchEvent(new ClipboardEvent('paste', {
                    bubbles: true
                }));
            }

            if (previousClipboard) {
                setTimeout(() => {
                    navigator.clipboard.writeText(previousClipboard).catch(() => { });
                }, 100);
            }

            return this.verifyInsertion(element, text);
        } catch (error) {
            console.debug('[ClipboardInsert] Failed:', error);
            return false;
        }
    }

    /**
     * Strategy 6: MutationObserver bypass
     */
    mutationBypassInsert(element, text) {
        try {
            const OriginalMO = window.MutationObserver;
            window.MutationObserver = class FakeMutationObserver {
                constructor() { }
                disconnect() { }
                observe() { }
                takeRecords() { return []; }
            };

            try {
                const valueSetter = Object.getOwnPropertyDescriptor(
                    element.constructor.prototype,
                    'value'
                )?.set;

                if (valueSetter) {
                    valueSetter.call(element, text);
                }

                this.dispatchEvents(element, [
                    'keydown', 'keypress', 'input',
                    'change', 'keyup', 'blur', 'focus'
                ]);

                return this.verifyInsertion(element, text);
            } finally {
                window.MutationObserver = OriginalMO;
            }
        } catch (error) {
            console.debug('[MutationBypass] Failed:', error);
            return false;
        }
    }

    /**
     * Helper: Get insertion method for element
     */
    getInsertMethod(element) {
        if (element.tagName === 'TEXTAREA' ||
            (element.tagName === 'INPUT' && ['text', 'search', 'email', 'url'].includes(element.type))) {
            return 'value';
        }
        if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
            return 'content';
        }
        return 'value';
    }

    /**
     * Helper: Dispatch multiple events
     */
    dispatchEvents(element, eventTypes) {
        eventTypes.forEach(type => {
            element.dispatchEvent(new Event(type, { bubbles: true }));
        });
    }

    /**
     * Helper: Verify insertion worked
     */
    verifyInsertion(element, text) {
        const insertMethod = this.getInsertMethod(element);
        const checkText = text.substring(0, Math.min(20, text.length));

        if (insertMethod === 'value') {
            return element.value && element.value.includes(checkText);
        } else {
            return element.textContent && element.textContent.includes(checkText);
        }
    }
}

// Export for use in content_script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartInsertionEngine;
}
