// Onboarding logic for PromptPal
// Handles tutorial flow and first-run experience

console.log('PromptPal onboarding loaded');

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen');
const tutorialScreen = document.getElementById('tutorial-screen');
const completionScreen = document.getElementById('completion-screen');

const startTutorialBtn = document.getElementById('start-tutorial-btn');
const skipTutorialBtn = document.getElementById('skip-tutorial-btn');
const skipStepBtn = document.getElementById('skip-step-btn');

const step1Continue = document.getElementById('step1-continue');
const step2Continue = document.getElementById('step2-continue');
const step3Continue = document.getElementById('step3-continue');
const step4Finish = document.getElementById('step4-finish');

const openManagerBtn = document.getElementById('open-manager');
const openSettingsBtn = document.getElementById('open-settings');
const closeOnboardingBtn = document.getElementById('close-onboarding-btn');

const progressFill = document.getElementById('progress-fill');
const currentStepEl = document.getElementById('current-step');

let currentStep = 1;
const totalSteps = 4;

/**
 * Initialize onboarding
 */
function init() {
    setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Welcome screen
    startTutorialBtn.addEventListener('click', startTutorial);
    skipTutorialBtn.addEventListener('click', skipToCompletion);

    // Tutorial navigation - all steps
    if (step1Continue) {
        step1Continue.addEventListener('click', () => goToStep(2));
    }
    if (step2Continue) {
        step2Continue.addEventListener('click', () => goToStep(3));
    }
    if (step3Continue) {
        step3Continue.addEventListener('click', () => goToStep(4));
    }
    if (step4Finish) {
        step4Finish.addEventListener('click', showCompletion);
    }
    if (skipStepBtn) {
        skipStepBtn.addEventListener('click', skipToCompletion);
    }

    // Completion actions
    if (openManagerBtn) {
        openManagerBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('popup/manager.html') });
            closeOnboarding();
        });
    }

    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
            closeOnboarding();
        });
    }

    if (closeOnboardingBtn) {
        closeOnboardingBtn.addEventListener('click', closeOnboarding);
    }

    // Auto-advance from step 1 when text is selected
    const demoBox = document.querySelector('.demo-box');
    if (demoBox) {
        document.addEventListener('selectionchange', () => {
            if (currentStep === 1) {
                const selection = window.getSelection();
                if (selection && selection.toString().length > 10) {
                    // User selected text, show hint
                    console.log('Text selected! You can now try Alt+S or right-click');
                }
            }
        });
    }
}

/**
 * Start tutorial
 */
function startTutorial() {
    welcomeScreen.classList.remove('active');
    tutorialScreen.classList.add('active');
    currentStep = 1;
    updateProgress();
}

/**
 * Go to specific step
 */
function goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > totalSteps) return;

    // Hide current step
    const currentStepEl = document.querySelector(`.tutorial-step[data-step="${currentStep}"]`);
    if (currentStepEl) {
        currentStepEl.classList.remove('active');
    }

    // Show new step
    currentStep = stepNumber;
    const newStepEl = document.querySelector(`.tutorial-step[data-step="${currentStep}"]`);
    if (newStepEl) {
        newStepEl.classList.add('active');
    }

    updateProgress();
}

/**
 * Update progress bar and indicator
 */
function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    progressFill.style.width = `${progress}%`;
    document.getElementById('current-step').textContent = currentStep;
}

/**
 * Show completion screen
 */
function showCompletion() {
    tutorialScreen.classList.remove('active');
    completionScreen.classList.add('active');

    // Mark onboarding as complete
    completeOnboarding();
}

/**
 * Skip to completion
 */
function skipToCompletion() {
    welcomeScreen.classList.remove('active');
    tutorialScreen.classList.remove('active');
    completionScreen.classList.add('active');

    // Mark onboarding as complete
    completeOnboarding();
}

/**
 * Mark onboarding as complete in storage
 */
async function completeOnboarding() {
    try {
        await chrome.storage.local.set({
            onboardingCompleted: true,
            onboardingCompletedAt: Date.now()
        });
        console.log('Onboarding marked as complete');
    } catch (error) {
        console.error('Error marking onboarding complete:', error);
    }
}

/**
 * Close onboarding and current tab
 */
function closeOnboarding() {
    window.close();
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
