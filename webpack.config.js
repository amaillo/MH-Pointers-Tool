const path = require("path");


module.exports = {
  mode: process.NODE_ENV || "development",
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