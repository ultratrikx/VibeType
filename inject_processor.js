/**
 * This script initializes the required components in the content page
 * so they're accessible for execution by the background script
 */
(function injectContentProcessor() {
    // If the script is already injected, do nothing
    if (window.ContentProcessor) {
        return;
    }

    // Make the classes available in the global scope
    window.HTMLParser = HTMLParser;
    window.ContentChunker = ContentChunker;
    window.SemanticSearcher = SemanticSearcher;
    window.ContentProcessor = ContentProcessor;

    console.log("WebPilot: Content processing components initialized");
})();
