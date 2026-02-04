// Settings page logic for PromptPal
// Handles settings changes, data import/export, and i18n

console.log('PromptPal settings page loaded');

// DOM elements
const saveModeSelect = document.getElementById('save-mode');
const languageSelect = document.getElementById('language');
const themeSelect = document.getElementById('theme');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const clearBtn = document.getElementById('clear-btn');
const closeBtn = document.getElementById('close-btn');
const importFile = document.getElementById('import-file');
const toast = document.getElementById('toast');

/**
 * Initialize settings page
 */
async function init() {
    // Load current settings
    await loadSettings();

    // Check keyboard shortcuts
    await checkAndDisplayShortcuts();

    // Setup event listeners
    setupEventListeners();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const settings = await Storage.getSettings();

        // Set save mode
        saveModeSelect.value = settings.saveMode || 'quick';

        // Set language
        languageSelect.value = settings.language || 'auto';

        // Set theme
        themeSelect.value = settings.theme || 'auto';

    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Save mode change
    saveModeSelect.addEventListener('change', async (e) => {
        await updateSetting('saveMode', e.target.value);
        showToast('Save mode updated');
    });

    // Language change
    languageSelect.addEventListener('change', async (e) => {
        const newLanguage = e.target.value;
        await updateSetting('language', newLanguage);

        // Update language immediately
        if (newLanguage === 'auto') {
            // Detect browser language
            const browserLang = navigator.language.split('-')[0];
            I18n.setLanguage(browserLang === 'zh' ? 'zh_CN' : 'en');
        } else {
            I18n.setLanguage(newLanguage);
        }

        showToast('Language updated');
    });

    // Theme change
    themeSelect.addEventListener('change', async (e) => {
        await updateSetting('theme', e.target.value);
        showToast('Theme preference saved (feature coming soon)');
    });

    // Export button
    exportBtn.addEventListener('click', handleExport);

    // Import button
    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    // Import file selected
    importFile.addEventListener('change', handleImport);

    // Clear all data button
    clearBtn.addEventListener('click', handleClearData);

    // Close button
    closeBtn.addEventListener('click', () => {
        window.close();
    });

    // Help button
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (window.HelpSystem) {
                HelpSystem.show('settings');
            }
        });
    }
}

/**
 * Update a single setting
 */
async function updateSetting(key, value) {
    try {
        const settings = await Storage.getSettings();
        settings[key] = value;
        await Storage.updateSettings(settings);
    } catch (error) {
        console.error('Error updating setting:', error);
        showToast('Error saving setting', 'error');
    }
}

/**
 * Handle export - Download all data as JSON
 */
async function handleExport() {
    try {
        console.log('[Export] Starting export...');

        // Get all data from storage
        const allData = await chrome.storage.local.get(null);
        console.log('[Export] Data keys:', Object.keys(allData));

        // Create JSON string with pretty formatting
        const jsonString = JSON.stringify(allData, null, 2);

        // Create blob and download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `promptpal-backup-${new Date().toISOString().split('T')[0]}.json`;

        // Trigger download
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('✅ Data exported successfully!');
        console.log('[Export] Export complete');
    } catch (error) {
        console.error('[Export] Error:', error);
        showToast('❌ Export failed: ' + error.message, 'error');
    }
}

/**
 * Handle import
 */
async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const jsonString = event.target.result;
                const data = JSON.parse(jsonString);

                console.log('Importing data:', data);

                // Confirm before importing
                const confirmMsg = 'This will merge imported prompts with your existing data. Continue?';
                if (!confirm(confirmMsg)) {
                    return;
                }

                await Storage.importData(data);
                showToast('Data imported successfully');

                // Reset file input
                importFile.value = '';
            } catch (error) {
                console.error('Error parsing import file:', error);
                showToast('Invalid import file', 'error');
            }
        };

        reader.readAsText(file);
    } catch (error) {
        console.error('Error importing data:', error);
        showToast('Error importing data', 'error');
    }
}

/**
 * Handle clear all data
 */
async function handleClearData() {
    const confirmMsg = chrome.i18n.getMessage('clear_confirm_message') ||
        'This will permanently delete all your saved prompts. This action cannot be undone.';

    if (!confirm(confirmMsg)) {
        return;
    }

    // Second confirmation
    if (!confirm('Are you absolutely sure? This cannot be undone!')) {
        return;
    }

    try {
        await Storage.clearAllData();
        showToast('All data cleared');

        // Reload page after a delay
        setTimeout(() => {
            location.reload();
        }, 1500);
    } catch (error) {
        console.error('Error clearing data:', error);
        showToast('Error clearing data', 'error');
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';

        setTimeout(() => {
            toast.style.display = 'none';
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 300);
    }, 2500);
}

/**
 * Check and display keyboard shortcuts status
 */
async function checkAndDisplayShortcuts() {
    try {
        const statusContainer = document.getElementById('shortcut-status');
        if (!statusContainer) return;

        // Use the functions from shortcuts.js
        if (typeof checkShortcutConflicts === 'function') {
            const status = await checkShortcutConflicts();
            statusContainer.innerHTML = formatShortcutStatus(status);

            // Add click handler for fix button if present
            const fixBtn = document.getElementById('fix-shortcuts-btn');
            if (fixBtn) {
                fixBtn.addEventListener('click', () => {
                    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
                });
            }
        } else {
            console.warn('[Settings] shortcut functions not loaded');
        }
    } catch (error) {
        console.error('[Settings] Error checking shortcuts:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
