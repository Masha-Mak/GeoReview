let path = require("path");
let rules = require("./webpack.config.rules.js")();
let UglifyJsPlugin = require("uglifyjs-webpack-plugin");
let HtmlPlugin = require("html-webpack-plugin");
let CleanWebpackPlugin = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const fs = require("fs");

const settingsPath = "./settings.json";
const proxy = {};

rules.push({
  test: /\.css$/i,
  use: [MiniCssExtractPlugin.loader, "css-loader"],
});

if (fs.existsSync(settingsPath)) {
  const settings = require(settingsPath);
  Object.assign(proxy, settings.proxy);
}

module.exports = {
  entry: {
    index: "./src/index.js",
  },
  output: {
    filename: "[name].[hash].js",
    path: path.resolve("dist"),
  },
  devServer: {
    index: "index.html",
    overlay: true,
    proxy,
  },
  devtool: "source-map",
  module: {
    rules,
  },
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        cache: true,
        parallel: true,
        uglifyOptions: {
          compress: false,
          ecma: 6,
          mangle: true,
        },
        sourceMap: true,
      }),
    ],
  },
  plugins: [
    new HtmlPlugin({
      title: "GeoReview",
      template: "index.hbs",
    }),
    new MiniCssExtractPlugin(),
    new CleanWebpackPlugin(["dist"]),
  ],
};
