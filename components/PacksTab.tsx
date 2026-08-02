
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Package, Settings2, ArrowUpDown, Key, ScanLine, AlertTriangle, CheckCircle2, Search, Wand2, FileWarning, Download } from 'lucide-react';

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
    const str = String(val).trim();
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
  const [packNameColIndex, setPackNameColIndex] = useState<number | null>(null);
  const [barcodeColIndex, setBarcodeColIndex] = useState<number | null>(null);
  const [skuColIndex, setSkuColIndex] = useState<number | null>(null);

  const [smartNormalize, setSmartNormalize] = useState<boolean>(true);
  const [exportBatchSize, setExportBatchSize] = useState<number>(0);
  
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
        setPackNameColIndex(null);
        setBarcodeColIndex(null);
        setSkuColIndex(null);
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

      const rawData = getSheetData(fileData.workbook, selectedSheet, true);
      const originalHeaders = rawData[0] as string[];
      const rows = rawData.slice(1);
      
      const groups = new Map<string, { row: any[], originalIdx: number }[]>();
      let notationFixCount = 0;

      const errorSheetHeaders = [...originalHeaders, "Error Description (EN)", "Error Description (AR)", "Location Info"];
      
      const globalBarcodes = new Map<string, number[]>();
      const globalSkus = new Map<string, number[]>();

      rows.forEach((row, rIdx) => {
        if (barcodeColIndex !== null) {
            const bc = normalizeKey(row[barcodeColIndex], smartNormalize);
            if (bc !== "") {
                if (!globalBarcodes.has(bc)) globalBarcodes.set(bc, []);
                globalBarcodes.get(bc)!.push(rIdx);
            }
        }
        if (skuColIndex !== null) {
            const sku = normalizeKey(row[skuColIndex], smartNormalize);
            if (sku !== "") {
                if (!globalSkus.has(sku)) globalSkus.set(sku, []);
                globalSkus.get(sku)!.push(rIdx);
            }
        }

        const keyVal = row[keyColIndex];
        const normalizedKey = normalizeKey(keyVal, smartNormalize);
        
        // Also trim original key if it had spaces
        if (String(keyVal) !== String(keyVal).trim()) {
            row[keyColIndex] = String(keyVal).trim();
        }
        
        if (String(keyVal).trim() !== normalizedKey && normalizedKey !== "" && smartNormalize) {
            notationFixCount++;
            row[keyColIndex] = normalizedKey;
        }
        
        if (normalizedKey) {
           if (!groups.has(normalizedKey)) {
             groups.set(normalizedKey, []);
           }
           groups.get(normalizedKey)!.push({ row, originalIdx: rIdx });
        }
      });

      if (notationFixCount > 0) addLog(`Fixed ${notationFixCount} scientific notation issues.`, 'success');

      const packGroups = new Map<string, any[][]>(); 
      const singleRows: any[][] = []; 
      const validDuplicateRows: any[][] = []; 
      const singleItemErrorRows: any[][] = []; 
      const packErrorRows: any[][] = []; 

      let issuesCount = 0;

      groups.forEach((groupData, key) => {
          const groupRows = groupData.map(g => g.row);
          const errorsInGroup: { msgEn: string, msgAr: string, idx: number }[] = [];

          if (groupRows.length > 3) {
              groupData.forEach(g => {
                  errorsInGroup.push({
                      msgEn: `Too many packs (${groupRows.length} found, maximum 3 allowed)`,
                      msgAr: `عدد العبوات كبير جداً (تم العثور على ${groupRows.length}، الحد الأقصى المسموح به 3)`,
                      idx: g.originalIdx
                  });
              });
          }

          groupData.forEach(g => {
              const hasPackSize = sortColIndex !== null && String(g.row[sortColIndex] || "").trim() !== "";
              const hasPackName = packNameColIndex !== null && String(g.row[packNameColIndex] || "").trim() !== "";
              const hasBarcode = barcodeColIndex !== null && String(g.row[barcodeColIndex] || "").trim() !== "";
              const hasSku = skuColIndex !== null && String(g.row[skuColIndex] || "").trim() !== "";

              const isMultiRow = groupData.length > 1;
              const hasAnyPackInfo = hasPackSize || hasPackName;

              if (isMultiRow || hasAnyPackInfo) {
                  const missingName = !hasPackName && packNameColIndex !== null;
                  const missingSize = !hasPackSize && sortColIndex !== null;
                  
                  let missingBarcodeAndSku = false;
                  if (barcodeColIndex !== null && skuColIndex !== null) {
                      missingBarcodeAndSku = !hasBarcode && !hasSku;
                  } else if (barcodeColIndex !== null) {
                      missingBarcodeAndSku = !hasBarcode;
                  } else if (skuColIndex !== null) {
                      missingBarcodeAndSku = !hasSku;
                  }

                  const missingFieldsEn = [];
                  const missingFieldsAr = [];
                  if (missingName) {
                      missingFieldsEn.push("Pack Name");
                      missingFieldsAr.push("اسم العبوة");
                  }
                  if (missingSize) {
                      missingFieldsEn.push("Pack Size");
                      missingFieldsAr.push("حجم العبوة");
                  }
                  if (missingBarcodeAndSku) {
                      missingFieldsEn.push("SKU or Barcode");
                      missingFieldsAr.push("الباركود أو رمز SKU");
                  }

                  if (missingFieldsEn.length > 0) {
                      errorsInGroup.push({
                          msgEn: `Incomplete Pack Info. Missing: ${missingFieldsEn.join(" and ")}`,
                          msgAr: `معلومات العبوة غير مكتملة. مفقود: ${missingFieldsAr.join(" و ")}`,
                          idx: g.originalIdx
                      });
                  }
              }

              if (barcodeColIndex !== null) {
                  const bc = normalizeKey(g.row[barcodeColIndex], smartNormalize);
                  if (bc !== "" && (globalBarcodes.get(bc)?.length || 0) > 1) {
                      errorsInGroup.push({
                          msgEn: `Duplicate Barcode '${bc}' found`,
                          msgAr: `تم العثور على باركود مكرر '${bc}'`,
                          idx: g.originalIdx
                      });
                  }
              }
              if (skuColIndex !== null) {
                  const sku = normalizeKey(g.row[skuColIndex], smartNormalize);
                  if (sku !== "" && (globalSkus.get(sku)?.length || 0) > 1) {
                      errorsInGroup.push({
                          msgEn: `Duplicate SKU '${sku}' found`,
                          msgAr: `تم العثور على رمز SKU مكرر '${sku}'`,
                          idx: g.originalIdx
                      });
                  }
              }
          });

          if (sortColIndex !== null) {
              const sortValuesSeen = new Map<string, number[]>(); 

              groupData.forEach((g) => {
                  const sortVal = g.row[sortColIndex];
                  const normSortVal = String(sortVal || "").trim().toLowerCase();
                  
                  if (String(sortVal) !== String(sortVal || "").trim()) {
                      g.row[sortColIndex] = String(sortVal || "").trim();
                  }

                  if (normSortVal === "") {
                      errorsInGroup.push({
                          msgEn: "Missing Pack Size/Sort Value",
                          msgAr: "حجم العبوة أو قيمة الفرز مفقودة",
                          idx: g.originalIdx
                      });
                  } else {
                      if (!sortValuesSeen.has(normSortVal)) sortValuesSeen.set(normSortVal, []);
                      sortValuesSeen.get(normSortVal)!.push(g.originalIdx);
                  }
              });

              sortValuesSeen.forEach((indices, val) => {
                  if (indices.length > 1) {
                      indices.forEach(idx => {
                          errorsInGroup.push({
                              msgEn: `Duplicate Pack Size '${val}' inside the same product`,
                              msgAr: `حجم العبوة '${val}' مكرر لنفس المنتج`,
                              idx: idx
                          });
                      });
                  }
              });
          }

          if (errorsInGroup.length > 0) {
              issuesCount++;
              groupData.forEach(g => {
                  const rowErrors = errorsInGroup.filter(e => e.idx === g.originalIdx);
                  if (rowErrors.length > 0) {
                      const msgEn = rowErrors.map(e => e.msgEn).join("; ");
                      const msgAr = rowErrors.map(e => e.msgAr).join("; ");
                      const cellRef = XLSX.utils.encode_cell({ c: keyColIndex, r: g.originalIdx + 1 });
                      const errorRow = [...g.row, msgEn, msgAr, `Cell: ${cellRef}`];
                      if (groupData.length > 1) {
                          packErrorRows.push(errorRow);
                      } else {
                          singleItemErrorRows.push(errorRow);
                      }
                  } else {
                      const errorRow = [...g.row, "Part of invalid group", "جزء من مجموعة غير صالحة", `Group Key: ${key}`];
                      if (groupData.length > 1) {
                          packErrorRows.push(errorRow);
                      } else {
                          singleItemErrorRows.push(errorRow);
                      }
                  }
              });
          } else {
              if (groupRows.length > 1) {
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

      const packOutputRows: any[][] = [];
      let packHeaders: string[] = [];

      if (packGroups.size > 0) {
          let maxRepetitions = 0;
          packGroups.forEach((groupRows) => {
            if (groupRows.length > maxRepetitions) maxRepetitions = groupRows.length;
          });

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

      const baseName = fileData.name.replace(/\.[^/.]+$/, "");

      // BATCH EXPORT
      if (exportBatchSize > 0) {
          addLog(`Splitting export into files of ${exportBatchSize} rows...`, 'info');
          const zip = new JSZip();
          let part = 1;
          const maxRows = Math.max(packOutputRows.length, validDuplicateRows.length, singleItemErrorRows.length, packErrorRows.length, singleRows.length, rawData.length);

          for (let i = 0; i < maxRows; i += exportBatchSize) {
              const wb = XLSX.utils.book_new();
              const end = i + exportBatchSize;

              const sliceData = (data: any[][], header?: string[]) => {
                  if (data.length === 0) return [];
                  // data usually doesn't have header included in these arrays except rawData?
                  // Actually rawData includes header at 0. Others are just rows.
                  // Let's assume passed arrays are just data rows, except rawData.
                  
                  // For packOutputRows:
                  if (i >= data.length) return [];
                  const chunk = data.slice(i, end);
                  if (chunk.length === 0) return [];
                  return header ? [header, ...chunk] : chunk;
              };

              const chunkPacks = sliceData(packOutputRows, packHeaders);
              const chunkDupes = sliceData(validDuplicateRows, originalHeaders);
              const chunkSingleErrors = sliceData(singleItemErrorRows, errorSheetHeaders);
              const chunkPackErrors = sliceData(packErrorRows, errorSheetHeaders);
              const chunkSingles = sliceData(singleRows, originalHeaders);
              
              // Raw Data special handling (header is inside)
              let chunkMain: any[][] = [];
              if (i < rawData.length) {
                  const rawHeader = rawData[0];
                  const rawBody = rawData.slice(1);
                  const slice = rawBody.slice(i, end); // i starts 0, rawBody starts 0
                  if (slice.length > 0) chunkMain = [rawHeader, ...slice];
              } else if (i === 0 && rawData.length > 0) {
                  // If just header exists
                  chunkMain = [rawData[0]]; 
              }

              if (chunkPacks.length > 0) {
                  const ws = XLSX.utils.aoa_to_sheet(chunkPacks);
                  XLSX.utils.book_append_sheet(wb, ws, "Packs (Merged)");
              }
              if (chunkDupes.length > 0) {
                  const ws = XLSX.utils.aoa_to_sheet(chunkDupes);
                  XLSX.utils.book_append_sheet(wb, ws, "Grouped Items (Originals)");
              }
              if (chunkSingleErrors.length > 0) {
                  const wsSingleErrors = XLSX.utils.aoa_to_sheet(chunkSingleErrors);
                  XLSX.utils.book_append_sheet(wb, wsSingleErrors, "Errors - Single Items");
              }
              if (chunkPackErrors.length > 0) {
                  const wsPackErrors = XLSX.utils.aoa_to_sheet(chunkPackErrors);
                  XLSX.utils.book_append_sheet(wb, wsPackErrors, "Errors - Packs");
              }
              if (chunkSingles.length > 0) {
                  const ws = XLSX.utils.aoa_to_sheet(chunkSingles);
                  XLSX.utils.book_append_sheet(wb, ws, "One Item");
              }
              if (chunkMain.length > 0) {
                  const ws = XLSX.utils.aoa_to_sheet(chunkMain);
                  XLSX.utils.book_append_sheet(wb, ws, "Main (Original)");
              }

              if (wb.SheetNames.length > 0) {
                  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  zip.file(`Packs_Part_${part}.xlsx`, buffer);
                  part++;
              }
              
              await new Promise(r => setTimeout(r, 10));
          }

          const content = await zip.generateAsync({ type: 'blob' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(content);
          link.download = `Packs_Batch_${baseName}.zip`;
          link.click();
          addLog(`Batch Export Complete (${part - 1} files).`, 'success');

      } else {
          // SINGLE EXPORT
          const newWb = XLSX.utils.book_new();
          if (packOutputRows.length > 0) {
              const wsPacks = XLSX.utils.aoa_to_sheet([packHeaders, ...packOutputRows]);
              XLSX.utils.book_append_sheet(newWb, wsPacks, "Packs (Merged)");
          }
          if (validDuplicateRows.length > 0) {
              const wsDupes = XLSX.utils.aoa_to_sheet([originalHeaders, ...validDuplicateRows]);
              XLSX.utils.book_append_sheet(newWb, wsDupes, "Grouped Items (Originals)");
          }
          if (singleItemErrorRows.length > 0) {
              const wsSingleErrors = XLSX.utils.aoa_to_sheet([errorSheetHeaders, ...singleItemErrorRows]);
              XLSX.utils.book_append_sheet(newWb, wsSingleErrors, "Errors - Single Items");
          }
          if (packErrorRows.length > 0) {
              const wsPackErrors = XLSX.utils.aoa_to_sheet([errorSheetHeaders, ...packErrorRows]);
              XLSX.utils.book_append_sheet(newWb, wsPackErrors, "Errors - Packs");
          }
          if (singleRows.length > 0) {
              const wsSingles = XLSX.utils.aoa_to_sheet([originalHeaders, ...singleRows]);
              XLSX.utils.book_append_sheet(newWb, wsSingles, "One Item");
          }
          const wsMain = XLSX.utils.aoa_to_sheet(rawData);
          XLSX.utils.book_append_sheet(newWb, wsMain, "Main (Original)");

          saveWorkbook(newWb, `Packs_Processed_${baseName}.xlsx`);
          const totalErrors = singleItemErrorRows.length + packErrorRows.length;
          addLog(`${t.common.completed}. Created ${packGroups.size} clean packs. Found ${totalErrors} rows with issues.`, 'success');
      }

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
          {/* ... (Keep existing config UI) ... */}
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
                <ArrowUpDown size={14} className="mr-1" /> {t.packs.sortPack} (Pack Size)
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

          <div className="mb-4">
             <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center">
                <Search size={14} className="mr-1" /> Pack Name Column
             </label>
             <select 
              className="w-full p-2 border rounded text-sm bg-slate-50"
              value={packNameColIndex !== null ? packNameColIndex : ""}
              onChange={(e) => {
                const val = e.target.value;
                setPackNameColIndex(val === "" ? null : Number(val));
              }}
            >
              <option value="">(None)</option>
              {headers.map((h, idx) => (
                 <option key={idx} value={idx}>{idx + 1}. {h}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
                Products with a pack size must have this field populated.
            </p>
          </div>

          <div className="mb-4">
             <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center">
                <ScanLine size={14} className="mr-1" /> Barcode Column
             </label>
             <select 
              className="w-full p-2 border rounded text-sm bg-slate-50"
              value={barcodeColIndex !== null ? barcodeColIndex : ""}
              onChange={(e) => {
                const val = e.target.value;
                setBarcodeColIndex(val === "" ? null : Number(val));
              }}
            >
              <option value="">(None)</option>
              {headers.map((h, idx) => (
                 <option key={idx} value={idx}>{idx + 1}. {h}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
                Used to check for globally duplicate barcodes and missing pack barcodes.
            </p>
          </div>

          <div className="mb-4">
             <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center">
                <Search size={14} className="mr-1" /> SKU Column
             </label>
             <select 
              className="w-full p-2 border rounded text-sm bg-slate-50"
              value={skuColIndex !== null ? skuColIndex : ""}
              onChange={(e) => {
                const val = e.target.value;
                setSkuColIndex(val === "" ? null : Number(val));
              }}
            >
              <option value="">(None)</option>
              {headers.map((h, idx) => (
                 <option key={idx} value={idx}>{idx + 1}. {h}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
                Used to check for globally duplicate SKUs.
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
                  <li>Globally Duplicate SKUs or Barcodes.</li>
                  <li>Missing Pack Name or Barcode when Pack Size exists.</li>
              </ul>
          </div>

          <div className="flex gap-2 items-center mb-4">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-2 flex-1">
                   <Package size={14} className="text-slate-400"/>
                   <input 
                      type="number" 
                      placeholder="Max Rows per File (Optional)" 
                      className="w-full text-xs outline-none"
                      value={exportBatchSize || ''}
                      onChange={(e) => setExportBatchSize(Number(e.target.value))}
                   />
              </div>
          </div>

          <button
            onClick={handleProcess}
            disabled={!fileData || keyColIndex === null || status === ProcessingStatus.PROCESSING}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
                ${!fileData || keyColIndex === null || status === ProcessingStatus.PROCESSING
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {status === ProcessingStatus.PROCESSING ? (
                <>
                    <span className="animate-spin mr-2">⏳</span>
                    <span>{t.common.processing}</span>
                </>
            ) : (
                <>
                    <Package size={18} />
                    <span>{t.common.start}</span>
                </>
            )}
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
             {/* ... (Keep headers selection UI) ... */}
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
