import { Handle, Position, type NodeProps } from "@xyflow/react";

type ContainerData = {
  label?: string;
  containerType?: string | null;
};

export function TerraformContainerNode({ data, selected }: NodeProps) {
  const d = (data || {}) as ContainerData;
  const label = d.label || "container";
  const type = d.containerType || "container";

  return (
    <div className={`tf-container${selected ? " tf-container--selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="tf-handle" />
      <Handle type="source" position={Position.Right} className="tf-handle" />
      <div className="tf-container__label">{label}</div>
      <div className="tf-container__type">{type}</div>
    </div>
  );
}
