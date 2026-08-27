// Import the original mapper
import Highlight from "@site/src/components/Highlight";
import MDXComponents from "@theme-original/MDXComponents";

export default {
  // Re-use the default mapping
  ...MDXComponents,
  // Map the "highlight" tag to our <Highlight /> component!
  // `Highlight` will receive all props that were passed to `highlight` in MDX
  highlight: Highlight,
};
