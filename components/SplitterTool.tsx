import React, { useState } from 'react';
import { FileData, ProcessingStatus } from '../types';
import { getSheetData } from '../services/excelService';
import { extractSheets, exportToExcelSingleSheet } from '../utils/excelUtils';
import { Download, FileSpreadsheet, Spline, SplitSquareHorizontal, Layers, Activity } from 'lucide-react';
import JSZip from 'jszip';

interface Props {
  fileData?: FileData | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export const SplitterTool: React.FC<Props> = ({ fileData, addLog }) => {
  const [splitMode, setSplitMode] = useState<'sheets' | 'rows'>('sheets');
  const [maxRows, setMaxRows] = useState<number>(1000);
  const [targetSheet, setTargetSheet] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  
  React.useEffect(() => {
     if (fileData && fileData.sheets.length > 0 && !targetSheet) {
         setTargetSheet(fileData.sheets[0]);
     }
  }, [fileData]);

  const handleSplitSheets = async () => {
    if (!fileData) return;
    setStatus(ProcessingStatus.PROCESSING);
    addLog(`Splitting workbook into ${fileData.sheets.length} separate files...`, 'info');

    setTimeout(async () => {
        try {
            const zip = new JSZip();
            fileData.sheets.forEach(sheetName => {
                const data = getSheetData(fileData.workbook, sheetName, true);
                const buffer = exportToExcelSingleSheet(data, sheetName);
                zip.file(`${sheetName}.xlsx`, buffer);
            });
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Separated_Sheets_${fileData.name}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            setStatus(ProcessingStatus.COMPLETED);
            addLog(`Successfully generated ZIP with ${fileData.sheets.length} files.`, 'success');
        } catch (e: any) {
            addLog(`Error exporting split sheets: ${e.message}`, 'error');
            setStatus(ProcessingStatus.ERROR);
        }
    }, 50);
  };

  const handleSplitRows = async () => {
      if (!fileData || !targetSheet || maxRows < 1) return;
      setStatus(ProcessingStatus.PROCESSING);
      addLog(`Splitting sheet '${targetSheet}' into chunks of ${maxRows} max rows...`, 'info');

      setTimeout(async () => {
          try {
              const zip = new JSZip();
              const fullData = getSheetData(fileData.workbook, targetSheet, true);
              const headers = fullData[0] || [];
              const rows = fullData.slice(1);
              
              if (rows.length === 0) {
                  addLog("No data rows found to split.", 'warning');
                  setStatus(ProcessingStatus.IDLE);
                  return;
              }

              let part = 1;
              for (let i = 0; i < rows.length; i += maxRows) {
                  const chunk = rows.slice(i, i + maxRows);
                  const exportData = [headers, ...chunk];
                  const buffer = exportToExcelSingleSheet(exportData, `${targetSheet}_Pt${part}`);
                  zip.file(`${targetSheet}_Part_${part}.xlsx`, buffer);
                  part++;
              }

              const blob = await zip.generateAsync({ type: 'blob' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Chunked_Rows_${targetSheet}.zip`;
              a.click();
              URL.revokeObjectURL(url);
              
              setStatus(ProcessingStatus.COMPLETED);
              addLog(`Successfully generated ZIP with ${part - 1} chunked files.`, 'success');
          } catch (e: any) {
              addLog(`Error splitting rows: ${e.message}`, 'error');
              setStatus(ProcessingStatus.ERROR);
          }
      }, 50);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-start gap-4">
            <Spline className="text-indigo-600 w-8 h-8 shrink-0" />
            <div>
                <h2 className="text-xl font-bold text-slate-800">Separator Tool</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Break down large, unwieldy Excel files into smaller, manageable granular chunks.
                </p>
            </div>
        </div>

        <div className="p-6 flex flex-col lg:flex-row gap-6 bg-white overflow-y-auto">
            <div className="w-full lg:w-1/3 space-y-4">
                <button 
                   onClick={() => setSplitMode('sheets')}
                   className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${splitMode === 'sheets' ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}
                >
                    <Layers className={`shrink-0 ${splitMode === 'sheets' ? 'text-indigo-600' : 'text-slate-400'}`} size={24} />
                    <div>
                        <h3 className={`font-bold text-sm ${splitMode === 'sheets' ? 'text-indigo-800' : 'text-slate-700'}`}>Separate Sheets to Files</h3>
                        <p className="text-xs text-slate-500 mt-1">Extracts every internal sheet into its own isolated XLSX file.</p>
                    </div>
                </button>

                <button 
                   onClick={() => setSplitMode('rows')}
                   className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${splitMode === 'rows' ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}
                >
                    <SplitSquareHorizontal className={`shrink-0 ${splitMode === 'rows' ? 'text-indigo-600' : 'text-slate-400'}`} size={24} />
                    <div>
                        <h3 className={`font-bold text-sm ${splitMode === 'rows' ? 'text-indigo-800' : 'text-slate-700'}`}>Divide Rows to New Sheets</h3>
                        <p className="text-xs text-slate-500 mt-1">Chunks massive rows evenly by a specified batch limit.</p>
                    </div>
                </button>
            </div>

            <div className="w-full lg:w-2/3 border border-slate-200 rounded-lg p-6 bg-slate-50">
                {splitMode === 'sheets' ? (
                   <div className="h-full flex flex-col justify-center max-w-md mx-auto space-y-6">
                       <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
                           <FileSpreadsheet className="text-blue-500 shrink-0 mt-1" size={20}/>
                           <div>
                               <h4 className="font-bold text-blue-900 text-sm">Convert Sheets to Files</h4>
                               <p className="text-xs text-blue-700 mt-1">This will compress {fileData?.sheets.length || 0} sheets into a unified ZIP archive containing individual Excel files.</p>
                           </div>
                       </div>
                       <button
                           disabled={!fileData || status === ProcessingStatus.PROCESSING}
                           onClick={handleSplitSheets}
                           className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                           {status === ProcessingStatus.PROCESSING ? <Activity className="animate-spin" size={18}/> : <Download size={18}/>}
                           Download ZIP Repository
                       </button>
                   </div>
                ) : (
                   <div className="h-full flex flex-col justify-center max-w-md mx-auto space-y-6">
                       <div className="space-y-4 bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                           <div>
                               <label className="block text-xs font-bold text-slate-700 mb-1">Target Source Sheet</label>
                               <select 
                                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                  value={targetSheet}
                                  onChange={(e) => setTargetSheet(e.target.value)}
                               >
                                   {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                               </select>
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-slate-700 mb-1">Maximum Rows per File (Chunk Size)</label>
                               <input 
                                  type="number"
                                  min="1"
                                  value={maxRows}
                                  onChange={(e) => setMaxRows(parseInt(e.target.value) || 1000)}
                                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                               />
                               <p className="text-[10px] text-slate-500 mt-1">Files exceeding this length will overflow into _Pt2, _Pt3 etc.</p>
                           </div>
                       </div>

                       <button
                           disabled={!fileData || status === ProcessingStatus.PROCESSING}
                           onClick={handleSplitRows}
                           className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                           {status === ProcessingStatus.PROCESSING ? <Activity className="animate-spin" size={18}/> : <Download size={18}/>}
                           Execute Row Split (Download ZIP)
                       </button>
                   </div>
                )}
            </div>
        </div>
    </div>
  );
};
