/**
 * Default website content used for RAG when no documents are uploaded.
 * The chatbot answers from this + user-uploaded documents.
 */
export const DEFAULT_WEBSITE_CONTEXT = `
About this website:
- AI-Powered Website Assistant: A modern landing page with an AI chatbot
- Uses RAG (Retrieval-Augmented Generation) for context-aware answers
- Answers questions from uploaded documents and website content

Services & Features:
- Context-Aware Chat: Answers based on your uploaded documents and knowledge base
- Instant Responses: Smooth streaming and typing indicators
- Secure & Private: JWT authentication, your data stays protected
- Knowledge Base: Upload PDFs, text files, or add text to expand the chatbot's knowledge
- Admin Page: Manage documents, upload files, add text content (authenticated users only)

How it works:
- Add documents or text in the Admin section
- The system extracts text, creates embeddings, and stores them for retrieval
- When you ask a question, relevant chunks are retrieved and used to generate accurate answers
- Chat history is stored so you can resume conversations
`;
