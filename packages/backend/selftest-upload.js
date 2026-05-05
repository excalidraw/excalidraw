/**
 * One-shot script: builds a tiny plan+dot in a temp dir, POSTs to the backend, prints upload id.
 * Run from repo root with backend up: `node packages/backend/selftest-upload.js` (optional `BACKEND_URL`).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

async function main() {
  const baseUrl = process.env.BACKEND_URL || "http://localhost:3000";

  const plan = {
    format_version: "1.2",
    terraform_version: "1.7.0",
    resource_changes: [
      {
        address: "aws_vpc.main",
        mode: "managed",
        type: "aws_vpc",
        name: "main",
        change: {
          actions: ["create"],
          after: { id: "vpc-1234abcd", cidr_block: "10.0.0.0/16" },
        },
      },
      {
        address: "aws_subnet.private",
        mode: "managed",
        type: "aws_subnet",
        name: "private",
        change: {
          actions: ["create"],
          after: {
            id: "subnet-1234abcd",
            vpc_id: "vpc-1234abcd",
            cidr_block: "10.0.1.0/24",
          },
        },
      },
      {
        address: "aws_route_table.private",
        mode: "managed",
        type: "aws_route_table",
        name: "private",
        change: {
          actions: ["create"],
          after: { id: "rtb-1234abcd", vpc_id: "vpc-1234abcd" },
        },
      },
      {
        address: "aws_route.private_default",
        mode: "managed",
        type: "aws_route",
        name: "private_default",
        change: {
          actions: ["create"],
          after: {
            route_table_id: "rtb-1234abcd",
            nat_gateway_id: "nat-1234abcd",
            destination_cidr_block: "0.0.0.0/0",
          },
        },
      },
      {
        address: "aws_route_table_association.private",
        mode: "managed",
        type: "aws_route_table_association",
        name: "private",
        change: {
          actions: ["create"],
          after: {
            subnet_id: "subnet-1234abcd",
            route_table_id: "rtb-1234abcd",
          },
        },
      },
    ],
  };

  const dot = `digraph {
  "aws_subnet.private" -> "aws_vpc.main"
  "aws_route_table.private" -> "aws_vpc.main"
  "aws_route.private_default" -> "aws_route_table.private"
  "aws_route_table_association.private" -> "aws_route_table.private"
  "aws_route_table_association.private" -> "aws_subnet.private"
}
`;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-upload-selftest-"));
  const planPath = path.join(tempDir, "selftest-plan.json");
  const dotPath = path.join(tempDir, "selftest.dot");
  fs.writeFileSync(planPath, JSON.stringify(plan), "utf8");
  fs.writeFileSync(dotPath, dot, "utf8");

  try {
    const form = new FormData();
    form.append("planFile", new Blob([fs.readFileSync(planPath)]), "selftest-plan.json");
    form.append("dotFile", new Blob([fs.readFileSync(dotPath)]), "selftest.dot");

    const uploadResp = await fetch(`${baseUrl}/terraform/upload`, {
      method: "POST",
      body: form,
    });
    const uploadBody = await uploadResp.json();
    if (!uploadResp.ok || !uploadBody?.id) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadBody)}`);
    }

    const sceneResp = await fetch(
      `${baseUrl}/terraform/upload/${uploadBody.id}/excalidraw`,
    );
    const scene = await sceneResp.json();
    if (!sceneResp.ok) {
      throw new Error(`Scene fetch failed: ${JSON.stringify(scene)}`);
    }

    const elements = scene.elements || [];
    const vpcText = elements.find(
      (element) =>
        element.type === "text" &&
        element.customData?.terraformVpcGroup &&
        typeof element.text === "string" &&
        element.text.includes("rt:1") &&
        element.text.includes("assoc:1") &&
        element.text.includes("routes:1"),
    );
    const subnetText = elements.find(
      (element) =>
        element.type === "text" &&
        element.customData?.terraformSubnetGroup &&
        typeof element.text === "string" &&
        element.text.includes("rt_assoc:1"),
    );

    if (!vpcText || !subnetText) {
      throw new Error("Facet summary text not found in rendered VPC/subnet labels");
    }

    console.log("SELFTEST_PASS", {
      uploadId: uploadBody.id,
      vpcLabel: vpcText.text,
      subnetLabel: subnetText.text,
    });
  } finally {
    try {
      fs.unlinkSync(planPath);
      fs.unlinkSync(dotPath);
      fs.rmdirSync(tempDir);
    } catch {
      // Best-effort temp cleanup.
    }
  }
}

main().catch((error) => {
  console.error("SELFTEST_FAIL", error.message);
  process.exit(1);
});
