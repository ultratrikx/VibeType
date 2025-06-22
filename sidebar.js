document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".tab-link");
    const contents = document.querySelectorAll(".tab-content");
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

    // Load saved settings
    chrome.storage.sync.get(
        ["openai_api_key", "scrape_api_url"],
        function (items) {
            if (items.openai_api_key) {
                apiKeyEl.value = items.openai_api_key;
            }
            if (items.scrape_api_url) {
                apiUrlEl.value = items.scrape_api_url;
            }
        }
    );

    // Tab switching
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
                settingsStatusEl.textContent = "Settings saved!";
                setTimeout(() => {
                    settingsStatusEl.textContent = "";
                }, 2000);
            }
        );
    });

    // Test API Key
    testApiKeyBtn.addEventListener("click", () => {
        settingsStatusEl.textContent = "Testing API Key...";
        chrome.runtime.sendMessage({ action: "testApiKey" }, (response) => {
            settingsStatusEl.textContent = response.message;
        });
    });

    // Test Scrape API URL
    testApiUrlBtn.addEventListener("click", () => {
        settingsStatusEl.textContent = "Testing Scrape API URL...";
        chrome.runtime.sendMessage({ action: "testScrapeApi" }, (response) => {
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
        chrome.runtime.sendMessage({ action: "getAllTabs" }, (response) => {
            if (response.success) {
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
                selectTabForContext(tab.id, tab.title);
            });
            tabListEl.appendChild(tabItem);
        });
    }

    function selectTabForContext(tabId, tabTitle) {
        tabSelectionModal.style.display = "none";
        // Store tab info instead of fetching immediately
        additionalContext = {
            sourceTabId: tabId,
            sourceTabTitle: tabTitle,
            fetched: false, // Mark context as not fetched
        };
        addMessage(
            "assistant",
            `Context from "${tabTitle}" is selected. It will be processed with your next message.`
        );
        // TODO: Add a UI element (a "pill") to show the selected context and allow clearing it
    }

    // Generate response
    generateBtn.addEventListener("click", () => {
        const prompt = customPromptEl.value.trim();
        const originalText = originalTextEl.textContent;
        if (!prompt) return;

        addMessage("user", prompt);
        customPromptEl.value = "";

        const sendChatMessage = (context) => {
            chrome.runtime.sendMessage(
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
            chrome.runtime.sendMessage(
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
