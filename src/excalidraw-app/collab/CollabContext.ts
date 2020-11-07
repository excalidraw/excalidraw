import { createContext } from "react";

const { Provider: CollabProvider, Consumer: CollabConsumer } = createContext(
  {},
);

export { CollabProvider, CollabConsumer };
