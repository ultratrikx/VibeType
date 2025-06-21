class WebPilot {
    constructor() {
        this.sidebar = null;
        this.currentInput = null;
        this.isEnabled = true;
        this.additionalContext = null;
        this.isMouseOverSidebar = false;
        this.init();
    }

    init() {
        this.loadSettings();
        this.observeTextInputs();
        this.createSidebar();
        this.setupKeyboardShortcuts();
    }

    async loadSettings() {
        const result = await chrome.storage.sync.get([
            "webpilot_enabled",
            "openai_api_key",
        ]);
        this.isEnabled = result.webpilot_enabled !== false; // Default to true
        this.apiKey = result.openai_api_key;
    }

    observeTextInputs() {
        // Initial detection
        this.detectTextInputs();

        // Observe for dynamically added inputs
        const observer = new MutationObserver(() => {
            this.detectTextInputs();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    detectTextInputs() {
        const selectors = [
            'input[type="text"]',
            'input[type="email"]',
            'input[type="search"]',
            "textarea",
            '[contenteditable="true"]',
            '[contenteditable=""]',
            ".ql-editor", // Quill editor
            ".ProseMirror", // ProseMirror editor
            ".notion-page-content", // Notion
            ".gmail_default", // Gmail
            ".editable", // Common editable class
            '[role="textbox"]',
        ];

        const inputs = document.querySelectorAll(selectors.join(","));

        inputs.forEach((input) => {
            if (!input.hasAttribute("data-webpilot-initialized")) {
                this.initializeInput(input);
            }
        });
    }

    initializeInput(input) {
        input.setAttribute("data-webpilot-initialized", "true");

        // Add focus event listener
        input.addEventListener("focus", () => {
            if (this.isEnabled) {
                this.showSidebar(input);
            }
        });

        // Add blur event listener
        input.addEventListener("blur", () => {
            // A brief timeout allows for events like 'mouseenter' on the sidebar or a focus
            // change to an element within the sidebar to be processed before we check.
            // This prevents the sidebar from closing when the user clicks on it.
            setTimeout(() => {
                if (
                    !this.isMouseOverSidebar &&
                    !this.sidebar.contains(document.activeElement)
                ) {
                    this.hideSidebar();
                }
            }, 200);
        });

        // Add input event listener for real-time suggestions
        input.addEventListener("input", (e) => {
            if (this.isEnabled && this.currentInput === input) {
                this.debounce(() => this.getSuggestions(input), 500)();
            }
        });
    }

    createSidebar() {
        this.sidebar = document.createElement("div");
        this.sidebar.id = "webpilot-sidebar";
        this.sidebar.innerHTML = `
      <div class="webpilot-header">
        <span class="webpilot-title">WebPilot</span>
        <button class="webpilot-close" id="webpilot-close">×</button>
      </div>
      <div class="webpilot-content">
        <div class="webpilot-context-section">
          <div class="webpilot-context-header">
            <span>📄 Current Page</span>
            <button class="webpilot-context-toggle" id="webpilot-context-toggle">▼</button>
          </div>
          <div class="webpilot-context-info" id="webpilot-context-info">
            <div class="context-item">
              <strong>Title:</strong> <span id="context-title">Loading...</span>
            </div>
            <div class="context-item">
              <strong>URL:</strong> <span id="context-url">Loading...</span>
            </div>
          </div>
        </div>
        
        <div class="webpilot-tab-context-section">
          <div class="webpilot-tab-context-header">
            <span>🔗 Additional Tab Context</span>
            <button class="webpilot-tab-context-toggle" id="webpilot-tab-context-toggle">▼</button>
          </div>
          <div class="webpilot-tab-context-content" id="webpilot-tab-context-content" style="display: none;">
            <div class="tab-selector">
              <select id="webpilot-tab-selector">
                <option value="">Select a tab for additional context...</option>
              </select>
              <button id="webpilot-load-tab-context" class="webpilot-load-context-btn">Load Context</button>
            </div>
            <div class="webpilot-tab-context-display" id="webpilot-tab-context-display" style="display: none;">
              <div class="context-item">
                <strong>Tab:</strong> <span id="tab-context-title">-</span>
              </div>
              <div class="context-item">
                <strong>Content:</strong> <span id="tab-context-content">-</span>
              </div>
              <button id="webpilot-clear-tab-context" class="webpilot-clear-context-btn">Clear Context</button>
            </div>
          </div>
        </div>        <div class="webpilot-suggestions" id="webpilot-suggestions">
          <div class="webpilot-loading">Loading suggestions...</div>
        </div>
        <div id="webpilot-confirmation-container" style="display: none;"></div>
        
        <div class="webpilot-settings-section">
          <div class="webpilot-settings-header">
            <span>⚙️ Settings</span>
            <button class="webpilot-settings-toggle" id="webpilot-settings-toggle">▼</button>
          </div>
          <div class="webpilot-settings-content" id="webpilot-settings-content" style="display: none;">
            <div class="webpilot-settings-form">
              <div class="webpilot-form-group">
                <label for="webpilot-api-key">OpenAI API Key:</label>
                <input type="password" id="webpilot-api-key" placeholder="sk-..." />
                <small class="webpilot-help-text">Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a></small>
              </div>
              <div class="webpilot-form-buttons">
                <button id="webpilot-save-api-key" class="webpilot-settings-btn">Save API Key</button>
                <button id="webpilot-test-api-key" class="webpilot-settings-btn secondary">Test Connection</button>
              </div>
              <div class="webpilot-toggle-group">
                <label>
                  <input type="checkbox" id="webpilot-enabled" checked>
                  <span>Enable WebPilot</span>
                </label>
              </div>
              <div class="webpilot-toggle-group">
                <label>
                  <input type="checkbox" id="webpilot-auto-suggestions" checked>
                  <span>Auto-suggestions</span>
                </label>
              </div>
              <div id="webpilot-settings-status" class="webpilot-settings-status" style="display: none;"></div>
            </div>
          </div>
        </div>
        
        <div class="webpilot-actions">
          <button class="webpilot-action" id="webpilot-improve">Improve</button>
          <button class="webpilot-action" id="webpilot-rewrite">Rewrite</button>
          <button class="webpilot-action" id="webpilot-elaborate">Elaborate</button>
          <button class="webpilot-action" id="webpilot-chat">Chat</button>
        </div>
        <div class="webpilot-chat-container" id="webpilot-chat-container" style="display: none;">
          <div class="webpilot-chat-messages" id="webpilot-chat-messages"></div>
          <div class="webpilot-chat-input">
            <textarea id="webpilot-chat-input" placeholder="Ask WebPilot for help..."></textarea>
            <button id="webpilot-chat-send">Send</button>
          </div>
        </div>
      </div>
    `;

        document.body.appendChild(this.sidebar);
        this.setupSidebarEvents();
    }

    setupSidebarEvents() {
        // Close button
        document
            .getElementById("webpilot-close")
            .addEventListener("click", () => {
                this.hideSidebar();
            });

        this.sidebar.addEventListener("mouseenter", () => {
            this.isMouseOverSidebar = true;
        });

        this.sidebar.addEventListener("mouseleave", () => {
            this.isMouseOverSidebar = false;
        });

        // Context toggle
        document
            .querySelector(".webpilot-context-header")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleContextSection();
            });

        // Tab context toggle
        document
            .querySelector(".webpilot-tab-context-header")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleTabContextSection();
            });

        // Load tab context
        document
            .getElementById("webpilot-load-tab-context")
            .addEventListener("click", () => {
                this.loadTabContext();
            });

        // Clear tab context
        document
            .getElementById("webpilot-clear-tab-context")
            .addEventListener("click", () => {
                this.clearTabContext();
            });

        // Action buttons
        document
            .getElementById("webpilot-improve")
            .addEventListener("click", () => {
                this.improveText();
            });

        document
            .getElementById("webpilot-rewrite")
            .addEventListener("click", () => {
                this.rewriteText();
            });

        document
            .getElementById("webpilot-elaborate")
            .addEventListener("click", () => {
                this.elaborateText();
            });

        document
            .getElementById("webpilot-chat")
            .addEventListener("click", () => {
                this.toggleChat();
            });

        // Chat functionality
        document
            .getElementById("webpilot-chat-send")
            .addEventListener("click", () => {
                this.sendChatMessage();
            });
        document
            .getElementById("webpilot-chat-input")
            .addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });

        // Settings functionality
        document
            .querySelector(".webpilot-settings-header")
            .addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleSettingsSection();
            });

        document
            .getElementById("webpilot-save-api-key")
            .addEventListener("click", () => {
                this.saveApiKey();
            });

        document
            .getElementById("webpilot-test-api-key")
            .addEventListener("click", () => {
                this.testApiKey();
            });

        document
            .getElementById("webpilot-enabled")
            .addEventListener("change", (e) => {
                this.saveSettings();
            });

        document
            .getElementById("webpilot-auto-suggestions")
            .addEventListener("change", (e) => {
                this.saveSettings();
            });
    }

    toggleContextSection() {
        const contextInfo = document.getElementById("webpilot-context-info");
        const toggle = document.getElementById("webpilot-context-toggle");
        const isHidden = contextInfo.style.display === "none";

        contextInfo.style.display = isHidden ? "block" : "none";
        toggle.textContent = isHidden ? "▼" : "▶";
    }

    toggleTabContextSection() {
        const content = document.getElementById("webpilot-tab-context-content");
        const toggle = document.getElementById("webpilot-tab-context-toggle");
        const isHidden = content.style.display === "none";

        content.style.display = isHidden ? "block" : "none";
        toggle.textContent = isHidden ? "▼" : "▶";

        if (isHidden) {
            this.loadTabList();
        }
    }

    async loadTabList() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: "getAllTabs",
            });
            if (response.success) {
                const selector = document.getElementById(
                    "webpilot-tab-selector"
                );
                selector.innerHTML =
                    '<option value="">Select a tab for additional context...</option>';

                response.tabs.forEach((tab) => {
                    if (tab.url && tab.url.startsWith("http")) {
                        const option = document.createElement("option");
                        option.value = tab.id;
                        option.textContent = `${tab.title.substring(0, 50)}${
                            tab.title.length > 50 ? "..." : ""
                        }`;
                        selector.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error("Error loading tab list:", error);
        }
    }

    async loadTabContext() {
        const selector = document.getElementById("webpilot-tab-selector");
        const tabId = parseInt(selector.value);

        if (!tabId) {
            alert("Please select a tab first");
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: "getTabContext",
                tabId: tabId,
            });

            if (response.success) {
                this.additionalContext = response.context;
                this.displayTabContext(response.context);
                this.getSuggestions(this.currentInput); // Refresh suggestions with new context
            } else {
                alert("Error loading tab context: " + response.error);
            }
        } catch (error) {
            console.error("Error loading tab context:", error);
            alert("Error loading tab context");
        }
    }

    displayTabContext(context) {
        const display = document.getElementById("webpilot-tab-context-display");
        const title = document.getElementById("tab-context-title");
        const content = document.getElementById("tab-context-content");

        title.textContent = context.title;
        content.textContent =
            context.content.substring(0, 100) +
            (context.content.length > 100 ? "..." : "");
        display.style.display = "block";
    }

    clearTabContext() {
        this.additionalContext = null;
        document.getElementById("webpilot-tab-context-display").style.display =
            "none";
        document.getElementById("webpilot-tab-selector").value = "";
        this.getSuggestions(this.currentInput); // Refresh suggestions without context
    }

    // Settings methods
    toggleSettingsSection() {
        const content = document.getElementById("webpilot-settings-content");
        const toggle = document.getElementById("webpilot-settings-toggle");
        const isHidden = content.style.display === "none";

        content.style.display = isHidden ? "block" : "none";
        toggle.textContent = isHidden ? "▼" : "▶";

        if (isHidden) {
            this.loadSettingsValues();
        }
    }

    async loadSettingsValues() {
        const result = await chrome.storage.sync.get([
            "openai_api_key",
            "webpilot_enabled",
            "webpilot_auto_suggestions",
        ]);

        const apiKeyInput = document.getElementById("webpilot-api-key");
        const enabledInput = document.getElementById("webpilot-enabled");
        const autoSuggestionsInput = document.getElementById(
            "webpilot-auto-suggestions"
        );

        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
        enabledInput.checked = result.webpilot_enabled !== false;
        autoSuggestionsInput.checked =
            result.webpilot_auto_suggestions !== false;
    }

    async saveApiKey() {
        const apiKey = document.getElementById("webpilot-api-key").value.trim();
        const statusElement = document.getElementById(
            "webpilot-settings-status"
        );

        if (!apiKey) {
            this.showSettingsStatus("Please enter an API key", "error");
            return;
        }

        if (!apiKey.startsWith("sk-")) {
            this.showSettingsStatus("API key should start with 'sk-'", "error");
            return;
        }

        try {
            await chrome.storage.sync.set({ openai_api_key: apiKey });
            this.apiKey = apiKey;
            this.showSettingsStatus("API key saved successfully!", "success");
        } catch (error) {
            this.showSettingsStatus("Error saving API key", "error");
        }
    }

    async testApiKey() {
        const apiKey =
            document.getElementById("webpilot-api-key").value.trim() ||
            this.apiKey;

        if (!apiKey) {
            this.showSettingsStatus("Please enter an API key first", "error");
            return;
        }

        this.showSettingsStatus("Testing connection...", "info");

        try {
            const response = await chrome.runtime.sendMessage({
                action: "testApiKey",
                apiKey: apiKey,
            });

            if (response.success) {
                this.showSettingsStatus("Connection successful!", "success");
            } else {
                this.showSettingsStatus(
                    `Connection failed: ${response.error}`,
                    "error"
                );
            }
        } catch (error) {
            this.showSettingsStatus("Error testing connection", "error");
        }
    }

    async saveSettings() {
        const enabled = document.getElementById("webpilot-enabled").checked;
        const autoSuggestions = document.getElementById(
            "webpilot-auto-suggestions"
        ).checked;

        try {
            await chrome.storage.sync.set({
                webpilot_enabled: enabled,
                webpilot_auto_suggestions: autoSuggestions,
            });

            this.isEnabled = enabled;
            this.showSettingsStatus("Settings saved!", "success");
        } catch (error) {
            this.showSettingsStatus("Error saving settings", "error");
        }
    }

    showSettingsStatus(message, type) {
        const statusElement = document.getElementById(
            "webpilot-settings-status"
        );
        statusElement.textContent = message;
        statusElement.className = `webpilot-settings-status ${type}`;
        statusElement.style.display = "block";

        setTimeout(() => {
            statusElement.style.display = "none";
        }, 3000);
    }

    showSidebar(input) {
        this.currentInput = input;

        // Add class to body to shift content
        document.body.classList.add("webpilot-sidebar-active");

        // Show and slide in the sidebar
        this.sidebar.classList.add("webpilot-sidebar-open");

        // Update context info
        this.updateContextInfo();

        // Get initial suggestions
        this.getSuggestions(input);
    }

    hideSidebar() {
        // Remove classes to hide sidebar and restore content position
        this.sidebar.classList.remove("webpilot-sidebar-open");
        document.body.classList.remove("webpilot-sidebar-active");

        this.currentInput = null;
        this.additionalContext = null;
    }

    updateContextInfo() {
        const context = this.getPageContext();
        document.getElementById("context-title").textContent = context.title;
        document.getElementById("context-url").textContent = context.url;
    }

    async getSuggestions(input) {
        const text = this.getInputText(input);
        if (!text.trim()) {
            this.updateSuggestions("Start typing to get suggestions...");
            return;
        }

        try {
            const context = this.getPageContext();
            const response = await chrome.runtime.sendMessage({
                action: "getSuggestions",
                text: text,
                context: context,
                additionalContext: this.additionalContext,
            });

            if (response.success) {
                this.updateSuggestions(response.suggestions);
            } else {
                this.updateSuggestions("Error: " + response.error);
            }
        } catch (error) {
            this.updateSuggestions("Error getting suggestions");
        }
    }

    getInputText(input) {
        if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
            return input.value;
        } else if (input.hasAttribute("contenteditable")) {
            return input.textContent || input.innerText;
        }
        return "";
    }

    setInputText(input, text) {
        if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
            input.value = text;
        } else if (input.hasAttribute("contenteditable")) {
            input.textContent = text;
        }

        // Trigger input event
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    getPageContext() {
        return {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
            selection: window.getSelection().toString(),
        };
    }

    updateSuggestions(suggestions) {
        const container = document.getElementById("webpilot-suggestions");
        if (typeof suggestions === "string") {
            container.innerHTML = `<div class="webpilot-suggestion">${suggestions}</div>`;
        } else {
            container.innerHTML = suggestions
                .map(
                    (suggestion) =>
                        `<div class="webpilot-suggestion" onclick="this.insertSuggestion('${suggestion.replace(
                            /'/g,
                            "\\'"
                        )}')">${suggestion}</div>`
                )
                .join("");
        }
    }

    async improveText() {
        if (!this.currentInput) return;

        const originalText = this.getInputText(this.currentInput);
        if (!originalText.trim()) return;

        this.showLoadingInSuggestions("Generating improvement...");

        try {
            const response = await chrome.runtime.sendMessage({
                action: "improveText",
                text: originalText,
                context: this.getPageContext(),
                additionalContext: this.additionalContext,
            });

            if (response.success) {
                this.showConfirmation(originalText, response.improvedText);
            } else {
                this.updateSuggestions("Error: " + response.error);
            }
        } catch (error) {
            console.error("Error improving text:", error);
            this.updateSuggestions("Error improving text");
        }
    }

    async rewriteText() {
        if (!this.currentInput) return;

        const originalText = this.getInputText(this.currentInput);
        if (!originalText.trim()) return;

        this.showLoadingInSuggestions("Generating rewrite...");

        try {
            const response = await chrome.runtime.sendMessage({
                action: "rewriteText",
                text: originalText,
                context: this.getPageContext(),
                additionalContext: this.additionalContext,
            });

            if (response.success) {
                this.showConfirmation(originalText, response.rewrittenText);
            } else {
                this.updateSuggestions("Error: " + response.error);
            }
        } catch (error) {
            console.error("Error rewriting text:", error);
            this.updateSuggestions("Error rewriting text");
        }
    }

    async elaborateText() {
        if (!this.currentInput) return;

        const originalText = this.getInputText(this.currentInput);
        if (!originalText.trim()) return;

        this.showLoadingInSuggestions("Generating elaboration...");

        try {
            const response = await chrome.runtime.sendMessage({
                action: "elaborateText",
                text: originalText,
                context: this.getPageContext(),
                additionalContext: this.additionalContext,
            });

            if (response.success) {
                this.showConfirmation(originalText, response.elaboratedText);
            } else {
                this.updateSuggestions("Error: " + response.error);
            }
        } catch (error) {
            console.error("Error elaborating text:", error);
            this.updateSuggestions("Error elaborating text");
        }
    }

    showLoadingInSuggestions(message) {
        const suggestionsContainer = document.getElementById(
            "webpilot-suggestions"
        );
        const confirmationContainer = document.getElementById(
            "webpilot-confirmation-container"
        );

        suggestionsContainer.style.display = "block";
        suggestionsContainer.innerHTML = `<div class="webpilot-loading">${message}</div>`;
        confirmationContainer.style.display = "none";
    }

    showConfirmation(originalText, suggestedText) {
        const suggestionsContainer = document.getElementById(
            "webpilot-suggestions"
        );
        const confirmationContainer = document.getElementById(
            "webpilot-confirmation-container"
        );

        suggestionsContainer.style.display = "none";
        confirmationContainer.style.display = "block";

        confirmationContainer.innerHTML = `
      <div class="webpilot-diff-view">
          <div class="diff-header">Suggested Change</div>
          <div class="diff-content">
              <div class="diff-pane original">
                  <div class="pane-title">Before</div>
                  <pre>${this.escapeHtml(originalText)}</pre>
              </div>
              <div class="diff-pane suggested">
                  <div class="pane-title">After</div>
                  <pre>${this.escapeHtml(suggestedText)}</pre>
              </div>
          </div>
      </div>
      <div class="webpilot-confirmation-actions">
          <button id="webpilot-accept-change" class="webpilot-accept-btn">✅ Accept</button>
          <button id="webpilot-reject-change" class="webpilot-reject-btn">❌ Reject</button>
      </div>
    `;

        document
            .getElementById("webpilot-accept-change")
            .addEventListener("click", () => {
                this.setInputText(this.currentInput, suggestedText);
                this.hideConfirmation();
            });

        document
            .getElementById("webpilot-reject-change")
            .addEventListener("click", () => {
                this.hideConfirmation();
            });
    }

    hideConfirmation() {
        const suggestionsContainer = document.getElementById(
            "webpilot-suggestions"
        );
        const confirmationContainer = document.getElementById(
            "webpilot-confirmation-container"
        );

        confirmationContainer.innerHTML = "";
        confirmationContainer.style.display = "none";
        suggestionsContainer.style.display = "block";

        this.getSuggestions(this.currentInput);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    toggleChat() {
        const chatContainer = document.getElementById(
            "webpilot-chat-container"
        );
        const suggestionsContainer = document.getElementById(
            "webpilot-suggestions"
        );
        const confirmationContainer = document.getElementById(
            "webpilot-confirmation-container"
        );
        const contextSections = this.sidebar.querySelectorAll(
            ".webpilot-context-section, .webpilot-tab-context-section"
        );

        const isChatVisible = chatContainer.style.display !== "none";

        if (isChatVisible) {
            // Hide chat, show suggestions and context
            chatContainer.style.display = "none";
            suggestionsContainer.style.display = "block";
            contextSections.forEach((el) => (el.style.display = "block"));
            this.getSuggestions(this.currentInput);
        } else {
            // Show chat, hide suggestions and context
            chatContainer.style.display = "flex";
            suggestionsContainer.style.display = "none";
            confirmationContainer.style.display = "none";
            contextSections.forEach((el) => (el.style.display = "none"));

            this.clearChat();

            // Scroll chat into view and focus input
            chatContainer.scrollIntoView({ behavior: "smooth", block: "end" });
            setTimeout(
                () => document.getElementById("webpilot-chat-input").focus(),
                150
            );
        }
    }

    clearChat() {
        document.getElementById("webpilot-chat-messages").innerHTML = "";
    }

    async sendChatMessage() {
        const input = document.getElementById("webpilot-chat-input");
        const message = input.value.trim();
        if (!message) return;

        const messagesContainer = document.getElementById(
            "webpilot-chat-messages"
        );

        // Add user message
        messagesContainer.innerHTML += `
      <div class="webpilot-message user-message">
        <div class="message-content">${message}</div>
      </div>
    `;

        input.value = "";
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await chrome.runtime.sendMessage({
                action: "chatMessage",
                message: message,
                context: this.getPageContext(),
                currentText: this.currentInput
                    ? this.getInputText(this.currentInput)
                    : "",
                additionalContext: this.additionalContext,
            });

            if (response.success) {
                messagesContainer.innerHTML += `
          <div class="webpilot-message assistant-message">
            <div class="message-content">${response.reply}</div>
          </div>
        `;
            } else {
                messagesContainer.innerHTML += `
          <div class="webpilot-message error-message">
            <div class="message-content">Error: ${response.error}</div>
          </div>
        `;
            }
        } catch (error) {
            messagesContainer.innerHTML += `
        <div class="webpilot-message error-message">
          <div class="message-content">Error: ${error.message}</div>
        </div>
      `;
        }

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    setupKeyboardShortcuts() {
        document.addEventListener("keydown", (e) => {
            // Escape key to close sidebar
            if (
                e.key === "Escape" &&
                this.sidebar.classList.contains("webpilot-sidebar-open")
            ) {
                e.preventDefault();
                this.hideSidebar();
                return;
            }

            // Ctrl/Cmd + Shift + P to toggle WebPilot (legacy)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
                e.preventDefault();
                this.toggleSidebar();
            }

            // Ctrl/Cmd + Shift + W to toggle WebPilot (new shortcut)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "W") {
                e.preventDefault();
                this.toggleSidebar();
            }
        });

        // Listen for command from extension
        chrome.runtime.onMessage.addListener(
            (request, sender, sendResponse) => {
                if (request.command === "toggle-sidebar") {
                    this.toggleSidebar();
                    sendResponse({ success: true });
                }
            }
        );
    }

    toggleSidebar() {
        const isSidebarOpen = this.sidebar.classList.contains(
            "webpilot-sidebar-open"
        );

        if (isSidebarOpen) {
            this.hideSidebar();
        } else {
            const activeElement = document.activeElement;
            if (this.isTextInput(activeElement)) {
                this.showSidebar(activeElement);
            } else {
                // If no text input is focused, find the first available one or just show empty sidebar
                const firstTextInput = document.querySelector(
                    'input[type="text"], input[type="email"], textarea, [contenteditable="true"]'
                );
                if (firstTextInput) {
                    firstTextInput.focus();
                    this.showSidebar(firstTextInput);
                } else {
                    // Show sidebar without specific input focus
                    this.showSidebarGeneral();
                }
            }
        }
    }

    showSidebarGeneral() {
        // Add class to body to shift content
        document.body.classList.add("webpilot-sidebar-active");

        // Show and slide in the sidebar
        this.sidebar.classList.add("webpilot-sidebar-open");

        // Update context info
        this.updateContextInfo();

        // Show a general message
        this.showGeneralSuggestions();
    }

    showGeneralSuggestions() {
        const suggestionsContainer = document.getElementById(
            "webpilot-suggestions"
        );
        suggestionsContainer.innerHTML = `
      <div class="webpilot-general-message">
        <h3>📝 Welcome to WebPilot</h3>
        <p>Focus on any text input field to get AI-powered writing assistance!</p>
        <ul>
          <li>Click on text fields, text areas, or editable content</li>
          <li>Get real-time suggestions as you type</li>
          <li>Use action buttons to improve, rewrite, or elaborate text</li>
          <li>Chat with WebPilot for writing help</li>
        </ul>
      </div>
    `;
    }

    isTextInput(element) {
        if (!element) return false;

        const tagName = element.tagName.toLowerCase();
        const isInput = tagName === "input" || tagName === "textarea";
        const isContentEditable = element.hasAttribute("contenteditable");

        return isInput || isContentEditable;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize WebPilot when DOM is loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        new WebPilot();
    });
} else {
    new WebPilot();
}
