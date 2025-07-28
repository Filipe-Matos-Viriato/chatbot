const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'loader.js',
    library: 'ViriatoChatbot',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat'
    },
    extensions: ['.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', {
                pragma: 'h',
                pragmaFrag: 'Fragment'
              }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.VITE_API_URL': JSON.stringify(
        process.env.VITE_API_URL || 'https://chatbot1-eta.vercel.app'
      )
    })
  ],
  optimization: {
    minimize: true
  },
  mode: 'production'
}; 