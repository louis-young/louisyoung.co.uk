import { Spacer } from "../Spacer";
import { PageSectionProps } from "./types";

export const PageSection = ({ className, children }: PageSectionProps) => {
  return (
    <>
      <Spacer size="large" />
      <section className={className}>{children}</section>
      <Spacer size="large" />
    </>
  );
};
