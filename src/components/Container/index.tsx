import classNames from "classnames";
import type { ContainerProps } from "./types";

export const Container = ({
  size = "medium",
  className,
  children,
}: ContainerProps) => {
  const containerClassNames = classNames(
    {
      "px-[5vw]": true,
      "lg:px-[5vw]": size === "large",
      "lg:px-[10vw]": size === "medium",
      "lg:px-[17.5vw]": size === "small",
    },
    className,
  );

  return <div className={containerClassNames}>{children}</div>;
};
