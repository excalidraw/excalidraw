/* eslint-disable @typescript-eslint/no-namespace */
import { Options } from "cypress-image-snapshot";

declare namespace Cypress {
  interface Chainable {
    matchImageSnapshot(nameOrOptions?: string | Options): void;
    matchImageSnapshot(name: string, options: Options): void;
  }
}
