export class BinaryHeap<T> {
  private content: T[] = [];

  constructor(private scoreFunction: (node: T) => number) {}

  sinkDown(idx: number) {
    const node = this.content[idx];
    const nodeScore = this.scoreFunction(node);
    while (idx > 0) {
      const parentN = ((idx + 1) >> 1) - 1;
      const parent = this.content[parentN];
      if (nodeScore < this.scoreFunction(parent)) {
        this.content[idx] = parent;
        idx = parentN; // TODO: Optimize
      } else {
        break;
      }
    }
    this.content[idx] = node;
  }

  bubbleUp(idx: number) {
    const length = this.content.length;
    const node = this.content[idx];
    const score = this.scoreFunction(node);

    while (true) {
      const child1N = ((idx + 1) << 1) - 1;
      const child2N = child1N + 1;
      let smallestIdx = idx;
      let smallestScore = score;

      // Check left child
      if (child1N < length) {
        const child1Score = this.scoreFunction(this.content[child1N]);
        if (child1Score < smallestScore) {
          smallestIdx = child1N;
          smallestScore = child1Score;
        }
      }

      // Check right child
      if (child2N < length) {
        const child2Score = this.scoreFunction(this.content[child2N]);
        if (child2Score < smallestScore) {
          smallestIdx = child2N;
        }
      }

      if (smallestIdx === idx) {
        break;
      }

      // Move the smaller child up, continue finding position for node
      this.content[idx] = this.content[smallestIdx];
      idx = smallestIdx;
    }

    // Place node in its final position
    this.content[idx] = node;
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
