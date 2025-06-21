/**
 * Content Processor - Main module that integrates HTML parsing, content chunking, and semantic search
 */
class ContentProcessor {
    /**
     * Initialize content processor
     * @param {Object} options - Processor options
     * @param {string} [options.apiKey] - OpenAI API key
     * @param {string} [options.embeddingModel="text-embedding-3-small"] - Embedding model to use
     * @param {number} [options.chunkSize=750] - Target chunk size
     * @param {number} [options.overlapPercentage=0.15] - Chunk overlap percentage
     */
    constructor(options = {}) {
        this.apiKey = options.apiKey || null;

        // Initialize components
        this.htmlParser = new HTMLParser();
        this.contentChunker = new ContentChunker({
            targetChunkSize: options.chunkSize || 750,
            overlapPercentage: options.overlapPercentage || 0.15,
        });
        this.semanticSearcher = new SemanticSearcher({
            apiKey: this.apiKey,
            embeddingModel: options.embeddingModel || "text-embedding-3-small",
        });
    }

    /**
     * Set OpenAI API key
     * @param {string} apiKey - OpenAI API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.semanticSearcher.setApiKey(apiKey);
    }

    /**
     * Process HTML content
     * @param {Object} options - Processing options
     * @param {string} options.html - HTML content to process
     * @param {string} [options.query=""] - Search query (if specified, will return relevant chunks)
     * @param {number} [options.topK=3] - Number of top chunks to return
     * @returns {Promise<Object>} Processing result
     */
    async process(options) {
        try {
            // Check if API key is set
            if (!this.apiKey) {
                throw new Error("OpenAI API key is required");
            }

            const { html, query = "", topK = 3 } = options;

            // 1. Parse HTML to extract main content
            console.log("Parsing HTML...");
            const extractionResult = this.htmlParser.extractMainContent(html);
            if (!extractionResult.success) {
                throw new Error(
                    "HTML parsing failed: " + extractionResult.error
                );
            }

            // 2. Chunk the content
            console.log("Chunking content...");
            const chunks = this.contentChunker.chunkByHeadings(
                extractionResult.markdown,
                extractionResult.title
            );

            // 3. Create embeddings for chunks
            console.log("Creating embeddings...");
            const chunksWithEmbeddings =
                await this.semanticSearcher.embedChunks(chunks);

            // Prepare the response
            const result = {
                success: true,
                title: extractionResult.title,
                content: extractionResult.text,
                content_markdown: extractionResult.markdown,
                chunk_count: chunks.length,
                chunks: chunks.map((c) => ({ ...c, embedding: undefined })), // Send chunks without embeddings
            };

            // 4. If query is specified, find relevant chunks
            if (query) {
                console.log("Searching for relevant chunks...");
                const relevantChunks =
                    await this.semanticSearcher.searchWithFallback(
                        query,
                        chunksWithEmbeddings,
                        topK
                    );

                result.most_relevant_chunks = relevantChunks;
            }

            return result;
        } catch (error) {
            console.error("Content processing failed:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Process HTML content and get full context with embeddings
     * @param {Object} options - Processing options
     * @param {string} options.html - HTML content to process
     * @param {string} options.query - Query to get context for
     * @param {number} [options.topK=5] - Number of top chunks to return
     * @returns {Promise<Object>} Processing result with full content and relevant chunks
     */
    async getFullContextWithEmbeddings(options) {
        try {
            const processResult = await this.process(options);

            if (!processResult.success) {
                throw new Error(processResult.error || "Processing failed");
            }

            // Add the full content as context
            const fullContext = {
                title: processResult.title,
                content: processResult.content,
                content_markdown: processResult.content_markdown,
                relevant_chunks: processResult.most_relevant_chunks || [],
                full_page_context: true,
            };

            return {
                success: true,
                context: fullContext,
            };
        } catch (error) {
            console.error("Failed to get full context with embeddings:", error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

// Export the class
if (typeof module !== "undefined") {
    module.exports = { ContentProcessor };
}
