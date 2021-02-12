import React from "react";

const Container = ({ children }) => {
  return <div className="container mx-auto px-12 md:px-18 lg:px-26 xl:px-32 2xl:px-60">{children}</div>;
};

export default Container;
