import React from 'react';
import { FileSpreadsheet, UploadCloud, Link as LinkIcon, RefreshCw, ArrowRight, Info, X } from 'lucide-react';
import { TRANSLATIONS, Language } from '../utils/translations';
import { FileData } from '../types';

interface FileUploaderBaseProps {
  language: Language;
  fileData: FileData | null;
  resetKey: number;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  gsheetUrl: string;
  setGsheetUrl: (url: string) => void;
  handleGSheetImport: () => void;
  isImportingGSheet: boolean;
  handleReset: () => void;
}

const FileUploaderBase: React.FC<FileUploaderBaseProps> = ({
  language,
  fileData,
  resetKey,
  handleFileUpload,
  gsheetUrl,
  setGsheetUrl,
  handleGSheetImport,
  isImportingGSheet,
  handleReset
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 transition-all duration-300 ${fileData ? 'border-s-4 border-s-green-500' : ''}`}>
      {!fileData ? (
        <div className="flex flex-col md:flex-row gap-6 items-stretch">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileSpreadsheet size={16}/> {t.actions.uploadFile}
            </label>
            <label className="flex flex-col h-28 px-4 justify-center items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all text-slate-500 hover:text-blue-600 bg-slate-50/50 group">
              <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover:scale-110 transition-transform shadow-sm">
                <UploadCloud size={24} className="text-blue-500" />
              </div>
              <div className="text-center">
                <span className="font-semibold text-sm block">Click to Upload Excel / CSV</span>
                <span className="text-[10px] text-slate-400">Drag & Drop supported</span>
              </div>
              <input key={resetKey} type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" id="home-upload-trigger" />
            </label>
          </div>
          <div className="hidden md:flex items-center justify-center p-4">
            <div className="h-full w-px bg-slate-200 relative">
              <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[10px] text-slate-400 font-bold tracking-wider">OR</span>
            </div>
          </div>
          <div className="flex-1 w-full flex flex-col justify-end">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <LinkIcon size={16}/> Import Google Sheet
            </label>
            <div className="flex gap-2 h-12">
              <div className="relative flex-1 text-sm bg-white border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent transition-all shadow-sm">
                <input 
                  type="text" 
                  value={gsheetUrl} 
                  onChange={e => setGsheetUrl(e.target.value)} 
                  placeholder="Paste public Google Sheet link..." 
                  className="w-full h-full pl-3 pr-3 bg-transparent outline-none font-mono" 
                />
              </div>
              <button 
                onClick={() => handleGSheetImport()} 
                disabled={isImportingGSheet || !gsheetUrl} 
                className="h-full px-5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isImportingGSheet ? <RefreshCw className="animate-spin" size={18}/> : <ArrowRight size={18}/>}
                <span className="hidden lg:inline">Load</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
              <Info size={10}/> Ensure sheet is "Anyone with link" or "Published"
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-green-50 p-3 rounded-lg text-green-600 border border-green-100">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {fileData.name} <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-[10px] font-medium uppercase tracking-wider">Ready</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <span className="bg-slate-50 px-2 py-0.5 rounded-md text-slate-600 border border-slate-200">{fileData.sheets.length} Sheets</span>
              </p>
            </div>
          </div>
          <button 
            onClick={handleReset} 
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100 shadow-sm"
          >
            <X size={16} /><span>Remove File</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUploaderBase;
