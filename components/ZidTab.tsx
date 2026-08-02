
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { saveWorkbook, getSheetData, readExcelFile } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Store, ListTree, Scissors, Trash2, Merge, Info, X, BookOpen, AlertCircle, Save, FileText, Settings, UploadCloud, Map as MapIcon, Filter, ArrowRight, Download, Eye, Package } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

const COLUMNS_TO_DELETE = [
  "description_ar", "description_en", "short_description_ar", "short_description_en",
  "product_page_title_ar", "product_page_title_en", "product_page_description_ar", "product_page_description_en",
  "product_page_url", "categories_ar", "categories_en", "categories_description_ar", "categories_description_en",
  "categories_images", "keywords", "weight", "weight_unit", "published", "images", "images_alt_text_ar", "images_alt_text_en",
  "has_dropdown", "is_dropdown_required", "dropdown_name_ar", "dropdown_name_en",
  "dropdown_choice1_ar", "dropdown_choice1_en", "dropdown_choice1_price",
  "dropdown_choice2_ar", "dropdown_choice2_en", "dropdown_choice2_price",
  "dropdown_choice3_ar", "dropdown_choice3_en", "dropdown_choice3_price",
  "dropdown_choice4_ar", "dropdown_choice4_en", "dropdown_choice4_price",
  "dropdown_choice5_ar", "dropdown_choice5_en", "dropdown_choice5_price",
  "dropdown_choice6_ar", "dropdown_choice6_en", "dropdown_choice6_price",
  "dropdown_choice7_ar", "dropdown_choice7_en", "dropdown_choice7_price",
  "dropdown_choice8_ar", "dropdown_choice8_en", "dropdown_choice8_price",
  "dropdown_choice9_ar", "dropdown_choice9_en", "dropdown_choice9_price",
  "dropdown_choice10_ar", "dropdown_choice10_en", "dropdown_choice10_price",
  "dropdown_choice11_ar", "dropdown_choice11_en", "dropdown_choice11_price",
  "dropdown_choice12_ar", "dropdown_choice12_en", "dropdown_choice12_price",
  "dropdown_choice13_ar", "dropdown_choice13_en", "dropdown_choice13_price",
  "has_multiple_options", "is_multiple_options_required", "multiple_options_name_ar", "multiple_options_name_en",
  "has_text_input", "is_text_input_required", "text_input_name_ar", "text_input_name_en", "text_input_price",
  "has_numerical_input", "is_numerical_input_required", "numerical_input_name_ar", "numerical_input_name_en", "numerical_input_price",
  "has_date", "is_date_required", "date_name_ar", "date_name_en",
  "has_time", "is_time_required", "time_name_ar", "time_name_en",
  "has_image_upload", "is_image_upload_required", "image_upload_name_ar", "image_upload_name_en",
  "has_file_upload", "is_file_upload_required", "file_upload_name_ar", "file_upload_name_en"
];

const ZidTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [variantColIdx, setVariantColIdx] = useState<number>(-1);
  const [nameColIdx, setNameColIdx] = useState<number>(-1);
  const [skuColIdx, setSkuColIdx] = useState<number>(-1);
  
  // Options
  const [removeExtraCols, setRemoveExtraCols] = useState<boolean>(true);
  const [deleteParentRows, setDeleteParentRows] = useState<boolean>(true); 
  const [concatenateOptions, setConcatenateOptions] = useState<boolean>(true);
  const [exportBatchSize, setExportBatchSize] = useState<number>(0);

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [showHelp, setShowHelp] = useState(false);

  // Results State
  const [resultData, setResultData] = useState<{
      all: any[][], 
      simple: any[][], 
      variable: any[][],
      summary: {
          totalRows: number,
          simpleCount: number,
          variableCount: number,
          orphanedCount: number,
          missingSkuCount: number,
          duplicateSkuCount: number
      }
  } | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'simple' | 'variable'>('variable');

  // Mapping State
  const [templateFile, setTemplateFile] = useState<FileData | null>(null);
  const [templateHeaders, setTemplateHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(false);
  const [mappingSource, setMappingSource] = useState<'all' | 'simple' | 'variable'>('all');

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
        
        // Auto-detect columns using safe string conversion
        const vIdx = head.findIndex(h => {
            const val = String(h || "").toLowerCase();
            return val.includes('هل يوجد خيارات') || val.includes('has variant') || val.includes('option');
        });
        const nIdx = head.findIndex(h => {
            const val = String(h || "").toLowerCase();
            return val.includes('اسم') || val.includes('name') || val.includes('product');
        });
        
        const sIdx = head.findIndex(h => {
            const val = String(h || "").toLowerCase();
            return val.includes('sku') || val.includes('رمز') || val.includes('باركود') || val.includes('barcode');
        });

        // Default to -1 if not found to force manual selection or show "Select"
        setVariantColIdx(vIdx);
        setNameColIdx(nIdx);
        setSkuColIdx(sIdx);
        
        setResultData(null);
        setTemplateFile(null);
        setTemplateHeaders([]);
        setMapping({});
        setShowMapping(false);
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

  const removeEmptyColumns = (data: any[][]) => {
    if (!data || data.length <= 1) return { cleanedData: data };
    const headers = data[0];
    const numCols = headers.length;
    const keepIndices: number[] = [];
    
    for (let c = 0; c < numCols; c++) {
        let hasData = false;
        for (let r = 1; r < data.length; r++) {
            const cell = data[r][c];
            // Enhanced check using cleanCell logic
            if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
                hasData = true;
                break;
            }
        }
        if (hasData) keepIndices.push(c);
    }
    const cleanedData = data.map(row => keepIndices.map(i => row[i]));
    return { cleanedData };
  };

  const filterBlacklistedColumns = (data: any[][]) => {
    if (!data || data.length === 0) return data;
    const header = data[0];
    const indicesToKeep: number[] = [];
    
    header.forEach((colName, idx) => {
        const name = String(colName).trim().toLowerCase();
        if (!COLUMNS_TO_DELETE.includes(name)) {
            indicesToKeep.push(idx);
        }
    });
    
    return data.map(row => indicesToKeep.map(i => row[i]));
  };

  const appendSheetWithFormat = (wb: any, data: any[][], name: string) => {
      const ws = XLSX.utils.aoa_to_sheet(data);
      Object.keys(ws).forEach(cellRef => {
          if (cellRef[0] === '!') return;
          const cell = ws[cellRef];
          // Handle long numbers as strings
          if (cell.t === 'n' && String(cell.v).length > 10) {
              cell.t = 's';
              cell.v = String(cell.v);
              cell.z = '@'; 
          }
      });
      XLSX.utils.book_append_sheet(wb, ws, name);
  };

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
      if (!resultData || !templateHeaders.length) return;

      const mapRows = (sourceRows: any[][]) => {
          const sourceHeaders = sourceRows[0] as string[];
          const dataRows = sourceRows.slice(1);
          
          const mappedData = dataRows.map(row => {
              return templateHeaders.map(th => {
                  const sourceCol = mapping[th];
                  // STRICT: If no mapping is set, or explicitly "", return NULL (truly empty).
                  if (!sourceCol || sourceCol === "") return null;
                  
                  const idx = sourceHeaders.indexOf(sourceCol);
                  if (idx !== -1) {
                      const val = row[idx];
                      // ENHANCED EMPTY CHECK
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
      
      saveWorkbook(newWb, `Zid_Mapped_${sourceLabel}_${baseName}.xlsx`);
      addLog(`Exported mapped ${sourceLabel} file successfully.`, 'success');
  };

  const handleProcess = async () => {
    // ... (keep process logic)
    if (!fileData || !selectedSheet) return;
    if (variantColIdx === -1 || nameColIdx === -1) {
        addLog("Please select required columns (Has Variant / Name) in the mapping section.", 'warning');
        return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    setResultData(null);
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));

      const rawData = getSheetData(fileData.workbook, selectedSheet, true); // Use raw=true for better type handling if needed
      if (rawData.length <= 1) throw new Error("Sheet is empty.");

      const header = rawData[0];
      const rows = rawData.slice(1);
      
      // 1. Auto-detect Option Name columns
      const optionNameCols: number[] = [];
      header.forEach((h, idx) => {
          const val = String(h || "").toLowerCase();
          if (val.includes('option') && val.includes('name')) {
              optionNameCols.push(idx);
          }
      });

      // 2. Auto-detect Option Value columns for Concatenation
      const optionValueCols: { idx: number, nameIdx: number, lang: 'ar' | 'en' | 'unknown' }[] = [];
      header.forEach((h, i) => {
         const hStr = String(h).toLowerCase();
         if (hStr.includes('value') && (hStr.includes('option') || hStr.includes('variant'))) {
            let lang: 'ar' | 'en' | 'unknown' = 'unknown';
            if (hStr.includes('_ar') || hStr.includes('arabic')) lang = 'ar';
            else if (hStr.includes('_en') || hStr.includes('english')) lang = 'en';
            
            let nameIdx = -1;
            const expectedNameHeader = hStr.replace('value', 'name');
            const foundIdx = header.findIndex(x => String(x).toLowerCase() === expectedNameHeader);
            if (foundIdx !== -1) {
                nameIdx = foundIdx;
            } else if (i > 0) {
                const prev = String(header[i-1]).toLowerCase();
                if (prev.includes('name') && prev.includes('option')) nameIdx = i-1;
            }
            optionValueCols.push({ idx: i, nameIdx, lang });
         }
      });

      // New Header: Insert "Parent Product Name" and "Error Description"
      const newHeader = [...header];
      newHeader.splice(variantColIdx + 1, 0, "Parent Product Name"); 
      newHeader.push("Error Description");

      const allProcessedRows: any[][] = [newHeader];
      const simpleRows: any[][] = [newHeader];
      const variableRows: any[][] = [newHeader];

      let currentParentName = "";
      let currentParentRowData: any[] = [];
      let isInsideVariableGroup = false;
      let orphanedCount = 0;
      const missingSkuCount = 0;
      const duplicateSkuCount = 0;
      const seenSkus = new Set<string>();

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

      for (let i = 0; i < rows.length; i++) {
          const rawRow = rows[i];
          const row = normalizeRow(rawRow); // Strict cleaning
          
          const rawVariantVal = row[variantColIdx] ? String(row[variantColIdx]).trim().toLowerCase() : "";
          const nameVal = row[nameColIdx] ? String(row[nameColIdx]).trim() : "";
          
          let rowIsVariable = false;
          let rowIsParent = false;
          let processedVariantVal = row[variantColIdx]; 
          let errorDesc = "";

          if (rawVariantVal === 'yes' || rawVariantVal === 'نعم') {
              // Parent of a variable product
              currentParentName = nameVal;
              currentParentRowData = [...row]; 
              isInsideVariableGroup = true;
              rowIsVariable = true;
              rowIsParent = true;
          } else if (rawVariantVal === 'no' || rawVariantVal === 'لا') {
              // Simple product
              currentParentName = ""; 
              currentParentRowData = [];
              isInsideVariableGroup = false;
              rowIsVariable = false;
          } else if (rawVariantVal === "") {
              // Empty
              if (isInsideVariableGroup) {
                  // It's a variant child
                  rowIsVariable = true;
                  processedVariantVal = "Yes"; 
              } else {
                  // Orphaned variant or standalone simple product with missing flag?
                  // Assume Simple if no parent context, but flag error
                  currentParentName = "";
                  currentParentRowData = [];
                  rowIsVariable = false;
                  // If name is present, treat as simple. If name missing, likely orphan.
                  if (!nameVal) {
                      errorDesc = "Orphaned Variant (No Parent)";
                      orphanedCount++;
                  }
              }
          } else {
              // Unknown value -> treat as simple
              currentParentName = "";
              currentParentRowData = [];
              isInsideVariableGroup = false;
              rowIsVariable = false;
          }

          // Fill Option Names from Parent
          if (isInsideVariableGroup && !rowIsParent && currentParentRowData.length > 0) {
              optionNameCols.forEach(colIdx => {
                  const val = row[colIdx];
                  const parentVal = currentParentRowData[colIdx];
                  if ((val === null) && parentVal) {
                      row[colIdx] = parentVal;
                  }
              });
          }

          // Concatenate Options to Name
          let filledName = rowIsVariable ? currentParentName : nameVal;
          if (concatenateOptions && isInsideVariableGroup && !rowIsParent) {
             const extras = new Set<string>();
             optionValueCols.forEach(ov => {
                const val = row[ov.idx];
                if (val && String(val).trim()) {
                   let prefix = "";
                   if (ov.nameIdx !== -1) {
                       const optName = row[ov.nameIdx];
                       if (optName && String(optName).trim()) {
                           prefix = String(optName).trim() + ": ";
                       }
                   }
                   extras.add(`${prefix}${String(val).trim()}`);
                }
             });
             
             if (extras.size > 0) {
                 filledName = `${filledName} - ${Array.from(extras).join(' - ')}`;
             }
          }
          
          let parentNameValue = "";
          if (rowIsVariable) {
             parentNameValue = rowIsParent ? nameVal : currentParentName;
          }

          row[nameColIdx] = filledName;

          if (skuColIdx !== -1) {
              const rawSku = row[skuColIdx];
              const cleanedSku = cleanSku(rawSku);
              if (!rowIsParent && !cleanedSku) {
                  errorDesc = errorDesc ? errorDesc + " | Missing SKU" : "Missing SKU";
              } else if (!rowIsParent && cleanedSku) {
                  const dupCheckStr = cleanedSku.replace(/^0+/, '');
                  if (seenSkus.has(dupCheckStr)) {
                      errorDesc = errorDesc ? errorDesc + " | Duplicate SKU" : "Duplicate SKU";
                  } else {
                      seenSkus.add(dupCheckStr);
                  }
              }
          }

          // Insert Parent Name Column + Error Column
          const prePart = row.slice(0, variantColIdx + 1);
          prePart[variantColIdx] = processedVariantVal; 
          
          const postPart = row.slice(variantColIdx + 1);
          const newRow = [...prePart, parentNameValue, ...postPart, errorDesc];
          
          if (!deleteParentRows || !rowIsParent) {
              allProcessedRows.push(newRow);
              if (rowIsVariable) {
                  variableRows.push(newRow);
              } else {
                  simpleRows.push(newRow);
              }
          }

          if (i % 500 === 0) {
             setProgress(Math.round((i / rows.length) * 80));
             await new Promise(r => setTimeout(r, 0));
          }
      }

      // Filter Blacklisted & Clean
      let processedAll = allProcessedRows;
      let processedSimple = simpleRows;
      let processedVariable = variableRows;

      // Count missing and duplicate after generation or during? During is better. 
      // But let's recount from errorDesc to be accurate on final exported data without parent rows.
      let finalMissingSkuCount = 0;
      let finalDuplicateSkuCount = 0;
      const errorColIdx = allProcessedRows[0].indexOf("Error Description");
      if (errorColIdx !== -1) {
          for(let i=1; i < allProcessedRows.length; i++) {
              const rowErr = String(allProcessedRows[i][errorColIdx]);
              if (rowErr.includes("Missing SKU")) finalMissingSkuCount++;
              if (rowErr.includes("Duplicate SKU")) finalDuplicateSkuCount++;
          }
      }

      // Remove "Parent Product Name" from Simple Products
      if (processedSimple.length > 0) {
          const colToRemove = variantColIdx + 1;
          processedSimple = processedSimple.map(row => {
             const r = [...row];
             if (r.length > colToRemove) r.splice(colToRemove, 1);
             return r;
          });
      }

      if (removeExtraCols) {
          processedAll = filterBlacklistedColumns(processedAll);
          processedSimple = filterBlacklistedColumns(processedSimple);
          processedVariable = filterBlacklistedColumns(processedVariable);
      }

      setProgress(90);
      const { cleanedData: finalAllData } = removeEmptyColumns(processedAll);
      const { cleanedData: finalSimpleData } = removeEmptyColumns(processedSimple);
      const { cleanedData: finalVariableData } = removeEmptyColumns(processedVariable);

      setResultData({
          all: finalAllData,
          simple: finalSimpleData,
          variable: finalVariableData,
          summary: {
              totalRows: finalAllData.length - 1,
              simpleCount: simpleRows.length - 1,
              variableCount: variableRows.length - 1,
              orphanedCount,
              missingSkuCount: finalMissingSkuCount,
              duplicateSkuCount: finalDuplicateSkuCount
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

  const handleExport = async () => {
      if (!resultData) return;
      const baseName = fileData?.name.replace(/\.[^/.]+$/, "") || "Zid_Organized";

      // BATCH EXPORT
      if (exportBatchSize > 0) {
          addLog(`Splitting export into files of ${exportBatchSize} rows...`, 'info');
          setStatus(ProcessingStatus.PROCESSING);
          
          try {
              const zip = new JSZip();
              let part = 1;
              const maxRows = Math.max(resultData.all.length, resultData.simple.length, resultData.variable.length);

              // Split logic
              for (let i = 1; i < maxRows; i += exportBatchSize) {
                  const wb = XLSX.utils.book_new();
                  const end = i + exportBatchSize;
                  
                  const sliceSheet = (data: any[][]) => {
                      if (data.length <= 1) return [];
                      const header = data[0];
                      const rows = data.slice(1);
                      if (i > rows.length) return [];
                      const chunk = rows.slice(i - 1, end - 1); 
                      if (chunk.length === 0) return [];
                      return [header, ...chunk];
                  };

                  const chunkAll = sliceSheet(resultData.all);
                  const chunkVar = sliceSheet(resultData.variable);
                  const chunkSimple = sliceSheet(resultData.simple);

                  if (chunkAll.length > 0) appendSheetWithFormat(wb, chunkAll, "Zid All Products");
                  if (chunkVar.length > 0) appendSheetWithFormat(wb, chunkVar, "Variable Products");
                  if (chunkSimple.length > 0) appendSheetWithFormat(wb, chunkSimple, "Simple Products");

                  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  zip.file(`Zid_Part_${part}.xlsx`, buffer);
                  part++;
                  
                  await new Promise(r => setTimeout(r, 10));
              }

              const content = await zip.generateAsync({ type: 'blob' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(content);
              link.download = `Zid_Batch_${baseName}.zip`;
              link.click();
              
              setStatus(ProcessingStatus.COMPLETED);
              addLog(`Batch Export Complete (${part - 1} files).`, 'success');
          } catch(e: any) {
              addLog(`Export Error: ${e.message}`, 'error');
              setStatus(ProcessingStatus.IDLE);
          }
          return;
      }

      // SINGLE EXPORT
      const newWb = XLSX.utils.book_new();
      appendSheetWithFormat(newWb, resultData.all, "Zid All Products");
      if (resultData.variable.length > 1) appendSheetWithFormat(newWb, resultData.variable, "Variable Products");
      if (resultData.simple.length > 1) appendSheetWithFormat(newWb, resultData.simple, "Simple Products");

      saveWorkbook(newWb, `Zid_Organized_${baseName}.xlsx`);
      addLog("Exported successfully.", 'success');
  };

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         {/* ... (Header, Help, Sheet Select, Mapping Config, Options) same as before ... */}
         <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-slate-700 flex items-center">
                <Store className="mr-2" size={20}/>
                {t.zid.title}
             </h3>
             <button onClick={() => setShowHelp(!showHelp)} className="text-xs font-bold text-green-600 flex items-center gap-1 hover:bg-green-50 px-2 py-1 rounded transition-colors">
                 {showHelp ? <X size={14}/> : <Info size={14}/>} {language === 'ar' ? 'كيفية الاستخدام' : 'How to use'}
             </button>
         </div>

         {showHelp && (
             <div className="mb-6 bg-green-50 p-4 rounded-lg text-sm text-green-900 border border-green-200 animate-in slide-in-from-top-2 space-y-4">
                 <div>
                     <h4 className="font-bold mb-2 flex items-center gap-2 text-green-800"><BookOpen size={16}/> {language === 'ar' ? 'دليل الاستخدام' : 'User Manual'}</h4>
                     <ol className="list-decimal list-inside space-y-1 text-xs">
                         <li>{language === 'ar' ? 'اختر الأعمدة: حدد عمود "هل يوجد خيارات" و "الاسم".' : 'Select Columns: Identify "Has Variant" and "Product Name".'}</li>
                         <li>{language === 'ar' ? 'انقر معالجة لتقسيم المنتجات وتعبئة البيانات.' : 'Click Analyze to split products and fill data.'}</li>
                         <li>{language === 'ar' ? 'استخدم ميزة التخطيط لتصدير النتائج في قالبك الخاص.' : 'Use Template Mapping to export results in your specific format.'}</li>
                     </ol>
                 </div>
             </div>
         )}
         
         <div className="mb-6">
            <label className="block text-sm font-medium text-slate-600 mb-2">{t.common.selectSheet}</label>
            <select className="w-full p-2.5 border rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)}>
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>

         <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in">
             <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center gap-2"><Settings size={14}/> {language === 'ar' ? 'تعيين الأعمدة (تلقائي / يدوي)' : 'Column Mapping (Auto / Manual)'}</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.zid.colVariant} (Required)</label>
                    <select className={`w-full p-2 border rounded text-xs ${variantColIdx === -1 ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} value={variantColIdx} onChange={(e) => setVariantColIdx(Number(e.target.value))}>
                      <option value="-1">-- Select 'Has Variant' --</option>
                      {headers.map((h, i) => <option key={i} value={i}>{i+1}. {h}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.zid.colName} (Required)</label>
                    <select className={`w-full p-2 border rounded text-xs ${nameColIdx === -1 ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} value={nameColIdx} onChange={(e) => setNameColIdx(Number(e.target.value))}>
                      <option value="-1">-- Select 'Name' --</option>
                      {headers.map((h, i) => <option key={i} value={i}>{i+1}. {h}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SKU Column</label>
                    <select className="w-full p-2 border rounded text-xs border-slate-300" value={skuColIdx} onChange={(e) => setSkuColIdx(Number(e.target.value))}>
                      <option value="-1">-- Select 'SKU' --</option>
                      {headers.map((h, i) => <option key={i} value={i}>{i+1}. {h}</option>)}
                    </select>
                </div>
             </div>
         </div>

         <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={removeExtraCols} onChange={(e) => setRemoveExtraCols(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                <span className="text-sm font-medium text-slate-700 flex items-center"><Scissors size={16} className="mr-2 text-slate-500" /> Remove Extra Zid Columns</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={deleteParentRows} onChange={(e) => setDeleteParentRows(e.target.checked)} className="w-4 h-4 text-red-600 rounded" />
                <span className="text-sm font-medium text-slate-700 flex items-center"><Trash2 size={16} className="mr-2 text-slate-500" /> Delete Parent Rows</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={concatenateOptions} onChange={(e) => setConcatenateOptions(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                <span className="text-sm font-medium text-slate-700 flex items-center"><Merge size={16} className="mr-2 text-slate-500" /> Concatenate Options to Name</span>
            </label>
         </div>
          
         <div className="flex items-center justify-between">
             <button onClick={handleProcess} disabled={!fileData || status === ProcessingStatus.PROCESSING} className={`w-full flex justify-center items-center space-x-2 px-6 py-4 rounded-lg font-bold text-white shadow-md transition-all transform active:scale-95 ${status === ProcessingStatus.PROCESSING ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}>
                {status === ProcessingStatus.PROCESSING ? <span className="animate-spin mr-2">⏳</span> : <ListTree size={20} />}
                <span>{resultData ? (language === 'ar' ? 'تحديث التحليل' : 'Re-Analyze') : t.zid.analyzeBtn}</span>
            </button>
         </div>
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
                       {resultData.summary.orphanedCount > 0 && (
                           <div className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                               Orphaned: <span className="font-bold text-red-600">{resultData.summary.orphanedCount}</span>
                           </div>
                       )}
                       
                       <div className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 hidden sm:flex gap-4">
                           <span>Missing SKUs: <span className="font-bold text-red-600">{resultData.summary.missingSkuCount}</span></span>
                           <span>Duplicate SKUs: <span className="font-bold text-red-600">{resultData.summary.duplicateSkuCount}</span></span>
                       </div>
                       
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
                       {/* ... (Mapping UI) same as before ... */}
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
                                   <div className="p-2 bg-indigo-100 text-indigo-800 text-xs font-bold flex justify-between px-4"><span>Template Column</span><span>Source Column (Analyzed)</span></div>
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
                               const isError = lastCell && typeof lastCell === 'string' && (lastCell.includes('Orphaned') || lastCell.includes('Missing SKU') || lastCell.includes('Duplicate SKU'));
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

export default ZidTab;
