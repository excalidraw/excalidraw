import R from "./R";

/**
 * convert raphael's internal path representation (must be converted to curves before) to segments / bezier curves
 *
 * @returns array segments (path as a collection of segments)
 */
function generatePathSegments(path) {
  const segments = [];

  path.forEach((pathCommand, i) => {
    let seg = {
      items: [],
    };

    //if command is a moveto create new sub-path
    if (pathCommand[0] !== "M") {
      const prevCommand = path[i - 1];
      const prevCommandLength = prevCommand.length;

      seg = {
        items: [
          prevCommand[prevCommandLength - 2],
          prevCommand[prevCommandLength - 1],
          ...pathCommand.slice(1),
        ],
      };
    }

    //add empty segments for "moveto", because Raphael counts it when calculating interceptions
    if (i > 0) {
      segments.push(seg);
    }
  });

  return segments;
}

/**
 * mark the starting and ending points of all subpaths
 * to simplify later building of closed paths
 *
 * @params (a list of paths in segment representation)
 *
 * @returns void
 */
function markSubpathEndings(...pathSegments) {
  let subPaths = 0; //store overall number of existing subpaths (for id generation)

  pathSegments.forEach((segments) => {
    //iterate path segments
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const nextSeg = segments[i + 1];

      //first segment of a path has always starting point of subpath
      if (i === 0) {
        seg.startPoint = `S${subPaths}`;
      }

      //if ending point of a segment is different from starting  point of next seg. mark both
      if (i < segments.length - 1) {
        if (
          seg.items[6] !== nextSeg.items[0] ||
          seg.items[7] !== nextSeg.items[1]
        ) {
          seg.endPoint = `S${subPaths}`;
          subPaths++;
          nextSeg.startPoint = `S${subPaths}`;
        }
      }

      //if all coords of a segment are the same mark starting and ending point (RaphaelJS bug)

      //last segment of a path has always ending point of subpath
      if (i === segments.length - 1) {
        seg.endPoint = `S${subPaths}`;
        subPaths++;
      }
    }
  });
}

/**
 * execute the bool operation
 *
 * @param string type (name of the boolean operation)
 * @param array path1Segs (segment representation of path1)
 * @param array path2Segs (segment representation of path2)
 *
 * @return array newPath (segment representation of the resulting path)
 */
function operateBool(type, path1, path2) {
  const path1Segs = generatePathSegments(path1);
  const path2Segs = generatePathSegments(path2);

  markSubpathEndings(path1Segs, path2Segs);

  //get intersections of both paths
  var inters = getIntersections(path1, path2);

  //if any insert intersections into paths
  if (inters.length > 0) {
    insertIntersectionPoints(path1Segs, 1, inters);
    insertIntersectionPoints(path2Segs, 2, inters);
  }

  var newParts = buildNewPathParts(type, path1Segs, path2Segs);
  var indexes = buildPartIndexes(newParts);

  return buildNewPath(type, newParts, indexes.inversions, indexes.startIndex);
}

/**
 * convert a path array into path string
 *
 * @param arr pathArr
 *
 * @returns string
 */
var pathArrToStr = function (pathArr) {
  return pathArr.join(",").replace(/,?([achlmqrstvxz]),?/gi, "$1");
};

/**
 * Shortcut helper
 *
 * @returns string (path string)
 */
var pathSegsToStr = function (pathSegs) {
  return pathArrToStr(pathSegsToArr(pathSegs));
};

/**
 * convert segments / bezier curves representation of a path to raphael's internal path representation (svg commands as array)
 *
 * @param array pathSegs (path as a collection of segments)
 *
 * @returns array pathArr (RaphaelJS path array)
 */
var pathSegsToArr = function (segments) {
  var pathArr = [];

  segments.forEach((segment, i) => {
    //ignore empty segments
    if (segment.items.length === 0) {
      return;
    }

    const prevSegment = segments[i - 1];
    let command = [];
    //if start point of current segment is different from end point of previous segment add a new subpath
    if (
      i === 0 ||
      segment.items[0] !== prevSegment.items[prevSegment.items.length - 2] ||
      segment.items[1] !== prevSegment.items[prevSegment.items.length - 1]
    ) {
      command.push("M", segment.items[0], segment.items[1]);
      pathArr.push(command);
      command = [];
    }
    command.push("C");

    for (var j = 2; j < segment.items.length; j++) {
      command.push(segment.items[j]);
    }
    pathArr.push(command);
  });

  return pathArr;
};

/**
 * splits a segment of given path into two by using de Casteljau's algorithm (http://en.wikipedia.org/wiki/De_Casteljau%27s_algorithm - Geometric interpretation)
 *
 * @param array pathSegs (segment representation of a path returned by function pathArrToSegs)
 * @param int segNr (nr of the segment - starting with 1, like it is returned by Raphael.pathIntersection: segment1, segment2)
 *
 * @returns void
 */
function splitSegment(segments, segNr, t, newPoint, intersId) {
  const oldSeg = segments[segNr - 1];
  const { items } = oldSeg;

  //new anchor for start point of segment / bezier curve
  const newA1_1 = [
    items[0] + t * (items[2] - items[0]),
    items[1] + t * (items[3] - items[1]),
  ];
  //new anchor for end point of segment / bezier curve
  const newA2_2 = [
    items[4] + t * (items[6] - items[4]),
    items[5] + t * (items[7] - items[5]),
  ];

  //intermediate point between the two original anchors
  const iP = [
    items[2] + t * (items[4] - items[2]),
    items[3] + t * (items[5] - items[3]),
  ];

  //calculate anchors for the inserted point
  const newA1_2 = [
    newA1_1[0] + t * (iP[0] - newA1_1[0]),
    newA1_1[1] + t * (iP[1] - newA1_1[1]),
  ];
  const newA2_1 = [
    iP[0] + t * (newA2_2[0] - iP[0]),
    iP[1] + t * (newA2_2[1] - iP[1]),
  ];

  //set coordinates for new segments
  const newSeg1 = {
    items: [items[0], items[1], ...newA1_1, ...newA1_2, ...newPoint],
  };

  if (typeof oldSeg.startPoint !== undefined) {
    newSeg1.startPoint = oldSeg.startPoint;
  }
  newSeg1.endPoint = `I${intersId}`; //mark end point as intersection

  const newSeg2 = {
    items: [...newPoint, ...newA2_1, ...newA2_2, items[6], items[7]],
  };
  newSeg2.startPoint = `I${intersId}`; //mark start point as intersection
  if (typeof oldSeg.endPoint !== undefined) {
    newSeg2.endPoint = oldSeg.endPoint;
  }

  //insert new segments and replace the old one
  segments.splice(segNr - 1, 1, newSeg1, newSeg2);
}

/**
 * add points path given by intersections array
 *
 * @param array pathSegs (path in segement representation)
 * @param array inters (intersections returned by Raphael.pathIntersection)
 *
 * @returns void
 */
function insertIntersectionPoints(pathSegs, pathNr, inters) {
  inters.forEach((interI, i) => {
    let splits = 0;
    let t = interI[`t${pathNr}`];
    let t1 = 0;
    let t2 = 1;

    for (let j = 0; j <= i; j++) {
      const interJ = inters[j];

      //check if previous segments where splitted before (influences segment nr)
      if (interJ[`segment${pathNr}`] < interI[`segment${pathNr}`]) {
        splits++;
      }

      //check if currently affected segment was splitted before
      //this influences segment nr and t -> get nearest t1 (lower) and t2 (higher) for recalculation of t
      if (interJ[`segment${pathNr}`] === interI[`segment${pathNr}`]) {
        if (interJ[`t${pathNr}`] < t) {
          splits++;
          if (interJ[`t${pathNr}`] > t1) {
            t1 = interJ[`t${pathNr}`];
          }
        }

        if (interJ[`t${pathNr}`] > t && interJ[`t${pathNr}`] < t2) {
          t2 = interJ[`t${pathNr}`];
        }
      }
    }

    //recalculate t
    t = (t - t1) / (t2 - t1);

    //split intersected segments
    splitSegment(
      pathSegs,
      interI[`segment${pathNr}`] + splits,
      t,
      [interI.x, interI.y],
      i,
    );
  });
}

/**
 * checks wether a segment is inside a path by selecting the point at t = 0.5 (only works properly after inserting intersections)
 *
 * @param array seg (segment of a path)
 * @param string path (string representation of the [other] path)
 *
 * @returns bool
 */
var isSegInsidePath = function (segments, path) {
  //get point on segment (t = 0.5)
  var point = R.findDotsAtSegment(...[...segments, 0.5]);

  //is point inside of given path
  return R.isPointInsidePath(path, point.x, point.y);
};

/**
 * invert the coordinates of given segment array
 *
 * @param array segCoords (representing the coords of a segment, length = 7)
 *
 * @returns void
 */
var invertSeg = function (segCoords) {
  var tmp = JSON.parse(JSON.stringify(segCoords));
  segCoords[0] = tmp[6];
  segCoords[1] = tmp[7];
  segCoords[2] = tmp[4];
  segCoords[3] = tmp[5];
  segCoords[4] = tmp[2];
  segCoords[5] = tmp[3];
  segCoords[6] = tmp[0];
  segCoords[7] = tmp[1];

  //return [segCoords[6], segCoords[7], segCoords[4], segCoords[5], segCoords[2], segCoords[3], segCoords[0], segCoords[1]];
  //return segCoords;
};

/**
 * invert the given part (of a path), including coordinates in segments, starting and ending points
 *
 * @param array part
 *
 * returns void
 */
var invertPart = function (part) {
  const length = part.segments.length;
  const firstSegment = part.segments[0];
  const lastSegment = part.segments[length - 1];

  part.segments.map((segment) => invertSeg(segment.items));

  //invert order of segments
  part.segments.reverse();

  //switch starting and ending points
  var oldStartPoint = lastSegment.startPoint;
  firstSegment.startPoint = firstSegment.endPoint;
  if (length > 1) {
    delete firstSegment.endPoint;
  }

  lastSegment.endPoint = oldStartPoint;
  if (length > 1) {
    delete lastSegment.startPoint;
  }
};

/**
 * calculate the direction of the given path
 *
 * @param array pathSegArr (path array in segment representation)
 *
 * @returns int dir (1: clockwise, -1: counter clockwise)
 */
var getPathDirection = function (pathSegArr) {
  var dir = -1;
  var minT, maxT;

  //get y of path's starting point
  var startY = pathSegArr[0][1];

  //convert path to string
  var path = pathSegsToStr(pathSegArr);
  var box = R.pathDimensions(path);

  //"draw" a horizontal line from left to right at half height of path's bbox
  var lineY = box.y + box.height / 2;
  var line = `M${box.x},${lineY}L${box.x2},${lineY}`;

  //get intersections of line and path
  var inters = R.pathIntersection(line, path);

  //get intersections with extrema for t on line
  for (var i = 0; i < inters.length; i++) {
    if (minT === undefined || inters[i].t1 <= inters[minT].t1) {
      minT = i;
    }
    if (maxT === undefined || inters[i].t1 >= inters[maxT].t1) {
      maxT = i;
    }
  }

  //decide, if path is clockwise (1) or counter clockwise (-1)
  if (
    (startY < lineY && inters[minT].segment2 >= inters[maxT].segment2) ||
    (startY > lineY && inters[minT].segment2 <= inters[maxT].segment2)
  ) {
    //for path with only one segment compare t
    if (inters[minT].segment2 === inters[maxT].segment2) {
      if (
        (startY < lineY && inters[minT].t2 >= inters[maxT].t2) ||
        (startY > lineY && inters[minT].t2 <= inters[maxT].t2)
      ) {
        dir = 1;
      }
    } else {
      dir = 1;
    }
  }

  return dir;
};

/**
 * wrapper for RaphaelJS pathIntersection()
 * with filter for redundant intersections caused by
 * - self-intersection (path1 = path2)
 * - intersections that lies exactly in path points (path1 != path2; use strict mode!)
 *
 * @param string path1
 * @param string path2
 * @param bool strict (true: also assume intersections as obolete that are close segment's starting / ending points; use only when path1 != path2!)
 *
 * @returns array validInters (filtered path intersections calculated by Raphael.pathIntersections())
 */
function getIntersections(path1, path2) {
  const d = 0.1; //min. deviation to assume point as different from another
  const inters = R.pathIntersection(path1, path2);
  const validInters = [];
  let valid = true;

  //iterate all other intersections
  for (let i = 0; i < inters.length; i++) {
    const p = inters[i];
    valid = true;

    //iterate all valid intersections and check if point already exists, if not push to valid intersections
    if (validInters.length > 0) {
      for (let j = 1; j < validInters.length; j++) {
        if (
          Math.abs(validInters[j].x - p.x) < d &&
          Math.abs(validInters[j].y - p.y) < d
        ) {
          valid = false;
          break;
        }
      }
    }

    if (valid) {
      if ((1 - p.t1 < d || p.t1 < d) && (1 - p.t2 < d || p.t2 < d)) {
        valid = false;
      }
    }

    if (valid) {
      validInters.push(inters[i]);
    }
  }

  return validInters;
}

/**
 * collect the parts of the resulting path according to given rules for the type of boolean operation
 * a part is characterized as a bunch of segments - first and last segment hosts a sub-path starting / ending point or intersection point
 *
 * @param string type (type of boolean operation)
 * @param array path1Segs (path1 in segment representation)
 * @param array path1Segs (path2 in segment representation)
 *
 * @returns array newParts (array of arrays holding segments)
 */
function buildNewPathParts(type, path1Segs, path2Segs) {
  let IOSituationChecked = false;
  let insideOtherPath; //temporary flag
  let partNeeded = false;
  let newPathPart = { segments: [] };
  const newParts = [];

  /*
  Add-Part-to-new-Path-Rules:
    union:
    path1 - segment NOT inside path2
    path2 - segment NOT inside path1
    difference:
    path1 - segment NOT inside path2
    path2 - segment inside path1
    intersection:
    path1 - segment inside path2
    path2 - segment inside path1
  */
  const rules = {
    union: {
      0: false,
      1: false,
    },
    difference: {
      0: false,
      1: true,
    },
    intersection: {
      0: true,
      1: true,
    },
  };

  var paths = [
    {
      segs: path1Segs,
      nr: 1,
    },
    {
      segs: path2Segs,
      nr: 2,
    },
  ];

  //iterate both paths and collect parts that are needed according to rules
  for (let p = 0; p <= 1; p++) {
    const path = paths[p];

    for (let s = 0; s < path.segs.length; s++) {
      const segment = path.segs[s];
      const segCoords = segment.items;

      if (segCoords.length === 0) {
        continue;
      }
      if (!IOSituationChecked) {
        insideOtherPath = isSegInsidePath(
          segCoords,
          pathSegsToStr(paths[p ^ 1].segs),
        );

        IOSituationChecked = true;
        partNeeded = rules[type][p] === insideOtherPath;
      }

      //if conditions are satisfied add current segment to new part
      if (partNeeded) {
        newPathPart.segments.push(segment);
      }

      if (typeof segment.endPoint !== undefined) {
        if (partNeeded) {
          newPathPart.pathNr = path.nr;
          newParts.push(newPathPart);
        }
        newPathPart = { segments: [] };
        IOSituationChecked = false;
      }
    }
  }

  return newParts;
}

/**
 * build indexes of the given path parts in order to simplify the process of putting parts together to a new path
 *
 * @param array parts
 *
 * @returns object (holding indexes and information about inverted parts)
 */
function buildPartIndexes(parts) {
  var startIndex = {};
  var endIndex = {};
  var inversions = {
    1: 0,
    2: 0,
  }; //count inversions on parts formerly belonging to path with the particular number

  //iterate all parts of the new path and build indices of starting and ending points
  parts.forEach((part, i) => {
    const firstSegment = part.segments[0];
    const lastSegment = part.segments[part.segments.length - 1];

    //if starting point or ending point id already exists (and there are different) invert the part
    if (firstSegment.startPoint !== lastSegment.endPoint) {
      //part.pathNr == 2 &&
      if (
        typeof startIndex[firstSegment.startPoint.segments] !== undefined ||
        typeof endIndex[lastSegment.endPoint] !== undefined
      ) {
        //invert the segments
        invertPart(part);

        //count inversions
        inversions[part.pathNr]++;
        part.inverted = true;
      }
    }

    //save intersection id at starting point
    startIndex[firstSegment.startPoint] = i;
    endIndex[lastSegment.endPoint] = i;
  });

  return {
    inversions: inversions,
    startIndex: startIndex,
    endIndex: endIndex,
  };
};

/**
 * the final step: build a new path out of the given parts by putting together the appropriate starting end ending points
 *
 * @param string type (type of the boolean operation)
 * @param array parts (see buildNewPathParts())
 * @param object inversions (see buildPartIndexes())
 * @param array startIndex (see buildPartIndexes())
 *
 * @returns array resultPath (segment representation of the operation's resulting path)
 */
function buildNewPath(type, parts, inversions, startIndex) {
  var newPath = [];
  var dirCheck = []; //starting position of subpaths marked for a direction check

  //for union operation correct path directions where necessary
  if (type === "union") {
    //if inversions occured invert also other parts of the path (only where starting point = ending point)
    parts.forEach((part) => {
      if (
        inversions[part.pathNr] > 0 &&
        !part.inverted &&
        part[0].startPoint === part[part.length - 1].endPoint
      ) {
        invertPart(part);
      }
    });
  }

  //build new path as an array of (closed) sub-paths (segment representation)
  if (parts.length > 0) {
    let partsAdded = 0;
    let curPart = parts[0];
    let endPointId;
    let subPath = [];
    let firstStartPoint = curPart.segments[0].startPoint;

    while (partsAdded < parts.length) {
      const firstSegment = curPart.segments[0];
      const lastSegment = curPart.segments[curPart.segments.length - 1];

      //for difference operation prepare correction of path directions where necessary
      if (type === "difference") {
        //if part was belonging to path 2 and starting point = ending point (means part was a subpath of path2 and completely inside path1)
        if (
          curPart.pathNr === 2 &&
          firstSegment.startPoint === lastSegment.endPoint
        ) {
          dirCheck.push(newPath.length);
        }
      }

      subPath = subPath.concat(curPart);
      partsAdded++;
      endPointId = lastSegment.endPoint;
      curPart.added = true;

      if (endPointId !== firstStartPoint) {
        //path isn't closed yet
        curPart = parts[startIndex[endPointId]]; //new part to add is the one that has current ending point as starting point
      } else {
        //add subpath to new path and find part that hasn't been added yet to start a new sub-path
        newPath.push(subPath);
        subPath = [];

        for (let p = 1; p < parts.length; p++) {
          if (!parts[p].added) {
            curPart = parts[p];
            firstStartPoint = curPart.segments[0].startPoint;
            break;
          }
        }
      }
    }
  }

  //for difference operation correct path direction (by inverting sub-paths) where necessary
  if (type === "difference") {
    for (var i = 0; i < dirCheck.length; i++) {
      //inside which subpath is the subpath that has to be checked
      for (var o = 0; o < newPath.length; o++) {
        if (dirCheck[i] === o) {
          continue;
        }
        if (
          isSegInsidePath(newPath[dirCheck[i]][0], pathSegsToStr(newPath[o]))
        ) {
          var pathDirOut = getPathDirection(newPath[o]);
          var pathDirIn = getPathDirection(newPath[dirCheck[i]]);

          //if both subpaths have the same direction invert the inner path
          if (pathDirIn === pathDirOut) {
            invertPart(newPath[dirCheck[i]]);
          }
        }
      }
    }
  }

  //flatten new path
  return newPath.reduce((acc, path) => {
    return acc.concat(...path.map(({ segments }) => segments));
  }, []);
}

/**
 * perform a union of the two given paths
 *
 * @param object el1 (RaphaelJS element)
 * @param object el2 (RaphaelJS element)
 *
 * @returns string (path string)
 */
export function union(path1, path2) {
  return pathSegsToStr(operateBool("union", path1, path2));
}

/**
 * perform a difference of the two given paths
 *
 * @param object el1 (RaphaelJS element)
 * @param object el2 (RaphaelJS element)
 *
 * @returns string (path string)
 */
export function difference(path1, path2) {
  return pathSegsToStr(operateBool("difference", path1, path2));
}

/**
 * perform an intersection of the two given paths
 *
 * @param object el1 (RaphaelJS element)
 * @param object el2 (RaphaelJS element)
 *
 * @returns string (path string)
 */
export function intersection(path1, path2) {
  return pathSegsToStr(operateBool("intersection", path1, path2));
}

/**
 * perform an exclusion of the two given paths -> A Exclusion B = (A Union B) Difference (A Intersection B)
 *
 * @param object el1 (RaphaelJS element)
 * @param object el2 (RaphaelJS element)
 *
 * @returns string (path string)
 */
export function exclusion(path1, path2) {
  return pathSegsToStr(
    operateBool(
      "difference",
      operateBool("union", path1, path2),
      operateBool("intersection", path1, path2),
    ),
  );
}
