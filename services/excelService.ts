
import * as XLSX from 'xlsx';
import XLSX_STYLE from 'xlsx-js-style';
import { FileData, SheetData } from '../types';
import { scientificNumberOverride, plainNumberString } from '../utils/cellText';

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
    // TEXT MODE — SheetJS's own output, with ONE class of cell corrected.
    //
    // `sheet_to_json({ raw: false })` returns `w`, the text Excel would DISPLAY.
    // For long numbers that is lossy: Excel's General format switches to
    // scientific at 12 digits, so a 13-digit barcode arrives as "1.23457E+12" —
    // six significant digits. The previous code tried to rescue that by running
    // `Number()` on the scientific string, which produced 1234570000000: a wrong
    // barcode that still looks like a barcode. `cell.v` held the true value all
    // along (TD-038).
    //
    // The correction is an OVERRIDE, not a re-read. `data` keeps SheetJS's value
    // for every cell, and only a number whose displayed text is scientific is
    // replaced. An earlier attempt rebuilt every value from the cell and quietly
    // changed three other classes: error cells went from `""` to the literal
    // "#N/A" — so a broken VLOOKUP in a barcode column would export `#N/A` AS a
    // barcode — text cells lost display formats, and untyped cells stopped
    // yielding `defval`. Overriding instead makes "nothing else changes"
    // verifiable by reading these six lines.
    //
    // One further deliberate difference from the old code: a TEXT cell whose
    // content is literally "1.23E+12" is no longer expanded via `Number()`. Those
    // digits are already gone in the file; expanding them invents zeros.
    //
    // Column labels are hoisted because this runs on the main thread inside a
    // click handler, and `encode_cell` per cell allocates an object and a string
    // for every one of them — 800k allocations on the 40k-row sheet the e2e suite
    // already exercises.
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const colRefs: string[] = [];
    for (let c = 0; c < (data[0]?.length ?? 0); c++) {
      colRefs.push(XLSX.utils.encode_col(range.s.c + c));
    }

    for (let r = 0; r < data.length; r++) {
      const rowRef = String(range.s.r + r + 1);
      for (let c = 0; c < data[r].length; c++) {
        const corrected = scientificNumberOverride(worksheet[colRefs[c] + rowRef]);
        if (corrected !== null) data[r][c] = corrected;
      }
    }
    return data;
  }

  // RAW MODE — numbers stay numbers, which is what Compare, Merge, Dedupe,
  // Duplicates and Clean need for arithmetic and key building. Raw values never
  // carry the scientific display text, so the corruption above cannot occur here;
  // the only guard needed is JavaScript's own switch to exponent form at 1e21,
  // which would otherwise reach the UI as "1e+21".
  //
  // ONE DELIBERATE CHANGE, stated because an earlier comment here wrongly claimed
  // there were none. The old loop had a second branch that ran `Number()` over
  // *string* cells matching scientific notation, so a text cell containing
  // "1.23E+12" reached these tools as "1230000000000". That branch is gone: those
  // digits are already lost in the file, and expanding them invents zeros. Such a
  // cell now arrives verbatim, consistent with text mode above.
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
