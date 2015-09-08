var babel = require('babel');
var browserify = require('browserify');
var childProcess = require('child_process');
var clc = require('cli-color');
var fse = require('fs-extra');
var nodeSass = require('node-sass');
var nodeWatch = require('node-watch');
var pkg = require('../package.json');
var uglifyJS = require('uglify-js');
var util = require('util');

// CONFIG
// -----------------------------------------------
var jsSrcDir = 'src/js';
var buildDir = 'build';
var jsDir = 'js';
var cssDir = 'css';
var scssDir = 'src/scss';

// options for babel
var babelOptions = {
  sourceMap: 'inline',
  modules: 'common',
  optional: ['runtime']
};

// options for browserify
var browserifyOptions = {
  standalone: pkg.standalone,
  debug: true
};

// colors for shell - for a more complete list
// cf. http://stackoverflow.com/questions/5947742/how-to-change-the-output-color-of-echo-in-linux
var red   = '\033[0;31m';
var green = '\033[0;32m';
var NC    = '\033[0m'; // No Color

// COMMAND INTERPRETER
// -----------------------------------------------
var command = process.argv[2];
// execute the correct function given the script
switch (command) {
  case '--bundle':
    bundle();
    break;
  case '--sass':
    sass();
    break;
  case '--transpile':
    transpileAll();
    break;
  case '--uglify':
    uglify();
    break;
  case '--watch':
    watch();
    break;
}

// HELPERS
// -----------------------------------------------

// create filename from src to build
function createTargetName(filename) {
  // replace source dir with target dir and '.es6.js' to '.js'
  return filename.replace(new RegExp('^' + jsSrcDir), buildDir).replace('.es6.js', '.js');
}

// create filename from `pkg.main` to `umd` version
function getUmdName() {
  return pkg.main.replace(new RegExp('^' + buildDir), jsDir).replace('.js', '.umd.js');
}

// create filename from `umd` to `min` version
function getMinName() {
  return getUmdName().replace('.umd.js', '.min.js');
}

// SCRIPTS
// -----------------------------------------------

// watch source dir
function watch() {
  nodeWatch(jsSrcDir, function(filename) {
    console.log(util.format(green + '=> "%s" changed' + NC, filename));
    transpile(filename, null, bundle);
  });
  nodeWatch(scssDir, function(filename) {
    console.log(util.format(green + '=> "%s" changed' + NC, filename));
    sass(filename);
  })
}

// create the `.umd.js` version
function bundle() {
  var src = './' + pkg.main;
  var target = getUmdName();
  var b = browserify(src, browserifyOptions);

  try {
    b.bundle().pipe(fse.createWriteStream(target));
    // is not called at the right place - streams are async
    console.log(util.format(green + '=> "%s" successfully created' + NC, target));
  } catch(e) {
    return console.log(err.message);
  }

}

// create the `.min.js` version
function uglify() {
  var src = getUmdName();
  var target = getMinName();
  var res = uglifyJS.minify(src);

  fse.outputFile(target, res.code, function(err, res) {
    if (err) { return console.log(err.message); }

    console.log(util.format(green + '=> "%s" successfully created' + NC, target));
    // reminder
    console.log(util.format(red + '==> THINK ABOUT UPDATING PACKAGE VERSION [npm --help version] <==' + NC));
  });
}

// transpile all files in `jsSrcDir`
function transpileAll() {
  var cmd = 'find ' + jsSrcDir + ' -type f';

  childProcess.exec(cmd , function(err, stdout, stderr) {
    if (err) { console.error(err); }
    var fileList = stdout.split('\n');

    var stack = [];

    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      if (!file) { continue; }

      stack.push(file);
    }

    transpile(stack.shift(), stack);
  });
}

// transpile one file or several files in serial
// @param `stack` is a workaround for babel which has some kind of leak and
// cannot transpile several files in parallel without being messy with sourceMaps.
// Using the Sync method crash the entire script each time there is an error in
// the code which is really boring when watching...
function transpile(src, stack, cb) {
  var target = createTargetName(src);

  babel.transformFile(src, babelOptions, function (err, result) {
    if (err) { return console.log(err.codeFrame); }

    fse.outputFile(target, result.code, function(err) {
      if (err) { return console.error(err.message); }

      console.log(util.format(green + '=> "%s" successfully transpiled to "%s"' + NC, src, target));

      // next
      if (stack && stack.length) {
        transpile(stack.shift(), stack);
      }

      cb();
    });
  });

}

// convert to sass
function sass(filename) {
  var src = scssDir + '/main.scss';
  var target = cssDir + '/main.css';

  nodeSass.render({
    file: src,
    outFile: target
  }, function(error, result) { // node-style callback from v3.0.0 onwards
    if (error) {
      return console.error('ERROR (status ' + error.status + ', line ' + error.line + ', column ' + error.column + '):\n' + error.message + '\nin ' + error.file );
    }

    fse.outputFile(cssDir + '/main.css', result.css, function(err) {
      if (err) { return console.error(err.message); }

      console.log(util.format(green + '=> "%s" successfully transpiled to "%s"' + NC, src, target));
    });

  });
}
