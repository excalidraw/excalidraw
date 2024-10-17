/**
 * Modified version of hb-subset bindings from "subset-font" package https://github.com/papandreou/subset-font/blob/3f711c8aa29a426c7f22655861abfb976950f527/index.js
 * 
 * CHANGELOG:
 * - removed dependency on node APIs to work inside the browser
 * - removed dependency on font fontverter for brotli compression
 * - removed dependencies on lodash and p-limit
 * - removed options for preserveNameIds, variationAxes, noLayoutClosure (not needed for now)
 * - replaced text input with codepoints
 * - rewritten in typescript and with esm modules

Copyright (c) 2012, Andreas Lind Petersen
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in
    the documentation and/or other materials provided with the
    distribution.
  * Neither the name of the author nor the names of contributors may
    be used to endorse or promote products derived from this
    software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// function HB_TAG(str) {
//   return str.split("").reduce((a, ch) => {
//     return (a << 8) + ch.charCodeAt(0);
//   }, 0);
// }

function subset(
  hbSubsetWasm: any,
  heapu8: Uint8Array,
  font: ArrayBuffer,
  codePoints: ReadonlySet<number>,
) {
  const input = hbSubsetWasm.hb_subset_input_create_or_fail();
  if (input === 0) {
    throw new Error(
      "hb_subset_input_create_or_fail (harfbuzz) returned zero, indicating failure",
    );
  }

  const fontBuffer = hbSubsetWasm.malloc(font.byteLength);
  heapu8.set(new Uint8Array(font), fontBuffer);

  // Create the face
  const blob = hbSubsetWasm.hb_blob_create(
    fontBuffer,
    font.byteLength,
    2, // HB_MEMORY_MODE_WRITABLE
    0,
    0,
  );
  const face = hbSubsetWasm.hb_face_create(blob, 0);
  hbSubsetWasm.hb_blob_destroy(blob);

  // Do the equivalent of --font-features=*
  const layoutFeatures = hbSubsetWasm.hb_subset_input_set(
    input,
    6, // HB_SUBSET_SETS_LAYOUT_FEATURE_TAG
  );
  hbSubsetWasm.hb_set_clear(layoutFeatures);
  hbSubsetWasm.hb_set_invert(layoutFeatures);

  // if (preserveNameIds) {
  //   const inputNameIds = harfbuzzJsWasm.hb_subset_input_set(
  //     input,
  //     4, // HB_SUBSET_SETS_NAME_ID
  //   );
  //   for (const nameId of preserveNameIds) {
  //     harfbuzzJsWasm.hb_set_add(inputNameIds, nameId);
  //   }
  // }

  // if (noLayoutClosure) {
  //   harfbuzzJsWasm.hb_subset_input_set_flags(
  //     input,
  //     harfbuzzJsWasm.hb_subset_input_get_flags(input) | 0x00000200, // HB_SUBSET_FLAGS_NO_LAYOUT_CLOSURE
  //   );
  // }

  // Add unicodes indices
  const inputUnicodes = hbSubsetWasm.hb_subset_input_unicode_set(input);
  for (const c of codePoints) {
    hbSubsetWasm.hb_set_add(inputUnicodes, c);
  }

  // if (variationAxes) {
  //   for (const [axisName, value] of Object.entries(variationAxes)) {
  //     if (typeof value === "number") {
  //       // Simple case: Pin/instance the variation axis to a single value
  //       if (
  //         !harfbuzzJsWasm.hb_subset_input_pin_axis_location(
  //           input,
  //           face,
  //           HB_TAG(axisName),
  //           value,
  //         )
  //       ) {
  //         harfbuzzJsWasm.hb_face_destroy(face);
  //         harfbuzzJsWasm.free(fontBuffer);
  //         throw new Error(
  //           `hb_subset_input_pin_axis_location (harfbuzz) returned zero when pinning ${axisName} to ${value}, indicating failure. Maybe the axis does not exist in the font?`,
  //         );
  //       }
  //     } else if (value && typeof value === "object") {
  //       // Complex case: Reduce the variation space of the axis
  //       if (
  //         typeof value.min === "undefined" ||
  //         typeof value.max === "undefined"
  //       ) {
  //         harfbuzzJsWasm.hb_face_destroy(face);
  //         harfbuzzJsWasm.free(fontBuffer);
  //         throw new Error(
  //           `${axisName}: You must provide both a min and a max value when setting the axis range`,
  //         );
  //       }
  //       if (
  //         !harfbuzzJsWasm.hb_subset_input_set_axis_range(
  //           input,
  //           face,
  //           HB_TAG(axisName),
  //           value.min,
  //           value.max,
  //           // An explicit NaN makes harfbuzz use the existing default value, clamping to the new range if necessary
  //           value.default ?? NaN,
  //         )
  //       ) {
  //         harfbuzzJsWasm.hb_face_destroy(face);
  //         harfbuzzJsWasm.free(fontBuffer);
  //         throw new Error(
  //           `hb_subset_input_set_axis_range (harfbuzz) returned zero when setting the range of ${axisName} to [${value.min}; ${value.max}] and a default value of ${value.default}, indicating failure. Maybe the axis does not exist in the font?`,
  //         );
  //       }
  //     }
  //   }
  // }

  let subset;
  try {
    subset = hbSubsetWasm.hb_subset_or_fail(face, input);
    if (subset === 0) {
      hbSubsetWasm.hb_face_destroy(face);
      hbSubsetWasm.free(fontBuffer);
      throw new Error(
        "hb_subset_or_fail (harfbuzz) returned zero, indicating failure. Maybe the input file is corrupted?",
      );
    }
  } finally {
    // Clean up
    hbSubsetWasm.hb_subset_input_destroy(input);
  }

  // Get result blob
  const result = hbSubsetWasm.hb_face_reference_blob(subset);

  const offset = hbSubsetWasm.hb_blob_get_data(result, 0);
  const subsetByteLength = hbSubsetWasm.hb_blob_get_length(result);
  if (subsetByteLength === 0) {
    hbSubsetWasm.hb_blob_destroy(result);
    hbSubsetWasm.hb_face_destroy(subset);
    hbSubsetWasm.hb_face_destroy(face);
    hbSubsetWasm.free(fontBuffer);
    throw new Error(
      "Failed to create subset font, maybe the input file is corrupted?",
    );
  }

  const subsetFont = new Uint8Array(
    heapu8.subarray(offset, offset + subsetByteLength),
  );

  // Clean up
  hbSubsetWasm.hb_blob_destroy(result);
  hbSubsetWasm.hb_face_destroy(subset);
  hbSubsetWasm.hb_face_destroy(face);
  hbSubsetWasm.free(fontBuffer);

  return subsetFont;
}

export default {
  subset,
};
