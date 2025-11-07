const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'electron-renderer',
  entry: {
    renderer: './src/renderer/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.renderer.json'
          }
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    fallback: {
      "path": false,
      "fs": false,
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
    }),
    new webpack.DefinePlugin({
      'global': 'window',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }),
  ],
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/renderer'),
    },
    port: 3001,
    hot: true,
    open: false,
  },
  externals: {
    // Don't bundle electron in the renderer
    electron: 'commonjs2 electron',
  },
};