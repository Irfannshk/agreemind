import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, Plus, LayoutDashboard, Loader2, Bell, Tag, Search, MessageSquare, X, BarChart2, Folder, CheckSquare, MessageCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeFolder, setActiveFolder] = useState('All'); 
  const [documents, setDocuments] = useState([]); 
  
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [contractText, setContractText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [chatDocs, setChatDocs] = useState([]); 
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatting, setIsChatting] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]); 

  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [globalChatInput, setGlobalChatInput] = useState('');
  const [globalChatHistory, setGlobalChatHistory] = useState([]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/documents');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
      } else {
        console.error("DB Error:", data);
        setDocuments([]);
      }
    } catch (err) {
      console.error(err);
      setDocuments([]);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!title && !file && !contractText) return alert("Need a title and some text/file!");

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      if (file) formData.append('file', file);
      if (contractText) formData.append('text', contractText);

      const response = await fetch('http://localhost:5000/api/analyze', { method: 'POST', body: formData });
      if (!response.ok) throw new Error("Server failed");

      const newDoc = await response.json();
      setDocuments(prev => Array.isArray(prev) ? [newDoc, ...prev] : [newDoc]);
      setTitle(''); setFile(null); setContractText(''); setActiveTab('dashboard');
    } catch (error) {
      alert("Analysis failed. Ollama running?");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleCompare = (doc) => {
    if (selectedForCompare.find(d => d.id === doc.id)) {
      setSelectedForCompare(selectedForCompare.filter(d => d.id !== doc.id));
    } else {
      if (selectedForCompare.length >= 2) return alert("You can only compare 2 documents at a time!");
      setSelectedForCompare([...selectedForCompare, doc]);
    }
  };

  const startCompareChat = () => {
    if (selectedForCompare.length !== 2) return;
    setChatDocs(selectedForCompare);
    setChatHistory([{ role: 'ai', text: `I am ready to compare ${selectedForCompare[0].title} and ${selectedForCompare[1].title}. What would you like to know?` }]);
    setSelectedForCompare([]); 
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput) return;
    
    const userMsg = chatInput;
    setChatHistory([...chatHistory, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatting(true);

    try {
      const payload = { 
        contractText: chatDocs[0].raw_text, 
        userMessage: userMsg,
        contractText2: chatDocs.length > 1 ? chatDocs[1].raw_text : null 
      };
      const response = await fetch('http://localhost:5000/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      setChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Error connecting to AI." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleGlobalChatSubmit = async (e) => {
    e.preventDefault();
    if (!globalChatInput) return;
    
    const userMsg = globalChatInput;
    setGlobalChatHistory([...globalChatHistory, { role: 'user', text: userMsg }]);
    setGlobalChatInput('');
    setIsChatting(true);

    try {
      const docsSummary = documents.map(d => ({ id: d.id, title: d.title, category: getSafeAiData(d).category }));
      const response = await fetch('http://localhost:5000/api/global-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: userMsg, docsSummary }),
      });
      
      const data = await response.json();
      setGlobalChatHistory(prev => [...prev, { role: 'ai', text: data.reply }]);
      if (data.updated) fetchDocuments();
    } catch (err) {
      setGlobalChatHistory(prev => [...prev, { role: 'ai', text: "Error connecting to AI." }]);
    } finally {
      setIsChatting(false);
    }
  };

  // --- BULLETPROOF DATA PARSER ---
  // If the DB has weird corrupted JSON strings from old tests, this fixes it silently.
  const getSafeAiData = (doc) => {
    if (!doc || !doc.ai_data) return {};
    if (typeof doc.ai_data === 'string') {
      try { return JSON.parse(doc.ai_data); } catch { return {}; }
    }
    return doc.ai_data;
  };

  const safeDocs = Array.isArray(documents) ? documents : [];
  const folders = ['All', ...new Set(safeDocs.map(d => getSafeAiData(d).category || 'Uncategorized').filter(Boolean))];

  const filteredDocs = safeDocs.filter(doc => {
    const ai = getSafeAiData(doc);
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (doc?.title || '').toLowerCase().includes(query) || 
      (ai.category || '').toLowerCase().includes(query) ||
      (doc?.raw_text || '').toLowerCase().includes(query); 
    const matchesFolder = activeFolder === 'All' || (ai.category === activeFolder);
    return matchesSearch && matchesFolder;
  });

  const allAlerts = safeDocs.flatMap(doc => {
    const dates = getSafeAiData(doc).dueDates;
    // Indestructible check: Must be a real array to render alerts!
    if (!Array.isArray(dates)) return [];
    return dates.map(d => ({ docTitle: doc.title || 'Untitled', date: d.date, task: d.task }));
  });

  const chartData = [
    { name: 'Low', count: safeDocs.filter(d => getSafeAiData(d).riskLevel === 'Low').length },
    { name: 'Medium', count: safeDocs.filter(d => getSafeAiData(d).riskLevel === 'Medium').length },
    { name: 'High', count: safeDocs.filter(d => getSafeAiData(d).riskLevel === 'High').length }
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden relative">
      
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col shadow-sm z-10">
        <h1 className="text-2xl font-bold text-indigo-600 mb-8 flex items-center gap-2">
          <FileText size={28} /> AgreeMind
        </h1>
        <nav className="flex flex-col gap-2 mb-8">
          <button onClick={() => { setActiveTab('dashboard'); setActiveFolder('All'); }} className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${activeTab === 'dashboard' && activeFolder === 'All' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-gray-50 text-gray-600'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('upload')} className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${activeTab === 'upload' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-gray-50 text-gray-600'}`}>
            <Plus size={20} /> New Contract
          </button>
        </nav>
        
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Smart Folders</h3>
        <nav className="flex flex-col gap-1 overflow-y-auto">
          {folders.filter(f => f !== 'All').map(folder => (
            <button key={folder} onClick={() => { setActiveTab('dashboard'); setActiveFolder(folder); }} className={`flex items-center gap-3 p-2.5 rounded-lg text-sm text-left transition-colors ${activeFolder === folder ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-gray-50 text-gray-600'}`}>
              <Folder size={16} className={activeFolder === folder ? 'text-indigo-600' : 'text-gray-400'} /> {folder}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto relative">
        
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto pb-20">
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-800">{activeFolder === 'All' ? 'Intelligence Dashboard' : `${activeFolder} Contracts`}</h2>
                <p className="text-gray-500 mt-1">Manage documents, categories, and deadlines.</p>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input type="text" placeholder="Deep search contents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
            </header>

            {selectedForCompare.length > 0 && (
              <div className="bg-indigo-600 text-white p-4 rounded-xl mb-6 flex justify-between items-center shadow-lg animate-in fade-in slide-in-from-top-4">
                <span className="font-medium">{selectedForCompare.length} document(s) selected for comparison.</span>
                <button onClick={startCompareChat} disabled={selectedForCompare.length !== 2} className={`px-4 py-2 rounded-lg font-bold ${selectedForCompare.length === 2 ? 'bg-white text-indigo-700 hover:bg-gray-100' : 'bg-indigo-400 text-indigo-200 cursor-not-allowed'}`}>
                  Compare in AI Chat
                </button>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8 flex items-center gap-8">
              <div className="w-1/3">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-2"><BarChart2 size={20}/> Risk Overview</h3>
                <p className="text-sm text-gray-500 mb-4">Viewing {filteredDocs.length} contract(s)</p>
              </div>
              <div className="w-2/3 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}><XAxis dataKey="name" fontSize={12} /><Tooltip cursor={{fill: 'transparent'}} /><Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 flex flex-col gap-6">
                {filteredDocs.map((doc) => {
                  const ai = getSafeAiData(doc);
                  const isSelected = selectedForCompare.some(d => d.id === doc.id);
                  return (
                    <div id={doc.title} key={doc.id || Math.random()} className={`bg-white p-6 rounded-2xl border shadow-sm transition-all relative ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-100 hover:shadow-md'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-start gap-3">
                          <button onClick={() => toggleCompare(doc)} className="mt-1">
                            <CheckSquare size={20} className={isSelected ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'} />
                          </button>
                          <div>
                            <h4 className="text-xl font-bold text-gray-900">{doc.title || 'Untitled'} <span className="text-xs text-gray-400 font-normal ml-2">ID: {doc.id}</span></h4>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase"><Tag size={12} className="inline mr-1" /> {ai.category || 'Uncategorized'}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${ai.riskLevel === 'High' ? 'bg-red-50 text-red-600' : ai.riskLevel === 'Medium' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>Risk: {ai.riskLevel || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => { setChatDocs([doc]); setChatHistory([]); }} className="flex items-center gap-1 bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium">
                          <MessageSquare size={16}/> Ask AI
                        </button>
                      </div>
                      <p className="text-gray-600 text-sm mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">{ai.summary || 'No summary available.'}</p>
                      {ai.riskReason && <p className="text-xs text-red-500 font-medium mb-4 flex items-center gap-1"><AlertCircle size={14} /> {ai.riskReason}</p>}
                      <div>
                        <h5 className="font-bold text-gray-900 text-sm mb-3">Key Clauses Extracted:</h5>
                        <ul className="flex flex-wrap gap-2">
                          {/* Indestructible mapping: checks if it is truly an array before mapping! */}
                          {Array.isArray(ai.keyClauses) && ai.keyClauses.length > 0 ? ai.keyClauses.map((clause, i) => (
                            <li key={i} className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-200">{clause}</li>
                          )) : <li className="text-xs text-gray-500 italic">None detected.</li>}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Alerts */}
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm sticky top-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Bell size={20} className="text-amber-500" /> Upcoming Alerts</h3>
                  {allAlerts.length === 0 ? <p className="text-sm text-gray-500 text-center">No upcoming dates.</p> : (
                    <div className="flex flex-col gap-4">
                      {allAlerts.map((alert, i) => (
                        <div 
                          key={i} 
                          onClick={() => {
                             // This is the "Highlight" feature!
                             const el = document.getElementById(alert.docTitle);
                             if (el) el.scrollIntoView({ behavior: 'smooth' });
                             else alert(`This alert is for: ${alert.docTitle}`);
                          }}
                          className="flex gap-3 items-start p-3 bg-amber-50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-100"
                        >
                          <div className="bg-amber-100 p-2 rounded-lg text-amber-700"><AlertCircle size={16} /></div>
                          <div>
                            <p className="text-xs font-bold text-amber-800 mb-1">{alert.date}</p>
                            <p className="text-sm font-medium text-gray-900">{alert.docTitle}</p>
                            <p className="text-xs text-gray-600 mt-1">{alert.task}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto mt-10">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Process New Contract</h2>
              <form onSubmit={handleAnalyze} className="flex flex-col gap-5 mt-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Document Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave blank to let AI auto-generate title" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-2">Upload File (PDF/Docx/Txt)</label>
                   <input type="file" onChange={(e) => setFile(e.target.files[0])} className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                </div>
                <div className="flex items-center gap-4"><hr className="flex-1"/><span className="text-xs text-gray-400 font-bold uppercase">OR</span><hr className="flex-1"/></div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Paste Raw Text</label>
                  <textarea rows="6" value={contractText} onChange={(e) => setContractText(e.target.value)} placeholder="If no file, paste text here..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"></textarea>
                </div>
                <button type="button" onClick={handleAnalyze} disabled={isAnalyzing} className={`w-full flex justify-center items-center gap-2 py-3 rounded-xl font-bold text-white transition-all ${isAnalyzing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {isAnalyzing ? <><Loader2 size={20} className="animate-spin" /> Processing AI...</> : "Extract Intelligence"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* DOC-SPECIFIC AI CHAT MODAL */}
        {chatDocs.length > 0 && (
          <div className="fixed bottom-8 right-8 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50">
            <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
              <div>
                <h4 className="font-bold">Legal Advisor AI</h4>
                <p className="text-xs text-indigo-200 truncate w-64">
                  {chatDocs.length === 1 ? chatDocs[0].title : `Comparing: ${chatDocs[0].title} & ${chatDocs[1].title}`}
                </p>
              </div>
              <button onClick={() => setChatDocs([])} className="text-white hover:text-gray-200"><X size={20}/></button>
            </div>
            <div className="h-80 p-4 overflow-y-auto flex flex-col gap-3 bg-gray-50">
              {chatHistory.length === 0 && <p className="text-sm text-gray-500 text-center mt-10">Ask me for legal advice, risks, or improvements!</p>}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white self-end rounded-tr-none max-w-[85%]' : 'bg-white border border-gray-200 text-gray-800 self-start rounded-tl-none w-[95%] whitespace-pre-wrap'}`}>
                  {msg.text}
                </div>
              ))}
              {isChatting && <div className="text-xs text-gray-400 italic">Advisor is analyzing...</div>}
            </div>
            <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="e.g. What are the risks?" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">Send</button>
            </form>
          </div>
        )}

      </div>

      {/* FLOATING GLOBAL AI BUTTON */}
      {!isGlobalChatOpen && chatDocs.length === 0 && (
        <button 
          onClick={() => setIsGlobalChatOpen(true)}
          className="fixed bottom-8 right-8 bg-slate-800 hover:bg-slate-900 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-105 z-40 flex items-center justify-center">
          <MessageCircle size={28} />
        </button>
      )}

      {/* GLOBAL AI CHAT MODAL */}
      {isGlobalChatOpen && (
        <div className="fixed bottom-8 right-8 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50">
          <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
            <div>
              <h4 className="font-bold">AgreeMind System AI</h4>
              <p className="text-xs text-slate-300">I can answer questions or edit your database.</p>
            </div>
            <button onClick={() => setIsGlobalChatOpen(false)} className="text-white hover:text-gray-300"><X size={20}/></button>
          </div>
          <div className="h-80 p-4 overflow-y-auto flex flex-col gap-3 bg-gray-50">
            {globalChatHistory.length === 0 && (
              <div className="text-sm text-gray-500 text-center mt-6 space-y-2">
                <p>Hello! I manage your entire contract database.</p>
                <p className="text-xs bg-slate-100 p-2 rounded border border-slate-200">
                  Try saying: "Change the category of document #5 to SLA"
                </p>
              </div>
            )}
            {globalChatHistory.map((msg, idx) => (
              <div key={idx} className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-slate-700 text-white self-end rounded-tr-none max-w-[85%]' : 'bg-white border border-gray-200 text-gray-800 self-start rounded-tl-none w-[95%] whitespace-pre-wrap'}`}>
                {msg.text}
              </div>
            ))}
            {isChatting && <div className="text-xs text-gray-400 italic">Processing command...</div>}
          </div>
          <form onSubmit={handleGlobalChatSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input type="text" value={globalChatInput} onChange={e => setGlobalChatInput(e.target.value)} placeholder="e.g. Change document #2 category to NDA" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm" />
            <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900">Send</button>
          </form>
        </div>
      )}

    </div>
  );
}