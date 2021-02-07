// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    /* ... */
  },
  plugins: [
    /* ... */
  ],
  packageOptions: {
    /* ... */
  },
  devOptions: {
    /* ... */
  },
  buildOptions: {
    /* ... */
  },
  exclude: [
    "**/node_modules/**/*",
    "**/test/**/*",
    "dev.js",
    "mytmp/**/*",
    "coverage/**/*",
    ".gitignore",
    "index.d.ts",
    "jsconfig.json",
    "LICENSE",
    "package-lock.json",
    "package.json",
    "README.md",
    "snowpack.config.cjs",
  ],
};
