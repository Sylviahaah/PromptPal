/**
 * Keyboard Shortcut Utilities
 * Checks for conflicts and validates shortcuts
 */

/**
 * Check if keyboard shortcuts are properly configured
 */
async function checkShortcutConflicts() {
    try {
        const commands = await chrome.commands.getAll();
        const issues = [];

        // Expected default shortcuts
        const defaults = {
            'save_selection': 'Alt+S',
            'insert_prompt': 'Alt+P'
        };

        for (const command of commands) {
            // Check if shortcut is assigned
            if (!command.shortcut || command.shortcut.trim() === '') {
                issues.push({
                    command: command.name,
                    issue: 'no_shortcut',
                    severity: 'warning',
                    message: `No shortcut assigned for "${command.description}"`
                });
            }
            // Check if shortcut differs from default
            else if (defaults[command.name] && command.shortcut !== defaults[command.name]) {
                issues.push({
                    command: command.name,
                    issue: 'modified_shortcut',
                    severity: 'info',
                    message: `Shortcut changed from default ${defaults[command.name]} to ${command.shortcut}`
                });
            }
        }

        return {
            hasIssues: issues.length > 0,
            issues: issues,
            commands: commands,
            defaults: defaults
        };
    } catch (error) {
        console.error('Error checking shortcuts:', error);
        return {
            hasIssues: true,
            issues: [{
                command: 'unknown',
                issue: 'error',
                severity: 'error',
                message: 'Unable to check shortcuts: ' + error.message
            }],
            commands: [],
            defaults: {}
        };
    }
}

/**
 * Format shortcut status as HTML
 */
function formatShortcutStatus(status) {
    if (!status.hasIssues) {
        // All shortcuts OK
        let html = '<div class="success-box" style="background: #F0FDF4; border: 1px solid #86EFAC; padding: 16px; border-radius: 8px; margin-bottom: 16px;">';
        html += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">';
        html += '<span style="font-size: 20px;">✅</span>';
        html += '<strong style="color: #15803d;">All shortcuts configured properly</strong>';
        html += '</div>';
        html += '<ul style="margin: 0; padding-left: 20px; color: #166534;">';

        for (const cmd of status.commands) {
            html += `<li><strong>${cmd.description}:</strong> <kbd style="background: white; padding: 4px 8px; border-radius: 4px; border: 1px solid #d1d5db;">${cmd.shortcut}</kbd></li>`;
        }

        html += '</ul></div>';
        return html;
    } else {
        // Has issues
        let html = '<div class="warning-box" style="background: #FEF3C7; border: 1px solid #FDE68A; padding: 16px; border-radius: 8px; margin-bottom: 16px;">';
        html += '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">';
        html += '<span style="font-size: 20px;">⚠️</span>';
        html += '<strong style="color: #92400e;">Shortcut Issues Detected</strong>';
        html += '</div>';
        html += '<ul style="margin: 0 0 12px 0; padding-left: 20px; color: #78350f;">';

        for (const issue of status.issues) {
            html += `<li>${issue.message}</li>`;
        }

        html += '</ul>';
        html += '<button id="fix-shortcuts-btn" style="background: #D97706; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;">Configure Shortcuts</button>';
        html += '</div>';
        return html;
    }
}

// Export for use in settings
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { checkShortcutConflicts, formatShortcutStatus };
}
