import React from "react";

import { graphql } from "gatsby";
import Image from "gatsby-image";

import Author from "../components/author";
import Meta from "../components/meta";
import Container from "../components/container";
import Progress from "../components/progress";
import Content from "../components/content";
import Date from "../components/date";

const Post = ({ data }) => {
  const post = data.mdx;

  return (
    <>
      <Meta
        title={post.frontmatter.title}
        description={post.excerpt}
        image={post.frontmatter.image.childImageSharp.sizes.src}
        slug={post.slug}
      />

      <Progress />

      <Container>
        <article className="mt-8 mb-24 md:mb-32">
          <h1 className="text-5xl md:text-6xl xl:text-7xl font-bold tracking-tighter leading-tight md:leading-none mb-12 text-left">
            {post.frontmatter.title}
          </h1>

          <div className="mt-12 mb-12">
            <Author />
          </div>

          <Image
            fluid={post.frontmatter.image.childImageSharp.sizes}
            alt={post.frontmatter.title}
            className="mb-8 md:mb-16 sm:mx-0 w-full h-full max-h-35 object-cover rounded"
          />

          <div className="max-w-2xl mx-auto mb-6 text-lg">
            <Date dateString={post.frontmatter.date} />
          </div>

          <Content content={post.body} />
        </article>
      </Container>
    </>
  );
};

export default Post;

export const pageQuery = graphql`
  query BlogPostBySlug($id: String!) {
    mdx(id: { eq: $id }) {
      id
      slug
      excerpt(pruneLength: 160)
      body
      frontmatter {
        title
        date(formatString: "MMMM DD, YYYY")
        description
        image {
          childImageSharp {
            sizes(maxWidth: 1056) {
              ...GatsbyImageSharpSizes
            }
          }
        }
      }
    }
  }
`;
