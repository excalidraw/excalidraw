// Custom matchers and snapshot serializers. Imported for its side effects by
// test-utils and the test helpers, so every test that uses any of them gets
// these registered.

expect.extend({
  toBeNonNaNNumber(received) {
    const pass = typeof received === "number" && !isNaN(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a non-NaN number`,
        pass: true,
      };
    }
    return {
      message: () => `expected ${received} to be a non-NaN number`,
      pass: false,
    };
  },
});

/**
 * Serializer for IEE754 float pointing numbers to avoid random failures due to tiny precision differences
 */
expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    return printer(val.toFixed(5), config, indentation, depth, refs);
  },
  test(val) {
    return (
      typeof val === "number" &&
      Number.isFinite(val) &&
      !Number.isNaN(val) &&
      !Number.isInteger(val)
    );
  },
});
