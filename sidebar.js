class WebPilotSidebar {
    constructor() {
        this.activeView = "assistant";
        this.additionalContext = null;
        this.init();
    }

    init() {
        this.addEventListeners();
        this.loadSettings();
    }

    addEventListeners() {
        document
            .getElementById("webpilot-drag-handle")
            .addEventListener("click", () => {
                this.sendMessageToContentScript("toggleCollapse");
            });

        // Navigation
        document.querySelectorAll(".nav-btn").forEach((btn) => {
            btn.addEventListener("click", (event) => {
                event.stopPropagation();
                this.switchView(btn.dataset.view);
            });
        });

        // Assistant View
        document
            .getElementById("webpilot-improve")
            .addEventListener("click", () =>
                this.handleTextAction("improveText")
            );
        document
            .getElementById("webpilot-rewrite")
            .addEventListener("click", () =>
                this.handleTextAction("rewriteText")
            );
        document
            .getElementById("webpilot-elaborate")
            .addEventListener("click", () =>
                this.handleTextAction("elaborateText")
            );

        // Context Toggles
        document.querySelectorAll(".context-header").forEach((header) => {
            header.addEventListener("click", () => {
                const content = document.getElementById(header.dataset.toggle);
                content.style.display =
                    content.style.display === "none" ? "block" : "none";
                header.querySelector(".toggle-arrow").textContent =
                    content.style.display === "none" ? "▶" : "▼";
                if (
                    header.dataset.toggle === "tab-context-content" &&
                    content.style.display !== "none"
                ) {
                    this.loadTabList();
                }
            });
        }); // Tab Context
        document
            .getElementById("webpilot-load-tab-context")
            .addEventListener("click", () => this.loadTabContext());
        document
            .getElementById("webpilot-enhanced-load")
            .addEventListener("click", () => this.loadEnhancedTabContext());
        document
            .getElementById("webpilot-search-content")
            .addEventListener("click", () => this.searchWebContent());
        document
            .getElementById("webpilot-clear-tab-context")
            .addEventListener("click", () => this.clearTabContext());

        // Chat View
        document
            .getElementById("webpilot-chat-send")
            .addEventListener("click", () => this.sendChatMessage());
        document
            .getElementById("webpilot-chat-input")
            .addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });

        // Settings View
        document
            .getElementById("saveApiKey")
            .addEventListener("click", () => this.saveApiKey());
        document
            .getElementById("testApiKey")
            .addEventListener("click", () => this.testApiKey());

        // Analyze Current Page
        document
            .getElementById("webpilot-analyze-page")
            .addEventListener("click", () => this.analyzeCurrentPage());

        // Listen for messages from the content script
        window.addEventListener("message", (event) => {
            if (!event.data || !event.data.action) return;

            const { action, data } = event.data;

            if (action === "updateCollapseState") {
                this.handleCollapseState(data.isCollapsed);
            } else if (action === "showConfirmation") {
                this.showConfirmation(data.originalText, data.suggestedText);
            } else if (action === "showSuggestions") {
                this.updateSuggestions(data.suggestions);
            } else if (action === "showLoading") {
                this.showLoadingInSuggestions(data.message);
            } else if (action === "updateTabContext") {
                this.displayTabContext(data.context);

                // Check if this is a full page context with relevant chunks
                if (data.context && data.context.full_page_context) {
                    this.updateAnalysisDisplay(data.context);
                }
            } else if (action === "addSystemMessage") {
                this.addSystemMessage(data.message, data.type);
            } else if (action === "addChatMessage") {
                this.addChatMessage(data.sender, data.message);
            } else if (action === "settingsLoaded") {
                if (data.settings.openai_api_key) {
                    document.getElementById("apiKey").value =
                        data.settings.openai_api_key;
                }
                if (data.settings.scrape_api_url) {
                    document.getElementById("scrapeApiUrl").value =
                        data.settings.scrape_api_url;
                }
            } else if (action === "apiKeyStatus") {
                this.showStatus(
                    data.message,
                    data.success ? "success" : "error"
                );
            } else if (action === "scrapeApiStatus") {
                this.showStatus(
                    data.message,
                    data.success ? "success" : "error"
                );
            } else if (action === "updateAnalysisDisplay") {
                this.updateAnalysisDisplay(data.context);
            }
        });
    }

    // --- Communication with Content Script ---
    sendMessageToContentScript(action, data) {
        window.parent.postMessage(
            { type: "FROM_WEBPILOT_SIDEBAR", action, data },
            "*"
        );
    }

    // --- View Switching ---
    switchView(viewName) {
        // Update nav buttons
        document
            .querySelectorAll(".nav-btn")
            .forEach((btn) => btn.classList.remove("active"));
        document
            .querySelector(`.nav-btn[data-view="${viewName}"]`)
            .classList.add("active");

        // Show the correct view
        document
            .querySelectorAll(".view")
            .forEach((view) => view.classList.remove("active"));
        document.getElementById(`${viewName}-view`).classList.add("active");

        this.activeView = viewName;
    }

    // --- Assistant Logic ---
    handleTextAction(action) {
        this.sendMessageToContentScript(action);
    }

    showLoadingInSuggestions(message = "Loading...") {
        document.getElementById("webpilot-suggestions").style.display = "block";
        document.getElementById(
            "webpilot-confirmation-container"
        ).style.display = "none";
        document.getElementById(
            "webpilot-suggestions"
        ).innerHTML = `<div class="loading">${message}</div>`;
    }

    updateSuggestions(suggestions) {
        const container = document.getElementById("webpilot-suggestions");
        if (typeof suggestions === "string") {
            container.innerHTML = `<div class="suggestion-item">${suggestions}</div>`;
        } else {
            container.innerHTML = suggestions
                .map((s) => `<div class="suggestion-item">${s}</div>`)
                .join("");
        }
    }

    showConfirmation(originalText, suggestedText) {
        document.getElementById("webpilot-suggestions").style.display = "none";
        const container = document.getElementById(
            "webpilot-confirmation-container"
        );
        container.style.display = "block";

        container.innerHTML = `
          <div class="webpilot-diff-view">
              <div class="diff-header">Suggested Change</div>
              <div class="diff-content">
                  <div class="diff-pane original"><div class="pane-title">Before</div><pre>${originalText}</pre></div>
                  <div class="diff-pane suggested"><div class="pane-title">After</div><pre>${suggestedText}</pre></div>
              </div>
          </div>
          <div class="webpilot-confirmation-actions">
              <button id="accept-change" class="webpilot-accept-btn">✅ Accept</button>
              <button id="reject-change" class="webpilot-reject-btn">❌ Reject</button>
          </div>
        `;

        document
            .getElementById("accept-change")
            .addEventListener("click", () => {
                this.sendMessageToContentScript("acceptChange", {
                    newText: suggestedText,
                });
                this.hideConfirmation();
            });
        document
            .getElementById("reject-change")
            .addEventListener("click", () => this.hideConfirmation());
    }

    hideConfirmation() {
        document.getElementById(
            "webpilot-confirmation-container"
        ).style.display = "none";
        document.getElementById("webpilot-suggestions").style.display = "block";
        this.sendMessageToContentScript("getSuggestions");
    }

    // --- Context Logic ---
    async loadTabList() {
        // This needs to message the content script, which messages the background script.
        // For simplicity, we'll assume the content script will push the tab list to us.
        // Let's create a placeholder listener for now.
        window.addEventListener("message", (event) => {
            const { action, data } = event.data;
            if (action === "updateTabList") {
                const selector = document.getElementById(
                    "webpilot-tab-selector"
                );
                selector.innerHTML =
                    '<option value="">Select a tab...</option>';
                data.tabs.forEach((tab) => {
                    const option = document.createElement("option");
                    option.value = tab.id;
                    option.textContent = tab.title.substring(0, 40) + "...";
                    selector.appendChild(option);
                });
            }
        });
        this.sendMessageToContentScript("getTabList");
    }
    loadTabContext() {
        const tabId = document.getElementById("webpilot-tab-selector").value;
        if (tabId) {
            this.sendMessageToContentScript("loadTabContext", { tabId });
        }
    }

    loadEnhancedTabContext() {
        const tabId = document.getElementById("webpilot-tab-selector").value;
        const query =
            document.getElementById("content-search-query").value ||
            "Extract main content and key information";

        if (tabId) {
            this.showLoadingInSuggestions(
                "Processing content with enhanced extraction..."
            );
            this.sendMessageToContentScript("loadEnhancedTabContext", {
                tabId,
                query,
            });
        }
    }

    searchWebContent() {
        const tabId = document.getElementById("webpilot-tab-selector").value;
        const query = document.getElementById("content-search-query").value;

        if (!query.trim()) {
            this.showStatus("Please enter a search query", "error");
            return;
        }

        if (tabId) {
            this.showLoadingInSuggestions("Searching web content...");
            this.sendMessageToContentScript("searchWebContent", {
                tabId,
                query,
            });
        } else {
            this.showStatus("Please select a tab first", "error");
        }
    }

    clearTabContext() {
        this.sendMessageToContentScript("clearTabContext");
        document.getElementById("webpilot-tab-context-display").style.display =
            "none";
        this.additionalContext = null;
    }
    displayTabContext(context) {
        if (!context) {
            document.getElementById(
                "webpilot-tab-context-display"
            ).style.display = "none";
            return;
        }

        const display = document.getElementById("webpilot-tab-context-display");
        document.getElementById("tab-context-title").textContent =
            context.title;

        // Handle enhanced content with chunks
        if (
            context.most_relevant_chunks &&
            context.most_relevant_chunks.length > 0
        ) {
            document.getElementById(
                "tab-context-snippet"
            ).textContent = `Enhanced content processed (${
                context.chunks?.length || 0
            } chunks analyzed)`;

            const chunksDisplay = document.getElementById("chunks-display");
            const relevantChunks = document.getElementById("relevant-chunks");

            chunksDisplay.innerHTML = context.most_relevant_chunks
                .map(
                    (chunk, index) => `
                <div class="chunk-item" style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <div class="chunk-header" style="font-weight: bold; color: #333;">
                        Section ${index + 1}: ${chunk.title || "Untitled"} 
                        <span style="font-size: 0.8em; color: #666;">(Score: ${(
                            chunk.similarity_score * 100
                        ).toFixed(1)}%)</span>
                    </div>
                    <div class="chunk-content" style="margin-top: 5px; font-size: 0.9em;">
                        ${chunk.content.substring(0, 200)}${
                        chunk.content.length > 200 ? "..." : ""
                    }
                    </div>
                </div>
            `
                )
                .join("");

            relevantChunks.style.display = "block";
        } else {
            // Basic content display
            document.getElementById("tab-context-snippet").textContent =
                context.content
                    ? context.content.substring(0, 100) + "..."
                    : "No content extracted";
            document.getElementById("relevant-chunks").style.display = "none";
        }

        display.style.display = "block";
    }

    /**
     * Analyze the current webpage with GPT embeddings
     */
    analyzeCurrentPage() {
        const query =
            document.getElementById("page-analysis-query").value ||
            "Extract the most important information from this page";

        this.showStatus("Analyzing current webpage...", "info");

        // Show loading in the analysis display
        const analysisDisplay = document.getElementById(
            "webpilot-page-analysis-display"
        );
        analysisDisplay.style.display = "block";
        analysisDisplay.innerHTML =
            '<div class="loading">Analyzing webpage content with GPT embeddings...</div>';

        // Request page analysis from content script
        this.sendMessageToContentScript("analyzeCurrentPage", { query });
    }

    /**
     * Update the analysis display with results
     * @param {Object} context - The analysis context with relevant chunks
     */
    updateAnalysisDisplay(context) {
        const analysisDisplay = document.getElementById(
            "webpilot-page-analysis-display"
        );
        const chunksContainer = document.getElementById("page-relevant-chunks");
        const chunksDisplay = document.getElementById("page-chunks-display");

        // Set the page title
        document.getElementById("page-analysis-title").textContent =
            context.title || "Current Page";

        // Show the display
        analysisDisplay.style.display = "block";

        // Check if we have relevant chunks
        if (context.relevant_chunks && context.relevant_chunks.length > 0) {
            // Clear previous content
            chunksDisplay.innerHTML = "";

            // Add each chunk
            context.relevant_chunks.forEach((chunk) => {
                const chunkEl = document.createElement("div");
                chunkEl.className = "chunk-item";

                const relevancePercent = (chunk.similarity_score * 100).toFixed(
                    1
                );

                chunkEl.innerHTML = `
                    <div class="chunk-title">${
                        chunk.title || "Untitled Section"
                    }</div>
                    <div class="chunk-content">${chunk.content.substring(
                        0,
                        200
                    )}${chunk.content.length > 200 ? "..." : ""}</div>
                    <div class="chunk-relevance">${relevancePercent}% relevant</div>
                `;

                chunksDisplay.appendChild(chunkEl);
            });

            // Show the chunks container
            chunksContainer.style.display = "block";
        } else {
            // No chunks available
            chunksContainer.style.display = "none";
            chunksDisplay.innerHTML =
                '<div class="no-chunks">No relevant sections found.</div>';
        }
    }

    // --- Chat Logic ---
    sendChatMessage() {
        const input = document.getElementById("webpilot-chat-input");
        const message = input.value.trim();
        if (!message) return;

        this.addChatMessage("user", message);
        this.sendMessageToContentScript("sendChatMessage", { message });
        input.value = "";
    }

    addChatMessage(sender, message) {
        const container = document.getElementById("webpilot-chat-messages");
        const messageEl = document.createElement("div");
        messageEl.className = `message ${sender}`;
        messageEl.textContent = message;
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Add a system message to the chat
     * @param {string} message - The message to display
     * @param {string} type - The type of system message
     */
    addSystemMessage(message, type = "default") {
        const chatContainer = document.getElementById(
            "webpilot-chat-container"
        );
        const systemMessageDiv = document.createElement("div");
        systemMessageDiv.className = `system-message ${type}`;
        systemMessageDiv.textContent = message;

        chatContainer.appendChild(systemMessageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // --- Settings Logic ---
    async loadSettings() {
        // Request settings from content script (which gets from storage)
        this.sendMessageToContentScript("loadSettings");
    }
    saveApiKey() {
        const apiKey = document.getElementById("apiKey").value;
        this.sendMessageToContentScript("saveSetting", {
            key: "openai_api_key",
            value: apiKey,
        });
        this.showStatus("API Key saved!", "success");
    }

    testApiKey() {
        this.showStatus("Testing connection...", "info");
        this.sendMessageToContentScript("testApiKey");
    }

    showStatus(message, type) {
        const statusEl = document.getElementById("status");
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = "block";
        setTimeout(() => (statusEl.style.display = "none"), 3000);
    }

    handleCollapseState(isCollapsed) {
        const container = document.querySelector(".webpilot-sidebar-container");
        const icon = document.getElementById("webpilot-icon");
        if (isCollapsed) {
            container.classList.add("is-collapsed");
            icon.textContent = "📖"; // Change icon to show it can be opened
        } else {
            container.classList.remove("is-collapsed");
            icon.textContent = "✍️"; // Restore original icon
        }
    }
}

new WebPilotSidebar();
