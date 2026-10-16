import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { setAccessToken } from '../api/session';
import i18n from '../i18n';
import { unexpectedRequests } from './render';

// Pages are lazy and render behind the session check; give async queries time on slow runners.
configure({ asyncUtilTimeout: 20_000 });

// Every test starts signed out, in Ukrainian, with empty storage, and must not hit unmocked endpoints.
beforeEach(async () => {
  setAccessToken(null);
  localStorage.clear();
  unexpectedRequests.length = 0;
  await i18n.changeLanguage('uk');
});

afterEach(() => {
  vi.unstubAllGlobals();
  expect(unexpectedRequests, 'requests without a mock handler').toEqual([]);
});

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
