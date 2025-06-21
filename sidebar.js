class WebPilotSidebar {
    constructor() {
        this.activeView = 'assistant';
        this.additionalContext = null;
        this.init();
    }

    init() {
        this.addEventListeners();
        this.loadSettings();
    }

    addEventListeners() {
        document.getElementById('webpilot-drag-handle').addEventListener('click', () => {
            this.sendMessageToContentScript('toggleCollapse');
        });

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.switchView(btn.dataset.view)
            });
        });

        // Assistant View
        document.getElementById('webpilot-improve').addEventListener('click', () => this.handleTextAction('improveText'));
        document.getElementById('webpilot-rewrite').addEventListener('click', () => this.handleTextAction('rewriteText'));
        document.getElementById('webpilot-elaborate').addEventListener('click', () => this.handleTextAction('elaborateText'));

        // Context Toggles
        document.querySelectorAll('.context-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = document.getElementById(header.dataset.toggle);
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
                header.querySelector('.toggle-arrow').textContent = content.style.display === 'none' ? '▶' : '▼';
                if (header.dataset.toggle === 'tab-context-content' && content.style.display !== 'none') {
                    this.loadTabList();
                }
            });
        });

        // Tab Context
        document.getElementById('webpilot-load-tab-context').addEventListener('click', () => this.loadTabContext());
        document.getElementById('webpilot-clear-tab-context').addEventListener('click', () => this.clearTabContext());

        // Chat View
        document.getElementById('webpilot-chat-send').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('webpilot-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // Settings View
        document.getElementById('saveApiKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('testApiKey').addEventListener('click', () => this.testApiKey());

        // Listen for messages from the content script
        window.addEventListener('message', (event) => {
            if (!event.data || !event.data.action) return;

            const { action, data } = event.data;

            if (action === 'updateCollapseState') {
                this.handleCollapseState(data.isCollapsed);
            } else if (action === 'showConfirmation') {
                this.showConfirmation(data.originalText, data.suggestedText);
            } else if (action === 'showSuggestions') {
                this.updateSuggestions(data.suggestions);
            } else if (action === 'showLoading') {
                 this.showLoadingInSuggestions(data.message);
            } else if (action === 'updateTabContext') {
                this.displayTabContext(data.context);
            } else if (action === 'addChatMessage') {
                this.addChatMessage(data.sender, data.message);
            } else if (action === 'settingsLoaded') {
                if (data.settings.openai_api_key) {
                    document.getElementById('apiKey').value = data.settings.openai_api_key;
                }
            } else if (action === 'apiKeyStatus') {
                this.showStatus(data.message, data.success ? 'success' : 'error');
            }
        });
    }

    // --- Communication with Content Script ---
    sendMessageToContentScript(action, data) {
        window.parent.postMessage({ type: 'FROM_WEBPILOT_SIDEBAR', action, data }, '*');
    }

    // --- View Switching ---
    switchView(viewName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.nav-btn[data-view="${viewName}"]`).classList.add('active');

        // Show the correct view
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(`${viewName}-view`).classList.add('active');

        this.activeView = viewName;
    }
    
    // --- Assistant Logic ---
    handleTextAction(action) {
        this.sendMessageToContentScript(action);
    }

    showLoadingInSuggestions(message = 'Loading...') {
        document.getElementById('webpilot-suggestions').style.display = 'block';
        document.getElementById('webpilot-confirmation-container').style.display = 'none';
        document.getElementById('webpilot-suggestions').innerHTML = `<div class="loading">${message}</div>`;
    }

    updateSuggestions(suggestions) {
        const container = document.getElementById('webpilot-suggestions');
        if (typeof suggestions === 'string') {
            container.innerHTML = `<div class="suggestion-item">${suggestions}</div>`;
        } else {
            container.innerHTML = suggestions.map(s => `<div class="suggestion-item">${s}</div>`).join('');
        }
    }

    showConfirmation(originalText, suggestedText) {
        document.getElementById('webpilot-suggestions').style.display = 'none';
        const container = document.getElementById('webpilot-confirmation-container');
        container.style.display = 'block';
        
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

        document.getElementById('accept-change').addEventListener('click', () => {
            this.sendMessageToContentScript('acceptChange', { newText: suggestedText });
            this.hideConfirmation();
        });
        document.getElementById('reject-change').addEventListener('click', () => this.hideConfirmation());
    }
    
    hideConfirmation() {
        document.getElementById('webpilot-confirmation-container').style.display = 'none';
        document.getElementById('webpilot-suggestions').style.display = 'block';
        this.sendMessageToContentScript('getSuggestions');
    }

    // --- Context Logic ---
    async loadTabList() {
        // This needs to message the content script, which messages the background script.
        // For simplicity, we'll assume the content script will push the tab list to us.
        // Let's create a placeholder listener for now.
        window.addEventListener('message', (event) => {
            const { action, data } = event.data;
            if (action === 'updateTabList') {
                const selector = document.getElementById('webpilot-tab-selector');
                selector.innerHTML = '<option value="">Select a tab...</option>';
                data.tabs.forEach(tab => {
                    const option = document.createElement('option');
                    option.value = tab.id;
                    option.textContent = tab.title.substring(0, 40) + '...';
                    selector.appendChild(option);
                });
            }
        });
        this.sendMessageToContentScript('getTabList');
    }

    loadTabContext() {
        const tabId = document.getElementById('webpilot-tab-selector').value;
        if (tabId) {
            this.sendMessageToContentScript('loadTabContext', { tabId });
        }
    }

    clearTabContext() {
        this.sendMessageToContentScript('clearTabContext');
        document.getElementById('webpilot-tab-context-display').style.display = 'none';
        this.additionalContext = null;
    }

    displayTabContext(context) {
        if (!context) {
            document.getElementById('webpilot-tab-context-display').style.display = 'none';
            return;
        }
        const display = document.getElementById('webpilot-tab-context-display');
        document.getElementById('tab-context-title').textContent = context.title;
        document.getElementById('tab-context-snippet').textContent = context.content.substring(0, 100) + '...';
        display.style.display = 'block';
    }

    // --- Chat Logic ---
    sendChatMessage() {
        const input = document.getElementById('webpilot-chat-input');
        const message = input.value.trim();
        if (!message) return;
        
        this.addChatMessage('user', message);
        this.sendMessageToContentScript('sendChatMessage', { message });
        input.value = '';
    }

    addChatMessage(sender, message) {
        const container = document.getElementById('webpilot-chat-messages');
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}`;
        messageEl.textContent = message;
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    // --- Settings Logic ---
    async loadSettings() {
        // Request settings from content script (which gets from storage)
        this.sendMessageToContentScript('loadSettings');
    }

    saveApiKey() {
        const apiKey = document.getElementById('apiKey').value;
        this.sendMessageToContentScript('saveSetting', { key: 'openai_api_key', value: apiKey });
        this.showStatus('API Key saved!', 'success');
    }

    testApiKey() {
        this.showStatus('Testing connection...', 'info');
        this.sendMessageToContentScript('testApiKey');
    }
    
    showStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = 'block';
        setTimeout(() => statusEl.style.display = 'none', 3000);
    }

    handleCollapseState(isCollapsed) {
        const container = document.querySelector('.webpilot-sidebar-container');
        const icon = document.getElementById('webpilot-icon');
        if (isCollapsed) {
            container.classList.add('is-collapsed');
            icon.textContent = '📖'; // Change icon to show it can be opened
        } else {
            container.classList.remove('is-collapsed');
            icon.textContent = '✍️'; // Restore original icon
        }
    }
}

new WebPilotSidebar(); 