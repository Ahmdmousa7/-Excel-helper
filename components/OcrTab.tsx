import React, { useState, useEffect, useMemo } from 'react';
import { FileData, LogEntry, ProcessingStatus } from '../types';
import { TRANSLATIONS, Language } from '../utils/translations';
import { readExcelFile, getSheetData, saveWorkbook } from '../services/excelService';
import { aiService } from '../services/aiServiceFactory';
import ProgressBar from './ProgressBar';
import { 
  ScanText, UploadCloud, FileText, Zap, TableProperties, Edit3, 
  Trash2, Download, ArrowRight, Settings, Plus, CheckCircle,
  LayoutTemplate, Split, Filter, Search, X, ChevronDown, ChevronUp,
  Maximize2, Minimize2, Eye, GripVertical, Clipboard, FileInput, Map as MapIcon, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface MediaFile {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
  status: ProcessingStatus;
  rotation: number;
}

const OcrTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [templates, setTemplates] = useState<{id: string, label: string, icon: any, prompt: string, schema: any[]}[]>([]);
  
  // Config State
  const [inputType, setInputType] = useState<'file' | 'text'>('file');
  const [textInput, setTextInput] = useState<string>("");
  
  const [activeTemplate, setActiveTemplate] = useState<string>('free');
  const [useSchema, setUseSchema] = useState<boolean>(false);
  const [instruction, setInstruction] = useState<string>("");
  const [schemaFields, setSchemaFields] = useState<{name: string, desc: string}[]>([
     {name: 'Product SKU', desc: 'Item Code/SKU if Simple. Leave empty if variable'},
     {name: 'Variant SKU', desc: 'Item Code/SKU if Variable. Leave empty if simple'},
     {name: 'Product Name', desc: 'Name (Bilingual)'},
     {name: 'Category', desc: 'Product category or classification'},
     {name: 'Description', desc: 'Details (Bilingual)'},
     {name: 'Retail Price', desc: 'Price value'},
     {name: 'Enable stock management', desc: 'yes/no (Default no)'},
     {name: 'Option 1', desc: 'Category of variant 1 (e.g. Size, Flavor)'},
     {name: 'Option 1 Value', desc: 'Specific Option 1 (e.g. Small, Spicy)'},
     {name: 'Option 2', desc: 'Category of variant 2 (e.g. Color)'},
     {name: 'Option 2 Value', desc: 'Specific Option 2 (e.g. Red)'},
     {name: 'Option 3', desc: 'Category of variant 3 (e.g. Material)'},
     {name: 'Option 3 Value', desc: 'Specific Option 3 (e.g. Cotton)'},
     {name: 'Type', desc: 'Simple or Variable'}
  ]);

  // Options (Hidden from UI, enabled by default)
  const [autoBilingual, setAutoBilingual] = useState<boolean>(true);
  const [extractSizes, setExtractSizes] = useState<boolean>(true);
  const [generateRandomSkus, setGenerateRandomSkus] = useState<boolean>(true);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);

  const [masterData, setMasterData] = useState<any[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]); // Headers from extraction
  
  // UI State
  const [showConfig, setShowConfig] = useState(true);
  const [showSplitView, setShowSplitView] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // --- MAPPING STATE (DUAL) ---
  const [mappingTab, setMappingTab] = useState<'simple' | 'variable'>('simple');
  
  // Simple Template State
  const [simpleTemplateFile, setSimpleTemplateFile] = useState<File | null>(null);
  const [simpleHeaders, setSimpleHeaders] = useState<string[]>([]);
  const [simpleMapping, setSimpleMapping] = useState<Record<string, string>>({});

  // Variable Template State
  const [varTemplateFile, setVarTemplateFile] = useState<File | null>(null);
  const [varHeaders, setVarHeaders] = useState<string[]>([]);
  const [varMapping, setVarMapping] = useState<Record<string, string>>({});

  // --- SORT & FILTER STATE ---
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  // --- RESULT TABS STATE ---
  const [resultTab, setResultTab] = useState<'all' | 'simple' | 'variable'>('all');

  // Initialize Templates
  useEffect(() => {
    setTemplates([
      { id: 'free', label: t.ocr.labels.free, icon: Edit3, prompt: '', schema: [] },
      { id: 'invoice', label: t.ocr.labels.invoice, icon: FileText, prompt: 'Extract invoice items, qty, price, and total.', schema: [] },
      { id: 'menu', label: t.ocr.labels.menu, icon: Zap, prompt: 'Extract menu items. If items have choices (Spicy/Regular), split them into separate rows with Option 1 and Option 1 Value. Use Option 2/Option 2 Value for additional options.', schema: [] },
      { id: 'receipt', label: t.ocr.labels.receipt, icon: TableProperties, prompt: 'Extract purchased items and prices from receipt.', schema: [] },
    ]);
  }, [language, t]);

  useEffect(() => {
    return () => {
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  // --- MAPPING HELPERS ---
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'simple' | 'variable') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await readExcelFile(file);
        const firstSheet = data.sheets[0];
        const rows = getSheetData(data.workbook, firstSheet, false); // Get all rows
        
        if (rows.length > 0) {
           const headers = rows[0] as string[];
           
           // Auto-map logic
           const initialMapping: Record<string, string> = {};
           headers.forEach(h => {
              const match = rawHeaders.find(rh => rh.toLowerCase() === String(h).toLowerCase());
              if (match) initialMapping[h] = match;
           });

           if (type === 'simple') {
               setSimpleTemplateFile(file);
               setSimpleHeaders(headers);
               setSimpleMapping(initialMapping);
               addLog(`Loaded Simple Template: ${file.name}`, 'success');
           } else {
               setVarTemplateFile(file);
               setVarHeaders(headers);
               setVarMapping(initialMapping);
               addLog(`Loaded Variable Template: ${file.name}`, 'success');
           }
        }
      } catch (err: any) {
        addLog(`Template Error: ${err.message}`, 'error');
      }
    }
  };

  const clearTemplate = (type: 'simple' | 'variable') => {
      if (type === 'simple') {
          setSimpleTemplateFile(null);
          setSimpleHeaders([]);
          setSimpleMapping({});
      } else {
          setVarTemplateFile(null);
          setVarHeaders([]);
          setVarMapping({});
      }
  };

  const updateMapping = (type: 'simple' | 'variable', templateHeader: string, extractedHeader: string) => {
      if (type === 'simple') {
          setSimpleMapping(prev => ({...prev, [templateHeader]: extractedHeader}));
      } else {
          setVarMapping(prev => ({...prev, [templateHeader]: extractedHeader}));
      }
  };

  // --- SORT & FILTER HELPERS ---
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const processedData = useMemo(() => {
    let data = [...masterData];

    // 0. Result Tab Filter (Simple/Variable/All)
    if (resultTab === 'simple') {
        data = data.filter(r => {
            const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
            return typeVal.includes('simple') || (!typeVal.includes('variable') && !typeVal.includes('var'));
        });
    } else if (resultTab === 'variable') {
        data = data.filter(r => {
            const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
            return typeVal.includes('variable') || typeVal.includes('var');
        });
    }

    // 1. Column Filter
    Object.keys(filters).forEach(key => {
      const filterVal = filters[key].toLowerCase();
      if (filterVal) {
        data = data.filter(row => String(row[key] || '').toLowerCase().includes(filterVal));
      }
    });

    // 2. Sort
    if (sortConfig) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        const isNum = !isNaN(numA) && !isNaN(numB) && typeof valA !== 'string'; // Rough check

        if (isNum) {
           return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        } else {
           const strA = String(valA || "").toLowerCase();
           const strB = String(valB || "").toLowerCase();
           return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
      });
    }

    return data;
  }, [masterData, filters, sortConfig, resultTab]);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: MediaFile[] = [];
      const uploadedFiles: File[] = Array.from(e.target.files);
      for (const file of uploadedFiles) {
         const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
               const res = ev.target?.result as string;
               resolve(res.split(',')[1]); 
            };
            reader.readAsDataURL(file);
         });

         newFiles.push({
           id: Math.random().toString(36).substr(2, 9),
           file,
           previewUrl: URL.createObjectURL(file),
           base64Data,
           mimeType: file.type,
           status: ProcessingStatus.IDLE,
           rotation: 0
         });
      }
      setFiles(prev => [...prev, ...newFiles]);
      addLog(`${t.common.processing} ${uploadedFiles.length} files...`, 'info');
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const constructPrompt = () => {
    // 1. Detect keywords in instruction to enable hidden features
    const instrLower = instruction.toLowerCase();
    // Default to true now as requested, but also keep keyword check just in case
    const enableTranslate = autoBilingual || instrLower.includes("translate");
    const enableSplit = extractSizes || instrLower.includes("split") || instrLower.includes("variant");

    if (useSchema) {
      const schemaDesc = schemaFields.map(f => `${f.name}: ${f.desc}`).join(', ');
      return `Extract data strictly following this schema structure: [${schemaDesc}]. ${instruction}`;
    }
    
    const selectedTmpl = templates.find(t => t.id === activeTemplate);
    let prompt = selectedTmpl?.prompt || "Extract data into a table.";
    
    // Add User Instructions
    if (instruction) prompt += `\n\nUser Notes: ${instruction}`;
    
    // Feature Injections
    if (enableTranslate) prompt += " Translate ALL text fields (Product Name, Description, Option 1 Value, Option 2 Value, Option 3 Value): Arabic->English (concat using ' | ') or English->Arabic (concat using ' | '). If already bilingual, keep as is.";
    if (enableSplit) prompt += " DETECT VARIANTS: If an item has options (Size, Flavor, Type) like 'Spicy/Regular' or 'Small/Large', YOU MUST split it into separate rows. **CRITICAL: If the price is a range like '20 - 30', split it into TWO separate rows.** For price ranges where sizes aren't named, use 'Small | صغير' for the lower price and 'Large | كبير' for the higher price, under 'Option 1'. Set Type='Variable' and fill Option 1/Option 1 Value. If there are multiple variant dimensions (e.g. Size AND Color), use Option 2/Option 2 Value for the additional variants.";
    
    // Enhanced Prompt for SKU, Stock, and Category
    prompt += " MANDATORY COLUMNS: 1. 'Product SKU' (if Simple) or 'Variant SKU' (if Variable): Extract code/ID if visible, otherwise leave empty. 2. 'Category': Extract category. 3. 'Enable stock management': 'yes' or 'no' (default 'no'). 4. 'Type': 'Simple' or 'Variable'.";

    return prompt;
  };

  const handleProcess = async () => {
      if (inputType === 'file' && files.length === 0) return;
      if (inputType === 'text' && !textInput.trim()) return;

      setStatus(ProcessingStatus.PROCESSING);
      setProgress(0);
      setMasterData([]);
      setRawHeaders([]);
      addLog(t.common.processing, 'info');

      const fullPrompt = constructPrompt();
      // We'll also accumulate in `allResults` for post-process check, but UI updates via state setters
      const allResults: any[] = []; 

      let currentFileIndex = 0;
      let simulatedFileProgress = 0;
      const totalItems = inputType === 'text' ? 1 : Math.max(1, files.length);

      const progressInterval = setInterval(() => {
          simulatedFileProgress += (90 - simulatedFileProgress) * 0.1;
          const baseProgress = (currentFileIndex / totalItems) * 100;
          const currentFileContribution = (simulatedFileProgress / 100) * (100 / totalItems);
          setProgress(Math.round(baseProgress + currentFileContribution));
      }, 500);

      if (inputType === 'text') {
          // TEXT MODE
          try {
              const result: any = await aiService.extractStructuredData(textInput, fullPrompt);
              const resultArray = Array.isArray(result) ? result : [result];
              
              if (resultArray.length > 0) {
                  // Post-Process: Generate Random SKUs
                  const enableRandomSku = generateRandomSkus || instruction.toLowerCase().includes("random sku") || instruction.toLowerCase().includes("generate sku");
                  if (enableRandomSku) {
                      resultArray.forEach((r: any) => {
                          const isVar = String(r.Type || '').toLowerCase() === 'variable';
                          if (isVar) {
                              if (!r['Variant SKU'] || String(r['Variant SKU']).trim() === '') {
                                  r['Variant SKU'] = `GEN-${Math.floor(Math.random() * 1000000)}`;
                              }
                          } else {
                              if (!r['Product SKU'] || String(r['Product SKU']).trim() === '') {
                                  r['Product SKU'] = `GEN-${Math.floor(Math.random() * 1000000)}`;
                              }
                          }
                      });
                  }
                  
                  allResults.push(...resultArray);
                  setMasterData(resultArray);
                  setRawHeaders(Object.keys(resultArray[0]));
                  
                  resultArray.forEach((r: any) => {
                      const itemName = r['Product Name'] || r.Item || r.Name || r.name || r.item || r.Description || 'Unknown Item';
                      addLog(`Extracted: ${itemName}`, 'success');
                  });
              }
          } catch (e: any) {
              addLog(`Error processing text: ${e.message}`, 'error');
          }
          clearInterval(progressInterval);
          setProgress(100);
      } else {
          // FILE MODE
          for (let i = 0; i < files.length; i++) {
              currentFileIndex = i;
              simulatedFileProgress = 0;
              const file = files[i];
              addLog(`Processing file ${i + 1} of ${files.length}: ${file.file.name}...`, 'info');
              try {
                  const result: any = await aiService.extractFromMedia({ data: file.base64Data, mimeType: file.mimeType }, fullPrompt, (msg: string) => {
                      addLog(msg, 'success');
                  });
                  
                  if (Array.isArray(result) && result.length > 0) {
                      allResults.push(...result);
                      
                      // Post-Process: Generate Random SKUs if keyword present or flag set (Per batch)
                      const enableRandomSku = generateRandomSkus || instruction.toLowerCase().includes("random sku") || instruction.toLowerCase().includes("generate sku");
                      if (enableRandomSku) {
                          result.forEach((r: any) => {
                              const isVar = String(r.Type || '').toLowerCase() === 'variable';
                              if (isVar) {
                                  if (!r['Variant SKU'] || String(r['Variant SKU']).trim() === '') {
                                      r['Variant SKU'] = `GEN-${Math.floor(Math.random() * 1000000)}`;
                                  }
                              } else {
                                  if (!r['Product SKU'] || String(r['Product SKU']).trim() === '') {
                                      r['Product SKU'] = `GEN-${Math.floor(Math.random() * 1000000)}`;
                                  }
                              }
                          });
                      }

                      result.forEach((r: any) => {
                          const itemName = r['Product Name'] || r.Item || r.Name || r.name || r.item || r.Description || 'Unknown Item';
                          addLog(`Extracted: ${itemName}`, 'success');
                      });

                      // Incremental Update
                      setMasterData(prev => {
                          const newData = [...prev, ...result];
                          return newData;
                      });
                      
                      // Update headers if not set yet
                      setRawHeaders(prev => {
                          if (prev.length === 0 && result.length > 0) {
                              return Object.keys(result[0]);
                          }
                          return prev;
                      });
                  }
              } catch (e: any) {
                  addLog(`Error processing ${file.file.name}: ${e.message}`, 'error');
              }
              setProgress(Math.round(((i + 1) / files.length) * 100));
          }
          clearInterval(progressInterval);
      }

      // Post-Process: Ensure unique names across categories
      if (allResults.length > 0) {
          const nameKey = Object.keys(allResults[0]).find(k => k.toLowerCase() === 'product name' || k.toLowerCase() === 'name' || k.toLowerCase() === 'item' || k.toLowerCase() === 'description');
          const catKey = Object.keys(allResults[0]).find(k => k.toLowerCase() === 'category' || k.toLowerCase() === 'group' || k.toLowerCase() === 'section');

          if (nameKey && catKey) {
              const nameToCats = new Map<string, Set<string>>();
              allResults.forEach(r => {
                  const name = String(r[nameKey] || '').trim();
                  const cat = String(r[catKey] || '').trim();
                  if (name && cat) {
                      if (!nameToCats.has(name)) nameToCats.set(name, new Set());
                      nameToCats.get(name)!.add(cat);
                  }
              });

              const nameCatToSuffix = new Map<string, Map<string, string>>();
              nameToCats.forEach((cats, name) => {
                  if (cats.size > 1) {
                      const catMap = new Map<string, string>();
                      let counter = 0;
                      Array.from(cats).sort().forEach(cat => {
                          const letter = String.fromCharCode(65 + (counter % 26));
                          const suffix = counter >= 26 ? ` ${letter}${Math.floor(counter/26)}` : ` ${letter}`;
                          catMap.set(cat, suffix);
                          counter++;
                      });
                      nameCatToSuffix.set(name, catMap);
                  }
              });

              let modifiedCount = 0;
              allResults.forEach(r => {
                  const name = String(r[nameKey] || '').trim();
                  const cat = String(r[catKey] || '').trim();
                  if (name && cat && nameCatToSuffix.has(name)) {
                      const suffix = nameCatToSuffix.get(name)!.get(cat);
                      if (suffix) {
                          r[nameKey] = `${name}${suffix}`;
                          modifiedCount++;
                      }
                  }
              });
              
              if (modifiedCount > 0) {
                  addLog(`Auto-resolved ${modifiedCount} duplicate item names across different categories.`, 'info');
                  setMasterData([...allResults]);
              }
          }
      }

      // Check if anything was extracted
      if (allResults.length > 0) {
          addLog(`${t.common.completed} ${allResults.length} items extracted.`, 'success');
          setShowConfig(false); // Auto collapse config to show results
          
          exportData(allResults); // Auto export logic
      } else {
          addLog("No data extracted.", 'warning');
      }
      setStatus(ProcessingStatus.COMPLETED);
  };

  const mapDataToTemplate = (rows: any[], mapping: Record<string, string>, templateHeaders: string[]) => {
      return rows.map(row => {
          const newRow: any = {};
          templateHeaders.forEach(tmplHead => {
              const sourceKey = mapping[tmplHead];
              newRow[tmplHead] = sourceKey ? row[sourceKey] : "";
          });
          return newRow;
      });
  };

  const exportData = (dataToExport: any[]) => {
      if (dataToExport.length === 0) return;
      
      const wb = XLSX.utils.book_new();
      
      // 1. All Data Sheet
      const wsAll = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(wb, wsAll, "All Extracted Data");

      // Filter Rows
      const simpleRows = dataToExport.filter(r => {
          const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
          return typeVal === 'simple' || (!typeVal.includes('variable') && !typeVal.includes('var'));
      }).map(row => {
          const newRow = { ...row };
          // Remove variable specific columns for simple products
          const keysToRemove = Object.keys(newRow).filter(k => {
              const lower = k.toLowerCase();
              return lower.includes('option') || lower.includes('variant');
          });
          keysToRemove.forEach(k => delete newRow[k]);
          return newRow;
      });
      
      const variableRows = dataToExport.filter(r => {
          const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
          return typeVal.includes('variable') || typeVal.includes('var');
      }).map(row => {
          const newRow = { ...row };
          // Remove simple specific columns for variable products
          const keysToRemove = Object.keys(newRow).filter(k => {
              const lower = k.toLowerCase();
              return lower === 'product sku' || lower === 'product_sku';
          });
          keysToRemove.forEach(k => delete newRow[k]);
          return newRow;
      });

      // 2. Simple Products Sheet (Mapped if template exists)
      if (simpleRows.length > 0) {
          let exportSimple = simpleRows;
          let sheetName = "Simple Products";
          if (simpleTemplateFile && simpleHeaders.length > 0) {
              exportSimple = mapDataToTemplate(simpleRows, simpleMapping, simpleHeaders);
              sheetName = "Mapped Simple";
          }
          const wsSimple = XLSX.utils.json_to_sheet(exportSimple);
          XLSX.utils.book_append_sheet(wb, wsSimple, sheetName);
      }

      // 3. Variable Products Sheet (Mapped if template exists)
      if (variableRows.length > 0) {
          let exportVar = variableRows;
          let sheetName = "Variable Products";
          if (varTemplateFile && varHeaders.length > 0) {
              exportVar = mapDataToTemplate(variableRows, varMapping, varHeaders);
              sheetName = "Mapped Variable";
          }
          const wsVariable = XLSX.utils.json_to_sheet(exportVar);
          XLSX.utils.book_append_sheet(wb, wsVariable, sheetName);
      }

      saveWorkbook(wb, `OCR_Extract_${Date.now()}.xlsx`);
      addLog("Exported successfully (Split & Mapped).", 'success');
  };

  const handleExport = () => {
      exportData(masterData);
  };

  return (
      <div className="space-y-6">
          {/* CONFIGURATION PANEL */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div 
                className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer"
                onClick={() => setShowConfig(!showConfig)}
              >
                  <h3 className="font-bold text-slate-700 flex items-center">
                      <ScanText size={20} className="mr-2 text-indigo-600"/> OCR Extraction
                  </h3>
                  {showConfig ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
              </div>
              
              {showConfig && (
                  <div className="p-6 space-y-6 animate-in slide-in-from-top-2">
                      
                      {/* Input Mode Toggle */}
                      <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                          <button onClick={() => setInputType('file')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${inputType === 'file' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                              <UploadCloud size={14}/> Upload Files
                          </button>
                          <button onClick={() => setInputType('text')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${inputType === 'text' ? 'bg-white text-indigo-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                              <Clipboard size={14}/> Paste Text
                          </button>
                      </div>

                      {/* Input Area */}
                      {inputType === 'file' ? (
                          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-slate-50 transition-all cursor-pointer relative">
                              <input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer"/>
                              <UploadCloud size={40} className="text-slate-300 mb-4"/>
                              <p className="text-slate-600 font-bold">{t.ocr.uploadTitle}</p>
                              <p className="text-slate-400 text-sm">JPG, PNG, PDF</p>
                          </div>
                      ) : (
                          <div className="relative">
                              <textarea 
                                  value={textInput}
                                  onChange={(e) => setTextInput(e.target.value)}
                                  placeholder="Paste raw text here (e.g. from a PDF or website)..."
                                  className="w-full h-40 p-4 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                              />
                              <button onClick={() => setTextInput('')} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1 bg-white rounded-full shadow-sm"><X size={14}/></button>
                          </div>
                      )}

                      {/* File List (Only for File Mode) */}
                      {inputType === 'file' && files.length > 0 && (
                          <div>
                              <h4 className="text-sm font-bold text-slate-700 mb-2">Files ({files.length})</h4>
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                  {files.map(f => (
                                      <div key={f.id} className="relative w-20 h-20 border rounded-lg overflow-hidden shrink-0 group">
                                          {f.mimeType.includes('image') ? (
                                              <img
                                                src={f.previewUrl}
                                                alt={`Preview of ${f.file.name}`}
                                                className="w-full h-full object-cover"
                                              />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">PDF</div>
                                          )}
                                          <button onClick={() => removeFile(f.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Trash2 size={12}/>
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* Templates Grid */}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Extraction Template</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {templates.map(tmpl => (
                                  <button
                                      key={tmpl.id}
                                      onClick={() => { setActiveTemplate(tmpl.id); setUseSchema(false); }}
                                      className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-2 ${activeTemplate === tmpl.id && !useSchema ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300'}`}
                                  >
                                      <tmpl.icon size={20} className={activeTemplate === tmpl.id && !useSchema ? 'text-indigo-600' : 'text-slate-400'}/>
                                      <span className={`text-xs font-bold ${activeTemplate === tmpl.id && !useSchema ? 'text-indigo-700' : 'text-slate-600'}`}>{tmpl.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Schema Builder Toggle */}
                      <div className="border-t border-slate-100 pt-4">
                          <label className="flex items-center gap-2 cursor-pointer mb-4">
                              <input type="checkbox" checked={useSchema} onChange={e => setUseSchema(e.target.checked)} className="rounded text-indigo-600"/>
                              <span className="font-bold text-slate-700 flex items-center gap-2"><LayoutTemplate size={16}/> Custom Schema Builder</span>
                          </label>
                          
                          {useSchema && (
                              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                  {schemaFields.map((field, idx) => (
                                      <div key={idx} className="flex gap-2 items-center">
                                          <input 
                                              value={field.name} 
                                              onChange={e => { const n = [...schemaFields]; n[idx].name = e.target.value; setSchemaFields(n); }}
                                              className="w-1/3 p-2 border rounded text-xs" placeholder="Field Name"
                                          />
                                          <input 
                                              value={field.desc} 
                                              onChange={e => { const n = [...schemaFields]; n[idx].desc = e.target.value; setSchemaFields(n); }}
                                              className="flex-1 p-2 border rounded text-xs" placeholder="Description / Type"
                                          />
                                          <button onClick={() => setSchemaFields(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                      </div>
                                  ))}
                                  <button onClick={() => setSchemaFields([...schemaFields, {name: '', desc: ''}])} className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                                      <Plus size={12}/> Add Field
                                  </button>
                              </div>
                          )}
                      </div>

                      {/* Additional Instructions */}
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Additional Instructions</label>
                          <textarea
                              value={instruction}
                              onChange={(e) => setInstruction(e.target.value)}
                              className="w-full p-3 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400"
                              placeholder={language === 'ar' ? 'مثال: ترجم إلى العربية، افصل المقاسات، أنشئ SKU...' : 'e.g. Translate to Arabic, Split variants, Generate SKUs...'}
                              rows={3}
                          />
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                              <div className="flex items-center gap-2 font-bold mb-1"><Info size={14}/> Active Features:</div>
                              <ul className="list-disc list-inside space-y-0.5 ml-1 text-blue-700">
                                  <li>Auto-Translation, Variant Splitting, and Random SKU Generation are enabled by default.</li>
                              </ul>
                          </div>
                      </div>

                      {/* Action */}
                      <div className="flex justify-end pt-4 border-t border-slate-100">
                          <button 
                              onClick={handleProcess} 
                              disabled={(inputType === 'file' && files.length === 0) || (inputType === 'text' && !textInput) || status === ProcessingStatus.PROCESSING}
                              className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              {status === ProcessingStatus.PROCESSING ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> : <Zap size={18}/>}
                              {t.ocr.extractBtn}
                          </button>
                      </div>
                  </div>
              )}
          </div>

          {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}

          {/* RESULTS AREA */}
          {masterData.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                  {/* Toolbar */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
                      <div className="flex items-center gap-2">
                          <div className="flex bg-white rounded border border-slate-300 p-0.5">
                              <button onClick={() => setResultTab('all')} className={`px-3 py-1 text-xs font-bold rounded ${resultTab === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>All</button>
                              <button onClick={() => setResultTab('simple')} className={`px-3 py-1 text-xs font-bold rounded ${resultTab === 'simple' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>Simple</button>
                              <button onClick={() => setResultTab('variable')} className={`px-3 py-1 text-xs font-bold rounded ${resultTab === 'variable' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500'}`}>Variable</button>
                          </div>
                          {inputType === 'file' && (
                              <>
                                <div className="h-4 w-px bg-slate-300 mx-2"></div>
                                <button onClick={() => setShowSplitView(!showSplitView)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold border transition-colors ${showSplitView ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-300'}`}>
                                    <Split size={14}/> Verify Mode
                                </button>
                              </>
                          )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-bold">{processedData.length} Items</span>
                          <button onClick={handleExport} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm">
                              <Download size={14}/> Export
                          </button>
                      </div>
                  </div>

                  {/* Content Area */}
                  <div className={`flex ${showSplitView ? 'h-[600px]' : 'h-auto max-h-[600px]'}`}>
                      
                      {/* Left: Split View (Image/PDF) */}
                      {showSplitView && inputType === 'file' && (
                          <div className="w-1/3 border-r border-slate-200 bg-slate-800 flex items-center justify-center p-4 relative">
                              {files.length > 0 ? (
                                  <div className="relative w-full h-full">
                                      {files[0].mimeType.includes("pdf") ? (
                                        <iframe src={files[0].previewUrl} className="w-full h-full rounded" title="Source PDF" />
                                      ) : (
                                        <img src={files[0].previewUrl} className="object-contain w-full h-full rounded" alt="Source" />
                                      )}
                                      <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded">Source: {files[0].file.name}</div>
                                  </div>
                              ) : (
                                  <span className="text-slate-500">No source file</span>
                              )}
                          </div>
                      )}

                      {/* Right: Data Table */}
                      <div className="flex-1 overflow-hidden flex flex-col">
                          <div className="flex-1 overflow-auto">
                              <table className="w-full text-xs text-left border-collapse">
                                  <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                                      <tr>
                                          {rawHeaders.map(h => (
                                              <th key={h} className="p-2 border-b min-w-[120px]">
                                                  <div className="flex flex-col gap-1">
                                                      <button onClick={() => handleSort(h)} className="font-bold flex items-center gap-1 hover:text-indigo-600">
                                                          {h} <ArrowRight size={10} className={sortConfig?.key === h ? 'text-indigo-600' : 'text-transparent'}/>
                                                      </button>
                                                      <input 
                                                          placeholder="Filter..." 
                                                          className="w-full px-1.5 py-0.5 border rounded text-[10px] focus:border-indigo-500 outline-none font-normal"
                                                          value={filters[h] || ''}
                                                          onChange={e => handleFilterChange(h, e.target.value)}
                                                      />
                                                  </div>
                                              </th>
                                          ))}
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {processedData.map((row, i) => (
                                          <tr 
                                            key={i} 
                                            className={`hover:bg-indigo-50 border-b border-slate-100 last:border-0 cursor-pointer ${activeRowIndex === i ? 'bg-indigo-50' : ''}`}
                                            onClick={() => setActiveRowIndex(i)}
                                          >
                                              {rawHeaders.map(h => (
                                                  <td key={h} className="p-2 truncate max-w-[200px] border-r border-transparent">
                                                      {String(row[h] || "")}
                                                  </td>
                                              ))}
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
                  
                  {/* Advanced Mapping Section (Bottom of Results) */}
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2"><Settings size={16}/> Advanced: Template Mapping</h4>
                          <div className="flex bg-white rounded border border-slate-200 p-0.5">
                              <button onClick={() => setMappingTab('simple')} className={`px-3 py-1 text-xs font-bold rounded ${mappingTab === 'simple' ? 'bg-slate-200 text-slate-800' : 'text-slate-500'}`}>Simple Template</button>
                              <button onClick={() => setMappingTab('variable')} className={`px-3 py-1 text-xs font-bold rounded ${mappingTab === 'variable' ? 'bg-slate-200 text-slate-800' : 'text-slate-500'}`}>Variable Template</button>
                          </div>
                      </div>
                      
                      <div className="flex gap-4 items-center mb-4">
                          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition-colors">
                              <UploadCloud size={16} className="text-slate-400"/>
                              <span className="text-xs font-bold text-slate-600">
                                  {mappingTab === 'simple' 
                                      ? (simpleTemplateFile ? simpleTemplateFile.name : "Upload Simple Excel Template")
                                      : (varTemplateFile ? varTemplateFile.name : "Upload Variable Excel Template")
                                  }
                              </span>
                              <input type="file" className="hidden" accept=".xlsx" onChange={(e) => handleTemplateUpload(e, mappingTab)}/>
                          </label>
                          {(mappingTab === 'simple' ? simpleTemplateFile : varTemplateFile) && (
                              <button onClick={() => clearTemplate(mappingTab)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                  <Trash2 size={16}/>
                              </button>
                          )}
                          <p className="text-[10px] text-slate-400">
                              Upload an Excel file with headers to automatically map extracted data to your format.
                          </p>
                      </div>

                      {/* Manual Mapping UI */}
                      {(mappingTab === 'simple' ? simpleTemplateFile : varTemplateFile) && (
                          <div className="bg-white border border-slate-200 rounded-lg p-4">
                              <h5 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-2"><MapIcon size={14}/> Column Mapper ({mappingTab})</h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                  {(mappingTab === 'simple' ? simpleHeaders : varHeaders).map((tmplHead, idx) => (
                                      <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                                          <span className="text-[10px] font-bold text-slate-700 w-1/3 truncate" title={tmplHead}>{tmplHead}</span>
                                          <ArrowRight size={10} className="text-slate-400"/>
                                          <select 
                                              className="flex-1 text-[10px] p-1 border rounded bg-white"
                                              value={(mappingTab === 'simple' ? simpleMapping : varMapping)[tmplHead] || ""}
                                              onChange={(e) => updateMapping(mappingTab, tmplHead, e.target.value)}
                                          >
                                              <option value="">-- Ignore --</option>
                                              {rawHeaders.map(h => (
                                                  <option key={h} value={h}>{h}</option>
                                              ))}
                                          </select>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}
      </div>
  );
};

export default OcrTab;