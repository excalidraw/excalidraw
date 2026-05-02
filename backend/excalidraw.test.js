const { nodesToExcalidraw } = require("./excalidraw");

describe("nodesToExcalidraw Terraform edge layers", () => {
  it("renders dependency and data-flow arrows with layer metadata", async () => {
    const scene = await nodesToExcalidraw({
      "aws_api_gateway_rest_api.api": {
        resources: {
          "aws_api_gateway_rest_api.api": {
            address: "aws_api_gateway_rest_api.api",
            type: "aws_api_gateway_rest_api",
            name: "api",
            change: { actions: ["create"], after: { id: "api-id" } },
          },
        },
        edges_new: ["aws_lambda_function.handler"],
        edges_existing: [],
        edges_data_flow: [
          {
            target: "aws_lambda_function.handler",
            type: "invokes",
            label: "invokes",
            origin: "terraform_resource",
          },
        ],
      },
      "aws_lambda_function.handler": {
        resources: {
          "aws_lambda_function.handler": {
            address: "aws_lambda_function.handler",
            type: "aws_lambda_function",
            name: "handler",
            change: {
              actions: ["create"],
              after: { function_name: "handler" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [],
      },
    });

    const dependencyArrow = scene.elements.find(
      (element) => element.customData?.terraformEdgeLayer === "dependency",
    );
    const dataFlowArrow = scene.elements.find(
      (element) => element.customData?.terraformEdgeLayer === "dataFlow",
    );

    expect(dependencyArrow).toMatchObject({
      type: "arrow",
      customData: {
        relationship: {
          type: "dependency",
        },
      },
    });
    expect(dataFlowArrow).toMatchObject({
      type: "arrow",
      strokeColor: "#0ca678",
      strokeWidth: 3,
      endArrowhead: "arrow",
      startBinding: {
        elementId: expect.any(String),
        mode: "orbit",
      },
      endBinding: {
        elementId: expect.any(String),
        mode: "orbit",
      },
      customData: {
        relationship: {
          type: "invokes",
          label: "invokes",
          origin: "terraform_resource",
        },
      },
    });
    expect(dataFlowArrow.startBinding.fixedPoint).not.toEqual(
      dependencyArrow.startBinding.fixedPoint,
    );
    expect(dataFlowArrow.endBinding.fixedPoint).not.toEqual(
      dependencyArrow.endBinding.fixedPoint,
    );
  });

  it("coalesces opposite data-flow directions into a bidirectional arrow", async () => {
    const scene = await nodesToExcalidraw({
      "aws_lambda_function.sync": {
        resources: {
          "aws_lambda_function.sync": {
            address: "aws_lambda_function.sync",
            type: "aws_lambda_function",
            name: "sync",
            change: {
              actions: ["create"],
              after: { function_name: "sync" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [
          {
            target: "aws_s3_bucket.assets",
            type: "writes",
            label: "writes",
            origin: "iam_policy",
          },
        ],
      },
      "aws_s3_bucket.assets": {
        resources: {
          "aws_s3_bucket.assets": {
            address: "aws_s3_bucket.assets",
            type: "aws_s3_bucket",
            name: "assets",
            change: {
              actions: ["create"],
              after: { bucket: "assets" },
            },
          },
        },
        edges_new: [],
        edges_existing: [],
        edges_data_flow: [
          {
            target: "aws_lambda_function.sync",
            type: "reads",
            label: "reads",
            origin: "iam_policy",
          },
        ],
      },
    });

    const dataFlowArrows = scene.elements.filter(
      (element) => element.customData?.terraformEdgeLayer === "dataFlow",
    );

    expect(dataFlowArrows).toHaveLength(1);
    expect(dataFlowArrows[0]).toMatchObject({
      startArrowhead: "arrow",
      endArrowhead: "arrow",
      customData: {
        relationship: {
          type: "bidirectional_data_flow",
          label: "writes / reads",
          bidirectional: true,
          directed: false,
        },
      },
    });
  });
});
