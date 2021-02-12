const path = require("path");

const { createFilePath } = require("gatsby-source-filesystem");

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions;

  const postTemplate = path.resolve("./src/templates/post.js");

  const result = await graphql(
    `
      {
        allMdx(sort: { fields: [frontmatter___date], order: ASC }, limit: 1000) {
          nodes {
            id
            fields {
              slug
            }
          }
        }
      }
    `
  );

  const posts = result.data.allMdx.nodes;

  if (posts.length) {
    posts.forEach((post) => {
      createPage({
        path: post.fields.slug,
        component: postTemplate,
        context: {
          id: post.id,
        },
      });
    });
  }
};

exports.onCreateNode = ({ node, actions, getNode }) => {
  const { createNodeField } = actions;

  if (node.internal.type === "Mdx") {
    const value = createFilePath({ node, getNode });

    createNodeField({
      name: "slug",
      node,
      value,
    });
  }
};

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;
  createTypes(`
    type Mdx implements Node {
      frontmatter: Frontmatter
      fields: Fields
    }

    type Frontmatter {
      title: String
      description: String
      date: Date @dateformat
      image: File @fileByRelativePath
    }

    type Fields {
      slug: String
    }
  `);
};
