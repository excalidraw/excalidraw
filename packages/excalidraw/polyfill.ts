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

  if (!Array.prototype.findLast) {
    Object.defineProperty(Array.prototype, "findLast", {
      value: function <T>(
        this: T[],
        predicate: (value: T, index: number, array: T[]) => unknown,
        thisArg?: unknown,
      ) {
        return this
          .slice()
          .reverse()
          .find((value, index) =>
            predicate.call(thisArg, value, this.length - index - 1, this),
          );
      },
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }

  if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, "findIndex", {
      value: function <T>(
        this: T[],
        predicate: (value: T, index: number, array: T[]) => unknown,
        thisArg?: unknown,
      ) {
        for (let index = 0; index < this.length; index++) {
          if (predicate.call(thisArg, this[index], index, this)) {
            return index;
          }
        }

        return -1;
      },
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }

  if (!Array.prototype.findLastIndex) {
    Object.defineProperty(Array.prototype, "findLastIndex", {
      value: function <T>(
        this: T[],
        predicate: (value: T, index: number, array: T[]) => unknown,
        thisArg?: unknown,
      ) {
        const index = this
          .slice()
          .reverse()
          .findIndex((value, index) =>
            predicate.call(thisArg, value, this.length - index - 1, this),
          );

        return index === -1 ? -1 : this.length - index - 1;
      },
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }

  if (!Array.prototype.toReversed) {
    Object.defineProperty(Array.prototype, "toReversed", {
      value: function <T>(this: T[]) {
        return this.slice().reverse();
      },
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }

  if (!Array.prototype.toSorted) {
    Object.defineProperty(Array.prototype, "toSorted", {
      value: function <T>(
        this: T[],
        compareFn?: (a: T, b: T) => number,
      ) {
        return this.slice().sort(compareFn);
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
