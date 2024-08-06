export default class BinaryHeap<T> {
  private content: T[] = [];

  constructor(private scoreFunction: (node: T) => number) {}

  sinkDown(idx: number) {
    const node = this.content[idx];
    while (idx > 0) {
      const parentN = ((idx + 1) >> 1) - 1;
      const parent = this.content[parentN];
      if (this.scoreFunction(node) < this.scoreFunction(parent)) {
        this.content[parentN] = node;
        this.content[idx] = parent;
        idx = parentN; // TODO: Optimize
      } else {
        break;
      }
    }
  }

  bubbleUp(idx: number) {
    const length = this.content.length;
    const node = this.content[idx];
    const score = this.scoreFunction(node);

    while (true) {
      const child2N = (idx + 1) << 1;
      const child1N = child2N - 1;
      let swap = null;
      let child1Score = 0;

      if (child1N < length) {
        const child1 = this.content[child1N];
        child1Score = this.scoreFunction(child1);
        if (child1Score < score) {
          swap = child1N;
        }
      }

      if (child2N < length) {
        const child2 = this.content[child2N];
        const child2Score = this.scoreFunction(child2);
        if (child2Score < (swap === null ? score : child1Score)) {
          swap = child2N;
        }
      }

      if (swap !== null) {
        this.content[idx] = this.content[swap];
        this.content[swap] = node;
        idx = swap; // TODO: Optimize
      } else {
        break;
      }
    }
  }

  push(node: T) {
    this.content.push(node);
    this.sinkDown(this.content.length - 1);
  }

  pop(): T | null {
    if (this.content.length === 0) {
      return null;
    }

    const result = this.content[0];
    const end = this.content.pop()!;

    if (this.content.length > 0) {
      this.content[0] = end;
      this.bubbleUp(0);
    }

    return result;
  }

  remove(node: T) {
    if (this.content.length === 0) {
      return;
    }

    const i = this.content.indexOf(node);
    const end = this.content.pop()!;

    if (i < this.content.length) {
      this.content[i] = end;

      if (this.scoreFunction(end) < this.scoreFunction(node)) {
        this.sinkDown(i);
      } else {
        this.bubbleUp(i);
      }
    }
  }

  size(): number {
    return this.content.length;
  }

  rescoreElement(node: T) {
    this.sinkDown(this.content.indexOf(node));
  }
}
