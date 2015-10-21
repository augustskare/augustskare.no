module.exports = {
  dist: {
    files: [
      {
        expand: true,
        cwd: 'public/',
        src: ['**', '!*.css'],
        dest: 'build/'
      }
    ]
  }
}
