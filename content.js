(function () {
    // Prevent script from running multiple times
    if (window.webPilotInitialized) {
        return;
    }
    window.webPilotInitialized = true;

    console.log("WebPilot: Simplified content script loaded.");

    let floatingToolbar;
    let suggestionPanel;
    let lastRange; // Variable to store the last text selection Range

    // 1. CREATE THE UI ELEMENTS
    // =================================
    function createUI() {
        // Create the main toolbar
        floatingToolbar = document.createElement("div");
        floatingToolbar.id = "web-pilot-toolbar";
        floatingToolbar.style.display = "none";
        floatingToolbar.innerHTML = `
            <button data-action="Improve">Improve</button>
            <button data-action="Rewrite">Rewrite</button>
            <button data-action="Elaborate">Elaborate</button>
        `;
        document.body.appendChild(floatingToolbar);

        // Create the suggestion panel
        suggestionPanel = document.createElement("div");
        suggestionPanel.id = "web-pilot-suggestion-panel";
        suggestionPanel.style.display = "none";
        suggestionPanel.innerHTML = `
            <div class="suggestion-content"></div>
            <div class="suggestion-actions">
                <button class="accept">Accept</button>
                <button class="decline">Decline</button>
            </div>
        `;
        document.body.appendChild(suggestionPanel);
    }

    // 2. DEFINE CORE FUNCTIONS
    // =================================

    function showToolbar() {
        const selection = window.getSelection();
        if (!selection.isCollapsed) {
            lastRange = selection.getRangeAt(0);
            const rect = lastRange.getBoundingClientRect();

            // Position toolbar above the selection
            floatingToolbar.style.display = "block";
            floatingToolbar.style.left = `${
                window.scrollX +
                rect.left +
                rect.width / 2 -
                floatingToolbar.offsetWidth / 2
            }px`;
            floatingToolbar.style.top = `${
                window.scrollY + rect.top - floatingToolbar.offsetHeight - 5
            }px`;

            // Hide suggestion panel if it's somehow visible
            hideSuggestionPanel();
        } else {
            // If selection is collapsed (e.g., a simple click), do nothing.
            // The hide logic is handled by the mousedown listener.
        }
    }

    function hideToolbar() {
        if (floatingToolbar) {
            floatingToolbar.style.display = "none";
        }
    }

    function showSuggestionPanel(isLoading = true, suggestion = "Loading...") {
        if (!lastRange) return;

        const rect = floatingToolbar.getBoundingClientRect(); // Position relative to where the toolbar was
        suggestionPanel.style.display = "block";
        suggestionPanel.style.left = `${window.scrollX + rect.left}px`;
        suggestionPanel.style.top = `${window.scrollY + rect.top}px`;

        const contentDiv = suggestionPanel.querySelector(".suggestion-content");
        const actionsDiv = suggestionPanel.querySelector(".suggestion-actions");

        contentDiv.textContent = suggestion;
        actionsDiv.style.display = isLoading ? "none" : "flex";
    }

    function hideSuggestionPanel() {
        if (suggestionPanel) {
            suggestionPanel.style.display = "none";
        }
    }

    function handleAccept() {
        const suggestionText = suggestionPanel.querySelector(
            ".suggestion-content"
        ).textContent;
        if (lastRange && suggestionText) {
            // Use the stored range to replace the text. This is robust.
            lastRange.deleteContents();
            lastRange.insertNode(document.createTextNode(suggestionText));
        }
        hideSuggestionPanel();
        window.getSelection().removeAllRanges(); // Clear selection
    }

    // 3. SET UP EVENT LISTENERS
    // =================================

    // Listen for text selection
    document.addEventListener("mouseup", (e) => {
        // Use a timeout to allow the selection to finalize
        setTimeout(() => {
            const selection = window.getSelection();
            // Don't show toolbar if clicking on the toolbar itself or the suggestion panel
            if (
                floatingToolbar.contains(e.target) ||
                suggestionPanel.contains(e.target)
            ) {
                return;
            }
            if (selection && !selection.isCollapsed) {
                showToolbar();
            } else {
                hideToolbar();
            }
        }, 10);
    });

    // Hide toolbar on any click outside of it
    document.addEventListener("mousedown", (e) => {
        if (
            !floatingToolbar.contains(e.target) &&
            floatingToolbar.style.display === "block"
        ) {
            hideToolbar();
        }
        if (
            !suggestionPanel.contains(e.target) &&
            suggestionPanel.style.display === "block"
        ) {
            hideSuggestionPanel();
        }
    });

    // Hide on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideToolbar();
            hideSuggestionPanel();
        }
    });

    // Listen for clicks on toolbar buttons
    document.addEventListener("click", (e) => {
        const action = e.target.getAttribute("data-action");
        if (action) {
            const selectedText = lastRange.toString();
            console.log(
                `WebPilot: Action "${action}" on text: "${selectedText}"`
            );

            hideToolbar();
            showSuggestionPanel(true); // Show loading state

            chrome.runtime.sendMessage({
                action: "processText",
                text: selectedText,
                editType: action,
            });
        }

        // Listen for suggestion panel actions
        if (e.target.matches("#web-pilot-suggestion-panel .accept")) {
            handleAccept();
        }
        if (e.target.matches("#web-pilot-suggestion-panel .decline")) {
            hideSuggestionPanel();
        }
    });

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "showSuggestion") {
            console.log("WebPilot: Received suggestion:", message.suggestion);
            showSuggestionPanel(false, message.suggestion);
        }
    });

    // 4. INITIALIZE
    // =================================
    createUI();
})();
