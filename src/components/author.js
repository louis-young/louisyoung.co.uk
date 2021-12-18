import React from "react";

import { useStaticQuery, graphql } from "gatsby";
import { GatsbyImage, getImage } from "gatsby-plugin-image";

const Author = () => {
  const data = useStaticQuery(graphql`
    query AuthorQuery {
      avatar: file(absolutePath: { regex: "/author/author.jpg/" }) {
        childImageSharp {
          gatsbyImageData(
            width: 50
            placeholder: BLURRED
            formats: [AUTO, WEBP, AVIF]
          )
        }
      }
    }
  `);

  const avatar = getImage(data?.avatar);

  return (
    <a
      href="https://www.louisyoung.co.uk"
      target="_blank"
      rel="noopener noreferrer"
      className="block hover:opacity-80 transition duration-200"
    >
      <figure className="flex items-center">
        <GatsbyImage
          image={avatar}
          className="w-12 h-12 rounded-full mr-4"
          alt="Louis Young"
        />
        <figcaption className="text-xl font-bold">Louis Young</figcaption>
      </figure>
    </a>
  );
};

export default Author;
