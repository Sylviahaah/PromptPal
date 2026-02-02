// Content script wrapper - loads SmartInsertionEngine integration
// This file bridges the legacy insertText function with the new SmartInsertionEngine

// Initialize Smart Insertion Engine (loaded from lib/insertion_engine.js)
if (typeof SmartInsertionEngine !== 'undefined') {
    window.promptPalInsertionEngine = new SmartInsertionEngine();
    console.log('[PromptPal] Smart Insertion Engine initialized');
} else {
    console.error('[PromptPal] SmartInsertionEngine not found! Make sure lib/insertion_engine.js is loaded first.');
}

// Override insertText to use SmartInsertionEngine
window.originalInsertText = window.insertText;

window.insertText = async function(text, target = null) {
    // Use SmartInsertionEngine if available
    if (window.promptPalInsertionEngine) {
        if (!target) {
            target = detectFocusedInput();
        }
        
        if (!target) {
            console.warn('[PromptPal] No input element detected');
            if (typeof showToast !== 'undefined') {
                showToast('Please focus an input field first', 'error');
            }
            return false;
        }
        
        console.log('[PromptPal] Using SmartInsertionEngine');
        const success = await window.promptPalInsertionEngine.insert(target.element, text);
        
        if (!success && typeof showToast !== 'undefined') {
            showToast('Failed to insert. Try clicking the input field.', 'error');
        }
        
        return success;
    }
    
    // Fallback to original if engine not available
    console.warn('[PromptPal] Falling back to original insertText');
    return window.originalInsertText ? window.originalInsertText(text, target) : false;
};

console.log('[PromptPal] Insertion wrapper loaded');
