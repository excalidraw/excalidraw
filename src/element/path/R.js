const pathCommand = /([achlmrqstvz])[\s,]*((-?\d*\.?\d*(?:e[-+]?\d+)?[\s]*,?[\s]*)+)/gi;
const pathValues = /(-?\d*\.?\d*(?:e[-+]?\d+)?)[\s]*,?[\s]*/gi;
const notcurvepath = /,?([achlqrstvx]),?/i;

function findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
  var t1 = 1 - t;
  return {
    x:
      Math.pow(t1, 3) * p1x +
      Math.pow(t1, 2) * 3 * t * c1x +
      t1 * 3 * t * t * c2x +
      Math.pow(t, 3) * p2x,
    y:
      Math.pow(t1, 3) * p1y +
      Math.pow(t1, 2) * 3 * t * c1y +
      t1 * 3 * t * t * c2y +
      Math.pow(t, 3) * p2y,
  };
}

function curveDim(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {
  var a = c2x - 2 * c1x + p1x - (p2x - 2 * c2x + c1x),
    b = 2 * (c1x - p1x) - 2 * (c2x - c1x),
    c = p1x - c1x,
    t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / 2 / a,
    t2 = (-b - Math.sqrt(b * b - 4 * a * c)) / 2 / a,
    y = [p1y, p2y],
    x = [p1x, p2x],
    dot;
  Math.abs(t1) > "1e12" && (t1 = 0.5);
  Math.abs(t2) > "1e12" && (t2 = 0.5);
  if (t1 > 0 && t1 < 1) {
    dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t1);
    x.push(dot.x);
    y.push(dot.y);
  }
  if (t2 > 0 && t2 < 1) {
    dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t2);
    x.push(dot.x);
    y.push(dot.y);
  }
  a = c2y - 2 * c1y + p1y - (p2y - 2 * c2y + c1y);
  b = 2 * (c1y - p1y) - 2 * (c2y - c1y);
  c = p1y - c1y;
  t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / 2 / a;
  t2 = (-b - Math.sqrt(b * b - 4 * a * c)) / 2 / a;
  Math.abs(t1) > "1e12" && (t1 = 0.5);
  Math.abs(t2) > "1e12" && (t2 = 0.5);
  if (t1 > 0 && t1 < 1) {
    dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t1);
    x.push(dot.x);
    y.push(dot.y);
  }
  if (t2 > 0 && t2 < 1) {
    dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t2);
    x.push(dot.x);
    y.push(dot.y);
  }
  return {
    min: { x: Math.min.apply(0, x), y: Math.min.apply(0, y) },
    max: { x: Math.max.apply(0, x), y: Math.max.apply(0, y) },
  };
}

function bezierBBox(params) {
  var bbox = curveDim(...params);

  return {
    x: bbox.min.x,
    y: bbox.min.y,
    x2: bbox.max.x,
    y2: bbox.max.y,
    width: bbox.max.x - bbox.min.x,
    height: bbox.max.y - bbox.min.y,
  };
}

function isPointInsideBBox(bbox, x, y) {
  return x >= bbox.x && x <= bbox.x2 && y >= bbox.y && y <= bbox.y2;
}

function isBBoxIntersect(bbox1, bbox2) {
  return (
    isPointInsideBBox(bbox2, bbox1.x, bbox1.y) ||
    isPointInsideBBox(bbox2, bbox1.x2, bbox1.y) ||
    isPointInsideBBox(bbox2, bbox1.x, bbox1.y2) ||
    isPointInsideBBox(bbox2, bbox1.x2, bbox1.y2) ||
    isPointInsideBBox(bbox1, bbox2.x, bbox2.y) ||
    isPointInsideBBox(bbox1, bbox2.x2, bbox2.y) ||
    isPointInsideBBox(bbox1, bbox2.x, bbox2.y2) ||
    isPointInsideBBox(bbox1, bbox2.x2, bbox2.y2) ||
    (((bbox1.x < bbox2.x2 && bbox1.x > bbox2.x) ||
      (bbox2.x < bbox1.x2 && bbox2.x > bbox1.x)) &&
      ((bbox1.y < bbox2.y2 && bbox1.y > bbox2.y) ||
        (bbox2.y < bbox1.y2 && bbox2.y > bbox1.y)))
  );
}

function base3(t, p1, p2, p3, p4) {
  var t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4,
    t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3;
  return t * t2 - 3 * p1 + 3 * p2;
}

function bezlen(x1, y1, x2, y2, x3, y3, x4, y4, z) {
  if (z == null) {
    z = 1;
  }
  z = z > 1 ? 1 : z < 0 ? 0 : z;
  var z2 = z / 2,
    n = 12,
    Tvalues = [
      -0.1252,
      0.1252,
      -0.3678,
      0.3678,
      -0.5873,
      0.5873,
      -0.7699,
      0.7699,
      -0.9041,
      0.9041,
      -0.9816,
      0.9816,
    ],
    Cvalues = [
      0.2491,
      0.2491,
      0.2335,
      0.2335,
      0.2032,
      0.2032,
      0.1601,
      0.1601,
      0.1069,
      0.1069,
      0.0472,
      0.0472,
    ],
    sum = 0;
  for (var i = 0; i < n; i++) {
    var ct = z2 * Tvalues[i] + z2,
      xbase = base3(ct, x1, x2, x3, x4),
      ybase = base3(ct, y1, y2, y3, y4),
      comb = xbase * xbase + ybase * ybase;
    sum += Cvalues[i] * Math.sqrt(comb);
  }
  return z2 * sum;
}

function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  if (
    Math.max(x1, x2) < Math.min(x3, x4) ||
    Math.min(x1, x2) > Math.max(x3, x4) ||
    Math.max(y1, y2) < Math.min(y3, y4) ||
    Math.min(y1, y2) > Math.max(y3, y4)
  ) {
    return;
  }
  var nx = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4),
    ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4),
    denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (!denominator) {
    return;
  }
  var px = nx / denominator,
    py = ny / denominator,
    px2 = +px.toFixed(2),
    py2 = +py.toFixed(2);
  if (
    px2 < +Math.min(x1, x2).toFixed(2) ||
    px2 > +Math.max(x1, x2).toFixed(2) ||
    px2 < +Math.min(x3, x4).toFixed(2) ||
    px2 > +Math.max(x3, x4).toFixed(2) ||
    py2 < +Math.min(y1, y2).toFixed(2) ||
    py2 > +Math.max(y1, y2).toFixed(2) ||
    py2 < +Math.min(y3, y4).toFixed(2) ||
    py2 > +Math.max(y3, y4).toFixed(2)
  ) {
    return;
  }
  return { x: px, y: py };
}

function interHelper(bez1, bez2) {
  var bbox1 = bezierBBox(bez1),
    bbox2 = bezierBBox(bez2);

  if (!isBBoxIntersect(bbox1, bbox2)) {
    return [];
  }

  var l1 = bezlen.apply(0, bez1),
    l2 = bezlen.apply(0, bez2),
    n1 = Math.max(~~(l1 / 5), 1),
    n2 = Math.max(~~(l2 / 5), 1),
    dots1 = [],
    dots2 = [],
    xy = {},
    res = [];
  for (var i = 0; i < n1 + 1; i++) {
    var p = findDotsAtSegment(...bez1.concat(i / n1));
    dots1.push({ x: p.x, y: p.y, t: i / n1 });
  }
  for (i = 0; i < n2 + 1; i++) {
    p = findDotsAtSegment(...bez2.concat(i / n2));
    dots2.push({ x: p.x, y: p.y, t: i / n2 });
  }
  for (i = 0; i < n1; i++) {
    for (var j = 0; j < n2; j++) {
      var di = dots1[i],
        di1 = dots1[i + 1],
        dj = dots2[j],
        dj1 = dots2[j + 1],
        ci = Math.abs(di1.x - di.x) < 0.001 ? "y" : "x",
        cj = Math.abs(dj1.x - dj.x) < 0.001 ? "y" : "x",
        is = intersect(di.x, di.y, di1.x, di1.y, dj.x, dj.y, dj1.x, dj1.y);
      if (is) {
        if (xy[is.x.toFixed(4)] === is.y.toFixed(4)) {
          continue;
        }
        xy[is.x.toFixed(4)] = is.y.toFixed(4);
        var t1 =
            di.t +
            Math.abs((is[ci] - di[ci]) / (di1[ci] - di[ci])) * (di1.t - di.t),
          t2 =
            dj.t +
            Math.abs((is[cj] - dj[cj]) / (dj1[cj] - dj[cj])) * (dj1.t - dj.t);
        if (t1 >= 0 && t1 <= 1.001 && t2 >= 0 && t2 <= 1.001) {
          res.push({
            x: is.x,
            y: is.y,
            t1: Math.min(t1, 1),
            t2: Math.min(t2, 1),
          });
        }
      }
    }
  }

  return res;
}

function l2c(x1, y1, x2, y2) {
  return [x1, y1, x2, y2, x2, y2];
}

// function pathToAbsolute(pathArray) {
//   var pth = paths(pathArray);
//   if (!R.is(pathArray, array) || !R.is(pathArray && pathArray[0], array)) { // rough assumption
//       pathArray = R.parsePathString(pathArray);
//   }
//   if (!pathArray || !pathArray.length) {
//       return [["M", 0, 0]];
//   }
//   var res = [],
//       x = 0,
//       y = 0,
//       mx = 0,
//       my = 0,
//       start = 0;
//   if (pathArray[0][0] == "M") {
//       x = +pathArray[0][1];
//       y = +pathArray[0][2];
//       mx = x;
//       my = y;
//       start++;
//       res[0] = ["M", x, y];
//   }
//   var crz = pathArray.length == 3 && pathArray[0][0] == "M" && pathArray[1][0].toUpperCase() == "R" && pathArray[2][0].toUpperCase() == "Z";
//   for (var r, pa, i = start, ii = pathArray.length; i < ii; i++) {
//       res.push(r = []);
//       pa = pathArray[i];
//       if (pa[0] != upperCase.call(pa[0])) {
//           r[0] = upperCase.call(pa[0]);
//           switch (r[0]) {
//               case "A":
//                   r[1] = pa[1];
//                   r[2] = pa[2];
//                   r[3] = pa[3];
//                   r[4] = pa[4];
//                   r[5] = pa[5];
//                   r[6] = +(pa[6] + x);
//                   r[7] = +(pa[7] + y);
//                   break;
//               case "V":
//                   r[1] = +pa[1] + y;
//                   break;
//               case "H":
//                   r[1] = +pa[1] + x;
//                   break;
//               case "R":
//                   var dots = [x, y][concat](pa.slice(1));
//                   for (var j = 2, jj = dots.length; j < jj; j++) {
//                       dots[j] = +dots[j] + x;
//                       dots[++j] = +dots[j] + y;
//                   }
//                   res.pop();
//                   res = res[concat](catmullRom2bezier(dots, crz));
//                   break;
//               case "M":
//                   mx = +pa[1] + x;
//                   my = +pa[2] + y;
//               default:
//                   for (j = 1, jj = pa.length; j < jj; j++) {
//                       r[j] = +pa[j] + ((j % 2) ? x : y);
//                   }
//           }
//       } else if (pa[0] == "R") {
//           dots = [x, y][concat](pa.slice(1));
//           res.pop();
//           res = res[concat](catmullRom2bezier(dots, crz));
//           r = ["R"][concat](pa.slice(-2));
//       } else {
//           for (var k = 0, kk = pa.length; k < kk; k++) {
//               r[k] = pa[k];
//           }
//       }
//       switch (r[0]) {
//           case "Z":
//               x = mx;
//               y = my;
//               break;
//           case "H":
//               x = r[1];
//               break;
//           case "V":
//               y = r[1];
//               break;
//           case "M":
//               mx = r[r.length - 2];
//               my = r[r.length - 1];
//           default:
//               x = r[r.length - 2];
//               y = r[r.length - 1];
//       }
//   }
//   res.toString = R._path2string;
//   pth.abs = pathClone(res);
//   return res;
// }

function _path2curve(path) {
  var attrs = { x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null },
    processPath = function (path, d) {
      var tq = { T: 1, Q: 1 };
      if (!path) {
        return ["C", d.x, d.y, d.x, d.y, d.x, d.y];
      }
      !(path[0] in tq) && (d.qx = d.qy = null);
      switch (path[0]) {
        case "M":
          d.X = path[1];
          d.Y = path[2];
          break;
        case "L":
          path = ["C"].concat(l2c(d.x, d.y, path[1], path[2]));
          break;
        case "H":
          path = ["C"].concat(l2c(d.x, d.y, path[1], d.y));
          break;
        case "Z":
          path = ["C"].concat(l2c(d.x, d.y, d.X, d.Y));
          break;
        default:
      }
      return path;
    },
    pcoms1 = [], // path commands of original path p
    pfirst = "", // temporary holder for original path command
    pcom = ""; // holder for previous path command of original path
  for (var i = 0, ii = path.length; i < ii; i++) {
    path[i] && (pfirst = path[i][0]); // save current path command

    if (pfirst !== "C") {
      // C is not saved yet, because it may be result of conversion
      pcoms1[i] = pfirst; // Save current path command
      i && (pcom = pcoms1[i - 1]); // Get previous path command pcom
    }
    path[i] = processPath(path[i], attrs, pcom); // Previous path command is inputted to processPath

    if (pcoms1[i] !== "A" && pfirst === "C") {
      pcoms1[i] = "C";
    } // A is the only command
    // which may produce multiple C:s
    // so we have to make sure that C is also C in original path

    var seg = path[i],
      seglen = seg.length;
    attrs.x = seg[seglen - 2];
    attrs.y = seg[seglen - 1];
    attrs.bx = parseFloat(seg[seglen - 4]) || attrs.x;
    attrs.by = parseFloat(seg[seglen - 3]) || attrs.y;
  }
  return path;
}

function getTatLen(x1, y1, x2, y2, x3, y3, x4, y4, ll) {
  if (ll < 0 || bezlen(x1, y1, x2, y2, x3, y3, x4, y4) < ll) {
    return;
  }
  var t = 1,
    step = t / 2,
    t2 = t - step,
    l,
    e = 0.01;
  l = bezlen(x1, y1, x2, y2, x3, y3, x4, y4, t2);
  while (Math.abs(l - ll) > e) {
    step /= 2;
    t2 += (l < ll ? 1 : -1) * step;
    l = bezlen(x1, y1, x2, y2, x3, y3, x4, y4, t2);
  }
  return t2;
}

function getPointAtSegmentLength(
  p1x,
  p1y,
  c1x,
  c1y,
  c2x,
  c2y,
  p2x,
  p2y,
  length,
) {
  if (length == null) {
    return bezlen(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y);
  }
  return findDotsAtSegment(
    p1x,
    p1y,
    c1x,
    c1y,
    c2x,
    c2y,
    p2x,
    p2y,
    getTatLen(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, length),
  );
}

export function pathIntersection(path1, path2) {
  path1 = normalizePath(path1);
  path2 = normalizePath(path2);

  var x1,
    y1,
    x2,
    y2,
    x1m,
    y1m,
    x2m,
    y2m,
    bez1,
    bez2,
    res = [];

  for (var i = 0, ii = path1.length; i < ii; i++) {
    var pi = path1[i];
    if (pi[0] === "M") {
      x1 = x1m = pi[1];
      y1 = y1m = pi[2];
    } else {
      if (pi[0] === "C") {
        bez1 = [x1, y1].concat(pi.slice(1));
        x1 = bez1[6];
        y1 = bez1[7];
      } else {
        bez1 = [x1, y1, x1, y1, x1m, y1m, x1m, y1m];
        x1 = x1m;
        y1 = y1m;
      }
      for (var j = 0, jj = path2.length; j < jj; j++) {
        var pj = path2[j];
        if (pj[0] === "M") {
          x2 = x2m = pj[1];
          y2 = y2m = pj[2];
        } else {
          if (pj[0] === "C") {
            bez2 = [x2, y2].concat(pj.slice(1));
            x2 = bez2[6];
            y2 = bez2[7];
          } else {
            bez2 = [x2, y2, x2, y2, x2m, y2m, x2m, y2m];
            x2 = x2m;
            y2 = y2m;
          }

          var intr = interHelper(bez1, bez2);
          for (var k = 0, kk = intr.length; k < kk; k++) {
            intr[k].segment1 = i;
            intr[k].segment2 = j;
            intr[k].bez1 = bez1;
            intr[k].bez2 = bez2;
          }
          res = res.concat(intr);
        }
      }
    }
  }
  return res;
}

export function normalizePath(path) {
  if (typeof path === "string") {
    if (notcurvepath.test(path)) {
      return _path2curve(parsePathString(path));
    }

    return parsePathString(path);
  }

  return path;
}

export function parsePathString(pathString) {
  const paramCounts = {
    a: 7,
    c: 6,
    h: 1,
    l: 2,
    m: 2,
    r: 4,
    q: 4,
    s: 4,
    t: 2,
    v: 1,
    z: 0,
  };
  const data = [];

  if (!data.length) {
    pathString.replace(pathCommand, function (a, b, c) {
      var params = [],
        name = b.toLowerCase();
      c.replace(pathValues, function (a, b) {
        b && params.push(+b);
      });
      while (params.length >= paramCounts[name]) {
        data.push([b].concat(params.splice(0, paramCounts[name])));
        if (!paramCounts[name]) {
          break;
        }
      }
    });
  }

  return data;
}

export function isPointInsidePath(path, x, y) {
  var bbox = pathDimensions(path);

  return (
    isPointInsideBBox(bbox, x, y) &&
    // eslint-disable-next-line
    pathIntersection(path, _path2curve([["M", x, y], ["H", bbox.x2 + 10]])).length % 2 === 1
  );
}

export function findDotsAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
  var t1 = 1 - t,
    t13 = Math.pow(t1, 3),
    t12 = Math.pow(t1, 2),
    t2 = t * t,
    t3 = t2 * t,
    x = t13 * p1x + t12 * 3 * t * c1x + t1 * 3 * t * t * c2x + t3 * p2x,
    y = t13 * p1y + t12 * 3 * t * c1y + t1 * 3 * t * t * c2y + t3 * p2y,
    mx = p1x + 2 * t * (c1x - p1x) + t2 * (c2x - 2 * c1x + p1x),
    my = p1y + 2 * t * (c1y - p1y) + t2 * (c2y - 2 * c1y + p1y),
    nx = c1x + 2 * t * (c2x - c1x) + t2 * (p2x - 2 * c2x + c1x),
    ny = c1y + 2 * t * (c2y - c1y) + t2 * (p2y - 2 * c2y + c1y),
    ax = t1 * p1x + t * c1x,
    ay = t1 * p1y + t * c1y,
    cx = t1 * c2x + t * p2x,
    cy = t1 * c2y + t * p2y,
    alpha = 90 - (Math.atan2(mx - nx, my - ny) * 180) / Math.PI;
  (mx > nx || my < ny) && (alpha += 180);
  return {
    x: x,
    y: y,
    m: { x: mx, y: my },
    n: { x: nx, y: ny },
    start: { x: ax, y: ay },
    end: { x: cx, y: cy },
    alpha: alpha,
  };
}

export function pathDimensions(path) {
  path = normalizePath(path);

  var x = 0,
    y = 0,
    X = [],
    Y = [],
    p;
  for (var i = 0, ii = path.length; i < ii; i++) {
    p = path[i];
    if (p[0] === "M") {
      x = p[1];
      y = p[2];
      X.push(x);
      Y.push(y);
    } else {
      var dim = curveDim(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);
      X = X.concat(dim.min.x, dim.max.x);
      Y = Y.concat(dim.min.y, dim.max.y);
      x = p[5];
      y = p[6];
    }
  }
  var xmin = Math.min.apply(0, X),
    ymin = Math.min.apply(0, Y),
    xmax = Math.max.apply(0, X),
    ymax = Math.max.apply(0, Y),
    width = xmax - xmin,
    height = ymax - ymin,
    bb = {
      x: xmin,
      y: ymin,
      x2: xmax,
      y2: ymax,
      width: width,
      height: height,
      cx: xmin + width / 2,
      cy: ymin + height / 2,
    };
  return bb;
}

export function getTotalLength(path, length) {
  var x,
    y,
    p,
    l,
    len = 0;

  for (var i = 0, ii = path.length; i < ii; i++) {
    p = path[i];
    if (p[0] === "M") {
      x = +p[1];
      y = +p[2];
    } else {
      l = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);
      len += l;
      x = +p[5];
      y = +p[6];
    }
  }

  return len;
}
export function getPointAtLength(path, length) {
  var x,
    y,
    p,
    l,
    point,
    len = 0;
  for (var i = 0, ii = path.length; i < ii; i++) {
    p = path[i];
    if (p[0] === "M") {
      x = +p[1];
      y = +p[2];
    } else {
      l = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);
      if (len + l > length) {
        point = getPointAtSegmentLength(
          x,
          y,
          p[1],
          p[2],
          p[3],
          p[4],
          p[5],
          p[6],
          length - len,
        );
        return { x: point.x, y: point.y, alpha: point.alpha };
      }
      len += l;
      x = +p[5];
      y = +p[6];
    }
  }
  point = findDotsAtSegment(x, y, p[0], p[1], p[2], p[3], p[4], p[5], 1);
  point.alpha && (point = { x: point.x, y: point.y, alpha: point.alpha });

  return point;
}
