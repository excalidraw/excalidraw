/* eslint-disable @typescript-eslint/no-namespace */
import { Options } from "cypress-image-snapshot";

type Point = { x: number; y: number };
declare namespace Cypress {
  interface Chainable {
    matchImageSnapshot(nameOrOptions?: string | Options): void;
    matchImageSnapshot(name: string, options: Options): void;
    drag(start: Point, end: Point, button?: number): void;
  }
}
