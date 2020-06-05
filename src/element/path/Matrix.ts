function rad(deg: number) {
  return ((deg % 360) * Math.PI) / 180;
}

export default class Matrix {
  a: number = 1;
  b: number = 0;
  c: number = 0;
  d: number = 1;
  e: number = 0;
  f: number = 0;

  /*\
    * Matrix.add
    [ method ]
    **
    * Adds given matrix to existing one.
    > Parameters
    - a (number)
    - b (number)
    - c (number)
    - d (number)
    - e (number)
    - f (number)
    or
    - matrix (object) @Matrix
  \*/
  add(a: number, b: number, c: number, d: number, e: number, f: number) {
    const out: [number?, number?, number?][] = [[], [], []];
    const m = [
      [this.a, this.c, this.e],
      [this.b, this.d, this.f],
      [0, 0, 1],
    ];
    const matrix = [
      [a, c, e],
      [b, d, f],
      [0, 0, 1],
    ];

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        let res = 0;
        for (let z = 0; z < 3; z++) {
          res += m[x][z] * matrix[z][y];
        }
        out[x][y] = res;
      }
    }

    this.a = out[0][0] as number;
    this.b = out[1][0] as number;
    this.c = out[0][1] as number;
    this.d = out[1][1] as number;
    this.e = out[0][2] as number;
    this.f = out[1][2] as number;
  }
  /*\
    * Matrix.translate
    [ method ]
    **
    * Translate the matrix
    > Parameters
    - x (number)
    - y (number)
  \*/
  translate(x: number, y: number) {
    this.add(1, 0, 0, 1, x, y);
  }
  /*\
    * Matrix.rotate
    [ method ]
    **
    * Rotates the matrix
    > Parameters
    - a (number)
    - x (number)
    - y (number)
  \*/
  rotate(a: number, x: number, y: number) {
    a = rad(a);
    x = x || 0;
    y = y || 0;
    const cos = +Math.cos(a).toFixed(9);
    const sin = +Math.sin(a).toFixed(9);

    this.add(cos, sin, -sin, cos, x, y);
    this.add(1, 0, 0, 1, -x, -y);
  }

  /*\
    * Matrix.x
    [ method ]
    **
    * Return x coordinate for given point after transformation described by the matrix. See also @Matrix.y
    > Parameters
    - x (number)
    - y (number)
    = (number) x
  \*/
  x(x: number, y: number) {
    return x * this.a + y * this.c + this.e;
  }
  /*\
    * Matrix.y
    [ method ]
    **
    * Return y coordinate for given point after transformation described by the matrix. See also @Matrix.x
    > Parameters
    - x (number)
    - y (number)
    = (number) y
  \*/
  y(x: number, y: number) {
    return x * this.b + y * this.d + this.f;
  }
}
