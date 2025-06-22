# WebPilot - AI Writing Assistant

WebPilot is a browser extension that provides AI-powered writing assistance similar to GitHub Copilot, but for any website. It helps you write better content by providing real-time suggestions, improvements, and rewriting capabilities using ChatGPT.

## ✨ Features

-   **Floating Toolbar**: A simple, robust toolbar that appears when you select text.
-   **Text Improvement**: Enhance clarity, grammar, and style with one click.
-   **Text Rewriting**: Rewrite content in different ways while maintaining meaning.
-   **Text Elaboration**: Expand and add detail to your writing.
-   **Chat Interface**: Ask WebPilot for writing help and advice.
-   **Context Awareness**: Understands the webpage context for better suggestions.
-   **Cross-Tab Context**: Include context from other browser tabs for enhanced AI assistance.
-   **Universal Compatibility**: Works on any website with text inputs.
-   **Keyboard Shortcuts**: Quick access with Ctrl/Cmd + Shift + P.
-   **Modern UI**: Beautiful, responsive interface with dark mode support.
-   **Instant Suggestions**: Accept or decline AI suggestions with one click.

## 🚀 Installation

### Method 1: Load as Unpacked Extension (Development)

1. **Download the extension files** to a folder on your computer
2. **Open Chrome/Edge** and go to `chrome://extensions/`
3. **Enable "Developer mode"** in the top right corner
4. **Click "Load unpacked"** and select the folder containing the extension files
5. **Pin the extension** to your toolbar for easy access

### Method 2: Build from Source

1. **Clone or download** this repository
2. **Open the folder** in your code editor
3. **Load as unpacked extension** following Method 1 above

## ⚙️ Setup

1. **Get an OpenAI API Key**:

    - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
    - Create an account or sign in
    - Generate a new API key (free tier available)

2. **Configure the Extension**:
    - Click the WebPilot extension icon in your browser
    - Enter your OpenAI API key in the settings
    - Click "Save API Key" and "Test Connection"
    - Enable/disable features as needed

## 🎯 How to Use

### Basic Usage

1. **Navigate to any website** with text input fields (Gmail, Notion, Twitter, etc.)
2. **Click on a text field** (input, textarea, or contenteditable)
3. **WebPilot sidebar appears** automatically on the right
4. **Start typing** to get real-time suggestions
5. **Use action buttons** to improve, rewrite, or elaborate your text

### Floating Toolbar

WebPilot includes a simple and robust floating toolbar that appears when you select text on any webpage.

**How it works:**

1. **Select Text**: Highlight any text on a page.
2. **Toolbar Appears**: A small toolbar will appear above your selection with "Improve", "Rewrite", and "Elaborate" options.
3. **Choose an Action**: Click one of the options.
4. **Get Suggestion**: The toolbar will be replaced by a panel showing the AI's suggestion.
5. **Accept or Decline**: You can accept the suggestion to replace your original text, or decline it to keep your text as is.

This feature provides a quick and effortless way to edit text without needing to open the main sidebar.

### Cross-Tab Context Feature

WebPilot can include context from other browser tabs to provide more relevant suggestions:

1. **Open the sidebar** by clicking on a text field
2. **Expand "Additional Tab Context"** section (click the arrow)
3. **Select a tab** from the dropdown list
4. **Click "Load Context"** to include that tab's content
5. **Get enhanced suggestions** that consider both current page and selected tab context
6. **Clear context** when no longer needed

**Use Cases:**

-   Writing an email while referencing information from another tab
-   Creating content based on research from multiple sources
-   Summarizing information from different web pages
-   Cross-referencing data while writing reports

### Action Buttons

-   **Improve**: Fixes grammar, improves clarity, and enhances style
-   **Rewrite**: Rewrites text using different words and structures
-   **Elaborate**: Expands text with more details and examples
-   **Chat**: Opens a chat interface for writing help

### Keyboard Shortcuts

-   **Ctrl/Cmd + Shift + P**: Toggle WebPilot sidebar
-   **Enter** in chat: Send message
-   **Shift + Enter** in chat: New line

### Supported Text Fields

-   Regular input fields (`<input type="text">`)
-   Text areas (`<textarea>`)
-   Contenteditable elements (`[contenteditable]`)
-   Rich text editors (Quill, ProseMirror)
-   Gmail compose windows
-   Notion pages
-   Twitter/X compose boxes
-   And many more!

## 🔧 Configuration

### Settings

-   **Enable/Disable**: Turn WebPilot on or off globally
-   **Auto-suggestions**: Enable/disable real-time suggestions
-   **API Key Management**: Save and test your OpenAI API key

### Customization

The extension automatically adapts to:

-   **Dark/Light mode** based on system preferences
-   **Responsive design** for different screen sizes
-   **Website context** for better suggestions
-   **Cross-tab context** for enhanced AI assistance

## 🛠️ Technical Details

### Architecture

-   **Manifest V3**: Modern Chrome extension architecture
-   **Content Scripts**: Inject UI and handle text field detection
-   **Background Script**: Manages API calls and extension logic
-   **Popup Interface**: Settings and configuration management
-   **Cross-Tab Communication**: Secure tab context extraction

### API Integration

-   **OpenAI GPT-3.5-turbo**: For all AI-powered features
-   **Context-Aware Prompts**: Includes webpage information for better suggestions
-   **Multi-Context Support**: Combines current page and additional tab context
-   **Error Handling**: Graceful fallbacks for API issues

### Security

-   **Local Storage**: API keys stored securely in browser storage
-   **No Data Collection**: All processing happens locally
-   **Privacy-First**: No user data sent to external servers except OpenAI
-   **Tab Isolation**: Context extraction only when explicitly requested

## 📁 File Structure

```plaintext
WebPilot/
├── manifest.json          # Extension configuration
├── content.js            # Content script for webpage integration
├── background.js         # Background script for API handling
├── popup.html           # Settings popup interface
├── popup.js             # Popup functionality
├── styles.css           # UI styling
├── README.md            # This file
└── icons/               # Extension icons (create this folder)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🎨 Creating Icons

You'll need to create icon files for the extension:

1. **Create an `icons` folder** in the extension directory
2. **Add icon files**:
    - `icon16.png` (16x16 pixels)
    - `icon48.png` (48x48 pixels)
    - `icon128.png` (128x128 pixels)

You can use any image editor or online icon generators to create these icons.

## 🔍 Troubleshooting

### Common Issues

**Extension not working:**

-   Check if the extension is enabled in `chrome://extensions/`
-   Verify your OpenAI API key is valid
-   Test the API connection in settings

**No suggestions appearing:**

-   Ensure you have a valid API key configured
-   Check if auto-suggestions are enabled
-   Try refreshing the webpage

**Sidebar not appearing:**

-   Click on a text input field to trigger the sidebar
-   Use Ctrl/Cmd + Shift + P to manually toggle
-   Check if the extension is enabled

**Tab context not loading:**

-   Ensure the target tab is accessible (not a chrome:// page)
-   Check if the tab has loaded completely
-   Try refreshing the target tab

**API errors:**

-   Verify your API key is correct
-   Check your OpenAI account balance
-   Ensure you have internet connectivity

### Debug Mode

1. **Open Developer Tools** (F12)
2. **Check Console** for error messages
3. **Look for WebPilot-related logs**
4. **Test API calls** in the Network tab

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Development Setup

1. **Clone the repository**
2. **Load as unpacked extension**
3. **Make changes to files**
4. **Reload extension** in `chrome://extensions/`
5. **Test on different websites**

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

-   **OpenAI** for providing the GPT API
-   **Chrome Extensions** team for the excellent documentation
-   **GitHub Copilot** for inspiration

## 📞 Support

If you encounter any issues or have questions:

1. **Check the troubleshooting section** above
2. **Review the console logs** for error messages
3. **Test with a different website** to isolate issues
4. **Create an issue** in the repository

## 🔄 Updates

To update the extension:

1. **Download the latest version**
2. **Replace the old files** with new ones
3. **Reload the extension** in `chrome://extensions/`
4. **Test functionality** on your favorite websites

---

**Happy Writing! ✍️**

WebPilot makes writing better, one suggestion at a time.
