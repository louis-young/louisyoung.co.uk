import React from "react";

import Footer from "./footer";
import Header from "./header";
import Markdown from "./markdown";

const Layout = ({ children }) => {
  return (
    <>
      <Header />
      <main>
        <Markdown>{children}</Markdown>
      </main>
      <Footer />
    </>
  );
};

export default Layout;
