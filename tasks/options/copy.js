module.exports = {
  dist: {
    files: [
      {
        expand: true,
        cwd: 'public/',
        src: ['**', '!*.html', '!*.css'],
        dest: 'build/'
      }
    ]
  }
}
