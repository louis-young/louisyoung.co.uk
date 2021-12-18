import React from "react";

import { Helmet } from "react-helmet";

import image from "../../content/assets/software-development-articles.jpg";

const BASE_URL = "https://blog.louisyoung.co.uk";

const base = {
  title: "Software Development Blog - Web Development | Louis Young",
  short: "Software Development Blog",
  description:
    "A software development blog by Louis Young where I write about JavaScript, React, and general software/web development.",
  image,
  canonical: BASE_URL,
  twitter: "louisryoungg",
};

const Meta = ({ title, description, image, slug }) => {
  return (
    <Helmet>
      <html lang="en" />

      <title>{title ? `${title} | Louis Young` : base.title}</title>

      <meta name="theme-color" content="#000000" />

      <link rel="canonical" href={slug ? `${BASE_URL}/${slug}` : base.canonical} />

      <meta name="description" content={description || base.description} />

      <meta property="og:url" content={slug ? `${BASE_URL}/${slug}` : base.canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title || base.short} />
      <meta property="og:site_name" content="Louis Young" />
      <meta property="og:description" content={description || base.description} />
      <meta property="og:image" content={image ? `${BASE_URL}${image}` : base.image} />

      <meta name="twitter:site" content={`@${base.twitter}`} />
      <meta name="twitter:url" content={slug ? `${BASE_URL}/${slug}` : base.canonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title || base.short} />
      <meta name="twitter:description" content={description || base.description} />
      <meta name="twitter:image" content={image ? `${BASE_URL}${image}` : base.image} />
    </Helmet>
  );
};

export default Meta;
