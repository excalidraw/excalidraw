/**
 * @licstart The following is the entire license notice for the
 * JavaScript code in this page
 *
 * Copyright 2023 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @licend The above is the entire license notice for the
 * JavaScript code in this page
 */

(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = root.pdfjsLib = factory();
	else if(typeof define === 'function' && define.amd)
		define("pdfjs-dist/build/pdf", [], () => { return (root.pdfjsLib = factory()); });
	else if(typeof exports === 'object')
		exports["pdfjs-dist/build/pdf"] = root.pdfjsLib = factory();
	else
		root["pdfjs-dist/build/pdf"] = root.pdfjsLib = factory();
})(globalThis, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, exports) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.VerbosityLevel = exports.Util = exports.UnknownErrorException = exports.UnexpectedResponseException = exports.TextRenderingMode = exports.RenderingIntentFlag = exports.PromiseCapability = exports.PermissionFlag = exports.PasswordResponses = exports.PasswordException = exports.PageActionEventType = exports.OPS = exports.MissingPDFException = exports.MAX_IMAGE_SIZE_TO_CACHE = exports.LINE_FACTOR = exports.LINE_DESCENT_FACTOR = exports.InvalidPDFException = exports.ImageKind = exports.IDENTITY_MATRIX = exports.FormatError = exports.FeatureTest = exports.FONT_IDENTITY_MATRIX = exports.DocumentActionEventType = exports.CMapCompressionType = exports.BaseException = exports.BASELINE_FACTOR = exports.AnnotationType = exports.AnnotationReplyType = exports.AnnotationPrefix = exports.AnnotationMode = exports.AnnotationFlag = exports.AnnotationFieldFlag = exports.AnnotationEditorType = exports.AnnotationEditorPrefix = exports.AnnotationEditorParamsType = exports.AnnotationBorderStyleType = exports.AnnotationActionEventType = exports.AbortException = void 0;
exports.assert = assert;
exports.bytesToString = bytesToString;
exports.createValidAbsoluteUrl = createValidAbsoluteUrl;
exports.getModificationDate = getModificationDate;
exports.getUuid = getUuid;
exports.getVerbosityLevel = getVerbosityLevel;
exports.info = info;
exports.isArrayBuffer = isArrayBuffer;
exports.isArrayEqual = isArrayEqual;
exports.isNodeJS = void 0;
exports.normalizeUnicode = normalizeUnicode;
exports.objectFromMap = objectFromMap;
exports.objectSize = objectSize;
exports.setVerbosityLevel = setVerbosityLevel;
exports.shadow = shadow;
exports.string32 = string32;
exports.stringToBytes = stringToBytes;
exports.stringToPDFString = stringToPDFString;
exports.stringToUTF8String = stringToUTF8String;
exports.unreachable = unreachable;
exports.utf8StringToString = utf8StringToString;
exports.warn = warn;
const isNodeJS = typeof process === "object" && process + "" === "[object process]" && !process.versions.nw && !(process.versions.electron && process.type && process.type !== "browser");
exports.isNodeJS = isNodeJS;
const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];
exports.IDENTITY_MATRIX = IDENTITY_MATRIX;
const FONT_IDENTITY_MATRIX = [0.001, 0, 0, 0.001, 0, 0];
exports.FONT_IDENTITY_MATRIX = FONT_IDENTITY_MATRIX;
const MAX_IMAGE_SIZE_TO_CACHE = 10e6;
exports.MAX_IMAGE_SIZE_TO_CACHE = MAX_IMAGE_SIZE_TO_CACHE;
const LINE_FACTOR = 1.35;
exports.LINE_FACTOR = LINE_FACTOR;
const LINE_DESCENT_FACTOR = 0.35;
exports.LINE_DESCENT_FACTOR = LINE_DESCENT_FACTOR;
const BASELINE_FACTOR = LINE_DESCENT_FACTOR / LINE_FACTOR;
exports.BASELINE_FACTOR = BASELINE_FACTOR;
const RenderingIntentFlag = {
  ANY: 0x01,
  DISPLAY: 0x02,
  PRINT: 0x04,
  SAVE: 0x08,
  ANNOTATIONS_FORMS: 0x10,
  ANNOTATIONS_STORAGE: 0x20,
  ANNOTATIONS_DISABLE: 0x40,
  OPLIST: 0x100
};
exports.RenderingIntentFlag = RenderingIntentFlag;
const AnnotationMode = {
  DISABLE: 0,
  ENABLE: 1,
  ENABLE_FORMS: 2,
  ENABLE_STORAGE: 3
};
exports.AnnotationMode = AnnotationMode;
const AnnotationEditorPrefix = "pdfjs_internal_editor_";
exports.AnnotationEditorPrefix = AnnotationEditorPrefix;
const AnnotationEditorType = {
  DISABLE: -1,
  NONE: 0,
  FREETEXT: 3,
  STAMP: 13,
  INK: 15
};
exports.AnnotationEditorType = AnnotationEditorType;
const AnnotationEditorParamsType = {
  RESIZE: 1,
  CREATE: 2,
  FREETEXT_SIZE: 11,
  FREETEXT_COLOR: 12,
  FREETEXT_OPACITY: 13,
  INK_COLOR: 21,
  INK_THICKNESS: 22,
  INK_OPACITY: 23
};
exports.AnnotationEditorParamsType = AnnotationEditorParamsType;
const PermissionFlag = {
  PRINT: 0x04,
  MODIFY_CONTENTS: 0x08,
  COPY: 0x10,
  MODIFY_ANNOTATIONS: 0x20,
  FILL_INTERACTIVE_FORMS: 0x100,
  COPY_FOR_ACCESSIBILITY: 0x200,
  ASSEMBLE: 0x400,
  PRINT_HIGH_QUALITY: 0x800
};
exports.PermissionFlag = PermissionFlag;
const TextRenderingMode = {
  FILL: 0,
  STROKE: 1,
  FILL_STROKE: 2,
  INVISIBLE: 3,
  FILL_ADD_TO_PATH: 4,
  STROKE_ADD_TO_PATH: 5,
  FILL_STROKE_ADD_TO_PATH: 6,
  ADD_TO_PATH: 7,
  FILL_STROKE_MASK: 3,
  ADD_TO_PATH_FLAG: 4
};
exports.TextRenderingMode = TextRenderingMode;
const ImageKind = {
  GRAYSCALE_1BPP: 1,
  RGB_24BPP: 2,
  RGBA_32BPP: 3
};
exports.ImageKind = ImageKind;
const AnnotationType = {
  TEXT: 1,
  LINK: 2,
  FREETEXT: 3,
  LINE: 4,
  SQUARE: 5,
  CIRCLE: 6,
  POLYGON: 7,
  POLYLINE: 8,
  HIGHLIGHT: 9,
  UNDERLINE: 10,
  SQUIGGLY: 11,
  STRIKEOUT: 12,
  STAMP: 13,
  CARET: 14,
  INK: 15,
  POPUP: 16,
  FILEATTACHMENT: 17,
  SOUND: 18,
  MOVIE: 19,
  WIDGET: 20,
  SCREEN: 21,
  PRINTERMARK: 22,
  TRAPNET: 23,
  WATERMARK: 24,
  THREED: 25,
  REDACT: 26
};
exports.AnnotationType = AnnotationType;
const AnnotationReplyType = {
  GROUP: "Group",
  REPLY: "R"
};
exports.AnnotationReplyType = AnnotationReplyType;
const AnnotationFlag = {
  INVISIBLE: 0x01,
  HIDDEN: 0x02,
  PRINT: 0x04,
  NOZOOM: 0x08,
  NOROTATE: 0x10,
  NOVIEW: 0x20,
  READONLY: 0x40,
  LOCKED: 0x80,
  TOGGLENOVIEW: 0x100,
  LOCKEDCONTENTS: 0x200
};
exports.AnnotationFlag = AnnotationFlag;
const AnnotationFieldFlag = {
  READONLY: 0x0000001,
  REQUIRED: 0x0000002,
  NOEXPORT: 0x0000004,
  MULTILINE: 0x0001000,
  PASSWORD: 0x0002000,
  NOTOGGLETOOFF: 0x0004000,
  RADIO: 0x0008000,
  PUSHBUTTON: 0x0010000,
  COMBO: 0x0020000,
  EDIT: 0x0040000,
  SORT: 0x0080000,
  FILESELECT: 0x0100000,
  MULTISELECT: 0x0200000,
  DONOTSPELLCHECK: 0x0400000,
  DONOTSCROLL: 0x0800000,
  COMB: 0x1000000,
  RICHTEXT: 0x2000000,
  RADIOSINUNISON: 0x2000000,
  COMMITONSELCHANGE: 0x4000000
};
exports.AnnotationFieldFlag = AnnotationFieldFlag;
const AnnotationBorderStyleType = {
  SOLID: 1,
  DASHED: 2,
  BEVELED: 3,
  INSET: 4,
  UNDERLINE: 5
};
exports.AnnotationBorderStyleType = AnnotationBorderStyleType;
const AnnotationActionEventType = {
  E: "Mouse Enter",
  X: "Mouse Exit",
  D: "Mouse Down",
  U: "Mouse Up",
  Fo: "Focus",
  Bl: "Blur",
  PO: "PageOpen",
  PC: "PageClose",
  PV: "PageVisible",
  PI: "PageInvisible",
  K: "Keystroke",
  F: "Format",
  V: "Validate",
  C: "Calculate"
};
exports.AnnotationActionEventType = AnnotationActionEventType;
const DocumentActionEventType = {
  WC: "WillClose",
  WS: "WillSave",
  DS: "DidSave",
  WP: "WillPrint",
  DP: "DidPrint"
};
exports.DocumentActionEventType = DocumentActionEventType;
const PageActionEventType = {
  O: "PageOpen",
  C: "PageClose"
};
exports.PageActionEventType = PageActionEventType;
const VerbosityLevel = {
  ERRORS: 0,
  WARNINGS: 1,
  INFOS: 5
};
exports.VerbosityLevel = VerbosityLevel;
const CMapCompressionType = {
  NONE: 0,
  BINARY: 1
};
exports.CMapCompressionType = CMapCompressionType;
const OPS = {
  dependency: 1,
  setLineWidth: 2,
  setLineCap: 3,
  setLineJoin: 4,
  setMiterLimit: 5,
  setDash: 6,
  setRenderingIntent: 7,
  setFlatness: 8,
  setGState: 9,
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  clip: 29,
  eoClip: 30,
  beginText: 31,
  endText: 32,
  setCharSpacing: 33,
  setWordSpacing: 34,
  setHScale: 35,
  setLeading: 36,
  setFont: 37,
  setTextRenderingMode: 38,
  setTextRise: 39,
  moveText: 40,
  setLeadingMoveText: 41,
  setTextMatrix: 42,
  nextLine: 43,
  showText: 44,
  showSpacedText: 45,
  nextLineShowText: 46,
  nextLineSetSpacingShowText: 47,
  setCharWidth: 48,
  setCharWidthAndBounds: 49,
  setStrokeColorSpace: 50,
  setFillColorSpace: 51,
  setStrokeColor: 52,
  setStrokeColorN: 53,
  setFillColor: 54,
  setFillColorN: 55,
  setStrokeGray: 56,
  setFillGray: 57,
  setStrokeRGBColor: 58,
  setFillRGBColor: 59,
  setStrokeCMYKColor: 60,
  setFillCMYKColor: 61,
  shadingFill: 62,
  beginInlineImage: 63,
  beginImageData: 64,
  endInlineImage: 65,
  paintXObject: 66,
  markPoint: 67,
  markPointProps: 68,
  beginMarkedContent: 69,
  beginMarkedContentProps: 70,
  endMarkedContent: 71,
  beginCompat: 72,
  endCompat: 73,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  beginGroup: 76,
  endGroup: 77,
  beginAnnotation: 80,
  endAnnotation: 81,
  paintImageMaskXObject: 83,
  paintImageMaskXObjectGroup: 84,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintInlineImageXObjectGroup: 87,
  paintImageXObjectRepeat: 88,
  paintImageMaskXObjectRepeat: 89,
  paintSolidColorImageMask: 90,
  constructPath: 91
};
exports.OPS = OPS;
const PasswordResponses = {
  NEED_PASSWORD: 1,
  INCORRECT_PASSWORD: 2
};
exports.PasswordResponses = PasswordResponses;
let verbosity = VerbosityLevel.WARNINGS;
function setVerbosityLevel(level) {
  if (Number.isInteger(level)) {
    verbosity = level;
  }
}
function getVerbosityLevel() {
  return verbosity;
}
function info(msg) {
  if (verbosity >= VerbosityLevel.INFOS) {
    console.log(`Info: ${msg}`);
  }
}
function warn(msg) {
  if (verbosity >= VerbosityLevel.WARNINGS) {
    console.log(`Warning: ${msg}`);
  }
}
function unreachable(msg) {
  throw new Error(msg);
}
function assert(cond, msg) {
  if (!cond) {
    unreachable(msg);
  }
}
function _isValidProtocol(url) {
  switch (url?.protocol) {
    case "http:":
    case "https:":
    case "ftp:":
    case "mailto:":
    case "tel:":
      return true;
    default:
      return false;
  }
}
function createValidAbsoluteUrl(url, baseUrl = null, options = null) {
  if (!url) {
    return null;
  }
  try {
    if (options && typeof url === "string") {
      if (options.addDefaultProtocol && url.startsWith("www.")) {
        const dots = url.match(/\./g);
        if (dots?.length >= 2) {
          url = `http://${url}`;
        }
      }
      if (options.tryConvertEncoding) {
        try {
          url = stringToUTF8String(url);
        } catch {}
      }
    }
    const absoluteUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);
    if (_isValidProtocol(absoluteUrl)) {
      return absoluteUrl;
    }
  } catch {}
  return null;
}
function shadow(obj, prop, value, nonSerializable = false) {
  Object.defineProperty(obj, prop, {
    value,
    enumerable: !nonSerializable,
    configurable: true,
    writable: false
  });
  return value;
}
const BaseException = function BaseExceptionClosure() {
  function BaseException(message, name) {
    if (this.constructor === BaseException) {
      unreachable("Cannot initialize BaseException.");
    }
    this.message = message;
    this.name = name;
  }
  BaseException.prototype = new Error();
  BaseException.constructor = BaseException;
  return BaseException;
}();
exports.BaseException = BaseException;
class PasswordException extends BaseException {
  constructor(msg, code) {
    super(msg, "PasswordException");
    this.code = code;
  }
}
exports.PasswordException = PasswordException;
class UnknownErrorException extends BaseException {
  constructor(msg, details) {
    super(msg, "UnknownErrorException");
    this.details = details;
  }
}
exports.UnknownErrorException = UnknownErrorException;
class InvalidPDFException extends BaseException {
  constructor(msg) {
    super(msg, "InvalidPDFException");
  }
}
exports.InvalidPDFException = InvalidPDFException;
class MissingPDFException extends BaseException {
  constructor(msg) {
    super(msg, "MissingPDFException");
  }
}
exports.MissingPDFException = MissingPDFException;
class UnexpectedResponseException extends BaseException {
  constructor(msg, status) {
    super(msg, "UnexpectedResponseException");
    this.status = status;
  }
}
exports.UnexpectedResponseException = UnexpectedResponseException;
class FormatError extends BaseException {
  constructor(msg) {
    super(msg, "FormatError");
  }
}
exports.FormatError = FormatError;
class AbortException extends BaseException {
  constructor(msg) {
    super(msg, "AbortException");
  }
}
exports.AbortException = AbortException;
function bytesToString(bytes) {
  if (typeof bytes !== "object" || bytes?.length === undefined) {
    unreachable("Invalid argument for bytesToString");
  }
  const length = bytes.length;
  const MAX_ARGUMENT_COUNT = 8192;
  if (length < MAX_ARGUMENT_COUNT) {
    return String.fromCharCode.apply(null, bytes);
  }
  const strBuf = [];
  for (let i = 0; i < length; i += MAX_ARGUMENT_COUNT) {
    const chunkEnd = Math.min(i + MAX_ARGUMENT_COUNT, length);
    const chunk = bytes.subarray(i, chunkEnd);
    strBuf.push(String.fromCharCode.apply(null, chunk));
  }
  return strBuf.join("");
}
function stringToBytes(str) {
  if (typeof str !== "string") {
    unreachable("Invalid argument for stringToBytes");
  }
  const length = str.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; ++i) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}
function string32(value) {
  return String.fromCharCode(value >> 24 & 0xff, value >> 16 & 0xff, value >> 8 & 0xff, value & 0xff);
}
function objectSize(obj) {
  return Object.keys(obj).length;
}
function objectFromMap(map) {
  const obj = Object.create(null);
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}
function isLittleEndian() {
  const buffer8 = new Uint8Array(4);
  buffer8[0] = 1;
  const view32 = new Uint32Array(buffer8.buffer, 0, 1);
  return view32[0] === 1;
}
function isEvalSupported() {
  try {
    new Function("");
    return true;
  } catch {
    return false;
  }
}
class FeatureTest {
  static get isLittleEndian() {
    return shadow(this, "isLittleEndian", isLittleEndian());
  }
  static get isEvalSupported() {
    return shadow(this, "isEvalSupported", isEvalSupported());
  }
  static get isOffscreenCanvasSupported() {
    return shadow(this, "isOffscreenCanvasSupported", typeof OffscreenCanvas !== "undefined");
  }
  static get platform() {
    if (typeof navigator === "undefined") {
      return shadow(this, "platform", {
        isWin: false,
        isMac: false
      });
    }
    return shadow(this, "platform", {
      isWin: navigator.platform.includes("Win"),
      isMac: navigator.platform.includes("Mac")
    });
  }
  static get isCSSRoundSupported() {
    return shadow(this, "isCSSRoundSupported", globalThis.CSS?.supports?.("width: round(1.5px, 1px)"));
  }
}
exports.FeatureTest = FeatureTest;
const hexNumbers = [...Array(256).keys()].map(n => n.toString(16).padStart(2, "0"));
class Util {
  static makeHexColor(r, g, b) {
    return `#${hexNumbers[r]}${hexNumbers[g]}${hexNumbers[b]}`;
  }
  static scaleMinMax(transform, minMax) {
    let temp;
    if (transform[0]) {
      if (transform[0] < 0) {
        temp = minMax[0];
        minMax[0] = minMax[1];
        minMax[1] = temp;
      }
      minMax[0] *= transform[0];
      minMax[1] *= transform[0];
      if (transform[3] < 0) {
        temp = minMax[2];
        minMax[2] = minMax[3];
        minMax[3] = temp;
      }
      minMax[2] *= transform[3];
      minMax[3] *= transform[3];
    } else {
      temp = minMax[0];
      minMax[0] = minMax[2];
      minMax[2] = temp;
      temp = minMax[1];
      minMax[1] = minMax[3];
      minMax[3] = temp;
      if (transform[1] < 0) {
        temp = minMax[2];
        minMax[2] = minMax[3];
        minMax[3] = temp;
      }
      minMax[2] *= transform[1];
      minMax[3] *= transform[1];
      if (transform[2] < 0) {
        temp = minMax[0];
        minMax[0] = minMax[1];
        minMax[1] = temp;
      }
      minMax[0] *= transform[2];
      minMax[1] *= transform[2];
    }
    minMax[0] += transform[4];
    minMax[1] += transform[4];
    minMax[2] += transform[5];
    minMax[3] += transform[5];
  }
  static transform(m1, m2) {
    return [m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1], m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3], m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]];
  }
  static applyTransform(p, m) {
    const xt = p[0] * m[0] + p[1] * m[2] + m[4];
    const yt = p[0] * m[1] + p[1] * m[3] + m[5];
    return [xt, yt];
  }
  static applyInverseTransform(p, m) {
    const d = m[0] * m[3] - m[1] * m[2];
    const xt = (p[0] * m[3] - p[1] * m[2] + m[2] * m[5] - m[4] * m[3]) / d;
    const yt = (-p[0] * m[1] + p[1] * m[0] + m[4] * m[1] - m[5] * m[0]) / d;
    return [xt, yt];
  }
  static getAxialAlignedBoundingBox(r, m) {
    const p1 = this.applyTransform(r, m);
    const p2 = this.applyTransform(r.slice(2, 4), m);
    const p3 = this.applyTransform([r[0], r[3]], m);
    const p4 = this.applyTransform([r[2], r[1]], m);
    return [Math.min(p1[0], p2[0], p3[0], p4[0]), Math.min(p1[1], p2[1], p3[1], p4[1]), Math.max(p1[0], p2[0], p3[0], p4[0]), Math.max(p1[1], p2[1], p3[1], p4[1])];
  }
  static inverseTransform(m) {
    const d = m[0] * m[3] - m[1] * m[2];
    return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[4] * m[3]) / d, (m[4] * m[1] - m[5] * m[0]) / d];
  }
  static singularValueDecompose2dScale(m) {
    const transpose = [m[0], m[2], m[1], m[3]];
    const a = m[0] * transpose[0] + m[1] * transpose[2];
    const b = m[0] * transpose[1] + m[1] * transpose[3];
    const c = m[2] * transpose[0] + m[3] * transpose[2];
    const d = m[2] * transpose[1] + m[3] * transpose[3];
    const first = (a + d) / 2;
    const second = Math.sqrt((a + d) ** 2 - 4 * (a * d - c * b)) / 2;
    const sx = first + second || 1;
    const sy = first - second || 1;
    return [Math.sqrt(sx), Math.sqrt(sy)];
  }
  static normalizeRect(rect) {
    const r = rect.slice(0);
    if (rect[0] > rect[2]) {
      r[0] = rect[2];
      r[2] = rect[0];
    }
    if (rect[1] > rect[3]) {
      r[1] = rect[3];
      r[3] = rect[1];
    }
    return r;
  }
  static intersect(rect1, rect2) {
    const xLow = Math.max(Math.min(rect1[0], rect1[2]), Math.min(rect2[0], rect2[2]));
    const xHigh = Math.min(Math.max(rect1[0], rect1[2]), Math.max(rect2[0], rect2[2]));
    if (xLow > xHigh) {
      return null;
    }
    const yLow = Math.max(Math.min(rect1[1], rect1[3]), Math.min(rect2[1], rect2[3]));
    const yHigh = Math.min(Math.max(rect1[1], rect1[3]), Math.max(rect2[1], rect2[3]));
    if (yLow > yHigh) {
      return null;
    }
    return [xLow, yLow, xHigh, yHigh];
  }
  static bezierBoundingBox(x0, y0, x1, y1, x2, y2, x3, y3) {
    const tvalues = [],
      bounds = [[], []];
    let a, b, c, t, t1, t2, b2ac, sqrtb2ac;
    for (let i = 0; i < 2; ++i) {
      if (i === 0) {
        b = 6 * x0 - 12 * x1 + 6 * x2;
        a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
        c = 3 * x1 - 3 * x0;
      } else {
        b = 6 * y0 - 12 * y1 + 6 * y2;
        a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
        c = 3 * y1 - 3 * y0;
      }
      if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) < 1e-12) {
          continue;
        }
        t = -c / b;
        if (0 < t && t < 1) {
          tvalues.push(t);
        }
        continue;
      }
      b2ac = b * b - 4 * c * a;
      sqrtb2ac = Math.sqrt(b2ac);
      if (b2ac < 0) {
        continue;
      }
      t1 = (-b + sqrtb2ac) / (2 * a);
      if (0 < t1 && t1 < 1) {
        tvalues.push(t1);
      }
      t2 = (-b - sqrtb2ac) / (2 * a);
      if (0 < t2 && t2 < 1) {
        tvalues.push(t2);
      }
    }
    let j = tvalues.length,
      mt;
    const jlen = j;
    while (j--) {
      t = tvalues[j];
      mt = 1 - t;
      bounds[0][j] = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
      bounds[1][j] = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
    }
    bounds[0][jlen] = x0;
    bounds[1][jlen] = y0;
    bounds[0][jlen + 1] = x3;
    bounds[1][jlen + 1] = y3;
    bounds[0].length = bounds[1].length = jlen + 2;
    return [Math.min(...bounds[0]), Math.min(...bounds[1]), Math.max(...bounds[0]), Math.max(...bounds[1])];
  }
}
exports.Util = Util;
const PDFStringTranslateTable = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x2d8, 0x2c7, 0x2c6, 0x2d9, 0x2dd, 0x2db, 0x2da, 0x2dc, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x2022, 0x2020, 0x2021, 0x2026, 0x2014, 0x2013, 0x192, 0x2044, 0x2039, 0x203a, 0x2212, 0x2030, 0x201e, 0x201c, 0x201d, 0x2018, 0x2019, 0x201a, 0x2122, 0xfb01, 0xfb02, 0x141, 0x152, 0x160, 0x178, 0x17d, 0x131, 0x142, 0x153, 0x161, 0x17e, 0, 0x20ac];
function stringToPDFString(str) {
  if (str[0] >= "\xEF") {
    let encoding;
    if (str[0] === "\xFE" && str[1] === "\xFF") {
      encoding = "utf-16be";
    } else if (str[0] === "\xFF" && str[1] === "\xFE") {
      encoding = "utf-16le";
    } else if (str[0] === "\xEF" && str[1] === "\xBB" && str[2] === "\xBF") {
      encoding = "utf-8";
    }
    if (encoding) {
      try {
        const decoder = new TextDecoder(encoding, {
          fatal: true
        });
        const buffer = stringToBytes(str);
        return decoder.decode(buffer);
      } catch (ex) {
        warn(`stringToPDFString: "${ex}".`);
      }
    }
  }
  const strBuf = [];
  for (let i = 0, ii = str.length; i < ii; i++) {
    const code = PDFStringTranslateTable[str.charCodeAt(i)];
    strBuf.push(code ? String.fromCharCode(code) : str.charAt(i));
  }
  return strBuf.join("");
}
function stringToUTF8String(str) {
  return decodeURIComponent(escape(str));
}
function utf8StringToString(str) {
  return unescape(encodeURIComponent(str));
}
function isArrayBuffer(v) {
  return typeof v === "object" && v?.byteLength !== undefined;
}
function isArrayEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0, ii = arr1.length; i < ii; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}
function getModificationDate(date = new Date()) {
  const buffer = [date.getUTCFullYear().toString(), (date.getUTCMonth() + 1).toString().padStart(2, "0"), date.getUTCDate().toString().padStart(2, "0"), date.getUTCHours().toString().padStart(2, "0"), date.getUTCMinutes().toString().padStart(2, "0"), date.getUTCSeconds().toString().padStart(2, "0")];
  return buffer.join("");
}
class PromiseCapability {
  #settled = false;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = data => {
        this.#settled = true;
        resolve(data);
      };
      this.reject = reason => {
        this.#settled = true;
        reject(reason);
      };
    });
  }
  get settled() {
    return this.#settled;
  }
}
exports.PromiseCapability = PromiseCapability;
let NormalizeRegex = null;
let NormalizationMap = null;
function normalizeUnicode(str) {
  if (!NormalizeRegex) {
    NormalizeRegex = /([\u00a0\u00b5\u037e\u0eb3\u2000-\u200a\u202f\u2126\ufb00-\ufb04\ufb06\ufb20-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufba1\ufba4-\ufba9\ufbae-\ufbb1\ufbd3-\ufbdc\ufbde-\ufbe7\ufbea-\ufbf8\ufbfc-\ufbfd\ufc00-\ufc5d\ufc64-\ufcf1\ufcf5-\ufd3d\ufd88\ufdf4\ufdfa-\ufdfb\ufe71\ufe77\ufe79\ufe7b\ufe7d]+)|(\ufb05+)/gu;
    NormalizationMap = new Map([["ﬅ", "ſt"]]);
  }
  return str.replaceAll(NormalizeRegex, (_, p1, p2) => {
    return p1 ? p1.normalize("NFKC") : NormalizationMap.get(p2);
  });
}
function getUuid() {
  if (typeof crypto !== "undefined" && typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(32);
  if (typeof crypto !== "undefined" && typeof crypto?.getRandomValues === "function") {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < 32; i++) {
      buf[i] = Math.floor(Math.random() * 255);
    }
  }
  return bytesToString(buf);
}
const AnnotationPrefix = "pdfjs_internal_id_";
exports.AnnotationPrefix = AnnotationPrefix;

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.RenderTask = exports.PDFWorkerUtil = exports.PDFWorker = exports.PDFPageProxy = exports.PDFDocumentProxy = exports.PDFDocumentLoadingTask = exports.PDFDataRangeTransport = exports.LoopbackPort = exports.DefaultStandardFontDataFactory = exports.DefaultFilterFactory = exports.DefaultCanvasFactory = exports.DefaultCMapReaderFactory = void 0;
Object.defineProperty(exports, "SVGGraphics", ({
  enumerable: true,
  get: function () {
    return _displaySvg.SVGGraphics;
  }
}));
exports.build = void 0;
exports.getDocument = getDocument;
exports.version = void 0;
var _util = __w_pdfjs_require__(1);
var _annotation_storage = __w_pdfjs_require__(3);
var _display_utils = __w_pdfjs_require__(6);
var _font_loader = __w_pdfjs_require__(9);
var _displayNode_utils = __w_pdfjs_require__(10);
var _canvas = __w_pdfjs_require__(11);
var _worker_options = __w_pdfjs_require__(14);
var _message_handler = __w_pdfjs_require__(15);
var _metadata = __w_pdfjs_require__(16);
var _optional_content_config = __w_pdfjs_require__(17);
var _transport_stream = __w_pdfjs_require__(18);
var _displayFetch_stream = __w_pdfjs_require__(19);
var _displayNetwork = __w_pdfjs_require__(22);
var _displayNode_stream = __w_pdfjs_require__(23);
var _displaySvg = __w_pdfjs_require__(24);
var _xfa_text = __w_pdfjs_require__(25);
const DEFAULT_RANGE_CHUNK_SIZE = 65536;
const RENDERING_CANCELLED_TIMEOUT = 100;
const DELAYED_CLEANUP_TIMEOUT = 5000;
const DefaultCanvasFactory = _util.isNodeJS ? _displayNode_utils.NodeCanvasFactory : _display_utils.DOMCanvasFactory;
exports.DefaultCanvasFactory = DefaultCanvasFactory;
const DefaultCMapReaderFactory = _util.isNodeJS ? _displayNode_utils.NodeCMapReaderFactory : _display_utils.DOMCMapReaderFactory;
exports.DefaultCMapReaderFactory = DefaultCMapReaderFactory;
const DefaultFilterFactory = _util.isNodeJS ? _displayNode_utils.NodeFilterFactory : _display_utils.DOMFilterFactory;
exports.DefaultFilterFactory = DefaultFilterFactory;
const DefaultStandardFontDataFactory = _util.isNodeJS ? _displayNode_utils.NodeStandardFontDataFactory : _display_utils.DOMStandardFontDataFactory;
exports.DefaultStandardFontDataFactory = DefaultStandardFontDataFactory;
function getDocument(src) {
  if (typeof src === "string" || src instanceof URL) {
    src = {
      url: src
    };
  } else if ((0, _util.isArrayBuffer)(src)) {
    src = {
      data: src
    };
  }
  if (typeof src !== "object") {
    throw new Error("Invalid parameter in getDocument, need parameter object.");
  }
  if (!src.url && !src.data && !src.range) {
    throw new Error("Invalid parameter object: need either .data, .range or .url");
  }
  const task = new PDFDocumentLoadingTask();
  const {
    docId
  } = task;
  const url = src.url ? getUrlProp(src.url) : null;
  const data = src.data ? getDataProp(src.data) : null;
  const httpHeaders = src.httpHeaders || null;
  const withCredentials = src.withCredentials === true;
  const password = src.password ?? null;
  const rangeTransport = src.range instanceof PDFDataRangeTransport ? src.range : null;
  const rangeChunkSize = Number.isInteger(src.rangeChunkSize) && src.rangeChunkSize > 0 ? src.rangeChunkSize : DEFAULT_RANGE_CHUNK_SIZE;
  let worker = src.worker instanceof PDFWorker ? src.worker : null;
  const verbosity = src.verbosity;
  const docBaseUrl = typeof src.docBaseUrl === "string" && !(0, _display_utils.isDataScheme)(src.docBaseUrl) ? src.docBaseUrl : null;
  const cMapUrl = typeof src.cMapUrl === "string" ? src.cMapUrl : null;
  const cMapPacked = src.cMapPacked !== false;
  const CMapReaderFactory = src.CMapReaderFactory || DefaultCMapReaderFactory;
  const standardFontDataUrl = typeof src.standardFontDataUrl === "string" ? src.standardFontDataUrl : null;
  const StandardFontDataFactory = src.StandardFontDataFactory || DefaultStandardFontDataFactory;
  const ignoreErrors = src.stopAtErrors !== true;
  const maxImageSize = Number.isInteger(src.maxImageSize) && src.maxImageSize > -1 ? src.maxImageSize : -1;
  const isEvalSupported = src.isEvalSupported !== false;
  const isOffscreenCanvasSupported = typeof src.isOffscreenCanvasSupported === "boolean" ? src.isOffscreenCanvasSupported : !_util.isNodeJS;
  const canvasMaxAreaInBytes = Number.isInteger(src.canvasMaxAreaInBytes) ? src.canvasMaxAreaInBytes : -1;
  const disableFontFace = typeof src.disableFontFace === "boolean" ? src.disableFontFace : _util.isNodeJS;
  const fontExtraProperties = src.fontExtraProperties === true;
  const enableXfa = src.enableXfa === true;
  const ownerDocument = src.ownerDocument || globalThis.document;
  const disableRange = src.disableRange === true;
  const disableStream = src.disableStream === true;
  const disableAutoFetch = src.disableAutoFetch === true;
  const pdfBug = src.pdfBug === true;
  const length = rangeTransport ? rangeTransport.length : src.length ?? NaN;
  const useSystemFonts = typeof src.useSystemFonts === "boolean" ? src.useSystemFonts : !_util.isNodeJS && !disableFontFace;
  const useWorkerFetch = typeof src.useWorkerFetch === "boolean" ? src.useWorkerFetch : CMapReaderFactory === _display_utils.DOMCMapReaderFactory && StandardFontDataFactory === _display_utils.DOMStandardFontDataFactory && cMapUrl && standardFontDataUrl && (0, _display_utils.isValidFetchUrl)(cMapUrl, document.baseURI) && (0, _display_utils.isValidFetchUrl)(standardFontDataUrl, document.baseURI);
  const canvasFactory = src.canvasFactory || new DefaultCanvasFactory({
    ownerDocument
  });
  const filterFactory = src.filterFactory || new DefaultFilterFactory({
    docId,
    ownerDocument
  });
  const styleElement = null;
  (0, _util.setVerbosityLevel)(verbosity);
  const transportFactory = {
    canvasFactory,
    filterFactory
  };
  if (!useWorkerFetch) {
    transportFactory.cMapReaderFactory = new CMapReaderFactory({
      baseUrl: cMapUrl,
      isCompressed: cMapPacked
    });
    transportFactory.standardFontDataFactory = new StandardFontDataFactory({
      baseUrl: standardFontDataUrl
    });
  }
  if (!worker) {
    const workerParams = {
      verbosity,
      port: _worker_options.GlobalWorkerOptions.workerPort
    };
    worker = workerParams.port ? PDFWorker.fromPort(workerParams) : new PDFWorker(workerParams);
    task._worker = worker;
  }
  const fetchDocParams = {
    docId,
    apiVersion: '3.11.174',
    data,
    password,
    disableAutoFetch,
    rangeChunkSize,
    length,
    docBaseUrl,
    enableXfa,
    evaluatorOptions: {
      maxImageSize,
      disableFontFace,
      ignoreErrors,
      isEvalSupported,
      isOffscreenCanvasSupported,
      canvasMaxAreaInBytes,
      fontExtraProperties,
      useSystemFonts,
      cMapUrl: useWorkerFetch ? cMapUrl : null,
      standardFontDataUrl: useWorkerFetch ? standardFontDataUrl : null
    }
  };
  const transportParams = {
    ignoreErrors,
    isEvalSupported,
    disableFontFace,
    fontExtraProperties,
    enableXfa,
    ownerDocument,
    disableAutoFetch,
    pdfBug,
    styleElement
  };
  worker.promise.then(function () {
    if (task.destroyed) {
      throw new Error("Loading aborted");
    }
    const workerIdPromise = _fetchDocument(worker, fetchDocParams);
    const networkStreamPromise = new Promise(function (resolve) {
      let networkStream;
      if (rangeTransport) {
        networkStream = new _transport_stream.PDFDataTransportStream({
          length,
          initialData: rangeTransport.initialData,
          progressiveDone: rangeTransport.progressiveDone,
          contentDispositionFilename: rangeTransport.contentDispositionFilename,
          disableRange,
          disableStream
        }, rangeTransport);
      } else if (!data) {
        const createPDFNetworkStream = params => {
          if (_util.isNodeJS) {
            return new _displayNode_stream.PDFNodeStream(params);
          }
          return (0, _display_utils.isValidFetchUrl)(params.url) ? new _displayFetch_stream.PDFFetchStream(params) : new _displayNetwork.PDFNetworkStream(params);
        };
        networkStream = createPDFNetworkStream({
          url,
          length,
          httpHeaders,
          withCredentials,
          rangeChunkSize,
          disableRange,
          disableStream
        });
      }
      resolve(networkStream);
    });
    return Promise.all([workerIdPromise, networkStreamPromise]).then(function ([workerId, networkStream]) {
      if (task.destroyed) {
        throw new Error("Loading aborted");
      }
      const messageHandler = new _message_handler.MessageHandler(docId, workerId, worker.port);
      const transport = new WorkerTransport(messageHandler, task, networkStream, transportParams, transportFactory);
      task._transport = transport;
      messageHandler.send("Ready", null);
    });
  }).catch(task._capability.reject);
  return task;
}
async function _fetchDocument(worker, source) {
  if (worker.destroyed) {
    throw new Error("Worker was destroyed");
  }
  const workerId = await worker.messageHandler.sendWithPromise("GetDocRequest", source, source.data ? [source.data.buffer] : null);
  if (worker.destroyed) {
    throw new Error("Worker was destroyed");
  }
  return workerId;
}
function getUrlProp(val) {
  if (val instanceof URL) {
    return val.href;
  }
  try {
    return new URL(val, window.location).href;
  } catch {
    if (_util.isNodeJS && typeof val === "string") {
      return val;
    }
  }
  throw new Error("Invalid PDF url data: " + "either string or URL-object is expected in the url property.");
}
function getDataProp(val) {
  if (_util.isNodeJS && typeof Buffer !== "undefined" && val instanceof Buffer) {
    throw new Error("Please provide binary data as `Uint8Array`, rather than `Buffer`.");
  }
  if (val instanceof Uint8Array && val.byteLength === val.buffer.byteLength) {
    return val;
  }
  if (typeof val === "string") {
    return (0, _util.stringToBytes)(val);
  }
  if (typeof val === "object" && !isNaN(val?.length) || (0, _util.isArrayBuffer)(val)) {
    return new Uint8Array(val);
  }
  throw new Error("Invalid PDF binary data: either TypedArray, " + "string, or array-like object is expected in the data property.");
}
class PDFDocumentLoadingTask {
  static #docId = 0;
  constructor() {
    this._capability = new _util.PromiseCapability();
    this._transport = null;
    this._worker = null;
    this.docId = `d${PDFDocumentLoadingTask.#docId++}`;
    this.destroyed = false;
    this.onPassword = null;
    this.onProgress = null;
  }
  get promise() {
    return this._capability.promise;
  }
  async destroy() {
    this.destroyed = true;
    try {
      if (this._worker?.port) {
        this._worker._pendingDestroy = true;
      }
      await this._transport?.destroy();
    } catch (ex) {
      if (this._worker?.port) {
        delete this._worker._pendingDestroy;
      }
      throw ex;
    }
    this._transport = null;
    if (this._worker) {
      this._worker.destroy();
      this._worker = null;
    }
  }
}
exports.PDFDocumentLoadingTask = PDFDocumentLoadingTask;
class PDFDataRangeTransport {
  constructor(length, initialData, progressiveDone = false, contentDispositionFilename = null) {
    this.length = length;
    this.initialData = initialData;
    this.progressiveDone = progressiveDone;
    this.contentDispositionFilename = contentDispositionFilename;
    this._rangeListeners = [];
    this._progressListeners = [];
    this._progressiveReadListeners = [];
    this._progressiveDoneListeners = [];
    this._readyCapability = new _util.PromiseCapability();
  }
  addRangeListener(listener) {
    this._rangeListeners.push(listener);
  }
  addProgressListener(listener) {
    this._progressListeners.push(listener);
  }
  addProgressiveReadListener(listener) {
    this._progressiveReadListeners.push(listener);
  }
  addProgressiveDoneListener(listener) {
    this._progressiveDoneListeners.push(listener);
  }
  onDataRange(begin, chunk) {
    for (const listener of this._rangeListeners) {
      listener(begin, chunk);
    }
  }
  onDataProgress(loaded, total) {
    this._readyCapability.promise.then(() => {
      for (const listener of this._progressListeners) {
        listener(loaded, total);
      }
    });
  }
  onDataProgressiveRead(chunk) {
    this._readyCapability.promise.then(() => {
      for (const listener of this._progressiveReadListeners) {
        listener(chunk);
      }
    });
  }
  onDataProgressiveDone() {
    this._readyCapability.promise.then(() => {
      for (const listener of this._progressiveDoneListeners) {
        listener();
      }
    });
  }
  transportReady() {
    this._readyCapability.resolve();
  }
  requestDataRange(begin, end) {
    (0, _util.unreachable)("Abstract method PDFDataRangeTransport.requestDataRange");
  }
  abort() {}
}
exports.PDFDataRangeTransport = PDFDataRangeTransport;
class PDFDocumentProxy {
  constructor(pdfInfo, transport) {
    this._pdfInfo = pdfInfo;
    this._transport = transport;
    Object.defineProperty(this, "getJavaScript", {
      value: () => {
        (0, _display_utils.deprecated)("`PDFDocumentProxy.getJavaScript`, " + "please use `PDFDocumentProxy.getJSActions` instead.");
        return this.getJSActions().then(js => {
          if (!js) {
            return js;
          }
          const jsArr = [];
          for (const name in js) {
            jsArr.push(...js[name]);
          }
          return jsArr;
        });
      }
    });
  }
  get annotationStorage() {
    return this._transport.annotationStorage;
  }
  get filterFactory() {
    return this._transport.filterFactory;
  }
  get numPages() {
    return this._pdfInfo.numPages;
  }
  get fingerprints() {
    return this._pdfInfo.fingerprints;
  }
  get isPureXfa() {
    return (0, _util.shadow)(this, "isPureXfa", !!this._transport._htmlForXfa);
  }
  get allXfaHtml() {
    return this._transport._htmlForXfa;
  }
  getPage(pageNumber) {
    return this._transport.getPage(pageNumber);
  }
  getPageIndex(ref) {
    return this._transport.getPageIndex(ref);
  }
  getDestinations() {
    return this._transport.getDestinations();
  }
  getDestination(id) {
    return this._transport.getDestination(id);
  }
  getPageLabels() {
    return this._transport.getPageLabels();
  }
  getPageLayout() {
    return this._transport.getPageLayout();
  }
  getPageMode() {
    return this._transport.getPageMode();
  }
  getViewerPreferences() {
    return this._transport.getViewerPreferences();
  }
  getOpenAction() {
    return this._transport.getOpenAction();
  }
  getAttachments() {
    return this._transport.getAttachments();
  }
  getJSActions() {
    return this._transport.getDocJSActions();
  }
  getOutline() {
    return this._transport.getOutline();
  }
  getOptionalContentConfig() {
    return this._transport.getOptionalContentConfig();
  }
  getPermissions() {
    return this._transport.getPermissions();
  }
  getMetadata() {
    return this._transport.getMetadata();
  }
  getMarkInfo() {
    return this._transport.getMarkInfo();
  }
  getData() {
    return this._transport.getData();
  }
  saveDocument() {
    return this._transport.saveDocument();
  }
  getDownloadInfo() {
    return this._transport.downloadInfoCapability.promise;
  }
  cleanup(keepLoadedFonts = false) {
    return this._transport.startCleanup(keepLoadedFonts || this.isPureXfa);
  }
  destroy() {
    return this.loadingTask.destroy();
  }
  get loadingParams() {
    return this._transport.loadingParams;
  }
  get loadingTask() {
    return this._transport.loadingTask;
  }
  getFieldObjects() {
    return this._transport.getFieldObjects();
  }
  hasJSActions() {
    return this._transport.hasJSActions();
  }
  getCalculationOrderIds() {
    return this._transport.getCalculationOrderIds();
  }
}
exports.PDFDocumentProxy = PDFDocumentProxy;
class PDFPageProxy {
  #delayedCleanupTimeout = null;
  #pendingCleanup = false;
  constructor(pageIndex, pageInfo, transport, pdfBug = false) {
    this._pageIndex = pageIndex;
    this._pageInfo = pageInfo;
    this._transport = transport;
    this._stats = pdfBug ? new _display_utils.StatTimer() : null;
    this._pdfBug = pdfBug;
    this.commonObjs = transport.commonObjs;
    this.objs = new PDFObjects();
    this._maybeCleanupAfterRender = false;
    this._intentStates = new Map();
    this.destroyed = false;
  }
  get pageNumber() {
    return this._pageIndex + 1;
  }
  get rotate() {
    return this._pageInfo.rotate;
  }
  get ref() {
    return this._pageInfo.ref;
  }
  get userUnit() {
    return this._pageInfo.userUnit;
  }
  get view() {
    return this._pageInfo.view;
  }
  getViewport({
    scale,
    rotation = this.rotate,
    offsetX = 0,
    offsetY = 0,
    dontFlip = false
  } = {}) {
    return new _display_utils.PageViewport({
      viewBox: this.view,
      scale,
      rotation,
      offsetX,
      offsetY,
      dontFlip
    });
  }
  getAnnotations({
    intent = "display"
  } = {}) {
    const intentArgs = this._transport.getRenderingIntent(intent);
    return this._transport.getAnnotations(this._pageIndex, intentArgs.renderingIntent);
  }
  getJSActions() {
    return this._transport.getPageJSActions(this._pageIndex);
  }
  get filterFactory() {
    return this._transport.filterFactory;
  }
  get isPureXfa() {
    return (0, _util.shadow)(this, "isPureXfa", !!this._transport._htmlForXfa);
  }
  async getXfa() {
    return this._transport._htmlForXfa?.children[this._pageIndex] || null;
  }
  render({
    canvasContext,
    viewport,
    intent = "display",
    annotationMode = _util.AnnotationMode.ENABLE,
    transform = null,
    background = null,
    optionalContentConfigPromise = null,
    annotationCanvasMap = null,
    pageColors = null,
    printAnnotationStorage = null
  }) {
    this._stats?.time("Overall");
    const intentArgs = this._transport.getRenderingIntent(intent, annotationMode, printAnnotationStorage);
    this.#pendingCleanup = false;
    this.#abortDelayedCleanup();
    if (!optionalContentConfigPromise) {
      optionalContentConfigPromise = this._transport.getOptionalContentConfig();
    }
    let intentState = this._intentStates.get(intentArgs.cacheKey);
    if (!intentState) {
      intentState = Object.create(null);
      this._intentStates.set(intentArgs.cacheKey, intentState);
    }
    if (intentState.streamReaderCancelTimeout) {
      clearTimeout(intentState.streamReaderCancelTimeout);
      intentState.streamReaderCancelTimeout = null;
    }
    const intentPrint = !!(intentArgs.renderingIntent & _util.RenderingIntentFlag.PRINT);
    if (!intentState.displayReadyCapability) {
      intentState.displayReadyCapability = new _util.PromiseCapability();
      intentState.operatorList = {
        fnArray: [],
        argsArray: [],
        lastChunk: false,
        separateAnnots: null
      };
      this._stats?.time("Page Request");
      this._pumpOperatorList(intentArgs);
    }
    const complete = error => {
      intentState.renderTasks.delete(internalRenderTask);
      if (this._maybeCleanupAfterRender || intentPrint) {
        this.#pendingCleanup = true;
      }
      this.#tryCleanup(!intentPrint);
      if (error) {
        internalRenderTask.capability.reject(error);
        this._abortOperatorList({
          intentState,
          reason: error instanceof Error ? error : new Error(error)
        });
      } else {
        internalRenderTask.capability.resolve();
      }
      this._stats?.timeEnd("Rendering");
      this._stats?.timeEnd("Overall");
    };
    const internalRenderTask = new InternalRenderTask({
      callback: complete,
      params: {
        canvasContext,
        viewport,
        transform,
        background
      },
      objs: this.objs,
      commonObjs: this.commonObjs,
      annotationCanvasMap,
      operatorList: intentState.operatorList,
      pageIndex: this._pageIndex,
      canvasFactory: this._transport.canvasFactory,
      filterFactory: this._transport.filterFactory,
      useRequestAnimationFrame: !intentPrint,
      pdfBug: this._pdfBug,
      pageColors
    });
    (intentState.renderTasks ||= new Set()).add(internalRenderTask);
    const renderTask = internalRenderTask.task;
    Promise.all([intentState.displayReadyCapability.promise, optionalContentConfigPromise]).then(([transparency, optionalContentConfig]) => {
      if (this.destroyed) {
        complete();
        return;
      }
      this._stats?.time("Rendering");
      internalRenderTask.initializeGraphics({
        transparency,
        optionalContentConfig
      });
      internalRenderTask.operatorListChanged();
    }).catch(complete);
    return renderTask;
  }
  getOperatorList({
    intent = "display",
    annotationMode = _util.AnnotationMode.ENABLE,
    printAnnotationStorage = null
  } = {}) {
    function operatorListChanged() {
      if (intentState.operatorList.lastChunk) {
        intentState.opListReadCapability.resolve(intentState.operatorList);
        intentState.renderTasks.delete(opListTask);
      }
    }
    const intentArgs = this._transport.getRenderingIntent(intent, annotationMode, printAnnotationStorage, true);
    let intentState = this._intentStates.get(intentArgs.cacheKey);
    if (!intentState) {
      intentState = Object.create(null);
      this._intentStates.set(intentArgs.cacheKey, intentState);
    }
    let opListTask;
    if (!intentState.opListReadCapability) {
      opListTask = Object.create(null);
      opListTask.operatorListChanged = operatorListChanged;
      intentState.opListReadCapability = new _util.PromiseCapability();
      (intentState.renderTasks ||= new Set()).add(opListTask);
      intentState.operatorList = {
        fnArray: [],
        argsArray: [],
        lastChunk: false,
        separateAnnots: null
      };
      this._stats?.time("Page Request");
      this._pumpOperatorList(intentArgs);
    }
    return intentState.opListReadCapability.promise;
  }
  streamTextContent({
    includeMarkedContent = false,
    disableNormalization = false
  } = {}) {
    const TEXT_CONTENT_CHUNK_SIZE = 100;
    return this._transport.messageHandler.sendWithStream("GetTextContent", {
      pageIndex: this._pageIndex,
      includeMarkedContent: includeMarkedContent === true,
      disableNormalization: disableNormalization === true
    }, {
      highWaterMark: TEXT_CONTENT_CHUNK_SIZE,
      size(textContent) {
        return textContent.items.length;
      }
    });
  }
  getTextContent(params = {}) {
    if (this._transport._htmlForXfa) {
      return this.getXfa().then(xfa => {
        return _xfa_text.XfaText.textContent(xfa);
      });
    }
    const readableStream = this.streamTextContent(params);
    return new Promise(function (resolve, reject) {
      function pump() {
        reader.read().then(function ({
          value,
          done
        }) {
          if (done) {
            resolve(textContent);
            return;
          }
          Object.assign(textContent.styles, value.styles);
          textContent.items.push(...value.items);
          pump();
        }, reject);
      }
      const reader = readableStream.getReader();
      const textContent = {
        items: [],
        styles: Object.create(null)
      };
      pump();
    });
  }
  getStructTree() {
    return this._transport.getStructTree(this._pageIndex);
  }
  _destroy() {
    this.destroyed = true;
    const waitOn = [];
    for (const intentState of this._intentStates.values()) {
      this._abortOperatorList({
        intentState,
        reason: new Error("Page was destroyed."),
        force: true
      });
      if (intentState.opListReadCapability) {
        continue;
      }
      for (const internalRenderTask of intentState.renderTasks) {
        waitOn.push(internalRenderTask.completed);
        internalRenderTask.cancel();
      }
    }
    this.objs.clear();
    this.#pendingCleanup = false;
    this.#abortDelayedCleanup();
    return Promise.all(waitOn);
  }
  cleanup(resetStats = false) {
    this.#pendingCleanup = true;
    const success = this.#tryCleanup(false);
    if (resetStats && success) {
      this._stats &&= new _display_utils.StatTimer();
    }
    return success;
  }
  #tryCleanup(delayed = false) {
    this.#abortDelayedCleanup();
    if (!this.#pendingCleanup || this.destroyed) {
      return false;
    }
    if (delayed) {
      this.#delayedCleanupTimeout = setTimeout(() => {
        this.#delayedCleanupTimeout = null;
        this.#tryCleanup(false);
      }, DELAYED_CLEANUP_TIMEOUT);
      return false;
    }
    for (const {
      renderTasks,
      operatorList
    } of this._intentStates.values()) {
      if (renderTasks.size > 0 || !operatorList.lastChunk) {
        return false;
      }
    }
    this._intentStates.clear();
    this.objs.clear();
    this.#pendingCleanup = false;
    return true;
  }
  #abortDelayedCleanup() {
    if (this.#delayedCleanupTimeout) {
      clearTimeout(this.#delayedCleanupTimeout);
      this.#delayedCleanupTimeout = null;
    }
  }
  _startRenderPage(transparency, cacheKey) {
    const intentState = this._intentStates.get(cacheKey);
    if (!intentState) {
      return;
    }
    this._stats?.timeEnd("Page Request");
    intentState.displayReadyCapability?.resolve(transparency);
  }
  _renderPageChunk(operatorListChunk, intentState) {
    for (let i = 0, ii = operatorListChunk.length; i < ii; i++) {
      intentState.operatorList.fnArray.push(operatorListChunk.fnArray[i]);
      intentState.operatorList.argsArray.push(operatorListChunk.argsArray[i]);
    }
    intentState.operatorList.lastChunk = operatorListChunk.lastChunk;
    intentState.operatorList.separateAnnots = operatorListChunk.separateAnnots;
    for (const internalRenderTask of intentState.renderTasks) {
      internalRenderTask.operatorListChanged();
    }
    if (operatorListChunk.lastChunk) {
      this.#tryCleanup(true);
    }
  }
  _pumpOperatorList({
    renderingIntent,
    cacheKey,
    annotationStorageSerializable
  }) {
    const {
      map,
      transfers
    } = annotationStorageSerializable;
    const readableStream = this._transport.messageHandler.sendWithStream("GetOperatorList", {
      pageIndex: this._pageIndex,
      intent: renderingIntent,
      cacheKey,
      annotationStorage: map
    }, transfers);
    const reader = readableStream.getReader();
    const intentState = this._intentStates.get(cacheKey);
    intentState.streamReader = reader;
    const pump = () => {
      reader.read().then(({
        value,
        done
      }) => {
        if (done) {
          intentState.streamReader = null;
          return;
        }
        if (this._transport.destroyed) {
          return;
        }
        this._renderPageChunk(value, intentState);
        pump();
      }, reason => {
        intentState.streamReader = null;
        if (this._transport.destroyed) {
          return;
        }
        if (intentState.operatorList) {
          intentState.operatorList.lastChunk = true;
          for (const internalRenderTask of intentState.renderTasks) {
            internalRenderTask.operatorListChanged();
          }
          this.#tryCleanup(true);
        }
        if (intentState.displayReadyCapability) {
          intentState.displayReadyCapability.reject(reason);
        } else if (intentState.opListReadCapability) {
          intentState.opListReadCapability.reject(reason);
        } else {
          throw reason;
        }
      });
    };
    pump();
  }
  _abortOperatorList({
    intentState,
    reason,
    force = false
  }) {
    if (!intentState.streamReader) {
      return;
    }
    if (intentState.streamReaderCancelTimeout) {
      clearTimeout(intentState.streamReaderCancelTimeout);
      intentState.streamReaderCancelTimeout = null;
    }
    if (!force) {
      if (intentState.renderTasks.size > 0) {
        return;
      }
      if (reason instanceof _display_utils.RenderingCancelledException) {
        let delay = RENDERING_CANCELLED_TIMEOUT;
        if (reason.extraDelay > 0 && reason.extraDelay < 1000) {
          delay += reason.extraDelay;
        }
        intentState.streamReaderCancelTimeout = setTimeout(() => {
          intentState.streamReaderCancelTimeout = null;
          this._abortOperatorList({
            intentState,
            reason,
            force: true
          });
        }, delay);
        return;
      }
    }
    intentState.streamReader.cancel(new _util.AbortException(reason.message)).catch(() => {});
    intentState.streamReader = null;
    if (this._transport.destroyed) {
      return;
    }
    for (const [curCacheKey, curIntentState] of this._intentStates) {
      if (curIntentState === intentState) {
        this._intentStates.delete(curCacheKey);
        break;
      }
    }
    this.cleanup();
  }
  get stats() {
    return this._stats;
  }
}
exports.PDFPageProxy = PDFPageProxy;
class LoopbackPort {
  #listeners = new Set();
  #deferred = Promise.resolve();
  postMessage(obj, transfer) {
    const event = {
      data: structuredClone(obj, transfer ? {
        transfer
      } : null)
    };
    this.#deferred.then(() => {
      for (const listener of this.#listeners) {
        listener.call(this, event);
      }
    });
  }
  addEventListener(name, listener) {
    this.#listeners.add(listener);
  }
  removeEventListener(name, listener) {
    this.#listeners.delete(listener);
  }
  terminate() {
    this.#listeners.clear();
  }
}
exports.LoopbackPort = LoopbackPort;
const PDFWorkerUtil = {
  isWorkerDisabled: false,
  fallbackWorkerSrc: null,
  fakeWorkerId: 0
};
exports.PDFWorkerUtil = PDFWorkerUtil;
{
  if (_util.isNodeJS && typeof require === "function") {
    PDFWorkerUtil.isWorkerDisabled = true;
    PDFWorkerUtil.fallbackWorkerSrc = "./pdf.worker.js";
  } else if (typeof document === "object") {
    const pdfjsFilePath = document?.currentScript?.src;
    if (pdfjsFilePath) {
      PDFWorkerUtil.fallbackWorkerSrc = pdfjsFilePath.replace(/(\.(?:min\.)?js)(\?.*)?$/i, ".worker$1$2");
    }
  }
  PDFWorkerUtil.isSameOrigin = function (baseUrl, otherUrl) {
    let base;
    try {
      base = new URL(baseUrl);
      if (!base.origin || base.origin === "null") {
        return false;
      }
    } catch {
      return false;
    }
    const other = new URL(otherUrl, base);
    return base.origin === other.origin;
  };
  PDFWorkerUtil.createCDNWrapper = function (url) {
    const wrapper = `importScripts("${url}");`;
    return URL.createObjectURL(new Blob([wrapper]));
  };
}
class PDFWorker {
  static #workerPorts;
  constructor({
    name = null,
    port = null,
    verbosity = (0, _util.getVerbosityLevel)()
  } = {}) {
    this.name = name;
    this.destroyed = false;
    this.verbosity = verbosity;
    this._readyCapability = new _util.PromiseCapability();
    this._port = null;
    this._webWorker = null;
    this._messageHandler = null;
    if (port) {
      if (PDFWorker.#workerPorts?.has(port)) {
        throw new Error("Cannot use more than one PDFWorker per port.");
      }
      (PDFWorker.#workerPorts ||= new WeakMap()).set(port, this);
      this._initializeFromPort(port);
      return;
    }
    this._initialize();
  }
  get promise() {
    return this._readyCapability.promise;
  }
  get port() {
    return this._port;
  }
  get messageHandler() {
    return this._messageHandler;
  }
  _initializeFromPort(port) {
    this._port = port;
    this._messageHandler = new _message_handler.MessageHandler("main", "worker", port);
    this._messageHandler.on("ready", function () {});
    this._readyCapability.resolve();
    this._messageHandler.send("configure", {
      verbosity: this.verbosity
    });
  }
  _initialize() {
    if (!PDFWorkerUtil.isWorkerDisabled && !PDFWorker._mainThreadWorkerMessageHandler) {
      let {
        workerSrc
      } = PDFWorker;
      try {
        if (!PDFWorkerUtil.isSameOrigin(window.location.href, workerSrc)) {
          workerSrc = PDFWorkerUtil.createCDNWrapper(new URL(workerSrc, window.location).href);
        }
        const worker = new Worker(workerSrc);
        const messageHandler = new _message_handler.MessageHandler("main", "worker", worker);
        const terminateEarly = () => {
          worker.removeEventListener("error", onWorkerError);
          messageHandler.destroy();
          worker.terminate();
          if (this.destroyed) {
            this._readyCapability.reject(new Error("Worker was destroyed"));
          } else {
            this._setupFakeWorker();
          }
        };
        const onWorkerError = () => {
          if (!this._webWorker) {
            terminateEarly();
          }
        };
        worker.addEventListener("error", onWorkerError);
        messageHandler.on("test", data => {
          worker.removeEventListener("error", onWorkerError);
          if (this.destroyed) {
            terminateEarly();
            return;
          }
          if (data) {
            this._messageHandler = messageHandler;
            this._port = worker;
            this._webWorker = worker;
            this._readyCapability.resolve();
            messageHandler.send("configure", {
              verbosity: this.verbosity
            });
          } else {
            this._setupFakeWorker();
            messageHandler.destroy();
            worker.terminate();
          }
        });
        messageHandler.on("ready", data => {
          worker.removeEventListener("error", onWorkerError);
          if (this.destroyed) {
            terminateEarly();
            return;
          }
          try {
            sendTest();
          } catch {
            this._setupFakeWorker();
          }
        });
        const sendTest = () => {
          const testObj = new Uint8Array();
          messageHandler.send("test", testObj, [testObj.buffer]);
        };
        sendTest();
        return;
      } catch {
        (0, _util.info)("The worker has been disabled.");
      }
    }
    this._setupFakeWorker();
  }
  _setupFakeWorker() {
    if (!PDFWorkerUtil.isWorkerDisabled) {
      (0, _util.warn)("Setting up fake worker.");
      PDFWorkerUtil.isWorkerDisabled = true;
    }
    PDFWorker._setupFakeWorkerGlobal.then(WorkerMessageHandler => {
      if (this.destroyed) {
        this._readyCapability.reject(new Error("Worker was destroyed"));
        return;
      }
      const port = new LoopbackPort();
      this._port = port;
      const id = `fake${PDFWorkerUtil.fakeWorkerId++}`;
      const workerHandler = new _message_handler.MessageHandler(id + "_worker", id, port);
      WorkerMessageHandler.setup(workerHandler, port);
      const messageHandler = new _message_handler.MessageHandler(id, id + "_worker", port);
      this._messageHandler = messageHandler;
      this._readyCapability.resolve();
      messageHandler.send("configure", {
        verbosity: this.verbosity
      });
    }).catch(reason => {
      this._readyCapability.reject(new Error(`Setting up fake worker failed: "${reason.message}".`));
    });
  }
  destroy() {
    this.destroyed = true;
    if (this._webWorker) {
      this._webWorker.terminate();
      this._webWorker = null;
    }
    PDFWorker.#workerPorts?.delete(this._port);
    this._port = null;
    if (this._messageHandler) {
      this._messageHandler.destroy();
      this._messageHandler = null;
    }
  }
  static fromPort(params) {
    if (!params?.port) {
      throw new Error("PDFWorker.fromPort - invalid method signature.");
    }
    const cachedPort = this.#workerPorts?.get(params.port);
    if (cachedPort) {
      if (cachedPort._pendingDestroy) {
        throw new Error("PDFWorker.fromPort - the worker is being destroyed.\n" + "Please remember to await `PDFDocumentLoadingTask.destroy()`-calls.");
      }
      return cachedPort;
    }
    return new PDFWorker(params);
  }
  static get workerSrc() {
    if (_worker_options.GlobalWorkerOptions.workerSrc) {
      return _worker_options.GlobalWorkerOptions.workerSrc;
    }
    if (PDFWorkerUtil.fallbackWorkerSrc !== null) {
      if (!_util.isNodeJS) {
        (0, _display_utils.deprecated)('No "GlobalWorkerOptions.workerSrc" specified.');
      }
      return PDFWorkerUtil.fallbackWorkerSrc;
    }
    throw new Error('No "GlobalWorkerOptions.workerSrc" specified.');
  }
  static get _mainThreadWorkerMessageHandler() {
    try {
      return globalThis.pdfjsWorker?.WorkerMessageHandler || null;
    } catch {
      return null;
    }
  }
  static get _setupFakeWorkerGlobal() {
    const loader = async () => {
      const mainWorkerMessageHandler = this._mainThreadWorkerMessageHandler;
      if (mainWorkerMessageHandler) {
        return mainWorkerMessageHandler;
      }
      if (_util.isNodeJS && typeof require === "function") {
        const worker = eval("require")(this.workerSrc);
        return worker.WorkerMessageHandler;
      }
      await (0, _display_utils.loadScript)(this.workerSrc);
      return window.pdfjsWorker.WorkerMessageHandler;
    };
    return (0, _util.shadow)(this, "_setupFakeWorkerGlobal", loader());
  }
}
exports.PDFWorker = PDFWorker;
class WorkerTransport {
  #methodPromises = new Map();
  #pageCache = new Map();
  #pagePromises = new Map();
  #passwordCapability = null;
  constructor(messageHandler, loadingTask, networkStream, params, factory) {
    this.messageHandler = messageHandler;
    this.loadingTask = loadingTask;
    this.commonObjs = new PDFObjects();
    this.fontLoader = new _font_loader.FontLoader({
      ownerDocument: params.ownerDocument,
      styleElement: params.styleElement
    });
    this._params = params;
    this.canvasFactory = factory.canvasFactory;
    this.filterFactory = factory.filterFactory;
    this.cMapReaderFactory = factory.cMapReaderFactory;
    this.standardFontDataFactory = factory.standardFontDataFactory;
    this.destroyed = false;
    this.destroyCapability = null;
    this._networkStream = networkStream;
    this._fullReader = null;
    this._lastProgress = null;
    this.downloadInfoCapability = new _util.PromiseCapability();
    this.setupMessageHandler();
  }
  #cacheSimpleMethod(name, data = null) {
    const cachedPromise = this.#methodPromises.get(name);
    if (cachedPromise) {
      return cachedPromise;
    }
    const promise = this.messageHandler.sendWithPromise(name, data);
    this.#methodPromises.set(name, promise);
    return promise;
  }
  get annotationStorage() {
    return (0, _util.shadow)(this, "annotationStorage", new _annotation_storage.AnnotationStorage());
  }
  getRenderingIntent(intent, annotationMode = _util.AnnotationMode.ENABLE, printAnnotationStorage = null, isOpList = false) {
    let renderingIntent = _util.RenderingIntentFlag.DISPLAY;
    let annotationStorageSerializable = _annotation_storage.SerializableEmpty;
    switch (intent) {
      case "any":
        renderingIntent = _util.RenderingIntentFlag.ANY;
        break;
      case "display":
        break;
      case "print":
        renderingIntent = _util.RenderingIntentFlag.PRINT;
        break;
      default:
        (0, _util.warn)(`getRenderingIntent - invalid intent: ${intent}`);
    }
    switch (annotationMode) {
      case _util.AnnotationMode.DISABLE:
        renderingIntent += _util.RenderingIntentFlag.ANNOTATIONS_DISABLE;
        break;
      case _util.AnnotationMode.ENABLE:
        break;
      case _util.AnnotationMode.ENABLE_FORMS:
        renderingIntent += _util.RenderingIntentFlag.ANNOTATIONS_FORMS;
        break;
      case _util.AnnotationMode.ENABLE_STORAGE:
        renderingIntent += _util.RenderingIntentFlag.ANNOTATIONS_STORAGE;
        const annotationStorage = renderingIntent & _util.RenderingIntentFlag.PRINT && printAnnotationStorage instanceof _annotation_storage.PrintAnnotationStorage ? printAnnotationStorage : this.annotationStorage;
        annotationStorageSerializable = annotationStorage.serializable;
        break;
      default:
        (0, _util.warn)(`getRenderingIntent - invalid annotationMode: ${annotationMode}`);
    }
    if (isOpList) {
      renderingIntent += _util.RenderingIntentFlag.OPLIST;
    }
    return {
      renderingIntent,
      cacheKey: `${renderingIntent}_${annotationStorageSerializable.hash}`,
      annotationStorageSerializable
    };
  }
  destroy() {
    if (this.destroyCapability) {
      return this.destroyCapability.promise;
    }
    this.destroyed = true;
    this.destroyCapability = new _util.PromiseCapability();
    this.#passwordCapability?.reject(new Error("Worker was destroyed during onPassword callback"));
    const waitOn = [];
    for (const page of this.#pageCache.values()) {
      waitOn.push(page._destroy());
    }
    this.#pageCache.clear();
    this.#pagePromises.clear();
    if (this.hasOwnProperty("annotationStorage")) {
      this.annotationStorage.resetModified();
    }
    const terminated = this.messageHandler.sendWithPromise("Terminate", null);
    waitOn.push(terminated);
    Promise.all(waitOn).then(() => {
      this.commonObjs.clear();
      this.fontLoader.clear();
      this.#methodPromises.clear();
      this.filterFactory.destroy();
      this._networkStream?.cancelAllRequests(new _util.AbortException("Worker was terminated."));
      if (this.messageHandler) {
        this.messageHandler.destroy();
        this.messageHandler = null;
      }
      this.destroyCapability.resolve();
    }, this.destroyCapability.reject);
    return this.destroyCapability.promise;
  }
  setupMessageHandler() {
    const {
      messageHandler,
      loadingTask
    } = this;
    messageHandler.on("GetReader", (data, sink) => {
      (0, _util.assert)(this._networkStream, "GetReader - no `IPDFStream` instance available.");
      this._fullReader = this._networkStream.getFullReader();
      this._fullReader.onProgress = evt => {
        this._lastProgress = {
          loaded: evt.loaded,
          total: evt.total
        };
      };
      sink.onPull = () => {
        this._fullReader.read().then(function ({
          value,
          done
        }) {
          if (done) {
            sink.close();
            return;
          }
          (0, _util.assert)(value instanceof ArrayBuffer, "GetReader - expected an ArrayBuffer.");
          sink.enqueue(new Uint8Array(value), 1, [value]);
        }).catch(reason => {
          sink.error(reason);
        });
      };
      sink.onCancel = reason => {
        this._fullReader.cancel(reason);
        sink.ready.catch(readyReason => {
          if (this.destroyed) {
            return;
          }
          throw readyReason;
        });
      };
    });
    messageHandler.on("ReaderHeadersReady", data => {
      const headersCapability = new _util.PromiseCapability();
      const fullReader = this._fullReader;
      fullReader.headersReady.then(() => {
        if (!fullReader.isStreamingSupported || !fullReader.isRangeSupported) {
          if (this._lastProgress) {
            loadingTask.onProgress?.(this._lastProgress);
          }
          fullReader.onProgress = evt => {
            loadingTask.onProgress?.({
              loaded: evt.loaded,
              total: evt.total
            });
          };
        }
        headersCapability.resolve({
          isStreamingSupported: fullReader.isStreamingSupported,
          isRangeSupported: fullReader.isRangeSupported,
          contentLength: fullReader.contentLength
        });
      }, headersCapability.reject);
      return headersCapability.promise;
    });
    messageHandler.on("GetRangeReader", (data, sink) => {
      (0, _util.assert)(this._networkStream, "GetRangeReader - no `IPDFStream` instance available.");
      const rangeReader = this._networkStream.getRangeReader(data.begin, data.end);
      if (!rangeReader) {
        sink.close();
        return;
      }
      sink.onPull = () => {
        rangeReader.read().then(function ({
          value,
          done
        }) {
          if (done) {
            sink.close();
            return;
          }
          (0, _util.assert)(value instanceof ArrayBuffer, "GetRangeReader - expected an ArrayBuffer.");
          sink.enqueue(new Uint8Array(value), 1, [value]);
        }).catch(reason => {
          sink.error(reason);
        });
      };
      sink.onCancel = reason => {
        rangeReader.cancel(reason);
        sink.ready.catch(readyReason => {
          if (this.destroyed) {
            return;
          }
          throw readyReason;
        });
      };
    });
    messageHandler.on("GetDoc", ({
      pdfInfo
    }) => {
      this._numPages = pdfInfo.numPages;
      this._htmlForXfa = pdfInfo.htmlForXfa;
      delete pdfInfo.htmlForXfa;
      loadingTask._capability.resolve(new PDFDocumentProxy(pdfInfo, this));
    });
    messageHandler.on("DocException", function (ex) {
      let reason;
      switch (ex.name) {
        case "PasswordException":
          reason = new _util.PasswordException(ex.message, ex.code);
          break;
        case "InvalidPDFException":
          reason = new _util.InvalidPDFException(ex.message);
          break;
        case "MissingPDFException":
          reason = new _util.MissingPDFException(ex.message);
          break;
        case "UnexpectedResponseException":
          reason = new _util.UnexpectedResponseException(ex.message, ex.status);
          break;
        case "UnknownErrorException":
          reason = new _util.UnknownErrorException(ex.message, ex.details);
          break;
        default:
          (0, _util.unreachable)("DocException - expected a valid Error.");
      }
      loadingTask._capability.reject(reason);
    });
    messageHandler.on("PasswordRequest", exception => {
      this.#passwordCapability = new _util.PromiseCapability();
      if (loadingTask.onPassword) {
        const updatePassword = password => {
          if (password instanceof Error) {
            this.#passwordCapability.reject(password);
          } else {
            this.#passwordCapability.resolve({
              password
            });
          }
        };
        try {
          loadingTask.onPassword(updatePassword, exception.code);
        } catch (ex) {
          this.#passwordCapability.reject(ex);
        }
      } else {
        this.#passwordCapability.reject(new _util.PasswordException(exception.message, exception.code));
      }
      return this.#passwordCapability.promise;
    });
    messageHandler.on("DataLoaded", data => {
      loadingTask.onProgress?.({
        loaded: data.length,
        total: data.length
      });
      this.downloadInfoCapability.resolve(data);
    });
    messageHandler.on("StartRenderPage", data => {
      if (this.destroyed) {
        return;
      }
      const page = this.#pageCache.get(data.pageIndex);
      page._startRenderPage(data.transparency, data.cacheKey);
    });
    messageHandler.on("commonobj", ([id, type, exportedData]) => {
      if (this.destroyed) {
        return;
      }
      if (this.commonObjs.has(id)) {
        return;
      }
      switch (type) {
        case "Font":
          const params = this._params;
          if ("error" in exportedData) {
            const exportedError = exportedData.error;
            (0, _util.warn)(`Error during font loading: ${exportedError}`);
            this.commonObjs.resolve(id, exportedError);
            break;
          }
          const inspectFont = params.pdfBug && globalThis.FontInspector?.enabled ? (font, url) => globalThis.FontInspector.fontAdded(font, url) : null;
          const font = new _font_loader.FontFaceObject(exportedData, {
            isEvalSupported: params.isEvalSupported,
            disableFontFace: params.disableFontFace,
            ignoreErrors: params.ignoreErrors,
            inspectFont
          });
          this.fontLoader.bind(font).catch(reason => {
            return messageHandler.sendWithPromise("FontFallback", {
              id
            });
          }).finally(() => {
            if (!params.fontExtraProperties && font.data) {
              font.data = null;
            }
            this.commonObjs.resolve(id, font);
          });
          break;
        case "FontPath":
        case "Image":
        case "Pattern":
          this.commonObjs.resolve(id, exportedData);
          break;
        default:
          throw new Error(`Got unknown common object type ${type}`);
      }
    });
    messageHandler.on("obj", ([id, pageIndex, type, imageData]) => {
      if (this.destroyed) {
        return;
      }
      const pageProxy = this.#pageCache.get(pageIndex);
      if (pageProxy.objs.has(id)) {
        return;
      }
      switch (type) {
        case "Image":
          pageProxy.objs.resolve(id, imageData);
          if (imageData) {
            let length;
            if (imageData.bitmap) {
              const {
                width,
                height
              } = imageData;
              length = width * height * 4;
            } else {
              length = imageData.data?.length || 0;
            }
            if (length > _util.MAX_IMAGE_SIZE_TO_CACHE) {
              pageProxy._maybeCleanupAfterRender = true;
            }
          }
          break;
        case "Pattern":
          pageProxy.objs.resolve(id, imageData);
          break;
        default:
          throw new Error(`Got unknown object type ${type}`);
      }
    });
    messageHandler.on("DocProgress", data => {
      if (this.destroyed) {
        return;
      }
      loadingTask.onProgress?.({
        loaded: data.loaded,
        total: data.total
      });
    });
    messageHandler.on("FetchBuiltInCMap", data => {
      if (this.destroyed) {
        return Promise.reject(new Error("Worker was destroyed."));
      }
      if (!this.cMapReaderFactory) {
        return Promise.reject(new Error("CMapReaderFactory not initialized, see the `useWorkerFetch` parameter."));
      }
      return this.cMapReaderFactory.fetch(data);
    });
    messageHandler.on("FetchStandardFontData", data => {
      if (this.destroyed) {
        return Promise.reject(new Error("Worker was destroyed."));
      }
      if (!this.standardFontDataFactory) {
        return Promise.reject(new Error("StandardFontDataFactory not initialized, see the `useWorkerFetch` parameter."));
      }
      return this.standardFontDataFactory.fetch(data);
    });
  }
  getData() {
    return this.messageHandler.sendWithPromise("GetData", null);
  }
  saveDocument() {
    if (this.annotationStorage.size <= 0) {
      (0, _util.warn)("saveDocument called while `annotationStorage` is empty, " + "please use the getData-method instead.");
    }
    const {
      map,
      transfers
    } = this.annotationStorage.serializable;
    return this.messageHandler.sendWithPromise("SaveDocument", {
      isPureXfa: !!this._htmlForXfa,
      numPages: this._numPages,
      annotationStorage: map,
      filename: this._fullReader?.filename ?? null
    }, transfers).finally(() => {
      this.annotationStorage.resetModified();
    });
  }
  getPage(pageNumber) {
    if (!Number.isInteger(pageNumber) || pageNumber <= 0 || pageNumber > this._numPages) {
      return Promise.reject(new Error("Invalid page request."));
    }
    const pageIndex = pageNumber - 1,
      cachedPromise = this.#pagePromises.get(pageIndex);
    if (cachedPromise) {
      return cachedPromise;
    }
    const promise = this.messageHandler.sendWithPromise("GetPage", {
      pageIndex
    }).then(pageInfo => {
      if (this.destroyed) {
        throw new Error("Transport destroyed");
      }
      const page = new PDFPageProxy(pageIndex, pageInfo, this, this._params.pdfBug);
      this.#pageCache.set(pageIndex, page);
      return page;
    });
    this.#pagePromises.set(pageIndex, promise);
    return promise;
  }
  getPageIndex(ref) {
    if (typeof ref !== "object" || ref === null || !Number.isInteger(ref.num) || ref.num < 0 || !Number.isInteger(ref.gen) || ref.gen < 0) {
      return Promise.reject(new Error("Invalid pageIndex request."));
    }
    return this.messageHandler.sendWithPromise("GetPageIndex", {
      num: ref.num,
      gen: ref.gen
    });
  }
  getAnnotations(pageIndex, intent) {
    return this.messageHandler.sendWithPromise("GetAnnotations", {
      pageIndex,
      intent
    });
  }
  getFieldObjects() {
    return this.#cacheSimpleMethod("GetFieldObjects");
  }
  hasJSActions() {
    return this.#cacheSimpleMethod("HasJSActions");
  }
  getCalculationOrderIds() {
    return this.messageHandler.sendWithPromise("GetCalculationOrderIds", null);
  }
  getDestinations() {
    return this.messageHandler.sendWithPromise("GetDestinations", null);
  }
  getDestination(id) {
    if (typeof id !== "string") {
      return Promise.reject(new Error("Invalid destination request."));
    }
    return this.messageHandler.sendWithPromise("GetDestination", {
      id
    });
  }
  getPageLabels() {
    return this.messageHandler.sendWithPromise("GetPageLabels", null);
  }
  getPageLayout() {
    return this.messageHandler.sendWithPromise("GetPageLayout", null);
  }
  getPageMode() {
    return this.messageHandler.sendWithPromise("GetPageMode", null);
  }
  getViewerPreferences() {
    return this.messageHandler.sendWithPromise("GetViewerPreferences", null);
  }
  getOpenAction() {
    return this.messageHandler.sendWithPromise("GetOpenAction", null);
  }
  getAttachments() {
    return this.messageHandler.sendWithPromise("GetAttachments", null);
  }
  getDocJSActions() {
    return this.#cacheSimpleMethod("GetDocJSActions");
  }
  getPageJSActions(pageIndex) {
    return this.messageHandler.sendWithPromise("GetPageJSActions", {
      pageIndex
    });
  }
  getStructTree(pageIndex) {
    return this.messageHandler.sendWithPromise("GetStructTree", {
      pageIndex
    });
  }
  getOutline() {
    return this.messageHandler.sendWithPromise("GetOutline", null);
  }
  getOptionalContentConfig() {
    return this.messageHandler.sendWithPromise("GetOptionalContentConfig", null).then(results => {
      return new _optional_content_config.OptionalContentConfig(results);
    });
  }
  getPermissions() {
    return this.messageHandler.sendWithPromise("GetPermissions", null);
  }
  getMetadata() {
    const name = "GetMetadata",
      cachedPromise = this.#methodPromises.get(name);
    if (cachedPromise) {
      return cachedPromise;
    }
    const promise = this.messageHandler.sendWithPromise(name, null).then(results => {
      return {
        info: results[0],
        metadata: results[1] ? new _metadata.Metadata(results[1]) : null,
        contentDispositionFilename: this._fullReader?.filename ?? null,
        contentLength: this._fullReader?.contentLength ?? null
      };
    });
    this.#methodPromises.set(name, promise);
    return promise;
  }
  getMarkInfo() {
    return this.messageHandler.sendWithPromise("GetMarkInfo", null);
  }
  async startCleanup(keepLoadedFonts = false) {
    if (this.destroyed) {
      return;
    }
    await this.messageHandler.sendWithPromise("Cleanup", null);
    for (const page of this.#pageCache.values()) {
      const cleanupSuccessful = page.cleanup();
      if (!cleanupSuccessful) {
        throw new Error(`startCleanup: Page ${page.pageNumber} is currently rendering.`);
      }
    }
    this.commonObjs.clear();
    if (!keepLoadedFonts) {
      this.fontLoader.clear();
    }
    this.#methodPromises.clear();
    this.filterFactory.destroy(true);
  }
  get loadingParams() {
    const {
      disableAutoFetch,
      enableXfa
    } = this._params;
    return (0, _util.shadow)(this, "loadingParams", {
      disableAutoFetch,
      enableXfa
    });
  }
}
class PDFObjects {
  #objs = Object.create(null);
  #ensureObj(objId) {
    return this.#objs[objId] ||= {
      capability: new _util.PromiseCapability(),
      data: null
    };
  }
  get(objId, callback = null) {
    if (callback) {
      const obj = this.#ensureObj(objId);
      obj.capability.promise.then(() => callback(obj.data));
      return null;
    }
    const obj = this.#objs[objId];
    if (!obj?.capability.settled) {
      throw new Error(`Requesting object that isn't resolved yet ${objId}.`);
    }
    return obj.data;
  }
  has(objId) {
    const obj = this.#objs[objId];
    return obj?.capability.settled || false;
  }
  resolve(objId, data = null) {
    const obj = this.#ensureObj(objId);
    obj.data = data;
    obj.capability.resolve();
  }
  clear() {
    for (const objId in this.#objs) {
      const {
        data
      } = this.#objs[objId];
      data?.bitmap?.close();
    }
    this.#objs = Object.create(null);
  }
}
class RenderTask {
  #internalRenderTask = null;
  constructor(internalRenderTask) {
    this.#internalRenderTask = internalRenderTask;
    this.onContinue = null;
  }
  get promise() {
    return this.#internalRenderTask.capability.promise;
  }
  cancel(extraDelay = 0) {
    this.#internalRenderTask.cancel(null, extraDelay);
  }
  get separateAnnots() {
    const {
      separateAnnots
    } = this.#internalRenderTask.operatorList;
    if (!separateAnnots) {
      return false;
    }
    const {
      annotationCanvasMap
    } = this.#internalRenderTask;
    return separateAnnots.form || separateAnnots.canvas && annotationCanvasMap?.size > 0;
  }
}
exports.RenderTask = RenderTask;
class InternalRenderTask {
  static #canvasInUse = new WeakSet();
  constructor({
    callback,
    params,
    objs,
    commonObjs,
    annotationCanvasMap,
    operatorList,
    pageIndex,
    canvasFactory,
    filterFactory,
    useRequestAnimationFrame = false,
    pdfBug = false,
    pageColors = null
  }) {
    this.callback = callback;
    this.params = params;
    this.objs = objs;
    this.commonObjs = commonObjs;
    this.annotationCanvasMap = annotationCanvasMap;
    this.operatorListIdx = null;
    this.operatorList = operatorList;
    this._pageIndex = pageIndex;
    this.canvasFactory = canvasFactory;
    this.filterFactory = filterFactory;
    this._pdfBug = pdfBug;
    this.pageColors = pageColors;
    this.running = false;
    this.graphicsReadyCallback = null;
    this.graphicsReady = false;
    this._useRequestAnimationFrame = useRequestAnimationFrame === true && typeof window !== "undefined";
    this.cancelled = false;
    this.capability = new _util.PromiseCapability();
    this.task = new RenderTask(this);
    this._cancelBound = this.cancel.bind(this);
    this._continueBound = this._continue.bind(this);
    this._scheduleNextBound = this._scheduleNext.bind(this);
    this._nextBound = this._next.bind(this);
    this._canvas = params.canvasContext.canvas;
  }
  get completed() {
    return this.capability.promise.catch(function () {});
  }
  initializeGraphics({
    transparency = false,
    optionalContentConfig
  }) {
    if (this.cancelled) {
      return;
    }
    if (this._canvas) {
      if (InternalRenderTask.#canvasInUse.has(this._canvas)) {
        throw new Error("Cannot use the same canvas during multiple render() operations. " + "Use different canvas or ensure previous operations were " + "cancelled or completed.");
      }
      InternalRenderTask.#canvasInUse.add(this._canvas);
    }
    if (this._pdfBug && globalThis.StepperManager?.enabled) {
      this.stepper = globalThis.StepperManager.create(this._pageIndex);
      this.stepper.init(this.operatorList);
      this.stepper.nextBreakPoint = this.stepper.getNextBreakPoint();
    }
    const {
      canvasContext,
      viewport,
      transform,
      background
    } = this.params;
    this.gfx = new _canvas.CanvasGraphics(canvasContext, this.commonObjs, this.objs, this.canvasFactory, this.filterFactory, {
      optionalContentConfig
    }, this.annotationCanvasMap, this.pageColors);
    this.gfx.beginDrawing({
      transform,
      viewport,
      transparency,
      background
    });
    this.operatorListIdx = 0;
    this.graphicsReady = true;
    this.graphicsReadyCallback?.();
  }
  cancel(error = null, extraDelay = 0) {
    this.running = false;
    this.cancelled = true;
    this.gfx?.endDrawing();
    InternalRenderTask.#canvasInUse.delete(this._canvas);
    this.callback(error || new _display_utils.RenderingCancelledException(`Rendering cancelled, page ${this._pageIndex + 1}`, extraDelay));
  }
  operatorListChanged() {
    if (!this.graphicsReady) {
      this.graphicsReadyCallback ||= this._continueBound;
      return;
    }
    this.stepper?.updateOperatorList(this.operatorList);
    if (this.running) {
      return;
    }
    this._continue();
  }
  _continue() {
    this.running = true;
    if (this.cancelled) {
      return;
    }
    if (this.task.onContinue) {
      this.task.onContinue(this._scheduleNextBound);
    } else {
      this._scheduleNext();
    }
  }
  _scheduleNext() {
    if (this._useRequestAnimationFrame) {
      window.requestAnimationFrame(() => {
        this._nextBound().catch(this._cancelBound);
      });
    } else {
      Promise.resolve().then(this._nextBound).catch(this._cancelBound);
    }
  }
  async _next() {
    if (this.cancelled) {
      return;
    }
    this.operatorListIdx = this.gfx.executeOperatorList(this.operatorList, this.operatorListIdx, this._continueBound, this.stepper);
    if (this.operatorListIdx === this.operatorList.argsArray.length) {
      this.running = false;
      if (this.operatorList.lastChunk) {
        this.gfx.endDrawing();
        InternalRenderTask.#canvasInUse.delete(this._canvas);
        this.callback();
      }
    }
  }
}
const version = '3.11.174';
exports.version = version;
const build = 'ce8716743';
exports.build = build;

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.SerializableEmpty = exports.PrintAnnotationStorage = exports.AnnotationStorage = void 0;
var _util = __w_pdfjs_require__(1);
var _editor = __w_pdfjs_require__(4);
var _murmurhash = __w_pdfjs_require__(8);
const SerializableEmpty = Object.freeze({
  map: null,
  hash: "",
  transfers: undefined
});
exports.SerializableEmpty = SerializableEmpty;
class AnnotationStorage {
  #modified = false;
  #storage = new Map();
  constructor() {
    this.onSetModified = null;
    this.onResetModified = null;
    this.onAnnotationEditor = null;
  }
  getValue(key, defaultValue) {
    const value = this.#storage.get(key);
    if (value === undefined) {
      return defaultValue;
    }
    return Object.assign(defaultValue, value);
  }
  getRawValue(key) {
    return this.#storage.get(key);
  }
  remove(key) {
    this.#storage.delete(key);
    if (this.#storage.size === 0) {
      this.resetModified();
    }
    if (typeof this.onAnnotationEditor === "function") {
      for (const value of this.#storage.values()) {
        if (value instanceof _editor.AnnotationEditor) {
          return;
        }
      }
      this.onAnnotationEditor(null);
    }
  }
  setValue(key, value) {
    const obj = this.#storage.get(key);
    let modified = false;
    if (obj !== undefined) {
      for (const [entry, val] of Object.entries(value)) {
        if (obj[entry] !== val) {
          modified = true;
          obj[entry] = val;
        }
      }
    } else {
      modified = true;
      this.#storage.set(key, value);
    }
    if (modified) {
      this.#setModified();
    }
    if (value instanceof _editor.AnnotationEditor && typeof this.onAnnotationEditor === "function") {
      this.onAnnotationEditor(value.constructor._type);
    }
  }
  has(key) {
    return this.#storage.has(key);
  }
  getAll() {
    return this.#storage.size > 0 ? (0, _util.objectFromMap)(this.#storage) : null;
  }
  setAll(obj) {
    for (const [key, val] of Object.entries(obj)) {
      this.setValue(key, val);
    }
  }
  get size() {
    return this.#storage.size;
  }
  #setModified() {
    if (!this.#modified) {
      this.#modified = true;
      if (typeof this.onSetModified === "function") {
        this.onSetModified();
      }
    }
  }
  resetModified() {
    if (this.#modified) {
      this.#modified = false;
      if (typeof this.onResetModified === "function") {
        this.onResetModified();
      }
    }
  }
  get print() {
    return new PrintAnnotationStorage(this);
  }
  get serializable() {
    if (this.#storage.size === 0) {
      return SerializableEmpty;
    }
    const map = new Map(),
      hash = new _murmurhash.MurmurHash3_64(),
      transfers = [];
    const context = Object.create(null);
    let hasBitmap = false;
    for (const [key, val] of this.#storage) {
      const serialized = val instanceof _editor.AnnotationEditor ? val.serialize(false, context) : val;
      if (serialized) {
        map.set(key, serialized);
        hash.update(`${key}:${JSON.stringify(serialized)}`);
        hasBitmap ||= !!serialized.bitmap;
      }
    }
    if (hasBitmap) {
      for (const value of map.values()) {
        if (value.bitmap) {
          transfers.push(value.bitmap);
        }
      }
    }
    return map.size > 0 ? {
      map,
      hash: hash.hexdigest(),
      transfers
    } : SerializableEmpty;
  }
}
exports.AnnotationStorage = AnnotationStorage;
class PrintAnnotationStorage extends AnnotationStorage {
  #serializable;
  constructor(parent) {
    super();
    const {
      map,
      hash,
      transfers
    } = parent.serializable;
    const clone = structuredClone(map, transfers ? {
      transfer: transfers
    } : null);
    this.#serializable = {
      map: clone,
      hash,
      transfers
    };
  }
  get print() {
    (0, _util.unreachable)("Should not call PrintAnnotationStorage.print");
  }
  get serializable() {
    return this.#serializable;
  }
}
exports.PrintAnnotationStorage = PrintAnnotationStorage;

/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.AnnotationEditor = void 0;
var _tools = __w_pdfjs_require__(5);
var _util = __w_pdfjs_require__(1);
var _display_utils = __w_pdfjs_require__(6);
class AnnotationEditor {
  #altText = "";
  #altTextDecorative = false;
  #altTextButton = null;
  #altTextTooltip = null;
  #altTextTooltipTimeout = null;
  #keepAspectRatio = false;
  #resizersDiv = null;
  #boundFocusin = this.focusin.bind(this);
  #boundFocusout = this.focusout.bind(this);
  #hasBeenClicked = false;
  #isEditing = false;
  #isInEditMode = false;
  _initialOptions = Object.create(null);
  _uiManager = null;
  _focusEventsAllowed = true;
  _l10nPromise = null;
  #isDraggable = false;
  #zIndex = AnnotationEditor._zIndex++;
  static _borderLineWidth = -1;
  static _colorManager = new _tools.ColorManager();
  static _zIndex = 1;
  static SMALL_EDITOR_SIZE = 0;
  constructor(parameters) {
    if (this.constructor === AnnotationEditor) {
      (0, _util.unreachable)("Cannot initialize AnnotationEditor.");
    }
    this.parent = parameters.parent;
    this.id = parameters.id;
    this.width = this.height = null;
    this.pageIndex = parameters.parent.pageIndex;
    this.name = parameters.name;
    this.div = null;
    this._uiManager = parameters.uiManager;
    this.annotationElementId = null;
    this._willKeepAspectRatio = false;
    this._initialOptions.isCentered = parameters.isCentered;
    this._structTreeParentId = null;
    const {
      rotation,
      rawDims: {
        pageWidth,
        pageHeight,
        pageX,
        pageY
      }
    } = this.parent.viewport;
    this.rotation = rotation;
    this.pageRotation = (360 + rotation - this._uiManager.viewParameters.rotation) % 360;
    this.pageDimensions = [pageWidth, pageHeight];
    this.pageTranslation = [pageX, pageY];
    const [width, height] = this.parentDimensions;
    this.x = parameters.x / width;
    this.y = parameters.y / height;
    this.isAttachedToDOM = false;
    this.deleted = false;
  }
  get editorType() {
    return Object.getPrototypeOf(this).constructor._type;
  }
  static get _defaultLineColor() {
    return (0, _util.shadow)(this, "_defaultLineColor", this._colorManager.getHexCode("CanvasText"));
  }
  static deleteAnnotationElement(editor) {
    const fakeEditor = new FakeEditor({
      id: editor.parent.getNextId(),
      parent: editor.parent,
      uiManager: editor._uiManager
    });
    fakeEditor.annotationElementId = editor.annotationElementId;
    fakeEditor.deleted = true;
    fakeEditor._uiManager.addToAnnotationStorage(fakeEditor);
  }
  static initialize(l10n, options = null) {
    AnnotationEditor._l10nPromise ||= new Map(["editor_alt_text_button_label", "editor_alt_text_edit_button_label", "editor_alt_text_decorative_tooltip"].map(str => [str, l10n.get(str)]));
    if (options?.strings) {
      for (const str of options.strings) {
        AnnotationEditor._l10nPromise.set(str, l10n.get(str));
      }
    }
    if (AnnotationEditor._borderLineWidth !== -1) {
      return;
    }
    const style = getComputedStyle(document.documentElement);
    AnnotationEditor._borderLineWidth = parseFloat(style.getPropertyValue("--outline-width")) || 0;
  }
  static updateDefaultParams(_type, _value) {}
  static get defaultPropertiesToUpdate() {
    return [];
  }
  static isHandlingMimeForPasting(mime) {
    return false;
  }
  static paste(item, parent) {
    (0, _util.unreachable)("Not implemented");
  }
  get propertiesToUpdate() {
    return [];
  }
  get _isDraggable() {
    return this.#isDraggable;
  }
  set _isDraggable(value) {
    this.#isDraggable = value;
    this.div?.classList.toggle("draggable", value);
  }
  center() {
    const [pageWidth, pageHeight] = this.pageDimensions;
    switch (this.parentRotation) {
      case 90:
        this.x -= this.height * pageHeight / (pageWidth * 2);
        this.y += this.width * pageWidth / (pageHeight * 2);
        break;
      case 180:
        this.x += this.width / 2;
        this.y += this.height / 2;
        break;
      case 270:
        this.x += this.height * pageHeight / (pageWidth * 2);
        this.y -= this.width * pageWidth / (pageHeight * 2);
        break;
      default:
        this.x -= this.width / 2;
        this.y -= this.height / 2;
        break;
    }
    this.fixAndSetPosition();
  }
  addCommands(params) {
    this._uiManager.addCommands(params);
  }
  get currentLayer() {
    return this._uiManager.currentLayer;
  }
  setInBackground() {
    this.div.style.zIndex = 0;
  }
  setInForeground() {
    this.div.style.zIndex = this.#zIndex;
  }
  setParent(parent) {
    if (parent !== null) {
      this.pageIndex = parent.pageIndex;
      this.pageDimensions = parent.pageDimensions;
    }
    this.parent = parent;
  }
  focusin(event) {
    if (!this._focusEventsAllowed) {
      return;
    }
    if (!this.#hasBeenClicked) {
      this.parent.setSelected(this);
    } else {
      this.#hasBeenClicked = false;
    }
  }
  focusout(event) {
    if (!this._focusEventsAllowed) {
      return;
    }
    if (!this.isAttachedToDOM) {
      return;
    }
    const target = event.relatedTarget;
    if (target?.closest(`#${this.id}`)) {
      return;
    }
    event.preventDefault();
    if (!this.parent?.isMultipleSelection) {
      this.commitOrRemove();
    }
  }
  commitOrRemove() {
    if (this.isEmpty()) {
      this.remove();
    } else {
      this.commit();
    }
  }
  commit() {
    this.addToAnnotationStorage();
  }
  addToAnnotationStorage() {
    this._uiManager.addToAnnotationStorage(this);
  }
  setAt(x, y, tx, ty) {
    const [width, height] = this.parentDimensions;
    [tx, ty] = this.screenToPageTranslation(tx, ty);
    this.x = (x + tx) / width;
    this.y = (y + ty) / height;
    this.fixAndSetPosition();
  }
  #translate([width, height], x, y) {
    [x, y] = this.screenToPageTranslation(x, y);
    this.x += x / width;
    this.y += y / height;
    this.fixAndSetPosition();
  }
  translate(x, y) {
    this.#translate(this.parentDimensions, x, y);
  }
  translateInPage(x, y) {
    this.#translate(this.pageDimensions, x, y);
    this.div.scrollIntoView({
      block: "nearest"
    });
  }
  drag(tx, ty) {
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.x += tx / parentWidth;
    this.y += ty / parentHeight;
    if (this.parent && (this.x < 0 || this.x > 1 || this.y < 0 || this.y > 1)) {
      const {
        x,
        y
      } = this.div.getBoundingClientRect();
      if (this.parent.findNewParent(this, x, y)) {
        this.x -= Math.floor(this.x);
        this.y -= Math.floor(this.y);
      }
    }
    let {
      x,
      y
    } = this;
    const [bx, by] = this.#getBaseTranslation();
    x += bx;
    y += by;
    this.div.style.left = `${(100 * x).toFixed(2)}%`;
    this.div.style.top = `${(100 * y).toFixed(2)}%`;
    this.div.scrollIntoView({
      block: "nearest"
    });
  }
  #getBaseTranslation() {
    const [parentWidth, parentHeight] = this.parentDimensions;
    const {
      _borderLineWidth
    } = AnnotationEditor;
    const x = _borderLineWidth / parentWidth;
    const y = _borderLineWidth / parentHeight;
    switch (this.rotation) {
      case 90:
        return [-x, y];
      case 180:
        return [x, y];
      case 270:
        return [x, -y];
      default:
        return [-x, -y];
    }
  }
  fixAndSetPosition() {
    const [pageWidth, pageHeight] = this.pageDimensions;
    let {
      x,
      y,
      width,
      height
    } = this;
    width *= pageWidth;
    height *= pageHeight;
    x *= pageWidth;
    y *= pageHeight;
    switch (this.rotation) {
      case 0:
        x = Math.max(0, Math.min(pageWidth - width, x));
        y = Math.max(0, Math.min(pageHeight - height, y));
        break;
      case 90:
        x = Math.max(0, Math.min(pageWidth - height, x));
        y = Math.min(pageHeight, Math.max(width, y));
        break;
      case 180:
        x = Math.min(pageWidth, Math.max(width, x));
        y = Math.min(pageHeight, Math.max(height, y));
        break;
      case 270:
        x = Math.min(pageWidth, Math.max(height, x));
        y = Math.max(0, Math.min(pageHeight - width, y));
        break;
    }
    this.x = x /= pageWidth;
    this.y = y /= pageHeight;
    const [bx, by] = this.#getBaseTranslation();
    x += bx;
    y += by;
    const {
      style
    } = this.div;
    style.left = `${(100 * x).toFixed(2)}%`;
    style.top = `${(100 * y).toFixed(2)}%`;
    this.moveInDOM();
  }
  static #rotatePoint(x, y, angle) {
    switch (angle) {
      case 90:
        return [y, -x];
      case 180:
        return [-x, -y];
      case 270:
        return [-y, x];
      default:
        return [x, y];
    }
  }
  screenToPageTranslation(x, y) {
    return AnnotationEditor.#rotatePoint(x, y, this.parentRotation);
  }
  pageTranslationToScreen(x, y) {
    return AnnotationEditor.#rotatePoint(x, y, 360 - this.parentRotation);
  }
  #getRotationMatrix(rotation) {
    switch (rotation) {
      case 90:
        {
          const [pageWidth, pageHeight] = this.pageDimensions;
          return [0, -pageWidth / pageHeight, pageHeight / pageWidth, 0];
        }
      case 180:
        return [-1, 0, 0, -1];
      case 270:
        {
          const [pageWidth, pageHeight] = this.pageDimensions;
          return [0, pageWidth / pageHeight, -pageHeight / pageWidth, 0];
        }
      default:
        return [1, 0, 0, 1];
    }
  }
  get parentScale() {
    return this._uiManager.viewParameters.realScale;
  }
  get parentRotation() {
    return (this._uiManager.viewParameters.rotation + this.pageRotation) % 360;
  }
  get parentDimensions() {
    const {
      parentScale,
      pageDimensions: [pageWidth, pageHeight]
    } = this;
    const scaledWidth = pageWidth * parentScale;
    const scaledHeight = pageHeight * parentScale;
    return _util.FeatureTest.isCSSRoundSupported ? [Math.round(scaledWidth), Math.round(scaledHeight)] : [scaledWidth, scaledHeight];
  }
  setDims(width, height) {
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.div.style.width = `${(100 * width / parentWidth).toFixed(2)}%`;
    if (!this.#keepAspectRatio) {
      this.div.style.height = `${(100 * height / parentHeight).toFixed(2)}%`;
    }
    this.#altTextButton?.classList.toggle("small", width < AnnotationEditor.SMALL_EDITOR_SIZE || height < AnnotationEditor.SMALL_EDITOR_SIZE);
  }
  fixDims() {
    const {
      style
    } = this.div;
    const {
      height,
      width
    } = style;
    const widthPercent = width.endsWith("%");
    const heightPercent = !this.#keepAspectRatio && height.endsWith("%");
    if (widthPercent && heightPercent) {
      return;
    }
    const [parentWidth, parentHeight] = this.parentDimensions;
    if (!widthPercent) {
      style.width = `${(100 * parseFloat(width) / parentWidth).toFixed(2)}%`;
    }
    if (!this.#keepAspectRatio && !heightPercent) {
      style.height = `${(100 * parseFloat(height) / parentHeight).toFixed(2)}%`;
    }
  }
  getInitialTranslation() {
    return [0, 0];
  }
  #createResizers() {
    if (this.#resizersDiv) {
      return;
    }
    this.#resizersDiv = document.createElement("div");
    this.#resizersDiv.classList.add("resizers");
    const classes = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
    if (!this._willKeepAspectRatio) {
      classes.push("topMiddle", "middleRight", "bottomMiddle", "middleLeft");
    }
    for (const name of classes) {
      const div = document.createElement("div");
      this.#resizersDiv.append(div);
      div.classList.add("resizer", name);
      div.addEventListener("pointerdown", this.#resizerPointerdown.bind(this, name));
      div.addEventListener("contextmenu", _display_utils.noContextMenu);
    }
    this.div.prepend(this.#resizersDiv);
  }
  #resizerPointerdown(name, event) {
    event.preventDefault();
    const {
      isMac
    } = _util.FeatureTest.platform;
    if (event.button !== 0 || event.ctrlKey && isMac) {
      return;
    }
    const boundResizerPointermove = this.#resizerPointermove.bind(this, name);
    const savedDraggable = this._isDraggable;
    this._isDraggable = false;
    const pointerMoveOptions = {
      passive: true,
      capture: true
    };
    window.addEventListener("pointermove", boundResizerPointermove, pointerMoveOptions);
    const savedX = this.x;
    const savedY = this.y;
    const savedWidth = this.width;
    const savedHeight = this.height;
    const savedParentCursor = this.parent.div.style.cursor;
    const savedCursor = this.div.style.cursor;
    this.div.style.cursor = this.parent.div.style.cursor = window.getComputedStyle(event.target).cursor;
    const pointerUpCallback = () => {
      this._isDraggable = savedDraggable;
      window.removeEventListener("pointerup", pointerUpCallback);
      window.removeEventListener("blur", pointerUpCallback);
      window.removeEventListener("pointermove", boundResizerPointermove, pointerMoveOptions);
      this.parent.div.style.cursor = savedParentCursor;
      this.div.style.cursor = savedCursor;
      const newX = this.x;
      const newY = this.y;
      const newWidth = this.width;
      const newHeight = this.height;
      if (newX === savedX && newY === savedY && newWidth === savedWidth && newHeight === savedHeight) {
        return;
      }
      this.addCommands({
        cmd: () => {
          this.width = newWidth;
          this.height = newHeight;
          this.x = newX;
          this.y = newY;
          const [parentWidth, parentHeight] = this.parentDimensions;
          this.setDims(parentWidth * newWidth, parentHeight * newHeight);
          this.fixAndSetPosition();
        },
        undo: () => {
          this.width = savedWidth;
          this.height = savedHeight;
          this.x = savedX;
          this.y = savedY;
          const [parentWidth, parentHeight] = this.parentDimensions;
          this.setDims(parentWidth * savedWidth, parentHeight * savedHeight);
          this.fixAndSetPosition();
        },
        mustExec: true
      });
    };
    window.addEventListener("pointerup", pointerUpCallback);
    window.addEventListener("blur", pointerUpCallback);
  }
  #resizerPointermove(name, event) {
    const [parentWidth, parentHeight] = this.parentDimensions;
    const savedX = this.x;
    const savedY = this.y;
    const savedWidth = this.width;
    const savedHeight = this.height;
    const minWidth = AnnotationEditor.MIN_SIZE / parentWidth;
    const minHeight = AnnotationEditor.MIN_SIZE / parentHeight;
    const round = x => Math.round(x * 10000) / 10000;
    const rotationMatrix = this.#getRotationMatrix(this.rotation);
    const transf = (x, y) => [rotationMatrix[0] * x + rotationMatrix[2] * y, rotationMatrix[1] * x + rotationMatrix[3] * y];
    const invRotationMatrix = this.#getRotationMatrix(360 - this.rotation);
    const invTransf = (x, y) => [invRotationMatrix[0] * x + invRotationMatrix[2] * y, invRotationMatrix[1] * x + invRotationMatrix[3] * y];
    let getPoint;
    let getOpposite;
    let isDiagonal = false;
    let isHorizontal = false;
    switch (name) {
      case "topLeft":
        isDiagonal = true;
        getPoint = (w, h) => [0, 0];
        getOpposite = (w, h) => [w, h];
        break;
      case "topMiddle":
        getPoint = (w, h) => [w / 2, 0];
        getOpposite = (w, h) => [w / 2, h];
        break;
      case "topRight":
        isDiagonal = true;
        getPoint = (w, h) => [w, 0];
        getOpposite = (w, h) => [0, h];
        break;
      case "middleRight":
        isHorizontal = true;
        getPoint = (w, h) => [w, h / 2];
        getOpposite = (w, h) => [0, h / 2];
        break;
      case "bottomRight":
        isDiagonal = true;
        getPoint = (w, h) => [w, h];
        getOpposite = (w, h) => [0, 0];
        break;
      case "bottomMiddle":
        getPoint = (w, h) => [w / 2, h];
        getOpposite = (w, h) => [w / 2, 0];
        break;
      case "bottomLeft":
        isDiagonal = true;
        getPoint = (w, h) => [0, h];
        getOpposite = (w, h) => [w, 0];
        break;
      case "middleLeft":
        isHorizontal = true;
        getPoint = (w, h) => [0, h / 2];
        getOpposite = (w, h) => [w, h / 2];
        break;
    }
    const point = getPoint(savedWidth, savedHeight);
    const oppositePoint = getOpposite(savedWidth, savedHeight);
    let transfOppositePoint = transf(...oppositePoint);
    const oppositeX = round(savedX + transfOppositePoint[0]);
    const oppositeY = round(savedY + transfOppositePoint[1]);
    let ratioX = 1;
    let ratioY = 1;
    let [deltaX, deltaY] = this.screenToPageTranslation(event.movementX, event.movementY);
    [deltaX, deltaY] = invTransf(deltaX / parentWidth, deltaY / parentHeight);
    if (isDiagonal) {
      const oldDiag = Math.hypot(savedWidth, savedHeight);
      ratioX = ratioY = Math.max(Math.min(Math.hypot(oppositePoint[0] - point[0] - deltaX, oppositePoint[1] - point[1] - deltaY) / oldDiag, 1 / savedWidth, 1 / savedHeight), minWidth / savedWidth, minHeight / savedHeight);
    } else if (isHorizontal) {
      ratioX = Math.max(minWidth, Math.min(1, Math.abs(oppositePoint[0] - point[0] - deltaX))) / savedWidth;
    } else {
      ratioY = Math.max(minHeight, Math.min(1, Math.abs(oppositePoint[1] - point[1] - deltaY))) / savedHeight;
    }
    const newWidth = round(savedWidth * ratioX);
    const newHeight = round(savedHeight * ratioY);
    transfOppositePoint = transf(...getOpposite(newWidth, newHeight));
    const newX = oppositeX - transfOppositePoint[0];
    const newY = oppositeY - transfOppositePoint[1];
    this.width = newWidth;
    this.height = newHeight;
    this.x = newX;
    this.y = newY;
    this.setDims(parentWidth * newWidth, parentHeight * newHeight);
    this.fixAndSetPosition();
  }
  async addAltTextButton() {
    if (this.#altTextButton) {
      return;
    }
    const altText = this.#altTextButton = document.createElement("button");
    altText.className = "altText";
    const msg = await AnnotationEditor._l10nPromise.get("editor_alt_text_button_label");
    altText.textContent = msg;
    altText.setAttribute("aria-label", msg);
    altText.tabIndex = "0";
    altText.addEventListener("contextmenu", _display_utils.noContextMenu);
    altText.addEventListener("pointerdown", event => event.stopPropagation());
    altText.addEventListener("click", event => {
      event.preventDefault();
      this._uiManager.editAltText(this);
    }, {
      capture: true
    });
    altText.addEventListener("keydown", event => {
      if (event.target === altText && event.key === "Enter") {
        event.preventDefault();
        this._uiManager.editAltText(this);
      }
    });
    this.#setAltTextButtonState();
    this.div.append(altText);
    if (!AnnotationEditor.SMALL_EDITOR_SIZE) {
      const PERCENT = 40;
      AnnotationEditor.SMALL_EDITOR_SIZE = Math.min(128, Math.round(altText.getBoundingClientRect().width * (1 + PERCENT / 100)));
    }
  }
  async #setAltTextButtonState() {
    const button = this.#altTextButton;
    if (!button) {
      return;
    }
    if (!this.#altText && !this.#altTextDecorative) {
      button.classList.remove("done");
      this.#altTextTooltip?.remove();
      return;
    }
    AnnotationEditor._l10nPromise.get("editor_alt_text_edit_button_label").then(msg => {
      button.setAttribute("aria-label", msg);
    });
    let tooltip = this.#altTextTooltip;
    if (!tooltip) {
      this.#altTextTooltip = tooltip = document.createElement("span");
      tooltip.className = "tooltip";
      tooltip.setAttribute("role", "tooltip");
      const id = tooltip.id = `alt-text-tooltip-${this.id}`;
      button.setAttribute("aria-describedby", id);
      const DELAY_TO_SHOW_TOOLTIP = 100;
      button.addEventListener("mouseenter", () => {
        this.#altTextTooltipTimeout = setTimeout(() => {
          this.#altTextTooltipTimeout = null;
          this.#altTextTooltip.classList.add("show");
          this._uiManager._eventBus.dispatch("reporttelemetry", {
            source: this,
            details: {
              type: "editing",
              subtype: this.editorType,
              data: {
                action: "alt_text_tooltip"
              }
            }
          });
        }, DELAY_TO_SHOW_TOOLTIP);
      });
      button.addEventListener("mouseleave", () => {
        clearTimeout(this.#altTextTooltipTimeout);
        this.#altTextTooltipTimeout = null;
        this.#altTextTooltip?.classList.remove("show");
      });
    }
    button.classList.add("done");
    tooltip.innerText = this.#altTextDecorative ? await AnnotationEditor._l10nPromise.get("editor_alt_text_decorative_tooltip") : this.#altText;
    if (!tooltip.parentNode) {
      button.append(tooltip);
    }
  }
  getClientDimensions() {
    return this.div.getBoundingClientRect();
  }
  get altTextData() {
    return {
      altText: this.#altText,
      decorative: this.#altTextDecorative
    };
  }
  set altTextData({
    altText,
    decorative
  }) {
    if (this.#altText === altText && this.#altTextDecorative === decorative) {
      return;
    }
    this.#altText = altText;
    this.#altTextDecorative = decorative;
    this.#setAltTextButtonState();
  }
  render() {
    this.div = document.createElement("div");
    this.div.setAttribute("data-editor-rotation", (360 - this.rotation) % 360);
    this.div.className = this.name;
    this.div.setAttribute("id", this.id);
    this.div.setAttribute("tabIndex", 0);
    this.setInForeground();
    this.div.addEventListener("focusin", this.#boundFocusin);
    this.div.addEventListener("focusout", this.#boundFocusout);
    const [parentWidth, parentHeight] = this.parentDimensions;
    if (this.parentRotation % 180 !== 0) {
      this.div.style.maxWidth = `${(100 * parentHeight / parentWidth).toFixed(2)}%`;
      this.div.style.maxHeight = `${(100 * parentWidth / parentHeight).toFixed(2)}%`;
    }
    const [tx, ty] = this.getInitialTranslation();
    this.translate(tx, ty);
    (0, _tools.bindEvents)(this, this.div, ["pointerdown"]);
    return this.div;
  }
  pointerdown(event) {
    const {
      isMac
    } = _util.FeatureTest.platform;
    if (event.button !== 0 || event.ctrlKey && isMac) {
      event.preventDefault();
      return;
    }
    this.#hasBeenClicked = true;
    this.#setUpDragSession(event);
  }
  #setUpDragSession(event) {
    if (!this._isDraggable) {
      return;
    }
    const isSelected = this._uiManager.isSelected(this);
    this._uiManager.setUpDragSession();
    let pointerMoveOptions, pointerMoveCallback;
    if (isSelected) {
      pointerMoveOptions = {
        passive: true,
        capture: true
      };
      pointerMoveCallback = e => {
        const [tx, ty] = this.screenToPageTranslation(e.movementX, e.movementY);
        this._uiManager.dragSelectedEditors(tx, ty);
      };
      window.addEventListener("pointermove", pointerMoveCallback, pointerMoveOptions);
    }
    const pointerUpCallback = () => {
      window.removeEventListener("pointerup", pointerUpCallback);
      window.removeEventListener("blur", pointerUpCallback);
      if (isSelected) {
        window.removeEventListener("pointermove", pointerMoveCallback, pointerMoveOptions);
      }
      this.#hasBeenClicked = false;
      if (!this._uiManager.endDragSession()) {
        const {
          isMac
        } = _util.FeatureTest.platform;
        if (event.ctrlKey && !isMac || event.shiftKey || event.metaKey && isMac) {
          this.parent.toggleSelected(this);
        } else {
          this.parent.setSelected(this);
        }
      }
    };
    window.addEventListener("pointerup", pointerUpCallback);
    window.addEventListener("blur", pointerUpCallback);
  }
  moveInDOM() {
    this.parent?.moveEditorInDOM(this);
  }
  _setParentAndPosition(parent, x, y) {
    parent.changeParent(this);
    this.x = x;
    this.y = y;
    this.fixAndSetPosition();
  }
  getRect(tx, ty) {
    const scale = this.parentScale;
    const [pageWidth, pageHeight] = this.pageDimensions;
    const [pageX, pageY] = this.pageTranslation;
    const shiftX = tx / scale;
    const shiftY = ty / scale;
    const x = this.x * pageWidth;
    const y = this.y * pageHeight;
    const width = this.width * pageWidth;
    const height = this.height * pageHeight;
    switch (this.rotation) {
      case 0:
        return [x + shiftX + pageX, pageHeight - y - shiftY - height + pageY, x + shiftX + width + pageX, pageHeight - y - shiftY + pageY];
      case 90:
        return [x + shiftY + pageX, pageHeight - y + shiftX + pageY, x + shiftY + height + pageX, pageHeight - y + shiftX + width + pageY];
      case 180:
        return [x - shiftX - width + pageX, pageHeight - y + shiftY + pageY, x - shiftX + pageX, pageHeight - y + shiftY + height + pageY];
      case 270:
        return [x - shiftY - height + pageX, pageHeight - y - shiftX - width + pageY, x - shiftY + pageX, pageHeight - y - shiftX + pageY];
      default:
        throw new Error("Invalid rotation");
    }
  }
  getRectInCurrentCoords(rect, pageHeight) {
    const [x1, y1, x2, y2] = rect;
    const width = x2 - x1;
    const height = y2 - y1;
    switch (this.rotation) {
      case 0:
        return [x1, pageHeight - y2, width, height];
      case 90:
        return [x1, pageHeight - y1, height, width];
      case 180:
        return [x2, pageHeight - y1, width, height];
      case 270:
        return [x2, pageHeight - y2, height, width];
      default:
        throw new Error("Invalid rotation");
    }
  }
  onceAdded() {}
  isEmpty() {
    return false;
  }
  enableEditMode() {
    this.#isInEditMode = true;
  }
  disableEditMode() {
    this.#isInEditMode = false;
  }
  isInEditMode() {
    return this.#isInEditMode;
  }
  shouldGetKeyboardEvents() {
    return false;
  }
  needsToBeRebuilt() {
    return this.div && !this.isAttachedToDOM;
  }
  rebuild() {
    this.div?.addEventListener("focusin", this.#boundFocusin);
    this.div?.addEventListener("focusout", this.#boundFocusout);
  }
  serialize(isForCopying = false, context = null) {
    (0, _util.unreachable)("An editor must be serializable");
  }
  static deserialize(data, parent, uiManager) {
    const editor = new this.prototype.constructor({
      parent,
      id: parent.getNextId(),
      uiManager
    });
    editor.rotation = data.rotation;
    const [pageWidth, pageHeight] = editor.pageDimensions;
    const [x, y, width, height] = editor.getRectInCurrentCoords(data.rect, pageHeight);
    editor.x = x / pageWidth;
    editor.y = y / pageHeight;
    editor.width = width / pageWidth;
    editor.height = height / pageHeight;
    return editor;
  }
  remove() {
    this.div.removeEventListener("focusin", this.#boundFocusin);
    this.div.removeEventListener("focusout", this.#boundFocusout);
    if (!this.isEmpty()) {
      this.commit();
    }
    if (this.parent) {
      this.parent.remove(this);
    } else {
      this._uiManager.removeEditor(this);
    }
    this.#altTextButton?.remove();
    this.#altTextButton = null;
    this.#altTextTooltip = null;
  }
  get isResizable() {
    return false;
  }
  makeResizable() {
    if (this.isResizable) {
      this.#createResizers();
      this.#resizersDiv.classList.remove("hidden");
    }
  }
  select() {
    this.makeResizable();
    this.div?.classList.add("selectedEditor");
  }
  unselect() {
    this.#resizersDiv?.classList.add("hidden");
    this.div?.classList.remove("selectedEditor");
    if (this.div?.contains(document.activeElement)) {
      this._uiManager.currentLayer.div.focus();
    }
  }
  updateParams(type, value) {}
  disableEditing() {
    if (this.#altTextButton) {
      this.#altTextButton.hidden = true;
    }
  }
  enableEditing() {
    if (this.#altTextButton) {
      this.#altTextButton.hidden = false;
    }
  }
  enterInEditMode() {}
  get contentDiv() {
    return this.div;
  }
  get isEditing() {
    return this.#isEditing;
  }
  set isEditing(value) {
    this.#isEditing = value;
    if (!this.parent) {
      return;
    }
    if (value) {
      this.parent.setSelected(this);
      this.parent.setActiveEditor(this);
    } else {
      this.parent.setActiveEditor(null);
    }
  }
  setAspectRatio(width, height) {
    this.#keepAspectRatio = true;
    const aspectRatio = width / height;
    const {
      style
    } = this.div;
    style.aspectRatio = aspectRatio;
    style.height = "auto";
  }
  static get MIN_SIZE() {
    return 16;
  }
}
exports.AnnotationEditor = AnnotationEditor;
class FakeEditor extends AnnotationEditor {
  constructor(params) {
    super(params);
    this.annotationElementId = params.annotationElementId;
    this.deleted = true;
  }
  serialize() {
    return {
      id: this.annotationElementId,
      deleted: true,
      pageIndex: this.pageIndex
    };
  }
}

/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.KeyboardManager = exports.CommandManager = exports.ColorManager = exports.AnnotationEditorUIManager = void 0;
exports.bindEvents = bindEvents;
exports.opacityToHex = opacityToHex;
var _util = __w_pdfjs_require__(1);
var _display_utils = __w_pdfjs_require__(6);
function bindEvents(obj, element, names) {
  for (const name of names) {
    element.addEventListener(name, obj[name].bind(obj));
  }
}
function opacityToHex(opacity) {
  return Math.round(Math.min(255, Math.max(1, 255 * opacity))).toString(16).padStart(2, "0");
}
class IdManager {
  #id = 0;
  getId() {
    return `${_util.AnnotationEditorPrefix}${this.#id++}`;
  }
}
class ImageManager {
  #baseId = (0, _util.getUuid)();
  #id = 0;
  #cache = null;
  static get _isSVGFittingCanvas() {
    const svg = `data:image/svg+xml;charset=UTF-8,<svg viewBox="0 0 1 1" width="1" height="1" xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" style="fill:red;"/></svg>`;
    const canvas = new OffscreenCanvas(1, 3);
    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.src = svg;
    const promise = image.decode().then(() => {
      ctx.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 3);
      return new Uint32Array(ctx.getImageData(0, 0, 1, 1).data.buffer)[0] === 0;
    });
    return (0, _util.shadow)(this, "_isSVGFittingCanvas", promise);
  }
  async #get(key, rawData) {
    this.#cache ||= new Map();
    let data = this.#cache.get(key);
    if (data === null) {
      return null;
    }
    if (data?.bitmap) {
      data.refCounter += 1;
      return data;
    }
    try {
      data ||= {
        bitmap: null,
        id: `image_${this.#baseId}_${this.#id++}`,
        refCounter: 0,
        isSvg: false
      };
      let image;
      if (typeof rawData === "string") {
        data.url = rawData;
        const response = await fetch(rawData);
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        image = await response.blob();
      } else {
        image = data.file = rawData;
      }
      if (image.type === "image/svg+xml") {
        const mustRemoveAspectRatioPromise = ImageManager._isSVGFittingCanvas;
        const fileReader = new FileReader();
        const imageElement = new Image();
        const imagePromise = new Promise((resolve, reject) => {
          imageElement.onload = () => {
            data.bitmap = imageElement;
            data.isSvg = true;
            resolve();
          };
          fileReader.onload = async () => {
            const url = data.svgUrl = fileReader.result;
            imageElement.src = (await mustRemoveAspectRatioPromise) ? `${url}#svgView(preserveAspectRatio(none))` : url;
          };
          imageElement.onerror = fileReader.onerror = reject;
        });
        fileReader.readAsDataURL(image);
        await imagePromise;
      } else {
        data.bitmap = await createImageBitmap(image);
      }
      data.refCounter = 1;
    } catch (e) {
      console.error(e);
      data = null;
    }
    this.#cache.set(key, data);
    if (data) {
      this.#cache.set(data.id, data);
    }
    return data;
  }
  async getFromFile(file) {
    const {
      lastModified,
      name,
      size,
      type
    } = file;
    return this.#get(`${lastModified}_${name}_${size}_${type}`, file);
  }
  async getFromUrl(url) {
    return this.#get(url, url);
  }
  async getFromId(id) {
    this.#cache ||= new Map();
    const data = this.#cache.get(id);
    if (!data) {
      return null;
    }
    if (data.bitmap) {
      data.refCounter += 1;
      return data;
    }
    if (data.file) {
      return this.getFromFile(data.file);
    }
    return this.getFromUrl(data.url);
  }
  getSvgUrl(id) {
    const data = this.#cache.get(id);
    if (!data?.isSvg) {
      return null;
    }
    return data.svgUrl;
  }
  deleteId(id) {
    this.#cache ||= new Map();
    const data = this.#cache.get(id);
    if (!data) {
      return;
    }
    data.refCounter -= 1;
    if (data.refCounter !== 0) {
      return;
    }
    data.bitmap = null;
  }
  isValidId(id) {
    return id.startsWith(`image_${this.#baseId}_`);
  }
}
class CommandManager {
  #commands = [];
  #locked = false;
  #maxSize;
  #position = -1;
  constructor(maxSize = 128) {
    this.#maxSize = maxSize;
  }
  add({
    cmd,
    undo,
    mustExec,
    type = NaN,
    overwriteIfSameType = false,
    keepUndo = false
  }) {
    if (mustExec) {
      cmd();
    }
    if (this.#locked) {
      return;
    }
    const save = {
      cmd,
      undo,
      type
    };
    if (this.#position === -1) {
      if (this.#commands.length > 0) {
        this.#commands.length = 0;
      }
      this.#position = 0;
      this.#commands.push(save);
      return;
    }
    if (overwriteIfSameType && this.#commands[this.#position].type === type) {
      if (keepUndo) {
        save.undo = this.#commands[this.#position].undo;
      }
      this.#commands[this.#position] = save;
      return;
    }
    const next = this.#position + 1;
    if (next === this.#maxSize) {
      this.#commands.splice(0, 1);
    } else {
      this.#position = next;
      if (next < this.#commands.length) {
        this.#commands.splice(next);
      }
    }
    this.#commands.push(save);
  }
  undo() {
    if (this.#position === -1) {
      return;
    }
    this.#locked = true;
    this.#commands[this.#position].undo();
    this.#locked = false;
    this.#position -= 1;
  }
  redo() {
    if (this.#position < this.#commands.length - 1) {
      this.#position += 1;
      this.#locked = true;
      this.#commands[this.#position].cmd();
      this.#locked = false;
    }
  }
  hasSomethingToUndo() {
    return this.#position !== -1;
  }
  hasSomethingToRedo() {
    return this.#position < this.#commands.length - 1;
  }
  destroy() {
    this.#commands = null;
  }
}
exports.CommandManager = CommandManager;
class KeyboardManager {
  constructor(callbacks) {
    this.buffer = [];
    this.callbacks = new Map();
    this.allKeys = new Set();
    const {
      isMac
    } = _util.FeatureTest.platform;
    for (const [keys, callback, options = {}] of callbacks) {
      for (const key of keys) {
        const isMacKey = key.startsWith("mac+");
        if (isMac && isMacKey) {
          this.callbacks.set(key.slice(4), {
            callback,
            options
          });
          this.allKeys.add(key.split("+").at(-1));
        } else if (!isMac && !isMacKey) {
          this.callbacks.set(key, {
            callback,
            options
          });
          this.allKeys.add(key.split("+").at(-1));
        }
      }
    }
  }
  #serialize(event) {
    if (event.altKey) {
      this.buffer.push("alt");
    }
    if (event.ctrlKey) {
      this.buffer.push("ctrl");
    }
    if (event.metaKey) {
      this.buffer.push("meta");
    }
    if (event.shiftKey) {
      this.buffer.push("shift");
    }
    this.buffer.push(event.key);
    const str = this.buffer.join("+");
    this.buffer.length = 0;
    return str;
  }
  exec(self, event) {
    if (!this.allKeys.has(event.key)) {
      return;
    }
    const info = this.callbacks.get(this.#serialize(event));
    if (!info) {
      return;
    }
    const {
      callback,
      options: {
        bubbles = false,
        args = [],
        checker = null
      }
    } = info;
    if (checker && !checker(self, event)) {
      return;
    }
    callback.bind(self, ...args)();
    if (!bubbles) {
      event.stopPropagation();
      event.preventDefault();
    }
  }
}
exports.KeyboardManager = KeyboardManager;
class ColorManager {
  static _colorsMapping = new Map([["CanvasText", [0, 0, 0]], ["Canvas", [255, 255, 255]]]);
  get _colors() {
    const colors = new Map([["CanvasText", null], ["Canvas", null]]);
    (0, _display_utils.getColorValues)(colors);
    return (0, _util.shadow)(this, "_colors", colors);
  }
  convert(color) {
    const rgb = (0, _display_utils.getRGB)(color);
    if (!window.matchMedia("(forced-colors: active)").matches) {
      return rgb;
    }
    for (const [name, RGB] of this._colors) {
      if (RGB.every((x, i) => x === rgb[i])) {
        return ColorManager._colorsMapping.get(name);
      }
    }
    return rgb;
  }
  getHexCode(name) {
    const rgb = this._colors.get(name);
    if (!rgb) {
      return name;
    }
    return _util.Util.makeHexColor(...rgb);
  }
}
exports.ColorManager = ColorManager;
class AnnotationEditorUIManager {
  #activeEditor = null;
  #allEditors = new Map();
  #allLayers = new Map();
  #altTextManager = null;
  #annotationStorage = null;
  #commandManager = new CommandManager();
  #currentPageIndex = 0;
  #deletedAnnotationsElementIds = new Set();
  #draggingEditors = null;
  #editorTypes = null;
  #editorsToRescale = new Set();
  #filterFactory = null;
  #idManager = new IdManager();
  #isEnabled = false;
  #isWaiting = false;
  #lastActiveElement = null;
  #mode = _util.AnnotationEditorType.NONE;
  #selectedEditors = new Set();
  #pageColors = null;
  #boundBlur = this.blur.bind(this);
  #boundFocus = this.focus.bind(this);
  #boundCopy = this.copy.bind(this);
  #boundCut = this.cut.bind(this);
  #boundPaste = this.paste.bind(this);
  #boundKeydown = this.keydown.bind(this);
  #boundOnEditingAction = this.onEditingAction.bind(this);
  #boundOnPageChanging = this.onPageChanging.bind(this);
  #boundOnScaleChanging = this.onScaleChanging.bind(this);
  #boundOnRotationChanging = this.onRotationChanging.bind(this);
  #previousStates = {
    isEditing: false,
    isEmpty: true,
    hasSomethingToUndo: false,
    hasSomethingToRedo: false,
    hasSelectedEditor: false
  };
  #translation = [0, 0];
  #translationTimeoutId = null;
  #container = null;
  #viewer = null;
  static TRANSLATE_SMALL = 1;
  static TRANSLATE_BIG = 10;
  static get _keyboardManager() {
    const proto = AnnotationEditorUIManager.prototype;
    const arrowChecker = self => {
      const {
        activeElement
      } = document;
      return activeElement && self.#container.contains(activeElement) && self.hasSomethingToControl();
    };
    const small = this.TRANSLATE_SMALL;
    const big = this.TRANSLATE_BIG;
    return (0, _util.shadow)(this, "_keyboardManager", new KeyboardManager([[["ctrl+a", "mac+meta+a"], proto.selectAll], [["ctrl+z", "mac+meta+z"], proto.undo], [["ctrl+y", "ctrl+shift+z", "mac+meta+shift+z", "ctrl+shift+Z", "mac+meta+shift+Z"], proto.redo], [["Backspace", "alt+Backspace", "ctrl+Backspace", "shift+Backspace", "mac+Backspace", "mac+alt+Backspace", "mac+ctrl+Backspace", "Delete", "ctrl+Delete", "shift+Delete", "mac+Delete"], proto.delete], [["Escape", "mac+Escape"], proto.unselectAll], [["ArrowLeft", "mac+ArrowLeft"], proto.translateSelectedEditors, {
      args: [-small, 0],
      checker: arrowChecker
    }], [["ctrl+ArrowLeft", "mac+shift+ArrowLeft"], proto.translateSelectedEditors, {
      args: [-big, 0],
      checker: arrowChecker
    }], [["ArrowRight", "mac+ArrowRight"], proto.translateSelectedEditors, {
      args: [small, 0],
      checker: arrowChecker
    }], [["ctrl+ArrowRight", "mac+shift+ArrowRight"], proto.translateSelectedEditors, {
      args: [big, 0],
      checker: arrowChecker
    }], [["ArrowUp", "mac+ArrowUp"], proto.translateSelectedEditors, {
      args: [0, -small],
      checker: arrowChecker
    }], [["ctrl+ArrowUp", "mac+shift+ArrowUp"], proto.translateSelectedEditors, {
      args: [0, -big],
      checker: arrowChecker
    }], [["ArrowDown", "mac+ArrowDown"], proto.translateSelectedEditors, {
      args: [0, small],
      checker: arrowChecker
    }], [["ctrl+ArrowDown", "mac+shift+ArrowDown"], proto.translateSelectedEditors, {
      args: [0, big],
      checker: arrowChecker
    }]]));
  }
  constructor(container, viewer, altTextManager, eventBus, pdfDocument, pageColors) {
    this.#container = container;
    this.#viewer = viewer;
    this.#altTextManager = altTextManager;
    this._eventBus = eventBus;
    this._eventBus._on("editingaction", this.#boundOnEditingAction);
    this._eventBus._on("pagechanging", this.#boundOnPageChanging);
    this._eventBus._on("scalechanging", this.#boundOnScaleChanging);
    this._eventBus._on("rotationchanging", this.#boundOnRotationChanging);
    this.#annotationStorage = pdfDocument.annotationStorage;
    this.#filterFactory = pdfDocument.filterFactory;
    this.#pageColors = pageColors;
    this.viewParameters = {
      realScale: _display_utils.PixelsPerInch.PDF_TO_CSS_UNITS,
      rotation: 0
    };
  }
  destroy() {
    this.#removeKeyboardManager();
    this.#removeFocusManager();
    this._eventBus._off("editingaction", this.#boundOnEditingAction);
    this._eventBus._off("pagechanging", this.#boundOnPageChanging);
    this._eventBus._off("scalechanging", this.#boundOnScaleChanging);
    this._eventBus._off("rotationchanging", this.#boundOnRotationChanging);
    for (const layer of this.#allLayers.values()) {
      layer.destroy();
    }
    this.#allLayers.clear();
    this.#allEditors.clear();
    this.#editorsToRescale.clear();
    this.#activeEditor = null;
    this.#selectedEditors.clear();
    this.#commandManager.destroy();
    this.#altTextManager.destroy();
  }
  get hcmFilter() {
    return (0, _util.shadow)(this, "hcmFilter", this.#pageColors ? this.#filterFactory.addHCMFilter(this.#pageColors.foreground, this.#pageColors.background) : "none");
  }
  get direction() {
    return (0, _util.shadow)(this, "direction", getComputedStyle(this.#container).direction);
  }
  editAltText(editor) {
    this.#altTextManager?.editAltText(this, editor);
  }
  onPageChanging({
    pageNumber
  }) {
    this.#currentPageIndex = pageNumber - 1;
  }
  focusMainContainer() {
    this.#container.focus();
  }
  findParent(x, y) {
    for (const layer of this.#allLayers.values()) {
      const {
        x: layerX,
        y: layerY,
        width,
        height
      } = layer.div.getBoundingClientRect();
      if (x >= layerX && x <= layerX + width && y >= layerY && y <= layerY + height) {
        return layer;
      }
    }
    return null;
  }
  disableUserSelect(value = false) {
    this.#viewer.classList.toggle("noUserSelect", value);
  }
  addShouldRescale(editor) {
    this.#editorsToRescale.add(editor);
  }
  removeShouldRescale(editor) {
    this.#editorsToRescale.delete(editor);
  }
  onScaleChanging({
    scale
  }) {
    this.commitOrRemove();
    this.viewParameters.realScale = scale * _display_utils.PixelsPerInch.PDF_TO_CSS_UNITS;
    for (const editor of this.#editorsToRescale) {
      editor.onScaleChanging();
    }
  }
  onRotationChanging({
    pagesRotation
  }) {
    this.commitOrRemove();
    this.viewParameters.rotation = pagesRotation;
  }
  addToAnnotationStorage(editor) {
    if (!editor.isEmpty() && this.#annotationStorage && !this.#annotationStorage.has(editor.id)) {
      this.#annotationStorage.setValue(editor.id, editor);
    }
  }
  #addFocusManager() {
    window.addEventListener("focus", this.#boundFocus);
    window.addEventListener("blur", this.#boundBlur);
  }
  #removeFocusManager() {
    window.removeEventListener("focus", this.#boundFocus);
    window.removeEventListener("blur", this.#boundBlur);
  }
  blur() {
    if (!this.hasSelection) {
      return;
    }
    const {
      activeElement
    } = document;
    for (const editor of this.#selectedEditors) {
      if (editor.div.contains(activeElement)) {
        this.#lastActiveElement = [editor, activeElement];
        editor._focusEventsAllowed = false;
        break;
      }
    }
  }
  focus() {
    if (!this.#lastActiveElement) {
      return;
    }
    const [lastEditor, lastActiveElement] = this.#lastActiveElement;
    this.#lastActiveElement = null;
    lastActiveElement.addEventListener("focusin", () => {
      lastEditor._focusEventsAllowed = true;
    }, {
      once: true
    });
    lastActiveElement.focus();
  }
  #addKeyboardManager() {
    window.addEventListener("keydown", this.#boundKeydown, {
      capture: true
    });
  }
  #removeKeyboardManager() {
    window.removeEventListener("keydown", this.#boundKeydown, {
      capture: true
    });
  }
  #addCopyPasteListeners() {
    document.addEventListener("copy", this.#boundCopy);
    document.addEventListener("cut", this.#boundCut);
    document.addEventListener("paste", this.#boundPaste);
  }
  #removeCopyPasteListeners() {
    document.removeEventListener("copy", this.#boundCopy);
    document.removeEventListener("cut", this.#boundCut);
    document.removeEventListener("paste", this.#boundPaste);
  }
  addEditListeners() {
    this.#addKeyboardManager();
    this.#addCopyPasteListeners();
  }
  removeEditListeners() {
    this.#removeKeyboardManager();
    this.#removeCopyPasteListeners();
  }
  copy(event) {
    event.preventDefault();
    this.#activeEditor?.commitOrRemove();
    if (!this.hasSelection) {
      return;
    }
    const editors = [];
    for (const editor of this.#selectedEditors) {
      const serialized = editor.serialize(true);
      if (serialized) {
        editors.push(serialized);
      }
    }
    if (editors.length === 0) {
      return;
    }
    event.clipboardData.setData("application/pdfjs", JSON.stringify(editors));
  }
  cut(event) {
    this.copy(event);
    this.delete();
  }
  paste(event) {
    event.preventDefault();
    const {
      clipboardData
    } = event;
    for (const item of clipboardData.items) {
      for (const editorType of this.#editorTypes) {
        if (editorType.isHandlingMimeForPasting(item.type)) {
          editorType.paste(item, this.currentLayer);
          return;
        }
      }
    }
    let data = clipboardData.getData("application/pdfjs");
    if (!data) {
      return;
    }
    try {
      data = JSON.parse(data);
    } catch (ex) {
      (0, _util.warn)(`paste: "${ex.message}".`);
      return;
    }
    if (!Array.isArray(data)) {
      return;
    }
    this.unselectAll();
    const layer = this.currentLayer;
    try {
      const newEditors = [];
      for (const editor of data) {
        const deserializedEditor = layer.deserialize(editor);
        if (!deserializedEditor) {
          return;
        }
        newEditors.push(deserializedEditor);
      }
      const cmd = () => {
        for (const editor of newEditors) {
          this.#addEditorToLayer(editor);
        }
        this.#selectEditors(newEditors);
      };
      const undo = () => {
        for (const editor of newEditors) {
          editor.remove();
        }
      };
      this.addCommands({
        cmd,
        undo,
        mustExec: true
      });
    } catch (ex) {
      (0, _util.warn)(`paste: "${ex.message}".`);
    }
  }
  keydown(event) {
    if (!this.getActive()?.shouldGetKeyboardEvents()) {
      AnnotationEditorUIManager._keyboardManager.exec(this, event);
    }
  }
  onEditingAction(details) {
    if (["undo", "redo", "delete", "selectAll"].includes(details.name)) {
      this[details.name]();
    }
  }
  #dispatchUpdateStates(details) {
    const hasChanged = Object.entries(details).some(([key, value]) => this.#previousStates[key] !== value);
    if (hasChanged) {
      this._eventBus.dispatch("annotationeditorstateschanged", {
        source: this,
        details: Object.assign(this.#previousStates, details)
      });
    }
  }
  #dispatchUpdateUI(details) {
    this._eventBus.dispatch("annotationeditorparamschanged", {
      source: this,
      details
    });
  }
  setEditingState(isEditing) {
    if (isEditing) {
      this.#addFocusManager();
      this.#addKeyboardManager();
      this.#addCopyPasteListeners();
      this.#dispatchUpdateStates({
        isEditing: this.#mode !== _util.AnnotationEditorType.NONE,
        isEmpty: this.#isEmpty(),
        hasSomethingToUndo: this.#commandManager.hasSomethingToUndo(),
        hasSomethingToRedo: this.#commandManager.hasSomethingToRedo(),
        hasSelectedEditor: false
      });
    } else {
      this.#removeFocusManager();
      this.#removeKeyboardManager();
      this.#removeCopyPasteListeners();
      this.#dispatchUpdateStates({
        isEditing: false
      });
      this.disableUserSelect(false);
    }
  }
  registerEditorTypes(types) {
    if (this.#editorTypes) {
      return;
    }
    this.#editorTypes = types;
    for (const editorType of this.#editorTypes) {
      this.#dispatchUpdateUI(editorType.defaultPropertiesToUpdate);
    }
  }
  getId() {
    return this.#idManager.getId();
  }
  get currentLayer() {
    return this.#allLayers.get(this.#currentPageIndex);
  }
  getLayer(pageIndex) {
    return this.#allLayers.get(pageIndex);
  }
  get currentPageIndex() {
    return this.#currentPageIndex;
  }
  addLayer(layer) {
    this.#allLayers.set(layer.pageIndex, layer);
    if (this.#isEnabled) {
      layer.enable();
    } else {
      layer.disable();
    }
  }
  removeLayer(layer) {
    this.#allLayers.delete(layer.pageIndex);
  }
  updateMode(mode, editId = null) {
    if (this.#mode === mode) {
      return;
    }
    this.#mode = mode;
    if (mode === _util.AnnotationEditorType.NONE) {
      this.setEditingState(false);
      this.#disableAll();
      return;
    }
    this.setEditingState(true);
    this.#enableAll();
    this.unselectAll();
    for (const layer of this.#allLayers.values()) {
      layer.updateMode(mode);
    }
    if (!editId) {
      return;
    }
    for (const editor of this.#allEditors.values()) {
      if (editor.annotationElementId === editId) {
        this.setSelected(editor);
        editor.enterInEditMode();
        break;
      }
    }
  }
  updateToolbar(mode) {
    if (mode === this.#mode) {
      return;
    }
    this._eventBus.dispatch("switchannotationeditormode", {
      source: this,
      mode
    });
  }
  updateParams(type, value) {
    if (!this.#editorTypes) {
      return;
    }
    if (type === _util.AnnotationEditorParamsType.CREATE) {
      this.currentLayer.addNewEditor(type);
      return;
    }
    for (const editor of this.#selectedEditors) {
      editor.updateParams(type, value);
    }
    for (const editorType of this.#editorTypes) {
      editorType.updateDefaultParams(type, value);
    }
  }
  enableWaiting(mustWait = false) {
    if (this.#isWaiting === mustWait) {
      return;
    }
    this.#isWaiting = mustWait;
    for (const layer of this.#allLayers.values()) {
      if (mustWait) {
        layer.disableClick();
      } else {
        layer.enableClick();
      }
      layer.div.classList.toggle("waiting", mustWait);
    }
  }
  #enableAll() {
    if (!this.#isEnabled) {
      this.#isEnabled = true;
      for (const layer of this.#allLayers.values()) {
        layer.enable();
      }
    }
  }
  #disableAll() {
    this.unselectAll();
    if (this.#isEnabled) {
      this.#isEnabled = false;
      for (const layer of this.#allLayers.values()) {
        layer.disable();
      }
    }
  }
  getEditors(pageIndex) {
    const editors = [];
    for (const editor of this.#allEditors.values()) {
      if (editor.pageIndex === pageIndex) {
        editors.push(editor);
      }
    }
    return editors;
  }
  getEditor(id) {
    return this.#allEditors.get(id);
  }
  addEditor(editor) {
    this.#allEditors.set(editor.id, editor);
  }
  removeEditor(editor) {
    this.#allEditors.delete(editor.id);
    this.unselect(editor);
    if (!editor.annotationElementId || !this.#deletedAnnotationsElementIds.has(editor.annotationElementId)) {
      this.#annotationStorage?.remove(editor.id);
    }
  }
  addDeletedAnnotationElement(editor) {
    this.#deletedAnnotationsElementIds.add(editor.annotationElementId);
    editor.deleted = true;
  }
  isDeletedAnnotationElement(annotationElementId) {
    return this.#deletedAnnotationsElementIds.has(annotationElementId);
  }
  removeDeletedAnnotationElement(editor) {
    this.#deletedAnnotationsElementIds.delete(editor.annotationElementId);
    editor.deleted = false;
  }
  #addEditorToLayer(editor) {
    const layer = this.#allLayers.get(editor.pageIndex);
    if (layer) {
      layer.addOrRebuild(editor);
    } else {
      this.addEditor(editor);
    }
  }
  setActiveEditor(editor) {
    if (this.#activeEditor === editor) {
      return;
    }
    this.#activeEditor = editor;
    if (editor) {
      this.#dispatchUpdateUI(editor.propertiesToUpdate);
    }
  }
  toggleSelected(editor) {
    if (this.#selectedEditors.has(editor)) {
      this.#selectedEditors.delete(editor);
      editor.unselect();
      this.#dispatchUpdateStates({
        hasSelectedEditor: this.hasSelection
      });
      return;
    }
    this.#selectedEditors.add(editor);
    editor.select();
    this.#dispatchUpdateUI(editor.propertiesToUpdate);
    this.#dispatchUpdateStates({
      hasSelectedEditor: true
    });
  }
  setSelected(editor) {
    for (const ed of this.#selectedEditors) {
      if (ed !== editor) {
        ed.unselect();
      }
    }
    this.#selectedEditors.clear();
    this.#selectedEditors.add(editor);
    editor.select();
    this.#dispatchUpdateUI(editor.propertiesToUpdate);
    this.#dispatchUpdateStates({
      hasSelectedEditor: true
    });
  }
  isSelected(editor) {
    return this.#selectedEditors.has(editor);
  }
  unselect(editor) {
    editor.unselect();
    this.#selectedEditors.delete(editor);
    this.#dispatchUpdateStates({
      hasSelectedEditor: this.hasSelection
    });
  }
  get hasSelection() {
    return this.#selectedEditors.size !== 0;
  }
  undo() {
    this.#commandManager.undo();
    this.#dispatchUpdateStates({
      hasSomethingToUndo: this.#commandManager.hasSomethingToUndo(),
      hasSomethingToRedo: true,
      isEmpty: this.#isEmpty()
    });
  }
  redo() {
    this.#commandManager.redo();
    this.#dispatchUpdateStates({
      hasSomethingToUndo: true,
      hasSomethingToRedo: this.#commandManager.hasSomethingToRedo(),
      isEmpty: this.#isEmpty()
    });
  }
  addCommands(params) {
    this.#commandManager.add(params);
    this.#dispatchUpdateStates({
      hasSomethingToUndo: true,
      hasSomethingToRedo: false,
      isEmpty: this.#isEmpty()
    });
  }
  #isEmpty() {
    if (this.#allEditors.size === 0) {
      return true;
    }
    if (this.#allEditors.size === 1) {
      for (const editor of this.#allEditors.values()) {
        return editor.isEmpty();
      }
    }
    return false;
  }
  delete() {
    this.commitOrRemove();
    if (!this.hasSelection) {
      return;
    }
    const editors = [...this.#selectedEditors];
    const cmd = () => {
      for (const editor of editors) {
        editor.remove();
      }
    };
    const undo = () => {
      for (const editor of editors) {
        this.#addEditorToLayer(editor);
      }
    };
    this.addCommands({
      cmd,
      undo,
      mustExec: true
    });
  }
  commitOrRemove() {
    this.#activeEditor?.commitOrRemove();
  }
  hasSomethingToControl() {
    return this.#activeEditor || this.hasSelection;
  }
  #selectEditors(editors) {
    this.#selectedEditors.clear();
    for (const editor of editors) {
      if (editor.isEmpty()) {
        continue;
      }
      this.#selectedEditors.add(editor);
      editor.select();
    }
    this.#dispatchUpdateStates({
      hasSelectedEditor: true
    });
  }
  selectAll() {
    for (const editor of this.#selectedEditors) {
      editor.commit();
    }
    this.#selectEditors(this.#allEditors.values());
  }
  unselectAll() {
    if (this.#activeEditor) {
      this.#activeEditor.commitOrRemove();
      return;
    }
    if (!this.hasSelection) {
      return;
    }
    for (const editor of this.#selectedEditors) {
      editor.unselect();
    }
    this.#selectedEditors.clear();
    this.#dispatchUpdateStates({
      hasSelectedEditor: false
    });
  }
  translateSelectedEditors(x, y, noCommit = false) {
    if (!noCommit) {
      this.commitOrRemove();
    }
    if (!this.hasSelection) {
      return;
    }
    this.#translation[0] += x;
    this.#translation[1] += y;
    const [totalX, totalY] = this.#translation;
    const editors = [...this.#selectedEditors];
    const TIME_TO_WAIT = 1000;
    if (this.#translationTimeoutId) {
      clearTimeout(this.#translationTimeoutId);
    }
    this.#translationTimeoutId = setTimeout(() => {
      this.#translationTimeoutId = null;
      this.#translation[0] = this.#translation[1] = 0;
      this.addCommands({
        cmd: () => {
          for (const editor of editors) {
            if (this.#allEditors.has(editor.id)) {
              editor.translateInPage(totalX, totalY);
            }
          }
        },
        undo: () => {
          for (const editor of editors) {
            if (this.#allEditors.has(editor.id)) {
              editor.translateInPage(-totalX, -totalY);
            }
          }
        },
        mustExec: false
      });
    }, TIME_TO_WAIT);
    for (const editor of editors) {
      editor.translateInPage(x, y);
    }
  }
  setUpDragSession() {
    if (!this.hasSelection) {
      return;
    }
    this.disableUserSelect(true);
    this.#draggingEditors = new Map();
    for (const editor of this.#selectedEditors) {
      this.#draggingEditors.set(editor, {
        savedX: editor.x,
        savedY: editor.y,
        savedPageIndex: editor.pageIndex,
        newX: 0,
        newY: 0,
        newPageIndex: -1
      });
    }
  }
  endDragSession() {
    if (!this.#draggingEditors) {
      return false;
    }
    this.disableUserSelect(false);
    const map = this.#draggingEditors;
    this.#draggingEditors = null;
    let mustBeAddedInUndoStack = false;
    for (const [{
      x,
      y,
      pageIndex
    }, value] of map) {
      value.newX = x;
      value.newY = y;
      value.newPageIndex = pageIndex;
      mustBeAddedInUndoStack ||= x !== value.savedX || y !== value.savedY || pageIndex !== value.savedPageIndex;
    }
    if (!mustBeAddedInUndoStack) {
      return false;
    }
    const move = (editor, x, y, pageIndex) => {
      if (this.#allEditors.has(editor.id)) {
        const parent = this.#allLayers.get(pageIndex);
        if (parent) {
          editor._setParentAndPosition(parent, x, y);
        } else {
          editor.pageIndex = pageIndex;
          editor.x = x;
          editor.y = y;
        }
      }
    };
    this.addCommands({
      cmd: () => {
        for (const [editor, {
          newX,
          newY,
          newPageIndex
        }] of map) {
          move(editor, newX, newY, newPageIndex);
        }
      },
      undo: () => {
        for (const [editor, {
          savedX,
          savedY,
          savedPageIndex
        }] of map) {
          move(editor, savedX, savedY, savedPageIndex);
        }
      },
      mustExec: true
    });
    return true;
  }
  dragSelectedEditors(tx, ty) {
    if (!this.#draggingEditors) {
      return;
    }
    for (const editor of this.#draggingEditors.keys()) {
      editor.drag(tx, ty);
    }
  }
  rebuild(editor) {
    if (editor.parent === null) {
      const parent = this.getLayer(editor.pageIndex);
      if (parent) {
        parent.changeParent(editor);
        parent.addOrRebuild(editor);
      } else {
        this.addEditor(editor);
        this.addToAnnotationStorage(editor);
        editor.rebuild();
      }
    } else {
      editor.parent.addOrRebuild(editor);
    }
  }
  isActive(editor) {
    return this.#activeEditor === editor;
  }
  getActive() {
    return this.#activeEditor;
  }
  getMode() {
    return this.#mode;
  }
  get imageManager() {
    return (0, _util.shadow)(this, "imageManager", new ImageManager());
  }
}
exports.AnnotationEditorUIManager = AnnotationEditorUIManager;

/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.StatTimer = exports.RenderingCancelledException = exports.PixelsPerInch = exports.PageViewport = exports.PDFDateString = exports.DOMStandardFontDataFactory = exports.DOMSVGFactory = exports.DOMFilterFactory = exports.DOMCanvasFactory = exports.DOMCMapReaderFactory = void 0;
exports.deprecated = deprecated;
exports.getColorValues = getColorValues;
exports.getCurrentTransform = getCurrentTransform;
exports.getCurrentTransformInverse = getCurrentTransformInverse;
exports.getFilenameFromUrl = getFilenameFromUrl;
exports.getPdfFilenameFromUrl = getPdfFilenameFromUrl;
exports.getRGB = getRGB;
exports.getXfaPageViewport = getXfaPageViewport;
exports.isDataScheme = isDataScheme;
exports.isPdfFile = isPdfFile;
exports.isValidFetchUrl = isValidFetchUrl;
exports.loadScript = loadScript;
exports.noContextMenu = noContextMenu;
exports.setLayerDimensions = setLayerDimensions;
var _base_factory = __w_pdfjs_require__(7);
var _util = __w_pdfjs_require__(1);
const SVG_NS = "http://www.w3.org/2000/svg";
class PixelsPerInch {
  static CSS = 96.0;
  static PDF = 72.0;
  static PDF_TO_CSS_UNITS = this.CSS / this.PDF;
}
exports.PixelsPerInch = PixelsPerInch;
class DOMFilterFactory extends _base_factory.BaseFilterFactory {
  #_cache;
  #_defs;
  #docId;
  #document;
  #hcmFilter;
  #hcmKey;
  #hcmUrl;
  #hcmHighlightFilter;
  #hcmHighlightKey;
  #hcmHighlightUrl;
  #id = 0;
  constructor({
    docId,
    ownerDocument = globalThis.document
  } = {}) {
    super();
    this.#docId = docId;
    this.#document = ownerDocument;
  }
  get #cache() {
    return this.#_cache ||= new Map();
  }
  get #defs() {
    if (!this.#_defs) {
      const div = this.#document.createElement("div");
      const {
        style
      } = div;
      style.visibility = "hidden";
      style.contain = "strict";
      style.width = style.height = 0;
      style.position = "absolute";
      style.top = style.left = 0;
      style.zIndex = -1;
      const svg = this.#document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("width", 0);
      svg.setAttribute("height", 0);
      this.#_defs = this.#document.createElementNS(SVG_NS, "defs");
      div.append(svg);
      svg.append(this.#_defs);
      this.#document.body.append(div);
    }
    return this.#_defs;
  }
  addFilter(maps) {
    if (!maps) {
      return "none";
    }
    let value = this.#cache.get(maps);
    if (value) {
      return value;
    }
    let tableR, tableG, tableB, key;
    if (maps.length === 1) {
      const mapR = maps[0];
      const buffer = new Array(256);
      for (let i = 0; i < 256; i++) {
        buffer[i] = mapR[i] / 255;
      }
      key = tableR = tableG = tableB = buffer.join(",");
    } else {
      const [mapR, mapG, mapB] = maps;
      const bufferR = new Array(256);
      const bufferG = new Array(256);
      const bufferB = new Array(256);
      for (let i = 0; i < 256; i++) {
        bufferR[i] = mapR[i] / 255;
        bufferG[i] = mapG[i] / 255;
        bufferB[i] = mapB[i] / 255;
      }
      tableR = bufferR.join(",");
      tableG = bufferG.join(",");
      tableB = bufferB.join(",");
      key = `${tableR}${tableG}${tableB}`;
    }
    value = this.#cache.get(key);
    if (value) {
      this.#cache.set(maps, value);
      return value;
    }
    const id = `g_${this.#docId}_transfer_map_${this.#id++}`;
    const url = `url(#${id})`;
    this.#cache.set(maps, url);
    this.#cache.set(key, url);
    const filter = this.#createFilter(id);
    this.#addTransferMapConversion(tableR, tableG, tableB, filter);
    return url;
  }
  addHCMFilter(fgColor, bgColor) {
    const key = `${fgColor}-${bgColor}`;
    if (this.#hcmKey === key) {
      return this.#hcmUrl;
    }
    this.#hcmKey = key;
    this.#hcmUrl = "none";
    this.#hcmFilter?.remove();
    if (!fgColor || !bgColor) {
      return this.#hcmUrl;
    }
    const fgRGB = this.#getRGB(fgColor);
    fgColor = _util.Util.makeHexColor(...fgRGB);
    const bgRGB = this.#getRGB(bgColor);
    bgColor = _util.Util.makeHexColor(...bgRGB);
    this.#defs.style.color = "";
    if (fgColor === "#000000" && bgColor === "#ffffff" || fgColor === bgColor) {
      return this.#hcmUrl;
    }
    const map = new Array(256);
    for (let i = 0; i <= 255; i++) {
      const x = i / 255;
      map[i] = x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    }
    const table = map.join(",");
    const id = `g_${this.#docId}_hcm_filter`;
    const filter = this.#hcmHighlightFilter = this.#createFilter(id);
    this.#addTransferMapConversion(table, table, table, filter);
    this.#addGrayConversion(filter);
    const getSteps = (c, n) => {
      const start = fgRGB[c] / 255;
      const end = bgRGB[c] / 255;
      const arr = new Array(n + 1);
      for (let i = 0; i <= n; i++) {
        arr[i] = start + i / n * (end - start);
      }
      return arr.join(",");
    };
    this.#addTransferMapConversion(getSteps(0, 5), getSteps(1, 5), getSteps(2, 5), filter);
    this.#hcmUrl = `url(#${id})`;
    return this.#hcmUrl;
  }
  addHighlightHCMFilter(fgColor, bgColor, newFgColor, newBgColor) {
    const key = `${fgColor}-${bgColor}-${newFgColor}-${newBgColor}`;
    if (this.#hcmHighlightKey === key) {
      return this.#hcmHighlightUrl;
    }
    this.#hcmHighlightKey = key;
    this.#hcmHighlightUrl = "none";
    this.#hcmHighlightFilter?.remove();
    if (!fgColor || !bgColor) {
      return this.#hcmHighlightUrl;
    }
    const [fgRGB, bgRGB] = [fgColor, bgColor].map(this.#getRGB.bind(this));
    let fgGray = Math.round(0.2126 * fgRGB[0] + 0.7152 * fgRGB[1] + 0.0722 * fgRGB[2]);
    let bgGray = Math.round(0.2126 * bgRGB[0] + 0.7152 * bgRGB[1] + 0.0722 * bgRGB[2]);
    let [newFgRGB, newBgRGB] = [newFgColor, newBgColor].map(this.#getRGB.bind(this));
    if (bgGray < fgGray) {
      [fgGray, bgGray, newFgRGB, newBgRGB] = [bgGray, fgGray, newBgRGB, newFgRGB];
    }
    this.#defs.style.color = "";
    const getSteps = (fg, bg, n) => {
      const arr = new Array(256);
      const step = (bgGray - fgGray) / n;
      const newStart = fg / 255;
      const newStep = (bg - fg) / (255 * n);
      let prev = 0;
      for (let i = 0; i <= n; i++) {
        const k = Math.round(fgGray + i * step);
        const value = newStart + i * newStep;
        for (let j = prev; j <= k; j++) {
          arr[j] = value;
        }
        prev = k + 1;
      }
      for (let i = prev; i < 256; i++) {
        arr[i] = arr[prev - 1];
      }
      return arr.join(",");
    };
    const id = `g_${this.#docId}_hcm_highlight_filter`;
    const filter = this.#hcmHighlightFilter = this.#createFilter(id);
    this.#addGrayConversion(filter);
    this.#addTransferMapConversion(getSteps(newFgRGB[0], newBgRGB[0], 5), getSteps(newFgRGB[1], newBgRGB[1], 5), getSteps(newFgRGB[2], newBgRGB[2], 5), filter);
    this.#hcmHighlightUrl = `url(#${id})`;
    return this.#hcmHighlightUrl;
  }
  destroy(keepHCM = false) {
    if (keepHCM && (this.#hcmUrl || this.#hcmHighlightUrl)) {
      return;
    }
    if (this.#_defs) {
      this.#_defs.parentNode.parentNode.remove();
      this.#_defs = null;
    }
    if (this.#_cache) {
      this.#_cache.clear();
      this.#_cache = null;
    }
    this.#id = 0;
  }
  #addGrayConversion(filter) {
    const feColorMatrix = this.#document.createElementNS(SVG_NS, "feColorMatrix");
    feColorMatrix.setAttribute("type", "matrix");
    feColorMatrix.setAttribute("values", "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0");
    filter.append(feColorMatrix);
  }
  #createFilter(id) {
    const filter = this.#document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.setAttribute("id", id);
    this.#defs.append(filter);
    return filter;
  }
  #appendFeFunc(feComponentTransfer, func, table) {
    const feFunc = this.#document.createElementNS(SVG_NS, func);
    feFunc.setAttribute("type", "discrete");
    feFunc.setAttribute("tableValues", table);
    feComponentTransfer.append(feFunc);
  }
  #addTransferMapConversion(rTable, gTable, bTable, filter) {
    const feComponentTransfer = this.#document.createElementNS(SVG_NS, "feComponentTransfer");
    filter.append(feComponentTransfer);
    this.#appendFeFunc(feComponentTransfer, "feFuncR", rTable);
    this.#appendFeFunc(feComponentTransfer, "feFuncG", gTable);
    this.#appendFeFunc(feComponentTransfer, "feFuncB", bTable);
  }
  #getRGB(color) {
    this.#defs.style.color = color;
    return getRGB(getComputedStyle(this.#defs).getPropertyValue("color"));
  }
}
exports.DOMFilterFactory = DOMFilterFactory;
class DOMCanvasFactory extends _base_factory.BaseCanvasFactory {
  constructor({
    ownerDocument = globalThis.document
  } = {}) {
    super();
    this._document = ownerDocument;
  }
  _createCanvas(width, height) {
    const canvas = this._document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
}
exports.DOMCanvasFactory = DOMCanvasFactory;
async function fetchData(url, asTypedArray = false) {
  if (isValidFetchUrl(url, document.baseURI)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return asTypedArray ? new Uint8Array(await response.arrayBuffer()) : (0, _util.stringToBytes)(await response.text());
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    if (asTypedArray) {
      request.responseType = "arraybuffer";
    }
    request.onreadystatechange = () => {
      if (request.readyState !== XMLHttpRequest.DONE) {
        return;
      }
      if (request.status === 200 || request.status === 0) {
        let data;
        if (asTypedArray && request.response) {
          data = new Uint8Array(request.response);
        } else if (!asTypedArray && request.responseText) {
          data = (0, _util.stringToBytes)(request.responseText);
        }
        if (data) {
          resolve(data);
          return;
        }
      }
      reject(new Error(request.statusText));
    };
    request.send(null);
  });
}
class DOMCMapReaderFactory extends _base_factory.BaseCMapReaderFactory {
  _fetchData(url, compressionType) {
    return fetchData(url, this.isCompressed).then(data => {
      return {
        cMapData: data,
        compressionType
      };
    });
  }
}
exports.DOMCMapReaderFactory = DOMCMapReaderFactory;
class DOMStandardFontDataFactory extends _base_factory.BaseStandardFontDataFactory {
  _fetchData(url) {
    return fetchData(url, true);
  }
}
exports.DOMStandardFontDataFactory = DOMStandardFontDataFactory;
class DOMSVGFactory extends _base_factory.BaseSVGFactory {
  _createSVG(type) {
    return document.createElementNS(SVG_NS, type);
  }
}
exports.DOMSVGFactory = DOMSVGFactory;
class PageViewport {
  constructor({
    viewBox,
    scale,
    rotation,
    offsetX = 0,
    offsetY = 0,
    dontFlip = false
  }) {
    this.viewBox = viewBox;
    this.scale = scale;
    this.rotation = rotation;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    const centerX = (viewBox[2] + viewBox[0]) / 2;
    const centerY = (viewBox[3] + viewBox[1]) / 2;
    let rotateA, rotateB, rotateC, rotateD;
    rotation %= 360;
    if (rotation < 0) {
      rotation += 360;
    }
    switch (rotation) {
      case 180:
        rotateA = -1;
        rotateB = 0;
        rotateC = 0;
        rotateD = 1;
        break;
      case 90:
        rotateA = 0;
        rotateB = 1;
        rotateC = 1;
        rotateD = 0;
        break;
      case 270:
        rotateA = 0;
        rotateB = -1;
        rotateC = -1;
        rotateD = 0;
        break;
      case 0:
        rotateA = 1;
        rotateB = 0;
        rotateC = 0;
        rotateD = -1;
        break;
      default:
        throw new Error("PageViewport: Invalid rotation, must be a multiple of 90 degrees.");
    }
    if (dontFlip) {
      rotateC = -rotateC;
      rotateD = -rotateD;
    }
    let offsetCanvasX, offsetCanvasY;
    let width, height;
    if (rotateA === 0) {
      offsetCanvasX = Math.abs(centerY - viewBox[1]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerX - viewBox[0]) * scale + offsetY;
      width = (viewBox[3] - viewBox[1]) * scale;
      height = (viewBox[2] - viewBox[0]) * scale;
    } else {
      offsetCanvasX = Math.abs(centerX - viewBox[0]) * scale + offsetX;
      offsetCanvasY = Math.abs(centerY - viewBox[1]) * scale + offsetY;
      width = (viewBox[2] - viewBox[0]) * scale;
      height = (viewBox[3] - viewBox[1]) * scale;
    }
    this.transform = [rotateA * scale, rotateB * scale, rotateC * scale, rotateD * scale, offsetCanvasX - rotateA * scale * centerX - rotateC * scale * centerY, offsetCanvasY - rotateB * scale * centerX - rotateD * scale * centerY];
    this.width = width;
    this.height = height;
  }
  get rawDims() {
    const {
      viewBox
    } = this;
    return (0, _util.shadow)(this, "rawDims", {
      pageWidth: viewBox[2] - viewBox[0],
      pageHeight: viewBox[3] - viewBox[1],
      pageX: viewBox[0],
      pageY: viewBox[1]
    });
  }
  clone({
    scale = this.scale,
    rotation = this.rotation,
    offsetX = this.offsetX,
    offsetY = this.offsetY,
    dontFlip = false
  } = {}) {
    return new PageViewport({
      viewBox: this.viewBox.slice(),
      scale,
      rotation,
      offsetX,
      offsetY,
      dontFlip
    });
  }
  convertToViewportPoint(x, y) {
    return _util.Util.applyTransform([x, y], this.transform);
  }
  convertToViewportRectangle(rect) {
    const topLeft = _util.Util.applyTransform([rect[0], rect[1]], this.transform);
    const bottomRight = _util.Util.applyTransform([rect[2], rect[3]], this.transform);
    return [topLeft[0], topLeft[1], bottomRight[0], bottomRight[1]];
  }
  convertToPdfPoint(x, y) {
    return _util.Util.applyInverseTransform([x, y], this.transform);
  }
}
exports.PageViewport = PageViewport;
class RenderingCancelledException extends _util.BaseException {
  constructor(msg, extraDelay = 0) {
    super(msg, "RenderingCancelledException");
    this.extraDelay = extraDelay;
  }
}
exports.RenderingCancelledException = RenderingCancelledException;
function isDataScheme(url) {
  const ii = url.length;
  let i = 0;
  while (i < ii && url[i].trim() === "") {
    i++;
  }
  return url.substring(i, i + 5).toLowerCase() === "data:";
}
function isPdfFile(filename) {
  return typeof filename === "string" && /\.pdf$/i.test(filename);
}
function getFilenameFromUrl(url, onlyStripPath = false) {
  if (!onlyStripPath) {
    [url] = url.split(/[#?]/, 1);
  }
  return url.substring(url.lastIndexOf("/") + 1);
}
function getPdfFilenameFromUrl(url, defaultFilename = "document.pdf") {
  if (typeof url !== "string") {
    return defaultFilename;
  }
  if (isDataScheme(url)) {
    (0, _util.warn)('getPdfFilenameFromUrl: ignore "data:"-URL for performance reasons.');
    return defaultFilename;
  }
  const reURI = /^(?:(?:[^:]+:)?\/\/[^/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
  const reFilename = /[^/?#=]+\.pdf\b(?!.*\.pdf\b)/i;
  const splitURI = reURI.exec(url);
  let suggestedFilename = reFilename.exec(splitURI[1]) || reFilename.exec(splitURI[2]) || reFilename.exec(splitURI[3]);
  if (suggestedFilename) {
    suggestedFilename = suggestedFilename[0];
    if (suggestedFilename.includes("%")) {
      try {
        suggestedFilename = reFilename.exec(decodeURIComponent(suggestedFilename))[0];
      } catch {}
    }
  }
  return suggestedFilename || defaultFilename;
}
class StatTimer {
  started = Object.create(null);
  times = [];
  time(name) {
    if (name in this.started) {
      (0, _util.warn)(`Timer is already running for ${name}`);
    }
    this.started[name] = Date.now();
  }
  timeEnd(name) {
    if (!(name in this.started)) {
      (0, _util.warn)(`Timer has not been started for ${name}`);
    }
    this.times.push({
      name,
      start: this.started[name],
      end: Date.now()
    });
    delete this.started[name];
  }
  toString() {
    const outBuf = [];
    let longest = 0;
    for (const {
      name
    } of this.times) {
      longest = Math.max(name.length, longest);
    }
    for (const {
      name,
      start,
      end
    } of this.times) {
      outBuf.push(`${name.padEnd(longest)} ${end - start}ms\n`);
    }
    return outBuf.join("");
  }
}
exports.StatTimer = StatTimer;
function isValidFetchUrl(url, baseUrl) {
  try {
    const {
      protocol
    } = baseUrl ? new URL(url, baseUrl) : new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
function noContextMenu(e) {
  e.preventDefault();
}
function loadScript(src, removeScriptElement = false) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = function (evt) {
      if (removeScriptElement) {
        script.remove();
      }
      resolve(evt);
    };
    script.onerror = function () {
      reject(new Error(`Cannot load script at: ${script.src}`));
    };
    (document.head || document.documentElement).append(script);
  });
}
function deprecated(details) {
  console.log("Deprecated API usage: " + details);
}
let pdfDateStringRegex;
class PDFDateString {
  static toDateObject(input) {
    if (!input || typeof input !== "string") {
      return null;
    }
    pdfDateStringRegex ||= new RegExp("^D:" + "(\\d{4})" + "(\\d{2})?" + "(\\d{2})?" + "(\\d{2})?" + "(\\d{2})?" + "(\\d{2})?" + "([Z|+|-])?" + "(\\d{2})?" + "'?" + "(\\d{2})?" + "'?");
    const matches = pdfDateStringRegex.exec(input);
    if (!matches) {
      return null;
    }
    const year = parseInt(matches[1], 10);
    let month = parseInt(matches[2], 10);
    month = month >= 1 && month <= 12 ? month - 1 : 0;
    let day = parseInt(matches[3], 10);
    day = day >= 1 && day <= 31 ? day : 1;
    let hour = parseInt(matches[4], 10);
    hour = hour >= 0 && hour <= 23 ? hour : 0;
    let minute = parseInt(matches[5], 10);
    minute = minute >= 0 && minute <= 59 ? minute : 0;
    let second = parseInt(matches[6], 10);
    second = second >= 0 && second <= 59 ? second : 0;
    const universalTimeRelation = matches[7] || "Z";
    let offsetHour = parseInt(matches[8], 10);
    offsetHour = offsetHour >= 0 && offsetHour <= 23 ? offsetHour : 0;
    let offsetMinute = parseInt(matches[9], 10) || 0;
    offsetMinute = offsetMinute >= 0 && offsetMinute <= 59 ? offsetMinute : 0;
    if (universalTimeRelation === "-") {
      hour += offsetHour;
      minute += offsetMinute;
    } else if (universalTimeRelation === "+") {
      hour -= offsetHour;
      minute -= offsetMinute;
    }
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
}
exports.PDFDateString = PDFDateString;
function getXfaPageViewport(xfaPage, {
  scale = 1,
  rotation = 0
}) {
  const {
    width,
    height
  } = xfaPage.attributes.style;
  const viewBox = [0, 0, parseInt(width), parseInt(height)];
  return new PageViewport({
    viewBox,
    scale,
    rotation
  });
}
function getRGB(color) {
  if (color.startsWith("#")) {
    const colorRGB = parseInt(color.slice(1), 16);
    return [(colorRGB & 0xff0000) >> 16, (colorRGB & 0x00ff00) >> 8, colorRGB & 0x0000ff];
  }
  if (color.startsWith("rgb(")) {
    return color.slice(4, -1).split(",").map(x => parseInt(x));
  }
  if (color.startsWith("rgba(")) {
    return color.slice(5, -1).split(",").map(x => parseInt(x)).slice(0, 3);
  }
  (0, _util.warn)(`Not a valid color format: "${color}"`);
  return [0, 0, 0];
}
function getColorValues(colors) {
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  document.body.append(span);
  for (const name of colors.keys()) {
    span.style.color = name;
    const computedColor = window.getComputedStyle(span).color;
    colors.set(name, getRGB(computedColor));
  }
  span.remove();
}
function getCurrentTransform(ctx) {
  const {
    a,
    b,
    c,
    d,
    e,
    f
  } = ctx.getTransform();
  return [a, b, c, d, e, f];
}
function getCurrentTransformInverse(ctx) {
  const {
    a,
    b,
    c,
    d,
    e,
    f
  } = ctx.getTransform().invertSelf();
  return [a, b, c, d, e, f];
}
function setLayerDimensions(div, viewport, mustFlip = false, mustRotate = true) {
  if (viewport instanceof PageViewport) {
    const {
      pageWidth,
      pageHeight
    } = viewport.rawDims;
    const {
      style
    } = div;
    const useRound = _util.FeatureTest.isCSSRoundSupported;
    const w = `var(--scale-factor) * ${pageWidth}px`,
      h = `var(--scale-factor) * ${pageHeight}px`;
    const widthStr = useRound ? `round(${w}, 1px)` : `calc(${w})`,
      heightStr = useRound ? `round(${h}, 1px)` : `calc(${h})`;
    if (!mustFlip || viewport.rotation % 180 === 0) {
      style.width = widthStr;
      style.height = heightStr;
    } else {
      style.width = heightStr;
      style.height = widthStr;
    }
  }
  if (mustRotate) {
    div.setAttribute("data-main-rotation", viewport.rotation);
  }
}

/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.BaseStandardFontDataFactory = exports.BaseSVGFactory = exports.BaseFilterFactory = exports.BaseCanvasFactory = exports.BaseCMapReaderFactory = void 0;
var _util = __w_pdfjs_require__(1);
class BaseFilterFactory {
  constructor() {
    if (this.constructor === BaseFilterFactory) {
      (0, _util.unreachable)("Cannot initialize BaseFilterFactory.");
    }
  }
  addFilter(maps) {
    return "none";
  }
  addHCMFilter(fgColor, bgColor) {
    return "none";
  }
  addHighlightHCMFilter(fgColor, bgColor, newFgColor, newBgColor) {
    return "none";
  }
  destroy(keepHCM = false) {}
}
exports.BaseFilterFactory = BaseFilterFactory;
class BaseCanvasFactory {
  constructor() {
    if (this.constructor === BaseCanvasFactory) {
      (0, _util.unreachable)("Cannot initialize BaseCanvasFactory.");
    }
  }
  create(width, height) {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    const canvas = this._createCanvas(width, height);
    return {
      canvas,
      context: canvas.getContext("2d")
    };
  }
  reset(canvasAndContext, width, height) {
    if (!canvasAndContext.canvas) {
      throw new Error("Canvas is not specified");
    }
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    if (!canvasAndContext.canvas) {
      throw new Error("Canvas is not specified");
    }
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
  _createCanvas(width, height) {
    (0, _util.unreachable)("Abstract method `_createCanvas` called.");
  }
}
exports.BaseCanvasFactory = BaseCanvasFactory;
class BaseCMapReaderFactory {
  constructor({
    baseUrl = null,
    isCompressed = true
  }) {
    if (this.constructor === BaseCMapReaderFactory) {
      (0, _util.unreachable)("Cannot initialize BaseCMapReaderFactory.");
    }
    this.baseUrl = baseUrl;
    this.isCompressed = isCompressed;
  }
  async fetch({
    name
  }) {
    if (!this.baseUrl) {
      throw new Error('The CMap "baseUrl" parameter must be specified, ensure that ' + 'the "cMapUrl" and "cMapPacked" API parameters are provided.');
    }
    if (!name) {
      throw new Error("CMap name must be specified.");
    }
    const url = this.baseUrl + name + (this.isCompressed ? ".bcmap" : "");
    const compressionType = this.isCompressed ? _util.CMapCompressionType.BINARY : _util.CMapCompressionType.NONE;
    return this._fetchData(url, compressionType).catch(reason => {
      throw new Error(`Unable to load ${this.isCompressed ? "binary " : ""}CMap at: ${url}`);
    });
  }
  _fetchData(url, compressionType) {
    (0, _util.unreachable)("Abstract method `_fetchData` called.");
  }
}
exports.BaseCMapReaderFactory = BaseCMapReaderFactory;
class BaseStandardFontDataFactory {
  constructor({
    baseUrl = null
  }) {
    if (this.constructor === BaseStandardFontDataFactory) {
      (0, _util.unreachable)("Cannot initialize BaseStandardFontDataFactory.");
    }
    this.baseUrl = baseUrl;
  }
  async fetch({
    filename
  }) {
    if (!this.baseUrl) {
      throw new Error('The standard font "baseUrl" parameter must be specified, ensure that ' + 'the "standardFontDataUrl" API parameter is provided.');
    }
    if (!filename) {
      throw new Error("Font filename must be specified.");
    }
    const url = `${this.baseUrl}${filename}`;
    return this._fetchData(url).catch(reason => {
      throw new Error(`Unable to load font data at: ${url}`);
    });
  }
  _fetchData(url) {
    (0, _util.unreachable)("Abstract method `_fetchData` called.");
  }
}
exports.BaseStandardFontDataFactory = BaseStandardFontDataFactory;
class BaseSVGFactory {
  constructor() {
    if (this.constructor === BaseSVGFactory) {
      (0, _util.unreachable)("Cannot initialize BaseSVGFactory.");
    }
  }
  create(width, height, skipDimensions = false) {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid SVG dimensions");
    }
    const svg = this._createSVG("svg:svg");
    svg.setAttribute("version", "1.1");
    if (!skipDimensions) {
      svg.setAttribute("width", `${width}px`);
      svg.setAttribute("height", `${height}px`);
    }
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return svg;
  }
  createElement(type) {
    if (typeof type !== "string") {
      throw new Error("Invalid SVG element type");
    }
    return this._createSVG(type);
  }
  _createSVG(type) {
    (0, _util.unreachable)("Abstract method `_createSVG` called.");
  }
}
exports.BaseSVGFactory = BaseSVGFactory;

/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.MurmurHash3_64 = void 0;
var _util = __w_pdfjs_require__(1);
const SEED = 0xc3d2e1f0;
const MASK_HIGH = 0xffff0000;
const MASK_LOW = 0xffff;
class MurmurHash3_64 {
  constructor(seed) {
    this.h1 = seed ? seed & 0xffffffff : SEED;
    this.h2 = seed ? seed & 0xffffffff : SEED;
  }
  update(input) {
    let data, length;
    if (typeof input === "string") {
      data = new Uint8Array(input.length * 2);
      length = 0;
      for (let i = 0, ii = input.length; i < ii; i++) {
        const code = input.charCodeAt(i);
        if (code <= 0xff) {
          data[length++] = code;
        } else {
          data[length++] = code >>> 8;
          data[length++] = code & 0xff;
        }
      }
    } else if ((0, _util.isArrayBuffer)(input)) {
      data = input.slice();
      length = data.byteLength;
    } else {
      throw new Error("Wrong data format in MurmurHash3_64_update. " + "Input must be a string or array.");
    }
    const blockCounts = length >> 2;
    const tailLength = length - blockCounts * 4;
    const dataUint32 = new Uint32Array(data.buffer, 0, blockCounts);
    let k1 = 0,
      k2 = 0;
    let h1 = this.h1,
      h2 = this.h2;
    const C1 = 0xcc9e2d51,
      C2 = 0x1b873593;
    const C1_LOW = C1 & MASK_LOW,
      C2_LOW = C2 & MASK_LOW;
    for (let i = 0; i < blockCounts; i++) {
      if (i & 1) {
        k1 = dataUint32[i];
        k1 = k1 * C1 & MASK_HIGH | k1 * C1_LOW & MASK_LOW;
        k1 = k1 << 15 | k1 >>> 17;
        k1 = k1 * C2 & MASK_HIGH | k1 * C2_LOW & MASK_LOW;
        h1 ^= k1;
        h1 = h1 << 13 | h1 >>> 19;
        h1 = h1 * 5 + 0xe6546b64;
      } else {
        k2 = dataUint32[i];
        k2 = k2 * C1 & MASK_HIGH | k2 * C1_LOW & MASK_LOW;
        k2 = k2 << 15 | k2 >>> 17;
        k2 = k2 * C2 & MASK_HIGH | k2 * C2_LOW & MASK_LOW;
        h2 ^= k2;
        h2 = h2 << 13 | h2 >>> 19;
        h2 = h2 * 5 + 0xe6546b64;
      }
    }
    k1 = 0;
    switch (tailLength) {
      case 3:
        k1 ^= data[blockCounts * 4 + 2] << 16;
      case 2:
        k1 ^= data[blockCounts * 4 + 1] << 8;
      case 1:
        k1 ^= data[blockCounts * 4];
        k1 = k1 * C1 & MASK_HIGH | k1 * C1_LOW & MASK_LOW;
        k1 = k1 << 15 | k1 >>> 17;
        k1 = k1 * C2 & MASK_HIGH | k1 * C2_LOW & MASK_LOW;
        if (blockCounts & 1) {
          h1 ^= k1;
        } else {
          h2 ^= k1;
        }
    }
    this.h1 = h1;
    this.h2 = h2;
  }
  hexdigest() {
    let h1 = this.h1,
      h2 = this.h2;
    h1 ^= h2 >>> 1;
    h1 = h1 * 0xed558ccd & MASK_HIGH | h1 * 0x8ccd & MASK_LOW;
    h2 = h2 * 0xff51afd7 & MASK_HIGH | ((h2 << 16 | h1 >>> 16) * 0xafd7ed55 & MASK_HIGH) >>> 16;
    h1 ^= h2 >>> 1;
    h1 = h1 * 0x1a85ec53 & MASK_HIGH | h1 * 0xec53 & MASK_LOW;
    h2 = h2 * 0xc4ceb9fe & MASK_HIGH | ((h2 << 16 | h1 >>> 16) * 0xb9fe1a85 & MASK_HIGH) >>> 16;
    h1 ^= h2 >>> 1;
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }
}
exports.MurmurHash3_64 = MurmurHash3_64;

/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.FontLoader = exports.FontFaceObject = void 0;
var _util = __w_pdfjs_require__(1);
class FontLoader {
  #systemFonts = new Set();
  constructor({
    ownerDocument = globalThis.document,
    styleElement = null
  }) {
    this._document = ownerDocument;
    this.nativeFontFaces = new Set();
    this.styleElement = null;
    this.loadingRequests = [];
    this.loadTestFontId = 0;
  }
  addNativeFontFace(nativeFontFace) {
    this.nativeFontFaces.add(nativeFontFace);
    this._document.fonts.add(nativeFontFace);
  }
  removeNativeFontFace(nativeFontFace) {
    this.nativeFontFaces.delete(nativeFontFace);
    this._document.fonts.delete(nativeFontFace);
  }
  insertRule(rule) {
    if (!this.styleElement) {
      this.styleElement = this._document.createElement("style");
      this._document.documentElement.getElementsByTagName("head")[0].append(this.styleElement);
    }
    const styleSheet = this.styleElement.sheet;
    styleSheet.insertRule(rule, styleSheet.cssRules.length);
  }
  clear() {
    for (const nativeFontFace of this.nativeFontFaces) {
      this._document.fonts.delete(nativeFontFace);
    }
    this.nativeFontFaces.clear();
    this.#systemFonts.clear();
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
  async loadSystemFont(info) {
    if (!info || this.#systemFonts.has(info.loadedName)) {
      return;
    }
    (0, _util.assert)(!this.disableFontFace, "loadSystemFont shouldn't be called when `disableFontFace` is set.");
    if (this.isFontLoadingAPISupported) {
      const {
        loadedName,
        src,
        style
      } = info;
      const fontFace = new FontFace(loadedName, src, style);
      this.addNativeFontFace(fontFace);
      try {
        await fontFace.load();
        this.#systemFonts.add(loadedName);
      } catch {
        (0, _util.warn)(`Cannot load system font: ${info.baseFontName}, installing it could help to improve PDF rendering.`);
        this.removeNativeFontFace(fontFace);
      }
      return;
    }
    (0, _util.unreachable)("Not implemented: loadSystemFont without the Font Loading API.");
  }
  async bind(font) {
    if (font.attached || font.missingFile && !font.systemFontInfo) {
      return;
    }
    font.attached = true;
    if (font.systemFontInfo) {
      await this.loadSystemFont(font.systemFontInfo);
      return;
    }
    if (this.isFontLoadingAPISupported) {
      const nativeFontFace = font.createNativeFontFace();
      if (nativeFontFace) {
        this.addNativeFontFace(nativeFontFace);
        try {
          await nativeFontFace.loaded;
        } catch (ex) {
          (0, _util.warn)(`Failed to load font '${nativeFontFace.family}': '${ex}'.`);
          font.disableFontFace = true;
          throw ex;
        }
      }
      return;
    }
    const rule = font.createFontFaceRule();
    if (rule) {
      this.insertRule(rule);
      if (this.isSyncFontLoadingSupported) {
        return;
      }
      await new Promise(resolve => {
        const request = this._queueLoadingCallback(resolve);
        this._prepareFontLoadEvent(font, request);
      });
    }
  }
  get isFontLoadingAPISupported() {
    const hasFonts = !!this._document?.fonts;
    return (0, _util.shadow)(this, "isFontLoadingAPISupported", hasFonts);
  }
  get isSyncFontLoadingSupported() {
    let supported = false;
    if (_util.isNodeJS) {
      supported = true;
    } else if (typeof navigator !== "undefined" && /Mozilla\/5.0.*?rv:\d+.*? Gecko/.test(navigator.userAgent)) {
      supported = true;
    }
    return (0, _util.shadow)(this, "isSyncFontLoadingSupported", supported);
  }
  _queueLoadingCallback(callback) {
    function completeRequest() {
      (0, _util.assert)(!request.done, "completeRequest() cannot be called twice.");
      request.done = true;
      while (loadingRequests.length > 0 && loadingRequests[0].done) {
        const otherRequest = loadingRequests.shift();
        setTimeout(otherRequest.callback, 0);
      }
    }
    const {
      loadingRequests
    } = this;
    const request = {
      done: false,
      complete: completeRequest,
      callback
    };
    loadingRequests.push(request);
    return request;
  }
  get _loadTestFont() {
    const testFont = atob("T1RUTwALAIAAAwAwQ0ZGIDHtZg4AAAOYAAAAgUZGVE1lkzZwAAAEHAAAABxHREVGABQA" + "FQAABDgAAAAeT1MvMlYNYwkAAAEgAAAAYGNtYXABDQLUAAACNAAAAUJoZWFk/xVFDQAA" + "ALwAAAA2aGhlYQdkA+oAAAD0AAAAJGhtdHgD6AAAAAAEWAAAAAZtYXhwAAJQAAAAARgA" + "AAAGbmFtZVjmdH4AAAGAAAAAsXBvc3T/hgAzAAADeAAAACAAAQAAAAEAALZRFsRfDzz1" + "AAsD6AAAAADOBOTLAAAAAM4KHDwAAAAAA+gDIQAAAAgAAgAAAAAAAAABAAADIQAAAFoD" + "6AAAAAAD6AABAAAAAAAAAAAAAAAAAAAAAQAAUAAAAgAAAAQD6AH0AAUAAAKKArwAAACM" + "AooCvAAAAeAAMQECAAACAAYJAAAAAAAAAAAAAQAAAAAAAAAAAAAAAFBmRWQAwAAuAC4D" + "IP84AFoDIQAAAAAAAQAAAAAAAAAAACAAIAABAAAADgCuAAEAAAAAAAAAAQAAAAEAAAAA" + "AAEAAQAAAAEAAAAAAAIAAQAAAAEAAAAAAAMAAQAAAAEAAAAAAAQAAQAAAAEAAAAAAAUA" + "AQAAAAEAAAAAAAYAAQAAAAMAAQQJAAAAAgABAAMAAQQJAAEAAgABAAMAAQQJAAIAAgAB" + "AAMAAQQJAAMAAgABAAMAAQQJAAQAAgABAAMAAQQJAAUAAgABAAMAAQQJAAYAAgABWABY" + "AAAAAAAAAwAAAAMAAAAcAAEAAAAAADwAAwABAAAAHAAEACAAAAAEAAQAAQAAAC7//wAA" + "AC7////TAAEAAAAAAAABBgAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAD/gwAyAAAAAQAAAAAAAAAAAAAAAAAA" + "AAABAAQEAAEBAQJYAAEBASH4DwD4GwHEAvgcA/gXBIwMAYuL+nz5tQXkD5j3CBLnEQAC" + "AQEBIVhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYAAABAQAADwACAQEEE/t3" + "Dov6fAH6fAT+fPp8+nwHDosMCvm1Cvm1DAz6fBQAAAAAAAABAAAAAMmJbzEAAAAAzgTj" + "FQAAAADOBOQpAAEAAAAAAAAADAAUAAQAAAABAAAAAgABAAAAAAAAAAAD6AAAAAAAAA==");
    return (0, _util.shadow)(this, "_loadTestFont", testFont);
  }
  _prepareFontLoadEvent(font, request) {
    function int32(data, offset) {
      return data.charCodeAt(offset) << 24 | data.charCodeAt(offset + 1) << 16 | data.charCodeAt(offset + 2) << 8 | data.charCodeAt(offset + 3) & 0xff;
    }
    function spliceString(s, offset, remove, insert) {
      const chunk1 = s.substring(0, offset);
      const chunk2 = s.substring(offset + remove);
      return chunk1 + insert + chunk2;
    }
    let i, ii;
    const canvas = this._document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    let called = 0;
    function isFontReady(name, callback) {
      if (++called > 30) {
        (0, _util.warn)("Load test font never loaded.");
        callback();
        return;
      }
      ctx.font = "30px " + name;
      ctx.fillText(".", 0, 20);
      const imageData = ctx.getImageData(0, 0, 1, 1);
      if (imageData.data[3] > 0) {
        callback();
        return;
      }
      setTimeout(isFontReady.bind(null, name, callback));
    }
    const loadTestFontId = `lt${Date.now()}${this.loadTestFontId++}`;
    let data = this._loadTestFont;
    const COMMENT_OFFSET = 976;
    data = spliceString(data, COMMENT_OFFSET, loadTestFontId.length, loadTestFontId);
    const CFF_CHECKSUM_OFFSET = 16;
    const XXXX_VALUE = 0x58585858;
    let checksum = int32(data, CFF_CHECKSUM_OFFSET);
    for (i = 0, ii = loadTestFontId.length - 3; i < ii; i += 4) {
      checksum = checksum - XXXX_VALUE + int32(loadTestFontId, i) | 0;
    }
    if (i < loadTestFontId.length) {
      checksum = checksum - XXXX_VALUE + int32(loadTestFontId + "XXX", i) | 0;
    }
    data = spliceString(data, CFF_CHECKSUM_OFFSET, 4, (0, _util.string32)(checksum));
    const url = `url(data:font/opentype;base64,${btoa(data)});`;
    const rule = `@font-face {font-family:"${loadTestFontId}";src:${url}}`;
    this.insertRule(rule);
    const div = this._document.createElement("div");
    div.style.visibility = "hidden";
    div.style.width = div.style.height = "10px";
    div.style.position = "absolute";
    div.style.top = div.style.left = "0px";
    for (const name of [font.loadedName, loadTestFontId]) {
      const span = this._document.createElement("span");
      span.textContent = "Hi";
      span.style.fontFamily = name;
      div.append(span);
    }
    this._document.body.append(div);
    isFontReady(loadTestFontId, () => {
      div.remove();
      request.complete();
    });
  }
}
exports.FontLoader = FontLoader;
class FontFaceObject {
  constructor(translatedData, {
    isEvalSupported = true,
    disableFontFace = false,
    ignoreErrors = false,
    inspectFont = null
  }) {
    this.compiledGlyphs = Object.create(null);
    for (const i in translatedData) {
      this[i] = translatedData[i];
    }
    this.isEvalSupported = isEvalSupported !== false;
    this.disableFontFace = disableFontFace === true;
    this.ignoreErrors = ignoreErrors === true;
    this._inspectFont = inspectFont;
  }
  createNativeFontFace() {
    if (!this.data || this.disableFontFace) {
      return null;
    }
    let nativeFontFace;
    if (!this.cssFontInfo) {
      nativeFontFace = new FontFace(this.loadedName, this.data, {});
    } else {
      const css = {
        weight: this.cssFontInfo.fontWeight
      };
      if (this.cssFontInfo.italicAngle) {
        css.style = `oblique ${this.cssFontInfo.italicAngle}deg`;
      }
      nativeFontFace = new FontFace(this.cssFontInfo.fontFamily, this.data, css);
    }
    this._inspectFont?.(this);
    return nativeFontFace;
  }
  createFontFaceRule() {
    if (!this.data || this.disableFontFace) {
      return null;
    }
    const data = (0, _util.bytesToString)(this.data);
    const url = `url(data:${this.mimetype};base64,${btoa(data)});`;
    let rule;
    if (!this.cssFontInfo) {
      rule = `@font-face {font-family:"${this.loadedName}";src:${url}}`;
    } else {
      let css = `font-weight: ${this.cssFontInfo.fontWeight};`;
      if (this.cssFontInfo.italicAngle) {
        css += `font-style: oblique ${this.cssFontInfo.italicAngle}deg;`;
      }
      rule = `@font-face {font-family:"${this.cssFontInfo.fontFamily}";${css}src:${url}}`;
    }
    this._inspectFont?.(this, url);
    return rule;
  }
  getPathGenerator(objs, character) {
    if (this.compiledGlyphs[character] !== undefined) {
      return this.compiledGlyphs[character];
    }
    let cmds;
    try {
      cmds = objs.get(this.loadedName + "_path_" + character);
    } catch (ex) {
      if (!this.ignoreErrors) {
        throw ex;
      }
      (0, _util.warn)(`getPathGenerator - ignoring character: "${ex}".`);
      return this.compiledGlyphs[character] = function (c, size) {};
    }
    if (this.isEvalSupported && _util.FeatureTest.isEvalSupported) {
      const jsBuf = [];
      for (const current of cmds) {
        const args = current.args !== undefined ? current.args.join(",") : "";
        jsBuf.push("c.", current.cmd, "(", args, ");\n");
      }
      return this.compiledGlyphs[character] = new Function("c", "size", jsBuf.join(""));
    }
    return this.compiledGlyphs[character] = function (c, size) {
      for (const current of cmds) {
        if (current.cmd === "scale") {
          current.args = [size, -size];
        }
        c[current.cmd].apply(c, current.args);
      }
    };
  }
}
exports.FontFaceObject = FontFaceObject;

/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.NodeStandardFontDataFactory = exports.NodeFilterFactory = exports.NodeCanvasFactory = exports.NodeCMapReaderFactory = void 0;
var _base_factory = __w_pdfjs_require__(7);
var _util = __w_pdfjs_require__(1);
;
;
const fetchData = function (url) {
  return new Promise((resolve, reject) => {
    const fs = require("fs");
    fs.readFile(url, (error, data) => {
      if (error || !data) {
        reject(new Error(error));
        return;
      }
      resolve(new Uint8Array(data));
    });
  });
};
class NodeFilterFactory extends _base_factory.BaseFilterFactory {}
exports.NodeFilterFactory = NodeFilterFactory;
class NodeCanvasFactory extends _base_factory.BaseCanvasFactory {
  _createCanvas(width, height) {
    const Canvas = require("canvas");
    return Canvas.createCanvas(width, height);
  }
}
exports.NodeCanvasFactory = NodeCanvasFactory;
class NodeCMapReaderFactory extends _base_factory.BaseCMapReaderFactory {
  _fetchData(url, compressionType) {
    return fetchData(url).then(data => {
      return {
        cMapData: data,
        compressionType
      };
    });
  }
}
exports.NodeCMapReaderFactory = NodeCMapReaderFactory;
class NodeStandardFontDataFactory extends _base_factory.BaseStandardFontDataFactory {
  _fetchData(url) {
    return fetchData(url);
  }
}
exports.NodeStandardFontDataFactory = NodeStandardFontDataFactory;

/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.CanvasGraphics = void 0;
var _util = __w_pdfjs_require__(1);
var _display_utils = __w_pdfjs_require__(6);
var _pattern_helper = __w_pdfjs_require__(12);
var _image_utils = __w_pdfjs_require__(13);
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 100;
const MAX_GROUP_SIZE = 4096;
const EXECUTION_TIME = 15;
const EXECUTION_STEPS = 10;
const MAX_SIZE_TO_COMPILE = 1000;
const FULL_CHUNK_HEIGHT = 16;
function mirrorContextOperations(ctx, destCtx) {
  if (ctx._removeMirroring) {
    throw new Error("Context is already forwarding operations.");
  }
  ctx.__originalSave = ctx.save;
  ctx.__originalRestore = ctx.restore;
  ctx.__originalRotate = ctx.rotate;
  ctx.__originalScale = ctx.scale;
  ctx.__originalTranslate = ctx.translate;
  ctx.__originalTransform = ctx.transform;
  ctx.__originalSetTransform = ctx.setTransform;
  ctx.__originalResetTransform = ctx.resetTransform;
  ctx.__originalClip = ctx.clip;
  ctx.__originalMoveTo = ctx.moveTo;
  ctx.__originalLineTo = ctx.lineTo;
  ctx.__originalBezierCurveTo = ctx.bezierCurveTo;
  ctx.__originalRect = ctx.rect;
  ctx.__originalClosePath = ctx.closePath;
  ctx.__originalBeginPath = ctx.beginPath;
  ctx._removeMirroring = () => {
    ctx.save = ctx.__originalSave;
    ctx.restore = ctx.__originalRestore;
    ctx.rotate = ctx.__originalRotate;
    ctx.scale = ctx.__originalScale;
    ctx.translate = ctx.__originalTranslate;
    ctx.transform = ctx.__originalTransform;
    ctx.setTransform = ctx.__originalSetTransform;
    ctx.resetTransform = ctx.__originalResetTransform;
    ctx.clip = ctx.__originalClip;
    ctx.moveTo = ctx.__originalMoveTo;
    ctx.lineTo = ctx.__originalLineTo;
    ctx.bezierCurveTo = ctx.__originalBezierCurveTo;
    ctx.rect = ctx.__originalRect;
    ctx.closePath = ctx.__originalClosePath;
    ctx.beginPath = ctx.__originalBeginPath;
    delete ctx._removeMirroring;
  };
  ctx.save = function ctxSave() {
    destCtx.save();
    this.__originalSave();
  };
  ctx.restore = function ctxRestore() {
    destCtx.restore();
    this.__originalRestore();
  };
  ctx.translate = function ctxTranslate(x, y) {
    destCtx.translate(x, y);
    this.__originalTranslate(x, y);
  };
  ctx.scale = function ctxScale(x, y) {
    destCtx.scale(x, y);
    this.__originalScale(x, y);
  };
  ctx.transform = function ctxTransform(a, b, c, d, e, f) {
    destCtx.transform(a, b, c, d, e, f);
    this.__originalTransform(a, b, c, d, e, f);
  };
  ctx.setTransform = function ctxSetTransform(a, b, c, d, e, f) {
    destCtx.setTransform(a, b, c, d, e, f);
    this.__originalSetTransform(a, b, c, d, e, f);
  };
  ctx.resetTransform = function ctxResetTransform() {
    destCtx.resetTransform();
    this.__originalResetTransform();
  };
  ctx.rotate = function ctxRotate(angle) {
    destCtx.rotate(angle);
    this.__originalRotate(angle);
  };
  ctx.clip = function ctxRotate(rule) {
    destCtx.clip(rule);
    this.__originalClip(rule);
  };
  ctx.moveTo = function (x, y) {
    destCtx.moveTo(x, y);
    this.__originalMoveTo(x, y);
  };
  ctx.lineTo = function (x, y) {
    destCtx.lineTo(x, y);
    this.__originalLineTo(x, y);
  };
  ctx.bezierCurveTo = function (cp1x, cp1y, cp2x, cp2y, x, y) {
    destCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    this.__originalBezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
  };
  ctx.rect = function (x, y, width, height) {
    destCtx.rect(x, y, width, height);
    this.__originalRect(x, y, width, height);
  };
  ctx.closePath = function () {
    destCtx.closePath();
    this.__originalClosePath();
  };
  ctx.beginPath = function () {
    destCtx.beginPath();
    this.__originalBeginPath();
  };
}
class CachedCanvases {
  constructor(canvasFactory) {
    this.canvasFactory = canvasFactory;
    this.cache = Object.create(null);
  }
  getCanvas(id, width, height) {
    let canvasEntry;
    if (this.cache[id] !== undefined) {
      canvasEntry = this.cache[id];
      this.canvasFactory.reset(canvasEntry, width, height);
    } else {
      canvasEntry = this.canvasFactory.create(width, height);
      this.cache[id] = canvasEntry;
    }
    return canvasEntry;
  }
  delete(id) {
    delete this.cache[id];
  }
  clear() {
    for (const id in this.cache) {
      const canvasEntry = this.cache[id];
      this.canvasFactory.destroy(canvasEntry);
      delete this.cache[id];
    }
  }
}
function drawImageAtIntegerCoords(ctx, srcImg, srcX, srcY, srcW, srcH, destX, destY, destW, destH) {
  const [a, b, c, d, tx, ty] = (0, _display_utils.getCurrentTransform)(ctx);
  if (b === 0 && c === 0) {
    const tlX = destX * a + tx;
    const rTlX = Math.round(tlX);
    const tlY = destY * d + ty;
    const rTlY = Math.round(tlY);
    const brX = (destX + destW) * a + tx;
    const rWidth = Math.abs(Math.round(brX) - rTlX) || 1;
    const brY = (destY + destH) * d + ty;
    const rHeight = Math.abs(Math.round(brY) - rTlY) || 1;
    ctx.setTransform(Math.sign(a), 0, 0, Math.sign(d), rTlX, rTlY);
    ctx.drawImage(srcImg, srcX, srcY, srcW, srcH, 0, 0, rWidth, rHeight);
    ctx.setTransform(a, b, c, d, tx, ty);
    return [rWidth, rHeight];
  }
  if (a === 0 && d === 0) {
    const tlX = destY * c + tx;
    const rTlX = Math.round(tlX);
    const tlY = destX * b + ty;
    const rTlY = Math.round(tlY);
    const brX = (destY + destH) * c + tx;
    const rWidth = Math.abs(Math.round(brX) - rTlX) || 1;
    const brY = (destX + destW) * b + ty;
    const rHeight = Math.abs(Math.round(brY) - rTlY) || 1;
    ctx.setTransform(0, Math.sign(b), Math.sign(c), 0, rTlX, rTlY);
    ctx.drawImage(srcImg, srcX, srcY, srcW, srcH, 0, 0, rHeight, rWidth);
    ctx.setTransform(a, b, c, d, tx, ty);
    return [rHeight, rWidth];
  }
  ctx.drawImage(srcImg, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
  const scaleX = Math.hypot(a, b);
  const scaleY = Math.hypot(c, d);
  return [scaleX * destW, scaleY * destH];
}
function compileType3Glyph(imgData) {
  const {
    width,
    height
  } = imgData;
  if (width > MAX_SIZE_TO_COMPILE || height > MAX_SIZE_TO_COMPILE) {
    return null;
  }
  const POINT_TO_PROCESS_LIMIT = 1000;
  const POINT_TYPES = new Uint8Array([0, 2, 4, 0, 1, 0, 5, 4, 8, 10, 0, 8, 0, 2, 1, 0]);
  const width1 = width + 1;
  let points = new Uint8Array(width1 * (height + 1));
  let i, j, j0;
  const lineSize = width + 7 & ~7;
  let data = new Uint8Array(lineSize * height),
    pos = 0;
  for (const elem of imgData.data) {
    let mask = 128;
    while (mask > 0) {
      data[pos++] = elem & mask ? 0 : 255;
      mask >>= 1;
    }
  }
  let count = 0;
  pos = 0;
  if (data[pos] !== 0) {
    points[0] = 1;
    ++count;
  }
  for (j = 1; j < width; j++) {
    if (data[pos] !== data[pos + 1]) {
      points[j] = data[pos] ? 2 : 1;
      ++count;
    }
    pos++;
  }
  if (data[pos] !== 0) {
    points[j] = 2;
    ++count;
  }
  for (i = 1; i < height; i++) {
    pos = i * lineSize;
    j0 = i * width1;
    if (data[pos - lineSize] !== data[pos]) {
      points[j0] = data[pos] ? 1 : 8;
      ++count;
    }
    let sum = (data[pos] ? 4 : 0) + (data[pos - lineSize] ? 8 : 0);
    for (j = 1; j < width; j++) {
      sum = (sum >> 2) + (data[pos + 1] ? 4 : 0) + (data[pos - lineSize + 1] ? 8 : 0);
      if (POINT_TYPES[sum]) {
        points[j0 + j] = POINT_TYPES[sum];
        ++count;
      }
      pos++;
    }
    if (data[pos - lineSize] !== data[pos]) {
      points[j0 + j] = data[pos] ? 2 : 4;
      ++count;
    }
    if (count > POINT_TO_PROCESS_LIMIT) {
      return null;
    }
  }
  pos = lineSize * (height - 1);
  j0 = i * width1;
  if (data[pos] !== 0) {
    points[j0] = 8;
    ++count;
  }
  for (j = 1; j < width; j++) {
    if (data[pos] !== data[pos + 1]) {
      points[j0 + j] = data[pos] ? 4 : 8;
      ++count;
    }
    pos++;
  }
  if (data[pos] !== 0) {
    points[j0 + j] = 4;
    ++count;
  }
  if (count > POINT_TO_PROCESS_LIMIT) {
    return null;
  }
  const steps = new Int32Array([0, width1, -1, 0, -width1, 0, 0, 0, 1]);
  const path = new Path2D();
  for (i = 0; count && i <= height; i++) {
    let p = i * width1;
    const end = p + width;
    while (p < end && !points[p]) {
      p++;
    }
    if (p === end) {
      continue;
    }
    path.moveTo(p % width1, i);
    const p0 = p;
    let type = points[p];
    do {
      const step = steps[type];
      do {
        p += step;
      } while (!points[p]);
      const pp = points[p];
      if (pp !== 5 && pp !== 10) {
        type = pp;
        points[p] = 0;
      } else {
        type = pp & 0x33 * type >> 4;
        points[p] &= type >> 2 | type << 2;
      }
      path.lineTo(p % width1, p / width1 | 0);
      if (!points[p]) {
        --count;
      }
    } while (p0 !== p);
    --i;
  }
  data = null;
  points = null;
  const drawOutline = function (c) {
    c.save();
    c.scale(1 / width, -1 / height);
    c.translate(0, -height);
    c.fill(path);
    c.beginPath();
    c.restore();
  };
  return drawOutline;
}
class CanvasExtraState {
  constructor(width, height) {
    this.alphaIsShape = false;
    this.fontSize = 0;
    this.fontSizeScale = 1;
    this.textMatrix = _util.IDENTITY_MATRIX;
    this.textMatrixScale = 1;
    this.fontMatrix = _util.FONT_IDENTITY_MATRIX;
    this.leading = 0;
    this.x = 0;
    this.y = 0;
    this.lineX = 0;
    this.lineY = 0;
    this.charSpacing = 0;
    this.wordSpacing = 0;
    this.textHScale = 1;
    this.textRenderingMode = _util.TextRenderingMode.FILL;
    this.textRise = 0;
    this.fillColor = "#000000";
    this.strokeColor = "#000000";
    this.patternFill = false;
    this.fillAlpha = 1;
    this.strokeAlpha = 1;
    this.lineWidth = 1;
    this.activeSMask = null;
    this.transferMaps = "none";
    this.startNewPathAndClipBox([0, 0, width, height]);
  }
  clone() {
    const clone = Object.create(this);
    clone.clipBox = this.clipBox.slice();
    return clone;
  }
  setCurrentPoint(x, y) {
    this.x = x;
    this.y = y;
  }
  updatePathMinMax(transform, x, y) {
    [x, y] = _util.Util.applyTransform([x, y], transform);
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }
  updateRectMinMax(transform, rect) {
    const p1 = _util.Util.applyTransform(rect, transform);
    const p2 = _util.Util.applyTransform(rect.slice(2), transform);
    this.minX = Math.min(this.minX, p1[0], p2[0]);
    this.minY = Math.min(this.minY, p1[1], p2[1]);
    this.maxX = Math.max(this.maxX, p1[0], p2[0]);
    this.maxY = Math.max(this.maxY, p1[1], p2[1]);
  }
  updateScalingPathMinMax(transform, minMax) {
    _util.Util.scaleMinMax(transform, minMax);
    this.minX = Math.min(this.minX, minMax[0]);
    this.maxX = Math.max(this.maxX, minMax[1]);
    this.minY = Math.min(this.minY, minMax[2]);
    this.maxY = Math.max(this.maxY, minMax[3]);
  }
  updateCurvePathMinMax(transform, x0, y0, x1, y1, x2, y2, x3, y3, minMax) {
    const box = _util.Util.bezierBoundingBox(x0, y0, x1, y1, x2, y2, x3, y3);
    if (minMax) {
      minMax[0] = Math.min(minMax[0], box[0], box[2]);
      minMax[1] = Math.max(minMax[1], box[0], box[2]);
      minMax[2] = Math.min(minMax[2], box[1], box[3]);
      minMax[3] = Math.max(minMax[3], box[1], box[3]);
      return;
    }
    this.updateRectMinMax(transform, box);
  }
  getPathBoundingBox(pathType = _pattern_helper.PathType.FILL, transform = null) {
    const box = [this.minX, this.minY, this.maxX, this.maxY];
    if (pathType === _pattern_helper.PathType.STROKE) {
      if (!transform) {
        (0, _util.unreachable)("Stroke bounding box must include transform.");
      }
      const scale = _util.Util.singularValueDecompose2dScale(transform);
      const xStrokePad = scale[0] * this.lineWidth / 2;
      const yStrokePad = scale[1] * this.lineWidth / 2;
      box[0] -= xStrokePad;
      box[1] -= yStrokePad;
      box[2] += xStrokePad;
      box[3] += yStrokePad;
    }
    return box;
  }
  updateClipFromPath() {
    const intersect = _util.Util.intersect(this.clipBox, this.getPathBoundingBox());
    this.startNewPathAndClipBox(intersect || [0, 0, 0, 0]);
  }
  isEmptyClip() {
    return this.minX === Infinity;
  }
  startNewPathAndClipBox(box) {
    this.clipBox = box;
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = 0;
    this.maxY = 0;
  }
  getClippedPathBoundingBox(pathType = _pattern_helper.PathType.FILL, transform = null) {
    return _util.Util.intersect(this.clipBox, this.getPathBoundingBox(pathType, transform));
  }
}
function putBinaryImageData(ctx, imgData) {
  if (typeof ImageData !== "undefined" && imgData instanceof ImageData) {
    ctx.putImageData(imgData, 0, 0);
    return;
  }
  const height = imgData.height,
    width = imgData.width;
  const partialChunkHeight = height % FULL_CHUNK_HEIGHT;
  const fullChunks = (height - partialChunkHeight) / FULL_CHUNK_HEIGHT;
  const totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1;
  const chunkImgData = ctx.createImageData(width, FULL_CHUNK_HEIGHT);
  let srcPos = 0,
    destPos;
  const src = imgData.data;
  const dest = chunkImgData.data;
  let i, j, thisChunkHeight, elemsInThisChunk;
  if (imgData.kind === _util.ImageKind.GRAYSCALE_1BPP) {
    const srcLength = src.byteLength;
    const dest32 = new Uint32Array(dest.buffer, 0, dest.byteLength >> 2);
    const dest32DataLength = dest32.length;
    const fullSrcDiff = width + 7 >> 3;
    const white = 0xffffffff;
    const black = _util.FeatureTest.isLittleEndian ? 0xff000000 : 0x000000ff;
    for (i = 0; i < totalChunks; i++) {
      thisChunkHeight = i < fullChunks ? FULL_CHUNK_HEIGHT : partialChunkHeight;
      destPos = 0;
      for (j = 0; j < thisChunkHeight; j++) {
        const srcDiff = srcLength - srcPos;
        let k = 0;
        const kEnd = srcDiff > fullSrcDiff ? width : srcDiff * 8 - 7;
        const kEndUnrolled = kEnd & ~7;
        let mask = 0;
        let srcByte = 0;
        for (; k < kEndUnrolled; k += 8) {
          srcByte = src[srcPos++];
          dest32[destPos++] = srcByte & 128 ? white : black;
          dest32[destPos++] = srcByte & 64 ? white : black;
          dest32[destPos++] = srcByte & 32 ? white : black;
          dest32[destPos++] = srcByte & 16 ? white : black;
          dest32[destPos++] = srcByte & 8 ? white : black;
          dest32[destPos++] = srcByte & 4 ? white : black;
          dest32[destPos++] = srcByte & 2 ? white : black;
          dest32[destPos++] = srcByte & 1 ? white : black;
        }
        for (; k < kEnd; k++) {
          if (mask === 0) {
            srcByte = src[srcPos++];
            mask = 128;
          }
          dest32[destPos++] = srcByte & mask ? white : black;
          mask >>= 1;
        }
      }
      while (destPos < dest32DataLength) {
        dest32[destPos++] = 0;
      }
      ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
    }
  } else if (imgData.kind === _util.ImageKind.RGBA_32BPP) {
    j = 0;
    elemsInThisChunk = width * FULL_CHUNK_HEIGHT * 4;
    for (i = 0; i < fullChunks; i++) {
      dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));
      srcPos += elemsInThisChunk;
      ctx.putImageData(chunkImgData, 0, j);
      j += FULL_CHUNK_HEIGHT;
    }
    if (i < totalChunks) {
      elemsInThisChunk = width * partialChunkHeight * 4;
      dest.set(src.subarray(srcPos, srcPos + elemsInThisChunk));
      ctx.putImageData(chunkImgData, 0, j);
    }
  } else if (imgData.kind === _util.ImageKind.RGB_24BPP) {
    thisChunkHeight = FULL_CHUNK_HEIGHT;
    elemsInThisChunk = width * thisChunkHeight;
    for (i = 0; i < totalChunks; i++) {
      if (i >= fullChunks) {
        thisChunkHeight = partialChunkHeight;
        elemsInThisChunk = width * thisChunkHeight;
      }
      destPos = 0;
      for (j = elemsInThisChunk; j--;) {
        dest[destPos++] = src[srcPos++];
        dest[destPos++] = src[srcPos++];
        dest[destPos++] = src[srcPos++];
        dest[destPos++] = 255;
      }
      ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
    }
  } else {
    throw new Error(`bad image kind: ${imgData.kind}`);
  }
}
function putBinaryImageMask(ctx, imgData) {
  if (imgData.bitmap) {
    ctx.drawImage(imgData.bitmap, 0, 0);
    return;
  }
  const height = imgData.height,
    width = imgData.width;
  const partialChunkHeight = height % FULL_CHUNK_HEIGHT;
  const fullChunks = (height - partialChunkHeight) / FULL_CHUNK_HEIGHT;
  const totalChunks = partialChunkHeight === 0 ? fullChunks : fullChunks + 1;
  const chunkImgData = ctx.createImageData(width, FULL_CHUNK_HEIGHT);
  let srcPos = 0;
  const src = imgData.data;
  const dest = chunkImgData.data;
  for (let i = 0; i < totalChunks; i++) {
    const thisChunkHeight = i < fullChunks ? FULL_CHUNK_HEIGHT : partialChunkHeight;
    ({
      srcPos
    } = (0, _image_utils.convertBlackAndWhiteToRGBA)({
      src,
      srcPos,
      dest,
      width,
      height: thisChunkHeight,
      nonBlackColor: 0
    }));
    ctx.putImageData(chunkImgData, 0, i * FULL_CHUNK_HEIGHT);
  }
}
function copyCtxState(sourceCtx, destCtx) {
  const properties = ["strokeStyle", "fillStyle", "fillRule", "globalAlpha", "lineWidth", "lineCap", "lineJoin", "miterLimit", "globalCompositeOperation", "font", "filter"];
  for (const property of properties) {
    if (sourceCtx[property] !== undefined) {
      destCtx[property] = sourceCtx[property];
    }
  }
  if (sourceCtx.setLineDash !== undefined) {
    destCtx.setLineDash(sourceCtx.getLineDash());
    destCtx.lineDashOffset = sourceCtx.lineDashOffset;
  }
}
function resetCtxToDefault(ctx) {
  ctx.strokeStyle = ctx.fillStyle = "#000000";
  ctx.fillRule = "nonzero";
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.miterLimit = 10;
  ctx.globalCompositeOperation = "source-over";
  ctx.font = "10px sans-serif";
  if (ctx.setLineDash !== undefined) {
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
  if (!_util.isNodeJS) {
    const {
      filter
    } = ctx;
    if (filter !== "none" && filter !== "") {
      ctx.filter = "none";
    }
  }
}
function composeSMaskBackdrop(bytes, r0, g0, b0) {
  const length = bytes.length;
  for (let i = 3; i < length; i += 4) {
    const alpha = bytes[i];
    if (alpha === 0) {
      bytes[i - 3] = r0;
      bytes[i - 2] = g0;
      bytes[i - 1] = b0;
    } else if (alpha < 255) {
      const alpha_ = 255 - alpha;
      bytes[i - 3] = bytes[i - 3] * alpha + r0 * alpha_ >> 8;
      bytes[i - 2] = bytes[i - 2] * alpha + g0 * alpha_ >> 8;
      bytes[i - 1] = bytes[i - 1] * alpha + b0 * alpha_ >> 8;
    }
  }
}
function composeSMaskAlpha(maskData, layerData, transferMap) {
  const length = maskData.length;
  const scale = 1 / 255;
  for (let i = 3; i < length; i += 4) {
    const alpha = transferMap ? transferMap[maskData[i]] : maskData[i];
    layerData[i] = layerData[i] * alpha * scale | 0;
  }
}
function composeSMaskLuminosity(maskData, layerData, transferMap) {
  const length = maskData.length;
  for (let i = 3; i < length; i += 4) {
    const y = maskData[i - 3] * 77 + maskData[i - 2] * 152 + maskData[i - 1] * 28;
    layerData[i] = transferMap ? layerData[i] * transferMap[y >> 8] >> 8 : layerData[i] * y >> 16;
  }
}
function genericComposeSMask(maskCtx, layerCtx, width, height, subtype, backdrop, transferMap, layerOffsetX, layerOffsetY, maskOffsetX, maskOffsetY) {
  const hasBackdrop = !!backdrop;
  const r0 = hasBackdrop ? backdrop[0] : 0;
  const g0 = hasBackdrop ? backdrop[1] : 0;
  const b0 = hasBackdrop ? backdrop[2] : 0;
  const composeFn = subtype === "Luminosity" ? composeSMaskLuminosity : composeSMaskAlpha;
  const PIXELS_TO_PROCESS = 1048576;
  const chunkSize = Math.min(height, Math.ceil(PIXELS_TO_PROCESS / width));
  for (let row = 0; row < height; row += chunkSize) {
    const chunkHeight = Math.min(chunkSize, height - row);
    const maskData = maskCtx.getImageData(layerOffsetX - maskOffsetX, row + (layerOffsetY - maskOffsetY), width, chunkHeight);
    const layerData = layerCtx.getImageData(layerOffsetX, row + layerOffsetY, width, chunkHeight);
    if (hasBackdrop) {
      composeSMaskBackdrop(maskData.data, r0, g0, b0);
    }
    composeFn(maskData.data, layerData.data, transferMap);
    layerCtx.putImageData(layerData, layerOffsetX, row + layerOffsetY);
  }
}
function composeSMask(ctx, smask, layerCtx, layerBox) {
  const layerOffsetX = layerBox[0];
  const layerOffsetY = layerBox[1];
  const layerWidth = layerBox[2] - layerOffsetX;
  const layerHeight = layerBox[3] - layerOffsetY;
  if (layerWidth === 0 || layerHeight === 0) {
    return;
  }
  genericComposeSMask(smask.context, layerCtx, layerWidth, layerHeight, smask.subtype, smask.backdrop, smask.transferMap, layerOffsetX, layerOffsetY, smask.offsetX, smask.offsetY);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layerCtx.canvas, 0, 0);
  ctx.restore();
}
function getImageSmoothingEnabled(transform, interpolate) {
  const scale = _util.Util.singularValueDecompose2dScale(transform);
  scale[0] = Math.fround(scale[0]);
  scale[1] = Math.fround(scale[1]);
  const actualScale = Math.fround((globalThis.devicePixelRatio || 1) * _display_utils.PixelsPerInch.PDF_TO_CSS_UNITS);
  if (interpolate !== undefined) {
    return interpolate;
  } else if (scale[0] <= actualScale || scale[1] <= actualScale) {
    return true;
  }
  return false;
}
const LINE_CAP_STYLES = ["butt", "round", "square"];
const LINE_JOIN_STYLES = ["miter", "round", "bevel"];
const NORMAL_CLIP = {};
const EO_CLIP = {};
class CanvasGraphics {
  constructor(canvasCtx, commonObjs, objs, canvasFactory, filterFactory, {
    optionalContentConfig,
    markedContentStack = null
  }, annotationCanvasMap, pageColors) {
    this.ctx = canvasCtx;
    this.current = new CanvasExtraState(this.ctx.canvas.width, this.ctx.canvas.height);
    this.stateStack = [];
    this.pendingClip = null;
    this.pendingEOFill = false;
    this.res = null;
    this.xobjs = null;
    this.commonObjs = commonObjs;
    this.objs = objs;
    this.canvasFactory = canvasFactory;
    this.filterFactory = filterFactory;
    this.groupStack = [];
    this.processingType3 = null;
    this.baseTransform = null;
    this.baseTransformStack = [];
    this.groupLevel = 0;
    this.smaskStack = [];
    this.smaskCounter = 0;
    this.tempSMask = null;
    this.suspendedCtx = null;
    this.contentVisible = true;
    this.markedContentStack = markedContentStack || [];
    this.optionalContentConfig = optionalContentConfig;
    this.cachedCanvases = new CachedCanvases(this.canvasFactory);
    this.cachedPatterns = new Map();
    this.annotationCanvasMap = annotationCanvasMap;
    this.viewportScale = 1;
    this.outputScaleX = 1;
    this.outputScaleY = 1;
    this.pageColors = pageColors;
    this._cachedScaleForStroking = [-1, 0];
    this._cachedGetSinglePixelWidth = null;
    this._cachedBitmapsMap = new Map();
  }
  getObject(data, fallback = null) {
    if (typeof data === "string") {
      return data.startsWith("g_") ? this.commonObjs.get(data) : this.objs.get(data);
    }
    return fallback;
  }
  beginDrawing({
    transform,
    viewport,
    transparency = false,
    background = null
  }) {
    const width = this.ctx.canvas.width;
    const height = this.ctx.canvas.height;
    const savedFillStyle = this.ctx.fillStyle;
    this.ctx.fillStyle = background || "#ffffff";
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.fillStyle = savedFillStyle;
    if (transparency) {
      const transparentCanvas = this.cachedCanvases.getCanvas("transparent", width, height);
      this.compositeCtx = this.ctx;
      this.transparentCanvas = transparentCanvas.canvas;
      this.ctx = transparentCanvas.context;
      this.ctx.save();
      this.ctx.transform(...(0, _display_utils.getCurrentTransform)(this.compositeCtx));
    }
    this.ctx.save();
    resetCtxToDefault(this.ctx);
    if (transform) {
      this.ctx.transform(...transform);
      this.outputScaleX = transform[0];
      this.outputScaleY = transform[0];
    }
    this.ctx.transform(...viewport.transform);
    this.viewportScale = viewport.scale;
    this.baseTransform = (0, _display_utils.getCurrentTransform)(this.ctx);
  }
  executeOperatorList(operatorList, executionStartIdx, continueCallback, stepper) {
    const argsArray = operatorList.argsArray;
    const fnArray = operatorList.fnArray;
    let i = executionStartIdx || 0;
    const argsArrayLen = argsArray.length;
    if (argsArrayLen === i) {
      return i;
    }
    const chunkOperations = argsArrayLen - i > EXECUTION_STEPS && typeof continueCallback === "function";
    const endTime = chunkOperations ? Date.now() + EXECUTION_TIME : 0;
    let steps = 0;
    const commonObjs = this.commonObjs;
    const objs = this.objs;
    let fnId;
    while (true) {
      if (stepper !== undefined && i === stepper.nextBreakPoint) {
        stepper.breakIt(i, continueCallback);
        return i;
      }
      fnId = fnArray[i];
      if (fnId !== _util.OPS.dependency) {
        this[fnId].apply(this, argsArray[i]);
      } else {
        for (const depObjId of argsArray[i]) {
          const objsPool = depObjId.startsWith("g_") ? commonObjs : objs;
          if (!objsPool.has(depObjId)) {
            objsPool.get(depObjId, continueCallback);
            return i;
          }
        }
      }
      i++;
      if (i === argsArrayLen) {
        return i;
      }
      if (chunkOperations && ++steps > EXECUTION_STEPS) {
        if (Date.now() > endTime) {
          continueCallback();
          return i;
        }
        steps = 0;
      }
    }
  }
  #restoreInitialState() {
    while (this.stateStack.length || this.inSMaskMode) {
      this.restore();
    }
    this.ctx.restore();
    if (this.transparentCanvas) {
      this.ctx = this.compositeCtx;
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.drawImage(this.transparentCanvas, 0, 0);
      this.ctx.restore();
      this.transparentCanvas = null;
    }
  }
  endDrawing() {
    this.#restoreInitialState();
    this.cachedCanvases.clear();
    this.cachedPatterns.clear();
    for (const cache of this._cachedBitmapsMap.values()) {
      for (const canvas of cache.values()) {
        if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement) {
          canvas.width = canvas.height = 0;
        }
      }
      cache.clear();
    }
    this._cachedBitmapsMap.clear();
    this.#drawFilter();
  }
  #drawFilter() {
    if (this.pageColors) {
      const hcmFilterId = this.filterFactory.addHCMFilter(this.pageColors.foreground, this.pageColors.background);
      if (hcmFilterId !== "none") {
        const savedFilter = this.ctx.filter;
        this.ctx.filter = hcmFilterId;
        this.ctx.drawImage(this.ctx.canvas, 0, 0);
        this.ctx.filter = savedFilter;
      }
    }
  }
  _scaleImage(img, inverseTransform) {
    const width = img.width;
    const height = img.height;
    let widthScale = Math.max(Math.hypot(inverseTransform[0], inverseTransform[1]), 1);
    let heightScale = Math.max(Math.hypot(inverseTransform[2], inverseTransform[3]), 1);
    let paintWidth = width,
      paintHeight = height;
    let tmpCanvasId = "prescale1";
    let tmpCanvas, tmpCtx;
    while (widthScale > 2 && paintWidth > 1 || heightScale > 2 && paintHeight > 1) {
      let newWidth = paintWidth,
        newHeight = paintHeight;
      if (widthScale > 2 && paintWidth > 1) {
        newWidth = paintWidth >= 16384 ? Math.floor(paintWidth / 2) - 1 || 1 : Math.ceil(paintWidth / 2);
        widthScale /= paintWidth / newWidth;
      }
      if (heightScale > 2 && paintHeight > 1) {
        newHeight = paintHeight >= 16384 ? Math.floor(paintHeight / 2) - 1 || 1 : Math.ceil(paintHeight) / 2;
        heightScale /= paintHeight / newHeight;
      }
      tmpCanvas = this.cachedCanvases.getCanvas(tmpCanvasId, newWidth, newHeight);
      tmpCtx = tmpCanvas.context;
      tmpCtx.clearRect(0, 0, newWidth, newHeight);
      tmpCtx.drawImage(img, 0, 0, paintWidth, paintHeight, 0, 0, newWidth, newHeight);
      img = tmpCanvas.canvas;
      paintWidth = newWidth;
      paintHeight = newHeight;
      tmpCanvasId = tmpCanvasId === "prescale1" ? "prescale2" : "prescale1";
    }
    return {
      img,
      paintWidth,
      paintHeight
    };
  }
  _createMaskCanvas(img) {
    const ctx = this.ctx;
    const {
      width,
      height
    } = img;
    const fillColor = this.current.fillColor;
    const isPatternFill = this.current.patternFill;
    const currentTransform = (0, _display_utils.getCurrentTransform)(ctx);
    let cache, cacheKey, scaled, maskCanvas;
    if ((img.bitmap || img.data) && img.count > 1) {
      const mainKey = img.bitmap || img.data.buffer;
      cacheKey = JSON.stringify(isPatternFill ? currentTransform : [currentTransform.slice(0, 4), fillColor]);
      cache = this._cachedBitmapsMap.get(mainKey);
      if (!cache) {
        cache = new Map();
        this._cachedBitmapsMap.set(mainKey, cache);
      }
      const cachedImage = cache.get(cacheKey);
      if (cachedImage && !isPatternFill) {
        const offsetX = Math.round(Math.min(currentTransform[0], currentTransform[2]) + currentTransform[4]);
        const offsetY = Math.round(Math.min(currentTransform[1], currentTransform[3]) + currentTransform[5]);
        return {
          canvas: cachedImage,
          offsetX,
          offsetY
        };
      }
      scaled = cachedImage;
    }
    if (!scaled) {
      maskCanvas = this.cachedCanvases.getCanvas("maskCanvas", width, height);
      putBinaryImageMask(maskCanvas.context, img);
    }
    let maskToCanvas = _util.Util.transform(currentTransform, [1 / width, 0, 0, -1 / height, 0, 0]);
    maskToCanvas = _util.Util.transform(maskToCanvas, [1, 0, 0, 1, 0, -height]);
    const cord1 = _util.Util.applyTransform([0, 0], maskToCanvas);
    const cord2 = _util.Util.applyTransform([width, height], maskToCanvas);
    const rect = _util.Util.normalizeRect([cord1[0], cord1[1], cord2[0], cord2[1]]);
    const drawnWidth = Math.round(rect[2] - rect[0]) || 1;
    const drawnHeight = Math.round(rect[3] - rect[1]) || 1;
    const fillCanvas = this.cachedCanvases.getCanvas("fillCanvas", drawnWidth, drawnHeight);
    const fillCtx = fillCanvas.context;
    const offsetX = Math.min(cord1[0], cord2[0]);
    const offsetY = Math.min(cord1[1], cord2[1]);
    fillCtx.translate(-offsetX, -offsetY);
    fillCtx.transform(...maskToCanvas);
    if (!scaled) {
      scaled = this._scaleImage(maskCanvas.canvas, (0, _display_utils.getCurrentTransformInverse)(fillCtx));
      scaled = scaled.img;
      if (cache && isPatternFill) {
        cache.set(cacheKey, scaled);
      }
    }
    fillCtx.imageSmoothingEnabled = getImageSmoothingEnabled((0, _display_utils.getCurrentTransform)(fillCtx), img.interpolate);
    drawImageAtIntegerCoords(fillCtx, scaled, 0, 0, scaled.width, scaled.height, 0, 0, width, height);
    fillCtx.globalCompositeOperation = "source-in";
    const inverse = _util.Util.transform((0, _display_utils.getCurrentTransformInverse)(fillCtx), [1, 0, 0, 1, -offsetX, -offsetY]);
    fillCtx.fillStyle = isPatternFill ? fillColor.getPattern(ctx, this, inverse, _pattern_helper.PathType.FILL) : fillColor;
    fillCtx.fillRect(0, 0, width, height);
    if (cache && !isPatternFill) {
      this.cachedCanvases.delete("fillCanvas");
      cache.set(cacheKey, fillCanvas.canvas);
    }
    return {
      canvas: fillCanvas.canvas,
      offsetX: Math.round(offsetX),
      offsetY: Math.round(offsetY)
    };
  }
  setLineWidth(width) {
    if (width !== this.current.lineWidth) {
      this._cachedScaleForStroking[0] = -1;
    }
    this.current.lineWidth = width;
    this.ctx.lineWidth = width;
  }
  setLineCap(style) {
    this.ctx.lineCap = LINE_CAP_STYLES[style];
  }
  setLineJoin(style) {
    this.ctx.lineJoin = LINE_JOIN_STYLES[style];
  }
  setMiterLimit(limit) {
    this.ctx.miterLimit = limit;
  }
  setDash(dashArray, dashPhase) {
    const ctx = this.ctx;
    if (ctx.setLineDash !== undefined) {
      ctx.setLineDash(dashArray);
      ctx.lineDashOffset = dashPhase;
    }
  }
  setRenderingIntent(intent) {}
  setFlatness(flatness) {}
  setGState(states) {
    for (const [key, value] of states) {
      switch (key) {
        case "LW":
          this.setLineWidth(value);
          break;
        case "LC":
          this.setLineCap(value);
          break;
        case "LJ":
          this.setLineJoin(value);
          break;
        case "ML":
          this.setMiterLimit(value);
          break;
        case "D":
          this.setDash(value[0], value[1]);
          break;
        case "RI":
          this.setRenderingIntent(value);
          break;
        case "FL":
          this.setFlatness(value);
          break;
        case "Font":
          this.setFont(value[0], value[1]);
          break;
        case "CA":
          this.current.strokeAlpha = value;
          break;
        case "ca":
          this.current.fillAlpha = value;
          this.ctx.globalAlpha = value;
          break;
        case "BM":
          this.ctx.globalCompositeOperation = value;
          break;
        case "SMask":
          this.current.activeSMask = value ? this.tempSMask : null;
          this.tempSMask = null;
          this.checkSMaskState();
          break;
        case "TR":
          this.ctx.filter = this.current.transferMaps = this.filterFactory.addFilter(value);
          break;
      }
    }
  }
  get inSMaskMode() {
    return !!this.suspendedCtx;
  }
  checkSMaskState() {
    const inSMaskMode = this.inSMaskMode;
    if (this.current.activeSMask && !inSMaskMode) {
      this.beginSMaskMode();
    } else if (!this.current.activeSMask && inSMaskMode) {
      this.endSMaskMode();
    }
  }
  beginSMaskMode() {
    if (this.inSMaskMode) {
      throw new Error("beginSMaskMode called while already in smask mode");
    }
    const drawnWidth = this.ctx.canvas.width;
    const drawnHeight = this.ctx.canvas.height;
    const cacheId = "smaskGroupAt" + this.groupLevel;
    const scratchCanvas = this.cachedCanvases.getCanvas(cacheId, drawnWidth, drawnHeight);
    this.suspendedCtx = this.ctx;
    this.ctx = scratchCanvas.context;
    const ctx = this.ctx;
    ctx.setTransform(...(0, _display_utils.getCurrentTransform)(this.suspendedCtx));
    copyCtxState(this.suspendedCtx, ctx);
    mirrorContextOperations(ctx, this.suspendedCtx);
    this.setGState([["BM", "source-over"], ["ca", 1], ["CA", 1]]);
  }
  endSMaskMode() {
    if (!this.inSMaskMode) {
      throw new Error("endSMaskMode called while not in smask mode");
    }
    this.ctx._removeMirroring();
    copyCtxState(this.ctx, this.suspendedCtx);
    this.ctx = this.suspendedCtx;
    this.suspendedCtx = null;
  }
  compose(dirtyBox) {
    if (!this.current.activeSMask) {
      return;
    }
    if (!dirtyBox) {
      dirtyBox = [0, 0, this.ctx.canvas.width, this.ctx.canvas.height];
    } else {
      dirtyBox[0] = Math.floor(dirtyBox[0]);
      dirtyBox[1] = Math.floor(dirtyBox[1]);
      dirtyBox[2] = Math.ceil(dirtyBox[2]);
      dirtyBox[3] = Math.ceil(dirtyBox[3]);
    }
    const smask = this.current.activeSMask;
    const suspendedCtx = this.suspendedCtx;
    composeSMask(suspendedCtx, smask, this.ctx, dirtyBox);
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.restore();
  }
  save() {
    if (this.inSMaskMode) {
      copyCtxState(this.ctx, this.suspendedCtx);
      this.suspendedCtx.save();
    } else {
      this.ctx.save();
    }
    const old = this.current;
    this.stateStack.push(old);
    this.current = old.clone();
  }
  restore() {
    if (this.stateStack.length === 0 && this.inSMaskMode) {
      this.endSMaskMode();
    }
    if (this.stateStack.length !== 0) {
      this.current = this.stateStack.pop();
      if (this.inSMaskMode) {
        this.suspendedCtx.restore();
        copyCtxState(this.suspendedCtx, this.ctx);
      } else {
        this.ctx.restore();
      }
      this.checkSMaskState();
      this.pendingClip = null;
      this._cachedScaleForStroking[0] = -1;
      this._cachedGetSinglePixelWidth = null;
    }
  }
  transform(a, b, c, d, e, f) {
    this.ctx.transform(a, b, c, d, e, f);
    this._cachedScaleForStroking[0] = -1;
    this._cachedGetSinglePixelWidth = null;
  }
  constructPath(ops, args, minMax) {
    const ctx = this.ctx;
    const current = this.current;
    let x = current.x,
      y = current.y;
    let startX, startY;
    const currentTransform = (0, _display_utils.getCurrentTransform)(ctx);
    const isScalingMatrix = currentTransform[0] === 0 && currentTransform[3] === 0 || currentTransform[1] === 0 && currentTransform[2] === 0;
    const minMaxForBezier = isScalingMatrix ? minMax.slice(0) : null;
    for (let i = 0, j = 0, ii = ops.length; i < ii; i++) {
      switch (ops[i] | 0) {
        case _util.OPS.rectangle:
          x = args[j++];
          y = args[j++];
          const width = args[j++];
          const height = args[j++];
          const xw = x + width;
          const yh = y + height;
          ctx.moveTo(x, y);
          if (width === 0 || height === 0) {
            ctx.lineTo(xw, yh);
          } else {
            ctx.lineTo(xw, y);
            ctx.lineTo(xw, yh);
            ctx.lineTo(x, yh);
          }
          if (!isScalingMatrix) {
            current.updateRectMinMax(currentTransform, [x, y, xw, yh]);
          }
          ctx.closePath();
          break;
        case _util.OPS.moveTo:
          x = args[j++];
          y = args[j++];
          ctx.moveTo(x, y);
          if (!isScalingMatrix) {
            current.updatePathMinMax(currentTransform, x, y);
          }
          break;
        case _util.OPS.lineTo:
          x = args[j++];
          y = args[j++];
          ctx.lineTo(x, y);
          if (!isScalingMatrix) {
            current.updatePathMinMax(currentTransform, x, y);
          }
          break;
        case _util.OPS.curveTo:
          startX = x;
          startY = y;
          x = args[j + 4];
          y = args[j + 5];
          ctx.bezierCurveTo(args[j], args[j + 1], args[j + 2], args[j + 3], x, y);
          current.updateCurvePathMinMax(currentTransform, startX, startY, args[j], args[j + 1], args[j + 2], args[j + 3], x, y, minMaxForBezier);
          j += 6;
          break;
        case _util.OPS.curveTo2:
          startX = x;
          startY = y;
          ctx.bezierCurveTo(x, y, args[j], args[j + 1], args[j + 2], args[j + 3]);
          current.updateCurvePathMinMax(currentTransform, startX, startY, x, y, args[j], args[j + 1], args[j + 2], args[j + 3], minMaxForBezier);
          x = args[j + 2];
          y = args[j + 3];
          j += 4;
          break;
        case _util.OPS.curveTo3:
          startX = x;
          startY = y;
          x = args[j + 2];
          y = args[j + 3];
          ctx.bezierCurveTo(args[j], args[j + 1], x, y, x, y);
          current.updateCurvePathMinMax(currentTransform, startX, startY, args[j], args[j + 1], x, y, x, y, minMaxForBezier);
          j += 4;
          break;
        case _util.OPS.closePath:
          ctx.closePath();
          break;
      }
    }
    if (isScalingMatrix) {
      current.updateScalingPathMinMax(currentTransform, minMaxForBezier);
    }
    current.setCurrentPoint(x, y);
  }
  closePath() {
    this.ctx.closePath();
  }
  stroke(consumePath = true) {
    const ctx = this.ctx;
    const strokeColor = this.current.strokeColor;
    ctx.globalAlpha = this.current.strokeAlpha;
    if (this.contentVisible) {
      if (typeof strokeColor === "object" && strokeColor?.getPattern) {
        ctx.save();
        ctx.strokeStyle = strokeColor.getPattern(ctx, this, (0, _display_utils.getCurrentTransformInverse)(ctx), _pattern_helper.PathType.STROKE);
        this.rescaleAndStroke(false);
        ctx.restore();
      } else {
        this.rescaleAndStroke(true);
      }
    }
    if (consumePath) {
      this.consumePath(this.current.getClippedPathBoundingBox());
    }
    ctx.globalAlpha = this.current.fillAlpha;
  }
  closeStroke() {
    this.closePath();
    this.stroke();
  }
  fill(consumePath = true) {
    const ctx = this.ctx;
    const fillColor = this.current.fillColor;
    const isPatternFill = this.current.patternFill;
    let needRestore = false;
    if (isPatternFill) {
      ctx.save();
      ctx.fillStyle = fillColor.getPattern(ctx, this, (0, _display_utils.getCurrentTransformInverse)(ctx), _pattern_helper.PathType.FILL);
      needRestore = true;
    }
    const intersect = this.current.getClippedPathBoundingBox();
    if (this.contentVisible && intersect !== null) {
      if (this.pendingEOFill) {
        ctx.fill("evenodd");
        this.pendingEOFill = false;
      } else {
        ctx.fill();
      }
    }
    if (needRestore) {
      ctx.restore();
    }
    if (consumePath) {
      this.consumePath(intersect);
    }
  }
  eoFill() {
    this.pendingEOFill = true;
    this.fill();
  }
  fillStroke() {
    this.fill(false);
    this.stroke(false);
    this.consumePath();
  }
  eoFillStroke() {
    this.pendingEOFill = true;
    this.fillStroke();
  }
  closeFillStroke() {
    this.closePath();
    this.fillStroke();
  }
  closeEOFillStroke() {
    this.pendingEOFill = true;
    this.closePath();
    this.fillStroke();
  }
  endPath() {
    this.consumePath();
  }
  clip() {
    this.pendingClip = NORMAL_CLIP;
  }
  eoClip() {
    this.pendingClip = EO_CLIP;
  }
  beginText() {
    this.current.textMatrix = _util.IDENTITY_MATRIX;
    this.current.textMatrixScale = 1;
    this.current.x = this.current.lineX = 0;
    this.current.y = this.current.lineY = 0;
  }
  endText() {
    const paths = this.pendingTextPaths;
    const ctx = this.ctx;
    if (paths === undefined) {
      ctx.beginPath();
      return;
    }
    ctx.save();
    ctx.beginPath();
    for (const path of paths) {
      ctx.setTransform(...path.transform);
      ctx.translate(path.x, path.y);
      path.addToPath(ctx, path.fontSize);
    }
    ctx.restore();
    ctx.clip();
    ctx.beginPath();
    delete this.pendingTextPaths;
  }
  setCharSpacing(spacing) {
    this.current.charSpacing = spacing;
  }
  setWordSpacing(spacing) {
    this.current.wordSpacing = spacing;
  }
  setHScale(scale) {
    this.current.textHScale = scale / 100;
  }
  setLeading(leading) {
    this.current.leading = -leading;
  }
  setFont(fontRefName, size) {
    const fontObj = this.commonObjs.get(fontRefName);
    const current = this.current;
    if (!fontObj) {
      throw new Error(`Can't find font for ${fontRefName}`);
    }
    current.fontMatrix = fontObj.fontMatrix || _util.FONT_IDENTITY_MATRIX;
    if (current.fontMatrix[0] === 0 || current.fontMatrix[3] === 0) {
      (0, _util.warn)("Invalid font matrix for font " + fontRefName);
    }
    if (size < 0) {
      size = -size;
      current.fontDirection = -1;
    } else {
      current.fontDirection = 1;
    }
    this.current.font = fontObj;
    this.current.fontSize = size;
    if (fontObj.isType3Font) {
      return;
    }
    const name = fontObj.loadedName || "sans-serif";
    const typeface = fontObj.systemFontInfo?.css || `"${name}", ${fontObj.fallbackName}`;
    let bold = "normal";
    if (fontObj.black) {
      bold = "900";
    } else if (fontObj.bold) {
      bold = "bold";
    }
    const italic = fontObj.italic ? "italic" : "normal";
    let browserFontSize = size;
    if (size < MIN_FONT_SIZE) {
      browserFontSize = MIN_FONT_SIZE;
    } else if (size > MAX_FONT_SIZE) {
      browserFontSize = MAX_FONT_SIZE;
    }
    this.current.fontSizeScale = size / browserFontSize;
    this.ctx.font = `${italic} ${bold} ${browserFontSize}px ${typeface}`;
  }
  setTextRenderingMode(mode) {
    this.current.textRenderingMode = mode;
  }
  setTextRise(rise) {
    this.current.textRise = rise;
  }
  moveText(x, y) {
    this.current.x = this.current.lineX += x;
    this.current.y = this.current.lineY += y;
  }
  setLeadingMoveText(x, y) {
    this.setLeading(-y);
    this.moveText(x, y);
  }
  setTextMatrix(a, b, c, d, e, f) {
    this.current.textMatrix = [a, b, c, d, e, f];
    this.current.textMatrixScale = Math.hypot(a, b);
    this.current.x = this.current.lineX = 0;
    this.current.y = this.current.lineY = 0;
  }
  nextLine() {
    this.moveText(0, this.current.leading);
  }
  paintChar(character, x, y, patternTransform) {
    const ctx = this.ctx;
    const current = this.current;
    const font = current.font;
    const textRenderingMode = current.textRenderingMode;
    const fontSize = current.fontSize / current.fontSizeScale;
    const fillStrokeMode = textRenderingMode & _util.TextRenderingMode.FILL_STROKE_MASK;
    const isAddToPathSet = !!(textRenderingMode & _util.TextRenderingMode.ADD_TO_PATH_FLAG);
    const patternFill = current.patternFill && !font.missingFile;
    let addToPath;
    if (font.disableFontFace || isAddToPathSet || patternFill) {
      addToPath = font.getPathGenerator(this.commonObjs, character);
    }
    if (font.disableFontFace || patternFill) {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      addToPath(ctx, fontSize);
      if (patternTransform) {
        ctx.setTransform(...patternTransform);
      }
      if (fillStrokeMode === _util.TextRenderingMode.FILL || fillStrokeMode === _util.TextRenderingMode.FILL_STROKE) {
        ctx.fill();
      }
      if (fillStrokeMode === _util.TextRenderingMode.STROKE || fillStrokeMode === _util.TextRenderingMode.FILL_STROKE) {
        ctx.stroke();
      }
      ctx.restore();
    } else {
      if (fillStrokeMode === _util.TextRenderingMode.FILL || fillStrokeMode === _util.TextRenderingMode.FILL_STROKE) {
        ctx.fillText(character, x, y);
      }
      if (fillStrokeMode === _util.TextRenderingMode.STROKE || fillStrokeMode === _util.TextRenderingMode.FILL_STROKE) {
        ctx.strokeText(character, x, y);
      }
    }
    if (isAddToPathSet) {
      const paths = this.pendingTextPaths ||= [];
      paths.push({
        transform: (0, _display_utils.getCurrentTransform)(ctx),
        x,
        y,
        fontSize,
        addToPath
      });
    }
  }
  get isFontSubpixelAAEnabled() {
    const {
      context: ctx
    } = this.cachedCanvases.getCanvas("isFontSubpixelAAEnabled", 10, 10);
    ctx.scale(1.5, 1);
    ctx.fillText("I", 0, 10);
    const data = ctx.getImageData(0, 0, 10, 10).data;
    let enabled = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0 && data[i] < 255) {
        enabled = true;
        break;
      }
    }
    return (0, _util.shadow)(this, "isFontSubpixelAAEnabled", enabled);
  }
  showText(glyphs) {
    const current = this.current;
    const font = current.font;
    if (font.isType3Font) {
      return this.showType3Text(glyphs);
    }
    const fontSize = current.fontSize;
    if (fontSize === 0) {
      return undefined;
    }
    const ctx = this.ctx;
    const fontSizeScale = current.fontSizeScale;
    const charSpacing = current.charSpacing;
    const wordSpacing = current.wordSpacing;
    const fontDirection = current.fontDirection;
    const textHScale = current.textHScale * fontDirection;
    const glyphsLength = glyphs.length;
    const vertical = font.vertical;
    const spacingDir = vertical ? 1 : -1;
    const defaultVMetrics = font.defaultVMetrics;
    const widthAdvanceScale = fontSize * current.fontMatrix[0];
    const simpleFillText = current.textRenderingMode === _util.TextRenderingMode.FILL && !font.disableFontFace && !current.patternFill;
    ctx.save();
    ctx.transform(...current.textMatrix);
    ctx.translate(current.x, current.y + current.textRise);
    if (fontDirection > 0) {
      ctx.scale(textHScale, -1);
    } else {
      ctx.scale(textHScale, 1);
    }
    let patternTransform;
    if (current.patternFill) {
      ctx.save();
      const pattern = current.fillColor.getPattern(ctx, this, (0, _display_utils.getCurrentTransformInverse)(ctx), _pattern_helper.PathType.FILL);
      patternTransform = (0, _display_utils.getCurrentTransform)(ctx);
      ctx.restore();
      ctx.fillStyle = pattern;
    }
    let lineWidth = current.lineWidth;
    const scale = current.textMatrixScale;
    if (scale === 0 || lineWidth === 0) {
      const fillStrokeMode = current.textRenderingMode & _util.TextRenderingMode.FILL_STROKE_MASK;
      if (fillStrokeMode === _util.TextRenderingMode.STROKE || fillStrokeMode === _util.TextRenderingMode.FILL_STROKE) {
        lineWidth = this.getSinglePixelWidth();
      }
    } else {
      lineWidth /= scale;
    }
    if (fontSizeScale !== 1.0) {
      ctx.scale(fontSizeScale, fontSizeScale);
      lineWidth /= fontSizeScale;
    }
    ctx.lineWidth = lineWidth;
    if (font.isInvalidPDFjsFont) {
      const chars = [];
      let width = 0;
      for (const glyph of glyphs) {
        chars.push(glyph.unicode);
        width += glyph.width;
      }
      ctx.fillText(chars.join(""), 0, 0);
      current.x += width * widthAdvanceScale * textHScale;
      ctx.restore();
      this.compose();
      return undefined;
    }
    let x = 0,
      i;
    for (i = 0; i < glyphsLength; ++i) {
      const glyph = glyphs[i];
      if (typeof glyph === "number") {
        x += spacingDir * glyph * fontSize / 1000;
        continue;
      }
      let restoreNeeded = false;
      const spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
      const character = glyph.fontChar;
      const accent = glyph.accent;
      let scaledX, scaledY;
      let width = glyph.width;
      if (vertical) {
        const vmetric = glyph.vmetric || defaultVMetrics;
        const vx = -(glyph.vmetric ? vmetric[1] : width * 0.5) * widthAdvanceScale;
        const vy = vmetric[2] * widthAdvanceScale;
        width = vmetric ? -vmetric[0] : width;
        scaledX = vx / fontSizeScale;
        scaledY = (x + vy) / fontSizeScale;
      } else {
        scaledX = x / fontSizeScale;
        scaledY = 0;
      }
      if (font.remeasure && width > 0) {
        const measuredWidth = ctx.measureText(character).width * 1000 / fontSize * fontSizeScale;
        if (width < measuredWidth && this.isFontSubpixelAAEnabled) {
          const characterScaleX = width / measuredWidth;
          restoreNeeded = true;
          ctx.save();
          ctx.scale(characterScaleX, 1);
          scaledX /= characterScaleX;
        } else if (width !== measuredWidth) {
          scaledX += (width - measuredWidth) / 2000 * fontSize / fontSizeScale;
        }
      }
      if (this.contentVisible && (glyph.isInFont || font.missingFile)) {
        if (simpleFillText && !accent) {
          ctx.fillText(character, scaledX, scaledY);
        } else {
          this.paintChar(character, scaledX, scaledY, patternTransform);
          if (accent) {
            const scaledAccentX = scaledX + fontSize * accent.offset.x / fontSizeScale;
            const scaledAccentY = scaledY - fontSize * accent.offset.y / fontSizeScale;
            this.paintChar(accent.fontChar, scaledAccentX, scaledAccentY, patternTransform);
          }
        }
      }
      const charWidth = vertical ? width * widthAdvanceScale - spacing * fontDirection : width * widthAdvanceScale + spacing * fontDirection;
      x += charWidth;
      if (restoreNeeded) {
        ctx.restore();
      }
    }
    if (vertical) {
      current.y -= x;
    } else {
      current.x += x * textHScale;
    }
    ctx.restore();
    this.compose();
    return undefined;
  }
  showType3Text(glyphs) {
    const ctx = this.ctx;
    const current = this.current;
    const font = current.font;
    const fontSize = current.fontSize;
    const fontDirection = current.fontDirection;
    const spacingDir = font.vertical ? 1 : -1;
    const charSpacing = current.charSpacing;
    const wordSpacing = current.wordSpacing;
    const textHScale = current.textHScale * fontDirection;
    const fontMatrix = current.fontMatrix || _util.FONT_IDENTITY_MATRIX;
    const glyphsLength = glyphs.length;
    const isTextInvisible = current.textRenderingMode === _util.TextRenderingMode.INVISIBLE;
    let i, glyph, width, spacingLength;
    if (isTextInvisible || fontSize === 0) {
      return;
    }
    this._cachedScaleForStroking[0] = -1;
    this._cachedGetSinglePixelWidth = null;
    ctx.save();
    ctx.transform(...current.textMatrix);
    ctx.translate(current.x, current.y);
    ctx.scale(textHScale, fontDirection);
    for (i = 0; i < glyphsLength; ++i) {
      glyph = glyphs[i];
      if (typeof glyph === "number") {
        spacingLength = spacingDir * glyph * fontSize / 1000;
        this.ctx.translate(spacingLength, 0);
        current.x += spacingLength * textHScale;
        continue;
      }
      const spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
      const operatorList = font.charProcOperatorList[glyph.operatorListId];
      if (!operatorList) {
        (0, _util.warn)(`Type3 character "${glyph.operatorListId}" is not available.`);
        continue;
      }
      if (this.contentVisible) {
        this.processingType3 = glyph;
        this.save();
        ctx.scale(fontSize, fontSize);
        ctx.transform(...fontMatrix);
        this.executeOperatorList(operatorList);
        this.restore();
      }
      const transformed = _util.Util.applyTransform([glyph.width, 0], fontMatrix);
      width = transformed[0] * fontSize + spacing;
      ctx.translate(width, 0);
      current.x += width * textHScale;
    }
    ctx.restore();
    this.processingType3 = null;
  }
  setCharWidth(xWidth, yWidth) {}
  setCharWidthAndBounds(xWidth, yWidth, llx, lly, urx, ury) {
    this.ctx.rect(llx, lly, urx - llx, ury - lly);
    this.ctx.clip();
    this.endPath();
  }
  getColorN_Pattern(IR) {
    let pattern;
    if (IR[0] === "TilingPattern") {
      const color = IR[1];
      const baseTransform = this.baseTransform || (0, _display_utils.getCurrentTransform)(this.ctx);
      const canvasGraphicsFactory = {
        createCanvasGraphics: ctx => {
          return new CanvasGraphics(ctx, this.commonObjs, this.objs, this.canvasFactory, this.filterFactory, {
            optionalContentConfig: this.optionalContentConfig,
            markedContentStack: this.markedContentStack
          });
        }
      };
      pattern = new _pattern_helper.TilingPattern(IR, color, this.ctx, canvasGraphicsFactory, baseTransform);
    } else {
      pattern = this._getPattern(IR[1], IR[2]);
    }
    return pattern;
  }
  setStrokeColorN() {
    this.current.strokeColor = this.getColorN_Pattern(arguments);
  }
  setFillColorN() {
    this.current.fillColor = this.getColorN_Pattern(arguments);
    this.current.patternFill = true;
  }
  setStrokeRGBColor(r, g, b) {
    const color = _util.Util.makeHexColor(r, g, b);
    this.ctx.strokeStyle = color;
    this.current.strokeColor = color;
  }
  setFillRGBColor(r, g, b) {
    const color = _util.Util.makeHexColor(r, g, b);
    this.ctx.fillStyle = color;
    this.current.fillColor = color;
    this.current.patternFill = false;
  }
  _getPattern(objId, matrix = null) {
    let pattern;
    if (this.cachedPatterns.has(objId)) {
      pattern = this.cachedPatterns.get(objId);
    } else {
      pattern = (0, _pattern_helper.getShadingPattern)(this.getObject(objId));
      this.cachedPatterns.set(objId, pattern);
    }
    if (matrix) {
      pattern.matrix = matrix;
    }
    return pattern;
  }
  shadingFill(objId) {
    if (!this.contentVisible) {
      return;
    }
    const ctx = this.ctx;
    this.save();
    const pattern = this._getPattern(objId);
    ctx.fillStyle = pattern.getPattern(ctx, this, (0, _display_utils.getCurrentTransformInverse)(ctx), _pattern_helper.PathType.SHADING);
    const inv = (0, _display_utils.getCurrentTransformInverse)(ctx);
    if (inv) {
      const {
        width,
        height
      } = ctx.canvas;
      const [x0, y0, x1, y1] = _util.Util.getAxialAlignedBoundingBox([0, 0, width, height], inv);
      this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    } else {
      this.ctx.fillRect(-1e10, -1e10, 2e10, 2e10);
    }
    this.compose(this.current.getClippedPathBoundingBox());
    this.restore();
  }
  beginInlineImage() {
    (0, _util.unreachable)("Should not call beginInlineImage");
  }
  beginImageData() {
    (0, _util.unreachable)("Should not call beginImageData");
  }
  paintFormXObjectBegin(matrix, bbox) {
    if (!this.contentVisible) {
      return;
    }
    this.save();
    this.baseTransformStack.push(this.baseTransform);
    if (Array.isArray(matrix) && matrix.length === 6) {
      this.transform(...matrix);
    }
    this.baseTransform = (0, _display_utils.getCurrentTransform)(this.ctx);
    if (bbox) {
      const width = bbox[2] - bbox[0];
      const height = bbox[3] - bbox[1];
      this.ctx.rect(bbox[0], bbox[1], width, height);
      this.current.updateRectMinMax((0, _display_utils.getCurrentTransform)(this.ctx), bbox);
      this.clip();
      this.endPath();
    }
  }
  paintFormXObjectEnd() {
    if (!this.contentVisible) {
      return;
    }
    this.restore();
    this.baseTransform = this.baseTransformStack.pop();
  }
  beginGroup(group) {
    if (!this.contentVisible) {
      return;
    }
    this.save();
    if (this.inSMaskMode) {
      this.endSMaskMode();
      this.current.activeSMask = null;
    }
    const currentCtx = this.ctx;
    if (!group.isolated) {
      (0, _util.info)("TODO: Support non-isolated groups.");
    }
    if (group.knockout) {
      (0, _util.warn)("Knockout groups not supported.");
    }
    const currentTransform = (0, _display_utils.getCurrentTransform)(currentCtx);
    if (group.matrix) {
      currentCtx.transform(...group.matrix);
    }
    if (!group.bbox) {
      throw new Error("Bounding box is required.");
    }
    let bounds = _util.Util.getAxialAlignedBoundingBox(group.bbox, (0, _display_utils.getCurrentTransform)(currentCtx));
    const canvasBounds = [0, 0, currentCtx.canvas.width, currentCtx.canvas.height];
    bounds = _util.Util.intersect(bounds, canvasBounds) || [0, 0, 0, 0];
    const offsetX = Math.floor(bounds[0]);
    const offsetY = Math.floor(bounds[1]);
    let drawnWidth = Math.max(Math.ceil(bounds[2]) - offsetX, 1);
    let drawnHeight = Math.max(Math.ceil(bounds[3]) - offsetY, 1);
    let scaleX = 1,
      scaleY = 1;
    if (drawnWidth > MAX_GROUP_SIZE) {
      scaleX = drawnWidth / MAX_GROUP_SIZE;
      drawnWidth = MAX_GROUP_SIZE;
    }
    if (drawnHeight > MAX_GROUP_SIZE) {
      scaleY = drawnHeight / MAX_GROUP_SIZE;
      drawnHeight = MAX_GROUP_SIZE;
    }
    this.current.startNewPathAndClipBox([0, 0, drawnWidth, drawnHeight]);
    let cacheId = "groupAt" + this.groupLevel;
    if (group.smask) {
      cacheId += "_smask_" + this.smaskCounter++ % 2;
    }
    const scratchCanvas = this.cachedCanvases.getCanvas(cacheId, drawnWidth, drawnHeight);
    const groupCtx = scratchCanvas.context;
    groupCtx.scale(1 / scaleX, 1 / scaleY);
    groupCtx.translate(-offsetX, -offsetY);
    groupCtx.transform(...currentTransform);
    if (group.smask) {
      this.smaskStack.push({
        canvas: scratchCanvas.canvas,
        context: groupCtx,
        offsetX,
        offsetY,
        scaleX,
        scaleY,
        subtype: group.smask.subtype,
        backdrop: group.smask.backdrop,
        transferMap: group.smask.transferMap || null,
        startTransformInverse: null
      });
    } else {
      currentCtx.setTransform(1, 0, 0, 1, 0, 0);
      currentCtx.translate(offsetX, offsetY);
      currentCtx.scale(scaleX, scaleY);
      currentCtx.save();
    }
    copyCtxState(currentCtx, groupCtx);
    this.ctx = groupCtx;
    this.setGState([["BM", "source-over"], ["ca", 1], ["CA", 1]]);
    this.groupStack.push(currentCtx);
    this.groupLevel++;
  }
  endGroup(group) {
    if (!this.contentVisible) {
      return;
    }
    this.groupLevel--;
    const groupCtx = this.ctx;
    const ctx = this.groupStack.pop();
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    if (group.smask) {
      this.tempSMask = this.smaskStack.pop();
      this.restore();
    } else {
      this.ctx.restore();
      const currentMtx = (0, _display_utils.getCurrentTransform)(this.ctx);
      this.restore();
      this.ctx.save();
      this.ctx.setTransform(...currentMtx);
      const dirtyBox = _util.Util.getAxialAlignedBoundingBox([0, 0, groupCtx.canvas.width, groupCtx.canvas.height], currentMtx);
      this.ctx.drawImage(groupCtx.canvas, 0, 0);
      this.ctx.restore();
      this.compose(dirtyBox);
    }
  }
  beginAnnotation(id, rect, transform, matrix, hasOwnCanvas) {
    this.#restoreInitialState();
    resetCtxToDefault(this.ctx);
    this.ctx.save();
    this.save();
    if (this.baseTransform) {
      this.ctx.setTransform(...this.baseTransform);
    }
    if (Array.isArray(rect) && rect.length === 4) {
      const width = rect[2] - rect[0];
      const height = rect[3] - rect[1];
      if (hasOwnCanvas && this.annotationCanvasMap) {
        transform = transform.slice();
        transform[4] -= rect[0];
        transform[5] -= rect[1];
        rect = rect.slice();
        rect[0] = rect[1] = 0;
        rect[2] = width;
        rect[3] = height;
        const [scaleX, scaleY] = _util.Util.singularValueDecompose2dScale((0, _display_utils.getCurrentTransform)(this.ctx));
        const {
          viewportScale
        } = this;
        const canvasWidth = Math.ceil(width * this.outputScaleX * viewportScale);
        const canvasHeight = Math.ceil(height * this.outputScaleY * viewportScale);
        this.annotationCanvas = this.canvasFactory.create(canvasWidth, canvasHeight);
        const {
          canvas,
          context
        } = this.annotationCanvas;
        this.annotationCanvasMap.set(id, canvas);
        this.annotationCanvas.savedCtx = this.ctx;
        this.ctx = context;
        this.ctx.save();
        this.ctx.setTransform(scaleX, 0, 0, -scaleY, 0, height * scaleY);
        resetCtxToDefault(this.ctx);
      } else {
        resetCtxToDefault(this.ctx);
        this.ctx.rect(rect[0], rect[1], width, height);
        this.ctx.clip();
        this.endPath();
      }
    }
    this.current = new CanvasExtraState(this.ctx.canvas.width, this.ctx.canvas.height);
    this.transform(...transform);
    this.transform(...matrix);
  }
  endAnnotation() {
    if (this.annotationCanvas) {
      this.ctx.restore();
      this.#drawFilter();
      this.ctx = this.annotationCanvas.savedCtx;
      delete this.annotationCanvas.savedCtx;
      delete this.annotationCanvas;
    }
  }
  paintImageMaskXObject(img) {
    if (!this.contentVisible) {
      return;
    }
    const count = img.count;
    img = this.getObject(img.data, img);
    img.count = count;
    const ctx = this.ctx;
    const glyph = this.processingType3;
    if (glyph) {
      if (glyph.compiled === undefined) {
        glyph.compiled = compileType3Glyph(img);
      }
      if (glyph.compiled) {
        glyph.compiled(ctx);
        return;
      }
    }
    const mask = this._createMaskCanvas(img);
    const maskCanvas = mask.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(maskCanvas, mask.offsetX, mask.offsetY);
    ctx.restore();
    this.compose();
  }
  paintImageMaskXObjectRepeat(img, scaleX, skewX = 0, skewY = 0, scaleY, positions) {
    if (!this.contentVisible) {
      return;
    }
    img = this.getObject(img.data, img);
    const ctx = this.ctx;
    ctx.save();
    const currentTransform = (0, _display_utils.getCurrentTransform)(ctx);
    ctx.transform(scaleX, skewX, skewY, scaleY, 0, 0);
    const mask = this._createMaskCanvas(img);
    ctx.setTransform(1, 0, 0, 1, mask.offsetX - currentTransform[4], mask.offsetY - currentTransform[5]);
    for (let i = 0, ii = positions.length; i < ii; i += 2) {
      const trans = _util.Util.transform(currentTransform, [scaleX, skewX, skewY, scaleY, positions[i], positions[i + 1]]);
      const [x, y] = _util.Util.applyTransform([0, 0], trans);
      ctx.drawImage(mask.canvas, x, y);
    }
    ctx.restore();
    this.compose();
  }
  paintImageMaskXObjectGroup(images) {
    if (!this.contentVisible) {
      return;
    }
    const ctx = this.ctx;
    const fillColor = this.current.fillColor;
    const isPatternFill = this.current.patternFill;
    for (const image of images) {
      const {
        data,
        width,
        height,
        transform
      } = image;
      const maskCanvas = this.cachedCanvases.getCanvas("maskCanvas", width, height);
      const maskCtx = maskCanvas.context;
      maskCtx.save();
      const img = this.getObject(data, image);
      putBinaryImageMask(maskCtx, img);
      maskCtx.globalCompositeOperation = "source-in";
      maskCtx.fillStyle = isPatternFill ? fillColor.getPattern(maskCtx, this, (0, _display_utils.getCurrentTransformInverse)(ctx), _pattern_helper.PathType.FILL) : fillColor;
      maskCtx.fillRect(0, 0, width, height);
      maskCtx.restore();
      ctx.save();
      ctx.transform(...transform);
      ctx.scale(1, -1);
      drawImageAtIntegerCoords(ctx, maskCanvas.canvas, 0, 0, width, height, 0, -1, 1, 1);
      ctx.restore();
    }
    this.compose();
  }
  paintImageXObject(objId) {
    if (!this.contentVisible) {
      return;
    }
    const imgData = this.getObject(objId);
    if (!imgData) {
      (0, _util.warn)("Dependent image isn't ready yet");
      return;
    }
    this.paintInlineImageXObject(imgData);
  }
  paintImageXObjectRepeat(objId, scaleX, scaleY, positions) {
    if (!this.contentVisible) {
      return;
    }
    const imgData = this.getObject(objId);
    if (!imgData) {
      (0, _util.warn)("Dependent image isn't ready yet");
      return;
    }
    const width = imgData.width;
    const height = imgData.height;
    const map = [];
    for (let i = 0, ii = positions.length; i < ii; i += 2) {
      map.push({
        transform: [scaleX, 0, 0, scaleY, positions[i], positions[i + 1]],
        x: 0,
        y: 0,
        w: width,
        h: height
      });
    }
    this.paintInlineImageXObjectGroup(imgData, map);
  }
  applyTransferMapsToCanvas(ctx) {
    if (this.current.transferMaps !== "none") {
      ctx.filter = this.current.transferMaps;
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.filter = "none";
    }
    return ctx.canvas;
  }
  applyTransferMapsToBitmap(imgData) {
    if (this.current.transferMaps === "none") {
      return imgData.bitmap;
    }
    const {
      bitmap,
      width,
      height
    } = imgData;
    const tmpCanvas = this.cachedCanvases.getCanvas("inlineImage", width, height);
    const tmpCtx = tmpCanvas.context;
    tmpCtx.filter = this.current.transferMaps;
    tmpCtx.drawImage(bitmap, 0, 0);
    tmpCtx.filter = "none";
    return tmpCanvas.canvas;
  }
  paintInlineImageXObject(imgData) {
    if (!this.contentVisible) {
      return;
    }
    const width = imgData.width;
    const height = imgData.height;
    const ctx = this.ctx;
    this.save();
    if (!_util.isNodeJS) {
      const {
        filter
      } = ctx;
      if (filter !== "none" && filter !== "") {
        ctx.filter = "none";
      }
    }
    ctx.scale(1 / width, -1 / height);
    let imgToPaint;
    if (imgData.bitmap) {
      imgToPaint = this.applyTransferMapsToBitmap(imgData);
    } else if (typeof HTMLElement === "function" && imgData instanceof HTMLElement || !imgData.data) {
      imgToPaint = imgData;
    } else {
      const tmpCanvas = this.cachedCanvases.getCanvas("inlineImage", width, height);
      const tmpCtx = tmpCanvas.context;
      putBinaryImageData(tmpCtx, imgData);
      imgToPaint = this.applyTransferMapsToCanvas(tmpCtx);
    }
    const scaled = this._scaleImage(imgToPaint, (0, _display_utils.getCurrentTransformInverse)(ctx));
    ctx.imageSmoothingEnabled = getImageSmoothingEnabled((0, _display_utils.getCurrentTransform)(ctx), imgData.interpolate);
    drawImageAtIntegerCoords(ctx, scaled.img, 0, 0, scaled.paintWidth, scaled.paintHeight, 0, -height, width, height);
    this.compose();
    this.restore();
  }
  paintInlineImageXObjectGroup(imgData, map) {
    if (!this.contentVisible) {
      return;
    }
    const ctx = this.ctx;
    let imgToPaint;
    if (imgData.bitmap) {
      imgToPaint = imgData.bitmap;
    } else {
      const w = imgData.width;
      const h = imgData.height;
      const tmpCanvas = this.cachedCanvases.getCanvas("inlineImage", w, h);
      const tmpCtx = tmpCanvas.context;
      putBinaryImageData(tmpCtx, imgData);
      imgToPaint = this.applyTransferMapsToCanvas(tmpCtx);
    }
    for (const entry of map) {
      ctx.save();
      ctx.transform(...entry.transform);
      ctx.scale(1, -1);
      drawImageAtIntegerCoords(ctx, imgToPaint, entry.x, entry.y, entry.w, entry.h, 0, -1, 1, 1);
      ctx.restore();
    }
    this.compose();
  }
  paintSolidColorImageMask() {
    if (!this.contentVisible) {
      return;
    }
    this.ctx.fillRect(0, 0, 1, 1);
    this.compose();
  }
  markPoint(tag) {}
  markPointProps(tag, properties) {}
  beginMarkedContent(tag) {
    this.markedContentStack.push({
      visible: true
    });
  }
  beginMarkedContentProps(tag, properties) {
    if (tag === "OC") {
      this.markedContentStack.push({
        visible: this.optionalContentConfig.isVisible(properties)
      });
    } else {
      this.markedContentStack.push({
        visible: true
      });
    }
    this.contentVisible = this.isContentVisible();
  }
  endMarkedContent() {
    this.markedContentStack.pop();
    this.contentVisible = this.isContentVisible();
  }
  beginCompat() {}
  endCompat() {}
  consumePath(clipBox) {
    const isEmpty = this.current.isEmptyClip();
    if (this.pendingClip) {
      this.current.updateClipFromPath();
    }
    if (!this.pendingClip) {
      this.compose(clipBox);
    }
    const ctx = this.ctx;
    if (this.pendingClip) {
      if (!isEmpty) {
        if (this.pendingClip === EO_CLIP) {
          ctx.clip("evenodd");
        } else {
          ctx.clip();
        }
      }
      this.pendingClip = null;
    }
    this.current.startNewPathAndClipBox(this.current.clipBox);
    ctx.beginPath();
  }
  getSinglePixelWidth() {
    if (!this._cachedGetSinglePixelWidth) {
      const m = (0, _display_utils.getCurrentTransform)(this.ctx);
      if (m[1] === 0 && m[2] === 0) {
        this._cachedGetSinglePixelWidth = 1 / Math.min(Math.abs(m[0]), Math.abs(m[3]));
      } else {
        const absDet = Math.abs(m[0] * m[3] - m[2] * m[1]);
        const normX = Math.hypot(m[0], m[2]);
        const normY = Math.hypot(m[1], m[3]);
        this._cachedGetSinglePixelWidth = Math.max(normX, normY) / absDet;
      }
    }
    return this._cachedGetSinglePixelWidth;
  }
  getScaleForStroking() {
    if (this._cachedScaleForStroking[0] === -1) {
      const {
        lineWidth
      } = this.current;
      const {
        a,
        b,
        c,
        d
      } = this.ctx.getTransform();
      let scaleX, scaleY;
      if (b === 0 && c === 0) {
        const normX = Math.abs(a);
        const normY = Math.abs(d);
        if (normX === normY) {
          if (lineWidth === 0) {
            scaleX = scaleY = 1 / normX;
          } else {
            const scaledLineWidth = normX * lineWidth;
            scaleX = scaleY = scaledLineWidth < 1 ? 1 / scaledLineWidth : 1;
          }
        } else if (lineWidth === 0) {
          scaleX = 1 / normX;
          scaleY = 1 / normY;
        } else {
          const scaledXLineWidth = normX * lineWidth;
          const scaledYLineWidth = normY * lineWidth;
          scaleX = scaledXLineWidth < 1 ? 1 / scaledXLineWidth : 1;
          scaleY = scaledYLineWidth < 1 ? 1 / scaledYLineWidth : 1;
        }
      } else {
        const absDet = Math.abs(a * d - b * c);
        const normX = Math.hypot(a, b);
        const normY = Math.hypot(c, d);
        if (lineWidth === 0) {
          scaleX = normY / absDet;
          scaleY = normX / absDet;
        } else {
          const baseArea = lineWidth * absDet;
          scaleX = normY > baseArea ? normY / baseArea : 1;
          scaleY = normX > baseArea ? normX / baseArea : 1;
        }
      }
      this._cachedScaleForStroking[0] = scaleX;
      this._cachedScaleForStroking[1] = scaleY;
    }
    return this._cachedScaleForStroking;
  }
  rescaleAndStroke(saveRestore) {
    const {
      ctx
    } = this;
    const {
      lineWidth
    } = this.current;
    const [scaleX, scaleY] = this.getScaleForStroking();
    ctx.lineWidth = lineWidth || 1;
    if (scaleX === 1 && scaleY === 1) {
      ctx.stroke();
      return;
    }
    const dashes = ctx.getLineDash();
    if (saveRestore) {
      ctx.save();
    }
    ctx.scale(scaleX, scaleY);
    if (dashes.length > 0) {
      const scale = Math.max(scaleX, scaleY);
      ctx.setLineDash(dashes.map(x => x / scale));
      ctx.lineDashOffset /= scale;
    }
    ctx.stroke();
    if (saveRestore) {
      ctx.restore();
    }
  }
  isContentVisible() {
    for (let i = this.markedContentStack.length - 1; i >= 0; i--) {
      if (!this.markedContentStack[i].visible) {
        return false;
      }
    }
    return true;
  }
}
exports.CanvasGraphics = CanvasGraphics;
for (const op in _util.OPS) {
  if (CanvasGraphics.prototype[op] !== undefined) {
    CanvasGraphics.prototype[_util.OPS[op]] = CanvasGraphics.prototype[op];
  }
}

/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.TilingPattern = exports.PathType = void 0;
exports.getShadingPattern = getShadingPattern;
var _util = __w_pdfjs_require__(1);
var _display_utils = __w_pdfjs_require__(6);
const PathType = {
  FILL: "Fill",
  STROKE: "Stroke",
  SHADING: "Shading"
};
exports.PathType = PathType;
function applyBoundingBox(ctx, bbox) {
  if (!bbox) {
    return;
  }
  const width = bbox[2] - bbox[0];
  const height = bbox[3] - bbox[1];
  const region = new Path2D();
  region.rect(bbox[0], bbox[1], width, height);
  ctx.clip(region);
}
class BaseShadingPattern {
  constructor() {
    if (this.constructor === BaseShadingPattern) {
      (0, _util.unreachable)("Cannot initialize BaseShadingPattern.");
    }
  }
  getPattern() {
    (0, _util.unreachable)("Abstract method `getPattern` called.");
  }
}
class RadialAxialShadingPattern extends BaseShadingPattern {
  constructor(IR) {
    super();
    this._type = IR[1];
    this._bbox = IR[2];
    this._colorStops = IR[3];
    this._p0 = IR[4];
    this._p1 = IR[5];
    this._r0 = IR[6];
    this._r1 = IR[7];
    this.matrix = null;
  }
  _createGradient(ctx) {
    let grad;
    if (this._type === "axial") {
      grad = ctx.createLinearGradient(this._p0[0], this._p0[1], this._p1[0], this._p1[1]);
    } else if (this._type === "radial") {
      grad = ctx.createRadialGradient(this._p0[0], this._p0[1], this._r0, this._p1[0], this._p1[1], this._r1);
    }
    for (const colorStop of this._colorStops) {
      grad.addColorStop(colorStop[0], colorStop[1]);
    }
    return grad;
  }
  getPattern(ctx, owner, inverse, pathType) {
    let pattern;
    if (pathType === PathType.STROKE || pathType === PathType.FILL) {
      const ownerBBox = owner.current.getClippedPathBoundingBox(pathType, (0, _display_utils.getCurrentTransform)(ctx)) || [0, 0, 0, 0];
      const width = Math.ceil(ownerBBox[2] - ownerBBox[0]) || 1;
      const height = Math.ceil(ownerBBox[3] - ownerBBox[1]) || 1;
      const tmpCanvas = owner.cachedCanvases.getCanvas("pattern", width, height, true);
      const tmpCtx = tmpCanvas.context;
      tmpCtx.clearRect(0, 0, tmpCtx.canvas.width, tmpCtx.canvas.height);
      tmpCtx.beginPath();
      tmpCtx.rect(0, 0, tmpCtx.canvas.width, tmpCtx.canvas.height);
      tmpCtx.translate(-ownerBBox[0], -ownerBBox[1]);
      inverse = _util.Util.transform(inverse, [1, 0, 0, 1, ownerBBox[0], ownerBBox[1]]);
      tmpCtx.transform(...owner.baseTransform);
      if (this.matrix) {
        tmpCtx.transform(...this.matrix);
      }
      applyBoundingBox(tmpCtx, this._bbox);
      tmpCtx.fillStyle = this._createGradient(tmpCtx);
      tmpCtx.fill();
      pattern = ctx.createPattern(tmpCanvas.canvas, "no-repeat");
      const domMatrix = new DOMMatrix(inverse);
      pattern.setTransform(domMatrix);
    } else {
      applyBoundingBox(ctx, this._bbox);
      pattern = this._createGradient(ctx);
    }
    return pattern;
  }
}
function drawTriangle(data, context, p1, p2, p3, c1, c2, c3) {
  const coords = context.coords,
    colors = context.colors;
  const bytes = data.data,
    rowSize = data.width * 4;
  let tmp;
  if (coords[p1 + 1] > coords[p2 + 1]) {
    tmp = p1;
    p1 = p2;
    p2 = tmp;
    tmp = c1;
    c1 = c2;
    c2 = tmp;
  }
  if (coords[p2 + 1] > coords[p3 + 1]) {
    tmp = p2;
    p2 = p3;
    p3 = tmp;
    tmp = c2;
    c2 = c3;
    c3 = tmp;
  }
  if (coords[p1 + 1] > coords[p2 + 1]) {
    tmp = p1;
    p1 = p2;
    p2 = tmp;
    tmp = c1;
    c1 = c2;
    c2 = tmp;
  }
  const x1 = (coords[p1] + context.offsetX) * context.scaleX;
  const y1 = (coords[p1 + 1] + context.offsetY) * context.scaleY;
  const x2 = (coords[p2] + context.offsetX) * context.scaleX;
  const y2 = (coords[p2 + 1] + context.offsetY) * context.scaleY;
  const x3 = (coords[p3] + context.offsetX) * context.scaleX;
  const y3 = (coords[p3 + 1] + context.offsetY) * context.scaleY;
  if (y1 >= y3) {
    return;
  }
  const c1r = colors[c1],
    c1g = colors[c1 + 1],
    c1b = colors[c1 + 2];
  const c2r = colors[c2],
    c2g = colors[c2 + 1],
    c2b = colors[c2 + 2];
  const c3r = colors[c3],
    c3g = colors[c3 + 1],
    c3b = colors[c3 + 2];
  const minY = Math.round(y1),
    maxY = Math.round(y3);
  let xa, car, cag, cab;
  let xb, cbr, cbg, cbb;
  for (let y = minY; y <= maxY; y++) {
    if (y < y2) {
      const k = y < y1 ? 0 : (y1 - y) / (y1 - y2);
      xa = x1 - (x1 - x2) * k;
      car = c1r - (c1r - c2r) * k;
      cag = c1g - (c1g - c2g) * k;
      cab = c1b - (c1b - c2b) * k;
    } else {
      let k;
      if (y > y3) {
        k = 1;
      } else if (y2 === y3) {
        k = 0;
      } else {
        k = (y2 - y) / (y2 - y3);
      }
      xa = x2 - (x2 - x3) * k;
      car = c2r - (c2r - c3r) * k;
      cag = c2g - (c2g - c3g) * k;
      cab = c2b - (c2b - c3b) * k;
    }
    let k;
    if (y < y1) {
      k = 0;
    } else if (y > y3) {
      k = 1;
    } else {
      k = (y1 - y) / (y1 - y3);
    }
    xb = x1 - (x1 - x3) * k;
    cbr = c1r - (c1r - c3r) * k;
    cbg = c1g - (c1g - c3g) * k;
    cbb = c1b - (c1b - c3b) * k;
    const x1_ = Math.round(Math.min(xa, xb));
    const x2_ = Math.round(Math.max(xa, xb));
    let j = rowSize * y + x1_ * 4;
    for (let x = x1_; x <= x2_; x++) {
      k = (xa - x) / (xa - xb);
      if (k < 0) {
        k = 0;
      } else if (k > 1) {
        k = 1;
      }
      bytes[j++] = car - (car - cbr) * k | 0;
      bytes[j++] = cag - (cag - cbg) * k | 0;
      bytes[j++] = cab - (cab - cbb) * k | 0;
      bytes[j++] = 255;
    }
  }
}
function drawFigure(data, figure, context) {
  const ps = figure.coords;
  const cs = figure.colors;
  let i, ii;
  switch (figure.type) {
    case "lattice":
      const verticesPerRow = figure.verticesPerRow;
      const rows = Math.floor(ps.length / verticesPerRow) - 1;
      const cols = verticesPerRow - 1;
      for (i = 0; i < rows; i++) {
        let q = i * verticesPerRow;
        for (let j = 0; j < cols; j++, q++) {
          drawTriangle(data, context, ps[q], ps[q + 1], ps[q + verticesPerRow], cs[q], cs[q + 1], cs[q + verticesPerRow]);
          drawTriangle(data, context, ps[q + verticesPerRow + 1], ps[q + 1], ps[q + verticesPerRow], cs[q + verticesPerRow + 1], cs[q + 1], cs[q + verticesPerRow]);
        }
      }
      break;
    case "triangles":
      for (i = 0, ii = ps.length; i < ii; i += 3) {
        drawTriangle(data, context, ps[i], ps[i + 1], ps[i + 2], cs[i], cs[i + 1], cs[i + 2]);
      }
      break;
    default:
      throw new Error("illegal figure");
  }
}
class MeshShadingPattern extends BaseShadingPattern {
  constructor(IR) {
    super();
    this._coords = IR[2];
    this._colors = IR[3];
    this._figures = IR[4];
    this._bounds = IR[5];
    this._bbox = IR[7];
    this._background = IR[8];
    this.matrix = null;
  }
  _createMeshCanvas(combinedScale, backgroundColor, cachedCanvases) {
    const EXPECTED_SCALE = 1.1;
    const MAX_PATTERN_SIZE = 3000;
    const BORDER_SIZE = 2;
    const offsetX = Math.floor(this._bounds[0]);
    const offsetY = Math.floor(this._bounds[1]);
    const boundsWidth = Math.ceil(this._bounds[2]) - offsetX;
    const boundsHeight = Math.ceil(this._bounds[3]) - offsetY;
    const width = Math.min(Math.ceil(Math.abs(boundsWidth * combinedScale[0] * EXPECTED_SCALE)), MAX_PATTERN_SIZE);
    const height = Math.min(Math.ceil(Math.abs(boundsHeight * combinedScale[1] * EXPECTED_SCALE)), MAX_PATTERN_SIZE);
    const scaleX = boundsWidth / width;
    const scaleY = boundsHeight / height;
    const context = {
      coords: this._coords,
      colors: this._colors,
      offsetX: -offsetX,
      offsetY: -offsetY,
      scaleX: 1 / scaleX,
      scaleY: 1 / scaleY
    };
    const paddedWidth = width + BORDER_SIZE * 2;
    const paddedHeight = height + BORDER_SIZE * 2;
    const tmpCanvas = cachedCanvases.getCanvas("mesh", paddedWidth, paddedHeight, false);
    const tmpCtx = tmpCanvas.context;
    const data = tmpCtx.createImageData(width, height);
    if (backgroundColor) {
      const bytes = data.data;
      for (let i = 0, ii = bytes.length; i < ii; i += 4) {
        bytes[i] = backgroundColor[0];
        bytes[i + 1] = backgroundColor[1];
        bytes[i + 2] = backgroundColor[2];
        bytes[i + 3] = 255;
      }
    }
    for (const figure of this._figures) {
      drawFigure(data, figure, context);
    }
    tmpCtx.putImageData(data, BORDER_SIZE, BORDER_SIZE);
    const canvas = tmpCanvas.canvas;
    return {
      canvas,
      offsetX: offsetX - BORDER_SIZE * scaleX,
      offsetY: offsetY - BORDER_SIZE * scaleY,
      scaleX,
      scaleY
    };
  }
  getPattern(ctx, owner, inverse, pathType) {
    applyBoundingBox(ctx, this._bbox);
    let scale;
    if (pathType === PathType.SHADING) {
      scale = _util.Util.singularValueDecompose2dScale((0, _display_utils.getCurrentTransform)(ctx));
    } else {
      scale = _util.Util.singularValueDecompose2dScale(owner.baseTransform);
      if (this.matrix) {
        const matrixScale = _util.Util.singularValueDecompose2dScale(this.matrix);
        scale = [scale[0] * matrixScale[0], scale[1] * matrixScale[1]];
      }
    }
    const temporaryPatternCanvas = this._createMeshCanvas(scale, pathType === PathType.SHADING ? null : this._background, owner.cachedCanvases);
    if (pathType !== PathType.SHADING) {
      ctx.setTransform(...owner.baseTransform);
      if (this.matrix) {
        ctx.transform(...this.matrix);
      }
    }
    ctx.translate(temporaryPatternCanvas.offsetX, temporaryPatternCanvas.offsetY);
    ctx.scale(temporaryPatternCanvas.scaleX, temporaryPatternCanvas.scaleY);
    return ctx.createPattern(temporaryPatternCanvas.canvas, "no-repeat");
  }
}
class DummyShadingPattern extends BaseShadingPattern {
  getPattern() {
    return "hotpink";
  }
}
function getShadingPattern(IR) {
  switch (IR[0]) {
    case "RadialAxial":
      return new RadialAxialShadingPattern(IR);
    case "Mesh":
      return new MeshShadingPattern(IR);
    case "Dummy":
      return new DummyShadingPattern();
  }
  throw new Error(`Unknown IR type: ${IR[0]}`);
}
const PaintType = {
  COLORED: 1,
  UNCOLORED: 2
};
class TilingPattern {
  static MAX_PATTERN_SIZE = 3000;
  constructor(IR, color, ctx, canvasGraphicsFactory, baseTransform) {
    this.operatorList = IR[2];
    this.matrix = IR[3] || [1, 0, 0, 1, 0, 0];
    this.bbox = IR[4];
    this.xstep = IR[5];
    this.ystep = IR[6];
    this.paintType = IR[7];
    this.tilingType = IR[8];
    this.color = color;
    this.ctx = ctx;
    this.canvasGraphicsFactory = canvasGraphicsFactory;
    this.baseTransform = baseTransform;
  }
  createPatternCanvas(owner) {
    const operatorList = this.operatorList;
    const bbox = this.bbox;
    const xstep = this.xstep;
    const ystep = this.ystep;
    const paintType = this.paintType;
    const tilingType = this.tilingType;
    const color = this.color;
    const canvasGraphicsFactory = this.canvasGraphicsFactory;
    (0, _util.info)("TilingType: " + tilingType);
    const x0 = bbox[0],
      y0 = bbox[1],
      x1 = bbox[2],
      y1 = bbox[3];
    const matrixScale = _util.Util.singularValueDecompose2dScale(this.matrix);
    const curMatrixScale = _util.Util.singularValueDecompose2dScale(this.baseTransform);
    const combinedScale = [matrixScale[0] * curMatrixScale[0], matrixScale[1] * curMatrixScale[1]];
    const dimx = this.getSizeAndScale(xstep, this.ctx.canvas.width, combinedScale[0]);
    const dimy = this.getSizeAndScale(ystep, this.ctx.canvas.height, combinedScale[1]);
    const tmpCanvas = owner.cachedCanvases.getCanvas("pattern", dimx.size, dimy.size, true);
    const tmpCtx = tmpCanvas.context;
    const graphics = canvasGraphicsFactory.createCanvasGraphics(tmpCtx);
    graphics.groupLevel = owner.groupLevel;
    this.setFillAndStrokeStyleToContext(graphics, paintType, color);
    let adjustedX0 = x0;
    let adjustedY0 = y0;
    let adjustedX1 = x1;
    let adjustedY1 = y1;
    if (x0 < 0) {
      adjustedX0 = 0;
      adjustedX1 += Math.abs(x0);
    }
    if (y0 < 0) {
      adjustedY0 = 0;
      adjustedY1 += Math.abs(y0);
    }
    tmpCtx.translate(-(dimx.scale * adjustedX0), -(dimy.scale * adjustedY0));
    graphics.transform(dimx.scale, 0, 0, dimy.scale, 0, 0);
    tmpCtx.save();
    this.clipBbox(graphics, adjustedX0, adjustedY0, adjustedX1, adjustedY1);
    graphics.baseTransform = (0, _display_utils.getCurrentTransform)(graphics.ctx);
    graphics.executeOperatorList(operatorList);
    graphics.endDrawing();
    return {
      canvas: tmpCanvas.canvas,
      scaleX: dimx.scale,
      scaleY: dimy.scale,
      offsetX: adjustedX0,
      offsetY: adjustedY0
    };
  }
  getSizeAndScale(step, realOutputSize, scale) {
    step = Math.abs(step);
    const maxSize = Math.max(TilingPattern.MAX_PATTERN_SIZE, realOutputSize);
    let size = Math.ceil(step * scale);
    if (size >= maxSize) {
      size = maxSize;
    } else {
      scale = size / step;
    }
    return {
      scale,
      size
    };
  }
  clipBbox(graphics, x0, y0, x1, y1) {
    const bboxWidth = x1 - x0;
    const bboxHeight = y1 - y0;
    graphics.ctx.rect(x0, y0, bboxWidth, bboxHeight);
    graphics.current.updateRectMinMax((0, _display_utils.getCurrentTransform)(graphics.ctx), [x0, y0, x1, y1]);
    graphics.clip();
    graphics.endPath();
  }
  setFillAndStrokeStyleToContext(graphics, paintType, color) {
    const context = graphics.ctx,
      current = graphics.current;
    switch (paintType) {
      case PaintType.COLORED:
        const ctx = this.ctx;
        context.fillStyle = ctx.fillStyle;
        context.strokeStyle = ctx.strokeStyle;
        current.fillColor = ctx.fillStyle;
        current.strokeColor = ctx.strokeStyle;
        break;
      case PaintType.UNCOLORED:
        const cssColor = _util.Util.makeHexColor(color[0], color[1], color[2]);
        context.fillStyle = cssColor;
        context.strokeStyle = cssColor;
        current.fillColor = cssColor;
        current.strokeColor = cssColor;
        break;
      default:
        throw new _util.FormatError(`Unsupported paint type: ${paintType}`);
    }
  }
  getPattern(ctx, owner, inverse, pathType) {
    let matrix = inverse;
    if (pathType !== PathType.SHADING) {
      matrix = _util.Util.transform(matrix, owner.baseTransform);
      if (this.matrix) {
        matrix = _util.Util.transform(matrix, this.matrix);
      }
    }
    const temporaryPatternCanvas = this.createPatternCanvas(owner);
    let domMatrix = new DOMMatrix(matrix);
    domMatrix = domMatrix.translate(temporaryPatternCanvas.offsetX, temporaryPatternCanvas.offsetY);
    domMatrix = domMatrix.scale(1 / temporaryPatternCanvas.scaleX, 1 / temporaryPatternCanvas.scaleY);
    const pattern = ctx.createPattern(temporaryPatternCanvas.canvas, "repeat");
    pattern.setTransform(domMatrix);
    return pattern;
  }
}
exports.TilingPattern = TilingPattern;

/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.convertBlackAndWhiteToRGBA = convertBlackAndWhiteToRGBA;
exports.convertToRGBA = convertToRGBA;
exports.grayToRGBA = grayToRGBA;
var _util = __w_pdfjs_require__(1);
function convertToRGBA(params) {
  switch (params.kind) {
    case _util.ImageKind.GRAYSCALE_1BPP:
      return convertBlackAndWhiteToRGBA(params);
    case _util.ImageKind.RGB_24BPP:
      return convertRGBToRGBA(params);
  }
  return null;
}
function convertBlackAndWhiteToRGBA({
  src,
  srcPos = 0,
  dest,
  width,
  height,
  nonBlackColor = 0xffffffff,
  inverseDecode = false
}) {
  const black = _util.FeatureTest.isLittleEndian ? 0xff000000 : 0x000000ff;
  const [zeroMapping, oneMapping] = inverseDecode ? [nonBlackColor, black] : [black, nonBlackColor];
  const widthInSource = width >> 3;
  const widthRemainder = width & 7;
  const srcLength = src.length;
  dest = new Uint32Array(dest.buffer);
  let destPos = 0;
  for (let i = 0; i < height; i++) {
    for (const max = srcPos + widthInSource; srcPos < max; srcPos++) {
      const elem = srcPos < srcLength ? src[srcPos] : 255;
      dest[destPos++] = elem & 0b10000000 ? oneMapping : zeroMapping;
      dest[destPos++] = elem & 0b1000000 ? oneMapping : zeroMapping;
      dest[destPos++] = elem & 0b100000 ? oneMapping : zeroMapping;
      dest[destPos++] = elem & 0b10000 ? oneMapping : zeroMapping;
      dest[destPos++] = elem & 0b1000 ? oneMapping : zeroMapping;
      dest[destPos++] = elem & 0b100 ? oneMapping : zeroMapping;
      dest[destPos++] = elem & 0b10 ? oneMapping : zeroMapping;
      dest[destPos++] = elem & 0b1 ? oneMapping : zeroMapping;
    }
    if (widthRemainder === 0) {
      continue;
    }
    const elem = srcPos < srcLength ? src[srcPos++] : 255;
    for (let j = 0; j < widthRemainder; j++) {
      dest[destPos++] = elem & 1 << 7 - j ? oneMapping : zeroMapping;
    }
  }
  return {
    srcPos,
    destPos
  };
}
function convertRGBToRGBA({
  src,
  srcPos = 0,
  dest,
  destPos = 0,
  width,
  height
}) {
  let i = 0;
  const len32 = src.length >> 2;
  const src32 = new Uint32Array(src.buffer, srcPos, len32);
  if (_util.FeatureTest.isLittleEndian) {
    for (; i < len32 - 2; i += 3, destPos += 4) {
      const s1 = src32[i];
      const s2 = src32[i + 1];
      const s3 = src32[i + 2];
      dest[destPos] = s1 | 0xff000000;
      dest[destPos + 1] = s1 >>> 24 | s2 << 8 | 0xff000000;
      dest[destPos + 2] = s2 >>> 16 | s3 << 16 | 0xff000000;
      dest[destPos + 3] = s3 >>> 8 | 0xff000000;
    }
    for (let j = i * 4, jj = src.length; j < jj; j += 3) {
      dest[destPos++] = src[j] | src[j + 1] << 8 | src[j + 2] << 16 | 0xff000000;
    }
  } else {
    for (; i < len32 - 2; i += 3, destPos += 4) {
      const s1 = src32[i];
      const s2 = src32[i + 1];
      const s3 = src32[i + 2];
      dest[destPos] = s1 | 0xff;
      dest[destPos + 1] = s1 << 24 | s2 >>> 8 | 0xff;
      dest[destPos + 2] = s2 << 16 | s3 >>> 16 | 0xff;
      dest[destPos + 3] = s3 << 8 | 0xff;
    }
    for (let j = i * 4, jj = src.length; j < jj; j += 3) {
      dest[destPos++] = src[j] << 24 | src[j + 1] << 16 | src[j + 2] << 8 | 0xff;
    }
  }
  return {
    srcPos,
    destPos
  };
}
function grayToRGBA(src, dest) {
  if (_util.FeatureTest.isLittleEndian) {
    for (let i = 0, ii = src.length; i < ii; i++) {
      dest[i] = src[i] * 0x10101 | 0xff000000;
    }
  } else {
    for (let i = 0, ii = src.length; i < ii; i++) {
      dest[i] = src[i] * 0x1010100 | 0x000000ff;
    }
  }
}

/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, exports) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.GlobalWorkerOptions = void 0;
const GlobalWorkerOptions = Object.create(null);
exports.GlobalWorkerOptions = GlobalWorkerOptions;
GlobalWorkerOptions.workerPort = null;
GlobalWorkerOptions.workerSrc = "";

/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.MessageHandler = void 0;
var _util = __w_pdfjs_require__(1);
const CallbackKind = {
  UNKNOWN: 0,
  DATA: 1,
  ERROR: 2
};
const StreamKind = {
  UNKNOWN: 0,
  CANCEL: 1,
  CANCEL_COMPLETE: 2,
  CLOSE: 3,
  ENQUEUE: 4,
  ERROR: 5,
  PULL: 6,
  PULL_COMPLETE: 7,
  START_COMPLETE: 8
};
function wrapReason(reason) {
  if (!(reason instanceof Error || typeof reason === "object" && reason !== null)) {
    (0, _util.unreachable)('wrapReason: Expected "reason" to be a (possibly cloned) Error.');
  }
  switch (reason.name) {
    case "AbortException":
      return new _util.AbortException(reason.message);
    case "MissingPDFException":
      return new _util.MissingPDFException(reason.message);
    case "PasswordException":
      return new _util.PasswordException(reason.message, reason.code);
    case "UnexpectedResponseException":
      return new _util.UnexpectedResponseException(reason.message, reason.status);
    case "UnknownErrorException":
      return new _util.UnknownErrorException(reason.message, reason.details);
    default:
      return new _util.UnknownErrorException(reason.message, reason.toString());
  }
}
class MessageHandler {
  constructor(sourceName, targetName, comObj) {
    this.sourceName = sourceName;
    this.targetName = targetName;
    this.comObj = comObj;
    this.callbackId = 1;
    this.streamId = 1;
    this.streamSinks = Object.create(null);
    this.streamControllers = Object.create(null);
    this.callbackCapabilities = Object.create(null);
    this.actionHandler = Object.create(null);
    this._onComObjOnMessage = event => {
      const data = event.data;
      if (data.targetName !== this.sourceName) {
        return;
      }
      if (data.stream) {
        this.#processStreamMessage(data);
        return;
      }
      if (data.callback) {
        const callbackId = data.callbackId;
        const capability = this.callbackCapabilities[callbackId];
        if (!capability) {
          throw new Error(`Cannot resolve callback ${callbackId}`);
        }
        delete this.callbackCapabilities[callbackId];
        if (data.callback === CallbackKind.DATA) {
          capability.resolve(data.data);
        } else if (data.callback === CallbackKind.ERROR) {
          capability.reject(wrapReason(data.reason));
        } else {
          throw new Error("Unexpected callback case");
        }
        return;
      }
      const action = this.actionHandler[data.action];
      if (!action) {
        throw new Error(`Unknown action from worker: ${data.action}`);
      }
      if (data.callbackId) {
        const cbSourceName = this.sourceName;
        const cbTargetName = data.sourceName;
        new Promise(function (resolve) {
          resolve(action(data.data));
        }).then(function (result) {
          comObj.postMessage({
            sourceName: cbSourceName,
            targetName: cbTargetName,
            callback: CallbackKind.DATA,
            callbackId: data.callbackId,
            data: result
          });
        }, function (reason) {
          comObj.postMessage({
            sourceName: cbSourceName,
            targetName: cbTargetName,
            callback: CallbackKind.ERROR,
            callbackId: data.callbackId,
            reason: wrapReason(reason)
          });
        });
        return;
      }
      if (data.streamId) {
        this.#createStreamSink(data);
        return;
      }
      action(data.data);
    };
    comObj.addEventListener("message", this._onComObjOnMessage);
  }
  on(actionName, handler) {
    const ah = this.actionHandler;
    if (ah[actionName]) {
      throw new Error(`There is already an actionName called "${actionName}"`);
    }
    ah[actionName] = handler;
  }
  send(actionName, data, transfers) {
    this.comObj.postMessage({
      sourceName: this.sourceName,
      targetName: this.targetName,
      action: actionName,
      data
    }, transfers);
  }
  sendWithPromise(actionName, data, transfers) {
    const callbackId = this.callbackId++;
    const capability = new _util.PromiseCapability();
    this.callbackCapabilities[callbackId] = capability;
    try {
      this.comObj.postMessage({
        sourceName: this.sourceName,
        targetName: this.targetName,
        action: actionName,
        callbackId,
        data
      }, transfers);
    } catch (ex) {
      capability.reject(ex);
    }
    return capability.promise;
  }
  sendWithStream(actionName, data, queueingStrategy, transfers) {
    const streamId = this.streamId++,
      sourceName = this.sourceName,
      targetName = this.targetName,
      comObj = this.comObj;
    return new ReadableStream({
      start: controller => {
        const startCapability = new _util.PromiseCapability();
        this.streamControllers[streamId] = {
          controller,
          startCall: startCapability,
          pullCall: null,
          cancelCall: null,
          isClosed: false
        };
        comObj.postMessage({
          sourceName,
          targetName,
          action: actionName,
          streamId,
          data,
          desiredSize: controller.desiredSize
        }, transfers);
        return startCapability.promise;
      },
      pull: controller => {
        const pullCapability = new _util.PromiseCapability();
        this.streamControllers[streamId].pullCall = pullCapability;
        comObj.postMessage({
          sourceName,
          targetName,
          stream: StreamKind.PULL,
          streamId,
          desiredSize: controller.desiredSize
        });
        return pullCapability.promise;
      },
      cancel: reason => {
        (0, _util.assert)(reason instanceof Error, "cancel must have a valid reason");
        const cancelCapability = new _util.PromiseCapability();
        this.streamControllers[streamId].cancelCall = cancelCapability;
        this.streamControllers[streamId].isClosed = true;
        comObj.postMessage({
          sourceName,
          targetName,
          stream: StreamKind.CANCEL,
          streamId,
          reason: wrapReason(reason)
        });
        return cancelCapability.promise;
      }
    }, queueingStrategy);
  }
  #createStreamSink(data) {
    const streamId = data.streamId,
      sourceName = this.sourceName,
      targetName = data.sourceName,
      comObj = this.comObj;
    const self = this,
      action = this.actionHandler[data.action];
    const streamSink = {
      enqueue(chunk, size = 1, transfers) {
        if (this.isCancelled) {
          return;
        }
        const lastDesiredSize = this.desiredSize;
        this.desiredSize -= size;
        if (lastDesiredSize > 0 && this.desiredSize <= 0) {
          this.sinkCapability = new _util.PromiseCapability();
          this.ready = this.sinkCapability.promise;
        }
        comObj.postMessage({
          sourceName,
          targetName,
          stream: StreamKind.ENQUEUE,
          streamId,
          chunk
        }, transfers);
      },
      close() {
        if (this.isCancelled) {
          return;
        }
        this.isCancelled = true;
        comObj.postMessage({
          sourceName,
          targetName,
          stream: StreamKind.CLOSE,
          streamId
        });
        delete self.streamSinks[streamId];
      },
      error(reason) {
        (0, _util.assert)(reason instanceof Error, "error must have a valid reason");
        if (this.isCancelled) {
          return;
        }
        this.isCancelled = true;
        comObj.postMessage({
          sourceName,
          targetName,
          stream: StreamKind.ERROR,
          streamId,
          reason: wrapReason(reason)
        });
      },
      sinkCapability: new _util.PromiseCapability(),
      onPull: null,
      onCancel: null,
      isCancelled: false,
      desiredSize: data.desiredSize,
      ready: null
    };
    streamSink.sinkCapability.resolve();
    streamSink.ready = streamSink.sinkCapability.promise;
    this.streamSinks[streamId] = streamSink;
    new Promise(function (resolve) {
      resolve(action(data.data, streamSink));
    }).then(function () {
      comObj.postMessage({
        sourceName,
        targetName,
        stream: StreamKind.START_COMPLETE,
        streamId,
        success: true
      });
    }, function (reason) {
      comObj.postMessage({
        sourceName,
        targetName,
        stream: StreamKind.START_COMPLETE,
        streamId,
        reason: wrapReason(reason)
      });
    });
  }
  #processStreamMessage(data) {
    const streamId = data.streamId,
      sourceName = this.sourceName,
      targetName = data.sourceName,
      comObj = this.comObj;
    const streamController = this.streamControllers[streamId],
      streamSink = this.streamSinks[streamId];
    switch (data.stream) {
      case StreamKind.START_COMPLETE:
        if (data.success) {
          streamController.startCall.resolve();
        } else {
          streamController.startCall.reject(wrapReason(data.reason));
        }
        break;
      case StreamKind.PULL_COMPLETE:
        if (data.success) {
          streamController.pullCall.resolve();
        } else {
          streamController.pullCall.reject(wrapReason(data.reason));
        }
        break;
      case StreamKind.PULL:
        if (!streamSink) {
          comObj.postMessage({
            sourceName,
            targetName,
            stream: StreamKind.PULL_COMPLETE,
            streamId,
            success: true
          });
          break;
        }
        if (streamSink.desiredSize <= 0 && data.desiredSize > 0) {
          streamSink.sinkCapability.resolve();
        }
        streamSink.desiredSize = data.desiredSize;
        new Promise(function (resolve) {
          resolve(streamSink.onPull?.());
        }).then(function () {
          comObj.postMessage({
            sourceName,
            targetName,
            stream: StreamKind.PULL_COMPLETE,
            streamId,
            success: true
          });
        }, function (reason) {
          comObj.postMessage({
            sourceName,
            targetName,
            stream: StreamKind.PULL_COMPLETE,
            streamId,
            reason: wrapReason(reason)
          });
        });
        break;
      case StreamKind.ENQUEUE:
        (0, _util.assert)(streamController, "enqueue should have stream controller");
        if (streamController.isClosed) {
          break;
        }
        streamController.controller.enqueue(data.chunk);
        break;
      case StreamKind.CLOSE:
        (0, _util.assert)(streamController, "close should have stream controller");
        if (streamController.isClosed) {
          break;
        }
        streamController.isClosed = true;
        streamController.controller.close();
        this.#deleteStreamController(streamController, streamId);
        break;
      case StreamKind.ERROR:
        (0, _util.assert)(streamController, "error should have stream controller");
        streamController.controller.error(wrapReason(data.reason));
        this.#deleteStreamController(streamController, streamId);
        break;
      case StreamKind.CANCEL_COMPLETE:
        if (data.success) {
          streamController.cancelCall.resolve();
        } else {
          streamController.cancelCall.reject(wrapReason(data.reason));
        }
        this.#deleteStreamController(streamController, streamId);
        break;
      case StreamKind.CANCEL:
        if (!streamSink) {
          break;
        }
        new Promise(function (resolve) {
          resolve(streamSink.onCancel?.(wrapReason(data.reason)));
        }).then(function () {
          comObj.postMessage({
            sourceName,
            targetName,
            stream: StreamKind.CANCEL_COMPLETE,
            streamId,
            success: true
          });
        }, function (reason) {
          comObj.postMessage({
            sourceName,
            targetName,
            stream: StreamKind.CANCEL_COMPLETE,
            streamId,
            reason: wrapReason(reason)
          });
        });
        streamSink.sinkCapability.reject(wrapReason(data.reason));
        streamSink.isCancelled = true;
        delete this.streamSinks[streamId];
        break;
      default:
        throw new Error("Unexpected stream case");
    }
  }
  async #deleteStreamController(streamController, streamId) {
    await Promise.allSettled([streamController.startCall?.promise, streamController.pullCall?.promise, streamController.cancelCall?.promise]);
    delete this.streamControllers[streamId];
  }
  destroy() {
    this.comObj.removeEventListener("message", this._onComObjOnMessage);
  }
}
exports.MessageHandler = MessageHandler;

/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.Metadata = void 0;
var _util = __w_pdfjs_require__(1);
class Metadata {
  #metadataMap;
  #data;
  constructor({
    parsedData,
    rawData
  }) {
    this.#metadataMap = parsedData;
    this.#data = rawData;
  }
  getRaw() {
    return this.#data;
  }
  get(name) {
    return this.#metadataMap.get(name) ?? null;
  }
  getAll() {
    return (0, _util.objectFromMap)(this.#metadataMap);
  }
  has(name) {
    return this.#metadataMap.has(name);
  }
}
exports.Metadata = Metadata;

/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.OptionalContentConfig = void 0;
var _util = __w_pdfjs_require__(1);
var _murmurhash = __w_pdfjs_require__(8);
const INTERNAL = Symbol("INTERNAL");
class OptionalContentGroup {
  #visible = true;
  constructor(name, intent) {
    this.name = name;
    this.intent = intent;
  }
  get visible() {
    return this.#visible;
  }
  _setVisible(internal, visible) {
    if (internal !== INTERNAL) {
      (0, _util.unreachable)("Internal method `_setVisible` called.");
    }
    this.#visible = visible;
  }
}
class OptionalContentConfig {
  #cachedGetHash = null;
  #groups = new Map();
  #initialHash = null;
  #order = null;
  constructor(data) {
    this.name = null;
    this.creator = null;
    if (data === null) {
      return;
    }
    this.name = data.name;
    this.creator = data.creator;
    this.#order = data.order;
    for (const group of data.groups) {
      this.#groups.set(group.id, new OptionalContentGroup(group.name, group.intent));
    }
    if (data.baseState === "OFF") {
      for (const group of this.#groups.values()) {
        group._setVisible(INTERNAL, false);
      }
    }
    for (const on of data.on) {
      this.#groups.get(on)._setVisible(INTERNAL, true);
    }
    for (const off of data.off) {
      this.#groups.get(off)._setVisible(INTERNAL, false);
    }
    this.#initialHash = this.getHash();
  }
  #evaluateVisibilityExpression(array) {
    const length = array.length;
    if (length < 2) {
      return true;
    }
    const operator = array[0];
    for (let i = 1; i < length; i++) {
      const element = array[i];
      let state;
      if (Array.isArray(element)) {
        state = this.#evaluateVisibilityExpression(element);
      } else if (this.#groups.has(element)) {
        state = this.#groups.get(element).visible;
      } else {
        (0, _util.warn)(`Optional content group not found: ${element}`);
        return true;
      }
      switch (operator) {
        case "And":
          if (!state) {
            return false;
          }
          break;
        case "Or":
          if (state) {
            return true;
          }
          break;
        case "Not":
          return !state;
        default:
          return true;
      }
    }
    return operator === "And";
  }
  isVisible(group) {
    if (this.#groups.size === 0) {
      return true;
    }
    if (!group) {
      (0, _util.warn)("Optional content group not defined.");
      return true;
    }
    if (group.type === "OCG") {
      if (!this.#groups.has(group.id)) {
        (0, _util.warn)(`Optional content group not found: ${group.id}`);
        return true;
      }
      return this.#groups.get(group.id).visible;
    } else if (group.type === "OCMD") {
      if (group.expression) {
        return this.#evaluateVisibilityExpression(group.expression);
      }
      if (!group.policy || group.policy === "AnyOn") {
        for (const id of group.ids) {
          if (!this.#groups.has(id)) {
            (0, _util.warn)(`Optional content group not found: ${id}`);
            return true;
          }
          if (this.#groups.get(id).visible) {
            return true;
          }
        }
        return false;
      } else if (group.policy === "AllOn") {
        for (const id of group.ids) {
          if (!this.#groups.has(id)) {
            (0, _util.warn)(`Optional content group not found: ${id}`);
            return true;
          }
          if (!this.#groups.get(id).visible) {
            return false;
          }
        }
        return true;
      } else if (group.policy === "AnyOff") {
        for (const id of group.ids) {
          if (!this.#groups.has(id)) {
            (0, _util.warn)(`Optional content group not found: ${id}`);
            return true;
          }
          if (!this.#groups.get(id).visible) {
            return true;
          }
        }
        return false;
      } else if (group.policy === "AllOff") {
        for (const id of group.ids) {
          if (!this.#groups.has(id)) {
            (0, _util.warn)(`Optional content group not found: ${id}`);
            return true;
          }
          if (this.#groups.get(id).visible) {
            return false;
          }
        }
        return true;
      }
      (0, _util.warn)(`Unknown optional content policy ${group.policy}.`);
      return true;
    }
    (0, _util.warn)(`Unknown group type ${group.type}.`);
    return true;
  }
  setVisibility(id, visible = true) {
    if (!this.#groups.has(id)) {
      (0, _util.warn)(`Optional content group not found: ${id}`);
      return;
    }
    this.#groups.get(id)._setVisible(INTERNAL, !!visible);
    this.#cachedGetHash = null;
  }
  get hasInitialVisibility() {
    return this.#initialHash === null || this.getHash() === this.#initialHash;
  }
  getOrder() {
    if (!this.#groups.size) {
      return null;
    }
    if (this.#order) {
      return this.#order.slice();
    }
    return [...this.#groups.keys()];
  }
  getGroups() {
    return this.#groups.size > 0 ? (0, _util.objectFromMap)(this.#groups) : null;
  }
  getGroup(id) {
    return this.#groups.get(id) || null;
  }
  getHash() {
    if (this.#cachedGetHash !== null) {
      return this.#cachedGetHash;
    }
    const hash = new _murmurhash.MurmurHash3_64();
    for (const [id, group] of this.#groups) {
      hash.update(`${id}:${group.visible}`);
    }
    return this.#cachedGetHash = hash.hexdigest();
  }
}
exports.OptionalContentConfig = OptionalContentConfig;

/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.PDFDataTransportStream = void 0;
var _util = __w_pdfjs_require__(1);
var _display_utils = __w_pdfjs_require__(6);
class PDFDataTransportStream {
  constructor({
    length,
    initialData,
    progressiveDone = false,
    contentDispositionFilename = null,
    disableRange = false,
    disableStream = false
  }, pdfDataRangeTransport) {
    (0, _util.assert)(pdfDataRangeTransport, 'PDFDataTransportStream - missing required "pdfDataRangeTransport" argument.');
    this._queuedChunks = [];
    this._progressiveDone = progressiveDone;
    this._contentDispositionFilename = contentDispositionFilename;
    if (initialData?.length > 0) {
      const buffer = initialData instanceof Uint8Array && initialData.byteLength === initialData.buffer.byteLength ? initialData.buffer : new Uint8Array(initialData).buffer;
      this._queuedChunks.push(buffer);
    }
    this._pdfDataRangeTransport = pdfDataRangeTransport;
    this._isStreamingSupported = !disableStream;
    this._isRangeSupported = !disableRange;
    this._contentLength = length;
    this._fullRequestReader = null;
    this._rangeReaders = [];
    this._pdfDataRangeTransport.addRangeListener((begin, chunk) => {
      this._onReceiveData({
        begin,
        chunk
      });
    });
    this._pdfDataRangeTransport.addProgressListener((loaded, total) => {
      this._onProgress({
        loaded,
        total
      });
    });
    this._pdfDataRangeTransport.addProgressiveReadListener(chunk => {
      this._onReceiveData({
        chunk
      });
    });
    this._pdfDataRangeTransport.addProgressiveDoneListener(() => {
      this._onProgressiveDone();
    });
    this._pdfDataRangeTransport.transportReady();
  }
  _onReceiveData({
    begin,
    chunk
  }) {
    const buffer = chunk instanceof Uint8Array && chunk.byteLength === chunk.buffer.byteLength ? chunk.buffer : new Uint8Array(chunk).buffer;
    if (begin === undefined) {
      if (this._fullRequestReader) {
        this._fullRequestReader._enqueue(buffer);
      } else {
        this._queuedChunks.push(buffer);
      }
    } else {
      const found = this._rangeReaders.some(function (rangeReader) {
        if (rangeReader._begin !== begin) {
          return false;
        }
        rangeReader._enqueue(buffer);
        return true;
      });
      (0, _util.assert)(found, "_onReceiveData - no `PDFDataTransportStreamRangeReader` instance found.");
    }
  }
  get _progressiveDataLength() {
    return this._fullRequestReader?._loaded ?? 0;
  }
  _onProgress(evt) {
    if (evt.total === undefined) {
      this._rangeReaders[0]?.onProgress?.({
        loaded: evt.loaded
      });
    } else {
      this._fullRequestReader?.onProgress?.({
        loaded: evt.loaded,
        total: evt.total
      });
    }
  }
  _onProgressiveDone() {
    this._fullRequestReader?.progressiveDone();
    this._progressiveDone = true;
  }
  _removeRangeReader(reader) {
    const i = this._rangeReaders.indexOf(reader);
    if (i >= 0) {
      this._rangeReaders.splice(i, 1);
    }
  }
  getFullReader() {
    (0, _util.assert)(!this._fullRequestReader, "PDFDataTransportStream.getFullReader can only be called once.");
    const queuedChunks = this._queuedChunks;
    this._queuedChunks = null;
    return new PDFDataTransportStreamReader(this, queuedChunks, this._progressiveDone, this._contentDispositionFilename);
  }
  getRangeReader(begin, end) {
    if (end <= this._progressiveDataLength) {
      return null;
    }
    const reader = new PDFDataTransportStreamRangeReader(this, begin, end);
    this._pdfDataRangeTransport.requestDataRange(begin, end);
    this._rangeReaders.push(reader);
    return reader;
  }
  cancelAllRequests(reason) {
    this._fullRequestReader?.cancel(reason);
    for (const reader of this._rangeReaders.slice(0)) {
      reader.cancel(reason);
    }
    this._pdfDataRangeTransport.abort();
  }
}
exports.PDFDataTransportStream = PDFDataTransportStream;
class PDFDataTransportStreamReader {
  constructor(stream, queuedChunks, progressiveDone = false, contentDispositionFilename = null) {
    this._stream = stream;
    this._done = progressiveDone || false;
    this._filename = (0, _display_utils.isPdfFile)(contentDispositionFilename) ? contentDispositionFilename : null;
    this._queuedChunks = queuedChunks || [];
    this._loaded = 0;
    for (const chunk of this._queuedChunks) {
      this._loaded += chunk.byteLength;
    }
    this._requests = [];
    this._headersReady = Promise.resolve();
    stream._fullRequestReader = this;
    this.onProgress = null;
  }
  _enqueue(chunk) {
    if (this._done) {
      return;
    }
    if (this._requests.length > 0) {
      const requestCapability = this._requests.shift();
      requestCapability.resolve({
        value: chunk,
        done: false
      });
    } else {
      this._queuedChunks.push(chunk);
    }
    this._loaded += chunk.byteLength;
  }
  get headersReady() {
    return this._headersReady;
  }
  get filename() {
    return this._filename;
  }
  get isRangeSupported() {
    return this._stream._isRangeSupported;
  }
  get isStreamingSupported() {
    return this._stream._isStreamingSupported;
  }
  get contentLength() {
    return this._stream._contentLength;
  }
  async read() {
    if (this._queuedChunks.length > 0) {
      const chunk = this._queuedChunks.shift();
      return {
        value: chunk,
        done: false
      };
    }
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    const requestCapability = new _util.PromiseCapability();
    this._requests.push(requestCapability);
    return requestCapability.promise;
  }
  cancel(reason) {
    this._done = true;
    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }
    this._requests.length = 0;
  }
  progressiveDone() {
    if (this._done) {
      return;
    }
    this._done = true;
  }
}
class PDFDataTransportStreamRangeReader {
  constructor(stream, begin, end) {
    this._stream = stream;
    this._begin = begin;
    this._end = end;
    this._queuedChunk = null;
    this._requests = [];
    this._done = false;
    this.onProgress = null;
  }
  _enqueue(chunk) {
    if (this._done) {
      return;
    }
    if (this._requests.length === 0) {
      this._queuedChunk = chunk;
    } else {
      const requestsCapability = this._requests.shift();
      requestsCapability.resolve({
        value: chunk,
        done: false
      });
      for (const requestCapability of this._requests) {
        requestCapability.resolve({
          value: undefined,
          done: true
        });
      }
      this._requests.length = 0;
    }
    this._done = true;
    this._stream._removeRangeReader(this);
  }
  get isStreamingSupported() {
    return false;
  }
  async read() {
    if (this._queuedChunk) {
      const chunk = this._queuedChunk;
      this._queuedChunk = null;
      return {
        value: chunk,
        done: false
      };
    }
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    const requestCapability = new _util.PromiseCapability();
    this._requests.push(requestCapability);
    return requestCapability.promise;
  }
  cancel(reason) {
    this._done = true;
    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }
    this._requests.length = 0;
    this._stream._removeRangeReader(this);
  }
}

/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.PDFFetchStream = void 0;
var _util = __w_pdfjs_require__(1);
var _network_utils = __w_pdfjs_require__(20);
;
function createFetchOptions(headers, withCredentials, abortController) {
  return {
    method: "GET",
    headers,
    signal: abortController.signal,
    mode: "cors",
    credentials: withCredentials ? "include" : "same-origin",
    redirect: "follow"
  };
}
function createHeaders(httpHeaders) {
  const headers = new Headers();
  for (const property in httpHeaders) {
    const value = httpHeaders[property];
    if (value === undefined) {
      continue;
    }
    headers.append(property, value);
  }
  return headers;
}
function getArrayBuffer(val) {
  if (val instanceof Uint8Array) {
    return val.buffer;
  }
  if (val instanceof ArrayBuffer) {
    return val;
  }
  (0, _util.warn)(`getArrayBuffer - unexpected data format: ${val}`);
  return new Uint8Array(val).buffer;
}
class PDFFetchStream {
  constructor(source) {
    this.source = source;
    this.isHttp = /^https?:/i.test(source.url);
    this.httpHeaders = this.isHttp && source.httpHeaders || {};
    this._fullRequestReader = null;
    this._rangeRequestReaders = [];
  }
  get _progressiveDataLength() {
    return this._fullRequestReader?._loaded ?? 0;
  }
  getFullReader() {
    (0, _util.assert)(!this._fullRequestReader, "PDFFetchStream.getFullReader can only be called once.");
    this._fullRequestReader = new PDFFetchStreamReader(this);
    return this._fullRequestReader;
  }
  getRangeReader(begin, end) {
    if (end <= this._progressiveDataLength) {
      return null;
    }
    const reader = new PDFFetchStreamRangeReader(this, begin, end);
    this._rangeRequestReaders.push(reader);
    return reader;
  }
  cancelAllRequests(reason) {
    this._fullRequestReader?.cancel(reason);
    for (const reader of this._rangeRequestReaders.slice(0)) {
      reader.cancel(reason);
    }
  }
}
exports.PDFFetchStream = PDFFetchStream;
class PDFFetchStreamReader {
  constructor(stream) {
    this._stream = stream;
    this._reader = null;
    this._loaded = 0;
    this._filename = null;
    const source = stream.source;
    this._withCredentials = source.withCredentials || false;
    this._contentLength = source.length;
    this._headersCapability = new _util.PromiseCapability();
    this._disableRange = source.disableRange || false;
    this._rangeChunkSize = source.rangeChunkSize;
    if (!this._rangeChunkSize && !this._disableRange) {
      this._disableRange = true;
    }
    this._abortController = new AbortController();
    this._isStreamingSupported = !source.disableStream;
    this._isRangeSupported = !source.disableRange;
    this._headers = createHeaders(this._stream.httpHeaders);
    const url = source.url;
    fetch(url, createFetchOptions(this._headers, this._withCredentials, this._abortController)).then(response => {
      if (!(0, _network_utils.validateResponseStatus)(response.status)) {
        throw (0, _network_utils.createResponseStatusError)(response.status, url);
      }
      this._reader = response.body.getReader();
      this._headersCapability.resolve();
      const getResponseHeader = name => {
        return response.headers.get(name);
      };
      const {
        allowRangeRequests,
        suggestedLength
      } = (0, _network_utils.validateRangeRequestCapabilities)({
        getResponseHeader,
        isHttp: this._stream.isHttp,
        rangeChunkSize: this._rangeChunkSize,
        disableRange: this._disableRange
      });
      this._isRangeSupported = allowRangeRequests;
      this._contentLength = suggestedLength || this._contentLength;
      this._filename = (0, _network_utils.extractFilenameFromHeader)(getResponseHeader);
      if (!this._isStreamingSupported && this._isRangeSupported) {
        this.cancel(new _util.AbortException("Streaming is disabled."));
      }
    }).catch(this._headersCapability.reject);
    this.onProgress = null;
  }
  get headersReady() {
    return this._headersCapability.promise;
  }
  get filename() {
    return this._filename;
  }
  get contentLength() {
    return this._contentLength;
  }
  get isRangeSupported() {
    return this._isRangeSupported;
  }
  get isStreamingSupported() {
    return this._isStreamingSupported;
  }
  async read() {
    await this._headersCapability.promise;
    const {
      value,
      done
    } = await this._reader.read();
    if (done) {
      return {
        value,
        done
      };
    }
    this._loaded += value.byteLength;
    this.onProgress?.({
      loaded: this._loaded,
      total: this._contentLength
    });
    return {
      value: getArrayBuffer(value),
      done: false
    };
  }
  cancel(reason) {
    this._reader?.cancel(reason);
    this._abortController.abort();
  }
}
class PDFFetchStreamRangeReader {
  constructor(stream, begin, end) {
    this._stream = stream;
    this._reader = null;
    this._loaded = 0;
    const source = stream.source;
    this._withCredentials = source.withCredentials || false;
    this._readCapability = new _util.PromiseCapability();
    this._isStreamingSupported = !source.disableStream;
    this._abortController = new AbortController();
    this._headers = createHeaders(this._stream.httpHeaders);
    this._headers.append("Range", `bytes=${begin}-${end - 1}`);
    const url = source.url;
    fetch(url, createFetchOptions(this._headers, this._withCredentials, this._abortController)).then(response => {
      if (!(0, _network_utils.validateResponseStatus)(response.status)) {
        throw (0, _network_utils.createResponseStatusError)(response.status, url);
      }
      this._readCapability.resolve();
      this._reader = response.body.getReader();
    }).catch(this._readCapability.reject);
    this.onProgress = null;
  }
  get isStreamingSupported() {
    return this._isStreamingSupported;
  }
  async read() {
    await this._readCapability.promise;
    const {
      value,
      done
    } = await this._reader.read();
    if (done) {
      return {
        value,
        done
      };
    }
    this._loaded += value.byteLength;
    this.onProgress?.({
      loaded: this._loaded
    });
    return {
      value: getArrayBuffer(value),
      done: false
    };
  }
  cancel(reason) {
    this._reader?.cancel(reason);
    this._abortController.abort();
  }
}

/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.createResponseStatusError = createResponseStatusError;
exports.extractFilenameFromHeader = extractFilenameFromHeader;
exports.validateRangeRequestCapabilities = validateRangeRequestCapabilities;
exports.validateResponseStatus = validateResponseStatus;
var _util = __w_pdfjs_require__(1);
var _content_disposition = __w_pdfjs_require__(21);
var _display_utils = __w_pdfjs_require__(6);
function validateRangeRequestCapabilities({
  getResponseHeader,
  isHttp,
  rangeChunkSize,
  disableRange
}) {
  const returnValues = {
    allowRangeRequests: false,
    suggestedLength: undefined
  };
  const length = parseInt(getResponseHeader("Content-Length"), 10);
  if (!Number.isInteger(length)) {
    return returnValues;
  }
  returnValues.suggestedLength = length;
  if (length <= 2 * rangeChunkSize) {
    return returnValues;
  }
  if (disableRange || !isHttp) {
    return returnValues;
  }
  if (getResponseHeader("Accept-Ranges") !== "bytes") {
    return returnValues;
  }
  const contentEncoding = getResponseHeader("Content-Encoding") || "identity";
  if (contentEncoding !== "identity") {
    return returnValues;
  }
  returnValues.allowRangeRequests = true;
  return returnValues;
}
function extractFilenameFromHeader(getResponseHeader) {
  const contentDisposition = getResponseHeader("Content-Disposition");
  if (contentDisposition) {
    let filename = (0, _content_disposition.getFilenameFromContentDispositionHeader)(contentDisposition);
    if (filename.includes("%")) {
      try {
        filename = decodeURIComponent(filename);
      } catch {}
    }
    if ((0, _display_utils.isPdfFile)(filename)) {
      return filename;
    }
  }
  return null;
}
function createResponseStatusError(status, url) {
  if (status === 404 || status === 0 && url.startsWith("file:")) {
    return new _util.MissingPDFException('Missing PDF "' + url + '".');
  }
  return new _util.UnexpectedResponseException(`Unexpected server response (${status}) while retrieving PDF "${url}".`, status);
}
function validateResponseStatus(status) {
  return status === 200 || status === 206;
}

/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.getFilenameFromContentDispositionHeader = getFilenameFromContentDispositionHeader;
var _util = __w_pdfjs_require__(1);
function getFilenameFromContentDispositionHeader(contentDisposition) {
  let needsEncodingFixup = true;
  let tmp = toParamRegExp("filename\\*", "i").exec(contentDisposition);
  if (tmp) {
    tmp = tmp[1];
    let filename = rfc2616unquote(tmp);
    filename = unescape(filename);
    filename = rfc5987decode(filename);
    filename = rfc2047decode(filename);
    return fixupEncoding(filename);
  }
  tmp = rfc2231getparam(contentDisposition);
  if (tmp) {
    const filename = rfc2047decode(tmp);
    return fixupEncoding(filename);
  }
  tmp = toParamRegExp("filename", "i").exec(contentDisposition);
  if (tmp) {
    tmp = tmp[1];
    let filename = rfc2616unquote(tmp);
    filename = rfc2047decode(filename);
    return fixupEncoding(filename);
  }
  function toParamRegExp(attributePattern, flags) {
    return new RegExp("(?:^|;)\\s*" + attributePattern + "\\s*=\\s*" + "(" + '[^";\\s][^;\\s]*' + "|" + '"(?:[^"\\\\]|\\\\"?)+"?' + ")", flags);
  }
  function textdecode(encoding, value) {
    if (encoding) {
      if (!/^[\x00-\xFF]+$/.test(value)) {
        return value;
      }
      try {
        const decoder = new TextDecoder(encoding, {
          fatal: true
        });
        const buffer = (0, _util.stringToBytes)(value);
        value = decoder.decode(buffer);
        needsEncodingFixup = false;
      } catch {}
    }
    return value;
  }
  function fixupEncoding(value) {
    if (needsEncodingFixup && /[\x80-\xff]/.test(value)) {
      value = textdecode("utf-8", value);
      if (needsEncodingFixup) {
        value = textdecode("iso-8859-1", value);
      }
    }
    return value;
  }
  function rfc2231getparam(contentDispositionStr) {
    const matches = [];
    let match;
    const iter = toParamRegExp("filename\\*((?!0\\d)\\d+)(\\*?)", "ig");
    while ((match = iter.exec(contentDispositionStr)) !== null) {
      let [, n, quot, part] = match;
      n = parseInt(n, 10);
      if (n in matches) {
        if (n === 0) {
          break;
        }
        continue;
      }
      matches[n] = [quot, part];
    }
    const parts = [];
    for (let n = 0; n < matches.length; ++n) {
      if (!(n in matches)) {
        break;
      }
      let [quot, part] = matches[n];
      part = rfc2616unquote(part);
      if (quot) {
        part = unescape(part);
        if (n === 0) {
          part = rfc5987decode(part);
        }
      }
      parts.push(part);
    }
    return parts.join("");
  }
  function rfc2616unquote(value) {
    if (value.startsWith('"')) {
      const parts = value.slice(1).split('\\"');
      for (let i = 0; i < parts.length; ++i) {
        const quotindex = parts[i].indexOf('"');
        if (quotindex !== -1) {
          parts[i] = parts[i].slice(0, quotindex);
          parts.length = i + 1;
        }
        parts[i] = parts[i].replaceAll(/\\(.)/g, "$1");
      }
      value = parts.join('"');
    }
    return value;
  }
  function rfc5987decode(extvalue) {
    const encodingend = extvalue.indexOf("'");
    if (encodingend === -1) {
      return extvalue;
    }
    const encoding = extvalue.slice(0, encodingend);
    const langvalue = extvalue.slice(encodingend + 1);
    const value = langvalue.replace(/^[^']*'/, "");
    return textdecode(encoding, value);
  }
  function rfc2047decode(value) {
    if (!value.startsWith("=?") || /[\x00-\x19\x80-\xff]/.test(value)) {
      return value;
    }
    return value.replaceAll(/=\?([\w-]*)\?([QqBb])\?((?:[^?]|\?(?!=))*)\?=/g, function (matches, charset, encoding, text) {
      if (encoding === "q" || encoding === "Q") {
        text = text.replaceAll("_", " ");
        text = text.replaceAll(/=([0-9a-fA-F]{2})/g, function (match, hex) {
          return String.fromCharCode(parseInt(hex, 16));
        });
        return textdecode(charset, text);
      }
      try {
        text = atob(text);
      } catch {}
      return textdecode(charset, text);
    });
  }
  return "";
}

/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.PDFNetworkStream = void 0;
var _util = __w_pdfjs_require__(1);
var _network_utils = __w_pdfjs_require__(20);
;
const OK_RESPONSE = 200;
const PARTIAL_CONTENT_RESPONSE = 206;
function getArrayBuffer(xhr) {
  const data = xhr.response;
  if (typeof data !== "string") {
    return data;
  }
  return (0, _util.stringToBytes)(data).buffer;
}
class NetworkManager {
  constructor(url, args = {}) {
    this.url = url;
    this.isHttp = /^https?:/i.test(url);
    this.httpHeaders = this.isHttp && args.httpHeaders || Object.create(null);
    this.withCredentials = args.withCredentials || false;
    this.currXhrId = 0;
    this.pendingRequests = Object.create(null);
  }
  requestRange(begin, end, listeners) {
    const args = {
      begin,
      end
    };
    for (const prop in listeners) {
      args[prop] = listeners[prop];
    }
    return this.request(args);
  }
  requestFull(listeners) {
    return this.request(listeners);
  }
  request(args) {
    const xhr = new XMLHttpRequest();
    const xhrId = this.currXhrId++;
    const pendingRequest = this.pendingRequests[xhrId] = {
      xhr
    };
    xhr.open("GET", this.url);
    xhr.withCredentials = this.withCredentials;
    for (const property in this.httpHeaders) {
      const value = this.httpHeaders[property];
      if (value === undefined) {
        continue;
      }
      xhr.setRequestHeader(property, value);
    }
    if (this.isHttp && "begin" in args && "end" in args) {
      xhr.setRequestHeader("Range", `bytes=${args.begin}-${args.end - 1}`);
      pendingRequest.expectedStatus = PARTIAL_CONTENT_RESPONSE;
    } else {
      pendingRequest.expectedStatus = OK_RESPONSE;
    }
    xhr.responseType = "arraybuffer";
    if (args.onError) {
      xhr.onerror = function (evt) {
        args.onError(xhr.status);
      };
    }
    xhr.onreadystatechange = this.onStateChange.bind(this, xhrId);
    xhr.onprogress = this.onProgress.bind(this, xhrId);
    pendingRequest.onHeadersReceived = args.onHeadersReceived;
    pendingRequest.onDone = args.onDone;
    pendingRequest.onError = args.onError;
    pendingRequest.onProgress = args.onProgress;
    xhr.send(null);
    return xhrId;
  }
  onProgress(xhrId, evt) {
    const pendingRequest = this.pendingRequests[xhrId];
    if (!pendingRequest) {
      return;
    }
    pendingRequest.onProgress?.(evt);
  }
  onStateChange(xhrId, evt) {
    const pendingRequest = this.pendingRequests[xhrId];
    if (!pendingRequest) {
      return;
    }
    const xhr = pendingRequest.xhr;
    if (xhr.readyState >= 2 && pendingRequest.onHeadersReceived) {
      pendingRequest.onHeadersReceived();
      delete pendingRequest.onHeadersReceived;
    }
    if (xhr.readyState !== 4) {
      return;
    }
    if (!(xhrId in this.pendingRequests)) {
      return;
    }
    delete this.pendingRequests[xhrId];
    if (xhr.status === 0 && this.isHttp) {
      pendingRequest.onError?.(xhr.status);
      return;
    }
    const xhrStatus = xhr.status || OK_RESPONSE;
    const ok_response_on_range_request = xhrStatus === OK_RESPONSE && pendingRequest.expectedStatus === PARTIAL_CONTENT_RESPONSE;
    if (!ok_response_on_range_request && xhrStatus !== pendingRequest.expectedStatus) {
      pendingRequest.onError?.(xhr.status);
      return;
    }
    const chunk = getArrayBuffer(xhr);
    if (xhrStatus === PARTIAL_CONTENT_RESPONSE) {
      const rangeHeader = xhr.getResponseHeader("Content-Range");
      const matches = /bytes (\d+)-(\d+)\/(\d+)/.exec(rangeHeader);
      pendingRequest.onDone({
        begin: parseInt(matches[1], 10),
        chunk
      });
    } else if (chunk) {
      pendingRequest.onDone({
        begin: 0,
        chunk
      });
    } else {
      pendingRequest.onError?.(xhr.status);
    }
  }
  getRequestXhr(xhrId) {
    return this.pendingRequests[xhrId].xhr;
  }
  isPendingRequest(xhrId) {
    return xhrId in this.pendingRequests;
  }
  abortRequest(xhrId) {
    const xhr = this.pendingRequests[xhrId].xhr;
    delete this.pendingRequests[xhrId];
    xhr.abort();
  }
}
class PDFNetworkStream {
  constructor(source) {
    this._source = source;
    this._manager = new NetworkManager(source.url, {
      httpHeaders: source.httpHeaders,
      withCredentials: source.withCredentials
    });
    this._rangeChunkSize = source.rangeChunkSize;
    this._fullRequestReader = null;
    this._rangeRequestReaders = [];
  }
  _onRangeRequestReaderClosed(reader) {
    const i = this._rangeRequestReaders.indexOf(reader);
    if (i >= 0) {
      this._rangeRequestReaders.splice(i, 1);
    }
  }
  getFullReader() {
    (0, _util.assert)(!this._fullRequestReader, "PDFNetworkStream.getFullReader can only be called once.");
    this._fullRequestReader = new PDFNetworkStreamFullRequestReader(this._manager, this._source);
    return this._fullRequestReader;
  }
  getRangeReader(begin, end) {
    const reader = new PDFNetworkStreamRangeRequestReader(this._manager, begin, end);
    reader.onClosed = this._onRangeRequestReaderClosed.bind(this);
    this._rangeRequestReaders.push(reader);
    return reader;
  }
  cancelAllRequests(reason) {
    this._fullRequestReader?.cancel(reason);
    for (const reader of this._rangeRequestReaders.slice(0)) {
      reader.cancel(reason);
    }
  }
}
exports.PDFNetworkStream = PDFNetworkStream;
class PDFNetworkStreamFullRequestReader {
  constructor(manager, source) {
    this._manager = manager;
    const args = {
      onHeadersReceived: this._onHeadersReceived.bind(this),
      onDone: this._onDone.bind(this),
      onError: this._onError.bind(this),
      onProgress: this._onProgress.bind(this)
    };
    this._url = source.url;
    this._fullRequestId = manager.requestFull(args);
    this._headersReceivedCapability = new _util.PromiseCapability();
    this._disableRange = source.disableRange || false;
    this._contentLength = source.length;
    this._rangeChunkSize = source.rangeChunkSize;
    if (!this._rangeChunkSize && !this._disableRange) {
      this._disableRange = true;
    }
    this._isStreamingSupported = false;
    this._isRangeSupported = false;
    this._cachedChunks = [];
    this._requests = [];
    this._done = false;
    this._storedError = undefined;
    this._filename = null;
    this.onProgress = null;
  }
  _onHeadersReceived() {
    const fullRequestXhrId = this._fullRequestId;
    const fullRequestXhr = this._manager.getRequestXhr(fullRequestXhrId);
    const getResponseHeader = name => {
      return fullRequestXhr.getResponseHeader(name);
    };
    const {
      allowRangeRequests,
      suggestedLength
    } = (0, _network_utils.validateRangeRequestCapabilities)({
      getResponseHeader,
      isHttp: this._manager.isHttp,
      rangeChunkSize: this._rangeChunkSize,
      disableRange: this._disableRange
    });
    if (allowRangeRequests) {
      this._isRangeSupported = true;
    }
    this._contentLength = suggestedLength || this._contentLength;
    this._filename = (0, _network_utils.extractFilenameFromHeader)(getResponseHeader);
    if (this._isRangeSupported) {
      this._manager.abortRequest(fullRequestXhrId);
    }
    this._headersReceivedCapability.resolve();
  }
  _onDone(data) {
    if (data) {
      if (this._requests.length > 0) {
        const requestCapability = this._requests.shift();
        requestCapability.resolve({
          value: data.chunk,
          done: false
        });
      } else {
        this._cachedChunks.push(data.chunk);
      }
    }
    this._done = true;
    if (this._cachedChunks.length > 0) {
      return;
    }
    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }
    this._requests.length = 0;
  }
  _onError(status) {
    this._storedError = (0, _network_utils.createResponseStatusError)(status, this._url);
    this._headersReceivedCapability.reject(this._storedError);
    for (const requestCapability of this._requests) {
      requestCapability.reject(this._storedError);
    }
    this._requests.length = 0;
    this._cachedChunks.length = 0;
  }
  _onProgress(evt) {
    this.onProgress?.({
      loaded: evt.loaded,
      total: evt.lengthComputable ? evt.total : this._contentLength
    });
  }
  get filename() {
    return this._filename;
  }
  get isRangeSupported() {
    return this._isRangeSupported;
  }
  get isStreamingSupported() {
    return this._isStreamingSupported;
  }
  get contentLength() {
    return this._contentLength;
  }
  get headersReady() {
    return this._headersReceivedCapability.promise;
  }
  async read() {
    if (this._storedError) {
      throw this._storedError;
    }
    if (this._cachedChunks.length > 0) {
      const chunk = this._cachedChunks.shift();
      return {
        value: chunk,
        done: false
      };
    }
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    const requestCapability = new _util.PromiseCapability();
    this._requests.push(requestCapability);
    return requestCapability.promise;
  }
  cancel(reason) {
    this._done = true;
    this._headersReceivedCapability.reject(reason);
    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }
    this._requests.length = 0;
    if (this._manager.isPendingRequest(this._fullRequestId)) {
      this._manager.abortRequest(this._fullRequestId);
    }
    this._fullRequestReader = null;
  }
}
class PDFNetworkStreamRangeRequestReader {
  constructor(manager, begin, end) {
    this._manager = manager;
    const args = {
      onDone: this._onDone.bind(this),
      onError: this._onError.bind(this),
      onProgress: this._onProgress.bind(this)
    };
    this._url = manager.url;
    this._requestId = manager.requestRange(begin, end, args);
    this._requests = [];
    this._queuedChunk = null;
    this._done = false;
    this._storedError = undefined;
    this.onProgress = null;
    this.onClosed = null;
  }
  _close() {
    this.onClosed?.(this);
  }
  _onDone(data) {
    const chunk = data.chunk;
    if (this._requests.length > 0) {
      const requestCapability = this._requests.shift();
      requestCapability.resolve({
        value: chunk,
        done: false
      });
    } else {
      this._queuedChunk = chunk;
    }
    this._done = true;
    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }
    this._requests.length = 0;
    this._close();
  }
  _onError(status) {
    this._storedError = (0, _network_utils.createResponseStatusError)(status, this._url);
    for (const requestCapability of this._requests) {
      requestCapability.reject(this._storedError);
    }
    this._requests.length = 0;
    this._queuedChunk = null;
  }
  _onProgress(evt) {
    if (!this.isStreamingSupported) {
      this.onProgress?.({
        loaded: evt.loaded
      });
    }
  }
  get isStreamingSupported() {
    return false;
  }
  async read() {
    if (this._storedError) {
      throw this._storedError;
    }
    if (this._queuedChunk !== null) {
      const chunk = this._queuedChunk;
      this._queuedChunk = null;
      return {
        value: chunk,
        done: false
      };
    }
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    const requestCapability = new _util.PromiseCapability();
    this._requests.push(requestCapability);
    return requestCapability.promise;
  }
  cancel(reason) {
    this._done = true;
    for (const requestCapability of this._requests) {
      requestCapability.resolve({
        value: undefined,
        done: true
      });
    }
    this._requests.length = 0;
    if (this._manager.isPendingRequest(this._requestId)) {
      this._manager.abortRequest(this._requestId);
    }
    this._close();
  }
}

/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.PDFNodeStream = void 0;
var _util = __w_pdfjs_require__(1);
var _network_utils = __w_pdfjs_require__(20);
;
const fileUriRegex = /^file:\/\/\/[a-zA-Z]:\//;
function parseUrl(sourceUrl) {
  const url = require("url");
  const parsedUrl = url.parse(sourceUrl);
  if (parsedUrl.protocol === "file:" || parsedUrl.host) {
    return parsedUrl;
  }
  if (/^[a-z]:[/\\]/i.test(sourceUrl)) {
    return url.parse(`file:///${sourceUrl}`);
  }
  if (!parsedUrl.host) {
    parsedUrl.protocol = "file:";
  }
  return parsedUrl;
}
class PDFNodeStream {
  constructor(source) {
    this.source = source;
    this.url = parseUrl(source.url);
    this.isHttp = this.url.protocol === "http:" || this.url.protocol === "https:";
    this.isFsUrl = this.url.protocol === "file:";
    this.httpHeaders = this.isHttp && source.httpHeaders || {};
    this._fullRequestReader = null;
    this._rangeRequestReaders = [];
  }
  get _progressiveDataLength() {
    return this._fullRequestReader?._loaded ?? 0;
  }
  getFullReader() {
    (0, _util.assert)(!this._fullRequestReader, "PDFNodeStream.getFullReader can only be called once.");
    this._fullRequestReader = this.isFsUrl ? new PDFNodeStreamFsFullReader(this) : new PDFNodeStreamFullReader(this);
    return this._fullRequestReader;
  }
  getRangeReader(start, end) {
    if (end <= this._progressiveDataLength) {
      return null;
    }
    const rangeReader = this.isFsUrl ? new PDFNodeStreamFsRangeReader(this, start, end) : new PDFNodeStreamRangeReader(this, start, end);
    this._rangeRequestReaders.push(rangeReader);
    return rangeReader;
  }
  cancelAllRequests(reason) {
    this._fullRequestReader?.cancel(reason);
    for (const reader of this._rangeRequestReaders.slice(0)) {
      reader.cancel(reason);
    }
  }
}
exports.PDFNodeStream = PDFNodeStream;
class BaseFullReader {
  constructor(stream) {
    this._url = stream.url;
    this._done = false;
    this._storedError = null;
    this.onProgress = null;
    const source = stream.source;
    this._contentLength = source.length;
    this._loaded = 0;
    this._filename = null;
    this._disableRange = source.disableRange || false;
    this._rangeChunkSize = source.rangeChunkSize;
    if (!this._rangeChunkSize && !this._disableRange) {
      this._disableRange = true;
    }
    this._isStreamingSupported = !source.disableStream;
    this._isRangeSupported = !source.disableRange;
    this._readableStream = null;
    this._readCapability = new _util.PromiseCapability();
    this._headersCapability = new _util.PromiseCapability();
  }
  get headersReady() {
    return this._headersCapability.promise;
  }
  get filename() {
    return this._filename;
  }
  get contentLength() {
    return this._contentLength;
  }
  get isRangeSupported() {
    return this._isRangeSupported;
  }
  get isStreamingSupported() {
    return this._isStreamingSupported;
  }
  async read() {
    await this._readCapability.promise;
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    if (this._storedError) {
      throw this._storedError;
    }
    const chunk = this._readableStream.read();
    if (chunk === null) {
      this._readCapability = new _util.PromiseCapability();
      return this.read();
    }
    this._loaded += chunk.length;
    this.onProgress?.({
      loaded: this._loaded,
      total: this._contentLength
    });
    const buffer = new Uint8Array(chunk).buffer;
    return {
      value: buffer,
      done: false
    };
  }
  cancel(reason) {
    if (!this._readableStream) {
      this._error(reason);
      return;
    }
    this._readableStream.destroy(reason);
  }
  _error(reason) {
    this._storedError = reason;
    this._readCapability.resolve();
  }
  _setReadableStream(readableStream) {
    this._readableStream = readableStream;
    readableStream.on("readable", () => {
      this._readCapability.resolve();
    });
    readableStream.on("end", () => {
      readableStream.destroy();
      this._done = true;
      this._readCapability.resolve();
    });
    readableStream.on("error", reason => {
      this._error(reason);
    });
    if (!this._isStreamingSupported && this._isRangeSupported) {
      this._error(new _util.AbortException("streaming is disabled"));
    }
    if (this._storedError) {
      this._readableStream.destroy(this._storedError);
    }
  }
}
class BaseRangeReader {
  constructor(stream) {
    this._url = stream.url;
    this._done = false;
    this._storedError = null;
    this.onProgress = null;
    this._loaded = 0;
    this._readableStream = null;
    this._readCapability = new _util.PromiseCapability();
    const source = stream.source;
    this._isStreamingSupported = !source.disableStream;
  }
  get isStreamingSupported() {
    return this._isStreamingSupported;
  }
  async read() {
    await this._readCapability.promise;
    if (this._done) {
      return {
        value: undefined,
        done: true
      };
    }
    if (this._storedError) {
      throw this._storedError;
    }
    const chunk = this._readableStream.read();
    if (chunk === null) {
      this._readCapability = new _util.PromiseCapability();
      return this.read();
    }
    this._loaded += chunk.length;
    this.onProgress?.({
      loaded: this._loaded
    });
    const buffer = new Uint8Array(chunk).buffer;
    return {
      value: buffer,
      done: false
    };
  }
  cancel(reason) {
    if (!this._readableStream) {
      this._error(reason);
      return;
    }
    this._readableStream.destroy(reason);
  }
  _error(reason) {
    this._storedError = reason;
    this._readCapability.resolve();
  }
  _setReadableStream(readableStream) {
    this._readableStream = readableStream;
    readableStream.on("readable", () => {
      this._readCapability.resolve();
    });
    readableStream.on("end", () => {
      readableStream.destroy();
      this._done = true;
      this._readCapability.resolve();
    });
    readableStream.on("error", reason => {
      this._error(reason);
    });
    if (this._storedError) {
      this._readableStream.destroy(this._storedError);
    }
  }
}
function createRequestOptions(parsedUrl, headers) {
  return {
    protocol: parsedUrl.protocol,
    auth: parsedUrl.auth,
    host: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    method: "GET",
    headers
  };
}
class PDFNodeStreamFullReader extends BaseFullReader {
  constructor(stream) {
    super(stream);
    const handleResponse = response => {
      if (response.statusCode === 404) {
        const error = new _util.MissingPDFException(`Missing PDF "${this._url}".`);
        this._storedError = error;
        this._headersCapability.reject(error);
        return;
      }
      this._headersCapability.resolve();
      this._setReadableStream(response);
      const getResponseHeader = name => {
        return this._readableStream.headers[name.toLowerCase()];
      };
      const {
        allowRangeRequests,
        suggestedLength
      } = (0, _network_utils.validateRangeRequestCapabilities)({
        getResponseHeader,
        isHttp: stream.isHttp,
        rangeChunkSize: this._rangeChunkSize,
        disableRange: this._disableRange
      });
      this._isRangeSupported = allowRangeRequests;
      this._contentLength = suggestedLength || this._contentLength;
      this._filename = (0, _network_utils.extractFilenameFromHeader)(getResponseHeader);
    };
    this._request = null;
    if (this._url.protocol === "http:") {
      const http = require("http");
      this._request = http.request(createRequestOptions(this._url, stream.httpHeaders), handleResponse);
    } else {
      const https = require("https");
      this._request = https.request(createRequestOptions(this._url, stream.httpHeaders), handleResponse);
    }
    this._request.on("error", reason => {
      this._storedError = reason;
      this._headersCapability.reject(reason);
    });
    this._request.end();
  }
}
class PDFNodeStreamRangeReader extends BaseRangeReader {
  constructor(stream, start, end) {
    super(stream);
    this._httpHeaders = {};
    for (const property in stream.httpHeaders) {
      const value = stream.httpHeaders[property];
      if (value === undefined) {
        continue;
      }
      this._httpHeaders[property] = value;
    }
    this._httpHeaders.Range = `bytes=${start}-${end - 1}`;
    const handleResponse = response => {
      if (response.statusCode === 404) {
        const error = new _util.MissingPDFException(`Missing PDF "${this._url}".`);
        this._storedError = error;
        return;
      }
      this._setReadableStream(response);
    };
    this._request = null;
    if (this._url.protocol === "http:") {
      const http = require("http");
      this._request = http.request(createRequestOptions(this._url, this._httpHeaders), handleResponse);
    } else {
      const https = require("https");
      this._request = https.request(createRequestOptions(this._url, this._httpHeaders), handleResponse);
    }
    this._request.on("error", reason => {
      this._storedError = reason;
    });
    this._request.end();
  }
}
class PDFNodeStreamFsFullReader extends BaseFullReader {
  constructor(stream) {
    super(stream);
    let path = decodeURIComponent(this._url.path);
    if (fileUriRegex.test(this._url.href)) {
      path = path.replace(/^\//, "");
    }
    const fs = require("fs");
    fs.lstat(path, (error, stat) => {
      if (error) {
        if (error.code === "ENOENT") {
          error = new _util.MissingPDFException(`Missing PDF "${path}".`);
        }
        this._storedError = error;
        this._headersCapability.reject(error);
        return;
      }
      this._contentLength = stat.size;
      this._setReadableStream(fs.createReadStream(path));
      this._headersCapability.resolve();
    });
  }
}
class PDFNodeStreamFsRangeReader extends BaseRangeReader {
  constructor(stream, start, end) {
    super(stream);
    let path = decodeURIComponent(this._url.path);
    if (fileUriRegex.test(this._url.href)) {
      path = path.replace(/^\//, "");
    }
    const fs = require("fs");
    this._setReadableStream(fs.createReadStream(path, {
      start,
      end: end - 1
    }));
  }
}

/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.SVGGraphics = void 0;
var _display_utils = __w_pdfjs_require__(6);
var _util = __w_pdfjs_require__(1);
;
const SVG_DEFAULTS = {
  fontStyle: "normal",
  fontWeight: "normal",
  fillColor: "#000000"
};
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const LINE_CAP_STYLES = ["butt", "round", "square"];
const LINE_JOIN_STYLES = ["miter", "round", "bevel"];
const createObjectURL = function (data, contentType = "", forceDataSchema = false) {
  if (URL.createObjectURL && typeof Blob !== "undefined" && !forceDataSchema) {
    return URL.createObjectURL(new Blob([data], {
      type: contentType
    }));
  }
  const digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let buffer = `data:${contentType};base64,`;
  for (let i = 0, ii = data.length; i < ii; i += 3) {
    const b1 = data[i] & 0xff;
    const b2 = data[i + 1] & 0xff;
    const b3 = data[i + 2] & 0xff;
    const d1 = b1 >> 2,
      d2 = (b1 & 3) << 4 | b2 >> 4;
    const d3 = i + 1 < ii ? (b2 & 0xf) << 2 | b3 >> 6 : 64;
    const d4 = i + 2 < ii ? b3 & 0x3f : 64;
    buffer += digits[d1] + digits[d2] + digits[d3] + digits[d4];
  }
  return buffer;
};
const convertImgDataToPng = function () {
  const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const CHUNK_WRAPPER_SIZE = 12;
  const crcTable = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let h = 0; h < 8; h++) {
      c = c & 1 ? 0xedb88320 ^ c >> 1 & 0x7fffffff : c >> 1 & 0x7fffffff;
    }
    crcTable[i] = c;
  }
  function crc32(data, start, end) {
    let crc = -1;
    for (let i = start; i < end; i++) {
      const a = (crc ^ data[i]) & 0xff;
      const b = crcTable[a];
      crc = crc >>> 8 ^ b;
    }
    return crc ^ -1;
  }
  function writePngChunk(type, body, data, offset) {
    let p = offset;
    const len = body.length;
    data[p] = len >> 24 & 0xff;
    data[p + 1] = len >> 16 & 0xff;
    data[p + 2] = len >> 8 & 0xff;
    data[p + 3] = len & 0xff;
    p += 4;
    data[p] = type.charCodeAt(0) & 0xff;
    data[p + 1] = type.charCodeAt(1) & 0xff;
    data[p + 2] = type.charCodeAt(2) & 0xff;
    data[p + 3] = type.charCodeAt(3) & 0xff;
    p += 4;
    data.set(body, p);
    p += body.length;
    const crc = crc32(data, offset + 4, p);
    data[p] = crc >> 24 & 0xff;
    data[p + 1] = crc >> 16 & 0xff;
    data[p + 2] = crc >> 8 & 0xff;
    data[p + 3] = crc & 0xff;
  }
  function adler32(data, start, end) {
    let a = 1;
    let b = 0;
    for (let i = start; i < end; ++i) {
      a = (a + (data[i] & 0xff)) % 65521;
      b = (b + a) % 65521;
    }
    return b << 16 | a;
  }
  function deflateSync(literals) {
    if (!_util.isNodeJS) {
      return deflateSyncUncompressed(literals);
    }
    try {
      const input = parseInt(process.versions.node) >= 8 ? literals : Buffer.from(literals);
      const output = require("zlib").deflateSync(input, {
        level: 9
      });
      return output instanceof Uint8Array ? output : new Uint8Array(output);
    } catch (e) {
      (0, _util.warn)("Not compressing PNG because zlib.deflateSync is unavailable: " + e);
    }
    return deflateSyncUncompressed(literals);
  }
  function deflateSyncUncompressed(literals) {
    let len = literals.length;
    const maxBlockLength = 0xffff;
    const deflateBlocks = Math.ceil(len / maxBlockLength);
    const idat = new Uint8Array(2 + len + deflateBlocks * 5 + 4);
    let pi = 0;
    idat[pi++] = 0x78;
    idat[pi++] = 0x9c;
    let pos = 0;
    while (len > maxBlockLength) {
      idat[pi++] = 0x00;
      idat[pi++] = 0xff;
      idat[pi++] = 0xff;
      idat[pi++] = 0x00;
      idat[pi++] = 0x00;
      idat.set(literals.subarray(pos, pos + maxBlockLength), pi);
      pi += maxBlockLength;
      pos += maxBlockLength;
      len -= maxBlockLength;
    }
    idat[pi++] = 0x01;
    idat[pi++] = len & 0xff;
    idat[pi++] = len >> 8 & 0xff;
    idat[pi++] = ~len & 0xffff & 0xff;
    idat[pi++] = (~len & 0xffff) >> 8 & 0xff;
    idat.set(literals.subarray(pos), pi);
    pi += literals.length - pos;
    const adler = adler32(literals, 0, literals.length);
    idat[pi++] = adler >> 24 & 0xff;
    idat[pi++] = adler >> 16 & 0xff;
    idat[pi++] = adler >> 8 & 0xff;
    idat[pi++] = adler & 0xff;
    return idat;
  }
  function encode(imgData, kind, forceDataSchema, isMask) {
    const width = imgData.width;
    const height = imgData.height;
    let bitDepth, colorType, lineSize;
    const bytes = imgData.data;
    switch (kind) {
      case _util.ImageKind.GRAYSCALE_1BPP:
        colorType = 0;
        bitDepth = 1;
        lineSize = width + 7 >> 3;
        break;
      case _util.ImageKind.RGB_24BPP:
        colorType = 2;
        bitDepth = 8;
        lineSize = width * 3;
        break;
      case _util.ImageKind.RGBA_32BPP:
        colorType = 6;
        bitDepth = 8;
        lineSize = width * 4;
        break;
      default:
        throw new Error("invalid format");
    }
    const literals = new Uint8Array((1 + lineSize) * height);
    let offsetLiterals = 0,
      offsetBytes = 0;
    for (let y = 0; y < height; ++y) {
      literals[offsetLiterals++] = 0;
      literals.set(bytes.subarray(offsetBytes, offsetBytes + lineSize), offsetLiterals);
      offsetBytes += lineSize;
      offsetLiterals += lineSize;
    }
    if (kind === _util.ImageKind.GRAYSCALE_1BPP && isMask) {
      offsetLiterals = 0;
      for (let y = 0; y < height; y++) {
        offsetLiterals++;
        for (let i = 0; i < lineSize; i++) {
          literals[offsetLiterals++] ^= 0xff;
        }
      }
    }
    const ihdr = new Uint8Array([width >> 24 & 0xff, width >> 16 & 0xff, width >> 8 & 0xff, width & 0xff, height >> 24 & 0xff, height >> 16 & 0xff, height >> 8 & 0xff, height & 0xff, bitDepth, colorType, 0x00, 0x00, 0x00]);
    const idat = deflateSync(literals);
    const pngLength = PNG_HEADER.length + CHUNK_WRAPPER_SIZE * 3 + ihdr.length + idat.length;
    const data = new Uint8Array(pngLength);
    let offset = 0;
    data.set(PNG_HEADER, offset);
    offset += PNG_HEADER.length;
    writePngChunk("IHDR", ihdr, data, offset);
    offset += CHUNK_WRAPPER_SIZE + ihdr.length;
    writePngChunk("IDATA", idat, data, offset);
    offset += CHUNK_WRAPPER_SIZE + idat.length;
    writePngChunk("IEND", new Uint8Array(0), data, offset);
    return createObjectURL(data, "image/png", forceDataSchema);
  }
  return function convertImgDataToPng(imgData, forceDataSchema, isMask) {
    const kind = imgData.kind === undefined ? _util.ImageKind.GRAYSCALE_1BPP : imgData.kind;
    return encode(imgData, kind, forceDataSchema, isMask);
  };
}();
class SVGExtraState {
  constructor() {
    this.fontSizeScale = 1;
    this.fontWeight = SVG_DEFAULTS.fontWeight;
    this.fontSize = 0;
    this.textMatrix = _util.IDENTITY_MATRIX;
    this.fontMatrix = _util.FONT_IDENTITY_MATRIX;
    this.leading = 0;
    this.textRenderingMode = _util.TextRenderingMode.FILL;
    this.textMatrixScale = 1;
    this.x = 0;
    this.y = 0;
    this.lineX = 0;
    this.lineY = 0;
    this.charSpacing = 0;
    this.wordSpacing = 0;
    this.textHScale = 1;
    this.textRise = 0;
    this.fillColor = SVG_DEFAULTS.fillColor;
    this.strokeColor = "#000000";
    this.fillAlpha = 1;
    this.strokeAlpha = 1;
    this.lineWidth = 1;
    this.lineJoin = "";
    this.lineCap = "";
    this.miterLimit = 0;
    this.dashArray = [];
    this.dashPhase = 0;
    this.dependencies = [];
    this.activeClipUrl = null;
    this.clipGroup = null;
    this.maskId = "";
  }
  clone() {
    return Object.create(this);
  }
  setCurrentPoint(x, y) {
    this.x = x;
    this.y = y;
  }
}
function opListToTree(opList) {
  let opTree = [];
  const tmp = [];
  for (const opListElement of opList) {
    if (opListElement.fn === "save") {
      opTree.push({
        fnId: 92,
        fn: "group",
        items: []
      });
      tmp.push(opTree);
      opTree = opTree.at(-1).items;
      continue;
    }
    if (opListElement.fn === "restore") {
      opTree = tmp.pop();
    } else {
      opTree.push(opListElement);
    }
  }
  return opTree;
}
function pf(value) {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  const s = value.toFixed(10);
  let i = s.length - 1;
  if (s[i] !== "0") {
    return s;
  }
  do {
    i--;
  } while (s[i] === "0");
  return s.substring(0, s[i] === "." ? i : i + 1);
}
function pm(m) {
  if (m[4] === 0 && m[5] === 0) {
    if (m[1] === 0 && m[2] === 0) {
      if (m[0] === 1 && m[3] === 1) {
        return "";
      }
      return `scale(${pf(m[0])} ${pf(m[3])})`;
    }
    if (m[0] === m[3] && m[1] === -m[2]) {
      const a = Math.acos(m[0]) * 180 / Math.PI;
      return `rotate(${pf(a)})`;
    }
  } else if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1) {
    return `translate(${pf(m[4])} ${pf(m[5])})`;
  }
  return `matrix(${pf(m[0])} ${pf(m[1])} ${pf(m[2])} ${pf(m[3])} ${pf(m[4])} ` + `${pf(m[5])})`;
}
let clipCount = 0;
let maskCount = 0;
let shadingCount = 0;
class SVGGraphics {
  constructor(commonObjs, objs, forceDataSchema = false) {
    (0, _display_utils.deprecated)("The SVG back-end is no longer maintained and *may* be removed in the future.");
    this.svgFactory = new _display_utils.DOMSVGFactory();
    this.current = new SVGExtraState();
    this.transformMatrix = _util.IDENTITY_MATRIX;
    this.transformStack = [];
    this.extraStack = [];
    this.commonObjs = commonObjs;
    this.objs = objs;
    this.pendingClip = null;
    this.pendingEOFill = false;
    this.embedFonts = false;
    this.embeddedFonts = Object.create(null);
    this.cssStyle = null;
    this.forceDataSchema = !!forceDataSchema;
    this._operatorIdMapping = [];
    for (const op in _util.OPS) {
      this._operatorIdMapping[_util.OPS[op]] = op;
    }
  }
  getObject(data, fallback = null) {
    if (typeof data === "string") {
      return data.startsWith("g_") ? this.commonObjs.get(data) : this.objs.get(data);
    }
    return fallback;
  }
  save() {
    this.transformStack.push(this.transformMatrix);
    const old = this.current;
    this.extraStack.push(old);
    this.current = old.clone();
  }
  restore() {
    this.transformMatrix = this.transformStack.pop();
    this.current = this.extraStack.pop();
    this.pendingClip = null;
    this.tgrp = null;
  }
  group(items) {
    this.save();
    this.executeOpTree(items);
    this.restore();
  }
  loadDependencies(operatorList) {
    const fnArray = operatorList.fnArray;
    const argsArray = operatorList.argsArray;
    for (let i = 0, ii = fnArray.length; i < ii; i++) {
      if (fnArray[i] !== _util.OPS.dependency) {
        continue;
      }
      for (const obj of argsArray[i]) {
        const objsPool = obj.startsWith("g_") ? this.commonObjs : this.objs;
        const promise = new Promise(resolve => {
          objsPool.get(obj, resolve);
        });
        this.current.dependencies.push(promise);
      }
    }
    return Promise.all(this.current.dependencies);
  }
  transform(a, b, c, d, e, f) {
    const transformMatrix = [a, b, c, d, e, f];
    this.transformMatrix = _util.Util.transform(this.transformMatrix, transformMatrix);
    this.tgrp = null;
  }
  getSVG(operatorList, viewport) {
    this.viewport = viewport;
    const svgElement = this._initialize(viewport);
    return this.loadDependencies(operatorList).then(() => {
      this.transformMatrix = _util.IDENTITY_MATRIX;
      this.executeOpTree(this.convertOpList(operatorList));
      return svgElement;
    });
  }
  convertOpList(operatorList) {
    const operatorIdMapping = this._operatorIdMapping;
    const argsArray = operatorList.argsArray;
    const fnArray = operatorList.fnArray;
    const opList = [];
    for (let i = 0, ii = fnArray.length; i < ii; i++) {
      const fnId = fnArray[i];
      opList.push({
        fnId,
        fn: operatorIdMapping[fnId],
        args: argsArray[i]
      });
    }
    return opListToTree(opList);
  }
  executeOpTree(opTree) {
    for (const opTreeElement of opTree) {
      const fn = opTreeElement.fn;
      const fnId = opTreeElement.fnId;
      const args = opTreeElement.args;
      switch (fnId | 0) {
        case _util.OPS.beginText:
          this.beginText();
          break;
        case _util.OPS.dependency:
          break;
        case _util.OPS.setLeading:
          this.setLeading(args);
          break;
        case _util.OPS.setLeadingMoveText:
          this.setLeadingMoveText(args[0], args[1]);
          break;
        case _util.OPS.setFont:
          this.setFont(args);
          break;
        case _util.OPS.showText:
          this.showText(args[0]);
          break;
        case _util.OPS.showSpacedText:
          this.showText(args[0]);
          break;
        case _util.OPS.endText:
          this.endText();
          break;
        case _util.OPS.moveText:
          this.moveText(args[0], args[1]);
          break;
        case _util.OPS.setCharSpacing:
          this.setCharSpacing(args[0]);
          break;
        case _util.OPS.setWordSpacing:
          this.setWordSpacing(args[0]);
          break;
        case _util.OPS.setHScale:
          this.setHScale(args[0]);
          break;
        case _util.OPS.setTextMatrix:
          this.setTextMatrix(args[0], args[1], args[2], args[3], args[4], args[5]);
          break;
        case _util.OPS.setTextRise:
          this.setTextRise(args[0]);
          break;
        case _util.OPS.setTextRenderingMode:
          this.setTextRenderingMode(args[0]);
          break;
        case _util.OPS.setLineWidth:
          this.setLineWidth(args[0]);
          break;
        case _util.OPS.setLineJoin:
          this.setLineJoin(args[0]);
          break;
        case _util.OPS.setLineCap:
          this.setLineCap(args[0]);
          break;
        case _util.OPS.setMiterLimit:
          this.setMiterLimit(args[0]);
          break;
        case _util.OPS.setFillRGBColor:
          this.setFillRGBColor(args[0], args[1], args[2]);
          break;
        case _util.OPS.setStrokeRGBColor:
          this.setStrokeRGBColor(args[0], args[1], args[2]);
          break;
        case _util.OPS.setStrokeColorN:
          this.setStrokeColorN(args);
          break;
        case _util.OPS.setFillColorN:
          this.setFillColorN(args);
          break;
        case _util.OPS.shadingFill:
          this.shadingFill(args[0]);
          break;
        case _util.OPS.setDash:
          this.setDash(args[0], args[1]);
          break;
        case _util.OPS.setRenderingIntent:
          this.setRenderingIntent(args[0]);
          break;
        case _util.OPS.setFlatness:
          this.setFlatness(args[0]);
          break;
        case _util.OPS.setGState:
          this.setGState(args[0]);
          break;
        case _util.OPS.fill:
          this.fill();
          break;
        case _util.OPS.eoFill:
          this.eoFill();
          break;
        case _util.OPS.stroke:
          this.stroke();
          break;
        case _util.OPS.fillStroke:
          this.fillStroke();
          break;
        case _util.OPS.eoFillStroke:
          this.eoFillStroke();
          break;
        case _util.OPS.clip:
          this.clip("nonzero");
          break;
        case _util.OPS.eoClip:
          this.clip("evenodd");
          break;
        case _util.OPS.paintSolidColorImageMask:
          this.paintSolidColorImageMask();
          break;
        case _util.OPS.paintImageXObject:
          this.paintImageXObject(args[0]);
          break;
        case _util.OPS.paintInlineImageXObject:
          this.paintInlineImageXObject(args[0]);
          break;
        case _util.OPS.paintImageMaskXObject:
          this.paintImageMaskXObject(args[0]);
          break;
        case _util.OPS.paintFormXObjectBegin:
          this.paintFormXObjectBegin(args[0], args[1]);
          break;
        case _util.OPS.paintFormXObjectEnd:
          this.paintFormXObjectEnd();
          break;
        case _util.OPS.closePath:
          this.closePath();
          break;
        case _util.OPS.closeStroke:
          this.closeStroke();
          break;
        case _util.OPS.closeFillStroke:
          this.closeFillStroke();
          break;
        case _util.OPS.closeEOFillStroke:
          this.closeEOFillStroke();
          break;
        case _util.OPS.nextLine:
          this.nextLine();
          break;
        case _util.OPS.transform:
          this.transform(args[0], args[1], args[2], args[3], args[4], args[5]);
          break;
        case _util.OPS.constructPath:
          this.constructPath(args[0], args[1]);
          break;
        case _util.OPS.endPath:
          this.endPath();
          break;
        case 92:
          this.group(opTreeElement.items);
          break;
        default:
          (0, _util.warn)(`Unimplemented operator ${fn}`);
          break;
      }
    }
  }
  setWordSpacing(wordSpacing) {
    this.current.wordSpacing = wordSpacing;
  }
  setCharSpacing(charSpacing) {
    this.current.charSpacing = charSpacing;
  }
  nextLine() {
    this.moveText(0, this.current.leading);
  }
  setTextMatrix(a, b, c, d, e, f) {
    const current = this.current;
    current.textMatrix = current.lineMatrix = [a, b, c, d, e, f];
    current.textMatrixScale = Math.hypot(a, b);
    current.x = current.lineX = 0;
    current.y = current.lineY = 0;
    current.xcoords = [];
    current.ycoords = [];
    current.tspan = this.svgFactory.createElement("svg:tspan");
    current.tspan.setAttributeNS(null, "font-family", current.fontFamily);
    current.tspan.setAttributeNS(null, "font-size", `${pf(current.fontSize)}px`);
    current.tspan.setAttributeNS(null, "y", pf(-current.y));
    current.txtElement = this.svgFactory.createElement("svg:text");
    current.txtElement.append(current.tspan);
  }
  beginText() {
    const current = this.current;
    current.x = current.lineX = 0;
    current.y = current.lineY = 0;
    current.textMatrix = _util.IDENTITY_MATRIX;
    current.lineMatrix = _util.IDENTITY_MATRIX;
    current.textMatrixScale = 1;
    current.tspan = this.svgFactory.createElement("svg:tspan");
    current.txtElement = this.svgFactory.createElement("svg:text");
    current.txtgrp = this.svgFactory.createElement("svg:g");
    current.xcoords = [];
    current.ycoords = [];
  }
  moveText(x, y) {
    const current = this.current;
    current.x = current.lineX += x;
    current.y = current.lineY += y;
    current.xcoords = [];
    current.ycoords = [];
    current.tspan = this.svgFactory.createElement("svg:tspan");
    current.tspan.setAttributeNS(null, "font-family", current.fontFamily);
    current.tspan.setAttributeNS(null, "font-size", `${pf(current.fontSize)}px`);
    current.tspan.setAttributeNS(null, "y", pf(-current.y));
  }
  showText(glyphs) {
    const current = this.current;
    const font = current.font;
    const fontSize = current.fontSize;
    if (fontSize === 0) {
      return;
    }
    const fontSizeScale = current.fontSizeScale;
    const charSpacing = current.charSpacing;
    const wordSpacing = current.wordSpacing;
    const fontDirection = current.fontDirection;
    const textHScale = current.textHScale * fontDirection;
    const vertical = font.vertical;
    const spacingDir = vertical ? 1 : -1;
    const defaultVMetrics = font.defaultVMetrics;
    const widthAdvanceScale = fontSize * current.fontMatrix[0];
    let x = 0;
    for (const glyph of glyphs) {
      if (glyph === null) {
        x += fontDirection * wordSpacing;
        continue;
      } else if (typeof glyph === "number") {
        x += spacingDir * glyph * fontSize / 1000;
        continue;
      }
      const spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing;
      const character = glyph.fontChar;
      let scaledX, scaledY;
      let width = glyph.width;
      if (vertical) {
        let vx;
        const vmetric = glyph.vmetric || defaultVMetrics;
        vx = glyph.vmetric ? vmetric[1] : width * 0.5;
        vx = -vx * widthAdvanceScale;
        const vy = vmetric[2] * widthAdvanceScale;
        width = vmetric ? -vmetric[0] : width;
        scaledX = vx / fontSizeScale;
        scaledY = (x + vy) / fontSizeScale;
      } else {
        scaledX = x / fontSizeScale;
        scaledY = 0;
      }
      if (glyph.isInFont || font.missingFile) {
        current.xcoords.push(current.x + scaledX);
        if (vertical) {
          current.ycoords.push(-current.y + scaledY);
        }
        current.tspan.textContent += character;
      } else {}
      const charWidth = vertical ? width * widthAdvanceScale - spacing * fontDirection : width * widthAdvanceScale + spacing * fontDirection;
      x += charWidth;
    }
    current.tspan.setAttributeNS(null, "x", current.xcoords.map(pf).join(" "));
    if (vertical) {
      current.tspan.setAttributeNS(null, "y", current.ycoords.map(pf).join(" "));
    } else {
      current.tspan.setAttributeNS(null, "y", pf(-current.y));
    }
    if (vertical) {
      current.y -= x;
    } else {
      current.x += x * textHScale;
    }
    current.tspan.setAttributeNS(null, "font-family", current.fontFamily);
    current.tspan.setAttributeNS(null, "font-size", `${pf(current.fontSize)}px`);
    if (current.fontStyle !== SVG_DEFAULTS.fontStyle) {
      current.tspan.setAttributeNS(null, "font-style", current.fontStyle);
    }
    if (current.fontWeight !== SVG_DEFAULTS.fontWeight) {
      current.tspan.setAttributeNS(null, "font-weight", current.fontWeight);
    }
    const fillStrokeMode = current.textRenderingMode & _util.TextRenderingMode.FILL_STROKE_MASK;
    if (fillStrokeMode === _util.TextRenderingMode.FILL || fillStrokeMode === _util.TextRenderingMode.FILL_STROKE) {
      if (current.fillColor !== SVG_DEFAULTS.fillColor) {
        current.tspan.setAttributeNS(null, "fill", current.fillColor);
      }
      if (current.fillAlpha < 1) {
        current.tspan.setAttributeNS(null, "fill-opacity", current.fillAlpha);
      }
    } else if (current.textRenderingMode === _util.TextRenderingMode.ADD_TO_PATH) {
      current.tspan.setAttributeNS(null, "fill", "transparent");
    } else {
      current.tspan.setAttributeNS(null, "fill", "none");
    }
    if (fillStrokeMode === _util.TextRenderingMode.STROKE || fillStrokeMode === _util.TextRenderingMode.FILL_STROKE) {
      const lineWidthScale = 1 / (current.textMatrixScale || 1);
      this._setStrokeAttributes(current.tspan, lineWidthScale);
    }
    let textMatrix = current.textMatrix;
    if (current.textRise !== 0) {
      textMatrix = textMatrix.slice();
      textMatrix[5] += current.textRise;
    }
    current.txtElement.setAttributeNS(null, "transform", `${pm(textMatrix)} scale(${pf(textHScale)}, -1)`);
    current.txtElement.setAttributeNS(XML_NS, "xml:space", "preserve");
    current.txtElement.append(current.tspan);
    current.txtgrp.append(current.txtElement);
    this._ensureTransformGroup().append(current.txtElement);
  }
  setLeadingMoveText(x, y) {
    this.setLeading(-y);
    this.moveText(x, y);
  }
  addFontStyle(fontObj) {
    if (!fontObj.data) {
      throw new Error("addFontStyle: No font data available, " + 'ensure that the "fontExtraProperties" API parameter is set.');
    }
    if (!this.cssStyle) {
      this.cssStyle = this.svgFactory.createElement("svg:style");
      this.cssStyle.setAttributeNS(null, "type", "text/css");
      this.defs.append(this.cssStyle);
    }
    const url = createObjectURL(fontObj.data, fontObj.mimetype, this.forceDataSchema);
    this.cssStyle.textContent += `@font-face { font-family: "${fontObj.loadedName}";` + ` src: url(${url}); }\n`;
  }
  setFont(details) {
    const current = this.current;
    const fontObj = this.commonObjs.get(details[0]);
    let size = details[1];
    current.font = fontObj;
    if (this.embedFonts && !fontObj.missingFile && !this.embeddedFonts[fontObj.loadedName]) {
      this.addFontStyle(fontObj);
      this.embeddedFonts[fontObj.loadedName] = fontObj;
    }
    current.fontMatrix = fontObj.fontMatrix || _util.FONT_IDENTITY_MATRIX;
    let bold = "normal";
    if (fontObj.black) {
      bold = "900";
    } else if (fontObj.bold) {
      bold = "bold";
    }
    const italic = fontObj.italic ? "italic" : "normal";
    if (size < 0) {
      size = -size;
      current.fontDirection = -1;
    } else {
      current.fontDirection = 1;
    }
    current.fontSize = size;
    current.fontFamily = fontObj.loadedName;
    current.fontWeight = bold;
    current.fontStyle = italic;
    current.tspan = this.svgFactory.createElement("svg:tspan");
    current.tspan.setAttributeNS(null, "y", pf(-current.y));
    current.xcoords = [];
    current.ycoords = [];
  }
  endText() {
    const current = this.current;
    if (current.textRenderingMode & _util.TextRenderingMode.ADD_TO_PATH_FLAG && current.txtElement?.hasChildNodes()) {
      current.element = current.txtElement;
      this.clip("nonzero");
      this.endPath();
    }
  }
  setLineWidth(width) {
    if (width > 0) {
      this.current.lineWidth = width;
    }
  }
  setLineCap(style) {
    this.current.lineCap = LINE_CAP_STYLES[style];
  }
  setLineJoin(style) {
    this.current.lineJoin = LINE_JOIN_STYLES[style];
  }
  setMiterLimit(limit) {
    this.current.miterLimit = limit;
  }
  setStrokeAlpha(strokeAlpha) {
    this.current.strokeAlpha = strokeAlpha;
  }
  setStrokeRGBColor(r, g, b) {
    this.current.strokeColor = _util.Util.makeHexColor(r, g, b);
  }
  setFillAlpha(fillAlpha) {
    this.current.fillAlpha = fillAlpha;
  }
  setFillRGBColor(r, g, b) {
    this.current.fillColor = _util.Util.makeHexColor(r, g, b);
    this.current.tspan = this.svgFactory.createElement("svg:tspan");
    this.current.xcoords = [];
    this.current.ycoords = [];
  }
  setStrokeColorN(args) {
    this.current.strokeColor = this._makeColorN_Pattern(args);
  }
  setFillColorN(args) {
    this.current.fillColor = this._makeColorN_Pattern(args);
  }
  shadingFill(args) {
    const {
      width,
      height
    } = this.viewport;
    const inv = _util.Util.inverseTransform(this.transformMatrix);
    const [x0, y0, x1, y1] = _util.Util.getAxialAlignedBoundingBox([0, 0, width, height], inv);
    const rect = this.svgFactory.createElement("svg:rect");
    rect.setAttributeNS(null, "x", x0);
    rect.setAttributeNS(null, "y", y0);
    rect.setAttributeNS(null, "width", x1 - x0);
    rect.setAttributeNS(null, "height", y1 - y0);
    rect.setAttributeNS(null, "fill", this._makeShadingPattern(args));
    if (this.current.fillAlpha < 1) {
      rect.setAttributeNS(null, "fill-opacity", this.current.fillAlpha);
    }
    this._ensureTransformGroup().append(rect);
  }
  _makeColorN_Pattern(args) {
    if (args[0] === "TilingPattern") {
      return this._makeTilingPattern(args);
    }
    return this._makeShadingPattern(args);
  }
  _makeTilingPattern(args) {
    const color = args[1];
    const operatorList = args[2];
    const matrix = args[3] || _util.IDENTITY_MATRIX;
    const [x0, y0, x1, y1] = args[4];
    const xstep = args[5];
    const ystep = args[6];
    const paintType = args[7];
    const tilingId = `shading${shadingCount++}`;
    const [tx0, ty0, tx1, ty1] = _util.Util.normalizeRect([..._util.Util.applyTransform([x0, y0], matrix), ..._util.Util.applyTransform([x1, y1], matrix)]);
    const [xscale, yscale] = _util.Util.singularValueDecompose2dScale(matrix);
    const txstep = xstep * xscale;
    const tystep = ystep * yscale;
    const tiling = this.svgFactory.createElement("svg:pattern");
    tiling.setAttributeNS(null, "id", tilingId);
    tiling.setAttributeNS(null, "patternUnits", "userSpaceOnUse");
    tiling.setAttributeNS(null, "width", txstep);
    tiling.setAttributeNS(null, "height", tystep);
    tiling.setAttributeNS(null, "x", `${tx0}`);
    tiling.setAttributeNS(null, "y", `${ty0}`);
    const svg = this.svg;
    const transformMatrix = this.transformMatrix;
    const fillColor = this.current.fillColor;
    const strokeColor = this.current.strokeColor;
    const bbox = this.svgFactory.create(tx1 - tx0, ty1 - ty0);
    this.svg = bbox;
    this.transformMatrix = matrix;
    if (paintType === 2) {
      const cssColor = _util.Util.makeHexColor(...color);
      this.current.fillColor = cssColor;
      this.current.strokeColor = cssColor;
    }
    this.executeOpTree(this.convertOpList(operatorList));
    this.svg = svg;
    this.transformMatrix = transformMatrix;
    this.current.fillColor = fillColor;
    this.current.strokeColor = strokeColor;
    tiling.append(bbox.childNodes[0]);
    this.defs.append(tiling);
    return `url(#${tilingId})`;
  }
  _makeShadingPattern(args) {
    if (typeof args === "string") {
      args = this.objs.get(args);
    }
    switch (args[0]) {
      case "RadialAxial":
        const shadingId = `shading${shadingCount++}`;
        const colorStops = args[3];
        let gradient;
        switch (args[1]) {
          case "axial":
            const point0 = args[4];
            const point1 = args[5];
            gradient = this.svgFactory.createElement("svg:linearGradient");
            gradient.setAttributeNS(null, "id", shadingId);
            gradient.setAttributeNS(null, "gradientUnits", "userSpaceOnUse");
            gradient.setAttributeNS(null, "x1", point0[0]);
            gradient.setAttributeNS(null, "y1", point0[1]);
            gradient.setAttributeNS(null, "x2", point1[0]);
            gradient.setAttributeNS(null, "y2", point1[1]);
            break;
          case "radial":
            const focalPoint = args[4];
            const circlePoint = args[5];
            const focalRadius = args[6];
            const circleRadius = args[7];
            gradient = this.svgFactory.createElement("svg:radialGradient");
            gradient.setAttributeNS(null, "id", shadingId);
            gradient.setAttributeNS(null, "gradientUnits", "userSpaceOnUse");
            gradient.setAttributeNS(null, "cx", circlePoint[0]);
            gradient.setAttributeNS(null, "cy", circlePoint[1]);
            gradient.setAttributeNS(null, "r", circleRadius);
            gradient.setAttributeNS(null, "fx", focalPoint[0]);
            gradient.setAttributeNS(null, "fy", focalPoint[1]);
            gradient.setAttributeNS(null, "fr", focalRadius);
            break;
          default:
            throw new Error(`Unknown RadialAxial type: ${args[1]}`);
        }
        for (const colorStop of colorStops) {
          const stop = this.svgFactory.createElement("svg:stop");
          stop.setAttributeNS(null, "offset", colorStop[0]);
          stop.setAttributeNS(null, "stop-color", colorStop[1]);
          gradient.append(stop);
        }
        this.defs.append(gradient);
        return `url(#${shadingId})`;
      case "Mesh":
        (0, _util.warn)("Unimplemented pattern Mesh");
        return null;
      case "Dummy":
        return "hotpink";
      default:
        throw new Error(`Unknown IR type: ${args[0]}`);
    }
  }
  setDash(dashArray, dashPhase) {
    this.current.dashArray = dashArray;
    this.current.dashPhase = dashPhase;
  }
  constructPath(ops, args) {
    const current = this.current;
    let x = current.x,
      y = current.y;
    let d = [];
    let j = 0;
    for (const op of ops) {
      switch (op | 0) {
        case _util.OPS.rectangle:
          x = args[j++];
          y = args[j++];
          const width = args[j++];
          const height = args[j++];
          const xw = x + width;
          const yh = y + height;
          d.push("M", pf(x), pf(y), "L", pf(xw), pf(y), "L", pf(xw), pf(yh), "L", pf(x), pf(yh), "Z");
          break;
        case _util.OPS.moveTo:
          x = args[j++];
          y = args[j++];
          d.push("M", pf(x), pf(y));
          break;
        case _util.OPS.lineTo:
          x = args[j++];
          y = args[j++];
          d.push("L", pf(x), pf(y));
          break;
        case _util.OPS.curveTo:
          x = args[j + 4];
          y = args[j + 5];
          d.push("C", pf(args[j]), pf(args[j + 1]), pf(args[j + 2]), pf(args[j + 3]), pf(x), pf(y));
          j += 6;
          break;
        case _util.OPS.curveTo2:
          d.push("C", pf(x), pf(y), pf(args[j]), pf(args[j + 1]), pf(args[j + 2]), pf(args[j + 3]));
          x = args[j + 2];
          y = args[j + 3];
          j += 4;
          break;
        case _util.OPS.curveTo3:
          x = args[j + 2];
          y = args[j + 3];
          d.push("C", pf(args[j]), pf(args[j + 1]), pf(x), pf(y), pf(x), pf(y));
          j += 4;
          break;
        case _util.OPS.closePath:
          d.push("Z");
          break;
      }
    }
    d = d.join(" ");
    if (current.path && ops.length > 0 && ops[0] !== _util.OPS.rectangle && ops[0] !== _util.OPS.moveTo) {
      d = current.path.getAttributeNS(null, "d") + d;
    } else {
      current.path = this.svgFactory.createElement("svg:path");
      this._ensureTransformGroup().append(current.path);
    }
    current.path.setAttributeNS(null, "d", d);
    current.path.setAttributeNS(null, "fill", "none");
    current.element = current.path;
    current.setCurrentPoint(x, y);
  }
  endPath() {
    const current = this.current;
    current.path = null;
    if (!this.pendingClip) {
      return;
    }
    if (!current.element) {
      this.pendingClip = null;
      return;
    }
    const clipId = `clippath${clipCount++}`;
    const clipPath = this.svgFactory.createElement("svg:clipPath");
    clipPath.setAttributeNS(null, "id", clipId);
    clipPath.setAttributeNS(null, "transform", pm(this.transformMatrix));
    const clipElement = current.element.cloneNode(true);
    if (this.pendingClip === "evenodd") {
      clipElement.setAttributeNS(null, "clip-rule", "evenodd");
    } else {
      clipElement.setAttributeNS(null, "clip-rule", "nonzero");
    }
    this.pendingClip = null;
    clipPath.append(clipElement);
    this.defs.append(clipPath);
    if (current.activeClipUrl) {
      current.clipGroup = null;
      for (const prev of this.extraStack) {
        prev.clipGroup = null;
      }
      clipPath.setAttributeNS(null, "clip-path", current.activeClipUrl);
    }
    current.activeClipUrl = `url(#${clipId})`;
    this.tgrp = null;
  }
  clip(type) {
    this.pendingClip = type;
  }
  closePath() {
    const current = this.current;
    if (current.path) {
      const d = `${current.path.getAttributeNS(null, "d")}Z`;
      current.path.setAttributeNS(null, "d", d);
    }
  }
  setLeading(leading) {
    this.current.leading = -leading;
  }
  setTextRise(textRise) {
    this.current.textRise = textRise;
  }
  setTextRenderingMode(textRenderingMode) {
    this.current.textRenderingMode = textRenderingMode;
  }
  setHScale(scale) {
    this.current.textHScale = scale / 100;
  }
  setRenderingIntent(intent) {}
  setFlatness(flatness) {}
  setGState(states) {
    for (const [key, value] of states) {
      switch (key) {
        case "LW":
          this.setLineWidth(value);
          break;
        case "LC":
          this.setLineCap(value);
          break;
        case "LJ":
          this.setLineJoin(value);
          break;
        case "ML":
          this.setMiterLimit(value);
          break;
        case "D":
          this.setDash(value[0], value[1]);
          break;
        case "RI":
          this.setRenderingIntent(value);
          break;
        case "FL":
          this.setFlatness(value);
          break;
        case "Font":
          this.setFont(value);
          break;
        case "CA":
          this.setStrokeAlpha(value);
          break;
        case "ca":
          this.setFillAlpha(value);
          break;
        default:
          (0, _util.warn)(`Unimplemented graphic state operator ${key}`);
          break;
      }
    }
  }
  fill() {
    const current = this.current;
    if (current.element) {
      current.element.setAttributeNS(null, "fill", current.fillColor);
      current.element.setAttributeNS(null, "fill-opacity", current.fillAlpha);
      this.endPath();
    }
  }
  stroke() {
    const current = this.current;
    if (current.element) {
      this._setStrokeAttributes(current.element);
      current.element.setAttributeNS(null, "fill", "none");
      this.endPath();
    }
  }
  _setStrokeAttributes(element, lineWidthScale = 1) {
    const current = this.current;
    let dashArray = current.dashArray;
    if (lineWidthScale !== 1 && dashArray.length > 0) {
      dashArray = dashArray.map(function (value) {
        return lineWidthScale * value;
      });
    }
    element.setAttributeNS(null, "stroke", current.strokeColor);
    element.setAttributeNS(null, "stroke-opacity", current.strokeAlpha);
    element.setAttributeNS(null, "stroke-miterlimit", pf(current.miterLimit));
    element.setAttributeNS(null, "stroke-linecap", current.lineCap);
    element.setAttributeNS(null, "stroke-linejoin", current.lineJoin);
    element.setAttributeNS(null, "stroke-width", pf(lineWidthScale * current.lineWidth) + "px");
    element.setAttributeNS(null, "stroke-dasharray", dashArray.map(pf).join(" "));
    element.setAttributeNS(null, "stroke-dashoffset", pf(lineWidthScale * current.dashPhase) + "px");
  }
  eoFill() {
    this.current.element?.setAttributeNS(null, "fill-rule", "evenodd");
    this.fill();
  }
  fillStroke() {
    this.stroke();
    this.fill();
  }
  eoFillStroke() {
    this.current.element?.setAttributeNS(null, "fill-rule", "evenodd");
    this.fillStroke();
  }
  closeStroke() {
    this.closePath();
    this.stroke();
  }
  closeFillStroke() {
    this.closePath();
    this.fillStroke();
  }
  closeEOFillStroke() {
    this.closePath();
    this.eoFillStroke();
  }
  paintSolidColorImageMask() {
    const rect = this.svgFactory.createElement("svg:rect");
    rect.setAttributeNS(null, "x", "0");
    rect.setAttributeNS(null, "y", "0");
    rect.setAttributeNS(null, "width", "1px");
    rect.setAttributeNS(null, "height", "1px");
    rect.setAttributeNS(null, "fill", this.current.fillColor);
    this._ensureTransformGroup().append(rect);
  }
  paintImageXObject(objId) {
    const imgData = this.getObject(objId);
    if (!imgData) {
      (0, _util.warn)(`Dependent image with object ID ${objId} is not ready yet`);
      return;
    }
    this.paintInlineImageXObject(imgData);
  }
  paintInlineImageXObject(imgData, mask) {
    const width = imgData.width;
    const height = imgData.height;
    const imgSrc = convertImgDataToPng(imgData, this.forceDataSchema, !!mask);
    const cliprect = this.svgFactory.createElement("svg:rect");
    cliprect.setAttributeNS(null, "x", "0");
    cliprect.setAttributeNS(null, "y", "0");
    cliprect.setAttributeNS(null, "width", pf(width));
    cliprect.setAttributeNS(null, "height", pf(height));
    this.current.element = cliprect;
    this.clip("nonzero");
    const imgEl = this.svgFactory.createElement("svg:image");
    imgEl.setAttributeNS(XLINK_NS, "xlink:href", imgSrc);
    imgEl.setAttributeNS(null, "x", "0");
    imgEl.setAttributeNS(null, "y", pf(-height));
    imgEl.setAttributeNS(null, "width", pf(width) + "px");
    imgEl.setAttributeNS(null, "height", pf(height) + "px");
    imgEl.setAttributeNS(null, "transform", `scale(${pf(1 / width)} ${pf(-1 / height)})`);
    if (mask) {
      mask.append(imgEl);
    } else {
      this._ensureTransformGroup().append(imgEl);
    }
  }
  paintImageMaskXObject(img) {
    const imgData = this.getObject(img.data, img);
    if (imgData.bitmap) {
      (0, _util.warn)("paintImageMaskXObject: ImageBitmap support is not implemented, " + "ensure that the `isOffscreenCanvasSupported` API parameter is disabled.");
      return;
    }
    const current = this.current;
    const width = imgData.width;
    const height = imgData.height;
    const fillColor = current.fillColor;
    current.maskId = `mask${maskCount++}`;
    const mask = this.svgFactory.createElement("svg:mask");
    mask.setAttributeNS(null, "id", current.maskId);
    const rect = this.svgFactory.createElement("svg:rect");
    rect.setAttributeNS(null, "x", "0");
    rect.setAttributeNS(null, "y", "0");
    rect.setAttributeNS(null, "width", pf(width));
    rect.setAttributeNS(null, "height", pf(height));
    rect.setAttributeNS(null, "fill", fillColor);
    rect.setAttributeNS(null, "mask", `url(#${current.maskId})`);
    this.defs.append(mask);
    this._ensureTransformGroup().append(rect);
    this.paintInlineImageXObject(imgData, mask);
  }
  paintFormXObjectBegin(matrix, bbox) {
    if (Array.isArray(matrix) && matrix.length === 6) {
      this.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
    }
    if (bbox) {
      const width = bbox[2] - bbox[0];
      const height = bbox[3] - bbox[1];
      const cliprect = this.svgFactory.createElement("svg:rect");
      cliprect.setAttributeNS(null, "x", bbox[0]);
      cliprect.setAttributeNS(null, "y", bbox[1]);
      cliprect.setAttributeNS(null, "width", pf(width));
      cliprect.setAttributeNS(null, "height", pf(height));
      this.current.element = cliprect;
      this.clip("nonzero");
      this.endPath();
    }
  }
  paintFormXObjectEnd() {}
  _initialize(viewport) {
    const svg = this.svgFactory.create(viewport.width, viewport.height);
    const definitions = this.svgFactory.createElement("svg:defs");
    svg.append(definitions);
    this.defs = definitions;
    const rootGroup = this.svgFactory.createElement("svg:g");
    rootGroup.setAttributeNS(null, "transform", pm(viewport.transform));
    svg.append(rootGroup);
    this.svg = rootGroup;
    return svg;
  }
  _ensureClipGroup() {
    if (!this.current.clipGroup) {
      const clipGroup = this.svgFactory.createElement("svg:g");
      clipGroup.setAttributeNS(null, "clip-path", this.current.activeClipUrl);
      this.svg.append(clipGroup);
      this.current.clipGroup = clipGroup;
    }
    return this.current.clipGroup;
  }
  _ensureTransformGroup() {
    if (!this.tgrp) {
      this.tgrp = this.svgFactory.createElement("svg:g");
      this.tgrp.setAttributeNS(null, "transform", pm(this.transformMatrix));
      if (this.current.activeClipUrl) {
        this._ensureClipGroup().append(this.tgrp);
      } else {
        this.svg.append(this.tgrp);
      }
    }
    return this.tgrp;
  }
}
exports.SVGGraphics = SVGGraphics;

/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, exports) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.XfaText = void 0;
class XfaText {
  static textContent(xfa) {
    const items = [];
    const output = {
      items,
      styles: Object.create(null)
    };
    function walk(node) {
      if (!node) {
        return;
      }
      let str = null;
      const name = node.name;
      if (name === "#text") {
        str = node.value;
      } else if (!XfaText.shouldBuildText(name)) {
        return;
      } else if (node?.attributes?.textContent) {
        str = node.attributes.textContent;
      } else if (node.value) {
        str = node.value;
      }
      if (str !== null) {
        items.push({
          str
        });
      }
      if (!node.children) {
        return;
      }
      for (const child of node.children) {
        walk(child);
      }
    }
    walk(xfa);
    return output;
  }
  static shouldBuildText(name) {
    return !(name === "textarea" || name === "input" || name === "option" || name === "select");
  }
}
exports.XfaText = XfaText;

/***/ }),
/* 26 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.TextLayerRenderTask = void 0;
exports.renderTextLayer = renderTextLayer;
exports.updateTextLayer = updateTextLayer;
var _util = __w_pdfjs_require__(1);
var _display_utils = __w_pdfjs_require__(6);
const MAX_TEXT_DIVS_TO_RENDER = 100000;
const DEFAULT_FONT_SIZE = 30;
const DEFAULT_FONT_ASCENT = 0.8;
const ascentCache = new Map();
function getCtx(size, isOffscreenCanvasSupported) {
  let ctx;
  if (isOffscreenCanvasSupported && _util.FeatureTest.isOffscreenCanvasSupported) {
    ctx = new OffscreenCanvas(size, size).getContext("2d", {
      alpha: false
    });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    ctx = canvas.getContext("2d", {
      alpha: false
    });
  }
  return ctx;
}
function getAscent(fontFamily, isOffscreenCanvasSupported) {
  const cachedAscent = ascentCache.get(fontFamily);
  if (cachedAscent) {
    return cachedAscent;
  }
  const ctx = getCtx(DEFAULT_FONT_SIZE, isOffscreenCanvasSupported);
  ctx.font = `${DEFAULT_FONT_SIZE}px ${fontFamily}`;
  const metrics = ctx.measureText("");
  let ascent = metrics.fontBoundingBoxAscent;
  let descent = Math.abs(metrics.fontBoundingBoxDescent);
  if (ascent) {
    const ratio = ascent / (ascent + descent);
    ascentCache.set(fontFamily, ratio);
    ctx.canvas.width = ctx.canvas.height = 0;
    return ratio;
  }
  ctx.strokeStyle = "red";
  ctx.clearRect(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE);
  ctx.strokeText("g", 0, 0);
  let pixels = ctx.getImageData(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE).data;
  descent = 0;
  for (let i = pixels.length - 1 - 3; i >= 0; i -= 4) {
    if (pixels[i] > 0) {
      descent = Math.ceil(i / 4 / DEFAULT_FONT_SIZE);
      break;
    }
  }
  ctx.clearRect(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE);
  ctx.strokeText("A", 0, DEFAULT_FONT_SIZE);
  pixels = ctx.getImageData(0, 0, DEFAULT_FONT_SIZE, DEFAULT_FONT_SIZE).data;
  ascent = 0;
  for (let i = 0, ii = pixels.length; i < ii; i += 4) {
    if (pixels[i] > 0) {
      ascent = DEFAULT_FONT_SIZE - Math.floor(i / 4 / DEFAULT_FONT_SIZE);
      break;
    }
  }
  ctx.canvas.width = ctx.canvas.height = 0;
  if (ascent) {
    const ratio = ascent / (ascent + descent);
    ascentCache.set(fontFamily, ratio);
    return ratio;
  }
  ascentCache.set(fontFamily, DEFAULT_FONT_ASCENT);
  return DEFAULT_FONT_ASCENT;
}
function appendText(task, geom, styles) {
  const textDiv = document.createElement("span");
  const textDivProperties = {
    angle: 0,
    canvasWidth: 0,
    hasText: geom.str !== "",
    hasEOL: geom.hasEOL,
    fontSize: 0
  };
  task._textDivs.push(textDiv);
  const tx = _util.Util.transform(task._transform, geom.transform);
  let angle = Math.atan2(tx[1], tx[0]);
  const style = styles[geom.fontName];
  if (style.vertical) {
    angle += Math.PI / 2;
  }
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const fontAscent = fontHeight * getAscent(style.fontFamily, task._isOffscreenCanvasSupported);
  let left, top;
  if (angle === 0) {
    left = tx[4];
    top = tx[5] - fontAscent;
  } else {
    left = tx[4] + fontAscent * Math.sin(angle);
    top = tx[5] - fontAscent * Math.cos(angle);
  }
  const scaleFactorStr = "calc(var(--scale-factor)*";
  const divStyle = textDiv.style;
  if (task._container === task._rootContainer) {
    divStyle.left = `${(100 * left / task._pageWidth).toFixed(2)}%`;
    divStyle.top = `${(100 * top / task._pageHeight).toFixed(2)}%`;
  } else {
    divStyle.left = `${scaleFactorStr}${left.toFixed(2)}px)`;
    divStyle.top = `${scaleFactorStr}${top.toFixed(2)}px)`;
  }
  divStyle.fontSize = `${scaleFactorStr}${fontHeight.toFixed(2)}px)`;
  divStyle.fontFamily = style.fontFamily;
  textDivProperties.fontSize = fontHeight;
  textDiv.setAttribute("role", "presentation");
  textDiv.textContent = geom.str;
  textDiv.dir = geom.dir;
  if (task._fontInspectorEnabled) {
    textDiv.dataset.fontName = geom.fontName;
  }
  if (angle !== 0) {
    textDivProperties.angle = angle * (180 / Math.PI);
  }
  let shouldScaleText = false;
  if (geom.str.length > 1) {
    shouldScaleText = true;
  } else if (geom.str !== " " && geom.transform[0] !== geom.transform[3]) {
    const absScaleX = Math.abs(geom.transform[0]),
      absScaleY = Math.abs(geom.transform[3]);
    if (absScaleX !== absScaleY && Math.max(absScaleX, absScaleY) / Math.min(absScaleX, absScaleY) > 1.5) {
      shouldScaleText = true;
    }
  }
  if (shouldScaleText) {
    textDivProperties.canvasWidth = style.vertical ? geom.height : geom.width;
  }
  task._textDivProperties.set(textDiv, textDivProperties);
  if (task._isReadableStream) {
    task._layoutText(textDiv);
  }
}
function layout(params) {
  const {
    div,
    scale,
    properties,
    ctx,
    prevFontSize,
    prevFontFamily
  } = params;
  const {
    style
  } = div;
  let transform = "";
  if (properties.canvasWidth !== 0 && properties.hasText) {
    const {
      fontFamily
    } = style;
    const {
      canvasWidth,
      fontSize
    } = properties;
    if (prevFontSize !== fontSize || prevFontFamily !== fontFamily) {
      ctx.font = `${fontSize * scale}px ${fontFamily}`;
      params.prevFontSize = fontSize;
      params.prevFontFamily = fontFamily;
    }
    const {
      width
    } = ctx.measureText(div.textContent);
    if (width > 0) {
      transform = `scaleX(${canvasWidth * scale / width})`;
    }
  }
  if (properties.angle !== 0) {
    transform = `rotate(${properties.angle}deg) ${transform}`;
  }
  if (transform.length > 0) {
    style.transform = transform;
  }
}
function render(task) {
  if (task._canceled) {
    return;
  }
  const textDivs = task._textDivs;
  const capability = task._capability;
  const textDivsLength = textDivs.length;
  if (textDivsLength > MAX_TEXT_DIVS_TO_RENDER) {
    capability.resolve();
    return;
  }
  if (!task._isReadableStream) {
    for (const textDiv of textDivs) {
      task._layoutText(textDiv);
    }
  }
  capability.resolve();
}
class TextLayerRenderTask {
  constructor({
    textContentSource,
    container,
    viewport,
    textDivs,
    textDivProperties,
    textContentItemsStr,
    isOffscreenCanvasSupported
  }) {
    this._textContentSource = textContentSource;
    this._isReadableStream = textContentSource instanceof ReadableStream;
    this._container = this._rootContainer = container;
    this._textDivs = textDivs || [];
    this._textContentItemsStr = textContentItemsStr || [];
    this._isOffscreenCanvasSupported = isOffscreenCanvasSupported;
    this._fontInspectorEnabled = !!globalThis.FontInspector?.enabled;
    this._reader = null;
    this._textDivProperties = textDivProperties || new WeakMap();
    this._canceled = false;
    this._capability = new _util.PromiseCapability();
    this._layoutTextParams = {
      prevFontSize: null,
      prevFontFamily: null,
      div: null,
      scale: viewport.scale * (globalThis.devicePixelRatio || 1),
      properties: null,
      ctx: getCtx(0, isOffscreenCanvasSupported)
    };
    const {
      pageWidth,
      pageHeight,
      pageX,
      pageY
    } = viewport.rawDims;
    this._transform = [1, 0, 0, -1, -pageX, pageY + pageHeight];
    this._pageWidth = pageWidth;
    this._pageHeight = pageHeight;
    (0, _display_utils.setLayerDimensions)(container, viewport);
    this._capability.promise.finally(() => {
      this._layoutTextParams = null;
    }).catch(() => {});
  }
  get promise() {
    return this._capability.promise;
  }
  cancel() {
    this._canceled = true;
    if (this._reader) {
      this._reader.cancel(new _util.AbortException("TextLayer task cancelled.")).catch(() => {});
      this._reader = null;
    }
    this._capability.reject(new _util.AbortException("TextLayer task cancelled."));
  }
  _processItems(items, styleCache) {
    for (const item of items) {
      if (item.str === undefined) {
        if (item.type === "beginMarkedContentProps" || item.type === "beginMarkedContent") {
          const parent = this._container;
          this._container = document.createElement("span");
          this._container.classList.add("markedContent");
          if (item.id !== null) {
            this._container.setAttribute("id", `${item.id}`);
          }
          parent.append(this._container);
        } else if (item.type === "endMarkedContent") {
          this._container = this._container.parentNode;
        }
        continue;
      }
      this._textContentItemsStr.push(item.str);
      appendText(this, item, styleCache);
    }
  }
  _layoutText(textDiv) {
    const textDivProperties = this._layoutTextParams.properties = this._textDivProperties.get(textDiv);
    this._layoutTextParams.div = textDiv;
    layout(this._layoutTextParams);
    if (textDivProperties.hasText) {
      this._container.append(textDiv);
    }
    if (textDivProperties.hasEOL) {
      const br = document.createElement("br");
      br.setAttribute("role", "presentation");
      this._container.append(br);
    }
  }
  _render() {
    const capability = new _util.PromiseCapability();
    let styleCache = Object.create(null);
    if (this._isReadableStream) {
      const pump = () => {
        this._reader.read().then(({
          value,
          done
        }) => {
          if (done) {
            capability.resolve();
            return;
          }
          Object.assign(styleCache, value.styles);
          this._processItems(value.items, styleCache);
          pump();
        }, capability.reject);
      };
      this._reader = this._textContentSource.getReader();
      pump();
    } else if (this._textContentSource) {
      const {
        items,
        styles
      } = this._textContentSource;
      this._processItems(items, styles);
      capability.resolve();
    } else {
      throw new Error('No "textContentSource" parameter specified.');
    }
    capability.promise.then(() => {
      styleCache = null;
      render(this);
    }, this._capability.reject);
  }
}
exports.TextLayerRenderTask = TextLayerRenderTask;
function renderTextLayer(params) {
  if (!params.textContentSource && (params.textContent || params.textContentStream)) {
    (0, _display_utils.deprecated)("The TextLayerRender `textContent`/`textContentStream` parameters " + "will be removed in the future, please use `textContentSource` instead.");
    params.textContentSource = params.textContent || params.textContentStream;
  }
  const {
    container,
    viewport
  } = params;
  const style = getComputedStyle(container);
  const visibility = style.getPropertyValue("visibility");
  const scaleFactor = parseFloat(style.getPropertyValue("--scale-factor"));
  if (visibility === "visible" && (!scaleFactor || Math.abs(scaleFactor - viewport.scale) > 1e-5)) {
    console.error("The `--scale-factor` CSS-variable must be set, " + "to the same value as `viewport.scale`, " + "either on the `container`-element itself or higher up in the DOM.");
  }
  const task = new TextLayerRenderTask(params);
  task._render();
  return task;
}
function updateTextLayer({
  container,
  viewport,
  textDivs,
  textDivProperties,
  isOffscreenCanvasSupported,
  mustRotate = true,
  mustRescale = true
}) {
  if (mustRotate) {
    (0, _display_utils.setLayerDimensions)(container, {
      rotation: viewport.rotation
    });
  }
  if (mustRescale) {
    const ctx = getCtx(0, isOffscreenCanvasSupported);
    const scale = viewport.scale * (globalThis.devicePixelRatio || 1);
    const params = {
      prevFontSize: null,
      prevFontFamily: null,
      div: null,
      scale,
      properties: null,
      ctx
    };
    for (const div of textDivs) {
      params.properties = textDivProperties.get(div);
      params.div = div;
      layout(params);
    }
  }
}

/***/ }),
/* 27 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.AnnotationEditorLayer = void 0;
var _util = __w_pdfjs_require__(1);
var _editor = __w_pdfjs_require__(4);
var _freetext = __w_pdfjs_require__(28);
var _ink = __w_pdfjs_require__(33);
var _display_utils = __w_pdfjs_require__(6);
var _stamp = __w_pdfjs_require__(34);
class AnnotationEditorLayer {
  #accessibilityManager;
  #allowClick = false;
  #annotationLayer = null;
  #boundPointerup = this.pointerup.bind(this);
  #boundPointerdown = this.pointerdown.bind(this);
  #editors = new Map();
  #hadPointerDown = false;
  #isCleaningUp = false;
  #isDisabling = false;
  #uiManager;
  static _initialized = false;
  constructor({
    uiManager,
    pageIndex,
    div,
    accessibilityManager,
    annotationLayer,
    viewport,
    l10n
  }) {
    const editorTypes = [_freetext.FreeTextEditor, _ink.InkEditor, _stamp.StampEditor];
    if (!AnnotationEditorLayer._initialized) {
      AnnotationEditorLayer._initialized = true;
      for (const editorType of editorTypes) {
        editorType.initialize(l10n);
      }
    }
    uiManager.registerEditorTypes(editorTypes);
    this.#uiManager = uiManager;
    this.pageIndex = pageIndex;
    this.div = div;
    this.#accessibilityManager = accessibilityManager;
    this.#annotationLayer = annotationLayer;
    this.viewport = viewport;
    this.#uiManager.addLayer(this);
  }
  get isEmpty() {
    return this.#editors.size === 0;
  }
  updateToolbar(mode) {
    this.#uiManager.updateToolbar(mode);
  }
  updateMode(mode = this.#uiManager.getMode()) {
    this.#cleanup();
    if (mode === _util.AnnotationEditorType.INK) {
      this.addInkEditorIfNeeded(false);
      this.disableClick();
    } else {
      this.enableClick();
    }
    if (mode !== _util.AnnotationEditorType.NONE) {
      this.div.classList.toggle("freeTextEditing", mode === _util.AnnotationEditorType.FREETEXT);
      this.div.classList.toggle("inkEditing", mode === _util.AnnotationEditorType.INK);
      this.div.classList.toggle("stampEditing", mode === _util.AnnotationEditorType.STAMP);
      this.div.hidden = false;
    }
  }
  addInkEditorIfNeeded(isCommitting) {
    if (!isCommitting && this.#uiManager.getMode() !== _util.AnnotationEditorType.INK) {
      return;
    }
    if (!isCommitting) {
      for (const editor of this.#editors.values()) {
        if (editor.isEmpty()) {
          editor.setInBackground();
          return;
        }
      }
    }
    const editor = this.#createAndAddNewEditor({
      offsetX: 0,
      offsetY: 0
    }, false);
    editor.setInBackground();
  }
  setEditingState(isEditing) {
    this.#uiManager.setEditingState(isEditing);
  }
  addCommands(params) {
    this.#uiManager.addCommands(params);
  }
  enable() {
    this.div.style.pointerEvents = "auto";
    const annotationElementIds = new Set();
    for (const editor of this.#editors.values()) {
      editor.enableEditing();
      if (editor.annotationElementId) {
        annotationElementIds.add(editor.annotationElementId);
      }
    }
    if (!this.#annotationLayer) {
      return;
    }
    const editables = this.#annotationLayer.getEditableAnnotations();
    for (const editable of editables) {
      editable.hide();
      if (this.#uiManager.isDeletedAnnotationElement(editable.data.id)) {
        continue;
      }
      if (annotationElementIds.has(editable.data.id)) {
        continue;
      }
      const editor = this.deserialize(editable);
      if (!editor) {
        continue;
      }
      this.addOrRebuild(editor);
      editor.enableEditing();
    }
  }
  disable() {
    this.#isDisabling = true;
    this.div.style.pointerEvents = "none";
    const hiddenAnnotationIds = new Set();
    for (const editor of this.#editors.values()) {
      editor.disableEditing();
      if (!editor.annotationElementId || editor.serialize() !== null) {
        hiddenAnnotationIds.add(editor.annotationElementId);
        continue;
      }
      this.getEditableAnnotation(editor.annotationElementId)?.show();
      editor.remove();
    }
    if (this.#annotationLayer) {
      const editables = this.#annotationLayer.getEditableAnnotations();
      for (const editable of editables) {
        const {
          id
        } = editable.data;
        if (hiddenAnnotationIds.has(id) || this.#uiManager.isDeletedAnnotationElement(id)) {
          continue;
        }
        editable.show();
      }
    }
    this.#cleanup();
    if (this.isEmpty) {
      this.div.hidden = true;
    }
    this.#isDisabling = false;
  }
  getEditableAnnotation(id) {
    return this.#annotationLayer?.getEditableAnnotation(id) || null;
  }
  setActiveEditor(editor) {
    const currentActive = this.#uiManager.getActive();
    if (currentActive === editor) {
      return;
    }
    this.#uiManager.setActiveEditor(editor);
  }
  enableClick() {
    this.div.addEventListener("pointerdown", this.#boundPointerdown);
    this.div.addEventListener("pointerup", this.#boundPointerup);
  }
  disableClick() {
    this.div.removeEventListener("pointerdown", this.#boundPointerdown);
    this.div.removeEventListener("pointerup", this.#boundPointerup);
  }
  attach(editor) {
    this.#editors.set(editor.id, editor);
    const {
      annotationElementId
    } = editor;
    if (annotationElementId && this.#uiManager.isDeletedAnnotationElement(annotationElementId)) {
      this.#uiManager.removeDeletedAnnotationElement(editor);
    }
  }
  detach(editor) {
    this.#editors.delete(editor.id);
    this.#accessibilityManager?.removePointerInTextLayer(editor.contentDiv);
    if (!this.#isDisabling && editor.annotationElementId) {
      this.#uiManager.addDeletedAnnotationElement(editor);
    }
  }
  remove(editor) {
    this.detach(editor);
    this.#uiManager.removeEditor(editor);
    if (editor.div.contains(document.activeElement)) {
      setTimeout(() => {
        this.#uiManager.focusMainContainer();
      }, 0);
    }
    editor.div.remove();
    editor.isAttachedToDOM = false;
    if (!this.#isCleaningUp) {
      this.addInkEditorIfNeeded(false);
    }
  }
  changeParent(editor) {
    if (editor.parent === this) {
      return;
    }
    if (editor.annotationElementId) {
      this.#uiManager.addDeletedAnnotationElement(editor.annotationElementId);
      _editor.AnnotationEditor.deleteAnnotationElement(editor);
      editor.annotationElementId = null;
    }
    this.attach(editor);
    editor.parent?.detach(editor);
    editor.setParent(this);
    if (editor.div && editor.isAttachedToDOM) {
      editor.div.remove();
      this.div.append(editor.div);
    }
  }
  add(editor) {
    this.changeParent(editor);
    this.#uiManager.addEditor(editor);
    this.attach(editor);
    if (!editor.isAttachedToDOM) {
      const div = editor.render();
      this.div.append(div);
      editor.isAttachedToDOM = true;
    }
    editor.fixAndSetPosition();
    editor.onceAdded();
    this.#uiManager.addToAnnotationStorage(editor);
  }
  moveEditorInDOM(editor) {
    if (!editor.isAttachedToDOM) {
      return;
    }
    const {
      activeElement
    } = document;
    if (editor.div.contains(activeElement)) {
      editor._focusEventsAllowed = false;
      setTimeout(() => {
        if (!editor.div.contains(document.activeElement)) {
          editor.div.addEventListener("focusin", () => {
            editor._focusEventsAllowed = true;
          }, {
            once: true
          });
          activeElement.focus();
        } else {
          editor._focusEventsAllowed = true;
        }
      }, 0);
    }
    editor._structTreeParentId = this.#accessibilityManager?.moveElementInDOM(this.div, editor.div, editor.contentDiv, true);
  }
  addOrRebuild(editor) {
    if (editor.needsToBeRebuilt()) {
      editor.rebuild();
    } else {
      this.add(editor);
    }
  }
  addUndoableEditor(editor) {
    const cmd = () => editor._uiManager.rebuild(editor);
    const undo = () => {
      editor.remove();
    };
    this.addCommands({
      cmd,
      undo,
      mustExec: false
    });
  }
  getNextId() {
    return this.#uiManager.getId();
  }
  #createNewEditor(params) {
    switch (this.#uiManager.getMode()) {
      case _util.AnnotationEditorType.FREETEXT:
        return new _freetext.FreeTextEditor(params);
      case _util.AnnotationEditorType.INK:
        return new _ink.InkEditor(params);
      case _util.AnnotationEditorType.STAMP:
        return new _stamp.StampEditor(params);
    }
    return null;
  }
  pasteEditor(mode, params) {
    this.#uiManager.updateToolbar(mode);
    this.#uiManager.updateMode(mode);
    const {
      offsetX,
      offsetY
    } = this.#getCenterPoint();
    const id = this.getNextId();
    const editor = this.#createNewEditor({
      parent: this,
      id,
      x: offsetX,
      y: offsetY,
      uiManager: this.#uiManager,
      isCentered: true,
      ...params
    });
    if (editor) {
      this.add(editor);
    }
  }
  deserialize(data) {
    switch (data.annotationType ?? data.annotationEditorType) {
      case _util.AnnotationEditorType.FREETEXT:
        return _freetext.FreeTextEditor.deserialize(data, this, this.#uiManager);
      case _util.AnnotationEditorType.INK:
        return _ink.InkEditor.deserialize(data, this, this.#uiManager);
      case _util.AnnotationEditorType.STAMP:
        return _stamp.StampEditor.deserialize(data, this, this.#uiManager);
    }
    return null;
  }
  #createAndAddNewEditor(event, isCentered) {
    const id = this.getNextId();
    const editor = this.#createNewEditor({
      parent: this,
      id,
      x: event.offsetX,
      y: event.offsetY,
      uiManager: this.#uiManager,
      isCentered
    });
    if (editor) {
      this.add(editor);
    }
    return editor;
  }
  #getCenterPoint() {
    const {
      x,
      y,
      width,
      height
    } = this.div.getBoundingClientRect();
    const tlX = Math.max(0, x);
    const tlY = Math.max(0, y);
    const brX = Math.min(window.innerWidth, x + width);
    const brY = Math.min(window.innerHeight, y + height);
    const centerX = (tlX + brX) / 2 - x;
    const centerY = (tlY + brY) / 2 - y;
    const [offsetX, offsetY] = this.viewport.rotation % 180 === 0 ? [centerX, centerY] : [centerY, centerX];
    return {
      offsetX,
      offsetY
    };
  }
  addNewEditor() {
    this.#createAndAddNewEditor(this.#getCenterPoint(), true);
  }
  setSelected(editor) {
    this.#uiManager.setSelected(editor);
  }
  toggleSelected(editor) {
    this.#uiManager.toggleSelected(editor);
  }
  isSelected(editor) {
    return this.#uiManager.isSelected(editor);
  }
  unselect(editor) {
    this.#uiManager.unselect(editor);
  }
  pointerup(event) {
    const {
      isMac
    } = _util.FeatureTest.platform;
    if (event.button !== 0 || event.ctrlKey && isMac) {
      return;
    }
    if (event.target !== this.div) {
      return;
    }
    if (!this.#hadPointerDown) {
      return;
    }
    this.#hadPointerDown = false;
    if (!this.#allowClick) {
      this.#allowClick = true;
      return;
    }
    if (this.#uiManager.getMode() === _util.AnnotationEditorType.STAMP) {
      this.#uiManager.unselectAll();
      return;
    }
    this.#createAndAddNewEditor(event, false);
  }
  pointerdown(event) {
    if (this.#hadPointerDown) {
      this.#hadPointerDown = false;
      return;
    }
    const {
      isMac
    } = _util.FeatureTest.platform;
    if (event.button !== 0 || event.ctrlKey && isMac) {
      return;
    }
    if (event.target !== this.div) {
      return;
    }
    this.#hadPointerDown = true;
    const editor = this.#uiManager.getActive();
    this.#allowClick = !editor || editor.isEmpty();
  }
  findNewParent(editor, x, y) {
    const layer = this.#uiManager.findParent(x, y);
    if (layer === null || layer === this) {
      return false;
    }
    layer.changeParent(editor);
    return true;
  }
  destroy() {
    if (this.#uiManager.getActive()?.parent === this) {
      this.#uiManager.commitOrRemove();
      this.#uiManager.setActiveEditor(null);
    }
    for (const editor of this.#editors.values()) {
      this.#accessibilityManager?.removePointerInTextLayer(editor.contentDiv);
      editor.setParent(null);
      editor.isAttachedToDOM = false;
      editor.div.remove();
    }
    this.div = null;
    this.#editors.clear();
    this.#uiManager.removeLayer(this);
  }
  #cleanup() {
    this.#isCleaningUp = true;
    for (const editor of this.#editors.values()) {
      if (editor.isEmpty()) {
        editor.remove();
      }
    }
    this.#isCleaningUp = false;
  }
  render({
    viewport
  }) {
    this.viewport = viewport;
    (0, _display_utils.setLayerDimensions)(this.div, viewport);
    for (const editor of this.#uiManager.getEditors(this.pageIndex)) {
      this.add(editor);
    }
    this.updateMode();
  }
  update({
    viewport
  }) {
    this.#uiManager.commitOrRemove();
    this.viewport = viewport;
    (0, _display_utils.setLayerDimensions)(this.div, {
      rotation: viewport.rotation
    });
    this.updateMode();
  }
  get pageDimensions() {
    const {
      pageWidth,
      pageHeight
    } = this.viewport.rawDims;
    return [pageWidth, pageHeight];
  }
}
exports.AnnotationEditorLayer = AnnotationEditorLayer;

/***/ }),
/* 28 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.FreeTextEditor = void 0;
var _util = __w_pdfjs_require__(1);
var _tools = __w_pdfjs_require__(5);
var _editor = __w_pdfjs_require__(4);
var _annotation_layer = __w_pdfjs_require__(29);
class FreeTextEditor extends _editor.AnnotationEditor {
  #boundEditorDivBlur = this.editorDivBlur.bind(this);
  #boundEditorDivFocus = this.editorDivFocus.bind(this);
  #boundEditorDivInput = this.editorDivInput.bind(this);
  #boundEditorDivKeydown = this.editorDivKeydown.bind(this);
  #color;
  #content = "";
  #editorDivId = `${this.id}-editor`;
  #fontSize;
  #initialData = null;
  static _freeTextDefaultContent = "";
  static _internalPadding = 0;
  static _defaultColor = null;
  static _defaultFontSize = 10;
  static get _keyboardManager() {
    const proto = FreeTextEditor.prototype;
    const arrowChecker = self => self.isEmpty();
    const small = _tools.AnnotationEditorUIManager.TRANSLATE_SMALL;
    const big = _tools.AnnotationEditorUIManager.TRANSLATE_BIG;
    return (0, _util.shadow)(this, "_keyboardManager", new _tools.KeyboardManager([[["ctrl+s", "mac+meta+s", "ctrl+p", "mac+meta+p"], proto.commitOrRemove, {
      bubbles: true
    }], [["ctrl+Enter", "mac+meta+Enter", "Escape", "mac+Escape"], proto.commitOrRemove], [["ArrowLeft", "mac+ArrowLeft"], proto._translateEmpty, {
      args: [-small, 0],
      checker: arrowChecker
    }], [["ctrl+ArrowLeft", "mac+shift+ArrowLeft"], proto._translateEmpty, {
      args: [-big, 0],
      checker: arrowChecker
    }], [["ArrowRight", "mac+ArrowRight"], proto._translateEmpty, {
      args: [small, 0],
      checker: arrowChecker
    }], [["ctrl+ArrowRight", "mac+shift+ArrowRight"], proto._translateEmpty, {
      args: [big, 0],
      checker: arrowChecker
    }], [["ArrowUp", "mac+ArrowUp"], proto._translateEmpty, {
      args: [0, -small],
      checker: arrowChecker
    }], [["ctrl+ArrowUp", "mac+shift+ArrowUp"], proto._translateEmpty, {
      args: [0, -big],
      checker: arrowChecker
    }], [["ArrowDown", "mac+ArrowDown"], proto._translateEmpty, {
      args: [0, small],
      checker: arrowChecker
    }], [["ctrl+ArrowDown", "mac+shift+ArrowDown"], proto._translateEmpty, {
      args: [0, big],
      checker: arrowChecker
    }]]));
  }
  static _type = "freetext";
  constructor(params) {
    super({
      ...params,
      name: "freeTextEditor"
    });
    this.#color = params.color || FreeTextEditor._defaultColor || _editor.AnnotationEditor._defaultLineColor;
    this.#fontSize = params.fontSize || FreeTextEditor._defaultFontSize;
  }
  static initialize(l10n) {
    _editor.AnnotationEditor.initialize(l10n, {
      strings: ["free_text2_default_content", "editor_free_text2_aria_label"]
    });
    const style = getComputedStyle(document.documentElement);
    this._internalPadding = parseFloat(style.getPropertyValue("--freetext-padding"));
  }
  static updateDefaultParams(type, value) {
    switch (type) {
      case _util.AnnotationEditorParamsType.FREETEXT_SIZE:
        FreeTextEditor._defaultFontSize = value;
        break;
      case _util.AnnotationEditorParamsType.FREETEXT_COLOR:
        FreeTextEditor._defaultColor = value;
        break;
    }
  }
  updateParams(type, value) {
    switch (type) {
      case _util.AnnotationEditorParamsType.FREETEXT_SIZE:
        this.#updateFontSize(value);
        break;
      case _util.AnnotationEditorParamsType.FREETEXT_COLOR:
        this.#updateColor(value);
        break;
    }
  }
  static get defaultPropertiesToUpdate() {
    return [[_util.AnnotationEditorParamsType.FREETEXT_SIZE, FreeTextEditor._defaultFontSize], [_util.AnnotationEditorParamsType.FREETEXT_COLOR, FreeTextEditor._defaultColor || _editor.AnnotationEditor._defaultLineColor]];
  }
  get propertiesToUpdate() {
    return [[_util.AnnotationEditorParamsType.FREETEXT_SIZE, this.#fontSize], [_util.AnnotationEditorParamsType.FREETEXT_COLOR, this.#color]];
  }
  #updateFontSize(fontSize) {
    const setFontsize = size => {
      this.editorDiv.style.fontSize = `calc(${size}px * var(--scale-factor))`;
      this.translate(0, -(size - this.#fontSize) * this.parentScale);
      this.#fontSize = size;
      this.#setEditorDimensions();
    };
    const savedFontsize = this.#fontSize;
    this.addCommands({
      cmd: () => {
        setFontsize(fontSize);
      },
      undo: () => {
        setFontsize(savedFontsize);
      },
      mustExec: true,
      type: _util.AnnotationEditorParamsType.FREETEXT_SIZE,
      overwriteIfSameType: true,
      keepUndo: true
    });
  }
  #updateColor(color) {
    const savedColor = this.#color;
    this.addCommands({
      cmd: () => {
        this.#color = this.editorDiv.style.color = color;
      },
      undo: () => {
        this.#color = this.editorDiv.style.color = savedColor;
      },
      mustExec: true,
      type: _util.AnnotationEditorParamsType.FREETEXT_COLOR,
      overwriteIfSameType: true,
      keepUndo: true
    });
  }
  _translateEmpty(x, y) {
    this._uiManager.translateSelectedEditors(x, y, true);
  }
  getInitialTranslation() {
    const scale = this.parentScale;
    return [-FreeTextEditor._internalPadding * scale, -(FreeTextEditor._internalPadding + this.#fontSize) * scale];
  }
  rebuild() {
    if (!this.parent) {
      return;
    }
    super.rebuild();
    if (this.div === null) {
      return;
    }
    if (!this.isAttachedToDOM) {
      this.parent.add(this);
    }
  }
  enableEditMode() {
    if (this.isInEditMode()) {
      return;
    }
    this.parent.setEditingState(false);
    this.parent.updateToolbar(_util.AnnotationEditorType.FREETEXT);
    super.enableEditMode();
    this.overlayDiv.classList.remove("enabled");
    this.editorDiv.contentEditable = true;
    this._isDraggable = false;
    this.div.removeAttribute("aria-activedescendant");
    this.editorDiv.addEventListener("keydown", this.#boundEditorDivKeydown);
    this.editorDiv.addEventListener("focus", this.#boundEditorDivFocus);
    this.editorDiv.addEventListener("blur", this.#boundEditorDivBlur);
    this.editorDiv.addEventListener("input", this.#boundEditorDivInput);
  }
  disableEditMode() {
    if (!this.isInEditMode()) {
      return;
    }
    this.parent.setEditingState(true);
    super.disableEditMode();
    this.overlayDiv.classList.add("enabled");
    this.editorDiv.contentEditable = false;
    this.div.setAttribute("aria-activedescendant", this.#editorDivId);
    this._isDraggable = true;
    this.editorDiv.removeEventListener("keydown", this.#boundEditorDivKeydown);
    this.editorDiv.removeEventListener("focus", this.#boundEditorDivFocus);
    this.editorDiv.removeEventListener("blur", this.#boundEditorDivBlur);
    this.editorDiv.removeEventListener("input", this.#boundEditorDivInput);
    this.div.focus({
      preventScroll: true
    });
    this.isEditing = false;
    this.parent.div.classList.add("freeTextEditing");
  }
  focusin(event) {
    if (!this._focusEventsAllowed) {
      return;
    }
    super.focusin(event);
    if (event.target !== this.editorDiv) {
      this.editorDiv.focus();
    }
  }
  onceAdded() {
    if (this.width) {
      this.#cheatInitialRect();
      return;
    }
    this.enableEditMode();
    this.editorDiv.focus();
    if (this._initialOptions?.isCentered) {
      this.center();
    }
    this._initialOptions = null;
  }
  isEmpty() {
    return !this.editorDiv || this.editorDiv.innerText.trim() === "";
  }
  remove() {
    this.isEditing = false;
    if (this.parent) {
      this.parent.setEditingState(true);
      this.parent.div.classList.add("freeTextEditing");
    }
    super.remove();
  }
  #extractText() {
    const divs = this.editorDiv.getElementsByTagName("div");
    if (divs.length === 0) {
      return this.editorDiv.innerText;
    }
    const buffer = [];
    for (const div of divs) {
      buffer.push(div.innerText.replace(/\r\n?|\n/, ""));
    }
    return buffer.join("\n");
  }
  #setEditorDimensions() {
    const [parentWidth, parentHeight] = this.parentDimensions;
    let rect;
    if (this.isAttachedToDOM) {
      rect = this.div.getBoundingClientRect();
    } else {
      const {
        currentLayer,
        div
      } = this;
      const savedDisplay = div.style.display;
      div.style.display = "hidden";
      currentLayer.div.append(this.div);
      rect = div.getBoundingClientRect();
      div.remove();
      div.style.display = savedDisplay;
    }
    if (this.rotation % 180 === this.parentRotation % 180) {
      this.width = rect.width / parentWidth;
      this.height = rect.height / parentHeight;
    } else {
      this.width = rect.height / parentWidth;
      this.height = rect.width / parentHeight;
    }
    this.fixAndSetPosition();
  }
  commit() {
    if (!this.isInEditMode()) {
      return;
    }
    super.commit();
    this.disableEditMode();
    const savedText = this.#content;
    const newText = this.#content = this.#extractText().trimEnd();
    if (savedText === newText) {
      return;
    }
    const setText = text => {
      this.#content = text;
      if (!text) {
        this.remove();
        return;
      }
      this.#setContent();
      this._uiManager.rebuild(this);
      this.#setEditorDimensions();
    };
    this.addCommands({
      cmd: () => {
        setText(newText);
      },
      undo: () => {
        setText(savedText);
      },
      mustExec: false
    });
    this.#setEditorDimensions();
  }
  shouldGetKeyboardEvents() {
    return this.isInEditMode();
  }
  enterInEditMode() {
    this.enableEditMode();
    this.editorDiv.focus();
  }
  dblclick(event) {
    this.enterInEditMode();
  }
  keydown(event) {
    if (event.target === this.div && event.key === "Enter") {
      this.enterInEditMode();
      event.preventDefault();
    }
  }
  editorDivKeydown(event) {
    FreeTextEditor._keyboardManager.exec(this, event);
  }
  editorDivFocus(event) {
    this.isEditing = true;
  }
  editorDivBlur(event) {
    this.isEditing = false;
  }
  editorDivInput(event) {
    this.parent.div.classList.toggle("freeTextEditing", this.isEmpty());
  }
  disableEditing() {
    this.editorDiv.setAttribute("role", "comment");
    this.editorDiv.removeAttribute("aria-multiline");
  }
  enableEditing() {
    this.editorDiv.setAttribute("role", "textbox");
    this.editorDiv.setAttribute("aria-multiline", true);
  }
  render() {
    if (this.div) {
      return this.div;
    }
    let baseX, baseY;
    if (this.width) {
      baseX = this.x;
      baseY = this.y;
    }
    super.render();
    this.editorDiv = document.createElement("div");
    this.editorDiv.className = "internal";
    this.editorDiv.setAttribute("id", this.#editorDivId);
    this.enableEditing();
    _editor.AnnotationEditor._l10nPromise.get("editor_free_text2_aria_label").then(msg => this.editorDiv?.setAttribute("aria-label", msg));
    _editor.AnnotationEditor._l10nPromise.get("free_text2_default_content").then(msg => this.editorDiv?.setAttribute("default-content", msg));
    this.editorDiv.contentEditable = true;
    const {
      style
    } = this.editorDiv;
    style.fontSize = `calc(${this.#fontSize}px * var(--scale-factor))`;
    style.color = this.#color;
    this.div.append(this.editorDiv);
    this.overlayDiv = document.createElement("div");
    this.overlayDiv.classList.add("overlay", "enabled");
    this.div.append(this.overlayDiv);
    (0, _tools.bindEvents)(this, this.div, ["dblclick", "keydown"]);
    if (this.width) {
      const [parentWidth, parentHeight] = this.parentDimensions;
      if (this.annotationElementId) {
        const {
          position
        } = this.#initialData;
        let [tx, ty] = this.getInitialTranslation();
        [tx, ty] = this.pageTranslationToScreen(tx, ty);
        const [pageWidth, pageHeight] = this.pageDimensions;
        const [pageX, pageY] = this.pageTranslation;
        let posX, posY;
        switch (this.rotation) {
          case 0:
            posX = baseX + (position[0] - pageX) / pageWidth;
            posY = baseY + this.height - (position[1] - pageY) / pageHeight;
            break;
          case 90:
            posX = baseX + (position[0] - pageX) / pageWidth;
            posY = baseY - (position[1] - pageY) / pageHeight;
            [tx, ty] = [ty, -tx];
            break;
          case 180:
            posX = baseX - this.width + (position[0] - pageX) / pageWidth;
            posY = baseY - (position[1] - pageY) / pageHeight;
            [tx, ty] = [-tx, -ty];
            break;
          case 270:
            posX = baseX + (position[0] - pageX - this.height * pageHeight) / pageWidth;
            posY = baseY + (position[1] - pageY - this.width * pageWidth) / pageHeight;
            [tx, ty] = [-ty, tx];
            break;
        }
        this.setAt(posX * parentWidth, posY * parentHeight, tx, ty);
      } else {
        this.setAt(baseX * parentWidth, baseY * parentHeight, this.width * parentWidth, this.height * parentHeight);
      }
      this.#setContent();
      this._isDraggable = true;
      this.editorDiv.contentEditable = false;
    } else {
      this._isDraggable = false;
      this.editorDiv.contentEditable = true;
    }
    return this.div;
  }
  #setContent() {
    this.editorDiv.replaceChildren();
    if (!this.#content) {
      return;
    }
    for (const line of this.#content.split("\n")) {
      const div = document.createElement("div");
      div.append(line ? document.createTextNode(line) : document.createElement("br"));
      this.editorDiv.append(div);
    }
  }
  get contentDiv() {
    return this.editorDiv;
  }
  static deserialize(data, parent, uiManager) {
    let initialData = null;
    if (data instanceof _annotation_layer.FreeTextAnnotationElement) {
      const {
        data: {
          defaultAppearanceData: {
            fontSize,
            fontColor
          },
          rect,
          rotation,
          id
        },
        textContent,
        textPosition,
        parent: {
          page: {
            pageNumber
          }
        }
      } = data;
      if (!textContent || textContent.length === 0) {
        return null;
      }
      initialData = data = {
        annotationType: _util.AnnotationEditorType.FREETEXT,
        color: Array.from(fontColor),
        fontSize,
        value: textContent.join("\n"),
        position: textPosition,
        pageIndex: pageNumber - 1,
        rect,
        rotation,
        id,
        deleted: false
      };
    }
    const editor = super.deserialize(data, parent, uiManager);
    editor.#fontSize = data.fontSize;
    editor.#color = _util.Util.makeHexColor(...data.color);
    editor.#content = data.value;
    editor.annotationElementId = data.id || null;
    editor.#initialData = initialData;
    return editor;
  }
  serialize(isForCopying = false) {
    if (this.isEmpty()) {
      return null;
    }
    if (this.deleted) {
      return {
        pageIndex: this.pageIndex,
        id: this.annotationElementId,
        deleted: true
      };
    }
    const padding = FreeTextEditor._internalPadding * this.parentScale;
    const rect = this.getRect(padding, padding);
    const color = _editor.AnnotationEditor._colorManager.convert(this.isAttachedToDOM ? getComputedStyle(this.editorDiv).color : this.#color);
    const serialized = {
      annotationType: _util.AnnotationEditorType.FREETEXT,
      color,
      fontSize: this.#fontSize,
      value: this.#content,
      pageIndex: this.pageIndex,
      rect,
      rotation: this.rotation,
      structTreeParentId: this._structTreeParentId
    };
    if (isForCopying) {
      return serialized;
    }
    if (this.annotationElementId && !this.#hasElementChanged(serialized)) {
      return null;
    }
    serialized.id = this.annotationElementId;
    return serialized;
  }
  #hasElementChanged(serialized) {
    const {
      value,
      fontSize,
      color,
      rect,
      pageIndex
    } = this.#initialData;
    return serialized.value !== value || serialized.fontSize !== fontSize || serialized.rect.some((x, i) => Math.abs(x - rect[i]) >= 1) || serialized.color.some((c, i) => c !== color[i]) || serialized.pageIndex !== pageIndex;
  }
  #cheatInitialRect(delayed = false) {
    if (!this.annotationElementId) {
      return;
    }
    this.#setEditorDimensions();
    if (!delayed && (this.width === 0 || this.height === 0)) {
      setTimeout(() => this.#cheatInitialRect(true), 0);
      return;
    }
    const padding = FreeTextEditor._internalPadding * this.parentScale;
    this.#initialData.rect = this.getRect(padding, padding);
  }
}
exports.FreeTextEditor = FreeTextEditor;

/***/ }),
/* 29 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.StampAnnotationElement = exports.InkAnnotationElement = exports.FreeTextAnnotationElement = exports.AnnotationLayer = void 0;
var _util = __w_pdfjs_require__(1);
var _display_utils = __w_pdfjs_require__(6);
var _annotation_storage = __w_pdfjs_require__(3);
var _scripting_utils = __w_pdfjs_require__(30);
var _displayL10n_utils = __w_pdfjs_require__(31);
var _xfa_layer = __w_pdfjs_require__(32);
const DEFAULT_TAB_INDEX = 1000;
const DEFAULT_FONT_SIZE = 9;
const GetElementsByNameSet = new WeakSet();
function getRectDims(rect) {
  return {
    width: rect[2] - rect[0],
    height: rect[3] - rect[1]
  };
}
class AnnotationElementFactory {
  static create(parameters) {
    const subtype = parameters.data.annotationType;
    switch (subtype) {
      case _util.AnnotationType.LINK:
        return new LinkAnnotationElement(parameters);
      case _util.AnnotationType.TEXT:
        return new TextAnnotationElement(parameters);
      case _util.AnnotationType.WIDGET:
        const fieldType = parameters.data.fieldType;
        switch (fieldType) {
          case "Tx":
            return new TextWidgetAnnotationElement(parameters);
          case "Btn":
            if (parameters.data.radioButton) {
              return new RadioButtonWidgetAnnotationElement(parameters);
            } else if (parameters.data.checkBox) {
              return new CheckboxWidgetAnnotationElement(parameters);
            }
            return new PushButtonWidgetAnnotationElement(parameters);
          case "Ch":
            return new ChoiceWidgetAnnotationElement(parameters);
          case "Sig":
            return new SignatureWidgetAnnotationElement(parameters);
        }
        return new WidgetAnnotationElement(parameters);
      case _util.AnnotationType.POPUP:
        return new PopupAnnotationElement(parameters);
      case _util.AnnotationType.FREETEXT:
        return new FreeTextAnnotationElement(parameters);
      case _util.AnnotationType.LINE:
        return new LineAnnotationElement(parameters);
      case _util.AnnotationType.SQUARE:
        return new SquareAnnotationElement(parameters);
      case _util.AnnotationType.CIRCLE:
        return new CircleAnnotationElement(parameters);
      case _util.AnnotationType.POLYLINE:
        return new PolylineAnnotationElement(parameters);
      case _util.AnnotationType.CARET:
        return new CaretAnnotationElement(parameters);
      case _util.AnnotationType.INK:
        return new InkAnnotationElement(parameters);
      case _util.AnnotationType.POLYGON:
        return new PolygonAnnotationElement(parameters);
      case _util.AnnotationType.HIGHLIGHT:
        return new HighlightAnnotationElement(parameters);
      case _util.AnnotationType.UNDERLINE:
        return new UnderlineAnnotationElement(parameters);
      case _util.AnnotationType.SQUIGGLY:
        return new SquigglyAnnotationElement(parameters);
      case _util.AnnotationType.STRIKEOUT:
        return new StrikeOutAnnotationElement(parameters);
      case _util.AnnotationType.STAMP:
        return new StampAnnotationElement(parameters);
      case _util.AnnotationType.FILEATTACHMENT:
        return new FileAttachmentAnnotationElement(parameters);
      default:
        return new AnnotationElement(parameters);
    }
  }
}
class AnnotationElement {
  #hasBorder = false;
  constructor(parameters, {
    isRenderable = false,
    ignoreBorder = false,
    createQuadrilaterals = false
  } = {}) {
    this.isRenderable = isRenderable;
    this.data = parameters.data;
    this.layer = parameters.layer;
    this.linkService = parameters.linkService;
    this.downloadManager = parameters.downloadManager;
    this.imageResourcesPath = parameters.imageResourcesPath;
    this.renderForms = parameters.renderForms;
    this.svgFactory = parameters.svgFactory;
    this.annotationStorage = parameters.annotationStorage;
    this.enableScripting = parameters.enableScripting;
    this.hasJSActions = parameters.hasJSActions;
    this._fieldObjects = parameters.fieldObjects;
    this.parent = parameters.parent;
    if (isRenderable) {
      this.container = this._createContainer(ignoreBorder);
    }
    if (createQuadrilaterals) {
      this._createQuadrilaterals();
    }
  }
  static _hasPopupData({
    titleObj,
    contentsObj,
    richText
  }) {
    return !!(titleObj?.str || contentsObj?.str || richText?.str);
  }
  get hasPopupData() {
    return AnnotationElement._hasPopupData(this.data);
  }
  _createContainer(ignoreBorder) {
    const {
      data,
      parent: {
        page,
        viewport
      }
    } = this;
    const container = document.createElement("section");
    container.setAttribute("data-annotation-id", data.id);
    if (!(this instanceof WidgetAnnotationElement)) {
      container.tabIndex = DEFAULT_TAB_INDEX;
    }
    container.style.zIndex = this.parent.zIndex++;
    if (this.data.popupRef) {
      container.setAttribute("aria-haspopup", "dialog");
    }
    if (data.noRotate) {
      container.classList.add("norotate");
    }
    const {
      pageWidth,
      pageHeight,
      pageX,
      pageY
    } = viewport.rawDims;
    if (!data.rect || this instanceof PopupAnnotationElement) {
      const {
        rotation
      } = data;
      if (!data.hasOwnCanvas && rotation !== 0) {
        this.setRotation(rotation, container);
      }
      return container;
    }
    const {
      width,
      height
    } = getRectDims(data.rect);
    const rect = _util.Util.normalizeRect([data.rect[0], page.view[3] - data.rect[1] + page.view[1], data.rect[2], page.view[3] - data.rect[3] + page.view[1]]);
    if (!ignoreBorder && data.borderStyle.width > 0) {
      container.style.borderWidth = `${data.borderStyle.width}px`;
      const horizontalRadius = data.borderStyle.horizontalCornerRadius;
      const verticalRadius = data.borderStyle.verticalCornerRadius;
      if (horizontalRadius > 0 || verticalRadius > 0) {
        const radius = `calc(${horizontalRadius}px * var(--scale-factor)) / calc(${verticalRadius}px * var(--scale-factor))`;
        container.style.borderRadius = radius;
      } else if (this instanceof RadioButtonWidgetAnnotationElement) {
        const radius = `calc(${width}px * var(--scale-factor)) / calc(${height}px * var(--scale-factor))`;
        container.style.borderRadius = radius;
      }
      switch (data.borderStyle.style) {
        case _util.AnnotationBorderStyleType.SOLID:
          container.style.borderStyle = "solid";
          break;
        case _util.AnnotationBorderStyleType.DASHED:
          container.style.borderStyle = "dashed";
          break;
        case _util.AnnotationBorderStyleType.BEVELED:
          (0, _util.warn)("Unimplemented border style: beveled");
          break;
        case _util.AnnotationBorderStyleType.INSET:
          (0, _util.warn)("Unimplemented border style: inset");
          break;
        case _util.AnnotationBorderStyleType.UNDERLINE:
          container.style.borderBottomStyle = "solid";
          break;
        default:
          break;
      }
      const borderColor = data.borderColor || null;
      if (borderColor) {
        this.#hasBorder = true;
        container.style.borderColor = _util.Util.makeHexColor(borderColor[0] | 0, borderColor[1] | 0, borderColor[2] | 0);
      } else {
        container.style.borderWidth = 0;
      }
    }
    container.style.left = `${100 * (rect[0] - pageX) / pageWidth}%`;
    container.style.top = `${100 * (rect[1] - pageY) / pageHeight}%`;
    const {
      rotation
    } = data;
    if (data.hasOwnCanvas || rotation === 0) {
      container.style.width = `${100 * width / pageWidth}%`;
      container.style.height = `${100 * height / pageHeight}%`;
    } else {
      this.setRotation(rotation, container);
    }
    return container;
  }
  setRotation(angle, container = this.container) {
    if (!this.data.rect) {
      return;
    }
    const {
      pageWidth,
      pageHeight
    } = this.parent.viewport.rawDims;
    const {
      width,
      height
    } = getRectDims(this.data.rect);
    let elementWidth, elementHeight;
    if (angle % 180 === 0) {
      elementWidth = 100 * width / pageWidth;
      elementHeight = 100 * height / pageHeight;
    } else {
      elementWidth = 100 * height / pageWidth;
      elementHeight = 100 * width / pageHeight;
    }
    container.style.width = `${elementWidth}%`;
    container.style.height = `${elementHeight}%`;
    container.setAttribute("data-main-rotation", (360 - angle) % 360);
  }
  get _commonActions() {
    const setColor = (jsName, styleName, event) => {
      const color = event.detail[jsName];
      const colorType = color[0];
      const colorArray = color.slice(1);
      event.target.style[styleName] = _scripting_utils.ColorConverters[`${colorType}_HTML`](colorArray);
      this.annotationStorage.setValue(this.data.id, {
        [styleName]: _scripting_utils.ColorConverters[`${colorType}_rgb`](colorArray)
      });
    };
    return (0, _util.shadow)(this, "_commonActions", {
      display: event => {
        const {
          display
        } = event.detail;
        const hidden = display % 2 === 1;
        this.container.style.visibility = hidden ? "hidden" : "visible";
        this.annotationStorage.setValue(this.data.id, {
          noView: hidden,
          noPrint: display === 1 || display === 2
        });
      },
      print: event => {
        this.annotationStorage.setValue(this.data.id, {
          noPrint: !event.detail.print
        });
      },
      hidden: event => {
        const {
          hidden
        } = event.detail;
        this.container.style.visibility = hidden ? "hidden" : "visible";
        this.annotationStorage.setValue(this.data.id, {
          noPrint: hidden,
          noView: hidden
        });
      },
      focus: event => {
        setTimeout(() => event.target.focus({
          preventScroll: false
        }), 0);
      },
      userName: event => {
        event.target.title = event.detail.userName;
      },
      readonly: event => {
        event.target.disabled = event.detail.readonly;
      },
      required: event => {
        this._setRequired(event.target, event.detail.required);
      },
      bgColor: event => {
        setColor("bgColor", "backgroundColor", event);
      },
      fillColor: event => {
        setColor("fillColor", "backgroundColor", event);
      },
      fgColor: event => {
        setColor("fgColor", "color", event);
      },
      textColor: event => {
        setColor("textColor", "color", event);
      },
      borderColor: event => {
        setColor("borderColor", "borderColor", event);
      },
      strokeColor: event => {
        setColor("strokeColor", "borderColor", event);
      },
      rotation: event => {
        const angle = event.detail.rotation;
        this.setRotation(angle);
        this.annotationStorage.setValue(this.data.id, {
          rotation: angle
        });
      }
    });
  }
  _dispatchEventFromSandbox(actions, jsEvent) {
    const commonActions = this._commonActions;
    for (const name of Object.keys(jsEvent.detail)) {
      const action = actions[name] || commonActions[name];
      action?.(jsEvent);
    }
  }
  _setDefaultPropertiesFromJS(element) {
    if (!this.enableScripting) {
      return;
    }
    const storedData = this.annotationStorage.getRawValue(this.data.id);
    if (!storedData) {
      return;
    }
    const commonActions = this._commonActions;
    for (const [actionName, detail] of Object.entries(storedData)) {
      const action = commonActions[actionName];
      if (action) {
        const eventProxy = {
          detail: {
            [actionName]: detail
          },
          target: element
        };
        action(eventProxy);
        delete storedData[actionName];
      }
    }
  }
  _createQuadrilaterals() {
    if (!this.container) {
      return;
    }
    const {
      quadPoints
    } = this.data;
    if (!quadPoints) {
      return;
    }
    const [rectBlX, rectBlY, rectTrX, rectTrY] = this.data.rect;
    if (quadPoints.length === 1) {
      const [, {
        x: trX,
        y: trY
      }, {
        x: blX,
        y: blY
      }] = quadPoints[0];
      if (rectTrX === trX && rectTrY === trY && rectBlX === blX && rectBlY === blY) {
        return;
      }
    }
    const {
      style
    } = this.container;
    let svgBuffer;
    if (this.#hasBorder) {
      const {
        borderColor,
        borderWidth
      } = style;
      style.borderWidth = 0;
      svgBuffer = ["url('data:image/svg+xml;utf8,", `<svg xmlns="http://www.w3.org/2000/svg"`, ` preserveAspectRatio="none" viewBox="0 0 1 1">`, `<g fill="transparent" stroke="${borderColor}" stroke-width="${borderWidth}">`];
      this.container.classList.add("hasBorder");
    }
    const width = rectTrX - rectBlX;
    const height = rectTrY - rectBlY;
    const {
      svgFactory
    } = this;
    const svg = svgFactory.createElement("svg");
    svg.classList.add("quadrilateralsContainer");
    svg.setAttribute("width", 0);
    svg.setAttribute("height", 0);
    const defs = svgFactory.createElement("defs");
    svg.append(defs);
    const clipPath = svgFactory.createElement("clipPath");
    const id = `clippath_${this.data.id}`;
    clipPath.setAttribute("id", id);
    clipPath.setAttribute("clipPathUnits", "objectBoundingBox");
    defs.append(clipPath);
    for (const [, {
      x: trX,
      y: trY
    }, {
      x: blX,
      y: blY
    }] of quadPoints) {
      const rect = svgFactory.createElement("rect");
      const x = (blX - rectBlX) / width;
      const y = (rectTrY - trY) / height;
      const rectWidth = (trX - blX) / width;
      const rectHeight = (trY - blY) / height;
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", rectWidth);
      rect.setAttribute("height", rectHeight);
      clipPath.append(rect);
      svgBuffer?.push(`<rect vector-effect="non-scaling-stroke" x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}"/>`);
    }
    if (this.#hasBorder) {
      svgBuffer.push(`</g></svg>')`);
      style.backgroundImage = svgBuffer.join("");
    }
    this.container.append(svg);
    this.container.style.clipPath = `url(#${id})`;
  }
  _createPopup() {
    const {
      container,
      data
    } = this;
    container.setAttribute("aria-haspopup", "dialog");
    const popup = new PopupAnnotationElement({
      data: {
        color: data.color,
        titleObj: data.titleObj,
        modificationDate: data.modificationDate,
        contentsObj: data.contentsObj,
        richText: data.richText,
        parentRect: data.rect,
        borderStyle: 0,
        id: `popup_${data.id}`,
        rotation: data.rotation
      },
      parent: this.parent,
      elements: [this]
    });
    this.parent.div.append(popup.render());
  }
  render() {
    (0, _util.unreachable)("Abstract method `AnnotationElement.render` called");
  }
  _getElementsByName(name, skipId = null) {
    const fields = [];
    if (this._fieldObjects) {
      const fieldObj = this._fieldObjects[name];
      if (fieldObj) {
        for (const {
          page,
          id,
          exportValues
        } of fieldObj) {
          if (page === -1) {
            continue;
          }
          if (id === skipId) {
            continue;
          }
          const exportValue = typeof exportValues === "string" ? exportValues : null;
          const domElement = document.querySelector(`[data-element-id="${id}"]`);
          if (domElement && !GetElementsByNameSet.has(domElement)) {
            (0, _util.warn)(`_getElementsByName - element not allowed: ${id}`);
            continue;
          }
          fields.push({
            id,
            exportValue,
            domElement
          });
        }
      }
      return fields;
    }
    for (const domElement of document.getElementsByName(name)) {
      const {
        exportValue
      } = domElement;
      const id = domElement.getAttribute("data-element-id");
      if (id === skipId) {
        continue;
      }
      if (!GetElementsByNameSet.has(domElement)) {
        continue;
      }
      fields.push({
        id,
        exportValue,
        domElement
      });
    }
    return fields;
  }
  show() {
    if (this.container) {
      this.container.hidden = false;
    }
    this.popup?.maybeShow();
  }
  hide() {
    if (this.container) {
      this.container.hidden = true;
    }
    this.popup?.forceHide();
  }
  getElementsToTriggerPopup() {
    return this.container;
  }
  addHighlightArea() {
    const triggers = this.getElementsToTriggerPopup();
    if (Array.isArray(triggers)) {
      for (const element of triggers) {
        element.classList.add("highlightArea");
      }
    } else {
      triggers.classList.add("highlightArea");
    }
  }
  _editOnDoubleClick() {
    const {
      annotationEditorType: mode,
      data: {
        id: editId
      }
    } = this;
    this.container.addEventListener("dblclick", () => {
      this.linkService.eventBus?.dispatch("switchannotationeditormode", {
        source: this,
        mode,
        editId
      });
    });
  }
}
class LinkAnnotationElement extends AnnotationElement {
  constructor(parameters, options = null) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: !!options?.ignoreBorder,
      createQuadrilaterals: true
    });
    this.isTooltipOnly = parameters.data.isTooltipOnly;
  }
  render() {
    const {
      data,
      linkService
    } = this;
    const link = document.createElement("a");
    link.setAttribute("data-element-id", data.id);
    let isBound = false;
    if (data.url) {
      linkService.addLinkAttributes(link, data.url, data.newWindow);
      isBound = true;
    } else if (data.action) {
      this._bindNamedAction(link, data.action);
      isBound = true;
    } else if (data.attachment) {
      this._bindAttachment(link, data.attachment);
      isBound = true;
    } else if (data.setOCGState) {
      this.#bindSetOCGState(link, data.setOCGState);
      isBound = true;
    } else if (data.dest) {
      this._bindLink(link, data.dest);
      isBound = true;
    } else {
      if (data.actions && (data.actions.Action || data.actions["Mouse Up"] || data.actions["Mouse Down"]) && this.enableScripting && this.hasJSActions) {
        this._bindJSAction(link, data);
        isBound = true;
      }
      if (data.resetForm) {
        this._bindResetFormAction(link, data.resetForm);
        isBound = true;
      } else if (this.isTooltipOnly && !isBound) {
        this._bindLink(link, "");
        isBound = true;
      }
    }
    this.container.classList.add("linkAnnotation");
    if (isBound) {
      this.container.append(link);
    }
    return this.container;
  }
  #setInternalLink() {
    this.container.setAttribute("data-internal-link", "");
  }
  _bindLink(link, destination) {
    link.href = this.linkService.getDestinationHash(destination);
    link.onclick = () => {
      if (destination) {
        this.linkService.goToDestination(destination);
      }
      return false;
    };
    if (destination || destination === "") {
      this.#setInternalLink();
    }
  }
  _bindNamedAction(link, action) {
    link.href = this.linkService.getAnchorUrl("");
    link.onclick = () => {
      this.linkService.executeNamedAction(action);
      return false;
    };
    this.#setInternalLink();
  }
  _bindAttachment(link, attachment) {
    link.href = this.linkService.getAnchorUrl("");
    link.onclick = () => {
      this.downloadManager?.openOrDownloadData(this.container, attachment.content, attachment.filename);
      return false;
    };
    this.#setInternalLink();
  }
  #bindSetOCGState(link, action) {
    link.href = this.linkService.getAnchorUrl("");
    link.onclick = () => {
      this.linkService.executeSetOCGState(action);
      return false;
    };
    this.#setInternalLink();
  }
  _bindJSAction(link, data) {
    link.href = this.linkService.getAnchorUrl("");
    const map = new Map([["Action", "onclick"], ["Mouse Up", "onmouseup"], ["Mouse Down", "onmousedown"]]);
    for (const name of Object.keys(data.actions)) {
      const jsName = map.get(name);
      if (!jsName) {
        continue;
      }
      link[jsName] = () => {
        this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id: data.id,
            name
          }
        });
        return false;
      };
    }
    if (!link.onclick) {
      link.onclick = () => false;
    }
    this.#setInternalLink();
  }
  _bindResetFormAction(link, resetForm) {
    const otherClickAction = link.onclick;
    if (!otherClickAction) {
      link.href = this.linkService.getAnchorUrl("");
    }
    this.#setInternalLink();
    if (!this._fieldObjects) {
      (0, _util.warn)(`_bindResetFormAction - "resetForm" action not supported, ` + "ensure that the `fieldObjects` parameter is provided.");
      if (!otherClickAction) {
        link.onclick = () => false;
      }
      return;
    }
    link.onclick = () => {
      otherClickAction?.();
      const {
        fields: resetFormFields,
        refs: resetFormRefs,
        include
      } = resetForm;
      const allFields = [];
      if (resetFormFields.length !== 0 || resetFormRefs.length !== 0) {
        const fieldIds = new Set(resetFormRefs);
        for (const fieldName of resetFormFields) {
          const fields = this._fieldObjects[fieldName] || [];
          for (const {
            id
          } of fields) {
            fieldIds.add(id);
          }
        }
        for (const fields of Object.values(this._fieldObjects)) {
          for (const field of fields) {
            if (fieldIds.has(field.id) === include) {
              allFields.push(field);
            }
          }
        }
      } else {
        for (const fields of Object.values(this._fieldObjects)) {
          allFields.push(...fields);
        }
      }
      const storage = this.annotationStorage;
      const allIds = [];
      for (const field of allFields) {
        const {
          id
        } = field;
        allIds.push(id);
        switch (field.type) {
          case "text":
            {
              const value = field.defaultValue || "";
              storage.setValue(id, {
                value
              });
              break;
            }
          case "checkbox":
          case "radiobutton":
            {
              const value = field.defaultValue === field.exportValues;
              storage.setValue(id, {
                value
              });
              break;
            }
          case "combobox":
          case "listbox":
            {
              const value = field.defaultValue || "";
              storage.setValue(id, {
                value
              });
              break;
            }
          default:
            continue;
        }
        const domElement = document.querySelector(`[data-element-id="${id}"]`);
        if (!domElement) {
          continue;
        } else if (!GetElementsByNameSet.has(domElement)) {
          (0, _util.warn)(`_bindResetFormAction - element not allowed: ${id}`);
          continue;
        }
        domElement.dispatchEvent(new Event("resetform"));
      }
      if (this.enableScripting) {
        this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id: "app",
            ids: allIds,
            name: "ResetForm"
          }
        });
      }
      return false;
    };
  }
}
class TextAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true
    });
  }
  render() {
    this.container.classList.add("textAnnotation");
    const image = document.createElement("img");
    image.src = this.imageResourcesPath + "annotation-" + this.data.name.toLowerCase() + ".svg";
    image.alt = "[{{type}} Annotation]";
    image.dataset.l10nId = "text_annotation_type";
    image.dataset.l10nArgs = JSON.stringify({
      type: this.data.name
    });
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    this.container.append(image);
    return this.container;
  }
}
class WidgetAnnotationElement extends AnnotationElement {
  render() {
    if (this.data.alternativeText) {
      this.container.title = this.data.alternativeText;
    }
    return this.container;
  }
  showElementAndHideCanvas(element) {
    if (this.data.hasOwnCanvas) {
      if (element.previousSibling?.nodeName === "CANVAS") {
        element.previousSibling.hidden = true;
      }
      element.hidden = false;
    }
  }
  _getKeyModifier(event) {
    const {
      isWin,
      isMac
    } = _util.FeatureTest.platform;
    return isWin && event.ctrlKey || isMac && event.metaKey;
  }
  _setEventListener(element, elementData, baseName, eventName, valueGetter) {
    if (baseName.includes("mouse")) {
      element.addEventListener(baseName, event => {
        this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id: this.data.id,
            name: eventName,
            value: valueGetter(event),
            shift: event.shiftKey,
            modifier: this._getKeyModifier(event)
          }
        });
      });
    } else {
      element.addEventListener(baseName, event => {
        if (baseName === "blur") {
          if (!elementData.focused || !event.relatedTarget) {
            return;
          }
          elementData.focused = false;
        } else if (baseName === "focus") {
          if (elementData.focused) {
            return;
          }
          elementData.focused = true;
        }
        if (!valueGetter) {
          return;
        }
        this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id: this.data.id,
            name: eventName,
            value: valueGetter(event)
          }
        });
      });
    }
  }
  _setEventListeners(element, elementData, names, getter) {
    for (const [baseName, eventName] of names) {
      if (eventName === "Action" || this.data.actions?.[eventName]) {
        if (eventName === "Focus" || eventName === "Blur") {
          elementData ||= {
            focused: false
          };
        }
        this._setEventListener(element, elementData, baseName, eventName, getter);
        if (eventName === "Focus" && !this.data.actions?.Blur) {
          this._setEventListener(element, elementData, "blur", "Blur", null);
        } else if (eventName === "Blur" && !this.data.actions?.Focus) {
          this._setEventListener(element, elementData, "focus", "Focus", null);
        }
      }
    }
  }
  _setBackgroundColor(element) {
    const color = this.data.backgroundColor || null;
    element.style.backgroundColor = color === null ? "transparent" : _util.Util.makeHexColor(color[0], color[1], color[2]);
  }
  _setTextStyle(element) {
    const TEXT_ALIGNMENT = ["left", "center", "right"];
    const {
      fontColor
    } = this.data.defaultAppearanceData;
    const fontSize = this.data.defaultAppearanceData.fontSize || DEFAULT_FONT_SIZE;
    const style = element.style;
    let computedFontSize;
    const BORDER_SIZE = 2;
    const roundToOneDecimal = x => Math.round(10 * x) / 10;
    if (this.data.multiLine) {
      const height = Math.abs(this.data.rect[3] - this.data.rect[1] - BORDER_SIZE);
      const numberOfLines = Math.round(height / (_util.LINE_FACTOR * fontSize)) || 1;
      const lineHeight = height / numberOfLines;
      computedFontSize = Math.min(fontSize, roundToOneDecimal(lineHeight / _util.LINE_FACTOR));
    } else {
      const height = Math.abs(this.data.rect[3] - this.data.rect[1] - BORDER_SIZE);
      computedFontSize = Math.min(fontSize, roundToOneDecimal(height / _util.LINE_FACTOR));
    }
    style.fontSize = `calc(${computedFontSize}px * var(--scale-factor))`;
    style.color = _util.Util.makeHexColor(fontColor[0], fontColor[1], fontColor[2]);
    if (this.data.textAlignment !== null) {
      style.textAlign = TEXT_ALIGNMENT[this.data.textAlignment];
    }
  }
  _setRequired(element, isRequired) {
    if (isRequired) {
      element.setAttribute("required", true);
    } else {
      element.removeAttribute("required");
    }
    element.setAttribute("aria-required", isRequired);
  }
}
class TextWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    const isRenderable = parameters.renderForms || !parameters.data.hasAppearance && !!parameters.data.fieldValue;
    super(parameters, {
      isRenderable
    });
  }
  setPropertyOnSiblings(base, key, value, keyInStorage) {
    const storage = this.annotationStorage;
    for (const element of this._getElementsByName(base.name, base.id)) {
      if (element.domElement) {
        element.domElement[key] = value;
      }
      storage.setValue(element.id, {
        [keyInStorage]: value
      });
    }
  }
  render() {
    const storage = this.annotationStorage;
    const id = this.data.id;
    this.container.classList.add("textWidgetAnnotation");
    let element = null;
    if (this.renderForms) {
      const storedData = storage.getValue(id, {
        value: this.data.fieldValue
      });
      let textContent = storedData.value || "";
      const maxLen = storage.getValue(id, {
        charLimit: this.data.maxLen
      }).charLimit;
      if (maxLen && textContent.length > maxLen) {
        textContent = textContent.slice(0, maxLen);
      }
      let fieldFormattedValues = storedData.formattedValue || this.data.textContent?.join("\n") || null;
      if (fieldFormattedValues && this.data.comb) {
        fieldFormattedValues = fieldFormattedValues.replaceAll(/\s+/g, "");
      }
      const elementData = {
        userValue: textContent,
        formattedValue: fieldFormattedValues,
        lastCommittedValue: null,
        commitKey: 1,
        focused: false
      };
      if (this.data.multiLine) {
        element = document.createElement("textarea");
        element.textContent = fieldFormattedValues ?? textContent;
        if (this.data.doNotScroll) {
          element.style.overflowY = "hidden";
        }
      } else {
        element = document.createElement("input");
        element.type = "text";
        element.setAttribute("value", fieldFormattedValues ?? textContent);
        if (this.data.doNotScroll) {
          element.style.overflowX = "hidden";
        }
      }
      if (this.data.hasOwnCanvas) {
        element.hidden = true;
      }
      GetElementsByNameSet.add(element);
      element.setAttribute("data-element-id", id);
      element.disabled = this.data.readOnly;
      element.name = this.data.fieldName;
      element.tabIndex = DEFAULT_TAB_INDEX;
      this._setRequired(element, this.data.required);
      if (maxLen) {
        element.maxLength = maxLen;
      }
      element.addEventListener("input", event => {
        storage.setValue(id, {
          value: event.target.value
        });
        this.setPropertyOnSiblings(element, "value", event.target.value, "value");
        elementData.formattedValue = null;
      });
      element.addEventListener("resetform", event => {
        const defaultValue = this.data.defaultFieldValue ?? "";
        element.value = elementData.userValue = defaultValue;
        elementData.formattedValue = null;
      });
      let blurListener = event => {
        const {
          formattedValue
        } = elementData;
        if (formattedValue !== null && formattedValue !== undefined) {
          event.target.value = formattedValue;
        }
        event.target.scrollLeft = 0;
      };
      if (this.enableScripting && this.hasJSActions) {
        element.addEventListener("focus", event => {
          if (elementData.focused) {
            return;
          }
          const {
            target
          } = event;
          if (elementData.userValue) {
            target.value = elementData.userValue;
          }
          elementData.lastCommittedValue = target.value;
          elementData.commitKey = 1;
          elementData.focused = true;
        });
        element.addEventListener("updatefromsandbox", jsEvent => {
          this.showElementAndHideCanvas(jsEvent.target);
          const actions = {
            value(event) {
              elementData.userValue = event.detail.value ?? "";
              storage.setValue(id, {
                value: elementData.userValue.toString()
              });
              event.target.value = elementData.userValue;
            },
            formattedValue(event) {
              const {
                formattedValue
              } = event.detail;
              elementData.formattedValue = formattedValue;
              if (formattedValue !== null && formattedValue !== undefined && event.target !== document.activeElement) {
                event.target.value = formattedValue;
              }
              storage.setValue(id, {
                formattedValue
              });
            },
            selRange(event) {
              event.target.setSelectionRange(...event.detail.selRange);
            },
            charLimit: event => {
              const {
                charLimit
              } = event.detail;
              const {
                target
              } = event;
              if (charLimit === 0) {
                target.removeAttribute("maxLength");
                return;
              }
              target.setAttribute("maxLength", charLimit);
              let value = elementData.userValue;
              if (!value || value.length <= charLimit) {
                return;
              }
              value = value.slice(0, charLimit);
              target.value = elementData.userValue = value;
              storage.setValue(id, {
                value
              });
              this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
                source: this,
                detail: {
                  id,
                  name: "Keystroke",
                  value,
                  willCommit: true,
                  commitKey: 1,
                  selStart: target.selectionStart,
                  selEnd: target.selectionEnd
                }
              });
            }
          };
          this._dispatchEventFromSandbox(actions, jsEvent);
        });
        element.addEventListener("keydown", event => {
          elementData.commitKey = 1;
          let commitKey = -1;
          if (event.key === "Escape") {
            commitKey = 0;
          } else if (event.key === "Enter" && !this.data.multiLine) {
            commitKey = 2;
          } else if (event.key === "Tab") {
            elementData.commitKey = 3;
          }
          if (commitKey === -1) {
            return;
          }
          const {
            value
          } = event.target;
          if (elementData.lastCommittedValue === value) {
            return;
          }
          elementData.lastCommittedValue = value;
          elementData.userValue = value;
          this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
            source: this,
            detail: {
              id,
              name: "Keystroke",
              value,
              willCommit: true,
              commitKey,
              selStart: event.target.selectionStart,
              selEnd: event.target.selectionEnd
            }
          });
        });
        const _blurListener = blurListener;
        blurListener = null;
        element.addEventListener("blur", event => {
          if (!elementData.focused || !event.relatedTarget) {
            return;
          }
          elementData.focused = false;
          const {
            value
          } = event.target;
          elementData.userValue = value;
          if (elementData.lastCommittedValue !== value) {
            this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
              source: this,
              detail: {
                id,
                name: "Keystroke",
                value,
                willCommit: true,
                commitKey: elementData.commitKey,
                selStart: event.target.selectionStart,
                selEnd: event.target.selectionEnd
              }
            });
          }
          _blurListener(event);
        });
        if (this.data.actions?.Keystroke) {
          element.addEventListener("beforeinput", event => {
            elementData.lastCommittedValue = null;
            const {
              data,
              target
            } = event;
            const {
              value,
              selectionStart,
              selectionEnd
            } = target;
            let selStart = selectionStart,
              selEnd = selectionEnd;
            switch (event.inputType) {
              case "deleteWordBackward":
                {
                  const match = value.substring(0, selectionStart).match(/\w*[^\w]*$/);
                  if (match) {
                    selStart -= match[0].length;
                  }
                  break;
                }
              case "deleteWordForward":
                {
                  const match = value.substring(selectionStart).match(/^[^\w]*\w*/);
                  if (match) {
                    selEnd += match[0].length;
                  }
                  break;
                }
              case "deleteContentBackward":
                if (selectionStart === selectionEnd) {
                  selStart -= 1;
                }
                break;
              case "deleteContentForward":
                if (selectionStart === selectionEnd) {
                  selEnd += 1;
                }
                break;
            }
            event.preventDefault();
            this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
              source: this,
              detail: {
                id,
                name: "Keystroke",
                value,
                change: data || "",
                willCommit: false,
                selStart,
                selEnd
              }
            });
          });
        }
        this._setEventListeners(element, elementData, [["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"]], event => event.target.value);
      }
      if (blurListener) {
        element.addEventListener("blur", blurListener);
      }
      if (this.data.comb) {
        const fieldWidth = this.data.rect[2] - this.data.rect[0];
        const combWidth = fieldWidth / maxLen;
        element.classList.add("comb");
        element.style.letterSpacing = `calc(${combWidth}px * var(--scale-factor) - 1ch)`;
      }
    } else {
      element = document.createElement("div");
      element.textContent = this.data.fieldValue;
      element.style.verticalAlign = "middle";
      element.style.display = "table-cell";
    }
    this._setTextStyle(element);
    this._setBackgroundColor(element);
    this._setDefaultPropertiesFromJS(element);
    this.container.append(element);
    return this.container;
  }
}
class SignatureWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: !!parameters.data.hasOwnCanvas
    });
  }
}
class CheckboxWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: parameters.renderForms
    });
  }
  render() {
    const storage = this.annotationStorage;
    const data = this.data;
    const id = data.id;
    let value = storage.getValue(id, {
      value: data.exportValue === data.fieldValue
    }).value;
    if (typeof value === "string") {
      value = value !== "Off";
      storage.setValue(id, {
        value
      });
    }
    this.container.classList.add("buttonWidgetAnnotation", "checkBox");
    const element = document.createElement("input");
    GetElementsByNameSet.add(element);
    element.setAttribute("data-element-id", id);
    element.disabled = data.readOnly;
    this._setRequired(element, this.data.required);
    element.type = "checkbox";
    element.name = data.fieldName;
    if (value) {
      element.setAttribute("checked", true);
    }
    element.setAttribute("exportValue", data.exportValue);
    element.tabIndex = DEFAULT_TAB_INDEX;
    element.addEventListener("change", event => {
      const {
        name,
        checked
      } = event.target;
      for (const checkbox of this._getElementsByName(name, id)) {
        const curChecked = checked && checkbox.exportValue === data.exportValue;
        if (checkbox.domElement) {
          checkbox.domElement.checked = curChecked;
        }
        storage.setValue(checkbox.id, {
          value: curChecked
        });
      }
      storage.setValue(id, {
        value: checked
      });
    });
    element.addEventListener("resetform", event => {
      const defaultValue = data.defaultFieldValue || "Off";
      event.target.checked = defaultValue === data.exportValue;
    });
    if (this.enableScripting && this.hasJSActions) {
      element.addEventListener("updatefromsandbox", jsEvent => {
        const actions = {
          value(event) {
            event.target.checked = event.detail.value !== "Off";
            storage.setValue(id, {
              value: event.target.checked
            });
          }
        };
        this._dispatchEventFromSandbox(actions, jsEvent);
      });
      this._setEventListeners(element, null, [["change", "Validate"], ["change", "Action"], ["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"]], event => event.target.checked);
    }
    this._setBackgroundColor(element);
    this._setDefaultPropertiesFromJS(element);
    this.container.append(element);
    return this.container;
  }
}
class RadioButtonWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: parameters.renderForms
    });
  }
  render() {
    this.container.classList.add("buttonWidgetAnnotation", "radioButton");
    const storage = this.annotationStorage;
    const data = this.data;
    const id = data.id;
    let value = storage.getValue(id, {
      value: data.fieldValue === data.buttonValue
    }).value;
    if (typeof value === "string") {
      value = value !== data.buttonValue;
      storage.setValue(id, {
        value
      });
    }
    const element = document.createElement("input");
    GetElementsByNameSet.add(element);
    element.setAttribute("data-element-id", id);
    element.disabled = data.readOnly;
    this._setRequired(element, this.data.required);
    element.type = "radio";
    element.name = data.fieldName;
    if (value) {
      element.setAttribute("checked", true);
    }
    element.tabIndex = DEFAULT_TAB_INDEX;
    element.addEventListener("change", event => {
      const {
        name,
        checked
      } = event.target;
      for (const radio of this._getElementsByName(name, id)) {
        storage.setValue(radio.id, {
          value: false
        });
      }
      storage.setValue(id, {
        value: checked
      });
    });
    element.addEventListener("resetform", event => {
      const defaultValue = data.defaultFieldValue;
      event.target.checked = defaultValue !== null && defaultValue !== undefined && defaultValue === data.buttonValue;
    });
    if (this.enableScripting && this.hasJSActions) {
      const pdfButtonValue = data.buttonValue;
      element.addEventListener("updatefromsandbox", jsEvent => {
        const actions = {
          value: event => {
            const checked = pdfButtonValue === event.detail.value;
            for (const radio of this._getElementsByName(event.target.name)) {
              const curChecked = checked && radio.id === id;
              if (radio.domElement) {
                radio.domElement.checked = curChecked;
              }
              storage.setValue(radio.id, {
                value: curChecked
              });
            }
          }
        };
        this._dispatchEventFromSandbox(actions, jsEvent);
      });
      this._setEventListeners(element, null, [["change", "Validate"], ["change", "Action"], ["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"]], event => event.target.checked);
    }
    this._setBackgroundColor(element);
    this._setDefaultPropertiesFromJS(element);
    this.container.append(element);
    return this.container;
  }
}
class PushButtonWidgetAnnotationElement extends LinkAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      ignoreBorder: parameters.data.hasAppearance
    });
  }
  render() {
    const container = super.render();
    container.classList.add("buttonWidgetAnnotation", "pushButton");
    if (this.data.alternativeText) {
      container.title = this.data.alternativeText;
    }
    const linkElement = container.lastChild;
    if (this.enableScripting && this.hasJSActions && linkElement) {
      this._setDefaultPropertiesFromJS(linkElement);
      linkElement.addEventListener("updatefromsandbox", jsEvent => {
        this._dispatchEventFromSandbox({}, jsEvent);
      });
    }
    return container;
  }
}
class ChoiceWidgetAnnotationElement extends WidgetAnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: parameters.renderForms
    });
  }
  render() {
    this.container.classList.add("choiceWidgetAnnotation");
    const storage = this.annotationStorage;
    const id = this.data.id;
    const storedData = storage.getValue(id, {
      value: this.data.fieldValue
    });
    const selectElement = document.createElement("select");
    GetElementsByNameSet.add(selectElement);
    selectElement.setAttribute("data-element-id", id);
    selectElement.disabled = this.data.readOnly;
    this._setRequired(selectElement, this.data.required);
    selectElement.name = this.data.fieldName;
    selectElement.tabIndex = DEFAULT_TAB_INDEX;
    let addAnEmptyEntry = this.data.combo && this.data.options.length > 0;
    if (!this.data.combo) {
      selectElement.size = this.data.options.length;
      if (this.data.multiSelect) {
        selectElement.multiple = true;
      }
    }
    selectElement.addEventListener("resetform", event => {
      const defaultValue = this.data.defaultFieldValue;
      for (const option of selectElement.options) {
        option.selected = option.value === defaultValue;
      }
    });
    for (const option of this.data.options) {
      const optionElement = document.createElement("option");
      optionElement.textContent = option.displayValue;
      optionElement.value = option.exportValue;
      if (storedData.value.includes(option.exportValue)) {
        optionElement.setAttribute("selected", true);
        addAnEmptyEntry = false;
      }
      selectElement.append(optionElement);
    }
    let removeEmptyEntry = null;
    if (addAnEmptyEntry) {
      const noneOptionElement = document.createElement("option");
      noneOptionElement.value = " ";
      noneOptionElement.setAttribute("hidden", true);
      noneOptionElement.setAttribute("selected", true);
      selectElement.prepend(noneOptionElement);
      removeEmptyEntry = () => {
        noneOptionElement.remove();
        selectElement.removeEventListener("input", removeEmptyEntry);
        removeEmptyEntry = null;
      };
      selectElement.addEventListener("input", removeEmptyEntry);
    }
    const getValue = isExport => {
      const name = isExport ? "value" : "textContent";
      const {
        options,
        multiple
      } = selectElement;
      if (!multiple) {
        return options.selectedIndex === -1 ? null : options[options.selectedIndex][name];
      }
      return Array.prototype.filter.call(options, option => option.selected).map(option => option[name]);
    };
    let selectedValues = getValue(false);
    const getItems = event => {
      const options = event.target.options;
      return Array.prototype.map.call(options, option => {
        return {
          displayValue: option.textContent,
          exportValue: option.value
        };
      });
    };
    if (this.enableScripting && this.hasJSActions) {
      selectElement.addEventListener("updatefromsandbox", jsEvent => {
        const actions = {
          value(event) {
            removeEmptyEntry?.();
            const value = event.detail.value;
            const values = new Set(Array.isArray(value) ? value : [value]);
            for (const option of selectElement.options) {
              option.selected = values.has(option.value);
            }
            storage.setValue(id, {
              value: getValue(true)
            });
            selectedValues = getValue(false);
          },
          multipleSelection(event) {
            selectElement.multiple = true;
          },
          remove(event) {
            const options = selectElement.options;
            const index = event.detail.remove;
            options[index].selected = false;
            selectElement.remove(index);
            if (options.length > 0) {
              const i = Array.prototype.findIndex.call(options, option => option.selected);
              if (i === -1) {
                options[0].selected = true;
              }
            }
            storage.setValue(id, {
              value: getValue(true),
              items: getItems(event)
            });
            selectedValues = getValue(false);
          },
          clear(event) {
            while (selectElement.length !== 0) {
              selectElement.remove(0);
            }
            storage.setValue(id, {
              value: null,
              items: []
            });
            selectedValues = getValue(false);
          },
          insert(event) {
            const {
              index,
              displayValue,
              exportValue
            } = event.detail.insert;
            const selectChild = selectElement.children[index];
            const optionElement = document.createElement("option");
            optionElement.textContent = displayValue;
            optionElement.value = exportValue;
            if (selectChild) {
              selectChild.before(optionElement);
            } else {
              selectElement.append(optionElement);
            }
            storage.setValue(id, {
              value: getValue(true),
              items: getItems(event)
            });
            selectedValues = getValue(false);
          },
          items(event) {
            const {
              items
            } = event.detail;
            while (selectElement.length !== 0) {
              selectElement.remove(0);
            }
            for (const item of items) {
              const {
                displayValue,
                exportValue
              } = item;
              const optionElement = document.createElement("option");
              optionElement.textContent = displayValue;
              optionElement.value = exportValue;
              selectElement.append(optionElement);
            }
            if (selectElement.options.length > 0) {
              selectElement.options[0].selected = true;
            }
            storage.setValue(id, {
              value: getValue(true),
              items: getItems(event)
            });
            selectedValues = getValue(false);
          },
          indices(event) {
            const indices = new Set(event.detail.indices);
            for (const option of event.target.options) {
              option.selected = indices.has(option.index);
            }
            storage.setValue(id, {
              value: getValue(true)
            });
            selectedValues = getValue(false);
          },
          editable(event) {
            event.target.disabled = !event.detail.editable;
          }
        };
        this._dispatchEventFromSandbox(actions, jsEvent);
      });
      selectElement.addEventListener("input", event => {
        const exportValue = getValue(true);
        storage.setValue(id, {
          value: exportValue
        });
        event.preventDefault();
        this.linkService.eventBus?.dispatch("dispatcheventinsandbox", {
          source: this,
          detail: {
            id,
            name: "Keystroke",
            value: selectedValues,
            changeEx: exportValue,
            willCommit: false,
            commitKey: 1,
            keyDown: false
          }
        });
      });
      this._setEventListeners(selectElement, null, [["focus", "Focus"], ["blur", "Blur"], ["mousedown", "Mouse Down"], ["mouseenter", "Mouse Enter"], ["mouseleave", "Mouse Exit"], ["mouseup", "Mouse Up"], ["input", "Action"], ["input", "Validate"]], event => event.target.value);
    } else {
      selectElement.addEventListener("input", function (event) {
        storage.setValue(id, {
          value: getValue(true)
        });
      });
    }
    if (this.data.combo) {
      this._setTextStyle(selectElement);
    } else {}
    this._setBackgroundColor(selectElement);
    this._setDefaultPropertiesFromJS(selectElement);
    this.container.append(selectElement);
    return this.container;
  }
}
class PopupAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    const {
      data,
      elements
    } = parameters;
    super(parameters, {
      isRenderable: AnnotationElement._hasPopupData(data)
    });
    this.elements = elements;
  }
  render() {
    this.container.classList.add("popupAnnotation");
    const popup = new PopupElement({
      container: this.container,
      color: this.data.color,
      titleObj: this.data.titleObj,
      modificationDate: this.data.modificationDate,
      contentsObj: this.data.contentsObj,
      richText: this.data.richText,
      rect: this.data.rect,
      parentRect: this.data.parentRect || null,
      parent: this.parent,
      elements: this.elements,
      open: this.data.open
    });
    const elementIds = [];
    for (const element of this.elements) {
      element.popup = popup;
      elementIds.push(element.data.id);
      element.addHighlightArea();
    }
    this.container.setAttribute("aria-controls", elementIds.map(id => `${_util.AnnotationPrefix}${id}`).join(","));
    return this.container;
  }
}
class PopupElement {
  #dateTimePromise = null;
  #boundKeyDown = this.#keyDown.bind(this);
  #boundHide = this.#hide.bind(this);
  #boundShow = this.#show.bind(this);
  #boundToggle = this.#toggle.bind(this);
  #color = null;
  #container = null;
  #contentsObj = null;
  #elements = null;
  #parent = null;
  #parentRect = null;
  #pinned = false;
  #popup = null;
  #rect = null;
  #richText = null;
  #titleObj = null;
  #wasVisible = false;
  constructor({
    container,
    color,
    elements,
    titleObj,
    modificationDate,
    contentsObj,
    richText,
    parent,
    rect,
    parentRect,
    open
  }) {
    this.#container = container;
    this.#titleObj = titleObj;
    this.#contentsObj = contentsObj;
    this.#richText = richText;
    this.#parent = parent;
    this.#color = color;
    this.#rect = rect;
    this.#parentRect = parentRect;
    this.#elements = elements;
    const dateObject = _display_utils.PDFDateString.toDateObject(modificationDate);
    if (dateObject) {
      this.#dateTimePromise = parent.l10n.get("annotation_date_string", {
        date: dateObject.toLocaleDateString(),
        time: dateObject.toLocaleTimeString()
      });
    }
    this.trigger = elements.flatMap(e => e.getElementsToTriggerPopup());
    for (const element of this.trigger) {
      element.addEventListener("click", this.#boundToggle);
      element.addEventListener("mouseenter", this.#boundShow);
      element.addEventListener("mouseleave", this.#boundHide);
      element.classList.add("popupTriggerArea");
    }
    for (const element of elements) {
      element.container?.addEventListener("keydown", this.#boundKeyDown);
    }
    this.#container.hidden = true;
    if (open) {
      this.#toggle();
    }
  }
  render() {
    if (this.#popup) {
      return;
    }
    const {
      page: {
        view
      },
      viewport: {
        rawDims: {
          pageWidth,
          pageHeight,
          pageX,
          pageY
        }
      }
    } = this.#parent;
    const popup = this.#popup = document.createElement("div");
    popup.className = "popup";
    if (this.#color) {
      const baseColor = popup.style.outlineColor = _util.Util.makeHexColor(...this.#color);
      if (CSS.supports("background-color", "color-mix(in srgb, red 30%, white)")) {
        popup.style.backgroundColor = `color-mix(in srgb, ${baseColor} 30%, white)`;
      } else {
        const BACKGROUND_ENLIGHT = 0.7;
        popup.style.backgroundColor = _util.Util.makeHexColor(...this.#color.map(c => Math.floor(BACKGROUND_ENLIGHT * (255 - c) + c)));
      }
    }
    const header = document.createElement("span");
    header.className = "header";
    const title = document.createElement("h1");
    header.append(title);
    ({
      dir: title.dir,
      str: title.textContent
    } = this.#titleObj);
    popup.append(header);
    if (this.#dateTimePromise) {
      const modificationDate = document.createElement("span");
      modificationDate.classList.add("popupDate");
      this.#dateTimePromise.then(localized => {
        modificationDate.textContent = localized;
      });
      header.append(modificationDate);
    }
    const contentsObj = this.#contentsObj;
    const richText = this.#richText;
    if (richText?.str && (!contentsObj?.str || contentsObj.str === richText.str)) {
      _xfa_layer.XfaLayer.render({
        xfaHtml: richText.html,
        intent: "richText",
        div: popup
      });
      popup.lastChild.classList.add("richText", "popupContent");
    } else {
      const contents = this._formatContents(contentsObj);
      popup.append(contents);
    }
    let useParentRect = !!this.#parentRect;
    let rect = useParentRect ? this.#parentRect : this.#rect;
    for (const element of this.#elements) {
      if (!rect || _util.Util.intersect(element.data.rect, rect) !== null) {
        rect = element.data.rect;
        useParentRect = true;
        break;
      }
    }
    const normalizedRect = _util.Util.normalizeRect([rect[0], view[3] - rect[1] + view[1], rect[2], view[3] - rect[3] + view[1]]);
    const HORIZONTAL_SPACE_AFTER_ANNOTATION = 5;
    const parentWidth = useParentRect ? rect[2] - rect[0] + HORIZONTAL_SPACE_AFTER_ANNOTATION : 0;
    const popupLeft = normalizedRect[0] + parentWidth;
    const popupTop = normalizedRect[1];
    const {
      style
    } = this.#container;
    style.left = `${100 * (popupLeft - pageX) / pageWidth}%`;
    style.top = `${100 * (popupTop - pageY) / pageHeight}%`;
    this.#container.append(popup);
  }
  _formatContents({
    str,
    dir
  }) {
    const p = document.createElement("p");
    p.classList.add("popupContent");
    p.dir = dir;
    const lines = str.split(/(?:\r\n?|\n)/);
    for (let i = 0, ii = lines.length; i < ii; ++i) {
      const line = lines[i];
      p.append(document.createTextNode(line));
      if (i < ii - 1) {
        p.append(document.createElement("br"));
      }
    }
    return p;
  }
  #keyDown(event) {
    if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === "Enter" || event.key === "Escape" && this.#pinned) {
      this.#toggle();
    }
  }
  #toggle() {
    this.#pinned = !this.#pinned;
    if (this.#pinned) {
      this.#show();
      this.#container.addEventListener("click", this.#boundToggle);
      this.#container.addEventListener("keydown", this.#boundKeyDown);
    } else {
      this.#hide();
      this.#container.removeEventListener("click", this.#boundToggle);
      this.#container.removeEventListener("keydown", this.#boundKeyDown);
    }
  }
  #show() {
    if (!this.#popup) {
      this.render();
    }
    if (!this.isVisible) {
      this.#container.hidden = false;
      this.#container.style.zIndex = parseInt(this.#container.style.zIndex) + 1000;
    } else if (this.#pinned) {
      this.#container.classList.add("focused");
    }
  }
  #hide() {
    this.#container.classList.remove("focused");
    if (this.#pinned || !this.isVisible) {
      return;
    }
    this.#container.hidden = true;
    this.#container.style.zIndex = parseInt(this.#container.style.zIndex) - 1000;
  }
  forceHide() {
    this.#wasVisible = this.isVisible;
    if (!this.#wasVisible) {
      return;
    }
    this.#container.hidden = true;
  }
  maybeShow() {
    if (!this.#wasVisible) {
      return;
    }
    this.#wasVisible = false;
    this.#container.hidden = false;
  }
  get isVisible() {
    return this.#container.hidden === false;
  }
}
class FreeTextAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
    this.textContent = parameters.data.textContent;
    this.textPosition = parameters.data.textPosition;
    this.annotationEditorType = _util.AnnotationEditorType.FREETEXT;
  }
  render() {
    this.container.classList.add("freeTextAnnotation");
    if (this.textContent) {
      const content = document.createElement("div");
      content.classList.add("annotationTextContent");
      content.setAttribute("role", "comment");
      for (const line of this.textContent) {
        const lineSpan = document.createElement("span");
        lineSpan.textContent = line;
        content.append(lineSpan);
      }
      this.container.append(content);
    }
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    this._editOnDoubleClick();
    return this.container;
  }
}
exports.FreeTextAnnotationElement = FreeTextAnnotationElement;
class LineAnnotationElement extends AnnotationElement {
  #line = null;
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
  }
  render() {
    this.container.classList.add("lineAnnotation");
    const data = this.data;
    const {
      width,
      height
    } = getRectDims(data.rect);
    const svg = this.svgFactory.create(width, height, true);
    const line = this.#line = this.svgFactory.createElement("svg:line");
    line.setAttribute("x1", data.rect[2] - data.lineCoordinates[0]);
    line.setAttribute("y1", data.rect[3] - data.lineCoordinates[1]);
    line.setAttribute("x2", data.rect[2] - data.lineCoordinates[2]);
    line.setAttribute("y2", data.rect[3] - data.lineCoordinates[3]);
    line.setAttribute("stroke-width", data.borderStyle.width || 1);
    line.setAttribute("stroke", "transparent");
    line.setAttribute("fill", "transparent");
    svg.append(line);
    this.container.append(svg);
    if (!data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    return this.container;
  }
  getElementsToTriggerPopup() {
    return this.#line;
  }
  addHighlightArea() {
    this.container.classList.add("highlightArea");
  }
}
class SquareAnnotationElement extends AnnotationElement {
  #square = null;
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
  }
  render() {
    this.container.classList.add("squareAnnotation");
    const data = this.data;
    const {
      width,
      height
    } = getRectDims(data.rect);
    const svg = this.svgFactory.create(width, height, true);
    const borderWidth = data.borderStyle.width;
    const square = this.#square = this.svgFactory.createElement("svg:rect");
    square.setAttribute("x", borderWidth / 2);
    square.setAttribute("y", borderWidth / 2);
    square.setAttribute("width", width - borderWidth);
    square.setAttribute("height", height - borderWidth);
    square.setAttribute("stroke-width", borderWidth || 1);
    square.setAttribute("stroke", "transparent");
    square.setAttribute("fill", "transparent");
    svg.append(square);
    this.container.append(svg);
    if (!data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    return this.container;
  }
  getElementsToTriggerPopup() {
    return this.#square;
  }
  addHighlightArea() {
    this.container.classList.add("highlightArea");
  }
}
class CircleAnnotationElement extends AnnotationElement {
  #circle = null;
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
  }
  render() {
    this.container.classList.add("circleAnnotation");
    const data = this.data;
    const {
      width,
      height
    } = getRectDims(data.rect);
    const svg = this.svgFactory.create(width, height, true);
    const borderWidth = data.borderStyle.width;
    const circle = this.#circle = this.svgFactory.createElement("svg:ellipse");
    circle.setAttribute("cx", width / 2);
    circle.setAttribute("cy", height / 2);
    circle.setAttribute("rx", width / 2 - borderWidth / 2);
    circle.setAttribute("ry", height / 2 - borderWidth / 2);
    circle.setAttribute("stroke-width", borderWidth || 1);
    circle.setAttribute("stroke", "transparent");
    circle.setAttribute("fill", "transparent");
    svg.append(circle);
    this.container.append(svg);
    if (!data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    return this.container;
  }
  getElementsToTriggerPopup() {
    return this.#circle;
  }
  addHighlightArea() {
    this.container.classList.add("highlightArea");
  }
}
class PolylineAnnotationElement extends AnnotationElement {
  #polyline = null;
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
    this.containerClassName = "polylineAnnotation";
    this.svgElementName = "svg:polyline";
  }
  render() {
    this.container.classList.add(this.containerClassName);
    const data = this.data;
    const {
      width,
      height
    } = getRectDims(data.rect);
    const svg = this.svgFactory.create(width, height, true);
    let points = [];
    for (const coordinate of data.vertices) {
      const x = coordinate.x - data.rect[0];
      const y = data.rect[3] - coordinate.y;
      points.push(x + "," + y);
    }
    points = points.join(" ");
    const polyline = this.#polyline = this.svgFactory.createElement(this.svgElementName);
    polyline.setAttribute("points", points);
    polyline.setAttribute("stroke-width", data.borderStyle.width || 1);
    polyline.setAttribute("stroke", "transparent");
    polyline.setAttribute("fill", "transparent");
    svg.append(polyline);
    this.container.append(svg);
    if (!data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    return this.container;
  }
  getElementsToTriggerPopup() {
    return this.#polyline;
  }
  addHighlightArea() {
    this.container.classList.add("highlightArea");
  }
}
class PolygonAnnotationElement extends PolylineAnnotationElement {
  constructor(parameters) {
    super(parameters);
    this.containerClassName = "polygonAnnotation";
    this.svgElementName = "svg:polygon";
  }
}
class CaretAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
  }
  render() {
    this.container.classList.add("caretAnnotation");
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    return this.container;
  }
}
class InkAnnotationElement extends AnnotationElement {
  #polylines = [];
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
    this.containerClassName = "inkAnnotation";
    this.svgElementName = "svg:polyline";
    this.annotationEditorType = _util.AnnotationEditorType.INK;
  }
  render() {
    this.container.classList.add(this.containerClassName);
    const data = this.data;
    const {
      width,
      height
    } = getRectDims(data.rect);
    const svg = this.svgFactory.create(width, height, true);
    for (const inkList of data.inkLists) {
      let points = [];
      for (const coordinate of inkList) {
        const x = coordinate.x - data.rect[0];
        const y = data.rect[3] - coordinate.y;
        points.push(`${x},${y}`);
      }
      points = points.join(" ");
      const polyline = this.svgFactory.createElement(this.svgElementName);
      this.#polylines.push(polyline);
      polyline.setAttribute("points", points);
      polyline.setAttribute("stroke-width", data.borderStyle.width || 1);
      polyline.setAttribute("stroke", "transparent");
      polyline.setAttribute("fill", "transparent");
      if (!data.popupRef && this.hasPopupData) {
        this._createPopup();
      }
      svg.append(polyline);
    }
    this.container.append(svg);
    return this.container;
  }
  getElementsToTriggerPopup() {
    return this.#polylines;
  }
  addHighlightArea() {
    this.container.classList.add("highlightArea");
  }
}
exports.InkAnnotationElement = InkAnnotationElement;
class HighlightAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }
  render() {
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    this.container.classList.add("highlightAnnotation");
    return this.container;
  }
}
class UnderlineAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }
  render() {
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    this.container.classList.add("underlineAnnotation");
    return this.container;
  }
}
class SquigglyAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }
  render() {
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    this.container.classList.add("squigglyAnnotation");
    return this.container;
  }
}
class StrikeOutAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true,
      createQuadrilaterals: true
    });
  }
  render() {
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    this.container.classList.add("strikeoutAnnotation");
    return this.container;
  }
}
class StampAnnotationElement extends AnnotationElement {
  constructor(parameters) {
    super(parameters, {
      isRenderable: true,
      ignoreBorder: true
    });
  }
  render() {
    this.container.classList.add("stampAnnotation");
    if (!this.data.popupRef && this.hasPopupData) {
      this._createPopup();
    }
    return this.container;
  }
}
exports.StampAnnotationElement = StampAnnotationElement;
class FileAttachmentAnnotationElement extends AnnotationElement {
  #trigger = null;
  constructor(parameters) {
    super(parameters, {
      isRenderable: true
    });
    const {
      filename,
      content
    } = this.data.file;
    this.filename = (0, _display_utils.getFilenameFromUrl)(filename, true);
    this.content = content;
    this.linkService.eventBus?.dispatch("fileattachmentannotation", {
      source: this,
      filename,
      content
    });
  }
  render() {
    this.container.classList.add("fileAttachmentAnnotation");
    const {
      container,
      data
    } = this;
    let trigger;
    if (data.hasAppearance || data.fillAlpha === 0) {
      trigger = document.createElement("div");
    } else {
      trigger = document.createElement("img");
      trigger.src = `${this.imageResourcesPath}annotation-${/paperclip/i.test(data.name) ? "paperclip" : "pushpin"}.svg`;
      if (data.fillAlpha && data.fillAlpha < 1) {
        trigger.style = `filter: opacity(${Math.round(data.fillAlpha * 100)}%);`;
      }
    }
    trigger.addEventListener("dblclick", this.#download.bind(this));
    this.#trigger = trigger;
    const {
      isMac
    } = _util.FeatureTest.platform;
    container.addEventListener("keydown", evt => {
      if (evt.key === "Enter" && (isMac ? evt.metaKey : evt.ctrlKey)) {
        this.#download();
      }
    });
    if (!data.popupRef && this.hasPopupData) {
      this._createPopup();
    } else {
      trigger.classList.add("popupTriggerArea");
    }
    container.append(trigger);
    return container;
  }
  getElementsToTriggerPopup() {
    return this.#trigger;
  }
  addHighlightArea() {
    this.container.classList.add("highlightArea");
  }
  #download() {
    this.downloadManager?.openOrDownloadData(this.container, this.content, this.filename);
  }
}
class AnnotationLayer {
  #accessibilityManager = null;
  #annotationCanvasMap = null;
  #editableAnnotations = new Map();
  constructor({
    div,
    accessibilityManager,
    annotationCanvasMap,
    l10n,
    page,
    viewport
  }) {
    this.div = div;
    this.#accessibilityManager = accessibilityManager;
    this.#annotationCanvasMap = annotationCanvasMap;
    this.l10n = l10n;
    this.page = page;
    this.viewport = viewport;
    this.zIndex = 0;
    this.l10n ||= _displayL10n_utils.NullL10n;
  }
  #appendElement(element, id) {
    const contentElement = element.firstChild || element;
    contentElement.id = `${_util.AnnotationPrefix}${id}`;
    this.div.append(element);
    this.#accessibilityManager?.moveElementInDOM(this.div, element, contentElement, false);
  }
  async render(params) {
    const {
      annotations
    } = params;
    const layer = this.div;
    (0, _display_utils.setLayerDimensions)(layer, this.viewport);
    const popupToElements = new Map();
    const elementParams = {
      data: null,
      layer,
      linkService: params.linkService,
      downloadManager: params.downloadManager,
      imageResourcesPath: params.imageResourcesPath || "",
      renderForms: params.renderForms !== false,
      svgFactory: new _display_utils.DOMSVGFactory(),
      annotationStorage: params.annotationStorage || new _annotation_storage.AnnotationStorage(),
      enableScripting: params.enableScripting === true,
      hasJSActions: params.hasJSActions,
      fieldObjects: params.fieldObjects,
      parent: this,
      elements: null
    };
    for (const data of annotations) {
      if (data.noHTML) {
        continue;
      }
      const isPopupAnnotation = data.annotationType === _util.AnnotationType.POPUP;
      if (!isPopupAnnotation) {
        const {
          width,
          height
        } = getRectDims(data.rect);
        if (width <= 0 || height <= 0) {
          continue;
        }
      } else {
        const elements = popupToElements.get(data.id);
        if (!elements) {
          continue;
        }
        elementParams.elements = elements;
      }
      elementParams.data = data;
      const element = AnnotationElementFactory.create(elementParams);
      if (!element.isRenderable) {
        continue;
      }
      if (!isPopupAnnotation && data.popupRef) {
        const elements = popupToElements.get(data.popupRef);
        if (!elements) {
          popupToElements.set(data.popupRef, [element]);
        } else {
          elements.push(element);
        }
      }
      if (element.annotationEditorType > 0) {
        this.#editableAnnotations.set(element.data.id, element);
      }
      const rendered = element.render();
      if (data.hidden) {
        rendered.style.visibility = "hidden";
      }
      this.#appendElement(rendered, data.id);
    }
    this.#setAnnotationCanvasMap();
    await this.l10n.translate(layer);
  }
  update({
    viewport
  }) {
    const layer = this.div;
    this.viewport = viewport;
    (0, _display_utils.setLayerDimensions)(layer, {
      rotation: viewport.rotation
    });
    this.#setAnnotationCanvasMap();
    layer.hidden = false;
  }
  #setAnnotationCanvasMap() {
    if (!this.#annotationCanvasMap) {
      return;
    }
    const layer = this.div;
    for (const [id, canvas] of this.#annotationCanvasMap) {
      const element = layer.querySelector(`[data-annotation-id="${id}"]`);
      if (!element) {
        continue;
      }
      const {
        firstChild
      } = element;
      if (!firstChild) {
        element.append(canvas);
      } else if (firstChild.nodeName === "CANVAS") {
        firstChild.replaceWith(canvas);
      } else {
        firstChild.before(canvas);
      }
    }
    this.#annotationCanvasMap.clear();
  }
  getEditableAnnotations() {
    return Array.from(this.#editableAnnotations.values());
  }
  getEditableAnnotation(id) {
    return this.#editableAnnotations.get(id);
  }
}
exports.AnnotationLayer = AnnotationLayer;

/***/ }),
/* 30 */
/***/ ((__unused_webpack_module, exports) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.ColorConverters = void 0;
function makeColorComp(n) {
  return Math.floor(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0");
}
function scaleAndClamp(x) {
  return Math.max(0, Math.min(255, 255 * x));
}
class ColorConverters {
  static CMYK_G([c, y, m, k]) {
    return ["G", 1 - Math.min(1, 0.3 * c + 0.59 * m + 0.11 * y + k)];
  }
  static G_CMYK([g]) {
    return ["CMYK", 0, 0, 0, 1 - g];
  }
  static G_RGB([g]) {
    return ["RGB", g, g, g];
  }
  static G_rgb([g]) {
    g = scaleAndClamp(g);
    return [g, g, g];
  }
  static G_HTML([g]) {
    const G = makeColorComp(g);
    return `#${G}${G}${G}`;
  }
  static RGB_G([r, g, b]) {
    return ["G", 0.3 * r + 0.59 * g + 0.11 * b];
  }
  static RGB_rgb(color) {
    return color.map(scaleAndClamp);
  }
  static RGB_HTML(color) {
    return `#${color.map(makeColorComp).join("")}`;
  }
  static T_HTML() {
    return "#00000000";
  }
  static T_rgb() {
    return [null];
  }
  static CMYK_RGB([c, y, m, k]) {
    return ["RGB", 1 - Math.min(1, c + k), 1 - Math.min(1, m + k), 1 - Math.min(1, y + k)];
  }
  static CMYK_rgb([c, y, m, k]) {
    return [scaleAndClamp(1 - Math.min(1, c + k)), scaleAndClamp(1 - Math.min(1, m + k)), scaleAndClamp(1 - Math.min(1, y + k))];
  }
  static CMYK_HTML(components) {
    const rgb = this.CMYK_RGB(components).slice(1);
    return this.RGB_HTML(rgb);
  }
  static RGB_CMYK([r, g, b]) {
    const c = 1 - r;
    const m = 1 - g;
    const y = 1 - b;
    const k = Math.min(c, m, y);
    return ["CMYK", c, m, y, k];
  }
}
exports.ColorConverters = ColorConverters;

/***/ }),
/* 31 */
/***/ ((__unused_webpack_module, exports) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.NullL10n = void 0;
exports.getL10nFallback = getL10nFallback;
const DEFAULT_L10N_STRINGS = {
  of_pages: "of {{pagesCount}}",
  page_of_pages: "({{pageNumber}} of {{pagesCount}})",
  document_properties_kb: "{{size_kb}} KB ({{size_b}} bytes)",
  document_properties_mb: "{{size_mb}} MB ({{size_b}} bytes)",
  document_properties_date_string: "{{date}}, {{time}}",
  document_properties_page_size_unit_inches: "in",
  document_properties_page_size_unit_millimeters: "mm",
  document_properties_page_size_orientation_portrait: "portrait",
  document_properties_page_size_orientation_landscape: "landscape",
  document_properties_page_size_name_a3: "A3",
  document_properties_page_size_name_a4: "A4",
  document_properties_page_size_name_letter: "Letter",
  document_properties_page_size_name_legal: "Legal",
  document_properties_page_size_dimension_string: "{{width}} × {{height}} {{unit}} ({{orientation}})",
  document_properties_page_size_dimension_name_string: "{{width}} × {{height}} {{unit}} ({{name}}, {{orientation}})",
  document_properties_linearized_yes: "Yes",
  document_properties_linearized_no: "No",
  additional_layers: "Additional Layers",
  page_landmark: "Page {{page}}",
  thumb_page_title: "Page {{page}}",
  thumb_page_canvas: "Thumbnail of Page {{page}}",
  find_reached_top: "Reached top of document, continued from bottom",
  find_reached_bottom: "Reached end of document, continued from top",
  "find_match_count[one]": "{{current}} of {{total}} match",
  "find_match_count[other]": "{{current}} of {{total}} matches",
  "find_match_count_limit[one]": "More than {{limit}} match",
  "find_match_count_limit[other]": "More than {{limit}} matches",
  find_not_found: "Phrase not found",
  page_scale_width: "Page Width",
  page_scale_fit: "Page Fit",
  page_scale_auto: "Automatic Zoom",
  page_scale_actual: "Actual Size",
  page_scale_percent: "{{scale}}%",
  loading_error: "An error occurred while loading the PDF.",
  invalid_file_error: "Invalid or corrupted PDF file.",
  missing_file_error: "Missing PDF file.",
  unexpected_response_error: "Unexpected server response.",
  rendering_error: "An error occurred while rendering the page.",
  annotation_date_string: "{{date}}, {{time}}",
  printing_not_supported: "Warning: Printing is not fully supported by this browser.",
  printing_not_ready: "Warning: The PDF is not fully loaded for printing.",
  web_fonts_disabled: "Web fonts are disabled: unable to use embedded PDF fonts.",
  free_text2_default_content: "Start typing…",
  editor_free_text2_aria_label: "Text Editor",
  editor_ink2_aria_label: "Draw Editor",
  editor_ink_canvas_aria_label: "User-created image",
  editor_alt_text_button_label: "Alt text",
  editor_alt_text_edit_button_label: "Edit alt text",
  editor_alt_text_decorative_tooltip: "Marked as decorative"
};
{
  DEFAULT_L10N_STRINGS.print_progress_percent = "{{progress}}%";
}
function getL10nFallback(key, args) {
  switch (key) {
    case "find_match_count":
      key = `find_match_count[${args.total === 1 ? "one" : "other"}]`;
      break;
    case "find_match_count_limit":
      key = `find_match_count_limit[${args.limit === 1 ? "one" : "other"}]`;
      break;
  }
  return DEFAULT_L10N_STRINGS[key] || "";
}
function formatL10nValue(text, args) {
  if (!args) {
    return text;
  }
  return text.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (all, name) => {
    return name in args ? args[name] : "{{" + name + "}}";
  });
}
const NullL10n = {
  async getLanguage() {
    return "en-us";
  },
  async getDirection() {
    return "ltr";
  },
  async get(key, args = null, fallback = getL10nFallback(key, args)) {
    return formatL10nValue(fallback, args);
  },
  async translate(element) {}
};
exports.NullL10n = NullL10n;

/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.XfaLayer = void 0;
var _xfa_text = __w_pdfjs_require__(25);
class XfaLayer {
  static setupStorage(html, id, element, storage, intent) {
    const storedData = storage.getValue(id, {
      value: null
    });
    switch (element.name) {
      case "textarea":
        if (storedData.value !== null) {
          html.textContent = storedData.value;
        }
        if (intent === "print") {
          break;
        }
        html.addEventListener("input", event => {
          storage.setValue(id, {
            value: event.target.value
          });
        });
        break;
      case "input":
        if (element.attributes.type === "radio" || element.attributes.type === "checkbox") {
          if (storedData.value === element.attributes.xfaOn) {
            html.setAttribute("checked", true);
          } else if (storedData.value === element.attributes.xfaOff) {
            html.removeAttribute("checked");
          }
          if (intent === "print") {
            break;
          }
          html.addEventListener("change", event => {
            storage.setValue(id, {
              value: event.target.checked ? event.target.getAttribute("xfaOn") : event.target.getAttribute("xfaOff")
            });
          });
        } else {
          if (storedData.value !== null) {
            html.setAttribute("value", storedData.value);
          }
          if (intent === "print") {
            break;
          }
          html.addEventListener("input", event => {
            storage.setValue(id, {
              value: event.target.value
            });
          });
        }
        break;
      case "select":
        if (storedData.value !== null) {
          html.setAttribute("value", storedData.value);
          for (const option of element.children) {
            if (option.attributes.value === storedData.value) {
              option.attributes.selected = true;
            } else if (option.attributes.hasOwnProperty("selected")) {
              delete option.attributes.selected;
            }
          }
        }
        html.addEventListener("input", event => {
          const options = event.target.options;
          const value = options.selectedIndex === -1 ? "" : options[options.selectedIndex].value;
          storage.setValue(id, {
            value
          });
        });
        break;
    }
  }
  static setAttributes({
    html,
    element,
    storage = null,
    intent,
    linkService
  }) {
    const {
      attributes
    } = element;
    const isHTMLAnchorElement = html instanceof HTMLAnchorElement;
    if (attributes.type === "radio") {
      attributes.name = `${attributes.name}-${intent}`;
    }
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) {
        continue;
      }
      switch (key) {
        case "class":
          if (value.length) {
            html.setAttribute(key, value.join(" "));
          }
          break;
        case "dataId":
          break;
        case "id":
          html.setAttribute("data-element-id", value);
          break;
        case "style":
          Object.assign(html.style, value);
          break;
        case "textContent":
          html.textContent = value;
          break;
        default:
          if (!isHTMLAnchorElement || key !== "href" && key !== "newWindow") {
            html.setAttribute(key, value);
          }
      }
    }
    if (isHTMLAnchorElement) {
      linkService.addLinkAttributes(html, attributes.href, attributes.newWindow);
    }
    if (storage && attributes.dataId) {
      this.setupStorage(html, attributes.dataId, element, storage);
    }
  }
  static render(parameters) {
    const storage = parameters.annotationStorage;
    const linkService = parameters.linkService;
    const root = parameters.xfaHtml;
    const intent = parameters.intent || "display";
    const rootHtml = document.createElement(root.name);
    if (root.attributes) {
      this.setAttributes({
        html: rootHtml,
        element: root,
        intent,
        linkService
      });
    }
    const stack = [[root, -1, rootHtml]];
    const rootDiv = parameters.div;
    rootDiv.append(rootHtml);
    if (parameters.viewport) {
      const transform = `matrix(${parameters.viewport.transform.join(",")})`;
      rootDiv.style.transform = transform;
    }
    if (intent !== "richText") {
      rootDiv.setAttribute("class", "xfaLayer xfaFont");
    }
    const textDivs = [];
    while (stack.length > 0) {
      const [parent, i, html] = stack.at(-1);
      if (i + 1 === parent.children.length) {
        stack.pop();
        continue;
      }
      const child = parent.children[++stack.at(-1)[1]];
      if (child === null) {
        continue;
      }
      const {
        name
      } = child;
      if (name === "#text") {
        const node = document.createTextNode(child.value);
        textDivs.push(node);
        html.append(node);
        continue;
      }
      const childHtml = child?.attributes?.xmlns ? document.createElementNS(child.attributes.xmlns, name) : document.createElement(name);
      html.append(childHtml);
      if (child.attributes) {
        this.setAttributes({
          html: childHtml,
          element: child,
          storage,
          intent,
          linkService
        });
      }
      if (child.children && child.children.length > 0) {
        stack.push([child, -1, childHtml]);
      } else if (child.value) {
        const node = document.createTextNode(child.value);
        if (_xfa_text.XfaText.shouldBuildText(name)) {
          textDivs.push(node);
        }
        childHtml.append(node);
      }
    }
    for (const el of rootDiv.querySelectorAll(".xfaNonInteractive input, .xfaNonInteractive textarea")) {
      el.setAttribute("readOnly", true);
    }
    return {
      textDivs
    };
  }
  static update(parameters) {
    const transform = `matrix(${parameters.viewport.transform.join(",")})`;
    parameters.div.style.transform = transform;
    parameters.div.hidden = false;
  }
}
exports.XfaLayer = XfaLayer;

/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.InkEditor = void 0;
var _util = __w_pdfjs_require__(1);
var _editor = __w_pdfjs_require__(4);
var _annotation_layer = __w_pdfjs_require__(29);
var _display_utils = __w_pdfjs_require__(6);
var _tools = __w_pdfjs_require__(5);
class InkEditor extends _editor.AnnotationEditor {
  #baseHeight = 0;
  #baseWidth = 0;
  #boundCanvasPointermove = this.canvasPointermove.bind(this);
  #boundCanvasPointerleave = this.canvasPointerleave.bind(this);
  #boundCanvasPointerup = this.canvasPointerup.bind(this);
  #boundCanvasPointerdown = this.canvasPointerdown.bind(this);
  #currentPath2D = new Path2D();
  #disableEditing = false;
  #hasSomethingToDraw = false;
  #isCanvasInitialized = false;
  #observer = null;
  #realWidth = 0;
  #realHeight = 0;
  #requestFrameCallback = null;
  static _defaultColor = null;
  static _defaultOpacity = 1;
  static _defaultThickness = 1;
  static _type = "ink";
  constructor(params) {
    super({
      ...params,
      name: "inkEditor"
    });
    this.color = params.color || null;
    this.thickness = params.thickness || null;
    this.opacity = params.opacity || null;
    this.paths = [];
    this.bezierPath2D = [];
    this.allRawPaths = [];
    this.currentPath = [];
    this.scaleFactor = 1;
    this.translationX = this.translationY = 0;
    this.x = 0;
    this.y = 0;
    this._willKeepAspectRatio = true;
  }
  static initialize(l10n) {
    _editor.AnnotationEditor.initialize(l10n, {
      strings: ["editor_ink_canvas_aria_label", "editor_ink2_aria_label"]
    });
  }
  static updateDefaultParams(type, value) {
    switch (type) {
      case _util.AnnotationEditorParamsType.INK_THICKNESS:
        InkEditor._defaultThickness = value;
        break;
      case _util.AnnotationEditorParamsType.INK_COLOR:
        InkEditor._defaultColor = value;
        break;
      case _util.AnnotationEditorParamsType.INK_OPACITY:
        InkEditor._defaultOpacity = value / 100;
        break;
    }
  }
  updateParams(type, value) {
    switch (type) {
      case _util.AnnotationEditorParamsType.INK_THICKNESS:
        this.#updateThickness(value);
        break;
      case _util.AnnotationEditorParamsType.INK_COLOR:
        this.#updateColor(value);
        break;
      case _util.AnnotationEditorParamsType.INK_OPACITY:
        this.#updateOpacity(value);
        break;
    }
  }
  static get defaultPropertiesToUpdate() {
    return [[_util.AnnotationEditorParamsType.INK_THICKNESS, InkEditor._defaultThickness], [_util.AnnotationEditorParamsType.INK_COLOR, InkEditor._defaultColor || _editor.AnnotationEditor._defaultLineColor], [_util.AnnotationEditorParamsType.INK_OPACITY, Math.round(InkEditor._defaultOpacity * 100)]];
  }
  get propertiesToUpdate() {
    return [[_util.AnnotationEditorParamsType.INK_THICKNESS, this.thickness || InkEditor._defaultThickness], [_util.AnnotationEditorParamsType.INK_COLOR, this.color || InkEditor._defaultColor || _editor.AnnotationEditor._defaultLineColor], [_util.AnnotationEditorParamsType.INK_OPACITY, Math.round(100 * (this.opacity ?? InkEditor._defaultOpacity))]];
  }
  #updateThickness(thickness) {
    const savedThickness = this.thickness;
    this.addCommands({
      cmd: () => {
        this.thickness = thickness;
        this.#fitToContent();
      },
      undo: () => {
        this.thickness = savedThickness;
        this.#fitToContent();
      },
      mustExec: true,
      type: _util.AnnotationEditorParamsType.INK_THICKNESS,
      overwriteIfSameType: true,
      keepUndo: true
    });
  }
  #updateColor(color) {
    const savedColor = this.color;
    this.addCommands({
      cmd: () => {
        this.color = color;
        this.#redraw();
      },
      undo: () => {
        this.color = savedColor;
        this.#redraw();
      },
      mustExec: true,
      type: _util.AnnotationEditorParamsType.INK_COLOR,
      overwriteIfSameType: true,
      keepUndo: true
    });
  }
  #updateOpacity(opacity) {
    opacity /= 100;
    const savedOpacity = this.opacity;
    this.addCommands({
      cmd: () => {
        this.opacity = opacity;
        this.#redraw();
      },
      undo: () => {
        this.opacity = savedOpacity;
        this.#redraw();
      },
      mustExec: true,
      type: _util.AnnotationEditorParamsType.INK_OPACITY,
      overwriteIfSameType: true,
      keepUndo: true
    });
  }
  rebuild() {
    if (!this.parent) {
      return;
    }
    super.rebuild();
    if (this.div === null) {
      return;
    }
    if (!this.canvas) {
      this.#createCanvas();
      this.#createObserver();
    }
    if (!this.isAttachedToDOM) {
      this.parent.add(this);
      this.#setCanvasDims();
    }
    this.#fitToContent();
  }
  remove() {
    if (this.canvas === null) {
      return;
    }
    if (!this.isEmpty()) {
      this.commit();
    }
    this.canvas.width = this.canvas.height = 0;
    this.canvas.remove();
    this.canvas = null;
    this.#observer.disconnect();
    this.#observer = null;
    super.remove();
  }
  setParent(parent) {
    if (!this.parent && parent) {
      this._uiManager.removeShouldRescale(this);
    } else if (this.parent && parent === null) {
      this._uiManager.addShouldRescale(this);
    }
    super.setParent(parent);
  }
  onScaleChanging() {
    const [parentWidth, parentHeight] = this.parentDimensions;
    const width = this.width * parentWidth;
    const height = this.height * parentHeight;
    this.setDimensions(width, height);
  }
  enableEditMode() {
    if (this.#disableEditing || this.canvas === null) {
      return;
    }
    super.enableEditMode();
    this._isDraggable = false;
    this.canvas.addEventListener("pointerdown", this.#boundCanvasPointerdown);
  }
  disableEditMode() {
    if (!this.isInEditMode() || this.canvas === null) {
      return;
    }
    super.disableEditMode();
    this._isDraggable = !this.isEmpty();
    this.div.classList.remove("editing");
    this.canvas.removeEventListener("pointerdown", this.#boundCanvasPointerdown);
  }
  onceAdded() {
    this._isDraggable = !this.isEmpty();
  }
  isEmpty() {
    return this.paths.length === 0 || this.paths.length === 1 && this.paths[0].length === 0;
  }
  #getInitialBBox() {
    const {
      parentRotation,
      parentDimensions: [width, height]
    } = this;
    switch (parentRotation) {
      case 90:
        return [0, height, height, width];
      case 180:
        return [width, height, width, height];
      case 270:
        return [width, 0, height, width];
      default:
        return [0, 0, width, height];
    }
  }
  #setStroke() {
    const {
      ctx,
      color,
      opacity,
      thickness,
      parentScale,
      scaleFactor
    } = this;
    ctx.lineWidth = thickness * parentScale / scaleFactor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.miterLimit = 10;
    ctx.strokeStyle = `${color}${(0, _tools.opacityToHex)(opacity)}`;
  }
  #startDrawing(x, y) {
    this.canvas.addEventListener("contextmenu", _display_utils.noContextMenu);
    this.canvas.addEventListener("pointerleave", this.#boundCanvasPointerleave);
    this.canvas.addEventListener("pointermove", this.#boundCanvasPointermove);
    this.canvas.addEventListener("pointerup", this.#boundCanvasPointerup);
    this.canvas.removeEventListener("pointerdown", this.#boundCanvasPointerdown);
    this.isEditing = true;
    if (!this.#isCanvasInitialized) {
      this.#isCanvasInitialized = true;
      this.#setCanvasDims();
      this.thickness ||= InkEditor._defaultThickness;
      this.color ||= InkEditor._defaultColor || _editor.AnnotationEditor._defaultLineColor;
      this.opacity ??= InkEditor._defaultOpacity;
    }
    this.currentPath.push([x, y]);
    this.#hasSomethingToDraw = false;
    this.#setStroke();
    this.#requestFrameCallback = () => {
      this.#drawPoints();
      if (this.#requestFrameCallback) {
        window.requestAnimationFrame(this.#requestFrameCallback);
      }
    };
    window.requestAnimationFrame(this.#requestFrameCallback);
  }
  #draw(x, y) {
    const [lastX, lastY] = this.currentPath.at(-1);
    if (this.currentPath.length > 1 && x === lastX && y === lastY) {
      return;
    }
    const currentPath = this.currentPath;
    let path2D = this.#currentPath2D;
    currentPath.push([x, y]);
    this.#hasSomethingToDraw = true;
    if (currentPath.length <= 2) {
      path2D.moveTo(...currentPath[0]);
      path2D.lineTo(x, y);
      return;
    }
    if (currentPath.length === 3) {
      this.#currentPath2D = path2D = new Path2D();
      path2D.moveTo(...currentPath[0]);
    }
    this.#makeBezierCurve(path2D, ...currentPath.at(-3), ...currentPath.at(-2), x, y);
  }
  #endPath() {
    if (this.currentPath.length === 0) {
      return;
    }
    const lastPoint = this.currentPath.at(-1);
    this.#currentPath2D.lineTo(...lastPoint);
  }
  #stopDrawing(x, y) {
    this.#requestFrameCallback = null;
    x = Math.min(Math.max(x, 0), this.canvas.width);
    y = Math.min(Math.max(y, 0), this.canvas.height);
    this.#draw(x, y);
    this.#endPath();
    let bezier;
    if (this.currentPath.length !== 1) {
      bezier = this.#generateBezierPoints();
    } else {
      const xy = [x, y];
      bezier = [[xy, xy.slice(), xy.slice(), xy]];
    }
    const path2D = this.#currentPath2D;
    const currentPath = this.currentPath;
    this.currentPath = [];
    this.#currentPath2D = new Path2D();
    const cmd = () => {
      this.allRawPaths.push(currentPath);
      this.paths.push(bezier);
      this.bezierPath2D.push(path2D);
      this.rebuild();
    };
    const undo = () => {
      this.allRawPaths.pop();
      this.paths.pop();
      this.bezierPath2D.pop();
      if (this.paths.length === 0) {
        this.remove();
      } else {
        if (!this.canvas) {
          this.#createCanvas();
          this.#createObserver();
        }
        this.#fitToContent();
      }
    };
    this.addCommands({
      cmd,
      undo,
      mustExec: true
    });
  }
  #drawPoints() {
    if (!this.#hasSomethingToDraw) {
      return;
    }
    this.#hasSomethingToDraw = false;
    const thickness = Math.ceil(this.thickness * this.parentScale);
    const lastPoints = this.currentPath.slice(-3);
    const x = lastPoints.map(xy => xy[0]);
    const y = lastPoints.map(xy => xy[1]);
    const xMin = Math.min(...x) - thickness;
    const xMax = Math.max(...x) + thickness;
    const yMin = Math.min(...y) - thickness;
    const yMax = Math.max(...y) + thickness;
    const {
      ctx
    } = this;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const path of this.bezierPath2D) {
      ctx.stroke(path);
    }
    ctx.stroke(this.#currentPath2D);
    ctx.restore();
  }
  #makeBezierCurve(path2D, x0, y0, x1, y1, x2, y2) {
    const prevX = (x0 + x1) / 2;
    const prevY = (y0 + y1) / 2;
    const x3 = (x1 + x2) / 2;
    const y3 = (y1 + y2) / 2;
    path2D.bezierCurveTo(prevX + 2 * (x1 - prevX) / 3, prevY + 2 * (y1 - prevY) / 3, x3 + 2 * (x1 - x3) / 3, y3 + 2 * (y1 - y3) / 3, x3, y3);
  }
  #generateBezierPoints() {
    const path = this.currentPath;
    if (path.length <= 2) {
      return [[path[0], path[0], path.at(-1), path.at(-1)]];
    }
    const bezierPoints = [];
    let i;
    let [x0, y0] = path[0];
    for (i = 1; i < path.length - 2; i++) {
      const [x1, y1] = path[i];
      const [x2, y2] = path[i + 1];
      const x3 = (x1 + x2) / 2;
      const y3 = (y1 + y2) / 2;
      const control1 = [x0 + 2 * (x1 - x0) / 3, y0 + 2 * (y1 - y0) / 3];
      const control2 = [x3 + 2 * (x1 - x3) / 3, y3 + 2 * (y1 - y3) / 3];
      bezierPoints.push([[x0, y0], control1, control2, [x3, y3]]);
      [x0, y0] = [x3, y3];
    }
    const [x1, y1] = path[i];
    const [x2, y2] = path[i + 1];
    const control1 = [x0 + 2 * (x1 - x0) / 3, y0 + 2 * (y1 - y0) / 3];
    const control2 = [x2 + 2 * (x1 - x2) / 3, y2 + 2 * (y1 - y2) / 3];
    bezierPoints.push([[x0, y0], control1, control2, [x2, y2]]);
    return bezierPoints;
  }
  #redraw() {
    if (this.isEmpty()) {
      this.#updateTransform();
      return;
    }
    this.#setStroke();
    const {
      canvas,
      ctx
    } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.#updateTransform();
    for (const path of this.bezierPath2D) {
      ctx.stroke(path);
    }
  }
  commit() {
    if (this.#disableEditing) {
      return;
    }
    super.commit();
    this.isEditing = false;
    this.disableEditMode();
    this.setInForeground();
    this.#disableEditing = true;
    this.div.classList.add("disabled");
    this.#fitToContent(true);
    this.makeResizable();
    this.parent.addInkEditorIfNeeded(true);
    this.moveInDOM();
    this.div.focus({
      preventScroll: true
    });
  }
  focusin(event) {
    if (!this._focusEventsAllowed) {
      return;
    }
    super.focusin(event);
    this.enableEditMode();
  }
  canvasPointerdown(event) {
    if (event.button !== 0 || !this.isInEditMode() || this.#disableEditing) {
      return;
    }
    this.setInForeground();
    event.preventDefault();
    if (event.type !== "mouse") {
      this.div.focus();
    }
    this.#startDrawing(event.offsetX, event.offsetY);
  }
  canvasPointermove(event) {
    event.preventDefault();
    this.#draw(event.offsetX, event.offsetY);
  }
  canvasPointerup(event) {
    event.preventDefault();
    this.#endDrawing(event);
  }
  canvasPointerleave(event) {
    this.#endDrawing(event);
  }
  #endDrawing(event) {
    this.canvas.removeEventListener("pointerleave", this.#boundCanvasPointerleave);
    this.canvas.removeEventListener("pointermove", this.#boundCanvasPointermove);
    this.canvas.removeEventListener("pointerup", this.#boundCanvasPointerup);
    this.canvas.addEventListener("pointerdown", this.#boundCanvasPointerdown);
    setTimeout(() => {
      this.canvas.removeEventListener("contextmenu", _display_utils.noContextMenu);
    }, 10);
    this.#stopDrawing(event.offsetX, event.offsetY);
    this.addToAnnotationStorage();
    this.setInBackground();
  }
  #createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = 0;
    this.canvas.className = "inkEditorCanvas";
    _editor.AnnotationEditor._l10nPromise.get("editor_ink_canvas_aria_label").then(msg => this.canvas?.setAttribute("aria-label", msg));
    this.div.append(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  }
  #createObserver() {
    this.#observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      if (rect.width && rect.height) {
        this.setDimensions(rect.width, rect.height);
      }
    });
    this.#observer.observe(this.div);
  }
  get isResizable() {
    return !this.isEmpty() && this.#disableEditing;
  }
  render() {
    if (this.div) {
      return this.div;
    }
    let baseX, baseY;
    if (this.width) {
      baseX = this.x;
      baseY = this.y;
    }
    super.render();
    _editor.AnnotationEditor._l10nPromise.get("editor_ink2_aria_label").then(msg => this.div?.setAttribute("aria-label", msg));
    const [x, y, w, h] = this.#getInitialBBox();
    this.setAt(x, y, 0, 0);
    this.setDims(w, h);
    this.#createCanvas();
    if (this.width) {
      const [parentWidth, parentHeight] = this.parentDimensions;
      this.setAspectRatio(this.width * parentWidth, this.height * parentHeight);
      this.setAt(baseX * parentWidth, baseY * parentHeight, this.width * parentWidth, this.height * parentHeight);
      this.#isCanvasInitialized = true;
      this.#setCanvasDims();
      this.setDims(this.width * parentWidth, this.height * parentHeight);
      this.#redraw();
      this.div.classList.add("disabled");
    } else {
      this.div.classList.add("editing");
      this.enableEditMode();
    }
    this.#createObserver();
    return this.div;
  }
  #setCanvasDims() {
    if (!this.#isCanvasInitialized) {
      return;
    }
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.canvas.width = Math.ceil(this.width * parentWidth);
    this.canvas.height = Math.ceil(this.height * parentHeight);
    this.#updateTransform();
  }
  setDimensions(width, height) {
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    if (this.#realWidth === roundedWidth && this.#realHeight === roundedHeight) {
      return;
    }
    this.#realWidth = roundedWidth;
    this.#realHeight = roundedHeight;
    this.canvas.style.visibility = "hidden";
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.width = width / parentWidth;
    this.height = height / parentHeight;
    this.fixAndSetPosition();
    if (this.#disableEditing) {
      this.#setScaleFactor(width, height);
    }
    this.#setCanvasDims();
    this.#redraw();
    this.canvas.style.visibility = "visible";
    this.fixDims();
  }
  #setScaleFactor(width, height) {
    const padding = this.#getPadding();
    const scaleFactorW = (width - padding) / this.#baseWidth;
    const scaleFactorH = (height - padding) / this.#baseHeight;
    this.scaleFactor = Math.min(scaleFactorW, scaleFactorH);
  }
  #updateTransform() {
    const padding = this.#getPadding() / 2;
    this.ctx.setTransform(this.scaleFactor, 0, 0, this.scaleFactor, this.translationX * this.scaleFactor + padding, this.translationY * this.scaleFactor + padding);
  }
  static #buildPath2D(bezier) {
    const path2D = new Path2D();
    for (let i = 0, ii = bezier.length; i < ii; i++) {
      const [first, control1, control2, second] = bezier[i];
      if (i === 0) {
        path2D.moveTo(...first);
      }
      path2D.bezierCurveTo(control1[0], control1[1], control2[0], control2[1], second[0], second[1]);
    }
    return path2D;
  }
  static #toPDFCoordinates(points, rect, rotation) {
    const [blX, blY, trX, trY] = rect;
    switch (rotation) {
      case 0:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          points[i] += blX;
          points[i + 1] = trY - points[i + 1];
        }
        break;
      case 90:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          const x = points[i];
          points[i] = points[i + 1] + blX;
          points[i + 1] = x + blY;
        }
        break;
      case 180:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          points[i] = trX - points[i];
          points[i + 1] += blY;
        }
        break;
      case 270:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          const x = points[i];
          points[i] = trX - points[i + 1];
          points[i + 1] = trY - x;
        }
        break;
      default:
        throw new Error("Invalid rotation");
    }
    return points;
  }
  static #fromPDFCoordinates(points, rect, rotation) {
    const [blX, blY, trX, trY] = rect;
    switch (rotation) {
      case 0:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          points[i] -= blX;
          points[i + 1] = trY - points[i + 1];
        }
        break;
      case 90:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          const x = points[i];
          points[i] = points[i + 1] - blY;
          points[i + 1] = x - blX;
        }
        break;
      case 180:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          points[i] = trX - points[i];
          points[i + 1] -= blY;
        }
        break;
      case 270:
        for (let i = 0, ii = points.length; i < ii; i += 2) {
          const x = points[i];
          points[i] = trY - points[i + 1];
          points[i + 1] = trX - x;
        }
        break;
      default:
        throw new Error("Invalid rotation");
    }
    return points;
  }
  #serializePaths(s, tx, ty, rect) {
    const paths = [];
    const padding = this.thickness / 2;
    const shiftX = s * tx + padding;
    const shiftY = s * ty + padding;
    for (const bezier of this.paths) {
      const buffer = [];
      const points = [];
      for (let j = 0, jj = bezier.length; j < jj; j++) {
        const [first, control1, control2, second] = bezier[j];
        const p10 = s * first[0] + shiftX;
        const p11 = s * first[1] + shiftY;
        const p20 = s * control1[0] + shiftX;
        const p21 = s * control1[1] + shiftY;
        const p30 = s * control2[0] + shiftX;
        const p31 = s * control2[1] + shiftY;
        const p40 = s * second[0] + shiftX;
        const p41 = s * second[1] + shiftY;
        if (j === 0) {
          buffer.push(p10, p11);
          points.push(p10, p11);
        }
        buffer.push(p20, p21, p30, p31, p40, p41);
        points.push(p20, p21);
        if (j === jj - 1) {
          points.push(p40, p41);
        }
      }
      paths.push({
        bezier: InkEditor.#toPDFCoordinates(buffer, rect, this.rotation),
        points: InkEditor.#toPDFCoordinates(points, rect, this.rotation)
      });
    }
    return paths;
  }
  #getBbox() {
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const path of this.paths) {
      for (const [first, control1, control2, second] of path) {
        const bbox = _util.Util.bezierBoundingBox(...first, ...control1, ...control2, ...second);
        xMin = Math.min(xMin, bbox[0]);
        yMin = Math.min(yMin, bbox[1]);
        xMax = Math.max(xMax, bbox[2]);
        yMax = Math.max(yMax, bbox[3]);
      }
    }
    return [xMin, yMin, xMax, yMax];
  }
  #getPadding() {
    return this.#disableEditing ? Math.ceil(this.thickness * this.parentScale) : 0;
  }
  #fitToContent(firstTime = false) {
    if (this.isEmpty()) {
      return;
    }
    if (!this.#disableEditing) {
      this.#redraw();
      return;
    }
    const bbox = this.#getBbox();
    const padding = this.#getPadding();
    this.#baseWidth = Math.max(_editor.AnnotationEditor.MIN_SIZE, bbox[2] - bbox[0]);
    this.#baseHeight = Math.max(_editor.AnnotationEditor.MIN_SIZE, bbox[3] - bbox[1]);
    const width = Math.ceil(padding + this.#baseWidth * this.scaleFactor);
    const height = Math.ceil(padding + this.#baseHeight * this.scaleFactor);
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.width = width / parentWidth;
    this.height = height / parentHeight;
    this.setAspectRatio(width, height);
    const prevTranslationX = this.translationX;
    const prevTranslationY = this.translationY;
    this.translationX = -bbox[0];
    this.translationY = -bbox[1];
    this.#setCanvasDims();
    this.#redraw();
    this.#realWidth = width;
    this.#realHeight = height;
    this.setDims(width, height);
    const unscaledPadding = firstTime ? padding / this.scaleFactor / 2 : 0;
    this.translate(prevTranslationX - this.translationX - unscaledPadding, prevTranslationY - this.translationY - unscaledPadding);
  }
  static deserialize(data, parent, uiManager) {
    if (data instanceof _annotation_layer.InkAnnotationElement) {
      return null;
    }
    const editor = super.deserialize(data, parent, uiManager);
    editor.thickness = data.thickness;
    editor.color = _util.Util.makeHexColor(...data.color);
    editor.opacity = data.opacity;
    const [pageWidth, pageHeight] = editor.pageDimensions;
    const width = editor.width * pageWidth;
    const height = editor.height * pageHeight;
    const scaleFactor = editor.parentScale;
    const padding = data.thickness / 2;
    editor.#disableEditing = true;
    editor.#realWidth = Math.round(width);
    editor.#realHeight = Math.round(height);
    const {
      paths,
      rect,
      rotation
    } = data;
    for (let {
      bezier
    } of paths) {
      bezier = InkEditor.#fromPDFCoordinates(bezier, rect, rotation);
      const path = [];
      editor.paths.push(path);
      let p0 = scaleFactor * (bezier[0] - padding);
      let p1 = scaleFactor * (bezier[1] - padding);
      for (let i = 2, ii = bezier.length; i < ii; i += 6) {
        const p10 = scaleFactor * (bezier[i] - padding);
        const p11 = scaleFactor * (bezier[i + 1] - padding);
        const p20 = scaleFactor * (bezier[i + 2] - padding);
        const p21 = scaleFactor * (bezier[i + 3] - padding);
        const p30 = scaleFactor * (bezier[i + 4] - padding);
        const p31 = scaleFactor * (bezier[i + 5] - padding);
        path.push([[p0, p1], [p10, p11], [p20, p21], [p30, p31]]);
        p0 = p30;
        p1 = p31;
      }
      const path2D = this.#buildPath2D(path);
      editor.bezierPath2D.push(path2D);
    }
    const bbox = editor.#getBbox();
    editor.#baseWidth = Math.max(_editor.AnnotationEditor.MIN_SIZE, bbox[2] - bbox[0]);
    editor.#baseHeight = Math.max(_editor.AnnotationEditor.MIN_SIZE, bbox[3] - bbox[1]);
    editor.#setScaleFactor(width, height);
    return editor;
  }
  serialize() {
    if (this.isEmpty()) {
      return null;
    }
    const rect = this.getRect(0, 0);
    const color = _editor.AnnotationEditor._colorManager.convert(this.ctx.strokeStyle);
    return {
      annotationType: _util.AnnotationEditorType.INK,
      color,
      thickness: this.thickness,
      opacity: this.opacity,
      paths: this.#serializePaths(this.scaleFactor / this.parentScale, this.translationX, this.translationY, rect),
      pageIndex: this.pageIndex,
      rect,
      rotation: this.rotation,
      structTreeParentId: this._structTreeParentId
    };
  }
}
exports.InkEditor = InkEditor;

/***/ }),
/* 34 */
/***/ ((__unused_webpack_module, exports, __w_pdfjs_require__) => {



Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.StampEditor = void 0;
var _util = __w_pdfjs_require__(1);
var _editor = __w_pdfjs_require__(4);
var _display_utils = __w_pdfjs_require__(6);
var _annotation_layer = __w_pdfjs_require__(29);
class StampEditor extends _editor.AnnotationEditor {
  #bitmap = null;
  #bitmapId = null;
  #bitmapPromise = null;
  #bitmapUrl = null;
  #bitmapFile = null;
  #canvas = null;
  #observer = null;
  #resizeTimeoutId = null;
  #isSvg = false;
  #hasBeenAddedInUndoStack = false;
  static _type = "stamp";
  constructor(params) {
    super({
      ...params,
      name: "stampEditor"
    });
    this.#bitmapUrl = params.bitmapUrl;
    this.#bitmapFile = params.bitmapFile;
  }
  static initialize(l10n) {
    _editor.AnnotationEditor.initialize(l10n);
  }
  static get supportedTypes() {
    const types = ["apng", "avif", "bmp", "gif", "jpeg", "png", "svg+xml", "webp", "x-icon"];
    return (0, _util.shadow)(this, "supportedTypes", types.map(type => `image/${type}`));
  }
  static get supportedTypesStr() {
    return (0, _util.shadow)(this, "supportedTypesStr", this.supportedTypes.join(","));
  }
  static isHandlingMimeForPasting(mime) {
    return this.supportedTypes.includes(mime);
  }
  static paste(item, parent) {
    parent.pasteEditor(_util.AnnotationEditorType.STAMP, {
      bitmapFile: item.getAsFile()
    });
  }
  #getBitmapFetched(data, fromId = false) {
    if (!data) {
      this.remove();
      return;
    }
    this.#bitmap = data.bitmap;
    if (!fromId) {
      this.#bitmapId = data.id;
      this.#isSvg = data.isSvg;
    }
    this.#createCanvas();
  }
  #getBitmapDone() {
    this.#bitmapPromise = null;
    this._uiManager.enableWaiting(false);
    if (this.#canvas) {
      this.div.focus();
    }
  }
  #getBitmap() {
    if (this.#bitmapId) {
      this._uiManager.enableWaiting(true);
      this._uiManager.imageManager.getFromId(this.#bitmapId).then(data => this.#getBitmapFetched(data, true)).finally(() => this.#getBitmapDone());
      return;
    }
    if (this.#bitmapUrl) {
      const url = this.#bitmapUrl;
      this.#bitmapUrl = null;
      this._uiManager.enableWaiting(true);
      this.#bitmapPromise = this._uiManager.imageManager.getFromUrl(url).then(data => this.#getBitmapFetched(data)).finally(() => this.#getBitmapDone());
      return;
    }
    if (this.#bitmapFile) {
      const file = this.#bitmapFile;
      this.#bitmapFile = null;
      this._uiManager.enableWaiting(true);
      this.#bitmapPromise = this._uiManager.imageManager.getFromFile(file).then(data => this.#getBitmapFetched(data)).finally(() => this.#getBitmapDone());
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = StampEditor.supportedTypesStr;
    this.#bitmapPromise = new Promise(resolve => {
      input.addEventListener("change", async () => {
        if (!input.files || input.files.length === 0) {
          this.remove();
        } else {
          this._uiManager.enableWaiting(true);
          const data = await this._uiManager.imageManager.getFromFile(input.files[0]);
          this.#getBitmapFetched(data);
        }
        resolve();
      });
      input.addEventListener("cancel", () => {
        this.remove();
        resolve();
      });
    }).finally(() => this.#getBitmapDone());
    input.click();
  }
  remove() {
    if (this.#bitmapId) {
      this.#bitmap = null;
      this._uiManager.imageManager.deleteId(this.#bitmapId);
      this.#canvas?.remove();
      this.#canvas = null;
      this.#observer?.disconnect();
      this.#observer = null;
    }
    super.remove();
  }
  rebuild() {
    if (!this.parent) {
      if (this.#bitmapId) {
        this.#getBitmap();
      }
      return;
    }
    super.rebuild();
    if (this.div === null) {
      return;
    }
    if (this.#bitmapId) {
      this.#getBitmap();
    }
    if (!this.isAttachedToDOM) {
      this.parent.add(this);
    }
  }
  onceAdded() {
    this._isDraggable = true;
    this.div.focus();
  }
  isEmpty() {
    return !(this.#bitmapPromise || this.#bitmap || this.#bitmapUrl || this.#bitmapFile);
  }
  get isResizable() {
    return true;
  }
  render() {
    if (this.div) {
      return this.div;
    }
    let baseX, baseY;
    if (this.width) {
      baseX = this.x;
      baseY = this.y;
    }
    super.render();
    this.div.hidden = true;
    if (this.#bitmap) {
      this.#createCanvas();
    } else {
      this.#getBitmap();
    }
    if (this.width) {
      const [parentWidth, parentHeight] = this.parentDimensions;
      this.setAt(baseX * parentWidth, baseY * parentHeight, this.width * parentWidth, this.height * parentHeight);
    }
    return this.div;
  }
  #createCanvas() {
    const {
      div
    } = this;
    let {
      width,
      height
    } = this.#bitmap;
    const [pageWidth, pageHeight] = this.pageDimensions;
    const MAX_RATIO = 0.75;
    if (this.width) {
      width = this.width * pageWidth;
      height = this.height * pageHeight;
    } else if (width > MAX_RATIO * pageWidth || height > MAX_RATIO * pageHeight) {
      const factor = Math.min(MAX_RATIO * pageWidth / width, MAX_RATIO * pageHeight / height);
      width *= factor;
      height *= factor;
    }
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.setDims(width * parentWidth / pageWidth, height * parentHeight / pageHeight);
    this._uiManager.enableWaiting(false);
    const canvas = this.#canvas = document.createElement("canvas");
    div.append(canvas);
    div.hidden = false;
    this.#drawBitmap(width, height);
    this.#createObserver();
    if (!this.#hasBeenAddedInUndoStack) {
      this.parent.addUndoableEditor(this);
      this.#hasBeenAddedInUndoStack = true;
    }
    this._uiManager._eventBus.dispatch("reporttelemetry", {
      source: this,
      details: {
        type: "editing",
        subtype: this.editorType,
        data: {
          action: "inserted_image"
        }
      }
    });
    this.addAltTextButton();
  }
  #setDimensions(width, height) {
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.width = width / parentWidth;
    this.height = height / parentHeight;
    this.setDims(width, height);
    if (this._initialOptions?.isCentered) {
      this.center();
    } else {
      this.fixAndSetPosition();
    }
    this._initialOptions = null;
    if (this.#resizeTimeoutId !== null) {
      clearTimeout(this.#resizeTimeoutId);
    }
    const TIME_TO_WAIT = 200;
    this.#resizeTimeoutId = setTimeout(() => {
      this.#resizeTimeoutId = null;
      this.#drawBitmap(width, height);
    }, TIME_TO_WAIT);
  }
  #scaleBitmap(width, height) {
    const {
      width: bitmapWidth,
      height: bitmapHeight
    } = this.#bitmap;
    let newWidth = bitmapWidth;
    let newHeight = bitmapHeight;
    let bitmap = this.#bitmap;
    while (newWidth > 2 * width || newHeight > 2 * height) {
      const prevWidth = newWidth;
      const prevHeight = newHeight;
      if (newWidth > 2 * width) {
        newWidth = newWidth >= 16384 ? Math.floor(newWidth / 2) - 1 : Math.ceil(newWidth / 2);
      }
      if (newHeight > 2 * height) {
        newHeight = newHeight >= 16384 ? Math.floor(newHeight / 2) - 1 : Math.ceil(newHeight / 2);
      }
      const offscreen = new OffscreenCanvas(newWidth, newHeight);
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, prevWidth, prevHeight, 0, 0, newWidth, newHeight);
      bitmap = offscreen.transferToImageBitmap();
    }
    return bitmap;
  }
  #drawBitmap(width, height) {
    width = Math.ceil(width);
    height = Math.ceil(height);
    const canvas = this.#canvas;
    if (!canvas || canvas.width === width && canvas.height === height) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    const bitmap = this.#isSvg ? this.#bitmap : this.#scaleBitmap(width, height);
    const ctx = canvas.getContext("2d");
    ctx.filter = this._uiManager.hcmFilter;
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height);
  }
  #serializeBitmap(toUrl) {
    if (toUrl) {
      if (this.#isSvg) {
        const url = this._uiManager.imageManager.getSvgUrl(this.#bitmapId);
        if (url) {
          return url;
        }
      }
      const canvas = document.createElement("canvas");
      ({
        width: canvas.width,
        height: canvas.height
      } = this.#bitmap);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this.#bitmap, 0, 0);
      return canvas.toDataURL();
    }
    if (this.#isSvg) {
      const [pageWidth, pageHeight] = this.pageDimensions;
      const width = Math.round(this.width * pageWidth * _display_utils.PixelsPerInch.PDF_TO_CSS_UNITS);
      const height = Math.round(this.height * pageHeight * _display_utils.PixelsPerInch.PDF_TO_CSS_UNITS);
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(this.#bitmap, 0, 0, this.#bitmap.width, this.#bitmap.height, 0, 0, width, height);
      return offscreen.transferToImageBitmap();
    }
    return structuredClone(this.#bitmap);
  }
  #createObserver() {
    this.#observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      if (rect.width && rect.height) {
        this.#setDimensions(rect.width, rect.height);
      }
    });
    this.#observer.observe(this.div);
  }
  static deserialize(data, parent, uiManager) {
    if (data instanceof _annotation_layer.StampAnnotationElement) {
      return null;
    }
    const editor = super.deserialize(data, parent, uiManager);
    const {
      rect,
      bitmapUrl,
      bitmapId,
      isSvg,
      accessibilityData
    } = data;
    if (bitmapId && uiManager.imageManager.isValidId(bitmapId)) {
      editor.#bitmapId = bitmapId;
    } else {
      editor.#bitmapUrl = bitmapUrl;
    }
    editor.#isSvg = isSvg;
    const [parentWidth, parentHeight] = editor.pageDimensions;
    editor.width = (rect[2] - rect[0]) / parentWidth;
    editor.height = (rect[3] - rect[1]) / parentHeight;
    if (accessibilityData) {
      editor.altTextData = accessibilityData;
    }
    return editor;
  }
  serialize(isForCopying = false, context = null) {
    if (this.isEmpty()) {
      return null;
    }
    const serialized = {
      annotationType: _util.AnnotationEditorType.STAMP,
      bitmapId: this.#bitmapId,
      pageIndex: this.pageIndex,
      rect: this.getRect(0, 0),
      rotation: this.rotation,
      isSvg: this.#isSvg,
      structTreeParentId: this._structTreeParentId
    };
    if (isForCopying) {
      serialized.bitmapUrl = this.#serializeBitmap(true);
      serialized.accessibilityData = this.altTextData;
      return serialized;
    }
    const {
      decorative,
      altText
    } = this.altTextData;
    if (!decorative && altText) {
      serialized.accessibilityData = {
        type: "Figure",
        alt: altText
      };
    }
    if (context === null) {
      return serialized;
    }
    context.stamps ||= new Map();
    const area = this.#isSvg ? (serialized.rect[2] - serialized.rect[0]) * (serialized.rect[3] - serialized.rect[1]) : null;
    if (!context.stamps.has(this.#bitmapId)) {
      context.stamps.set(this.#bitmapId, {
        area,
        serialized
      });
      serialized.bitmap = this.#serializeBitmap(false);
    } else if (this.#isSvg) {
      const prevData = context.stamps.get(this.#bitmapId);
      if (area > prevData.area) {
        prevData.area = area;
        prevData.serialized.bitmap.close();
        prevData.serialized.bitmap = this.#serializeBitmap(false);
      }
    }
    return serialized;
  }
}
exports.StampEditor = StampEditor;

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __w_pdfjs_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __w_pdfjs_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
Object.defineProperty(exports, "AbortException", ({
  enumerable: true,
  get: function () {
    return _util.AbortException;
  }
}));
Object.defineProperty(exports, "AnnotationEditorLayer", ({
  enumerable: true,
  get: function () {
    return _annotation_editor_layer.AnnotationEditorLayer;
  }
}));
Object.defineProperty(exports, "AnnotationEditorParamsType", ({
  enumerable: true,
  get: function () {
    return _util.AnnotationEditorParamsType;
  }
}));
Object.defineProperty(exports, "AnnotationEditorType", ({
  enumerable: true,
  get: function () {
    return _util.AnnotationEditorType;
  }
}));
Object.defineProperty(exports, "AnnotationEditorUIManager", ({
  enumerable: true,
  get: function () {
    return _tools.AnnotationEditorUIManager;
  }
}));
Object.defineProperty(exports, "AnnotationLayer", ({
  enumerable: true,
  get: function () {
    return _annotation_layer.AnnotationLayer;
  }
}));
Object.defineProperty(exports, "AnnotationMode", ({
  enumerable: true,
  get: function () {
    return _util.AnnotationMode;
  }
}));
Object.defineProperty(exports, "CMapCompressionType", ({
  enumerable: true,
  get: function () {
    return _util.CMapCompressionType;
  }
}));
Object.defineProperty(exports, "DOMSVGFactory", ({
  enumerable: true,
  get: function () {
    return _display_utils.DOMSVGFactory;
  }
}));
Object.defineProperty(exports, "FeatureTest", ({
  enumerable: true,
  get: function () {
    return _util.FeatureTest;
  }
}));
Object.defineProperty(exports, "GlobalWorkerOptions", ({
  enumerable: true,
  get: function () {
    return _worker_options.GlobalWorkerOptions;
  }
}));
Object.defineProperty(exports, "ImageKind", ({
  enumerable: true,
  get: function () {
    return _util.ImageKind;
  }
}));
Object.defineProperty(exports, "InvalidPDFException", ({
  enumerable: true,
  get: function () {
    return _util.InvalidPDFException;
  }
}));
Object.defineProperty(exports, "MissingPDFException", ({
  enumerable: true,
  get: function () {
    return _util.MissingPDFException;
  }
}));
Object.defineProperty(exports, "OPS", ({
  enumerable: true,
  get: function () {
    return _util.OPS;
  }
}));
Object.defineProperty(exports, "PDFDataRangeTransport", ({
  enumerable: true,
  get: function () {
    return _api.PDFDataRangeTransport;
  }
}));
Object.defineProperty(exports, "PDFDateString", ({
  enumerable: true,
  get: function () {
    return _display_utils.PDFDateString;
  }
}));
Object.defineProperty(exports, "PDFWorker", ({
  enumerable: true,
  get: function () {
    return _api.PDFWorker;
  }
}));
Object.defineProperty(exports, "PasswordResponses", ({
  enumerable: true,
  get: function () {
    return _util.PasswordResponses;
  }
}));
Object.defineProperty(exports, "PermissionFlag", ({
  enumerable: true,
  get: function () {
    return _util.PermissionFlag;
  }
}));
Object.defineProperty(exports, "PixelsPerInch", ({
  enumerable: true,
  get: function () {
    return _display_utils.PixelsPerInch;
  }
}));
Object.defineProperty(exports, "PromiseCapability", ({
  enumerable: true,
  get: function () {
    return _util.PromiseCapability;
  }
}));
Object.defineProperty(exports, "RenderingCancelledException", ({
  enumerable: true,
  get: function () {
    return _display_utils.RenderingCancelledException;
  }
}));
Object.defineProperty(exports, "SVGGraphics", ({
  enumerable: true,
  get: function () {
    return _api.SVGGraphics;
  }
}));
Object.defineProperty(exports, "UnexpectedResponseException", ({
  enumerable: true,
  get: function () {
    return _util.UnexpectedResponseException;
  }
}));
Object.defineProperty(exports, "Util", ({
  enumerable: true,
  get: function () {
    return _util.Util;
  }
}));
Object.defineProperty(exports, "VerbosityLevel", ({
  enumerable: true,
  get: function () {
    return _util.VerbosityLevel;
  }
}));
Object.defineProperty(exports, "XfaLayer", ({
  enumerable: true,
  get: function () {
    return _xfa_layer.XfaLayer;
  }
}));
Object.defineProperty(exports, "build", ({
  enumerable: true,
  get: function () {
    return _api.build;
  }
}));
Object.defineProperty(exports, "createValidAbsoluteUrl", ({
  enumerable: true,
  get: function () {
    return _util.createValidAbsoluteUrl;
  }
}));
Object.defineProperty(exports, "getDocument", ({
  enumerable: true,
  get: function () {
    return _api.getDocument;
  }
}));
Object.defineProperty(exports, "getFilenameFromUrl", ({
  enumerable: true,
  get: function () {
    return _display_utils.getFilenameFromUrl;
  }
}));
Object.defineProperty(exports, "getPdfFilenameFromUrl", ({
  enumerable: true,
  get: function () {
    return _display_utils.getPdfFilenameFromUrl;
  }
}));
Object.defineProperty(exports, "getXfaPageViewport", ({
  enumerable: true,
  get: function () {
    return _display_utils.getXfaPageViewport;
  }
}));
Object.defineProperty(exports, "isDataScheme", ({
  enumerable: true,
  get: function () {
    return _display_utils.isDataScheme;
  }
}));
Object.defineProperty(exports, "isPdfFile", ({
  enumerable: true,
  get: function () {
    return _display_utils.isPdfFile;
  }
}));
Object.defineProperty(exports, "loadScript", ({
  enumerable: true,
  get: function () {
    return _display_utils.loadScript;
  }
}));
Object.defineProperty(exports, "noContextMenu", ({
  enumerable: true,
  get: function () {
    return _display_utils.noContextMenu;
  }
}));
Object.defineProperty(exports, "normalizeUnicode", ({
  enumerable: true,
  get: function () {
    return _util.normalizeUnicode;
  }
}));
Object.defineProperty(exports, "renderTextLayer", ({
  enumerable: true,
  get: function () {
    return _text_layer.renderTextLayer;
  }
}));
Object.defineProperty(exports, "setLayerDimensions", ({
  enumerable: true,
  get: function () {
    return _display_utils.setLayerDimensions;
  }
}));
Object.defineProperty(exports, "shadow", ({
  enumerable: true,
  get: function () {
    return _util.shadow;
  }
}));
Object.defineProperty(exports, "updateTextLayer", ({
  enumerable: true,
  get: function () {
    return _text_layer.updateTextLayer;
  }
}));
Object.defineProperty(exports, "version", ({
  enumerable: true,
  get: function () {
    return _api.version;
  }
}));
var _util = __w_pdfjs_require__(1);
var _api = __w_pdfjs_require__(2);
var _display_utils = __w_pdfjs_require__(6);
var _text_layer = __w_pdfjs_require__(26);
var _annotation_editor_layer = __w_pdfjs_require__(27);
var _tools = __w_pdfjs_require__(5);
var _annotation_layer = __w_pdfjs_require__(29);
var _worker_options = __w_pdfjs_require__(14);
var _xfa_layer = __w_pdfjs_require__(32);
const pdfjsVersion = '3.11.174';
const pdfjsBuild = 'ce8716743';
})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=pdf.js.map