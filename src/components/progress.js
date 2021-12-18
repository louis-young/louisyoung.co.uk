import React, { useEffect, useState } from "react";

import * as styles from "./progress.module.css";

const Progress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculatePercentage = () => {
      const scrolled = window.scrollY;

      const total =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;

      const percentage = (scrolled / total) * 100;

      setProgress(percentage);
    };

    window.addEventListener("scroll", calculatePercentage);
    return () => {
      window.removeEventListener("scroll", calculatePercentage);
    };
  }, []);

  return <progress className={styles.progress} value={progress} max="100" />;
};

export default Progress;
