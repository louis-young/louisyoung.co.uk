import classNames from "classnames";
import type { SpacerProps } from "./types";

export const Spacer = ({ size = "medium" }: SpacerProps) => {
  return (
    <div
      className={classNames({
        "h-3": size === "minute",
        "h-6": size === "small",
        "h-10": size === "medium",
        "h-16": size === "large",
      })}
    />
  );
};
