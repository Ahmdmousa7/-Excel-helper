
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Network, ArrowRight, Eraser, CheckSquare, Layers, Tag, Type, Grid3X3, List, Search, AlertCircle, CheckCircle2, LayoutGrid, X, Ban, BarChart3, TrendingUp, Edit, Save, MoreHorizontal, Info, BookOpen, FileText } from 'lucide-react';

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
  invalidCharsReplacedTotal: number;
}

interface CellEdit {
    price: string;
    qty: string;
}

const VariableBalanceTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [groupCol, setGroupCol] = useState<number>(-1);
  const [optionCols, setOptionCols] = useState<number[]>([]);
  const [clearCols, setClearCols] = useState<number[]>([]);
  
  const [catCol, setCatCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  const [visualResults, setVisualResults] = useState<VisualGroup[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  
  const [selectedVisualGroup, setSelectedVisualGroup] = useState<VisualGroup | null>(null);
  const [visualFilter, setVisualFilter] = useState<'All' | 'Unbalanced'>('Unbalanced');
  const [visualSearch, setVisualSearch] = useState<string>('');
  
  // Interactive Matrix State
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const [cellEdits, setCellEdits] = useState<Map<string, CellEdit>>(new Map());
  
  // UI State
  const [showHelp, setShowHelp] = useState(false);

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
        setGroupCol(-1);
        setOptionCols([]);
        
        const idKeywords = ['id', 'sku', 'barcode', 'code', 'ref', 'كود', 'بار코드', 'رقم'];
        const autoClearIndices: number[] = [];
        let detectedNameCol = -1;
        const nameKeywords = ['name', 'title', 'اسم', 'الاسم', 'product', 'منتج'];
        
        head.forEach((h, i) => {
            const lowerH = h ? h.toLowerCase() : "";
            if (lowerH && idKeywords.some(k => lowerH.includes(k))) {
                autoClearIndices.push(i);
            }
            if (lowerH && detectedNameCol === -1 && nameKeywords.some(k => lowerH.includes(k))) {
                detectedNameCol = i;
            }
        });
        setClearCols(autoClearIndices);

        setCatCol(-1);
        setNameCol(detectedNameCol);
        setVisualResults([]);
        setGlobalStats(null);
        setSelectedVisualGroup(null);
        setMarkedCells(new Set());
        setCellEdits(new Map());
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
                if (nextResult.length > limit) throw new Error("Safety Limit Exceeded: Too many variant combinations.");
            }
        }
        result = nextResult;
    }
    return result;
  };

  const normalize = (val: any) => String(val || "").trim().toLowerCase();
  const cleanStr = (val: string) => {
      let str = String(val || "");
      if (str) {
          str = str.replace(/[-–—]/g, '|')
                   .replace(/[()]/g, ' ')
                   .replace(/\//g, '|')
                   .replace(/_/g, '|')
                   .replace(/®/g, ' ');
      }
      return str.trim();
  };

  // --- Right Click Handler ---
  const handleCellContextMenu = (e: React.MouseEvent, uniqueId: string) => {
      e.preventDefault();
      // Only allow editing if it's missing (not existing)
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          key: uniqueId
      });
  };

  const openEditModal = () => {
      if (!contextMenu) return;
      const existingEdit = cellEdits.get(contextMenu.key);
      setEditModal({
          isOpen: true,
          key: contextMenu.key,
          price: existingEdit?.price || "",
          qty: existingEdit?.qty || ""
      });
      setContextMenu(null);
  };

  const saveEdit = () => {
      if (!editModal) return;
      setCellEdits(prev => {
          const newMap = new Map(prev);
          if (editModal.price || editModal.qty) {
              newMap.set(editModal.key, { price: editModal.price, qty: editModal.qty });
              // Auto-mark cell if edited
              setMarkedCells(prevMarked => new Set(prevMarked).add(editModal.key));
          } else {
              newMap.delete(editModal.key);
          }
          return newMap;
      });
      setEditModal(null);
  };

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    if (groupCol === -1) {
        addLog("Please select a grouping column (Product ID/SKU).", 'warning');
        return;
    }
    if (optionCols.length === 0) {
        addLog("Please select at least one option column (e.g. Size).", 'warning');
        return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    // Don't clear visual results immediately if we are re-processing with edits
    if (visualResults.length === 0) {
        setVisualResults([]);
        setGlobalStats(null);
        setSelectedVisualGroup(null);
        setMarkedCells(new Set());
    }
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));

      const displayData = getSheetData(fileData.workbook, selectedSheet, false); 
      const header = displayData[0];
      const rows = displayData.slice(1);
      
      const priceColIdx = headers.findIndex(h => /price|cost|سعر|مبلغ/i.test(String(h)));
      const qtyColIdx = headers.findIndex(h => /qty|quantity|stock|كمية|مخزون/i.test(String(h)));
      
      let effectiveNameCol = nameCol;
      if (effectiveNameCol === -1) {
          const nameKeywords = ['name', 'title', 'اسم', 'الاسم', 'product', 'منتج'];
          effectiveNameCol = headers.findIndex(h => {
              const lowerH = h ? String(h).toLowerCase() : "";
              return nameKeywords.some(k => lowerH.includes(k));
          });
      }

      const sortedOptionCols = [...optionCols].sort((a, b) => a - b);

      // --- CHECK CATEGORY CONSISTENCY ---
      const categoryErrors = new Set<string>(); 
      if (catCol !== -1 && effectiveNameCol !== -1) {
          const nameToCats = new Map<string, Set<string>>();
          rows.forEach(row => {
              const name = cleanStr(String(row[effectiveNameCol] || ""));
              let cat = String(row[catCol] || "").trim();
              if (catCol === -1) cat = "";
              if (name && cat) {
                  if (!nameToCats.has(name)) nameToCats.set(name, new Set());
                  nameToCats.get(name)!.add(cat.toLowerCase());
              }
          });
          nameToCats.forEach((cats, name) => {
              if (cats.size > 1) categoryErrors.add(name);
          });
      }

      // --- GROUPING ---
      const groups = new Map<string, { rows: any[][], indices: number[] }>();
      rows.forEach((row, idx) => {
          const key = String(row[groupCol] || "").trim();
          if (key) {
              if (!groups.has(key)) groups.set(key, { rows: [], indices: [] });
              const g = groups.get(key)!;
              g.rows.push([...row]); // Clone to avoid mutating source data
              g.indices.push(idx); 
          }
      });

      const balancedRows: any[][] = [header]; 
      const fixedActionRows: any[][] = [[t.balance.action, ...header]]; 
      const summaryRows: any[][] = [[...t.balance.summaryHeaders, "Error Description"]]; 

      // Clean headers for Product Name and Variant columns before exporting
      const cleanedExportHeader = [...header];
      if (effectiveNameCol !== -1) {
          cleanedExportHeader[effectiveNameCol] = cleanStr(String(cleanedExportHeader[effectiveNameCol]));
      }
      sortedOptionCols.forEach(c => {
          cleanedExportHeader[c] = cleanStr(String(cleanedExportHeader[c]));
      });

      const finalReadyRows: any[][] = [[...cleanedExportHeader, "Error Description"]]; 

      
      const visualDataBuffer: VisualGroup[] = [];
      const missingStats = new Map<string, number>();
      let totalInvalidCharsReplaced = 0;

      let processedCount = 0;
      const totalGroups = groups.size;

      // ----------------------------------------------------
      // PASS 1
      // ----------------------------------------------------
      groups.forEach((group, key) => {
          // Sanitize
          let groupInvalidCharsCnt = 0;
          group.rows.forEach(r => {
              let rowInvalidCount = 0;
              if (effectiveNameCol !== -1) {
                  const pre = String(r[effectiveNameCol] || "");
                  const cleaned = cleanStr(pre);
                  if (pre.trim() !== "" && cleaned !== pre.trim()) rowInvalidCount++;
                  r[effectiveNameCol] = cleaned;
              }
              sortedOptionCols.forEach(c => {
                  const pre = String(r[c] || "");
                  const cleaned = cleanStr(pre);
                  if (pre.trim() !== "" && cleaned !== pre.trim()) rowInvalidCount++;
                  r[c] = cleaned;
              });
              
              if (rowInvalidCount > 0) {
                  r[headers.length] = `Replaced Invalid Chars (${rowInvalidCount})`;
                  groupInvalidCharsCnt += rowInvalidCount;
              } else {
                  r[headers.length] = "";
              }
          });
          
          totalInvalidCharsReplaced += groupInvalidCharsCnt;

          // AUTO-FILL SINGLETON COLUMNS
          // If any column has exactly 1 unique non-empty value in this group, clone it to all empty cells.
          // This ensures Option Names, Categories, and single-value Options are properly copied to all rows.
          const numCols = headers.length;
          for (let c = 0; c < numCols; c++) {
              if (clearCols.includes(c) && c !== groupCol) continue;
              
              const uniqueVals = new Set<string>();
              let lastVal = "";
              group.rows.forEach(r => {
                  const val = String(r[c] || "").trim();
                  if (val) {
                      uniqueVals.add(val.toLowerCase());
                      lastVal = String(r[c] || ""); // preserve exact case
                  }
              });
              
              if (uniqueVals.size === 1) {
                  group.rows.forEach(r => {
                      const val = String(r[c] || "").trim();
                      if (!val) {
                          r[c] = lastVal;
                      }
                  });
              }
          }

          const activeOptionCols: number[] = [];
          const optionsMap: string[][] = [];
          
          sortedOptionCols.forEach((colIdx, index) => {
              const uniqueValuesMap = new Map<string, string>(); 
              group.rows.forEach(r => {
                  const val = String(r[colIdx] || "").trim();
                  if (val) uniqueValuesMap.set(val.toLowerCase(), val);
              });
              const vals = Array.from(uniqueValuesMap.values()).sort();
              
              if (vals.length > 0) {
                  activeOptionCols.push(colIdx);
                  optionsMap.push(vals);
              }
          });

          let hasCatError = false;
          if (effectiveNameCol !== -1 && catCol !== -1) {
              const cleanedName = cleanStr(String(group.rows[0]?.[effectiveNameCol] || ""));
              hasCatError = categoryErrors.has(cleanedName);
          }

          if (optionsMap.length === 0) {
              balancedRows.push(...group.rows);
              summaryRows.push([key, 0, "-", "No Options Detected", "SKIPPED", ""]);
              processedCount++;
              return;
          }

          let combinations: any[][] = [];
          try {
             combinations = optionsMap.length === 1 
               ? optionsMap[0].map(v => [v])
               : cartesian(optionsMap);
          } catch(e: any) {
             addLog(`Skipped group ${key}: ${e.message}`, 'error');
             balancedRows.push(...group.rows);
             summaryRows.push([key, 0, "-", "Error: Too Many Combos", "ERROR", ""]);
             return;
          }

          const missingCombos: any[][] = [];
          const missingValuesForStats: string[] = [];
          const hits = new Set<string>();

          group.rows.forEach(row => {
              const k = activeOptionCols.map(c => normalize(row[c])).join("|||");
              hits.add(k);
          });

          combinations.forEach(combo => {
              const comboKey = combo.map(v => normalize(v)).join("|||");
              if (!hits.has(comboKey)) {
                  missingCombos.push(combo);
                  combo.forEach(val => missingValuesForStats.push(String(val)));
              }
          });

          // Aggregate Global Stats
          missingValuesForStats.forEach(v => {
              const current = missingStats.get(v) || 0;
              missingStats.set(v, current + 1);
          });

          visualDataBuffer.push({
              key,
              status: missingCombos.length > 0 ? 'Unbalanced' : 'Balanced',
              dimensions: activeOptionCols.map((c, i) => ({ 
                  name: headers[c] || `Option ${i+1}`, 
                  values: optionsMap[i] 
              })),
              hits,
              missingCount: missingCombos.length,
              missingValues: [...new Set(missingValuesForStats)]
          });

          balancedRows.push(...group.rows);
          
          const hasActionTaken = missingCombos.length > 0 || hasCatError;
          if (hasActionTaken) {
              group.rows.forEach(r => {
                    let action = missingCombos.length > 0 ? t.balance.existing : t.balance.balanced;
                    if (hasCatError) action += ` + ${t.balance.catError}`;
                    fixedActionRows.push([action, ...r]);
              });
          }

          if (missingCombos.length > 0) {
              const templateRow = [...group.rows[0]];
              
              missingCombos.forEach((combo, idx) => {
                  const newRow = [...templateRow];
                  
                  // 1. Set Options
                  activeOptionCols.forEach((colIdx, i) => newRow[colIdx] = combo[i]);
                  
                  // 2. Clear auto-clear cols
                  clearCols.forEach(colIdx => newRow[colIdx] = ""); 
                  
                  // 3. Keep Original SKU (No Suffix)
                  if (groupCol !== -1) {
                      const originalSku = String(templateRow[groupCol] || "").trim();
                      newRow[groupCol] = originalSku; 
                  }

                  // 4. CHECK FOR MANUAL EDITS (Interactive Matrix)
                  // Construct key same as matrix uniqueId: key_val1|||val2
                  const comboKey = combo.map(v => normalize(v)).join("|||");
                  const uniqueId = `${key}_${comboKey}`;
                  
                  if (cellEdits.has(uniqueId)) {
                      const edit = cellEdits.get(uniqueId)!;
                      if (priceColIdx !== -1 && edit.price) newRow[priceColIdx] = edit.price;
                      if (qtyColIdx !== -1 && edit.qty) newRow[qtyColIdx] = edit.qty;
                  }

                  (newRow as any)._isNew = true;
                  balancedRows.push(newRow);
                  fixedActionRows.push([t.balance.added, ...newRow]);
              });
          }

          const opt1Values = optionsMap[0] || [];
          let statusText = missingCombos.length > 0 ? t.balance.unbalanced : t.balance.balanced;
          
          let detailsStr = optionsMap.map(opts => opts.length).join(" x ") + " Variants";
          const allValuesStr = optionsMap.map((opts, i) => `Opt ${i+1}: [${opts.join(", ")}]`).join(" | ");
          const opt2Count = activeOptionCols.length > 1 ? Math.max(...optionsMap.slice(1).map(o=>o.length)) : "-";
          
          const errDesc = groupInvalidCharsCnt > 0 ? `Replaced chars in ${groupInvalidCharsCnt} cells` : "";

          summaryRows.push([key, opt1Values.length, opt2Count, detailsStr, statusText, allValuesStr, errDesc]);

          processedCount++;
          if (processedCount % 50 === 0) setProgress(Math.round((processedCount / totalGroups) * 80));
      });

      // Stats Calculation
      const unbalancedCount = visualDataBuffer.filter(g => g.status === 'Unbalanced').length;
      const topMissing = Array.from(missingStats.entries())
          .sort((a,b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

      setGlobalStats({
          totalProducts: visualDataBuffer.length,
          balancedCount: visualDataBuffer.length - unbalancedCount,
          unbalancedCount,
          missingFrequency: topMissing,
          invalidCharsReplacedTotal: totalInvalidCharsReplaced
      });

      // ----------------------------------------------------
      // PASS 2: Generate "Final Ready File"
      // ----------------------------------------------------
      groups.forEach((group, key) => {
          const catBuckets = new Map<string, any[][]>();
          if (catCol !== -1) {
              group.rows.forEach(r => {
                  let cVal = String(r[catCol] || "").trim();
                  if (!cVal) cVal = "Uncategorized";
                  if (!catBuckets.has(cVal)) catBuckets.set(cVal, []);
                  catBuckets.get(cVal)!.push(r);
              });
          } else {
              catBuckets.set("Default", group.rows);
          }

          let catIndex = 0;
          catBuckets.forEach((rowsInCat) => {
              const currentSku = catIndex === 0 ? key : `${key}${catIndex}`; 
              const partitionRows = rowsInCat.map(r => {
                  const newR = [...r];
                  if (groupCol !== -1) newR[groupCol] = currentSku;
                  return newR;
              });

              const activeOptionCols: number[] = [];
              const partitionOptionsMap: string[][] = [];
              
              sortedOptionCols.forEach(colIdx => {
                  const uniqueValuesMap = new Map<string, string>();
                  partitionRows.forEach(r => {
                      const val = String(r[colIdx] || "").trim();
                      if (val) uniqueValuesMap.set(val.toLowerCase(), val);
                  });
                  const sortedVals = Array.from(uniqueValuesMap.values()).sort();
                  if (sortedVals.length > 0) {
                      activeOptionCols.push(colIdx);
                      partitionOptionsMap.push(sortedVals);
                  }
              });

              const uniqueRowsMap = new Map<string, any[]>();
              partitionRows.forEach(row => {
                  const optsKey = activeOptionCols.map(c => normalize(row[c])).join("|||");
                  const nameVal = effectiveNameCol !== -1 ? normalize(row[effectiveNameCol]) : "";
                  const priceVal = priceColIdx !== -1 ? String(row[priceColIdx]).trim() : "";
                  const qtyVal = qtyColIdx !== -1 ? String(row[qtyColIdx]).trim() : "";
                  const dedupKey = `${optsKey}_NAME:${nameVal}_PRICE:${priceVal}_QTY:${qtyVal}`;
                  if (!uniqueRowsMap.has(dedupKey)) uniqueRowsMap.set(dedupKey, row);
              });

              const dedupedRows = Array.from(uniqueRowsMap.values());
              
              // Apply existing edits so they reflect in Final file
              dedupedRows.forEach(r => {
                  const k = activeOptionCols.map(c => normalize(r[c])).join("|||");
                  const uniqueId = `${key}_${k}`;
                  if (cellEdits.has(uniqueId)) {
                      const edit = cellEdits.get(uniqueId)!;
                      if (priceColIdx !== -1 && edit.price) r[priceColIdx] = edit.price;
                      if (qtyColIdx !== -1 && edit.qty) r[qtyColIdx] = edit.qty;
                      (r as any)._isEdited = true;
                  }
              });

              if (partitionOptionsMap.length > 0) {
                  let partitionCombos: any[][] = [];
                  try { 
                      partitionCombos = partitionOptionsMap.length === 1 
                          ? partitionOptionsMap[0].map(v => [v])
                          : cartesian(partitionOptionsMap); 
                  } catch (e) { partitionCombos = []; }

                  const partitionHits = new Set<string>();
                  dedupedRows.forEach(r => {
                      const k = activeOptionCols.map(c => normalize(r[c])).join("|||");
                      partitionHits.add(k);
                  });

                  finalReadyRows.push(...dedupedRows);

                  if (dedupedRows.length > 0) {
                      const templateR = [...dedupedRows[0]];
                      
                      partitionCombos.forEach(combo => {
                          const k = combo.map(v => normalize(v)).join("|||");
                          if (!partitionHits.has(k)) {
                              const newR = [...templateR];
                              activeOptionCols.forEach((c, i) => newR[c] = combo[i]);
                              clearCols.forEach(c => newR[c] = ""); 
                              
                              if (groupCol !== -1) {
                                  newR[groupCol] = currentSku; 
                              }
                              
                              newR[headers.length] = ""; // clear error description for newly generated variant

                              // Apply Edits here too if key matches
                              // Note: Logic here is a bit tricky if category splits SKU. 
                              // For now we assume edits apply to main SKU logic.
                              const uniqueId = `${key}_${k}`;
                              if (cellEdits.has(uniqueId)) {
                                  const edit = cellEdits.get(uniqueId)!;
                                  if (priceColIdx !== -1 && edit.price) newR[priceColIdx] = edit.price;
                                  if (qtyColIdx !== -1 && edit.qty) newR[qtyColIdx] = edit.qty;
                              }

                              (newR as any)._isNew = true;
                              finalReadyRows.push(newR);
                          }
                      });
                  }
              } else {
                  finalReadyRows.push(...dedupedRows);
              }
              catIndex++;
          });
      });

      // Update visual results only if not merely refreshing edits
      if (visualResults.length === 0) {
          visualDataBuffer.sort((a, b) => {
              if (a.status === 'Unbalanced' && b.status === 'Balanced') return -1;
              if (a.status === 'Balanced' && b.status === 'Unbalanced') return 1;
              return a.key.localeCompare(b.key);
          });
          setVisualResults(visualDataBuffer);
          if (visualDataBuffer.length > 0) {
              const firstUnbalanced = visualDataBuffer.find(g => g.status === 'Unbalanced');
              setSelectedVisualGroup(firstUnbalanced || visualDataBuffer[0]);
          }
      }

      const newWb = XLSX_STYLE.utils.book_new();

      // Original File
      if (fileData && fileData.sheets.length > 0) {
          const originalData = getSheetData(fileData.workbook, fileData.sheets[0]);
          const wsOriginal = XLSX_STYLE.utils.aoa_to_sheet(originalData);
          XLSX_STYLE.utils.book_append_sheet(newWb, wsOriginal, "Original File");
      }

      const greenStyle = { fill: { fgColor: { rgb: "CCFFCC" } } };

      const wsSummary = XLSX_STYLE.utils.aoa_to_sheet(summaryRows);
      const rangeSum = XLSX_STYLE.utils.decode_range(wsSummary['!ref'] || "A1");
      const statusIdx = 4;
      for (let R = 1; R <= rangeSum.e.r; ++R) {
          const cellRef = XLSX_STYLE.utils.encode_cell({r: R, c: statusIdx});
          const cell = wsSummary[cellRef];
          if (cell) {
              const val = String(cell.v).toUpperCase();
              let color = null;
              if (val.includes('UNBALANCED') || val.includes('ERROR')) color = { rgb: "FFCCCC" }; 
              else if (val.includes('BALANCED')) color = { rgb: "CCFFCC" }; 
              else if (val.includes('SKIPPED')) color = { rgb: "EEEEEE" };
              if (color && !wsSummary[cellRef].s) {
                  wsSummary[cellRef].s = { fill: { fgColor: color } };
              }
          }
      }
      XLSX_STYLE.utils.book_append_sheet(newWb, wsSummary, t.balance.summarySheet);

      const wsReport = XLSX_STYLE.utils.aoa_to_sheet(fixedActionRows);
      const rangeRep = XLSX_STYLE.utils.decode_range(wsReport['!ref'] || "A1");
      for (let R = 1; R <= rangeRep.e.r; ++R) {
          const actionText = String(fixedActionRows[R]?.[0] || "");
          if (actionText.includes(t.balance.added)) {
              for (let C = 0; C <= rangeRep.e.c; ++C) {
                 const cellRef = XLSX_STYLE.utils.encode_cell({r: R, c: C});
                 if (wsReport[cellRef]) wsReport[cellRef].s = greenStyle;
              }
          }
      }
      XLSX_STYLE.utils.book_append_sheet(newWb, wsReport, "Detailed Action Report");

      const wsFinal = XLSX_STYLE.utils.aoa_to_sheet(finalReadyRows);
      const rangeFinal = XLSX_STYLE.utils.decode_range(wsFinal['!ref'] || "A1");
      for (let R = 1; R <= rangeFinal.e.r; ++R) {
          const rObj = finalReadyRows[R] as any;
          if (rObj?._isNew || rObj?._isEdited) {
              const color = "CCFFCC"; // Using green for both added rows and edited rows so users spot them easily
              for (let C = 0; C <= rangeFinal.e.c; ++C) {
                 const cellRef = XLSX_STYLE.utils.encode_cell({r: R, c: C});
                 if (wsFinal[cellRef]) wsFinal[cellRef].s = { fill: { fgColor: { rgb: color } } };
              }
          }
      }
      XLSX_STYLE.utils.book_append_sheet(newWb, wsFinal, "Final Ready File");

      const baseName = fileData?.name.replace(/\.[^/.]+$/, "") || "File";
      XLSX_STYLE.writeFile(newWb, `Balanced_${baseName}.xlsx`);
      
      addLog(t.common.completed, 'success');
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  const filteredVisualResults = visualResults.filter(g => {
      const matchFilter = visualFilter === 'All' || g.status === visualFilter;
      const matchSearch = g.key.toLowerCase().includes(visualSearch.toLowerCase());
      return matchFilter && matchSearch;
  });

  const toggleCellMark = (key: string) => {
      setMarkedCells(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
      });
  };

  return (
    <div className="space-y-6 relative">
       
       {/* Configuration Card */}
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-700 flex items-center">
                <Network className="mr-2" size={20}/>
                {t.tabs.balance}
             </h3>
             <button 
                onClick={() => setShowHelp(!showHelp)} 
                className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
             >
                 {showHelp ? <X size={14}/> : <Info size={14}/>} {language === 'ar' ? 'كيفية الاستخدام' : 'How to use'}
             </button>
         </div>

         {/* HELP SECTION */}
         {showHelp && (
             <div className="mb-6 bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-200 animate-in slide-in-from-top-2 space-y-4">
                 {/* Basic Usage */}
                 <div>
                     <h4 className="font-bold mb-2 flex items-center gap-2 text-blue-900"><BookOpen size={16}/> {language === 'ar' ? 'دليل الاستخدام' : 'User Manual'}</h4>
                     {language === 'ar' ? (
                         <ol className="list-decimal list-inside space-y-1 text-xs">
                             <li><strong>اختر الورقة:</strong> حدد الورقة التي تحتوي على بيانات المنتجات.</li>
                             <li><strong>عمود التجميع:</strong> هو المعرف المشترك لجميع متغيرات المنتج (مثل SKU الأب).</li>
                             <li><strong>أعمدة الخيارات:</strong> اختر الأعمدة المتغيرة (مثل المقاس، اللون).</li>
                             <li><strong>تحليل:</strong> تفحص الأداة ما إذا كانت جميع التشكيلات موجودة.</li>
                             <li><strong>المصفوفة التفاعلية:</strong> انقر الخلايا الحمراء لتحديدها للإنشاء، أو انقر بالزر الأيمن لتعديل السعر/الكمية.</li>
                         </ol>
                     ) : (
                         <ol className="list-decimal list-inside space-y-1 text-xs">
                             <li><strong>Select Sheet:</strong> Choose the sheet containing your product data.</li>
                             <li><strong>Grouping Column:</strong> Select the Product ID or Parent SKU.</li>
                             <li><strong>Option Columns:</strong> Select attributes that vary (e.g. Size, Color).</li>
                             <li><strong>Analyze:</strong> The tool checks if every combination exists.</li>
                             <li><strong>Interactive Matrix:</strong> Click red cells to mark for creation, right-click to edit price/qty.</li>
                         </ol>
                     )}
                 </div>

                 <div className="h-px bg-blue-200"></div>

                 {/* Errors & Exports Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Errors */}
                     <div>
                         <h5 className="font-bold mb-2 text-xs uppercase text-blue-900 flex items-center gap-1"><AlertCircle size={12}/> {language === 'ar' ? 'معاني الأخطاء' : 'Common Errors'}</h5>
                         <ul className="space-y-1 text-[10px] list-disc list-inside">
                             {language === 'ar' ? (
                                 <>
                                     <li><strong>Static Option:</strong> عمود الخيار يحتوي على قيمة واحدة فقط للمنتج (لا يوجد تنوع).</li>
                                     <li><strong>Category Error:</strong> نفس المنتج له تصنيفات مختلفة في صفوف مختلفة.</li>
                                     <li><strong>Too Many Combos:</strong> عدد الاحتمالات كبير جداً (تجاوز حد الأمان).</li>
                                 </>
                             ) : (
                                 <>
                                     <li><strong>Static Option:</strong> Option column has only 1 unique value for the product (must vary).</li>
                                     <li><strong>Category Error:</strong> Same Product ID has inconsistent category names.</li>
                                     <li><strong>Too Many Combos:</strong> Generated variants exceed safety limits.</li>
                                 </>
                             )}
                         </ul>
                     </div>

                     {/* Exports */}
                     <div>
                         <h5 className="font-bold mb-2 text-xs uppercase text-blue-900 flex items-center gap-1"><Save size={12}/> {language === 'ar' ? 'محتوى التصدير' : 'Export Content'}</h5>
                         <ul className="space-y-1 text-[10px] list-disc list-inside">
                             {language === 'ar' ? (
                                  <>
                                      <li><strong>Detailed Action Report:</strong> المنتجات التي تم التعديل عليها أو إضافة متغيرات لها.</li>
                                      <li><strong>Summary:</strong> ملخص حالة كل منتج (متوازن/غير متوازن).</li>
                                      <li><strong>Final Ready:</strong> القائمة الكاملة النهائية الجاهزة للاستيراد.</li>
                                  </>
                              ) : (
                                  <>
                                      <li><strong>Detailed Action Report:</strong> Products that had missing variants added or errors fixed.</li>
                                      <li><strong>Summary:</strong> Status overview for each product group.</li>
                                      <li><strong>Final Ready:</strong> Clean, final complete list ready for import.</li>
                                  </>
                              )}
                         </ul>
                     </div>
                 </div>

                 {/* File Example Section */}
                 <div className="h-px bg-blue-200"></div>
                 
                 <div>
                     <h5 className="font-bold mb-2 text-xs uppercase text-blue-900 flex items-center gap-1">
                        <FileText size={12}/> {language === 'ar' ? 'مثال على الملف' : 'Input File Example'}
                     </h5>
                     <div className="flex flex-col md:flex-row gap-4 items-start">
                         <div className="bg-white border border-blue-200 rounded overflow-hidden w-full md:w-1/2 shadow-sm">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-blue-100 text-blue-900 font-bold">
                                    <tr>
                                        <th className="p-2 border-r border-blue-200">ID (Group)</th>
                                        <th className="p-2 border-r border-blue-200">Color (Option)</th>
                                        <th className="p-2">Size (Option)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-600">
                                    <tr className="border-b border-blue-50"><td className="p-2 border-r">P-100</td><td className="p-2 border-r">Red</td><td className="p-2">Small</td></tr>
                                    <tr className="border-b border-blue-50"><td className="p-2 border-r">P-100</td><td className="p-2 border-r">Red</td><td className="p-2">Large</td></tr>
                                    <tr className="border-b border-blue-50"><td className="p-2 border-r">P-100</td><td className="p-2 border-r">Blue</td><td className="p-2">Small</td></tr>
                                    <tr className="bg-red-50 text-red-500 font-bold"><td className="p-2 border-r">P-100</td><td className="p-2 border-r">Blue</td><td className="p-2">Large (Missing)</td></tr>
                                </tbody>
                            </table>
                         </div>
                         <div className="flex-1 text-xs text-blue-800">
                             <p className="mb-2">
                                 {language === 'ar' 
                                    ? 'في هذا المثال، المنتج P-100 لديه لونين (أحمر، أزرق) ومقاسين (صغير، كبير).' 
                                    : 'In this example, Product P-100 has 2 Colors (Red, Blue) and 2 Sizes (Small, Large).'}
                             </p>
                             <p>
                                 {language === 'ar'
                                    ? 'الأداة ستكتشف أن "أزرق / كبير" مفقود وتقوم بإنشائه تلقائياً لضمان التوازن.'
                                    : 'The tool detects that "Blue / Large" is missing and generates it automatically to balance the variants.'}
                             </p>
                         </div>
                     </div>
                 </div>
             </div>
         )}
         
         <div className="mb-6">
            <label className="block text-sm font-medium text-slate-600 mb-2">{t.common.selectSheet}</label>
            <select 
              className="w-full p-2.5 border rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
            >
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1 border rounded-lg p-3 bg-slate-50">
                <h4 className="font-bold text-xs text-slate-700 uppercase mb-2 flex items-center">
                    <Layers size={14} className="mr-1"/> {t.balance.groupCol}
                </h4>
                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {headers.map((h, i) => (
                        <label key={i} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${groupCol === i ? 'bg-blue-100 text-blue-800 font-bold' : 'hover:bg-slate-200 text-slate-600'}`}>
                            <input 
                                type="radio" 
                                name="groupCol"
                                checked={groupCol === i}
                                onChange={() => { setGroupCol(i); if(optionCols.includes(i)) toggleOptionCol(i); }}
                                className="text-blue-600"
                            />
                            <span className="truncate">{h || `Col ${i+1}`}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-1 border rounded-lg p-3 bg-slate-50">
                <h4 className="font-bold text-xs text-slate-700 uppercase mb-2 flex items-center">
                    <CheckSquare size={14} className="mr-1"/> {t.balance.optionCols}
                </h4>
                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {headers.map((h, i) => (
                        <label key={i} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${optionCols.includes(i) ? 'bg-green-100 text-green-800 font-bold' : 'hover:bg-slate-200 text-slate-600'} ${groupCol === i ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input 
                                type="checkbox" 
                                checked={optionCols.includes(i)}
                                onChange={() => toggleOptionCol(i)}
                                disabled={groupCol === i}
                                className="text-green-600 rounded"
                            />
                            <span className="truncate">{h || `Col ${i+1}`}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-1 border rounded-lg p-3 bg-slate-50">
                <h4 className="font-bold text-xs text-slate-700 uppercase mb-2 flex items-center">
                    <Eraser size={14} className="mr-1"/> {t.balance.clearCols}
                </h4>
                <div className="text-[10px] text-slate-500 mb-2">Auto-selected IDs/SKUs to prevent duplication.</div>
                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {headers.map((h, i) => (
                        <label key={i} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${clearCols.includes(i) ? 'bg-red-100 text-red-800 font-bold' : 'hover:bg-slate-200 text-slate-600'} ${groupCol === i ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input 
                                type="checkbox" 
                                checked={clearCols.includes(i)}
                                onChange={() => toggleClearCol(i)}
                                disabled={groupCol === i}
                                className="text-red-600 rounded"
                            />
                            <span className="truncate">{h || `Col ${i+1}`}</span>
                        </label>
                    ))}
                </div>
            </div>
         </div>

         <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
             <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center">
                 Validation Checks (Optional)
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                        <Type size={12}/> {t.balance.nameCol}
                    </label>
                    <select 
                        className="w-full p-2 border rounded text-xs bg-white"
                        value={nameCol}
                        onChange={(e) => setNameCol(Number(e.target.value))}
                    >
                        <option value="-1">-- None --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                        <Tag size={12}/> {t.balance.catCol}
                    </label>
                    <select 
                        className="w-full p-2 border rounded text-xs bg-white"
                        value={catCol}
                        onChange={(e) => setCatCol(Number(e.target.value))}
                    >
                        <option value="-1">-- None --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                 </div>
             </div>
         </div>
          
          <div className="flex items-center justify-between">
             <button
                onClick={handleProcess}
                disabled={!fileData || status === ProcessingStatus.PROCESSING}
                className={`w-full flex justify-center items-center space-x-2 px-6 py-4 rounded-lg font-bold text-white shadow-md transition-all transform active:scale-95
                ${status === ProcessingStatus.PROCESSING 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
            >
                {status === ProcessingStatus.PROCESSING ? (
                    <>
                        <span className="animate-spin mr-2">⏳</span>
                        <span>{t.common.processing}</span>
                    </>
                ) : (
                    <>
                        <Network size={20} />
                        <span>{cellEdits.size > 0 ? "Regenerate with Edits" : t.common.start}</span>
                    </>
                )}
            </button>
          </div>
       </div>

       {/* GLOBAL ANALYTICS DASHBOARD */}
       {globalStats && (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
               <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                   <div className="bg-blue-100 p-3 rounded-full text-blue-600"><BarChart3 size={24}/></div>
                   <div>
                       <p className="text-xs font-bold text-slate-500 uppercase">Product Health</p>
                       <p className="text-2xl font-bold text-slate-800">
                           {Math.round((globalStats.balancedCount / globalStats.totalProducts) * 100)}%
                       </p>
                       <p className="text-xs text-slate-400">Balanced</p>
                   </div>
               </div>
               
               <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                   <div className="bg-red-100 p-3 rounded-full text-red-600"><AlertCircle size={24}/></div>
                   <div>
                       <p className="text-xs font-bold text-slate-500 uppercase">Action Needed</p>
                       <p className="text-2xl font-bold text-red-600">
                           {globalStats.unbalancedCount}
                       </p>
                       <p className="text-xs text-slate-400">Unbalanced Groups</p>
                   </div>
               </div>
               
               <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                   <div className="bg-purple-100 p-3 rounded-full text-purple-600"><AlertCircle size={24}/></div>
                   <div>
                       <p className="text-xs font-bold text-slate-500 uppercase">Values Cleaned</p>
                       <p className="text-2xl font-bold text-purple-600">
                           {globalStats.invalidCharsReplacedTotal}
                       </p>
                       <p className="text-xs text-slate-400">Invalid Chars Fixed</p>
                   </div>
               </div>

               <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                   <div className="bg-amber-100 p-3 rounded-full text-amber-600"><TrendingUp size={24}/></div>
                   <div className="flex-1">
                       <p className="text-xs font-bold text-slate-500 uppercase mb-1">Top Missing Variants</p>
                       <div className="space-y-1">
                           {globalStats.missingFrequency.slice(0, 2).map((item, idx) => (
                               <div key={idx} className="flex justify-between text-xs">
                                   <span className="font-medium text-slate-700">{item.name}</span>
                                   <span className="bg-slate-100 px-1.5 rounded text-slate-500">{item.count}</span>
                               </div>
                           ))}
                           {globalStats.missingFrequency.length === 0 && <span className="text-xs text-green-600">All Good!</span>}
                       </div>
                   </div>
               </div>
           </div>
       )}

               {/* VISUAL MATRIX GRID */}
        {visualResults.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 mt-8">
                <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                            <LayoutGrid size={20}/>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Visual Matrix Grid</h3>
                            <p className="text-slate-400 text-xs text-left">Click to select/deselect missing variants, right-click to edit price/qty.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium">
                        <span className="flex items-center gap-1.5 bg-green-500/20 px-3 py-1.5 rounded-md text-green-300 border border-green-500/30 font-mono shadow-sm">
                            <CheckCircle2 size={16}/> {visualResults.filter(r => r.status==='Balanced').length}
                        </span>
                        <span className="flex items-center gap-1.5 bg-red-500/20 px-3 py-1.5 rounded-md text-red-300 border border-red-500/30 font-mono shadow-sm">
                            <AlertCircle size={16}/> {visualResults.filter(r => r.status==='Unbalanced').length}
                        </span>
                    </div>
                </div>
                
                <div className="flex h-[600px]">
                    {/* Left Sidebar List */}
                    <div className="w-[300px] border-r border-slate-200 flex flex-col bg-slate-50/50">
                        <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                                <input 
                                    type="text" 
                                    placeholder="Search Products..." 
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={visualSearch}
                                    onChange={e => setVisualSearch(e.target.value)}
                                />
                            </div>
                            <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-medium">
                                <button 
                                   onClick={() => setVisualFilter('Unbalanced')} 
                                   className={`flex-1 py-1.5 rounded-md transition-all ${visualFilter==='Unbalanced' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                   Unbalanced
                                </button>
                                <button 
                                   onClick={() => setVisualFilter('All')} 
                                   className={`flex-1 py-1.5 rounded-md transition-all ${visualFilter==='All' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                   All
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 matrix-scroll">
                            {filteredVisualResults.map(group => {
                                const isSelected = selectedVisualGroup?.key === group.key;
                                return (
                                    <button 
                                        key={group.key}
                                        onClick={() => setSelectedVisualGroup(group)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-2 relative overflow-hidden group/item
                                           ${isSelected ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-500 text-blue-900' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm text-slate-700'}`}
                                    >
                                        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"/>}
                                        
                                        <div className="flex justify-between items-start w-full">
                                            <span className="font-mono text-xs font-bold truncate pr-2" title={group.key}>
                                                {group.key}
                                            </span>
                                            {group.status === 'Unbalanced' 
                                               ? <div className="bg-red-50 border border-red-100 text-red-500 p-1 rounded-md shrink-0"><AlertCircle size={14}/></div>
                                               : <div className="bg-green-50 border border-green-100 text-green-500 p-1 rounded-md shrink-0"><CheckCircle2 size={14}/></div>}
                                        </div>
                                        
                                        <div className="flex justify-between items-center w-full text-xs">
                                            <span className="text-slate-500 font-medium">{group.dimensions.length} Dimensions</span>
                                            {group.status === 'Unbalanced' && (
                                                <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100">Miss: {group.missingCount}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                            {filteredVisualResults.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-8 mt-10 text-slate-400">
                                    <div className="w-12 h-12 bg-white rounded-full border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
                                       <Search size={20} className="text-slate-300"/>
                                    </div>
                                    <p className="text-xs font-medium">No products match</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Matrix View */}
                    <div className="flex-1 bg-white flex flex-col overflow-hidden relative border-l border-slate-200">
                        {selectedVisualGroup ? (
                            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
                                {/* Context Header */}
                                <div className="bg-white px-6 py-5 border-b border-slate-200 shadow-sm z-10 flex flex-col">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Product Matrix</span>
                                        {selectedVisualGroup.status === 'Unbalanced' 
                                         ? <span className="bg-red-100 border border-red-200 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Needs Balance</span>
                                         : <span className="bg-green-100 border border-green-200 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Fully Balanced</span>
                                        }
                                    </div>
                                    <h4 className="font-mono font-bold text-2xl text-slate-800 break-all leading-tight">{selectedVisualGroup.key}</h4>
                                    
                                    <div className="mt-3 flex gap-2 flex-wrap text-sm">
                                        {selectedVisualGroup.dimensions.map((dim, idx) => (
                                            <span key={idx} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-slate-600 shadow-sm">
                                                <Tag size={12} className="text-slate-400"/>
                                                <span className="font-bold">{dim.name}:</span>
                                                <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">{dim.values.length}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-auto p-6 flex flex-col relative layout-grid-bg">
                                    {/* RENDER MATRIX */}
                                    {selectedVisualGroup.dimensions.length === 0 ? (
                                        // Error State (e.g. Static Option)
                                        <div className="flex flex-col items-center justify-center p-10 bg-red-50 border border-red-200 rounded-2xl text-red-800 max-w-lg mx-auto mt-10 shadow-sm">
                                            <div className="w-16 h-16 bg-white rounded-full flex justify-center items-center mb-4 shadow-sm">
                                               <Ban size={32} className="text-red-400"/>
                                            </div>
                                            <h3 className="font-bold text-xl mb-2">Static Option Error Detected</h3>
                                            <p className="text-sm mt-2 text-center opacity-80 leading-relaxed">
                                                One or more option columns have only a single value for this product.<br/>
                                                Variants cannot be generated because options must vary.
                                            </p>
                                        </div>
                                    ) : selectedVisualGroup.dimensions.length === 1 ? (
                                        // 1D View
                                        <div className="w-full max-w-4xl mx-auto space-y-4 pb-10">
                                             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Variant Dimension: <span className="text-blue-600">{selectedVisualGroup.dimensions[0].name}</span></h3>
                                             <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                 {selectedVisualGroup.dimensions[0].values.map(val => {
                                                     const normVal = val.toLowerCase().trim();
                                                     const exists = selectedVisualGroup.hits.has(normVal);
                                                     const fullKey = normVal;
                                                     const uniqueId = `${selectedVisualGroup.key}_${fullKey}`;
                                                     const isMarked = markedCells.has(uniqueId);
                                                     const hasEdit = cellEdits.has(uniqueId);
                                                     
                                                     return (
                                                         <div 
                                                            key={val} 
                                                            onClick={() => !exists && toggleCellMark(uniqueId)}
                                                            onContextMenu={(e) => !exists && handleCellContextMenu(e, uniqueId)}
                                                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group/card flex flex-col h-28 justify-between select-none
                                                              ${exists 
                                                                  ? 'bg-white border-green-100 cursor-default shadow-sm' 
                                                                  : isMarked 
                                                                      ? 'bg-blue-50 border-blue-400 cursor-pointer shadow-blue-500/10 shadow-lg scale-[1.02] z-10' 
                                                                      : 'bg-white border-red-200 border-dashed hover:border-red-400 cursor-pointer hover:shadow-md'}`}
                                                         >
                                                             <div className="flex justify-between items-start">
                                                                <span className={`font-mono text-sm font-bold ${exists ? 'text-slate-500' : 'text-slate-900'}`}>{val}</span>
                                                                {exists 
                                                                  ? <div className="bg-green-50 text-green-500 p-1.5 rounded-md border border-green-100"><CheckSquare size={16}/></div>
                                                                  : isMarked
                                                                    ? <div className="bg-blue-500 text-white p-1.5 rounded-md shadow-sm"><CheckSquare size={16}/></div>
                                                                    : <div className="bg-red-50 text-red-500 p-1.5 rounded-md border border-red-100 group-hover/card:bg-red-100 transition-colors"><span className="text-[10px] px-1 font-bold tracking-wider">ADD</span></div>
                                                                }
                                                             </div>
                                       
                                                             <div className="flex justify-between items-end">
                                                                {hasEdit && (
                                                                   <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold shadow-sm">
                                                                      <Edit size={10}/> EDITED
                                                                   </span>
                                                                )}
                                                                <span className="text-[10px] text-slate-400 group-hover/card:text-slate-500 uppercase font-bold tracking-wider ml-auto">
                                                                   {!exists && !isMarked ? 'Click to Select' : ''}
                                                                   {!exists && isMarked ? 'Selected' : ''}
                                                                   {exists ? 'Exists' : ''}
                                                                </span>
                                                             </div>
                                                         </div>
                                                     );
                                                 })}
                                             </div>
                                         </div>
                                    ) : (
                                        // 2D Matrix (Pivot)
                                        <div className="w-full max-w-full overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col mb-10 mt-2">
                                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Matrix Overview: <span className="text-blue-600">{selectedVisualGroup.dimensions[0].name}</span> × <span className="text-purple-600">{selectedVisualGroup.dimensions.slice(1).map(d => d.name).join(' / ')}</span></h3>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded shadow-sm border border-slate-200">Scroll to view</span>
                                            </div>
                                            <div className="overflow-auto relative max-h-[600px] matrix-scroll">
                                                <table className="w-full text-sm border-collapse min-w-max">
                                                    <thead className="sticky top-0 z-20">
                                                        <tr>
                                                            <th className="p-4 bg-slate-100 border-b border-r border-slate-200 text-slate-500 font-mono text-xs text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-30 sticky left-0 min-w-[140px] uppercase">
                                                                {selectedVisualGroup.dimensions[0].name} ↓
                                                            </th>
                                                            {/* Flatten Columns if dim > 2 */}
                                                            {cartesian(selectedVisualGroup.dimensions.slice(1).map(d => d.values)).map((combo, i) => (
                                                                <th key={i} className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 min-w-[120px] max-w-[200px] text-center shadow-sm relative after:absolute after:bottom-0 after:left-1/4 after:right-1/4 after:h-0.5 after:bg-slate-200 after:rounded-t">
                                                                    {combo.join(' / ')}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-slate-50/30 w-full relative">
                                                        {selectedVisualGroup.dimensions[0].values.map((rowVal, iRow) => (
                                                            <tr key={rowVal} className="group/row hover:bg-slate-50/80 transition-colors">
                                                                <th className={`p-4 bg-white border-r border-slate-200 font-mono text-xs font-bold text-slate-700 text-left min-w-[140px] sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]
                                                                   ${iRow % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                                    {rowVal}
                                                                </th>
                                                                {cartesian(selectedVisualGroup.dimensions.slice(1).map(d => d.values)).map((colCombo, j) => {
                                                                    // Normalized check
                                                                    const fullKey = [rowVal, ...colCombo].map(v => String(v).trim().toLowerCase()).join('|||');
                                                                    const exists = selectedVisualGroup.hits.has(fullKey);
                                                                    const uniqueId = `${selectedVisualGroup.key}_${fullKey}`;
                                                                    const isMarked = markedCells.has(uniqueId);
                                                                    const hasEdit = cellEdits.has(uniqueId);
                                                                    
                                                                    return (
                                                                        <td 
                                                                           key={j} 
                                                                           onClick={() => !exists && toggleCellMark(uniqueId)}
                                                                           onContextMenu={(e) => !exists && handleCellContextMenu(e, uniqueId)}
                                                                           className={`p-3 transition-all relative border-x border-slate-50/50 group-hover/row:border-slate-200 select-none
                                                                             ${exists ? 'bg-white cursor-default' : isMarked ? 'bg-blue-50/80 cursor-pointer pointer-events-auto' : 'bg-red-50/30 cursor-pointer hover:bg-red-50 pointer-events-auto'}`}
                                                                        >
                                                                            <div className={`p-3 rounded-xl flex flex-col items-center justify-center min-h-[70px] border-2 transition-all mx-auto
                                                                               ${exists ? 'border-transparent text-slate-300' : isMarked ? 'border-blue-400 bg-white shadow-sm text-blue-600 scale-[1.05] relative z-10' : 'border-red-200 border-dashed bg-white text-red-500 hover:border-red-400'}`}>
                                                                               {exists 
                                                                                 ? <CheckSquare size={20} className="text-green-500/30"/> 
                                                                                 : isMarked 
                                                                                   ? <CheckSquare size={20}/> 
                                                                                   : <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">+ Add</span>}
                                                                               
                                                                               {hasEdit && (
                                                                                  <span className="absolute -top-2 -right-2 text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded border border-purple-600 font-bold shadow-sm">
                                                                                     EDIT
                                                                                  </span>
                                                                               )}
                                                                               {hasEdit && !exists && (
                                                                                   <div className="absolute bottom-1 text-[8px] text-purple-600 font-bold tracking-wider">
                                                                                       EDITED
                                                                                   </div>
                                                                               )}
                                                                            </div>
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
                            </div>
                        ) : (
                            // Empty State
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 animate-in fade-in zoom-in-95 p-10">
                                <div className="w-24 h-24 mb-6 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white shadow-sm">
                                    <Layers size={32} className="text-slate-300"/>
                                </div>
                                <h3 className="text-xl font-bold text-slate-600 mb-2">Select a Product Matrix</h3>
                                <p className="text-sm max-w-[250px] text-center">Choose a product from the list to view its dimensional balance matrix and edit variants.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        {/* CONTEXT MENU */}
       {contextMenu && (
           <div 
             ref={contextMenuRef}
             style={{ top: contextMenu.y, left: contextMenu.x }}
             className="fixed bg-white border border-slate-200 shadow-xl rounded-md z-50 py-1 w-40 animate-in fade-in zoom-in-95 duration-100"
           >
               <button 
                 onClick={openEditModal}
                 className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
               >
                   <Edit size={14}/> Edit Variant Details
               </button>
           </div>
       )}

       {/* EDIT MODAL */}
       {editModal && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                   <h3 className="font-bold text-lg mb-4 text-slate-800">Edit Missing Variant</h3>
                   <div className="space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price Override</label>
                           <input 
                             type="text" 
                             className="w-full p-2 border rounded"
                             placeholder="e.g. 150"
                             value={editModal.price}
                             onChange={e => setEditModal({...editModal, price: e.target.value})}
                           />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity Override</label>
                           <input 
                             type="text" 
                             className="w-full p-2 border rounded"
                             placeholder="e.g. 10"
                             value={editModal.qty}
                             onChange={e => setEditModal({...editModal, qty: e.target.value})}
                           />
                       </div>
                   </div>
                   <div className="flex justify-end gap-2 mt-6">
                       <button onClick={() => setEditModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                       <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex items-center gap-2">
                           <Save size={16}/> Save
                       </button>
                   </div>
               </div>
           </div>
       )}

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default VariableBalanceTab;
