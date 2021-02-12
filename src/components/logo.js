import React from "react";

import { Link } from "gatsby";

const Logo = () => {
  return (
    <p className="text-2xl md:text-3xl font-bold tracking-tight hover:underline">
      <Link to="/">Louis Young</Link>
    </p>
  );
};

export default Logo;
