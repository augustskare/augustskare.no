const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const paths = {
  src: path.resolve(__dirname, 'source'),
  dist: path.resolve(__dirname, 'public'),
}

module.exports = (env = {}) => {
  const ENV = env.env || 'dev';
  const PRODUCTION = ENV === 'prod';

  return {
    context: paths.src,
    entry: {
      index: './index.js',
    },
    output: {
      path:  paths.dist,
      publicPath: '/',
      chunkFilename: PRODUCTION ? '[name].[chunkhash].js' : '[name].js',
      filename: PRODUCTION ? '[name].[chunkhash].js' : '[name].js',
    },
    stats: {
      colors: true,
      reasons: true,
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [{
              loader: 'css-loader',
              options: {
                sourceMap: !PRODUCTION,
              }
            }]
          })
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
      new ExtractTextPlugin({
        filename: '[name].[chunkhash].css',
        allChunks: true,
        disable: !PRODUCTION,
      }),
      new CopyWebpackPlugin([{ from: 'static' }]),
      new CleanWebpackPlugin(['public']),
      new webpack.NamedModulesPlugin(),
    ]).concat(ENV==='prod' ? [
      new webpack.optimize.ModuleConcatenationPlugin(),
      new webpack.HashedModuleIdsPlugin(),
      new UglifyJSPlugin({
        sourceMap: true
      }),
    ] : [])
  }
}