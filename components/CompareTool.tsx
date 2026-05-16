import React, { useState, useEffect } from 'react';
import { FileData, ProcessingStatus } from '../types';
import { getSheetData, createWorkbook, appendSheet, saveWorkbook, readExcelFile } from '../services/excelService';
import { compareDatasets, DiffRow, CompareSummary } from '../utils/compareUtils';
import { ArrowLeftRight, FileSpreadsheet, Play, Download, AlertTriangle, FileText, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { aiService } from '../services/aiServiceFactory';

interface Props {
  fileData?: FileData | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  geminiKey?: string;
  language?: string;
}

export const CompareTool: React.FC<Props> = ({ fileData, addLog, geminiKey, language = 'en' }) => {
  const [fileData2, setFileData2] = useState<FileData | null>(null);
  const [sheet1, setSheet1] = useState<string>('');
  const [sheet2, setSheet2] = useState<string>('');
  
  const [headers1, setHeaders1] = useState<string[]>([]);
  const [headers2, setHeaders2] = useState<string[]>([]);
  
  const [keyCol1, setKeyCol1] = useState<number>(0);
  const [keyCol2, setKeyCol2] = useState<number>(0);
  
  const [columnMapping, setColumnMapping] = useState<Record<number, number>>({});
  
  const [fuzzyMatch, setFuzzyMatch] = useState<boolean>(false);
  const [decimalTolerance, setDecimalTolerance] = useState<boolean>(false);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [results, setResults] = useState<{ diffs: DiffRow[], summary: CompareSummary } | null>(null);
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
     if (fileData && fileData.sheets.length > 0) {
         setSheet1(fileData.sheets[0]);
         if (fileData.sheets.length > 1) {
             setSheet2(fileData.sheets[1]);
         } else {
             setSheet2(fileData.sheets[0]);
         }
     }
  }, [fileData]);

  useEffect(() => {
     if (fileData && sheet1) {
         const data = getSheetData(fileData.workbook, sheet1, true);
         setHeaders1(data.length > 0 ? data[0] : []);
     }
  }, [fileData, sheet1]);

  useEffect(() => {
     if (fileData2 && fileData2.sheets.length > 0) {
         setSheet2(fileData2.sheets[0]);
     }
  }, [fileData2]);

  useEffect(() => {
     const dataFile2 = fileData2 || fileData;
     if (dataFile2 && sheet2) {
         const data = getSheetData(dataFile2.workbook, sheet2, true);
         setHeaders2(data.length > 0 ? data[0] : []);
         // auto-map by name
         const map: Record<number, number> = {};
         if (headers1.length > 0 && data.length > 0) {
             const h2 = data[0];
             headers1.forEach((h, i) => {
                 const tIdx = h2.findIndex((th: any) => th && h && String(th).toLowerCase().trim() === String(h).toLowerCase().trim());
                 if (tIdx !== -1) map[i] = tIdx;
             });
             setColumnMapping(map);
         }
     }
  }, [fileData, fileData2, sheet2, headers1]);

  const updateMap = (sIdx: number, tIdx: number) => {
      setColumnMapping(prev => ({ ...prev, [sIdx]: tIdx }));
  };

  const handleFile2Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          addLog(`Parsing file 2: ${file.name}...`, 'info');
          const data = await readExcelFile(file);
          setFileData2(data);
          addLog(`File 2 parsed successfully.`, 'success');
      } catch (err: any) {
          addLog(`Failed to parse file 2: ${err.message}`, 'error');
      }
      e.target.value = '';
  };

  const handleCompare = () => {
      if (!fileData) return;
      setStatus(ProcessingStatus.PROCESSING);
      setAiAnalysis(null);
      addLog(`Comparing sheets...`, 'info');

      setTimeout(() => {
          try {
              const dataFile2 = fileData2 || fileData;
              const data1 = getSheetData(fileData.workbook, sheet1, true);
              const data2 = dataFile2 ? getSheetData(dataFile2.workbook, sheet2, true) : [];

              const mappedColsDict: Record<number, number> = {};
              Object.entries(columnMapping).forEach(([k, v]) => {
                  if (v !== -1) mappedColsDict[Number(k)] = v;
              });

              const result = compareDatasets(data1, data2, keyCol1, keyCol2, mappedColsDict, fuzzyMatch, decimalTolerance);
              setResults(result);
              setStatus(ProcessingStatus.COMPLETED);
              addLog(`Comparison finished. Found ${result.summary.mismatches} mismatches.`, 'success');
          } catch(err: any) {
              addLog(`Comparison error: ${err.message}`, 'error');
              setStatus(ProcessingStatus.ERROR);
          }
      }, 50);
  };

  const handleAnalyzeAI = async () => {
      if (!results || !geminiKey) {
          if (!geminiKey) addLog("Gemini API key is required for AI Analysis.", "error");
          return;
      }
      
      setIsAiLoading(true);
      addLog("Generating AI Executive Summary...", 'info');
      try {
          const sampleMismatches = results.diffs.filter(d => d.status === 'mismatch').slice(0, 10).map(d => ({
              key: d.key,
              file1Data: d.data1,
              file2Data: d.data2
          }));

          const prompt = `Analyze this data comparison between "${sheet1}" and "${sheet2}". 
          Stats: Matches: ${results.summary.matches}, Mismatches: ${results.summary.mismatches}, Missing in 1: ${results.summary.missingIn1}, Missing in 2: ${results.summary.missingIn2}.
          Sample Mismatches (up to 10): ${JSON.stringify(sampleMismatches)}
          
          Provide a professional executive summary for a Data Analyst. Focus on data consistency, potential discrepancies (pricing/inventory if applicable), and identifiable broader patterns over these rows. Keep it concise, action-oriented, and structured. Only return the analysis text.`;

          const response = await aiService.generateContent(prompt, { model: 'gemini-3.1-pro-preview' }, geminiKey);
          setAiAnalysis(response);
          addLog("AI Analysis generated.", "success");
      } catch (err: any) {
          addLog(`AI Analysis Failed: ${err.message}`, 'error');
      } finally {
          setIsAiLoading(false);
      }
  };

  const buildExportData = () => {
      if (!results) return [];
      const exportData: any[][] = [
          ['Status', 'Key', 'Differences', 'Differences Description', ...headers1.map(h => `File1_${h}`), ...headers2.map(h => `File2_${h}`)]
      ];
      
      results.diffs.forEach(diff => {
          let diffNames = '';
          let diffDesc = '';
          let statusText = diff.status.toUpperCase();
          
          if (diff.status === 'missing_in_1') {
              diffDesc = 'Row missing in File 1';
          } else if (diff.status === 'missing_in_2') {
              diffDesc = 'Row missing in File 2';
          } else if (diff.status === 'match') {
              diffDesc = 'Rows perfectly match';
          } else if (diff.status === 'mismatch') {
              const cols = (diff.mismatchedColumns || [])
                  .map(c => headers1[c] || `Col ${c}`)
                  .filter(Boolean)
                  .join(' , ');
              diffNames = cols;
              
              const detailDesc = (diff.mismatchedColumns || []).map(c1 => {
                  const c2 = columnMapping[c1];
                  const colName = headers1[c1] || `Col ${c1}`;
                  const val1 = diff.data1 ? String(diff.data1[c1] ?? '') : '';
                  const val2 = (diff.data2 && c2 !== undefined && c2 !== -1) ? String(diff.data2[c2] ?? '') : '';
                  return `${colName}: ${val1} > ${val2}`;
              }).join(' - ');
              
              diffDesc = detailDesc || `Mismatched values in: ${cols}`;
          }

          const row = [
              statusText,
              diff.key, 
              diffNames,
              diffDesc,
              ...(diff.data1 || new Array(headers1.length).fill('')).map(c => String(c ?? '')),
              ...(diff.data2 || new Array(headers2.length).fill('')).map(c => String(c ?? ''))
          ];
          exportData.push(row);
      });
      return exportData;
  };

  const exportToExcel = () => {
      if (!results) return;
      try {
          const wb = createWorkbook();
          const exportData = buildExportData();

          appendSheet(wb, exportData, 'Comparison_Report');
          
          if (aiAnalysis) {
              const analysisData = [
                  ['AI Insights'],
                  [aiAnalysis]
              ];
              appendSheet(wb, analysisData, 'AI Insights');
          }

          saveWorkbook(wb, `Comparison_${fileData?.name || 'Report'}.xlsx`);
          addLog("Exported comparison to Excel.", "success");
      } catch(e: any) {
          addLog(`Export Error: ${e.message}`, "error");
      }
  };

  const exportToCSV = () => {
      if (!results) return;
      try {
          const exportData = buildExportData();

          const csvContent = "data:text/csv;charset=utf-8," 
              + exportData.map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
          
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `Comparison_${fileData?.name || 'Report'}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          addLog("Exported comparison to CSV.", "success");
      } catch(e: any) {
          addLog(`Export Error: ${e.message}`, "error");
      }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[600px] h-full overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col sm:flex-row justify-between shrink-0 gap-4">
            <div className="flex items-start gap-4">
                <ArrowLeftRight className="text-orange-600 w-8 h-8 shrink-0" />
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Compare Files</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Identify matching, differing, and missing rows between two datasets.
                    </p>
                </div>
            </div>
            {results && (
                <div className="flex gap-2">
                    <button onClick={exportToCSV} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                         <Download size={16}/> Export CSV
                    </button>
                    <button onClick={exportToExcel} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded shadow-sm text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                         <Download size={16}/> Export Excel
                    </button>
                    <button onClick={handleAnalyzeAI} disabled={isAiLoading || !geminiKey} className="bg-orange-600 text-white px-4 py-2 rounded shadow-sm text-sm font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
                         {isAiLoading ? <Activity className="animate-spin" size={16}/> : <FileText size={16}/>}
                         AI Analysis
                    </button>
                </div>
            )}
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
             {/* CONFIGURATION SIDEBAR */}
             <div className="w-full lg:w-[350px] bg-slate-50 border-r border-slate-200 overflow-y-auto p-4 flex flex-col gap-4">
                 <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                     <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">1. Select Files & Sheets</h3>
                     <div className="space-y-3">
                         <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                                 <FileSpreadsheet size={16} className="text-blue-500 shrink-0" />
                                 <span className="text-[10px] font-bold text-slate-500 truncate" title={fileData?.name || 'File 1'}>
                                     {fileData?.name || 'File 1 (Primary Upload)'}
                                 </span>
                             </div>
                             <select className="w-full p-1.5 border rounded text-xs bg-white" value={sheet1} onChange={e => setSheet1(e.target.value)}>
                                 {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                         </div>
                         <div className="flex justify-center text-slate-300">
                             <ArrowLeftRight size={14}/>
                         </div>
                         <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                                 <FileSpreadsheet size={16} className="text-purple-500 shrink-0" />
                                 <label className="text-[10px] font-bold text-slate-500 hover:text-purple-600 cursor-pointer truncate flex-1 flex items-center justify-between">
                                     <span>{fileData2 ? fileData2.name : fileData ? `(Using ${fileData.name}) - Click to Upload File 2` : 'Upload File 2...'}</span>
                                     <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFile2Upload} />
                                 </label>
                                 {fileData2 && (
                                     <button onClick={() => { setFileData2(null); setSheet2(''); }} className="text-slate-400 hover:text-red-500 shrink-0">
                                         <XCircle size={14} />
                                     </button>
                                 )}
                             </div>
                             <select 
                                className="w-full p-1.5 border rounded text-xs bg-white" 
                                value={sheet2} 
                                onChange={e => setSheet2(e.target.value)}
                                disabled={!fileData2 && !fileData}
                             >
                                 {(fileData2 || fileData)?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                         </div>
                     </div>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                     <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">2. Row Alignment (Keys)</h3>
                     <div className="space-y-2">
                         <div>
                             <label className="text-[10px] font-semibold text-slate-500">File 1 Key</label>
                             <select className="w-full p-1.5 border rounded text-xs bg-white" value={keyCol1} onChange={e => setKeyCol1(Number(e.target.value))}>
                                 {headers1.map((h, i) => <option key={i} value={i}>{h}</option>)}
                             </select>
                         </div>
                         <div>
                             <label className="text-[10px] font-semibold text-slate-500">File 2 Key</label>
                             <select className="w-full p-1.5 border rounded text-xs bg-white" value={keyCol2} onChange={e => setKeyCol2(Number(e.target.value))}>
                                 {headers2.map((h, i) => <option key={i} value={i}>{h}</option>)}
                             </select>
                         </div>
                     </div>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex-1 flex flex-col min-h-0">
                     <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">3. Column Mapping</h3>
                     <div className="flex-1 overflow-y-auto space-y-1">
                          {headers1.map((h, i) => (
                              <div key={i} className="flex flex-col gap-1 mb-2 bg-slate-50 p-1.5 border rounded">
                                  <span className="text-[10px] font-semibold text-blue-800">{h}</span>
                                  <div className="flex items-center gap-1">
                                      <select 
                                          className="flex-1 w-full p-1 border rounded text-[10px] bg-white outline-none"
                                          value={columnMapping[i] ?? -1}
                                          onChange={e => updateMap(i, Number(e.target.value))}
                                      >
                                          <option value={-1}>-- Ignore --</option>
                                          {headers2.map((th, ti) => {
                                              const isMapped = Object.values(columnMapping).includes(ti) && columnMapping[i] !== ti;
                                              return <option key={ti} value={ti} disabled={isMapped}>{th}{isMapped ? ' (Mapped)' : ''}</option>;
                                          })}
                                      </select>
                                  </div>
                              </div>
                          ))}
                     </div>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2">
                     <h3 className="text-xs font-bold text-slate-700 uppercase mb-1">Options</h3>
                     <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input type="checkbox" checked={decimalTolerance} onChange={() => setDecimalTolerance(!decimalTolerance)} />
                        <span>Decimal Tolerance (Ignore minor math rounding)</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input type="checkbox" checked={fuzzyMatch} onChange={() => setFuzzyMatch(!fuzzyMatch)} />
                        <span>Fuzzy Match (Text similarity 85%+)</span>
                     </label>
                     
                     <button 
                         onClick={handleCompare}
                         disabled={!fileData || status === ProcessingStatus.PROCESSING}
                         className="w-full bg-slate-800 text-white font-bold mt-2 py-2.5 rounded shadow-sm hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                         {status === ProcessingStatus.PROCESSING ? <Activity className="animate-spin" size={16}/> : <Play size={16}/>}
                         Run Comparison
                     </button>
                 </div>
             </div>

             {/* RESULTS MAIN AREA */}
             <div className="flex-1 bg-white p-4 overflow-y-auto flex flex-col gap-4">
                 {results ? (
                     <>
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                             <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col items-center">
                                 <h4 className="text-xs font-bold text-slate-500 uppercase">Total Rows</h4>
                                 <span className="text-2xl font-bold text-slate-800">{results.diffs.length}</span>
                             </div>
                             <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex flex-col items-center">
                                 <h4 className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-1"><CheckCircle2 size={12}/> Perfect Matches</h4>
                                 <span className="text-2xl font-bold text-emerald-700">{results.summary.matches}</span>
                             </div>
                             <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg flex flex-col items-center">
                                 <h4 className="text-xs font-bold text-rose-600 uppercase flex items-center gap-1"><XCircle size={12}/> Mismatches</h4>
                                 <span className="text-2xl font-bold text-rose-700">{results.summary.mismatches}</span>
                             </div>
                             <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex flex-col items-center">
                                 <h4 className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1"><AlertTriangle size={12}/> Missing</h4>
                                 <span className="text-2xl font-bold text-amber-700">{results.summary.missingIn1 + results.summary.missingIn2}</span>
                             </div>
                         </div>
                         
                         {aiAnalysis && (
                             <div className="bg-orange-50 border border-orange-200 rounded-lg p-5 shadow-sm text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                                 <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2"><FileText size={18}/> Executive AI Summary</h3>
                                 {aiAnalysis}
                             </div>
                         )}

                         <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-slate-50">
                             <div className="bg-slate-100 p-2 border-b border-slate-200 text-xs font-bold text-slate-700">Detailed Report (Preview 100 rows)</div>
                             <div className="flex-1 overflow-auto">
                                 <table className="min-w-full divide-y divide-slate-200 text-xs text-left bg-white">
                                     <thead className="bg-slate-100 sticky top-0">
                                         <tr>
                                             <th className="px-3 py-2 font-bold text-slate-600">Row Key</th>
                                             <th className="px-3 py-2 font-bold text-slate-600 border-r border-slate-200">Status</th>
                                             {Object.keys(columnMapping).map(c1Idxs => {
                                                 const c1 = Number(c1Idxs);
                                                 if (columnMapping[c1] === -1) return null;
                                                 return <th key={`th_col_${c1}`} className="px-3 py-2 font-bold text-slate-600 border-r border-slate-200">{headers1[c1]}</th>
                                             })}
                                         </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                         {results.diffs.slice(0, 100).map((d, i) => (
                                             <tr key={i} className="hover:bg-slate-50">
                                                 <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{d.key}</td>
                                                 <td className="px-3 py-2 whitespace-nowrap border-r border-slate-100">
                                                     {d.status === 'match' && <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]">Match</span>}
                                                     {d.status === 'mismatch' && <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold text-[10px]">Mismatch</span>}
                                                     {d.status === 'missing_in_1' && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold text-[10px]">Missing (F1)</span>}
                                                     {d.status === 'missing_in_2' && <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold text-[10px]">Missing (F2)</span>}
                                                 </td>
                                                 
                                                 {Object.entries(columnMapping).map(([c1Str, c2]) => {
                                                     if (c2 === -1) return null;
                                                     const c1 = Number(c1Str);
                                                     const isMismatch = d.mismatchedColumns?.includes(c1);
                                                     const val1 = d.data1 ? String(d.data1[c1] ?? '') : '-';
                                                     const val2 = d.data2 ? String(d.data2[c2] ?? '') : '-';
                                                     
                                                     return (
                                                         <td key={`f_${c1Str}`} className={`px-3 py-2 max-w-[200px] border-r border-slate-100 align-top ${isMismatch ? 'bg-orange-50/30' : ''}`}>
                                                             {isMismatch ? (
                                                                 <div className="flex flex-col gap-1 text-[11px] leading-tight text-slate-600 lg:w-48 xl:w-64">
                                                                     <div className="line-through text-red-500 truncate" title={val1}>{val1}</div>
                                                                     <div className="text-emerald-600 font-bold truncate" title={val2}>{val2}</div>
                                                                 </div>
                                                             ) : (
                                                                 <div className="text-slate-600 truncate lg:w-48 xl:w-64" title={d.data1 ? val1 : val2}>{d.data1 ? val1 : val2}</div>
                                                             )}
                                                         </td>
                                                     )
                                                 })}
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                     </>
                 ) : (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400">
                         <ArrowLeftRight size={48} className="mb-4 opacity-20"/>
                         <p>Configure mapping and run comparison.</p>
                     </div>
                 )}
             </div>
        </div>
    </div>
  );
};
