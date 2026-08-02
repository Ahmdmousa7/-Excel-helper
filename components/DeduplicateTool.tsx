import React, { useState, useEffect } from 'react';
import { FileData, ProcessingStatus } from '../types';
import { getSheetData, createWorkbook, appendSheet, saveWorkbook } from '../services/excelService';
import { CopyX, Download, Activity, AlertTriangle, Info } from 'lucide-react';

interface Props {
  fileData?: FileData | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export const DeduplicateTool: React.FC<Props> = ({ fileData, addLog }) => {
  const [targetSheet, setTargetSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedCols, setSelectedCols] = useState<number[]>([]);
  const [keepFirst, setKeepFirst] = useState<boolean>(true);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [result, setResult] = useState<{ cleanedData: any[][], origCount: number, dupesFound: number } | null>(null);

  useEffect(() => {
     if (fileData && fileData.sheets.length > 0 && !targetSheet) {
         setTargetSheet(fileData.sheets[0]);
     }
  }, [fileData]);

  useEffect(() => {
     if (fileData && targetSheet) {
         const data = getSheetData(fileData.workbook, targetSheet, true);
         setHeaders(data.length > 0 ? data[0] : []);
         setSelectedCols([]); // reset selection
     }
  }, [fileData, targetSheet]);

  const toggleCol = (idx: number) => {
      setSelectedCols(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const handleExecute = () => {
      if (!fileData || !targetSheet || selectedCols.length === 0) return;
      setStatus(ProcessingStatus.PROCESSING);
      addLog(`Removing duplicates using ${selectedCols.length} columns...`, 'info');

      setTimeout(() => {
         try {
             const rawData = getSheetData(fileData.workbook, targetSheet, true);
             if (rawData.length <= 1) {
                 addLog("Not enough data rows.", 'warning');
                 setStatus(ProcessingStatus.IDLE);
                 return;
             }

             const headerRow = rawData[0];
             const dataRows = rawData.slice(1);
             const occurrences = new Map<string, number[]>();

             // Map phase: Find all duplicates
             dataRows.forEach((row, rowIdx) => {
                 const keyParts: string[] = [];
                 selectedCols.forEach(cIdx => {
                     keyParts.push(String(row[cIdx] ?? '').trim().toLowerCase());
                 });
                 const key = keyParts.join('|||');
                 if (!occurrences.has(key)) occurrences.set(key, []);
                 occurrences.get(key)!.push(rowIdx);
             });

             const validIndices = new Set<number>();
             let dupesFound = 0;

             // Reduce phase: filter based on keepFirst mode
             occurrences.forEach((rowIndices, _) => {
                 if (rowIndices.length > 1) {
                     dupesFound += (rowIndices.length - 1);
                     if (keepFirst) {
                         validIndices.add(rowIndices[0]);
                     }
                     // if keepFirst is false, we keep NONE of them (eradicate outright)
                 } else {
                     validIndices.add(rowIndices[0]);
                 }
             });

             const cleanedData = [headerRow];
             dataRows.forEach((row, rowIdx) => {
                 if (validIndices.has(rowIdx)) {
                     cleanedData.push(row);
                 }
             });

             setResult({ cleanedData, origCount: dataRows.length, dupesFound });
             setStatus(ProcessingStatus.COMPLETED);
             addLog(`Done. Eradicated ${dupesFound} duplicates.`, 'success');
         } catch(e: any) {
             addLog(`Deduplication error: ${e.message}`, 'error');
             setStatus(ProcessingStatus.ERROR);
         }
      }, 50);
  };

  const downloadResult = () => {
      if (!result) return;
      try {
          const wb = createWorkbook();
          appendSheet(wb, result.cleanedData, 'Scrubbed_Data');
          saveWorkbook(wb, `Scrubbed_${fileData?.name || 'File'}.xlsx`);
          addLog("Downloaded scrubbed dataset.", "success");
      } catch (e: any) {
          addLog(`Error exporting: ${e.message}`, 'error');
      }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-start gap-4">
            <CopyX className="text-rose-600 w-8 h-8 shrink-0" />
            <div>
                <h2 className="text-xl font-bold text-slate-800">Remove Duplicates</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Sanitizes data arrays by mapping groups of rows via primary keys, preserving either the first valid occurrence or eradicating all duplicate occurrences outright.
                </p>
            </div>
        </div>

        <div className="p-6 flex flex-col lg:flex-row gap-6 bg-white overflow-y-auto">
             <div className="w-full lg:w-1/3 flex flex-col gap-4">
                 <div>
                     <label className="block text-xs font-bold text-slate-700 mb-1">Target Sheet</label>
                     <select className="w-full p-2 border rounded text-sm bg-white" value={targetSheet} onChange={e => setTargetSheet(e.target.value)}>
                         {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                 </div>

                 <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 shadow-sm">
                     <AlertTriangle className="text-amber-600 w-4 h-4 shrink-0 mt-0.5" />
                     <p className="text-[10px] text-amber-800 leading-tight">
                         <b>Important:</b> If you select multiple columns, a row is solely aggregated as a duplicate if ALL selected column vectors strictly match.
                     </p>
                 </div>

                 <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 flex flex-col">
                     <div className="bg-slate-100 p-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between">
                         <span>Hash Columns</span>
                         <span className="text-slate-500">{selectedCols.length} Selected</span>
                     </div>
                     <div className="p-2 overflow-auto flex-1 max-h-[250px] space-y-1">
                         {headers.map((h, i) => (
                             <label key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer font-medium text-xs transition-colors ${selectedCols.includes(i) ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}>
                                 <input type="checkbox" checked={selectedCols.includes(i)} onChange={() => toggleCol(i)} className="rounded text-rose-600" />
                                 <span className="truncate">{h || `Column ${i+1}`}</span>
                             </label>
                         ))}
                     </div>
                 </div>
             </div>

             <div className="w-full lg:w-2/3 flex flex-col gap-6">
                 <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
                    <h3 className="font-bold text-slate-800 border-b pb-2">Resolution Action</h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <label className={`flex-1 flex px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${keepFirst ? 'border-rose-600 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-300'}`}>
                            <input type="radio" checked={keepFirst} onChange={() => setKeepFirst(true)} className="mt-1 mr-3 text-rose-600" />
                            <div>
                                <h4 className="font-bold text-sm text-slate-800">Keep First Occurrence</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">Retains the very first row encountered; deletes subsequent matches.</p>
                            </div>
                        </label>
                        <label className={`flex-1 flex px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${!keepFirst ? 'border-rose-600 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-300'}`}>
                            <input type="radio" checked={!keepFirst} onChange={() => setKeepFirst(false)} className="mt-1 mr-3 text-rose-600" />
                            <div>
                                <h4 className="font-bold text-sm text-slate-800">Remove All Duplicates</h4>
                                <p className="text-[10px] text-slate-500 mt-0.5">Eradicates the group entirely. Only pure unique rows survive.</p>
                            </div>
                        </label>
                    </div>

                    <button 
                        onClick={handleExecute}
                        disabled={!fileData || selectedCols.length === 0 || status === ProcessingStatus.PROCESSING}
                        className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                         {status === ProcessingStatus.PROCESSING ? <Activity className="animate-spin" /> : <CopyX />}
                         Execute Deduplication
                    </button>
                 </div>

                 {result && (
                     <div className="border-2 border-green-200 bg-green-50 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
                         <div className="flex flex-col gap-1">
                             <h3 className="font-bold text-green-900 flex items-center gap-2">
                                <Info size={18}/> Operation Successful
                             </h3>
                             <div className="flex gap-4 text-xs font-medium text-green-800 mt-2">
                                 <span className="bg-white px-2 py-1 rounded shadow-sm">Original Rows: {result.origCount}</span>
                                 <span className="bg-white px-2 py-1 rounded shadow-sm text-rose-600">Discovered Duplicates: {result.dupesFound}</span>
                                 <span className="bg-white px-2 py-1 rounded shadow-sm font-bold">Surviving: {result.cleanedData.length - 1}</span>
                             </div>
                         </div>
                         <button 
                            onClick={downloadResult}
                            className="bg-green-600 text-white font-bold px-6 py-3 rounded-lg shadow-sm hover:bg-green-700 flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center"
                         >
                             <Download size={18}/> Export Dataset
                         </button>
                     </div>
                 )}
             </div>
        </div>
    </div>
  );
};
