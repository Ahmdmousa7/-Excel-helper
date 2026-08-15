
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook, readExcelFile } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import { readGrid, buildLookup, formatCell, writeSheet, type CellInfo } from '../utils/lookupEngine';
import ProgressBar from './ProgressBar';
import { 
  Search, ArrowRight, Database, UploadCloud, FileSpreadsheet, 
  Settings2, Wand2, CheckCircle2, AlertCircle, Download, 
  RefreshCw, X, Table, ArrowLeftRight, Package
} from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

// The matching rule and the join both live in `utils/lookupEngine.ts` now. They
// used to be here AND again inside `handleDownload`, and the two copies differed
// by one guard — the preview kept the first row for a duplicated key, the export
// kept the last (TD-043).

const SmartLookupTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  // --- STATE ---
  
  // 1. Reference Data (The Table Array)
  const [refFile, setRefFile] = useState<FileData | null>(null);
  const [useExternalRef, setUseExternalRef] = useState(false);
  
  // 2. Selection Configuration
  const [sourceSheet, setSourceSheet] = useState<string>('');
  const [refSheet, setRefSheet] = useState<string>('');
  
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [refHeaders, setRefHeaders] = useState<string[]>([]);
  
  const [lookupCol, setLookupCol] = useState<number>(-1); // Column in Source to search FOR
  const [matchCol, setMatchCol] = useState<number>(-1);   // Column in Ref to search IN
  const [returnCols, setReturnCols] = useState<number[]>([]); // Columns in Ref to return
  
  // 3. Settings
  const [smartMode, setSmartMode] = useState<boolean>(true);
  const [exportBatchSize, setExportBatchSize] = useState<number>(0);
  
  // 4. Processing
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [resultPreview, setResultPreview] = useState<any[][]>([]);
  const [stats, setStats] = useState<{ found: number, missing: number } | null>(null);
  /**
   * THE result — every row, not just the previewed ones.
   *
   * Export reads this instead of re-running the join. That is the whole fix for
   * TD-043: there is no second computation left to disagree with the first.
   */
  const [resultRows, setResultRows] = useState<CellInfo[][]>([]);
  const [resultHeader, setResultHeader] = useState<string[] | null>(null);

  // 3b. Behaviour options a manual formula user expects to control.
  const [hasHeaders, setHasHeaders] = useState<boolean>(true);
  /**
   * `null` means "the user has not chosen", so the localised default is used and
   * still follows a language switch. An EMPTY STRING is a real choice — write a
   * blank cell — which is why this is not just `useState('')` with a fallback:
   * that cannot tell "untouched" from "deliberately cleared".
   */
  const [notFoundValue, setNotFoundValue] = useState<string | null>(null);
  const effectiveNotFound = notFoundValue ?? t.smartLookup.notFound;

  // --- EFFECTS ---

  // Initialize Source Sheet from Main File
  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
        setSourceSheet(fileData.sheets[0]);
        // Default Ref to same file unless external selected
        if (!useExternalRef && !refFile) {
            setRefFile(fileData);
            setRefSheet(fileData.sheets.length > 1 ? fileData.sheets[1] : fileData.sheets[0]);
        }
    }
  }, [fileData]);

  // Sync internal refFile when toggling external off
  useEffect(() => {
      if (!useExternalRef && fileData) {
          setRefFile(fileData);
          // Keep current sheet selection if valid, else reset
          if (!fileData.sheets.includes(refSheet)) {
              setRefSheet(fileData.sheets[0]);
          }
      } else if (useExternalRef && refFile === fileData) {
          setRefFile(null); // Clear if switching to external but haven't uploaded yet
          setRefSheet('');
      }
  }, [useExternalRef, fileData]);

  // Load Headers Source
  useEffect(() => {
      if (fileData && sourceSheet) {
          const data = getSheetData(fileData.workbook, sourceSheet, false);
          if (data.length > 0) setSourceHeaders(data[0] as string[]);
          setLookupCol(-1);
      }
  }, [fileData, sourceSheet]);

  // Load Headers Ref
  useEffect(() => {
      if (refFile && refSheet) {
          const data = getSheetData(refFile.workbook, refSheet, false);
          if (data.length > 0) setRefHeaders(data[0] as string[]);
          setMatchCol(-1);
          setReturnCols([]);
      }
  }, [refFile, refSheet]);

  // --- HANDLERS ---

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          addLog(`${t.common.processing} ${file.name}...`, 'info');
          const data = await readExcelFile(file);
          setRefFile(data);
          setRefSheet(data.sheets[0]);
          addLog("Reference file loaded.", 'success');
      } catch (err: any) {
          addLog(err.message, 'error');
      }
  };

  const toggleReturnCol = (idx: number) => {
      setReturnCols(prev => 
          prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
  };

  const runLookup = async () => {
      if (!fileData || !refFile) return;
      if (lookupCol === -1 || matchCol === -1 || returnCols.length === 0) {
          addLog("Please select Lookup Column, Match Column, and at least one Return Column.", 'warning');
          return;
      }

      setStatus(ProcessingStatus.PROCESSING);
      setProgress(0);
      addLog("Starting Smart Lookup...", 'info');

      await new Promise(r => setTimeout(r, 100));

      // Cells, not values. `readGrid` keeps each cell's type and number format,
      // which is what lets the engine refuse to key on an error (TD-047) and lets
      // the export keep a date a date (TD-045).
      const sourceGrid = readGrid(XLSX, fileData.workbook.Sheets[sourceSheet]);
      const refGrid = readGrid(XLSX, refFile.workbook.Sheets[refSheet]);
      setProgress(20);

      const result = buildLookup(sourceGrid, refGrid, {
          matchCol,
          lookupCol,
          returnCols,
          smartMode,
          hasHeaders,
          notFoundValue: effectiveNotFound,
      });
      setProgress(90);

      // Held whole. The download exports THESE rows rather than repeating the
      // join, which is what stops the file disagreeing with the screen (TD-043).
      setResultRows(result.rows);
      setResultHeader(result.header);
      setStats({ found: result.found, missing: result.missing });
      setResultPreview([
          result.header ?? [],
          ...result.rows.slice(0, 50).map(row => row.map(c => formatCell(XLSX, c))),
      ]);

      addLog(`Lookup complete. Found: ${result.found}, Missing: ${result.missing}.`, 'success');
      setProgress(100);
      setStatus(ProcessingStatus.COMPLETED);
  };

  const handleDownload = async () => {
      if (!stats) return;
      
      setStatus(ProcessingStatus.PROCESSING);
      setProgress(0);
      
      try {
          // NO lookup here. This used to rebuild the index and re-run the join,
          // with one guard different from the preview's, so the file and the
          // screen disagreed whenever a key was duplicated (TD-043). It exports
          // the rows the preview was built from.
          const headerRow = resultHeader;
          const allDataRows = resultRows;

          // BATCH SPLIT LOGIC
          if (exportBatchSize > 0 && allDataRows.length > exportBatchSize) {
              const zip = new JSZip();
              let part = 1;
              const total = allDataRows.length;

              for (let i = 0; i < total; i += exportBatchSize) {
                  const chunk = allDataRows.slice(i, i + exportBatchSize);
                  const ws = writeSheet(XLSX, headerRow, chunk);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Lookup Results");
                  
                  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  zip.file(`Lookup_Part_${part}.xlsx`, buffer);
                  part++;
                  setProgress(Math.round((i / total) * 100));
                  await new Promise(r => setTimeout(r, 10));
              }

              const content = await zip.generateAsync({ type: 'blob' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(content);
              link.download = `SmartLookup_Batch_${fileData!.name}.zip`;
              link.click();
              
              addLog(`Batch Download Complete (${part-1} files).`, 'success');
          } else {
              // SINGLE FILE — same builder as the batch path above, so the two
              // cannot drift apart the way the two lookups did.
              const wb = XLSX.utils.book_new();
              const ws = writeSheet(XLSX, headerRow, allDataRows);
              XLSX.utils.book_append_sheet(wb, ws, "Lookup Results");
              saveWorkbook(wb, `SmartLookup_${fileData!.name}`);
              addLog("Download Complete.", 'success');
          }
      } catch (e: any) {
          addLog(`Download Error: ${e.message}`, 'error');
      } finally {
          setStatus(ProcessingStatus.COMPLETED);
      }
  };

  return (
    <div className="space-y-6">
       
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          {/* ... (Keep existing Header) */}
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                <Search className="text-indigo-600" size={24}/> {t.smartLookup.title}
             </h3>
             <div className="flex gap-2">
                 <button onClick={onReset} className="text-sm text-slate-500 hover:text-red-500 underline">Reset</button>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
             {/* ... (Keep existing Left/Right Config) ... */}
             <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-2 rounded-full border shadow-sm text-slate-400">
                 <ArrowRight size={24} />
             </div>

             {/* LEFT: SOURCE Config */}
             <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                 <div className="flex items-center gap-2 mb-2">
                     <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                     <h4 className="font-bold text-slate-700 text-sm uppercase">{t.smartLookup.sourceTable}</h4>
                 </div>
                 
                 <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.common.selectSheet}</label>
                     <div className="flex items-center gap-2">
                         <FileSpreadsheet size={16} className="text-slate-400"/>
                         <select 
                            className="w-full p-2 border rounded text-xs bg-white"
                            value={sourceSheet}
                            onChange={(e) => setSourceSheet(e.target.value)}
                         >
                            {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                     </div>
                 </div>

                 <div className="bg-white p-3 rounded border border-blue-200 shadow-sm">
                     <label className="block text-xs font-bold text-blue-700 uppercase mb-2">{t.smartLookup.lookupColumn}</label>
                     <select 
                        className="w-full p-2 border rounded text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={lookupCol}
                        onChange={(e) => setLookupCol(Number(e.target.value))}
                     >
                        <option value="-1">-- Select Column --</option>
                        {sourceHeaders.map((h, i) => <option key={i} value={i}>{i+1}. {h}</option>)}
                     </select>
                 </div>
             </div>

             {/* RIGHT: TARGET Config */}
             <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                 <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                        <h4 className="font-bold text-slate-700 text-sm uppercase">{t.smartLookup.targetTable}</h4>
                     </div>
                     
                     <div className="flex bg-white rounded p-0.5 border border-slate-200">
                         <button 
                            onClick={() => setUseExternalRef(false)}
                            className={`px-2 py-1 text-[10px] font-bold rounded ${!useExternalRef ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}
                         >
                             {t.smartLookup.currentFile}
                         </button>
                         <button 
                            onClick={() => setUseExternalRef(true)}
                            className={`px-2 py-1 text-[10px] font-bold rounded ${useExternalRef ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}
                         >
                             {t.smartLookup.externalFile}
                         </button>
                     </div>
                 </div>

                 {useExternalRef ? (
                     <div className="border-2 border-dashed border-slate-300 rounded p-3 text-center bg-white hover:bg-indigo-50 transition-colors cursor-pointer relative">
                         <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleRefUpload} accept=".xlsx,.csv" />
                         <UploadCloud size={20} className="mx-auto text-indigo-400 mb-1"/>
                         <p className="text-xs font-bold text-slate-600">{refFile ? refFile.name : t.smartLookup.uploadReference}</p>
                     </div>
                 ) : (
                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.common.selectSheet}</label>
                         <select 
                            className="w-full p-2 border rounded text-xs bg-white"
                            value={refSheet}
                            onChange={(e) => setRefSheet(e.target.value)}
                         >
                            {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                     </div>
                 )}

                 <div className="bg-white p-3 rounded border border-indigo-200 shadow-sm space-y-3">
                     <div>
                        <label className="block text-xs font-bold text-indigo-700 uppercase mb-2">{t.smartLookup.matchKey}</label>
                        <select 
                            className="w-full p-2 border rounded text-sm bg-indigo-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={matchCol}
                            onChange={(e) => setMatchCol(Number(e.target.value))}
                        >
                            <option value="-1">-- Select Key Column --</option>
                            {refHeaders.map((h, i) => <option key={i} value={i}>{i+1}. {h}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-green-700 uppercase mb-2">{t.smartLookup.returnColumns}</label>
                        <div className="max-h-32 overflow-y-auto border rounded bg-slate-50 p-2 custom-scrollbar">
                            {refHeaders.map((h, i) => (
                                <label key={i} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${returnCols.includes(i) ? 'bg-green-100 text-green-800 font-bold' : 'hover:bg-slate-200 text-slate-600'} ${matchCol === i ? 'opacity-50' : ''}`}>
                                    <input type="checkbox" checked={returnCols.includes(i)} onChange={() => toggleReturnCol(i)} className="rounded text-green-600"/>
                                    <span className="truncate">{h || `Col ${i+1}`}</span>
                                </label>
                            ))}
                        </div>
                     </div>
                 </div>
             </div>
          </div>

          {/* Configuration & Action */}
          <div className="mt-6 flex flex-col md:flex-row gap-6 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex-1">
                  <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><Settings2 size={16}/> {t.smartLookup.matchSettings}</h4>
                  <div className="flex flex-wrap gap-4 items-start">
                      <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white transition-colors border border-transparent hover:border-slate-200">
                          <input type="checkbox" checked={smartMode} onChange={e => setSmartMode(e.target.checked)} className="rounded text-indigo-600 w-4 h-4"/>
                          <div>
                              <span className="text-xs font-bold text-indigo-700 block flex items-center gap-1"><Wand2 size={12}/> {t.smartLookup.smartMatch}</span>
                              <span className="text-[10px] text-slate-500">{t.smartLookup.smartMatchHint}</span>
                          </div>
                      </label>

                      {/* The first row was ALWAYS consumed as a header, so headerless
                          data silently lost its first record with nothing to say so. */}
                      <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white transition-colors border border-transparent hover:border-slate-200">
                          <input type="checkbox" checked={hasHeaders} onChange={e => setHasHeaders(e.target.checked)} className="rounded text-indigo-600 w-4 h-4"/>
                          <div>
                              <span className="text-xs font-bold text-slate-700 block">{t.smartLookup.firstRowIsHeader}</span>
                              <span className="text-[10px] text-slate-500">{t.smartLookup.firstRowIsHeaderHint}</span>
                          </div>
                      </label>

                      {/* Was the hard-coded English string "Not Found", written into
                          whatever column it landed in — including numeric ones. */}
                      <div className="p-2">
                          <label className="text-xs font-bold text-slate-700 block mb-1" htmlFor="notFoundValue">
                              {t.smartLookup.notFoundLabel}
                          </label>
                          <input
                             id="notFoundValue"
                             type="text"
                             value={effectiveNotFound}
                             onChange={e => setNotFoundValue(e.target.value)}
                             placeholder={t.smartLookup.notFound}
                             className="w-40 p-1.5 border rounded text-xs bg-white"
                          />
                          <span className="text-[10px] text-slate-500 block mt-0.5">{t.smartLookup.notFoundHint}</span>
                      </div>
                  </div>
              </div>
              <button
                 onClick={runLookup}
                 disabled={status === ProcessingStatus.PROCESSING}
                 className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                 {status === ProcessingStatus.PROCESSING ? <RefreshCw className="animate-spin" size={20}/> : <ArrowLeftRight size={20}/>}
                 {t.smartLookup.run}
              </button>
          </div>
       </div>

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}

       {/* RESULTS PREVIEW */}
       {stats && (
           <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
               <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                   <div className="flex items-center gap-4">
                       <h4 className="font-bold text-slate-700 flex items-center gap-2"><Table size={16}/> {t.smartLookup.resultPreview}</h4>
                       <div className="flex gap-2 text-xs">
                           <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-bold flex items-center gap-1"><CheckCircle2 size={12}/> {stats.found} {t.smartLookup.found}</span>
                           <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-bold flex items-center gap-1"><AlertCircle size={12}/> {stats.missing} {t.smartLookup.missing}</span>
                       </div>
                   </div>
                   <div className="flex items-center gap-2">
                       <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5">
                           <Package size={14} className="text-slate-400"/>
                           <input 
                              type="number" 
                              placeholder={t.smartLookup.maxRowsPerFile} 
                              className="w-20 text-xs outline-none"
                              value={exportBatchSize || ''}
                              onChange={(e) => setExportBatchSize(Number(e.target.value))}
                           />
                       </div>
                       <button onClick={handleDownload} className="text-xs bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm transition-colors">
                           <Download size={14}/> {t.smartLookup.download}
                       </button>
                   </div>
               </div>
               
               <div className="overflow-x-auto max-h-[500px]">
                   <table className="w-full text-left text-xs border-collapse">
                       <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm z-10">
                           <tr>
                               <th className="p-3 border-b font-bold w-12 text-center">#</th>
                               {resultPreview[0]?.map((h: any, i: number) => (
                                   <th key={i} className={`p-3 border-b font-bold whitespace-nowrap ${i >= sourceHeaders.length ? 'text-green-700 bg-green-50' : ''}`}>
                                       {h}
                                   </th>
                               ))}
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                           {resultPreview.slice(1).map((row, i) => (
                               <tr key={i} className="hover:bg-slate-50">
                                   <td className="p-3 border-r text-center text-slate-400 font-mono">{i+1}</td>
                                   {row.map((c: any, j: number) => {
                                       const isResultCol = j >= sourceHeaders.length;
                                       const isNotFound = String(c) === "Not Found";
                                       return (
                                           <td key={j} className={`p-3 border-r truncate max-w-[200px] ${isResultCol ? (isNotFound ? 'text-red-500 font-bold bg-red-50' : 'font-medium text-slate-800 bg-green-50/20') : 'text-slate-600'}`}>
                                               {String(c)}
                                           </td>
                                       );
                                   })}
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           </div>
       )}

    </div>
  );
};

export default SmartLookupTab;
