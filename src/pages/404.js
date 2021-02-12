import React from "react";

import Layout from "../components/layout";
import Meta from "../components/meta";

const NotFoundPage = () => {
  return (
    <Layout>
      <Meta title="Page Not Found | Louis Young" />
      <section>
        <h1 className="py-20 text-center text-2xl md:text-4xl font-bold tracking-tight leading-normal md:leading-normal">
          Oops, we couldn't find what you
          <br /> were looking for.
        </h1>
      </section>
    </Layout>
  );
};

export default NotFoundPage;
