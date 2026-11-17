import fs from "fs";
import path from "path";

import { APP_ROUTES } from "../app_routes";

describe("app routes", () => {
  it("should each have a rewrite to the app in vercel.json, and vice versa", () => {
    const vercelConfig: {
      rewrites?: { source: string; destination: string }[];
    } = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../vercel.json"), "utf8"),
    );

    const rewrittenToApp = (vercelConfig.rewrites ?? [])
      .filter((rewrite) => rewrite.destination === "/index.html")
      .map((rewrite) => rewrite.source);

    expect(rewrittenToApp.sort()).toEqual(Object.values(APP_ROUTES).sort());
  });
});
