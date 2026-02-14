import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  ArrowLeft,
  Loader2,
  File,
} from 'lucide-react';

export default function Admin() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [addingText, setAddingText] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [showTextForm, setShowTextForm] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    try {
      const data = await api.documents.list();
      setDocuments(data.documents || []);
    } catch (err) {
      setError('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.documents.upload(formData);
      setSuccess('Document uploaded and processed.');
      loadDocuments();
      e.target.value = '';
    } catch (err) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAddText(e) {
    e.preventDefault();
    if (!textContent.trim()) return;

    setAddingText(true);
    setError('');
    setSuccess('');
    try {
      await api.documents.addText(textTitle || 'Untitled', textContent);
      setSuccess('Content added to knowledge base.');
      setTextTitle('');
      setTextContent('');
      setShowTextForm(false);
      loadDocuments();
    } catch (err) {
      setError(err?.message || 'Failed to add content.');
    } finally {
      setAddingText(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document? Its content will be removed from the chatbot.')) return;
    try {
      await api.documents.delete(id);
      setSuccess('Document deleted.');
      loadDocuments();
    } catch (err) {
      setError(err?.message || 'Delete failed.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950">
      <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white">Knowledge Base</h1>
          <div className="w-20" />
        </div>
      </nav>

      <main className="pt-24 pb-20 px-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Manage Documents</h2>
          <p className="text-slate-400">
            Upload PDFs or add text to expand the chatbot&apos;s knowledge base. Content is chunked, embedded, and used for RAG.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            {success}
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-8">
          <label className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium cursor-pointer transition-colors disabled:opacity-50">
            <Upload className="w-5 h-5" />
            {uploading ? 'Uploading...' : 'Upload PDF/TXT'}
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowTextForm(!showTextForm)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
          >
            <FileText className="w-5 h-5" />
            Add Text
          </button>
        </div>

        {showTextForm && (
          <form
            onSubmit={handleAddText}
            className="mb-8 p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50"
          >
            <input
              type="text"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 mb-3 text-sm"
            />
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste or type content (min 10 characters)..."
              rows={5}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 resize-y text-sm"
              required
            />
            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                disabled={addingText || textContent.trim().length < 10}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {addingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add to Knowledge Base
              </button>
              <button
                type="button"
                onClick={() => setShowTextForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h3 className="font-semibold text-white">Uploaded Documents</h3>
          </div>
          <div className="divide-y divide-slate-700/50">
            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No documents yet. Upload a file or add text above.</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="text-white font-medium">{doc.original_name || doc.filename}</p>
                      <p className="text-slate-500 text-xs">
                        {doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
