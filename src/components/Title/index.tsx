import { TitleProps } from "./types";

export const Title = ({ children }: TitleProps) => {
  return (
    <h1 className="text-4xl font-medium leading-tight text-slate-900 dark:text-white lg:text-6xl">
      {children}
    </h1>
  );
};
