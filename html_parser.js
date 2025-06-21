/**
 * HTML Parser - Extracts clean content from HTML
 * A JavaScript replacement for the Python HTMLParser
 */
class HTMLParser {
    constructor() {
        // Configure default options
        this.options = {
            removeSelectors: [
                "script",
                "style",
                "header",
                "footer",
                "nav",
                "aside",
                ".noprint",
                ".ad",
                ".ads",
                ".advert",
                '[role="banner"]',
                '[role="contentinfo"]',
                '[role="navigation"]',
                '[class*="sidebar"]',
                '[id*="sidebar"]',
            ],
            preferredContent: [
                "main",
                "article",
                '[role="main"]',
                ".main-content",
                ".article-content",
                ".post-content",
                ".content",
                "#content",
            ],
        };
    }

    /**
     * Extract main content from HTML
     * @param {string} html - Raw HTML content
     * @returns {Object} Object containing title, clean HTML, and markdown
     */
    extractMainContent(html) {
        try {
            // Create a document from the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Get title
            const title = doc.title || "Extracted Content";

            // Clone the body for cleaning
            const body = doc.body.cloneNode(true);

            // Remove unwanted elements
            this._removeUnwantedElements(body);

            // Find main content
            const mainContent = this._findMainContent(body);

            // Convert to clean text and markdown
            const text = this._getCleanText(mainContent || body);
            const markdown = this._convertToMarkdown(mainContent || body);

            return {
                title: title,
                html: mainContent ? mainContent.innerHTML : body.innerHTML,
                markdown: markdown,
                text: text,
                success: true,
            };
        } catch (error) {
            console.error("HTML parsing error:", error);
            // Fall back to basic extraction
            return this._fallbackExtraction(html, error.message);
        }
    }

    /**
     * Remove unwanted elements from DOM
     * @param {Element} element - DOM element to clean
     * @private
     */
    _removeUnwantedElements(element) {
        this.options.removeSelectors.forEach((selector) => {
            element.querySelectorAll(selector).forEach((el) => {
                el.remove();
            });
        });
    }

    /**
     * Find the main content element in the DOM
     * @param {Element} element - DOM element to search within
     * @returns {Element|null} Main content element or null
     * @private
     */
    _findMainContent(element) {
        for (const selector of this.options.preferredContent) {
            const found = element.querySelector(selector);
            if (found) {
                return found;
            }
        }
        return null;
    }

    /**
     * Extract clean text from an element
     * @param {Element} element - DOM element
     * @returns {string} Clean text content
     * @private
     */
    _getCleanText(element) {
        // Get text and clean up whitespace
        let text = element.innerText || "";
        text = text.replace(/(\r\n|\n|\r){3,}/gm, "\n\n").trim();
        return text;
    }

    /**
     * Convert element content to markdown-like format
     * @param {Element} element - DOM element
     * @returns {string} Markdown-like text
     * @private
     */
    _convertToMarkdown(element) {
        let markdown = "";

        // Clone element to work with
        const workingElement = element.cloneNode(true);

        // Process headings
        for (let i = 1; i <= 6; i++) {
            workingElement.querySelectorAll(`h${i}`).forEach((heading) => {
                const text = heading.innerText.trim();
                const prefix = "#".repeat(i);
                heading.innerHTML = `${prefix} ${text}`;
            });
        }

        // Process links
        workingElement.querySelectorAll("a").forEach((link) => {
            const text = link.innerText.trim();
            const href = link.getAttribute("href");
            if (href && text) {
                link.innerHTML = `[${text}](${href})`;
            }
        });

        // Process lists
        workingElement.querySelectorAll("ul li").forEach((item) => {
            const text = item.innerText.trim();
            item.innerHTML = `* ${text}`;
        });

        workingElement.querySelectorAll("ol li").forEach((item, index) => {
            const text = item.innerText.trim();
            item.innerHTML = `${index + 1}. ${text}`;
        });

        // Get text and clean up whitespace
        markdown = workingElement.innerText || "";
        markdown = markdown.replace(/(\r\n|\n|\r){3,}/gm, "\n\n").trim();

        return markdown;
    }

    /**
     * Fallback extraction method
     * @param {string} html - Raw HTML content
     * @param {string} error - Error message
     * @returns {Object} Extraction result
     * @private
     */
    _fallbackExtraction(html, error) {
        try {
            // Basic extraction by creating DOM and getting innerText
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Simple cleanup
            const body = doc.body.cloneNode(true);
            body.querySelectorAll("script, style").forEach((el) => el.remove());

            const text = body.innerText || "";
            const cleanText = text.replace(/(\r\n|\n|\r){3,}/gm, "\n\n").trim();

            return {
                title: doc.title || "Extracted Content",
                html: body.innerHTML,
                markdown: cleanText,
                text: cleanText,
                success: true,
                fallback: true,
                original_error: error,
            };
        } catch (fallbackError) {
            return {
                title: "",
                html: "",
                markdown: "",
                text: "",
                success: false,
                error: `Primary error: ${error}, Fallback error: ${fallbackError.message}`,
            };
        }
    }
}

// Export the class
if (typeof module !== "undefined") {
    module.exports = { HTMLParser };
}
