const isDarkMode = () => {
  const dark =
    localStorage.theme === "dark" ||
    (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return dark;
};

export default isDarkMode;
