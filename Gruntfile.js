'use strict';

function loadConfig(path) {
  var glob = require('glob');
  var object = {};
  var key;
  glob.sync('*', {cwd: path}).forEach(function(option) {
    key = option.replace(/\.js$/,'');
    object[key] = require(path + option);
  });
  return object;
}

module.exports = function(grunt) {

  var config = {
    pkg: grunt.file.readJSON('./package.json'),
    aws: grunt.file.readJSON('./aws-conf.json')
  };

  require('time-grunt')(grunt);
  require('load-grunt-tasks')(grunt);
  grunt.util._.extend(config, loadConfig('./tasks/options/'));
  grunt.initConfig(config);

  grunt.registerTask('build', [
    'clean',
    'copy',
    'postcss',
    'inline',
    'htmlmin'
  ]);

  grunt.registerTask('deploy', ['build', 'aws_s3']);

};
