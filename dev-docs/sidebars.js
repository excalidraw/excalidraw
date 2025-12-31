/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    {
      type: "category",
      label: "Introduction",
      link: {
        type: "doc",
        id: "introduction/get-started",
      },
      items: ["introduction/development", "introduction/contributing"],
    },
    {
      type: "category",
      label: "Codebase",
      items: ["codebase/json-schema", "codebase/frames", "codebase/releasing"],
    },
    {
      type: "category",
      label: "@excalidraw-modify/excalidraw",
      collapsed: false,
      items: [
        "@excalidraw-modify/excalidraw/installation",
        "@excalidraw-modify/excalidraw/integration",
        "@excalidraw-modify/excalidraw/customizing-styles",
        {
          type: "category",
          label: "API",
          link: {
            type: "doc",
            id: "@excalidraw-modify/excalidraw/api/api-intro",
          },
          items: [
            {
              type: "category",
              label: "Props",
              link: {
                type: "doc",
                id: "@excalidraw-modify/excalidraw/api/props/props",
              },
              items: [
                "@excalidraw-modify/excalidraw/api/props/initialdata",
                "@excalidraw-modify/excalidraw/api/props/excalidraw-api",
                "@excalidraw-modify/excalidraw/api/props/render-props",
                "@excalidraw-modify/excalidraw/api/props/ui-options",
              ],
            },
            {
              type: "category",
              label: "Children Components",
              link: {
                type: "doc",
                id: "@excalidraw-modify/excalidraw/api/children-components/children-components-intro",
              },
              items: [
                "@excalidraw-modify/excalidraw/api/children-components/main-menu",
                "@excalidraw-modify/excalidraw/api/children-components/welcome-screen",
                "@excalidraw-modify/excalidraw/api/children-components/sidebar",
                "@excalidraw-modify/excalidraw/api/children-components/footer",
                "@excalidraw-modify/excalidraw/api/children-components/live-collaboration-trigger",
              ],
            },
            {
              type: "category",
              label: "Utils",
              link: {
                type: "doc",
                id: "@excalidraw-modify/excalidraw/api/utils/utils-intro",
              },
              items: [
                "@excalidraw-modify/excalidraw/api/utils/export",
                "@excalidraw-modify/excalidraw/api/utils/restore",
              ],
            },
            "@excalidraw-modify/excalidraw/api/constants",
            "@excalidraw-modify/excalidraw/api/excalidraw-element-skeleton",
          ],
        },
        "@excalidraw-modify/excalidraw/faq",
        "@excalidraw-modify/excalidraw/development",
      ],
    },
    {
      type: "category",
      label: "@excalidraw/mermaid-to-excalidraw",
      link: {
        type: "doc",
        id: "@excalidraw/mermaid-to-excalidraw/installation",
      },
      items: [
        "@excalidraw/mermaid-to-excalidraw/api",
        "@excalidraw/mermaid-to-excalidraw/development",
        {
          type: "category",
          label: "Codebase",
          link: {
            type: "doc",
            id: "@excalidraw/mermaid-to-excalidraw/codebase/codebase",
          },
          items: [
            {
              type: "category",
              label: "How Parser works under the hood?",
              link: {
                type: "doc",
                id: "@excalidraw/mermaid-to-excalidraw/codebase/parser/parser",
              },
              items: [
                "@excalidraw/mermaid-to-excalidraw/codebase/parser/flowchart",
              ],
            },
            "@excalidraw/mermaid-to-excalidraw/codebase/new-diagram-type",
          ],
        },
      ],
    },
  ],
};

module.exports = sidebars;
