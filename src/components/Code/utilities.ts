export const calculateLinesToHighlight = (meta: string) => {
  const RegEx = /{([\d,-]+)}/;

  if (RegEx.test(meta)) {
    const lineNumbers = RegEx.exec(meta)?.[1]
      .split(",")
      .map((v) => v.split("-").map((y) => parseInt(y, 10)));

    return (index: number) => {
      const lineNumber = index + 1;

      const inRange = lineNumbers?.some(([start, end]) =>
        end ? lineNumber >= start && lineNumber <= end : lineNumber === start,
      );

      return inRange;
    };
  } else {
    return () => false;
  }
};
