import React, { useEffect } from "react";

import useDarkMode from "../hooks/useDarkMode";

import Footer from "./footer";
import Header from "./header";
import Markdown from "./markdown";

const Layout = ({ children }) => {
  const dark = useDarkMode();

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <section className="dark:bg-dark dark:text-white">
      <Header />
      <main>
        <Markdown>{children}</Markdown>
      </main>
      <Footer />
    </section>
  );
};

export default Layout;
