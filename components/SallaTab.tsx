
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { saveWorkbook, getSheetData, readExcelFile } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { ShoppingBag, Eraser, Scissors, Info, X, BookOpen, AlertCircle, Save, FileText, ArrowDownFromLine, TableProperties, ArrowRight, CheckCircle2, Download, Eye, RefreshCw, UploadCloud, Settings, Trash2, Map as MapIcon, Filter, Package } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

const SALLA_BLACKLIST = [
  "الوصف", "هل يتطلب شحن؟", "السعر المخفض", "تاريخ بداية التخفيض", "تاريخ نهاية التخفيض",
  "اقصي كمية لكل عميل", "إخفاء خيار تحديد الكمية", "اضافة صورة عند الطلب", "الوزن", "وحدة الوزن",
  "حالة المنتج", "العنوان الترويجي", "تثبيت المنتج", "السعرات الحرارية", "MPN", "GTIN",
  "تصنيف المنتج", "صورة المنتج", "نوع المنتج",
  "[1] الصورة / اللون", "[2] الصورة / اللون", "[3] الصورة / اللون",
  "[4] الصورة / اللون", "[5] الصورة / اللون", "[6] الصورة / اللون",
  "[7] الصورة / اللون", "[8] الصورة / اللون"
];

const SallaTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  
  // Options
  const [cleanColumns, setCleanColumns] = useState<boolean>(true);
  const [flattenVariants, setFlattenVariants] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState(false);
  const [exportBatchSize, setExportBatchSize] = useState<number>(0);

  // Auto-Detection State
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [typeCol, setTypeCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);
  const [skuCol, setSkuCol] = useState<number>(-1);

  // Results State
  const [resultData, setResultData] = useState<{
      all: any[][], 
      simple: any[][], 
      variable: any[][],
      summary: {
          totalRows: number,
          simpleCount: number,
          variableCount: number,
          missingSkuCount: number,
          duplicateSkuCount: number,
          removedColumns: string[],
          actions: string[]
      }
  } | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'simple' | 'variable'>('variable');

  // Mapping State
  const [templateFile, setTemplateFile] = useState<FileData | null>(null);
  const [templateHeaders, setTemplateHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(false);
  const [mappingSource, setMappingSource] = useState<'all' | 'simple' | 'variable'>('all');

  // Initial Sheet Selection
  useEffect(() => {
    if (fileData) {
      const salla = fileData.sheets.find(s => s.toLowerCase().includes('salla') || s.toLowerCase().includes('products'));
      setSelectedSheet(salla || fileData.sheets[0] || '');
    }
  }, [fileData]);

  // Load Headers & Auto-Detect when Sheet Changes
  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, true);
      if (data.length > 0) {
         // Auto-detect header row
         let hRowIdx = 0;
         let tIdx = -1;
         let nIdx = -1;
         let sIdx = -1;

         for (let r = 0; r < Math.min(data.length, 20); r++) {
             const row = data[r] as any[];
             const rowStr = row.map(c => String(c || "").trim());
             const typeIndex = rowStr.findIndex(c => c === "النوع" || c.toLowerCase() === "type" || c === "نوع المنتج");
             
             if (typeIndex !== -1) {
                 hRowIdx = r;
                 tIdx = typeIndex;
                 nIdx = rowStr.findIndex(c => c === "الاسم" || c.toLowerCase() === "name" || c === "اسم المنتج");
                 sIdx = rowStr.findIndex(c => {
                     const val = c.toLowerCase();
                     return val === "sku" || val === "الرمز" || val.includes("sku") || val.includes("رمز المنتج") || val.includes("رمز");
                 });
                 break;
             }
         }
         
         if (tIdx === -1) hRowIdx = 0;

         setHeaderRowIndex(hRowIdx);
         const rawHeaders = (data[hRowIdx] as any[]) || [];
         const headerStrs = rawHeaders.map(h => String(h || ""));
         setHeaders(headerStrs);
         
         setTypeCol(tIdx);
         setNameCol(nIdx);
         setSkuCol(sIdx);
         setResultData(null);
         
         setTemplateFile(null);
         setTemplateHeaders([]);
         setMapping({});
         setShowMapping(false);
         setMappingSource('all');
      }
    }
  }, [fileData, selectedSheet]);

  // Compute active headers based on selected source (Dynamic Mapping Options)
  const activeHeaders = useMemo(() => {
      if (!resultData) return [];
      if (mappingSource === 'simple' && resultData.simple.length > 0) return resultData.simple[0];
      if (mappingSource === 'variable' && resultData.variable.length > 0) return resultData.variable[0];
      if (resultData.all.length > 0) return resultData.all[0];
      return [];
  }, [resultData, mappingSource]);

  useEffect(() => {
      setMapping({}); 
  }, [activeHeaders, templateHeaders]);

  const filterAndCleanData = (data: any[][], blacklist: string[], applyCleaning: boolean) => {
    // ... (keep existing)
    if (!data || data.length === 0) return { cleanedData: data, removedCount: 0 };
    const header = data[0];
    const keepIndices: number[] = [];
    
    for (let c = 0; c < header.length; c++) {
        const colName = String(header[c] || "").trim();
        if (!applyCleaning) { keepIndices.push(c); continue; }
        if (blacklist.includes(colName)) continue;

        let hasData = false;
        for (let r = 1; r < data.length; r++) {
            const cell = data[r][c];
            if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
                hasData = true; break;
            }
        }
        if (hasData) keepIndices.push(c);
    }
    return { cleanedData: data.map(row => keepIndices.map(i => row[i])), removedCount: header.length - keepIndices.length };
  };

  const cleanCell = (cell: any) => {
      if (cell === null || cell === undefined) return null;
      if (typeof cell === 'number') return cell.toLocaleString('fullwide', { useGrouping: false });
      if (typeof cell === 'string') {
          const trimmed = cell.trim();
          return trimmed === "" ? null : trimmed;
      }
      return cell;
  };

  const normalizeRow = (row: any[]) => {
      return row.map(cleanCell);
  };

  const appendSheetWithFormat = (wb: any, data: any[][], name: string) => {
      const ws = XLSX.utils.aoa_to_sheet(data);
      Object.keys(ws).forEach(cellRef => {
          if (cellRef[0] === '!') return;
          const cell = ws[cellRef];
          if (cell.t === 'n' && String(cell.v).length > 10) {
              cell.t = 's';
              cell.v = String(cell.v);
              cell.z = '@'; 
          }
      });
      XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // ... (keep template upload helpers)
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const tData = await readExcelFile(file);
          if (tData.sheets.length > 0) {
              const rows = getSheetData(tData.workbook, tData.sheets[0], false);
              if (rows.length > 0) {
                  const headers = rows[0] as string[];
                  setTemplateFile(tData);
                  setTemplateHeaders(headers);
                  addLog("Template loaded. Please map columns manually.", 'info');
              }
          }
      } catch (err: any) {
          addLog(`Error loading template: ${err.message}`, 'error');
      }
  };

  const handleMappedExport = () => {
      // ... (keep mapped export)
      if (!resultData || !templateHeaders.length) return;

      const mapRows = (sourceRows: any[][]) => {
          const sourceHeaders = sourceRows[0] as string[];
          const dataRows = sourceRows.slice(1);
          
          const mappedData = dataRows.map(row => {
              return templateHeaders.map(th => {
                  const sourceCol = mapping[th];
                  if (!sourceCol || sourceCol === "") return null;
                  const idx = sourceHeaders.indexOf(sourceCol);
                  if (idx !== -1) {
                      const val = row[idx];
                      if (val === null || val === undefined) return null;
                      if (typeof val === 'string') {
                          if (val.trim() === "") return null;
                      }
                      return val;
                  }
                  return null;
              });
          });
          return [templateHeaders, ...mappedData];
      };

      const newWb = XLSX.utils.book_new();
      let sourceRows = resultData.all;
      let sheetName = "Mapped Data";
      
      if (mappingSource === 'simple') {
          sourceRows = resultData.simple;
          sheetName = "Mapped Simple";
      } else if (mappingSource === 'variable') {
          sourceRows = resultData.variable;
          sheetName = "Mapped Variable";
      }

      if (sourceRows.length > 1) {
          const mappedSheet = mapRows(sourceRows);
          appendSheetWithFormat(newWb, mappedSheet, sheetName);
      } else {
          addLog(`No data found for selected source: ${mappingSource}`, 'warning');
          return;
      }

      const baseName = fileData?.name.replace(/\.[^/.]+$/, "") || "Export";
      const sourceLabel = mappingSource.charAt(0).toUpperCase() + mappingSource.slice(1);
      
      saveWorkbook(newWb, `Mapped_${sourceLabel}_${baseName}.xlsx`);
      addLog(`Exported mapped ${sourceLabel} file successfully.`, 'success');
  };

  const handleProcess = async () => {
    // ... (keep processing logic)
    if (!fileData || !selectedSheet) return;
    if (typeCol === -1) {
        addLog("Please select the 'Type' column (النوع) manually below.", 'warning');
        return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    setResultData(null);
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));
      const originalData = getSheetData(fileData.workbook, selectedSheet, true);
      if (originalData.length === 0) throw new Error("Sheet is empty.");

      const header = headers;
      const optionNameCols: number[] = [];
      header.forEach((h, i) => {
          const hStr = String(h || "");
          if (
              (hStr.includes("[") && (hStr.includes("النوع") || hStr.includes("الاسم"))) || 
              (hStr.toLowerCase().includes("option") && hStr.toLowerCase().includes("name"))
          ) {
              optionNameCols.push(i);
          }
      });

      const newHeader = ["Analysis Type", ...header, "Error Description"];
      const simpleRows: any[][] = [];
      const variableRows: any[][] = [];
      const allNewRows: any[][] = [newHeader];

      const rows = originalData.slice(headerRowIndex + 1);
      let currentParentName = "";
      let currentParentRow: any[] = [];
      
      const seenSkus = new Set<string>();
      
      for (let i = 0; i < rows.length; i++) {
          const row = normalizeRow(rows[i]);
          const rawType = String(row[typeCol] || "").trim();
          let category = "نوع واحد"; // Simple
          
          const isProduct = rawType === "منتج" || rawType === "نوع المنتج" || rawType.toLowerCase() === "product";
          const isOption = rawType === "خيار" || rawType.toLowerCase() === "option" || rawType.toLowerCase() === "variant";
          
          let isVariableParent = false;

          if (isProduct) {
              if (i + 1 < rows.length) {
                  const nextRow = rows[i+1];
                  const nextType = String(nextRow[typeCol] || "").trim();
                  if (nextType === "خيار" || nextType.toLowerCase() === "option" || nextType.toLowerCase() === "variant") {
                      isVariableParent = true;
                      category = "متعدد"; // Variable
                  }
              }
              if (isVariableParent) category = "متعدد";
              
              if (nameCol !== -1) {
                  currentParentName = String(row[nameCol] || "").trim();
              }
              currentParentRow = [...row];
          } else if (isOption) {
              category = "متعدد";
              if (flattenVariants) {
                  if (nameCol !== -1) {
                      const currentName = String(row[nameCol] || "").trim();
                      if (!currentName && currentParentName) {
                          row[nameCol] = currentParentName;
                      }
                  }
                  if (currentParentRow.length > 0) {
                      optionNameCols.forEach(colIdx => {
                          const val = String(row[colIdx] || "").trim();
                          const parentVal = currentParentRow[colIdx];
                          if (!val && parentVal) {
                              row[colIdx] = parentVal;
                          }
                      });
                  }
              }
          }

          if (flattenVariants && isVariableParent) continue; 

          let errorDesc = "";
          if (skuCol !== -1) {
              const rawSku = row[skuCol];
              const cleanedSku = cleanSku(rawSku);
              if ((category === "نوع واحد" || isOption) && !cleanedSku) {
                  errorDesc = "Missing SKU";
              } else if (cleanedSku) {
                  // Normalize for dup check (remove leading zeros)
                  const dupCheckStr = cleanedSku.replace(/^0+/, '');
                  if (seenSkus.has(dupCheckStr)) {
                      errorDesc = errorDesc ? errorDesc + " | Duplicate SKU" : "Duplicate SKU";
                  } else {
                      seenSkus.add(dupCheckStr);
                  }
              }
          }

          const newRow = [category, ...row, errorDesc];
          allNewRows.push(newRow);
          if (category === "نوع واحد") simpleRows.push(newRow);
          else variableRows.push(newRow);

          if (i % 500 === 0) { setProgress(Math.round((i / rows.length) * 80)); await new Promise(r => setTimeout(r, 0)); }
      }

      const { cleanedData: finalMainData } = filterAndCleanData(allNewRows, SALLA_BLACKLIST, cleanColumns);
      const { cleanedData: finalSimpleData } = filterAndCleanData(simpleRows.length > 0 ? [newHeader, ...simpleRows] : [], SALLA_BLACKLIST, cleanColumns);
      const { cleanedData: finalVariableData } = filterAndCleanData(variableRows.length > 0 ? [newHeader, ...variableRows] : [], SALLA_BLACKLIST, cleanColumns);

      const originalHeaders = allNewRows[0] as string[];
      const finalHeaders = finalMainData[0] as string[];
      const removedHeaders = originalHeaders.filter(h => !finalHeaders.includes(h));

      let missingSkuCount = 0;
      let duplicateSkuCount = 0;
      const errorColIndex = allNewRows[0].indexOf("Error Description");
      if (errorColIndex !== -1) {
          for(let i=1; i < allNewRows.length; i++) {
              if (String(allNewRows[i][errorColIndex]).includes("Missing SKU")) {
                  missingSkuCount++;
              }
              if (String(allNewRows[i][errorColIndex]).includes("Duplicate SKU")) {
                  duplicateSkuCount++;
              }
          }
      }

      const actions = [
          "Identified Product Types (Simple/Variable)",
          flattenVariants ? "Flattened Variants (Copied Name/Options from Parent)" : "Preserved Original Hierarchy",
          cleanColumns ? "Cleaned & Removed Empty/Blacklisted Columns" : "Preserved All Columns",
          "Generated 'Analysis Type' Column",
          "Checked for Missing and Duplicate SKUs",
          "Generated Summary Report"
      ];

      setResultData({
          all: finalMainData,
          simple: finalSimpleData,
          variable: finalVariableData,
          summary: {
              totalRows: finalMainData.length - 1,
              simpleCount: simpleRows.length,
              variableCount: variableRows.length,
              missingSkuCount,
              duplicateSkuCount,
              removedColumns: removedHeaders,
              actions
          }
      });
      
      addLog(t.common.completed, 'success');
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  const cleanSku = (sku: any) => {
      if (sku === null || sku === undefined) return "";
      let str = "";
      if (typeof sku === 'number') {
          str = sku.toLocaleString('fullwide', { useGrouping: false });
      } else {
          str = String(sku);
      }
      return str.trim();
  };

  const handleExport = async () => {
      if (!resultData) return;
      
      const baseName = fileData?.name.replace(/\.[^/.]+$/, "") || "Salla_Export";
      const suffix = flattenVariants ? "_Flattened" : "";

      // BATCH EXPORT LOGIC
      if (exportBatchSize > 0) {
          addLog(`Splitting export into files of ${exportBatchSize} rows...`, 'info');
          setStatus(ProcessingStatus.PROCESSING);
          
          try {
              const zip = new JSZip();
              let part = 1;
              const maxRows = Math.max(resultData.all.length, resultData.simple.length, resultData.variable.length);

              // We split by row index. Each chunk will contain a slice of each category.
              // Note: resultData includes headers at index 0.
              for (let i = 1; i < maxRows; i += exportBatchSize) {
                  const wb = XLSX.utils.book_new();
                  
                  const end = i + exportBatchSize;
                  
                  // Helper to slice data while keeping header
                  const sliceSheet = (data: any[][]) => {
                      if (data.length <= 1) return [];
                      const header = data[0];
                      const rows = data.slice(1);
                      // Adjust indices for this dataset (might be shorter than max)
                      if (i > rows.length) return []; // No more data for this sheet
                      const chunk = rows.slice(i - 1, end - 1); // i starts at 1
                      if (chunk.length === 0) return [];
                      return [header, ...chunk];
                  };

                  const chunkAll = sliceSheet(resultData.all);
                  const chunkSimple = sliceSheet(resultData.simple);
                  const chunkVar = sliceSheet(resultData.variable);

                  if (chunkAll.length > 0) appendSheetWithFormat(wb, chunkAll, "All Products");
                  if (chunkSimple.length > 0) appendSheetWithFormat(wb, chunkSimple, "Simple Products");
                  if (chunkVar.length > 0) appendSheetWithFormat(wb, chunkVar, "Variable Products");

                  // Add summary to first part only? Or all? Let's add to all for context.
                  const summarySheetData: any[][] = [
                      ["BATCH SUMMARY"],
                      ["Part", part],
                      ["Rows Range", `${i} - ${Math.min(end-1, maxRows-1)}`],
                      ["Date", new Date().toLocaleString()]
                  ];
                  const wsSum = XLSX.utils.aoa_to_sheet(summarySheetData);
                  XLSX.utils.book_append_sheet(wb, wsSum, "Batch Info");

                  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  zip.file(`Salla_Part_${part}.xlsx`, buffer);
                  part++;
                  
                  await new Promise(r => setTimeout(r, 10));
              }

              const content = await zip.generateAsync({ type: 'blob' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(content);
              link.download = `Salla_Batch_${baseName}.zip`;
              link.click();
              
              addLog(`Batch Export Complete (${part - 1} files).`, 'success');
              setStatus(ProcessingStatus.COMPLETED);
              
          } catch(e: any) {
              addLog(`Export Error: ${e.message}`, 'error');
              setStatus(ProcessingStatus.IDLE);
          }
          return;
      }

      // STANDARD SINGLE EXPORT
      const newWb = XLSX.utils.book_new();
      
      // 1. Data Sheets
      appendSheetWithFormat(newWb, resultData.all, "All Products");
      if (resultData.simple.length > 1) appendSheetWithFormat(newWb, resultData.simple, "Simple Products");
      if (resultData.variable.length > 1) appendSheetWithFormat(newWb, resultData.variable, "Variable Products");

      // 2. Summary Sheet
      const summarySheetData: any[][] = [
          ["SALLA ANALYSIS SUMMARY REPORT"],
          ["Generated Date", new Date().toLocaleString()],
          ["File Name", fileData?.name || "-"],
          [],
          ["--- STATISTICS ---"],
          ["Total Product Rows", resultData.summary.totalRows],
          ["Simple Products Count", resultData.summary.simpleCount],
          ["Variable Products Count", resultData.summary.variableCount],
          ["Missing SKUs Detected", resultData.summary.missingSkuCount],
          ["Duplicate SKUs Detected", resultData.summary.duplicateSkuCount],
          [],
          ["--- ACTIONS PERFORMED ---"],
          ...resultData.summary.actions.map(a => [a]),
          [],
          ["--- EXCLUDED / REMOVED COLUMNS ---"],
          ...(resultData.summary.removedColumns.length > 0 ? resultData.summary.removedColumns.map(c => [c]) : [["None"]])
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      wsSummary['!cols'] = [{ wch: 40 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(newWb, wsSummary, "Summary Report");

      saveWorkbook(newWb, `Salla_Analyzed${suffix}_${baseName}.xlsx`);
      addLog("Exported successfully with Summary.", 'success');
  };

  return (
    <div className="space-y-6">
       {/* ... (Keep existing UI) ... */}
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-700 flex items-center">
                <ShoppingBag className="mr-2" size={20}/>
                {t.salla.title}
             </h3>
             {/* ... Help button ... */}
             <button 
                onClick={() => setShowHelp(!showHelp)} 
                className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
             >
                 {showHelp ? <X size={14}/> : <Info size={14}/>} {language === 'ar' ? 'كيفية الاستخدام' : 'How to use'}
             </button>
         </div>

         {/* ... (Help Section) ... */}
         {showHelp && (
             <div className="mb-6 bg-purple-50 p-4 rounded-lg text-sm text-purple-900 border border-purple-200 animate-in slide-in-from-top-2 space-y-4">
                 <div>
                     <h4 className="font-bold mb-2 flex items-center gap-2 text-purple-800"><BookOpen size={16}/> {language === 'ar' ? 'دليل الاستخدام' : 'User Manual'}</h4>
                     <ol className="list-decimal list-inside space-y-1 text-xs">
                         <li>Upload your Salla product export.</li>
                         <li>The tool automatically detects 'Type' and 'Name' columns.</li>
                         <li>Click <strong>Analyze</strong> to preview split data.</li>
                         <li>Review the tabs below and click <strong>Export Excel</strong>.</li>
                     </ol>
                 </div>
             </div>
         )}

         {/* ... (Sheet Selection, Mapping, Options) ... */}
         <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-2">{t.salla.selectProductSheet}</label>
            <select className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 outline-none" value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)}>
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>

         {headers.length > 0 && (
             <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in">
                 {/* ... Mapping UI ... */}
                 <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center gap-2"><Settings size={14}/> {language === 'ar' ? 'تعيين الأعمدة (تلقائي / يدوي)' : 'Column Mapping (Auto / Manual)'}</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type Column (Required)</label>
                         <select className={`w-full p-2 border rounded text-xs ${typeCol === -1 ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} value={typeCol} onChange={(e) => setTypeCol(Number(e.target.value))}>
                             <option value="-1">-- Select 'Type' --</option>
                             {headers.map((h, i) => <option key={i} value={i}>{h || `Col ${i+1}`}</option>)}
                         </select>
                     </div>
                     <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name Column</label>
                         <select className="w-full p-2 border rounded text-xs border-slate-300" value={nameCol} onChange={(e) => setNameCol(Number(e.target.value))}>
                             <option value="-1">-- Select 'Name' --</option>
                             {headers.map((h, i) => <option key={i} value={i}>{h || `Col ${i+1}`}</option>)}
                         </select>
                     </div>
                     <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SKU Column</label>
                         <select className="w-full p-2 border rounded text-xs border-slate-300" value={skuCol} onChange={(e) => setSkuCol(Number(e.target.value))}>
                             <option value="-1">-- Select 'SKU' --</option>
                             {headers.map((h, i) => <option key={i} value={i}>{h || `Col ${i+1}`}</option>)}
                         </select>
                     </div>
                 </div>
             </div>
         )}

         <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer">
                <input type="checkbox" checked={cleanColumns} onChange={(e) => setCleanColumns(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                <div className="flex-1 text-sm"><span className="font-bold text-slate-700 flex items-center gap-2"><Eraser size={16}/> Clean Columns</span><p className="text-xs text-slate-500 mt-1">Removes empty/blacklisted columns.</p></div>
            </label>
            <label className="flex items-start space-x-3 cursor-pointer">
                <input type="checkbox" checked={flattenVariants} onChange={(e) => setFlattenVariants(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                <div className="flex-1 text-sm">
                    <span className="font-bold text-slate-700 flex items-center gap-2"><ArrowDownFromLine size={16}/> Flatten Variants</span>
                    <p className="text-xs text-slate-500 mt-1">
                        {language === 'ar' ? 'ينسخ اسم المنتج من صف الأب إلى الأبناء، ثم يحذف صف الأب.' : 'Copies parent Name to children (Option rows) and deletes the parent row.'}
                    </p>
                </div>
            </label>
         </div>

         <button onClick={handleProcess} disabled={!fileData || status === ProcessingStatus.PROCESSING} className={`w-full flex justify-center items-center space-x-2 px-6 py-4 rounded-lg font-bold text-white shadow-md transition-all ${status === ProcessingStatus.PROCESSING ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700'}`}>
            {status === ProcessingStatus.PROCESSING ? <span className="animate-spin mr-2">⏳</span> : <Scissors size={20}/>}
            <span>{resultData ? (language === 'ar' ? 'تحديث التحليل' : 'Re-Analyze') : t.salla.analyzeBtn}</span>
         </button>
       </div>

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}

       {/* PREVIEW & EXPORT SECTION */}
       {resultData && status === ProcessingStatus.COMPLETED && (
           <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
               <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                   <div className="flex gap-2">
                       <button onClick={() => setActiveResultTab('variable')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeResultTab === 'variable' ? 'bg-purple-600 text-white shadow' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>Variable ({resultData.variable.length > 1 ? resultData.variable.length - 1 : 0})</button>
                       <button onClick={() => setActiveResultTab('simple')} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${activeResultTab === 'simple' ? 'bg-purple-600 text-white shadow' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>Simple ({resultData.simple.length > 1 ? resultData.simple.length - 1 : 0})</button>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-3">
                       <div className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 hidden sm:block">
                           Missing SKUs: <span className="font-bold text-red-600 mr-4">{resultData.summary.missingSkuCount}</span>
                           Duplicate SKUs: <span className="font-bold text-red-600">{resultData.summary.duplicateSkuCount}</span>
                       </div>
                       
                       {/* TEMPLATE MAPPING TOGGLE */}
                       <button onClick={() => setShowMapping(!showMapping)} className={`text-xs px-3 py-2 rounded-lg font-bold flex items-center gap-2 border transition-colors ${showMapping ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                           <MapIcon size={14}/> {language === 'ar' ? 'تخطيط القوالب' : 'Map to Template'}
                       </button>

                       <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5">
                           <Package size={14} className="text-slate-400"/>
                           <input 
                              type="number" 
                              placeholder="Max Rows" 
                              className="w-16 text-xs outline-none"
                              value={exportBatchSize || ''}
                              onChange={(e) => setExportBatchSize(Number(e.target.value))}
                           />
                       </div>

                       <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-green-700 flex items-center gap-2 shadow-sm transition-transform active:scale-95">
                           <Download size={14}/> Export Excel
                       </button>
                   </div>
               </div>

               {/* MAPPING SECTION */}
               {showMapping && (
                   <div className="p-4 bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top-2">
                       {/* ... (Mapping UI) ... */}
                       <div className="flex flex-col gap-4">
                           <div className="flex flex-wrap items-center gap-4">
                               <label className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors shadow-sm">
                                   <UploadCloud size={16} className="text-indigo-600"/>
                                   <span className="text-xs font-bold text-slate-700">{templateFile ? templateFile.name : (language === 'ar' ? "رفع ملف القالب" : "Upload Template File")}</span>
                                   <input type="file" className="hidden" accept=".xlsx" onChange={handleTemplateUpload} />
                               </label>
                               
                               {templateFile && (
                                   <div className="flex items-center gap-2 bg-white p-1 rounded border border-indigo-200">
                                       <span className="text-xs font-bold text-slate-500 px-2 flex items-center gap-1"><Filter size={12}/> {language === 'ar' ? 'مصدر البيانات:' : 'Data Source:'}</span>
                                       <select value={mappingSource} onChange={(e) => setMappingSource(e.target.value as any)} className="text-xs font-bold text-indigo-700 bg-transparent outline-none p-1 cursor-pointer">
                                           <option value="all">All Products</option>
                                           <option value="simple">Simple Only</option>
                                           <option value="variable">Variable Only</option>
                                       </select>
                                   </div>
                               )}

                               {templateFile && (
                                   <button onClick={handleMappedExport} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm ml-auto">
                                       <Download size={14}/> {language === 'ar' ? 'تصدير الملف المخطط' : 'Export Mapped File'}
                                   </button>
                               )}
                           </div>

                           {templateHeaders.length > 0 && (
                               <div className="bg-white rounded-lg border border-indigo-100 overflow-hidden">
                                   <div className="p-2 bg-indigo-100 text-indigo-800 text-xs font-bold flex justify-between px-4">
                                       <span>Template Column</span>
                                       <span>Source Column (Analyzed)</span>
                                   </div>
                                   <div className="max-h-60 overflow-y-auto p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                       {templateHeaders.map((header, idx) => (
                                           <div key={idx} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100 text-xs">
                                               <span className="font-bold text-slate-700 w-1/3 truncate" title={header}>{header}</span>
                                               <ArrowRight size={12} className="text-slate-400"/>
                                               <select className="flex-1 p-1 border rounded bg-white outline-none focus:border-indigo-400" value={mapping[header] || ""} onChange={(e) => setMapping({...mapping, [header]: e.target.value})}>
                                                   <option value="">-- Ignore --</option>
                                                   {activeHeaders.map((h: any, i: number) => <option key={i} value={h}>{h}</option>)}
                                               </select>
                                           </div>
                                       ))}
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>
               )}

               <div className="overflow-x-auto max-h-[500px]">
                   <table className="w-full text-left text-xs border-collapse">
                       <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm z-10">
                           <tr>
                               {resultData[activeResultTab][0]?.map((h: any, i: number) => (
                                   <th key={i} className="p-3 border-b font-semibold min-w-[100px] whitespace-nowrap">{h}</th>
                               ))}
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                           {resultData[activeResultTab].slice(1, 20).map((row: any[], i: number) => {
                               const lastCell = row[row.length - 1];
                               const isError = lastCell && typeof lastCell === 'string' && (lastCell.includes('Missing SKU') || lastCell.includes('Duplicate SKU'));
                               return (
                                   <tr key={i} className={`transition-colors ${isError ? 'bg-red-50 border-l-4 border-l-red-500' : 'hover:bg-purple-50'}`}>
                                       {row.map((cell, c) => (
                                           <td key={c} className="p-3 border-r border-slate-100 last:border-0 truncate max-w-[150px]" title={String(cell)}>{String(cell)}</td>
                                       ))}
                                   </tr>
                               );
                           })}
                           {resultData[activeResultTab].length > 20 && (
                               <tr><td colSpan={resultData[activeResultTab][0].length} className="p-4 text-center text-slate-400 italic bg-slate-50">... showing first 20 rows of {resultData[activeResultTab].length - 1} ...</td></tr>
                           )}
                           {resultData[activeResultTab].length <= 1 && (
                               <tr><td colSpan={resultData[activeResultTab][0].length} className="p-8 text-center text-slate-400"><Eye size={32} className="mx-auto mb-2 opacity-50"/>No products in this category.</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>
           </div>
       )}
    </div>
  );
};

export default SallaTab;
