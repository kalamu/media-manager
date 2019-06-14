const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const javascriptModule = {
  target: 'web',
  entry: './src/js/KalamuMediaManager.js',
  output: {
    library: 'KalamuMediaManager',
    libraryExport: "default",
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.bundle.js'
  }
}

const cssModule = {
  target: 'web',
  entry: './src/css/style.scss',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.bundle.css'
  },
  module: {
        rules: [
            {
                test: /\.scss$/,
                use: [MiniCssExtractPlugin.loader, "css-loader", 'sass-loader']
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "[name].css",
            chunkFilename: "[id].css"
        })
    ]
}

module.exports = [javascriptModule, cssModule];
