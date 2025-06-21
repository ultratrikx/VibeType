// WebPilot Popup Script
class WebPilotPopup {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'openai_api_key',
        'webpilot_enabled',
        'webpilot_auto_suggestions'
      ]);

      // Set API key
      const apiKeyInput = document.getElementById('apiKey');
      if (result.openai_api_key) {
        apiKeyInput.value = result.openai_api_key;
      }

      // Set enabled toggle
      const enabledToggle = document.getElementById('enabled');
      enabledToggle.checked = result.webpilot_enabled !== false; // Default to true

      // Set auto-suggestions toggle
      const autoSuggestionsToggle = document.getElementById('autoSuggestions');
      autoSuggestionsToggle.checked = result.webpilot_auto_suggestions !== false; // Default to true

    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  setupEventListeners() {
    // Save API key button
    document.getElementById('saveApiKey').addEventListener('click', () => {
      this.saveApiKey();
    });

    // Test API key button
    document.getElementById('testApiKey').addEventListener('click', () => {
      this.testApiKey();
    });

    // Enabled toggle
    document.getElementById('enabled').addEventListener('change', (e) => {
      this.saveSetting('webpilot_enabled', e.target.checked);
    });

    // Auto-suggestions toggle
    document.getElementById('autoSuggestions').addEventListener('change', (e) => {
      this.saveSetting('webpilot_auto_suggestions', e.target.checked);
    });

    // Enter key on API key input
    document.getElementById('apiKey').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveApiKey();
      }
    });
  }

  async saveApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      this.showStatus('Invalid API key format. Should start with "sk-"', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ openai_api_key: apiKey });
      this.showStatus('API key saved successfully!', 'success');
      
      // Update background script
      chrome.runtime.sendMessage({ action: 'updateApiKey', apiKey });
      
    } catch (error) {
      console.error('Error saving API key:', error);
      this.showStatus('Error saving API key', 'error');
    }
  }

  async testApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showStatus('Please enter an API key first', 'error');
      return;
    }

    this.showStatus('Testing connection...', 'success');

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        this.showStatus('✅ Connection successful! API key is valid.', 'success');
      } else {
        const errorData = await response.json();
        this.showStatus(`❌ Connection failed: ${errorData.error?.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('API test error:', error);
      this.showStatus('❌ Connection failed: Network error', 'error');
    }
  }

  async saveSetting(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
      
      // Notify content scripts of setting change
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'settingChanged', 
          key: key, 
          value: value 
        });
      }
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  }

  showStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }

  hideStatus() {
    const statusElement = document.getElementById('status');
    statusElement.style.display = 'none';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WebPilotPopup();
}); 