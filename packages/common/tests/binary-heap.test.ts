import { BinaryHeap } from "../src/binary-heap";

describe("BinaryHeap", () => {
  const numberHeap = () => new BinaryHeap<number>((n) => n);

  const drain = (heap: BinaryHeap<number>) => {
    const out: number[] = [];
    while (heap.size() > 0) {
      out.push(heap.pop()!);
    }
    return out;
  };

  describe("empty heap", () => {
    it("has size 0", () => {
      expect(numberHeap().size()).toBe(0);
    });

    it("pop() returns null", () => {
      expect(numberHeap().pop()).toBe(null);
    });

    it("remove() is a no-op and does not throw", () => {
      const heap = numberHeap();
      expect(() => heap.remove(1)).not.toThrow();
      expect(heap.size()).toBe(0);
    });
  });

  describe("push / pop", () => {
    it("tracks size as items are added and removed", () => {
      const heap = numberHeap();
      [3, 1, 2].forEach((n) => heap.push(n));
      expect(heap.size()).toBe(3);

      heap.pop();
      expect(heap.size()).toBe(2);
    });

    it("pops a single pushed element back out", () => {
      const heap = numberHeap();
      heap.push(42);
      expect(heap.pop()).toBe(42);
      expect(heap.pop()).toBe(null);
    });

    it("always pops the smallest score first", () => {
      const heap = numberHeap();
      [5, 3, 8, 1, 9, 2, 7].forEach((n) => heap.push(n));
      expect(drain(heap)).toEqual([1, 2, 3, 5, 7, 8, 9]);
    });

    it("handles duplicate scores", () => {
      const heap = numberHeap();
      [4, 1, 4, 1, 2].forEach((n) => heap.push(n));
      expect(drain(heap)).toEqual([1, 1, 2, 4, 4]);
    });

    it("maintains the heap invariant for a large adversarial (reverse-sorted) input", () => {
      const heap = numberHeap();
      // pushing in descending order forces a sift-up on every insert
      const input = Array.from({ length: 1000 }, (_, i) => 1000 - i);
      input.forEach((n) => heap.push(n));
      expect(drain(heap)).toEqual([...input].sort((a, b) => a - b));
    });
  });

  describe("remove", () => {
    it("removes an interior element and keeps the rest ordered", () => {
      const heap = numberHeap();
      [5, 3, 8, 1, 9].forEach((n) => heap.push(n));

      heap.remove(8);

      expect(heap.size()).toBe(4);
      expect(drain(heap)).toEqual([1, 3, 5, 9]);
    });

    it("can remove the current minimum", () => {
      const heap = numberHeap();
      [5, 3, 8, 1, 9].forEach((n) => heap.push(n));

      heap.remove(1);

      expect(heap.size()).toBe(4);
      expect(heap.pop()).toBe(3);
    });
  });

  describe("rescoreElement", () => {
    type Node = { id: string; f: number };

    it("re-sorts a node after its score is lowered", () => {
      const heap = new BinaryHeap<Node>((node) => node.f);

      const a = { id: "a", f: 10 };
      const b = { id: "b", f: 20 };
      const c = { id: "c", f: 30 };
      [a, b, c].forEach((node) => heap.push(node));

      c.f = 5;
      heap.rescoreElement(c);

      expect(heap.pop()).toBe(c);
      expect(heap.pop()).toBe(a);
      expect(heap.pop()).toBe(b);
    });
  });
});
