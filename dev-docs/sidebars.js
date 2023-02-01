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
                "@excalidraw/excalidraw/api/props/ref",
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
            {
              type: "category",
              label: "Constants",
              link: { type: "doc", id: "@excalidraw/excalidraw/api/constants" },
              items: [],
            },
          ],
        },
        "@excalidraw/excalidraw/faq",
        "@excalidraw/excalidraw/development",
      ],
    },
  ],
};

module.exports = sidebars;
