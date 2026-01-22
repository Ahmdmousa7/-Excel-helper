
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style'; 
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  Fingerprint, ArrowRightLeft, Key, Activity, CheckCircle, 
  Download, Filter, Grid, LayoutList, PieChart, BarChart3, 
  Calendar, Percent, ScanSearch, Wand2, ArrowRight, Split, 
  ShieldAlert, Trash2, Check, Crown, Info, Zap, X, GitMerge, ScanLine, ChevronDown, RefreshCw, Copy, Layers
} from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface ProcessedRow {
  _originalIdx: number;
  _id: string; 
  _clusterId: string | null; 
  _isMaster: boolean; 
  _status: 'Unique' | 'Duplicate' | 'Master' | 'Match (Duplicate)' | 'Missing in Target';
  _validationIssues: string[]; 
  data: any[]; 
}

const normalizeValue = (val: any, smartNum: boolean): string => {
  if (val === null || val === undefined) return "";
  
  let str = String(val).trim();

  // 1. Handle actual Number type (prevent JS scientific notation like 1e+21)
  if (typeof val === 'number') {
      // Convert to string without scientific notation
      str = val.toLocaleString('fullwide', { useGrouping: false });
  } 
  // 2. Handle String that looks like Scientific Notation (e.g. "1.23E+10" from Excel CSV)
  else if (smartNum && /^[0-9]+(\.[0-9]+)?[eE][+-]?[0-9]+$/.test(str)) {
      try {
          const num = Number(str);
          if (!isNaN(num)) {
              str = num.toLocaleString('fullwide', { useGrouping: false });
          }
      } catch (e) {
          // Keep original string if parsing fails
      }
  }

  // 3. General Cleanup
  if (typeof val === 'string') {
      str = str.replace(/\u00A0/g, ' ').trim();
  }
  
  if (str === "") return "";

  // 4. Smart Number Equivalence (1.0 == 1)
  if (smartNum) {
      const num = Number(str);
      if (!isNaN(num)) {
           return String(num); // "1.00" becomes "1"
      }
  }
  
  return str.toLowerCase();
};

type Mode = 'self' | 'cross_dup' | 'cross_diff';
type ViewFilter = 'all' | 'duplicates' | 'unique';

const DuplicatesTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  // --- STATE ---
  const [mode, setMode] = useState<Mode>('self'); 
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [targetSheet, setTargetSheet] = useState<string>(''); 
  
  const [headers, setHeaders] = useState<string[]>([]);
  const [targetHeaders, setTargetHeaders] = useState<string[]>([]); 
  
  const [selectedCols, setSelectedCols] = useState<number[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, number>>({});
  const [resolveCol, setResolveCol] = useState<number>(0); 
  
  const [smartNumberMatch, setSmartNumberMatch] = useState<boolean>(true);
  const [checkFullRow, setCheckFullRow] = useState<boolean>(false);
  
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isAnalysed, setIsAnalysed] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      if (!selectedSheet) setSelectedSheet(fileData.sheets[0]);
      if (fileData.sheets.length > 1) setTargetSheet(fileData.sheets[1]);
      else setTargetSheet(fileData.sheets[0]); 
    }
  }, [fileData]);

  const loadSheetData = () => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, true); // Raw=true is important for numbers
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
        const initRows = data.slice(1).map((row, idx) => ({
            _originalIdx: idx,
            _id: `row_${idx}`,
            _clusterId: null,
            _isMaster: false,
            _status: 'Unique' as const,
            _validationIssues: [],
            data: row
        }));
        setRows(initRows);
        setStats(null);
        setIsAnalysed(false);
      }
    }
  };

  useEffect(() => {
    loadSheetData();
  }, [fileData, selectedSheet]);

  // Load Target Headers for Cross Modes
  useEffect(() => {
      if ((mode === 'cross_dup' || mode === 'cross_diff') && fileData && targetSheet) {
          const tData = getSheetData(fileData.workbook, targetSheet, true);
          if (tData.length > 0) {
              const tHeads = tData[0] as string[];
              setTargetHeaders(tHeads);
              
              // Smart Auto-Mapping
              const newMap: Record<number, number> = {};
              headers.forEach((h, sIdx) => {
                  if (selectedCols.includes(sIdx)) {
                      const tIdx = tHeads.findIndex(th => th && h && th.toLowerCase().trim() === h.toLowerCase().trim());
                      if (tIdx !== -1) newMap[sIdx] = tIdx;
                  }
              });
              setColumnMapping(prev => ({ ...prev, ...newMap }));
          }
      }
  }, [fileData, targetSheet, mode, headers, selectedCols]);

  const handleSelectCol = (idx: number) => {
      setSelectedCols(prev => {
          const newCols = prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx];
          return newCols;
      });
  };

  const handleUpdateMapping = (sourceIdx: number, targetIdx: number) => {
      setColumnMapping(prev => ({ ...prev, [sourceIdx]: targetIdx }));
  };

  const handleSwapSheets = () => {
      const temp = selectedSheet;
      setSelectedSheet(targetSheet);
      setTargetSheet(temp);
      setColumnMapping({});
      setIsAnalysed(false);
  };

  // --- ANALYSIS ENGINE ---
  const analyzeRowsLogic = (inputRows: ProcessedRow[]) => {
      const newRows = inputRows.map(r => ({ ...r, data: [...r.data] }));
      const chartsData: any = { frequency: [], uniqueness: [], timeline: [], venn: null };
      
      // Calculate Column Uniqueness
      const uniquenessData: {colName: string, score: number}[] = [];
      selectedCols.forEach(cIdx => {
          const seen = new Set();
          let nonEmptyCount = 0;
          newRows.forEach(r => {
              const val = r.data[cIdx];
              if (val !== undefined && val !== null && String(val).trim() !== "") {
                  nonEmptyCount++;
                  seen.add(String(val).toLowerCase());
              }
          });
          const score = nonEmptyCount > 0 ? Math.round((seen.size / nonEmptyCount) * 100) : 0;
          uniquenessData.push({ colName: headers[cIdx], score });
      });
      chartsData.uniqueness = uniquenessData;

      // MODE 1: SINGLE SHEET CHECK
      if (mode === 'self') {
          const groups = new Map<string, string[]>(); 

          newRows.forEach(row => {
              let key = "";
              if (checkFullRow) {
                 key = row.data.map(c => normalizeValue(c, smartNumberMatch)).join("|||");
              } else {
                 key = selectedCols.map(c => normalizeValue(row.data[c], smartNumberMatch)).join("|||");
              }
              if (!key.replace(/\|\|\|/g, "")) return; 
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(row._id);
          });

          let duplicateCount = 0;
          let clusterCount = 0;
          const freqMap: {value: string, count: number}[] = [];

          groups.forEach((ids, key) => {
              if (ids.length > 1) {
                  freqMap.push({ value: key.split('|||').join(', ').substring(0, 30), count: ids.length });
                  clusterCount++;
              }
          });
          chartsData.frequency = freqMap.sort((a,b) => b.count - a.count).slice(0, 10);

          newRows.forEach(row => {
              let key = "";
              if (checkFullRow) {
                 key = row.data.map(c => normalizeValue(c, smartNumberMatch)).join("|||");
              } else {
                 key = selectedCols.map(c => normalizeValue(row.data[c], smartNumberMatch)).join("|||");
              }
              const groupIds = groups.get(key);

              if (groupIds && groupIds.length > 1) {
                  row._clusterId = key;
                  if (groupIds[0] === row._id) {
                      row._status = 'Master';
                      row._isMaster = true;
                  } else {
                      row._status = 'Duplicate';
                      row._isMaster = false;
                      duplicateCount++;
                  }
              } else {
                  row._clusterId = null;
                  row._status = 'Unique';
                  row._isMaster = false;
              }
          });

          return {
              rows: newRows,
              stats: {
                  totalRows: newRows.length,
                  duplicateRows: duplicateCount,
                  clusters: clusterCount, 
                  redundancyRate: Math.round((duplicateCount / newRows.length) * 100),
                  qualityScore: Math.round(Math.max(0, 100 - (duplicateCount / newRows.length * 100))),
                  charts: chartsData
              }
          };
      } 
      // MODE 2 & 3: CROSS SHEET (Duplicates or Missing)
      else {
          if (!fileData || !targetSheet) return { rows: inputRows, stats: null };
          
          const targetData = getSheetData(fileData.workbook, targetSheet, true).slice(1);
          const refSet = new Set<string>();
          
          targetData.forEach(tRow => {
              const keyParts: string[] = [];
              let isValidKey = false;
              selectedCols.forEach(sIdx => {
                  const tIdx = columnMapping[sIdx];
                  if (tIdx !== undefined && tIdx !== -1) {
                      const val = normalizeValue(tRow[tIdx], smartNumberMatch);
                      keyParts.push(val);
                      if (val) isValidKey = true;
                  } else {
                      keyParts.push(""); 
                  }
              });
              if (isValidKey) refSet.add(keyParts.join("|||"));
          });

          let foundCount = 0;
          let missingCount = 0;

          newRows.forEach(row => {
              const keyParts: string[] = [];
              let isValidKey = false;
              selectedCols.forEach(sIdx => {
                  const val = normalizeValue(row.data[sIdx], smartNumberMatch);
                  keyParts.push(val);
                  if (val) isValidKey = true;
              });
              const fullKey = keyParts.join("|||");

              if (isValidKey) {
                  if (refSet.has(fullKey)) {
                      row._status = 'Match (Duplicate)'; // Exists in Target
                      row._clusterId = fullKey;
                      foundCount++;
                  } else {
                      row._status = 'Missing in Target'; 
                      row._clusterId = null;
                      missingCount++;
                  }
              } else {
                  row._status = 'Unique';
              }
          });

          chartsData.venn = {
              sourceUnique: missingCount,
              intersection: foundCount,
              targetUnique: Math.max(0, targetData.length - foundCount) 
          };

          return {
              rows: newRows,
              stats: {
                  totalRows: newRows.length,
                  duplicateRows: foundCount, // 'Duplicates' here means Matches
                  missingRows: missingCount,
                  clusters: foundCount, 
                  redundancyRate: Math.round((foundCount / newRows.length) * 100),
                  qualityScore: 100, 
                  charts: chartsData
              }
          };
      }
  };

  const runAnalysis = () => {
      if (selectedCols.length === 0 && !checkFullRow) return;
      setStatus(ProcessingStatus.PROCESSING);
      
      // Auto-set view filter based on mode to be helpful
      if (mode === 'cross_dup') setViewFilter('duplicates');
      else if (mode === 'cross_diff') setViewFilter('unique');
      else setViewFilter('all');

      setTimeout(() => {
          const result = analyzeRowsLogic(rows);
          if (result.stats) {
              setRows(result.rows);
              setStats(result.stats);
              setIsAnalysed(true);
          }
          setStatus(ProcessingStatus.IDLE);
      }, 50);
  };

  const handleAutoResolve = () => {
      // Determine target column for resolution
      const targetColIdx = resolveCol >= 0 ? resolveCol : (selectedCols.length > 0 ? selectedCols[0] : 0);
      
      const currentRows = rows.map(r => ({ ...r, data: [...r.data] }));
      let resolvedCount = 0;

      if (mode === 'self') {
          // Self Mode: Keep 1 Master, Fix Duplicates (A, A -> A, A-1)
          const clustersMap = new Map<string, ProcessedRow[]>();
          currentRows.forEach(r => {
              if (r._clusterId && (r._status === 'Duplicate' || r._status === 'Master')) {
                  if (!clustersMap.has(r._clusterId)) clustersMap.set(r._clusterId, []);
                  clustersMap.get(r._clusterId)!.push(r);
              }
          });

          clustersMap.forEach((clusterRows) => {
              const master = clusterRows.find(r => r._isMaster) || clusterRows[0];
              let counter = 1;
              clusterRows.forEach(r => {
                  if (r._id !== master._id) { // Don't touch master
                      const originalVal = String(r.data[targetColIdx]);
                      r.data[targetColIdx] = `${originalVal}-${counter}`;
                      counter++;
                      resolvedCount++;
                  }
              });
          });
      } else {
          // Cross Mode: Fix Matches (A matches Target A -> A becomes A-1)
          // We use this to prevent collisions when merging
          const keyCounters = new Map<string, number>();

          currentRows.forEach(r => {
              if (r._status === 'Match (Duplicate)') {
                  const key = r._clusterId || String(r.data[targetColIdx]);
                  const count = (keyCounters.get(key) || 0) + 1;
                  keyCounters.set(key, count);

                  const originalVal = String(r.data[targetColIdx]);
                  r.data[targetColIdx] = `${originalVal}-${count}`;
                  resolvedCount++;
              }
          });
      }

      // Re-run analysis to show updated status
      const result = analyzeRowsLogic(currentRows);
      setRows(result.rows);
      setStats(result.stats);
      
      addLog(`Resolved ${resolvedCount} entries by appending suffix to '${headers[targetColIdx]}'.`, 'success');
  };

  const filteredRows = useMemo(() => {
      return rows.filter(r => {
          // VIEW FILTER LOGIC
          if (viewFilter === 'duplicates') {
              // Show: Duplicate, Master (Self) OR Match (Cross)
              if (mode === 'self') {
                  if (r._status !== 'Duplicate' && r._status !== 'Master') return false;
              } else {
                  // In Cross modes, "Duplicates" means "Matches found in target"
                  if (r._status !== 'Match (Duplicate)') return false;
              }
          } else if (viewFilter === 'unique') {
              // Show: Unique (Self) OR Missing/Unique (Cross)
              if (mode === 'self') {
                  if (r._status !== 'Unique') return false;
              } else {
                  if (r._status !== 'Missing in Target' && r._status !== 'Unique') return false;
              }
          }
          
          if (searchTerm) {
              const rowStr = r.data.join(" ").toLowerCase();
              if (!rowStr.includes(searchTerm.toLowerCase())) return false;
          }
          return true;
      });
  }, [rows, searchTerm, mode, viewFilter]);

  const handleExport = () => {
      if (!fileData) return;
      const wb = XLSX_STYLE.utils.book_new();
      const exportHeader = [...headers, "Analysis Status", "Match Key"];
      const exportData = [exportHeader];
      
      const redStyle = { fill: { fgColor: { rgb: "FFCCCC" } }, font: { color: { rgb: "9C0006" } } }; 
      const greenStyle = { fill: { fgColor: { rgb: "CCFFCC" } }, font: { color: { rgb: "006100" } } }; 
      const yellowStyle = { fill: { fgColor: { rgb: "FFFFCC" } }, font: { color: { rgb: "9C6500" } } }; 
      const blueStyle = { fill: { fgColor: { rgb: "E6F3FF" } }, font: { color: { rgb: "0000FF" } } }; 

      rows.forEach(r => {
          const rowData = [...r.data, r._status, r._clusterId || ""];
          exportData.push(rowData);
      });

      const ws = XLSX_STYLE.utils.aoa_to_sheet(exportData);
      const range = XLSX_STYLE.utils.decode_range(ws['!ref'] || "A1");
      
      // Fix Scientific Notation in Export: Force String format for ID-like columns
      for (let R = 1; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
              const ref = XLSX_STYLE.utils.encode_cell({r: R, c: C});
              if (!ws[ref]) continue;
              if (ws[ref].t === 'n' && String(ws[ref].v).length > 10) {
                  ws[ref].t = 's'; // Force string
                  ws[ref].z = '@'; // Text format
                  ws[ref].v = String(ws[ref].v);
              }
          }
      }

      // Apply color styles
      for (let R = 1; R <= range.e.r; ++R) { 
          const statusVal = exportData[R][exportHeader.length - 2]; 
          let styleToApply = null;
          if (statusVal === 'Duplicate') styleToApply = redStyle;
          else if (statusVal === 'Match (Duplicate)') styleToApply = redStyle;
          else if (statusVal === 'Master') styleToApply = yellowStyle;
          else if (statusVal === 'Missing in Target') styleToApply = blueStyle;

          if (styleToApply) {
              for (let C = range.s.c; C <= range.e.c; ++C) {
                  const cellRef = XLSX_STYLE.utils.encode_cell({ r: R, c: C });
                  if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" }; 
                  ws[cellRef].s = styleToApply;
              }
          }
      }

      // Header Style
      for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX_STYLE.utils.encode_cell({ r: 0, c: C });
          if (!ws[cellRef]) continue;
          ws[cellRef].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4472C4" } } };
      }

      ws['!cols'] = exportHeader.map(() => ({ wch: 15 }));
      XLSX_STYLE.utils.book_append_sheet(wb, ws, "Analysis Results");
      XLSX_STYLE.writeFile(wb, `Checked_${fileData.name}`);
      addLog("Export complete with styling.", 'success');
  };

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col relative">
      {/* 1. TOP BAR */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-3 shrink-0 z-20">
          {/* TAB SWITCHER */}
          <div className="flex border-b border-slate-100 mb-2">
             <button 
                onClick={() => { setMode('self'); setIsAnalysed(false); setSelectedCols([]); }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${mode === 'self' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
             >
                <Fingerprint size={16}/> Find Internal Duplicates
             </button>
             <button 
                onClick={() => { setMode('cross_dup'); setIsAnalysed(false); setSelectedCols([]); }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${mode === 'cross_dup' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
             >
                <GitMerge size={16}/> Find Matches (Duplicates)
             </button>
             <button 
                onClick={() => { setMode('cross_diff'); setIsAnalysed(false); setSelectedCols([]); }}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${mode === 'cross_diff' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
             >
                <ArrowRightLeft size={16}/> Compare (Find Missing)
             </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
              {/* CONFIG FOR FIND DUPLICATES (INTERNAL) */}
              {mode === 'self' && (
                  <>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Sheet:</span>
                        <select 
                            className="p-1.5 border rounded text-xs bg-slate-50 max-w-[150px]"
                            value={selectedSheet}
                            onChange={(e) => { setSelectedSheet(e.target.value); setSelectedCols([]); setIsAnalysed(false); }}
                        >
                            {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    
                    <div className="relative group">
                        <button className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded border ${checkFullRow ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-blue-600 border-blue-200'}`} disabled={checkFullRow}>
                            <Key size={14}/> {selectedCols.length === 0 ? "Select Columns" : `${selectedCols.length} Selected`} <ChevronDown size={12}/>
                        </button>
                        {!checkFullRow && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border shadow-xl rounded-lg p-2 hidden group-hover:block z-50 max-h-80 overflow-y-auto">
                                {headers.map((h, i) => (
                                    <label key={i} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 text-xs cursor-pointer">
                                        <input type="checkbox" checked={selectedCols.includes(i)} onChange={() => handleSelectCol(i)} className="rounded text-blue-600"/>
                                        <span className="truncate">{h || `Col ${i+1}`}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium px-2 py-1.5 rounded border hover:bg-slate-50">
                        <input type="checkbox" checked={checkFullRow} onChange={e => setCheckFullRow(e.target.checked)} className="rounded text-indigo-600"/>
                        <ScanLine size={14}/> Full Row
                    </label>
                  </>
              )}

              {/* CONFIG FOR CROSS SHEET MODES */}
              {(mode === 'cross_dup' || mode === 'cross_diff') && (
                  <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 bg-blue-50 p-1.5 rounded border border-blue-100">
                              <span className="text-[10px] font-bold text-blue-600 uppercase">Source</span>
                              <select className="p-1 border rounded text-xs" value={selectedSheet} onChange={(e) => { setSelectedSheet(e.target.value); setSelectedCols([]); setIsAnalysed(false); }}>
                                  {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                          </div>
                          
                          <button onClick={handleSwapSheets} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                              <ArrowRightLeft size={14}/>
                          </button>

                          <div className="flex items-center gap-2 bg-purple-50 p-1.5 rounded border border-purple-100">
                              <span className="text-[10px] font-bold text-purple-600 uppercase">Target</span>
                              <select className="p-1 border rounded text-xs" value={targetSheet} onChange={(e) => { setTargetSheet(e.target.value); setIsAnalysed(false); }}>
                                  {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                          </div>
                          
                          {selectedSheet === targetSheet && (
                              <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 font-bold">
                                  Same Sheet Comparison
                              </div>
                          )}
                      </div>

                      <div className="flex flex-wrap gap-2 items-start">
                          <div className="relative group">
                                <button className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded border bg-white text-slate-700 hover:border-purple-400">
                                    <Split size={14} className="text-purple-500"/>
                                    {selectedCols.length === 0 ? "Map Columns" : `${selectedCols.length} Mapped`}
                                </button>
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 shadow-xl rounded-lg p-2 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-2 max-h-80 overflow-y-auto">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-2 px-1">Select Source Columns to Match:</div>
                                    <div className="space-y-1">
                                        {headers.map((h, i) => (
                                            <label key={i} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-purple-50 text-xs ${selectedCols.includes(i) ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-600'}`}>
                                                <input type="checkbox" checked={selectedCols.includes(i)} onChange={() => handleSelectCol(i)} className="rounded text-purple-600"/>
                                                <span className="truncate">{h || `Col ${i+1}`}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                          </div>

                          {selectedCols.map((sIdx) => (
                              <div key={sIdx} className="flex items-center gap-1 bg-purple-50 border border-purple-100 rounded px-2 py-1 shadow-sm">
                                  <span className="text-[10px] font-bold text-slate-600 max-w-[80px] truncate">{headers[sIdx]}</span>
                                  <ArrowRight size={10} className="text-purple-400"/>
                                  <select 
                                      className="text-[10px] p-0.5 border rounded bg-white outline-none max-w-[100px]"
                                      value={columnMapping[sIdx] ?? -1}
                                      onChange={(e) => handleUpdateMapping(sIdx, Number(e.target.value))}
                                  >
                                      <option value="-1">Select...</option>
                                      {targetHeaders.map((th, ti) => <option key={ti} value={ti}>{th}</option>)}
                                  </select>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600 ml-auto">
                  <input type="checkbox" checked={smartNumberMatch} onChange={e => setSmartNumberMatch(e.target.checked)} className="rounded text-blue-600"/>
                  Smart Numbers (1.0 = 1)
              </label>

              {!isAnalysed ? (
                  <button 
                      onClick={runAnalysis}
                      disabled={status === ProcessingStatus.PROCESSING}
                      className="bg-blue-600 text-white px-6 py-1.5 rounded text-sm font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2"
                  >
                      {status === ProcessingStatus.PROCESSING ? <Activity className="animate-spin" size={16}/> : <Activity size={16}/>} 
                      {mode === 'self' ? 'Analyze' : 'Compare'}
                  </button>
              ) : (
                  <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-bold flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-200"><CheckCircle size={12}/> Done</span>
                      
                      {/* AUTO-RESOLVE BUTTON (Visible in Self and Cross-Dup modes) */}
                      {(mode === 'self' || mode === 'cross_dup') && stats && stats.duplicateRows > 0 && (
                          <div className="flex items-center gap-2 bg-purple-50 px-2 py-1 rounded border border-purple-100 animate-in fade-in">
                              <span className="text-[10px] font-bold text-purple-700 uppercase">Fix:</span>
                              <select 
                                  className="text-xs p-1 border rounded bg-white text-slate-700 outline-none max-w-[100px]"
                                  value={resolveCol}
                                  onChange={(e) => setResolveCol(Number(e.target.value))}
                              >
                                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                              </select>
                              <button 
                                onClick={handleAutoResolve} 
                                className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-purple-700 flex items-center gap-1 shadow-sm"
                                title={mode === 'cross_dup' ? "Append -1, -2 to source items that match target to make them unique" : "Append -1, -2 to duplicates"}
                              >
                                  <Wand2 size={12}/> Resolve
                              </button>
                          </div>
                      )}

                      <button onClick={handleExport} className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-green-700 flex items-center gap-2 shadow-sm">
                          <Download size={14}/> Export
                      </button>
                  </div>
              )}
          </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 flex gap-4 min-h-0">
          {/* LEFT: DASHBOARD */}
          <div className="w-64 flex flex-col gap-4 shrink-0 overflow-y-auto">
              {stats ? (
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-center">
                      <div className="relative w-24 h-24 mx-auto mb-3 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                              <circle cx="48" cy="48" r="40" stroke="#e2e8f0" strokeWidth="8" fill="none"/>
                              <circle 
                                cx="48" cy="48" r="40" 
                                stroke={mode === 'cross_diff' ? "#d97706" : (mode === 'cross_dup' ? "#9333ea" : "#ef4444")} 
                                strokeWidth="8" fill="none" 
                                strokeDasharray="251" 
                                strokeDashoffset={251 - (251 * (mode === 'cross_diff' ? (stats.missingRows/stats.totalRows)*100 : (mode === 'cross_dup' ? (stats.duplicateRows/stats.totalRows)*100 : stats.redundancyRate)) / 100)} 
                                className="transition-all duration-1000"
                              />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                              <span className="text-xl font-bold text-slate-700">
                                  {mode === 'cross_diff' ? stats.missingRows : stats.duplicateRows}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase">
                                  {mode === 'cross_diff' ? 'Missing' : (mode === 'cross_dup' ? 'Matches' : 'Duplicates')}
                              </span>
                          </div>
                      </div>
                      <div className="text-xs text-slate-500 mb-4">{stats.totalRows} Total Rows</div>
                      
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-left">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">View Filters</h4>
                          <div className="relative mb-2">
                              <ScanSearch size={12} className="absolute left-2 top-2 text-slate-400"/>
                              <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-6 p-1.5 text-xs border rounded"/>
                          </div>
                          
                          {/* NEW EXPLICIT FILTER CONTROLS */}
                          <div className="flex flex-col gap-2 mt-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Show Rows:</span>
                              <div className="flex bg-slate-200 rounded p-1">
                                  <button onClick={() => setViewFilter('all')} className={`flex-1 text-xs py-1 rounded transition-colors ${viewFilter === 'all' ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>All</button>
                                  <button onClick={() => setViewFilter('duplicates')} className={`flex-1 text-xs py-1 rounded transition-colors ${viewFilter === 'duplicates' ? 'bg-white shadow text-red-500 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
                                      {mode === 'cross_diff' ? 'Match' : 'Dupes'}
                                  </button>
                                  <button onClick={() => setViewFilter('unique')} className={`flex-1 text-xs py-1 rounded transition-colors ${viewFilter === 'unique' ? 'bg-white shadow text-green-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
                                      {mode === 'cross_diff' ? 'Missing' : 'Unique'}
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 flex-1 flex flex-col items-center justify-center">
                      <Activity size={32} className="mb-2 opacity-50"/>
                      <p className="text-xs">Select columns and click Analyze.</p>
                  </div>
              )}
          </div>

          {/* RIGHT: DATA TABLE */}
          <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto bg-slate-50">
                  {isAnalysed ? (
                      <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                              <tr>
                                  <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 uppercase w-28">Status</th>
                                  {headers.map((h, i) => (
                                      <th key={i} className={`px-3 py-2 text-left text-xs font-bold uppercase min-w-[120px] ${selectedCols.includes(i) ? 'text-blue-700 bg-blue-50' : 'text-slate-500'}`}>{h}</th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100">
                              {filteredRows.slice(0, 500).map((row) => (
                                  <tr key={row._id} className="hover:bg-slate-50">
                                      <td className="px-2 py-2 text-center">
                                          {row._status === 'Duplicate' && <span className="text-red-500 text-[10px] font-bold border border-red-200 bg-red-50 px-2 py-0.5 rounded-full">Dupe</span>}
                                          {row._status === 'Match (Duplicate)' && <span className="text-purple-600 text-[10px] font-bold border border-purple-200 bg-purple-50 px-2 py-0.5 rounded-full">Match</span>}
                                          {row._status === 'Missing in Target' && <span className="text-amber-600 text-[10px] font-bold border border-amber-200 bg-amber-50 px-2 py-0.5 rounded-full">Missing</span>}
                                          {row._status === 'Unique' && mode === 'self' && <span className="text-slate-400 text-[10px]">Unique</span>}
                                          {row._status === 'Master' && <span className="text-green-600 text-[10px] font-bold">Master</span>}
                                      </td>
                                      {row.data.map((cell, cIdx) => (
                                          <td key={cIdx} className="px-3 py-2 text-xs text-slate-600 border-r border-transparent truncate max-w-[200px]" title={String(cell)}>
                                              {String(cell)}
                                          </td>
                                      ))}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">Ready to analyze.</div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default DuplicatesTab;
