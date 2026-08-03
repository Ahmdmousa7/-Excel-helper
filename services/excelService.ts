
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';
import { FileData, SheetData } from '../types';
import { cellToText, plainNumberString } from '../utils/cellText';

export const readExcelFile = async (file: File): Promise<FileData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', raw: true });
        resolve({
          name: file.name,
          workbook: workbook,
          sheets: workbook.SheetNames,
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const fetchGoogleSheet = async (url: string): Promise<FileData> => {
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const id = idMatch ? idMatch[1] : null;

  if (!id) throw new Error("Invalid Google Sheet URL.");

  // Target: Export as XLSX to get all sheets
  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  
  // Proxy Strategy: Try primary (fast), then backup (reliable)
  const proxies = [
    { url: `https://corsproxy.io/?${encodeURIComponent(xlsxUrl)}`, type: 'blob' },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(xlsxUrl)}`, type: 'blob' }
  ];

  let lastError;

  for (const proxy of proxies) {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const response = await fetch(proxy.url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const arrayBuffer = await response.arrayBuffer();
          
          // Check for Access Denied (Google Login Page HTML)
          const firstBytes = new Uint8Array(arrayBuffer.slice(0, 50));
          const headerStr = String.fromCharCode(...firstBytes);
          if (headerStr.includes("<!DOCTYPE") || headerStr.includes("<html") || headerStr.includes("Sign in")) {
             throw new Error("Access Denied. Sheet must be Public (Anyone with link).");
          }

          const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true });
          
          if (workbook.SheetNames.length === 0) throw new Error("Empty file.");

          return {
            name: `GSheet_${id.substring(0,6)}.xlsx`,
            workbook: workbook,
            sheets: workbook.SheetNames,
            spreadsheetId: id // Store ID for Write-Back operations
          };

      } catch (e: any) {
          console.warn("Proxy failed, trying next...", e.message);
          lastError = e;
          // If permission error, don't retry, it's final
          if (e.message.includes("Access Denied")) break;
      }
  }

  throw new Error(lastError?.message || "Failed to fetch Google Sheet. Check internet or privacy settings.");
};

export const getSheetData = (workbook: any, sheetName: string, raw: boolean = false): SheetData => {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: raw }) as any[][];

  if (!raw) {
    // TEXT MODE — read each cell's real content instead of its display text.
    //
    // `sheet_to_json({ raw: false })` returns `w`, the text Excel would DISPLAY.
    // For long numbers that is lossy: Excel's General format switches to
    // scientific at 12 digits, so a 13-digit barcode arrives as "1.23457E+12" —
    // six significant digits. The previous code tried to rescue that by running
    // `Number()` on the scientific string, which produced 1234570000000: a wrong
    // barcode that still looks like a barcode. `cell.v` had the right value all
    // along.
    //
    // So the grid SHAPE still comes from sheet_to_json — same rows, same columns,
    // same `defval` behaviour as before — and only the values are re-read from
    // the cells. Keeping the shape identical is deliberate: every consumer
    // indexes this array positionally.
    //
    // See utils/cellText.ts for the per-cell rule and its tests.
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < data[r].length; c++) {
        const ref = XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c });
        data[r][c] = cellToText(worksheet[ref]);
      }
    }
    return data;
  }

  // RAW MODE — unchanged. Callers here (Compare, Merge, Dedupe, Duplicates,
  // Clean) rely on numbers staying numbers for arithmetic and key building, and
  // raw values never carry the scientific display text, so the corruption above
  // cannot occur. The only guard needed is JavaScript's own switch to exponent
  // form at 1e21, which would otherwise reach the UI as "1e+21".
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const val = data[r][c];
      if (typeof val === 'number' && /[eE]/.test(String(val))) {
        data[r][c] = plainNumberString(val);
      }
    }
  }

  return data;
};

export const createWorkbook = (): any => {
  return XLSX.utils.book_new();
};

export const appendSheet = (workbook: any, data: any[][], sheetName: string) => {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
};

export const saveWorkbook = (workbook: any, filename: string) => {
  XLSX_STYLE.writeFile(workbook, filename);
};

export const cloneWorkbook = (workbook: any): any => {
  const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return XLSX.read(wbOut, { type: 'array' });
};
