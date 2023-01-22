import { ReactNode } from "react";

export interface SubtitleProps {
  variant?: "primary" | "secondary";
  className?: string;
  children: ReactNode;
}
