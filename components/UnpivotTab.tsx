
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  ArrowDownRight, Table, List, Settings2, Columns, 
  ArrowRight, Save, RotateCw, CheckCircle2, LayoutTemplate, Tag
} from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

const UnpivotTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  // State
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  
  // Config
  const [anchorCols, setAnchorCols] = useState<number[]>([]); // Columns that stay (e.g. Product Name)
  const [transformCols, setTransformCols] = useState<number[]>([]); // Columns to rotate (e.g. Sizes)
  
  const [attrHeader, setAttrHeader] = useState<string>("Option"); // Name for the new column from headers
  const [valHeader, setValHeader] = useState<string>("Value"); // Name for the new column from values
  const [skipEmpty, setSkipEmpty] = useState<boolean>(true); // Skip cells with no value

  // New: Static Column Config
  const [staticTypeVal, setStaticTypeVal] = useState<string>("");
  const [staticTypeHeader, setStaticTypeHeader] = useState<string>("Option Name");

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [resultPreview, setResultPreview] = useState<any[][]>([]);

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
        
        // Auto-guess: First column is anchor, rest are transform
        if (head.length > 0) {
            setAnchorCols([0]);
            setTransformCols(head.map((_, i) => i).filter(i => i !== 0));
        } else {
            setAnchorCols([]);
            setTransformCols([]);
        }
        setResultPreview([]);
      }
    }
  }, [fileData, selectedSheet]);

  // Toggle selection logic
  const toggleAnchor = (idx: number) => {
      if (transformCols.includes(idx)) {
          setTransformCols(prev => prev.filter(i => i !== idx));
      }
      setAnchorCols(prev => 
          prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
  };

  const toggleTransform = (idx: number) => {
      if (anchorCols.includes(idx)) {
          setAnchorCols(prev => prev.filter(i => i !== idx));
      }
      setTransformCols(prev => 
          prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
  };

  const handleProcess = async () => {
      if (!fileData || anchorCols.length === 0 || transformCols.length === 0) {
          addLog("Please select at least one fixed column and one transform column.", 'warning');
          return;
      }

      setStatus(ProcessingStatus.PROCESSING);
      setProgress(0);
      addLog("Unpivoting table...", 'info');

      await new Promise(r => setTimeout(r, 100));

      try {
          const outputHeaders = [
              ...anchorCols.map(i => headers[i]),
              ...(staticTypeVal ? [staticTypeHeader] : []),
              attrHeader,
              valHeader
          ];

          const outputRows: any[][] = [outputHeaders];
          const totalRows = rows.length;

          rows.forEach((row, rIdx) => {
              // Get Anchor Values (Fixed part of the row)
              const fixedPart = anchorCols.map(i => row[i]);
              
              // Skip row if primary anchor is empty (cleanup bad data)
              if (!fixedPart[0]) return;

              // Iterate through transform columns
              transformCols.forEach(colIdx => {
                  const val = row[colIdx];
                  const hasValue = val !== undefined && val !== null && String(val).trim() !== "";
                  
                  if (!skipEmpty || hasValue) {
                      const attrName = headers[colIdx] || `Col ${colIdx+1}`;
                      outputRows.push([
                          ...fixedPart,
                          ...(staticTypeVal ? [staticTypeVal] : []),
                          attrName, // The header becomes a value
                          val       // The cell value stays a value
                      ]);
                  }
              });

              if (rIdx % 100 === 0) setProgress(Math.round((rIdx / totalRows) * 100));
          });

          setResultPreview(outputRows.slice(0, 10)); // Show preview
          
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(outputRows);
          // Style headers
          if (ws['!ref']) {
             const range = XLSX.utils.decode_range(ws['!ref']);
             for(let C=range.s.c; C<=range.e.c; ++C) {
                 const ref = XLSX.utils.encode_cell({r:0, c:C});
                 if(!ws[ref].s) ws[ref].s = {};
                 ws[ref].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } } };
             }
          }
          
          XLSX.utils.book_append_sheet(wb, ws, "Unpivoted Data");
          saveWorkbook(wb, `Vertical_${fileData.name}`);
          
          addLog(t.common.completed, 'success');
          setProgress(100);
          setStatus(ProcessingStatus.COMPLETED);

      } catch (e: any) {
          addLog(e.message, 'error');
          setStatus(ProcessingStatus.IDLE);
      }
  };

  return (
    <div className="space-y-6">
        
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                    <ArrowDownRight className="text-orange-500" size={24}/>
                    {t.unpivot.title}
                </h3>
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 mb-2">{t.common.selectSheet}</label>
                <select 
                    className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={selectedSheet}
                    onChange={(e) => { setSelectedSheet(e.target.value); setStatus(ProcessingStatus.IDLE); }}
                >
                    {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {headers.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Configuration */}
                    <div className="space-y-6">
                        {/* Anchor Columns */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center gap-2">
                                <Columns size={14}/> 1. Fixed Columns (Identifiers)
                            </h4>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                                {headers.map((h, i) => (
                                    <label key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${anchorCols.includes(i) ? 'bg-blue-100 text-blue-800 font-bold' : 'hover:bg-slate-200 text-slate-600'}`}>
                                        <input type="checkbox" checked={anchorCols.includes(i)} onChange={() => toggleAnchor(i)} className="rounded text-blue-600"/>
                                        <span className="truncate">{h || `Column ${i+1}`}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">These columns will repeat for every value found.</p>
                        </div>

                        {/* Transform Columns */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center gap-2">
                                <RotateCw size={14}/> 2. Columns to Verticalize (Values)
                            </h4>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                                {headers.map((h, i) => (
                                    <label key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${transformCols.includes(i) ? 'bg-orange-100 text-orange-800 font-bold' : 'hover:bg-slate-200 text-slate-600'}`}>
                                        <input type="checkbox" checked={transformCols.includes(i)} onChange={() => toggleTransform(i)} className="rounded text-orange-600"/>
                                        <span className="truncate">{h || `Column ${i+1}`}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">These headers will become values in the new "Option" column.</p>
                        </div>

                        {/* Settings */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center gap-2">
                                <Settings2 size={14}/> 3. Output Settings
                            </h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.unpivot.attrHeader}</label>
                                    <input type="text" value={attrHeader} onChange={e => setAttrHeader(e.target.value)} className="w-full p-2 border rounded text-xs"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.unpivot.valHeader}</label>
                                    <input type="text" value={valHeader} onChange={e => setValHeader(e.target.value)} className="w-full p-2 border rounded text-xs"/>
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={skipEmpty} onChange={e => setSkipEmpty(e.target.checked)} className="rounded text-orange-600"/>
                                <span className="text-xs font-bold text-slate-700">Skip Empty Cells</span>
                            </label>
                        </div>

                        {/* Static Type Column (Enhancement) */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center gap-2">
                                <Tag size={14}/> 4. Add Static Type (Optional)
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Header Name</label>
                                    <input type="text" value={staticTypeHeader} onChange={e => setStaticTypeHeader(e.target.value)} className="w-full p-2 border rounded text-xs"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Row Value</label>
                                    <input type="text" value={staticTypeVal} onChange={e => setStaticTypeVal(e.target.value)} placeholder="e.g. Size, Service" className="w-full p-2 border rounded text-xs"/>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">If filled, adds a column with this constant value to every row.</p>
                        </div>

                        <button 
                            onClick={handleProcess}
                            disabled={status === ProcessingStatus.PROCESSING}
                            className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                            {status === ProcessingStatus.PROCESSING ? <span className="animate-spin">⏳</span> : <ArrowDownRight size={20}/>}
                            {t.unpivot.convert}
                        </button>
                    </div>

                    {/* Right: Visual Preview */}
                    <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-3 border-b border-slate-200 bg-white flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><LayoutTemplate size={16}/> Transformation Preview</h4>
                            {resultPreview.length > 0 && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Generated</span>}
                        </div>
                        
                        <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-6 relative">
                            {/* Visual Representation */}
                            <div className="flex items-center gap-4 opacity-80">
                                <div className="bg-white border-2 border-blue-200 rounded p-2 shadow-sm w-24 h-16 flex flex-col gap-1">
                                    <div className="h-2 w-full bg-blue-100 rounded"></div>
                                    <div className="flex gap-1 h-full">
                                        <div className="w-1/3 bg-slate-100 rounded"></div>
                                        <div className="w-1/3 bg-orange-100 rounded"></div>
                                        <div className="w-1/3 bg-orange-100 rounded"></div>
                                    </div>
                                </div>
                                <ArrowRight size={24} className="text-slate-400"/>
                                <div className="bg-white border-2 border-green-200 rounded p-2 shadow-sm w-16 h-24 flex flex-col gap-1">
                                    <div className="h-2 w-full bg-green-100 rounded"></div>
                                    <div className="h-1.5 w-full bg-slate-50 rounded"></div>
                                    <div className="h-1.5 w-full bg-slate-50 rounded"></div>
                                    <div className="h-1.5 w-full bg-slate-50 rounded"></div>
                                    <div className="h-1.5 w-full bg-slate-50 rounded"></div>
                                </div>
                            </div>

                            {/* Actual Data Preview */}
                            {resultPreview.length > 0 ? (
                                <div className="w-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm max-h-60 overflow-y-auto text-xs">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                            <tr>
                                                {resultPreview[0].map((h: any, i: number) => (
                                                    <th key={i} className="p-2 border-b">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultPreview.slice(1).map((row, i) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                                    {row.map((c: any, j: number) => (
                                                        <td key={j} className="p-2 truncate max-w-[100px]">{c}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-slate-400 text-xs">
                                    <p>Select columns and process to see result.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default UnpivotTab;
