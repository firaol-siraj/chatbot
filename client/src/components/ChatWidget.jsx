import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, History, Plus } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef(null);
  const { token } = useAuth();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadSessions() {
    try {
      const data = await api.chat.sessions();
      const list = Array.isArray(data?.sessions) ? data.sessions.filter(Boolean) : [];
      setSessions(list);
    } catch {
      setSessions([]);
    }
  }

  useEffect(() => {
    if (open) loadSessions();
  }, [open]);

  async function loadSession(sid) {
    setShowHistory(false);
    setSessionId(sid);
    setMessages([]);
    try {
      const data = await api.chat.sessionMessages(sid);
      setMessages((data.messages || []).map((m) => ({ role: m.role, content: m.content })));
    } catch {
      setMessages([]);
    }
  }

  function startNewChat() {
    setShowHistory(false);
    setSessionId(null);
    setMessages([]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || streaming) return;

    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    setStreaming(true);
    setMessages((m) => [...m, { role: 'assistant', content: '', streaming: true }]);

    let fullContent = '';
    await api.chat.stream(
      text,
      sessionId,
      (chunk) => {
        fullContent += chunk;
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.streaming) {
            next[next.length - 1] = { ...last, content: fullContent };
          }
          return next;
        });
      },
      ({ sessionId: sid, error }) => {
        setStreaming(false);
        setLoading(false);
        if (sid) {
          setSessionId(sid);
          loadSessions();
        }
        if (error) {
          setMessages((m) => {
            const n = [...m];
            const idx = n.findIndex((x) => x.streaming);
            if (idx >= 0) n[idx] = { role: 'assistant', content: error };
            else n.push({ role: 'assistant', content: error });
            return n;
          });
        } else {
          setMessages((m) => {
            const n = [...m];
            const idx = n.findIndex((x) => x.streaming);
            if (idx >= 0) n[idx] = { ...n[idx], streaming: false };
            return n;
          });
        }
      }
    );
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-chat flex items-center justify-center transition-all hover:scale-105"
        aria-label="Toggle chat"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[80vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-chat flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-white">RAG Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white"
                title="Chat history"
              >
                <History className="w-5 h-5" />
              </button>
              <button
                onClick={startNewChat}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white"
                title="New chat"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="flex-1 overflow-y-auto p-2 border-b border-slate-700 bg-slate-800/50 max-h-32">
              <p className="text-xs text-slate-500 px-2 py-1">Past conversations</p>
              {sessions.length === 0 ? (
                <p className="text-slate-500 text-sm px-2 py-2">No past chats yet.</p>
              ) : (
                sessions.map((s, i) => (
                  <button
                    key={s?.id ?? i}
                    onClick={() => s && loadSession(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${
                      sessionId === s?.id ? 'bg-primary-500/30 text-primary-300' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {s?.title || `Chat ${s?.id ?? i}`}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8">
                <p className="font-medium text-slate-300 mb-1">Answers from your knowledge base</p>
                <p>Ask about your documents, website content, or services.</p>
                <p className="mt-2 text-slate-500">Try: &quot;What services do you offer?&quot;</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-br-md'
                      : 'bg-slate-800 text-slate-200 rounded-bl-md'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                    {msg.streaming && (
                      <span className="inline-block w-2 h-4 ml-0.5 bg-primary-400 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && !streaming && (
              <div className="flex justify-start">
                <div className="bg-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-md">
                  <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-3 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your documents..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
                disabled={loading || streaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || streaming}
                className="p-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
