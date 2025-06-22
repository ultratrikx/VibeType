(function () {
    if (window.vibeTypeInitialized) {
        return;
    }
    window.vibeTypeInitialized = true;

    console.log("VibeType: Content script loaded.");

    let toolbar, confirmationDialog, sidebar;
    let lastRange, originalText;
    let isSidebarOpen = false;

    function createUI() {
        toolbar = document.createElement("div");
        toolbar.id = "web-pilot-toolbar";
        toolbar.innerHTML = `
            <button data-action="Improve">Improve</button>
            <button data-action="Rewrite">Rewrite</button>
            <button data-action="Elaborate">Elaborate</button>
        `;
        document.body.appendChild(toolbar);

        confirmationDialog = document.createElement("div");
        confirmationDialog.id = "vibetype-confirmation-dialog";
        confirmationDialog.innerHTML = `
            <button class="accept-btn" title="Accept">✔️</button>
            <button class="discard-btn" title="Discard">❌</button>
            <button class="try-again-btn" title="Try Again">🔄</button>
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
        sidebar = document.createElement("iframe");
        sidebar.id = "vibetype-sidebar-iframe";
        sidebar.src = chrome.runtime.getURL("sidebar.html");
        document.body.appendChild(sidebar);

        sidebar.onload = () => {
            console.log("VibeType: Sidebar loaded.");
        };
    }

    function toggleSidebar() {
        if (!sidebar) {
            createSidebar();
        }
        isSidebarOpen = !isSidebarOpen;
        if (sidebar) {
            sidebar.style.width = isSidebarOpen ? "350px" : "0px";
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
        chrome.runtime.sendMessage({
            action: "processText",
            text: originalText,
            editType: action,
        });
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
        }
        hideConfirmationDialog();
    }

    function discardChange() {
        const highlight = document.querySelector(".vibetype-highlight");
        if (highlight) {
            const text = document.createTextNode(originalText);
            highlight.parentNode.replaceChild(text, highlight);
        }
        hideConfirmationDialog();
    }

    function tryAgain() {
        const highlight = document.querySelector(".vibetype-highlight");
        if (highlight) {
            const currentText = highlight.textContent;
            // Re-select the range for replacement
            const range = document.createRange();
            range.selectNodeContents(highlight);
            lastRange = range;
            originalText = currentText; // The new original is the current suggestion
        }
        hideConfirmationDialog();
        chrome.runtime.sendMessage({
            action: "processText",
            text: originalText, // Send original text again
            editType: "Rewrite", // Default to rewrite for trying again
        });
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

    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data.action) return;

        if (event.data.action === "toggleSidebar") {
            console.log("VibeType: Toggle sidebar message received.");
            toggleSidebar();
        }
    });

    createUI();
})();
