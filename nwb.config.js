module.exports = {
  type: 'react-app',
  webpack: {
    rules: {
      postcss: {
        plugins: [
          require('precss')(),
          require('autoprefixer')()
        ]
      }
    }
  }
}
