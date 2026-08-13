
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { aiService } from '../services/aiServiceFactory';
import { initGoogleAuth, updateSheetColumn } from '../services/googleSheetSync';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Play, RotateCcw, Zap, WifiOff, Split, Merge, ArrowRight, Layout, AlertCircle, ArrowDown, BrainCircuit, Globe, Book, Copy, Check, CloudUpload, User, PenTool, Columns, Table, FileOutput, ChevronDown, ChevronUp, Settings2, Plus, Combine, Replace, MousePointer2 } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  keyCount: number;
  onReset: () => void;
  language?: Language;
  googleClientId?: string;
}

type TranslationMode = 'bilingual' | 'separate' | 'template';

const TranslateTab: React.FC<Props> = ({ fileData, addLog, keyCount, onReset, language = 'en', googleClientId }) => {
  const t = TRANSLATIONS[language];
  
  // --- STATE ---
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedCols, setSelectedCols] = useState<number[]>([]);
  
  // Mode State
  const [mode, setMode] = useState<TranslationMode>('bilingual'); 
  const [separator, setSeparator] = useState<string>(' | '); 
  
  // Bilingual Specific Strategy
  // 'consolidate': Merge all selected cols into ONE output cell.
  // 'inplace': Update EACH selected col individually with bilingual text.
  const [bilingualStrategy, setBilingualStrategy] = useState<'consolidate' | 'inplace'>('consolidate');

  // Multi-Column Logic (Only for consolidate/separate modes)
  const [mergeSource, setMergeSource] = useState<boolean>(false); 

  // Output Config
  const [outputCol, setOutputCol] = useState<number>(1); 
  const [outputMapping, setOutputMapping] = useState<{[key: number]: number}>({}); 
  const [templatePattern, setTemplatePattern] = useState<string>('[Item] - [Trans]');

  // AI Config
  const [direction, setDirection] = useState<'ar_en' | 'en_ar' | 'auto'>('auto');
  const [contextCol, setContextCol] = useState<number>(-1);
  const [domain, setDomain] = useState<string>('Restaurant/Food');
  const [glossary, setGlossary] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // System
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [batchSize, setBatchSize] = useState<number>(20); // Higher batch size for deduplicated items
  const [resultData, setResultData] = useState<any[][] | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Playground State
  const [testInput, setTestInput] = useState("Apple");
  const [testTrans, setTestTrans] = useState("تفاحة");

  // --- EFFECTS ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const cid = googleClientId || localStorage.getItem('google_client_id');
    if (cid) {
       initGoogleAuth(cid, (token) => {
          setIsGoogleConnected(true);
          addLog("Google Account Connected.", 'success');
       });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [googleClientId]);

  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      if (!selectedSheet) setSelectedSheet(fileData.sheets[0]);
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet);
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
        setContextCol(-1);
      }
    }
  }, [fileData, selectedSheet]);

  // --- HELPERS ---
  const toggleColumn = (idx: number) => {
    setSelectedCols(prev => {
      const isSelecting = !prev.includes(idx);
      const newCols = isSelecting ? [...prev, idx] : prev.filter(i => i !== idx);
      
      // Auto-map for Separate Mode
      if (isSelecting) {
         setOutputMapping(prevMap => ({ ...prevMap, [idx]: idx + 2 }));
      }
      return newCols;
    });
  };

  const getExcelColumnName = (colIndex: number) => {
      let temp, letter = '';
      colIndex++; 
      while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
      }
      return letter;
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- PREVIEW GENERATOR ---
  const calculatePreview = () => {
      const src = testInput;
      const tr = testTrans;
      
      if (mode === 'bilingual') {
          return `${src}${separator}${tr}`;
      } 
      else if (mode === 'separate') {
          return tr;
      } 
      else if (mode === 'template') {
          return templatePattern
            .replace('[Item]', src)
            .replace('[Trans]', tr);
      }
      return "";
  };

  // --- MAIN PROCESS ---
  const handleProcess = async () => {
    if (!isOnline) { addLog("No Internet Connection.", "error"); return; }
    if (!fileData || selectedCols.length === 0) { addLog("Please select columns.", 'warning'); return; }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      const data = getSheetData(fileData.workbook, selectedSheet);
      const outputData = JSON.parse(JSON.stringify(data)); // Deep clone
      
      // Fourth column is "Status", not "Final Output": it carries
      // Translated / Already bilingual / NOT TRANSLATED, and the partial banner
      // tells the reader to look for "NOT TRANSLATED" in it. A mislabelled
      // header in the exported workbook is the one place that cannot be
      // explained away later.
      const summaryData: string[][] = [["Row", "Source Text", "Translated Text", "Status"]];
      
      // --- 1. SETUP OUTPUT HEADERS ---
      // Determine if we need a single dedicated output column
      const needsSingleOutput = (mode === 'bilingual' && bilingualStrategy === 'consolidate') || 
                                mode === 'template' || 
                                (mode === 'separate' && mergeSource);

      if (needsSingleOutput) {
         const outputColIdx = outputCol - 1;
         if (!outputData[0]) outputData[0] = [];
         while (outputData[0].length <= outputColIdx) outputData[0].push("");
         
         if (!outputData[0][outputColIdx]) {
             if (mode === 'bilingual') outputData[0][outputColIdx] = "Bilingual Result";
             else if (mode === 'template') outputData[0][outputColIdx] = "Template Output";
             else outputData[0][outputColIdx] = "Merged Translation";
         }
      } 
      else if (mode === 'separate' && !mergeSource) {
         selectedCols.forEach((colIdx) => {
            const targetCol1Based = outputMapping[colIdx] || (colIdx + 2);
            const targetColIdx = targetCol1Based - 1;
            if (!outputData[0]) outputData[0] = [];
            while (outputData[0].length <= targetColIdx) outputData[0].push("");
            if (!outputData[0][targetColIdx]) {
               outputData[0][targetColIdx] = `${headers[colIdx]}_TR`;
            }
         });
      }

      // --- 2. PREPARE UNIQUE LIST (DEDUPLICATION) ---
      const uniqueToTranslate = new Map<string, { text: string, context?: string }>();
      const rowToKeyMap = new Map<number, string>(); // Maps RowIndex -> Key used for translation
      const translationMap = new Map<string, string>(); // Key -> Translated Result
      
      const isAlreadyBilingual = (txt: string) => {
          return /[\u0600-\u06FF]/.test(txt) && /[a-zA-Z]/.test(txt);
      };

      // Scan rows to build unique list
      for (let i = 1; i < data.length; i++) {
          const row = data[i] || [];
          const rowTexts: string[] = [];
          
          selectedCols.forEach(colIdx => {
              rowTexts.push(row[colIdx] ? String(row[colIdx]).trim() : "");
          });

          const validTexts = rowTexts.filter(t => t.length > 0);
          
          if (validTexts.length > 0) {
               let textToTranslate = "";
               
               // Construct the "Translation Unit" based on settings
               if (mergeSource && mode !== 'bilingual') { 
                   textToTranslate = validTexts.join(" "); 
               } 
               else if (mode === 'bilingual' && bilingualStrategy === 'consolidate' && mergeSource) {
                   textToTranslate = validTexts.join(" ");
               }
               else {
                   // Standard: maintain separation with delimiter
                   textToTranslate = validTexts.join(" ||| "); 
               }

               const contextVal = contextCol !== -1 ? String(row[contextCol] || "") : "";
               const uniqueKey = `${textToTranslate}_CTX:${contextVal}`;
               
               if (isAlreadyBilingual(textToTranslate)) {
                   translationMap.set(uniqueKey, textToTranslate);
               } else if (!uniqueToTranslate.has(uniqueKey)) {
                   uniqueToTranslate.set(uniqueKey, { text: textToTranslate, context: contextVal });
               }
               
               rowToKeyMap.set(i, uniqueKey);
          }
      }

      const uniqueItems = Array.from(uniqueToTranslate.values());
      const uniqueKeys = Array.from(uniqueToTranslate.keys());
      const totalUnique = uniqueItems.length;
      
      addLog(`Found ${totalUnique} unique items to translate (Deduplicated from ${data.length} rows). Skipped ${translationMap.size} bilingual items.`, 'info');

      // Snapshot of the keys that were pre-seeded as already-bilingual, taken
      // BEFORE any batch runs. Without it `translationMap.has(key)` cannot tell
      // "the model translated this" from "this was already bilingual so we never
      // sent it", and every count and row label downstream conflates the two.
      const alreadyBilingualKeys = new Set(translationMap.keys());

      // --- 3. BATCH TRANSLATION OF UNIQUES ---
      const glossaryList = glossary.split(',').map(s => s.trim()).filter(s => s.length > 0);

      let processedUniqueCount = 0;
      // Attempted, for the progress bar. Distinct from `processedUniqueCount`,
      // which counts only items that came back with a translation.
      let attemptedUniqueCount = 0;
      // Set when a batch fails. Non-null means the run is PARTIAL and every
      // marker below (summary column, header note, filename, logs) switches on.
      let batchError: string | null = null;
      // Model fallbacks that happened during this run, de-duplicated.
      //
      // The quality tier degrades to a Flash id rather than failing outright when
      // every Pro id is retired. That is the right behaviour — a slightly weaker
      // translation beats no file — but it silently changes the quality of every
      // item after it, and a `console.warn` is not something anyone reads. A run
      // that quietly dropped tier is worth knowing about when you are checking
      // the output, so it goes in the log and in the exported workbook.
      const modelNotices = new Set<string>();

      for (let i = 0; i < totalUnique; i += batchSize) {
          const batchEnd = Math.min(i + batchSize, totalUnique);
          const currentBatchItems = uniqueItems.slice(i, batchEnd);
          const currentBatchKeys = uniqueKeys.slice(i, batchEnd);

          try {
              const translations = await aiService.translateBatch(currentBatchItems, {
                  sourceLang: direction === 'auto' ? 'auto' : (direction === 'ar_en' ? 'ar' : 'en'),
                  targetLang: direction === 'auto' ? 'auto' : (direction === 'ar_en' ? 'en' : 'ar'),
                  domain: domain,
                  glossary: glossaryList,
                  onNotice: (message) => {
                      if (modelNotices.has(message)) return;
                      modelNotices.add(message);
                      addLog(message, 'warning');
                  },
              });

              // Positional mapping is only safe if the model returned exactly one
              // result per input. It is not contractually obliged to: the reply
              // is `JSON.parse(response.text)` with no shape or length check, so
              // a model that drops or merges one item returns a SHORTER array —
              // and every result after the gap would be filed against the wrong
              // source row. That is silent corruption: plausible translations
              // attached to the wrong products, invisible in the output.
              //
              // A length mismatch means the alignment is unknowable, so nothing
              // from this batch is trusted.
              let batchTranslated = 0;
              if (!Array.isArray(translations) || translations.length !== currentBatchItems.length) {
                  addLog(
                    `Batch returned ${Array.isArray(translations) ? translations.length : 0} results ` +
                    `for ${currentBatchItems.length} items — cannot tell which is which, so the whole ` +
                    `batch was discarded rather than risk mismatched translations.`,
                    'error',
                  );
              } else {
                  // Only record results that actually contain something.
                  //
                  // `translateBatch` does NOT always throw on failure: an
                  // unparseable model reply makes it return `items.map(() => "")`,
                  // and an empty reply parses to `[]`. Writing those blanks into
                  // the map made them indistinguishable from real translations —
                  // rows showed "Translated" beside an empty cell, and the batch
                  // was credited in full.
                  translations.forEach((result, idx) => {
                      const text = typeof result === 'string' ? result.trim() : '';
                      if (!text) return;
                      translationMap.set(currentBatchKeys[idx], result);
                      batchTranslated++;
                      addLog(`Translated: "${currentBatchItems[idx]}" -> "${result}"`, 'success');
                  });
              }

              if (batchTranslated < currentBatchItems.length) {
                  // Silent, so it has to be said out loud.
                  addLog(
                    `${currentBatchItems.length - batchTranslated} item(s) in this batch came back empty — ` +
                    `left untranslated.`,
                    'error',
                  );
              }

              processedUniqueCount += batchTranslated;
              attemptedUniqueCount += currentBatchItems.length;
              // Progress tracks ATTEMPTED, not translated. `processedUniqueCount`
              // changed meaning when it stopped counting blanks, and driving the
              // bar from it leaves it frozen while batches are still running —
              // the one moment a user is watching it to decide whether to wait.
              setProgress((attemptedUniqueCount / totalUnique) * 90); // 90% for the translation phase
              await delay(200); // Slight delay to be nice to API

          } catch (e: any) {
              // Stop translating, but do NOT discard what already succeeded.
              //
              // This used to `return` here. `translationMap` is local to this
              // handler and is only written to the rows in step 4 below, so
              // bailing threw away every completed batch: fail on batch 7 of 10
              // and the six that worked were lost. On one API key a rate limit
              // costs ~3 minutes of waiting first (rotateKey is a no-op with a
              // single key), so the user paid the wait AND got nothing.
              //
              // Breaking instead lets steps 4 and 5 run over the partial map.
              // Untranslated rows keep their original text in the bilingual and
              // consolidate modes, and come through blank in `separate` mode —
              // which is the honest representation of "no translation for this
              // row". Every marker below exists so a partial file cannot be
              // mistaken for a finished one.
              console.error(e);
              batchError = e?.message || String(e);
              addLog(`Batch failed, stopping here: ${batchError}`, 'error');
              break;
          }
      }

      // --- 4. APPLY RESULTS TO ROWS ---
      for (let i = 1; i < data.length; i++) {
          const key = rowToKeyMap.get(i);
          if (!key) continue;

          const translationResult = translationMap.get(key) || "";
          
          const row = data[i];
          const originalParts: string[] = [];
          selectedCols.forEach(colIdx => {
              originalParts.push(row[colIdx] ? String(row[colIdx]).trim() : "");
          });

          if (!outputData[i]) outputData[i] = [];

          if (mode === 'bilingual') {
              if (bilingualStrategy === 'inplace') {
                  const transParts = translationResult.split("|||");
                  let validIdx = 0;
                  selectedCols.forEach((colIdx, k) => {
                      const orig = originalParts[k];
                      if (orig) {
                          const tText = (transParts[validIdx] || "").trim();
                          if (tText && tText.toLowerCase() !== orig.trim().toLowerCase()) {
                              outputData[i][colIdx] = `${orig}${separator}${tText}`;
                          } else {
                              outputData[i][colIdx] = orig;
                          }
                          validIdx++;
                      }
                  });
              } 
              else {
                  // Consolidate
                  let finalCellContent = "";
                  if (mergeSource) {
                      const sourceCombined = originalParts.filter(Boolean).join(" ");
                      if (translationResult && sourceCombined && sourceCombined.trim().toLowerCase() !== translationResult.toLowerCase()) {
                          finalCellContent = `${sourceCombined}${separator}${translationResult}`;
                      } else {
                          finalCellContent = sourceCombined || translationResult;
                      }
                  } else {
                      const transParts = translationResult.split("|||");
                      const lines: string[] = [];
                      let validIdx = 0;
                      originalParts.forEach((origText) => {
                          if (!origText) return;
                          const tText = (transParts[validIdx] || "").trim();
                          if (tText && tText.toLowerCase() !== origText.trim().toLowerCase()) lines.push(`${origText}${separator}${tText}`);
                          else lines.push(origText);
                          validIdx++;
                      });
                      finalCellContent = lines.join("\n");
                  }
                  const outputColIdx = outputCol - 1;
                  outputData[i][outputColIdx] = finalCellContent;
              }

          } else if (mode === 'separate') {
              if (mergeSource) {
                  const outputColIdx = outputCol - 1;
                  outputData[i][outputColIdx] = translationResult;
              } else {
                  const transParts = translationResult.split("|||");
                  let validIdx = 0;
                  selectedCols.forEach((colIdx, k) => {
                      const orig = originalParts[k];
                      if (orig) {
                          const tText = (transParts[validIdx] || "").trim();
                          const targetColIdx = (outputMapping[colIdx] || (colIdx + 2)) - 1;
                          outputData[i][targetColIdx] = tText;
                          validIdx++;
                      }
                  });
              }
          } else if (mode === 'template') {
              const transParts = translationResult.split("|||");
              let res = templatePattern;
              const tText = transParts[0] || "";
              const orig = originalParts.find(p => p) || "";
              res = res.replace('[Item]', orig).replace('[Trans]', tText);
              
              const outputColIdx = outputCol - 1;
              outputData[i][outputColIdx] = res;
          }

          // Per-row truth, not a blanket "Processed". After a partial run this
          // column is the only place that says which rows actually got a
          // translation, so it distinguishes three real outcomes rather than
          // two: a row skipped for being already bilingual was never sent to the
          // model, and calling that "Translated" is not true.
          const status = alreadyBilingualKeys.has(key)
            ? "Already bilingual"
            : translationMap.has(key)
              ? "Translated"
              : "NOT TRANSLATED";
          summaryData.push([
            String(i + 1),
            originalParts.join(", "),
            translationResult,
            status,
          ]);
      }

      setResultData(outputData);

      // --- 5. EXPORT FILE ---
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(data), "Original File");
      XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(outputData), "Translated File");

      // A partial run gets a banner at the top of the Summary sheet, before the
      // header row. Someone who opens the file months later has no logs and no
      // UI — the workbook has to say so itself.
      // Partial is a fact about the RESULT, not about whether an exception was
      // thrown. A batch that silently returned blanks leaves the file just as
      // incomplete as one that threw, so both are judged by the same count.
      const missingCount = totalUnique - processedUniqueCount;
      const isPartial = Boolean(batchError) || missingCount > 0;
      // "Stopped because:" is only true of the throwing case. When batches ran to
      // the end and simply returned blanks, nothing stopped — the run completed
      // and came up short — and labelling that "stopped" sends the reader looking
      // for a failure that never happened.
      const partialReason = batchError
        ? `Stopped because: ${batchError}`
        : `Ran to the end, but ${missingCount} item(s) came back with no translation.`;

      // Independent of `isPartial`: a run can fall back to a weaker model and
      // still translate every item. The file is complete, but not produced by the
      // model the user chose, and the workbook is the only record that outlives
      // the session's logs.
      //
      // Unshifted BEFORE the partial banner below, so that when both apply the
      // banner ends up on top — an incomplete file is the more urgent fact, and
      // the last `unshift` is the one a reader sees first.
      if (modelNotices.size > 0) {
        summaryData.unshift(
          ["*** THIS RUN DID NOT USE THE PREFERRED MODEL ***", "", "", ""],
          ...[...modelNotices].map((n) => [n, "", "", ""]),
          ["", "", "", ""],
        );
      }

      if (isPartial) {
        // `processedUniqueCount`, NOT `translationMap.size`. The map is
        // pre-seeded with already-bilingual items that were never sent to the
        // model, so its size is (skipped + translated) measured against a total
        // that excludes the skipped — which could report "45 of 20".
        summaryData.unshift(
          ["*** PARTIAL TRANSLATION — THIS FILE IS NOT COMPLETE ***", "", "", ""],
          [`Translated ${processedUniqueCount} of ${totalUnique} items that needed translation.`, "", "", ""],
          [`${alreadyBilingualKeys.size} further item(s) were already bilingual and were never sent.`, "", "", ""],
          [partialReason, "", "", ""],
          // Mode-accurate. In bilingual and template modes an untranslated row
          // falls back to its original text; in `separate` mode the translation
          // column is simply left blank. Claiming "keeps its original text" for
          // all three would send a `separate`-mode user hunting for text that was
          // never written.
          [
            mode === 'separate'
              ? 'Rows marked "NOT TRANSLATED" have an empty translation column; the source column is untouched.'
              : 'Rows marked "NOT TRANSLATED" below keep their original text.',
            "", "", "",
          ],
          ["", "", "", ""],
        );
      }
      XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(summaryData), "Translation Summary");

      const outName = fileData.name.toLowerCase().endsWith('.csv')
        ? fileData.name.replace(/\.csv$/i, '.xlsx')
        : fileData.name;

      // The filename is the marker that survives being emailed on.
      saveWorkbook(newWb, `${isPartial ? 'PARTIAL_' : ''}Translated_${outName}`);

      if (isPartial) {
        addLog(
          `PARTIAL: translated ${processedUniqueCount} of ${totalUnique} items. ${partialReason} ` +
          `The file was still exported — untranslated rows keep their original text. ` +
          `Re-run to continue, or add more API keys (one per line) so rate limits rotate instead of stopping.`,
          'error',
        );
        // ERROR, not COMPLETED: a file exists, but the job did not finish, and
        // the status is what the user glances at.
        setStatus(ProcessingStatus.ERROR);
      } else {
        addLog(t.common.completed, 'success');
        setStatus(ProcessingStatus.COMPLETED);
      }
      setProgress(100);

    } catch (e: any) {
        addLog(`Error: ${e.message}`, 'error');
        setStatus(ProcessingStatus.IDLE);
    }
  };

  const handleCopyToClipboard = () => {
    if (!resultData) return;
    const text = resultData.map(r => r.join("\t")).join("\n");
    navigator.clipboard.writeText(text).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOP CONFIGURATION AREA */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
         
         {/* LEFT: SETTINGS (4 Cols) */}
        <div className="md:col-span-4 space-y-4">
            
            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                    <Settings2 size={16} className="text-slate-400"/> Configuration
                </h3>

                {/* Sheet Selector */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Source Sheet</label>
                    <div className="relative">
                        <select 
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm appearance-none"
                            value={selectedSheet}
                            onChange={(e) => { setSelectedSheet(e.target.value); setSelectedCols([]); }}
                        >
                            {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <ChevronDown size={14}/>
                        </div>
                    </div>
                </div>

                {/* Language Direction */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t.translate.direction}</label>
                    <div className="flex p-1 bg-slate-100/80 border border-slate-200/50 rounded-lg">
                        <button onClick={() => setDirection('auto')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${direction === 'auto' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>Auto ⇄</button>
                        <button onClick={() => setDirection('en_ar')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${direction === 'en_ar' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>En → Ar</button>
                        <button onClick={() => setDirection('ar_en')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${direction === 'ar_en' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>Ar → En</button>
                    </div>
                </div>

                {/* Advanced Toggle */}
                <div>
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors w-full justify-between"
                    >
                        <span>Advanced Settings</span>
                        {showAdvanced ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    
                    {showAdvanced && (
                        <div className="mt-3 space-y-4 p-4 bg-slate-50/80 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Context Column</label>
                                <div className="relative">
                                    <select 
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm appearance-none"
                                        value={contextCol}
                                        onChange={(e) => setContextCol(Number(e.target.value))}
                                    >
                                        <option value="-1">None</option>
                                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                        <ChevronDown size={14}/>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Domain</label>
                                <div className="relative">
                                    <select 
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm appearance-none" 
                                        value={domain} 
                                        onChange={e => setDomain(e.target.value)}
                                    >
                                        <option value="Restaurant/Food">Restaurant / Menu</option>
                                        <option value="E-commerce">E-commerce / Retail</option>
                                        <option value="Technical">Technical / IT</option>
                                        <option value="General">General</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                        <ChevronDown size={14}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Run Button */}
            <button
                onClick={handleProcess}
                disabled={status === ProcessingStatus.PROCESSING || selectedCols.length === 0}
                className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none
                    ${status === ProcessingStatus.PROCESSING || selectedCols.length === 0 ? 'bg-slate-300 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
                {status === ProcessingStatus.PROCESSING ? <Zap className="animate-spin" size={16}/> : <Play size={16}/>}
                <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}</span>
            </button>

         </div>

         {/* CENTER: MODE SELECTION (5 Cols) */}
         <div className="md:col-span-5 space-y-4">
             <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                 <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                    <Layout size={16} className="text-slate-400"/> Output Mode
                 </h3>
                 
                 {/* 1. VISUAL CARDS */}
                 <div className="grid grid-cols-1 gap-3 flex-1">
                     
                     {/* Bilingual Card */}
                     <button 
                        onClick={() => setMode('bilingual')}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all group flex items-center gap-4
                            ${mode === 'bilingual' 
                                ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-sm' 
                                : 'border-slate-100 hover:border-blue-300 hover:bg-slate-50'}`}
                     >
                         {/* Visual Data Flow */}
                         <div className="flex items-center gap-1.5 opacity-80 shrink-0">
                             <div className="w-8 h-8 rounded border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400">A</div>
                             <ArrowRight size={14} className="text-blue-400"/>
                             <div className="w-12 h-8 rounded border border-blue-300 bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 font-bold">A | B</div>
                         </div>
                         
                         <div className="flex-1">
                             <h4 className={`font-bold text-sm ${mode === 'bilingual' ? 'text-blue-800' : 'text-slate-700'}`}>Bilingual Cell</h4>
                             <p className="text-[10px] text-slate-500">Merges original & translation in one cell.</p>
                         </div>
                         {mode === 'bilingual' && <Check size={18} className="text-blue-600"/>}
                     </button>

                     {/* Separate Card */}
                     <button 
                        onClick={() => setMode('separate')}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all group flex items-center gap-4
                            ${mode === 'separate' 
                                ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600 shadow-sm' 
                                : 'border-slate-100 hover:border-purple-300 hover:bg-slate-50'}`}
                     >
                         {/* Visual Data Flow */}
                         <div className="flex items-center gap-1.5 opacity-80 shrink-0">
                             <div className="w-8 h-8 rounded border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400">A</div>
                             <ArrowRight size={14} className="text-purple-400"/>
                             <div className="w-8 h-8 rounded border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400">A</div>
                             <div className="w-8 h-8 rounded border border-purple-300 bg-purple-100 flex items-center justify-center text-[10px] text-purple-700 font-bold">B</div>
                         </div>

                         <div className="flex-1">
                             <h4 className={`font-bold text-sm ${mode === 'separate' ? 'text-purple-800' : 'text-slate-700'}`}>New Column</h4>
                             <p className="text-[10px] text-slate-500">Translation goes to a new independent column.</p>
                         </div>
                         {mode === 'separate' && <Check size={18} className="text-purple-600"/>}
                     </button>

                     {/* Template Card */}
                     <button 
                        onClick={() => setMode('template')}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all group flex items-center gap-4
                            ${mode === 'template' 
                                ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500 shadow-sm' 
                                : 'border-slate-100 hover:border-amber-300 hover:bg-slate-50'}`}
                     >
                         {/* Visual Data Flow */}
                         <div className="flex items-center gap-1.5 opacity-80 shrink-0">
                             <div className="w-8 h-8 rounded border border-slate-300 bg-white flex items-center justify-center text-[10px] text-slate-400">A</div>
                             <ArrowRight size={14} className="text-amber-400"/>
                             <div className="w-12 h-8 rounded border border-amber-300 bg-amber-100 flex items-center justify-center text-[9px] text-amber-800 leading-tight p-0.5 text-center">Item: A<br/>Trans: B</div>
                         </div>

                         <div className="flex-1">
                             <h4 className={`font-bold text-sm ${mode === 'template' ? 'text-amber-800' : 'text-slate-700'}`}>Custom Template</h4>
                             <p className="text-[10px] text-slate-500">Format as [Item] - [Trans] etc.</p>
                         </div>
                         {mode === 'template' && <Check size={18} className="text-amber-600"/>}
                     </button>

                 </div>

                 {/* 2. DYNAMIC CONFIGURATION AREA */}
                 <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
                     
                     {/* BILINGUAL CONFIG */}
                     {mode === 'bilingual' && (
                         <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-slate-700 uppercase">Separator Style</label>
                                <div className="flex gap-1">
                                    {[' | ', ' - ', '\n', ' / '].map(sep => (
                                        <button 
                                            key={sep}
                                            onClick={() => setSeparator(sep)}
                                            className={`w-8 h-8 rounded text-xs font-mono border flex items-center justify-center transition-all ${separator === sep ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'}`}
                                            title={sep === '\n' ? "New Line" : sep}
                                        >
                                            {sep === '\n' ? '↵' : sep.trim()}
                                        </button>
                                    ))}
                                </div>
                             </div>
                             
                             <div className="flex p-1 bg-slate-100/80 border border-slate-200/50 rounded-lg">
                                <button onClick={() => setBilingualStrategy('consolidate')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${bilingualStrategy==='consolidate' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                    <Merge size={12}/> Consolidate
                                </button>
                                <button onClick={() => setBilingualStrategy('inplace')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${bilingualStrategy==='inplace' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                                    <Replace size={12}/> In-Place Update
                                </button>
                             </div>
                         </div>
                     )}

                     {/* SEPARATE CONFIG */}
                     {mode === 'separate' && (
                         <div>
                             <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={mergeSource} 
                                    onChange={e => setMergeSource(e.target.checked)}
                                    className="rounded text-purple-600 w-4 h-4" 
                                />
                                <div>
                                    <span className="text-xs font-semibold text-purple-800 flex items-center gap-1">
                                        <Combine size={14}/> Merge Sources First?
                                    </span>
                                    <p className="text-[10px] text-slate-500 mt-0.5">If checked, combines all selected columns into one phrase before translating.</p>
                                </div>
                             </label>
                         </div>
                     )}

                     {/* TEMPLATE CONFIG */}
                     {mode === 'template' && (
                         <div>
                             <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Pattern</label>
                             <div className="relative">
                                 <input 
                                    type="text" 
                                    value={templatePattern} 
                                    onChange={e => setTemplatePattern(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                                    placeholder="[Item] - [Trans]"
                                 />
                             </div>
                             <div className="mt-2 flex gap-2">
                                <button onClick={() => setTemplatePattern('[Item]\n[Trans]')} className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium hover:bg-amber-50 text-slate-600 transition-colors">Stacked</button>
                                <button onClick={() => setTemplatePattern('([Item]) [Trans]')} className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium hover:bg-amber-50 text-slate-600 transition-colors">Parentheses</button>
                             </div>
                         </div>
                     )}
                 </div>
                 
                 {/* 3. INTERACTIVE PREVIEW PLAYGROUND */}
                 <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                     <div className="bg-slate-50 p-2 border-b border-slate-200 flex justify-between items-center px-4">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><MousePointer2 size={12}/> Live Preview</span>
                         <input 
                             value={testInput}
                             onChange={(e) => setTestInput(e.target.value)}
                             className="text-xs px-2 py-1.5 border border-slate-300 rounded shadow-sm w-40 text-right bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                             placeholder="Test text..."
                         />
                     </div>
                     <div className="p-0 overflow-x-auto">
                         <table className="w-full text-sm text-left">
                             <thead className="bg-slate-50 text-xs uppercase tracking-widest font-semibold text-slate-500 border-b border-slate-200">
                                 <tr>
                                     <th className="px-4 py-3 w-1/3">Original Data</th>
                                     <th className="px-4 py-3 border-l border-slate-200 text-blue-600">Output Result</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                 <tr className="hover:bg-slate-50/50 transition-colors">
                                     <td className="px-4 py-3 text-slate-700 font-mono text-[13px]">{testInput}</td>
                                     <td className="px-4 py-3 text-blue-700 font-medium">
                                         {calculatePreview()}
                                     </td>
                                 </tr>
                             </tbody>
                         </table>
                     </div>
                 </div>

             </div>
         </div>

         {/* RIGHT: COLUMN SELECTION (3 Cols) */}
         <div className="md:col-span-3">
             <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Table size={16} className="text-slate-400"/> Columns
                     </h3>
                     <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded font-semibold tracking-wider">{selectedCols.length}</span>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg bg-slate-50 p-2">
                     {headers.map((h, i) => (
                         <label key={i} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${selectedCols.includes(i) ? 'bg-white border border-blue-200 shadow-sm' : 'hover:bg-slate-200'}`}>
                             <input 
                                type="checkbox" 
                                checked={selectedCols.includes(i)} 
                                onChange={() => toggleColumn(i)}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300"
                             />
                             <span className={`text-xs truncate ${selectedCols.includes(i) ? 'font-bold text-blue-700' : 'text-slate-600'}`}>{h || `Col ${i+1}`}</span>
                         </label>
                     ))}
                 </div>
                 
                 {/* Output Column Selector (For Single Column Output Modes) */}
                 {/* Logic: Show ONLY if NOT doing in-place update */}
                 {!(mode === 'bilingual' && bilingualStrategy === 'inplace') && (mode === 'bilingual' || mode === 'template' || (mode === 'separate' && mergeSource)) && (
                     <div className="mt-4 pt-4 border-t border-slate-200">
                         <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Target Output Column</label>
                         <div className="flex items-center gap-2">
                             <FileOutput size={16} className="text-slate-400"/>
                             <input 
                                type="number" 
                                min="1" 
                                className="w-16 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                value={outputCol}
                                onChange={e => setOutputCol(Number(e.target.value))}
                             />
                             <span className="text-xs text-slate-400">(Col {getExcelColumnName(outputCol - 1)})</span>
                         </div>
                     </div>
                 )}
             </div>
         </div>

      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={`${t.common.processing} (Batch: ${batchSize})`} />}
      
      {resultData && (
          <div className="flex justify-center gap-4 animate-in fade-in slide-in-from-bottom-2">
              <button 
                onClick={handleCopyToClipboard} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                  {copySuccess ? <Check size={16} className="text-green-600"/> : <Copy size={16} className="text-slate-400"/>}
                  {copySuccess ? "Copied!" : "Copy Output"}
              </button>
              {fileData?.spreadsheetId && (
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all shadow-sm active:scale-95 disabled:opacity-50">
                      <CloudUpload size={16}/> Sync to Google Sheet
                  </button>
              )}
          </div>
      )}

    </div>
  );
};

export default TranslateTab;
