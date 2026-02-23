function mockLanggraphEnrichment(nodes) {
  const enrichment = {};

  for (const [nodePath, node] of Object.entries(nodes)) {
    const actions = [];
    for (const resource of Object.values(node.resources || {})) {
      if (resource.change?.actions) {
        actions.push(...resource.change.actions);
      }
    }

    let summary = "";
    const issues = [];
    const recommendations = [];

    if (nodePath.includes("aws_lambda_function")) {
      summary = "Lambda function configuration";
      if (actions.includes("create")) {
        issues.push("New Lambda function - verify memory and timeout settings");
        recommendations.push("Consider setting reserved concurrency");
        recommendations.push("Ensure dead letter queue is configured");
      }
    } else if (nodePath.includes("aws_s3_bucket")) {
      summary = "S3 bucket configuration";
      issues.push("Verify bucket policy and public access settings");
      recommendations.push("Enable versioning for data protection");
      recommendations.push("Consider lifecycle rules for cost optimization");
    } else if (nodePath.includes("aws_iam")) {
      summary = "IAM configuration";
      issues.push("Review IAM policy for least-privilege compliance");
      recommendations.push("Audit policy permissions regularly");
    } else if (nodePath.includes("aws_dynamodb")) {
      summary = "DynamoDB table configuration";
      recommendations.push(
        "Consider on-demand capacity for unpredictable workloads",
      );
      recommendations.push("Enable point-in-time recovery");
    } else if (
      nodePath.includes("aws_api_gateway") ||
      nodePath.includes("aws_apigatewayv2")
    ) {
      summary = "API Gateway configuration";
      recommendations.push("Enable request validation");
      recommendations.push("Configure throttling limits");
    } else if (
      nodePath.includes("aws_security_group") ||
      nodePath.includes("aws_vpc")
    ) {
      summary = "Networking configuration";
      issues.push("Review security group rules for overly permissive access");
      recommendations.push("Restrict ingress to known CIDR ranges");
    } else {
      summary = `Resource: ${nodePath.split(".")[0]}`;
      if (actions.includes("delete")) {
        issues.push("Resource is being destroyed - verify this is intentional");
      }
    }

    if (actions.includes("update")) {
      issues.push("In-place update - verify no breaking changes");
    }

    enrichment[nodePath] = { summary, issues, recommendations };
  }

  return enrichment;
}

function applyEnrichment(nodes, enrichment) {
  for (const nodePath of Object.keys(nodes)) {
    const item = enrichment[nodePath] || {};
    nodes[nodePath].enrichment = {
      summary: item.summary || "",
      issues: item.issues || [],
      recommendations: item.recommendations || [],
    };
    nodes[nodePath].AI = {
      Issues: item.issues || [],
      Summary: item.summary || "",
      Recommendations: item.recommendations || [],
    };
  }
}

module.exports = {
  mockLanggraphEnrichment,
  applyEnrichment,
};
