import React, { useEffect } from "react";

import isDarkMode from "../utilities/dark-mode";

import Footer from "./footer";
import Header from "./header";
import Markdown from "./markdown";

const Layout = ({ children }) => {
  useEffect(() => {
    if (isDarkMode()) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

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
