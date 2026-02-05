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
const categoryCount = document.getElementById('category-count');
const usageCount = document.getElementById('usage-count');
const settingsBtn = document.getElementById('settings-btn');

// Bulk action elements
const bulkActionBar = document.getElementById('bulk-action-bar');
const selectionCount = document.getElementById('selection-count');

// Modal elements
const editModal = document.getElementById('edit-modal');
const closeModal = document.getElementById('close-modal');
const cancelEdit = document.getElementById('cancel-edit');
const saveEdit = document.getElementById('save-edit');
const editTitle = document.getElementById('edit-title');
const editContent = document.getElementById('edit-content');
const editCategory = document.getElementById('edit-category');
const editTags = document.getElementById('edit-tags');

// Variable panel elements
const variablesPanel = document.getElementById('variables-panel');
const variablesList = document.getElementById('variables-list');
const variableCount = document.getElementById('variable-count');

// State
let allPrompts = [];
let filteredPrompts = [];
let currentEditingId = null;
let currentEditingVariables = [];
let selectedIds = new Set(); // Multi-select tracking

/**
 * Initialize manager
 */
async function init() {
    await loadPrompts();
    setupEventListeners();
    setupBulkActions();
    updateCategoryFilter();
    updateStatsBadge();
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
    card.className = 'prompt-card' + (selectedIds.has(prompt.id) ? ' selected' : '');
    card.dataset.promptId = prompt.id;

    // Multi-select checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'prompt-checkbox';
    checkbox.checked = selectedIds.has(prompt.id);
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelection(prompt.id, checkbox.checked);
        card.classList.toggle('selected', checkbox.checked);
    });
    card.appendChild(checkbox);

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

    // Add structured badge if prompt has variables
    if (prompt.isStructured || (prompt.variables && prompt.variables.length > 0)) {
        const badge = document.createElement('div');
        badge.className = 'structured-badge';
        badge.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 7h6v6H4zM14 7h6v6h-6zM9 17h6v6H9z"/>
            </svg>
            ${prompt.variables.length} var${prompt.variables.length !== 1 ? 's' : ''}
        `;
        badge.title = 'Structured prompt with fillable variables';
        card.appendChild(badge);
    }

    // Double-click detection for edit (single click = insert)
    let clickTimer = null;
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking action buttons
        if (e.target.closest('.prompt-actions')) return;

        if (clickTimer) {
            // Double click detected - open edit
            clearTimeout(clickTimer);
            clickTimer = null;
            openEditModal(prompt);
        } else {
            // Wait for potential double click
            clickTimer = setTimeout(() => {
                clickTimer = null;
                insertPrompt(prompt);
            }, 300);
        }
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

    // Import button - MUST be set up here, not lazily
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', openImportModal);
        console.log('[Manager] Import button listener attached');
    }

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

    // Content change listener for variable detection
    let variableDetectionTimeout;
    editContent.addEventListener('input', () => {
        clearTimeout(variableDetectionTimeout);
        variableDetectionTimeout = setTimeout(() => {
            updateVariablesPanel(editContent.value);
        }, 300); // Debounce for performance
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
    currentEditingVariables = prompt.variables || [];

    editTitle.value = prompt.title;
    editContent.value = prompt.content;
    editCategory.value = prompt.category || '';
    editTags.value = (prompt.tags || []).join(', ');

    // Populate category suggestions from existing prompts
    populateCategorySuggestions();

    // Update variables panel
    updateVariablesPanel(prompt.content);

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
            tags: editTags.value.split(',').map(t => t.trim()).filter(Boolean),
            variables: currentEditingVariables
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
        // Check if this is a structured prompt with variables
        const isStructured = prompt.isStructured || (prompt.variables && prompt.variables.length > 0);

        if (isStructured) {
            // Send structured prompt to show variable form
            await chrome.runtime.sendMessage({
                action: 'insert_structured_prompt',
                prompt: prompt
            });
        } else {
            // Regular prompt - insert directly
            await chrome.runtime.sendMessage({
                action: 'insert_prompt',
                text: prompt.content,
                promptId: prompt.id
            });
        }
    } catch (error) {
        console.error('Error inserting prompt:', error);
    }
}

/**
 * Update variables panel based on content
 */
function updateVariablesPanel(content) {
    if (!variablesPanel || !variablesList || !variableCount) return;

    if (typeof VariableUtils === 'undefined') {
        console.warn('VariableUtils not loaded');
        return;
    }

    // Extract variables using VariableUtils, preserving existing configs
    currentEditingVariables = VariableUtils.extractVariablesForPrompt(
        content,
        currentEditingVariables
    );

    const count = currentEditingVariables.length;
    variableCount.textContent = `${count} variable${count !== 1 ? 's' : ''}`;

    if (count === 0) {
        variablesList.innerHTML = `
            <div class="no-variables">
                <span>💡</span>
                <p>Use <code>[variable_name]</code> syntax in your prompt to create fillable fields</p>
            </div>
        `;
        return;
    }

    // Render variable items
    variablesList.innerHTML = currentEditingVariables.map((variable, index) =>
        renderVariableItem(variable, index)
    ).join('');

    // Add event listeners for type changes
    variablesList.querySelectorAll('.variable-type-select').forEach((select, index) => {
        select.addEventListener('change', (e) => {
            currentEditingVariables[index].type = e.target.value;
        });
    });
}

/**
 * Render a single variable item
 */
function renderVariableItem(variable, index) {
    return `
        <div class="variable-item" data-index="${index}">
            <div class="variable-info">
                <span class="variable-name">[${variable.name}]</span>
                <span class="variable-type-badge ${variable.type}">${variable.type}</span>
            </div>
            <div class="variable-config">
                <select class="variable-type-select" data-index="${index}">
                    <option value="text" ${variable.type === 'text' ? 'selected' : ''}>Text</option>
                    <option value="options" ${variable.type === 'options' ? 'selected' : ''}>Options</option>
                    <option value="number" ${variable.type === 'number' ? 'selected' : ''}>Number</option>
                </select>
            </div>
        </div>
    `;
}

// ==========================================
// BATCH IMPORT FUNCTIONALITY
// ==========================================

// Import modal elements (lazily initialized)
let importModal, importText, importFile, fileNameSpan;
let previewBtn, startImportBtn, cancelImportBtn, closeImportBtn;
let importPreview, previewList, progressDiv, progressFill, progressText;
let statNew, statDuplicate, statCategories, previewProgress;
let optSkipDuplicates, optOverwrite, optAutoCategory, optDefaultCategory;
let pendingImportResult = null;
let fileContent = null;

/**
 * Initialize import modal elements
 */
function initImportElements() {
    if (importModal) return; // Already initialized

    importModal = document.getElementById('import-modal');
    importText = document.getElementById('import-text');
    importFile = document.getElementById('import-file');
    fileNameSpan = document.getElementById('file-name');

    previewBtn = document.getElementById('preview-import');
    startImportBtn = document.getElementById('start-import');
    cancelImportBtn = document.getElementById('cancel-import');
    closeImportBtn = document.getElementById('close-import-modal');

    importPreview = document.getElementById('import-preview');
    previewList = document.getElementById('preview-list');
    progressDiv = document.getElementById('import-progress');
    progressFill = document.getElementById('progress-fill');
    progressText = document.getElementById('progress-text');

    statNew = document.getElementById('stat-new');
    statDuplicate = document.getElementById('stat-duplicate');
    statCategories = document.getElementById('stat-categories');
    previewProgress = document.getElementById('preview-progress');

    optSkipDuplicates = document.getElementById('opt-skip-duplicates');
    optOverwrite = document.getElementById('opt-overwrite');
    optAutoCategory = document.getElementById('opt-auto-category');
    optDefaultCategory = document.getElementById('opt-default-category');

    setupImportListeners();
}

/**
 * Setup import modal event listeners
 */
function setupImportListeners() {
    // Modal open/close
    document.getElementById('import-btn')?.addEventListener('click', openImportModal);
    closeImportBtn?.addEventListener('click', closeImportModal);
    cancelImportBtn?.addEventListener('click', closeImportModal);

    // Click outside to close
    importModal?.addEventListener('click', (e) => {
        if (e.target === importModal) closeImportModal();
    });

    // Tab switching
    document.querySelectorAll('.import-tab').forEach(tab => {
        tab.addEventListener('click', () => switchImportTab(tab.dataset.tab));
    });

    // File upload
    importFile?.addEventListener('change', handleFileSelect);

    // Drag and drop
    const dropZone = document.getElementById('file-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].name.endsWith('.txt')) {
                handleFile(files[0]);
            }
        });
    }

    // Preview button
    previewBtn?.addEventListener('click', runPreview);

    // Import button
    startImportBtn?.addEventListener('click', executeImport);

    // Mutual exclusion for skip/overwrite options
    optSkipDuplicates?.addEventListener('change', () => {
        if (optSkipDuplicates.checked) {
            optOverwrite.checked = false;
        }
    });
    optOverwrite?.addEventListener('change', () => {
        if (optOverwrite.checked) {
            optSkipDuplicates.checked = false;
        }
    });
}

/**
 * Open import modal
 */
function openImportModal() {
    initImportElements();
    resetImportState();
    importModal.style.display = 'flex';
}

/**
 * Close import modal
 */
function closeImportModal() {
    if (importModal) {
        importModal.style.display = 'none';
        resetImportState();
    }
}

/**
 * Reset import state
 */
function resetImportState() {
    if (importText) importText.value = '';
    if (importFile) importFile.value = '';
    if (fileNameSpan) fileNameSpan.textContent = '';
    if (importPreview) importPreview.style.display = 'none';
    if (progressDiv) progressDiv.style.display = 'none';
    if (previewList) previewList.innerHTML = '';
    if (startImportBtn) startImportBtn.disabled = true;
    pendingImportResult = null;
    fileContent = null;
}

/**
 * Switch import tab
 */
function switchImportTab(tabName) {
    document.querySelectorAll('.import-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.import-tab-content').forEach(c => {
        c.classList.toggle('active', c.id === tabName + '-tab');
    });
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

/**
 * Handle file for import
 */
async function handleFile(file) {
    if (!file.name.endsWith('.txt')) {
        alert('请选择 .txt 文件');
        return;
    }

    fileNameSpan.textContent = file.name;

    try {
        fileContent = await BatchImporter.parseFile(file);
    } catch (error) {
        console.error('File read error:', error);
        alert('文件读取失败');
    }
}

/**
 * Get import text from current tab
 */
function getImportText() {
    const pasteTab = document.getElementById('paste-tab');
    if (pasteTab?.classList.contains('active')) {
        return importText?.value || '';
    } else {
        return fileContent || '';
    }
}

/**
 * Run preview processing
 */
async function runPreview() {
    const text = getImportText();
    if (!text.trim()) {
        alert('请输入或上传要导入的内容');
        return;
    }

    // Show progress
    progressDiv.style.display = 'block';
    importPreview.style.display = 'block';
    startImportBtn.disabled = true;
    progressFill.style.width = '0%';
    progressText.textContent = '正在分析...';

    const options = {
        skipDuplicates: optSkipDuplicates?.checked ?? true,
        overwriteDuplicates: optOverwrite?.checked ?? false,
        defaultCategory: optDefaultCategory?.value || '默认分类',
        autoExtractCategory: optAutoCategory?.checked ?? true,
        onProgress: (current, total) => {
            const pct = Math.round((current / total) * 100);
            progressFill.style.width = pct + '%';
            progressText.textContent = `正在处理 ${current}/${total} 条...`;
            previewProgress.textContent = `(${current}/${total})`;
        },
        onPreviewUpdate: (preview) => {
            updatePreviewUI(preview);
        }
    };

    try {
        pendingImportResult = await BatchImporter.processText(text, options);

        if (pendingImportResult.success) {
            progressText.textContent = '分析完成';
            startImportBtn.disabled = pendingImportResult.prompts.length === 0;

            // Final stats update
            statNew.textContent = pendingImportResult.stats.new;
            statDuplicate.textContent = pendingImportResult.stats.duplicateCount;
            statCategories.textContent = pendingImportResult.newCategories.length;

            // Show sample in preview
            renderPreviewItems(pendingImportResult.prompts.slice(0, 10), pendingImportResult.duplicates);
        } else {
            progressText.textContent = '分析失败: ' + pendingImportResult.error;
        }
    } catch (error) {
        console.error('Preview error:', error);
        progressText.textContent = '分析出错';
    }
}

/**
 * Update preview UI during processing
 */
function updatePreviewUI(preview) {
    statNew.textContent = preview.newCount;
    statDuplicate.textContent = preview.duplicateCount;
    statCategories.textContent = preview.newCategories.length;
}

/**
 * Render preview items
 */
function renderPreviewItems(prompts, duplicates) {
    const duplicateContents = new Set(duplicates.map(d => d.content.toLowerCase()));

    previewList.innerHTML = prompts.map(p => `
        <div class="preview-item ${duplicateContents.has(p.content.toLowerCase()) ? 'duplicate' : ''}">
            <span class="preview-category">${escapeHtml(p.category)}</span>
            <span class="preview-content">${escapeHtml(p.title)}</span>
        </div>
    `).join('');

    if (prompts.length > 10) {
        previewList.innerHTML += `<div style="text-align: center; color: #6b7280; font-size: 12px; padding: 8px;">
            ... 还有 ${prompts.length - 10} 条
        </div>`;
    }
}

/**
 * Execute the import
 */
async function executeImport() {
    if (!pendingImportResult || !pendingImportResult.success) {
        alert('请先预览导入内容');
        return;
    }

    if (pendingImportResult.prompts.length === 0) {
        alert('没有可导入的内容');
        return;
    }

    startImportBtn.disabled = true;
    startImportBtn.textContent = '导入中...';
    progressText.textContent = '正在保存...';

    try {
        const result = await BatchImporter.commitToStorage(pendingImportResult.prompts, {
            overwriteDuplicates: optOverwrite?.checked ?? false
        });

        if (result.success) {
            const summary = `✅ 导入完成\n· 成功导入: ${result.added} 条提示词\n· 跳过重复: ${pendingImportResult.stats.duplicateCount} 条\n· 新分类: ${pendingImportResult.newCategories.length} 个`;
            alert(summary);

            closeImportModal();
            await loadPrompts(); // Refresh the grid
            updateCategoryFilter(); // Update category dropdown
            updateStatsBadge();
        } else {
            alert('导入失败: ' + result.error);
        }
    } catch (error) {
        console.error('Import error:', error);
        alert('导入出错');
    } finally {
        startImportBtn.textContent = '开始导入';
        startImportBtn.disabled = false;
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

// ==========================================
// STATISTICS & MULTI-SELECT FUNCTIONS
// ==========================================

/**
 * Update statistics badge in header
 */
function updateStatsBadge() {
    const categories = new Set(allPrompts.map(p => p.category || 'Uncategorized'));
    const totalUses = allPrompts.reduce((sum, p) => sum + (p.usageCount || 0), 0);

    if (promptCount) promptCount.textContent = `${allPrompts.length} prompts`;
    if (categoryCount) categoryCount.textContent = `${categories.size} categories`;
    if (usageCount) usageCount.textContent = `${totalUses} uses`;
}

/**
 * Toggle prompt selection for multi-select
 */
function toggleSelection(promptId, selected) {
    if (selected) {
        selectedIds.add(promptId);
    } else {
        selectedIds.delete(promptId);
    }
    updateBulkActionBar();
}

/**
 * Update bulk action bar visibility
 */
function updateBulkActionBar() {
    if (selectedIds.size > 0) {
        bulkActionBar.style.display = 'flex';
        selectionCount.textContent = `${selectedIds.size} selected`;
    } else {
        bulkActionBar.style.display = 'none';
    }
}

/**
 * Setup bulk action handlers
 */
function setupBulkActions() {
    const bulkMove = document.getElementById('bulk-move');
    const bulkDelete = document.getElementById('bulk-delete');
    const bulkExport = document.getElementById('bulk-export');
    const bulkClear = document.getElementById('bulk-clear');

    bulkClear?.addEventListener('click', () => {
        selectedIds.clear();
        updateBulkActionBar();
        renderPrompts();
    });

    bulkDelete?.addEventListener('click', async () => {
        if (selectedIds.size === 0) return;

        const confirm = window.confirm(`确定删除 ${selectedIds.size} 个提示词吗？此操作不可撤销。`);
        if (!confirm) return;

        try {
            for (const id of selectedIds) {
                await Storage.deletePrompt(id);
            }
            selectedIds.clear();
            await loadPrompts();
            updateStatsBadge();
        } catch (error) {
            console.error('Bulk delete error:', error);
            alert('删除失败');
        }
    });

    bulkExport?.addEventListener('click', () => {
        if (selectedIds.size === 0) return;

        const selected = allPrompts.filter(p => selectedIds.has(p.id));
        const json = JSON.stringify(selected, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `promptpal_export_${selectedIds.size}_items.json`;
        a.click();

        URL.revokeObjectURL(url);
    });

    bulkMove?.addEventListener('click', () => {
        if (selectedIds.size === 0) return;

        const category = prompt('输入目标分类名称：', '默认分类');
        if (!category) return;

        moveBulkToCategory(category);
    });
}

/**
 * Move selected prompts to a category
 */
async function moveBulkToCategory(category) {
    try {
        for (const id of selectedIds) {
            await Storage.updatePrompt(id, { category });
        }
        selectedIds.clear();
        await loadPrompts();
        updateCategoryFilter();
        updateStatsBadge();
        alert(`已移动到分类: ${category}`);
    } catch (error) {
        console.error('Bulk move error:', error);
        alert('移动失败');
    }
}

/**
 * Populate category suggestions datalist
 */
function populateCategorySuggestions() {
    const datalist = document.getElementById('category-suggestions');
    if (!datalist) return;

    const categories = new Set(allPrompts.map(p => p.category).filter(Boolean));

    datalist.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        datalist.appendChild(option);
    });
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
