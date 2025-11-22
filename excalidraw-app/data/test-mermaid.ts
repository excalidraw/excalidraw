// Quick test for Mermaid parsing

import { parseMermaidFlowchart } from "./mermaidParser";
import { calculateLayout } from "./mermaidLayout";

const testCode = `graph TD
subgraph Frontend
WI[Web Interface]
end
subgraph Configuration
CRC[Cloud Run Config]
EV[Environment Variables]
end
subgraph Cloud Run Service
subgraph FastAPI Backend
DS[/api/derm-suggest/]
H[/api/health/]
GA[/api/gemini-analyze/]
PS[/api/product-suggestion/]
end
APP[FastAPI App]
end
subgraph Google Cloud Services
VAI[Vertex AI]
GEM[Gemini AI]
SA[Service Account]
end
WI --> APP
CRC --> APP
EV --> APP
APP --> SA
DS --> VAI
H --> VAI
GA --> GEM
PS --> GEM
PS --> APP`;

console.log("Testing Mermaid Parser...");
try {
  const graph = parseMermaidFlowchart(testCode);
  console.log("Parsed graph:", graph);
  console.log("Nodes:", graph.nodes.length);
  console.log("Edges:", graph.edges.length);

  const layout = calculateLayout(graph);
  console.log("Layout calculated:", layout.length, "nodes");
} catch (error) {
  console.error("Error:", error);
}
