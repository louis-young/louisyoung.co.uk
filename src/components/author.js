import React from "react";

import { useStaticQuery, graphql } from "gatsby";
import Image from "gatsby-image";

const Author = () => {
  const data = useStaticQuery(graphql`
    query AuthorQuery {
      avatar: file(absolutePath: { regex: "/author/author.jpg/" }) {
        childImageSharp {
          fixed(width: 50, height: 50, quality: 95) {
            ...GatsbyImageSharpFixed
          }
        }
      }
    }
  `);

  const avatar = data?.avatar?.childImageSharp?.fixed;

  return (
    <a
      href="https://www.louisyoung.co.uk"
      target="_blank"
      rel="noopener noreferrer"
      className="block hover:opacity-80 transition duration-200"
    >
      <figure className="flex items-center">
        <Image
          fixed={avatar}
          className="w-12 h-12 rounded-full mr-4"
          alt="Louis Young"
        />
        <figcaption className="text-xl font-bold">Louis Young</figcaption>
      </figure>
    </a>
  );
};

export default Author;
