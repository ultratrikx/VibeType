document.addEventListener("DOMContentLoaded", function () {
    // Send ready message to parent window
    try {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ action: "ready" }, "*");
        }
    } catch (error) {
        console.error("VibeType Sidebar: Error sending ready message:", error);
    }

    // Get DOM elements
    const backBtn = document.getElementById("back-btn");
    const settingsBtn = document.getElementById("settings-btn");
    const chatView = document.getElementById("chat-view");
    const settingsView = document.getElementById("settings-view");
    const sidebarTitle = document.querySelector(".sidebar-title");

    const originalTextEl = document.getElementById("original-text");
    const customPromptEl = document.getElementById("custom-prompt");
    const addContextBtn = document.getElementById("add-context-btn");
    const generateBtn = document.getElementById("generate-btn");
    const chatMessagesEl = document.getElementById("chat-messages");
    const apiKeyEl = document.getElementById("api-key");
    const apiUrlEl = document.getElementById("api-url");
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const settingsStatusEl = document.getElementById("settings-status");
    const testApiKeyBtn = document.getElementById("test-api-key-btn");
    const testApiUrlBtn = document.getElementById("test-api-url-btn");
    const tabSelectionModal = document.getElementById("tab-selection-modal");
    const tabListEl = document.getElementById("tab-list");
    const cancelTabSelectionBtn = document.getElementById(
        "cancel-tab-selection"
    );
    const originalTextContext = document.getElementById(
        "original-text-context"
    );
    const clearContextBtn = document.getElementById("clear-context-btn");

    let additionalContext = null;
    let currentView = "chat"; // 'chat' or 'settings'

    // View navigation
    function showChatView() {
        chatView.style.display = "flex";
        settingsView.style.display = "none";
        sidebarTitle.textContent = "Chat";
        backBtn.style.display = "none";
        settingsBtn.style.display = "block";
        currentView = "chat";
    }

    function showSettingsView() {
        chatView.style.display = "none";
        settingsView.style.display = "flex";
        sidebarTitle.textContent = "Settings";
        backBtn.style.display = "block";
        settingsBtn.style.display = "none";
        currentView = "settings";
    }

    // Navigation event listeners
    backBtn.addEventListener("click", showChatView);
    settingsBtn.addEventListener("click", showSettingsView);

    // Initialize view
    showChatView();

    // Safe message sending with error handling
    function safeSendMessage(message, callback) {
        try {
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log(
                            "VibeType Sidebar: Message error (expected):",
                            chrome.runtime.lastError.message
                        );
                        if (callback) {
                            callback({
                                success: false,
                                error: chrome.runtime.lastError.message,
                            });
                        }
                        return;
                    }
                    if (callback) {
                        callback(response);
                    }
                });
            } else {
                console.error("VibeType Sidebar: Chrome runtime not available");
                if (callback) {
                    callback({
                        success: false,
                        error: "Chrome runtime not available",
                    });
                }
            }
        } catch (error) {
            console.error("VibeType Sidebar: Error sending message:", error);
            if (callback) {
                callback({ success: false, error: error.message });
            }
        }
    }

    // Load saved settings
    safeSendMessage({ action: "getSettings" }, (response) => {
        if (response && response.success) {
            if (response.settings.openai_api_key) {
                apiKeyEl.value = response.settings.openai_api_key;
            }
            if (response.settings.scrape_api_url) {
                apiUrlEl.value = response.settings.scrape_api_url;
            } else {
                apiUrlEl.value = "http://127.0.0.1:8000"; // Default value
            }
        } else {
            // Fallback to direct chrome.storage access
            try {
                chrome.storage.sync.get(
                    ["openai_api_key", "scrape_api_url"],
                    function (items) {
                        if (chrome.runtime.lastError) {
                            console.log(
                                "VibeType Sidebar: Storage access error:",
                                chrome.runtime.lastError.message
                            );
                            return;
                        }
                        if (items.openai_api_key) {
                            apiKeyEl.value = items.openai_api_key;
                        }
                        if (items.scrape_api_url) {
                            apiUrlEl.value = items.scrape_api_url;
                        } else {
                            apiUrlEl.value = "http://127.0.0.1:8000";
                        }
                    }
                );
            } catch (error) {
                console.error(
                    "VibeType Sidebar: Error loading settings:",
                    error
                );
            }
        }
    });

    // Tab switching
    const tabs = document.querySelectorAll(".tab-link");
    const contents = document.querySelectorAll(".tab-content");

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t) => t.classList.remove("active"));
            contents.forEach((c) => c.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.dataset.tab).classList.add("active");
        });
    });

    // Save settings
    saveSettingsBtn.addEventListener("click", () => {
        const apiKey = apiKeyEl.value.trim();
        const apiUrl = apiUrlEl.value.trim();

        chrome.storage.sync.set(
            { openai_api_key: apiKey, scrape_api_url: apiUrl },
            () => {
                if (chrome.runtime.lastError) {
                    settingsStatusEl.textContent = `Error: ${chrome.runtime.lastError.message}`;
                } else {
                    settingsStatusEl.textContent = "Settings saved!";
                }
                setTimeout(() => {
                    settingsStatusEl.textContent = "";
                }, 2000);
            }
        );
    });

    // Test API Key
    testApiKeyBtn.addEventListener("click", () => {
        settingsStatusEl.textContent = "Testing API Key...";
        safeSendMessage({ action: "testApiKey" }, (response) => {
            settingsStatusEl.textContent = response.message;
        });
    });

    // Test Scrape API URL
    testApiUrlBtn.addEventListener("click", () => {
        settingsStatusEl.textContent = "Testing Scrape API URL...";
        safeSendMessage({ action: "testScrapeApi" }, (response) => {
            settingsStatusEl.textContent = response.message;
        });
    });

    // Handle incoming text selection from the content script
    window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        if (event.data.action === "updateSelectedText") {
            originalTextEl.textContent = event.data.text;
            originalTextContext.style.display = "flex";
        }
    });

    // Clear original text context
    clearContextBtn.addEventListener("click", () => {
        originalTextEl.textContent = "";
        originalTextContext.style.display = "none";
    });

    // Add tab context
    addContextBtn.addEventListener("click", () => {
        safeSendMessage({ action: "getAllTabs" }, (response) => {
            if (response && response.success) {
                populateTabList(response.tabs);
                tabSelectionModal.style.display = "flex";
            }
        });
    });

    cancelTabSelectionBtn.addEventListener("click", () => {
        tabSelectionModal.style.display = "none";
    });

    function populateTabList(tabs) {
        tabListEl.innerHTML = "";
        tabs.forEach((tab) => {
            const tabItem = document.createElement("div");
            tabItem.className = "tab-item";
            tabItem.dataset.tabId = tab.id;
            tabItem.innerHTML = `
                <img src="${
                    tab.favIconUrl || "icons/icon16.png"
                }" alt="favicon">
                <span>${tab.title}</span>
            `;
            tabItem.addEventListener("click", () => {
                selectTabForContext(tab.id, tab.title, tab.favIconUrl, tab.url);
            });
            tabListEl.appendChild(tabItem);
        });
    }

    function selectTabForContext(tabId, tabTitle, tabIcon, tabUrl) {
        tabSelectionModal.style.display = "none";

        // Store tab info with icon and URL
        additionalContext = {
            sourceTabId: tabId,
            sourceTabTitle: tabTitle,
            sourceTabIcon: tabIcon,
            sourceTabUrl: tabUrl,
            fetched: false,
        };

        // Show the context pill with tab info
        showContextPill(tabTitle, tabIcon, tabUrl);

        addMessage(
            "assistant",
            `Context from "${tabTitle}" is selected. It will be processed with your next message.`
        );
    }

    function showContextPill(tabTitle, tabIcon, tabUrl) {
        // Extract hostname from the tab URL
        let hostname = "Unknown";
        try {
            if (tabUrl) {
                const url = new URL(tabUrl);
                hostname = url.hostname.replace("www.", ""); // Remove www. prefix for cleaner display
            }
        } catch (e) {
            hostname = "Unknown";
        }

        // Create context pill content
        const contextPill = document.createElement("div");
        contextPill.className = "tab-context-pill";
        contextPill.innerHTML = `
            <div class="context-pill-content">
                <img src="${
                    tabIcon || "icons/icon16.png"
                }" alt="Tab icon" class="context-tab-icon">
                <div class="context-info">
                    <div class="context-type">History @ ${hostname}</div>
                    <div class="context-title">${tabTitle}</div>
                </div>
            </div>
            <button class="clear-tab-context-btn">&times;</button>
        `;

        // Insert before the input wrapper
        const chatInputContainer = document.querySelector(
            ".chat-input-container"
        );
        const inputWrapper = document.querySelector(".input-wrapper");

        // Remove any existing context pill
        const existingPill = document.querySelector(".tab-context-pill");
        if (existingPill) {
            existingPill.remove();
        }

        // Insert the new pill before the input wrapper
        chatInputContainer.insertBefore(contextPill, inputWrapper);

        // Add click handler for the clear button
        const clearBtn = contextPill.querySelector(".clear-tab-context-btn");
        clearBtn.addEventListener("click", () => {
            contextPill.remove();
            additionalContext = null;
        });
    }

    // Generate response
    generateBtn.addEventListener("click", () => {
        const prompt = customPromptEl.value.trim();
        const originalText = originalTextEl.textContent;
        if (!prompt) return;

        addMessage("user", prompt);
        customPromptEl.value = "";

        const sendChatMessage = (context) => {
            safeSendMessage(
                {
                    action: "chatMessage",
                    message: prompt,
                    currentText: originalText,
                    additionalContext: context,
                },
                (response) => {
                    if (response && response.success) {
                        addMessage("assistant", response.reply);
                    } else {
                        addMessage(
                            "assistant",
                            `Error: ${
                                response
                                    ? response.error
                                    : "Invalid text response received from API"
                            }`
                        );
                    }
                }
            );
        };

        // Check if context is selected but not yet fetched
        if (
            additionalContext &&
            additionalContext.sourceTabId &&
            !additionalContext.fetched
        ) {
            addMessage(
                "assistant",
                `Searching for relevant context in "${additionalContext.sourceTabTitle}"...`
            );
            safeSendMessage(
                {
                    action: "enhancedContentExtraction",
                    tabId: additionalContext.sourceTabId,
                    query: prompt, // Use the user's prompt as the query
                },
                (response) => {
                    if (response && response.success) {
                        additionalContext = { ...response, fetched: true };
                        addMessage(
                            "assistant",
                            `Context from "${
                                additionalContext.sourceTabTitle || "tab"
                            }" has been added.`
                        );
                        sendChatMessage(additionalContext);
                    } else {
                        addMessage(
                            "assistant",
                            `Error fetching context: ${
                                response ? response.error : "Unknown error"
                            }. Continuing without it.`
                        );
                        sendChatMessage(null);
                    }
                }
            );
        } else {
            // If context is already fetched or not selected, send the message
            sendChatMessage(additionalContext);
        }
    });

    function addMessage(sender, text) {
        const messageEl = document.createElement("div");
        messageEl.classList.add("chat-message", `${sender}-message`);
        messageEl.innerHTML = text; // Use innerHTML to render potential HTML in messages
        chatMessagesEl.appendChild(messageEl);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
});
