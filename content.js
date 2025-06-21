class WebPilotController {
    constructor() {
        this.sidebarIframe = null;
        this.activeElement = null;
        this.additionalContext = null;
        this.init();
    }

    init() {
        this.createSidebar();
        this.addEventListeners();
    }

    createSidebar() {
        this.sidebarIframe = document.createElement("iframe");
        this.sidebarIframe.id = "webpilot-sidebar-iframe";
        this.sidebarIframe.src = chrome.runtime.getURL("sidebar.html");
        document.body.appendChild(this.sidebarIframe);
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

        // Track the last active text element
        document.addEventListener("focusin", (e) => {
            const target = e.target;
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                this.activeElement = target;
            }
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
                const chatResponse = await this.sendMessageToBackground({
                    action: "chatMessage",
                    message: data.message,
                    context: this.getPageContext(),
                    currentText: this.activeElement ? this.getInputText() : "",
                    additionalContext: this.additionalContext,
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
    }

    // --- Getters & Setters for Active Element ---
    getInputText() {
        if (!this.activeElement) return "";
        return this.activeElement.isContentEditable
            ? this.activeElement.textContent
            : this.activeElement.value;
    }

    setInputText(text) {
        if (!this.activeElement) return;
        if (this.activeElement.isContentEditable) {
            this.activeElement.textContent = text;
        } else {
            this.activeElement.value = text;
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

        // If we have enhanced context, try to refresh it with a query relevant to the action
        if (
            this.additionalContext &&
            this.additionalContext.most_relevant_chunks
        ) {
            this.postMessageToSidebar("showLoading", {
                message: "Refreshing context for better analysis...",
            });

            let actionQuery = contextQuery;
            if (!actionQuery) {
                // Generate context query based on action and current text
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

            // Try to refresh context with action-specific query
            await this.refreshEnhancedContext(actionQuery);
        }

        this.postMessageToSidebar("showLoading", {
            message: "Analyzing text with enhanced context...",
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
        } else {
            this.postMessageToSidebar("showLoading", {
                message: `Error: ${response.error}`,
            });
        }
    }
}

new WebPilotController();
