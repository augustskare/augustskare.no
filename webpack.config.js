const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");

const paths = {
  src: path.resolve(__dirname, 'source'),
  dist: path.resolve(__dirname, 'public'),
}

const filename = (prod, ext) => `${prod ? '[name].[contenthash:5]' : '[name]'}.${ext}`;

module.exports = (env = {}) => {
  const ENV = env.mode || 'production';
  const PRODUCTION = ENV === 'production';
  
  return {
    context: paths.src,
    entry: {
      index: './index.js',
    },
    output: {
      path:  paths.dist,
      publicPath: '/',
      chunkFilename: filename(PRODUCTION, 'js'),
      filename: filename(PRODUCTION, 'js'),
    },
    mode: ENV,
    optimization: {
      minimizer: [
        new UglifyJsPlugin({
          cache: true,
          parallel: true,
          sourceMap: true,
        }),
        new OptimizeCSSAssetsPlugin({})
      ]
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [
            PRODUCTION ? MiniCssExtractPlugin.loader : 'style-loader', 
            'css-loader'
          ]
        },
      ]
    },
    devServer: {
      contentBase: paths.dist,
      host: '0.0.0.0',
      hot: false,
      overlay: true,
      historyApiFallback: true,
      disableHostCheck: true,
      useLocalIp: true,
    },
    devtool: PRODUCTION ? 'source-map' : 'cheap-module-eval-source-map',
    plugins: ([
      new HtmlWebpackPlugin({
        template: path.join(paths.src, 'index.html'),
        minify: { collapseWhitespace: true },
      }),
      new CopyWebpackPlugin([{ from: 'static' }]),
      new CleanWebpackPlugin(['public']),
      new webpack.NamedModulesPlugin(),
    ]).concat(PRODUCTION ? [
      new MiniCssExtractPlugin({
        filename: filename(true, 'css'),
        chunkFilename: filename(true, 'css'),
      })
    ] : [])
  }
}