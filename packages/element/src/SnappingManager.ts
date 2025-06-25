import { TransformHandleDirection } from "./transformHandles";

type Atribs = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FixedBoxToDraw = {
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
};

export default class SnappingManager {
  private ObjAtribs: Atribs;
  private childAtribs: Atribs;
  private snapDist = 50;
  private fixedBoxToDraw: FixedBoxToDraw = {
    x: null,
    y: null,
    width: null,
    height: null,
  };
  private static Instance: SnappingManager;
  constructor() {
    this.childAtribs = {
      x: 0,
      y: 0,
      height: 0,
      width: 0,
    };
    this.ObjAtribs = {
      x: 0,
      y: 0,
      height: 0,
      width: 0,
    };
  }

  private isBetween(a: number, start: number, end: number) {
    return a > start && a < end;
  }

  public static getInstance(): SnappingManager {
    if (!SnappingManager.Instance) {
      SnappingManager.Instance = new SnappingManager();
    }
    return SnappingManager.Instance;
  }

  private getSnappingBools(): {
    n: boolean;
    e: boolean;
    w: boolean;
    s: boolean;
  } {
    return {
      n: this.isBetween(
        this.ObjAtribs.y,
        this.childAtribs.y - this.snapDist,
        this.childAtribs.y,
      ),
      e: this.isBetween(
        this.ObjAtribs.x + this.ObjAtribs.width,
        this.childAtribs.x + this.childAtribs.width,
        this.childAtribs.x + this.childAtribs.width + this.snapDist,
      ),
      w: this.isBetween(
        this.ObjAtribs.x,
        this.childAtribs.x - this.snapDist,
        this.childAtribs.x,
      ),
      s: this.isBetween(
        this.ObjAtribs.y + this.ObjAtribs.height,
        this.childAtribs.y + this.childAtribs.height,
        this.childAtribs.y + this.childAtribs.height + this.snapDist,
      ),
    };
  }

  setObjAtribs(x: number, y: number, width: number, height: number) {
    this.ObjAtribs = {
      x,
      y,
      width,
      height,
    };
  }

  setChildAtribs(x: number, y: number, width: number, height: number) {
    this.childAtribs = {
      x,
      y,
      width,
      height,
    };
  }

  snap(): FixedBoxToDraw {
    const bools = this.getSnappingBools();

    if (bools.e) {
      this.fixedBoxToDraw.width =
        this.childAtribs.x - this.ObjAtribs.x + this.childAtribs.width;
    } else {
      this.fixedBoxToDraw.width = null;
    }

    if (bools.s) {
      this.fixedBoxToDraw.height =
        this.childAtribs.y - this.ObjAtribs.y + this.childAtribs.height;
    } else {
      this.fixedBoxToDraw.height = null;
    }

    return this.fixedBoxToDraw;
  }
}
