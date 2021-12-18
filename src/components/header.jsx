import React from "react";

import { Container } from "./container";
import Logo from "./logo";
import Socials from "./socials";

const Header = () => {
  return (
    <header className="py-4">
      <Container>
        <div className="flex items-center justify-between">
          <Logo />
          <Socials />
        </div>
      </Container>
    </header>
  );
};

export default Header;
