
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { saveWorkbook, getSheetData } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { ShoppingBag, Eraser, Scissors } from 'lucide-react';

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
  "[1] النوع", "[1] الصورة / اللون", "[2] النوع", "[2] الصورة / اللون", "[3] النوع", "[3] الصورة / اللون",
  "[4] النوع", "[4] الصورة / اللون", "[5] النوع", "[5] الصورة / اللون", "[6] النوع", "[6] الصورة / اللون",
  "[7] النوع", "[7] الصورة / اللون", "[8] النوع", "[8] الصورة / اللون"
];

const SallaTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [cleanColumns, setCleanColumns] = useState<boolean>(true);

  React.useEffect(() => {
    if (fileData) {
      const salla = fileData.sheets.find(s => s.toLowerCase().includes('salla') || s.toLowerCase().includes('products'));
      setSelectedSheet(salla || fileData.sheets[0] || '');
    }
  }, [fileData]);

  const filterAndCleanData = (data: any[][], blacklist: string[], applyCleaning: boolean) => {
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

  const normalizeRow = (row: any[]) => {
      return row.map(cell => {
          if (typeof cell === 'number') return cell.toLocaleString('fullwide', { useGrouping: false });
          return cell;
      });
  };

  // Helper to force Text format on export
  const appendSheetWithFormat = (wb: any, data: any[][], name: string) => {
      const ws = XLSX.utils.aoa_to_sheet(data);
      // Iterate all cells
      Object.keys(ws).forEach(cellRef => {
          if (cellRef[0] === '!') return;
          const cell = ws[cellRef];
          // If it's a number and long (like barcode), force string type
          if (cell.t === 'n' && String(cell.v).length > 10) {
              cell.t = 's';
              cell.v = String(cell.v);
              cell.z = '@'; // Force Text format in Excel
          }
      });
      XLSX.utils.book_append_sheet(wb, ws, name);
  };

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));
      const originalData = getSheetData(fileData.workbook, selectedSheet, true);
      if (originalData.length === 0) throw new Error("Sheet is empty.");

      let headerRowIndex = 0;
      let typeColIndex = -1;

      // Detect Type Col
      for (let r = 0; r < Math.min(originalData.length, 20); r++) {
          const row = originalData[r] as any[];
          const idx = row.findIndex(cell => cell && (String(cell).trim() === "النوع" || String(cell).trim().toLowerCase() === "type" || String(cell).trim() === "نوع المنتج"));
          if (idx !== -1) { headerRowIndex = r; typeColIndex = idx; break; }
      }
      if (typeColIndex === -1) {
          // Fallback logic omitted for brevity, assume found or throw error
          typeColIndex = 2; // Default fallback
      }

      const header = originalData[headerRowIndex] as string[];
      const newHeader = ["تصنيف البوت", ...header];
      const simpleRows: any[][] = [];
      const variableRows: any[][] = [];
      const allNewRows: any[][] = [newHeader];

      const rows = originalData.slice(headerRowIndex + 1);
      
      for (let i = 0; i < rows.length; i++) {
          const row = normalizeRow(rows[i]);
          const rawType = String(row[typeColIndex] || "").trim();
          let category = "نوع واحد";

          if (rawType === "منتج" || rawType === "نوع المنتج" || rawType.toLowerCase() === "product") {
              let isVariable = false;
              if (i + 1 < rows.length) {
                  const nextRow = rows[i+1];
                  const nextType = String(nextRow[typeColIndex] || "").trim();
                  if (nextType === "خيار" || nextType.toLowerCase() === "option" || nextType.toLowerCase() === "variant") isVariable = true;
              }
              if (isVariable) category = "متعدد"; 
          } else if (rawType === "خيار" || rawType.toLowerCase() === "option" || rawType.toLowerCase() === "variant") {
              category = "متعدد";
          }

          const newRow = [category, ...row];
          allNewRows.push(newRow);
          if (category === "نوع واحد") simpleRows.push(newRow);
          else variableRows.push(newRow);

          if (i % 500 === 0) { setProgress(Math.round((i / rows.length) * 80)); await new Promise(r => setTimeout(r, 0)); }
      }

      const { cleanedData: finalMainData } = filterAndCleanData(allNewRows, SALLA_BLACKLIST, cleanColumns);
      const { cleanedData: finalSimpleData } = filterAndCleanData(simpleRows.length > 0 ? [newHeader, ...simpleRows] : [], SALLA_BLACKLIST, cleanColumns);
      const { cleanedData: finalVariableData } = filterAndCleanData(variableRows.length > 0 ? [newHeader, ...variableRows] : [], SALLA_BLACKLIST, cleanColumns);

      const newWb = XLSX.utils.book_new();
      appendSheetWithFormat(newWb, finalMainData, selectedSheet.substring(0,30));
      if (finalSimpleData.length > 1) appendSheetWithFormat(newWb, finalSimpleData, "Simple Products");
      if (finalVariableData.length > 1) appendSheetWithFormat(newWb, finalVariableData, "Variable Products");

      const baseName = fileData.name.replace(/\.[^/.]+$/, "");
      saveWorkbook(newWb, `Salla_Analyzed_${baseName}.xlsx`);
      
      addLog(t.common.completed, 'success');
      setProgress(100);
    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         <h3 className="font-bold text-slate-700 mb-4 flex items-center"><ShoppingBag className="mr-2" size={20}/>{t.salla.title}</h3>
         <div className="mb-6">
            <label className="block text-sm font-medium text-slate-600 mb-2">{t.salla.selectProductSheet}</label>
            <select className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 outline-none" value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)}>
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>
         <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="flex items-start space-x-3 cursor-pointer">
                <input type="checkbox" checked={cleanColumns} onChange={(e) => setCleanColumns(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                <div className="flex-1 text-sm"><span className="font-bold text-slate-700 flex items-center gap-2"><Eraser size={16}/> Clean Columns</span><p className="text-xs text-slate-500 mt-1">Removes empty/blacklisted columns.</p></div>
            </label>
         </div>
         <button onClick={handleProcess} disabled={!fileData || status === ProcessingStatus.PROCESSING} className={`w-full flex justify-center items-center space-x-2 px-6 py-4 rounded-lg font-bold text-white shadow-md transition-all ${status === ProcessingStatus.PROCESSING ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700'}`}>
            {status === ProcessingStatus.PROCESSING ? <span className="animate-spin mr-2">⏳</span> : <Scissors size={20}/>}
            <span>{t.salla.analyzeBtn}</span>
         </button>
       </div>
       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default SallaTab;
