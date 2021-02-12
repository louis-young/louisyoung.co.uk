import React from "react";

import { Link } from "gatsby";
import Image from "gatsby-image";

import Author from "./author";

const Post = ({ title, image, excerpt, link }) => {
  return (
    <article>
      <figure className="sm:mx-0 mb-5">
        <Link to={link}>
          <Image
            fluid={image.childImageSharp.sizes}
            className="w-full h-52 object-cover rounded shadow-sm hover:shadow-md hover:opacity-80 transition duration-200"
            alt={title}
            loading="lazy"
          />
        </Link>
      </figure>

      <h2 className="text-2xl mb- font-bold leading-snug hover:underline">
        <Link to={link}>{title}</Link>
      </h2>

      <p className="text-lg leading-relaxed mt-4 mb-4">{excerpt}</p>

      <Author />
    </article>
  );
};

export default Post;
