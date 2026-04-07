import React from "react";

import { useI18n } from "../i18n";

import type { TranslationKeys } from "../i18n";

// Used for splitting i18nKey into tokens in Trans component
// Example:
// "Please <link>click {{location}}</link> to continue.".split(SPLIT_REGEX).filter(Boolean)
// produces
// ["Please ", "<link>", "click ", "{{location}}", "</link>", " to continue."]
const SPLIT_REGEX = /({{[\w-]+}})|(<[\w-]+>)|(<\/[\w-]+>)/g;
// Used for extracting "location" from "{{location}}"
const KEY_REGEXP = /{{([\w-]+)}}/;
// Used for extracting "link" from "<link>"
const TAG_START_REGEXP = /<([\w-]+)>/;
// Used for extracting "link" from "</link>"
const TAG_END_REGEXP = /<\/([\w-]+)>/;

const getTransChildren = (
  format: string,
  props: {
    [key: string]: React.ReactNode | ((el: React.ReactNode) => React.ReactNode);
  },
): React.ReactNode[] => {
  const stack: { name: string; children: React.ReactNode[] }[] = [
    {
      name: "",
      children: [],
    },
  ];

  format
    .split(SPLIT_REGEX)
    .filter(Boolean)
    .forEach((match) => {
      const tagStartMatch = match.match(TAG_START_REGEXP);
      const tagEndMatch = match.match(TAG_END_REGEXP);
      const keyMatch = match.match(KEY_REGEXP);

      if (tagStartMatch !== null) {
        // The match is <tag>. Set the tag name as the name if it's one of the
        // props, e.g. for "Please <link>click the button</link> to continue"
        // tagStartMatch[1] = "link" and props contain "link" then it will be
        // pushed to stack.
        const name = tagStartMatch[1];
        if (props.hasOwnProperty(name)) {
          stack.push({
            name,
            children: [],
          });
        } else {
          console.warn(
            `Trans: missed to pass in prop ${name} for interpolating ${format}`,
          );
        }
      } else if (tagEndMatch !== null) {
        // If tag end match is found, this means we need to replace the content with
        // its actual value in prop e.g. format = "Please <link>click the
        // button</link> to continue", tagEndMatch is for "</link>", stack last item name =
        // "link" and props.link = (el) => <a
        // href="https://example.com">{el}</a> then its prop value will be
        // pushed to "link"'s children so on DOM when rendering it's rendered as
        // <a href="https://example.com">click the button</a>
        const name = tagEndMatch[1];
        if (name === stack[stack.length - 1].name) {
          const item = stack.pop()!;
          const itemChildren = React.createElement(
            React.Fragment,
            {},
            ...item.children,
          );
          const fn = props[item.name];
          if (typeof fn === "function") {
            stack[stack.length - 1].children.push(fn(itemChildren));
          }
        } else {
          console.warn(
            `Trans: unexpected end tag ${match} for interpolating ${format}`,
          );
        }
      } else if (keyMatch !== null) {
        // The match is for {{key}}. Check if the key is present in props and set
        // the prop value as children of last stack item e.g. format = "Hello
        // {{name}}", key = "name" and props.name = "Excalidraw" then its prop
        // value will be pushed to "name"'s children so it's rendered on DOM as
        // "Hello Excalidraw"
        const name = keyMatch[1];
        if (props.hasOwnProperty(name)) {
          stack[stack.length - 1].children.push(props[name] as React.ReactNode);
        } else {
          console.warn(
            `Trans: key ${name} not in props for interpolating ${format}`,
          );
        }
      } else {
        // If none of cases match means we just need to push the string
        // to stack eg - "Hello {{name}} Whats up?" "Hello", "Whats up" will be pushed
        stack[stack.length - 1].children.push(match);
      }
    });

  if (stack.length !== 1) {
    console.warn(`Trans: stack not empty for interpolating ${format}`);
  }

  return stack[0].children;
};

/*
Trans component is used for translating JSX.

```json
{
  "example1": "Hello {{audience}}",
  "example2": "Please <link>click the button</link> to continue.",
  "example3": "Please <link>click {{location}}</link> to continue.",
  "example4": "Please <link>click <bold>{{location}}</bold></link> to continue.",
}
```

```jsx
<Trans i18nKey="example1" audience="world" />

<Trans
  i18nKey="example2"
  connectLink={(el) => <a href="https://example.com">{el}</a>}
/>

<Trans
  i18nKey="example3"
  connectLink={(el) => <a href="https://example.com">{el}</a>}
  location="the button"
/>

<Trans
  i18nKey="example4"
  connectLink={(el) => <a href="https://example.com">{el}</a>}
  location="the button"
  bold={(el) => <strong>{el}</strong>}
/>
```

Output:

```html
Hello world
Please <a href="https://example.com">click the button</a> to continue.
Please <a href="https://example.com">click the button</a> to continue.
Please <a href="https://example.com">click <strong>the button</strong></a> to continue.
```
*/
const Trans = ({
  i18nKey,
  children,
  ...props
}: {
  i18nKey: TranslationKeys;
  [key: string]: React.ReactNode | ((el: React.ReactNode) => React.ReactNode);
}) => {
  const { t } = useI18n();

  // This is needed to avoid unique key error in list which gets rendered from getTransChildren
  return React.createElement(
    React.Fragment,
    {},
    ...getTransChildren(t(i18nKey), props),
  );
};

export default Trans;
