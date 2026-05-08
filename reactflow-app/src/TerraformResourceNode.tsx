import { Handle, Position, type NodeProps } from "@xyflow/react";

type ResourceData = {
  label?: string;
  kind?: string;
  resourceType?: string | null;
  action?: string | null;
};

function actionClass(action?: string | null) {
  switch (action) {
    case "create":
      return "tf-node--create";
    case "update":
      return "tf-node--update";
    case "delete":
      return "tf-node--delete";
    default:
      return "tf-node--existing";
  }
}

export function TerraformResourceNode({ data, selected }: NodeProps) {
  const d = (data || {}) as ResourceData;
  const label = d.label || "resource";
  const [title, subtitle] = label.split("\n");
  const kind = d.kind || "resource";
  const resourceType = d.resourceType || "unknown";

  return (
    <div className={`tf-node ${actionClass(d.action)}${selected ? " tf-node--selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="tf-handle" />
      <Handle type="source" position={Position.Right} className="tf-handle" />
      <div className="tf-node__header">
        <span className="tf-node__title" title={title}>
          {title}
        </span>
        <span className="tf-node__kind">{kind}</span>
      </div>
      {subtitle ? (
        <div className="tf-node__subtitle" title={subtitle}>
          {subtitle}
        </div>
      ) : null}
      <div className="tf-node__meta" title={resourceType}>
        {resourceType}
      </div>
    </div>
  );
}
