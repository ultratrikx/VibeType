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
    const result = await chrome.storage.sync.get(['webpilot_enabled', 'openai_api_key']);
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
      subtree: true
    });
  }

  detectTextInputs() {
    const selectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="search"]',
      'textarea',
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '.ql-editor', // Quill editor
      '.ProseMirror', // ProseMirror editor
      '.notion-page-content', // Notion
      '.gmail_default', // Gmail
      '.editable', // Common editable class
      '[role="textbox"]'
    ];

    const inputs = document.querySelectorAll(selectors.join(','));
    
    inputs.forEach(input => {
      if (!input.hasAttribute('data-webpilot-initialized')) {
        this.initializeInput(input);
      }
    });
  }

  initializeInput(input) {
    input.setAttribute('data-webpilot-initialized', 'true');
    
    // Add focus event listener
    input.addEventListener('focus', () => {
      if (this.isEnabled) {
        this.showSidebar(input);
      }
    });

    // Add blur event listener
    input.addEventListener('blur', () => {
      // A brief timeout allows for events like 'mouseenter' on the sidebar or a focus
      // change to an element within the sidebar to be processed before we check.
      // This prevents the sidebar from closing when the user clicks on it.
      setTimeout(() => {
        if (!this.isMouseOverSidebar && !this.sidebar.contains(document.activeElement)) {
          this.hideSidebar();
        }
      }, 200);
    });

    // Add input event listener for real-time suggestions
    input.addEventListener('input', (e) => {
      if (this.isEnabled && this.currentInput === input) {
        this.debounce(() => this.getSuggestions(input), 500)();
      }
    });
  }

  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'webpilot-sidebar';
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
        </div>

        <div class="webpilot-suggestions" id="webpilot-suggestions">
          <div class="webpilot-loading">Loading suggestions...</div>
        </div>
        <div id="webpilot-confirmation-container" style="display: none;"></div>
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
    document.getElementById('webpilot-close').addEventListener('click', () => {
      this.hideSidebar();
    });

    this.sidebar.addEventListener('mouseenter', () => {
      this.isMouseOverSidebar = true;
    });

    this.sidebar.addEventListener('mouseleave', () => {
      this.isMouseOverSidebar = false;
    });

    // Context toggle
    document.querySelector('.webpilot-context-header').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleContextSection();
    });

    // Tab context toggle
    document.querySelector('.webpilot-tab-context-header').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTabContextSection();
    });

    // Load tab context
    document.getElementById('webpilot-load-tab-context').addEventListener('click', () => {
      this.loadTabContext();
    });

    // Clear tab context
    document.getElementById('webpilot-clear-tab-context').addEventListener('click', () => {
      this.clearTabContext();
    });

    // Action buttons
    document.getElementById('webpilot-improve').addEventListener('click', () => {
      this.improveText();
    });

    document.getElementById('webpilot-rewrite').addEventListener('click', () => {
      this.rewriteText();
    });

    document.getElementById('webpilot-elaborate').addEventListener('click', () => {
      this.elaborateText();
    });

    document.getElementById('webpilot-chat').addEventListener('click', () => {
      this.toggleChat();
    });

    // Chat functionality
    document.getElementById('webpilot-chat-send').addEventListener('click', () => {
      this.sendChatMessage();
    });

    document.getElementById('webpilot-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
  }

  toggleContextSection() {
    const contextInfo = document.getElementById('webpilot-context-info');
    const toggle = document.getElementById('webpilot-context-toggle');
    const isHidden = contextInfo.style.display === 'none';
    
    contextInfo.style.display = isHidden ? 'block' : 'none';
    toggle.textContent = isHidden ? '▼' : '▶';
  }

  toggleTabContextSection() {
    const content = document.getElementById('webpilot-tab-context-content');
    const toggle = document.getElementById('webpilot-tab-context-toggle');
    const isHidden = content.style.display === 'none';

    content.style.display = isHidden ? 'block' : 'none';
    toggle.textContent = isHidden ? '▼' : '▶';

    if (isHidden) {
      this.loadTabList();
    }
  }

  async loadTabList() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllTabs' });
      if (response.success) {
        const selector = document.getElementById('webpilot-tab-selector');
        selector.innerHTML = '<option value="">Select a tab for additional context...</option>';
        
        response.tabs.forEach(tab => {
          if (tab.url && tab.url.startsWith('http')) {
            const option = document.createElement('option');
            option.value = tab.id;
            option.textContent = `${tab.title.substring(0, 50)}${tab.title.length > 50 ? '...' : ''}`;
            selector.appendChild(option);
          }
        });
      }
    } catch (error) {
      console.error('Error loading tab list:', error);
    }
  }

  async loadTabContext() {
    const selector = document.getElementById('webpilot-tab-selector');
    const tabId = parseInt(selector.value);
    
    if (!tabId) {
      alert('Please select a tab first');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getTabContext', 
        tabId: tabId 
      });
      
      if (response.success) {
        this.additionalContext = response.context;
        this.displayTabContext(response.context);
        this.getSuggestions(this.currentInput); // Refresh suggestions with new context
      } else {
        alert('Error loading tab context: ' + response.error);
      }
    } catch (error) {
      console.error('Error loading tab context:', error);
      alert('Error loading tab context');
    }
  }

  displayTabContext(context) {
    const display = document.getElementById('webpilot-tab-context-display');
    const title = document.getElementById('tab-context-title');
    const content = document.getElementById('tab-context-content');
    
    title.textContent = context.title;
    content.textContent = context.content.substring(0, 100) + (context.content.length > 100 ? '...' : '');
    display.style.display = 'block';
  }

  clearTabContext() {
    this.additionalContext = null;
    document.getElementById('webpilot-tab-context-display').style.display = 'none';
    document.getElementById('webpilot-tab-selector').value = '';
    this.getSuggestions(this.currentInput); // Refresh suggestions without context
  }

  showSidebar(input) {
    this.currentInput = input;
    const rect = input.getBoundingClientRect();
    
    // Position sidebar to the right of the input
    this.sidebar.style.top = `${rect.top + window.scrollY}px`;
    this.sidebar.style.left = `${rect.right + 10}px`;
    this.sidebar.style.height = `${Math.max(rect.height, 500)}px`;
    this.sidebar.style.display = 'block';
    
    // Update context info
    this.updateContextInfo();
    
    // Get initial suggestions
    this.getSuggestions(input);
  }

  hideSidebar() {
    this.sidebar.style.display = 'none';
    this.currentInput = null;
    this.additionalContext = null;
  }

  updateContextInfo() {
    const context = this.getPageContext();
    document.getElementById('context-title').textContent = context.title;
    document.getElementById('context-url').textContent = context.url;
  }

  async getSuggestions(input) {
    const text = this.getInputText(input);
    if (!text.trim()) {
      this.updateSuggestions('Start typing to get suggestions...');
      return;
    }

    try {
      const context = this.getPageContext();
      const response = await chrome.runtime.sendMessage({
        action: 'getSuggestions',
        text: text,
        context: context,
        additionalContext: this.additionalContext
      });

      if (response.success) {
        this.updateSuggestions(response.suggestions);
      } else {
        this.updateSuggestions('Error: ' + response.error);
      }
    } catch (error) {
      this.updateSuggestions('Error getting suggestions');
    }
  }

  getInputText(input) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      return input.value;
    } else if (input.hasAttribute('contenteditable')) {
      return input.textContent || input.innerText;
    }
    return '';
  }

  setInputText(input, text) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = text;
    } else if (input.hasAttribute('contenteditable')) {
      input.textContent = text;
    }
    
    // Trigger input event
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  getPageContext() {
    return {
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname,
      selection: window.getSelection().toString()
    };
  }

  updateSuggestions(suggestions) {
    const container = document.getElementById('webpilot-suggestions');
    if (typeof suggestions === 'string') {
      container.innerHTML = `<div class="webpilot-suggestion">${suggestions}</div>`;
    } else {
      container.innerHTML = suggestions.map(suggestion => 
        `<div class="webpilot-suggestion" onclick="this.insertSuggestion('${suggestion.replace(/'/g, "\\'")}')">${suggestion}</div>`
      ).join('');
    }
  }

  async improveText() {
    if (!this.currentInput) return;
    
    const originalText = this.getInputText(this.currentInput);
    if (!originalText.trim()) return;

    this.showLoadingInSuggestions('Generating improvement...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'improveText',
        text: originalText,
        context: this.getPageContext(),
        additionalContext: this.additionalContext
      });

      if (response.success) {
        this.showConfirmation(originalText, response.improvedText);
      } else {
        this.updateSuggestions('Error: ' + response.error);
      }
    } catch (error) {
      console.error('Error improving text:', error);
      this.updateSuggestions('Error improving text');
    }
  }

  async rewriteText() {
    if (!this.currentInput) return;
    
    const originalText = this.getInputText(this.currentInput);
    if (!originalText.trim()) return;

    this.showLoadingInSuggestions('Generating rewrite...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'rewriteText',
        text: originalText,
        context: this.getPageContext(),
        additionalContext: this.additionalContext
      });

      if (response.success) {
        this.showConfirmation(originalText, response.rewrittenText);
      } else {
        this.updateSuggestions('Error: ' + response.error);
      }
    } catch (error) {
      console.error('Error rewriting text:', error);
      this.updateSuggestions('Error rewriting text');
    }
  }

  async elaborateText() {
    if (!this.currentInput) return;
    
    const originalText = this.getInputText(this.currentInput);
    if (!originalText.trim()) return;

    this.showLoadingInSuggestions('Generating elaboration...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'elaborateText',
        text: originalText,
        context: this.getPageContext(),
        additionalContext: this.additionalContext
      });

      if (response.success) {
        this.showConfirmation(originalText, response.elaboratedText);
      } else {
        this.updateSuggestions('Error: ' + response.error);
      }
    } catch (error) {
      console.error('Error elaborating text:', error);
      this.updateSuggestions('Error elaborating text');
    }
  }

  showLoadingInSuggestions(message) {
    const suggestionsContainer = document.getElementById('webpilot-suggestions');
    const confirmationContainer = document.getElementById('webpilot-confirmation-container');
    
    suggestionsContainer.style.display = 'block';
    suggestionsContainer.innerHTML = `<div class="webpilot-loading">${message}</div>`;
    confirmationContainer.style.display = 'none';
  }

  showConfirmation(originalText, suggestedText) {
    const suggestionsContainer = document.getElementById('webpilot-suggestions');
    const confirmationContainer = document.getElementById('webpilot-confirmation-container');

    suggestionsContainer.style.display = 'none';
    confirmationContainer.style.display = 'block';

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

    document.getElementById('webpilot-accept-change').addEventListener('click', () => {
      this.setInputText(this.currentInput, suggestedText);
      this.hideConfirmation();
    });

    document.getElementById('webpilot-reject-change').addEventListener('click', () => {
      this.hideConfirmation();
    });
  }

  hideConfirmation() {
    const suggestionsContainer = document.getElementById('webpilot-suggestions');
    const confirmationContainer = document.getElementById('webpilot-confirmation-container');

    confirmationContainer.innerHTML = '';
    confirmationContainer.style.display = 'none';
    suggestionsContainer.style.display = 'block';

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
    const chatContainer = document.getElementById('webpilot-chat-container');
    const suggestionsContainer = document.getElementById('webpilot-suggestions');
    const confirmationContainer = document.getElementById('webpilot-confirmation-container');
    const contextSections = this.sidebar.querySelectorAll('.webpilot-context-section, .webpilot-tab-context-section');
    
    const isChatVisible = chatContainer.style.display !== 'none';

    if (isChatVisible) {
      // Hide chat, show suggestions and context
      chatContainer.style.display = 'none';
      suggestionsContainer.style.display = 'block';
      contextSections.forEach(el => el.style.display = 'block');
      this.getSuggestions(this.currentInput);
    } else {
      // Show chat, hide suggestions and context
      chatContainer.style.display = 'flex';
      suggestionsContainer.style.display = 'none';
      confirmationContainer.style.display = 'none';
      contextSections.forEach(el => el.style.display = 'none');
      
      this.clearChat();
      
      // Scroll chat into view and focus input
      chatContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
      setTimeout(() => document.getElementById('webpilot-chat-input').focus(), 150);
    }
  }

  clearChat() {
    document.getElementById('webpilot-chat-messages').innerHTML = '';
  }

  async sendChatMessage() {
    const input = document.getElementById('webpilot-chat-input');
    const message = input.value.trim();
    if (!message) return;

    const messagesContainer = document.getElementById('webpilot-chat-messages');
    
    // Add user message
    messagesContainer.innerHTML += `
      <div class="webpilot-message user-message">
        <div class="message-content">${message}</div>
      </div>
    `;

    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'chatMessage',
        message: message,
        context: this.getPageContext(),
        currentText: this.currentInput ? this.getInputText(this.currentInput) : '',
        additionalContext: this.additionalContext
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
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + P to toggle WebPilot
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (this.sidebar.style.display === 'none') {
          const activeElement = document.activeElement;
          if (this.isTextInput(activeElement)) {
            this.showSidebar(activeElement);
          }
        } else {
          this.hideSidebar();
        }
      }
    });
  }

  isTextInput(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea';
    const isContentEditable = element.hasAttribute('contenteditable');
    
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new WebPilot();
  });
} else {
  new WebPilot();
} 