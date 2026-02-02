# PromptPal Product Requirements Document (PRD)

**Version:** 1.0.0  
**Date:** February 2, 2026  
**Author:** Product Team  
**Status:** ✅ Complete (v1.0 Launch Ready)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Feature Specifications](#2-feature-specifications)
3. [User Experience](#3-user-experience)
4. [Technical Architecture](#4-technical-architecture)
5. [Release Plan](#5-release-plan)
6. [Future Roadmap](#6-future-roadmap)
7. [Appendices](#7-appendices)

---

## 1. Product Overview

### 1.1 Vision Statement

**PromptPal empowers everyday AI users to get more value from AI assistants by making prompt reuse effortless.** We believe the biggest barrier to AI productivity isn't the AI itself—it's the friction of finding, remembering, and typing the same prompts repeatedly.

### 1.2 Problem Statement

| Pain Point | User Impact | Current Workarounds |
|:---|:---|:---|
| Prompt forgetting | Users spend time re-crafting prompts they've used before | Manual text files, notes apps |
| Copy-paste friction | Context switching breaks flow, especially across tabs | Browser tabs, clipboard managers |
| No organization | Valuable prompts get lost in chat histories | Screenshots, bookmarks |
| Platform fragmentation | Different AI tools require separate workflows | Remembering per-platform |

### 1.3 Solution Summary

PromptPal is a Chrome extension that provides:

1. **Universal Save** — Capture prompts from any webpage with right-click or `Alt+S`
2. **Instant Insert** — Press `Alt+P` on any AI chat to inject saved prompts
3. **Smart Organization** — Categories, tags, pinning, and search
4. **Zero Friction** — No accounts, no cloud, works immediately

### 1.4 Target User Personas

#### Persona 1: The Beginner (Primary Target)

| Attribute | Description |
|:---|:---|
| **Profile** | New to AI, uses ChatGPT 2-3x/week for writing help |
| **Goal** | Get better results without learning "prompt engineering" |
| **Pain** | Forgets what worked, intimidated by complex prompts |
| **Value from PromptPal** | Saves working prompts, reuses with one click |

#### Persona 2: The Power User (Secondary Target)

| Attribute | Description |
|:---|:---|
| **Profile** | Uses AI daily for coding, writing, analysis |
| **Goal** | Maximum efficiency, consistent quality |
| **Pain** | Maintains prompts in text files, constant copy-paste |
| **Value from PromptPal** | Keyboard shortcuts, categories, usage tracking |

#### Persona 3: The Researcher (Tertiary Target)

| Attribute | Description |
|:---|:---|
| **Profile** | Explores multiple AI platforms, tests prompt variations |
| **Goal** | Compare AI responses, iterate on prompts |
| **Pain** | Needs same prompt across ChatGPT, Claude, Gemini |
| **Value from PromptPal** | Universal insertion, works on all AI sites |

### 1.5 Success Metrics

| Metric | Target (90 days post-launch) | Measurement Method |
|:---|:---|:---|
| Active Installs | 5,000+ | Chrome Web Store |
| Daily Active Users | 20%+ of installs | <!-- [ANALYTICS_PLACEHOLDER] --> |
| Avg. Prompts Saved | 10+ per user | Storage telemetry (opt-in) |
| Avg. Insertions/Day | 3+ per active user | Usage tracking |
| Chrome Store Rating | 4.5+ stars | Chrome Web Store |
| Uninstall Rate | <30% (30 days) | Chrome Web Store |

---

## 2. Feature Specifications

### 2.1 Save Prompts

#### 2.1.1 Right-Click Context Menu

**User Flow:**
1. User selects text on any webpage
2. Right-clicks to open browser context menu
3. Clicks "Save to Prompt Library"
4. (If Detailed Mode) Save modal appears with fields
5. System confirms save with toast notification

**Technical Implementation:**
```javascript
// manifest.json
"permissions": ["contextMenus", "storage", "activeTab"]

// background.js - Menu creation
chrome.contextMenus.create({
    id: 'save_selection',
    title: chrome.i18n.getMessage('context_menu_save'),
    contexts: ['selection']
});
```

**Edge Cases:**
| Scenario | Behavior |
|:---|:---|
| Empty selection | Toast: "Please select some text first" |
| Very long text (>10,000 chars) | Save allowed, title truncates to 50 chars |
| Special characters | Full Unicode support, escaped for display |
| Protected pages (chrome://, PDFs) | Context menu hidden, no action |

#### 2.1.2 Keyboard Shortcut (Alt+S)

**User Flow:**
1. User selects text on any webpage
2. Presses `Alt+S`
3. Based on save mode setting:
   - **Quick Mode**: Saves immediately, shows toast
   - **Detailed Mode**: Opens popup with pre-filled content

**Technical Implementation:**
```javascript
// manifest.json
"commands": {
    "save_selection": {
        "suggested_key": { "default": "Alt+S" },
        "description": "Quick save selected text"
    }
}

// background.js
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'save_selection') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // Get selection via content script
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'get_selection' });
        // Save based on mode
    }
});
```

#### 2.1.3 Popup Quick Save

**User Flow:**
1. User clicks PromptPal icon in toolbar
2. Types/pastes prompt in text area
3. Clicks "Save" button
4. Toast confirmation shown

### 2.2 Insert Prompts

#### 2.2.1 Floating Prompt Selector (Alt+P)

**User Flow:**
1. User focuses an input field on any AI chat
2. Presses `Alt+P`
3. Floating selector appears near input with:
   - Pinned prompts (📌)
   - Recent prompts (by lastUsed)
4. User navigates with ↑↓ keys or clicks
5. Selected prompt inserts into input
6. Selector closes, input is focused

**Technical Implementation:**
```javascript
// content_script.js - Input Detection Strategy
function detectFocusedInput() {
    // Strategy 1: Standard focus
    // Strategy 2: Site-specific selectors (ChatGPT, Claude, Gemini)
    // Strategy 3: ContentEditable search
    // Strategy 4: ARIA role="textbox"
    // Strategy 5: Iframe inspection
}

// Site-specific selectors
const siteSelectors = {
    'gemini.google.com': ['textarea[aria-label*="Enter a prompt"]', '.ql-editor'],
    'chat.openai.com': ['#prompt-textarea', 'div[contenteditable="true"]'],
    'claude.ai': ['div[contenteditable="true"]', '[role="textbox"]']
};
```

**Supported Input Types:**
| Input Type | Detection Method | Insertion Method |
|:---|:---|:---|
| `<textarea>` | `tagName === 'TEXTAREA'` | `.value` + cursor position |
| `<input type="text">` | `tagName === 'INPUT'` | `.value` + cursor position |
| ContentEditable | `isContentEditable === true` | `Range.insertNode()` |
| ARIA textbox | `role="textbox"` | `Range.insertNode()` |
| Quill/ProseMirror | Site-specific selectors | Custom event dispatch |

**Edge Cases:**
| Scenario | Behavior |
|:---|:---|
| No input focused | Toast: "Please focus an input field first" |
| No saved prompts | Toast: "No prompts saved yet" |
| Read-only input | Insertion fails silently |
| React/Vue inputs | Dispatch `input` + `change` events for reactivity |

### 2.3 Manage Prompts

#### 2.3.1 Manager Interface

**Access Points:**
- Popup → "View All Prompts" link
- Context menu → "Manage Prompt Library"
- Opens as full-page tab: `popup/manager.html`

**Features:**
| Feature | Description | Status |
|:---|:---|:---|
| Search | Full-text search (title + content) | ✅ Complete |
| Filter by category | Dropdown filter | ✅ Complete |
| Sort | By date, usage count, title | ✅ Complete |
| Edit | Inline editing of title, content, category, tags | ✅ Complete |
| Delete | With confirmation modal | ✅ Complete |
| Pin/Unpin | Toggle pinned status | ✅ Complete |
| Bulk operations | Multi-select delete | 📅 Planned v1.1 |

### 2.4 Data Models

#### 2.4.1 Prompt Object

```typescript
interface Prompt {
    id: string;              // Unique: "{timestamp}_{random9chars}"
    title: string;           // User-defined or auto-generated (first 50 chars)
    content: string;         // Full prompt text
    category: string;        // "Writing" | "Coding" | "Analysis" | "Marketing" | "Uncategorized"
    tags: string[];          // User-defined tags
    autoTags: string[];      // AI-generated tags (Premium)
    autoCategory: string;    // AI-suggested category (Premium)
    isPinned: boolean;       // Pinned to top
    lastUsed: number;        // Unix timestamp of last insertion
    usageCount: number;      // Total times inserted
    createdAt: number;       // Unix timestamp
    sourceUrl: string;       // URL where prompt was captured
}
```

#### 2.4.2 Settings Object

```typescript
interface Settings {
    language: 'auto' | 'en' | 'zh_CN';
    saveMode: 'quick' | 'detailed';
    defaultCategory: string;
    theme: 'auto' | 'light' | 'dark';
    shortcutConflictResolved: boolean;
    autoTaggingUsed: number;  // 0-3 trial count
}
```

#### 2.4.3 Premium Object (Future)

```typescript
interface Premium {
    activated: boolean;
    licenseKey: string;
    expiresAt: number | null;
    features: string[];
    lastModalDismissed: number | null;
}
```

### 2.5 Settings

| Setting | Options | Default | Description |
|:---|:---|:---|:---|
| Save Mode | Quick / Detailed | Quick | Whether to show confirmation dialog |
| Language | Auto / English / 中文 | Auto | Interface language |
| Theme | Auto / Light / Dark | Auto | Visual theme (follows system) |

### 2.6 Import/Export

**Export Format:**
```json
{
    "version": "1.0.0",
    "exportDate": "2026-02-02T09:51:13.000Z",
    "prompts": [...],
    "settings": {...}
}
```

**Import Behavior:**
- Merge mode (default): Adds new prompts, skips duplicates by ID
- Replace mode: Overwrites all data (with confirmation)

---

## 3. User Experience

### 3.1 Performance Requirements

| Metric | Target | Measurement |
|:---|:---|:---|
| Popup open time | <200ms | Time to interactive |
| Floating UI appear | <100ms | From Alt+P to visible |
| Prompt insertion | <50ms | From click to inserted |
| Search response | <100ms | For 1000+ prompts |
| Memory footprint | <10MB | Total extension memory |

### 3.2 Accessibility Compliance

| Requirement | Implementation | Status |
|:---|:---|:---|
| Keyboard navigation | All features accessible via keyboard | ✅ Complete |
| Focus indicators | Visible focus states on all interactive elements | ✅ Complete |
| Color contrast | WCAG 2.1 AA compliant (4.5:1 minimum) | ✅ Complete |
| Screen reader | ARIA labels on buttons, tooltips via title | ✅ Complete |
| Reduced motion | Respects `prefers-reduced-motion` | 📅 Planned v1.1 |

### 3.3 Error States and Recovery

| Error | User Message | Recovery Action |
|:---|:---|:---|
| No selection | "Please select some text first" | Auto-dismiss toast |
| Storage full | "Storage limit reached. Delete some prompts." | Link to manager |
| Insert failed | "Could not insert prompt" | Offer copy to clipboard |
| Import invalid | "Invalid import file" | Toast with details |
| Content script blocked | "Cannot access this page" | Explain protected pages |

### 3.4 Onboarding Flow

**Trigger:** First install (`chrome.runtime.onInstalled` with `reason === 'install'`)

**Steps:**
1. Open `onboarding/onboarding.html` in new tab
2. 3-step tutorial:
   - Step 1: Save prompts (visual demo)
   - Step 2: Insert prompts (Alt+P demo)
   - Step 3: Manage library (manager preview)
3. "Got It!" button closes onboarding
4. 5 sample prompts pre-loaded for immediate value

**Sample Prompts:**
- Professional Email Template (Writing)
- Code Review Request (Coding)
- Meeting Summary Generator (Productivity)
- Content Brainstorm (Writing)
- Debug Assistant (Coding)

---

## 4. Technical Architecture

### 4.1 File Structure

```
promptpal/
├── manifest.json           # Manifest V3 configuration
├── background.js           # Service worker (543 lines)
├── content_script.js       # Page injection (751 lines)
│
├── _locales/
│   ├── en/messages.json    # English strings (292 messages)
│   └── zh_CN/messages.json # Chinese strings
│
├── popup/
│   ├── popup.html          # Main popup (400x500px)
│   ├── popup.css           # Popup styles
│   ├── popup.js            # Popup logic
│   ├── manager.html        # Full-page manager
│   ├── manager.css         # Manager styles
│   └── manager.js          # Manager logic
│
├── settings/
│   ├── settings.html       # Settings page
│   ├── settings.css        # Settings styles
│   └── settings.js         # Settings logic
│
├── onboarding/
│   ├── onboarding.html     # First-run experience
│   ├── onboarding.css
│   └── onboarding.js
│
├── lib/
│   ├── storage.js          # Chrome storage abstraction
│   ├── i18n.js             # Internationalization helpers
│   ├── insertion_engine.js # Smart input detection
│   ├── help_system.js      # Contextual help tooltips
│   └── shortcuts.js        # Keyboard handling
│
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### 4.2 Storage Strategy

**Storage API:** `chrome.storage.local`

| Consideration | Decision | Rationale |
|:---|:---|:---|
| `local` vs `sync` | `local` | Higher quota (5MB vs 100KB), no account required |
| Data structure | Single `prompts` array | Simple CRUD, no indexing needed |
| Sync (future) | Premium feature | Requires account infrastructure |

**Storage Quota:**
- `chrome.storage.local.QUOTA_BYTES`: 5,242,880 bytes (5MB)
- Estimated prompt size: ~500 bytes average
- Capacity: ~10,000 prompts

### 4.3 Content Script Strategy

**Injection:** Declared in manifest (all URLs)

```json
"content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["lib/insertion_engine.js", "content_script.js"],
    "run_at": "document_idle"
}]
```

**Dynamic Injection:** For pages where content script fails

```javascript
await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content_script.js']
});
```

### 4.4 Browser Compatibility

| Browser | Version | Manifest V3 | Status |
|:---|:---|:---|:---|
| Chrome | 88+ | ✅ Required | ✅ Primary |
| Edge | 88+ | ✅ Supported | ✅ Tested |
| Brave | Latest | ✅ Supported | ✅ Tested |
| Opera | Latest | ✅ Supported | ⚠️ Untested |
| Firefox | — | ❌ Not compatible | 📅 v1.2 (MV2 port) |
| Safari | — | ❌ Not compatible | ❌ Not planned |

### 4.5 Security & Privacy

| Concern | Mitigation |
|:---|:---|
| Data storage | 100% local, never transmitted |
| Permissions | Minimal required (`storage`, `contextMenus`, `activeTab`) |
| Host permissions | `<all_urls>` required for universal insertion |
| XSS | All user content escaped with `textContent` |
| Content script isolation | Runs in isolated world, no page variable access |

**Privacy Policy Highlights:**
- No data collection
- No analytics (v1.0)
- No external requests
- Export provides full data ownership

---

## 5. Release Plan

### 5.1 v1.0 Launch Checklist

| Item | Owner | Status |
|:---|:---|:---|
| Feature freeze | Engineering | ✅ Complete |
| QA testing (manual) | QA | ✅ Complete |
| Cross-browser testing (Chrome, Edge, Brave) | QA | ✅ Complete |
| Localization review (EN, ZH) | i18n | ✅ Complete |
| Privacy policy | Legal | ✅ Complete |
| Chrome Web Store listing assets | Design | 🚧 In Progress |
| README documentation | Product | ✅ Complete |
| PR review and merge | Engineering | ✅ Complete |

**Chrome Web Store Assets Needed:**
- [ ] Screenshots (5): Popup, Manager, Insert UI, Settings, Onboarding
- [ ] Promotional tile (1400x560)
- [ ] Icon (128x128 PNG)
- [ ] Short description (≤132 chars)
- [ ] Full description (≤16,000 chars)

### 5.2 Go-to-Market Strategy

**Phase 1: Soft Launch (Week 1-2)**
- Publish to Chrome Web Store (unlisted)
- Invite 50 beta testers
- Collect feedback via Google Form
- Fix critical bugs

**Phase 2: Public Launch (Week 3-4)**
- List publicly on Chrome Web Store
- Post on:
  - Product Hunt
  - r/ChatGPT, r/ClaudeAI, r/LocalLLaMA
  - Hacker News (Show HN)
  - Twitter/X
- Reach out to AI productivity bloggers

**Phase 3: Growth (Month 2+)**
- SEO optimization for store listing
- YouTube demo video
- Respond to all Chrome Web Store reviews
- Iterate based on user feedback

### 5.3 User Acquisition Channels

| Channel | Effort | Expected Impact |
|:---|:---|:---|
| Chrome Web Store SEO | Low | Medium (organic discovery) |
| Product Hunt launch | Medium | High (initial spike) |
| Reddit communities | Low | Medium (targeted users) |
| YouTube tutorial | High | Medium-High (evergreen) |
| Twitter/X | Low | Low-Medium |
| Blog partnerships | Medium | Medium |

### 5.4 Feedback Collection

| Method | Purpose |
|:---|:---|
| Chrome Web Store reviews | Public feedback, rating |
| In-app feedback button | Direct user issues |
| GitHub Issues | Technical bugs, feature requests |
| Email support | Complex issues |
| <!-- User surveys --> | Quarterly NPS measurement |

---

## 6. Future Roadmap

### 6.1 Version Planning

#### v1.1 (Q2 2026) — Enhanced Organization
| Feature | Priority | Effort |
|:---|:---|:---|
| Prompt templates with variables (`{{name}}`) | High | Medium |
| Bulk delete/export | Medium | Low |
| Folder organization | Medium | Medium |
| Usage analytics dashboard | Low | Medium |
| `prefers-reduced-motion` support | Low | Low |

#### v1.2 (Q3 2026) — Cross-Platform
| Feature | Priority | Effort |
|:---|:---|:---|
| Firefox port (Manifest V2) | High | High |
| Prompt sharing via URL | Medium | Medium |
| Community prompt library (browse-only) | Medium | High |
| Dark mode toggle in extension | Low | Low |

#### v1.3 (Q4 2026) — Smart Features
| Feature | Priority | Effort |
|:---|:---|:---|
| AI auto-tagging (Premium trial: 3 free) | High | High |
| AI auto-categorization | High | Medium |
| Prompt versioning | Medium | Medium |
| Related prompts suggestions | Low | High |

#### v2.0 (2027) — Premium & Sync
| Feature | Priority | Effort |
|:---|:---|:---|
| Account system | High | High |
| Cross-device sync (Premium) | High | High |
| Cloud backup (Premium) | High | Medium |
| Team sharing (Premium) | Medium | High |

### 6.2 Prioritization Framework

**ICE Scoring:**
- **Impact**: How much will this move metrics? (1-10)
- **Confidence**: How sure are we? (1-10)
- **Ease**: How easy to implement? (1-10)
- **Score** = (Impact × Confidence × Ease) / 1000

### 6.3 Technical Debt Considerations

| Debt Item | Description | Priority |
|:---|:---|:---|
| StorageHelper duplication | `background.js` duplicates `storage.js` logic | Medium |
| Inline styles in content script | Move to external CSS file | Low |
| No automated tests | Add Jest for unit tests | High |
| No E2E tests | Add Playwright for extension testing | High |

### 6.4 Scaling Considerations

| Scenario | Challenge | Solution |
|:---|:---|:---|
| 10,000+ prompts | Search becomes slow | Implement search indexing |
| Cloud sync | Data conflicts | Last-write-wins with conflict UI |
| Multi-language | Growing string count | Crowdsourced translations |
| Premium features | Payment processing | Gumroad/Paddle integration |

---

## 7. Appendices

### 7.1 Competitor Analysis

| Competitor | Strengths | Weaknesses | PromptPal Differentiator |
|:---|:---|:---|:---|
| **PromptGenius** | Large community library | Requires account, complex UI | Simpler, no account needed |
| **AIPRM** | Deep ChatGPT integration | ChatGPT only, heavy | Universal, lightweight |
| **PromptBox** | Beautiful UI | Cloud-only, subscription | Free, local-first |
| **Text Blaze** | Powerful templates | Expensive, overkill for prompts | Purpose-built for AI |
| **Browser History** | Free, built-in | No organization, search is poor | Smart organization |

### 7.2 Chrome Extension API Reference

| API | Usage | Documentation |
|:---|:---|:---|
| `chrome.storage.local` | Data persistence | [Storage API](https://developer.chrome.com/docs/extensions/reference/storage/) |
| `chrome.contextMenus` | Right-click save | [Context Menus API](https://developer.chrome.com/docs/extensions/reference/contextMenus/) |
| `chrome.commands` | Keyboard shortcuts | [Commands API](https://developer.chrome.com/docs/extensions/reference/commands/) |
| `chrome.tabs` | Tab communication | [Tabs API](https://developer.chrome.com/docs/extensions/reference/tabs/) |
| `chrome.scripting` | Dynamic injection | [Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/) |
| `chrome.notifications` | Toast messages | [Notifications API](https://developer.chrome.com/docs/extensions/reference/notifications/) |
| `chrome.i18n` | Localization | [i18n API](https://developer.chrome.com/docs/extensions/reference/i18n/) |

### 7.3 Technical Decisions Log

| Date | Decision | Rationale | Alternatives Considered |
|:---|:---|:---|:---|
| 2025-11 | Manifest V3 | Chrome requirement, better performance | MV2 (deprecated) |
| 2025-11 | Local storage only (v1) | No backend needed, privacy-first | Firebase, Supabase |
| 2025-12 | Multi-strategy input detection | AI sites use varied implementations | Single selector approach |
| 2026-01 | Sample prompts on install | Immediate value demonstration | Empty state only |
| 2026-01 | Quick save as default | Reduce friction for beginners | Detailed save as default |

### 7.4 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|:---|:---|:---|:---|
| Chrome Web Store rejection | Medium | High | Follow all policies, minimal permissions |
| AI site layout changes break insertion | High | Medium | Multi-strategy detection, quick patches |
| Low adoption | Medium | High | Focus on core value, iterate on feedback |
| Competitor copies features | Medium | Low | Speed of iteration, user relationship |
| Storage quota exhaustion | Low | Medium | Warn users at 80%, offer export |

### 7.5 Glossary

| Term | Definition |
|:---|:---|
| **Prompt** | Text input given to an AI assistant to generate a response |
| **Insertion** | Act of placing a saved prompt into an input field |
| **Floating UI** | Overlay interface that appears on `Alt+P` |
| **Content Script** | JavaScript that runs in the context of web pages |
| **Service Worker** | Background script that handles events |
| **Manifest V3** | Latest Chrome extension platform specification |

---

**Document History**

| Version | Date | Author | Changes |
|:---|:---|:---|:---|
| 1.0.0 | 2026-02-02 | Product Team | Initial v1.0 launch document |

---

*This document is maintained in the project repository. For questions, contact the Product team.*
