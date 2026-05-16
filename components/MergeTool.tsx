import React, { useState, useEffect, useRef } from 'react';
import { FileData, ProcessingStatus } from '../types';
import { getSheetData, createWorkbook, appendSheet, saveWorkbook, readExcelFile } from '../services/excelService';
import { mergeDatasets } from '../utils/mergeUtils';
import { Layers, Combine, Download, Activity, FileSpreadsheet, XCircle, Search, FileUp, Settings2, Trash2, ArrowUp, ArrowDown, ShieldCheck, FileArchive, ListChecks, FileOutput, UploadCloud, DatabaseZap, Play } from 'lucide-react';
import JSZip from 'jszip';
import { exportToExcelSingleSheet } from '../utils/excelUtils';

interface Props {
  fileData?: FileData | null;
  addLog: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

interface ColDef {
  originalIndex: number;
  originalName: string;
  currentName: string;
  keep: boolean;
}

export const MergeTool: React.FC<Props> = ({ fileData, addLog }) => {
  const [extraFiles, setExtraFiles] = useState<FileData[]>([]);
  const allFiles = fileData ? [fileData, ...extraFiles] : extraFiles;

  const [activeTab, setActiveTab] = useState<'upload' | 'structure' | 'merge'>('upload');
  const [selectedSheets, setSelectedSheets] = useState<Record<string, string>>({});
  const [fileColumns, setFileColumns] = useState<Record<string, ColDef[]>>({});
  
  const [mergeType, setMergeType] = useState<'append' | 'join'>('append');
  const [joinType, setJoinType] = useState<'inner' | 'left' | 'outer'>('left');
  const [keyCol1, setKeyCol1] = useState<number>(0);
  const [keyCol2, setKeyCol2] = useState<number>(0);
  const [outputMode, setOutputMode] = useState<'single' | 'sheets' | 'separate'>('single');
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [mergedData, setMergedData] = useState<any[][] | {sheets: {name: string, data: any[][]}[]} | null>(null);
  const [separateZips, setSeparateZips] = useState<Blob | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected sheets
  useEffect(() => {
     const newSheets = { ...selectedSheets };
     let changed = false;
     allFiles.forEach(f => {
         if (!newSheets[f.name] && f.sheets.length > 0) {
             newSheets[f.name] = f.sheets[0];
             changed = true;
         }
     });
     if (changed) setSelectedSheets(newSheets);
  }, [allFiles]);

  // Extract columns when selected sheets change
  useEffect(() => {
      const newCols = { ...fileColumns };
      let changed = false;
      allFiles.forEach(f => {
          const sheet = selectedSheets[f.name];
          if (sheet) {
              if (!newCols[f.name]) {
                  const data = getSheetData(f.workbook, sheet, true);
                  const headers = data.length > 0 ? data[0] : [];
                  newCols[f.name] = headers.map((h: any, idx: number) => ({
                      originalIndex: idx,
                      originalName: String(h),
                      currentName: String(h),
                      keep: true
                  }));
                  changed = true;
              }
          }
      });
      if (changed) setFileColumns(newCols);
  }, [allFiles, selectedSheets]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
          try {
              addLog(`Parsing ${files[i].name}...`, 'info');
              const data = await readExcelFile(files[i]);
              setExtraFiles(prev => [...prev, data]);
              addLog(`${files[i].name} parsed successfully.`, 'success');
          } catch (err: any) {
              addLog(`Failed to parse ${files[i].name}: ${err.message}`, 'error');
          }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (name: string) => {
      setExtraFiles(prev => prev.filter(f => f.name !== name));
      setFileColumns(prev => {
          const copy = { ...prev };
          delete copy[name];
          return copy;
      });
      setSelectedSheets(prev => {
          const copy = { ...prev };
          delete copy[name];
          return copy;
      });
  };

  const moveCol = (fileName: string, index: number, direction: 'up' | 'down') => {
      setFileColumns(prev => {
          const cols = [...(prev[fileName] || [])];
          if (direction === 'up' && index > 0) {
              [cols[index - 1], cols[index]] = [cols[index], cols[index - 1]];
          } else if (direction === 'down' && index < cols.length - 1) {
              [cols[index + 1], cols[index]] = [cols[index], cols[index + 1]];
          }
          return { ...prev, [fileName]: cols };
      });
  };

  const updateCol = (fileName: string, index: number, field: keyof ColDef, value: any) => {
      setFileColumns(prev => {
          const cols = [...(prev[fileName] || [])];
          cols[index] = { ...cols[index], [field]: value };
          return { ...prev, [fileName]: cols };
      });
  };

  const getProcessedDataForFile = (fileName: string) => {
      const sheetName = selectedSheets[fileName];
      const file = allFiles.find(f => f.name === fileName);
      if (!file || !sheetName) return [];
      
      const rawData = getSheetData(file.workbook, sheetName, true);
      if (rawData.length === 0) return [];
      
      const cols = fileColumns[fileName] || [];
      const keptCols = cols.filter(c => c.keep);
      
      const newHeaders = keptCols.map(c => c.currentName);
      const outData: any[][] = [newHeaders];
      
      for (let r = 1; r < rawData.length; r++) {
           const row = [];
           for(let c = 0; c < keptCols.length; c++) {
                const origIdx = keptCols[c].originalIndex;
                row.push(rawData[r][origIdx] !== undefined ? rawData[r][origIdx] : null);
           }
           outData.push(row);
      }
      return outData;
  };

  const processExecution = async () => {
      if (allFiles.length === 0) return;
      setStatus(ProcessingStatus.PROCESSING);
      setMergedData(null);
      setSeparateZips(null);

      setTimeout(async () => {
          try {
              if (outputMode === 'separate') {
                  addLog("Processing separated files output...", 'info');
                  const zip = new JSZip();
                  
                  allFiles.forEach(f => {
                      const data = getProcessedDataForFile(f.name);
                      const extSplit = f.name.lastIndexOf('.');
                      const baseName = extSplit === -1 ? f.name : f.name.substring(0, extSplit);
                      const sheetName = selectedSheets[f.name] || 'Sheet1';
                      
                      const buffer = exportToExcelSingleSheet(data, sheetName);
                      zip.file(`Processed_${baseName}.xlsx`, buffer);
                  });
                  
                  const content = await zip.generateAsync({ type: 'blob' });
                  setSeparateZips(content);
                  addLog(`Processed ${allFiles.length} separate files successfully.`, 'success');
              } else if (outputMode === 'sheets') {
                  addLog("Processing to multiple sheets...", 'info');
                  const targetDatasets = allFiles.map(f => {
                      let sheetName = f.name;
                      const extSplit = sheetName.lastIndexOf('.');
                      if (extSplit !== -1) sheetName = sheetName.substring(0, extSplit);
                      if (sheetName.length > 31) sheetName = sheetName.substring(0, 31);
                      sheetName = sheetName.replace(/[\[\]\*\\\/\?]/g, '');
                      return {
                          name: sheetName || 'Sheet',
                          data: getProcessedDataForFile(f.name)
                      };
                  });
                  setMergedData({ sheets: targetDatasets });
                  addLog(`Successfully processed into ${targetDatasets.length} separated sheets.`, 'success');
              } else {
                  addLog("Processing merge to single file...", 'info');
                  const datasets = allFiles.map(f => getProcessedDataForFile(f.name));
                  
                  if (datasets.length === 0) throw new Error("No data found.");
                  
                  let result = datasets[0];
                  
                  if (mergeType === 'append') {
                      for (let i = 1; i < datasets.length; i++) {
                         const safeAdd = datasets[i].length > 1 ? datasets[i].slice(1) : [];
                         result = [...result, ...safeAdd];
                      }
                  } else {
                      if (datasets.length > 2) {
                           addLog("Note: Exact Match Join is only applying between the first two files.", 'warning');
                      }
                      if (datasets.length >= 2) {
                          result = mergeDatasets(datasets[0], datasets[1], keyCol1, keyCol2, joinType);
                      }
                  }
                  
                  setMergedData(result);
                  addLog(`Successfully merged. Result rows: ${result.length}`, 'success');
              }
              setStatus(ProcessingStatus.COMPLETED);
              setActiveTab('merge');
          } catch(err: any) {
              addLog(`Error: ${err.message}`, 'error');
             setStatus(ProcessingStatus.ERROR);
          }
      }, 100);
  };

  const downloadResult = () => {
       if (outputMode === 'separate' && separateZips) {
            const url = URL.createObjectURL(separateZips);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Processed_Separated_${allFiles.length}_Files.zip`;
            a.click();
            URL.revokeObjectURL(url);
       } else if (mergedData) {
            const wb = createWorkbook();
            if (Array.isArray(mergedData)) {
                appendSheet(wb, mergedData, 'Merged_Data');
            } else if ('sheets' in mergedData) {
                mergedData.sheets.forEach(sheet => {
                    appendSheet(wb, sheet.data, sheet.name);
                });
            }
            saveWorkbook(wb, `Merged_Output.xlsx`);
       }
  };

  const getStructureReport = () => {
      if (allFiles.length < 2) return { allEqual: true, report: [] };
      const baseName = allFiles[0].name;
      const baseCols = (fileColumns[baseName] || []).filter(c=>c.keep).map(c => c.currentName);
      const baseHeaders = baseCols.join('|||');
      
      const report: {file: string, baseName: string, missing: string[], extra: string[]}[] = [];
      let allEqual = true;
      for (let i = 1; i < allFiles.length; i++) {
          const fName = allFiles[i].name;
          const cols = (fileColumns[fName] || []).filter(c=>c.keep).map(c => c.currentName);
          const headers = cols.join('|||');
          if (baseHeaders !== headers) {
              allEqual = false;
              const missingInFile = baseCols.filter(c => !cols.includes(c));
              const extraInFile = cols.filter(c => !baseCols.includes(c));
              report.push({ file: fName, baseName, missing: missingInFile, extra: extraInFile });
          }
      }
      return { allEqual, report };
  };

  const exportMismatches = () => {
      const { report } = getStructureReport();
      if (report.length === 0) return;
      
      const outData: any[][] = [['File Name', 'Compared To', 'Missing Columns (in File)', 'Extra Columns (in File)']];
      report.forEach(r => {
          outData.push([r.file, r.baseName, r.missing.join(', '), r.extra.join(', ')]);
      });
      const wb = createWorkbook();
      appendSheet(wb, outData, 'Schema_Mismatches');
      saveWorkbook(wb, 'Schema_Mismatch_Report.xlsx');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[600px]">
        {/* Header Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 rounded-t-xl overflow-hidden text-sm font-bold">
            <button 
                onClick={() => setActiveTab('upload')} 
                className={`flex-1 py-4 flex items-center justify-center gap-2 ${activeTab === 'upload' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <FileUp size={16}/> 1. Files & Sheets
            </button>
            <button 
                onClick={() => setActiveTab('structure')} 
                className={`flex-1 py-4 flex items-center justify-center gap-2 ${activeTab === 'structure' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <ListChecks size={16}/> 2. Check Structure
            </button>
            <button 
                onClick={() => setActiveTab('merge')} 
                className={`flex-1 py-4 flex items-center justify-center gap-2 ${activeTab === 'merge' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <DatabaseZap size={16}/> 3. Configuration & Run
            </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50">
            {activeTab === 'upload' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">Source Files</h3>
                            <p className="text-slate-500 text-sm">Upload multiple files to merge or normalize.</p>
                        </div>
                        <label className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-lg cursor-pointer font-bold flex items-center gap-2 transition-colors">
                            <UploadCloud size={18}/> Add Files
                            <input type="file" multiple accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allFiles.map((f, i) => (
                            <div key={i} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <FileSpreadsheet className="text-emerald-500" size={18}/>
                                        <span className="font-bold truncate" title={f.name}>{f.name}</span>
                                        {i === 0 && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded uppercase border border-emerald-200">Base</span>}
                                    </div>
                                    {f.name !== fileData?.name && (
                                        <button onClick={() => removeFile(f.name)} className="text-slate-400 hover:text-red-500">
                                            <XCircle size={16}/>
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Target Sheet</label>
                                    <select 
                                        className="w-full border-slate-200 rounded p-1.5 text-sm bg-slate-50"
                                        value={selectedSheets[f.name] || ''}
                                        onChange={(e) => {
                                             setSelectedSheets(prev => ({...prev, [f.name]: e.target.value}));
                                             setFileColumns(prev => {
                                                 const c = {...prev};
                                                 delete c[f.name];
                                                 return c;
                                             });
                                        }}
                                    >
                                        {f.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        ))}
                        {allFiles.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-slate-200 border-dashed rounded-xl">
                                <FileUp size={48} className="mx-auto mb-3 opacity-20"/>
                                <p>No files selected. Add files to begin.</p>
                            </div>
                        )}
                    </div>
                    
                    {allFiles.length > 0 && (
                        <div className="flex justify-end pt-4">
                            <button onClick={()=>setActiveTab('structure')} className="bg-slate-800 text-white px-6 py-2 rounded shadow font-bold hover:bg-slate-700">Next: Check Structure →</button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'structure' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-4">
                        <ShieldCheck className="text-blue-500 w-6 h-6 shrink-0"/>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800">Structure Evaluation</h3>
                            <p className="text-sm text-slate-500 mb-2">Review and align columns across your selected files.</p>
                            {allFiles.length > 1 ? (() => {
                                const rep = getStructureReport();
                                if (rep.allEqual) {
                                    return <div className="bg-emerald-50 text-emerald-800 text-sm p-2 rounded border border-emerald-200 font-semibold inline-flex items-center gap-2">✅ All selected files have matching structures.</div>;
                                } else {
                                    return (
                                        <div className="bg-rose-50 text-rose-800 text-xs p-3 rounded border border-rose-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-bold">⚠️ Schema Mismatches Detected:</div>
                                                <button onClick={exportMismatches} className="bg-white text-rose-700 px-3 py-1 md:py-1.5 rounded-full text-xs font-bold border border-rose-200 hover:bg-rose-100 flex items-center gap-1 shadow-sm transition-colors">
                                                    <Download size={14}/> Export
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {rep.report.map((r, i) => (
                                                    <div key={i} className="bg-white p-2 rounded border border-rose-100">
                                                        <div className="font-semibold text-rose-900 border-b border-rose-100 pb-1 mb-1">{r.file} differs from {r.baseName}</div>
                                                        <div className="grid grid-cols-2 gap-2 mt-1">
                                                            <div>
                                                                <span className="text-slate-500 font-semibold text-[10px] uppercase">Missing in {r.file}:</span>
                                                                {r.missing.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {r.missing.map((m, idx) => <span key={idx} className="bg-rose-100 px-1.5 py-0.5 rounded text-[10px] text-rose-800 border border-rose-200">{m}</span>)}
                                                                    </div>
                                                                ) : <span className="text-slate-400 text-[10px] ml-1">None</span>}
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500 font-semibold text-[10px] uppercase">Extra in {r.file}:</span>
                                                                {r.extra.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {r.extra.map((e, idx) => <span key={idx} className="bg-amber-100 px-1.5 py-0.5 rounded text-[10px] text-amber-800 border border-amber-200">{e}</span>)}
                                                                    </div>
                                                                ) : <span className="text-slate-400 text-[10px] ml-1">None</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                            })() : <p className="text-xs text-slate-400">Upload multiple files to compare structure.</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                        {allFiles.map(f => {
                            const cols = fileColumns[f.name] || [];
                            return (
                                <div key={f.name} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                                    <div className="bg-slate-50 border-b border-slate-200 p-3 font-bold text-slate-700 flex justify-between items-center">
                                       <span className="truncate pr-4">{f.name}</span>
                                       <span className="bg-white text-[10px] uppercase border px-2 py-0.5 rounded text-slate-500">{selectedSheets[f.name]}</span>
                                    </div>
                                    <div className="p-0 overflow-auto max-h-[400px]">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-100 text-slate-500 text-xs sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="p-2 font-semibold text-center w-10 border-b border-slate-200">Keep</th>
                                                    <th className="p-2 font-semibold border-b border-slate-200">Original Column</th>
                                                    <th className="p-2 font-semibold border-b border-slate-200">New Column Name</th>
                                                    <th className="p-2 font-semibold border-b border-slate-200 w-16 text-center">Order</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {cols.map((col, idx) => (
                                                    <tr key={idx} className={col.keep ? '' : 'bg-slate-50 opacity-50'}>
                                                        <td className="p-2 text-center">
                                                            <input type="checkbox" checked={col.keep} onChange={(e) => updateCol(f.name, idx, 'keep', e.target.checked)} className="cursor-pointer" />
                                                        </td>
                                                        <td className="p-2 text-slate-500 break-all">{col.originalName || '(Empty)'}</td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="text" 
                                                                value={col.currentName}
                                                                onChange={(e) => updateCol(f.name, idx, 'currentName', e.target.value)}
                                                                disabled={!col.keep}
                                                                className="w-full border border-slate-200 rounded p-1 text-sm bg-white focus:border-emerald-500 disabled:bg-slate-100"
                                                            />
                                                        </td>
                                                        <td className="p-2 flex items-center justify-center gap-1">
                                                            <button 
                                                                 onClick={() => moveCol(f.name, idx, 'up')} 
                                                                 disabled={idx === 0 || !col.keep} 
                                                                 className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                                            >
                                                                <ArrowUp size={14}/>
                                                            </button>
                                                            <button 
                                                                 onClick={() => moveCol(f.name, idx, 'down')} 
                                                                 disabled={idx === cols.length - 1 || !col.keep} 
                                                                 className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                                            >
                                                                <ArrowDown size={14}/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {cols.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="text-center p-4 text-slate-400">No columns found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'merge' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-700 text-sm border-b pb-2 flex items-center gap-2">
                                <FileOutput size={16}/> Output Destination
                            </h3>
                            <div className="flex gap-4 flex-col md:flex-row">
                                <label className={`flex-1 flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${outputMode === 'single' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                    <input type="radio" name="outputMode" checked={outputMode === 'single'} onChange={() => setOutputMode('single')} className="mt-1" />
                                    <div>
                                        <div className="font-bold text-slate-800">Combine to One Sheet</div>
                                        <div className="text-xs text-slate-500 mt-1">Combine all targeted files into a single master worksheet.</div>
                                    </div>
                                </label>
                                <label className={`flex-1 flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${outputMode === 'sheets' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                    <input type="radio" name="outputMode" checked={outputMode === 'sheets'} onChange={() => setOutputMode('sheets')} className="mt-1" />
                                    <div>
                                        <div className="font-bold text-slate-800">Combine to Multiple Sheets</div>
                                        <div className="text-xs text-slate-500 mt-1">Export into one file, but keep datasets in separated sheets.</div>
                                    </div>
                                </label>
                                <label className={`flex-1 flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${outputMode === 'separate' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                                    <input type="radio" name="outputMode" checked={outputMode === 'separate'} onChange={() => setOutputMode('separate')} className="mt-1" />
                                    <div>
                                        <div className="font-bold text-slate-800">Keep Separated (ZIP)</div>
                                        <div className="text-xs text-slate-500 mt-1">Apply structure transformations but export as separate files in a zip.</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {outputMode === 'single' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-bold text-slate-700 text-sm border-b pb-2 flex items-center gap-2">
                                    <DatabaseZap size={16}/> Compilation Logic
                                </h3>
                                <div className="flex gap-2">
                                    <button 
                                        className={`flex-1 py-2 text-sm font-bold rounded shadow-sm border ${mergeType === 'append' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                        onClick={() => setMergeType('append')}
                                    >
                                        Append Rows (Stack)
                                    </button>
                                    <button 
                                        className={`flex-1 py-2 text-sm font-bold rounded shadow-sm border ${mergeType === 'join' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                        onClick={() => setMergeType('join')}
                                        disabled={allFiles.length > 2}
                                        title={allFiles.length > 2 ? 'Only available for exactly two files' : ''}
                                    >
                                        Exact Match (Join 2 Files)
                                    </button>
                                </div>
                                {mergeType === 'join' && allFiles.length > 2 && (
                                    <div className="text-xs text-amber-600 italic">Join is supported for exactly 2 files. (You have {allFiles.length} files selected).</div>
                                )}
                                
                                {mergeType === 'join' && allFiles.length === 2 && (
                                    <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Primary Key ({allFiles[0].name})</label>
                                            <select className="w-full p-2 border border-slate-300 rounded text-sm" value={keyCol1} onChange={e => setKeyCol1(Number(e.target.value))}>
                                                {(fileColumns[allFiles[0].name]||[]).filter(c=>c.keep).map((h, i) => <option key={i} value={i}>{h.currentName}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Primary Key ({allFiles[1].name})</label>
                                            <select className="w-full p-2 border border-slate-300 rounded text-sm" value={keyCol2} onChange={e => setKeyCol2(Number(e.target.value))}>
                                                {(fileColumns[allFiles[1].name]||[]).filter(c=>c.keep).map((h, i) => <option key={i} value={i}>{h.currentName}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-full">
                                            <label className="block text-xs font-bold text-slate-600 mb-1">Algorithm</label>
                                            <select className="w-full p-2 border border-slate-300 rounded text-sm" value={joinType} onChange={e => setJoinType(e.target.value as any)}>
                                                <option value="left">Left Join</option>
                                                <option value="inner">Inner Join</option>
                                                <option value="outer">Outer Join</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-200">
                             <button 
                                onClick={processExecution}
                                disabled={allFiles.length === 0 || status === ProcessingStatus.PROCESSING}
                                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-lg shadow hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 text-lg transition-colors"
                            >
                                {status === ProcessingStatus.PROCESSING ? <Activity className="animate-spin"/> : <Play/>}
                                {outputMode === 'single' ? 'Generate Unified Dataset' : 'Process Separated Datasets'}
                            </button>
                        </div>
                    </div>

                    {(mergedData || separateZips) && (
                        <div className="bg-white border justify-center border-slate-200 rounded-lg p-6 shadow-sm text-center space-y-4">
                            <div className="inline-flex items-center justify-center bg-emerald-100 text-emerald-800 p-4 rounded-full">
                                <ShieldCheck size={32}/>
                            </div>
                            <div>
                                <h3 className="font-bold text-xl text-slate-800">Processing Complete</h3>
                                {outputMode === 'single' && mergedData && (
                                    <p className="text-slate-500">Unified dataset ready: {mergedData.length} records processed.</p>
                                )}
                                {outputMode === 'separate' && separateZips && (
                                    <p className="text-slate-500">Processed zip package ready.</p>
                                )}
                            </div>
                            <button 
                                onClick={downloadResult}
                                className="bg-slate-800 text-white px-8 py-3 rounded-lg shadow-sm text-sm font-bold hover:bg-slate-700 flex items-center justify-center gap-2 mx-auto"
                            >
                                <Download size={18}/> 
                                Download Output File
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};
