
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';
import JSZip from 'jszip';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  ShieldCheck, UploadCloud, FileSpreadsheet, Settings, 
  AlertTriangle, CheckCircle2, Download, ArrowRight, 
  AlertOctagon, Wand2, Search, Plus, Trash2, X, Filter,
  ChevronDown, Check, GripVertical, Percent, Package
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
  fileData?: FileData | null;
}

// --- CONFIGURATION ---
type FieldKey = 
  'name' | 'sku' | 'barcode' | 'qty' | 'retail_price' | 'cost' | 'buy_price' | 'supplier' |
  'sellable' | 'purchasable' | 'stock_mgmt' | 'weighted' | 'batch' | 'serial' |
  'pack_1_label' | 'pack_1_size' | 'pack_1_sku' | 'pack_1_barcode' |
  'pack_2_label' | 'pack_2_size' | 'pack_2_sku' | 'pack_2_barcode' |
  'pack_3_label' | 'pack_3_size' | 'pack_3_sku' | 'pack_3_barcode' |
  'tax' | 'category' | 'subcategory' | 'sub_subcategory';

interface FieldDef {
  key: FieldKey;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'id';
  description: string;
}

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Product Name', type: 'text', description: 'Checks symbols & empty' },
  { key: 'sku', label: 'SKU', type: 'id', description: 'Unique, Arabic/English OK, No Sci-Notation' },
  { key: 'barcode', label: 'Barcode', type: 'id', description: 'Unique, Arabic/English OK, No Sci-Notation' },
  { key: 'qty', label: 'Quantity', type: 'number', description: 'No negatives, comma->dot' },
  { key: 'retail_price', label: 'Retail Price', type: 'number', description: 'No negatives, comma->dot' },
  { key: 'cost', label: 'Cost', type: 'number', description: 'No negatives, number check' },
  { key: 'buy_price', label: 'Buy Price', type: 'number', description: 'No negatives, number check' },
  { key: 'supplier', label: 'Supplier', type: 'text', description: 'Clones to Code, creates Suppliers sheet' },
  { key: 'tax', label: 'Tax', type: 'text', description: "Empty, 'S', or 'VATEX-SA-OOS' only" },
  { key: 'category', label: 'Category', type: 'text', description: 'Main category' },
  { key: 'subcategory', label: 'Sub Category', type: 'text', description: 'Must have unique parent category' },
  { key: 'sub_subcategory', label: 'Sub-Sub Category', type: 'text', description: 'Must have unique parent subcategory' },
  { key: 'sellable', label: 'Sellable', type: 'boolean', description: 'yes/no/Empty only' },
  { key: 'purchasable', label: 'Purchasable', type: 'boolean', description: 'yes/no/Empty only' },
  { key: 'stock_mgmt', label: 'Enable Stock Management', type: 'boolean', description: 'yes/no/Empty only' },
  { key: 'weighted', label: 'Weighted', type: 'boolean', description: 'yes/no/Empty only' },
  { key: 'batch', label: 'Tracked by Batch', type: 'boolean', description: 'yes/no/Empty only' },
  { key: 'serial', label: 'Tracked by Serial', type: 'boolean', description: 'yes/no/Empty only' },
  // Pack Fields
  { key: 'pack_1_label', label: 'Pack 1 Label', type: 'text', description: 'Must have size if present' },
  { key: 'pack_1_size', label: 'Pack 1 Size', type: 'number', description: 'Must have label if present' },
  { key: 'pack_1_sku', label: 'Pack 1 SKU', type: 'id', description: 'Auto-generate if Label exists' },
  { key: 'pack_1_barcode', label: 'Pack 1 Barcode', type: 'id', description: 'Optional' },

  { key: 'pack_2_label', label: 'Pack 2 Label', type: 'text', description: 'Must have size if present' },
  { key: 'pack_2_size', label: 'Pack 2 Size', type: 'number', description: 'Must have label if present' },
  { key: 'pack_2_sku', label: 'Pack 2 SKU', type: 'id', description: 'Auto-generate if Label exists' },
  { key: 'pack_2_barcode', label: 'Pack 2 Barcode', type: 'id', description: 'Optional' },

  { key: 'pack_3_label', label: 'Pack 3 Label', type: 'text', description: 'Must have size if present' },
  { key: 'pack_3_size', label: 'Pack 3 Size', type: 'number', description: 'Must have label if present' },
  { key: 'pack_3_sku', label: 'Pack 3 SKU', type: 'id', description: 'Auto-generate if Label exists' },
  { key: 'pack_3_barcode', label: 'Pack 3 Barcode', type: 'id', description: 'Optional' },
];

const FileValidationTab: React.FC<Props> = ({ addLog, onReset, language = 'en', fileData }) => {
  const t = TRANSLATIONS[language];
  
  // State
  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[][]>([]);
  
  // Mapping: Field Key -> Array of Column Indices
  const [mapping, setMapping] = useState<Record<string, number[]>>({});
  
  // Validation Settings
  const [costIncVat, setCostIncVat] = useState<boolean>(false);
  const [retailIncVat, setRetailIncVat] = useState<boolean>(true);
  
  const [processedData, setProcessedData] = useState<any[][]>([]);
  const [actionsLog, setActionsLog] = useState<string[][]>([]); // Track actions per row
  const [errors, setErrors] = useState<{rowIndex: number, colIndex: number, msg: string}[]>([]);
  const [uniqueSuppliers, setUniqueSuppliers] = useState<Set<string>>(new Set());
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config');
  
  // UI Filter State
  const [viewFilter, setViewFilter] = useState<'all' | 'errors'>('all');
  
  // Export Settings
  const [exportBatchSize, setExportBatchSize] = useState<number>(0);
  
  // Dropdown open state for mapping
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // --- HELPERS ---

  const cleanSheetAndGetData = (ws: XLSX.WorkSheet): any[][] => {
      if (ws['!merges']) {
          ws['!merges'].forEach((range: any) => {
              const startRef = XLSX.utils.encode_cell({r: range.s.r, c: range.s.c});
              const startCell = ws[startRef];
              const val = startCell ? startCell.v : undefined;
              for(let r = range.s.r; r <= range.e.r; ++r) {
                  for(let c = range.s.c; c <= range.e.c; ++c) {
                      const cellRef = XLSX.utils.encode_cell({r, c});
                      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: val };
                      else ws[cellRef].v = val;
                  }
              }
          });
          delete ws['!merges'];
      }
      if (ws['!autofilter']) delete ws['!autofilter'];
      if (ws['!views']) delete ws['!views'];
      if (ws['!rows']) ws['!rows'].forEach((r: any) => { if(r) delete r.hidden; });
      if (ws['!cols']) ws['!cols'].forEach((c: any) => { if(c) delete c.hidden; });

      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as any[][];
  };

  // Load from FileData Prop
  useEffect(() => {
      if (fileData && fileData.sheets.length > 0) {
          setWorkbook(fileData.workbook);
          setSheetNames(fileData.sheets);
          if (fileData.sheets.length > 0) {
              setSelectedSheet(fileData.sheets[0]);
          }
          setFileName(fileData.name);
      }
  }, [fileData]);

  // Load Data when Sheet Changes
  useEffect(() => {
      if (workbook && selectedSheet) {
          const ws = workbook.Sheets[selectedSheet];
          if (ws) {
              let data = cleanSheetAndGetData(ws);
              
              // Filter out completely empty rows (ghost rows)
              // This fixes the issue where extra rows with errors are generated
              data = data.filter(row => row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== ""));
              
              setProcessedData([]);
              setActionsLog([]);
              setErrors([]);
              setUniqueSuppliers(new Set());
              setViewFilter('all');

              if (data.length > 0) {
                  const newHeaders = data[0].map(String);
                  setHeaders(newHeaders);
                  setRawData(data.slice(1)); 
                  autoMapColumns(newHeaders);
              } else {
                  setHeaders([]);
                  setRawData([]);
                  setMapping({});
                  addLog(`Sheet ${selectedSheet} is empty.`, 'warning');
              }
          }
      }
  }, [workbook, selectedSheet]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    addLog(`${t.common.processing} ${f.name}...`, 'info');
    try {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary', cellDates: true, cellNF: false, cellText: false });
            
            setWorkbook(wb);
            setSheetNames(wb.SheetNames);
            if (wb.SheetNames.length > 0) {
                setSelectedSheet(wb.SheetNames[0]);
            }
            setFileName(f.name);
            addLog(`${t.system.fileLoaded}: ${f.name}`, 'success');
        };
        reader.readAsBinaryString(f);
    } catch (err: any) {
        addLog(`Error: ${err.message}`, 'error');
    }
  };

  const autoMapColumns = (fileHeaders: string[]) => {
      const newMap: Record<string, number[]> = {};
      FIELDS.forEach(field => {
          const matches: number[] = [];
          fileHeaders.forEach((h, idx) => {
              const hLow = h.toLowerCase().replace(/[^a-z0-9]/g, '');
              const kLow = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (hLow === kLow || hLow.includes(kLow)) {
                  matches.push(idx);
              }
          });
          if (matches.length > 0) newMap[field.key] = matches;
      });
      setMapping(newMap);
  };

  const toggleMapping = (fieldKey: string, colIndex: number) => {
      setMapping(prev => {
          const current = prev[fieldKey] || [];
          const exists = current.includes(colIndex);
          let updated;
          if (exists) updated = current.filter(c => c !== colIndex);
          else updated = [...current, colIndex];
          return { ...prev, [fieldKey]: updated };
      });
  };

  const getPreviewValue = (colIndices: number[]) => {
      if (!colIndices || colIndices.length === 0) return "-";
      const colIdx = colIndices[0]; 
      for(let i=0; i<Math.min(rawData.length, 10); i++) {
          if(rawData[i][colIdx] !== undefined && rawData[i][colIdx] !== null && String(rawData[i][colIdx]).trim() !== "") {
              return String(rawData[i][colIdx]);
          }
      }
      return "(Empty)";
  };

  const handleClear = () => {
      setFileName('');
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet('');
      setHeaders([]);
      setRawData([]);
      setMapping({});
      
      setProcessedData([]);
      setActionsLog([]);
      setErrors([]);
      setUniqueSuppliers(new Set());
      
      setStatus(ProcessingStatus.IDLE);
      setProgress(0);
      setActiveTab('config');
  };

  // --- VALIDATION LOGIC ---
  const expandScientific = (val: any): string => {
      if (val === null || val === undefined) return "";
      const str = String(val).trim();
      if (str.includes('e') || str.includes('E')) {
          const num = Number(val);
          if (!isNaN(num)) return num.toLocaleString('fullwide', { useGrouping: false });
      }
      return str;
  };

  const normalizeBoolean = (val: any): 'yes' | 'no' | 'Empty' | 'Invalid' => {
      if (val === null || val === undefined || String(val).trim() === '') return 'Empty';
      const s = String(val).trim().toLowerCase();
      if (['yes', 'y', 'true', '1', 'نعم', 'صحيح'].includes(s)) return 'yes';
      if (['no', 'n', 'false', '0', 'لا', 'خطأ'].includes(s)) return 'no';
      return 'Invalid';
  };

  const processValidation = async () => {
      if (!fileName || rawData.length === 0) return;
      
      setStatus(ProcessingStatus.PROCESSING);
      setProgress(0);
      setErrors([]);
      setActionsLog([]);
      setUniqueSuppliers(new Set());
      
      const newRows = rawData.map(row => [...row]);
      const currentActionsLog: string[][] = new Array(newRows.length).fill(null).map(() => []);
      const reportErrors: {rowIndex: number, colIndex: number, msg: string}[] = [];
      const errorDescColIndex = headers.length; 
      
      const skuSet = new Map<string, number[]>();
      const barcodeSet = new Map<string, number[]>();
      const foundSuppliers = new Set<string>();
      
      const subcategoryParents = new Map<string, string>(); // lowercase subcat -> original cat
      const subsubcategoryParents = new Map<string, string>(); // lowercase subsubcat -> original subcat

      const totalRows = newRows.length;

      for (let r = 0; r < totalRows; r++) {
          const row = newRows[r];
          const rowErrors: string[] = [];

          const getVal = (key: string): string => {
              const idxs = mapping[key];
              if(!idxs || idxs.length === 0) return "";
              const val = row[idxs[0]];
              return val !== undefined && val !== null ? String(val).trim() : "";
          };

          const supplierVal = getVal('supplier');
          if (supplierVal) {
              foundSuppliers.add(supplierVal);
          }

          for (const field of FIELDS) {
              const mappedCols = mapping[field.key] || [];
              mappedCols.forEach(cIdx => {
                  let val = row[cIdx];
                  let strVal = val !== undefined && val !== null ? String(val).trim() : "";
                  
                  if (field.key === 'name') {
                      if (!strVal) rowErrors.push(`[${headers[cIdx]}]: Empty Name`);
                  }
                  else if (field.key === 'sku' || field.key === 'barcode' || field.key.includes('_sku') || field.key.includes('_barcode')) {
                      const expanded = expandScientific(val);
                      if (String(val) !== expanded) {
                          strVal = expanded;
                          row[cIdx] = expanded;
                          currentActionsLog[r].push(`Fixed Scientific Notation/Trim Space (${field.label})`);
                      } else if (String(val) !== strVal) {
                          // Fix basic trimming issues even if not scientific
                          row[cIdx] = strVal;
                      }
                      if (!strVal) {
                          if (field.key === 'sku') {
                              const headerName = headers[cIdx] ? headers[cIdx].toLowerCase() : "";
                              if (!headerName.includes('pack')) {
                                  const randomSku = `Rewaa-${Math.floor(Math.random() * 1000000)}`;
                                  row[cIdx] = randomSku;
                                  strVal = randomSku;
                                  currentActionsLog[r].push(`Generated Missing SKU`);
                              }
                          } else if (field.key.includes('_sku') && field.key.startsWith('pack_')) {
                              const parts = field.key.split('_'); 
                              if (parts.length === 3) {
                                  const packNum = parts[1];
                                  const labelKey = `pack_${packNum}_label` as FieldKey;
                                  const labelVal = getVal(labelKey);
                                  
                                  if (labelVal) {
                                      const randomSku = `Pack${packNum}-${Math.floor(Math.random() * 1000000)}`;
                                      row[cIdx] = randomSku;
                                      strVal = randomSku;
                                      currentActionsLog[r].push(`Generated Missing Pack ${packNum} SKU`);
                                  }
                              }
                          }
                      } else {
                          if (/[^a-zA-Z0-9\-_|\u0600-\u06FF\s]/.test(strVal)) {
                              rowErrors.push(`[${headers[cIdx]}]: Invalid characters`);
                          }
                          if (field.key === 'sku') {
                              if (!skuSet.has(strVal)) skuSet.set(strVal, []);
                              skuSet.get(strVal)!.push(r);
                          } else if (field.key === 'barcode') {
                              if (!barcodeSet.has(strVal)) barcodeSet.set(strVal, []);
                              barcodeSet.get(strVal)!.push(r);
                          }
                      }
                  }
                  else if (field.type === 'number') {
                      if (strVal === "") {
                      } else {
                          let clean = strVal.replace(/,/g, '.');
                          if (clean !== strVal) {
                              row[cIdx] = clean;
                              strVal = clean;
                              currentActionsLog[r].push(`Fixed Number Format (${field.label})`);
                          }
                          const num = Number(strVal);
                          if (isNaN(num)) {
                              rowErrors.push(`[${headers[cIdx]}]: Not a number`);
                          } else if (num < 0) {
                              row[cIdx] = 0;
                              currentActionsLog[r].push(`Fixed Negative Value (${field.label})`);
                          }
                      }
                  }
                  else if (field.type === 'boolean') {
                      const status = normalizeBoolean(val);
                      if (status === 'Invalid') {
                          rowErrors.push(`[${headers[cIdx]}]: Invalid Boolean`);
                      } else {
                          if (row[cIdx] !== status && status !== 'Empty') {
                              row[cIdx] = status;
                              currentActionsLog[r].push(`Normalized Boolean (${field.label})`);
                          } else if (status === 'Empty') {
                              row[cIdx] = '';
                          }
                      }
                  }
                  else if (field.key === 'tax') {
                      if (strVal !== "" && strVal !== "S" && strVal !== "VATEX-SA-OOS") {
                          if (strVal.toUpperCase() === "S") {
                              row[cIdx] = "S";
                              currentActionsLog[r].push(`Capitalized Tax value`);
                          } else if (strVal.toUpperCase() === "VATEX-SA-OOS") {
                              row[cIdx] = "VATEX-SA-OOS";
                              currentActionsLog[r].push(`Capitalized Tax value`);
                          } else {
                              rowErrors.push(`[${headers[cIdx]}]: Invalid Tax value (must be empty, 'S', or 'VATEX-SA-OOS')`);
                          }
                      }
                  }
              });
          }

          const origCat = getVal('category');
          const origSubCat = getVal('subcategory');
          const origSubSubCat = getVal('sub_subcategory');
          
          const catLow = origCat.toLowerCase();
          const subCatLow = origSubCat.toLowerCase();
          const subSubCatLow = origSubSubCat.toLowerCase();
          
          if (origCat || origSubCat || origSubSubCat) {
              if (catLow && catLow === subCatLow) {
                  rowErrors.push(`Category and Subcategory cannot have the same name ('${origCat}')`);
              }
              if (subCatLow && subCatLow === subSubCatLow) {
                  rowErrors.push(`Subcategory and Sub-Subcategory cannot have the same name ('${origSubCat}')`);
              }
              if (catLow && catLow === subSubCatLow) {
                  rowErrors.push(`Category and Sub-Subcategory cannot have the same name ('${origCat}')`);
              }
          
              if (origSubCat) {
                  if (!origCat) {
                      rowErrors.push(`Subcategory ('${origSubCat}') requires a main Category`);
                  } else {
                      if (subcategoryParents.has(subCatLow)) {
                          if (subcategoryParents.get(subCatLow)?.toLowerCase() !== catLow) {
                              rowErrors.push(`Subcategory '${origSubCat}' was previously seen under Category '${subcategoryParents.get(subCatLow)}'. It cannot belong to '${origCat}'.`);
                          }
                      } else {
                          subcategoryParents.set(subCatLow, origCat);
                      }
                  }
              }
          
              if (origSubSubCat) {
                  if (!origSubCat) {
                      rowErrors.push(`Sub-Subcategory ('${origSubSubCat}') requires a Subcategory`);
                  } else {
                      if (subsubcategoryParents.has(subSubCatLow)) {
                          if (subsubcategoryParents.get(subSubCatLow)?.toLowerCase() !== subCatLow) {
                              rowErrors.push(`Sub-Subcategory '${origSubSubCat}' was previously seen under Subcategory '${subsubcategoryParents.get(subSubCatLow)}'. It cannot belong to '${origSubCat}'.`);
                          }
                      } else {
                          subsubcategoryParents.set(subSubCatLow, origSubCat);
                      }
                  }
              }
          }

          for (let i = 1; i <= 3; i++) {
              const labelKey = `pack_${i}_label` as FieldKey;
              const sizeKey = `pack_${i}_size` as FieldKey;
              const labelVal = getVal(labelKey);
              const sizeVal = getVal(sizeKey);
              
              if ((labelVal && !sizeVal) || (!labelVal && sizeVal)) {
                  rowErrors.push(`Pack ${i} Mismatch: Label and Size must both be present or empty.`);
              }
          }

          const costValStr = getVal('cost');
          const retailValStr = getVal('retail_price');
          
          if (costValStr && retailValStr) {
              const cost = parseFloat(costValStr.replace(/,/g, '.'));
              const retail = parseFloat(retailValStr.replace(/,/g, '.'));
              
              if (!isNaN(cost) && !isNaN(retail)) {
                  const finalCost = costIncVat ? cost : cost * 1.15;
                  const finalRetail = retailIncVat ? retail : retail * 1.15;
                  
                  if (finalCost > finalRetail) {
                      rowErrors.push(`Loss Alert: Cost (${finalCost.toFixed(2)}) > Retail (${finalRetail.toFixed(2)}) (VAT Corrected)`);
                  }
              }
          }

          if (rowErrors.length > 0) {
              row[errorDescColIndex] = (row[errorDescColIndex] || "") + rowErrors.join("; ");
              rowErrors.forEach(msg => reportErrors.push({ rowIndex: r, colIndex: errorDescColIndex, msg }));
          }

          if (r % 500 === 0) {
              setProgress(Math.round((r / totalRows) * 50));
              await new Promise(res => setTimeout(res, 0));
          }
      }

      skuSet.forEach((indices, sku) => {
          if (indices.length > 1) {
              indices.forEach((rIdx, i) => {
                  if (i > 0) {
                      const mappedSkuCols = mapping['sku'] || [];
                      mappedSkuCols.forEach(c => {
                          newRows[rIdx][c] = `${sku}-${i}`;
                      });
                      currentActionsLog[rIdx].push(`Resolved Duplicate SKU`);
                  }
              });
          }
          if (barcodeSet.has(sku)) {
              indices.forEach(rIdx => {
                  const currentErr = newRows[rIdx][errorDescColIndex] || "";
                  newRows[rIdx][errorDescColIndex] = currentErr + (currentErr ? "; " : "") + "SKU conflicts with Barcode column";
                  reportErrors.push({ rowIndex: rIdx, colIndex: -1, msg: "Cross-column Duplicate" });
              });
          }
      });

      barcodeSet.forEach((indices, barcode) => {
          if (indices.length > 1) {
              indices.forEach(rIdx => {
                  const currentErr = newRows[rIdx][errorDescColIndex] || "";
                  newRows[rIdx][errorDescColIndex] = currentErr + (currentErr ? "; " : "") + "Duplicate Barcode";
                  reportErrors.push({ rowIndex: rIdx, colIndex: -1, msg: "Duplicate Barcode" });
              });
          }
          if (skuSet.has(barcode)) {
               indices.forEach(rIdx => {
                  const currentErr = newRows[rIdx][errorDescColIndex] || "";
                  if (!currentErr.includes("SKU conflicts")) {
                      newRows[rIdx][errorDescColIndex] = currentErr + (currentErr ? "; " : "") + "Barcode conflicts with SKU column";
                      reportErrors.push({ rowIndex: rIdx, colIndex: -1, msg: "Cross-column Duplicate" });
                  }
              });
          }
      });

      setProcessedData(newRows);
      setErrors(reportErrors);
      setActionsLog(currentActionsLog);
      setUniqueSuppliers(foundSuppliers);
      setProgress(100);
      setStatus(ProcessingStatus.COMPLETED);
      setActiveTab('results');
      if (reportErrors.length > 0) setViewFilter('errors');
      else setViewFilter('all');
      
      addLog(`${t.common.completed}. Found ${reportErrors.length} issues (auto-fixes applied).`, reportErrors.length > 0 ? 'warning' : 'success');
  };

  const handleExport = async () => {
      if (processedData.length === 0) return;
      
      // BATCH EXPORT LOGIC
      if (exportBatchSize > 0 && processedData.length > exportBatchSize) {
          addLog(`Splitting export into files of ${exportBatchSize} rows...`, 'info');
          setStatus(ProcessingStatus.PROCESSING);
          
          try {
              const zip = new JSZip();
              const totalRows = processedData.length;
              let part = 1;

              for (let i = 0; i < totalRows; i += exportBatchSize) {
                  const chunkData = processedData.slice(i, i + exportBatchSize);
                  const chunkLogs = actionsLog.slice(i, i + exportBatchSize);
                  
                  const wb = XLSX_STYLE.utils.book_new();
                  
                  // 1. Data Sheet
                  const supplierColIdx = mapping['supplier']?.[0];
                  let exportHeaders = [...headers];
                  if (supplierColIdx !== undefined) exportHeaders.splice(supplierColIdx + 1, 0, "Supplier Code");
                  exportHeaders.push("Error Description");

                  const exportData = [exportHeaders];
                  chunkData.forEach(row => {
                      let newRow = [...row];
                      if (supplierColIdx !== undefined) {
                          const supplierName = newRow[supplierColIdx] || "";
                          newRow.splice(supplierColIdx + 1, 0, supplierName); 
                      }
                      exportData.push(newRow);
                  });

                  const ws = XLSX_STYLE.utils.aoa_to_sheet(exportData);
                  // Apply Styles
                  const range = XLSX_STYLE.utils.decode_range(ws['!ref'] || "A1");
                  for (let C = range.s.c; C <= range.e.c; ++C) {
                      const ref = XLSX_STYLE.utils.encode_cell({ r: 0, c: C });
                      if (!ws[ref]) continue;
                      ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } }, alignment: { horizontal: "center" } };
                  }
                  
                  const errorColIdx = exportHeaders.length - 1;
                  for (let R = 1; R <= range.e.r; ++R) {
                      const errCellRef = XLSX_STYLE.utils.encode_cell({ r: R, c: errorColIdx });
                      const errCell = ws[errCellRef];
                      if (errCell && errCell.v) {
                          for (let C = range.s.c; C <= range.e.c; ++C) {
                              const cellRef = XLSX_STYLE.utils.encode_cell({ r: R, c: C });
                              if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
                              if (!ws[cellRef].s) ws[cellRef].s = {};
                              ws[cellRef].s.fill = { fgColor: { rgb: "FFEEEE" } };
                          }
                          if (!ws[errCellRef].s) ws[errCellRef].s = {};
                          ws[errCellRef].s.fill = { fgColor: { rgb: "FFCCCC" } };
                          ws[errCellRef].s.font = { color: { rgb: "990000" }, bold: true };
                      }
                  }
                  ws['!cols'] = exportHeaders.map(() => ({ wch: 15 }));
                  ws['!cols'][errorColIdx] = { wch: 50 };
                  XLSX_STYLE.utils.book_append_sheet(wb, ws, "Validated Data");

                  // 2. Log Sheet (Chunked)
                  const changeLogData = [["Product Name", "SKU", "Actions Taken", "Status"]];
                  const nameColIdx = mapping['name']?.[0];
                  const skuColIdx = mapping['sku']?.[0];
                  chunkData.forEach((row, rIdx) => {
                      const name = nameColIdx !== undefined ? String(row[nameColIdx] || "") : "(Unknown)";
                      const sku = skuColIdx !== undefined ? String(row[skuColIdx] || "") : "(Unknown)";
                      const rowActs = chunkLogs[rIdx] || [];
                      const errorDesc = row[headers.length]; 
                      const statusVal = errorDesc ? "Has Errors" : (rowActs.length > 0 ? "Fixed" : "Valid");
                      const actionStr = rowActs.length > 0 ? rowActs.join("; ") : "No Changes";
                      changeLogData.push([name, sku, actionStr, statusVal]);
                  });
                  const wsLog = XLSX_STYLE.utils.aoa_to_sheet(changeLogData);
                  XLSX_STYLE.utils.book_append_sheet(wb, wsLog, "Change Log");

                  const wbBlob = XLSX_STYLE.write(wb, { bookType: 'xlsx', type: 'array' });
                  zip.file(`Validated_Part_${part}.xlsx`, wbBlob);
                  part++;
                  
                  setProgress(Math.round((i / totalRows) * 100));
                  await new Promise(r => setTimeout(r, 10));
              }

              const content = await zip.generateAsync({ type: 'blob' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(content);
              link.download = `Validated_Batch_${fileName || 'File'}.zip`;
              link.click();
              
              setStatus(ProcessingStatus.COMPLETED);
              addLog(`Batch Export Complete (${part - 1} files).`, 'success');

          } catch (e: any) {
              addLog(`Export Error: ${e.message}`, 'error');
              setStatus(ProcessingStatus.COMPLETED);
          }
          return;
      }

      // STANDARD SINGLE EXPORT
      const wb = XLSX_STYLE.utils.book_new();

      // --- SHEET 1: Validated Data ---
      const supplierColIdx = mapping['supplier']?.[0];
      let exportHeaders = [...headers];
      
      if (supplierColIdx !== undefined) {
          exportHeaders.splice(supplierColIdx + 1, 0, "Supplier Code");
      }
      exportHeaders.push("Error Description");

      const exportData = [exportHeaders];
      
      processedData.forEach(row => {
          let newRow = [...row];
          if (supplierColIdx !== undefined) {
              const supplierName = newRow[supplierColIdx] || "";
              newRow.splice(supplierColIdx + 1, 0, supplierName); 
          }
          exportData.push(newRow);
      });

      const ws = XLSX_STYLE.utils.aoa_to_sheet(exportData);
      const range = XLSX_STYLE.utils.decode_range(ws['!ref'] || "A1");
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
          const ref = XLSX.utils.encode_cell({ r: 0, c: C });
          if (!ws[ref]) continue;
          ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } }, alignment: { horizontal: "center" } };
      }

      const errorColIdx = exportHeaders.length - 1;
      for (let R = 1; R <= range.e.r; ++R) {
          const errCellRef = XLSX_STYLE.utils.encode_cell({ r: R, c: errorColIdx });
          const errCell = ws[errCellRef];
          if (errCell && errCell.v) {
              for (let C = range.s.c; C <= range.e.c; ++C) {
                  const cellRef = XLSX_STYLE.utils.encode_cell({ r: R, c: C });
                  if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
                  if (!ws[cellRef].s) ws[cellRef].s = {};
                  ws[cellRef].s.fill = { fgColor: { rgb: "FFEEEE" } };
              }
              if (!ws[errCellRef].s) ws[errCellRef].s = {};
              ws[errCellRef].s.fill = { fgColor: { rgb: "FFCCCC" } };
              ws[errCellRef].s.font = { color: { rgb: "990000" }, bold: true };
          }
      }
      ws['!cols'] = exportHeaders.map(() => ({ wch: 15 }));
      ws['!cols'][errorColIdx] = { wch: 50 };
      XLSX_STYLE.utils.book_append_sheet(wb, ws, "Validated Data");

      // --- SHEET 2: Change Log ---
      const changeLogHeaders = ["Product Name", "SKU", "Actions Taken", "Status"];
      const changeLogData = [changeLogHeaders];
      const nameColIdx = mapping['name']?.[0];
      const skuColIdx = mapping['sku']?.[0];

      processedData.forEach((row, rIdx) => {
          const name = nameColIdx !== undefined ? String(row[nameColIdx] || "") : "(Unknown)";
          const sku = skuColIdx !== undefined ? String(row[skuColIdx] || "") : "(Unknown)";
          const rowActs = actionsLog[rIdx] || [];
          const errorDesc = row[headers.length]; 
          const statusVal = errorDesc ? "Has Errors" : (rowActs.length > 0 ? "Fixed" : "Valid");
          const actionStr = rowActs.length > 0 ? rowActs.join("; ") : "No Changes";
          changeLogData.push([name, sku, actionStr, statusVal]);
      });

      const wsChangeLog = XLSX_STYLE.utils.aoa_to_sheet(changeLogData);
      const rangeCL = XLSX_STYLE.utils.decode_range(wsChangeLog['!ref'] || "A1");
      for (let C = rangeCL.s.c; C <= rangeCL.e.c; ++C) {
          const ref = XLSX_STYLE.utils.encode_cell({ r: 0, c: C });
          if (wsChangeLog[ref]) wsChangeLog[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "059669" } } }; 
      }
      wsChangeLog['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 50 }, { wch: 15 }];
      XLSX_STYLE.utils.book_append_sheet(wb, wsChangeLog, "Change Log");

      // --- SHEET 3: Summary ---
      const totalRows = processedData.length;
      const uniqueErrorRows = new Set(errors.map(e => e.rowIndex)).size;
      const fixedRowsCount = actionsLog.filter(a => a.length > 0).length;
      const validRowsCount = totalRows - uniqueErrorRows;

      const actionCounts: Record<string, number> = {};
      actionsLog.forEach(rowActs => {
          rowActs.forEach(act => {
              actionCounts[act] = (actionCounts[act] || 0) + 1;
          });
      });

      const errorCounts: Record<string, number> = {};
      errors.forEach(err => {
          errorCounts[err.msg] = (errorCounts[err.msg] || 0) + 1;
      });

      const summaryData: any[][] = [
          ["Metric", "Value"],
          ["Total Rows Processed", totalRows],
          ["Rows Validated Successfully", validRowsCount],
          ["Rows with Auto-Fixes", fixedRowsCount],
      ];

      if (Object.keys(actionCounts).length > 0) {
          summaryData.push(["--- Auto-Fixes Breakdown ---", ""]);
          Object.entries(actionCounts).forEach(([act, count]) => {
              summaryData.push([`  ${act}`, count]);
          });
      }

      summaryData.push(["Rows with Remaining Errors", uniqueErrorRows]);

      if (Object.keys(errorCounts).length > 0) {
          summaryData.push(["--- Errors Breakdown ---", ""]);
          Object.entries(errorCounts).forEach(([err, count]) => {
              summaryData.push([`  ${err}`, count]);
          });
      }

      summaryData.push(["Date Processed", new Date().toLocaleString()]);

      const wsSummary = XLSX_STYLE.utils.aoa_to_sheet(summaryData);
      const rangeSum = XLSX_STYLE.utils.decode_range(wsSummary['!ref'] || "A1");
      for (let C = rangeSum.s.c; C <= rangeSum.e.c; ++C) {
          const ref = XLSX_STYLE.utils.encode_cell({ r: 0, c: C });
          if (wsSummary[ref]) wsSummary[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } } }; 
      }
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
      XLSX_STYLE.utils.book_append_sheet(wb, wsSummary, "Summary");

      // --- SHEET 4: Suppliers ---
      if (uniqueSuppliers.size > 0) {
          const supplierData = [["name", "code"]];
          uniqueSuppliers.forEach(s => supplierData.push([s, s]));
          const wsSuppliers = XLSX_STYLE.utils.aoa_to_sheet(supplierData);
          const rangeSup = XLSX_STYLE.utils.decode_range(wsSuppliers['!ref'] || "A1");
          for (let C = rangeSup.s.c; C <= rangeSup.e.c; ++C) {
              const ref = XLSX_STYLE.utils.encode_cell({ r: 0, c: C });
              if (wsSuppliers[ref]) wsSuppliers[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "9333EA" } } };
          }
          wsSuppliers['!cols'] = [{ wch: 40 }, { wch: 40 }];
          XLSX_STYLE.utils.book_append_sheet(wb, wsSuppliers, "Suppliers");
      }

      XLSX_STYLE.writeFile(wb, `Validated_${fileName || 'File'}.xlsx`);
      addLog("Export complete with Change Log, Summary and Suppliers list.", 'success');
  };

  const filteredRows = useMemo(() => {
      if (viewFilter === 'all') return processedData;
      const errorIndices = new Set(errors.map(e => e.rowIndex));
      return processedData.filter((_, idx) => errorIndices.has(idx));
  }, [processedData, viewFilter, errors]);

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          {/* ... (Header and File Upload UI) ... */}
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                <ShieldCheck className="text-indigo-600" size={24}/> Files Validation
             </h3>
             {fileName && (
                 <div className="flex gap-2">
                     <button onClick={() => setActiveTab('config')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === 'config' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>1. Mapping</button>
                     <button onClick={() => setActiveTab('results')} disabled={processedData.length === 0} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === 'results' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 disabled:opacity-50'}`}>2. Results</button>
                 </div>
             )}
          </div>

          {!fileName ? (
             <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center hover:bg-slate-50 transition-all cursor-pointer relative">
                 <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer"/>
                 <UploadCloud size={48} className="text-slate-300 mb-4"/>
                 <p className="text-slate-600 font-bold text-lg">{t.actions.uploadFile}</p>
                 <p className="text-slate-400 text-sm">Excel or CSV</p>
             </div>
          ) : (
             activeTab === 'config' ? (
                 <div className="animate-in fade-in slide-in-from-left-4">
                     {/* ... (Config UI) ... */}
                     <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-6">
                         <div className="bg-green-100 p-2 rounded text-green-700"><FileSpreadsheet size={20}/></div>
                         <div className="flex-1">
                             <p className="font-bold text-slate-700">{fileName}</p>
                             <p className="text-xs text-slate-500">{rawData.length} rows detected</p>
                         </div>
                         
                         {sheetNames.length > 1 && (
                             <div className="flex items-center gap-2 mr-4">
                                 <span className="text-xs font-bold text-slate-500">Sheet:</span>
                                 <select 
                                     value={selectedSheet} 
                                     onChange={(e) => setSelectedSheet(e.target.value)}
                                     className="p-1.5 border rounded text-xs bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                 >
                                     {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                                 </select>
                             </div>
                         )}

                         <button onClick={handleClear} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                     </div>

                     <div className="flex flex-col lg:flex-row gap-8">
                         <div className="flex-1">
                             {/* ... (Table) ... */}
                             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                     <h4 className="font-bold text-slate-700 flex items-center gap-2"><Settings size={16}/> Column Mapping</h4>
                                     <span className="text-xs text-slate-500">Map your file columns to the rules</span>
                                 </div>
                                 <div className="overflow-x-auto">
                                     <table className="w-full text-left text-sm">
                                         <thead className="bg-white text-slate-500 border-b border-slate-100">
                                             <tr>
                                                 <th className="p-4 font-bold w-1/3">Validation Field</th>
                                                 <th className="p-4 font-bold w-1/3">Your File Column</th>
                                                 <th className="p-4 font-bold w-1/3">Preview</th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-50">
                                             {FIELDS.map((field) => {
                                                 const mappedIndices = mapping[field.key] || [];
                                                 const previewVal = getPreviewValue(mappedIndices);
                                                 return (
                                                     <tr key={field.key} className="hover:bg-slate-50 transition-colors">
                                                         <td className="p-4 align-top">
                                                             <div className="font-bold text-slate-700">{field.label}</div>
                                                             <div className="text-xs text-slate-400 mt-1">{field.description}</div>
                                                             {field.type === 'id' && <span className="inline-block mt-2 px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold">Unique ID</span>}
                                                             {field.type === 'boolean' && <span className="inline-block mt-2 px-2 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-bold">Boolean</span>}
                                                         </td>
                                                         <td className="p-4 align-top">
                                                             <div className="relative group">
                                                                 <button onClick={() => setOpenDropdown(openDropdown === field.key ? null : field.key)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all flex justify-between items-center">
                                                                     <span className={`truncate ${mappedIndices.length ? 'font-medium' : 'text-slate-400 italic'}`}>
                                                                         {mappedIndices.length > 0 ? headers[mappedIndices[0]] + (mappedIndices.length > 1 ? ` (+${mappedIndices.length - 1})` : '') : 'Select Column...'}
                                                                     </span>
                                                                     <ChevronDown size={14} className="text-slate-400 shrink-0"/>
                                                                 </button>
                                                                 {openDropdown === field.key && (
                                                                     <>
                                                                         <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
                                                                         <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 custom-scrollbar">
                                                                             {headers.map((h, i) => (
                                                                                 <button key={i} onClick={() => { toggleMapping(field.key, i); setOpenDropdown(null); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center justify-between ${mappedIndices.includes(i) ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-600'}`}>
                                                                                     <span className="truncate">{h}</span>
                                                                                     {mappedIndices.includes(i) && <Check size={14} className="shrink-0"/>}
                                                                                 </button>
                                                                             ))}
                                                                         </div>
                                                                     </>
                                                                 )}
                                                             </div>
                                                             {mappedIndices.length > 0 && (
                                                                 <div className="flex flex-wrap gap-1 mt-2">
                                                                     {mappedIndices.map(idx => (
                                                                         <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-medium max-w-full truncate">
                                                                             <span className="truncate">{headers[idx]}</span>
                                                                             <button onClick={() => toggleMapping(field.key, idx)} className="ml-1 hover:text-indigo-900 shrink-0"><X size={10}/></button>
                                                                         </span>
                                                                     ))}
                                                                 </div>
                                                             )}
                                                         </td>
                                                         <td className="p-4 align-top">
                                                             <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-600 break-all min-h-[40px] flex items-center">{previewVal}</div>
                                                         </td>
                                                     </tr>
                                                 );
                                             })}
                                         </tbody>
                                     </table>
                                 </div>
                             </div>
                         </div>

                         <div className="lg:w-80 flex flex-col gap-4">
                             {/* VAT Settings Card */}
                             <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                                 <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                     <Percent size={16} className="text-indigo-600"/> VAT Settings (15%)
                                 </h4>
                                 <div className="space-y-3">
                                     <label className="flex items-start gap-2 cursor-pointer">
                                         <input type="checkbox" checked={costIncVat} onChange={e => setCostIncVat(e.target.checked)} className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"/>
                                         <span className="text-xs text-slate-600">Cost Column Includes VAT?</span>
                                     </label>
                                     <label className="flex items-start gap-2 cursor-pointer">
                                         <input type="checkbox" checked={retailIncVat} onChange={e => setRetailIncVat(e.target.checked)} className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"/>
                                         <span className="text-xs text-slate-600">Retail Price Includes VAT?</span>
                                     </label>
                                 </div>
                                 <div className="mt-2 p-2 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100">
                                     Validates if Cost (with Tax) {'>'} Retail Price (with Tax).
                                 </div>
                             </div>

                             <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                                 <h4 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2"><AlertOctagon size={16}/> Auto-Corrections</h4>
                                 <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                                     <li>Unmerge cells & fill values</li>
                                     <li>Remove filters, freeze panes, & hidden artifacts</li>
                                     <li>Negative numbers → 0</li>
                                     <li>Comma in numbers → Dot</li>
                                     <li>Scientific Notation → Full Number</li>
                                     <li>Empty SKU → Random "Rewaa-..."</li>
                                     <li>Pack SKU → Random "Pack-..." (If Label exists)</li>
                                     <li>Duplicate SKU → Appends "-1", "-2"</li>
                                     <li>Booleans → Standard "yes"/"no"</li>
                                 </ul>
                             </div>
                             <div className="sticky top-4">
                                 <button onClick={processValidation} disabled={status === ProcessingStatus.PROCESSING} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                    {status === ProcessingStatus.PROCESSING ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> : <Wand2 size={20}/>}
                                    Run Validation
                                 </button>
                             </div>
                         </div>
                     </div>
                 </div>
             ) : (
                 <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                     <div className="flex flex-wrap items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 gap-3">
                         <div className="flex items-center gap-4 text-sm">
                             <span className="font-bold text-slate-700">Total Rows: {processedData.length}</span>
                             <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={16}/> {errors.length} Issues Found</span>
                         </div>
                         <div className="flex bg-slate-200 p-1 rounded-lg">
                             <button onClick={() => setViewFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewFilter === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>All Rows</button>
                             <button onClick={() => setViewFilter('errors')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${viewFilter === 'errors' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Filter size={12}/> Errors Only ({errors.length})</button>
                         </div>
                         <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5">
                                 <Package size={14} className="text-slate-400"/>
                                 <input 
                                    type="number" 
                                    placeholder="Max Rows/File" 
                                    className="w-20 text-xs outline-none"
                                    value={exportBatchSize || ''}
                                    onChange={(e) => setExportBatchSize(Number(e.target.value))}
                                 />
                             </div>
                             <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-2 shadow-sm"><Download size={16}/> Export Report</button>
                         </div>
                     </div>
                     <div className="border border-slate-200 rounded-lg overflow-hidden h-[500px] flex flex-col bg-white">
                         <div className="overflow-auto flex-1 relative">
                             <table className="w-full text-xs text-left border-collapse">
                                 <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                                     <tr>
                                         <th className="p-3 border-b font-bold w-12 text-center">#</th>
                                         {headers.map((h, i) => (
                                             <th key={i} className="p-3 border-b font-semibold min-w-[120px]">{h}</th>
                                         ))}
                                         <th className="p-3 border-b font-bold text-red-600 min-w-[200px] bg-red-50">Error Description</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {filteredRows.slice(0, 100).map((row, rIdx) => {
                                         const errorDesc = row[headers.length]; 
                                         const hasError = !!errorDesc;
                                         return (
                                             <tr key={rIdx} className={`hover:bg-slate-50 ${hasError ? 'bg-red-50/30' : ''}`}>
                                                 <td className="p-3 border-b border-slate-100 text-center text-slate-400 font-mono">{rIdx + 1}</td>
                                                 {headers.map((_, cIdx) => (
                                                     <td key={cIdx} className="p-3 border-b border-slate-100 truncate max-w-[150px]" title={String(row[cIdx])}>{String(row[cIdx])}</td>
                                                 ))}
                                                 <td className="p-3 border-b border-slate-100 text-red-600 font-medium bg-red-50/10 truncate max-w-[250px]" title={errorDesc}>{errorDesc}</td>
                                             </tr>
                                         );
                                     })}
                                 </tbody>
                             </table>
                             {filteredRows.length === 0 && <div className="p-10 text-center text-slate-400 flex flex-col items-center"><CheckCircle2 size={48} className="mb-2 text-green-100"/><p>No rows found matching current filter.</p></div>}
                             {filteredRows.length > 100 && <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-50">Showing first 100 rows of {filteredRows.length}. Download export to see all.</div>}
                         </div>
                     </div>
                 </div>
             )
          )}
       </div>
       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default FileValidationTab;
