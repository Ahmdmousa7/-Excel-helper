/**
 * Hand bytes to the browser as a file download.
 *
 * The object URL is revoked shortly after the click, so the bytes are not
 * pinned in memory for the life of the page. Not immediately: some browsers
 * start reading the URL only after `click()` returns.
 *
 * A browser can still refuse a download it considers unsolicited, and says
 * nothing to the page when it does — so callers must keep a visible download
 * button rather than report this call as proof the file arrived.
 */
export function downloadBytes(bytes: Uint8Array | Blob, filename: string, mimeType: string): void {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const ZIP_MIME = 'application/zip';
