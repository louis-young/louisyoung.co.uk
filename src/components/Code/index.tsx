import React from "react";
import Highlight, { defaultProps } from "prism-react-renderer";
import nightOwl from "prism-react-renderer/themes/nightOwl";
import palenight from "prism-react-renderer/themes/palenight";
import type { CodeProps } from "./types";
import { calculateLinesToHighlight } from "./utilities";

export const Code = ({ code, language, metastring }: CodeProps) => {
  const shouldHighlightLine = calculateLinesToHighlight(metastring);

  const dark = false; // Temporary.

  const theme = dark ? palenight : nightOwl;

  return (
    <Highlight {...defaultProps} code={code} language={language} theme={theme}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <div style={{ overflow: "auto", borderRadius: "0.25rem" }}>
          <pre
            className={className}
            style={{
              padding: "1rem 1rem 1rem .75rem",
              fontSize: "1rem",
              float: "left",
              minWidth: "100%",
              overflow: "initial",
              ...style,
            }}
          >
            {tokens.map((line, i) => (
              <div
                key={i}
                {...getLineProps({
                  line,
                  key: i,
                  style: shouldHighlightLine(i)
                    ? {
                        backgroundColor: "rgba(201, 167, 255, 0.2)",
                        margin: "0px -1rem 0 -0.75rem",
                        padding: " 0px 7px",
                        borderLeft: "5px solid rgb(201, 167, 255)",
                      }
                    : undefined,
                })}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "1.75rem",
                    userSelect: "none",
                    opacity: "0.3",
                  }}
                >
                  {i + 1}
                </span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token, key })} />
                ))}
              </div>
            ))}
          </pre>
        </div>
      )}
    </Highlight>
  );
};
