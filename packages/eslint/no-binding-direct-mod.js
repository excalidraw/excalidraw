/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "disallow direct mutation of startBinding or endBinding via mutateElement",
      category: "Best Practices",
      recommended: false,
    },
    fixable: null,
    schema: [],
    messages: {
      noDirectBindingMutation:
        "Direct mutation of {{ property }} via mutateElement() is not allowed. Use proper binding update functions instead.",
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        // Check if this is a call to mutateElement (direct call or method call)
        let isMutateElementCall = false;

        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "mutateElement"
        ) {
          // Direct call: mutateElement()
          isMutateElementCall = true;
        } else if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "mutateElement"
        ) {
          // Method call: something.mutateElement() or this.scene.mutateElement()
          isMutateElementCall = true;
        }

        if (isMutateElementCall) {
          // mutateElement can have different argument patterns:
          // 1. mutateElement(element, updates) - 2 args
          // 2. mutateElement(element, elementsMap, updates) - 3 args
          // 3. mutateElement(element, updates, options) - 3 args
          let updatesArg = null;

          if (node.arguments.length >= 2) {
            // Try second argument first (most common pattern)
            const secondArg = node.arguments[1];
            if (secondArg.type === "ObjectExpression") {
              updatesArg = secondArg;
            } else if (node.arguments.length >= 3) {
              // If second arg is not an object, try third argument
              const thirdArg = node.arguments[2];
              if (thirdArg.type === "ObjectExpression") {
                updatesArg = thirdArg;
              }
            }
          }

          if (updatesArg) {
            // Look for startBinding or endBinding properties
            for (const property of updatesArg.properties) {
              if (
                property.type === "Property" &&
                property.key.type === "Identifier" &&
                (property.key.name === "startBinding" ||
                  property.key.name === "endBinding")
              ) {
                context.report({
                  node: property,
                  messageId: "noDirectBindingMutation",
                  data: {
                    property: property.key.name,
                  },
                });
              }
            }
          }
        }
      },
    };
  },
};
