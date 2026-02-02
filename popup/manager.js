// Manager page logic for PromptPal
// Full library view with search, filter, edit, and delete

console.log('PromptPal manager page loaded');

// DOM elements
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const categoryFilter = document.getElementById('category-filter');
const promptsGrid = document.getElementById('prompts-grid');
const emptyState = document.getElementById('empty-state');
const promptCount = document.getElementById('prompt-count');
const settingsBtn = document.getElementById('settings-btn');

// Modal elements
const editModal = document.getElementById('edit-modal');
const closeModal = document.getElementById('close-modal');
const cancelEdit = document.getElementById('cancel-edit');
const saveEdit = document.getElementById('save-edit');
const editTitle = document.getElementById('edit-title');
const editContent = document.getElementById('edit-content');
const editCategory = document.getElementById('edit-category');
const editTags = document.getElementById('edit-tags');

// State
let allPrompts = [];
let filteredPrompts = [];
let currentEditingId = null;

/**
 * Initialize manager
 */
async function init() {
    await loadPrompts();
    setupEventListeners();
    updateCategoryFilter();
}

/**
 * Load prompts from storage
 */
async function loadPrompts() {
    try {
        allPrompts = await Storage.getAllPrompts();
        applyFilters();
    } catch (error) {
        console.error('Error loading prompts:', error);
    }
}

/**
 * Apply filters and sorting
 */
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const category = categoryFilter.value;
    const sortBy = sortSelect.value;

    // Filter
    filteredPrompts = allPrompts.filter(prompt => {
        const matchesSearch = !searchTerm ||
            prompt.title.toLowerCase().includes(searchTerm) ||
            prompt.content.toLowerCase().includes(searchTerm);

        const matchesCategory = category === 'all' || prompt.category === category;

        return matchesSearch && matchesCategory;
    });

    // Sort
    switch (sortBy) {
        case 'recent':
            filteredPrompts.sort((a, b) => b.lastUsed - a.lastUsed);
            break;
        case 'usage':
            filteredPrompts.sort((a, b) => b.usageCount - a.usageCount);
            break;
        case 'title':
            filteredPrompts.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }

    renderPrompts();
}

/**
 * Render prompts grid
 */
function renderPrompts() {
    promptsGrid.innerHTML = '';

    // Update count
    promptCount.textContent = `${filteredPrompts.length} prompt${filteredPrompts.length !== 1 ? 's' : ''}`;

    if (filteredPrompts.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    filteredPrompts.forEach(prompt => {
        const card = createPromptCard(prompt);
        promptsGrid.appendChild(card);
    });
}

/**
 * Create prompt card element
 */
function createPromptCard(prompt) {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.promptId = prompt.id;

    // Header with actions
    const header = document.createElement('div');
    header.className = 'prompt-header';

    const title = document.createElement('div');
    title.className = 'prompt-title';
    title.textContent = prompt.title;

    const actions = document.createElement('div');
    actions.className = 'prompt-actions';

    // Pin button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'action-btn' + (prompt.isPinned ? ' pinned' : '');
    pinBtn.textContent = prompt.isPinned ? '📌' : '📍';
    pinBtn.title = prompt.isPinned ? I18n.getMessage('unpin_prompt') : I18n.getMessage('pin_prompt');
    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePin(prompt.id);
    });

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.textContent = '✏️';
    editBtn.title = I18n.getMessage('edit_prompt');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(prompt);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = I18n.getMessage('delete_prompt');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePrompt(prompt.id);
    });

    actions.appendChild(pinBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(title);
    header.appendChild(actions);

    // Content
    const content = document.createElement('div');
    content.className = 'prompt-content';
    content.textContent = prompt.content;

    // Meta
    const meta = document.createElement('div');
    meta.className = 'prompt-meta';

    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'prompt-category';
    categoryBadge.textContent = prompt.category || 'Uncategorized';

    const usageInfo = document.createElement('span');
    usageInfo.className = 'prompt-usage';
    usageInfo.textContent = `📊 ${prompt.usageCount || 0} uses`;

    meta.appendChild(categoryBadge);
    meta.appendChild(usageInfo);

    // Assemble card
    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(meta);

    // Click to insert
    card.addEventListener('click', () => {
        insertPrompt(prompt);
    });

    return card;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    searchInput.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    categoryFilter.addEventListener('change', applyFilters);

    settingsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
    });

    // Modal controls
    closeModal.addEventListener('click', closeEditModal);
    cancelEdit.addEventListener('click', closeEditModal);
    saveEdit.addEventListener('click', saveEditedPrompt);

    // Click outside modal to close
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

    // Help button
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (window.HelpSystem) {
                HelpSystem.show('manager');
            }
        });
    }
}

/**
 * Update category filter dropdown
 */
function updateCategoryFilter() {
    const categories = new Set(['all']);
    allPrompts.forEach(p => {
        if (p.category) categories.add(p.category);
    });

    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    Array.from(categories).sort().forEach(cat => {
        if (cat !== 'all') {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        }
    });
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

/**
 * Open edit modal
 */
function openEditModal(prompt) {
    currentEditingId = prompt.id;
    editTitle.value = prompt.title;
    editContent.value = prompt.content;
    editCategory.value = prompt.category || '';
    editTags.value = (prompt.tags || []).join(', ');

    editModal.style.display = 'flex';
}

/**
 * Close edit modal
 */
function closeEditModal() {
    editModal.style.display = 'none';
    currentEditingId = null;
}

/**
 * Save edited prompt
 */
async function saveEditedPrompt() {
    if (!currentEditingId) return;

    try {
        const updates = {
            title: editTitle.value.trim(),
            content: editContent.value.trim(),
            category: editCategory.value.trim() || 'Uncategorized',
            tags: editTags.value.split(',').map(t => t.trim()).filter(Boolean)
        };

        await Storage.updatePrompt(currentEditingId, updates);
        await loadPrompts();
        closeEditModal();
    } catch (error) {
        console.error('Error saving prompt:', error);
        alert('Error saving prompt');
    }
}

/**
 * Delete prompt
 */
async function deletePrompt(promptId) {
    const confirmMsg = I18n.getMessage('clear_confirm_message') || 'Delete this prompt?';

    if (!confirm(confirmMsg)) return;

    try {
        await Storage.deletePrompt(promptId);
        await loadPrompts();
    } catch (error) {
        console.error('Error deleting prompt:', error);
    }
}

/**
 * Insert prompt into active tab
 */
async function insertPrompt(prompt) {
    try {
        await chrome.runtime.sendMessage({
            action: 'insert_prompt',
            text: prompt.content,
            promptId: prompt.id
        });
    } catch (error) {
        console.error('Error inserting prompt:', error);
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
