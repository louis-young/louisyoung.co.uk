import { useState, useEffect } from "react";

const useDarkMode = () => {
  const [dark, setDark] = useState("");

  useEffect(() => {
    if (
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setDark(true);
    } else {
      setDark(false);
    }
  }, []);

  return dark;
};

export default useDarkMode;
