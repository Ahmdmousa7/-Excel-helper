import { describe, it, expect } from 'vitest';
import {
  isBridgeMode, isOwnMessage, isBridgeLoad, base64ToBytes, bytesToBase64, safeFileName, MSG,
} from '../../utils/zohoBridge';

describe('zohoBridge', () => {
  it('is opt-in through the URL hash', () => {
    expect(isBridgeMode('#zoho-bridge')).toBe(true);
    expect(isBridgeMode('#tab=ocr&zoho-bridge')).toBe(true);
    expect(isBridgeMode('')).toBe(false);
    expect(isBridgeMode('#zoho-bridgex')).toBe(false);
  });

  it('accepts only messages the window posted to itself', () => {
    const win = { location: { origin: 'https://a.example' } } as unknown as Window;
    expect(isOwnMessage({ source: win, origin: 'https://a.example' } as MessageEvent, win)).toBe(true);
    expect(isOwnMessage({ source: null, origin: 'https://a.example' } as MessageEvent, win)).toBe(false);
    expect(isOwnMessage({ source: win, origin: 'https://evil.example' } as MessageEvent, win)).toBe(false);
  });

  it('validates the load message', () => {
    const ok = { type: MSG.load, taskId: '123', files: [{ name: 'menu.pdf', mime: 'application/pdf', base64: 'AAAA' }] };
    expect(isBridgeLoad(ok)).toBe(true);
    expect(isBridgeLoad({ ...ok, type: 'other' })).toBe(false);
    expect(isBridgeLoad({ ...ok, taskId: '' })).toBe(false);
    expect(isBridgeLoad({ ...ok, files: [] })).toBe(false);
    expect(isBridgeLoad({ ...ok, files: [{ name: 'x', mime: 'y', base64: '' }] })).toBe(false);
    expect(isBridgeLoad(null)).toBe(false);
  });

  it('round-trips bytes through base64, including large buffers', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('strips paths and control characters from file names', () => {
    expect(safeFileName('C:\\x\\menu.pdf')).toBe('menu.pdf');
    expect(safeFileName('../../a/b.png')).toBe('b.png');
    expect(safeFileName('a\u0001b.jpg')).toBe('ab.jpg');
  });
});
