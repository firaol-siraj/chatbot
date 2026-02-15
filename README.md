# 🤖 AI-Powered Website Chatbot (RAG)

A modern AI-powered chatbot integrated into a website that answers user questions using **Retrieval-Augmented Generation (RAG)**.

## 🚀 Features

- AI-based question answering from your documents
- **Retrieval-Augmented Generation (RAG)** – answers grounded in uploaded PDFs and website content
- Context-aware responses (strict RAG: answers only from provided context)
- **Secure JWT authentication** + **Google OAuth** sign-in
- **Chat history** – view and resume past conversations
- **Streaming responses** for a smooth chat experience
- Modern UI (React, Tailwind)
- Node.js + Express backend
- **SQLite** database (sql.js)

## 🛠 Tech Stack

**Frontend:**
- React.js
- Vite
- Tailwind CSS
- React Router
- fetch (no Axios)

**Backend:**
- Node.js
- Express.js
- SQLite (sql.js)
- JWT Authentication
- Google OAuth (Passport)

**AI:**
- **Google Gemini API** (embeddings + chat)
- Optional **Ollama** (local fallback, no rate limits)
- RAG architecture (chunking, embeddings, cosine similarity)

## 📂 Project Structure

- `client/` → React frontend (Vite)
- `server/` → Express backend

## ⚙ Installation

1. **Clone the repo:**
   git clone https://github.com/firaol-siraj/chatbot
   cd chatbot
   
