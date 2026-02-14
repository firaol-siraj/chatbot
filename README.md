# AI-Powered Website Chatbot with RAG

A modern landing page integrated with an AI-powered chatbot that uses **Retrieval-Augmented Generation (RAG)** to answer questions from your website's knowledge base.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Lucide Icons
- **Backend:** Node.js, Express
- **Database:** SQLite (sql.js)
- **Auth:** JWT (jsonwebtoken) + bcrypt + OAuth (Google, Facebook)
- **AI:** Google Gemini API **or** Ollama (local, no rate limits)

## Prerequisites

- Node.js 18+
- **Either:** Google Gemini API key (free at https://aistudio.google.com/apikey)  
- **Or:** Ollama (for unlimited chat; install from https://ollama.com)

## Setup

1. **Install dependencies**

   ```bash
   npm run install:all
   ```

2. **Configure environment**

   ```bash
   cd server
   copy .env.example .env
   ```

   Edit `server/.env`:

   ```
   PORT=5000
   JWT_SECRET=your-secure-random-secret
   GEMINI_API_KEY=your-gemini-api-key
   ```

   Get a **free** Gemini API key: https://aistudio.google.com/apikey

   **To avoid rate limits:** use Ollama for unlimited chat. In `server/.env` add:
   ```
   USE_OLLAMA=true
   ```
   Then install Ollama from https://ollama.com and run:
   ```bash
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ```
   Keep Ollama running; the app will use it for chat and embeddings when available.

   **Optional - OAuth (Google, Facebook):** Add to `server/.env`:
   ```
   FRONTEND_URL=http://localhost:3000
   API_URL=http://localhost:5050
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   FACEBOOK_APP_ID=your-facebook-app-id
   FACEBOOK_APP_SECRET=your-facebook-app-secret
   ```
   - **Google:** Create OAuth 2.0 credentials at https://console.cloud.google.com/apis/credentials. Add `http://localhost:5050/api/auth/google/callback` to Authorized redirect URIs.
   - **Facebook:** Create an app at https://developers.facebook.com. Add `http://localhost:5050/api/auth/facebook/callback` to Valid OAuth Redirect URIs.

3. **Run the app**

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

## How to Test Each Feature

### 1. User Authentication & Authorization

- **Sign up:** Visit http://localhost:3000/signup  
  - Enter email, username (min 3 chars), password (min 6 chars)  
  - Expect: redirect to landing, user is logged in  

- **Log in:** Visit http://localhost:3000/login  
  - Enter valid email and password  
  - Expect: redirect to landing  

- **OAuth (optional):** If configured, click "Google" or "Facebook" on the login/signup pages to sign in with a third-party account.

- **Protected routes:**  
  - Log out, then try visiting http://localhost:3000 or http://localhost:3000/admin  
  - Expect: redirect to login  

- **Logout:** Click Logout on the landing page  
  - Expect: redirect to login, token cleared  

### 2. Landing Page with AI Chatbot (RAG)

- Log in and open http://localhost:3000  
- **UI:** You should see hero section, feature cards, and a floating chat button (bottom-right)  
- **Chat:**  
  - Click the chat button to open the widget  
  - Send a message  
  - Expect: response from the AI (uses RAG if documents are uploaded, otherwise general knowledge)  

### 3. Admin Page / Knowledge Base Management

- Go to Admin via nav or http://localhost:3000/admin  
- **Upload PDF:** Click “Upload PDF/TXT”, choose a PDF or TXT file  
  - Expect: success message, document appears in list  
  - Backend chunks the text, creates embeddings, and stores them  

- **Add text:** Click “Add Text”, enter a title and content (min 10 chars)  
  - Expect: content added, document appears in list  

- **Delete:** Click trash icon on a document  
  - Expect: document removed from list and from chatbot context  

- **Protected:** Visit /admin while logged out → expect redirect to login  

### 4. Chat Interface

- **Floating widget:** Chat button fixed at bottom-right  
- **Typing indicator:** Spinner shown while waiting for a non-streaming response  
- **Streaming:** Responses stream in real time (character-by-character)  
- **Conversation flow:** Multiple messages in one session; context maintained  

## Project Structure

```
chatbot-app-project/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # ChatWidget
│   │   ├── context/        # AuthContext
│   │   ├── pages/          # Login, Signup, Landing, Admin
│   │   ├── api.js          # API helpers
│   │   └── App.jsx
│   └── ...
├── server/
│   ├── routes/             # auth, documents, chat
│   ├── services/           # embeddings, documentProcessor
│   ├── middleware/         # auth (JWT)
│   ├── db.js               # SQLite setup
│   └── index.js
└── README.md
```

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/signup | No | Create account |
| POST | /api/auth/login | No | Log in |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/documents | Yes | List documents |
| POST | /api/documents/upload | Yes | Upload file |
| POST | /api/documents/text | Yes | Add text content |
| DELETE | /api/documents/:id | Yes | Delete document |
| POST | /api/chat/message | Yes | Chat (non-streaming) |
| POST | /api/chat/stream | Yes | Chat (streaming) |
| GET | /api/chat/sessions | Yes | List chat sessions |
| GET | /api/chat/sessions/:id/messages | Yes | Session messages |

## Notes

- **RAG:** Documents are chunked, embedded with OpenAI, and stored in SQLite. Queries are embedded and matched via cosine similarity; top chunks are passed to the model as context.
- **Chat history:** Sessions and messages are stored; the `/sessions` and `/sessions/:id/messages` endpoints support future chat history UI.
- **Security:** JWT expires in 7 days. Use a strong `JWT_SECRET` in production.
