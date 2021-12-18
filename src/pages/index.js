import React from "react";
import { graphql } from "gatsby";

import truncate from "../utilities/truncate";

import Meta from "../components/meta";
import Post from "../components/post";
import { Container } from "../components/container";

const Index = ({ data }) => {
  const posts = data.allMdx.nodes;

  return (
    <>
      <Meta />

      <section>
        <h1 className="py-14 md:py-20 text-center text-2xl md:text-4xl font-bold tracking-tight leading-normal md:leading-normal">
          Software development blog
          <br />
          by Louis Young
        </h1>
      </section>

      <Container>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-8 mt-6 mb-32">
          {posts.map((post) => {
            return (
              <Post
                key={post.fields.slug}
                title={post.frontmatter.title}
                image={post.frontmatter.image}
                link={post.fields.slug}
                excerpt={truncate(post.frontmatter.description)}
              />
            );
          })}
        </section>
      </Container>
    </>
  );
};

export default Index;

export const pageQuery = graphql`
  query {
    allMdx(sort: { fields: [frontmatter___date], order: DESC }) {
      nodes {
        excerpt(pruneLength: 165)
        fields {
          slug
        }
        frontmatter {
          date(formatString: "MMMM DD, YYYY")
          title
          description
          image {
            childImageSharp {
              gatsbyImageData(
                width: 500
                placeholder: BLURRED
                formats: [AUTO, WEBP, AVIF]
              )
            }
          }
        }
      }
    }
  }
`;
