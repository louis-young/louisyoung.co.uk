import classNames from "classnames";
import React from "react";
import type { ButtonProps } from "./types";

export const Button = ({
  children,
  variant = "primary",
  type = "button",
}: ButtonProps) => {
  return (
    <button
      type={type}
      className={classNames({
        "min-w-[10rem] rounded-full py-4 px-8 transition-colors hover:bg-opacity-70":
          true,
        " bg-primary text-white dark:bg-white dark:text-slate-900":
          variant === "primary",
        "border-2 border-black bg-black text-white dark:border-white dark:text-white":
          variant === "secondary",
      })}
    >
      {children}
    </button>
  );
};
