class LocalStorageMock {
  private store: { [key: string]: string };
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: any) {
    this.store[key] = value;
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

export const localStorage = new LocalStorageMock();

// @ts-ignore
global.localStorage = localStorage;
// @ts-ignore
global.Storage.prototype.getItem = jest.fn((key: string) => {
  return localStorage.getItem(key);
});

// @ts-ignore
global.Storage.prototype.setItem = jest.fn((key: string, value: any) => {
  localStorage.setItem(key, value);
});

// @ts-ignore
global.Storage.prototype.clear = jest.fn(() => {
  localStorage.clear();
});

// @ts-ignore
global.Storage.prototype.removeItem = jest.fn((key: string) => {
  localStorage.removeItem(key);
});
