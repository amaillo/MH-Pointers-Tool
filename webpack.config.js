const path = require("path");

module.exports = {
  mode: process.env.NODE_ENV || "development",
  devtool: "source-map",
  entry: "./src",
  target: "node",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js"
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        use: [
          {
            loader: "native-ext-loader"
          }
        ]
      }
    ]
  },
};