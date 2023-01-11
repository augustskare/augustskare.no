const CleanCSS = require("clean-css");
const { default: feedbinStars } = require("eleventy-plugin-feedbin-stars");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(feedbinStars, {
    feed_id: "5Euw2uq5T9oUL7tUbs0_2A",
  });
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
  });
  eleventyConfig.addFilter("cssmin", (css) => {
    return new CleanCSS({}).minify(css).styles;
  });
  eleventyConfig.addFilter("host", (url) => {
    if (url) {
      return new URL(url).host;
    }

    return "Invalid url";
  });

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
