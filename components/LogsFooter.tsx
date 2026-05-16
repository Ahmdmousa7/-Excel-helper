import React from 'react';
import { Terminal } from 'lucide-react';
import LogViewer from './LogViewer';
import { LogEntry } from '../types';

interface LogsFooterProps {
  showLogs: boolean;
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  t: any;
}

const LogsFooter: React.FC<LogsFooterProps> = ({ showLogs, logs, setLogs, t }) => {
  if (!showLogs) return null;

  return (
    <div className="h-64 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex flex-col shrink-0 transition-all duration-300 animate-in slide-in-from-bottom-10">
      <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600">
          <Terminal size={14} />
          <span className="text-[10px] font-bold uppercase tracking-wider">{t.system.logs}</span>
        </div>
        <button 
          onClick={() => setLogs([])} 
          className="text-[10px] text-slate-400 hover:text-red-500 hover:underline"
        >
          {t.actions.clearHistory}
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0">
          <LogViewer logs={logs} onClear={() => setLogs([])} />
        </div>
      </div>
    </div>
  );
};

export default LogsFooter;
