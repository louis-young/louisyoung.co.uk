module.exports = {
  plugins: [
    {
      resolve: "gatsby-source-filesystem",
      options: {
        path: `${__dirname}/content/posts`,
        name: "posts",
      },
    },
    {
      resolve: "gatsby-source-filesystem",
      options: {
        path: `${__dirname}/content/assets`,
        name: "assets",
      },
    },

    {
      resolve: `gatsby-plugin-google-gtag`,
      options: {
        trackingIds: ["G-CQ5X65RCG6"],
      },
    },
    {
      resolve: "gatsby-plugin-manifest",
      options: {
        name: "Software Development Blog",
        short_name: "Louis Young",
        start_url: "/",
        background_color: "#ffffff",
        theme_color: "#000000",
        display: "minimal-ui",
        icon: "content/assets/icon/icon.png",
      },
    },
    {
      resolve: "gatsby-plugin-mdx",
      options: {
        gatsbyRemarkPlugins: [
          {
            resolve: "gatsby-remark-images",
            options: {
              maxWidth: 1056,
            },
          },
          {
            resolve: "gatsby-remark-autolink-headers",
            options: {
              icon: false,
            },
          },
        ],
      },
    },
    {
      resolve: "gatsby-plugin-layout",
      options: {
        component: require.resolve("./src/components/layout.js"),
      },
    },
    "gatsby-transformer-sharp",
    "gatsby-plugin-sharp",
    "gatsby-plugin-react-helmet",
    "gatsby-plugin-postcss",
  ],
};
