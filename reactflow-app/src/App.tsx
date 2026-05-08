import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Edge,
  type Node,
} from "@xyflow/react";
import { UploadPanel, type ReactFlowScene } from "./UploadPanel";
import { TerraformResourceNode } from "./TerraformResourceNode";
import { TerraformContainerNode } from "./TerraformContainerNode";

const nodeTypes: NodeTypes = {
  default: TerraformResourceNode,
  tfResource: TerraformResourceNode,
  tfContainer: TerraformContainerNode,
};

export default function App() {
  const [scene, setScene] = useState<ReactFlowScene | null>(null);

  const handleSceneLoaded = useCallback((nextScene: ReactFlowScene) => {
    setScene(nextScene);
  }, []);

  const nodes = useMemo<Node[]>(() => scene?.nodes || [], [scene]);
  const edges = useMemo<Edge[]>(() => scene?.edges || [], [scene]);

  return (
    <div className="app">
      <UploadPanel onSceneLoaded={handleSceneLoaded} />
      <div className="canvas-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          selectionOnDrag
          defaultEdgeOptions={{ animated: false }}
        >
          <MiniMap pannable zoomable />
          <Controls />
          <Background gap={24} />
        </ReactFlow>
      </div>
      <div className="hint">
        {scene?.meta?.edgePolicy === "intra-module-only"
          ? `Showing subflows with only intra-module edges for now. Layout: ${scene?.meta?.layoutEngine || "elk"}.`
          : "Upload Terraform plan + DOT to render subflows."}
      </div>
    </div>
  );
}
