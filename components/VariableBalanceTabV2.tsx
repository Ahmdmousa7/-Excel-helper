
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Network, ArrowRight, Eraser, CheckSquare, Layers, Tag, Type, Grid3X3, Search, AlertCircle, CheckCircle2, LayoutGrid, X, Ban, BarChart3, TrendingUp, Edit, Save, Wand2, MousePointerClick, TableProperties, Sparkles } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface VisualGroup {
  key: string;
  status: 'Balanced' | 'Unbalanced';
  dimensions: { name: string, values: string[] }[];
  hits: Set<string>; 
  missingCount: number;
  missingValues: string[];
}

interface GlobalStats {
  totalProducts: number;
  balancedCount: number;
  unbalancedCount: number;
  missingFrequency: { name: string, count: number }[];
}

interface CellEdit {
    price: string;
    qty: string;
}

// Helper for Auto-Cluster
const levenshteinDistance = (a: string, b: string) => {
    if(a.length === 0) return b.length; 
    if(b.length === 0) return a.length; 
    const matrix = []; 
    for(let i = 0; i <= b.length; i++) matrix[i] = [i]; 
    for(let j = 0; j <= a.length; j++) matrix[0][j] = j; 
    for(let i = 1; i <= b.length; i++) { 
        for(let j = 1; j <= a.length; j++) { 
            if(b.charAt(i-1) == a.charAt(j-1)) matrix[i][j] = matrix[i-1][j-1]; 
            else matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1)); 
        } 
    } 
    return matrix[b.length][a.length]; 
};

const VariableBalanceTabV2: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]); // Manage rows in state for auto-cluster injection
  
  const [groupCol, setGroupCol] = useState<number>(-1);
  const [optionCols, setOptionCols] = useState<number[]>([]);
  const [clearCols, setClearCols] = useState<number[]>([]);
  
  const [catCol, setCatCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);
  const [skuCol, setSkuCol] = useState<number>(-1); // Specifically for Pattern Builder

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  const [visualResults, setVisualResults] = useState<VisualGroup[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  
  const [selectedVisualGroup, setSelectedVisualGroup] = useState<VisualGroup | null>(null);
  const [visualFilter, setVisualFilter] = useState<'All' | 'Unbalanced'>('Unbalanced');
  const [visualSearch, setVisualSearch] = useState<string>('');
  
  // --- ENHANCEMENT 1: SMART PATTERNS ---
  const [showPatterns, setShowPatterns] = useState(false);
  const [namePattern, setNamePattern] = useState("{Name} - {Option1} {Option2}");
  const [skuPattern, setSkuPattern] = useState("{Sku}-{Option1}-{Option2}");

  // --- ENHANCEMENT 2: MATRIX BULK ACTIONS ---
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const [cellEdits, setCellEdits] = useState<Map<string, CellEdit>>(new Map());
  const [bulkSelection, setBulkSelection] = useState<string[]>([]); // Array of uniqueIds
  
  // --- ENHANCEMENT 3: AUTO CLUSTER ---
  const [isAutoClustered, setIsAutoClustered] = useState(false);

  // Context Menu & Modal State
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, key: string} | null>(null);
  const [editModal, setEditModal] = useState<{isOpen: boolean, key: string, price: string, qty: string} | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      if (!selectedSheet) setSelectedSheet(fileData.sheets[0]);
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, false);
      if (data.length > 0) {
        const head = data[0] as string[];
        setHeaders(head);
        setRows(data.slice(1));
        setGroupCol(-1);
        setOptionCols([]);
        setIsAutoClustered(false);
        
        const idKeywords = ['id', 'sku', 'barcode', 'code', 'ref'];
        const nameKeywords = ['name', 'title', 'product'];
        
        const autoClearIndices: number[] = [];
        head.forEach((h, i) => {
            const hLow = String(h).toLowerCase();
            if (h && idKeywords.some(k => hLow.includes(k))) {
                autoClearIndices.push(i);
                if (hLow.includes('sku') && skuCol === -1) setSkuCol(i);
            }
            if (h && nameKeywords.some(k => hLow.includes(k)) && nameCol === -1) setNameCol(i);
        });
        setClearCols(autoClearIndices);

        setCatCol(-1);
        setVisualResults([]);
        setGlobalStats(null);
        setSelectedVisualGroup(null);
        setMarkedCells(new Set());
        setCellEdits(new Map());
        setBulkSelection([]);
      }
    }
  }, [fileData, selectedSheet]);

  const toggleOptionCol = (idx: number) => {
    if (groupCol === idx) return;
    setOptionCols(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const toggleClearCol = (idx: number) => {
    setClearCols(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const cartesian = (args: any[][]): any[][] => {
    const limit = 50000;
    let result: any[][] = [[]];
    for (const arg of args) {
        const nextResult: any[][] = [];
        for (const r of result) {
            for (const el of arg) {
                nextResult.push([...r, el]);
                if (nextResult.length > limit) throw new Error("Safety Limit Exceeded");
            }
        }
        result = nextResult;
    }
    return result;
  };

  const normalize = (val: any) => String(val || "").trim().toLowerCase();
  const cleanStr = (val: string) => String(val || "").replace(/-/g, '').trim();

  // --- ENHANCEMENT 3: AUTO CLUSTER LOGIC ---
  const handleAutoCluster = async () => {
      if (nameCol === -1) {
          addLog("Please select a Product Name column first to use Auto-Cluster.", 'warning');
          return;
      }
      
      setStatus(ProcessingStatus.PROCESSING);
      addLog("Auto-Clustering products by name similarity...", 'info');
      await new Promise(r => setTimeout(r, 100));

      // Clone rows
      const processedRows = [...rows];
      // Add a temporary Group ID column at the beginning
      const newRowsWithId = processedRows.map(r => ["", ...r]);
      const newHeaders = ["Auto-Group-ID", ...headers];

      // Logic: Sort by Name, then iterate
      // We need to keep track of original indices to map back later if needed, but for now we just sort/group
      const rowsWithIndex = processedRows.map((r, i) => ({ r, i, name: String(r[nameCol] || "") }));
      
      rowsWithIndex.sort((a, b) => a.name.localeCompare(b.name));

      let currentGroupId = 1;
      let prevName = "";
      
      rowsWithIndex.forEach((item, idx) => {
          if (idx === 0) {
              item.r = [`GRP-${currentGroupId}`, ...item.r];
              prevName = item.name;
          } else {
              // Fuzzy Check
              const dist = levenshteinDistance(prevName.toLowerCase(), item.name.toLowerCase());
              // If distinct < 5 chars OR starts with same 10 chars
              const isSimilar = dist < 4 || (item.name.length > 10 && item.name.substring(0, 10) === prevName.substring(0, 10));
              
              if (!isSimilar) {
                  currentGroupId++;
              }
              item.r = [`GRP-${currentGroupId}`, ...item.r];
              prevName = item.name;
          }
      });

      // Update State
      setHeaders(newHeaders);
      setRows(rowsWithIndex.map(item => item.r)); // Update rows with new column
      
      // Auto-set Group Col to 0 (The new ID column)
      setGroupCol(0);
      setIsAutoClustered(true);
      
      // Shift other columns indices by +1
      setOptionCols(prev => prev.map(p => p + 1));
      setClearCols(prev => prev.map(p => p + 1));
      setNameCol(prev => prev + 1);
      setSkuCol(prev => prev + 1);
      
      setStatus(ProcessingStatus.IDLE);
      addLog(`Auto-Cluster complete. Generated ${currentGroupId} groups.`, 'success');
  };

  // --- ENHANCEMENT 2: BULK ACTIONS ---
  const handleBulkSelect = (dimValue: string, dimIndex: number) => {
      // Select all cells that contain this dimension value
      if (!selectedVisualGroup) return;
      
      const toSelect: string[] = [];
      const dimensions = selectedVisualGroup.dimensions;
      
      // We need to iterate all possible combos and see if they match the clicked header
      const allCombos = cartesian(dimensions.map(d => d.values));
      
      allCombos.forEach(combo => {
          if (combo[dimIndex] === dimValue) {
              const fullKey = combo.map(v => String(v).trim().toLowerCase()).join('|||');
              if (!selectedVisualGroup.hits.has(fullKey)) {
                  toSelect.push(`${selectedVisualGroup.key}_${fullKey}`);
              }
          }
      });
      
      setBulkSelection(toSelect);
  };

  const applyBulkEdit = (price: string, qty: string) => {
      setCellEdits(prev => {
          const newMap = new Map(prev);
          bulkSelection.forEach(key => {
              newMap.set(key, { price, qty });
              setMarkedCells(curr => new Set(curr).add(key));
          });
          return newMap;
      });
      setBulkSelection([]);
      addLog("Bulk edit applied.", 'success');
  };

  // --- PROCESSING ---
  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    if (groupCol === -1) {
        addLog("Please select a grouping column.", 'warning');
        return;
    }
    if (optionCols.length === 0) {
        addLog("Please select option columns.", 'warning');
        return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    if (visualResults.length === 0) {
        setVisualResults([]);
        setGlobalStats(null);
        setSelectedVisualGroup(null);
        setMarkedCells(new Set());
    }
    addLog("Processing Variants V2...", 'info');

    try {
      await new Promise(r => setTimeout(r, 100));

      const priceColIdx = headers.findIndex(h => /price|cost|سعر/i.test(String(h)));
      const qtyColIdx = headers.findIndex(h => /qty|quant|stock|كمية/i.test(String(h)));
      const sortedOptionCols = [...optionCols].sort((a, b) => a - b);

      // Grouping
      const groups = new Map<string, any[][]>();
      rows.forEach((row) => {
          const key = String(row[groupCol] || "").trim();
          if (key) {
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(row);
          }
      });

      const visualDataBuffer: VisualGroup[] = [];
      const outputRows: any[][] = [headers]; // Header

      let processedCount = 0;
      groups.forEach((groupRows, key) => {
          // 1. Analyze Options
          const optionsMap = sortedOptionCols.map(colIdx => {
              const vals = new Set<string>();
              groupRows.forEach(r => {
                  const val = String(r[colIdx] || "").trim();
                  if(val) vals.add(val);
              });
              return Array.from(vals).sort();
          });

          if (optionsMap.some(o => o.length === 0)) {
              outputRows.push(...groupRows); // Skip empty
              processedCount++;
              return;
          }

          let combinations: any[][] = [];
          try { combinations = cartesian(optionsMap); } catch(e) { 
              outputRows.push(...groupRows);
              return;
          }

          const hits = new Set<string>();
          groupRows.forEach(r => {
              const k = sortedOptionCols.map(c => normalize(r[c])).join("|||");
              hits.add(k);
              outputRows.push(r); // Add existing
          });

          const missingCombos: any[][] = [];
          const missingVals: string[] = [];

          combinations.forEach(combo => {
              const k = combo.map(v => normalize(v)).join("|||");
              if (!hits.has(k)) {
                  missingCombos.push(combo);
                  missingVals.push(k);
              }
          });

          visualDataBuffer.push({
              key,
              status: missingCombos.length > 0 ? 'Unbalanced' : 'Balanced',
              dimensions: sortedOptionCols.map((c, i) => ({ 
                  name: headers[c] || `Opt${i+1}`, 
                  values: optionsMap[i] 
              })),
              hits,
              missingCount: missingCombos.length,
              missingValues: missingVals
          });

          // 2. Generate Missing Rows (with Patterns applied)
          if (missingCombos.length > 0) {
              const templateRow = [...groupRows[0]];
              
              missingCombos.forEach(combo => {
                  const newRow = [...templateRow];
                  
                  // A. Set Options
                  sortedOptionCols.forEach((c, i) => newRow[c] = combo[i]);
                  
                  // B. Clear Cols
                  clearCols.forEach(c => newRow[c] = "");

                  // --- ENHANCEMENT 1: APPLY PATTERNS ---
                  if (showPatterns) {
                      const parentName = nameCol !== -1 ? String(templateRow[nameCol] || "") : "";
                      const parentSku = skuCol !== -1 ? String(templateRow[skuCol] || "") : key; // Fallback to group key if SKU col not set
                      
                      const applyPattern = (pat: string) => {
                          let res = pat
                            .replace(/{Name}|{name}/g, parentName)
                            .replace(/{Sku}|{sku}/g, parentSku)
                            .replace(/{Group}|{group}/g, key);
                          
                          combo.forEach((optVal: string, idx: number) => {
                              res = res.replace(new RegExp(`{Option${idx+1}}`, 'gi'), optVal);
                          });
                          return res;
                      };

                      if (nameCol !== -1) newRow[nameCol] = applyPattern(namePattern);
                      if (skuCol !== -1) newRow[skuCol] = applyPattern(skuPattern);
                  }

                  // C. Apply Edits
                  const k = combo.map(v => normalize(v)).join("|||");
                  const uniqueId = `${key}_${k}`;
                  if (cellEdits.has(uniqueId)) {
                      const edit = cellEdits.get(uniqueId)!;
                      if (priceColIdx !== -1 && edit.price) newRow[priceColIdx] = edit.price;
                      if (qtyColIdx !== -1 && edit.qty) newRow[qtyColIdx] = edit.qty;
                  }

                  (newRow as any)._isNew = true;
                  outputRows.push(newRow);
              });
          }

          processedCount++;
          if (processedCount % 50 === 0) setProgress(Math.round((processedCount / groups.size) * 90));
      });

      if (visualResults.length === 0) {
          setVisualResults(visualDataBuffer);
          const firstUnbalanced = visualDataBuffer.find(g => g.status === 'Unbalanced');
          if (firstUnbalanced) setSelectedVisualGroup(firstUnbalanced);
      }

      const wb = XLSX_STYLE.utils.book_new();
      
      // First Sheet: Original File
      if (fileData && fileData.sheets.length > 0) {
          const originalData = getSheetData(fileData.workbook, fileData.sheets[0]);
          const wsOriginal = XLSX_STYLE.utils.aoa_to_sheet(originalData);
          XLSX_STYLE.utils.book_append_sheet(wb, wsOriginal, "Original File");
      }

      // Second Sheet: Balanced V2
      const ws = XLSX_STYLE.utils.aoa_to_sheet(outputRows);
      const rangeBal = XLSX_STYLE.utils.decode_range(ws['!ref'] || "A1");
      const greenStyle = { fill: { fgColor: { rgb: "CCFFCC" } } };
      for (let R = 1; R <= rangeBal.e.r; ++R) {
          if ((outputRows[R] as any)?._isNew) {
              for (let C = 0; C <= rangeBal.e.c; ++C) {
                 const cellRef = XLSX_STYLE.utils.encode_cell({r: R, c: C});
                 if (ws[cellRef]) ws[cellRef].s = greenStyle;
              }
          }
      }
      XLSX_STYLE.utils.book_append_sheet(wb, ws, "Balanced V2");
      
      const baseName = fileData?.name.replace(/\.[^/.]+$/, "") || "File";
      XLSX_STYLE.writeFile(wb, `Balanced_V2_${baseName}.xlsx`);

      addLog(t.common.completed, 'success');
      setProgress(100);
      setStatus(ProcessingStatus.COMPLETED);

    } catch (e: any) {
        addLog(e.message, 'error');
        setStatus(ProcessingStatus.IDLE);
    }
  };

  const filteredVisualResults = visualResults.filter(g => {
      const matchFilter = visualFilter === 'All' || g.status === visualFilter;
      const matchSearch = g.key.toLowerCase().includes(visualSearch.toLowerCase());
      return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-6 relative">
       
       {/* Configuration Card */}
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Sparkles className="text-purple-600" size={20}/>
            Product Variants V2 <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Enhanced</span>
         </h3>
         
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
             {/* Left: Auto Cluster & Grouping */}
             <div className="space-y-4">
                 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-2 opacity-10"><Wand2 size={64}/></div>
                     <h4 className="font-bold text-blue-800 text-sm mb-2">1. Grouping Strategy</h4>
                     
                     <div className="flex gap-2 items-center mb-3">
                         {isAutoClustered ? (
                             <div className="flex items-center gap-2 text-green-700 font-bold text-sm bg-white px-3 py-1 rounded shadow-sm">
                                 <CheckCircle2 size={16}/> Auto-Clustered by Name
                             </div>
                         ) : (
                             <button 
                                onClick={handleAutoCluster}
                                className="bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-2"
                             >
                                 <Wand2 size={14}/> Auto-Group by Name
                             </button>
                         )}
                     </div>

                     <div className="space-y-2">
                         <label className="block text-xs font-bold text-blue-700">Manual Group ID Column:</label>
                         <select 
                            className="w-full p-2 border rounded text-xs bg-white focus:ring-2 focus:ring-blue-500"
                            value={groupCol}
                            onChange={(e) => setGroupCol(Number(e.target.value))}
                            disabled={isAutoClustered}
                         >
                            <option value="-1">{t.common.selectCols}...</option>
                            {headers.map((h, i) => <option key={i} value={i}>{h || `Col ${i+1}`}</option>)}
                         </select>
                     </div>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Option Columns (Size, Color)</label>
                     <div className="max-h-40 overflow-y-auto border rounded bg-slate-50 p-2 custom-scrollbar">
                        {headers.map((h, i) => (
                            <label key={i} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${optionCols.includes(i) ? 'bg-green-100 text-green-800 font-bold' : 'hover:bg-slate-200'} ${groupCol===i ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="checkbox" checked={optionCols.includes(i)} onChange={() => toggleOptionCol(i)} className="rounded text-green-600"/>
                                <span className="truncate">{h || `Col ${i+1}`}</span>
                            </label>
                        ))}
                     </div>
                 </div>
             </div>

             {/* Right: Patterns & Config */}
             <div className="space-y-4">
                 <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                     <div className="flex justify-between items-center mb-2">
                         <h4 className="font-bold text-purple-800 text-sm flex items-center gap-2">
                             <TableProperties size={16}/> 2. Naming Patterns
                         </h4>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={showPatterns} onChange={e => setShowPatterns(e.target.checked)}/>
                            <div className="w-9 h-5 bg-purple-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                         </label>
                     </div>
                     
                     {showPatterns && (
                         <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                             <div className="grid grid-cols-2 gap-2">
                                 <div>
                                     <label className="text-[10px] font-bold text-purple-600 uppercase">Product Name Col</label>
                                     <select value={nameCol} onChange={e => setNameCol(Number(e.target.value))} className="w-full p-1.5 text-xs border rounded">
                                         <option value="-1">Select...</option>
                                         {headers.map((h,i) => <option key={i} value={i}>{h}</option>)}
                                     </select>
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-purple-600 uppercase">SKU Col</label>
                                     <select value={skuCol} onChange={e => setSkuCol(Number(e.target.value))} className="w-full p-1.5 text-xs border rounded">
                                         <option value="-1">Select...</option>
                                         {headers.map((h,i) => <option key={i} value={i}>{h}</option>)}
                                     </select>
                                 </div>
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold text-purple-600 uppercase">New Name Pattern</label>
                                 <input type="text" value={namePattern} onChange={e => setNamePattern(e.target.value)} className="w-full p-1.5 text-xs border rounded" placeholder="{Name} - {Option1}"/>
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold text-purple-600 uppercase">New SKU Pattern</label>
                                 <input type="text" value={skuPattern} onChange={e => setSkuPattern(e.target.value)} className="w-full p-1.5 text-xs border rounded" placeholder="{Sku}-{Option1}"/>
                             </div>
                             <p className="text-[10px] text-purple-500">Use: {'{Name}, {Sku}, {Option1}, {Option2}...'}</p>
                         </div>
                     )}
                 </div>

                 <button
                    onClick={handleProcess}
                    disabled={!fileData || status === ProcessingStatus.PROCESSING}
                    className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-2
                    ${status === ProcessingStatus.PROCESSING ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'}`}
                >
                    {status === ProcessingStatus.PROCESSING ? <span className="animate-spin">⏳</span> : <Network size={18}/>}
                    {cellEdits.size > 0 ? "Regenerate with Edits" : "Process & Balance"}
                </button>
             </div>
         </div>
       </div>

       {/* VISUAL MATRIX GRID */}
       {visualResults.length > 0 && (
           <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
               <div className="flex h-[600px]">
                   {/* Sidebar */}
                   <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50">
                       <div className="p-2 border-b border-slate-200">
                           <input type="text" placeholder="Search..." className="w-full p-1.5 text-xs border rounded bg-white" value={visualSearch} onChange={e => setVisualSearch(e.target.value)}/>
                           <div className="flex gap-1 mt-2">
                               <button onClick={() => setVisualFilter('Unbalanced')} className={`flex-1 py-1 text-[10px] rounded border font-bold ${visualFilter==='Unbalanced' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white'}`}>Issues ({visualResults.filter(r => r.status==='Unbalanced').length})</button>
                               <button onClick={() => setVisualFilter('All')} className={`flex-1 py-1 text-[10px] rounded border font-bold ${visualFilter==='All' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white'}`}>All</button>
                           </div>
                       </div>
                       <div className="flex-1 overflow-y-auto">
                           {filteredVisualResults.map(group => (
                               <button key={group.key} onClick={() => setSelectedVisualGroup(group)} className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-100 flex justify-between items-center ${selectedVisualGroup?.key === group.key ? 'bg-white border-l-4 border-l-purple-500' : 'border-l-4 border-l-transparent'}`}>
                                   <span className="font-mono text-xs font-bold text-slate-700 truncate w-32">{group.key}</span>
                                   {group.status === 'Unbalanced' ? <AlertCircle size={14} className="text-red-500"/> : <CheckCircle2 size={14} className="text-green-500"/>}
                               </button>
                           ))}
                       </div>
                   </div>

                   {/* Matrix Area */}
                   <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
                       {selectedVisualGroup && (
                           <>
                               <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                   <div>
                                       <h4 className="font-bold text-lg">{selectedVisualGroup.key}</h4>
                                       <p className="text-xs text-slate-500">{selectedVisualGroup.dimensions.map(d => d.name).join(' × ')}</p>
                                   </div>
                                   
                                   {/* BULK ACTION BAR */}
                                   {bulkSelection.length > 0 && (
                                       <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded shadow-lg animate-in fade-in slide-in-from-top-2">
                                           <span className="text-xs font-bold">{bulkSelection.length} Selected</span>
                                           <div className="h-4 w-px bg-blue-400 mx-1"></div>
                                           <input 
                                                type="text" placeholder="Price" className="w-16 p-1 text-xs text-black rounded"
                                                onKeyDown={(e) => e.key === 'Enter' && applyBulkEdit((e.target as HTMLInputElement).value, "")}
                                           />
                                           <input 
                                                type="text" placeholder="Qty" className="w-16 p-1 text-xs text-black rounded"
                                                onKeyDown={(e) => e.key === 'Enter' && applyBulkEdit("", (e.target as HTMLInputElement).value)}
                                           />
                                           <button onClick={() => setBulkSelection([])} className="hover:bg-blue-700 p-1 rounded"><X size={14}/></button>
                                       </div>
                                   )}
                               </div>

                               <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                                   {/* 2D Matrix Rendering */}
                                   {selectedVisualGroup.dimensions.length > 0 && (
                                       <table className="text-sm border-collapse bg-white shadow-sm">
                                           <thead>
                                               <tr>
                                                   <th className="p-3 bg-slate-100 border text-left text-xs font-mono text-slate-500">
                                                       {selectedVisualGroup.dimensions[0].name} ↓
                                                   </th>
                                                   {/* COLS HEADER */}
                                                   {cartesian(selectedVisualGroup.dimensions.slice(1).map(d => d.values)).map((combo, i) => (
                                                       <th 
                                                            key={i} 
                                                            className="p-3 bg-slate-50 border font-bold text-slate-700 text-center cursor-pointer hover:bg-blue-50 transition-colors group relative"
                                                            onClick={() => handleBulkSelect(combo[0], 1)} // Simplify: assume 2nd dim for now or flatten
                                                       >
                                                           {combo.join(' / ')}
                                                           <MousePointerClick size={12} className="absolute top-1 right-1 opacity-0 group-hover:opacity-50"/>
                                                       </th>
                                                   ))}
                                               </tr>
                                           </thead>
                                           <tbody>
                                               {selectedVisualGroup.dimensions[0].values.map((rowVal, rIdx) => (
                                                   <tr key={rowVal}>
                                                       <th 
                                                            className="p-3 bg-slate-50 border font-bold text-slate-700 text-left cursor-pointer hover:bg-blue-50 group relative"
                                                            onClick={() => handleBulkSelect(rowVal, 0)}
                                                       >
                                                           {rowVal}
                                                           <MousePointerClick size={12} className="absolute top-1 right-1 opacity-0 group-hover:opacity-50"/>
                                                       </th>
                                                       {/* CELLS */}
                                                       {cartesian(selectedVisualGroup.dimensions.slice(1).map(d => d.values)).map((colCombo, cIdx) => {
                                                           const fullKey = [rowVal, ...colCombo].map(v => String(v).trim().toLowerCase()).join('|||');
                                                           const exists = selectedVisualGroup.hits.has(fullKey);
                                                           const uniqueId = `${selectedVisualGroup.key}_${fullKey}`;
                                                           const isSelected = bulkSelection.includes(uniqueId);
                                                           const hasEdit = cellEdits.has(uniqueId);

                                                           return (
                                                               <td 
                                                                  key={cIdx} 
                                                                  className={`p-4 border text-center relative transition-all
                                                                    ${exists ? 'bg-green-50' : (isSelected || hasEdit ? 'bg-blue-50 ring-inset ring-2 ring-blue-300' : 'bg-red-50 hover:bg-red-100 cursor-pointer')}`}
                                                                  onClick={() => {
                                                                      if (!exists) {
                                                                          if(isSelected) setBulkSelection(prev => prev.filter(k => k !== uniqueId));
                                                                          else setBulkSelection(prev => [...prev, uniqueId]);
                                                                      }
                                                                  }}
                                                               >
                                                                   {exists ? <CheckCircle2 size={18} className="text-green-500 mx-auto"/> : <div className="w-3 h-3 rounded-full bg-red-400 mx-auto opacity-30"></div>}
                                                                   {hasEdit && <div className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></div>}
                                                               </td>
                                                           );
                                                       })}
                                                   </tr>
                                               ))}
                                           </tbody>
                                       </table>
                                   )}
                               </div>
                           </>
                       )}
                   </div>
               </div>
           </div>
       )}

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default VariableBalanceTabV2;
