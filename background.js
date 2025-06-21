// WebPilot Background Script
class WebPilotBackground {
  constructor() {
    this.apiKey = null;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupMessageListeners();
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(['openai_api_key']);
    this.apiKey = result.openai_api_key;
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getSuggestions':
          await this.handleGetSuggestions(request, sendResponse);
          break;
        case 'improveText':
          await this.handleImproveText(request, sendResponse);
          break;
        case 'rewriteText':
          await this.handleRewriteText(request, sendResponse);
          break;
        case 'elaborateText':
          await this.handleElaborateText(request, sendResponse);
          break;
        case 'chatMessage':
          await this.handleChatMessage(request, sendResponse);
          break;
        case 'getTabContext':
          await this.handleGetTabContext(request, sendResponse);
          break;
        case 'getAllTabs':
          await this.handleGetAllTabs(request, sender, sendResponse);
          break;
        case 'getSettings':
          await this.handleGetSettings(sendResponse);
          break;
        case 'saveSetting':
          await this.handleSaveSetting(request, sendResponse);
          break;
        case 'testApiKey':
          await this.handleTestApiKey(sendResponse);
          break;
        case 'updateApiKey':
          this.apiKey = request.apiKey;
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('WebPilot error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetTabContext(request, sendResponse) {
    try {
      const { tabId } = request;
      const tab = await chrome.tabs.get(tabId);
      const context = await this.extractTabContext(tabId, tab.url);
      sendResponse({ success: true, context });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetAllTabs(request, sender, sendResponse) {
    try {
      const allTabs = await chrome.tabs.query({});
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTabId = (activeTabs.length > 0) ? activeTabs[0].id : sender.tab?.id;
      
      const tabList = allTabs
        .filter(tab => tab.id !== currentTabId)
        .map(tab => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl
      }));
      sendResponse({ success: true, tabs: tabList });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async extractTabContext(tabId, tabUrl) {
    try {
      let extractionFunction;

      if (tabUrl && new URL(tabUrl).hostname === 'mail.google.com') {
        extractionFunction = () => {
          let content = '';
          const subjectEl = document.querySelector('h2.hP');
          const subject = subjectEl ? subjectEl.innerText : document.title;
          const emailContainer = document.querySelector('.nH.hx');

          if (emailContainer) {
            const messageBodies = emailContainer.querySelectorAll('.a3s.aiL, .adx');
            if (messageBodies.length > 0) {
              messageBodies.forEach(body => {
                content += body.innerText + '\n\n---\n\n';
              });
            } else {
              content = emailContainer.innerText;
            }
          }

          if (!content) {
            content = document.body.innerText;
          }

          return {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
            selection: window.getSelection().toString(),
            content: `Subject: ${subject}\n\n${content}`
          };
        };
      } else {
        extractionFunction = () => {
            const article = document.body.cloneNode(true);
            const selectorsToRemove = 'header, footer, nav, aside, .noprint, .ad, .ads, .advert, [role="banner"], [role="contentinfo"], [role="navigation"], [class*="sidebar"], [id*="sidebar"], script, style';
            article.querySelectorAll(selectorsToRemove).forEach(el => el.remove());
    
            let mainContentEl = article.querySelector('main, article, [role="main"]');
            let content = '';
        
            if (mainContentEl) {
                content = mainContentEl.innerText;
            } else {
                content = article.innerText;
            }
            
            content = content.replace(/(\\r\\n|\\n|\\r){3,}/gm, "\\n\\n").trim();
            
            return {
                title: document.title,
                url: window.location.href,
                domain: window.location.hostname,
                selection: window.getSelection().toString(),
                content: content
            };
        };
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: extractionFunction
      });

      if (results && results[0] && results[0].result) {
        let result = results[0].result;
        if (result.content.length > 15000) {
          result.content = result.content.substring(0, 15000) + "\\n... (content truncated)";
        }
        return result;
      }
      
      return {
        title: 'Unknown',
        url: 'Unknown',
        domain: 'Unknown',
        selection: '',
        content: ''
      };
    } catch (error) {
      console.error('Error extracting tab context:', error);
      return {
        title: 'Error accessing tab',
        url: 'Error',
        domain: 'Error',
        selection: '',
        content: `Error extracting content: ${error.message}`
      };
    }
  }

  async handleGetSuggestions(request, sendResponse) {
    if (!this.apiKey) {
      sendResponse({ 
        success: false, 
        error: 'OpenAI API key not configured. Please set it in the extension settings.' 
      });
      return;
    }

    const { text, context, additionalContext } = request;
    
    if (!text.trim()) {
      sendResponse({ 
        success: true, 
        suggestions: ['Start typing to get AI-powered suggestions...'] 
      });
      return;
    }

    const prompt = this.buildSuggestionPrompt(text, context, additionalContext);
    const response = await this.callOpenAI(prompt, 3);

    if (response.success) {
      const suggestions = response.choices.map(choice => 
        choice.message.content.trim()
      ).filter(suggestion => suggestion.length > 0);
      
      sendResponse({ success: true, suggestions });
    } else {
      sendResponse({ success: false, error: response.error });
    }
  }

  async handleImproveText(request, sendResponse) {
    if (!this.apiKey) {
      sendResponse({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
      return;
    }

    const { text, context, additionalContext } = request;
    const prompt = this.buildImprovePrompt(text, context, additionalContext);
    const response = await this.callOpenAI(prompt, 1);

    if (response.success) {
      const improvedText = response.choices[0].message.content.trim();
      sendResponse({ success: true, improvedText });
    } else {
      sendResponse({ success: false, error: response.error });
    }
  }

  async handleRewriteText(request, sendResponse) {
    if (!this.apiKey) {
      sendResponse({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
      return;
    }

    const { text, context, additionalContext } = request;
    const prompt = this.buildRewritePrompt(text, context, additionalContext);
    const response = await this.callOpenAI(prompt, 1);

    if (response.success) {
      const rewrittenText = response.choices[0].message.content.trim();
      sendResponse({ success: true, rewrittenText });
    } else {
      sendResponse({ success: false, error: response.error });
    }
  }

  async handleElaborateText(request, sendResponse) {
    if (!this.apiKey) {
      sendResponse({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
      return;
    }

    const { text, context, additionalContext } = request;
    const prompt = this.buildElaboratePrompt(text, context, additionalContext);
    const response = await this.callOpenAI(prompt, 1);

    if (response.success) {
      const elaboratedText = response.choices[0].message.content.trim();
      sendResponse({ success: true, elaboratedText });
    } else {
      sendResponse({ success: false, error: response.error });
    }
  }

  async handleChatMessage(request, sendResponse) {
    if (!this.apiKey) {
      sendResponse({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
      return;
    }

    const { message, context, currentText, additionalContext } = request;
    const prompt = this.buildChatPrompt(message, context, currentText, additionalContext);
    const response = await this.callOpenAI(prompt, 1);

    if (response.success) {
      const reply = response.choices[0].message.content.trim();
      sendResponse({ success: true, reply });
    } else {
      sendResponse({ success: false, error: response.error });
    }
  }

  buildSuggestionPrompt(text, context, additionalContext = null) {
    let contextInfo = `Context:
- Page title: ${context.title}
- Website: ${context.domain}
- URL: ${context.url}
- Selected text: ${context.selection || 'None'}`;

    if (additionalContext) {
      contextInfo += `

Additional Context from other tab:
- Tab title: ${additionalContext.title}
- Tab URL: ${additionalContext.url}
- Tab content: ${additionalContext.content.substring(0, 500)}...`;
    }

    return `You are WebPilot, an AI writing assistant. The user is typing in a text field on a webpage.

${contextInfo}

Current text the user is typing: "${text}"

Provide 3 different suggestions to complete or improve the current sentence/phrase. Each suggestion should be:
1. Natural and contextually appropriate
2. Grammatically correct
3. Helpful for the user's writing
4. No longer than 2-3 sentences
5. Consider both the current page context and any additional context provided

Return only the suggestions, one per line, without numbering or additional formatting.`;
  }

  buildImprovePrompt(text, context, additionalContext = null) {
    let contextInfo = `Context:
- Page title: ${context.title}
- Website: ${context.domain}
- URL: ${context.url}`;

    if (additionalContext) {
      contextInfo += `
- Additional context from: ${additionalContext.title} (${additionalContext.url})`;
    }

    return `You are WebPilot, an AI writing assistant. Improve the following text for clarity, grammar, and style while maintaining the original meaning and tone.

${contextInfo}

Original text: "${text}"

Please improve this text by:
1. Fixing grammar and punctuation errors
2. Improving clarity and readability
3. Enhancing style and flow
4. Maintaining the original intent and tone
5. Considering any additional context provided for better relevance

Return only the improved text without any explanations or additional formatting.`;
  }

  buildRewritePrompt(text, context, additionalContext = null) {
    let contextInfo = `Context:
- Page title: ${context.title}
- Website: ${context.domain}
- URL: ${context.url}`;

    if (additionalContext) {
      contextInfo += `
- Additional context from: ${additionalContext.title} (${additionalContext.url})`;
    }

    return `You are WebPilot, an AI writing assistant. Rewrite the following text in a different way while keeping the same meaning.

${contextInfo}

Original text: "${text}"

Please rewrite this text by:
1. Using different words and sentence structures
2. Maintaining the same meaning and intent
3. Keeping the same tone and style
4. Making it more engaging if possible
5. Considering any additional context for better relevance

Return only the rewritten text without any explanations or additional formatting.`;
  }

  buildElaboratePrompt(text, context, additionalContext = null) {
    let contextInfo = `Context:
- Page title: ${context.title}
- Website: ${context.domain}
- URL: ${context.url}`;

    if (additionalContext) {
      contextInfo += `
- Additional context from: ${additionalContext.title} (${additionalContext.url})`;
    }

    return `You are WebPilot, an AI writing assistant. Elaborate on the following text by adding more detail, examples, or explanations.

${contextInfo}

Original text: "${text}"

Please elaborate on this text by:
1. Adding relevant details and context
2. Providing examples or explanations where appropriate
3. Expanding on key points
4. Maintaining the original tone and style
5. Using any additional context provided for better elaboration

Return only the elaborated text without any explanations or additional formatting.`;
  }

  buildChatPrompt(message, context, currentText, additionalContext = null) {
    let contextInfo = `Context:
- Page title: ${context.title}
- Website: ${context.domain}
- URL: ${context.url}
- Current text in the input field: "${currentText || 'Empty'}"`;

    if (additionalContext) {
      contextInfo += `
- Additional context from: ${additionalContext.title} (${additionalContext.url})
- Additional content: ${additionalContext.content.substring(0, 300)}...`;
    }

    return `You are WebPilot, an AI writing assistant helping a user write better content on a webpage.

${contextInfo}

User's question/request: "${message}"

Please provide a helpful, concise response that assists the user with their writing. Be friendly, professional, and specific to their request. If they're asking about the current text, provide suggestions for improvement. If they're asking general writing questions, provide clear, actionable advice.

Consider both the current page context and any additional context provided to give more relevant and comprehensive assistance.

Keep your response under 200 words unless the user specifically asks for more detail.`;
  }

  async callOpenAI(prompt, numChoices = 1) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are WebPilot, a helpful AI writing assistant. Provide clear, concise, and helpful responses.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
          n: numChoices
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return { success: true, choices: data.choices };
    } catch (error) {
      console.error('OpenAI API call failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGetSettings(sendResponse) {
    const settings = await chrome.storage.local.get(['openai_api_key']);
    sendResponse(settings);
  }

  async handleSaveSetting(request, sendResponse) {
    try {
      await chrome.storage.local.set({ [request.key]: request.value });
      // Re-load settings after saving
      await this.loadSettings(); 
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleTestApiKey(sendResponse) {
    if (!this.apiKey) {
      sendResponse({ success: false, message: 'API Key not set.' });
      return;
    }
    const response = await this.callOpenAI("Test: Say 'Hello World'", 1);
    if (response.success && response.choices[0].message.content.includes('Hello World')) {
      sendResponse({ success: true, message: 'API Key is valid and working!' });
    } else {
      sendResponse({ success: false, message: 'API Key is invalid or call failed.' });
    }
  }
}

// listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
  }
});

// Initialize the background script
new WebPilotBackground(); 