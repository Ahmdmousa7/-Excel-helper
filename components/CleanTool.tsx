import React, { useState, useRef } from 'react';
import { FileData, ProcessingStatus } from '../types';
import { getSheetData, readExcelFile } from '../services/excelService';
import { cleanEmptyColumns, exportToExcelSingleSheet } from '../utils/excelUtils';
import { Download, Trash2, Wand2, Activity, ShieldCheck, Upload, XCircle, FileSpreadsheet } from 'lucide-react';
import JSZip from 'jszip';

interface Props {
  fileData?: FileData | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export const CleanTool: React.FC<Props> = ({ fileData, addLog }) => {
  const [startRow, setStartRow] = useState<number>(0);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [results, setResults] = useState<{ fileName: string, sheetName: string, dropped: number, retained: number, buffer: ArrayBuffer }[] | null>(null);
  const [extraFiles, setExtraFiles] = useState<FileData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allFiles = fileData ? [fileData, ...extraFiles] : extraFiles;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const newFiles: FileData[] = [];
      for (let i = 0; i < files.length; i++) {
          try {
              addLog(`Parsing file: ${files[i].name}...`, 'info');
              const data = await readExcelFile(files[i]);
              newFiles.push(data);
          } catch (err: any) {
              addLog(`Failed to parse file: ${err.message}`, 'error');
          }
      }
      if (newFiles.length > 0) {
          setExtraFiles(prev => [...prev, ...newFiles]);
          addLog(`Added ${newFiles.length} file(s).`, 'success');
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const removeExtraFile = (index: number) => {
      setExtraFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClean = async () => {
    if (allFiles.length === 0) {
      addLog('No files to clean.', 'error');
      return;
    }
    
    setStatus(ProcessingStatus.PROCESSING);
    addLog(`Cleaning ${allFiles.length} files, starting at row ${startRow}...`, 'info');

    // Async timeout to allow UI reflection
    setTimeout(() => {
        try {
            const arr: { fileName: string, sheetName: string, dropped: number, retained: number, buffer: ArrayBuffer }[] = [];
            let totalDropped = 0;
            allFiles.forEach(fData => {
                fData.sheets.forEach(sheetName => {
                    const rawData = getSheetData(fData.workbook, sheetName, true);
                    const { cleanedData, droppedCount, retainedCount } = cleanEmptyColumns(rawData, startRow);
                    const buffer = exportToExcelSingleSheet(cleanedData, sheetName);
                    arr.push({ fileName: fData.name, sheetName, dropped: droppedCount, retained: retainedCount, buffer });
                    totalDropped += droppedCount;
                });
            });
            setResults(arr);
            setStatus(ProcessingStatus.COMPLETED);
            addLog(`Completed! Removed ${totalDropped} empty columns across all files.`, 'success');
        } catch (err: any) {
            addLog(`Error during cleaning: ${err.message}`, 'error');
            setStatus(ProcessingStatus.ERROR);
        }
    }, 100);
  };

  const downloadAll = async () => {
      if (!results) return;
      if (results.length === 1) {
          const res = results[0];
          const extSplit = res.fileName.lastIndexOf('.');
          const baseName = extSplit === -1 ? res.fileName : res.fileName.substring(0, extSplit);
          const blob = new Blob([res.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Cleaned_${baseName}_${res.sheetName}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
      } else {
          const zip = new JSZip();
          results.forEach((res) => {
              const extSplit = res.fileName.lastIndexOf('.');
              const baseName = extSplit === -1 ? res.fileName : res.fileName.substring(0, extSplit);
              zip.file(`Cleaned_${baseName}_${res.sheetName}.xlsx`, res.buffer);
          });
          const blob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Cleaned_Archive_${allFiles.length}_Files.zip`;
          a.click();
          URL.revokeObjectURL(url);
      }
  };

  const downloadSingle = (res: any) => {
    const extSplit = res.fileName.lastIndexOf('.');
    const baseName = extSplit === -1 ? res.fileName : res.fileName.substring(0, extSplit);
    const blob = new Blob([res.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cleaned_${baseName}_${res.sheetName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="bg-slate-50 border-b border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Wand2 className="text-blue-600" />
                Remove Blanks (Clean Empty Columns)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
                Aggressively drops unneeded column vectors that maintain absolute null or zero-space consistency across the entire sheet.
            </p>
        </div>
        
        <div className="p-6 flex-1 flex flex-col gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                 <div className="flex justify-between items-center mb-3">
                     <h3 className="font-bold text-slate-700 text-sm">Files to Clean ({allFiles.length})</h3>
                     <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded cursor-pointer font-bold flex items-center gap-1 transition-colors">
                         <Upload size={14}/> Add More Files
                         <input type="file" multiple accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                     </label>
                 </div>
                 <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                     {fileData && (
                         <div className="flex items-center gap-2 bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-full text-xs font-semibold">
                             <FileSpreadsheet size={14}/>
                             {fileData.name} (Primary)
                         </div>
                     )}
                     {extraFiles.map((f, i) => (
                         <div key={i} className="flex items-center gap-2 bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-medium">
                             <FileSpreadsheet size={14}/>
                             {f.name}
                             <button onClick={() => removeExtraFile(i)} className="text-slate-400 hover:text-red-500 rounded-full bg-white ml-1">
                                 <XCircle size={14}/>
                             </button>
                         </div>
                     ))}
                     {allFiles.length === 0 && (
                         <p className="text-xs text-slate-500 italic">No files selected. Upload a file above or use the Add More Files button.</p>
                     )}
                 </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Define Start Row Index</label>
                    <p className="text-xs text-slate-500 mb-3">Skip early rows (like headers or metadata) to prevent false-positive column retention.</p>
                    <input 
                        type="number" 
                        min="0"
                        value={startRow} 
                        onChange={(e) => setStartRow(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full max-w-[200px] p-2 border border-blue-200 rounded shadow-sm outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    />
                </div>
                <div>
                   <button 
                        disabled={allFiles.length === 0 || status === ProcessingStatus.PROCESSING}
                        onClick={handleClean}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-lg shadow-sm transition-all flex items-center gap-2"
                   >
                       {status === ProcessingStatus.PROCESSING ? <Activity className="animate-spin" /> : <Trash2 />}
                       Scrub Clean
                   </button>
                </div>
            </div>

            {results && (
                <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center">
                        <span className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                           <ShieldCheck className="text-green-600 w-4 h-4"/> 
                           Sanitized Sheets
                        </span>
                        <button 
                            onClick={downloadAll}
                            className="text-xs bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 font-bold shadow-sm flex items-center gap-2"
                        >
                            <Download size={14} /> Download All Files
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4 bg-slate-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {results.map((res, i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded shadow-sm p-4 flex flex-col gap-3 hover:border-blue-300 transition-colors">
                                    <div className="min-w-0">
                                       <h4 className="font-bold text-slate-700 truncate" title={res.fileName}>{res.fileName}</h4>
                                       <p className="text-[10px] text-slate-500 uppercase tracking-widest">{res.sheetName}</p>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                                        <span className="text-red-500 font-semibold">{res.dropped} Dropped</span>
                                        <span className="text-green-600 font-semibold">{res.retained} Retained</span>
                                    </div>
                                    <button 
                                        onClick={() => downloadSingle(res)}
                                        className="mt-auto w-full py-1.5 border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1 text-slate-600"
                                    >
                                        <Download size={12} /> Download
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
