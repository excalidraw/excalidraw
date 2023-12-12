const polyfill = () => {
  if (!Array.prototype.at) {
    // Taken from https://github.com/tc39/proposal-relative-indexing-method#polyfill so that it works in tests
    /* eslint-disable */
    Object.defineProperty(Array.prototype, "at", {
      value: function (n: number) {
        // ToInteger() abstract op
        n = Math.trunc(n) || 0;
        // Allow negative indexing from the end
        if (n < 0) {
          n += this.length;
        }
        // OOB access is guaranteed to return undefined
        if (n < 0 || n >= this.length) {
          return undefined;
        }
        // Otherwise, this is just normal property access
        return this[n];
      },
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }

  if (!Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function (...nodes) {
      this.innerHTML = "";
      this.append(...nodes);
    };
  }
};
export default polyfill;
