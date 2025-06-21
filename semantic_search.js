/**
 * Semantic Search - Finds most relevant chunks using embeddings
 * A JavaScript replacement for the Python SemanticSearcher
 */
class SemanticSearcher {
    /**
     * Initialize semantic searcher
     * @param {Object} options - Options
     * @param {string} [options.apiKey] - OpenAI API key
     * @param {string} [options.embeddingModel="text-embedding-3-small"] - Embedding model to use
     */
    constructor(options = {}) {
        this.apiKey = options.apiKey || null;
        this.embeddingModel =
            options.embeddingModel || "text-embedding-3-small";
    }

    /**
     * Set OpenAI API key
     * @param {string} apiKey - OpenAI API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Get embedding for a text
     * @param {string} text - Text to embed
     * @returns {Promise<Array<number>>} Embedding vector
     */
    async getEmbedding(text) {
        if (!this.apiKey) {
            throw new Error("OpenAI API key is required");
        }

        try {
            const response = await fetch(
                "https://api.openai.com/v1/embeddings",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: this.embeddingModel,
                        input: text,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    `OpenAI API error: ${
                        error.error?.message || response.statusText
                    }`
                );
            }

            const result = await response.json();
            return result.data[0].embedding;
        } catch (error) {
            console.error("Error getting embedding:", error);
            throw error;
        }
    }

    /**
     * Get embeddings for multiple texts in batch
     * @param {Array<string>} texts - List of texts to embed
     * @returns {Promise<Array<Array<number>>>} List of embedding vectors
     */
    async getEmbeddingsBatch(texts) {
        if (!this.apiKey) {
            throw new Error("OpenAI API key is required");
        }

        try {
            const response = await fetch(
                "https://api.openai.com/v1/embeddings",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: this.embeddingModel,
                        input: texts,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    `OpenAI API error: ${
                        error.error?.message || response.statusText
                    }`
                );
            }

            const result = await response.json();
            return result.data.map((item) => item.embedding);
        } catch (error) {
            console.error("Error getting batch embeddings:", error);
            throw error;
        }
    }

    /**
     * Add embeddings to chunks
     * @param {Array<Object>} chunks - List of chunk objects
     * @returns {Promise<Array<Object>>} Chunks with embeddings added
     */
    async embedChunks(chunks) {
        // Prepare texts for embedding
        const texts = chunks.map((chunk) => {
            // Combine title and content for better context
            const text = `${chunk.title || ""}\n\n${chunk.content || ""}`;
            return text.trim();
        });

        // Get embeddings in batch
        const embeddings = await this.getEmbeddingsBatch(texts);

        // Add embeddings to chunks
        return chunks.map((chunk, i) => ({
            ...chunk,
            embedding: i < embeddings.length ? embeddings[i] : [],
        }));
    }

    /**
     * Find most relevant chunks for a query
     * @param {string} query - Search query
     * @param {Array<Object>} chunks - List of chunks with embeddings
     * @param {number} [topK=3] - Number of top chunks to return
     * @returns {Promise<Array<Object>>} List of most relevant chunks with similarity scores
     */
    async findRelevantChunks(query, chunks, topK = 3) {
        // Get query embedding
        const queryEmbedding = await this.getEmbedding(query);

        // Calculate similarities
        const similarities = chunks
            .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)
            .map((chunk) => ({
                chunk,
                similarity: this.cosineSimilarity(
                    queryEmbedding,
                    chunk.embedding
                ),
            }));

        // Sort by similarity and return top-k
        similarities.sort((a, b) => b.similarity - a.similarity);

        const relevantChunks = similarities
            .slice(0, topK)
            .map(({ chunk, similarity }) => {
                const relevantChunk = { ...chunk };
                relevantChunk.similarity_score = similarity;
                // Remove embedding from response to reduce size
                delete relevantChunk.embedding;
                return relevantChunk;
            });

        return relevantChunks;
    }

    /**
     * Search with keyword fallback if semantic search fails
     * @param {string} query - Search query
     * @param {Array<Object>} chunks - List of chunks
     * @param {number} [topK=3] - Number of top chunks to return
     * @returns {Promise<Array<Object>>} List of most relevant chunks
     */
    async searchWithFallback(query, chunks, topK = 3) {
        try {
            return await this.findRelevantChunks(query, chunks, topK);
        } catch (error) {
            console.error("Semantic search failed:", error);
            return this._keywordFallback(query, chunks, topK);
        }
    }

    /**
     * Fallback keyword-based search
     * @param {string} query - Search query
     * @param {Array<Object>} chunks - List of chunks
     * @param {number} [topK=3] - Number of top chunks to return
     * @returns {Array<Object>} List of chunks ranked by keyword relevance
     * @private
     */
    _keywordFallback(query, chunks, topK = 3) {
        const queryWords = new Set(query.toLowerCase().split(/\s+/));

        const scoredChunks = chunks
            .map((chunk) => {
                const content = `${chunk.title || ""} ${
                    chunk.content || ""
                }`.toLowerCase();
                const contentWords = new Set(content.split(/\s+/));

                // Simple keyword matching score
                const commonWords = [...queryWords].filter((word) =>
                    contentWords.has(word)
                );
                const score =
                    queryWords.size > 0
                        ? commonWords.length / queryWords.size
                        : 0;

                if (score > 0) {
                    const resultChunk = { ...chunk };
                    resultChunk.similarity_score = score;
                    resultChunk.search_type = "keyword_fallback";
                    // Remove embedding to reduce response size
                    delete resultChunk.embedding;
                    return resultChunk;
                }
                return null;
            })
            .filter((chunk) => chunk !== null);

        // Sort by score and return top-k
        scoredChunks.sort((a, b) => b.similarity_score - a.similarity_score);
        return scoredChunks.slice(0, topK);
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array<number>} vecA - First vector
     * @param {Array<number>} vecB - Second vector
     * @returns {number} Cosine similarity
     * @private
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }
}

// Export the class
if (typeof module !== "undefined") {
    module.exports = { SemanticSearcher };
}
