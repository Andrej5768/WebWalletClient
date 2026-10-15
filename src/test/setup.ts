import '@testing-library/jest-dom/vitest';
import '../i18n';

// Mantine reads these browser APIs that jsdom does not implement.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;

// Mantine's autosize textarea listens to font loading, which jsdom does not implement.
if (!document.fonts) {
  Object.defineProperty(document, 'fonts', { value: new EventTarget() });
}

// Combobox keyboard navigation scrolls the active option into view.
Element.prototype.scrollIntoView = function scrollIntoView() {};
