const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/dist/' // Points to the dist subdirectory
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { url: false } // Don't process URLs in CSS
          }
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: '../index.html' // Output to parent directory
    }),
    new MiniCssExtractPlugin({
      filename: 'static/css/[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: 'scripts',
          to: 'static/js'
        },
        {
          from: 'src/design/design.css',
          to: 'static/css/design.css'
        },
        {
          from: 'public/manifest.json',
          to: '..'
        },
        {
          from: 'src/service-worker.js',
          to: '..'
        }
      ]
    }),
    new WorkboxPlugin.GenerateSW({
      // Skip waiting for service worker activation
      skipWaiting: true,
      // Take control immediately
      clientsClaim: true,
      // Custom runtime caching rules
      runtimeCaching: [{
        // Cache API requests
        urlPattern: new RegExp('^https://chat-communication\\.perpetuumit\\.com'),
        handler: 'NetworkFirst'
      }]
    })
  ],
  devServer: {
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public')
    },
    port: 3000
  }
};
