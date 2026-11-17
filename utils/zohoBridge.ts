/**
 * Zoho bridge — lets the Rewaa "Account Setup" userscript send a task's
 * PDF / image files into the OCR tab and take the finished Rewaa workbook back.
 *
 * Transport: `window.postMessage` on THIS window only. The userscript runs inside
 * this page (Tampermonkey @match on the Excel Helper URL) and relays to the Zoho
 * tab through its own storage, so nothing is posted to another origin and no
 * other site can talk to the app. Every message is checked with
 * `isOwnMessage` (same window, same origin) and a type guard.
 *
 * Opt-in: the bridge only listens when the URL hash contains `zoho-bridge`
 * (the userscript opens `…/-Excel-helper/#zoho-bridge`).
 */

export const ZOHO_BRIDGE_HASH = 'zoho-bridge';

export const MSG = {
  ready: 'rewaa-ocr-ready',
  load: 'rewaa-ocr-load',
  loaded: 'rewaa-ocr-loaded',
  result: 'rewaa-ocr-result',
} as const;

export interface BridgeFile {
  name: string;
  mime: string;
  base64: string;
}

export interface BridgeLoad {
  type: typeof MSG.load;
  taskId: string;
  taskName?: string;
  files: BridgeFile[];
}

export interface BridgeResult {
  type: typeof MSG.result;
  taskId: string;
  fileName: string;
  base64: string;
  rows: number;
}

/** True when the page was opened by the userscript (hash `#zoho-bridge`, possibly with other parts). */
export const isBridgeMode = (hash: string = typeof window !== 'undefined' ? window.location.hash : ''): boolean =>
  hash.replace(/^#/, '').split(/[&/]/).includes(ZOHO_BRIDGE_HASH);

/** Only messages this window posted to itself (the userscript lives in this page). */
export const isOwnMessage = (e: Pick<MessageEvent, 'source' | 'origin'>, win: Window = window): boolean =>
  e.source === win && e.origin === win.location.origin;

const MAX_FILES = 20;
const MAX_BASE64 = 30 * 1024 * 1024; // ~22 MB per file

export const isBridgeLoad = (d: unknown): d is BridgeLoad => {
  if (!d || typeof d !== 'object') return false;
  const m = d as Record<string, unknown>;
  if (m.type !== MSG.load || typeof m.taskId !== 'string' || !m.taskId) return false;
  if (!Array.isArray(m.files) || m.files.length === 0 || m.files.length > MAX_FILES) return false;
  return m.files.every((f: unknown) => {
    if (!f || typeof f !== 'object') return false;
    const x = f as Record<string, unknown>;
    return typeof x.name === 'string' && !!x.name && typeof x.mime === 'string' &&
      typeof x.base64 === 'string' && x.base64.length > 0 && x.base64.length <= MAX_BASE64;
  });
};

export const base64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
};

/** A file name a browser `File` can carry: no path parts, no control characters. */
export const safeFileName = (name: string): string =>
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  (name.split(/[\\/]/).pop() || 'file').replace(/[\u0000-\u001f]/g, '').slice(0, 200) || 'file';

export const bridgeFileToFile = (f: BridgeFile): File =>
  new File([base64ToBytes(f.base64)], safeFileName(f.name), { type: f.mime || 'application/octet-stream' });

export const postToUserscript = (msg: { type: string } & Record<string, unknown>, win: Window = window): void =>
  win.postMessage(msg, win.location.origin);
