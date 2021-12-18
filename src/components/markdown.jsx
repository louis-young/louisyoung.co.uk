import React from "react";

import { MDXProvider } from "@mdx-js/react";

import Code from "./code";

const preToCodeBlock = (preProps) => {
  if (preProps.children && preProps.children.props && preProps.children.props.mdxType === "code") {
    const { children: code, className = "", ...props } = preProps.children.props;

    const matches = className.match(/language-(?<lang>.*)/);

    return {
      code: code.trim(),
      className,
      language: matches && matches.groups && matches.groups.lang ? matches.groups.lang : "",
      ...props,
    };
  }
};

const components = {
  pre: (preProps) => {
    const props = preToCodeBlock(preProps);

    if (props) {
      return <Code {...props} />;
    } else {
      return <pre {...preProps} />;
    }
  },
};

const Markdown = ({ children }) => {
  return <MDXProvider components={components}>{children}</MDXProvider>;
};

export default Markdown;
