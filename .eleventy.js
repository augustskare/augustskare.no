const pluginRss = require("@11ty/eleventy-plugin-rss");
const CleanCSS = require("clean-css");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addFilter("htmlDateString", dateObj => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });
  eleventyConfig.addFilter("cssmin", css => {
    return new CleanCSS({}).minify(css).styles;
  });

  eleventyConfig.addCollection("notes", collection => {
    return collection
      .getAll()
      .filter(({ inputPath }) => inputPath.includes("notes/"));
  });

  eleventyConfig.addPlugin(pluginRss);

  return {
    templateFormats: ["md", "njk", "html", "liquid"],
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      input: "src",
    },
  };
};
