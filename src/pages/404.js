import React from "react";

import Meta from "../components/meta";

const NotFoundPage = () => {
  return (
    <>
      <Meta title="Oops - Page Not Found | Louis Young" />
      <section>
        <h1 className="py-20 text-center text-2xl md:text-4xl font-bold tracking-tight leading-normal md:leading-normal">
          Oops, I couldn't find what you
          <br /> were looking for.
        </h1>
      </section>
    </>
  );
};

export default NotFoundPage;
