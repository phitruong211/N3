// Fill APIs that older Safari/Chrome lack (or that only exist on HTTPS) so sign-up and login work everywhere.

if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  // randomUUID is missing before Safari 15.4 / Chrome 92 and on non-HTTPS pages; getRandomValues works on both.
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true, writable: true,
    value: () => {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  });
}

if (typeof AbortSignal !== 'undefined' && !AbortSignal.prototype.throwIfAborted) {
  AbortSignal.prototype.throwIfAborted = function (this: AbortSignal) {
    if (this.aborted) throw this.reason ?? new DOMException('Aborted', 'AbortError');
  };
}

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    configurable: true, writable: true,
    value(this: unknown[], i: number) { const n = Math.trunc(i) || 0; return this[n < 0 ? this.length + n : n]; },
  });
}
if (!String.prototype.at) {
  Object.defineProperty(String.prototype, 'at', {
    configurable: true, writable: true,
    value(this: string, i: number) { const n = Math.trunc(i) || 0; return this[n < 0 ? this.length + n : n]; },
  });
}
