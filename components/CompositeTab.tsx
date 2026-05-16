
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook, cloneWorkbook, readExcelFile } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  ShieldCheck, CheckCircle2, AlertCircle, AlignLeft, SearchCode, 
  DollarSign, Calculator, TrendingUp, Percent, TreeDeciduous, 
  X, CircleDollarSign, AlertTriangle, Coins, FileWarning, Download,
  Map as MapIcon, UploadCloud, ArrowRight, FileSpreadsheet, Settings
} from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

// --- TYPES ---
interface Ingredient {
  sku: string;
  qty: number;
  unitCost: number;
  name?: string;
}

interface BomProduct {
  rowIdx: number;
  sku: string;
  name: string;
  retailPrice: number;
  ingredients: Ingredient[];
  baseTotalCost: number;
}

interface SimulationResult {
  sku: string;
  name: string;
  retailPrice: number;
  adjustedCost: number;
  marginPercent: number;
  profit: number;
  isRisk: boolean;
}

// Simple Levenshtein Distance Algorithm
const getEditDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const translateErrorToArabic = (errorMsg: string): string => {
    if (errorMsg.includes("Conflict: Composite SKU")) return "تعارض: رمز المنتج المركب موجود أيضاً كمادة خام";
    if (errorMsg.includes("Too many ingredients")) return "عدد المكونات كبير جداً (الحد الأقصى 30)";
    if (errorMsg.includes("Missing Product Definition")) return "بيانات المنتج الأساسية مفقودة (الاسم أو الرمز)";
    if (errorMsg.includes("Missing Product Name")) return "اسم المنتج مفقود";
    if (errorMsg.includes("Missing Qty for Ingredient")) {
        const match = errorMsg.match(/'([^']+)'/);
        return `الكمية مفقودة للمكون '${match ? match[1] : ''}'`;
    }
    if (errorMsg.includes("Missing SKU for Qty")) {
        const match = errorMsg.match(/'([^']+)'/);
        return `رمز المكون مفقود للكمية '${match ? match[1] : ''}'`;
    }
    if (errorMsg.includes("Non-numeric Qty")) {
        const match = errorMsg.match(/'([^']+)'/);
        return `الكمية غير صحيحة (يجب أن تكون رقماً) '${match ? match[1] : ''}'`;
    }
    if (errorMsg.includes("Possible Typo:")) {
        const matches = errorMsg.match(/'([^']+)'/g);
        if (matches && matches.length >= 2) {
            return `خطأ إملائي محتمل: ${matches[0]} هل تقصد ${matches[1]}؟`;
        }
        return "خطأ إملائي محتمل في رمز المكون";
    }
    if (errorMsg.includes("missing") && errorMsg.startsWith("SKU")) {
        const match = errorMsg.match(/'([^']+)'/);
        return `رمز المكون '${match ? match[1] : ''}' غير موجود في قائمة المواد الخام`;
    }
    if (errorMsg.includes("Circular Dependency")) {
        const match = errorMsg.match(/'([^']+)'/);
        return `خطأ دائري: المكون '${match ? match[1] : ''}' هو نفس رمز المنتج`;
    }
    if (errorMsg.includes("Duplicate SKU")) {
        const match = errorMsg.match(/'([^']+)'/);
        return `رمز المكون '${match ? match[1] : ''}' مكرر في نفس المنتج`;
    }
    return "خطأ في البيانات";
};

const CompositeTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'validate' | 'analysis'>('validate');
  
  const [selectedCols, setSelectedCols] = useState<number[]>([]);
  const [compositeSheet, setCompositeSheet] = useState<string>('');
  const [rawSheet, setRawSheet] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  
  const [summary, setSummary] = useState<{ total: number; errors: number } | null>(null);
  
  // Validation Settings
  const [autoAlign, setAutoAlign] = useState<boolean>(true);
  const [fixedColCount, setFixedColCount] = useState<number>(4); // Default to 4 fixed columns
  const [strictEmptyCheck, setStrictEmptyCheck] = useState<boolean>(true); // Changed to true by default to catch skipped columns/missing quantities
  
  const [enableFuzzy, setEnableFuzzy] = useState<boolean>(false);
  const [fuzzyThreshold, setFuzzyThreshold] = useState<number>(2);

  // Cost Logic State
  const [rawSkuCol, setRawSkuCol] = useState<number>(-1);
  const [costCol, setCostCol] = useState<number>(-1);
  const [rawNameCol, setRawNameCol] = useState<number>(-1); // New Name Mapping
  const [retailPriceCol, setRetailPriceCol] = useState<number>(-1);

  // Simulator State
  const [bomData, setBomData] = useState<BomProduct[]>([]);
  const [targetMargin, setTargetMargin] = useState<number>(30); // 30% default
  const [costFluctuation, setCostFluctuation] = useState<number>(0); // 0% increase
  const [visualizerItem, setVisualizerItem] = useState<BomProduct | null>(null);

  // --- MAPPING & EXPORT STATE ---
  const [showMapping, setShowMapping] = useState<boolean>(false);
  const [templateFile, setTemplateFile] = useState<FileData | null>(null);
  const [templateHeaders, setTemplateHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // Template Header -> Source Header
  const [processedRowsCache, setProcessedRowsCache] = useState<any[][]>([]); // Store validated rows for mapping export

  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      setRawSheet(fileData.sheets[0]);
      if (fileData.sheets.length > 1) {
        setCompositeSheet(fileData.sheets[1]);
      } else {
        setCompositeSheet('');
      }
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && compositeSheet) {
      const data = getSheetData(fileData.workbook, compositeSheet);
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
      }
    }
  }, [fileData, compositeSheet]);

  useEffect(() => {
    if (fileData && rawSheet) {
        const data = getSheetData(fileData.workbook, rawSheet);
        if (data.length > 0) {
            setRawHeaders(data[0] as string[]);
            setRawSkuCol(-1);
            setCostCol(-1);
            setRawNameCol(-1);
        }
    }
  }, [fileData, rawSheet]);

  const toggleColumn = (idx: number) => {
    setSelectedCols(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSelectAll = () => {
    if (selectedCols.length === headers.length) {
      setSelectedCols([]);
      setSummary(null);
    } else {
      setSelectedCols(headers.map((_, idx) => idx));
      setSummary(null);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const tData = await readExcelFile(file);
          if (tData.sheets.length > 0) {
              const rows = getSheetData(tData.workbook, tData.sheets[0], false);
              if (rows.length > 0) {
                  const tHead = rows[0] as string[];
                  setTemplateFile(tData);
                  setTemplateHeaders(tHead);
                  
                  // Auto-map
                  const newMap: Record<string, string> = {};
                  tHead.forEach(th => {
                      const match = headers.find(h => h && String(h).toLowerCase() === String(th).toLowerCase());
                      if (match) newMap[th] = match;
                  });
                  setMapping(newMap);
                  addLog("Template loaded. Please configure mapping.", 'info');
              }
          }
      } catch (err: any) {
          addLog(`Template Error: ${err.message}`, 'error');
      }
  };

  const handleCustomExport = () => {
      if (!processedRowsCache.length || !templateHeaders.length) {
          addLog("No processed data or template available.", 'warning');
          return;
      }

      const mapRows = (sourceRows: any[][], sourceHeader: string[]) => {
          return sourceRows.map(row => {
              return templateHeaders.map(th => {
                  const sourceColName = mapping[th];
                  if (!sourceColName) return "";
                  const idx = sourceHeader.indexOf(sourceColName);
                  return idx !== -1 ? row[idx] : "";
              });
          });
      };

      const newWb = XLSX.utils.book_new();
      const mappedData = mapRows(processedRowsCache, headers); // headers is current source header
      
      const ws = XLSX.utils.aoa_to_sheet([templateHeaders, ...mappedData]);
      XLSX.utils.book_append_sheet(newWb, ws, "Mapped Composite");
      saveWorkbook(newWb, `Mapped_Composite_${Date.now()}.xlsx`);
      addLog("Custom mapped file exported.", 'success');
  };

  const handleProcess = async () => {
    if (!fileData) return;
    if (!compositeSheet || !rawSheet) {
      addLog("Please select both Composite and Raw sheets.", 'error');
      return;
    }
    
    // Validation specifics
    if (activeTab === 'validate' && selectedCols.length === 0) {
      addLog("Select columns to validate.", 'warning');
      return;
    }

    // Analysis specifics
    if (activeTab === 'analysis') {
        if (rawSkuCol === -1 || costCol === -1) {
            addLog("Please map Raw SKU and Cost columns.", 'warning');
            return;
        }
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    setSummary(null);
    setBomData([]); 
    addLog(activeTab === 'validate' ? t.common.processing : "Analyzing Financials...", 'info');

    try {
      await new Promise(r => setTimeout(r, 50));

      const compData = getSheetData(fileData.workbook, compositeSheet);
      const rawData = getSheetData(fileData.workbook, rawSheet);

      const rawMaterialsSet = new Set<string>();
      const rawMaterialsArr: string[] = [];
      const skuCostMap = new Map<string, number>();
      const skuNameMap = new Map<string, string>(); 

      // 1. Build Lookup Maps (Existence, Cost, Name)
      const validRawRows = rawData.slice(1).filter(row => {
          return row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== "");
      });

      validRawRows.forEach(row => {
        if (rawSkuCol !== -1) {
            const val = String(row[rawSkuCol] || "").trim();
            if (val) {
                rawMaterialsSet.add(val);
                if (enableFuzzy) rawMaterialsArr.push(val);
                
                if (activeTab === 'analysis') {
                    if (costCol !== -1) {
                        const costVal = String(row[costCol] || "0").replace(/[^0-9.]/g, '');
                        skuCostMap.set(val, parseFloat(costVal) || 0);
                    }
                    if (rawNameCol !== -1) {
                        const nameVal = String(row[rawNameCol] || "").trim();
                        skuNameMap.set(val, nameVal);
                    }
                }
            }
        } else {
            // Legacy loose lookup
            row.forEach(cell => {
                if (cell) {
                    const val = String(cell).trim();
                    rawMaterialsSet.add(val);
                    if (enableFuzzy) rawMaterialsArr.push(val);
                }
            });
        }
      });

      const compHeader = compData[0];
      let compRows = compData.slice(1).filter(row => {
          return row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== "");
      });
      
      // TRACKING FOR SUMMARY REPORT
      const shiftLog: string[] = [];
      let shiftedCellCount = 0;
      const materialUsage = new Map<string, number>();

      // Auto Align Logic with Tracking
      if (activeTab === 'validate' && autoAlign) {
         compRows = compRows.map((row, rIdx) => {
            const fixedCount = fixedColCount;
            const fixed = row.slice(0, fixedCount);
            // Ensure fixed part exists
            while(fixed.length < fixedCount) fixed.push("");

            const dynamic = row.slice(fixedCount);
            const pairs: any[] = [];
            let keptPairIndex = 0;
            
            for (let i = 0; i < dynamic.length; i += 2) {
               const sku = dynamic[i];
               const qty = dynamic[i+1];
               const isSkuEmpty = sku === undefined || sku === null || String(sku).trim() === "";
               const isQtyEmpty = qty === undefined || qty === null || String(qty).trim() === "";
               
               if (!isSkuEmpty || !isQtyEmpty) {
                   // Detect Shift
                   if (i !== keptPairIndex * 2) {
                       const oldCol = fixedCount + i + 1;
                       const newCol = fixedCount + (keptPairIndex * 2) + 1;
                       // Simplified shift log
                       if (shiftLog.length < 5000) { // Limit log size
                           shiftLog.push(`Row ${rIdx + 2}: Item '${sku || "(qty only)"}' shifted from Col ${oldCol} to ${newCol}`);
                       }
                       shiftedCellCount++;
                   }
                   pairs.push(sku !== undefined ? sku : "", qty !== undefined ? qty : "");
                   keptPairIndex++;
               }
            }
            return [...fixed, ...pairs];
         });
      }
      
      // Calculate Material Usage (Post-Align)
      if (activeTab === 'validate') {
          compRows.forEach(row => {
              for (let k = fixedColCount; k < row.length; k += 2) {
                  const sku = String(row[k] || "").trim();
                  if (sku) {
                      materialUsage.set(sku, (materialUsage.get(sku) || 0) + 1);
                  }
              }
          });
      }

      const errorRows: { rowData: any[], errors: string[], locations: string[], rowIndex: number }[] = [];
      const errorRowIndices = new Set<number>();
      const parsedBomProducts: BomProduct[] = [];
      
      // NEW: Tracking for Raw vs Composite Collisions
      const skuConflictRows: any[][] = [["Composite SKU", "Product Name", "Conflict Type", "Row Number"]];

      if (activeTab === 'analysis') {
          compHeader.push("Calculated Cost");
      }

      const totalRows = compRows.length;
      const chunkSize = 100;
      
      for (let i = 0; i < totalRows; i += chunkSize) {
         const end = Math.min(i + chunkSize, totalRows);
         const chunk = compRows.slice(i, end);
         
         chunk.forEach((row, cIdx) => {
            const idx = i + cIdx;
            const rowErrors: string[] = [];
            const rowLocations: string[] = [];

            const getCellRef = (colIdx: number) => XLSX.utils.encode_cell({ r: idx + 1, c: colIdx });
            
            // --- ANALYSIS MODE ---
            if (activeTab === 'analysis') {
                let rowTotalCost = 0;
                const rowIngredients: Ingredient[] = [];
                const startIdx = fixedColCount;
                
                for (let k = startIdx; k < row.length; k += 2) {
                    const sku = String(row[k] || "").trim();
                    const qty = parseFloat(row[k+1]) || 0;
                    if (sku) {
                        const unitCost = skuCostMap.get(sku) || 0;
                        const ingName = skuNameMap.get(sku) || "";
                        rowTotalCost += unitCost * qty;
                        rowIngredients.push({ sku, qty, unitCost, name: ingName });
                    }
                }
                row.push(rowTotalCost); 

                const prodName = String(row[0] || `Product ${idx+1}`).trim(); 
                const prodSku = String(row[1] || "").trim(); 
                let retailPrice = 0;
                if (retailPriceCol !== -1) {
                    const priceStr = String(row[retailPriceCol] || "0").replace(/[^0-9.]/g, '');
                    retailPrice = parseFloat(priceStr) || 0;
                }
                
                parsedBomProducts.push({
                    rowIdx: idx,
                    sku: prodSku,
                    name: prodName,
                    retailPrice: retailPrice,
                    ingredients: rowIngredients,
                    baseTotalCost: rowTotalCost
                });
            }

            // --- VALIDATION MODE ---
            if (activeTab === 'validate') {
                const rowVals: {col: number, val: string}[] = [];
                // CRITICAL FIX: Automatically include all columns for validation so users don't miss errors by forgetting to select columns.
                row.forEach((val, colIdx) => {
                   rowVals.push({col: colIdx, val: String(val || "").trim()});
                });

                // Identify Parent SKU from column 1 (usually SKU)
                const parentSku = String(row[1] || "").trim(); 
                const parentName = String(row[0] || "").trim();

                // Check for SKU Collision (Composite SKU exists in Raw Materials)
                if (parentSku && rawMaterialsSet.has(parentSku)) {
                    const msg = `Conflict: Composite SKU '${parentSku}' is also defined as a Raw Material`;
                    rowErrors.push(msg);
                    rowLocations.push(getCellRef(1));
                    skuConflictRows.push([parentSku, parentName, "Duplicate in Raw Materials", idx + 1]);
                }

                let pairCount = 0;
                for (let k = fixedColCount; k < row.length; k += 2) {
                    const iSku = String(row[k] || "").trim();
                    const iQty = String(row[k+1] || "").trim();
                    if (iSku || iQty) {
                        pairCount++;
                    }
                }
                
                if (pairCount > 30) {
                    rowErrors.push(`Too many ingredients (${pairCount}). Max allowed is 30.`);
                    rowLocations.push(getCellRef(fixedColCount + 60)); 
                }

                if (strictEmptyCheck) {
                    const pName = String(row[0] || "").trim();
                    const pSku = String(row[1] || "").trim();
                    
                    if (fixedColCount >= 2 && (!pName || !pSku)) {
                        rowErrors.push("Missing Product Definition (Name or SKU in Col 1/2)");
                        if(!pName) rowLocations.push(getCellRef(0));
                        if(!pSku) rowLocations.push(getCellRef(1));
                    } else if (fixedColCount >= 1 && !pName) {
                        rowErrors.push("Missing Product Name (Col 1)");
                        rowLocations.push(getCellRef(0));
                    }

                    for (let k = fixedColCount; k < row.length; k += 2) {
                        const iSku = String(row[k] || "").trim();
                        const iQty = String(row[k+1] || "").trim();
                        
                        if (iSku && !iQty) {
                            rowErrors.push(`Missing Qty for Ingredient '${iSku}'`);
                            rowLocations.push(getCellRef(k+1));
                        }
                        if (!iSku && iQty) {
                            rowErrors.push(`Missing SKU for Qty '${iQty}'`);
                            rowLocations.push(getCellRef(k));
                        }
                    }
                }

                rowVals.forEach(item => {
                   if (item.col >= fixedColCount) {
                      const relativeIdx = item.col - fixedColCount;
                      const isQtyCol = relativeIdx % 2 !== 0;

                      if (isQtyCol && item.val && isNaN(Number(item.val))) {
                         rowErrors.push(`Non-numeric Qty '${item.val}'`);
                         rowLocations.push(getCellRef(item.col));
                      }
                   }
                });

                rowVals.forEach(item => {
                   if (item.col >= fixedColCount && (item.col - fixedColCount) % 2 === 0) { 
                       // Check Existence
                       if (item.val && !rawMaterialsSet.has(item.val)) {
                          let errorMsg = `SKU '${item.val}' missing`;

                          if (enableFuzzy && rawMaterialsArr.length > 0) {
                            let bestMatch = "";
                            let minDist = Infinity;
                            
                            if (item.val.length > 2) {
                               for (const rawSku of rawMaterialsArr) {
                                  if (Math.abs(rawSku.length - item.val.length) > fuzzyThreshold) continue;
                                  const dist = getEditDistance(item.val, rawSku);
                                  if (dist < minDist) {
                                     minDist = dist;
                                     bestMatch = rawSku;
                                  }
                                  if (minDist === 1) break; 
                               }
                            }

                            if (minDist <= fuzzyThreshold) {
                               errorMsg = `Possible Typo: '${item.val}'? Did you mean '${bestMatch}'?`;
                            }
                          }
                          rowErrors.push(errorMsg);
                          rowLocations.push(getCellRef(item.col));
                       }

                       // Check Circular Dependency
                       if (item.val && parentSku && item.val === parentSku) {
                           rowErrors.push(`Circular Dependency: Ingredient '${item.val}' matches Product SKU`);
                           rowLocations.push(getCellRef(item.col));
                       }
                   }
                });
                
                const seenInRow = new Set<string>();
                 rowVals.forEach(item => {
                   if (item.col >= fixedColCount && (item.col - fixedColCount) % 2 === 0 && item.val) { 
                     if (seenInRow.has(item.val)) {
                        rowErrors.push(`Duplicate SKU '${item.val}'`);
                        rowLocations.push(getCellRef(item.col));
                     }
                     seenInRow.add(item.val);
                   }
                });

                if (rowErrors.length > 0) {
                  errorRows.push({
                    rowData: row,
                    errors: rowErrors,
                    locations: rowLocations,
                    rowIndex: idx
                  });
                  errorRowIndices.add(idx);
                }
            }
         });

         const currentProgress = Math.round((end / totalRows) * 100);
         setProgress(currentProgress);
         await new Promise(r => setTimeout(r, 0));
      }

      if (activeTab === 'analysis') {
          setBomData(parsedBomProducts);
          addLog("Cost Analysis Complete. Dashboard Updated.", 'success');
      }

      if (activeTab === 'validate') {
          setSummary({
            total: compRows.length,
            errors: errorRows.length
          });
          setProcessedRowsCache(compRows); // Cache for mapping

          // Generate Result File
          const newWb = cloneWorkbook(fileData.workbook);
          const finalData = [compHeader, ...compRows];
          const newWs = XLSX.utils.aoa_to_sheet(finalData);
          
          if (errorRowIndices.size > 0) {
            const range = XLSX.utils.decode_range(newWs['!ref'] || "A1");
            errorRowIndices.forEach(rowIndex => {
                 const actualRowIdx = rowIndex + 1;
                 for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: actualRowIdx, c: C });
                    if (!newWs[cellRef]) newWs[cellRef] = { v: "", t: "s" }; 
                    if (!newWs[cellRef].s) newWs[cellRef].s = {};
                    newWs[cellRef].s.fill = { fgColor: { rgb: "FFC7CE" } };
                    newWs[cellRef].s.font = { color: { rgb: "9C0006" } };
                 }
             });
          }

          newWb.Sheets[compositeSheet] = newWs;

          if (errorRows.length > 0) {
            const errorHeader = [...compHeader, "Error Description", "وصف الخطأ (عربي)", "Error Location"];
            const errorSheetData = [errorHeader];
            errorRows.forEach(err => {
               const newRow = [...err.rowData];
               while(newRow.length < compHeader.length) newRow.push("");
               newRow.push(err.errors.join(", "));
               newRow.push(err.errors.map(e => translateErrorToArabic(e)).join(", "));
               newRow.push(err.locations.join(", "));
               errorSheetData.push(newRow);
            });
            const errorWs = XLSX.utils.aoa_to_sheet(errorSheetData);
            XLSX.utils.book_append_sheet(newWb, errorWs, "Validation Errors");
          }

          // NEW: Raw vs Composite Conflicts Sheet
          if (skuConflictRows.length > 1) {
              const conflictWs = XLSX.utils.aoa_to_sheet(skuConflictRows);
              if(conflictWs['!ref']) {
                  const range = XLSX.utils.decode_range(conflictWs['!ref']);
                  for(let C=range.s.c; C<=range.e.c; ++C) {
                      const ref = XLSX.utils.encode_cell({r:0, c:C});
                      if(!conflictWs[ref]) continue;
                      if(!conflictWs[ref].s) conflictWs[ref].s = {};
                      conflictWs[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "C00000" } } };
                  }
                  conflictWs['!cols'] = [{wch: 20}, {wch: 40}, {wch: 30}, {wch: 10}];
              }
              XLSX.utils.book_append_sheet(newWb, conflictWs, "Raw vs Composite Conflicts");
          }

          // --- NEW: Valid Products Sheet ---
          const validRows = compRows.filter((_, idx) => !errorRowIndices.has(idx));
          if (validRows.length > 0) {
              const validWs = XLSX.utils.aoa_to_sheet([compHeader, ...validRows]);
              if(validWs['!ref']) {
                  const range = XLSX.utils.decode_range(validWs['!ref']);
                  for(let C=range.s.c; C<=range.e.c; ++C) {
                      const ref = XLSX.utils.encode_cell({r:0, c:C});
                      if(!validWs[ref].s) validWs[ref].s = {};
                      validWs[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "059669" } } };
                  }
              }
              XLSX.utils.book_append_sheet(newWb, validWs, "Valid Products");
          }

          // --- NEW: Summary Sheet ---
          const summaryWsData = [
              ["Validation Summary Report"],
              ["Date", new Date().toLocaleString()],
              [],
              ["--- SHIFT STATISTICS ---"],
              ["Total Rows Processed", compRows.length],
              ["Total Shifted Cells (Auto-Aligned)", shiftedCellCount || 0],
              [],
              ["--- SHIFT DETAILS (Log) ---"],
              ["Log Message"],
              ...(shiftLog.length > 0 ? shiftLog.map(s => [s]) : [["No shifts occurred."]]),
              [],
              ["--- RAW MATERIAL USAGE FREQUENCY ---"],
              ["SKU", "Usage Count"],
              ...Array.from(materialUsage.entries()).sort((a,b) => b[1] - a[1]).map(([sku, count]) => [sku, count])
          ];
          const summaryWs = XLSX.utils.aoa_to_sheet(summaryWsData);
          // Style headers
          if(summaryWs['!ref']) {
              const range = XLSX.utils.decode_range(summaryWs['!ref']);
              summaryWs['!cols'] = [{ wch: 60 }, { wch: 15 }];
              const boldRows = [0, 3, 7, 11];
              boldRows.forEach(r => {
                  if (r <= range.e.r) {
                      const ref = XLSX.utils.encode_cell({r, c:0});
                      if(!summaryWs[ref]) return;
                      if(!summaryWs[ref].s) summaryWs[ref].s = {};
                      summaryWs[ref].s = { font: { bold: true, color: { rgb: "2563EB" } } };
                  }
              });
          }
          XLSX.utils.book_append_sheet(newWb, summaryWs, "Summary");
          
          saveWorkbook(newWb, `Validated_${fileData.name}`);
          addLog(errorRows.length > 0 ? `Found ${errorRows.length} errors.` : t.common.completed, errorRows.length > 0 ? 'warning' : 'success');
      }
      
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  // ... (Keep Profit Simulator Code unchanged) ...
  const simulationResults: SimulationResult[] = useMemo(() => {
      return bomData.map(product => {
          let adjustedCost = 0;
          product.ingredients.forEach(ing => {
              const adjustedUnitCost = ing.unitCost * (1 + costFluctuation / 100);
              adjustedCost += adjustedUnitCost * ing.qty;
          });

          if (product.ingredients.length === 0) adjustedCost = product.baseTotalCost * (1 + costFluctuation / 100);

          const retail = product.retailPrice || 0;
          const profit = retail - adjustedCost;
          const marginPercent = retail > 0 ? (profit / retail) * 100 : 0;
          
          return {
              sku: product.sku,
              name: product.name,
              retailPrice: retail,
              adjustedCost,
              profit,
              marginPercent,
              isRisk: marginPercent < targetMargin
          };
      });
  }, [bomData, targetMargin, costFluctuation]);

  const stats = useMemo(() => {
      const risky = simulationResults.filter(r => r.isRisk);
      const profitable = simulationResults.filter(r => !r.isRisk);
      return {
          riskyCount: risky.length,
          safeCount: profitable.length,
          avgMargin: simulationResults.length > 0 
            ? simulationResults.reduce((sum, r) => sum + r.marginPercent, 0) / simulationResults.length 
            : 0
      };
  }, [simulationResults]);

  const handleExportAnalysis = () => {
      if (simulationResults.length === 0) return;

      const wb = XLSX.utils.book_new();

      // Sheet 1: Analysis Summary
      const summaryHeader = ["Product Name", "SKU", "Retail Price", "Projected Cost", "Profit", "Margin %", "Status"];
      const summaryData: any[][] = [summaryHeader];

      simulationResults.forEach(item => {
          summaryData.push([
              item.name,
              item.sku,
              item.retailPrice,
              item.adjustedCost,
              item.profit,
              `${item.marginPercent.toFixed(2)}%`,
              item.isRisk ? "At Risk" : "Profitable"
          ]);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Profit Analysis");

      const bomHeader = ["Product Name", "Product SKU", "Ingredient SKU", "Ingredient Name", "Quantity", "Unit Cost", "Line Cost"];
      const bomRows: any[][] = [bomHeader];

      bomData.forEach(prod => {
          if (prod.ingredients.length === 0) {
               bomRows.push([prod.name, prod.sku, "(No Ingredients)", "", 0, 0, prod.baseTotalCost]);
          } else {
              prod.ingredients.forEach(ing => {
                  bomRows.push([
                      prod.name,
                      prod.sku,
                      ing.sku,
                      ing.name,
                      ing.qty,
                      ing.unitCost,
                      ing.qty * ing.unitCost
                  ]);
              });
          }
      });

      const wsBom = XLSX.utils.aoa_to_sheet(bomRows);
      wsBom['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsBom, "Detailed BOM");

      saveWorkbook(wb, `Cost_Analysis_${Date.now()}.xlsx`);
      addLog("Analysis exported successfully.", 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOP CONFIGURATION (COMMON) */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
         <h3 className="font-bold text-slate-700 mb-4">{t.common.config}</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.composite.compSheet}</label>
                <select 
                  className="w-full p-2 border rounded text-sm bg-slate-50"
                  value={compositeSheet}
                  onChange={(e) => {
                    setCompositeSheet(e.target.value);
                    setSelectedCols([]);
                    setSummary(null);
                    setBomData([]);
                    setProcessedRowsCache([]);
                  }}
                >
                  <option value="">{t.common.selectSheet}...</option>
                  {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.composite.rawSheet}</label>
                <select 
                  className="w-full p-2 border rounded text-sm bg-slate-50"
                  value={rawSheet}
                  onChange={(e) => {
                    setRawSheet(e.target.value);
                    setSummary(null);
                    setBomData([]);
                  }}
                >
                  <option value="">{t.common.selectSheet}...</option>
                  {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
         </div>
      </div>

      {/* 2. MODE TABS */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('validate')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'validate' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShieldCheck size={16} />
          <span>Structure Validator</span>
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Coins size={16} />
          <span>Cost & Profit Analyzer</span>
        </button>
      </div>

      {/* 3. MODE SPECIFIC CONTENT */}
      {activeTab === 'validate' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Validation Settings */}
                  <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <label className="block text-sm font-bold text-slate-700 mb-2">Validation Settings</label>
                          <div className="space-y-3">
                             <div className="flex items-start space-x-2">
                                <label className="flex items-center space-x-2 cursor-pointer mt-1">
                                    <input 
                                      type="checkbox" 
                                      checked={autoAlign} 
                                      onChange={(e) => setAutoAlign(e.target.checked)}
                                      className="text-teal-600 rounded"
                                    />
                                </label>
                                <div className="text-sm flex-1">
                                  <span className="font-semibold flex items-center gap-1">
                                    <AlignLeft size={16} /> 
                                    {t.composite.autoAlign}
                                  </span>
                                  <p className="text-xs text-slate-500 mb-2">Remove empty columns to compact data.</p>
                                  
                                  {autoAlign && (
                                      <div className="flex items-center gap-2 mt-1 animate-in fade-in">
                                          <label className="text-xs font-bold text-slate-600">Fixed Header Cols:</label>
                                          <input 
                                            type="number" 
                                            min="1" 
                                            max="20" 
                                            className="w-12 p-1 border rounded text-xs text-center font-bold"
                                            value={fixedColCount}
                                            onChange={(e) => setFixedColCount(Math.max(1, parseInt(e.target.value) || 4))}
                                          />
                                      </div>
                                  )}
                                </div>
                             </div>

                             <div className="flex items-start space-x-2 mt-1">
                                <label className="flex items-center space-x-2 cursor-pointer mt-1">
                                    <input 
                                      type="checkbox" 
                                      checked={strictEmptyCheck} 
                                      onChange={(e) => setStrictEmptyCheck(e.target.checked)}
                                      className="text-red-600 rounded focus:ring-red-500"
                                    />
                                </label>
                                <div className="text-sm flex-1">
                                  <span className="font-semibold flex items-center gap-1 text-red-800">
                                    <FileWarning size={16} /> 
                                    Strict Empty Check
                                  </span>
                                  <p className="text-xs text-slate-500">Flag rows with missing Name/SKU or incomplete ingredient pairs.</p>
                                </div>
                             </div>

                             <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 mt-2">
                               <label className="flex items-start space-x-2 cursor-pointer mb-2">
                                  <input 
                                    type="checkbox" 
                                    checked={enableFuzzy} 
                                    onChange={(e) => setEnableFuzzy(e.target.checked)}
                                    className="mt-1 text-indigo-600 rounded"
                                  />
                                  <div className="text-sm">
                                    <span className="font-semibold flex items-center gap-1 text-indigo-800">
                                      <SearchCode size={16} /> 
                                      {t.composite.fuzzy}
                                    </span>
                                  </div>
                               </label>
                               
                               {enableFuzzy && (
                                  <div className="ml-6 flex items-center space-x-2">
                                     <span className="text-xs font-semibold text-indigo-700">{t.composite.tolerance}:</span>
                                     <select 
                                       value={fuzzyThreshold}
                                       onChange={(e) => setFuzzyThreshold(Number(e.target.value))}
                                       className="p-1 border border-indigo-200 rounded text-xs bg-white"
                                     >
                                        <option value={1}>1</option>
                                        <option value={2}>2</option>
                                        <option value={3}>3</option>
                                     </select>
                                  </div>
                               )}
                             </div>
                          </div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Required Mapping</label>
                          <div className="mb-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Raw Sheet SKU Column</label>
                            <select 
                                className="w-full p-2 border rounded text-xs bg-white"
                                value={rawSkuCol}
                                onChange={(e) => setRawSkuCol(Number(e.target.value))}
                            >
                                <option value="-1">Auto-Detect / All Columns</option>
                                {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                            </select>
                          </div>
                      </div>
                  </div>

                  {/* Right: Column Selector */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col h-80">
                       <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-slate-700">{t.common.selectCols}</h3>
                         <button
                           onClick={handleSelectAll}
                           disabled={headers.length === 0}
                           className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
                         >
                           {selectedCols.length === headers.length && headers.length > 0 ? t.common.reset : t.common.selected}
                         </button>
                       </div>
                       <div className="flex-1 overflow-y-auto border border-slate-100 rounded p-2 bg-slate-50">
                         {headers.map((header, idx) => (
                           <label key={idx} className="flex items-center space-x-2 p-1 hover:bg-slate-100 rounded cursor-pointer">
                             <input 
                                type="checkbox"
                                checked={selectedCols.includes(idx)}
                                onChange={() => { toggleColumn(idx); setSummary(null); }}
                                className="rounded text-blue-600"
                             />
                             <span className="text-sm text-slate-700 truncate" title={String(header)}>
                               {idx + 1}. {header || `(Empty)`}
                             </span>
                           </label>
                         ))}
                       </div>
                  </div>
              </div>

              {/* Action */}
              <div className="flex items-center gap-4">
                  <button
                    onClick={handleProcess}
                    disabled={!fileData || status === ProcessingStatus.PROCESSING}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-bold text-white shadow-sm transition-colors
                      ${status === ProcessingStatus.PROCESSING 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-teal-600 hover:bg-teal-700'}`}
                  >
                    <ShieldCheck size={18} />
                    <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.composite.validateBtn}</span>
                  </button>

                  {summary && (
                    <div className={`p-3 rounded-lg border flex items-center gap-3 ${summary.errors > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                        {summary.errors > 0 ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
                        <div className="text-sm font-bold">
                            {summary.errors > 0 ? `Found ${summary.errors} errors in ${summary.total} rows.` : `All ${summary.total} rows valid!`}
                        </div>
                    </div>
                  )}
              </div>

              {/* RESTORED TEMPLATE MAPPING SECTION */}
              {processedRowsCache.length > 0 && (
                  <div className="border-t border-slate-200 pt-6 mt-6 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <MapIcon size={16}/> Advanced: Map & Export
                          </h4>
                          <button 
                              onClick={() => setShowMapping(!showMapping)}
                              className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded font-bold transition-colors text-slate-600"
                          >
                              {showMapping ? "Hide Mapping" : "Show Mapping"}
                          </button>
                      </div>

                      {showMapping && (
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                              <div className="flex gap-4 items-end mb-4">
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Upload Excel Template</label>
                                      <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors">
                                          <UploadCloud size={16} className="text-indigo-600"/>
                                          <span className="text-xs font-bold text-slate-600">{templateFile ? templateFile.name : "Choose Template File"}</span>
                                          <input type="file" className="hidden" accept=".xlsx" onChange={handleTemplateUpload}/>
                                      </label>
                                  </div>
                                  
                                  {templateHeaders.length > 0 && (
                                      <button onClick={handleCustomExport} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-indigo-700 flex items-center gap-2 shadow-sm h-[34px]">
                                          <Download size={14}/> Export Mapped File
                                      </button>
                                  )}
                              </div>

                              {templateHeaders.length > 0 && (
                                  <div className="bg-white rounded border border-slate-200 max-h-60 overflow-y-auto p-2 grid grid-cols-2 lg:grid-cols-3 gap-2">
                                      {templateHeaders.map((tHead, idx) => (
                                          <div key={idx} className="flex flex-col gap-1 p-1.5 bg-slate-50 rounded border border-slate-100">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase truncate" title={tHead}>{tHead}</span>
                                              <select 
                                                  className="p-1 border rounded text-xs bg-white focus:border-indigo-500 outline-none"
                                                  value={mapping[tHead] || ""}
                                                  onChange={(e) => setMapping(prev => ({...prev, [tHead]: e.target.value}))}
                                              >
                                                  <option value="">-- Ignore --</option>
                                                  {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                              </select>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              )}
          </div>
      )}

      {/* ANALYSIS TAB CONTENT (Keep existing) */}
      {activeTab === 'analysis' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calculator size={20}/> Financial Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* ... (Keep existing mapping UI) ... */}
                      <div className="p-3 bg-blue-50 rounded border border-blue-100">
                          <label className="block text-xs font-bold text-blue-800 mb-2 uppercase">Raw Sheet: SKU Column</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={rawSkuCol}
                              onChange={(e) => setRawSkuCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Select SKU --</option>
                              {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>

                      <div className="p-3 bg-green-50 rounded border border-green-100">
                          <label className="block text-xs font-bold text-green-800 mb-2 uppercase">Raw Sheet: Cost Column</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={costCol}
                              onChange={(e) => setCostCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Select Cost --</option>
                              {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>

                      <div className="p-3 bg-purple-50 rounded border border-purple-100">
                          <label className="block text-xs font-bold text-purple-800 mb-2 uppercase">Raw Sheet: Name Column</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={rawNameCol}
                              onChange={(e) => setRawNameCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Optional --</option>
                              {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>

                      <div className="p-3 bg-amber-50 rounded border border-amber-100">
                          <label className="block text-xs font-bold text-amber-800 mb-2 uppercase">Composite: Retail Price</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={retailPriceCol}
                              onChange={(e) => setRetailPriceCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Optional --</option>
                              {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={!fileData || status === ProcessingStatus.PROCESSING}
                    className={`mt-6 w-full py-4 rounded-lg font-bold text-white shadow-sm transition-colors flex justify-center items-center gap-2
                      ${status === ProcessingStatus.PROCESSING 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    <DollarSign size={20} />
                    <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : "Analyze Cost & Profit"}</span>
                  </button>
              </div>

              {/* --- PROFIT SIMULATOR DASHBOARD (Keep existing) --- */}
              {bomData.length > 0 && (
                  <div className="mt-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                      
                      <div className="bg-slate-50 p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex items-center gap-4">
                              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Calculator size={20} className="text-teal-600"/> Profit Simulator</h3>
                              <div className="text-xs bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                                  Average Margin: <span className={stats.avgMargin > targetMargin ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>{stats.avgMargin.toFixed(1)}%</span>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              <button onClick={handleExportAnalysis} className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors shadow-sm">
                                <Download size={14}/> Export Default
                              </button>
                          </div>
                      </div>
                      
                      <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl p-6 shadow-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center">
                                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Percent size={16}/> Target Margin</label>
                                      <span className="text-lg font-bold text-blue-600">{targetMargin}%</span>
                                  </div>
                                  <input 
                                    type="range" min="0" max="90" step="5" 
                                    value={targetMargin} 
                                    onChange={(e) => setTargetMargin(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                  />
                                  <p className="text-xs text-slate-500">Products below this margin will be flagged as risk.</p>
                              </div>

                              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center">
                                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><TrendingUp size={16}/> "What-If" Material Cost Increase</label>
                                      <span className="text-lg font-bold text-amber-600">+{costFluctuation}%</span>
                                  </div>
                                  <input 
                                    type="range" min="0" max="50" step="1" 
                                    value={costFluctuation} 
                                    onChange={(e) => setCostFluctuation(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                  />
                                  <p className="text-xs text-slate-500">Simulate inflation on raw material costs globally.</p>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-4">
                                  <div className="p-3 bg-green-100 text-green-600 rounded-full"><CheckCircle2 size={24}/></div>
                                  <div>
                                      <p className="text-2xl font-bold text-slate-800">{stats.safeCount}</p>
                                      <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Profitable Products</p>
                                  </div>
                              </div>
                              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-4">
                                  <div className="p-3 bg-red-100 text-red-600 rounded-full"><AlertTriangle size={24}/></div>
                                  <div>
                                      <p className="text-2xl font-bold text-slate-800">{stats.riskyCount}</p>
                                      <p className="text-xs font-bold text-red-700 uppercase tracking-wider">At Risk Products</p>
                                  </div>
                              </div>
                          </div>

                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="max-h-80 overflow-y-auto">
                                  <table className="w-full text-sm text-left">
                                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                                          <tr>
                                              <th className="p-3 border-b">Product Name</th>
                                              <th className="p-3 border-b">Retail Price</th>
                                              <th className="p-3 border-b">Projected Cost</th>
                                              <th className="p-3 border-b">Profit</th>
                                              <th className="p-3 border-b">Margin %</th>
                                              <th className="p-3 border-b text-center">BOM</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {simulationResults.map((item, idx) => (
                                              <tr key={idx} className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${item.isRisk ? 'bg-red-50/30' : ''}`}>
                                                  <td className="p-3 font-medium text-slate-700">
                                                      <div className="flex flex-col">
                                                          <span>{item.name}</span>
                                                          <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                                                      </div>
                                                  </td>
                                                  <td className="p-3 font-mono">{item.retailPrice.toFixed(2)}</td>
                                                  <td className="p-3 font-mono text-slate-600">{item.adjustedCost.toFixed(2)}</td>
                                                  <td className={`p-3 font-mono font-bold ${item.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.profit.toFixed(2)}</td>
                                                  <td className="p-3">
                                                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.isRisk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                          {item.marginPercent.toFixed(1)}%
                                                      </span>
                                                  </td>
                                                  <td className="p-3 text-center">
                                                      <button 
                                                        onClick={() => setVisualizerItem(bomData.find(b => b.sku === item.sku) || null)}
                                                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"
                                                        title="View BOM Tree"
                                                      >
                                                          <TreeDeciduous size={18}/>
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}

      {/* BOM VISUALIZER MODAL */}
      {visualizerItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-teal-500/20 rounded-lg"><TreeDeciduous size={20} className="text-teal-400"/></div>
                          <div>
                              <h3 className="font-bold text-lg">{visualizerItem.name}</h3>
                              <p className="text-xs text-slate-400 font-mono">{visualizerItem.sku}</p>
                          </div>
                      </div>
                      <button onClick={() => setVisualizerItem(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                      <div className="flex flex-col items-center">
                          {/* Root Node */}
                          <div className="bg-white border-2 border-teal-500 p-4 rounded-xl shadow-md min-w-[200px] text-center relative z-10">
                              <p className="font-bold text-slate-800 text-sm">{visualizerItem.name}</p>
                              <div className="mt-2 flex justify-center gap-4 text-xs">
                                  <span className="text-slate-500">Retail: <strong>{visualizerItem.retailPrice}</strong></span>
                                  <span className="text-slate-500">Cost: <strong>{visualizerItem.baseTotalCost.toFixed(2)}</strong></span>
                              </div>
                              {/* Connector Line Down */}
                              <div className="absolute top-full left-1/2 w-0.5 h-6 bg-slate-300 -translate-x-1/2"></div>
                          </div>

                          {/* Ingredient Grid */}
                          <div className="mt-6 w-full relative pt-4">
                              {/* Horizontal Bar Connector */}
                              {visualizerItem.ingredients.length > 1 && (
                                  <div className="absolute top-0 left-10 right-10 h-4 border-t-2 border-l-2 border-r-2 border-slate-300 rounded-t-xl"></div>
                              )}
                              
                              <div className="flex flex-wrap justify-center gap-4">
                                  {visualizerItem.ingredients.map((ing, i) => (
                                      <div key={i} className="relative pt-4">
                                          {/* Vertical Line from bar to node */}
                                          <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-slate-300 -translate-x-1/2"></div>
                                          
                                          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm w-40 hover:border-blue-400 hover:shadow-md transition-all group">
                                              <div className="flex items-center gap-2 mb-2">
                                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                      {i+1}
                                                  </div>
                                                  <div className="flex flex-col flex-1 min-w-0">
                                                      <p className="font-mono text-xs font-bold text-slate-700 truncate" title={ing.sku}>{ing.sku}</p>
                                                      {ing.name && <p className="text-[10px] text-slate-500 truncate" title={ing.name}>{ing.name}</p>}
                                                  </div>
                                              </div>
                                              <div className="text-xs space-y-1 text-slate-500">
                                                  <div className="flex justify-between"><span>Qty:</span> <span className="font-mono text-slate-800">{ing.qty}</span></div>
                                                  <div className="flex justify-between"><span>Unit:</span> <span className="font-mono text-slate-800">{ing.unitCost}</span></div>
                                                  <div className="border-t pt-1 mt-1 flex justify-between font-bold text-blue-700">
                                                      <span>Total:</span> <span>{(ing.qty * ing.unitCost).toFixed(2)}</span>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                      <span>Total Ingredients: <strong>{visualizerItem.ingredients.length}</strong></span>
                      <div className="flex gap-4">
                          <span className="flex items-center gap-1"><CircleDollarSign size={14} className="text-teal-500"/> Composite Cost</span>
                          <span className="flex items-center gap-1"><AlertTriangle size={14} className="text-amber-500"/> Raw Material</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default CompositeTab;
