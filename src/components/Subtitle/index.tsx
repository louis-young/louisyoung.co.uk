import classNames from "classnames";
import { SubtitleProps } from "./types";

export const Subtitle = ({
  variant = "primary",
  className,
  children,
}: SubtitleProps) => {
  return (
    <h2
      className={classNames(
        {
          "text-4xl font-normal leading-tight lg:text-5xl": true,
          "text-slate-900": variant === "primary",
          "text-primary": variant === "secondary",
        },
        className,
      )}
    >
      {children}
    </h2>
  );
};
