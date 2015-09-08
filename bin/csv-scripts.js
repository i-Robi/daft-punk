// Libraries
var fse = require('fs-extra');
var parse = require('csv-parse');
var util = require('util');

// Files and paths
var filename = process.argv[2];
var srcDir = 'resources/markers';
var srcPath = srcDir + '/' + filename;
var targetDir = 'assets';
var targetPath = targetDir + '/' + filename.replace('.txt', '.json');

// Colors for shell
var green    = '\033[0;32m';
var NO_COLOR = '\033[0m';

var parser = parse({ delimiter: " " }, function(err, data) {
  if (err) throw err;

  var output = { position: [], duration: [], strength: [], chord: [], variation: [] };

  for (var i = 0; i < data.length; i++) {
    var segment = data[i];
    output.position[i] = parseFloat(segment[0]);
    output.duration[i] = parseFloat(segment[1]);
    output.strength[i] = parseInt(segment[2]);
    output.chord[i] = parseInt(segment[3]);
    output.variation[i] = parseInt(segment[4]);
  }

  fse.outputFile(targetPath, JSON.stringify(output), function(err) {
    if (err) throw err;

    console.log(util.format(green + '=> "%s" successfully created' + NO_COLOR, targetPath));
  })
});

function csv2json() {
  fse.createReadStream(srcPath).pipe(parser);
}

csv2json();
