import React from "react";

import { useI18n } from "../i18n";

const REGEXP = /{{(.+?)}}/g;

const getTransChildren = (format: string, props: { [key: string]: any }) => {
  const stack: { name: string; children: any[] }[] = [
    {
      name: "",
      children: [],
    },
  ];

  format.split(REGEXP).forEach((match, index) => {
    if (index % 2 === 0) {
      if (match.length === 0) {
        return;
      }

      stack[stack.length - 1].children.push(match);
    } else if (match === `${stack[stack.length - 1].name}End`) {
      const item = stack.pop()!;
      const itemChildren = React.createElement(
        React.Fragment,
        {},
        ...item.children,
      );
      const fn = props[item.name];
      stack[stack.length - 1].children.push(fn(itemChildren));
    } else if (props.hasOwnProperty(match)) {
      stack[stack.length - 1].children.push(props[match]);
    } else if (/Start$/.test(match)) {
      const name = match.slice(0, match.length - 5);

      if (props.hasOwnProperty(name)) {
        stack.push({
          name,
          children: [],
        });
      } else {
        console.warn(
          `Trans: missed to pass in variable start/end ${match} for interpolating ${format}`,
        );
      }
    } else {
      console.warn(
        `Trans: missed to pass in variable ${match} for interpolating ${format}`,
      );
    }
  });

  if (stack.length !== 1) {
    console.warn(`Trans: stack not empty for interpolating ${format}`);
  }

  return stack[0].children;
};

const Trans = ({
  i18nKey,
  children,
  ...props
}: {
  i18nKey: string;
  [key: string]: any;
}) => {
  const { t } = useI18n();

  return React.createElement.apply(
    React.createElement,
    [React.Fragment, {}].concat(getTransChildren(t(i18nKey), props)) as any,
  );
};

export default Trans;
