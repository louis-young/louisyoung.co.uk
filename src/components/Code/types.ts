import type { Language } from "prism-react-renderer";

export interface CodeProps {
  code: string;
  language: Language;
  metastring: string;
}
