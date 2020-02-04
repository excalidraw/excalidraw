import { addMatchImageSnapshotCommand } from "cypress-image-snapshot/command";

import "./commands";
addMatchImageSnapshotCommand({
  failureThreshold: 0.01,
  failureThresholdType: "percent",
});
