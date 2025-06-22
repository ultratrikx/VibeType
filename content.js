(function () {
    if (window.vibeTypeInitialized) {
        return;
    }
    window.vibeTypeInitialized = true;

    console.log("VibeType: Content script loaded.");

    let toolbar, confirmationDialog, sidebar;
    let lastRange, originalText;
    let isSidebarOpen = false;
    let lastActiveElement; // To store the last focused editable element

    // Add a listener to track the last focused editable element
    document.addEventListener("focusin", (e) => {
        const el = e.target;
        if (
            el &&
            (el.isContentEditable ||
                el.tagName === "TEXTAREA" ||
                el.tagName === "INPUT")
        ) {
            lastActiveElement = el;
        }
    });

    // Create a shadow DOM container for our sidebar
    function createShadowContainer() {
        const container = document.createElement("div");
        container.id = "vibetype-container";
        // Position the container
        container.style.position = "fixed";
        container.style.top = "0";
        container.style.right = "0";
        container.style.height = "100vh";
        container.style.zIndex = "2147483647";
        container.style.transition = "width 0.3s ease";
        container.style.width = "0";

        // Create shadow DOM
        const shadow = container.attachShadow({ mode: "closed" });

        // Add styles to shadow DOM
        const style = document.createElement("style");
        style.textContent = `
            :host {
                all: initial;
            }
            #sidebar-wrapper {
                height: 100%;
                width: 100%;
                background: white;
                box-shadow: -2px 0 5px rgba(0,0,0,0.2);
            }
            iframe {
                border: none;
                width: 100%;
                height: 100%;
                background: white;
            }
        `;
        shadow.appendChild(style);

        return { container, shadow };
    }

    function initializeConnection() {
        // Simple connection initialization - can be expanded later
        console.log("VibeType: Connection initialized for sidebar");
    }

    function createUI() {
        // Inject styles for the toolbar and confirmation dialog
        const injectedStyles = `
            #web-pilot-toolbar {
                position: absolute;
                z-index: 2147483646;
                background-color: #1a1a1a;
                border-radius: 8px;
                padding: 4px;
                display: flex;
                gap: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                opacity: 0;
                transition: opacity 0.2s;
            }
            #web-pilot-toolbar button {
                background: none;
                border: none;
                color: #e0e0e0;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                transition: background-color 0.2s;
            }
            #web-pilot-toolbar button:hover {
                background-color: #333;
                color: white;
            }

            #vibetype-confirmation-dialog {
                position: absolute;
                z-index: 2147483647;
                background-color: #1a1a1a;
                border-radius: 6px;
                padding: 4px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                opacity: 0;
                transition: opacity 0.2s;
            }
            #vibetype-confirmation-dialog button {
                display: flex;
                align-items: center;
                gap: 8px;
                background: none;
                border: none;
                color: #e0e0e0;
                padding: 6px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                text-align: left;
                transition: color 0.2s;
                width: 100%;
            }
            #vibetype-confirmation-dialog button:hover {
                color: white;
            }
            #vibetype-confirmation-dialog button svg {
                flex-shrink: 0;
            }
            .vibetype-highlight {
                background-color: rgba(100, 180, 255, 0.25);
                border-radius: 3px;
                padding: 2px 0;
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = injectedStyles;
        document.head.appendChild(styleSheet);

        toolbar = document.createElement("div");
        toolbar.id = "web-pilot-toolbar";
        toolbar.innerHTML = `
            <button data-action="Improve">Improve</button>
            <button data-action="Rewrite">Rewrite</button>
            <button data-action="Elaborate">Elaborate</button>
            <button data-action="Chat">Chat</button>
        `;
        toolbar.style.display = "none"; // Initially hidden
        document.body.appendChild(toolbar);

        confirmationDialog = document.createElement("div");
        confirmationDialog.id = "vibetype-confirmation-dialog";
        confirmationDialog.innerHTML = `
            <button class="accept-btn" title="Accept">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>Accept</span>
            </button>
            <button class="discard-btn" title="Discard">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>Discard</span>
            </button>
            <button class="try-again-btn" title="Try Again">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.18 3 17.94 4.58 19.42 7M19.42 7H14V2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>Rewrite</span>
            </button>
        `;
        document.body.appendChild(confirmationDialog);
    }

    function showToolbar() {
        const selection = window.getSelection();
        if (!selection.isCollapsed) {
            lastRange = selection.getRangeAt(0);
            originalText = lastRange.toString();
            const rect = lastRange.getBoundingClientRect();

            toolbar.style.display = "flex";
            const toolbarWidth = toolbar.offsetWidth;
            toolbar.style.left = `${
                window.scrollX + rect.left + rect.width / 2 - toolbarWidth / 2
            }px`;
            toolbar.style.top = `${
                window.scrollY + rect.top - toolbar.offsetHeight - 8
            }px`;
            toolbar.style.opacity = "1";

            hideConfirmationDialog();
        }
    }

    function hideToolbar() {
        toolbar.style.opacity = "0";
        setTimeout(() => {
            toolbar.style.display = "none";
        }, 200);
    }

    function createSidebar() {
        if (sidebar) return;

        // Create shadow DOM container
        const { container, shadow } = createShadowContainer();
        document.body.appendChild(container);

        // Create wrapper inside shadow DOM
        const wrapper = document.createElement("div");
        wrapper.id = "sidebar-wrapper";

        // Create the iframe
        sidebar = document.createElement("iframe");
        sidebar.id = "vibetype-sidebar-iframe";

        const sidebarUrl = chrome.runtime.getURL("sidebar.html");
        sidebar.src = sidebarUrl;

        // Set security attributes
        sidebar.setAttribute("allow", "clipboard-write");
        sidebar.setAttribute(
            "sandbox",
            "allow-scripts allow-forms allow-same-origin allow-popups allow-modals"
        );

        wrapper.appendChild(sidebar);
        shadow.appendChild(wrapper);

        sidebar.onload = () => {
            console.log("VibeType: Sidebar loaded.");
            initializeConnection();

            if (sidebar.contentWindow) {
                sidebar.contentWindow.postMessage(
                    {
                        action: "sidebarReady",
                        extensionId: chrome.runtime.id,
                    },
                    "*"
                );
            }
        };
    }

    function toggleSidebar() {
        if (!sidebar) {
            createSidebar();
        }
        isSidebarOpen = !isSidebarOpen;

        const container = document.getElementById("vibetype-container");
        if (container) {
            container.style.width = isSidebarOpen ? "350px" : "0";
        }
    }

    function showConfirmationDialog(targetRect) {
        confirmationDialog.style.display = "flex";
        const dialogWidth = confirmationDialog.offsetWidth;
        confirmationDialog.style.left = `${
            window.scrollX +
            targetRect.left +
            targetRect.width / 2 -
            dialogWidth / 2
        }px`;
        confirmationDialog.style.top = `${
            window.scrollY + targetRect.bottom + 8
        }px`;
        confirmationDialog.style.opacity = "1";
    }

    function hideConfirmationDialog() {
        confirmationDialog.style.opacity = "0";
        setTimeout(() => {
            confirmationDialog.style.display = "none";
        }, 200);
    }

    function handleToolbarAction(action) {
        hideToolbar();

        if (action === "Chat") {
            // Toggle the sidebar for chat
            toggleSidebar();

            // If text is selected and sidebar is opening, send the selected text to sidebar
            if (originalText && !isSidebarOpen) {
                setTimeout(() => {
                    if (sidebar && sidebar.contentWindow) {
                        sidebar.contentWindow.postMessage(
                            {
                                action: "updateSelectedText",
                                text: originalText,
                            },
                            "*"
                        );
                    }
                }, 500); // Small delay to ensure sidebar is loaded
            }
        } else {
            // Handle text processing actions (Improve, Rewrite, Elaborate)
            chrome.runtime.sendMessage({
                action: "processText",
                text: originalText,
                editType: action,
            });
        }
    }

    function replaceAndHighlight(suggestion) {
        if (!lastRange) return;

        lastRange.deleteContents();

        const highlightSpan = document.createElement("span");
        highlightSpan.className = "vibetype-highlight";
        highlightSpan.textContent = suggestion;
        lastRange.insertNode(highlightSpan);

        const newRange = document.createRange();
        newRange.selectNode(highlightSpan);
        const rect = newRange.getBoundingClientRect();
        window.getSelection().removeAllRanges();

        showConfirmationDialog(rect);
    }

    function acceptChange() {
        const highlight = document.querySelector(".vibetype-highlight");
        if (highlight) {
            const text = document.createTextNode(highlight.textContent);
            highlight.parentNode.replaceChild(text, highlight);
            lastRange = null; // The range is now invalid
        }
        hideConfirmationDialog();
    }

    function discardChange() {
        const highlight = document.querySelector(".vibetype-highlight");
        if (highlight) {
            const text = document.createTextNode(originalText);
            highlight.parentNode.replaceChild(text, highlight);
            lastRange = null; // The range is now invalid
        }
        hideConfirmationDialog();
    }

    function tryAgain() {
        const highlight = document.querySelector(".vibetype-highlight");
        if (highlight) {
            const currentText = highlight.textContent;
            // Re-select the range for replacement so the next suggestion replaces this one
            const range = document.createRange();
            range.selectNodeContents(highlight);
            lastRange = range;

            hideConfirmationDialog();
            chrome.runtime.sendMessage({
                action: "processText",
                text: currentText, // Send the current suggestion's text to be rewritten
                editType: "Rewrite",
            });
        } else {
            hideConfirmationDialog();
        }
    }

    // --- Event Listeners ---
    document.addEventListener("mouseup", (e) => {
        if (
            toolbar.contains(e.target) ||
            confirmationDialog.contains(e.target)
        ) {
            return;
        }
        setTimeout(() => {
            const selection = window.getSelection();
            if (
                selection &&
                !selection.isCollapsed &&
                selection.toString().trim().length > 5
            ) {
                showToolbar();
                if (isSidebarOpen && sidebar && sidebar.contentWindow) {
                    sidebar.contentWindow.postMessage(
                        {
                            action: "updateSelectedText",
                            text: selection.toString(),
                        },
                        "*"
                    );
                }
            } else {
                hideToolbar();
            }
        }, 10);
    });

    document.addEventListener("mousedown", (e) => {
        if (
            !toolbar.contains(e.target) &&
            !confirmationDialog.contains(e.target)
        ) {
            hideToolbar();
            // Don't hide confirmation on mousedown, allow buttons to be clicked.
            // It will be hidden on action.
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideToolbar();
            hideConfirmationDialog();
            // Potentially discard changes on escape?
            const highlight = document.querySelector(".vibetype-highlight");
            if (highlight) {
                discardChange();
            }
        }
    });

    document.addEventListener("click", (e) => {
        const target = e.target.closest("button");
        if (!target) return;

        // Toolbar actions
        const action = target.getAttribute("data-action");
        if (action) {
            handleToolbarAction(action);
            return;
        }

        // Confirmation dialog actions
        if (target.classList.contains("accept-btn")) {
            acceptChange();
        } else if (target.classList.contains("discard-btn")) {
            discardChange();
        } else if (target.classList.contains("try-again-btn")) {
            tryAgain();
        }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "showSuggestion") {
            replaceAndHighlight(message.suggestion);
        }
    });

    const extensionOrigin = new URL(chrome.runtime.getURL("any.html")).origin;

    window.addEventListener("message", (event) => {
        // Only accept messages from our own extension's iframe
        if (
            event.origin !== extensionOrigin ||
            !event.data ||
            !event.data.action
        ) {
            return;
        }

        if (event.data.action === "toggleSidebar") {
            console.log("VibeType: Toggle sidebar message received.");
            toggleSidebar();
        } else if (event.data.action === "insertText") {
            const textToInsert = event.data.text;
            console.log("VibeType: Insert text message received", textToInsert);

            // Prioritize the last actively focused element, as the selection is lost when using the sidebar.
            const target = lastActiveElement;

            if (
                target &&
                (target.isContentEditable ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "INPUT")
            ) {
                target.focus(); // Bring focus back to the element to ensure commands work

                if (
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "INPUT"
                ) {
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const value = target.value || "";
                    // Replace selection or insert at cursor
                    target.value =
                        value.substring(0, start) +
                        textToInsert +
                        value.substring(end);
                    // Move cursor to the end of the inserted text
                    const newCursorPos = start + textToInsert.length;
                    target.selectionStart = newCursorPos;
                    target.selectionEnd = newCursorPos;
                } else if (target.isContentEditable) {
                    // For contenteditable, execCommand is a reliable way to handle various rich text editors.
                    document.execCommand("insertText", false, textToInsert);
                }
            } else if (lastRange) {
                // Fallback to the original selection range if no active element was tracked.
                // This is less reliable as the range can become invalid.
                try {
                    lastRange.deleteContents();
                    lastRange.insertNode(document.createTextNode(textToInsert));
                } catch (e) {
                    console.error(
                        "VibeType: Failed to insert text using lastRange.",
                        e
                    );
                }
            } else {
                console.error(
                    "VibeType: No target element found to insert text."
                );
            }
        }
    });

    createUI();
})();
