import { ExcalidrawImperativeAPI } from "../../../types";
import {
  EmptyExtension,
  setEmptyExtensionLoadable,
  useEmptyExtension,
} from "./empty";
import {
  MathJaxExtension,
  setMathJaxExtensionLoadable,
  useMathJaxExtension,
} from "./mathjax";

// Extension authors: do imports like follows:
// ```
// import {
//   MyExtension,
//   setMyExtensionLoadable,
//   useMyExtension,
// } from "./myExtension";
// ```

// Extension authors: include `MyExtension` in `validExtensions`
const validExtensions: readonly string[] = [EmptyExtension, MathJaxExtension];
const extensionsUsed: string[] = [];

// The main invocation hook for use in the UI
export const useExtensions = (
  api: ExcalidrawImperativeAPI | null,
  extensions?: string[],
) => {
  selectExtensionsToLoad(extensions);
  useEmptyExtension(api);
  useMathJaxExtension(api);
  // Extension authors: add a line here like `useMyExtension();`
};

// This MUST be called before the `useExtension`/`testExtension` calls.
const selectExtensionsToLoad = (extensions?: string[]) => {
  const extensionList: string[] = [];
  if (extensions === undefined) {
    extensionList.push(...validExtensions);
  } else {
    extensions.forEach(
      (val) => validExtensions.includes(val) && extensionList.push(val),
    );
  }
  while (extensionsUsed.length > 0) {
    extensionsUsed.pop();
  }
  extensionsUsed.push(...extensionList);
  setLoadableExtensions();
};

const setLoadableExtensions = () => {
  setEmptyExtensionLoadable(extensionsUsed.includes(EmptyExtension));
  setMathJaxExtensionLoadable(extensionsUsed.includes(MathJaxExtension));
  // Extension authors: add a line here like
  // `setMyExtensionLoadable(extensionsUsed.includes(MyExtension));`
};
