import React from "react";

import Social from "./social";

import { website, github, twitter, linkedin } from "./icons";

const Socials = () => {
  return (
    <nav>
      <ul className="grid grid-cols-4 gap-4 items-center">
        <Social title="Website" link="https://www.louisyoung.co.uk" icon={website} />
        <Social title="GitHub" link="https://github.com/louis-young" icon={github} />
        <Social title="Twitter" link="https://twitter.com/louisryoungg" icon={twitter} />
        <Social title="LinkedIn" link="https://www.linkedin.com/in/louis-r-young" icon={linkedin} />
      </ul>
    </nav>
  );
};

export default Socials;
