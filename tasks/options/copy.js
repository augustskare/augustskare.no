module.exports = {
  dist: {
    files: [
      {
        expand: true,
        cwd: 'public/',
        src: ['**', 'style.css', '!bower_components/**', '!app.js'],
        dest: 'build/'
      }
    ]
  }
}
