/**
 * Content Chunker - Splits content into semantic chunks
 * A JavaScript replacement for the Python ContentChunker
 */
class ContentChunker {
    /**
     * Initialize chunker
     * @param {Object} options - Chunker options
     * @param {number} [options.targetChunkSize=750] - Target size in characters for each chunk
     * @param {number} [options.overlapPercentage=0.15] - Percentage of overlap between chunks (0.0 - 1.0)
     */
    constructor(options = {}) {
        this.targetChunkSize = options.targetChunkSize || 750;
        this.overlapPercentage = options.overlapPercentage || 0.15;
        this.overlapSize = Math.floor(
            this.targetChunkSize * this.overlapPercentage
        );
    }

    /**
     * Split markdown by headings first, then by size if needed
     * @param {string} markdown - Markdown content to chunk
     * @param {string} [title=""] - Document title
     * @returns {Array<Object>} List of chunks with metadata
     */
    chunkByHeadings(markdown, title = "") {
        const chunks = [];

        // Split by headings (##, ###, etc.)
        const sections = this._splitByHeadings(markdown);

        let chunkId = 1;
        for (const section of sections) {
            const sectionTitle = section.title || `Section ${chunkId}`;
            const sectionContent = section.content || "";

            // If section is small enough, use as-is
            if (sectionContent.length <= this.targetChunkSize) {
                chunks.push({
                    id: String(chunkId),
                    title: sectionTitle,
                    content: sectionContent.trim(),
                    char_count: sectionContent.length,
                    type: "heading_based",
                });
                chunkId++;
            } else {
                // Split large sections into smaller chunks
                const subChunks = this._splitBySize(sectionContent);
                for (let i = 0; i < subChunks.length; i++) {
                    chunks.push({
                        id: String(chunkId),
                        title: `${sectionTitle} (Part ${i + 1})`,
                        content: subChunks[i].trim(),
                        char_count: subChunks[i].length,
                        type: "size_based",
                    });
                    chunkId++;
                }
            }
        }

        // If no meaningful chunks were created, fall back to size-based chunking
        if (chunks.length === 0) {
            return this.chunkBySize(markdown, title);
        }

        return chunks;
    }

    /**
     * Split markdown by fixed character size with overlap
     * @param {string} markdown - Markdown content to chunk
     * @param {string} [title=""] - Document title
     * @returns {Array<Object>} List of chunks with metadata
     */
    chunkBySize(markdown, title = "") {
        const chunks = [];
        const textChunks = this._splitBySize(markdown);

        for (let i = 0; i < textChunks.length; i++) {
            chunks.push({
                id: String(i + 1),
                title: title ? `${title} - Chunk ${i + 1}` : `Chunk ${i + 1}`,
                content: textChunks[i].trim(),
                char_count: textChunks[i].length,
                type: "size_based",
            });
        }

        return chunks;
    }

    /**
     * Split markdown content by headings
     * @param {string} markdown - Markdown content
     * @returns {Array<Object>} List of sections with title and content
     * @private
     */
    _splitByHeadings(markdown) {
        const sections = [];

        // Find all headings
        const headingPattern = /^(#{1,6})\s+(.+)$/gm;
        const lines = markdown.split("\n");

        let currentSection = { title: "", content: "", level: 0 };
        let inHeading = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^(#{1,6})\s+(.+)$/);

            if (match) {
                // Save previous section if it has content
                if (currentSection.content.trim()) {
                    sections.push({ ...currentSection });
                }

                // Start new section
                const headingLevel = match[1].length;
                const headingText = match[2].trim();

                currentSection = {
                    title: headingText,
                    content: line + "\n",
                    level: headingLevel,
                };
            } else {
                currentSection.content += line + "\n";
            }
        }

        // Add final section
        if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
        }

        // If no headings found, return entire content as one section
        if (sections.length === 0) {
            sections.push({
                title: "Main Content",
                content: markdown,
                level: 1,
            });
        }

        return sections;
    }

    /**
     * Split text into chunks of target size with overlap
     * @param {string} text - Text to split
     * @returns {Array<string>} List of text chunks
     * @private
     */
    _splitBySize(text) {
        if (!text.trim()) {
            return [];
        }

        // Split by paragraphs first
        const paragraphs = text.split("\n\n").filter((p) => p.trim());

        const chunks = [];
        let currentChunk = "";

        for (const paragraph of paragraphs) {
            // If single paragraph is larger than target, split it
            if (paragraph.length > this.targetChunkSize) {
                // Save current chunk if it has content
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = "";
                }

                // Split large paragraph by sentences
                const sentences = this._splitIntoSentences(paragraph);
                let tempChunk = "";

                for (const sentence of sentences) {
                    if (
                        tempChunk.length + sentence.length >
                        this.targetChunkSize
                    ) {
                        if (tempChunk) {
                            chunks.push(tempChunk.trim());
                        }
                        tempChunk = sentence + " ";
                    } else {
                        tempChunk += sentence + " ";
                    }
                }

                if (tempChunk) {
                    currentChunk = tempChunk;
                }
            }
            // If adding paragraph would exceed target size
            else if (
                currentChunk.length + paragraph.length >
                this.targetChunkSize
            ) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }

                // Start new chunk with overlap from previous chunk
                const overlapText = this._getOverlapText(currentChunk);
                currentChunk = overlapText
                    ? overlapText + "\n\n" + paragraph
                    : paragraph;
            } else {
                // Add paragraph to current chunk
                currentChunk = currentChunk
                    ? currentChunk + "\n\n" + paragraph
                    : paragraph;
            }
        }

        // Add final chunk
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Split text into sentences
     * @param {string} text - Text to split into sentences
     * @returns {Array<string>} List of sentences
     * @private
     */
    _splitIntoSentences(text) {
        // Simple sentence splitting
        const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
        return sentences.map((s) => s.trim());
    }

    /**
     * Get overlap text from the end of a chunk
     * @param {string} text - Text to get overlap from
     * @returns {string} Overlap text
     * @private
     */
    _getOverlapText(text) {
        if (!text) {
            return "";
        }

        if (text.length <= this.overlapSize) {
            return text;
        }

        // Get last N characters for overlap
        let overlapText = text.slice(-this.overlapSize);

        // Try to start at a sentence boundary
        const sentenceBoundary = overlapText.indexOf(". ");
        if (sentenceBoundary !== -1) {
            overlapText = overlapText.substring(sentenceBoundary + 2);
        }

        return overlapText;
    }
}

// Export the class
if (typeof module !== "undefined") {
    module.exports = { ContentChunker };
}
