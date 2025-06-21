/**
 * This script initializes the required components in the content page
 * so they're accessible for execution by the background script
 */
(function injectContentProcessor() {
    // If the script is already injected, do nothing
    if (
        window.ContentProcessor &&
        window.HTMLParser &&
        window.ContentChunker &&
        window.SemanticSearcher
    ) {
        console.log(
            "WebPilot: Content processing components already initialized"
        );
        return;
    }

    let retryCount = 0;
    const maxRetries = 100; // 10 seconds total (100 * 100ms)

    // Wait for classes to be available, then make them global
    const initializeClasses = () => {
        try {
            // Check if classes exist in current scope or already global
            const htmlParser =
                window.HTMLParser ||
                (typeof HTMLParser !== "undefined" ? HTMLParser : null);
            const contentChunker =
                window.ContentChunker ||
                (typeof ContentChunker !== "undefined" ? ContentChunker : null);
            const semanticSearcher =
                window.SemanticSearcher ||
                (typeof SemanticSearcher !== "undefined"
                    ? SemanticSearcher
                    : null);
            const contentProcessor =
                window.ContentProcessor ||
                (typeof ContentProcessor !== "undefined"
                    ? ContentProcessor
                    : null);

            if (
                htmlParser &&
                contentChunker &&
                semanticSearcher &&
                contentProcessor
            ) {
                // Make the classes available in the global scope
                window.HTMLParser = htmlParser;
                window.ContentChunker = contentChunker;
                window.SemanticSearcher = semanticSearcher;
                window.ContentProcessor = contentProcessor;

                console.log(
                    "WebPilot: Content processing components initialized successfully"
                );
                console.log("Available classes:", {
                    HTMLParser: typeof window.HTMLParser,
                    ContentChunker: typeof window.ContentChunker,
                    SemanticSearcher: typeof window.SemanticSearcher,
                    ContentProcessor: typeof window.ContentProcessor,
                });
                return true;
            } else {
                retryCount++;
                if (retryCount >= maxRetries) {
                    console.error(
                        "WebPilot: Failed to initialize content processing components after",
                        maxRetries,
                        "attempts"
                    );
                    console.error("Missing classes:", {
                        HTMLParser: typeof htmlParser,
                        ContentChunker: typeof contentChunker,
                        SemanticSearcher: typeof semanticSearcher,
                        ContentProcessor: typeof contentProcessor,
                    });
                    console.error("Window check:", {
                        HTMLParser: typeof window.HTMLParser,
                        ContentChunker: typeof window.ContentChunker,
                        SemanticSearcher: typeof window.SemanticSearcher,
                        ContentProcessor: typeof window.ContentProcessor,
                    });
                    return false;
                }

                // If classes aren't ready yet, try again in 100ms
                setTimeout(initializeClasses, 100);
                return false;
            }
        } catch (error) {
            console.error(
                "WebPilot: Error initializing content processing components:",
                error
            );
            retryCount++;
            if (retryCount < maxRetries) {
                setTimeout(initializeClasses, 100);
            }
            return false;
        }
    };

    initializeClasses();
})();
