import type { ReactNode } from "react";

export interface ContainerProps {
  size?: "small" | "medium" | "large";
  className?: string;
  children: ReactNode;
}
