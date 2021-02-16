import React from "react";

import Footer from "./footer";
import Header from "./header";
import Markdown from "./markdown";

const Layout = ({ children }) => {
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
