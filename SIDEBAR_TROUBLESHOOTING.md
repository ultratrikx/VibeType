# 🔧 WebPilot Sidebar Troubleshooting Guide

## The sidebar is not showing? Here's how to fix it!

### 🔍 **Quick Diagnosis**

1. **Open your browser's Developer Tools** (F12 or right-click → Inspect)
2. **Go to the Console tab**
3. **Type and run:** `WebPilotDiagnostic()`
4. **Check the output** for any red ❌ errors

### 🚀 **Quick Fixes**

#### **Method 1: Manual Toggle**

1. **In the browser console, type:** `WebPilotToggle()`
2. **Press Enter** - this should show/hide the sidebar

#### **Method 2: Extension Icon**

1. **Click the WebPilot extension icon** in your browser toolbar
2. **Should toggle the sidebar on/off**

#### **Method 3: Text Field Focus**

1. **Click on any text input field** (like a search box, textarea, etc.)
2. **The sidebar should automatically appear**

#### **Method 4: Emergency Reset (New!)**

1. **In the browser console, type:** `WebPilotReset()`
2. **Press Enter** - this performs a complete reset and recreation
3. **Wait a few seconds** for the sidebar to reappear

### 🐛 **Common Issues & Solutions**

#### **Issue: Extension not loading**

-   ✅ **Check:** Go to `chrome://extensions/` and ensure WebPilot is **enabled**
-   ✅ **Reload:** Try refreshing the webpage
-   ✅ **Restart:** Disable and re-enable the extension

#### **Issue: Iframe not found**

-   ✅ **Check console** for error messages about `sidebar.html`
-   ✅ **Verify files:** Make sure `sidebar.html` exists in the extension folder
-   ✅ **Reload extension:** Go to `chrome://extensions/` and click the reload button

#### **Issue: Sidebar appears but is blank**

-   ✅ **Check iframe source:** Run `WebPilotDiagnostic()` and verify the iframe src URL
-   ✅ **Check permissions:** Extension might need permission to load local files
-   ✅ **Check console:** Look for any loading errors in the iframe

#### **Issue: Console shows "Chrome extension API not available"**

-   ✅ **Browser compatibility:** Make sure you're using Chrome, Edge, or Firefox with manifest v3 support
-   ✅ **Extension context:** The page might be blocking extension scripts
-   ✅ **Try different website:** Some sites (like chrome:// pages) block extensions

### 🎮 **Fixing Toolbar Buttons Not Working**

If the toolbar appears but the buttons (Elaborate, Improve, Rewrite) don't function when clicked:

    1. **Run the toolbar button fix command**: `WebPilotFixToolbarButtons()` in console

2. **Check the browser console** for any JavaScript errors when clicking buttons
3. **Run WebPilotReset()** in the console to completely refresh the extension
4. **Verify selection** - some buttons only work with selected text
5. **Retry after page refresh** - page scripts might be interfering
6. **Check text length** - buttons may not work on very short text (under 10 characters)

**Common Toolbar Issues:**

-   **Buttons appear but don't respond**: Use `WebPilotFixToolbarButtons()` to reattach listeners
-   **Toolbar appears briefly and disappears**: This may occur due to several reasons:
    -   **Accidental click**: If you click somewhere else on the page right after selecting text
    -   **Scroll events**: Moving the page (even slightly) triggers the hide behavior
    -   **Selection issues**: The text selection might not be properly maintained
    -   **Fix**: Try these solutions:
        1. **Select text and don't move the mouse** before clicking a toolbar button
        2. **Run `WebPilotTestToolbar()`** in the console to force the toolbar to show
        3. **Run `WebPilotToolbarDebug()`** in the console to show detailed toolbar state
        4. **Run `WebPilotFixDisappearingToolbar()`** to modify the toolbar behavior for better persistence
        5. **Run `WebPilotKeepToolbarVisible()`** to force the toolbar to stay visible
        6. **Disable competing extensions** that might be interfering with text selection
        7. **Try selecting text by triple-clicking** a paragraph instead of dragging
        8. **Ensure no gestures or shortcuts** are conflicting with the toolbar actions

### 📝 **Fixing Text Editing Issues**

If the toolbar buttons work (showing suggestions) but the text doesn't actually change when you click "Accept":

1. **Test the text edit functionality**: Run `WebPilotTestTextEdit()` in the console
2. **Check if the Accept button works**: Run `WebPilotTestAccept()` in the console
3. **Check permissions**: Some websites restrict editing of their content
4. **Try a different input field**: Some custom editors have special handling
5. **Refresh the page**: Sometimes the DOM state gets corrupted

**Common Text Editing Issues:**

-   **Text doesn't change at all**: Usually a permissions or content security issue
-   **Wrong text is replaced**: Selection tracking issue, try selecting text again
-   **Text is replaced but reverts**: Framework reactivity issue, try typing manually after
-   **Error in console**: Look for Range or DOM manipulation errors

### 🔧 **Debug Commands**

Run these in your browser console:

```javascript
// Full diagnostic
WebPilotDiagnostic();

// Manual toggle
WebPilotToggle();

// Fix toolbar buttons
WebPilotFixToolbarButtons();

// Check if controller exists
console.log("Controller exists:", !!window.webPilotController);

// Check iframe manually
console.log("Iframe:", document.getElementById("webpilot-sidebar-iframe"));

// Force show sidebar
if (window.webPilotController) {
    window.webPilotController.showSidebar();
}
```

### 🔧 **New Advanced Debug Commands**

When standard troubleshooting doesn't work, try these advanced commands in the browser console:

```javascript
// EMERGENCY RESET - Use when sidebar is completely broken
WebPilotReset();

// FIX TOOLBAR BUTTONS - Use when buttons don't respond
WebPilotFixToolbarButtons();

// TEST TEXT EDITING - Use to test text editing functionality
WebPilotTestTextEdit();

// TEST ACCEPT SUGGESTION - Use with the above command
WebPilotTestAccept();

// Detailed diagnostic
WebPilotDiagnostic();

// Manual sidebar toggle
WebPilotToggle();

// Force show sidebar directly
document.getElementById("webpilot-sidebar-iframe").style.display = "block";

// Check for any errors
console.error("Check if there are any red error messages above");
```

### 🛠️ **Fixing "Receiving end does not exist" Error**

If you see the error "Receiving end does not exist" when clicking the extension icon:

1. **Go to** `chrome://extensions/`
2. **Find WebPilot** and click the "Reload" icon (circular arrow)
3. **Refresh your current tab** completely
4. **Try the WebPilotReset()** function in console
5. **Visit a different website** - some sites block extensions

### ⚠️ **Fixing "Toolbar listeners" Error**

If you see errors related to "this.addFloatingToolbarListeners is not a function":

1. **Run WebPilotReset()** to completely recreate the extension elements
2. **Check for syntax errors** - this indicates code mismatch
3. **Reinstall the extension** if problems persist

### ⚠️ **Fixing "Extension context invalidated" Error**

If you see an error message about "Extension context invalidated" when using the toolbar:

1. **Reload the page** you're working on
2. **Reopen the browser tab** if reloading doesn't help
3. **Check if the extension is still enabled** in chrome://extensions/
4. If the error persists, try **restarting your browser**

This error typically occurs when:

-   The browser tab has been open for a very long time
-   The extension was updated while the page was open
-   There was a conflict with another extension
-   The browser is running low on memory

The extension will try to recover automatically by showing a message instead of crashing, but reloading the page is the most reliable fix.

### 📋 **Step-by-Step Verification**

1. **Extension Status**

    - Go to `chrome://extensions/`
    - Find "WebPilot - AI Writing Assistant"
    - Ensure it's **enabled** and has a green toggle

2. **Page Reload**

    - Refresh the current webpage
    - Open developer console (F12)
    - Look for "WebPilot: Content script initialized successfully"

3. **Manual Test**

    - Run `WebPilotDiagnostic()` in console
    - Should show ✅ for content script, iframe, and toolbar

4. **Trigger Test**
    - Click on any text input field
    - Should see "WebPilot: Attempting to show sidebar" in console
    - Sidebar should appear on the right side

### 🎯 **Expected Behavior**

When working correctly:

-   **Auto-show:** Sidebar appears when clicking on text fields
-   **Manual toggle:** Extension icon toggles sidebar
-   **Console logs:** You'll see initialization and action messages
-   **Visual:** Sidebar appears on the right side with WebPilot interface

### 🆘 **Still Not Working?**

If none of the above solutions work:

1. **Check browser compatibility:** Chrome, Edge, or Firefox (latest versions)
2. **Try incognito mode:** Sometimes extensions are disabled in private browsing
3. **Check website restrictions:** Some sites block extension scripts
4. **Reinstall extension:** Remove and reload the extension files
5. **Test on different websites:** Try Gmail, Google Docs, or basic HTML pages

### 🧪 **Test Pages**

Try these websites to test if the sidebar works:

-   **Gmail:** compose.gmail.com
-   **Google Docs:** docs.google.com
-   **Basic HTML:** Use the included `test-floating-toolbar.html`
-   **Any site with text inputs**

### 💡 **Pro Tips**

-   **Console is your friend:** Always check the browser console for error messages
-   **Use diagnostic functions:** `WebPilotDiagnostic()` gives you a complete health check
-   **Try manual toggle:** `WebPilotToggle()` bypasses automatic triggers
-   **Check permissions:** Some sites require special permissions for extensions

---

**If you're still having issues, share the output of `WebPilotDiagnostic()` for more targeted help!** 🚀

### 🔍 **Using the Floating Toolbar**

The floating toolbar now appears **only** when you select text on a page. This is a deliberate design choice to focus on editing selected text.

**How to Use the Floating Toolbar:**

1. **Select text** on any webpage by clicking and dragging your mouse
2. The toolbar will automatically appear above your selection
3. Click one of the buttons (Elaborate, Improve, Rewrite)
4. Review the suggested change in the panel
5. Click "Accept" to apply the change or "Decline" to cancel

**Important Notes:**

-   The toolbar will no longer appear automatically after typing
-   You must have text selected for the toolbar buttons to work
-   If you get "Extension context invalidated" errors, reload the page

**Troubleshooting Tips:**

-   If the toolbar doesn't appear when selecting text, try clicking inside a text field first
-   Some websites restrict text editing - try a simpler website if having issues
-   Use WebPilotFixToolbarButtons() if buttons don't respond to clicks
