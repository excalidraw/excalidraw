export interface Block {
  w: number;
  h: number;
  fit?: TreeNode | null;
}

export interface TreeNode {
  x: number;
  y: number;
  w: number;
  h: number;
  used?: boolean;
  down?: TreeNode;
  right?: TreeNode;
}

/**
 * Growth packer based on https://github.com/jakesgordon/bin-packing/tree/master
 *
 * Added support to adding gaps to the packing by @feng94
 */
export class GrowingPacker {
  root: TreeNode | null;
  gap: number;

  constructor(gap = 0) {
    this.root = null;
    this.gap = gap;
  }

  fit(blocks: Block[]): void {
    const len = blocks.length;
    const w = len > 0 ? blocks[0].w : 0;
    const h = len > 0 ? blocks[0].h : 0;
    this.root = { x: 0, y: 0, w, h };

    for (let n = 0; n < len; n++) {
      const block = blocks[n];
      const TreeNode = this.findNode(this.root, block.w, block.h);
      if (TreeNode) {
        block.fit = this.splitNode(TreeNode, block.w, block.h);
      } else {
        block.fit = this.growNode(block.w, block.h);
      }
    }
  }

  private findNode(
    root: TreeNode | null,
    w: number,
    h: number,
  ): TreeNode | null {
    if (!root) {
      return null;
    }
    if (root.used) {
      return (
        this.findNode(root.right || null, w, h) ||
        this.findNode(root.down || null, w, h)
      );
    } else if (w <= root.w && h <= root.h) {
      return root;
    }
    return null;
  }

  private splitNode(TreeNode: TreeNode, w: number, h: number): TreeNode {
    TreeNode.used = true;
    TreeNode.down = {
      x: TreeNode.x,
      y: TreeNode.y + h + this.gap,
      w: TreeNode.w,
      h: TreeNode.h - h - this.gap,
    };
    TreeNode.right = {
      x: TreeNode.x + w + this.gap,
      y: TreeNode.y,
      w: TreeNode.w - w - this.gap,
      h,
    };
    return TreeNode;
  }

  private growNode(w: number, h: number): TreeNode | null {
    if (!this.root) {
      return null;
    }

    const canGrowDown = w <= this.root.w;
    const canGrowRight = h <= this.root.h;

    const shouldGrowRight =
      canGrowRight && this.root.h >= this.root.w + w + this.gap;
    const shouldGrowDown =
      canGrowDown && this.root.w >= this.root.h + h + this.gap;

    if (shouldGrowRight) {
      return this.growRight(w, h);
    } else if (shouldGrowDown) {
      return this.growDown(w, h);
    } else if (canGrowRight) {
      return this.growRight(w, h);
    } else if (canGrowDown) {
      return this.growDown(w, h);
    }
    return null;
  }

  private growRight(w: number, h: number): TreeNode | null {
    if (!this.root) {
      return null;
    }

    this.root = {
      used: true,
      x: 0,
      y: 0,
      w: this.root.w + w + this.gap,
      h: this.root.h,
      down: this.root,
      right: { x: this.root.w + this.gap, y: 0, w, h: this.root.h },
    };

    const TreeNode = this.findNode(this.root, w, h);
    return TreeNode ? this.splitNode(TreeNode, w, h) : null;
  }

  private growDown(w: number, h: number): TreeNode | null {
    if (!this.root) {
      return null;
    }

    this.root = {
      used: true,
      x: 0,
      y: 0,
      w: this.root.w,
      h: this.root.h + h + this.gap,
      down: { x: 0, y: this.root.h + this.gap, w: this.root.w, h },
      right: this.root,
    };

    const TreeNode = this.findNode(this.root, w, h);
    return TreeNode ? this.splitNode(TreeNode, w, h) : null;
  }
}
