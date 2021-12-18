import React from "react";

import { Container } from "./container";
import Logo from "./logo";
import Socials from "./socials";

const Footer = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-20 dark:border-darker dark:bg-darker">
      <Container>
        <div className="flex items-center justify-between">
          <Logo />
          <Socials />
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
