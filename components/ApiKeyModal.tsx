import React from 'react';
import { X, Check, AlertTriangle, ShieldPlus, RefreshCw, UserPlus, Zap, Key } from 'lucide-react';
import { TRANSLATIONS, Language } from '../utils/translations';

interface ApiKeyModalProps {
  language: Language;
  onClose: () => void;
  geminiKey: string;
  setGeminiKey: (key: string) => void;
  geminiStatus: 'idle' | 'valid' | 'invalid' | 'quota';
  setGeminiStatus: (status: 'idle' | 'valid' | 'invalid' | 'quota') => void;
  testingGemini: boolean;
  handleTestGemini: () => void;
  googleClientId: string;
  setGoogleClientId: (id: string) => void;
  groqKey: string;
  setGroqKey: (key: string) => void;
  groqStatus: 'idle' | 'valid' | 'invalid';
  setGroqStatus: (status: 'idle' | 'valid' | 'invalid') => void;
  testingGroq: boolean;
  handleTestGroq: () => void;
  handleSaveKey: () => void;
  keySaved: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  language,
  onClose,
  geminiKey,
  setGeminiKey,
  geminiStatus,
  setGeminiStatus,
  testingGemini,
  handleTestGemini,
  googleClientId,
  setGoogleClientId,
  groqKey,
  setGroqKey,
  groqStatus,
  setGroqStatus,
  testingGroq,
  handleTestGroq,
  handleSaveKey,
  keySaved
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">{t.actions.configureKey}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* GEMINI SECTION */}
        <div className="mb-6 border-b border-slate-100 pb-6">
          <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
            <div className="flex items-center gap-2">
              <span>Google Gemini Keys</span>
              {geminiStatus === 'valid' && <span className="px-2 py-0.5 rounded-sm bg-green-100 text-green-700 text-[10px] border border-green-200 flex items-center gap-1"><Check size={10} /> {t.actions.valid}</span>}
              {geminiStatus === 'invalid' && <span className="px-2 py-0.5 rounded-sm bg-red-100 text-red-700 text-[10px] border border-red-200 flex items-center gap-1"><X size={10} /> {t.actions.invalid}</span>}
              {geminiStatus === 'quota' && <span className="px-2 py-0.5 rounded-sm bg-amber-100 text-amber-700 text-[10px] border border-amber-200 flex items-center gap-1"><AlertTriangle size={10} /> {t.actions.quota}</span>}
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary-600 hover:underline text-[10px]">{t.actions.getGemini}</a>
          </label>
          <textarea 
            value={geminiKey} 
            onChange={(e) => { setGeminiKey(e.target.value); setGeminiStatus('idle'); }} 
            placeholder="Paste Gemini keys here (one per line for rotation)" 
            rows={3} 
            className={`w-full p-3 border rounded-sm font-mono text-xs focus:ring-1 outline-none mb-2 transition-colors resize-none text-slate-900 placeholder-slate-400 ${geminiStatus === 'valid' ? 'border-green-400 bg-green-50 focus:ring-green-200' : geminiStatus === 'invalid' ? 'border-red-400 bg-red-50 focus:ring-red-200' : geminiStatus === 'quota' ? 'border-amber-400 bg-amber-50 focus:ring-amber-200' : 'border-slate-300 bg-slate-50 focus:ring-primary-500'}`} 
          />
          <div className="flex justify-between items-start">
            <div className="bg-blue-50 border border-blue-100 p-2 rounded-sm flex items-start space-x-2 flex-1 me-2">
              <ShieldPlus size={14} className="text-primary-600 mt-0.5 shrink-0" />
              <div className="text-[10px] text-primary-800 leading-tight">{t.actions.autoRotate}</div>
            </div>
            <button onClick={handleTestGemini} disabled={!geminiKey || testingGemini} className="flex items-center space-x-1 px-3 py-2 rounded-sm text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              {testingGemini ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{t.actions.test}</span>
            </button>
          </div>
        </div>

        {/* GOOGLE SHEETS SYNC SECTION */}
        <div className="mb-6 border-b border-slate-100 pb-6">
          <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><UserPlus size={14} className="text-green-600"/> Google Client ID (For Sheet Sync)</span>
            </div>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px]">Create ID</a>
          </label>
          <div className="flex space-x-2">
            <input 
              type="text" 
              value={googleClientId} 
              onChange={(e) => setGoogleClientId(e.target.value)} 
              placeholder="123...apps.googleusercontent.com" 
              className="flex-1 p-2.5 border border-slate-300 bg-slate-50 rounded-sm font-mono text-xs focus:ring-1 focus:ring-green-500 outline-none transition-colors text-slate-900 placeholder-slate-400" 
            />
          </div>
        </div>

        {/* GROQ SECTION */}
        <div className="mb-6">
          <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><Zap size={14} className="text-orange-500"/> Groq Key (Fallback)</span>
              {groqStatus === 'valid' && <span className="px-2 py-0.5 rounded-sm bg-green-100 text-green-700 text-[10px] border border-green-200 flex items-center gap-1"><Check size={10} /> {t.actions.valid}</span>}
            </div>
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-600 hover:underline text-[10px]">{t.actions.getGroq}</a>
          </label>
          <form onSubmit={(e) => { e.preventDefault(); handleTestGroq(); }} className="flex space-x-2">
             <input type="password" value={groqKey} onChange={(e) => { setGroqKey(e.target.value); setGroqStatus('idle'); }} placeholder="gsk_..." className="flex-1 p-2.5 border border-slate-300 bg-slate-50 rounded-sm font-mono text-xs focus:ring-1 focus:ring-orange-500 outline-none transition-colors text-slate-900 placeholder-slate-400" />
             <button type="button" onClick={handleTestGroq} disabled={!groqKey || testingGroq} className="flex items-center justify-center space-x-1 px-3 rounded-sm text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors min-w-[60px]">{testingGroq ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}</button>
          </form>
        </div>

        <button onClick={handleSaveKey} className={`flex w-full h-10 px-4 justify-center items-center gap-1 rounded-sm text-white text-base font-medium shadow-sm transition-all transform active:scale-95 ${keySaved ? 'bg-green-600 hover:bg-green-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
          {keySaved ? <Check size={18} /> : <Key size={18} />}<span>{keySaved ? t.actions.saved : t.actions.saveKeys}</span>
        </button>
      </div>
    </div>
  );
};

export default ApiKeyModal;
