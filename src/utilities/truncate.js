const truncate = (string) => {
  const length = 165;

  const ellipsis = "...";

  if (string.length < length) {
    return string;
  }

  const truncatedString = string.slice(0, length - ellipsis.length);

  return `${truncatedString}${ellipsis}`;
};

export default truncate;
