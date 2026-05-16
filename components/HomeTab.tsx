
import React from 'react';
import { motion } from 'motion/react';
import { 
  Layers, Copy, ShoppingCart, Activity, FileSpreadsheet, 
  CheckCircle, AlertCircle, Clock, Zap, ArrowRight, Cloud, ScanText,
  Bot, FileText, Network, Sparkles, ChevronRight
} from 'lucide-react';
import { FileData } from '../types';

interface RecentFile {
  name: string;
  date: string;
  type: 'local' | 'gsheet';
  url?: string;
}

interface Props {
  onNavigate: (tabId: number) => void;
  recentFiles: RecentFile[];
  onLoadGSheet: (url: string) => void;
  fileData: FileData | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const HomeTab: React.FC<Props> = ({ onNavigate, recentFiles, onLoadGSheet, fileData }) => {
  const hasApiKey = !!localStorage.getItem('gemini_api_key');

  return (
    <motion.div 
      className="max-w-7xl mx-auto space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Hero Section - Masterclass Gradient */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-transparent opacity-50"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-50 animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-50 animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        <div className="relative z-10 p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-blue-200 mb-6 backdrop-blur-md">
              <Sparkles size={14} className="text-blue-400" />
              <span>Mousa Workspace 2.0</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              Automate your data.<br/>Elevate your workflow.
            </h1>
            <p className="text-lg md:text-xl text-slate-400 font-medium mb-8 max-w-xl leading-relaxed">
              The masterclass suite for Excel automation, AI translation, and intelligent data processing.
            </p>
            
            {fileData ? (
               <div className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-inner">
                  <div className="bg-green-500/20 p-3 rounded-xl">
                    <FileSpreadsheet size={24} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Active Workspace</p>
                    <p className="font-bold text-white text-lg">{fileData.name}</p>
                  </div>
               </div>
            ) : (
               <button 
                 onClick={() => document.getElementById('home-upload-trigger')?.click()}
                 className="group relative inline-flex items-center justify-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] hover:-translate-y-1"
               >
                 <Zap size={20} className="text-blue-600" /> 
                 <span>Start Processing</span>
                 <ArrowRight size={20} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
               </button>
            )}
          </div>
          
          {/* Status Card inside Hero */}
          <div className="hidden lg:block w-72 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={16} className="text-blue-400" /> System Status
            </h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-400">Gemini AI</span>
                  {hasApiKey ? (
                    <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div> Ready
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 flex items-center gap-1.5">
                      <AlertCircle size={12}/> Missing Key
                    </span>
                  )}
               </div>
               <div className="h-px w-full bg-white/10"></div>
               <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-400">Network</span>
                  {navigator.onLine ? (
                    <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full border border-blue-400/20 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Online
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20 flex items-center gap-1.5">
                      <AlertCircle size={12}/> Offline
                    </span>
                  )}
               </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        
        {/* Main Tools - Span 2 cols */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button onClick={() => onNavigate(0)} className="group relative bg-white p-6 rounded-3xl border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-xl transition-all duration-300 text-left overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="bg-blue-100 w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
              <Layers size={24} strokeWidth={2.5} />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">AI Translator</h4>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Bulk translate columns with context-aware AI precision.</p>
            <div className="mt-4 flex items-center text-blue-600 text-sm font-bold opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all">
              Launch Tool <ChevronRight size={16} className="ml-1" />
            </div>
          </button>

          <button onClick={() => onNavigate(12)} className="group relative bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-xl transition-all duration-300 text-left overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="bg-indigo-100 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
              <ScanText size={24} strokeWidth={2.5} />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">OCR Extraction</h4>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Convert PDFs and images into structured Excel tables.</p>
            <div className="mt-4 flex items-center text-indigo-600 text-sm font-bold opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all">
              Launch Tool <ChevronRight size={16} className="ml-1" />
            </div>
          </button>

          <button onClick={() => onNavigate(14)} className="group relative bg-white p-6 rounded-3xl border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-xl transition-all duration-300 text-left overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="bg-emerald-100 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
              <Network size={24} strokeWidth={2.5} />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">Product Variants</h4>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Balance and generate missing product combinations.</p>
            <div className="mt-4 flex items-center text-emerald-600 text-sm font-bold opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all">
              Launch Tool <ChevronRight size={16} className="ml-1" />
            </div>
          </button>

          <button onClick={() => onNavigate(26)} className="group relative bg-white p-6 rounded-3xl border border-slate-200 hover:border-orange-300 shadow-sm hover:shadow-xl transition-all duration-300 text-left overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
            <div className="bg-orange-100 w-12 h-12 rounded-2xl flex items-center justify-center text-orange-600 mb-4 group-hover:scale-110 transition-transform shadow-inner">
              <FileText size={24} strokeWidth={2.5} />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">Task Summary</h4>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Generate and export beautiful project reports.</p>
            <div className="mt-4 flex items-center text-orange-600 text-sm font-bold opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all">
              Launch Tool <ChevronRight size={16} className="ml-1" />
            </div>
          </button>
        </motion.div>

        {/* Recent Activity - Span 1 or 2 cols depending on screen */}
        <motion.div variants={itemVariants} className="md:col-span-1 lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="text-slate-400" size={20}/> Recent Files
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {recentFiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <FileSpreadsheet size={24} className="text-slate-300"/>
                </div>
                <p className="font-medium">No recent files</p>
                <p className="text-xs mt-1 text-center">Upload a file to see your history here.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentFiles.map((file, idx) => (
                  <div key={idx} className="group p-4 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition-colors cursor-default">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className={`p-3 rounded-xl shadow-sm ${file.type === 'gsheet' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-white text-blue-600 border border-slate-200'}`}>
                        {file.type === 'gsheet' ? <Cloud size={20}/> : <FileSpreadsheet size={20}/>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate group-hover:text-blue-600 transition-colors">{file.name}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{file.date} • {file.type === 'gsheet' ? 'Google Sheet' : 'Local File'}</p>
                      </div>
                    </div>
                    {file.type === 'gsheet' && file.url && (
                      <button 
                        onClick={() => onLoadGSheet(file.url!)}
                        className="opacity-0 group-hover:opacity-100 text-xs font-bold text-white bg-slate-800 px-4 py-2 rounded-xl hover:bg-slate-700 transition-all shadow-md flex items-center gap-2 shrink-0"
                      >
                        Reload <ArrowRight size={14}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};

export default HomeTab;
