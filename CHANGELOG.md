# Changelog

All notable changes to PromptPal will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-02-02

### 🎉 Initial Release

PromptPal is officially launched! Save and reuse your AI prompts across ChatGPT, Claude, Gemini, and more.

### Added

#### Core Features
- **Right-click Save** — Select any text on a webpage, right-click → "Save to Prompt Library"
- **Alt+S Quick Save** — Keyboard shortcut for instant prompt saving
- **Alt+P Quick Insert** — Open floating prompt picker on any AI chat
- **Smart Input Detection** — Works with textareas, contenteditable, and custom inputs

#### Prompt Management
- **Full Library Manager** — View, edit, delete, and organize all prompts
- **Categories** — Organize prompts by Writing, Coding, Analysis, Marketing, or custom
- **Tags** — Add multiple tags for flexible filtering
- **Pin Favorites** — Keep frequently-used prompts at the top
- **Search** — Full-text search across titles, content, and tags
- **Sort** — By date, usage count, or title

#### Settings & Preferences
- **Save Mode** — Quick (instant) or Detailed (with confirmation dialog)
- **Language** — English and 简体中文 with auto-detection
- **Theme** — Automatic dark mode based on system preference

#### Data Management
- **Import/Export** — Backup and restore prompts as JSON
- **Local Storage** — 100% local, no cloud, no account required
- **Sample Prompts** — 5 starter prompts included on first install

#### Platform Support
- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Google Gemini
- DeepSeek
- Perplexity
- Most AI chat interfaces with standard inputs

#### Browser Support
- Google Chrome 88+
- Microsoft Edge 88+
- Brave Browser
- Opera

### Known Issues
- Firefox not yet supported (Manifest V3 compatibility)
- Some sites with heavily customized inputs may require clicking in the field before Alt+P
- Very long prompts (>10,000 chars) may cause slight delay on insertion

### Technical Details
- Built on Manifest V3
- Uses `chrome.storage.local` (5MB quota)
- Content scripts injected on all URLs for universal support

---

## Version History

| Version | Date | Type | Highlights |
|:---|:---|:---|:---|
| 1.0.0 | 2026-02-02 | 🎉 Initial | First public release |

---

## Version Numbering Strategy

PromptPal follows [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes or complete redesigns
MINOR: New features, backward compatible
PATCH: Bug fixes, small improvements
```

### Examples
- `1.0.0` → `1.0.1`: Bug fix release
- `1.0.1` → `1.1.0`: New feature (e.g., folders)
- `1.1.0` → `2.0.0`: Major redesign or breaking change

---

## Future Release Templates

### v1.0.1 (Patch Release Template)

```markdown
## [1.0.1] - YYYY-MM-DD

### Fixed
- Fixed: [Brief description of bug] (#issue-number)
- Fixed: [Another bug fix]

### Changed
- Improved: [Performance or UX improvement]

### Known Issues
- [Any remaining known issues]
```

---

### v1.1.0 (Minor Release Template)

```markdown
## [1.1.0] - YYYY-MM-DD

### 🚀 New Features

#### [Feature Name]
- Description of the new feature
- How to use it
- Any limitations

### Added
- Added: [New feature 1]
- Added: [New feature 2]

### Changed
- Changed: [Improvement 1]
- Changed: [Improvement 2]

### Fixed
- Fixed: [Bug fix 1]
- Fixed: [Bug fix 2]

### Deprecated
- [Features being phased out]

### Known Issues
- [Current limitations]

### Upgrade Notes
- [Any special instructions for upgrading]
```

---

### v1.2.0+ (Major Update Template)

```markdown
## [1.2.0] - YYYY-MM-DD

### 🎉 Highlights
- **[Headline Feature 1]** — Brief description
- **[Headline Feature 2]** — Brief description
- **[Headline Feature 3]** — Brief description

### Added
- [Detailed feature list]

### Changed
- [Improvements and changes]

### Fixed
- [Bug fixes]

### Deprecated
- [Features being removed in future versions]

### Removed
- [Features removed in this version]

### Security
- [Security-related changes]

### Breaking Changes
- ⚠️ [Any breaking changes requiring user action]

### Migration Guide
[Steps to migrate from previous version]

### Known Issues
- [Current limitations]
```

---

## Announcement Templates

### Twitter/X Announcement

#### v1.0.0 Launch
```
🚀 PromptPal is live!

A free Chrome extension to save and reuse your AI prompts.

✅ Right-click to save
✅ Alt+P to insert in ChatGPT, Claude, Gemini
✅ 100% local — no account, no cloud

Stop retyping the same prompts. Start saving time.

👉 [Chrome Web Store Link]

#AI #ChatGPT #Productivity
```

#### Patch Release (v1.0.x)
```
🔧 PromptPal v1.0.x is out!

Fixed:
• [Bug 1]
• [Bug 2]

Update in Chrome → Extensions → PromptPal

Thanks for the bug reports! 🙏
```

#### Feature Release (v1.x.0)
```
✨ PromptPal v1.x.0 is here!

New:
🆕 [Feature 1]
🆕 [Feature 2]
🛠️ [Improvement]

Update now in Chrome → Extensions

#AI #Productivity #Update
```

---

### GitHub Release Page

#### v1.0.0
```markdown
# 🎉 PromptPal v1.0.0 — Initial Release

We're thrilled to launch PromptPal, your personal AI prompt library!

## What's New

### ✨ Features
- **Save prompts** from any webpage with right-click or Alt+S
- **Insert prompts** into any AI chat with Alt+P
- **Organize** with categories, tags, pinning, and search
- **Import/Export** your prompt library as JSON
- **Multi-language** support (English, 中文)
- **Dark mode** follows your system preference

### 🌐 Supported Platforms
ChatGPT, Claude, Gemini, DeepSeek, Perplexity, and more

### 🔒 Privacy First
100% local storage. No accounts. No cloud. No tracking.

## Installation

1. Download from [Chrome Web Store](#)
2. Click "Add to Chrome"
3. Start saving prompts!

## Documentation
- [README](README.md)
- [PRD](docs/PRD.md)

## Feedback
Found a bug? [Open an issue](../../issues/new)
Have a feature request? [Start a discussion](../../discussions/new)

---

Thank you for trying PromptPal! ⭐ Star this repo if you find it useful.
```

---

### Email to Users

#### Launch Announcement
```
Subject: 🚀 PromptPal v1.0.0 is Live!

Hi there,

PromptPal is officially launched on the Chrome Web Store!

**What is PromptPal?**
A free Chrome extension that lets you save your best AI prompts and reuse them instantly across ChatGPT, Claude, Gemini, and more.

**Key Features:**
• Right-click any text → Save to Prompt Library
• Press Alt+P on any AI chat → Insert your prompts
• Organize with categories, tags, and pinning
• 100% local storage — your data never leaves your browser

**Get Started:**
[Install from Chrome Web Store]

We'd love your feedback! Reply to this email or leave a review on the Chrome Web Store.

Happy prompting! 🎉

— The PromptPal Team

P.S. PromptPal is free and always will be for core features. We're an indie project, and your support means everything.
```

#### Update Notification
```
Subject: 🆕 PromptPal v1.x.0 — New Features Inside!

Hi there,

We've just released PromptPal v1.x.0 with some exciting updates:

**What's New:**
✅ [Feature 1] — [Brief description]
✅ [Feature 2] — [Brief description]
🛠️ [Bug fix/improvement]

**How to Update:**
Chrome should update automatically, but you can force it:
1. Go to chrome://extensions
2. Enable "Developer mode"
3. Click "Update"

**Feedback?**
Reply to this email or open an issue on GitHub.

Thanks for being part of the PromptPal community!

— The PromptPal Team
```

---

### Community Forum / Reddit Post

#### Launch Announcement
```
[Tool] PromptPal v1.0.0 — Save and Reuse AI Prompts (Free Chrome Extension)

Hey everyone!

I'm excited to share PromptPal, a Chrome extension I built to solve my own frustration: retyping the same prompts over and over in ChatGPT, Claude, and other AI tools.

**What it does:**
- 📥 **Save**: Right-click any text → "Save to Prompt Library" (or press Alt+S)
- 📤 **Insert**: On any AI chat, press Alt+P → Click a prompt to insert
- 📂 **Organize**: Categories, tags, search, pin favorites
- 💾 **Backup**: Export/import as JSON

**Platforms supported:**
ChatGPT, Claude, Gemini, DeepSeek, Perplexity, and basically any site with a text input

**Privacy:**
100% local storage. No accounts, no cloud, no tracking. Your prompts stay in your browser.

**Price:**
Free. No premium tiers. No ads.

**Links:**
- Chrome Web Store: [link]
- GitHub: [link]

I'd love feedback! What features would make this more useful for you?

---

*Edit: Thanks for the awards! Working on v1.1 with [feature based on feedback].*
```

#### Update Announcement
```
[Update] PromptPal v1.x.0 — [Main Feature Name]

Quick update for PromptPal users!

**What's new in v1.x.0:**
- 🆕 [Feature 1]
- 🆕 [Feature 2]
- 🔧 [Bug fix]

**Changelog:** [GitHub Release Link]

Thanks to everyone who reported issues and suggested features. Keep them coming!

Chrome should auto-update, or go to chrome://extensions → Update.
```

---

## Release Checklist

### Pre-Release
- [ ] All features complete and tested
- [ ] No critical bugs in issue tracker
- [ ] Updated version number in `manifest.json`
- [ ] Updated `CHANGELOG.md`
- [ ] README reflects new features
- [ ] Screenshots updated (if UI changed)
- [ ] Localization strings complete (EN, ZH)
- [ ] Tested on Chrome, Edge, Brave

### Release
- [ ] Create git tag (`git tag v1.x.x`)
- [ ] Push tag (`git push origin v1.x.x`)
- [ ] Create GitHub Release with notes
- [ ] Upload to Chrome Web Store
- [ ] Submit for review

### Post-Release
- [ ] Verify Chrome Web Store listing is live
- [ ] Post Twitter announcement
- [ ] Post Reddit/community announcement
- [ ] Send email to subscribers (if applicable)
- [ ] Monitor for bug reports
- [ ] Respond to initial reviews

---

## Links

- **Chrome Web Store:** <!-- [Add link when published] -->
- **GitHub Releases:** <!-- [Add link] -->
- **Issue Tracker:** <!-- [Add link] -->
- **Feedback Form:** <!-- [Add link] -->

---

*This changelog is maintained alongside the codebase. For the latest version, check the [releases page](../../releases).*
