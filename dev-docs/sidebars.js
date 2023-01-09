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
    "get-started",
    {
      type: "category",
      label: "Codebase",
      link: {
        type: "doc",
        id: "codebase/overview",
      },
      items: [],
    },
    {
      type: "category",
      label: "Package",

      items: [
        "package/Installation",
        "package/Usage",
        "package/CustomizingStyles",
        "package/Collaboration",
        {
          type: "category",
          label: "API",
          link: {
            type: "doc",
            id: "package/API/Introduction",
          },
          items: [
            "package/API/Props",
            {
              type: "category",
              label: "Components",
              link: {
                type: "doc",
                id: "package/API/Components/ComponentsIntro",
              },
              items: [
                "package/API/Components/Footer",
                "package/API/Components/MainMenu",
                {
                  type: "category",
                  label: "Utils",
                  link: { type: "doc", id: "package/API/Utils/UtilsIntro" },
                  items: [
                    "package/API/Utils/ExportUtilities",
                    "package/API/Utils/RestoreUtilities",
                    "package/API/Utils/Misc",
                  ],
                },
              ],
            },
          ],
        },
        "package/Development",
      ],
    },
  ],
};

module.exports = sidebars;
