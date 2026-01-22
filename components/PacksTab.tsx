
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Package, Settings2, ArrowUpDown, Key, ScanLine, AlertTriangle, CheckCircle2, Search, Wand2, FileWarning } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl', '5xl'];

const compareValues = (a: any, b: any) => {
  const valA = a !== undefined && a !== null ? String(a).trim() : "";
  const valB = b !== undefined && b !== null ? String(b).trim() : "";

  if (valA === "" && valB === "") return 0;
  if (valA === "") return 1;
  if (valB === "") return -1;

  const numA = parseFloat(valA);
  const numB = parseFloat(valB);
  
  const isNumA = !isNaN(numA) && /^-?\d*(\.\d+)?$/.test(valA);
  const isNumB = !isNaN(numB) && /^-?\d*(\.\d+)?$/.test(valB);

  if (isNumA && isNumB) {
    return numA - numB;
  }

  const sizeA = valA.toLowerCase();
  const sizeB = valB.toLowerCase();
  const idxA = SIZE_ORDER.indexOf(sizeA);
  const idxB = SIZE_ORDER.indexOf(sizeB);

  if (idxA !== -1 && idxB !== -1) {
    return idxA - idxB;
  }

  return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
};

// --- NORMALIZER ---
const normalizeKey = (val: any, smart: boolean): string => {
    if (val === null || val === undefined) return "";
    let str = String(val).trim();
    if (!smart) return str;

    // Fix Scientific Notation or numeric variations
    // 1. Check if valid number
    const num = Number(str);
    if (!isNaN(num) && str !== "") {
        // 2. Check if it LOOKS like scientific (contains E/e) OR we just want to standardize "1.0" vs "1"
        if (str.length > 15 && !str.includes('.')) return str; // Keep huge integers as-is if string
        return String(num); 
    }
    return str;
};

const PacksTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  
  const [keyColIndex, setKeyColIndex] = useState<number | null>(null);
  const [sortColIndex, setSortColIndex] = useState<number | null>(null);
  const [smartNormalize, setSmartNormalize] = useState<boolean>(true);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);

  useEffect(() => {
    if (fileData) {
      if (!selectedSheet && fileData.sheets.length > 0) {
        setSelectedSheet(fileData.sheets[0]);
      }
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, false);
      if (data.length > 0) {
        const heads = data[0] as string[];
        setHeaders(heads);
        
        // Auto-Detect Key Column (SKU, Barcode, etc.)
        const candidates = ['sku', 'barcode', 'item id', 'part number', 'code', 'id', 'معرف', 'باركود', 'رمز'];
        const foundIdx = heads.findIndex(h => 
            h && candidates.some(c => h.toLowerCase().includes(c))
        );
        
        if (foundIdx !== -1) {
            setKeyColIndex(foundIdx);
            addLog(`Auto-selected '${heads[foundIdx]}' as Grouping Key. You can change this below.`, 'info');
        } else {
            setKeyColIndex(null);
        }
        
        setSortColIndex(null);
      }
    }
  }, [fileData, selectedSheet]);

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    if (keyColIndex === null) {
      addLog("Please select a Key Column (e.g., SKU or Barcode).", 'warning');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');
    
    try {
      await new Promise(r => setTimeout(r, 100));

      // Use raw=true to get best possible original values before our manual normalization
      const rawData = getSheetData(fileData.workbook, selectedSheet, true);
      const originalHeaders = rawData[0] as string[];
      const rows = rawData.slice(1);
      
      const groups = new Map<string, { row: any[], originalIdx: number }[]>();
      let notationFixCount = 0;

      // Extend headers for validation output
      const errorSheetHeaders = [...originalHeaders, "Error Description", "Cell Reference"];
      
      // 1. Grouping Pass
      rows.forEach((row, rIdx) => {
        const keyVal = row[keyColIndex];
        const normalizedKey = normalizeKey(keyVal, smartNormalize);
        
        // Notation Check
        if (String(keyVal).trim() !== normalizedKey && normalizedKey !== "" && smartNormalize) {
            notationFixCount++;
        }
        
        if (normalizedKey) {
           if (!groups.has(normalizedKey)) {
             groups.set(normalizedKey, []);
           }
           groups.get(normalizedKey)!.push({ row, originalIdx: rIdx });
        }
      });

      if (notationFixCount > 0) addLog(`Fixed ${notationFixCount} scientific notation issues.`, 'success');

      const packGroups = new Map<string, any[][]>(); // Clean Packs
      const singleRows: any[][] = []; // Unique Items
      const validDuplicateRows: any[][] = []; // Raw rows of clean packs
      const errorRows: any[][] = []; // Rows with issues

      let issuesCount = 0;

      // 2. Validation & Separation Pass
      groups.forEach((groupData, key) => {
          const groupRows = groupData.map(g => g.row);
          const errorsInGroup: { msg: string, idx: number }[] = [];

          // Rule 1: Max 3 Packs (Total size > 3 is error, assuming 1 item + 2 packs = 3 total occurrences max?)
          // User said "more than 3 packs". Usually implies Group Size > 3 is the limit.
          if (groupRows.length > 3) {
              groupData.forEach(g => {
                  errorsInGroup.push({
                      msg: `Issue: Too many packs (${groupRows.length} found, max 3 allowed)`,
                      idx: g.originalIdx
                  });
              });
          }

          // Rule 2 & 3: Sort Value Checks (Missing or Duplicate within group)
          if (sortColIndex !== null) {
              const sortValuesSeen = new Map<string, number[]>(); // Value -> Indices

              groupData.forEach((g) => {
                  const sortVal = g.row[sortColIndex];
                  const normSortVal = String(sortVal || "").trim().toLowerCase();

                  // Check Missing
                  if (normSortVal === "") {
                      errorsInGroup.push({
                          msg: "Error: Missing Sort Value",
                          idx: g.originalIdx
                      });
                  } else {
                      if (!sortValuesSeen.has(normSortVal)) sortValuesSeen.set(normSortVal, []);
                      sortValuesSeen.get(normSortVal)!.push(g.originalIdx);
                  }
              });

              // Check Duplicates in Sort Value (e.g. 2 rows have 'Size L')
              sortValuesSeen.forEach((indices, val) => {
                  if (indices.length > 1) {
                      indices.forEach(idx => {
                          errorsInGroup.push({
                              msg: `Error: Duplicate Sort Value '${val}' in same product`,
                              idx: idx
                          });
                      });
                  }
              });
          }

          // Decide where to put this group
          if (errorsInGroup.length > 0) {
              issuesCount++;
              // Add to Error Sheet
              // We reconstruct the row with error details appended
              groupData.forEach(g => {
                  const rowErrors = errorsInGroup.filter(e => e.idx === g.originalIdx);
                  if (rowErrors.length > 0) {
                      const msgs = rowErrors.map(e => e.msg).join("; ");
                      // Calculate Excel Cell Address: Column Letter + Row Number
                      // Row Number = originalIdx + 2 (1 for header, +1 for 0-based index)
                      const cellRef = XLSX.utils.encode_cell({ c: keyColIndex, r: g.originalIdx + 1 });
                      
                      const errorRow = [...g.row, msgs, `Cell: ${cellRef}`];
                      errorRows.push(errorRow);
                  } else {
                      // Even valid rows in an invalid group might go to error sheet for context? 
                      // Or just ignore. Let's add them with "Group Error" context.
                      const errorRow = [...g.row, "Part of invalid group", `Group Key: ${key}`];
                      errorRows.push(errorRow);
                  }
              });
          } else {
              // Valid Group
              if (groupRows.length > 1) {
                  // Sort if needed
                  if (sortColIndex !== null) {
                      groupRows.sort((a, b) => compareValues(a[sortColIndex], b[sortColIndex]));
                  }
                  packGroups.set(key, groupRows);
                  validDuplicateRows.push(...groupRows);
              } else {
                  singleRows.push(groupRows[0]);
              }
          }
      });

      if (issuesCount > 0) addLog(`Found ${issuesCount} pack groups with errors (moved to 'Errors' sheet).`, 'warning');

      // 3. Flatten Clean Packs (Horizontal Merge)
      const packOutputRows: any[][] = [];
      let packHeaders: string[] = [];

      if (packGroups.size > 0) {
          let maxRepetitions = 0;
          packGroups.forEach((groupRows) => {
            if (groupRows.length > maxRepetitions) maxRepetitions = groupRows.length;
          });

          // Build Horizontal Headers
          packHeaders = [...originalHeaders]; 
          for (let i = 1; i < maxRepetitions; i++) {
              const suffix = ` #${i + 1}`;
              originalHeaders.forEach(h => packHeaders.push(`${h}${suffix}`));
          }

          let processedCount = 0;
          packGroups.forEach((groupRows) => {
            const baseRow = groupRows[0];
            const flatRow = [...baseRow];
            while(flatRow.length < originalHeaders.length) flatRow.push("");

            for (let i = 1; i < maxRepetitions; i++) {
                if (i < groupRows.length) {
                    const nextRow = groupRows[i];
                    const padded = [...nextRow];
                    while(padded.length < originalHeaders.length) padded.push("");
                    flatRow.push(...padded);
                } else {
                    const filler = new Array(originalHeaders.length).fill("");
                    flatRow.push(...filler);
                }
            }
            
            packOutputRows.push(flatRow);
            
            processedCount++;
            if (processedCount % 50 === 0) setProgress(Math.round((processedCount / packGroups.size) * 80));
          });
      }

      // --- EXPORT ---
      const newWb = XLSX.utils.book_new();

      // 1. Packs (Clean & Merged)
      if (packOutputRows.length > 0) {
          const wsPacks = XLSX.utils.aoa_to_sheet([packHeaders, ...packOutputRows]);
          XLSX.utils.book_append_sheet(newWb, wsPacks, "Packs (Merged)");
      }

      // 2. Duplicates (Raw rows of CLEAN packs only)
      if (validDuplicateRows.length > 0) {
          const wsDupes = XLSX.utils.aoa_to_sheet([originalHeaders, ...validDuplicateRows]);
          XLSX.utils.book_append_sheet(newWb, wsDupes, "Duplicates (Valid)");
      }

      // 3. Errors / Issues
      if (errorRows.length > 0) {
          const wsErrors = XLSX.utils.aoa_to_sheet([errorSheetHeaders, ...errorRows]);
          XLSX.utils.book_append_sheet(newWb, wsErrors, "Errors & Issues");
      }
      
      // 4. One Item (Singles)
      if (singleRows.length > 0) {
          const wsSingles = XLSX.utils.aoa_to_sheet([originalHeaders, ...singleRows]);
          XLSX.utils.book_append_sheet(newWb, wsSingles, "One Item");
      }

      // 5. Original Data (Reference)
      const wsMain = XLSX.utils.aoa_to_sheet(rawData);
      XLSX.utils.book_append_sheet(newWb, wsMain, "Main (Original)");

      const baseName = fileData.name.replace(/\.[^/.]+$/, "");
      saveWorkbook(newWb, `Packs_Processed_${baseName}.xlsx`);

      addLog(`${t.common.completed}. Created ${packGroups.size} clean packs. Found ${errorRows.length} rows with issues.`, 'success');
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-white p-4 rounded-lg border border-slate-200 h-fit">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center">
             <Settings2 size={18} className="mr-2" />
             {t.common.config}
          </h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">{t.common.selectSheet}</label>
            <select 
              className="w-full p-2 border rounded text-sm bg-slate-50"
              value={selectedSheet}
              onChange={(e) => {
                setSelectedSheet(e.target.value);
                setKeyColIndex(null);
                setSortColIndex(null);
              }}
            >
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="mb-4">
             <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center">
                <ArrowUpDown size={14} className="mr-1" /> {t.packs.sortPack}
             </label>
             <select 
              className="w-full p-2 border rounded text-sm bg-slate-50"
              value={sortColIndex !== null ? sortColIndex : ""}
              onChange={(e) => {
                const val = e.target.value;
                setSortColIndex(val === "" ? null : Number(val));
              }}
            >
              <option value="">{t.packs.none}</option>
              {headers.map((h, idx) => (
                 <option key={idx} value={idx}>{idx + 1}. {h}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
                Enables validation: Checks for missing or duplicate sort values within a pack.
            </p>
          </div>

          <div className="mb-6">
              <label className="flex items-start gap-2 cursor-pointer p-3 bg-blue-50 rounded border border-blue-100">
                  <input 
                    type="checkbox" 
                    checked={smartNormalize} 
                    onChange={e => setSmartNormalize(e.target.checked)}
                    className="mt-1 rounded text-blue-600" 
                  />
                  <div>
                      <span className="text-sm font-bold text-blue-800 flex items-center gap-1">
                          <Wand2 size={14}/> Smart Normalization
                      </span>
                      <p className="text-xs text-blue-600 mt-0.5">
                          Automatically fix scientific notation (e.g. 1.23E+10) and treat numbers stored as text as duplicates.
                      </p>
                  </div>
              </label>
          </div>

          <div className="p-3 bg-red-50 border border-red-100 rounded mb-6 text-xs text-red-800">
              <div className="font-bold flex items-center gap-1 mb-1"><FileWarning size={12}/> Automatic Errors Checks:</div>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Product has &gt; 3 packs.</li>
                  <li>Duplicate Sort Values in same pack.</li>
                  <li>Missing Sort Value.</li>
              </ul>
          </div>

          <button
            onClick={handleProcess}
            disabled={!fileData || keyColIndex === null || status === ProcessingStatus.PROCESSING}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
                ${!fileData || keyColIndex === null || status === ProcessingStatus.PROCESSING
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            <Package size={18} />
            <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col h-[500px]">
           <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
             <div>
                <h3 className="font-bold text-slate-700">{t.common.selectCols}</h3>
                <p className="text-xs text-slate-500">{t.packs.desc}</p>
             </div>
           </div>
           
           <div className="flex-1 overflow-y-auto border border-slate-100 rounded bg-slate-50">
             <div className="flex items-center px-3 py-2 bg-slate-200 text-xs font-bold text-slate-600 sticky top-0 z-10">
                 <div className="w-8 text-center">Key</div>
                 <div className="flex-1 px-2">{t.common.selected}</div>
             </div>

             {headers.map((header, idx) => (
               <div 
                 key={idx} 
                 className={`flex items-center px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-white transition-colors
                    ${keyColIndex === idx ? 'bg-indigo-50' : ''}`}
               >
                 <div className="w-8 flex justify-center">
                    <button 
                        onClick={() => setKeyColIndex(idx)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all
                           ${keyColIndex === idx ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent hover:border-indigo-400'}`}
                        title="Set as Grouping Key"
                    >
                        <Key size={10} />
                    </button>
                 </div>
                 
                 <div className="flex-1 px-2 min-w-0">
                     <p className={`text-sm truncate ${keyColIndex === idx ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                         {header || `(Col ${idx+1})`}
                     </p>
                     {keyColIndex === idx && <span className="text-[10px] text-indigo-500 font-bold uppercase">{t.packs.groupKey}</span>}
                 </div>
               </div>
             ))}
           </div>
        </div>

      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default PacksTab;
