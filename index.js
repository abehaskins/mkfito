#!/usr/bin/env node

var Twitter = require('twitter'),
    colors = require('colors'),
    child_process = require('child_process'),
    Promise = require('es6-promises'),
    fs = require('fs');

var pipeFile = process.argv[2] || '/tmp/twitterd',
    status;

var client = new Twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
});

function check_old_pipe(pipeFile) {
  return new Promise(function (resolve, reject) {
    fs.exists(pipeFile, function (exists) {
      if (exists) reject();
      else resolve(pipeFile)
    });
  });
}

function make_pipe(pipeFile) {
  console.log('Making a pipe'.blue, pipeFile.green, '...'.blue);
  status = 'setup';
  return new Promise(function (resolve, reject) {
    child_process
      .spawn('mkfifo', [pipeFile])
      .on('exit', resolve.bind(null, pipeFile))
      .on('error', reject)
  });
}

function watch_pipe(pipeFile) {
  console.log('Watching pipe...'.blue);
  status = 'running';
  return new Promise(function (resolve, reject) {
    child_process
      .spawn('tail', ['-f', pipeFile])
      .on('exit', resolve.bind(null, pipeFile))
      .on('error', reject)
      .stdout
      .on('data', function (buf) {
        var tweet = buf.toString();
        client.post('statuses/update.json', {status: tweet}, function (data) {
          console.log('Tweeted:'.blue, tweet.green);
        });
      });
  });
}

function setup_exit(pipeFile) {
  process.stdin.resume();
  process.on('exit', exit.bind(null, pipeFile));
  process.on('SIGINT', exit.bind(null, pipeFile));
  process.on('uncaughtError', exit.bind(null, pipeFile));
  return pipeFile;
}

function clean_pipe(pipeFile) {
  console.log('Cleaning up pipe...'.blue);
  status = 'exiting'
  return new Promise(function (resolve, reject) {
    child_process
      .spawn('rm', [pipeFile])
      .on('close', process.exit);
  });
}

function exit(pipeFile) {
  if (status !== 'running') return;
  console.log('Preparing to exit...'.blue);
  clean_pipe(pipeFile).then(process.exit)
  console.log('Exiting...'.blue);
}

check_old_pipe(pipeFile)
  .catch(function (err) {
    console.log('Pipe file'.red, pipeFile.red, 'already exists!'.red)
    process.exit(1)
  })
  .then(make_pipe)
  .catch(function (err) {
    console.log(err.toString().red)
    process.exit(1)
  })
  .then(setup_exit)
  .then(watch_pipe)
  .catch(function (err) {
    console.log(err.toString().red)
    process.exit(1)
  });
