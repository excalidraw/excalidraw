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
        id: "get-started",
      },
      items: [],
    },
    {
      type: "category",
      label: "Codebase",
      link: {
        type: "doc",
        id: "codebase/codebase-intro",
      },
      items: [],
    },
    {
      type: "category",
      label: "Package",

      items: [
        "package/installation",
        "package/integration",
        "package/customizing-styles",
        {
          type: "category",
          label: "API",
          link: {
            type: "doc",
            id: "package/api/api-intro",
          },
          items: [
            "package/api/props",
            {
              type: "category",
              label: "Components",
              link: {
                type: "doc",
                id: "package/api/components/components-intro",
              },
              items: [
                "package/api/components/footer",
                "package/api/components/main-menu",
              ],
            },
            {
              type: "category",
              label: "Utils",
              link: { type: "doc", id: "package/api/utils/utils-intro" },
              items: ["package/api/utils/export", "package/api/utils/restore"],
            },
          ],
        },
        "package/faq",
        "package/development",
      ],
    },
  ],
};

module.exports = sidebars;
