/**
 * PromptPal Help System
 * Centralized help modal for all extension interfaces
 */

const HelpSystem = {
    helpContent: {
        settings: {
            title: '⚙️ Settings Help',
            sections: [
                {
                    title: 'Save Modes',
                    content: '• **Quick**: Saves immediately with auto-generated title\n• **Detailed**: Opens popup to add title and tags'
                },
                {
                    title: 'Keyboard Shortcuts',
                    content: '• **Alt+S**: Save selected text\n• **Alt+P**: Insert prompt into active field\n• Configure in chrome://extensions/shortcuts'
                },
                {
                    title: 'Data Management',
                    content: '• **Export**: Download all prompts as JSON backup\n• **Import**: Merge or replace from JSON file\n• **Clear**: Delete all data (requires confirmation)'
                }
            ]
        },
        manager: {
            title: '📚 Library Help',
            sections: [
                {
                    title: 'Search & Filter',
                    content: '• Search by title, content, or tags\n• Filter by category or date\n• Sort by most used or recently added'
                },
                {
                    title: 'Organizing Prompts',
                    content: '• 📌 Pin frequently used prompts\n• Add tags for easy filtering\n• Create categories for grouping'
                },
                {
                    title: 'Editing',
                    content: '• Click any prompt to edit\n• Changes save automatically\n• Duplicate prompts for variations'
                }
            ]
        },
        popup: {
            title: '⚡ Quick Access Help',
            sections: [
                {
                    title: 'Quick Save',
                    content: '• Type or paste text in the input\n• Click Save or press Enter\n• No character limits'
                },
                {
                    title: 'Using Prompts',
                    content: '• Click any prompt to insert into active field\n• Recent prompts show at top\n• Pinned prompts always visible'
                },
                {
                    title: 'Shortcuts',
                    content: '• **Alt+S**: Save selection from any page\n• **Alt+P**: Open prompt selector\n• **ESC**: Close popup/selector'
                }
            ]
        },
        general: {
            title: '📖 PromptPal Quick Guide',
            sections: [
                {
                    title: 'Getting Started',
                    content: '1. Select text on any page\n2. Right-click → "Save to Prompt Library"\n3. Use Alt+P in AI chats to insert prompts'
                },
                {
                    title: 'Pro Tips',
                    content: '• Pin your top 5 prompts for quick access\n• Export backup before clearing data\n• Use descriptive titles for easy search'
                },
                {
                    title: 'Need More Help?',
                    content: '• Replay tutorial from Settings\n• Check Settings → Help & Tutorial section'
                }
            ]
        }
    },

    /**
     * Show help modal for specific context
     */
    show(context = 'general') {
        const content = this.helpContent[context] || this.helpContent.general;
        this.createModal(content);
    },

    /**
     * Create and display help modal
     */
    createModal(content) {
        // Remove existing modal
        this.close();

        const overlay = document.createElement('div');
        overlay.id = 'promptpal-help-overlay';
        overlay.className = 'help-overlay';
        overlay.innerHTML = `
            <div class="help-modal">
                <div class="help-header">
                    <h2>${content.title}</h2>
                    <button class="help-close-btn" aria-label="Close">×</button>
                </div>
                <div class="help-body">
                    ${content.sections.map(section => `
                        <div class="help-section">
                            <h3>${section.title}</h3>
                            <p>${this.formatContent(section.content)}</p>
                        </div>
                    `).join('')}
                </div>
                <div class="help-footer">
                    <button class="help-tutorial-btn">🔄 Replay Tutorial</button>
                    <button class="help-ok-btn">Got it!</button>
                </div>
            </div>
        `;

        // Add styles if not present
        this.injectStyles();

        document.body.appendChild(overlay);

        // Event listeners
        overlay.querySelector('.help-close-btn').addEventListener('click', () => this.close());
        overlay.querySelector('.help-ok-btn').addEventListener('click', () => this.close());
        overlay.querySelector('.help-tutorial-btn').addEventListener('click', () => {
            this.close();
            chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        // Close on ESC
        document.addEventListener('keydown', this.escHandler);
    },

    escHandler(e) {
        if (e.key === 'Escape') {
            HelpSystem.close();
        }
    },

    /**
     * Close help modal
     */
    close() {
        const overlay = document.getElementById('promptpal-help-overlay');
        if (overlay) {
            overlay.remove();
        }
        document.removeEventListener('keydown', this.escHandler);
    },

    /**
     * Format content with markdown-like styling
     */
    formatContent(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    },

    /**
     * Inject modal styles
     */
    injectStyles() {
        if (document.getElementById('promptpal-help-styles')) return;

        const style = document.createElement('style');
        style.id = 'promptpal-help-styles';
        style.textContent = `
            .help-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .help-modal {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 480px;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .help-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .help-header h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }
            
            .help-close-btn {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            
            .help-close-btn:hover {
                background: rgba(255,255,255,0.3);
            }
            
            .help-body {
                padding: 20px;
                overflow-y: auto;
                max-height: 50vh;
            }
            
            .help-section {
                margin-bottom: 16px;
            }
            
            .help-section:last-child {
                margin-bottom: 0;
            }
            
            .help-section h3 {
                margin: 0 0 8px 0;
                font-size: 14px;
                font-weight: 600;
                color: #374151;
            }
            
            .help-section p {
                margin: 0;
                font-size: 13px;
                color: #6b7280;
                line-height: 1.6;
            }
            
            .help-footer {
                display: flex;
                gap: 12px;
                padding: 16px 20px;
                border-top: 1px solid #e5e7eb;
                background: #f9fafb;
            }
            
            .help-tutorial-btn {
                flex: 1;
                padding: 10px 16px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .help-tutorial-btn:hover {
                background: #f3f4f6;
            }
            
            .help-ok-btn {
                flex: 1;
                padding: 10px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 8px;
                color: white;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .help-ok-btn:hover {
                transform: scale(1.02);
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .help-modal {
                    background: #1f2937;
                }
                .help-body {
                    background: #1f2937;
                }
                .help-section h3 {
                    color: #f3f4f6;
                }
                .help-section p {
                    color: #9ca3af;
                }
                .help-footer {
                    background: #111827;
                    border-color: #374151;
                }
                .help-tutorial-btn {
                    background: #374151;
                    border-color: #4b5563;
                    color: #f3f4f6;
                }
            }
        `;
        document.head.appendChild(style);
    }
};

// Export for use in extension pages
if (typeof window !== 'undefined') {
    window.HelpSystem = HelpSystem;
}
