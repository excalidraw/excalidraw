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
      customData: {
        relationship: {
          type: "invokes",
          label: "invokes",
          origin: "terraform_resource",
        },
      },
    });
  });
});
