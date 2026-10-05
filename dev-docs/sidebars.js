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
      items: ["codebase/json-schema", "codebase/frames"],
    },
    {
      type: "category",
      label: "@excalidraw/excalidraw",
      collapsed: false,
      items: [
        "@excalidraw/excalidraw/installation",
        "@excalidraw/excalidraw/integration",
        "@excalidraw/excalidraw/customizing-styles",
        {
          type: "category",
          label: "API",
          link: {
            type: "doc",
            id: "@excalidraw/excalidraw/api/api-intro",
          },
          items: [
            {
              type: "category",
              label: "Props",
              link: {
                type: "doc",
                id: "@excalidraw/excalidraw/api/props/props",
              },
              items: [
                "@excalidraw/excalidraw/api/props/initialdata",
                "@excalidraw/excalidraw/api/props/excalidraw-api",
                "@excalidraw/excalidraw/api/props/render-props",
                "@excalidraw/excalidraw/api/props/ui-options",
              ],
            },
            {
              type: "category",
              label: "Children Components",
              link: {
                type: "doc",
                id: "@excalidraw/excalidraw/api/children-components/children-components-intro",
              },
              items: [
                "@excalidraw/excalidraw/api/children-components/main-menu",
                "@excalidraw/excalidraw/api/children-components/welcome-screen",
                "@excalidraw/excalidraw/api/children-components/sidebar",
                "@excalidraw/excalidraw/api/children-components/footer",
                "@excalidraw/excalidraw/api/children-components/live-collaboration-trigger",
              ],
            },
            {
              type: "category",
              label: "Utils",
              link: {
                type: "doc",
                id: "@excalidraw/excalidraw/api/utils/utils-intro",
              },
              items: [
                "@excalidraw/excalidraw/api/utils/export",
                "@excalidraw/excalidraw/api/utils/restore",
              ],
            },
            "@excalidraw/excalidraw/api/constants",
            "@excalidraw/excalidraw/api/excalidraw-element-skeleton",
          ],
        },
        "@excalidraw/excalidraw/faq",
        "@excalidraw/excalidraw/development",
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
