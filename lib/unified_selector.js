/**
 * UnifiedPromptSelector - Shared prompt selection logic
 * Used by both popup (icon click) and modal (Alt+P) interfaces
 * 
 * @file lib/unified_selector.js
 */

/**
 * Configuration options for UnifiedPromptSelector
 * @typedef {Object} SelectorConfig
 * @property {'popup'|'modal'} context - The context this selector runs in
 * @property {HTMLElement} container - Container element to render into
 * @property {Function} onInsert - Callback when prompt is inserted
 * @property {Function} onClose - Callback when selector is closed
 * @property {Function} onEdit - Callback when prompt is edited
 * @property {number} [maxItems=10] - Maximum items to display
 */

/**
 * Selector state
 * @typedef {Object} SelectorState
 * @property {Array} items - Filtered prompt list
 * @property {number} selectedIndex - Currently selected index (-1 for none)
 * @property {string} filterQuery - Current search query
 * @property {'search'|'list'} inputFocus - Which element has focus
 */

class UnifiedPromptSelector {
    /**
     * @param {SelectorConfig} config
     */
    constructor(config) {
        this.context = config.context;
        this.container = config.container;
        this.onInsert = config.onInsert || (() => { });
        this.onClose = config.onClose || (() => { });
        this.onEdit = config.onEdit || (() => { });
        this.maxItems = config.maxItems || 10;

        /** @type {SelectorState} */
        this.state = {
            items: [],
            allItems: [],
            selectedIndex: -1,
            filterQuery: '',
            inputFocus: 'search'
        };

        // UI element references
        this.searchInput = null;
        this.listContainer = null;
        this.previewTooltip = null;

        // Timers for debounce and click detection
        this.searchDebounceTimer = null;
        this.clickTimer = null;
        this.hidePreviewTimer = null;

        // Bound event handlers (for removal)
        this._boundKeyHandler = this._handleKeydown.bind(this);
        this._boundOutsideClick = this._handleOutsideClick.bind(this);
    }

    /**
     * Initialize the selector with prompts
     * @param {Array} prompts - All available prompts
     */
    init(prompts) {
        this.state.allItems = prompts;
        this.state.items = this._filterAndSort(prompts, '');
        this._render();
        this._attachEventListeners();
        this._focusSearch();
        this._loadPersistedSearch();
    }

    /**
     * Load persisted search query from session storage
     */
    async _loadPersistedSearch() {
        try {
            const result = await chrome.storage.session.get(['lastSearchQuery']);
            if (result.lastSearchQuery) {
                this.searchInput.value = result.lastSearchQuery;
                this._handleSearchInput(result.lastSearchQuery);
            }
        } catch (e) {
            // Session storage may not be available
        }
    }

    /**
     * Persist search query to session storage
     */
    async _persistSearch(query) {
        try {
            await chrome.storage.session.set({ lastSearchQuery: query });
        } catch (e) {
            // Session storage may not be available
        }
    }

    /**
     * Filter and sort prompts
     * @param {Array} prompts
     * @param {string} query
     * @returns {Array}
     */
    _filterAndSort(prompts, query) {
        let filtered = prompts;

        if (query && query.trim()) {
            const term = query.toLowerCase().trim();
            filtered = prompts.filter(p =>
                p.title.toLowerCase().includes(term) ||
                p.content.toLowerCase().includes(term) ||
                (p.tags && p.tags.some(t => t.toLowerCase().includes(term)))
            );
        }

        // Sort: pinned first, then by lastUsed
        const pinned = filtered.filter(p => p.isPinned);
        const recent = filtered
            .filter(p => !p.isPinned)
            .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

        return [...pinned, ...recent].slice(0, this.maxItems);
    }

    /**
     * Render the selector UI
     */
    _render() {
        this.container.innerHTML = this._buildHTML();
        this.searchInput = this.container.querySelector('.ups-search-input');
        this.listContainer = this.container.querySelector('.ups-list');
        this._attachItemListeners();
    }

    /**
     * Build HTML structure
     * @returns {string}
     */
    _buildHTML() {
        const items = this.state.items;

        let html = `
            <div class="ups-header">
                <span class="ups-title">📋 Select Prompt</span>
                <button class="ups-close-btn" aria-label="Close">&times;</button>
            </div>
            <div class="ups-search-container">
                <input type="text" 
                       class="ups-search-input" 
                       placeholder="Search prompts..." 
                       value="${this._escapeHtml(this.state.filterQuery)}"
                       aria-label="Search prompts" />
                <button class="ups-search-clear" 
                        style="display: ${this.state.filterQuery ? 'block' : 'none'}"
                        aria-label="Clear search">&times;</button>
            </div>
            <div class="ups-list" role="listbox" aria-label="Prompts">
        `;

        if (items.length === 0) {
            html += `
                <div class="ups-no-results">
                    <span>🔍</span>
                    <p>No prompts found</p>
                </div>
            `;
        } else {
            items.forEach((prompt, index) => {
                const isSelected = index === this.state.selectedIndex;
                html += `
                    <div class="ups-item ${isSelected ? 'selected' : ''}" 
                         data-index="${index}"
                         data-prompt-id="${prompt.id}"
                         role="option"
                         aria-selected="${isSelected}">
                        ${prompt.isPinned ? '<span class="ups-pin-icon">📌</span>' : ''}
                        <span class="ups-item-title">${this._escapeHtml(prompt.title)}</span>
                        <span class="ups-edit-hint" title="Double-click to edit">✏️</span>
                    </div>
                `;
            });
        }

        html += `</div>`;
        html += `
            <div class="ups-footer">
                ESC close • ↑↓ navigate • Enter insert • Dbl-click edit
            </div>
        `;

        return html;
    }

    /**
     * Re-render just the list (after filter)
     */
    _renderList() {
        const items = this.state.items;
        let html = '';

        if (items.length === 0) {
            html = `
                <div class="ups-no-results">
                    <span>🔍</span>
                    <p>No prompts found</p>
                </div>
            `;
        } else {
            items.forEach((prompt, index) => {
                const isSelected = index === this.state.selectedIndex;
                html += `
                    <div class="ups-item ${isSelected ? 'selected' : ''}" 
                         data-index="${index}"
                         data-prompt-id="${prompt.id}"
                         role="option"
                         aria-selected="${isSelected}">
                        ${prompt.isPinned ? '<span class="ups-pin-icon">📌</span>' : ''}
                        <span class="ups-item-title">${this._escapeHtml(prompt.title)}</span>
                        <span class="ups-edit-hint" title="Double-click to edit">✏️</span>
                    </div>
                `;
            });
        }

        this.listContainer.innerHTML = html;
        this._attachItemListeners();

        // Select first item if available
        if (items.length > 0 && this.state.selectedIndex === -1) {
            this._selectIndex(0);
        }
    }

    /**
     * Attach event listeners
     */
    _attachEventListeners() {
        // Search input
        this.searchInput.addEventListener('input', (e) => {
            this._debouncedSearch(e.target.value);
        });

        // Clear button
        const clearBtn = this.container.querySelector('.ups-search-clear');
        clearBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this._handleSearchInput('');
            this._focusSearch();
        });

        // Close button
        const closeBtn = this.container.querySelector('.ups-close-btn');
        closeBtn.addEventListener('click', () => this.close());

        // Global keyboard handler
        document.addEventListener('keydown', this._boundKeyHandler);

        // Outside click (for modal context)
        if (this.context === 'modal') {
            setTimeout(() => {
                document.addEventListener('click', this._boundOutsideClick);
            }, 100);
        }
    }

    /**
     * Attach listeners to list items
     */
    _attachItemListeners() {
        const items = this.listContainer.querySelectorAll('.ups-item');

        items.forEach((item) => {
            const index = parseInt(item.dataset.index, 10);
            const prompt = this.state.items[index];

            // Single click (with delay for double-click detection)
            item.addEventListener('click', (e) => {
                if (this.clickTimer) {
                    clearTimeout(this.clickTimer);
                    this.clickTimer = null;
                    return; // Double-click will handle
                }

                this.clickTimer = setTimeout(() => {
                    this.clickTimer = null;
                    this._selectIndex(index);
                    this._insertSelected();
                }, 250);
            });

            // Double click - edit
            item.addEventListener('dblclick', (e) => {
                if (this.clickTimer) {
                    clearTimeout(this.clickTimer);
                    this.clickTimer = null;
                }
                this._selectIndex(index);
                this.onEdit(prompt);
            });

            // Hover - show preview
            item.addEventListener('mouseenter', () => {
                this._selectIndex(index, false); // Temporary selection
                this._showPreview(item, prompt);
            });

            item.addEventListener('mouseleave', () => {
                this._hidePreview();
            });
        });
    }

    /**
     * Debounced search handler
     */
    _debouncedSearch(query) {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this._handleSearchInput(query);
        }, 300);
    }

    /**
     * Handle search input change
     */
    _handleSearchInput(query) {
        this.state.filterQuery = query;
        this.state.items = this._filterAndSort(this.state.allItems, query);
        this.state.selectedIndex = this.state.items.length > 0 ? 0 : -1;

        // Update clear button visibility
        const clearBtn = this.container.querySelector('.ups-search-clear');
        clearBtn.style.display = query ? 'block' : 'none';

        this._renderList();
        this._persistSearch(query);
    }

    /**
     * Handle keyboard navigation
     */
    _handleKeydown(e) {
        const items = this.state.items;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (items.length > 0) {
                    const nextIndex = (this.state.selectedIndex + 1) % items.length;
                    this._selectIndex(nextIndex);
                    this._showPreviewForSelected();
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (items.length > 0) {
                    const prevIndex = this.state.selectedIndex <= 0
                        ? items.length - 1
                        : this.state.selectedIndex - 1;
                    this._selectIndex(prevIndex);
                    this._showPreviewForSelected();
                }
                break;

            case 'Enter':
                e.preventDefault();
                this._hidePreview();
                this._insertSelected();
                break;

            case 'Escape':
                e.preventDefault();
                this.close();
                break;

            case 'Tab':
                // Cycle focus between search and list
                e.preventDefault();
                if (this.state.inputFocus === 'search') {
                    this.state.inputFocus = 'list';
                    if (this.state.items.length > 0 && this.state.selectedIndex === -1) {
                        this._selectIndex(0);
                    }
                    this.listContainer.focus();
                } else {
                    this.state.inputFocus = 'search';
                    this._focusSearch();
                }
                break;
        }
    }

    /**
     * Handle clicks outside the selector (modal context)
     */
    _handleOutsideClick(e) {
        if (!this.container.contains(e.target) &&
            (!this.previewTooltip || !this.previewTooltip.contains(e.target))) {
            this.close();
        }
    }

    /**
     * Select an item by index
     */
    _selectIndex(index, updateUI = true) {
        this.state.selectedIndex = index;

        if (updateUI) {
            const items = this.listContainer.querySelectorAll('.ups-item');
            items.forEach((item, i) => {
                item.classList.toggle('selected', i === index);
                item.setAttribute('aria-selected', i === index);
            });

            // Scroll into view
            if (items[index]) {
                items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }

    /**
     * Insert the currently selected prompt
     */
    _insertSelected() {
        const prompt = this.state.items[this.state.selectedIndex];
        if (prompt) {
            this.onInsert(prompt);
        }
    }

    /**
     * Focus the search input
     */
    _focusSearch() {
        if (this.searchInput) {
            this.searchInput.focus();
            this.state.inputFocus = 'search';
        }
    }

    /**
     * Show preview tooltip for an item
     */
    _showPreview(itemElement, prompt) {
        this._hidePreview(true); // Immediate hide

        this.previewTooltip = document.createElement('div');
        this.previewTooltip.className = 'ups-preview-tooltip';

        // Truncate content for preview
        const previewContent = prompt.content.length > 500
            ? prompt.content.substring(0, 500) + '...'
            : prompt.content;

        let tagsHtml = '';
        if (prompt.tags && prompt.tags.length > 0) {
            tagsHtml = `
                <div class="ups-preview-tags">
                    ${prompt.tags.map(t => `<span class="ups-preview-tag">${this._escapeHtml(t)}</span>`).join('')}
                </div>
            `;
        }

        this.previewTooltip.innerHTML = `
            <div class="ups-preview-header">
                <strong>${this._escapeHtml(prompt.title)}</strong>
                ${prompt.isPinned ? '<span class="ups-preview-pin">📌 Pinned</span>' : ''}
            </div>
            <div class="ups-preview-content">${this._escapeHtml(previewContent)}</div>
            ${tagsHtml}
        `;

        document.body.appendChild(this.previewTooltip);
        this._positionPreview(itemElement);

        // Allow hovering on tooltip
        this.previewTooltip.addEventListener('mouseenter', () => {
            this.previewTooltip.dataset.hovered = 'true';
        });
        this.previewTooltip.addEventListener('mouseleave', () => {
            this.previewTooltip.dataset.hovered = 'false';
            this._hidePreview();
        });
    }

    /**
     * Position preview tooltip
     */
    _positionPreview(itemElement) {
        if (!this.previewTooltip) return;

        const itemRect = itemElement.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        const tooltipWidth = 320;
        const tooltipHeight = this.previewTooltip.offsetHeight || 200;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left, top;

        // Try right side first
        if (containerRect.right + tooltipWidth + 15 < viewportWidth) {
            left = containerRect.right + 10;
        }
        // Try left side
        else if (containerRect.left - tooltipWidth - 15 > 0) {
            left = containerRect.left - tooltipWidth - 10;
        }
        // Center below
        else {
            left = Math.max(10, (viewportWidth - tooltipWidth) / 2);
        }

        // Vertical positioning - align with item
        top = itemRect.top;

        // Adjust if would go off bottom
        if (top + tooltipHeight > viewportHeight - 10) {
            top = viewportHeight - tooltipHeight - 10;
        }

        // Ensure not above viewport
        if (top < 10) {
            top = 10;
        }

        this.previewTooltip.style.left = `${left}px`;
        this.previewTooltip.style.top = `${top}px`;
    }

    /**
     * Show preview for currently selected item
     */
    _showPreviewForSelected() {
        const items = this.listContainer.querySelectorAll('.ups-item');
        const selectedItem = items[this.state.selectedIndex];
        const prompt = this.state.items[this.state.selectedIndex];

        if (selectedItem && prompt) {
            this._showPreview(selectedItem, prompt);
        }
    }

    /**
     * Hide preview tooltip
     */
    _hidePreview(immediate = false) {
        if (this.hidePreviewTimer) {
            clearTimeout(this.hidePreviewTimer);
        }

        if (immediate) {
            if (this.previewTooltip) {
                this.previewTooltip.remove();
                this.previewTooltip = null;
            }
            return;
        }

        this.hidePreviewTimer = setTimeout(() => {
            if (this.previewTooltip && this.previewTooltip.dataset.hovered !== 'true') {
                this.previewTooltip.remove();
                this.previewTooltip = null;
            }
        }, 150);
    }

    /**
     * Close the selector
     */
    close() {
        this._hidePreview(true);
        document.removeEventListener('keydown', this._boundKeyHandler);
        document.removeEventListener('click', this._boundOutsideClick);
        this.onClose();
    }

    /**
     * Refresh items (after edit)
     */
    async refresh() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get_prompts' });
            if (response.success) {
                this.state.allItems = response.prompts;
                this.state.items = this._filterAndSort(response.prompts, this.state.filterQuery);
                this._renderList();
            }
        } catch (e) {
            console.error('[UnifiedSelector] Refresh error:', e);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedPromptSelector;
} else if (typeof window !== 'undefined') {
    window.UnifiedPromptSelector = UnifiedPromptSelector;
}
