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
}

new WebPilotController();
