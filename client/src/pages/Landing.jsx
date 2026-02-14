import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatWidget from '../components/ChatWidget';
import { LogOut, Settings, Sparkles, Zap, Shield, MessageSquare } from 'lucide-react';

export default function Landing() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950">
      <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary-500/20">
              <Sparkles className="w-6 h-6 text-primary-400" />
            </div>
            <span className="font-semibold text-white text-lg">AI Chatbot</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:inline">{user?.username}</span>
            <Link
              to="/admin"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              Admin
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
        <section className="text-center mb-20">
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 bg-clip-text">
            Your AI-Powered
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-mint">
              Website Assistant
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mt-6">
            Ask questions about your documents and website content. Get accurate, context-aware answers powered by RAG technology.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            {
              icon: MessageSquare,
              title: 'Context-Aware Chat',
              desc: 'Answers based on your uploaded documents and knowledge base.',
              color: 'primary',
            },
            {
              icon: Zap,
              title: 'Instant Responses',
              desc: 'Smooth streaming and typing indicators for a natural experience.',
              color: 'amber',
            },
            {
              icon: Shield,
              title: 'Secure & Private',
              desc: 'Your data stays protected with JWT authentication.',
              color: 'mint',
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-primary-500/30 transition-colors"
            >
              <div className={`inline-flex p-3 rounded-xl mb-4 ${
                color === 'primary' ? 'bg-primary-500/20' : color === 'amber' ? 'bg-amber-500/20' : 'bg-accent-mint/20'
              }`}>
                <Icon className={`w-6 h-6 ${
                  color === 'primary' ? 'text-primary-400' : color === 'amber' ? 'text-amber-400' : 'text-accent-mint'
                }`} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-slate-400 text-sm">{desc}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center">
          <p className="text-slate-300 mb-2">
            👋 Hi, <span className="text-primary-400 font-medium">{user?.username}</span>! Use the chat widget in the bottom-right to get started.
          </p>
          <p className="text-slate-500 text-sm">
            Add documents in Admin to enrich the knowledge base. The chatbot uses <strong>RAG</strong> (Retrieval-Augmented Generation) to answer from your uploaded files and website content. View and resume past conversations in the chat history.
          </p>
        </section>
      </main>

      <ChatWidget />
    </div>
  );
}
