# WebPilot Installation Guide

## Quick Start

### Step 1: Download and Prepare Files

1. **Download all extension files** to a folder on your computer
2. **Create icons** (see Icon Creation section below)
3. **Ensure all files are in the same folder**:
   ```
   WebPilot/
   ├── manifest.json
   ├── content.js
   ├── background.js
   ├── popup.html
   ├── popup.js
   ├── styles.css
   ├── README.md
   ├── create-icons.html
   └── icons/
       ├── icon16.png
       ├── icon48.png
       └── icon128.png
   ```

### Step 2: Create Icons

**Option A: Use the Icon Generator**
1. Open `create-icons.html` in your browser
2. Click "Download" for each icon size
3. Save the files as `icon16.png`, `icon48.png`, and `icon128.png`
4. Place them in the `icons` folder

**Option B: Create Your Own Icons**
1. Create three PNG images: 16x16, 48x48, and 128x128 pixels
2. Name them `icon16.png`, `icon48.png`, and `icon128.png`
3. Place them in the `icons` folder

### Step 3: Install in Chrome/Edge

1. **Open Chrome or Edge** and go to `chrome://extensions/`
2. **Enable "Developer mode"** (toggle in top right)
3. **Click "Load unpacked"**
4. **Select the WebPilot folder** containing all the files
5. **Pin the extension** to your toolbar (click the puzzle piece icon)

**Note:** The extension requires permissions for:
- **Active Tab**: To access the current webpage
- **Storage**: To save your API key and settings
- **Scripting**: To inject the sidebar interface
- **Tabs**: To enable cross-tab context feature
- **All URLs**: To work on any website

### Step 4: Configure API Key

1. **Get an OpenAI API key**:
   - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - Sign up or log in
   - Create a new API key

2. **Configure the extension**:
   - Click the WebPilot icon in your browser
   - Enter your API key
   - Click "Save API Key"
   - Click "Test Connection" to verify

### Step 5: Start Using

1. **Go to any website** with text fields (Gmail, Notion, etc.)
2. **Click on a text input** or textarea
3. **WebPilot sidebar appears** automatically
4. **Start typing** to get AI suggestions!

### Step 6: Try Cross-Tab Context (New Feature!)

1. **Open multiple tabs** with different content
2. **Click on a text field** to open WebPilot
3. **Expand "Additional Tab Context"** section
4. **Select another tab** from the dropdown
5. **Click "Load Context"** to include that tab's content
6. **Get enhanced suggestions** that consider both pages!

## Troubleshooting

### Extension Not Loading
- Check that all files are in the same folder
- Ensure `manifest.json` is not corrupted
- Try reloading the extension in `chrome://extensions/`

### Icons Not Showing
- Verify all three icon files exist in the `icons` folder
- Check file names are exactly: `icon16.png`, `icon48.png`, `icon128.png`
- Reload the extension after adding icons

### API Key Issues
- Verify your API key starts with `sk-`
- Check your OpenAI account has credits
- Test the connection in extension settings

### Sidebar Not Appearing
- Click on a text input field to trigger the sidebar
- Use Ctrl/Cmd + Shift + P to manually toggle
- Check if the extension is enabled in settings

### Tab Context Not Working
- Ensure the target tab is accessible (not a chrome:// page)
- Check if the tab has loaded completely
- Try refreshing the target tab
- Verify the extension has "Tabs" permission

## Browser Compatibility

- ✅ **Chrome** (version 88+)
- ✅ **Edge** (version 88+)
- ✅ **Brave** (version 88+)
- ❌ **Firefox** (requires different manifest format)
- ❌ **Safari** (requires different architecture)

## File Descriptions

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration and permissions |
| `content.js` | Detects text fields and injects sidebar |
| `background.js` | Handles API calls to OpenAI and tab context |
| `popup.html` | Settings interface |
| `popup.js` | Settings functionality |
| `styles.css` | UI styling and animations |
| `create-icons.html` | Icon generator tool |

## New Features

### Cross-Tab Context
- **Load context from other tabs** for enhanced AI suggestions
- **Select any open tab** from a dropdown list
- **Combine multiple sources** for better writing assistance
- **Clear context** when no longer needed

### Enhanced UI
- **Collapsible context sections** for better organization
- **Current page information** display
- **Tab context management** interface
- **Improved responsive design**

## Next Steps

After installation:
1. **Test on different websites** (Gmail, Notion, Twitter, etc.)
2. **Try the cross-tab context feature** with multiple tabs
3. **Customize settings** in the popup
4. **Learn keyboard shortcuts** (Ctrl/Cmd + Shift + P)
5. **Explore all features** (Improve, Rewrite, Elaborate, Chat)

## Support

If you encounter issues:
1. Check the console for error messages (F12)
2. Verify all files are present and correct
3. Test with a different website
4. Reload the extension

---

**Happy Writing! ✍️** 