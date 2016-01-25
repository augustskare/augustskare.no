module.exports = {
  options: {
    accessKeyId: '<%= aws.AWSAccessKeyId %>',
    secretAccessKey: '<%= aws.AWSSecretKey %>',
    uploadConcurrency: 5,
    downloadConcurrency: 5
  },
  production: {
    options: {
      bucket: '<%= aws.buket %>'
    },
    files: [
      {
        expand: true,
        cwd: './build',
        src: '**',
        dest: '/',
        action: 'upload',
        differential: true
      }
    ]
  }
}
