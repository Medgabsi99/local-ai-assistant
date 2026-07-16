import '@testing-library/jest-dom';

// Mock localStorage for tests
const localStorageMock = {
  store: {},
  getItem: (key) => this.store[key] || null,
  setItem: (key, value) => {
    this.store[key] = value;
  },
  removeItem: (key) => {
    delete this.store[key];
  },
  clear: () => {
    this.store = {};
  },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
