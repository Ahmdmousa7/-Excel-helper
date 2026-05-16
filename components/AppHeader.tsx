import React from 'react';
import { Info, HelpCircle, Mic, MicOff, FileSpreadsheet, X, RotateCcw, PanelBottomOpen, PanelBottomClose } from 'lucide-react';
import { TRANSLATIONS, Language } from '../utils/translations';
import { FileData } from '../types';

interface AppHeaderProps {
  language: Language;
  activeTabObj: any;
  activeTab: number;
  isSupported: boolean;
  isListening: boolean;
  toggleListening: () => void;
  fileData: FileData | null;
  isExcelTool: boolean;
  handleReset: () => void;
  showLogs: boolean;
  setShowLogs: (show: boolean) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  language,
  activeTabObj,
  activeTab,
  isSupported,
  isListening,
  toggleListening,
  fileData,
  isExcelTool,
  handleReset,
  showLogs,
  setShowLogs
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
          {activeTabObj?.icon}<span>{activeTabObj?.title}</span>
        </div>
        {activeTabObj && activeTab !== -1 && (
          <div className="group relative flex items-center">
            <Info size={16} className="text-slate-400 hover:text-blue-600 cursor-help transition-colors" />
            <div className="absolute top-full mt-3 w-72 sm:w-80 p-4 bg-slate-800 text-white text-xs rounded-xl shadow-2xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none group-hover:pointer-events-auto transform translate-y-2 group-hover:translate-y-0 start-0">
              <div className="absolute -top-1.5 w-3 h-3 bg-slate-800 border-t border-l border-slate-700 transform rotate-45 start-4"></div>
              <h4 className="font-bold mb-1 text-sm flex items-center gap-2">{activeTabObj.icon} {activeTabObj.title}</h4>
              <p className="text-slate-300 mb-2 leading-relaxed">{activeTabObj.description}</p>
              <div className="bg-slate-700/50 p-2 rounded border border-slate-600">
                <p className="font-semibold text-blue-200 mb-1 flex items-center gap-1"><HelpCircle size={10}/> {t.common.instructions}</p>
                <p className="text-slate-300 leading-tight">{activeTabObj.instructions}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {isSupported && (
          <button 
            onClick={toggleListening}
            className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            title="Voice Control"
          >
            {isListening ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
        )}

        {fileData && isExcelTool && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-sm border border-green-200 text-xs font-medium animate-in fade-in">
            <FileSpreadsheet size={14} />
            <span className="truncate max-w-[150px]">{fileData.name}</span>
            <button onClick={handleReset} className="ms-1 hover:text-green-900"><X size={12}/></button>
          </div>
        )}
        <button onClick={handleReset} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all active:scale-95" title={t.actions.reset}><RotateCcw size={18} /></button>
        <div className="h-6 w-px bg-slate-200 mx-1"></div>
        <button onClick={() => setShowLogs(!showLogs)} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold transition-colors border ${showLogs ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-transparent hover:bg-slate-50'}`}>
          {showLogs ? <PanelBottomOpen size={16} /> : <PanelBottomClose size={16} />}<span className="hidden sm:inline">{showLogs ? t.actions.hideLogs : t.actions.showLogs}</span>
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
