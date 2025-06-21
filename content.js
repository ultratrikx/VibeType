class WebPilotController {
    constructor() {
        this.sidebarIframe = null;
        this.activeElement = null;
        this.additionalContext = null;
        this.floatingToolbar = null;
        this.typingTimer = null;
        this.typingDelay = 1500; // 1.5 seconds after typing stops
        this.lastCaretPosition = null;
        this.selectedText = null; // Store selected text for processing
        this.isProcessing = false; // Prevent multiple simultaneous requests
        this.debounceTimers = new Map(); // For performance optimization
        this.init();
    }

    init() {
        this.createSidebar();
        this.createFloatingToolbar();
        this.addEventListeners();
    }

    createSidebar() {
        this.sidebarIframe = document.createElement("iframe");
        this.sidebarIframe.id = "webpilot-sidebar-iframe";
        this.sidebarIframe.src = chrome.runtime.getURL("sidebar.html");
        document.body.appendChild(this.sidebarIframe);
    }
    createFloatingToolbar() {
        this.floatingToolbar = document.createElement("div");
        this.floatingToolbar.id = "webpilot-floating-toolbar";
        this.floatingToolbar.setAttribute("role", "toolbar");
        this.floatingToolbar.setAttribute("aria-label", "AI Writing Assistant");
        this.floatingToolbar.innerHTML = `
            <div class="floating-toolbar-content">
                <button class="floating-btn" data-action="elaborate" title="Elaborate text (Ctrl+Shift+E)" aria-label="Elaborate text">
                    <span class="btn-icon">📝</span>
                    <span class="btn-text">Elaborate</span>
                </button>
                <button class="floating-btn" data-action="improve" title="Improve text (Ctrl+Shift+I)" aria-label="Improve text">
                    <span class="btn-icon">✨</span>
                    <span class="btn-text">Improve</span>
                </button>
                <button class="floating-btn" data-action="rewrite" title="Rewrite text (Ctrl+Shift+R)" aria-label="Rewrite text">
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">Rewrite</span>
                </button>
                <button class="floating-btn floating-btn-context" data-action="addContext" title="Add context from other sources" aria-label="Add context">
                    <span class="btn-icon">➕</span>
                </button>
            </div>
        `;
        // Add styles for floating toolbar
        const style = document.createElement("style");
        style.textContent = `
            #webpilot-floating-toolbar {
                position: absolute;
                z-index: 999999;
                background: white;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: none;
                opacity: 0;
                transform: translateY(-5px);
                transition: all 0.2s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                backdrop-filter: blur(10px);
            }
            
            #webpilot-floating-toolbar.show {
                display: block;
                opacity: 1;
                transform: translateY(0);
            }
            
            .floating-toolbar-content {
                display: flex;
                align-items: center;
                padding: 4px;
                gap: 2px;
            }
            
            .floating-btn {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 6px 8px;
                border: none;
                background: transparent;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.15s ease;
                font-size: 12px;
                color: #374151;
                white-space: nowrap;
                position: relative;
            }
            
            .floating-btn:hover {
                background: #f3f4f6;
                transform: translateY(-1px);
            }
            
            .floating-btn:active {
                transform: translateY(0);
            }
            
            .floating-btn.floating-btn-context {
                padding: 6px;
                border-left: 1px solid #e5e7eb;
                margin-left: 4px;
            }
            
            .btn-icon {
                font-size: 14px;
            }
            
            .btn-text {
                font-weight: 500;
            }
            
            /* Tooltip on hover */
            .floating-btn:before {
                content: attr(title);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s;
                margin-bottom: 4px;
            }
            
            .floating-btn:hover:before {
                opacity: 1;
            }
            
            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .floating-btn .btn-text {
                    display: none;
                }
                
                .floating-toolbar-content {
                    gap: 1px;
                }
                
                .floating-btn {
                    padding: 8px 6px;
                    min-width: 40px;
                    justify-content: center;
                }
            }
            
            /* Animations for better UX */
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .floating-btn:active {
                animation: pulse 0.2s ease;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.floatingToolbar); // Add event listeners for toolbar buttons
        this.floatingToolbar.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const button = e.target.closest(".floating-btn");
            if (!button) return;

            console.log(
                "Floating toolbar button clicked:",
                button.dataset.action
            );

            // Add visual feedback
            button.style.transform = "scale(0.95)";
            setTimeout(() => {
                button.style.transform = "";
            }, 150);

            const action = button.dataset.action;
            this.handleFloatingToolbarAction(action);
        });
        // Prevent toolbar from closing when clicking on it
        this.floatingToolbar.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // Add keyboard navigation support
        this.floatingToolbar.addEventListener("keydown", (e) => {
            const buttons =
                this.floatingToolbar.querySelectorAll(".floating-btn");
            const currentIndex = Array.from(buttons).findIndex(
                (btn) => btn === document.activeElement
            );

            switch (e.key) {
                case "ArrowLeft":
                case "ArrowUp":
                    e.preventDefault();
                    const prevIndex =
                        currentIndex > 0
                            ? currentIndex - 1
                            : buttons.length - 1;
                    buttons[prevIndex].focus();
                    break;
                case "ArrowRight":
                case "ArrowDown":
                    e.preventDefault();
                    const nextIndex =
                        currentIndex < buttons.length - 1
                            ? currentIndex + 1
                            : 0;
                    buttons[nextIndex].focus();
                    break;
                case "Enter":
                case " ":
                    e.preventDefault();
                    if (
                        document.activeElement.classList.contains(
                            "floating-btn"
                        )
                    ) {
                        document.activeElement.click();
                    }
                    break;
            }
        });
    }
    addEventListeners() {
        // Listen for toggle command from background script
        chrome.runtime.onMessage.addListener(
            (request, sender, sendResponse) => {
                if (request.action === "toggleSidebar") {
                    this.toggleSidebar();
                }
                return true;
            }
        );

        // Listen for messages from the sidebar iframe
        window.addEventListener("message", (event) => {
            if (
                event.source !== this.sidebarIframe.contentWindow ||
                event.data.type !== "FROM_WEBPILOT_SIDEBAR"
            ) {
                return;
            }
            this.handleSidebarAction(event.data.action, event.data.data);
        });

        // Track the last active text element and handle floating toolbar
        document.addEventListener("focusin", (e) => {
            const target = e.target;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                this.activeElement = target;
                this.hideFloatingToolbar();
            }
        });

        // Hide floating toolbar on focus out
        document.addEventListener("focusout", () => {
            this.hideFloatingToolbar();
        }); // Handle typing detection for floating toolbar
        document.addEventListener("keydown", (e) => {
            if (this.isTextInput(e.target)) {
                // Keyboard shortcuts (Ctrl/Cmd + Shift + E/I/R)
                if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                    if (e.key === "E") {
                        e.preventDefault();
                        this.handleFloatingToolbarAction("elaborate");
                        return;
                    } else if (e.key === "I") {
                        e.preventDefault();
                        this.handleFloatingToolbarAction("improve");
                        return;
                    } else if (e.key === "R") {
                        e.preventDefault();
                        this.handleFloatingToolbarAction("rewrite");
                        return;
                    }
                }

                this.handleTyping(e);
            }
        });
        document.addEventListener("input", (e) => {
            if (this.isTextInput(e.target)) {
                this.handleTyping(e);
            }
        });

        // Handle text selection to show floating toolbar
        document.addEventListener("mouseup", (e) => {
            // Small delay to ensure selection is complete
            setTimeout(() => {
                this.handleTextSelection(e);
            }, 100);
        }); // Also handle keyboard selection (shift + arrow keys, etc.)
        document.addEventListener("keyup", (e) => {
            if (
                (e.shiftKey ||
                    e.key === "ArrowLeft" ||
                    e.key === "ArrowRight" ||
                    e.key === "ArrowUp" ||
                    e.key === "ArrowDown") &&
                this.isTextInput(e.target)
            ) {
                setTimeout(() => {
                    this.handleTextSelection(e);
                }, 100);
            }
        });

        // Handle escape key to hide toolbar
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.hideFloatingToolbar();
            }
        }); // Handle window resize to reposition toolbar
        window.addEventListener("resize", () => {
            if (this.floatingToolbar.classList.contains("show")) {
                // Small delay to allow layout to settle
                setTimeout(() => {
                    if (this.selectedText) {
                        const selection = window.getSelection();
                        if (selection.toString().trim() === this.selectedText) {
                            this.showFloatingToolbarForSelection(
                                selection,
                                this.selectedText
                            );
                        }
                    } else if (this.activeElement) {
                        this.showFloatingToolbar(this.activeElement);
                    }
                }, 100);
            }
        });

        // Optional: Show toolbar on right-click for selected text
        document.addEventListener("contextmenu", (e) => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (
                selectedText.length > 2 &&
                this.isTextInput(document.activeElement)
            ) {
                // Don't prevent default context menu, just show our toolbar too
                setTimeout(() => {
                    this.handleTextSelection(e);
                }, 50);
            }
        });

        // Hide toolbar on scroll or click outside
        document.addEventListener(
            "scroll",
            () => {
                this.hideFloatingToolbar();
            },
            true
        );
        document.addEventListener("click", (e) => {
            // Don't hide if clicking on the toolbar itself
            if (this.floatingToolbar.contains(e.target)) {
                return;
            }

            // Don't hide if clicking on floating preview/menu elements
            if (
                e.target.closest("#webpilot-floating-preview") ||
                e.target.closest("#webpilot-context-menu") ||
                e.target.closest("#webpilot-tab-selector")
            ) {
                return;
            }

            this.hideFloatingToolbar();
        });
    }

    toggleSidebar() {
        const isVisible = this.sidebarIframe.style.display !== "none";
        if (isVisible) {
            this.sidebarIframe.style.display = "none";
        } else {
            this.sidebarIframe.style.display = "block";
            // Ensure it's not collapsed when first appearing
            this.sidebarIframe.classList.remove("is-collapsed");
            this.postMessageToSidebar("updateCollapseState", {
                isCollapsed: false,
            });
        }
    }

    toggleCollapse() {
        this.sidebarIframe.classList.toggle("is-collapsed");
        const isCollapsed =
            this.sidebarIframe.classList.contains("is-collapsed");
        // Also notify the iframe so it can update its internal state (e.g., hide content)
        this.postMessageToSidebar("updateCollapseState", { isCollapsed });
    }

    // --- Handle all actions from the sidebar ---
    async handleSidebarAction(action, data) {
        switch (action) {
            case "toggleCollapse":
                this.toggleCollapse();
                break;
            case "improveText":
            case "rewriteText":
            case "elaborateText":
                // Use enhanced processing if we have enhanced context
                if (
                    this.additionalContext &&
                    this.additionalContext.most_relevant_chunks
                ) {
                    await this.handleEnhancedTextAction(action);
                } else {
                    this.handleTextAction(action);
                }
                break;
            case "acceptChange":
                this.setInputText(data.newText);
                break;
            case "getSuggestions":
                this.getSuggestionsForActiveElement();
                break;
            case "getTabList":
                const tabs = await this.sendMessageToBackground({
                    action: "getAllTabs",
                });
                this.postMessageToSidebar("updateTabList", { tabs: tabs.tabs });
                break;
            case "loadTabContext":
                const contextResponse = await this.sendMessageToBackground({
                    action: "getTabContext",
                    tabId: parseInt(data.tabId),
                });
                if (contextResponse.success) {
                    this.additionalContext = contextResponse.context;
                    this.postMessageToSidebar("updateTabContext", {
                        context: this.additionalContext,
                    });
                }
                break;
            case "loadEnhancedTabContext":
                const enhancedResponse = await this.sendMessageToBackground({
                    action: "enhancedContentExtraction",
                    tabId: parseInt(data.tabId),
                    query: data.query,
                });
                if (enhancedResponse.success) {
                    this.additionalContext = enhancedResponse;
                    this.postMessageToSidebar("updateTabContext", {
                        context: this.additionalContext,
                    });
                } else {
                    this.postMessageToSidebar("showLoading", {
                        message: `Error: ${enhancedResponse.error}`,
                    });
                }
                break;
            case "searchWebContent":
                // Get HTML from the selected tab first
                const searchResponse = await this.sendMessageToBackground({
                    action: "enhancedContentExtraction",
                    tabId: parseInt(data.tabId),
                    query: data.query,
                });
                if (searchResponse.success) {
                    this.additionalContext = searchResponse;
                    this.postMessageToSidebar("updateTabContext", {
                        context: this.additionalContext,
                    });
                } else {
                    this.postMessageToSidebar("showLoading", {
                        message: `Search failed: ${searchResponse.error}`,
                    });
                }
                break;
            case "clearTabContext":
                this.additionalContext = null;
                this.postMessageToSidebar("updateTabContext", {
                    context: null,
                });
                break;
            case "sendChatMessage":
                try {
                    // Always try to analyze the current page with the message as query
                    // for the most relevant context to the current message
                    try {
                        // Analyze with the chat message as query
                        this.additionalContext =
                            await this.analyzeCurrentWebpage(data.message);

                        // Add a system message to let the user know we're using embeddings
                        this.addSystemMessage(
                            "Using GPT embeddings to find relevant context for your question..."
                        );
                    } catch (error) {
                        console.log(
                            "Could not analyze page for chat, continuing with basic context",
                            error
                        );
                    }

                    const chatResponse = await this.sendMessageToBackground({
                        action: "chatMessage",
                        message: data.message,
                        context: this.getPageContext(),
                        currentText: this.activeElement
                            ? this.getInputText()
                            : "",
                        additionalContext: this.additionalContext,
                        useEmbeddings: true,
                    });

                    if (chatResponse.success) {
                        this.postMessageToSidebar("addChatMessage", {
                            sender: "assistant",
                            message: chatResponse.reply,
                        });
                    } else {
                        this.postMessageToSidebar("addChatMessage", {
                            sender: "assistant",
                            message: `Error: ${chatResponse.error}`,
                        });
                    }
                } catch (error) {
                    console.error("Chat message failed:", error);
                    this.postMessageToSidebar("addChatMessage", {
                        sender: "assistant",
                        message: `Error: ${error.message}`,
                    });
                }
                break;
            case "loadSettings":
                const settings = await this.sendMessageToBackground({
                    action: "getSettings",
                });
                this.postMessageToSidebar("settingsLoaded", { settings });
                break;
            case "saveSetting":
                await this.sendMessageToBackground({
                    action: "saveSetting",
                    key: data.key,
                    value: data.value,
                });
                break;
            case "testApiKey":
                const testResult = await this.sendMessageToBackground({
                    action: "testApiKey",
                });
                this.postMessageToSidebar("apiKeyStatus", {
                    success: testResult.success,
                    message: testResult.message,
                });
                break;
            case "testScrapeApi":
                const scrapeTestResult = await this.sendMessageToBackground({
                    action: "testScrapeApi",
                });
                this.postMessageToSidebar("scrapeApiStatus", {
                    success: scrapeTestResult.success,
                    message: scrapeTestResult.message,
                });
                break;
            case "analyzeCurrentPage":
                try {
                    // Analyze the current webpage with the given query
                    const pageContext = await this.analyzeCurrentWebpage(
                        data.query
                    );

                    // Update the sidebar with analysis results
                    this.postMessageToSidebar("updateTabContext", {
                        context: pageContext,
                    });
                } catch (error) {
                    console.error("Failed to analyze current page:", error);
                    this.postMessageToSidebar("showLoading", {
                        message: `Analysis failed: ${error.message}`,
                    });
                }
                break;
            // ... handle other actions like chat, settings, etc.
        }
    }

    async handleTextAction(action) {
        if (!this.activeElement) {
            alert("Please focus a text field first.");
            return;
        }
        const originalText = this.getInputText();
        this.postMessageToSidebar("showLoading", {
            message: "Analyzing text...",
        });

        const response = await this.sendMessageToBackground({
            action: action,
            text: originalText,
            context: this.getPageContext(),
            additionalContext: this.additionalContext,
        });

        if (response.success) {
            const suggestedText =
                response.improvedText ||
                response.rewrittenText ||
                response.elaboratedText;
            this.postMessageToSidebar("showConfirmation", {
                originalText,
                suggestedText,
            });
        }
    }

    async getSuggestionsForActiveElement() {
        // Logic to get suggestions for the active text element
    } // --- Getters & Setters for Active Element ---
    getInputText() {
        // If we have selected text, use that instead
        if (this.selectedText && this.selectedText.trim().length > 0) {
            return this.selectedText;
        }

        if (!this.activeElement) return "";
        return this.activeElement.isContentEditable
            ? this.activeElement.textContent
            : this.activeElement.value;
    }
    setInputText(text) {
        if (!this.activeElement) return;

        // If we have selected text, replace just the selection
        if (this.selectedText && this.selectedText.trim().length > 0) {
            this.replaceSelectedText(text);
            this.selectedText = null; // Clear selected text
            return;
        }

        // Otherwise replace entire content
        if (this.activeElement.isContentEditable) {
            this.activeElement.textContent = text;
        } else {
            this.activeElement.value = text;
        }
    }

    replaceSelectedText(newText) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        if (this.activeElement.isContentEditable) {
            // For contenteditable elements
            range.deleteContents();
            const textNode = document.createTextNode(newText);
            range.insertNode(textNode);

            // Move cursor to end of inserted text
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // For input/textarea elements
            const start = this.activeElement.selectionStart;
            const end = this.activeElement.selectionEnd;
            const value = this.activeElement.value;

            this.activeElement.value =
                value.substring(0, start) + newText + value.substring(end);

            // Set cursor position after the inserted text
            const newCursorPos = start + newText.length;
            this.activeElement.setSelectionRange(newCursorPos, newCursorPos);
        }
    }

    getPageContext() {
        // Simplified context for the current page
        return {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
        };
    }

    // --- Communication Helpers ---
    postMessageToSidebar(action, data) {
        this.sidebarIframe.contentWindow.postMessage({ action, data }, "*");
    }

    async sendMessageToBackground(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, resolve);
        });
    }

    // Auto-refresh enhanced context for better GPT integration
    async refreshEnhancedContext(query = null) {
        if (!this.additionalContext || !this.additionalContext.title) {
            return false;
        }

        // Try to find the tab by title/URL to refresh its content
        const tabs = await this.sendMessageToBackground({
            action: "getAllTabs",
        });
        if (!tabs.success) return false;

        const matchingTab = tabs.tabs.find(
            (tab) =>
                tab.title === this.additionalContext.title ||
                tab.url === this.additionalContext.url
        );

        if (matchingTab) {
            const refreshQuery =
                query || "Extract updated content and key information";
            const refreshResponse = await this.sendMessageToBackground({
                action: "enhancedContentExtraction",
                tabId: matchingTab.id,
                query: refreshQuery,
            });

            if (refreshResponse.success) {
                this.additionalContext = refreshResponse;
                this.postMessageToSidebar("updateTabContext", {
                    context: this.additionalContext,
                });
                return true;
            }
        }
        return false;
    }

    // Enhanced text action with context-aware query refinement
    async handleEnhancedTextAction(action, contextQuery = null) {
        if (!this.activeElement) {
            alert("Please focus a text field first.");
            return;
        }

        const originalText = this.getInputText();
        this.postMessageToSidebar("showLoading", {
            message: "Analyzing text with GPT embeddings context...",
        });

        try {
            // Generate context query based on action and current text
            let actionQuery = contextQuery;
            if (!actionQuery) {
                switch (action) {
                    case "improveText":
                        actionQuery = `Find information relevant to improving: "${originalText.substring(
                            0,
                            100
                        )}"}`;
                        break;
                    case "rewriteText":
                        actionQuery = `Find context and alternatives for: "${originalText.substring(
                            0,
                            100
                        )}"}`;
                        break;
                    case "elaborateText":
                        actionQuery = `Find detailed information to elaborate on: "${originalText.substring(
                            0,
                            100
                        )}"}`;
                        break;
                    default:
                        actionQuery = `Find information relevant to: "${originalText.substring(
                            0,
                            100
                        )}"}`;
                }
            }

            // Analyze the current webpage directly with embeddings
            const pageContext = await this.analyzeCurrentWebpage(actionQuery);

            // Add a system message indicating GPT embeddings are being used
            this.addSystemMessage(
                "Using GPT embeddings to find relevant page context for your text..."
            );

            const response = await this.sendMessageToBackground({
                action: action,
                text: originalText,
                context: this.getPageContext(),
                additionalContext: pageContext,
                useEmbeddings: true,
            });

            if (response.success) {
                const suggestedText =
                    response.improvedText ||
                    response.rewrittenText ||
                    response.elaboratedText;
                this.postMessageToSidebar("showConfirmation", {
                    originalText,
                    suggestedText,
                });
            } else {
                this.postMessageToSidebar("showLoading", {
                    message: `Error: ${response.error}`,
                });
            }
        } catch (error) {
            console.error("Enhanced text action failed:", error);
            this.postMessageToSidebar("showLoading", {
                message: `Error: ${error.message}`,
            });

            // Fall back to regular text action
            this.handleTextAction(action);
        }
    }

    /**
     * Analyze the current webpage using GPT embeddings
     * @param {string} query - The query to use for context retrieval
     * @returns {Promise<Object>} - The context object with relevant sections
     */
    async analyzeCurrentWebpage(query) {
        this.postMessageToSidebar("showLoading", {
            message: "Analyzing current webpage with GPT embeddings...",
        });

        try {
            // Get the current HTML content
            const htmlContent = document.documentElement.outerHTML;

            // Process the HTML with the content processor directly in this page
            // First ensure the ContentProcessor is available
            await this.ensureProcessorAvailable();

            // Create a content processor
            const processor = new ContentProcessor({
                apiKey: await this.getApiKey(),
                chunkSize: 750,
            });

            // Process the content
            const result = await processor.getFullContextWithEmbeddings({
                html: htmlContent,
                query: query || "Extract most important information",
                topK: 5,
            });

            if (result.success) {
                // Store the context for use in other functions
                this.additionalContext = result.context;

                this.postMessageToSidebar("updateTabContext", {
                    context: this.additionalContext,
                });

                return this.additionalContext;
            } else {
                throw new Error(result.error || "Analysis failed");
            }
        } catch (error) {
            console.error("Webpage analysis failed:", error);
            this.postMessageToSidebar("showLoading", {
                message: `Analysis failed: ${error.message}`,
            });
            return null;
        }
    }

    /**
     * Ensure the content processor and related components are available
     * @returns {Promise<void>}
     */
    async ensureProcessorAvailable() {
        // Check if processor is already available
        if (window.ContentProcessor) {
            return;
        }

        // Inject the scripts
        return new Promise((resolve, reject) => {
            // Load each required script in sequence
            const scripts = [
                "html_parser.js",
                "content_chunker.js",
                "semantic_search.js",
                "content_processor.js",
            ];

            let loaded = 0;

            scripts.forEach((script) => {
                const scriptEl = document.createElement("script");
                scriptEl.src = chrome.runtime.getURL(script);
                scriptEl.onload = () => {
                    loaded++;
                    if (loaded === scripts.length) {
                        // Run the initializer script
                        const initScript = document.createElement("script");
                        initScript.src = chrome.runtime.getURL(
                            "inject_processor.js"
                        );
                        initScript.onload = () => resolve();
                        initScript.onerror = () =>
                            reject(
                                new Error(
                                    "Failed to load processor initializer"
                                )
                            );
                        document.head.appendChild(initScript);
                    }
                };
                scriptEl.onerror = () =>
                    reject(new Error(`Failed to load ${script}`));
                document.head.appendChild(scriptEl);
            });
        });
    }

    /**
     * Get OpenAI API key from storage
     * @returns {Promise<string>} - The API key
     */
    async getApiKey() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: "getSettings" },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else if (response && response.openai_api_key) {
                        resolve(response.openai_api_key);
                    } else {
                        reject(new Error("API key not found in settings"));
                    }
                }
            );
        });
    }

    /**
     * Add a system message to the chat
     * @param {string} message - The system message to display
     * @param {string} type - The type of message (default, embeddings, etc.)
     */
    addSystemMessage(message, type = "embeddings") {
        this.postMessageToSidebar("addSystemMessage", {
            message: message,
            type: type,
        });
    }
    addContextToSelection() {
        if (!this.activeElement) {
            alert("Please focus on a text field first.");
            return;
        }

        const selectedText = this.getInputText().substring(
            this.lastCaretPosition.start,
            this.lastCaretPosition.end
        );

        if (!selectedText) {
            alert("Please select some text to add context.");
            return;
        }

        // Here you would implement the logic to add context to the selected text
        // For now, we just show an alert
        alert(`Context added to: "${selectedText}"`);
    }

    // --- Floating Toolbar Methods ---
    isTextInput(element) {
        return (
            element &&
            (element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA" ||
                element.isContentEditable)
        );
    }
    handleTyping(e) {
        // Clear existing timer
        clearTimeout(this.typingTimer);

        // Hide toolbar while typing
        this.hideFloatingToolbar();

        // Set new timer to show toolbar after delay
        this.typingTimer = setTimeout(() => {
            this.showFloatingToolbarIfAppropriate(e.target);
        }, this.typingDelay);
    }
    handleTextSelection(e) {
        // Debounce rapid selection changes
        const debounceKey = "textSelection";
        if (this.debounceTimers.has(debounceKey)) {
            clearTimeout(this.debounceTimers.get(debounceKey));
        }

        this.debounceTimers.set(
            debounceKey,
            setTimeout(() => {
                this.processTextSelection(e);
                this.debounceTimers.delete(debounceKey);
            }, 150)
        );
    }

    processTextSelection(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // Only show toolbar if there's meaningful selected text
        if (!selectedText || selectedText.length < 2) {
            return;
        }

        // Check if selection is within a text input element
        const activeElement = document.activeElement;
        if (!this.isTextInput(activeElement)) {
            return;
        }

        // Don't show on password fields or protected elements
        if (
            activeElement.type === "password" ||
            activeElement.classList.contains("no-webpilot") ||
            activeElement.closest(".no-webpilot")
        ) {
            return;
        }

        // Set the active element and show toolbar
        this.activeElement = activeElement;
        this.showFloatingToolbarForSelection(selection, selectedText);
    }

    showFloatingToolbarForSelection(selection, selectedText) {
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) return;

        // Position toolbar above the selection
        const toolbarWidth = 280;
        const toolbarHeight = 50;

        let x = rect.left + rect.width / 2 - toolbarWidth / 2;
        let y = rect.top - toolbarHeight - 10;

        // Adjust horizontal position if off-screen
        if (x + toolbarWidth > window.innerWidth + window.scrollX) {
            x = window.innerWidth + window.scrollX - toolbarWidth - 10;
        }
        if (x < window.scrollX + 10) {
            x = window.scrollX + 10;
        }

        // Adjust vertical position if off-screen
        if (y < window.scrollY + 10) {
            y = rect.bottom + 10; // Show below selection instead
        }

        // Add scroll offset
        x += window.scrollX;
        y += window.scrollY;

        // Position and show toolbar
        this.floatingToolbar.style.left = `${x}px`;
        this.floatingToolbar.style.top = `${y}px`;
        this.floatingToolbar.classList.add("show");

        // Store selected text for processing
        this.selectedText = selectedText;

        // Auto-fetch context
        this.autoFetchCurrentPageContext();
    }
    showFloatingToolbarIfAppropriate(element) {
        if (!this.isTextInput(element)) {
            return;
        }

        // Only show if there's some text content
        const text = element.isContentEditable
            ? element.textContent
            : element.value;
        if (!text || text.trim().length < 3) {
            return;
        }

        // Don't show if element is not visible or too small
        const rect = element.getBoundingClientRect();
        if (
            rect.width < 50 ||
            rect.height < 20 ||
            rect.top < 0 ||
            rect.left < 0 ||
            rect.top > window.innerHeight ||
            rect.left > window.innerWidth
        ) {
            return;
        }

        // Don't show on password fields or other sensitive inputs
        if (
            element.type === "password" ||
            element.type === "hidden" ||
            element.classList.contains("no-webpilot") ||
            element.closest(".no-webpilot")
        ) {
            return;
        }

        this.activeElement = element;
        this.showFloatingToolbar(element);
    }
    showFloatingToolbar(element) {
        const position = this.getCaretPosition(element);
        if (!position) return;

        // Ensure toolbar doesn't go off-screen
        const toolbarWidth = 280; // Approximate width
        const toolbarHeight = 50; // Approximate height

        let x = position.x;
        let y = position.y - toolbarHeight - 10; // 10px gap above caret

        // Adjust horizontal position if off-screen
        if (x + toolbarWidth > window.innerWidth + window.scrollX) {
            x = window.innerWidth + window.scrollX - toolbarWidth - 10;
        }
        if (x < window.scrollX + 10) {
            x = window.scrollX + 10;
        }

        // Adjust vertical position if off-screen
        if (y < window.scrollY + 10) {
            y = position.y + 30; // Show below caret instead
        }

        // Position toolbar
        this.floatingToolbar.style.left = `${x}px`;
        this.floatingToolbar.style.top = `${y}px`;

        // Show with animation
        this.floatingToolbar.classList.add("show");

        // Auto-fetch context from current page
        this.autoFetchCurrentPageContext();
    }
    hideFloatingToolbar() {
        this.floatingToolbar.classList.remove("show");
        clearTimeout(this.typingTimer);
        // Clear selected text reference when hiding toolbar
        this.selectedText = null;
    }
    getCaretPosition(element) {
        let x = 0,
            y = 0;

        try {
            if (element.isContentEditable) {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) {
                        // If no selection, use element position
                        const elementRect = element.getBoundingClientRect();
                        x = elementRect.left + 10;
                        y = elementRect.top;
                    } else {
                        x = rect.left;
                        y = rect.top;
                    }
                } else {
                    const rect = element.getBoundingClientRect();
                    x = rect.left + 10;
                    y = rect.top;
                }
            } else if (
                element.tagName === "TEXTAREA" ||
                element.tagName === "INPUT"
            ) {
                const rect = element.getBoundingClientRect();

                // Try to get actual cursor position for inputs
                if (element.selectionStart !== undefined) {
                    // For now, approximate cursor position
                    // In a more sophisticated version, you could calculate exact position
                    const cursorRatio =
                        element.selectionStart / (element.value.length || 1);
                    x = rect.left + rect.width * Math.min(cursorRatio, 0.8);
                    y = rect.top;
                } else {
                    x = rect.left + 10;
                    y = rect.top;
                }
            } else {
                const rect = element.getBoundingClientRect();
                x = rect.left + 10;
                y = rect.top;
            }

            // Add scroll offset
            x += window.scrollX;
            y += window.scrollY;
        } catch (error) {
            console.log("Error getting caret position:", error);
            return null;
        }

        return { x, y };
    }
    async handleFloatingToolbarAction(action) {
        console.log("handleFloatingToolbarAction called with:", action);

        if (action === "addContext") {
            alert("Add context clicked!"); // Simple test
            this.showContextOptions();
            return;
        }

        if (!this.activeElement) {
            console.log("No active element found");
            alert("No active element found!"); // Simple test
            this.showFloatingError("Please focus on a text field first");
            return;
        }

        console.log("Active element:", this.activeElement);
        console.log("Input text:", this.getInputText());

        // Simple test - just show an alert for now
        alert(
            `Processing ${action} for text: "${this.getInputText().substring(
                0,
                50
            )}..."`
        );

        // Map floating toolbar actions to text actions and use the floating version
        const actionMap = {
            elaborate: "elaborateText",
            improve: "improveText",
            rewrite: "rewriteText",
        };

        const textAction = actionMap[action];
        console.log("Mapped to text action:", textAction);

        if (textAction) {
            await this.handleEnhancedTextActionFromFloating(textAction);
        }
    }
    async handleEnhancedTextActionFromFloating(action) {
        console.log(
            "handleEnhancedTextActionFromFloating called with:",
            action
        );

        // Prevent multiple simultaneous requests
        if (this.isProcessing) {
            console.log("Already processing, showing error");
            this.showFloatingError(
                "Please wait for current request to complete"
            );
            return;
        }

        const originalText = this.getInputText();
        console.log("Original text to process:", originalText);

        if (!originalText || originalText.trim().length === 0) {
            console.log("No text to process");
            this.showFloatingError("No text to process");
            return;
        }

        // Validate action
        const validActions = ["improveText", "rewriteText", "elaborateText"];
        if (!validActions.includes(action)) {
            this.showFloatingError("Invalid action");
            return;
        }

        // Set processing flag and show loading
        this.isProcessing = true;
        this.showFloatingLoading();

        try {
            const response = await this.sendMessageToBackground({
                action: action,
                text: originalText,
                context: this.getPageContext(),
                additionalContext: this.additionalContext,
            });

            if (response && response.success) {
                const suggestedText =
                    response.improvedText ||
                    response.rewrittenText ||
                    response.elaboratedText;

                if (suggestedText && suggestedText.trim().length > 0) {
                    this.showFloatingPreview(originalText, suggestedText);
                } else {
                    this.showFloatingError("No suggestions received");
                }
            } else {
                const errorMessage =
                    response?.error || "Failed to process text";
                this.showFloatingError(errorMessage);
            }
        } catch (error) {
            console.error("Error in floating toolbar action:", error);
            this.showFloatingError(
                `Error: ${error.message || "Unknown error occurred"}`
            );
        } finally {
            // Always clear processing flag
            this.isProcessing = false;
        }
    }
    showFloatingLoading() {
        console.log("showFloatingLoading called");
        // Create a small loading indicator
        const loader = document.createElement("div");
        loader.id = "webpilot-floating-loader";
        loader.innerHTML = `
            <div style="
                position: absolute;
                z-index: 1000000;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">Processing...</div>
        `;

        const position = this.getCaretPosition(this.activeElement);
        if (position) {
            loader.style.left = `${position.x}px`;
            loader.style.top = `${position.y - 30}px`;
        } else {
            // Fallback positioning
            loader.style.left = "50px";
            loader.style.top = "50px";
        }

        document.body.appendChild(loader);
        console.log("Loading indicator added to DOM");

        // Auto remove after 10 seconds
        setTimeout(() => {
            if (loader.parentNode) {
                loader.parentNode.removeChild(loader);
            }
        }, 10000);
    }

    showFloatingPreview(originalText, suggestedText) {
        // Remove any existing loader
        const existingLoader = document.getElementById(
            "webpilot-floating-loader"
        );
        if (existingLoader) {
            existingLoader.remove();
        }

        // Create preview popup
        const preview = document.createElement("div");
        preview.id = "webpilot-floating-preview";
        preview.innerHTML = `
            <div style="
                position: absolute;
                z-index: 1000000;
                background: white;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                max-width: 300px;
                padding: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
            ">
                <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">Suggested Change:</div>
                <div style="background: #f9fafb; padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 13px; max-height: 100px; overflow-y: auto;">${suggestedText}</div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        background: #6b7280;
                        color: white;
                        border: none;
                        padding: 4px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">Cancel</button>
                    <button onclick="window.webPilotController.acceptFloatingChange('${suggestedText.replace(
                        /'/g,
                        "\\'"
                    )}'); this.parentElement.parentElement.parentElement.remove()" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 4px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">Accept</button>
                </div>
            </div>
        `;

        const position = this.getCaretPosition(this.activeElement);
        preview.style.left = `${position.x}px`;
        preview.style.top = `${position.y - 150}px`;

        document.body.appendChild(preview);

        // Auto remove after 30 seconds
        setTimeout(() => {
            if (preview.parentNode) {
                preview.parentNode.removeChild(preview);
            }
        }, 30000);
    }

    acceptFloatingChange(newText) {
        this.setInputText(newText);

        // Trigger input event for reactive frameworks
        const event = new Event("input", { bubbles: true });
        this.activeElement.dispatchEvent(event);
    }

    showFloatingError(message) {
        // Remove any existing loader
        const existingLoader = document.getElementById(
            "webpilot-floating-loader"
        );
        if (existingLoader) {
            existingLoader.remove();
        }

        const error = document.createElement("div");
        error.innerHTML = `
            <div style="
                position: absolute;
                z-index: 1000000;
                background: #fee2e2;
                color: #dc2626;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                border: 1px solid #fecaca;
            ">${message}</div>
        `;

        const position = this.getCaretPosition(this.activeElement);
        error.style.left = `${position.x}px`;
        error.style.top = `${position.y - 30}px`;

        document.body.appendChild(error);

        setTimeout(() => {
            if (error.parentNode) {
                error.parentNode.removeChild(error);
            }
        }, 3000);
    }

    showContextOptions() {
        const contextMenu = document.createElement("div");
        contextMenu.id = "webpilot-context-menu";
        contextMenu.innerHTML = `
            <div style="
                position: absolute;
                z-index: 1000000;
                background: white;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                min-width: 200px;
            ">
                <div onclick="window.webPilotController.fetchCurrentPageContext(); this.parentElement.parentElement.remove()" style="
                    padding: 8px 12px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background-color 0.15s;
                " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                    📄 Use Current Page
                </div>
                <div onclick="window.webPilotController.showTabSelector(); this.parentElement.parentElement.remove()" style="
                    padding: 8px 12px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background-color 0.15s;
                " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                    🔗 Add From Other Tab
                </div>
            </div>
        `;

        const position = this.getCaretPosition(this.activeElement);
        contextMenu.style.left = `${position.x}px`;
        contextMenu.style.top = `${position.y - 100}px`;

        document.body.appendChild(contextMenu);

        // Click outside to close
        setTimeout(() => {
            document.addEventListener("click", function closeContextMenu(e) {
                if (!contextMenu.contains(e.target)) {
                    contextMenu.remove();
                    document.removeEventListener("click", closeContextMenu);
                }
            });
        }, 100);
    }

    async autoFetchCurrentPageContext() {
        try {
            // Automatically analyze current page for context
            const text = this.getInputText();
            if (text && text.length > 10) {
                this.additionalContext = await this.analyzeCurrentWebpage(text);
            }
        } catch (error) {
            // Silently fail - context is optional
            console.log("Auto-context fetch failed:", error);
        }
    }

    async fetchCurrentPageContext() {
        try {
            const text = this.getInputText();
            const query = text || "Extract key information from this page";
            this.additionalContext = await this.analyzeCurrentWebpage(query);
        } catch (error) {
            this.showFloatingError("Failed to fetch page context");
        }
    }

    async showTabSelector() {
        try {
            const tabs = await this.sendMessageToBackground({
                action: "getAllTabs",
            });

            if (tabs.success) {
                this.createTabSelectorMenu(tabs.tabs);
            }
        } catch (error) {
            this.showFloatingError("Failed to load tabs");
        }
    }

    createTabSelectorMenu(tabs) {
        const menu = document.createElement("div");
        menu.id = "webpilot-tab-selector";

        const tabsHtml = tabs
            .slice(0, 5)
            .map(
                (tab) => `
            <div onclick="window.webPilotController.loadTabContextFromFloating(${tab.id}); this.parentElement.parentElement.remove()" style="
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                transition: background-color 0.15s;
                border-bottom: 1px solid #f3f4f6;
                max-width: 250px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                <div style="font-weight: 500; font-size: 13px;">${tab.title}</div>
                <div style="font-size: 11px; color: #6b7280;">${tab.url}</div>
            </div>
        `
            )
            .join("");

        menu.innerHTML = `
            <div style="
                position: absolute;
                z-index: 1000000;
                background: white;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                max-height: 300px;
                overflow-y: auto;
            ">
                <div style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Select Tab</div>
                ${tabsHtml}
            </div>
        `;

        const position = this.getCaretPosition(this.activeElement);
        menu.style.left = `${position.x}px`;
        menu.style.top = `${position.y - 200}px`;

        document.body.appendChild(menu);
    }

    async loadTabContextFromFloating(tabId) {
        try {
            const text = this.getInputText();
            const query = text || "Extract relevant information";

            const response = await this.sendMessageToBackground({
                action: "enhancedContentExtraction",
                tabId: tabId,
                query: query,
            });

            if (response.success) {
                this.additionalContext = response;
            } else {
                this.showFloatingError("Failed to load tab context");
            }
        } catch (error) {
            this.showFloatingError("Error loading context");
        }
    }

    // --- Existing Methods Continue ---
}

// Make controller globally accessible for floating toolbar callbacks
window.webPilotController = new WebPilotController();
