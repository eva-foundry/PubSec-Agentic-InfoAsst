import "@testing-library/jest-dom";
import "@/lib/i18n";

// matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// ResizeObserver / IntersectionObserver (Radix popovers, embla, recharts)
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const g = globalThis as unknown as Record<string, unknown>;
g.ResizeObserver = g.ResizeObserver ?? RO;
g.IntersectionObserver =
  g.IntersectionObserver ??
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  };

// Radix Select uses these — jsdom doesn't implement them
const elProto = Element.prototype as unknown as Record<string, unknown>;
if (!elProto.hasPointerCapture) {
  elProto.hasPointerCapture = () => false;
}
if (!elProto.setPointerCapture) {
  elProto.setPointerCapture = () => {};
}
if (!elProto.releasePointerCapture) {
  elProto.releasePointerCapture = () => {};
}
if (!elProto.scrollIntoView) {
  elProto.scrollIntoView = () => {};
}
const htmlElProto = HTMLElement.prototype as unknown as Record<string, unknown>;
if (!htmlElProto.scrollTo) {
  htmlElProto.scrollTo = () => {};
}

// clipboard
const nav = navigator as unknown as Record<string, unknown>;
if (!nav.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async () => {} },
    configurable: true,
  });
}
