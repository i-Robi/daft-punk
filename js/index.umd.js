(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.script = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @file Dot navigation.
 * @description Based on Codrops' article [Dot Navigation Styles]
 * (http://tympanus.net/codrops/2014/01/21/dot-navigation-styles/).
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 */

'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var DotNav = (function () {
  function DotNav() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, DotNav);

    this.callback = options.callback;
    this.nav = options.nav;
    this.selected = options.selected;

    this.init();
  }

  _createClass(DotNav, [{
    key: 'init',
    value: function init() {
      var _this = this;

      var dots = this.nav.querySelectorAll('li');

      dots[this.selected].classList.add('selected');

      var _loop = function (i) {
        var dot = dots[i];

        dot.addEventListener('click', function () {
          if (i !== _this.selected) {
            dots[_this.selected].classList.remove('selected');

            dot.classList.add('selected');
            _this.callback(i);
            _this.selected = i;
          }
        });
      };

      for (var i = 0; i < dots.length; i++) {
        _loop(i);
      }
    }
  }]);

  return DotNav;
})();

module.exports = DotNav;

},{"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13}],2:[function(require,module,exports){
/**
 * @file Guitar engine.
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 */

'use strict';

// Libraries

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var audioContext = require('waves-audio').audioContext;
var SegmentEngine = require('waves-audio').SegmentEngine;
var TimeEngine = require('waves-audio').TimeEngine;

// Helper functions
function getMaxOfArray(array) {
  if (array.length > 0) return Math.max.apply(null, array);
  return null;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function getRandomValue(array) {
  return array[getRandomInt(0, array.length - 1)];
}

function chordConverter(chord, variation) {
  if (chord === 0) return 'mute';

  return chords[(chord - 1) * 2 + variation - 1];
}

function generateChordProgression() {
  var chordProgression = [];

  for (var i = 0; i < 200; i++) {
    // (4+2) bars * 8 beats * 4 eigth-notes = 192
    var chord = undefined;
    if (i % 128 < 32) chord = 'A#m';else if (i % 128 < 64) chord = 'G#';else if (i % 128 < 96) chord = 'D#m';else chord = 'F#';

    var variation = undefined;
    if (i % 16 < 3) variation = '-high';else variation = '-low';

    chordProgression[i] = chord + variation;
  }

  return chordProgression;
}

function sortMarkerIndices(markers) {
  var sortedIndices = {};

  for (var i = 0; i < markers.position.length; i++) {
    var chordName = chordConverter(markers.chord[i], markers.variation[i]);

    if (!sortedIndices[chordName]) sortedIndices[chordName] = [];

    if (markers.strength[i] < 2) sortedIndices[chordName].push(i);
  }

  return sortedIndices;
}

// Helper constants
var chords = ['A#m-high', 'A#m-low', 'G#-high', 'G#-low', 'D#m-high', 'D#m-low', 'F#-high', 'F#-low'];
var accents = [0, 3, 6, 10, 12, 13, 14, 15];

var GuitarEngine = (function (_TimeEngine) {
  _inherits(GuitarEngine, _TimeEngine);

  /**
   *
   */

  function GuitarEngine() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, GuitarEngine);

    _get(Object.getPrototypeOf(GuitarEngine.prototype), 'constructor', this).call(this);

    // Public attributes
    this.offset = options.offset || 0;
    this.outputNode = audioContext.createGain();
    this.period = options.period;
    this.startTime = null;

    // Private attributes
    this._chordProgression = generateChordProgression();
    this._energyBuffer = [];
    this._energyBufferMaxLength = 2; // TODO: automate
    this._lastBeatPlayed = null;
    this._mode = options.mode;
    this._numBeats = options.numBeats;
    this._p1 = null;
    this._p1Accent = null;
    this._p1NoAccent = null;
    this._p2 = null;
    this._p2BaseValue = null;
    this._p2MultiplyingFactor = null;
    this._segmentEngine = new SegmentEngine();
    this._segmentIndices = sortMarkerIndices(options.segmentMarkers);
    this._segmentMarkers = options.segmentMarkers;
    this._scratchBuffer = [];
    this._scratchBufferMaxLength = 5; // TODO: automate

    // Segment engine configuration
    this._segmentEngine.buffer = options.audioBuffer;
    this._segmentEngine.positionArray = this._segmentMarkers.position;
    this._segmentEngine.durationArray = this._segmentMarkers.duration;
    this._segmentEngine.connect(this.outputNode);
  }

  /**
   *
   */

  _createClass(GuitarEngine, [{
    key: 'syncPosition',
    value: function syncPosition(time, position, speed) {
      var nextPosition = Math.floor(position / this.period) * this.period;

      if (speed > 0 && nextPosition < position) nextPosition += this.period;else if (speed < 0 && nextPosition > position) nextPosition -= this.period;

      return nextPosition;
    }
  }, {
    key: 'advancePosition',
    value: function advancePosition(time, position, speed) {
      var currentBeat = Math.floor((time - this.startTime - this.offset) / this.period);
      var rand = Math.random();
      var eMax = Math.pow(getMaxOfArray(this._energyBuffer), 2); // TODO (inputM)
      var sMax = getMaxOfArray(this._scratchBuffer);
      var level = Math.max(eMax, sMax);

      // If the beat is on the original song's accents, high probability to play
      if (accents.indexOf(currentBeat % 16) > -1) this._p1 = this._p1Accent;else this._p1 = this._p1NoAccent;

      // If the last chord was played at least 3 beats before the current one,
      // increase probability to play
      if (this._lastBeatPlayed && this._lastBeatPlayed < currentBeat - 2) this._p2 *= this._p2MultiplyingFactor;

      // Calculate the probability to play a chord on this beat
      var p = Math.max(this._p1, Math.min(this._p1 * this._p2, 1));

      // Decide what to play
      if (level > 0.9 && rand < p) {
        this.trigger(time, 'chord');
        this._lastBeatPlayed = currentBeat;
        this._p2 = this._p2BaseValue;
      } else if (level > 0.5) this.trigger(time, 'mute');

      if (speed < 0) return position - this.period;

      return position + this.period;
    }

    /**
     *
     */
  }, {
    key: 'trigger',
    value: function trigger(time, type) {
      var currentBeat = Math.floor((time - this.startTime - this.offset) / this.period);
      var currentChord = undefined;
      var index = undefined;

      if (currentBeat >= 0 && currentBeat < this._numBeats) currentChord = this._chordProgression[currentBeat];

      if (type === 'chord' && currentChord) index = getRandomValue(this._segmentIndices[currentChord]);else if (type === 'mute' || currentBeat < 0) index = getRandomValue(this._segmentIndices['mute']);

      // Stop playing after the end of the backtrack
      if (currentBeat < this._numBeats) {
        this._segmentEngine.segmentIndex = index;
        this._segmentEngine.trigger(time);
      }
    }

    /**
     *
     */
  }, {
    key: 'onEnergy',
    value: function onEnergy(val) {
      if (this._energyBuffer.length === this._energyBufferMaxLength) this._energyBuffer.pop();

      this._energyBuffer.unshift(val);
    }

    /**
     *
     */
  }, {
    key: 'onScratch',
    value: function onScratch(val) {
      if (this._scratchBuffer.length === this._scratchBufferMaxLength) this._scratchBuffer.pop();

      this._scratchBuffer.unshift(val);
    }

    /**
     *
     */
  }, {
    key: 'start',
    value: function start() {
      this.startTime = audioContext.currentTime;
      this.changeMode(this._mode);
    }

    /**
     *
     */
  }, {
    key: 'stop',
    value: function stop() {
      // TODO: remove if empty
      this._p1 = null;
      this._p2 = null;
    }

    /**
     *
     */
  }, {
    key: 'connect',
    value: function connect(node) {
      this.outputNode.connect(node);
    }

    /**
     *
     */
  }, {
    key: 'changeMode',
    value: function changeMode(mode) {
      this._mode = mode;

      switch (mode) {
        case 0:
          // Stick to the original song
          this._p1Accent = 1;
          this._p1NoAccent = 0;
          this._p2BaseValue = 0;
          this._p2MultiplyingFactor = 0;
          break;
        case 1:
          // A little guidance
          this._p1Accent = 1;
          this._p1NoAccent = 0.3;
          this._p2BaseValue = 0.4;
          this._p2MultiplyingFactor = 1.1;
          break;
        case 2:
          // Complete freedom
          this._p1Accent = 1;
          this._p1NoAccent = 0.5;
          this._p2BaseValue = 0.5;
          this._p2MultiplyingFactor = 1.2;
          break;
      }
    }
  }]);

  return GuitarEngine;
})(TimeEngine);

module.exports = GuitarEngine;

},{"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15,"waves-audio":111}],3:[function(require,module,exports){
/**
 * @file Scratch
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 * @description Converts the action of scratching the screen or moving the
 * mouse into an energy value between 0 and 1.
 */

'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var EventEmitter = require('events').EventEmitter;

function speed(a, b) {
  var dX = a[0] - b[0];
  var dY = a[1] - b[1];
  var dT = b[2] - a[2];

  if (dX !== 0 && dY !== 0 && dT !== 0) return [Math.sqrt(dX * dX + dY * dY) / dT, b[2]];

  return [0, b[2]];
}

function acc(a, b) {
  var dS = b[0] - a[0];
  var dT = b[1] - a[1];

  if (dS !== 0 && dT !== 0) return [dS / dT, b[1]];

  return [0, b[1]];
}

function getTime() {
  return window.performance && window.performance.now ? window.performance.now() / 1000 : new Date().getTime() / 1000;
}

/**
 * @class LowPassFilter
 * @description Applies a low-pass filter.
 */

var LowPassFilter = (function () {
  function LowPassFilter(timeConstant) {
    _classCallCheck(this, LowPassFilter);

    this._XFiltered;
    this._previousTimestamp;
    this._timeConstant = timeConstant;
  }

  _createClass(LowPassFilter, [{
    key: '_decay',
    value: function _decay(dt) {
      return Math.exp(-2 * Math.PI * dt / this._timeConstant);
    }
  }, {
    key: 'input',
    value: function input(x) {
      var now = getTime();

      if (this._previousTimestamp) {
        var dt = now - this._previousTimestamp;
        var k = this._decay(dt);

        this._XFiltered = k * this._XFiltered + (1 - k) * x;
        this._previousTimestamp = now;

        return this._XFiltered;
      } else {
        this._previousTimestamp = now;
        this._XFiltered = x;
        return;
      }
    }
  }]);

  return LowPassFilter;
})();

var Scratch = (function (_EventEmitter) {
  _inherits(Scratch, _EventEmitter);

  function Scratch() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Scratch);

    _get(Object.getPrototypeOf(Scratch.prototype), 'constructor', this).call(this);

    this.event = null;

    this._bufferLength = options.bufferLength || 5;
    this._filter = new LowPassFilter(0.05);
    this._surface = options.surface || document;
    this._timeout = null;

    this._x = null;
    this._y = null;
    this._s = null;
    this._lastS = null;
    this._acc = null;

    this._surface.addEventListener('mousemove', this.onMotion.bind(this));
    this._surface.addEventListener('touchmove', this.onMotion.bind(this));
  }

  _createClass(Scratch, [{
    key: 'onMotion',
    value: function onMotion(e) {
      var timestamp = e.timeStamp / 1000;
      var x = undefined;
      var y = undefined;

      switch (e.type) {
        case 'mousemove':
          x = e.clientX;
          y = e.clientY;
          break;
        case 'touchmove':
          x = e.changedTouches[0].clientX;
          y = e.changedTouches[0].clientY;
          break;
      }

      var pos = [x, y, timestamp];

      if (this._pos) {
        this._lastS = this._s;
        this._s = speed(pos, this._pos);
      }

      if (this._lastS) this._acc = acc(this._s, this._lastS);

      this._pos = [x, y, timestamp];

      if (this._acc) {
        this.event = this._filter.input(Math.min(Math.abs(this._acc[0] / 100000), 1));
      }

      this.emit('scratch', this.event);

      clearTimeout(this._timeout);
      this._timeout = this.timeoutFun();
    }
  }, {
    key: 'timeoutFun',
    value: function timeoutFun() {
      var _this = this;

      return setTimeout(function () {
        _this.event = _this._filter.input(0);
        _this.emit('scratch', _this.event);
        _this._timeout = _this.timeoutFun();
      }, 50);
    }
  }]);

  return Scratch;
})(EventEmitter);

module.exports = Scratch;

},{"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15,"events":82}],4:[function(require,module,exports){
/**
 * @file Interactive version of Daft Punk's Lose Yourself To Dance.
 * @author Sébastien Robaszkiewicz [hello@robi.me]
 */

'use strict';

// Libraries and files

var _slicedToArray = require('babel-runtime/helpers/sliced-to-array')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var audioContext = require('waves-audio').audioContext;
var DotNav = require('./DotNav');
var GuitarEngine = require('./GuitarEngine');
var input = require('motion-input');
var SuperLoader = require('waves-loaders').SuperLoader;
var PlayControl = require('waves-audio').PlayControl;
var PlayerEngine = require('waves-audio').PlayerEngine;
var Scratch = require('./Scratch');
var Transport = require('waves-audio').Transport;

// Helper functions
function startWebAudio() {
  var o = audioContext.createOscillator();
  var g = audioContext.createGain();
  var now = audioContext.currentTime;
  o.connect(g);
  g.connect(audioContext.destination);
  o.start(now);
  o.stop(now + 0.000001);
}

// Helper variables
var webAudioStarted = false;
var playing = false;
var timeout = null;

// Constants (song specific)
var mode = 0;
var offset = 2.400;
var period = 0.150;

// Script
(function () {
  var loader = new SuperLoader();

  // Prevent scrolling
  document.body.addEventListener('touchmove', function (e) {
    e.preventDefault();
  });

  _Promise.all([loader.load(['assets/backtrack.mp3', 'assets/guitar.mp3', 'assets/guitar-markers.json']), input.init('energy')]).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2);

    var loadedFiles = _ref2[0];
    var inputModules = _ref2[1];

    // Files and energy module
    var backtrackBuffer = loadedFiles[0];
    var guitarBuffer = loadedFiles[1];
    var guitarMarkers = loadedFiles[2];
    var energy = inputModules[0];

    // Player engine (backtrack)
    var backtrackPlayer = new PlayerEngine({
      buffer: backtrackBuffer,
      gain: 0.5
    });
    backtrackPlayer.connect(audioContext.destination);

    // Instrument engine (guitar)
    var guitarEngine = new GuitarEngine({
      audioBuffer: guitarBuffer,
      mode: mode,
      numBeats: 200,
      offset: offset,
      period: period,
      segmentMarkers: guitarMarkers
    });
    guitarEngine.connect(audioContext.destination);

    // Transport
    var transport = new Transport();
    transport.add(backtrackPlayer, 0, Infinity);
    transport.add(guitarEngine, 0, Infinity);

    // Play control
    var playControl = new PlayControl(transport);

    // Dot navigation
    var nav = document.querySelector('.dot-nav');
    var dotNav = new DotNav({
      callback: guitarEngine.changeMode.bind(guitarEngine),
      nav: nav,
      selected: mode
    });

    // Button
    var button = document.getElementById('button').querySelector('i');
    button.addEventListener('click', function () {
      if (!webAudioStarted) {
        startWebAudio();
        webAudioStarted = true;
      }

      if (!playing) {
        playControl.start();
        guitarEngine.start();
        playing = true;
        clearTimeout(timeout);
        timeout = setTimeout(function () {
          playControl.stop();
          guitarEngine.stop(); // TODO: remove if empty
          button.classList.toggle('icon-play');
          button.classList.toggle('icon-stop');
          playing = false;
        }, backtrackBuffer.duration * 1000);
      } else {
        playControl.stop();
        guitarEngine.stop(); // TODO: remove if empty
        playing = false;
        clearTimeout(timeout);
      }

      button.classList.toggle('icon-play');
      button.classList.toggle('icon-stop');
    });

    // Toggle loading / button
    document.getElementById('loader').classList.toggle('hidden');
    document.getElementById('button').classList.toggle('hidden');

    // Scratch
    var scratch = new Scratch();
    scratch.on('scratch', function (val) {
      guitarEngine.onScratch(val);
    });

    // Input module listener
    var instr = document.querySelector('.instructions');
    if (energy.isValid) {
      instr.innerHTML = 'hit &lsquo;play&rsquo; and shake your device\n        </br>(or scratch the screen)';
      input.addListener('energy', function (val) {
        guitarEngine.onEnergy(val);
      });
    } else if ('ontouchstart' in window) {
      instr.innerHTML = 'hit &lsquo;play&rsquo; and scratch the screen';
    } else {
      instr.innerHTML = 'hit &lsquo;play&rsquo; and move your mouse';
    }
  });
})();

},{"./DotNav":1,"./GuitarEngine":2,"./Scratch":3,"babel-runtime/core-js/promise":11,"babel-runtime/helpers/sliced-to-array":17,"motion-input":89,"waves-audio":111,"waves-loaders":115}],5:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/get-iterator"), __esModule: true };
},{"core-js/library/fn/get-iterator":18}],6:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/is-iterable"), __esModule: true };
},{"core-js/library/fn/is-iterable":19}],7:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/create"), __esModule: true };
},{"core-js/library/fn/object/create":20}],8:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/define-property"), __esModule: true };
},{"core-js/library/fn/object/define-property":21}],9:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/get-own-property-descriptor"), __esModule: true };
},{"core-js/library/fn/object/get-own-property-descriptor":22}],10:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/set-prototype-of"), __esModule: true };
},{"core-js/library/fn/object/set-prototype-of":23}],11:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/promise"), __esModule: true };
},{"core-js/library/fn/promise":24}],12:[function(require,module,exports){
"use strict";

exports["default"] = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

exports.__esModule = true;
},{}],13:[function(require,module,exports){
"use strict";

var _Object$defineProperty = require("babel-runtime/core-js/object/define-property")["default"];

exports["default"] = (function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;

      _Object$defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();

exports.__esModule = true;
},{"babel-runtime/core-js/object/define-property":8}],14:[function(require,module,exports){
"use strict";

var _Object$getOwnPropertyDescriptor = require("babel-runtime/core-js/object/get-own-property-descriptor")["default"];

exports["default"] = function get(_x, _x2, _x3) {
  var _again = true;

  _function: while (_again) {
    var object = _x,
        property = _x2,
        receiver = _x3;
    desc = parent = getter = undefined;
    _again = false;
    if (object === null) object = Function.prototype;

    var desc = _Object$getOwnPropertyDescriptor(object, property);

    if (desc === undefined) {
      var parent = Object.getPrototypeOf(object);

      if (parent === null) {
        return undefined;
      } else {
        _x = parent;
        _x2 = property;
        _x3 = receiver;
        _again = true;
        continue _function;
      }
    } else if ("value" in desc) {
      return desc.value;
    } else {
      var getter = desc.get;

      if (getter === undefined) {
        return undefined;
      }

      return getter.call(receiver);
    }
  }
};

exports.__esModule = true;
},{"babel-runtime/core-js/object/get-own-property-descriptor":9}],15:[function(require,module,exports){
"use strict";

var _Object$create = require("babel-runtime/core-js/object/create")["default"];

var _Object$setPrototypeOf = require("babel-runtime/core-js/object/set-prototype-of")["default"];

exports["default"] = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = _Object$create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) _Object$setPrototypeOf ? _Object$setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

exports.__esModule = true;
},{"babel-runtime/core-js/object/create":7,"babel-runtime/core-js/object/set-prototype-of":10}],16:[function(require,module,exports){
"use strict";

exports["default"] = function (obj) {
  return obj && obj.__esModule ? obj : {
    "default": obj
  };
};

exports.__esModule = true;
},{}],17:[function(require,module,exports){
"use strict";

var _getIterator = require("babel-runtime/core-js/get-iterator")["default"];

var _isIterable = require("babel-runtime/core-js/is-iterable")["default"];

exports["default"] = (function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = _getIterator(arr), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (_isIterable(Object(arr))) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
})();

exports.__esModule = true;
},{"babel-runtime/core-js/get-iterator":5,"babel-runtime/core-js/is-iterable":6}],18:[function(require,module,exports){
require('../modules/web.dom.iterable');
require('../modules/es6.string.iterator');
module.exports = require('../modules/core.get-iterator');
},{"../modules/core.get-iterator":73,"../modules/es6.string.iterator":80,"../modules/web.dom.iterable":81}],19:[function(require,module,exports){
require('../modules/web.dom.iterable');
require('../modules/es6.string.iterator');
module.exports = require('../modules/core.is-iterable');
},{"../modules/core.is-iterable":74,"../modules/es6.string.iterator":80,"../modules/web.dom.iterable":81}],20:[function(require,module,exports){
var $ = require('../../modules/$');
module.exports = function create(P, D){
  return $.create(P, D);
};
},{"../../modules/$":50}],21:[function(require,module,exports){
var $ = require('../../modules/$');
module.exports = function defineProperty(it, key, desc){
  return $.setDesc(it, key, desc);
};
},{"../../modules/$":50}],22:[function(require,module,exports){
var $ = require('../../modules/$');
require('../../modules/es6.object.get-own-property-descriptor');
module.exports = function getOwnPropertyDescriptor(it, key){
  return $.getDesc(it, key);
};
},{"../../modules/$":50,"../../modules/es6.object.get-own-property-descriptor":76}],23:[function(require,module,exports){
require('../../modules/es6.object.set-prototype-of');
module.exports = require('../../modules/$.core').Object.setPrototypeOf;
},{"../../modules/$.core":29,"../../modules/es6.object.set-prototype-of":77}],24:[function(require,module,exports){
require('../modules/es6.object.to-string');
require('../modules/es6.string.iterator');
require('../modules/web.dom.iterable');
require('../modules/es6.promise');
module.exports = require('../modules/$.core').Promise;
},{"../modules/$.core":29,"../modules/es6.object.to-string":78,"../modules/es6.promise":79,"../modules/es6.string.iterator":80,"../modules/web.dom.iterable":81}],25:[function(require,module,exports){
module.exports = function(it){
  if(typeof it != 'function')throw TypeError(it + ' is not a function!');
  return it;
};
},{}],26:[function(require,module,exports){
var isObject = require('./$.is-object');
module.exports = function(it){
  if(!isObject(it))throw TypeError(it + ' is not an object!');
  return it;
};
},{"./$.is-object":43}],27:[function(require,module,exports){
// getting tag from 19.1.3.6 Object.prototype.toString()
var cof = require('./$.cof')
  , TAG = require('./$.wks')('toStringTag')
  // ES3 wrong here
  , ARG = cof(function(){ return arguments; }()) == 'Arguments';

module.exports = function(it){
  var O, T, B;
  return it === undefined ? 'Undefined' : it === null ? 'Null'
    // @@toStringTag case
    : typeof (T = (O = Object(it))[TAG]) == 'string' ? T
    // builtinTag case
    : ARG ? cof(O)
    // ES3 arguments fallback
    : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
};
},{"./$.cof":28,"./$.wks":71}],28:[function(require,module,exports){
var toString = {}.toString;

module.exports = function(it){
  return toString.call(it).slice(8, -1);
};
},{}],29:[function(require,module,exports){
var core = module.exports = {};
if(typeof __e == 'number')__e = core; // eslint-disable-line no-undef
},{}],30:[function(require,module,exports){
// optional / simple context binding
var aFunction = require('./$.a-function');
module.exports = function(fn, that, length){
  aFunction(fn);
  if(that === undefined)return fn;
  switch(length){
    case 1: return function(a){
      return fn.call(that, a);
    };
    case 2: return function(a, b){
      return fn.call(that, a, b);
    };
    case 3: return function(a, b, c){
      return fn.call(that, a, b, c);
    };
  } return function(/* ...args */){
      return fn.apply(that, arguments);
    };
};
},{"./$.a-function":25}],31:[function(require,module,exports){
var global    = require('./$.global')
  , core      = require('./$.core')
  , PROTOTYPE = 'prototype';
var ctx = function(fn, that){
  return function(){
    return fn.apply(that, arguments);
  };
};
var $def = function(type, name, source){
  var key, own, out, exp
    , isGlobal = type & $def.G
    , isProto  = type & $def.P
    , target   = isGlobal ? global : type & $def.S
        ? global[name] : (global[name] || {})[PROTOTYPE]
    , exports  = isGlobal ? core : core[name] || (core[name] = {});
  if(isGlobal)source = name;
  for(key in source){
    // contains in native
    own = !(type & $def.F) && target && key in target;
    if(own && key in exports)continue;
    // export native or passed
    out = own ? target[key] : source[key];
    // prevent global pollution for namespaces
    if(isGlobal && typeof target[key] != 'function')exp = source[key];
    // bind timers to global for call from export context
    else if(type & $def.B && own)exp = ctx(out, global);
    // wrap global constructors for prevent change them in library
    else if(type & $def.W && target[key] == out)!function(C){
      exp = function(param){
        return this instanceof C ? new C(param) : C(param);
      };
      exp[PROTOTYPE] = C[PROTOTYPE];
    }(out);
    else exp = isProto && typeof out == 'function' ? ctx(Function.call, out) : out;
    // export
    exports[key] = exp;
    if(isProto)(exports[PROTOTYPE] || (exports[PROTOTYPE] = {}))[key] = out;
  }
};
// type bitmap
$def.F = 1;  // forced
$def.G = 2;  // global
$def.S = 4;  // static
$def.P = 8;  // proto
$def.B = 16; // bind
$def.W = 32; // wrap
module.exports = $def;
},{"./$.core":29,"./$.global":36}],32:[function(require,module,exports){
// 7.2.1 RequireObjectCoercible(argument)
module.exports = function(it){
  if(it == undefined)throw TypeError("Can't call method on  " + it);
  return it;
};
},{}],33:[function(require,module,exports){
var isObject = require('./$.is-object')
  , document = require('./$.global').document
  // in old IE typeof document.createElement is 'object'
  , is = isObject(document) && isObject(document.createElement);
module.exports = function(it){
  return is ? document.createElement(it) : {};
};
},{"./$.global":36,"./$.is-object":43}],34:[function(require,module,exports){
module.exports = function(exec){
  try {
    return !!exec();
  } catch(e){
    return true;
  }
};
},{}],35:[function(require,module,exports){
var ctx         = require('./$.ctx')
  , call        = require('./$.iter-call')
  , isArrayIter = require('./$.is-array-iter')
  , anObject    = require('./$.an-object')
  , toLength    = require('./$.to-length')
  , getIterFn   = require('./core.get-iterator-method');
module.exports = function(iterable, entries, fn, that){
  var iterFn = getIterFn(iterable)
    , f      = ctx(fn, that, entries ? 2 : 1)
    , index  = 0
    , length, step, iterator;
  if(typeof iterFn != 'function')throw TypeError(iterable + ' is not iterable!');
  // fast case for arrays with default iterator
  if(isArrayIter(iterFn))for(length = toLength(iterable.length); length > index; index++){
    entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
  } else for(iterator = iterFn.call(iterable); !(step = iterator.next()).done; ){
    call(iterator, f, step.value, entries);
  }
};
},{"./$.an-object":26,"./$.ctx":30,"./$.is-array-iter":42,"./$.iter-call":44,"./$.to-length":68,"./core.get-iterator-method":72}],36:[function(require,module,exports){
// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var UNDEFINED = 'undefined';
var global = module.exports = typeof window != UNDEFINED && window.Math == Math
  ? window : typeof self != UNDEFINED && self.Math == Math ? self : Function('return this')();
if(typeof __g == 'number')__g = global; // eslint-disable-line no-undef
},{}],37:[function(require,module,exports){
var hasOwnProperty = {}.hasOwnProperty;
module.exports = function(it, key){
  return hasOwnProperty.call(it, key);
};
},{}],38:[function(require,module,exports){
var $          = require('./$')
  , createDesc = require('./$.property-desc');
module.exports = require('./$.support-desc') ? function(object, key, value){
  return $.setDesc(object, key, createDesc(1, value));
} : function(object, key, value){
  object[key] = value;
  return object;
};
},{"./$":50,"./$.property-desc":55,"./$.support-desc":63}],39:[function(require,module,exports){
module.exports = require('./$.global').document && document.documentElement;
},{"./$.global":36}],40:[function(require,module,exports){
// fast apply, http://jsperf.lnkit.com/fast-apply/5
module.exports = function(fn, args, that){
  var un = that === undefined;
  switch(args.length){
    case 0: return un ? fn()
                      : fn.call(that);
    case 1: return un ? fn(args[0])
                      : fn.call(that, args[0]);
    case 2: return un ? fn(args[0], args[1])
                      : fn.call(that, args[0], args[1]);
    case 3: return un ? fn(args[0], args[1], args[2])
                      : fn.call(that, args[0], args[1], args[2]);
    case 4: return un ? fn(args[0], args[1], args[2], args[3])
                      : fn.call(that, args[0], args[1], args[2], args[3]);
  } return              fn.apply(that, args);
};
},{}],41:[function(require,module,exports){
// indexed object, fallback for non-array-like ES3 strings
var cof = require('./$.cof');
module.exports = 0 in Object('z') ? Object : function(it){
  return cof(it) == 'String' ? it.split('') : Object(it);
};
},{"./$.cof":28}],42:[function(require,module,exports){
// check on default Array iterator
var Iterators = require('./$.iterators')
  , ITERATOR  = require('./$.wks')('iterator');
module.exports = function(it){
  return (Iterators.Array || Array.prototype[ITERATOR]) === it;
};
},{"./$.iterators":49,"./$.wks":71}],43:[function(require,module,exports){
// http://jsperf.com/core-js-isobject
module.exports = function(it){
  return it !== null && (typeof it == 'object' || typeof it == 'function');
};
},{}],44:[function(require,module,exports){
// call something on iterator step with safe closing on error
var anObject = require('./$.an-object');
module.exports = function(iterator, fn, value, entries){
  try {
    return entries ? fn(anObject(value)[0], value[1]) : fn(value);
  // 7.4.6 IteratorClose(iterator, completion)
  } catch(e){
    var ret = iterator['return'];
    if(ret !== undefined)anObject(ret.call(iterator));
    throw e;
  }
};
},{"./$.an-object":26}],45:[function(require,module,exports){
'use strict';
var $ = require('./$')
  , IteratorPrototype = {};

// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
require('./$.hide')(IteratorPrototype, require('./$.wks')('iterator'), function(){ return this; });

module.exports = function(Constructor, NAME, next){
  Constructor.prototype = $.create(IteratorPrototype, {next: require('./$.property-desc')(1,next)});
  require('./$.tag')(Constructor, NAME + ' Iterator');
};
},{"./$":50,"./$.hide":38,"./$.property-desc":55,"./$.tag":64,"./$.wks":71}],46:[function(require,module,exports){
'use strict';
var LIBRARY         = require('./$.library')
  , $def            = require('./$.def')
  , $redef          = require('./$.redef')
  , hide            = require('./$.hide')
  , has             = require('./$.has')
  , SYMBOL_ITERATOR = require('./$.wks')('iterator')
  , Iterators       = require('./$.iterators')
  , BUGGY           = !([].keys && 'next' in [].keys()) // Safari has buggy iterators w/o `next`
  , FF_ITERATOR     = '@@iterator'
  , KEYS            = 'keys'
  , VALUES          = 'values';
var returnThis = function(){ return this; };
module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCE){
  require('./$.iter-create')(Constructor, NAME, next);
  var createMethod = function(kind){
    switch(kind){
      case KEYS: return function keys(){ return new Constructor(this, kind); };
      case VALUES: return function values(){ return new Constructor(this, kind); };
    } return function entries(){ return new Constructor(this, kind); };
  };
  var TAG      = NAME + ' Iterator'
    , proto    = Base.prototype
    , _native  = proto[SYMBOL_ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT]
    , _default = _native || createMethod(DEFAULT)
    , methods, key;
  // Fix native
  if(_native){
    var IteratorPrototype = require('./$').getProto(_default.call(new Base));
    // Set @@toStringTag to native iterators
    require('./$.tag')(IteratorPrototype, TAG, true);
    // FF fix
    if(!LIBRARY && has(proto, FF_ITERATOR))hide(IteratorPrototype, SYMBOL_ITERATOR, returnThis);
  }
  // Define iterator
  if(!LIBRARY || FORCE)hide(proto, SYMBOL_ITERATOR, _default);
  // Plug for library
  Iterators[NAME] = _default;
  Iterators[TAG]  = returnThis;
  if(DEFAULT){
    methods = {
      keys:    IS_SET            ? _default : createMethod(KEYS),
      values:  DEFAULT == VALUES ? _default : createMethod(VALUES),
      entries: DEFAULT != VALUES ? _default : createMethod('entries')
    };
    if(FORCE)for(key in methods){
      if(!(key in proto))$redef(proto, key, methods[key]);
    } else $def($def.P + $def.F * BUGGY, NAME, methods);
  }
};
},{"./$":50,"./$.def":31,"./$.has":37,"./$.hide":38,"./$.iter-create":45,"./$.iterators":49,"./$.library":51,"./$.redef":56,"./$.tag":64,"./$.wks":71}],47:[function(require,module,exports){
var SYMBOL_ITERATOR = require('./$.wks')('iterator')
  , SAFE_CLOSING    = false;
try {
  var riter = [7][SYMBOL_ITERATOR]();
  riter['return'] = function(){ SAFE_CLOSING = true; };
  Array.from(riter, function(){ throw 2; });
} catch(e){ /* empty */ }
module.exports = function(exec){
  if(!SAFE_CLOSING)return false;
  var safe = false;
  try {
    var arr  = [7]
      , iter = arr[SYMBOL_ITERATOR]();
    iter.next = function(){ safe = true; };
    arr[SYMBOL_ITERATOR] = function(){ return iter; };
    exec(arr);
  } catch(e){ /* empty */ }
  return safe;
};
},{"./$.wks":71}],48:[function(require,module,exports){
module.exports = function(done, value){
  return {value: value, done: !!done};
};
},{}],49:[function(require,module,exports){
module.exports = {};
},{}],50:[function(require,module,exports){
var $Object = Object;
module.exports = {
  create:     $Object.create,
  getProto:   $Object.getPrototypeOf,
  isEnum:     {}.propertyIsEnumerable,
  getDesc:    $Object.getOwnPropertyDescriptor,
  setDesc:    $Object.defineProperty,
  setDescs:   $Object.defineProperties,
  getKeys:    $Object.keys,
  getNames:   $Object.getOwnPropertyNames,
  getSymbols: $Object.getOwnPropertySymbols,
  each:       [].forEach
};
},{}],51:[function(require,module,exports){
module.exports = true;
},{}],52:[function(require,module,exports){
var global    = require('./$.global')
  , macrotask = require('./$.task').set
  , Observer  = global.MutationObserver || global.WebKitMutationObserver
  , process   = global.process
  , isNode    = require('./$.cof')(process) == 'process'
  , head, last, notify;

var flush = function(){
  var parent, domain;
  if(isNode && (parent = process.domain)){
    process.domain = null;
    parent.exit();
  }
  while(head){
    domain = head.domain;
    if(domain)domain.enter();
    head.fn.call(); // <- currently we use it only for Promise - try / catch not required
    if(domain)domain.exit();
    head = head.next;
  } last = undefined;
  if(parent)parent.enter();
}

// Node.js
if(isNode){
  notify = function(){
    process.nextTick(flush);
  };
// browsers with MutationObserver
} else if(Observer){
  var toggle = 1
    , node   = document.createTextNode('');
  new Observer(flush).observe(node, {characterData: true}); // eslint-disable-line no-new
  notify = function(){
    node.data = toggle = -toggle;
  };
// for other environments - macrotask based on:
// - setImmediate
// - MessageChannel
// - window.postMessag
// - onreadystatechange
// - setTimeout
} else {
  notify = function(){
    // strange IE + webpack dev server bug - use .call(global)
    macrotask.call(global, flush);
  };
}

module.exports = function asap(fn){
  var task = {fn: fn, next: undefined, domain: isNode && process.domain};
  if(last)last.next = task;
  if(!head){
    head = task;
    notify();
  } last = task;
};
},{"./$.cof":28,"./$.global":36,"./$.task":65}],53:[function(require,module,exports){
var $redef = require('./$.redef');
module.exports = function(target, src){
  for(var key in src)$redef(target, key, src[key]);
  return target;
};
},{"./$.redef":56}],54:[function(require,module,exports){
// most Object methods by ES6 should accept primitives
module.exports = function(KEY, exec){
  var $def = require('./$.def')
    , fn   = (require('./$.core').Object || {})[KEY] || Object[KEY]
    , exp  = {};
  exp[KEY] = exec(fn);
  $def($def.S + $def.F * require('./$.fails')(function(){ fn(1); }), 'Object', exp);
};
},{"./$.core":29,"./$.def":31,"./$.fails":34}],55:[function(require,module,exports){
module.exports = function(bitmap, value){
  return {
    enumerable  : !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable    : !(bitmap & 4),
    value       : value
  };
};
},{}],56:[function(require,module,exports){
module.exports = require('./$.hide');
},{"./$.hide":38}],57:[function(require,module,exports){
module.exports = Object.is || function is(x, y){
  return x === y ? x !== 0 || 1 / x === 1 / y : x != x && y != y;
};
},{}],58:[function(require,module,exports){
// Works with __proto__ only. Old v8 can't work with null proto objects.
/* eslint-disable no-proto */
var getDesc  = require('./$').getDesc
  , isObject = require('./$.is-object')
  , anObject = require('./$.an-object');
var check = function(O, proto){
  anObject(O);
  if(!isObject(proto) && proto !== null)throw TypeError(proto + ": can't set as prototype!");
};
module.exports = {
  set: Object.setPrototypeOf || ('__proto__' in {} // eslint-disable-line
    ? function(buggy, set){
        try {
          set = require('./$.ctx')(Function.call, getDesc(Object.prototype, '__proto__').set, 2);
          set({}, []);
        } catch(e){ buggy = true; }
        return function setPrototypeOf(O, proto){
          check(O, proto);
          if(buggy)O.__proto__ = proto;
          else set(O, proto);
          return O;
        };
      }()
    : undefined),
  check: check
};
},{"./$":50,"./$.an-object":26,"./$.ctx":30,"./$.is-object":43}],59:[function(require,module,exports){
var global = require('./$.global')
  , SHARED = '__core-js_shared__'
  , store  = global[SHARED] || (global[SHARED] = {});
module.exports = function(key){
  return store[key] || (store[key] = {});
};
},{"./$.global":36}],60:[function(require,module,exports){
'use strict';
var $       = require('./$')
  , SPECIES = require('./$.wks')('species');
module.exports = function(C){
  if(require('./$.support-desc') && !(SPECIES in C))$.setDesc(C, SPECIES, {
    configurable: true,
    get: function(){ return this; }
  });
};
},{"./$":50,"./$.support-desc":63,"./$.wks":71}],61:[function(require,module,exports){
module.exports = function(it, Constructor, name){
  if(!(it instanceof Constructor))throw TypeError(name + ": use the 'new' operator!");
  return it;
};
},{}],62:[function(require,module,exports){
// true  -> String#at
// false -> String#codePointAt
var toInteger = require('./$.to-integer')
  , defined   = require('./$.defined');
module.exports = function(TO_STRING){
  return function(that, pos){
    var s = String(defined(that))
      , i = toInteger(pos)
      , l = s.length
      , a, b;
    if(i < 0 || i >= l)return TO_STRING ? '' : undefined;
    a = s.charCodeAt(i);
    return a < 0xd800 || a > 0xdbff || i + 1 === l
      || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
        ? TO_STRING ? s.charAt(i) : a
        : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
  };
};
},{"./$.defined":32,"./$.to-integer":66}],63:[function(require,module,exports){
// Thank's IE8 for his funny defineProperty
module.exports = !require('./$.fails')(function(){
  return Object.defineProperty({}, 'a', {get: function(){ return 7; }}).a != 7;
});
},{"./$.fails":34}],64:[function(require,module,exports){
var has  = require('./$.has')
  , hide = require('./$.hide')
  , TAG  = require('./$.wks')('toStringTag');

module.exports = function(it, tag, stat){
  if(it && !has(it = stat ? it : it.prototype, TAG))hide(it, TAG, tag);
};
},{"./$.has":37,"./$.hide":38,"./$.wks":71}],65:[function(require,module,exports){
'use strict';
var ctx                = require('./$.ctx')
  , invoke             = require('./$.invoke')
  , html               = require('./$.html')
  , cel                = require('./$.dom-create')
  , global             = require('./$.global')
  , process            = global.process
  , setTask            = global.setImmediate
  , clearTask          = global.clearImmediate
  , MessageChannel     = global.MessageChannel
  , counter            = 0
  , queue              = {}
  , ONREADYSTATECHANGE = 'onreadystatechange'
  , defer, channel, port;
var run = function(){
  var id = +this;
  if(queue.hasOwnProperty(id)){
    var fn = queue[id];
    delete queue[id];
    fn();
  }
};
var listner = function(event){
  run.call(event.data);
};
// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
if(!setTask || !clearTask){
  setTask = function setImmediate(fn){
    var args = [], i = 1;
    while(arguments.length > i)args.push(arguments[i++]);
    queue[++counter] = function(){
      invoke(typeof fn == 'function' ? fn : Function(fn), args);
    };
    defer(counter);
    return counter;
  };
  clearTask = function clearImmediate(id){
    delete queue[id];
  };
  // Node.js 0.8-
  if(require('./$.cof')(process) == 'process'){
    defer = function(id){
      process.nextTick(ctx(run, id, 1));
    };
  // Browsers with MessageChannel, includes WebWorkers
  } else if(MessageChannel){
    channel = new MessageChannel;
    port    = channel.port2;
    channel.port1.onmessage = listner;
    defer = ctx(port.postMessage, port, 1);
  // Browsers with postMessage, skip WebWorkers
  // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
  } else if(global.addEventListener && typeof postMessage == 'function' && !global.importScript){
    defer = function(id){
      global.postMessage(id + '', '*');
    };
    global.addEventListener('message', listner, false);
  // IE8-
  } else if(ONREADYSTATECHANGE in cel('script')){
    defer = function(id){
      html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function(){
        html.removeChild(this);
        run.call(id);
      };
    };
  // Rest old browsers
  } else {
    defer = function(id){
      setTimeout(ctx(run, id, 1), 0);
    };
  }
}
module.exports = {
  set:   setTask,
  clear: clearTask
};
},{"./$.cof":28,"./$.ctx":30,"./$.dom-create":33,"./$.global":36,"./$.html":39,"./$.invoke":40}],66:[function(require,module,exports){
// 7.1.4 ToInteger
var ceil  = Math.ceil
  , floor = Math.floor;
module.exports = function(it){
  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
};
},{}],67:[function(require,module,exports){
// to indexed object, toObject with fallback for non-array-like ES3 strings
var IObject = require('./$.iobject')
  , defined = require('./$.defined');
module.exports = function(it){
  return IObject(defined(it));
};
},{"./$.defined":32,"./$.iobject":41}],68:[function(require,module,exports){
// 7.1.15 ToLength
var toInteger = require('./$.to-integer')
  , min       = Math.min;
module.exports = function(it){
  return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
};
},{"./$.to-integer":66}],69:[function(require,module,exports){
var id = 0
  , px = Math.random();
module.exports = function(key){
  return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
};
},{}],70:[function(require,module,exports){
module.exports = function(){ /* empty */ };
},{}],71:[function(require,module,exports){
var store  = require('./$.shared')('wks')
  , Symbol = require('./$.global').Symbol;
module.exports = function(name){
  return store[name] || (store[name] =
    Symbol && Symbol[name] || (Symbol || require('./$.uid'))('Symbol.' + name));
};
},{"./$.global":36,"./$.shared":59,"./$.uid":69}],72:[function(require,module,exports){
var classof   = require('./$.classof')
  , ITERATOR  = require('./$.wks')('iterator')
  , Iterators = require('./$.iterators');
module.exports = require('./$.core').getIteratorMethod = function(it){
  if(it != undefined)return it[ITERATOR] || it['@@iterator'] || Iterators[classof(it)];
};
},{"./$.classof":27,"./$.core":29,"./$.iterators":49,"./$.wks":71}],73:[function(require,module,exports){
var anObject = require('./$.an-object')
  , get      = require('./core.get-iterator-method');
module.exports = require('./$.core').getIterator = function(it){
  var iterFn = get(it);
  if(typeof iterFn != 'function')throw TypeError(it + ' is not iterable!');
  return anObject(iterFn.call(it));
};
},{"./$.an-object":26,"./$.core":29,"./core.get-iterator-method":72}],74:[function(require,module,exports){
var classof   = require('./$.classof')
  , ITERATOR  = require('./$.wks')('iterator')
  , Iterators = require('./$.iterators');
module.exports = require('./$.core').isIterable = function(it){
  var O = Object(it);
  return ITERATOR in O || '@@iterator' in O || Iterators.hasOwnProperty(classof(O));
};
},{"./$.classof":27,"./$.core":29,"./$.iterators":49,"./$.wks":71}],75:[function(require,module,exports){
'use strict';
var setUnscope = require('./$.unscope')
  , step       = require('./$.iter-step')
  , Iterators  = require('./$.iterators')
  , toIObject  = require('./$.to-iobject');

// 22.1.3.4 Array.prototype.entries()
// 22.1.3.13 Array.prototype.keys()
// 22.1.3.29 Array.prototype.values()
// 22.1.3.30 Array.prototype[@@iterator]()
require('./$.iter-define')(Array, 'Array', function(iterated, kind){
  this._t = toIObject(iterated); // target
  this._i = 0;                   // next index
  this._k = kind;                // kind
// 22.1.5.2.1 %ArrayIteratorPrototype%.next()
}, function(){
  var O     = this._t
    , kind  = this._k
    , index = this._i++;
  if(!O || index >= O.length){
    this._t = undefined;
    return step(1);
  }
  if(kind == 'keys'  )return step(0, index);
  if(kind == 'values')return step(0, O[index]);
  return step(0, [index, O[index]]);
}, 'values');

// argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
Iterators.Arguments = Iterators.Array;

setUnscope('keys');
setUnscope('values');
setUnscope('entries');
},{"./$.iter-define":46,"./$.iter-step":48,"./$.iterators":49,"./$.to-iobject":67,"./$.unscope":70}],76:[function(require,module,exports){
// 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)
var toIObject = require('./$.to-iobject');

require('./$.object-sap')('getOwnPropertyDescriptor', function($getOwnPropertyDescriptor){
  return function getOwnPropertyDescriptor(it, key){
    return $getOwnPropertyDescriptor(toIObject(it), key);
  };
});
},{"./$.object-sap":54,"./$.to-iobject":67}],77:[function(require,module,exports){
// 19.1.3.19 Object.setPrototypeOf(O, proto)
var $def = require('./$.def');
$def($def.S, 'Object', {setPrototypeOf: require('./$.set-proto').set});
},{"./$.def":31,"./$.set-proto":58}],78:[function(require,module,exports){

},{}],79:[function(require,module,exports){
'use strict';
var $          = require('./$')
  , LIBRARY    = require('./$.library')
  , global     = require('./$.global')
  , ctx        = require('./$.ctx')
  , classof    = require('./$.classof')
  , $def       = require('./$.def')
  , isObject   = require('./$.is-object')
  , anObject   = require('./$.an-object')
  , aFunction  = require('./$.a-function')
  , strictNew  = require('./$.strict-new')
  , forOf      = require('./$.for-of')
  , setProto   = require('./$.set-proto').set
  , same       = require('./$.same')
  , species    = require('./$.species')
  , SPECIES    = require('./$.wks')('species')
  , RECORD     = require('./$.uid')('record')
  , asap       = require('./$.microtask')
  , PROMISE    = 'Promise'
  , process    = global.process
  , isNode     = classof(process) == 'process'
  , P          = global[PROMISE]
  , Wrapper;

var testResolve = function(sub){
  var test = new P(function(){});
  if(sub)test.constructor = Object;
  return P.resolve(test) === test;
};

var useNative = function(){
  var works = false;
  function P2(x){
    var self = new P(x);
    setProto(self, P2.prototype);
    return self;
  }
  try {
    works = P && P.resolve && testResolve();
    setProto(P2, P);
    P2.prototype = $.create(P.prototype, {constructor: {value: P2}});
    // actual Firefox has broken subclass support, test that
    if(!(P2.resolve(5).then(function(){}) instanceof P2)){
      works = false;
    }
    // actual V8 bug, https://code.google.com/p/v8/issues/detail?id=4162
    if(works && require('./$.support-desc')){
      var thenableThenGotten = false;
      P.resolve($.setDesc({}, 'then', {
        get: function(){ thenableThenGotten = true; }
      }));
      works = thenableThenGotten;
    }
  } catch(e){ works = false; }
  return works;
}();

// helpers
var isPromise = function(it){
  return isObject(it) && (useNative ? classof(it) == 'Promise' : RECORD in it);
};
var sameConstructor = function(a, b){
  // library wrapper special case
  if(LIBRARY && a === P && b === Wrapper)return true;
  return same(a, b);
};
var getConstructor = function(C){
  var S = anObject(C)[SPECIES];
  return S != undefined ? S : C;
};
var isThenable = function(it){
  var then;
  return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
};
var notify = function(record, isReject){
  if(record.n)return;
  record.n = true;
  var chain = record.c;
  asap(function(){
    var value = record.v
      , ok    = record.s == 1
      , i     = 0;
    var run = function(react){
      var cb = ok ? react.ok : react.fail
        , ret, then;
      try {
        if(cb){
          if(!ok)record.h = true;
          ret = cb === true ? value : cb(value);
          if(ret === react.P){
            react.rej(TypeError('Promise-chain cycle'));
          } else if(then = isThenable(ret)){
            then.call(ret, react.res, react.rej);
          } else react.res(ret);
        } else react.rej(value);
      } catch(err){
        react.rej(err);
      }
    };
    while(chain.length > i)run(chain[i++]); // variable length - can't use forEach
    chain.length = 0;
    record.n = false;
    if(isReject)setTimeout(function(){
      if(isUnhandled(record.p)){
        if(isNode){
          process.emit('unhandledRejection', value, record.p);
        } else if(global.console && console.error){
          console.error('Unhandled promise rejection', value);
        }
      } record.a = undefined;
    }, 1);
  });
};
var isUnhandled = function(promise){
  var record = promise[RECORD]
    , chain  = record.a || record.c
    , i      = 0
    , react;
  if(record.h)return false;
  while(chain.length > i){
    react = chain[i++];
    if(react.fail || !isUnhandled(react.P))return false;
  } return true;
};
var $reject = function(value){
  var record = this;
  if(record.d)return;
  record.d = true;
  record = record.r || record; // unwrap
  record.v = value;
  record.s = 2;
  record.a = record.c.slice();
  notify(record, true);
};
var $resolve = function(value){
  var record = this
    , then;
  if(record.d)return;
  record.d = true;
  record = record.r || record; // unwrap
  try {
    if(then = isThenable(value)){
      asap(function(){
        var wrapper = {r: record, d: false}; // wrap
        try {
          then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
        } catch(e){
          $reject.call(wrapper, e);
        }
      });
    } else {
      record.v = value;
      record.s = 1;
      notify(record, false);
    }
  } catch(e){
    $reject.call({r: record, d: false}, e); // wrap
  }
};

// constructor polyfill
if(!useNative){
  // 25.4.3.1 Promise(executor)
  P = function Promise(executor){
    aFunction(executor);
    var record = {
      p: strictNew(this, P, PROMISE),         // <- promise
      c: [],                                  // <- awaiting reactions
      a: undefined,                           // <- checked in isUnhandled reactions
      s: 0,                                   // <- state
      d: false,                               // <- done
      v: undefined,                           // <- value
      h: false,                               // <- handled rejection
      n: false                                // <- notify
    };
    this[RECORD] = record;
    try {
      executor(ctx($resolve, record, 1), ctx($reject, record, 1));
    } catch(err){
      $reject.call(record, err);
    }
  };
  require('./$.mix')(P.prototype, {
    // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
    then: function then(onFulfilled, onRejected){
      var S = anObject(anObject(this).constructor)[SPECIES];
      var react = {
        ok:   typeof onFulfilled == 'function' ? onFulfilled : true,
        fail: typeof onRejected == 'function'  ? onRejected  : false
      };
      var promise = react.P = new (S != undefined ? S : P)(function(res, rej){
        react.res = aFunction(res);
        react.rej = aFunction(rej);
      });
      var record = this[RECORD];
      record.c.push(react);
      if(record.a)record.a.push(react);
      if(record.s)notify(record, false);
      return promise;
    },
    // 25.4.5.1 Promise.prototype.catch(onRejected)
    'catch': function(onRejected){
      return this.then(undefined, onRejected);
    }
  });
}

// export
$def($def.G + $def.W + $def.F * !useNative, {Promise: P});
require('./$.tag')(P, PROMISE);
species(P);
species(Wrapper = require('./$.core')[PROMISE]);

// statics
$def($def.S + $def.F * !useNative, PROMISE, {
  // 25.4.4.5 Promise.reject(r)
  reject: function reject(r){
    return new this(function(res, rej){ rej(r); });
  }
});
$def($def.S + $def.F * (!useNative || testResolve(true)), PROMISE, {
  // 25.4.4.6 Promise.resolve(x)
  resolve: function resolve(x){
    return isPromise(x) && sameConstructor(x.constructor, this)
      ? x : new this(function(res){ res(x); });
  }
});
$def($def.S + $def.F * !(useNative && require('./$.iter-detect')(function(iter){
  P.all(iter)['catch'](function(){});
})), PROMISE, {
  // 25.4.4.1 Promise.all(iterable)
  all: function all(iterable){
    var C      = getConstructor(this)
      , values = [];
    return new C(function(res, rej){
      forOf(iterable, false, values.push, values);
      var remaining = values.length
        , results   = Array(remaining);
      if(remaining)$.each.call(values, function(promise, index){
        C.resolve(promise).then(function(value){
          results[index] = value;
          --remaining || res(results);
        }, rej);
      });
      else res(results);
    });
  },
  // 25.4.4.4 Promise.race(iterable)
  race: function race(iterable){
    var C = getConstructor(this);
    return new C(function(res, rej){
      forOf(iterable, false, function(promise){
        C.resolve(promise).then(res, rej);
      });
    });
  }
});
},{"./$":50,"./$.a-function":25,"./$.an-object":26,"./$.classof":27,"./$.core":29,"./$.ctx":30,"./$.def":31,"./$.for-of":35,"./$.global":36,"./$.is-object":43,"./$.iter-detect":47,"./$.library":51,"./$.microtask":52,"./$.mix":53,"./$.same":57,"./$.set-proto":58,"./$.species":60,"./$.strict-new":61,"./$.support-desc":63,"./$.tag":64,"./$.uid":69,"./$.wks":71}],80:[function(require,module,exports){
'use strict';
var $at  = require('./$.string-at')(true);

// 21.1.3.27 String.prototype[@@iterator]()
require('./$.iter-define')(String, 'String', function(iterated){
  this._t = String(iterated); // target
  this._i = 0;                // next index
// 21.1.5.2.1 %StringIteratorPrototype%.next()
}, function(){
  var O     = this._t
    , index = this._i
    , point;
  if(index >= O.length)return {value: undefined, done: true};
  point = $at(O, index);
  this._i += point.length;
  return {value: point, done: false};
});
},{"./$.iter-define":46,"./$.string-at":62}],81:[function(require,module,exports){
require('./es6.array.iterator');
var Iterators = require('./$.iterators');
Iterators.NodeList = Iterators.HTMLCollection = Iterators.Array;
},{"./$.iterators":49,"./es6.array.iterator":75}],82:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],83:[function(require,module,exports){
/**
 * @fileoverview `DOMEventSubmodule` module
 * @author <a href='mailto:sebastien@robaszkiewicz.com'>Sébastien Robaszkiewicz</a>, <a href='mailto:Norbert.Schnell@ircam.fr'>Norbert Schnell</a>
 */

'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var InputModule = require('./InputModule');

/**
 * `DOMEventSubmodule` class.
 * The `DOMEventSubmodule` class allows to instantiate modules that provide
 * unified values (such as `AccelerationIncludingGravity`, `Acceleration`,
 * `RotationRate`, `Orientation`, `OrientationAlt) from the `devicemotion`
 * or `deviceorientation` DOM events.
 *
 * @class DOMEventSubmodule
 * @extends InputModule
 */

var DOMEventSubmodule = (function (_InputModule) {
  _inherits(DOMEventSubmodule, _InputModule);

  /**
   * Creates a `DOMEventSubmodule` module instance.
   *
   * @constructor
   * @param {DeviceMotionModule|DeviceOrientationModule} DOMEventModule - The parent DOM event module.
   * @param {string} eventType - The name of the submodule / event (*e.g.* 'acceleration' or 'orientationAlt').
   * @see DeviceMotionModule
   * @see DeviceOrientationModule
   */

  function DOMEventSubmodule(DOMEventModule, eventType) {
    _classCallCheck(this, DOMEventSubmodule);

    _get(Object.getPrototypeOf(DOMEventSubmodule.prototype), 'constructor', this).call(this, eventType);

    /**
     * The DOM event parent module from which this module gets the raw values.
     *
     * @this DOMEventSubmodule
     * @type {DeviceMotionModule|DeviceOrientationModule}
     * @constant
     */
    this.DOMEventModule = DOMEventModule;

    /**
     * Raw values coming from the `devicemotion` event sent by this module.
     *
     * @this DOMEventSubmodule
     * @type {number[]}
     * @default [0, 0, 0]
     */
    this.event = [0, 0, 0];

    /**
     * Compass heading reference (iOS devices only, `Orientation` and `OrientationAlt` submodules only).
     *
     * @this DOMEventSubmodule
     * @type {number}
     * @default null
     */
    this._webkitCompassHeadingReference = null;
  }

  /**
   * Starts the module.
   */

  _createClass(DOMEventSubmodule, [{
    key: 'start',
    value: function start() {
      this.DOMEventModule._addListener();
    }

    /**
     * Stops the module.
     */
  }, {
    key: 'stop',
    value: function stop() {
      this.DOMEventModule._removeListener();
    }

    /**
     * Initializes of the module.
     *
     * @return {Promise}
     */
  }, {
    key: 'init',
    value: function init() {
      var _this = this;

      // Indicate to the parent module that this event is required
      this.DOMEventModule.required[this.eventType] = true;

      // If the parent event has not been initialized yet, initialize it
      var DOMEventPromise = this.DOMEventModule.promise;
      if (!DOMEventPromise) DOMEventPromise = this.DOMEventModule.init();

      return DOMEventPromise.then(function (module) {
        return _this;
      });
    }
  }]);

  return DOMEventSubmodule;
})(InputModule);

module.exports = DOMEventSubmodule;

},{"./InputModule":87,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15}],84:[function(require,module,exports){
/**
 * @fileoverview `DeviceMotion` module
 * @author <a href='mailto:sebastien@robaszkiewicz.com'>Sébastien Robaszkiewicz</a>, <a href='mailto:Norbert.Schnell@ircam.fr'>Norbert Schnell</a>
 */

'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var InputModule = require('./InputModule');
var DOMEventSubmodule = require('./DOMEventSubmodule');
var MotionInput = require('./MotionInput');
var platform = require('platform');

/**
 * Gets the current local time in seconds.
 * Uses `window.performance.now()` if available, and `Date.now()` otherwise.
 * 
 * @return {number}
 */
function getLocalTime() {
  if (window.performance) return window.performance.now() / 1000;
  return Date.now() / 1000;
}

/**
 * `DeviceMotion` module singleton.
 * The `DeviceMotionModule` singleton provides the raw values
 * of the acceleration including gravity, acceleration, and rotation
 * rate provided by the `DeviceMotion` event.
 * It also instantiate the `AccelerationIncludingGravity`,
 * `Acceleration` and `RotationRate` submodules that unify those values
 * across platforms by making them compliant with {@link
 * http://www.w3.org/TR/orientation-event/|the W3C standard}.
 * When raw values are not provided by the sensors, this modules tries
 * to recalculate them from available values:
 * - `acceleration` is calculated from `accelerationIncludingGravity`
 *   with a high-pass filter;
 * - (coming soon — waiting for a bug on Chrome to be resolved)
 *   `rotationRate` is calculated from `orientation`.
 *
 * @class DeviceMotionModule
 * @extends InputModule
 */

var DeviceMotionModule = (function (_InputModule) {
  _inherits(DeviceMotionModule, _InputModule);

  /**
   * Creates the `DeviceMotion` module instance.
   *
   * @constructor
   */

  function DeviceMotionModule() {
    _classCallCheck(this, DeviceMotionModule);

    _get(Object.getPrototypeOf(DeviceMotionModule.prototype), 'constructor', this).call(this, 'devicemotion');

    /**
     * Raw values coming from the `devicemotion` event sent by this module.
     *
     * @this DeviceMotionModule
     * @type {number[]}
     * @default [null, null, null, null, null, null, null, null, null]
     */
    this.event = [null, null, null, null, null, null, null, null, null];

    /**
     * The `AccelerationIncludingGravity` module.
     * Provides unified values of the acceleration including gravity.
     *
     * @this DeviceMotionModule
     * @type {DOMEventSubmodule}
     */
    this.accelerationIncludingGravity = new DOMEventSubmodule(this, 'accelerationIncludingGravity');

    /**
     * The `Acceleration` submodule.
     * Provides unified values of the acceleration.
     * Estimates the acceleration values from `accelerationIncludingGravity`
     * raw values if the acceleration raw values are not available on the
     * device.
     *
     * @this DeviceMotionModule
     * @type {DOMEventSubmodule}
     */
    this.acceleration = new DOMEventSubmodule(this, 'acceleration');

    /**
     * The `RotationRate` submodule.
     * Provides unified values of the rotation rate.
     * (coming soon, waiting for a bug on Chrome to be resolved)
     * Estimates the rotation rate values from `orientation` values if
     * the rotation rate raw values are not available on the device.
     *
     * @this DeviceMotionModule
     * @type {DOMEventSubmodule}
     */
    this.rotationRate = new DOMEventSubmodule(this, 'rotationRate');

    /**
     * Required submodules / events.
     *
     * @this DeviceMotionModule
     * @type {object}
     * @property {bool} accelerationIncludingGravity - Indicates whether the `accelerationIncludingGravity` unified values are required or not (defaults to `false`).
     * @property {bool} acceleration - Indicates whether the `acceleration` unified values are required or not (defaults to `false`).
     * @property {bool} rotationRate - Indicates whether the `rotationRate` unified values are required or not (defaults to `false`).
     */
    this.required = {
      accelerationIncludingGravity: false,
      acceleration: false,
      rotationRate: false
    };

    /**
     * Number of listeners subscribed to the `DeviceMotion` module.
     *
     * @this DeviceMotionModule
     * @type {number}
     */
    this._numListeners = 0;

    /**
     * Resolve function of the module's promise.
     *
     * @this DeviceMotionModule
     * @type {function}
     * @default null
     * @see DeviceMotionModule#init
     */
    this._promiseResolve = null;

    /**
     * Unifying factor of the motion data values (`1` on Android, `-1` on iOS).
     *
     * @this DeviceMotionModule
     * @type {number}
     */
    this._unifyMotionData = platform.os.family === 'iOS' ? -1 : 1;

    /**
     * Unifying factor of the period (`0.001` on Android, `1` on iOS).
     *
     * @this DeviceMotionModule
     * @type {number}
     */
    this._unifyPeriod = platform.os.family === 'Android' ? 0.001 : 1;

    /**
     * Acceleration calculated from the `accelerationIncludingGravity` raw values.
     *
     * @this DeviceMotionModule
     * @type {number[]}
     * @default [0, 0, 0]
     */
    this._calculatedAcceleration = [0, 0, 0];

    /**
     * Time constant (half-life) of the high-pass filter used to smooth the acceleration values calculated from the acceleration including gravity raw values (in seconds).
     *
     * @this DeviceMotionModule
     * @type {number}
     * @default 0.1
     * @constant
     */
    this._calculatedAccelerationTimeConstant = 0.1;

    /**
     * Latest `accelerationIncludingGravity` raw value, used in the high-pass filter to calculate the acceleration (if the `acceleration` values are not provided by `'devicemotion'`).
     *
     * @this DeviceMotionModule
     * @type {number[]}
     * @default [0, 0, 0]
     */
    this._lastAccelerationIncludingGravity = [0, 0, 0];

    /**
     * Rotation rate calculated from the orientation values.
     *
     * @this DeviceMotionModule
     * @type {number[]}
     * @default [0, 0, 0]
     */
    this._calculatedRotationRate = [0, 0, 0];

    /**
     * Latest orientation value, used to calculate the rotation rate  (if the `rotationRate` values are not provided by `'devicemotion'`).
     *
     * @this DeviceMotionModule
     * @type {number[]}
     * @default [0, 0, 0]
     */
    this._lastOrientation = [0, 0, 0];

    /**
     * Latest orientation timestamps, used to calculate the rotation rate (if the `rotationRate` values are not provided by `'devicemotion'`).
     *
     * @this DeviceMotionModule
     * @type {number[]}
     * @default [0, 0, 0]
     */
    this._lastOrientationTimestamp = null;

    /**
     * Method binding of the sensor check.
     *
     * @this DeviceMotionModule
     * @type {function}
     */
    this._devicemotionCheck = this._devicemotionCheck.bind(this);

    /**
     * Method binding of the `'devicemotion'` event callback.
     *
     * @this DeviceMotionModule
     * @type {function}
     */
    this._devicemotionListener = this._devicemotionListener.bind(this);
  }

  /**
   * Decay factor of the high-pass filter used to calculate the acceleration from the `accelerationIncludingGravity` raw values.
   *
   * @type {number}
   * @readonly
   */

  _createClass(DeviceMotionModule, [{
    key: '_devicemotionCheck',

    /**
     * Sensor check on initialization of the module.
     * This method:
     * - checks whether the `accelerationIncludingGravity`, the `acceleration`,
     *   and the `rotationRate` values are valid or not;
     * - gets the period of the `'devicemotion'` event and sets the period of
     *   the `AccelerationIncludingGravity`, `Acceleration`, and `RotationRate`
     *   submodules;
     * - (in the case where acceleration raw values are not provided)
     *   indicates whether the acceleration can be calculated from the
     *   `accelerationIncludingGravity` unified values or not.
     *
     * @param {DeviceMotionEvent} e - The first `'devicemotion'` event caught.
     */
    value: function _devicemotionCheck(e) {
      this.isProvided = true;
      this.period = e.interval / 1000;

      // Sensor availability for the acceleration including gravity
      this.accelerationIncludingGravity.isProvided = e.accelerationIncludingGravity && typeof e.accelerationIncludingGravity.x === 'number' && typeof e.accelerationIncludingGravity.y === 'number' && typeof e.accelerationIncludingGravity.z === 'number';
      this.accelerationIncludingGravity.period = e.interval * this._unifyPeriod;

      // Sensor availability for the acceleration
      this.acceleration.isProvided = e.acceleration && typeof e.acceleration.x === 'number' && typeof e.acceleration.y === 'number' && typeof e.acceleration.z === 'number';
      this.acceleration.period = e.interval * this._unifyPeriod;

      // Sensor availability for the rotation rate
      this.rotationRate.isProvided = e.rotationRate && typeof e.rotationRate.alpha === 'number' && typeof e.rotationRate.beta === 'number' && typeof e.rotationRate.gamma === 'number';
      this.rotationRate.period = e.interval * this._unifyPeriod;

      // We only need to listen to one event (=> remove the listener)
      window.removeEventListener('devicemotion', this._devicemotionCheck, false);

      // If acceleration is not provided by raw sensors, indicate whether it
      // can be calculated with `accelerationIncludingGravity` or not
      if (!this.acceleration.isProvided) this.acceleration.isCalculated = this.accelerationIncludingGravity.isProvided;

      // WARNING
      // The lines of code below are commented because of a bug of Chrome
      // on some Android devices, where 'devicemotion' events are not sent
      // or caught if the listener is set up after a 'deviceorientation'
      // listener. Here, the _tryOrientationFallback method would add a
      // 'deviceorientation' listener and block all subsequent 'devicemotion'
      // events on these devices. Comments will be removed once the bug of
      // Chrome is corrected.

      // if (this.required.rotationRate && !this.rotationRate.isProvided)
      //   this._tryOrientationFallback();
      // else
      this._promiseResolve(this);
    }

    /**
     * `'devicemotion'` event callback.
     * This method emits an event with the raw `'devicemotion'` values, and emits
     * events with the unified `accelerationIncludingGravity`, `acceleration`, 
     * and / or `rotationRate` values if they are required.
     *
     * @param {DeviceMotionEvent} e - `'devicemotion'` event the values are calculated from.
     */
  }, {
    key: '_devicemotionListener',
    value: function _devicemotionListener(e) {
      // 'devicemotion' event (raw values)
      this._emitDeviceMotionEvent(e);

      // 'acceleration' event (unified values)
      if (this.required.accelerationIncludingGravity && this.accelerationIncludingGravity.isValid) this._emitAccelerationIncludingGravityEvent(e);

      // 'accelerationIncludingGravity' event (unified values)
      if (this.required.acceleration && this.acceleration.isValid) // the fallback calculation of the acceleration happens in the `_emitAcceleration` method, so we check if this.acceleration.isValid
        this._emitAccelerationEvent(e);

      // 'rotationRate' event (unified values)
      if (this.required.rotationRate && this.rotationRate.isProvided) // the fallback calculation of the rotation rate does NOT happen in the `_emitRotationRate` method, so we only check if this.rotationRate.isProvided
        this._emitRotationRateEvent(e);
    }

    /**
     * Emits the `'devicemotion'` raw values.
     *
     * @param {DeviceMotionEvent} e - `'devicemotion'` event the values are calculated from.
     */
  }, {
    key: '_emitDeviceMotionEvent',
    value: function _emitDeviceMotionEvent(e) {
      var outEvent = this.event;

      if (e.accelerationIncludingGravity) {
        outEvent[0] = e.accelerationIncludingGravity.x;
        outEvent[1] = e.accelerationIncludingGravity.y;
        outEvent[2] = e.accelerationIncludingGravity.z;
      }

      if (e.acceleration) {
        outEvent[3] = e.acceleration.x;
        outEvent[4] = e.acceleration.y;
        outEvent[5] = e.acceleration.z;
      }

      if (e.rotationRate) {
        outEvent[6] = e.rotationRate.alpha;
        outEvent[7] = e.rotationRate.beta;
        outEvent[8] = e.rotationRate.gamma;
      }

      this.emit(outEvent);
    }

    /**
     * Emits the `accelerationIncludingGravity` unified values.
     *
     * @param {DeviceMotionEvent} e - `'devicemotion'` event the values are calculated from.
     */
  }, {
    key: '_emitAccelerationIncludingGravityEvent',
    value: function _emitAccelerationIncludingGravityEvent(e) {
      var outEvent = this.accelerationIncludingGravity.event;

      outEvent[0] = e.accelerationIncludingGravity.x * this._unifyMotionData;
      outEvent[1] = e.accelerationIncludingGravity.y * this._unifyMotionData;
      outEvent[2] = e.accelerationIncludingGravity.z * this._unifyMotionData;

      this.accelerationIncludingGravity.emit(outEvent);
    }

    /**
     * Emits the `acceleration` unified values.
     * When the `acceleration` raw values are not available, the method
     * also calculates the acceleration from the
     * `accelerationIncludingGravity` raw values.
     *
     * @param {DeviceMotionEvent} e - The `'devicemotion'` event.
     */
  }, {
    key: '_emitAccelerationEvent',
    value: function _emitAccelerationEvent(e) {
      var outEvent = this.acceleration.event;

      if (this.acceleration.isProvided) {
        // If raw acceleration values are provided
        outEvent[0] = e.acceleration.x * this._unifyMotionData;
        outEvent[1] = e.acceleration.y * this._unifyMotionData;
        outEvent[2] = e.acceleration.z * this._unifyMotionData;
      } else if (this.accelerationIncludingGravity.isValid) {
        // Otherwise, if accelerationIncludingGravity values are provided,
        // estimate the acceleration with a high-pass filter
        var accelerationIncludingGravity = [e.accelerationIncludingGravity.x * this._unifyMotionData, e.accelerationIncludingGravity.y * this._unifyMotionData, e.accelerationIncludingGravity.z * this._unifyMotionData];
        var k = this._calculatedAccelerationDecay;

        // High-pass filter to estimate the acceleration (without the gravity)
        this._calculatedAcceleration[0] = (1 + k) * 0.5 * accelerationIncludingGravity[0] - (1 + k) * 0.5 * this._lastAccelerationIncludingGravity[0] + k * this._calculatedAcceleration[0];
        this._calculatedAcceleration[1] = (1 + k) * 0.5 * accelerationIncludingGravity[1] - (1 + k) * 0.5 * this._lastAccelerationIncludingGravity[1] + k * this._calculatedAcceleration[1];
        this._calculatedAcceleration[2] = (1 + k) * 0.5 * accelerationIncludingGravity[2] - (1 + k) * 0.5 * this._lastAccelerationIncludingGravity[2] + k * this._calculatedAcceleration[2];

        this._lastAccelerationIncludingGravity[0] = accelerationIncludingGravity[0];
        this._lastAccelerationIncludingGravity[1] = accelerationIncludingGravity[1];
        this._lastAccelerationIncludingGravity[2] = accelerationIncludingGravity[2];

        outEvent[0] = this._calculatedAcceleration[0];
        outEvent[1] = this._calculatedAcceleration[1];
        outEvent[2] = this._calculatedAcceleration[2];
      }

      this.acceleration.emit(outEvent);
    }

    /**
     * Emits the `rotationRate` unified values.
     *
     * @param {DeviceMotionEvent} e - `'devicemotion'` event the values are calculated from.
     */
  }, {
    key: '_emitRotationRateEvent',
    value: function _emitRotationRateEvent(e) {
      var outEvent = this.rotationRate.event;

      outEvent[0] = e.rotationRate.alpha;
      outEvent[1] = e.rotationRate.beta;
      outEvent[2] = e.rotationRate.gamma;

      // TODO(?): unify

      this.rotationRate.emit(outEvent);
    }

    /**
     * Calculates and emits the `rotationRate` unified values from the `orientation` values.
     *
     * @param {number[]} orientation - Latest `orientation` raw values.
     */
  }, {
    key: '_calculateRotationRateFromOrientation',
    value: function _calculateRotationRateFromOrientation(orientation) {
      var now = getLocalTime();
      var k = 0.8; // TODO: improve low pass filter (frames are not regular)
      var alphaIsValid = typeof orientation[0] === 'number';

      if (this._lastOrientationTimestamp) {
        var rAlpha = null;
        var rBeta = undefined;
        var rGamma = undefined;

        var alphaDiscontinuityFactor = 0;
        var betaDiscontinuityFactor = 0;
        var gammaDiscontinuityFactor = 0;

        var deltaT = now - this._lastOrientationTimestamp;

        if (alphaIsValid) {
          // alpha discontinuity (+360 -> 0 or 0 -> +360)
          if (this._lastOrientation[0] > 320 && orientation[0] < 40) alphaDiscontinuityFactor = 360;else if (this._lastOrientation[0] < 40 && orientation[0] > 320) alphaDiscontinuityFactor = -360;
        }

        // beta discontinuity (+180 -> -180 or -180 -> +180)
        if (this._lastOrientation[1] > 140 && orientation[1] < -140) betaDiscontinuityFactor = 360;else if (this._lastOrientation[1] < -140 && orientation[1] > 140) betaDiscontinuityFactor = -360;

        // gamma discontinuities (+180 -> -180 or -180 -> +180)
        if (this._lastOrientation[2] > 50 && orientation[2] < -50) gammaDiscontinuityFactor = 180;else if (this._lastOrientation[2] < -50 && orientation[2] > 50) gammaDiscontinuityFactor = -180;

        if (deltaT > 0) {
          // Low pass filter to smooth the data
          if (alphaIsValid) rAlpha = k * this._calculatedRotationRate[0] + (1 - k) * (orientation[0] - this._lastOrientation[0] + alphaDiscontinuityFactor) / deltaT;
          rBeta = k * this._calculatedRotationRate[1] + (1 - k) * (orientation[1] - this._lastOrientation[1] + betaDiscontinuityFactor) / deltaT;
          rGamma = k * this._calculatedRotationRate[2] + (1 - k) * (orientation[2] - this._lastOrientation[2] + gammaDiscontinuityFactor) / deltaT;

          this._calculatedRotationRate[0] = rAlpha;
          this._calculatedRotationRate[1] = rBeta;
          this._calculatedRotationRate[2] = rGamma;
        }

        // TODO: resample the emission rate to match the devicemotion rate
        this.rotationRate.emit(this._calculatedRotationRate);
      }

      this._lastOrientationTimestamp = now;
      this._lastOrientation[0] = orientation[0];
      this._lastOrientation[1] = orientation[1];
      this._lastOrientation[2] = orientation[2];
    }

    /**
     * Checks whether the rotation rate can be calculated from the `orientation` values or not.
     */
  }, {
    key: '_tryOrientationFallback',
    value: function _tryOrientationFallback() {
      var _this = this;

      MotionInput.requireModule('orientation').then(function (orientation) {
        if (orientation.isValid) {
          console.log("WARNING (motion-input): The 'devicemotion' event does not exists or does not provide rotation rate values in your browser, so the rotation rate of the device is estimated from the 'orientation', calculated from the 'deviceorientation' event. Since the compass might not be available, only `beta` and `gamma` angles may be provided (`alpha` would be null).");

          _this.rotationRate.isCalculated = true;

          MotionInput.addListener('orientation', function (orientation) {
            _this._calculateRotationRateFromOrientation(orientation);
          });
        }

        _this._promiseResolve(_this);
      });
    }

    /**
     * Increases the number of listeners to this module (either because someone listens
     * to this module, or one of the three `DOMEventSubmodules`
     * (`AccelerationIncludingGravity`, `Acceleration`, `RotationRate`).
     * When the number of listeners reaches `1`, adds a `'devicemotion'` event listener.
     *
     * @see DeviceMotionModule#addListener
     * @see DOMEventSubmodule#start
     */
  }, {
    key: '_addListener',
    value: function _addListener() {
      this._numListeners++;

      if (this._numListeners === 1) window.addEventListener('devicemotion', this._devicemotionListener, false);
    }

    /**
     * Decreases the number of listeners to this module (either because someone stops
     * listening to this module, or one of the three `DOMEventSubmodules`
     * (`AccelerationIncludingGravity`, `Acceleration`, `RotationRate`).
     * When the number of listeners reaches `0`, removes the `'devicemotion'` event listener.
     *
     * @see DeviceMotionModule#removeListener
     * @see DOMEventSubmodule#stop
     */
  }, {
    key: '_removeListener',
    value: function _removeListener() {
      this._numListeners--;

      if (this._numListeners === 0) window.removeEventListener('devicemotion', this._devicemotionListener, false);
    }

    /**
     * Initializes of the module.
     *
     * @return {promise}
     */
  }, {
    key: 'init',
    value: function init() {
      var _this2 = this;

      return _get(Object.getPrototypeOf(DeviceMotionModule.prototype), 'init', this).call(this, function (resolve) {
        _this2._promiseResolve = resolve;

        if (window.DeviceMotionEvent) window.addEventListener('devicemotion', _this2._devicemotionCheck, false);

        // WARNING
        // The lines of code below are commented because of a bug of Chrome
        // on some Android devices, where 'devicemotion' events are not sent
        // or caught if the listener is set up after a 'deviceorientation'
        // listener. Here, the _tryOrientationFallback method would add a
        // 'deviceorientation' listener and block all subsequent 'devicemotion'
        // events on these devices. Comments will be removed once the bug of
        // Chrome is corrected.

        // else if (this.required.rotationRate)
        // this._tryOrientationFallback();

        else resolve(_this2);
      });
    }

    /**
     * Adds a listener to this module.
     * 
     * @param {function} listener - Listener to add.
     */
  }, {
    key: 'addListener',
    value: function addListener(listener) {
      _get(Object.getPrototypeOf(DeviceMotionModule.prototype), 'addListener', this).call(this, listener);
      this._addListener();
    }

    /**
     * Removes a listener from this module.
     *
     * @param {function} listener - Listener to remove.
     */
  }, {
    key: 'removeListener',
    value: function removeListener(listener) {
      _get(Object.getPrototypeOf(DeviceMotionModule.prototype), 'removeListener', this).call(this, listener);
      this._removeListener();
    }
  }, {
    key: '_calculatedAccelerationDecay',
    get: function get() {
      return Math.exp(-2 * Math.PI * this.accelerationIncludingGravity.period / this._calculatedAccelerationTimeConstant);
    }
  }]);

  return DeviceMotionModule;
})(InputModule);

module.exports = new DeviceMotionModule();

},{"./DOMEventSubmodule":83,"./InputModule":87,"./MotionInput":88,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15,"platform":90}],85:[function(require,module,exports){
/**
 * @fileoverview `DeviceOrientation` module
 * @author <a href='mailto:sebastien@robaszkiewicz.com'>Sébastien Robaszkiewicz</a>, <a href='mailto:Norbert.Schnell@ircam.fr'>Norbert Schnell</a>
 */

'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var DOMEventSubmodule = require('./DOMEventSubmodule');
var InputModule = require('./InputModule');
var MotionInput = require('./MotionInput');
var platform = require('platform');

/**
 * Converts degrees to radians.
 * 
 * @param {number} deg - Angle in degrees.
 * @return {number}
 */
function degToRad(deg) {
  return deg * Math.PI / 180;
}

/**
 * Converts radians to degrees.
 * 
 * @param {number} rad - Angle in radians.
 * @return {number}
 */
function radToDeg(rad) {
  return rad * 180 / Math.PI;
}

/**
 * Normalizes a 3 x 3 matrix.
 * 
 * @param {number[]} m - Matrix to normalize, represented by an array of length 9.
 * @return {number[]}
 */
function normalize(m) {
  var det = m[0] * m[4] * m[8] + m[1] * m[5] * m[6] + m[2] * m[3] * m[7] - m[0] * m[5] * m[7] - m[1] * m[3] * m[8] - m[2] * m[4] * m[6];

  for (var i = 0; i < m.length; i++) {
    m[i] /= det;
  }return m;
}

/**
 * Converts a Euler angle `[alpha, beta, gamma]` to the W3C specification, where:
 * - `alpha` is in [0; +360[;
 * - `beta` is in [-180; +180[;
 * - `gamma` is in [-90; +90[.
 * 
 * @param {number[]} eulerAngle - Euler angle to unify, represented by an array of length 3 (`[alpha, beta, gamma]`).
 * @see {@link http://www.w3.org/TR/orientation-event/}
 */
function unify(eulerAngle) {
  // Cf. W3C specification (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
  // and Euler angles Wikipedia page (http://en.wikipedia.org/wiki/Euler_angles).
  //
  // W3C convention: Tait–Bryan angles Z-X'-Y'', where:
  //   alpha is in [0; +360[,
  //   beta is in [-180; +180[,
  //   gamma is in [-90; +90[.

  var alphaIsValid = typeof eulerAngle[0] === 'number';

  var _alpha = alphaIsValid ? degToRad(eulerAngle[0]) : 0;
  var _beta = degToRad(eulerAngle[1]);
  var _gamma = degToRad(eulerAngle[2]);

  var cA = Math.cos(_alpha);
  var cB = Math.cos(_beta);
  var cG = Math.cos(_gamma);
  var sA = Math.sin(_alpha);
  var sB = Math.sin(_beta);
  var sG = Math.sin(_gamma);

  var alpha = undefined,
      beta = undefined,
      gamma = undefined;

  var m = [cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB, cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB, -cB * sG, sB, cB * cG];
  normalize(m);

  // Since we want gamma in [-90; +90[, cG >= 0.
  if (m[8] > 0) {
    // Case 1: m[8] > 0 <=> cB > 0                 (and cG != 0)
    //                  <=> beta in ]-pi/2; +pi/2[ (and cG != 0)
    alpha = Math.atan2(-m[1], m[4]);
    beta = Math.asin(m[7]); // asin returns a number between -pi/2 and +pi/2 => OK
    gamma = Math.atan2(-m[6], m[8]);
  } else if (m[8] < 0) {
    // Case 2: m[8] < 0 <=> cB < 0                            (and cG != 0)
    //                  <=> beta in [-pi; -pi/2[ U ]+pi/2; +pi] (and cG != 0)

    // Since cB < 0 and cB is in m[1] and m[4], the point is flipped by 180 degrees.
    // Hence, we have to multiply both arguments of atan2 by -1 in order to revert
    // the point in its original position (=> another flip by 180 degrees).
    alpha = Math.atan2(m[1], -m[4]);
    beta = -Math.asin(m[7]);
    beta += beta >= 0 ? -Math.PI : Math.PI; // asin returns a number between -pi/2 and pi/2 => make sure beta in [-pi; -pi/2[ U ]+pi/2; +pi]
    gamma = Math.atan2(m[6], -m[8]); // same remark as for alpha, multiplication by -1
  } else {
      // Case 3: m[8] = 0 <=> cB = 0 or cG = 0
      if (m[6] > 0) {
        // Subcase 1: cG = 0 and cB > 0
        //            cG = 0 <=> sG = -1 <=> gamma = -pi/2 => m[6] = cB
        //            Hence, m[6] > 0 <=> cB > 0 <=> beta in ]-pi/2; +pi/2[
        alpha = Math.atan2(-m[1], m[4]);
        beta = Math.asin(m[7]); // asin returns a number between -pi/2 and +pi/2 => OK
        gamma = -Math.PI / 2;
      } else if (m[6] < 0) {
        // Subcase 2: cG = 0 and cB < 0
        //            cG = 0 <=> sG = -1 <=> gamma = -pi/2 => m[6] = cB
        //            Hence, m[6] < 0 <=> cB < 0 <=> beta in [-pi; -pi/2[ U ]+pi/2; +pi]
        alpha = Math.atan2(m[1], -m[4]); // same remark as for alpha in a case above
        beta = -Math.asin(m[7]);
        beta += beta >= 0 ? -Math.PI : Math.PI; // asin returns a number between -pi/2 and +pi/2 => make sure beta in [-pi; -pi/2[ U ]+pi/2; +pi]
        gamma = -Math.PI / 2;
      } else {
        // Subcase 3: cB = 0
        // In the case where cos(beta) = 0 (i.e. beta = -pi/2 or beta = pi/2),
        // we have the gimbal lock problem: in that configuration, only the angle
        // alpha + gamma (if beta = +pi/2) or alpha - gamma (if beta = -pi/2)
        // are uniquely defined: alpha and gamma can take an infinity of values.
        // For convenience, let's set gamma = 0 (and thus sin(gamma) = 0).
        // (As a consequence of the gimbal lock problem, there is a discontinuity
        // in alpha and gamma.)
        alpha = Math.atan2(m[3], m[0]);
        beta = m[7] > 0 ? Math.PI / 2 : -Math.PI / 2;
        gamma = 0;
      }
    }

  // atan2 returns a number between -pi and pi => make sure that alpha is in [0, 2*pi[.
  alpha += alpha < 0 ? 2 * Math.PI : 0;

  eulerAngle[0] = alphaIsValid ? radToDeg(alpha) : null;
  eulerAngle[1] = radToDeg(beta);
  eulerAngle[2] = radToDeg(gamma);
}

/**
 * Converts a Euler angle `[alpha, beta, gamma]` to a Euler angle where:
 * - `alpha` is in [0; +360[;
 * - `beta` is in [-90; +90[;
 * - `gamma` is in [-180; +180[.
 * 
 * @param {number[]} eulerAngle - Euler angle to convert, represented by an array of length 3 (`[alpha, beta, gamma]`).
 */
function unifyAlt(eulerAngle) {
  // Convention here: Tait–Bryan angles Z-X'-Y'', where:
  //   alpha is in [0; +360[,
  //   beta is in [-90; +90[,
  //   gamma is in [-180; +180[.

  var alphaIsValid = typeof eulerAngle[0] === 'number';

  var _alpha = alphaIsValid ? degToRad(eulerAngle[0]) : 0;
  var _beta = degToRad(eulerAngle[1]);
  var _gamma = degToRad(eulerAngle[2]);

  var cA = Math.cos(_alpha);
  var cB = Math.cos(_beta);
  var cG = Math.cos(_gamma);
  var sA = Math.sin(_alpha);
  var sB = Math.sin(_beta);
  var sG = Math.sin(_gamma);

  var alpha = undefined,
      beta = undefined,
      gamma = undefined;

  var m = [cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB, cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB, -cB * sG, sB, cB * cG];
  normalize(m);

  alpha = Math.atan2(-m[1], m[4]);
  alpha += alpha < 0 ? 2 * Math.PI : 0; // atan2 returns a number between -pi and +pi => make sure alpha is in [0, 2*pi[.
  beta = Math.asin(m[7]); // asin returns a number between -pi/2 and pi/2 => OK
  gamma = Math.atan2(-m[6], m[8]); // atan2 returns a number between -pi and +pi => OK

  eulerAngle[0] = alphaIsValid ? radToDeg(alpha) : null;
  eulerAngle[1] = radToDeg(beta);
  eulerAngle[2] = radToDeg(gamma);
}

/**
 * `DeviceOrientationModule` singleton.
 * The `DeviceOrientationModule` singleton provides the raw values
 * of the orientation provided by the `DeviceMotion` event.
 * It also instantiate the `Orientation` submodule that unifies those
 * values across platforms by making them compliant with {@link
 * http://www.w3.org/TR/orientation-event/|the W3C standard} (*i.e.*
 * the `alpha` angle between `0` and `360` degrees, the `beta` angle
 * between `-180` and `180` degrees, and `gamma` between `-90` and
 * `90` degrees), as well as the `OrientationAlt` submodules (with
 * the `alpha` angle between `0` and `360` degrees, the `beta` angle
 * between `-90` and `90` degrees, and `gamma` between `-180` and
 * `180` degrees).
 * When the `orientation` raw values are not provided by the sensors,
 * this modules tries to recalculate `beta` and `gamma` from the
 * `AccelerationIncludingGravity` module, if available (in that case,
 * the `alpha` angle is impossible to retrieve since the compass is
 * not available).
 *
 * @class DeviceMotionModule
 * @extends InputModule
 */

var DeviceOrientationModule = (function (_InputModule) {
  _inherits(DeviceOrientationModule, _InputModule);

  /**
   * Creates the `DeviceOrientation` module instance.
   *
   * @constructor
   */

  function DeviceOrientationModule() {
    _classCallCheck(this, DeviceOrientationModule);

    _get(Object.getPrototypeOf(DeviceOrientationModule.prototype), 'constructor', this).call(this, 'deviceorientation');

    /**
     * Raw values coming from the `deviceorientation` event sent by this module.
     *
     * @this DeviceOrientationModule
     * @type {number[]}
     * @default [null, null, null]
     */
    this.event = [null, null, null];

    /**
     * The `Orientation` module.
     * Provides unified values of the orientation compliant with {@link
     * http://www.w3.org/TR/orientation-event/|the W3C standard}
     * (`alpha` in `[0, 360]`, beta in `[-180, +180]`, `gamma` in `[-90, +90]`).
     *
     * @this DeviceOrientationModule
     * @type {DOMEventSubmodule}
     */
    this.orientation = new DOMEventSubmodule(this, 'orientation');

    /**
     * The `OrientationAlt` module.
     * Provides alternative values of the orientation
     * (`alpha` in `[0, 360]`, beta in `[-90, +90]`, `gamma` in `[-180, +180]`).
     *
     * @this DeviceOrientationModule
     * @type {DOMEventSubmodule}
     */
    this.orientationAlt = new DOMEventSubmodule(this, 'orientationAlt');

    /**
     * Required submodules / events.
     *
     * @this DeviceOrientationModule
     * @type {object}
     * @property {bool} orientation - Indicates whether the `orientation` unified values are required or not (defaults to `false`).
     * @property {bool} orientationAlt - Indicates whether the `orientationAlt` values are required or not (defaults to `false`).
     */
    this.required = {
      orientation: false,
      orientationAlt: false
    };

    /**
     * Number of listeners subscribed to the `DeviceOrientation` module.
     *
     * @this DeviceOrientationModule
     * @type {number}
     */
    this._numListeners = 0;

    /**
     * Resolve function of the module's promise.
     *
     * @this DeviceOrientationModule
     * @type {function}
     * @default null
     * @see DeviceOrientationModule#init
     */
    this._promiseResolve = null;

    /**
     * Gravity vector calculated from the `accelerationIncludingGravity` unified values.
     *
     * @this DeviceOrientationModule
     * @type {number[]}
     * @default [0, 0, 0]
     */
    this._estimatedGravity = [0, 0, 0];

    /**
     * Method binding of the sensor check.
     *
     * @this DeviceOrientationModule
     * @type {function}
     */
    this._deviceorientationCheck = this._deviceorientationCheck.bind(this);

    /**
     * Method binding of the `'deviceorientation'` event callback.
     *
     * @this DeviceOrientationModule
     * @type {function}
     */
    this._deviceorientationListener = this._deviceorientationListener.bind(this);
  }

  /**
   * Sensor check on initialization of the module.
   * This method:
   * - checks whether the `orientation` values are valid or not;
   * - (in the case where orientation raw values are not provided)
   *   tries to calculate the orientation from the
   *   `accelerationIncludingGravity` unified values.
   *
   * @param {DeviceMotionEvent} e - First `'devicemotion'` event caught, on which the check is done.
   */

  _createClass(DeviceOrientationModule, [{
    key: '_deviceorientationCheck',
    value: function _deviceorientationCheck(e) {
      this.isProvided = true;

      // Sensor availability for the orientation and alternative orientation
      var rawValuesProvided = typeof e.alpha === 'number' && typeof e.beta === 'number' && typeof e.gamma === 'number';
      this.orientation.isProvided = rawValuesProvided;
      this.orientationAlt.isProvided = rawValuesProvided;

      // TODO(?): get pseudo-period

      // We only need to listen to one event (=> remove the listener)
      window.removeEventListener('deviceorientation', this._deviceorientationCheck, false);

      // If orientation or alternative orientation are not provided by raw sensors but required,
      // try to calculate them with `accelerationIncludingGravity` unified values
      if (this.required.orientation && !this.orientation.isProvided || this.required.orientationAlt && !this.orientationAlt.isProvided) this._tryAccelerationIncludingGravityFallback();else this._promiseResolve(this);
    }

    /**
     * `'deviceorientation'` event callback.
     * This method emits an event with the raw `'deviceorientation'` values,
     * and emits events with the unified `orientation` and / or the
     * `orientationAlt` values if they are required.
     *
     * @param {DeviceOrientationEvent} e - `'deviceorientation'` event the values are calculated from.
     */
  }, {
    key: '_deviceorientationListener',
    value: function _deviceorientationListener(e) {
      // 'deviceorientation' event (raw values)
      var outEvent = this.event;

      outEvent[0] = e.alpha;
      outEvent[1] = e.beta;
      outEvent[2] = e.gamma;

      this.emit(outEvent);

      // 'orientation' event (unified values)
      if (this.required.orientation && this.orientation.isProvided) {
        // On iOS, the `alpha` value is initialized at `0` on the first `deviceorientation` event
        // so we keep that reference in memory to calculate the North later on
        if (!this.orientation._webkitCompassHeadingReference && e.webkitCompassHeading && platform.os.family === 'iOS') this.orientation._webkitCompassHeadingReference = e.webkitCompassHeading;

        var _outEvent = this.orientation.event;

        _outEvent[0] = e.alpha;
        _outEvent[1] = e.beta;
        _outEvent[2] = e.gamma;

        // On iOS, replace the `alpha` value by the North value and unify the angles
        // (the default representation of the angles on iOS is not compliant with the W3C specification)
        if (this.orientation._webkitCompassHeadingReference && platform.os.family === 'iOS') {
          _outEvent[0] += 360 - this.orientation._webkitCompassHeadingReference;
          unify(_outEvent);
        }

        this.orientation.emit(_outEvent);
      }

      // 'orientationAlt' event
      if (this.required.orientationAlt && this.orientationAlt.isProvided) {
        // On iOS, the `alpha` value is initialized at `0` on the first `deviceorientation` event
        // so we keep that reference in memory to calculate the North later on
        if (!this.orientationAlt._webkitCompassHeadingReference && e.webkitCompassHeading && platform.os.family === 'iOS') this.orientationAlt._webkitCompassHeadingReference = e.webkitCompassHeading;

        var _outEvent2 = this.orientationAlt.event;

        _outEvent2[0] = e.alpha;
        _outEvent2[1] = e.beta;
        _outEvent2[2] = e.gamma;

        // On iOS, replace the `alpha` value by the North value but do not convert the angles
        // (the default representation of the angles on iOS is compliant with the alternative representation)
        if (this.orientationAlt._webkitCompassHeadingReference && platform.os.family === 'iOS') {
          _outEvent2[0] -= this.orientationAlt._webkitCompassHeadingReference;
          _outEvent2[0] += _outEvent2[0] < 0 ? 360 : 0; // make sure `alpha` is in [0, +360[
        }

        // On Android, transform the angles to the alternative representation
        // (the default representation of the angles on Android is compliant with the W3C specification)
        if (platform.os.family === 'Android') unifyAlt(_outEvent2);

        this.orientationAlt.emit(_outEvent2);
      }
    }

    /**
     * Checks whether `beta` and `gamma` can be calculated from the `accelerationIncludingGravity` values or not.
     */
  }, {
    key: '_tryAccelerationIncludingGravityFallback',
    value: function _tryAccelerationIncludingGravityFallback() {
      var _this = this;

      MotionInput.requireModule('accelerationIncludingGravity').then(function (accelerationIncludingGravity) {
        if (accelerationIncludingGravity.isValid) {
          console.log("WARNING (motion-input): The 'deviceorientation' event does not exist or does not provide values in your browser, so the orientation of the device is estimated from DeviceMotion's 'accelerationIncludingGravity' event. Since the compass is not available, only the `beta` and `gamma` angles are provided (`alpha` is null).");

          if (_this.required.orientation) {
            _this.orientation.isCalculated = true;
            _this.orientation.period = accelerationIncludingGravity.period;

            MotionInput.addListener('accelerationIncludingGravity', function (accelerationIncludingGravity) {
              _this._calculateBetaAndGammaFromAccelerationIncludingGravity(accelerationIncludingGravity);
            });
          }

          if (_this.required.orientationAlt) {
            _this.orientationAlt.isCalculated = true;
            _this.orientationAlt.period = accelerationIncludingGravity.period;

            MotionInput.addListener('accelerationIncludingGravity', function (accelerationIncludingGravity) {
              _this._calculateBetaAndGammaFromAccelerationIncludingGravity(accelerationIncludingGravity, true);
            });
          }
        }

        _this._promiseResolve(_this);
      });
    }

    /**
     * Calculates and emits `beta` and `gamma` values as a fallback of the `orientation` and / or `orientationAlt` events, from the `accelerationIncludingGravity` unified values.
     *
     * @param {number[]} accelerationIncludingGravity - Latest `accelerationIncludingGravity raw values.
     * @param {bool} [alt=false] - Indicates whether we need the alternate representation of the angles or not.
     */
  }, {
    key: '_calculateBetaAndGammaFromAccelerationIncludingGravity',
    value: function _calculateBetaAndGammaFromAccelerationIncludingGravity(accelerationIncludingGravity) {
      var alt = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      var k = 0.8;

      // Low pass filter to estimate the gravity
      this._estimatedGravity[0] = k * this._estimatedGravity[0] + (1 - k) * accelerationIncludingGravity[0];
      this._estimatedGravity[1] = k * this._estimatedGravity[1] + (1 - k) * accelerationIncludingGravity[1];
      this._estimatedGravity[2] = k * this._estimatedGravity[2] + (1 - k) * accelerationIncludingGravity[2];

      var _gX = this._estimatedGravity[0];
      var _gY = this._estimatedGravity[1];
      var _gZ = this._estimatedGravity[2];

      var norm = Math.sqrt(_gX * _gX + _gY * _gY + _gZ * _gZ);

      _gX /= norm;
      _gY /= norm;
      _gZ /= norm;

      // Adopting the following conventions:
      // - each matrix operates by pre-multiplying column vectors,
      // - each matrix represents an active rotation,
      // - each matrix represents the composition of intrinsic rotations,
      // the rotation matrix representing the composition of a rotation
      // about the x-axis by an angle beta and a rotation about the y-axis
      // by an angle gamma is:
      //
      // [ cos(gamma)               ,  0          ,  sin(gamma)              ,
      //   sin(beta) * sin(gamma)   ,  cos(beta)  ,  -cos(gamma) * sin(beta) ,
      //   -cos(beta) * sin(gamma)  ,  sin(beta)  ,  cos(beta) * cos(gamma)  ].
      //
      // Hence, the projection of the normalized gravity g = [0, 0, 1]
      // in the device's reference frame corresponds to:
      //
      // gX = -cos(beta) * sin(gamma),
      // gY = sin(beta),
      // gZ = cos(beta) * cos(gamma),
      //
      // so beta = asin(gY) and gamma = atan2(-gX, gZ).

      // Beta & gamma equations (we approximate [gX, gY, gZ] by [_gX, _gY, _gZ])
      var beta = radToDeg(Math.asin(_gY)); // beta is in [-pi/2; pi/2[
      var gamma = radToDeg(Math.atan2(-_gX, _gZ)); // gamma is in [-pi; pi[

      if (alt) {
        // In that case, there is nothing to do since the calculations above gave the angle in the right ranges
        var outEvent = this.orientationAlt.event;
        outEvent[0] = null;
        outEvent[1] = beta;
        outEvent[2] = gamma;

        this.orientationAlt.emit(outEvent);
      } else {
        // Here we have to unify the angles to get the ranges compliant with the W3C specification
        var outEvent = this.orientation.event;
        outEvent[0] = null;
        outEvent[1] = beta;
        outEvent[2] = gamma;
        unify(outEvent);

        this.orientation.emit(outEvent);
      }
    }

    /**
     * Increases the number of listeners to this module (either because someone listens
     * to this module, or one of the two `DOMEventSubmodules` (`Orientation`,
     * `OrientationAlt`).
     * When the number of listeners reaches `1`, adds a `'deviceorientation'`
     * event listener.
     *
     * @see DeviceOrientationModule#addListener
     * @see DOMEventSubmodule#start
     */
  }, {
    key: '_addListener',
    value: function _addListener() {
      this._numListeners++;

      if (this._numListeners === 1) window.addEventListener('deviceorientation', this._deviceorientationListener, false);
    }

    /**
     * Decreases the number of listeners to this module (either because someone stops
     * listening to this module, or one of the three `DOMEventSubmodules`
     * (`Orientation`, `OrientationAlt`).
     * When the number of listeners reaches `0`, removes the `'deviceorientation'`
     * event listener.
     *
     * @see DeviceOrientationModule#removeListener
     * @see DOMEventSubmodule#stop
     */
  }, {
    key: '_removeListener',
    value: function _removeListener() {
      this._numListeners--;

      if (this._numListeners === 0) {
        window.removeEventListener('deviceorientation', this._deviceorientationListener, false);
        this.orientation._webkitCompassHeadingReference = null; // don't forget to reset the compass reference since this reference is set each time we start listening to a `'deviceorientation'` event
      }
    }

    /**
     * Initializes of the module.
     *
     * @return {Promise}
     */
  }, {
    key: 'init',
    value: function init() {
      var _this2 = this;

      return _get(Object.getPrototypeOf(DeviceOrientationModule.prototype), 'init', this).call(this, function (resolve) {
        _this2._promiseResolve = resolve;

        if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', _this2._deviceorientationCheck, false);else if (_this2.required.orientation) _this2._tryAccelerationIncludingGravityFallback();else resolve(_this2);
      });
    }

    /**
     * Adds a listener to this module.
     * 
     * @param {function} listener - Listener to add.
     */
  }, {
    key: 'addListener',
    value: function addListener(listener) {
      _get(Object.getPrototypeOf(DeviceOrientationModule.prototype), 'addListener', this).call(this, listener);
      this._addListener();
    }

    /**
     * Removes a listener from this module.
     *
     * @param {function} listener - Listener to remove.
     */
  }, {
    key: 'removeListener',
    value: function removeListener(listener) {
      _get(Object.getPrototypeOf(DeviceOrientationModule.prototype), 'removeListener', this).call(this, listener);
      this._removeListener();
    }
  }]);

  return DeviceOrientationModule;
})(InputModule);

module.exports = new DeviceOrientationModule();

},{"./DOMEventSubmodule":83,"./InputModule":87,"./MotionInput":88,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15,"platform":90}],86:[function(require,module,exports){
/**
 * @fileoverview Energy module
 * @author <a href='mailto:sebastien@robaszkiewicz.com'>Sébastien Robaszkiewicz</a>, <a href='mailto:Norbert.Schnell@ircam.fr'>Norbert Schnell</a>
 */

'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _slicedToArray = require('babel-runtime/helpers/sliced-to-array')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var InputModule = require('./InputModule');
var MotionInput = require('./MotionInput');

/**
 * Energy module singleton.
 * The energy module singleton provides energy values (between 0 and 1)
 * based on the acceleration and the rotation rate of the device.
 * The period of the energy values is the same as the period of the
 * acceleration and the rotation rate values.
 *
 * @class EnergyModule
 * @extends InputModule
 */

var EnergyModule = (function (_InputModule) {
  _inherits(EnergyModule, _InputModule);

  /**
   * Creates the energy module instance.
   *
   * @constructor
   */

  function EnergyModule() {
    _classCallCheck(this, EnergyModule);

    _get(Object.getPrototypeOf(EnergyModule.prototype), 'constructor', this).call(this, 'energy');

    /**
     * Event containing the value of the energy, sent by the energy module.
     *
     * @this EnergyModule
     * @type {number}
     * @default 0
     */
    this.event = 0;

    /**
     * The acceleration module, used in the calculation of the energy.
     *
     * @this EnergyModule
     * @type {DOMEventSubmodule}
     * @default null
     * @see DevicemotionModule
     */
    this._accelerationModule = null;

    /**
     * Latest acceleration value sent by the acceleration module.
     *
     * @this EnergyModule
     * @type {number[]}
     * @default null
     */
    this._accelerationValues = null;

    /**
     * Maximum value reached by the acceleration magnitude, clipped at `this._accelerationMagnitudeThreshold`.
     *
     * @this EnergyModule
     * @type {number}
     * @default 9.81
     */
    this._accelerationMagnitudeCurrentMax = 9.81;

    /**
     * Clipping value of the acceleration magnitude.
     *
     * @this EnergyModule
     * @type {number}
     * @default 20
     * @constant
     */
    this._accelerationMagnitudeThreshold = 20;

    /**
     * The rotation rate module, used in the calculation of the energy.
     *
     * @this EnergyModule
     * @type {DOMEventSubmodule}
     * @default null
     * @see DevicemotionModule
     */
    this._rotationRateModule = null;

    /**
     * Latest rotation rate value sent by the rotation rate module.
     *
     * @this EnergyModule
     * @type {number[]}
     * @default null
     */
    this._rotationRateValues = null;

    /**
     * Maximum value reached by the rotation rate magnitude, clipped at `this._rotationRateMagnitudeThreshold`.
     *
     * @this EnergyModule
     * @type {number}
     * @default 200
     */
    this._rotationRateMagnitudeCurrentMax = 200;

    /**
     * Clipping value of the rotation rate magnitude.
     *
     * @this EnergyModule
     * @type {number}
     * @default 600
     * @constant
     */
    this._rotationRateMagnitudeThreshold = 600;

    /**
     * Time constant (half-life) of the low-pass filter used to smooth the energy values (in seconds).
     *
     * @this EnergyModule
     * @type {number}
     * @default 0.1
     * @constant
     */
    this._energyTimeConstant = 0.1;

    /**
     * Method binding of the acceleration values callback.
     *
     * @this EnergyModule
     * @type {function}
     */
    this._onAcceleration = this._onAcceleration.bind(this);

    /**
     * Method binding of the rotation rate values callback.
     *
     * @this EnergyModule
     * @type {function}
     */
    this._onRotationRate = this._onRotationRate.bind(this);
  }

  /**
   * Decay factor of the low-pass filter used to smooth the energy values.
   *
   * @type {number}
   * @readonly
   */

  _createClass(EnergyModule, [{
    key: 'init',

    /**
     * Initializes of the module.
     *
     * @return {Promise}
     */
    value: function init() {
      var _this = this;

      return _get(Object.getPrototypeOf(EnergyModule.prototype), 'init', this).call(this, function (resolve) {
        // The energy module requires the acceleration and the rotation rate modules
        _Promise.all([MotionInput.requireModule('acceleration'), MotionInput.requireModule('rotationRate')]).then(function (modules) {
          var _modules = _slicedToArray(modules, 2);

          var acceleration = _modules[0];
          var rotationRate = _modules[1];

          _this._accelerationModule = acceleration;
          _this._rotationRateModule = rotationRate;
          _this.isCalculated = _this._accelerationModule.isValid || _this._rotationRateModule.isValid;

          if (_this._accelerationModule.isValid) _this.period = _this._accelerationModule.period;else if (_this._rotationRateModule.isValid) _this.period = _this._rotationRateModule.period;

          resolve(_this);
        });
      });
    }

    /**
     * Start the module.
     */
  }, {
    key: 'start',
    value: function start() {
      // TODO(?): make this method private
      if (this._accelerationModule.isValid) MotionInput.addListener('acceleration', this._onAcceleration);
      if (this._rotationRateModule.isValid) MotionInput.addListener('rotationRate', this._onRotationRate);
    }

    /**
     * Stop the module.
     */
  }, {
    key: 'stop',
    value: function stop() {
      // TODO(?): make this method private
      if (this._accelerationModule.isValid) MotionInput.removeListener('acceleration', this._onAcceleration);
      if (this._rotationRateModule.isValid) MotionInput.removeListener('rotationRate', this._onRotationRate);
    }

    /**
     * Acceleration values handler.
     *
     * @param {number[]} acceleration - Latest acceleration value.
     */
  }, {
    key: '_onAcceleration',
    value: function _onAcceleration(acceleration) {
      this._accelerationValues = acceleration;

      // If the rotation rate values are not available, we calculate the energy right away.
      if (!this._rotationRateModule.isValid) this._calculateEnergy();
    }

    /**
     * Rotation rate values handler.
     *
     * @param {number[]} rotationRate - Latest rotation rate value.
     */
  }, {
    key: '_onRotationRate',
    value: function _onRotationRate(rotationRate) {
      this._rotationRateValues = rotationRate;

      // We know that the acceleration and rotation rate values coming from the
      // same `devicemotion` event are sent in that order (acceleration > rotation rate)
      // so when the rotation rate is provided, we calculate the energy value of the
      // latest `devicemotion` event when we receive the rotation rate values.
      this._calculateEnergy();
    }

    /**
     * Energy calculation: emits an energy value between 0 and 1.
     *
     * This method checks if the acceleration modules is valid. If that is the case,
     * it calculates an estimation of the energy (between 0 and 1) based on the ratio
     * of the current acceleration magnitude and the maximum acceleration magnitude
     * reached so far (clipped at the `this._accelerationMagnitudeThreshold` value).
     * (We use this trick to get uniform behaviors among devices. If we calculated
     * the ratio based on a fixed value independent of what the device is capable of
     * providing, we could get inconsistent behaviors. For instance, the devices
     * whose accelerometers are limited at 2g would always provide very low values
     * compared to devices with accelerometers capable of measuring 4g accelerations.)
     * The same checks and calculations are made on the rotation rate module.
     * Finally, the energy value is the maximum between the energy value estimated
     * from the acceleration, and the one estimated from the rotation rate. It is
     * smoothed through a low-pass filter.
     */
  }, {
    key: '_calculateEnergy',
    value: function _calculateEnergy() {
      var accelerationEnergy = 0;
      var rotationRateEnergy = 0;

      // Check the acceleration module and calculate an estimation of the energy value from the latest acceleration value
      if (this._accelerationModule.isValid) {
        var aX = this._accelerationValues[0];
        var aY = this._accelerationValues[1];
        var aZ = this._accelerationValues[2];
        var accelerationMagnitude = Math.sqrt(aX * aX + aY * aY + aZ * aZ);

        // Store the maximum acceleration magnitude reached so far, clipped at `this._accelerationMagnitudeThreshold`
        if (this._accelerationMagnitudeCurrentMax < accelerationMagnitude) this._accelerationMagnitudeCurrentMax = Math.min(accelerationMagnitude, this._accelerationMagnitudeThreshold);
        // TODO(?): remove ouliers --- on some Android devices, the magnitude is very high on a few isolated datapoints,
        // which make the threshold very high as well => the energy remains around 0.5, even when you shake very hard.

        accelerationEnergy = Math.min(accelerationMagnitude / this._accelerationMagnitudeCurrentMax, 1);
      }

      // Check the rotation rate module and calculate an estimation of the energy value from the latest rotation rate value
      if (this._rotationRateModule.isValid) {
        var rA = this._rotationRateValues[0];
        var rB = this._rotationRateValues[1];
        var rG = this._rotationRateValues[2];
        var rotationRateMagnitude = Math.sqrt(rA * rA + rB * rB + rG * rG);

        // Store the maximum rotation rate magnitude reached so far, clipped at `this._rotationRateMagnitudeThreshold`
        if (this._rotationRateMagnitudeCurrentMax < rotationRateMagnitude) this._rotationRateMagnitudeCurrentMax = Math.min(rotationRateMagnitude, this._rotationRateMagnitudeThreshold);

        rotationRateEnergy = Math.min(rotationRateMagnitude / this._rotationRateMagnitudeCurrentMax, 1);
      }

      var energy = Math.max(accelerationEnergy, rotationRateEnergy);

      // Low-pass filter to smooth the energy values
      var k = this._energyDecay;
      this.event = k * this.event + (1 - k) * energy;

      // Emit the energy value
      this.emit(this.event);
    }
  }, {
    key: '_energyDecay',
    get: function get() {
      return Math.exp(-2 * Math.PI * this.period / this._energyTimeConstant);
    }
  }]);

  return EnergyModule;
})(InputModule);

module.exports = new EnergyModule();

},{"./InputModule":87,"./MotionInput":88,"babel-runtime/core-js/promise":11,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15,"babel-runtime/helpers/sliced-to-array":17}],87:[function(require,module,exports){
/**
 * @fileoverview `InputModule` module
 * @author <a href='mailto:sebastien@robaszkiewicz.com'>Sébastien Robaszkiewicz</a>, <a href='mailto:Norbert.Schnell@ircam.fr'>Norbert Schnell</a>
 */

'use strict';

/**
 * `InputModule` class.
 * The `InputModule` class allows to instantiate modules that are part of the
 * motion input module, and that provide values (for instance, `deviceorientation`,
 * `acceleration`, `energy`).
 *
 * @class InputModule
 */

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _getIterator = require('babel-runtime/core-js/get-iterator')['default'];

var InputModule = (function () {

  /**
   * Creates an `InputModule` module instance.
   *
   * @constructor
   * @param {string} eventType - Name of the module / event (*e.g.* `deviceorientation, 'acceleration', 'energy').
   */

  function InputModule(eventType) {
    _classCallCheck(this, InputModule);

    /**
     * Event type of the module.
     *
     * @this InputModule
     * @type {string}
     * @constant
     */
    this.eventType = eventType;

    /**
     * Array of listeners attached to this module / event.
     *
     * @this InputModule
     * @type {function[]}
     * @default []
     */
    this.listeners = [];

    /**
     * Event sent by this module.
     *
     * @this InputModule
     * @type {number|number[]}
     * @default null
     */
    this.event = null;

    /**
     * Module promise (resolved when the module is initialized).
     *
     * @this InputModule
     * @type {Promise}
     * @default null
     */
    this.promise = null;

    /**
     * Indicates if the module's event values are calculated from parent modules / events.
     *
     * @this InputModule
     * @type {bool}
     * @default false
     */
    this.isCalculated = false;

    /**
     * Indicates if the module's event values are provided by the device's sensors.
     * (*I.e.* indicates if the `'devicemotion'` or `'deviceorientation'` events provide the required raw values.)
     *
     * @this InputModule
     * @type {bool}
     * @default false
     */
    this.isProvided = false;

    /**
     * Period at which the module's events are sent (`undefined` if the events are not sent at regular intervals).
     *
     * @this InputModule
     * @type {number}
     * @default undefined
     */
    this.period = undefined;
  }

  /**
   * Indicates whether the module can provide values or not.
   *
   * @type {bool}
   * @readonly
   */

  _createClass(InputModule, [{
    key: 'init',

    /**
     * Initializes the module.
     *
     * @param {function} promiseFun - Promise function that takes the `resolve` and `reject` functions as arguments.
     * @return {Promise}
     */
    value: function init(promiseFun) {
      this.promise = new _Promise(promiseFun);
      return this.promise;
    }

    /**
     * Starts the module.
     */
  }, {
    key: 'start',
    value: function start() {}
    // abstract method

    /**
     * Stops the module.
     */

  }, {
    key: 'stop',
    value: function stop() {}
    // abstract method

    /**
     * Adds a listener to the module.
     *
     * @param {function} listener - Listener to add.
     */

  }, {
    key: 'addListener',
    value: function addListener(listener) {
      this.listeners.push(listener);

      // Start the module as soon as there is a listener
      if (this.listeners.length === 1) this.start();
    }

    /**
     * Removes a listener from the module.
     *
     * @param {function} listener - Listener to remove.
     */
  }, {
    key: 'removeListener',
    value: function removeListener(listener) {
      var index = this.listeners.indexOf(listener);
      this.listeners.splice(index, 1);

      // Stop the module id there are no listeners
      if (this.listeners.length === 0) this.stop();
    }

    /**
     * Propagates an event to all the module's listeners.
     *
     * @param {number|number[]} [event=this.event] - Event values to propagate to the module's listeners.
     */
  }, {
    key: 'emit',
    value: function emit() {
      var event = arguments.length <= 0 || arguments[0] === undefined ? this.event : arguments[0];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = _getIterator(this.listeners), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var listener = _step.value;

          listener(event);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator['return']) {
            _iterator['return']();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }
  }, {
    key: 'isValid',
    get: function get() {
      return this.isProvided || this.isCalculated;
    }
  }]);

  return InputModule;
})();

module.exports = InputModule;

},{"babel-runtime/core-js/get-iterator":5,"babel-runtime/core-js/promise":11,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13}],88:[function(require,module,exports){
/**
 * @fileoverview `MotionInput` module
 * @author <a href='mailto:sebastien@robaszkiewicz.com'>Sébastien Robaszkiewicz</a>, <a href='mailto:Norbert.Schnell@ircam.fr'>Norbert Schnell</a>
 */

'use strict';

/**
 * `MotionInput` singleton.
 * The `MotionInput` singleton allows to initialize motion events
 * and to listen to them.
 * 
 * @class MotionInput
 */

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var MotionInput = (function () {

  /**
   * Creates the `MotionInput` module instance.
   *
   * @constructor
   */

  function MotionInput() {
    _classCallCheck(this, MotionInput);

    /**
     * Pool of all available modules.
     *
     * @this MotionInput
     * @type {object}
     * @default {}
     */
    this.modules = {};
  }

  /**
   * Adds a module to the `MotionInput` module.
   *
   * @param {string} eventType - Name of the event type.
   * @param {InputModule} module - Module to add to the `MotionInput` module.
   */

  _createClass(MotionInput, [{
    key: 'addModule',
    value: function addModule(eventType, module) {
      this.modules[eventType] = module;
    }

    /**
     * Gets a module.
     *
     * @param {string} eventType - Name of the event type (module) to retrieve.
     * @return {InputModule}
     */
  }, {
    key: 'getModule',
    value: function getModule(eventType) {
      return this.modules[eventType];
    }

    /**
     * Requires a module.
     * If the module has been initialized alread, returns its promise. Otherwise,
     * initializes the module.
     *
     * @param {string} eventType - Name of the event type (module) to require.
     * @return {Promise}
     */
  }, {
    key: 'requireModule',
    value: function requireModule(eventType) {
      var module = this.getModule(eventType);

      if (module.promise) return module.promise;

      return module.init();
    }

    /**
     * Initializes the `MotionInput` module.
     *
     * @param {string[]} ...eventTypes - Array of the event types to initialize.
     * @return {Promise}
     */
  }, {
    key: 'init',
    value: function init() {
      var _this = this;

      for (var _len = arguments.length, eventTypes = Array(_len), _key = 0; _key < _len; _key++) {
        eventTypes[_key] = arguments[_key];
      }

      var modulePromises = eventTypes.map(function (value) {
        var module = _this.getModule(value);
        return module.init();
      });

      return _Promise.all(modulePromises);
    }

    /**
     * Adds a listener.
     *
     * @param {string} eventType - Name of the event type (module) to add a listener to.
     * @param {function} listener - Listener to add.
     */
  }, {
    key: 'addListener',
    value: function addListener(eventType, listener) {
      var module = this.getModule(eventType);
      module.addListener(listener);
    }

    /**
     * Removes a listener.
     *
     * @param {string} eventType - Name of the event type (module) to add a listener to.
     * @param {function} listener - Listener to remove.
     */
  }, {
    key: 'removeListener',
    value: function removeListener(eventType, listener) {
      var module = this.getModule(eventType);
      module.removeListener(listener);
    }
  }]);

  return MotionInput;
})();

module.exports = new MotionInput();

},{"babel-runtime/core-js/promise":11,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13}],89:[function(require,module,exports){
/**
 * @fileoverview Motion input index file
 * @author <a href='mailto:sebastien@robaszkiewicz.com'>Sébastien Robaszkiewicz</a>, <a href='mailto:Norbert.Schnell@ircam.fr'>Norbert Schnell</a>
 * @description The motion input module can be used as follows:
 * ```
 * const input = require('motion-input');
 * const requiredEvents = ['acceleration', 'orientation', 'energy'];
 * 
 * input
 *  .init(requiredEvents)
 *  .then((modules) => {
 *    const [acceleration, orientation, energy] = modules;
 *
 *    if (acceleration.isValid) {
 *      input.addListener('acceleration', (val) => {
 *        console.log('acceleration', val);
 *        // do something with the acceleration values
 *      });
 *    }
 *
 *    // do something else with the other modules
 *  });
 * ```
 */

'use strict';

var motionInput = require('./dist/MotionInput');
var deviceorientationModule = require('./dist/DeviceOrientationModule');
var devicemotionModule = require('./dist/DeviceMotionModule');
var energy = require('./dist/EnergyModule');

motionInput.addModule('devicemotion', devicemotionModule);
motionInput.addModule('deviceorientation', deviceorientationModule);
motionInput.addModule('accelerationIncludingGravity', devicemotionModule.accelerationIncludingGravity);
motionInput.addModule('acceleration', devicemotionModule.acceleration);
motionInput.addModule('rotationRate', devicemotionModule.rotationRate);
motionInput.addModule('orientation', deviceorientationModule.orientation);
motionInput.addModule('orientationAlt', deviceorientationModule.orientationAlt);
motionInput.addModule('energy', energy);

module.exports = motionInput;
},{"./dist/DeviceMotionModule":84,"./dist/DeviceOrientationModule":85,"./dist/EnergyModule":86,"./dist/MotionInput":88}],90:[function(require,module,exports){
(function (global){
/*!
 * Platform.js v1.3.0 <http://mths.be/platform>
 * Copyright 2010-2014 John-David Dalton <http://allyoucanleet.com/>
 * Available under MIT license <http://mths.be/mit>
 */
;(function() {
  'use strict';

  /** Used to determine if values are of the language type `Object` */
  var objectTypes = {
    'function': true,
    'object': true
  };

  /** Used as a reference to the global object */
  var root = (objectTypes[typeof window] && window) || this;

  /** Backup possible global object */
  var oldRoot = root;

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
  var freeGlobal = freeExports && freeModule && typeof global == 'object' && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal)) {
    root = freeGlobal;
  }

  /**
   * Used as the maximum length of an array-like object.
   * See the [ES6 spec](http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength)
   * for more details.
   */
  var maxSafeInteger = Math.pow(2, 53) - 1;

  /** Opera regexp */
  var reOpera = /\bOpera/;

  /** Possible global object */
  var thisBinding = this;

  /** Used for native method references */
  var objectProto = Object.prototype;

  /** Used to check for own properties of an object */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /** Used to resolve the internal `[[Class]]` of values */
  var toString = objectProto.toString;

  /*--------------------------------------------------------------------------*/

  /**
   * Capitalizes a string value.
   *
   * @private
   * @param {string} string The string to capitalize.
   * @returns {string} The capitalized string.
   */
  function capitalize(string) {
    string = String(string);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * A utility function to clean up the OS name.
   *
   * @private
   * @param {string} os The OS name to clean up.
   * @param {string} [pattern] A `RegExp` pattern matching the OS name.
   * @param {string} [label] A label for the OS.
   */
  function cleanupOS(os, pattern, label) {
    // platform tokens defined at
    // http://msdn.microsoft.com/en-us/library/ms537503(VS.85).aspx
    // http://web.archive.org/web/20081122053950/http://msdn.microsoft.com/en-us/library/ms537503(VS.85).aspx
    var data = {
      '6.4':  '10',
      '6.3':  '8.1',
      '6.2':  '8',
      '6.1':  'Server 2008 R2 / 7',
      '6.0':  'Server 2008 / Vista',
      '5.2':  'Server 2003 / XP 64-bit',
      '5.1':  'XP',
      '5.01': '2000 SP1',
      '5.0':  '2000',
      '4.0':  'NT',
      '4.90': 'ME'
    };
    // detect Windows version from platform tokens
    if (pattern && label && /^Win/i.test(os) &&
        (data = data[0/*Opera 9.25 fix*/, /[\d.]+$/.exec(os)])) {
      os = 'Windows ' + data;
    }
    // correct character case and cleanup
    os = String(os);

    if (pattern && label) {
      os = os.replace(RegExp(pattern, 'i'), label);
    }

    os = format(
      os.replace(/ ce$/i, ' CE')
        .replace(/\bhpw/i, 'web')
        .replace(/\bMacintosh\b/, 'Mac OS')
        .replace(/_PowerPC\b/i, ' OS')
        .replace(/\b(OS X) [^ \d]+/i, '$1')
        .replace(/\bMac (OS X)\b/, '$1')
        .replace(/\/(\d)/, ' $1')
        .replace(/_/g, '.')
        .replace(/(?: BePC|[ .]*fc[ \d.]+)$/i, '')
        .replace(/\bx86\.64\b/gi, 'x86_64')
        .replace(/\b(Windows Phone) OS\b/, '$1')
        .split(' on ')[0]
    );

    return os;
  }

  /**
   * An iteration utility for arrays and objects.
   *
   * @private
   * @param {Array|Object} object The object to iterate over.
   * @param {Function} callback The function called per iteration.
   */
  function each(object, callback) {
    var index = -1,
        length = object ? object.length : 0;

    if (typeof length == 'number' && length > -1 && length <= maxSafeInteger) {
      while (++index < length) {
        callback(object[index], index, object);
      }
    } else {
      forOwn(object, callback);
    }
  }

  /**
   * Trim and conditionally capitalize string values.
   *
   * @private
   * @param {string} string The string to format.
   * @returns {string} The formatted string.
   */
  function format(string) {
    string = trim(string);
    return /^(?:webOS|i(?:OS|P))/.test(string)
      ? string
      : capitalize(string);
  }

  /**
   * Iterates over an object's own properties, executing the `callback` for each.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} callback The function executed per own property.
   */
  function forOwn(object, callback) {
    for (var key in object) {
      if (hasOwnProperty.call(object, key)) {
        callback(object[key], key, object);
      }
    }
  }

  /**
   * Gets the internal `[[Class]]` of a value.
   *
   * @private
   * @param {*} value The value.
   * @returns {string} The `[[Class]]`.
   */
  function getClassOf(value) {
    return value == null
      ? capitalize(value)
      : toString.call(value).slice(8, -1);
  }

  /**
   * Host objects can return type values that are different from their actual
   * data type. The objects we are concerned with usually return non-primitive
   * types of "object", "function", or "unknown".
   *
   * @private
   * @param {*} object The owner of the property.
   * @param {string} property The property to check.
   * @returns {boolean} Returns `true` if the property value is a non-primitive, else `false`.
   */
  function isHostType(object, property) {
    var type = object != null ? typeof object[property] : 'number';
    return !/^(?:boolean|number|string|undefined)$/.test(type) &&
      (type == 'object' ? !!object[property] : true);
  }

  /**
   * Prepares a string for use in a `RegExp` by making hyphens and spaces optional.
   *
   * @private
   * @param {string} string The string to qualify.
   * @returns {string} The qualified string.
   */
  function qualify(string) {
    return String(string).replace(/([ -])(?!$)/g, '$1?');
  }

  /**
   * A bare-bones `Array#reduce` like utility function.
   *
   * @private
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function called per iteration.
   * @returns {*} The accumulated result.
   */
  function reduce(array, callback) {
    var accumulator = null;
    each(array, function(value, index) {
      accumulator = callback(accumulator, value, index, array);
    });
    return accumulator;
  }

  /**
   * Removes leading and trailing whitespace from a string.
   *
   * @private
   * @param {string} string The string to trim.
   * @returns {string} The trimmed string.
   */
  function trim(string) {
    return String(string).replace(/^ +| +$/g, '');
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a new platform object.
   *
   * @memberOf platform
   * @param {Object|string} [ua=navigator.userAgent] The user agent string or
   *  context object.
   * @returns {Object} A platform object.
   */
  function parse(ua) {

    /** The environment context object */
    var context = root;

    /** Used to flag when a custom context is provided */
    var isCustomContext = ua && typeof ua == 'object' && getClassOf(ua) != 'String';

    // juggle arguments
    if (isCustomContext) {
      context = ua;
      ua = null;
    }

    /** Browser navigator object */
    var nav = context.navigator || {};

    /** Browser user agent string */
    var userAgent = nav.userAgent || '';

    ua || (ua = userAgent);

    /** Used to flag when `thisBinding` is the [ModuleScope] */
    var isModuleScope = isCustomContext || thisBinding == oldRoot;

    /** Used to detect if browser is like Chrome */
    var likeChrome = isCustomContext
      ? !!nav.likeChrome
      : /\bChrome\b/.test(ua) && !/internal|\n/i.test(toString.toString());

    /** Internal `[[Class]]` value shortcuts */
    var objectClass = 'Object',
        airRuntimeClass = isCustomContext ? objectClass : 'ScriptBridgingProxyObject',
        enviroClass = isCustomContext ? objectClass : 'Environment',
        javaClass = (isCustomContext && context.java) ? 'JavaPackage' : getClassOf(context.java),
        phantomClass = isCustomContext ? objectClass : 'RuntimeObject';

    /** Detect Java environment */
    var java = /\bJava/.test(javaClass) && context.java;

    /** Detect Rhino */
    var rhino = java && getClassOf(context.environment) == enviroClass;

    /** A character to represent alpha */
    var alpha = java ? 'a' : '\u03b1';

    /** A character to represent beta */
    var beta = java ? 'b' : '\u03b2';

    /** Browser document object */
    var doc = context.document || {};

    /**
     * Detect Opera browser (Presto-based)
     * http://www.howtocreate.co.uk/operaStuff/operaObject.html
     * http://dev.opera.com/articles/view/opera-mini-web-content-authoring-guidelines/#operamini
     */
    var opera = context.operamini || context.opera;

    /** Opera `[[Class]]` */
    var operaClass = reOpera.test(operaClass = (isCustomContext && opera) ? opera['[[Class]]'] : getClassOf(opera))
      ? operaClass
      : (opera = null);

    /*------------------------------------------------------------------------*/

    /** Temporary variable used over the script's lifetime */
    var data;

    /** The CPU architecture */
    var arch = ua;

    /** Platform description array */
    var description = [];

    /** Platform alpha/beta indicator */
    var prerelease = null;

    /** A flag to indicate that environment features should be used to resolve the platform */
    var useFeatures = ua == userAgent;

    /** The browser/environment version */
    var version = useFeatures && opera && typeof opera.version == 'function' && opera.version();

    /** A flag to indicate if the OS ends with "/ Version" */
    var isSpecialCasedOS;

    /* Detectable layout engines (order is important) */
    var layout = getLayout([
      'Trident',
      { 'label': 'WebKit', 'pattern': 'AppleWebKit' },
      'iCab',
      'Presto',
      'NetFront',
      'Tasman',
      'KHTML',
      'Gecko'
    ]);

    /* Detectable browser names (order is important) */
    var name = getName([
      'Adobe AIR',
      'Arora',
      'Avant Browser',
      'Breach',
      'Camino',
      'Epiphany',
      'Fennec',
      'Flock',
      'Galeon',
      'GreenBrowser',
      'iCab',
      'Iceweasel',
      { 'label': 'SRWare Iron', 'pattern': 'Iron' },
      'K-Meleon',
      'Konqueror',
      'Lunascape',
      'Maxthon',
      'Midori',
      'Nook Browser',
      'PhantomJS',
      'Raven',
      'Rekonq',
      'RockMelt',
      'SeaMonkey',
      { 'label': 'Silk', 'pattern': '(?:Cloud9|Silk-Accelerated)' },
      'Sleipnir',
      'SlimBrowser',
      'Sunrise',
      'Swiftfox',
      'WebPositive',
      'Opera Mini',
      { 'label': 'Opera Mini', 'pattern': 'OPiOS' },
      'Opera',
      { 'label': 'Opera', 'pattern': 'OPR' },
      'Chrome',
      { 'label': 'Chrome Mobile', 'pattern': '(?:CriOS|CrMo)' },
      { 'label': 'Firefox', 'pattern': '(?:Firefox|Minefield)' },
      { 'label': 'IE', 'pattern': 'IEMobile' },
      { 'label': 'IE', 'pattern': 'MSIE' },
      'Safari'
    ]);

    /* Detectable products (order is important) */
    var product = getProduct([
      { 'label': 'BlackBerry', 'pattern': 'BB10' },
      'BlackBerry',
      { 'label': 'Galaxy S', 'pattern': 'GT-I9000' },
      { 'label': 'Galaxy S2', 'pattern': 'GT-I9100' },
      { 'label': 'Galaxy S3', 'pattern': 'GT-I9300' },
      { 'label': 'Galaxy S4', 'pattern': 'GT-I9500' },
      'Google TV',
      'Lumia',
      'iPad',
      'iPod',
      'iPhone',
      'Kindle',
      { 'label': 'Kindle Fire', 'pattern': '(?:Cloud9|Silk-Accelerated)' },
      'Nook',
      'PlayBook',
      'PlayStation 4',
      'PlayStation 3',
      'PlayStation Vita',
      'TouchPad',
      'Transformer',
      { 'label': 'Wii U', 'pattern': 'WiiU' },
      'Wii',
      'Xbox One',
      { 'label': 'Xbox 360', 'pattern': 'Xbox' },
      'Xoom'
    ]);

    /* Detectable manufacturers */
    var manufacturer = getManufacturer({
      'Apple': { 'iPad': 1, 'iPhone': 1, 'iPod': 1 },
      'Amazon': { 'Kindle': 1, 'Kindle Fire': 1 },
      'Asus': { 'Transformer': 1 },
      'Barnes & Noble': { 'Nook': 1 },
      'BlackBerry': { 'PlayBook': 1 },
      'Google': { 'Google TV': 1 },
      'HP': { 'TouchPad': 1 },
      'HTC': {},
      'LG': {},
      'Microsoft': { 'Xbox': 1, 'Xbox One': 1 },
      'Motorola': { 'Xoom': 1 },
      'Nintendo': { 'Wii U': 1,  'Wii': 1 },
      'Nokia': { 'Lumia': 1 },
      'Samsung': { 'Galaxy S': 1, 'Galaxy S2': 1, 'Galaxy S3': 1, 'Galaxy S4': 1 },
      'Sony': { 'PlayStation 4': 1, 'PlayStation 3': 1, 'PlayStation Vita': 1 }
    });

    /* Detectable OSes (order is important) */
    var os = getOS([
      'Windows Phone ',
      'Android',
      'CentOS',
      'Debian',
      'Fedora',
      'FreeBSD',
      'Gentoo',
      'Haiku',
      'Kubuntu',
      'Linux Mint',
      'Red Hat',
      'SuSE',
      'Ubuntu',
      'Xubuntu',
      'Cygwin',
      'Symbian OS',
      'hpwOS',
      'webOS ',
      'webOS',
      'Tablet OS',
      'Linux',
      'Mac OS X',
      'Macintosh',
      'Mac',
      'Windows 98;',
      'Windows '
    ]);

    /*------------------------------------------------------------------------*/

    /**
     * Picks the layout engine from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected layout engine.
     */
    function getLayout(guesses) {
      return reduce(guesses, function(result, guess) {
        return result || RegExp('\\b' + (
          guess.pattern || qualify(guess)
        ) + '\\b', 'i').exec(ua) && (guess.label || guess);
      });
    }

    /**
     * Picks the manufacturer from an array of guesses.
     *
     * @private
     * @param {Array} guesses An object of guesses.
     * @returns {null|string} The detected manufacturer.
     */
    function getManufacturer(guesses) {
      return reduce(guesses, function(result, value, key) {
        // lookup the manufacturer by product or scan the UA for the manufacturer
        return result || (
          value[product] ||
          value[0/*Opera 9.25 fix*/, /^[a-z]+(?: +[a-z]+\b)*/i.exec(product)] ||
          RegExp('\\b' + qualify(key) + '(?:\\b|\\w*\\d)', 'i').exec(ua)
        ) && key;
      });
    }

    /**
     * Picks the browser name from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected browser name.
     */
    function getName(guesses) {
      return reduce(guesses, function(result, guess) {
        return result || RegExp('\\b' + (
          guess.pattern || qualify(guess)
        ) + '\\b', 'i').exec(ua) && (guess.label || guess);
      });
    }

    /**
     * Picks the OS name from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected OS name.
     */
    function getOS(guesses) {
      return reduce(guesses, function(result, guess) {
        var pattern = guess.pattern || qualify(guess);
        if (!result && (result =
              RegExp('\\b' + pattern + '(?:/[\\d.]+|[ \\w.]*)', 'i').exec(ua)
            )) {
          result = cleanupOS(result, pattern, guess.label || guess);
        }
        return result;
      });
    }

    /**
     * Picks the product name from an array of guesses.
     *
     * @private
     * @param {Array} guesses An array of guesses.
     * @returns {null|string} The detected product name.
     */
    function getProduct(guesses) {
      return reduce(guesses, function(result, guess) {
        var pattern = guess.pattern || qualify(guess);
        if (!result && (result =
              RegExp('\\b' + pattern + ' *\\d+[.\\w_]*', 'i').exec(ua) ||
              RegExp('\\b' + pattern + '(?:; *(?:[a-z]+[_-])?[a-z]+\\d+|[^ ();-]*)', 'i').exec(ua)
            )) {
          // split by forward slash and append product version if needed
          if ((result = String((guess.label && !RegExp(pattern, 'i').test(guess.label)) ? guess.label : result).split('/'))[1] && !/[\d.]+/.test(result[0])) {
            result[0] += ' ' + result[1];
          }
          // correct character case and cleanup
          guess = guess.label || guess;
          result = format(result[0]
            .replace(RegExp(pattern, 'i'), guess)
            .replace(RegExp('; *(?:' + guess + '[_-])?', 'i'), ' ')
            .replace(RegExp('(' + guess + ')[-_.]?(\\w)', 'i'), '$1 $2'));
        }
        return result;
      });
    }

    /**
     * Resolves the version using an array of UA patterns.
     *
     * @private
     * @param {Array} patterns An array of UA patterns.
     * @returns {null|string} The detected version.
     */
    function getVersion(patterns) {
      return reduce(patterns, function(result, pattern) {
        return result || (RegExp(pattern +
          '(?:-[\\d.]+/|(?: for [\\w-]+)?[ /-])([\\d.]+[^ ();/_-]*)', 'i').exec(ua) || 0)[1] || null;
      });
    }

    /**
     * Returns `platform.description` when the platform object is coerced to a string.
     *
     * @name toString
     * @memberOf platform
     * @returns {string} Returns `platform.description` if available, else an empty string.
     */
    function toStringPlatform() {
      return this.description || '';
    }

    /*------------------------------------------------------------------------*/

    // convert layout to an array so we can add extra details
    layout && (layout = [layout]);

    // detect product names that contain their manufacturer's name
    if (manufacturer && !product) {
      product = getProduct([manufacturer]);
    }
    // clean up Google TV
    if ((data = /\bGoogle TV\b/.exec(product))) {
      product = data[0];
    }
    // detect simulators
    if (/\bSimulator\b/i.test(ua)) {
      product = (product ? product + ' ' : '') + 'Simulator';
    }
    // detect Opera Mini 8+ running in Turbo/Uncompressed mode on iOS
    if (name == 'Opera Mini' && /\bOPiOS\b/.test(ua)) {
      description.push('running in Turbo/Uncompressed mode');
    }
    // detect iOS
    if (/^iP/.test(product)) {
      name || (name = 'Safari');
      os = 'iOS' + ((data = / OS ([\d_]+)/i.exec(ua))
        ? ' ' + data[1].replace(/_/g, '.')
        : '');
    }
    // detect Kubuntu
    else if (name == 'Konqueror' && !/buntu/i.test(os)) {
      os = 'Kubuntu';
    }
    // detect Android browsers
    else if (manufacturer && manufacturer != 'Google' &&
        ((/Chrome/.test(name) && !/\bMobile Safari\b/i.test(ua)) || /\bVita\b/.test(product))) {
      name = 'Android Browser';
      os = /\bAndroid\b/.test(os) ? os : 'Android';
    }
    // detect false positives for Firefox/Safari
    else if (!name || (data = !/\bMinefield\b|\(Android;/i.test(ua) && /\b(?:Firefox|Safari)\b/.exec(name))) {
      // escape the `/` for Firefox 1
      if (name && !product && /[\/,]|^[^(]+?\)/.test(ua.slice(ua.indexOf(data + '/') + 8))) {
        // clear name of false positives
        name = null;
      }
      // reassign a generic name
      if ((data = product || manufacturer || os) &&
          (product || manufacturer || /\b(?:Android|Symbian OS|Tablet OS|webOS)\b/.test(os))) {
        name = /[a-z]+(?: Hat)?/i.exec(/\bAndroid\b/.test(os) ? os : data) + ' Browser';
      }
    }
    // detect Firefox OS
    if ((data = /\((Mobile|Tablet).*?Firefox\b/i.exec(ua)) && data[1]) {
      os = 'Firefox OS';
      if (!product) {
        product = data[1];
      }
    }
    // detect non-Opera versions (order is important)
    if (!version) {
      version = getVersion([
        '(?:Cloud9|CriOS|CrMo|IEMobile|Iron|Opera ?Mini|OPiOS|OPR|Raven|Silk(?!/[\\d.]+$))',
        'Version',
        qualify(name),
        '(?:Firefox|Minefield|NetFront)'
      ]);
    }
    // detect stubborn layout engines
    if (layout == 'iCab' && parseFloat(version) > 3) {
      layout = ['WebKit'];
    } else if (
        layout != 'Trident' &&
        (data =
          /\bOpera\b/.test(name) && (/\bOPR\b/.test(ua) ? 'Blink' : 'Presto') ||
          /\b(?:Midori|Nook|Safari)\b/i.test(ua) && 'WebKit' ||
          !layout && /\bMSIE\b/i.test(ua) && (os == 'Mac OS' ? 'Tasman' : 'Trident')
        )
    ) {
      layout = [data];
    }
    // detect NetFront on PlayStation
    else if (/\bPlayStation\b(?! Vita\b)/i.test(name) && layout == 'WebKit') {
      layout = ['NetFront'];
    }
    // detect Windows Phone 7 desktop mode
    if (name == 'IE' && (data = (/; *(?:XBLWP|ZuneWP)(\d+)/i.exec(ua) || 0)[1])) {
      name += ' Mobile';
      os = 'Windows Phone ' + (/\+$/.test(data) ? data : data + '.x');
      description.unshift('desktop mode');
    }
    // detect Windows Phone 8+ desktop mode
    else if (/\bWPDesktop\b/i.test(ua)) {
      name = 'IE Mobile';
      os = 'Windows Phone 8+';
      description.unshift('desktop mode');
      version || (version = (/\brv:([\d.]+)/.exec(ua) || 0)[1]);
    }
    // detect IE 11 and above
    else if (name != 'IE' && layout == 'Trident' && (data = /\brv:([\d.]+)/.exec(ua))) {
      if (!/\bWPDesktop\b/i.test(ua)) {
        if (name) {
          description.push('identifying as ' + name + (version ? ' ' + version : ''));
        }
        name = 'IE';
      }
      version = data[1];
    }
    // detect IE Tech Preview
    else if ((name == 'Chrome' || name != 'IE') && (data = /\bEdge\/([\d.]+)/.exec(ua))) {
      name = 'IE';
      version = data[1];
      layout = ['Trident'];
      description.unshift('platform preview');
    }
    // leverage environment features
    if (useFeatures) {
      // detect server-side environments
      // Rhino has a global function while others have a global object
      if (isHostType(context, 'global')) {
        if (java) {
          data = java.lang.System;
          arch = data.getProperty('os.arch');
          os = os || data.getProperty('os.name') + ' ' + data.getProperty('os.version');
        }
        if (isModuleScope && isHostType(context, 'system') && (data = [context.system])[0]) {
          os || (os = data[0].os || null);
          try {
            data[1] = context.require('ringo/engine').version;
            version = data[1].join('.');
            name = 'RingoJS';
          } catch(e) {
            if (data[0].global.system == context.system) {
              name = 'Narwhal';
            }
          }
        }
        else if (typeof context.process == 'object' && (data = context.process)) {
          name = 'Node.js';
          arch = data.arch;
          os = data.platform;
          version = /[\d.]+/.exec(data.version)[0];
        }
        else if (rhino) {
          name = 'Rhino';
        }
      }
      // detect Adobe AIR
      else if (getClassOf((data = context.runtime)) == airRuntimeClass) {
        name = 'Adobe AIR';
        os = data.flash.system.Capabilities.os;
      }
      // detect PhantomJS
      else if (getClassOf((data = context.phantom)) == phantomClass) {
        name = 'PhantomJS';
        version = (data = data.version || null) && (data.major + '.' + data.minor + '.' + data.patch);
      }
      // detect IE compatibility modes
      else if (typeof doc.documentMode == 'number' && (data = /\bTrident\/(\d+)/i.exec(ua))) {
        // we're in compatibility mode when the Trident version + 4 doesn't
        // equal the document mode
        version = [version, doc.documentMode];
        if ((data = +data[1] + 4) != version[1]) {
          description.push('IE ' + version[1] + ' mode');
          layout && (layout[1] = '');
          version[1] = data;
        }
        version = name == 'IE' ? String(version[1].toFixed(1)) : version[0];
      }
      os = os && format(os);
    }
    // detect prerelease phases
    if (version && (data =
          /(?:[ab]|dp|pre|[ab]\d+pre)(?:\d+\+?)?$/i.exec(version) ||
          /(?:alpha|beta)(?: ?\d)?/i.exec(ua + ';' + (useFeatures && nav.appMinorVersion)) ||
          /\bMinefield\b/i.test(ua) && 'a'
        )) {
      prerelease = /b/i.test(data) ? 'beta' : 'alpha';
      version = version.replace(RegExp(data + '\\+?$'), '') +
        (prerelease == 'beta' ? beta : alpha) + (/\d+\+?/.exec(data) || '');
    }
    // detect Firefox Mobile
    if (name == 'Fennec' || name == 'Firefox' && /\b(?:Android|Firefox OS)\b/.test(os)) {
      name = 'Firefox Mobile';
    }
    // obscure Maxthon's unreliable version
    else if (name == 'Maxthon' && version) {
      version = version.replace(/\.[\d.]+/, '.x');
    }
    // detect Silk desktop/accelerated modes
    else if (name == 'Silk') {
      if (!/\bMobi/i.test(ua)) {
        os = 'Android';
        description.unshift('desktop mode');
      }
      if (/Accelerated *= *true/i.test(ua)) {
        description.unshift('accelerated');
      }
    }
    // detect Xbox 360 and Xbox One
    else if (/\bXbox\b/i.test(product)) {
      os = null;
      if (product == 'Xbox 360' && /\bIEMobile\b/.test(ua)) {
        description.unshift('mobile mode');
      }
    }
    // add mobile postfix
    else if ((/^(?:Chrome|IE|Opera)$/.test(name) || name && !product && !/Browser|Mobi/.test(name)) &&
        (os == 'Windows CE' || /Mobi/i.test(ua))) {
      name += ' Mobile';
    }
    // detect IE platform preview
    else if (name == 'IE' && useFeatures && context.external === null) {
      description.unshift('platform preview');
    }
    // detect BlackBerry OS version
    // http://docs.blackberry.com/en/developers/deliverables/18169/HTTP_headers_sent_by_BB_Browser_1234911_11.jsp
    else if ((/\bBlackBerry\b/.test(product) || /\bBB10\b/.test(ua)) && (data =
          (RegExp(product.replace(/ +/g, ' *') + '/([.\\d]+)', 'i').exec(ua) || 0)[1] ||
          version
        )) {
      data = [data, /BB10/.test(ua)];
      os = (data[1] ? (product = null, manufacturer = 'BlackBerry') : 'Device Software') + ' ' + data[0];
      version = null;
    }
    // detect Opera identifying/masking itself as another browser
    // http://www.opera.com/support/kb/view/843/
    else if (this != forOwn && (
          product != 'Wii' && (
            (useFeatures && opera) ||
            (/Opera/.test(name) && /\b(?:MSIE|Firefox)\b/i.test(ua)) ||
            (name == 'Firefox' && /\bOS X (?:\d+\.){2,}/.test(os)) ||
            (name == 'IE' && (
              (os && !/^Win/.test(os) && version > 5.5) ||
              /\bWindows XP\b/.test(os) && version > 8 ||
              version == 8 && !/\bTrident\b/.test(ua)
            ))
          )
        ) && !reOpera.test((data = parse.call(forOwn, ua.replace(reOpera, '') + ';'))) && data.name) {

      // when "indentifying", the UA contains both Opera and the other browser's name
      data = 'ing as ' + data.name + ((data = data.version) ? ' ' + data : '');
      if (reOpera.test(name)) {
        if (/\bIE\b/.test(data) && os == 'Mac OS') {
          os = null;
        }
        data = 'identify' + data;
      }
      // when "masking", the UA contains only the other browser's name
      else {
        data = 'mask' + data;
        if (operaClass) {
          name = format(operaClass.replace(/([a-z])([A-Z])/g, '$1 $2'));
        } else {
          name = 'Opera';
        }
        if (/\bIE\b/.test(data)) {
          os = null;
        }
        if (!useFeatures) {
          version = null;
        }
      }
      layout = ['Presto'];
      description.push(data);
    }
    // detect WebKit Nightly and approximate Chrome/Safari versions
    if ((data = (/\bAppleWebKit\/([\d.]+\+?)/i.exec(ua) || 0)[1])) {
      // correct build for numeric comparison
      // (e.g. "532.5" becomes "532.05")
      data = [parseFloat(data.replace(/\.(\d)$/, '.0$1')), data];
      // nightly builds are postfixed with a `+`
      if (name == 'Safari' && data[1].slice(-1) == '+') {
        name = 'WebKit Nightly';
        prerelease = 'alpha';
        version = data[1].slice(0, -1);
      }
      // clear incorrect browser versions
      else if (version == data[1] ||
          version == (data[2] = (/\bSafari\/([\d.]+\+?)/i.exec(ua) || 0)[1])) {
        version = null;
      }
      // use the full Chrome version when available
      data[1] = (/\bChrome\/([\d.]+)/i.exec(ua) || 0)[1];
      // detect Blink layout engine
      if (data[0] == 537.36 && data[2] == 537.36 && parseFloat(data[1]) >= 28 && name != 'IE') {
        layout = ['Blink'];
      }
      // detect JavaScriptCore
      // http://stackoverflow.com/questions/6768474/how-can-i-detect-which-javascript-engine-v8-or-jsc-is-used-at-runtime-in-androi
      if (!useFeatures || (!likeChrome && !data[1])) {
        layout && (layout[1] = 'like Safari');
        data = (data = data[0], data < 400 ? 1 : data < 500 ? 2 : data < 526 ? 3 : data < 533 ? 4 : data < 534 ? '4+' : data < 535 ? 5 : data < 537 ? 6 : data < 538 ? 7 : data < 601 ? 8 : '8');
      } else {
        layout && (layout[1] = 'like Chrome');
        data = data[1] || (data = data[0], data < 530 ? 1 : data < 532 ? 2 : data < 532.05 ? 3 : data < 533 ? 4 : data < 534.03 ? 5 : data < 534.07 ? 6 : data < 534.10 ? 7 : data < 534.13 ? 8 : data < 534.16 ? 9 : data < 534.24 ? 10 : data < 534.30 ? 11 : data < 535.01 ? 12 : data < 535.02 ? '13+' : data < 535.07 ? 15 : data < 535.11 ? 16 : data < 535.19 ? 17 : data < 536.05 ? 18 : data < 536.10 ? 19 : data < 537.01 ? 20 : data < 537.11 ? '21+' : data < 537.13 ? 23 : data < 537.18 ? 24 : data < 537.24 ? 25 : data < 537.36 ? 26 : layout != 'Blink' ? '27' : '28');
      }
      // add the postfix of ".x" or "+" for approximate versions
      layout && (layout[1] += ' ' + (data += typeof data == 'number' ? '.x' : /[.+]/.test(data) ? '' : '+'));
      // obscure version for some Safari 1-2 releases
      if (name == 'Safari' && (!version || parseInt(version) > 45)) {
        version = data;
      }
    }
    // detect Opera desktop modes
    if (name == 'Opera' &&  (data = /\bzbov|zvav$/.exec(os))) {
      name += ' ';
      description.unshift('desktop mode');
      if (data == 'zvav') {
        name += 'Mini';
        version = null;
      } else {
        name += 'Mobile';
      }
      os = os.replace(RegExp(' *' + data + '$'), '');
    }
    // detect Chrome desktop mode
    else if (name == 'Safari' && /\bChrome\b/.exec(layout && layout[1])) {
      description.unshift('desktop mode');
      name = 'Chrome Mobile';
      version = null;

      if (/\bOS X\b/.test(os)) {
        manufacturer = 'Apple';
        os = 'iOS 4.3+';
      } else {
        os = null;
      }
    }
    // strip incorrect OS versions
    if (version && version.indexOf((data = /[\d.]+$/.exec(os))) == 0 &&
        ua.indexOf('/' + data + '-') > -1) {
      os = trim(os.replace(data, ''));
    }
    // add layout engine
    if (layout && !/\b(?:Avant|Nook)\b/.test(name) && (
        /Browser|Lunascape|Maxthon/.test(name) ||
        /^(?:Adobe|Arora|Breach|Midori|Opera|Phantom|Rekonq|Rock|Sleipnir|Web)/.test(name) && layout[1])) {
      // don't add layout details to description if they are falsey
      (data = layout[layout.length - 1]) && description.push(data);
    }
    // combine contextual information
    if (description.length) {
      description = ['(' + description.join('; ') + ')'];
    }
    // append manufacturer
    if (manufacturer && product && product.indexOf(manufacturer) < 0) {
      description.push('on ' + manufacturer);
    }
    // append product
    if (product) {
      description.push((/^on /.test(description[description.length -1]) ? '' : 'on ') + product);
    }
    // parse OS into an object
    if (os) {
      data = / ([\d.+]+)$/.exec(os);
      isSpecialCasedOS = data && os.charAt(os.length - data[0].length - 1) == '/';
      os = {
        'architecture': 32,
        'family': (data && !isSpecialCasedOS) ? os.replace(data[0], '') : os,
        'version': data ? data[1] : null,
        'toString': function() {
          var version = this.version;
          return this.family + ((version && !isSpecialCasedOS) ? ' ' + version : '') + (this.architecture == 64 ? ' 64-bit' : '');
        }
      };
    }
    // add browser/OS architecture
    if ((data = /\b(?:AMD|IA|Win|WOW|x86_|x)64\b/i.exec(arch)) && !/\bi686\b/i.test(arch)) {
      if (os) {
        os.architecture = 64;
        os.family = os.family.replace(RegExp(' *' + data), '');
      }
      if (
          name && (/\bWOW64\b/i.test(ua) ||
          (useFeatures && /\w(?:86|32)$/.test(nav.cpuClass || nav.platform) && !/\bWin64; x64\b/i.test(ua)))
      ) {
        description.unshift('32-bit');
      }
    }

    ua || (ua = null);

    /*------------------------------------------------------------------------*/

    /**
     * The platform object.
     *
     * @name platform
     * @type Object
     */
    var platform = {};

    /**
     * The platform description.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.description = ua;

    /**
     * The name of the browser's layout engine.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.layout = layout && layout[0];

    /**
     * The name of the product's manufacturer.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.manufacturer = manufacturer;

    /**
     * The name of the browser/environment.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.name = name;

    /**
     * The alpha/beta release indicator.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.prerelease = prerelease;

    /**
     * The name of the product hosting the browser.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.product = product;

    /**
     * The browser's user agent string.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.ua = ua;

    /**
     * The browser/environment version.
     *
     * @memberOf platform
     * @type string|null
     */
    platform.version = name && version;

    /**
     * The name of the operating system.
     *
     * @memberOf platform
     * @type Object
     */
    platform.os = os || {

      /**
       * The CPU architecture the OS is built for.
       *
       * @memberOf platform.os
       * @type number|null
       */
      'architecture': null,

      /**
       * The family of the OS.
       *
       * Common values include:
       * "Windows", "Windows Server 2008 R2 / 7", "Windows Server 2008 / Vista",
       * "Windows XP", "OS X", "Ubuntu", "Debian", "Fedora", "Red Hat", "SuSE",
       * "Android", "iOS" and "Windows Phone"
       *
       * @memberOf platform.os
       * @type string|null
       */
      'family': null,

      /**
       * The version of the OS.
       *
       * @memberOf platform.os
       * @type string|null
       */
      'version': null,

      /**
       * Returns the OS string.
       *
       * @memberOf platform.os
       * @returns {string} The OS string.
       */
      'toString': function() { return 'null'; }
    };

    platform.parse = parse;
    platform.toString = toStringPlatform;

    if (platform.version) {
      description.unshift(version);
    }
    if (platform.name) {
      description.unshift(name);
    }
    if (os && name && !(os == String(os).split(' ')[0] && (os == name.split(' ')[0] || product))) {
      description.push(product ? '(' + os + ')' : 'on ' + os);
    }
    if (description.length) {
      platform.description = description.join(' ');
    }
    return platform;
  }

  /*--------------------------------------------------------------------------*/

  // export platform
  // some AMD build optimizers, like r.js, check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // define as an anonymous module so, through path mapping, it can be aliased
    define(function() {
      return parse();
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && freeModule) {
    // in Narwhal, Node.js, Rhino -require, or RingoJS
    forOwn(parse(), function(value, key) {
      freeExports[key] = value;
    });
  }
  // in a browser or Rhino
  else {
    root.platform = parse();
  }
}.call(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],91:[function(require,module,exports){
"use strict";

/* Copyright 2013 Chris Wilson

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/* 

This monkeypatch library is intended to be included in projects that are
written to the proper AudioContext spec (instead of webkitAudioContext), 
and that use the new naming and proper bits of the Web Audio API (e.g. 
using BufferSourceNode.start() instead of BufferSourceNode.noteOn()), but may
have to run on systems that only support the deprecated bits.

This library should be harmless to include if the browser supports 
unprefixed "AudioContext", and/or if it supports the new names.  

The patches this library handles:
if window.AudioContext is unsupported, it will be aliased to webkitAudioContext().
if AudioBufferSourceNode.start() is unimplemented, it will be routed to noteOn() or
noteGrainOn(), depending on parameters.

The following aliases only take effect if the new names are not already in place:

AudioBufferSourceNode.stop() is aliased to noteOff()
AudioContext.createGain() is aliased to createGainNode()
AudioContext.createDelay() is aliased to createDelayNode()
AudioContext.createScriptProcessor() is aliased to createJavaScriptNode()
AudioContext.createPeriodicWave() is aliased to createWaveTable()
OscillatorNode.start() is aliased to noteOn()
OscillatorNode.stop() is aliased to noteOff()
OscillatorNode.setPeriodicWave() is aliased to setWaveTable()
AudioParam.setTargetAtTime() is aliased to setTargetValueAtTime()

This library does NOT patch the enumerated type changes, as it is 
recommended in the specification that implementations support both integer
and string types for AudioPannerNode.panningModel, AudioPannerNode.distanceModel 
BiquadFilterNode.type and OscillatorNode.type.

*/
(function (global, exports, perf) {
  "use strict";

  function fixSetTarget(param) {
    if (!param) {
      // if NYI, just return
      return;
    }if (!param.setTargetAtTime) param.setTargetAtTime = param.setTargetValueAtTime;
  }

  if (window.hasOwnProperty("webkitAudioContext") && !window.hasOwnProperty("AudioContext")) {
    window.AudioContext = webkitAudioContext;

    if (!AudioContext.prototype.hasOwnProperty("createGain")) AudioContext.prototype.createGain = AudioContext.prototype.createGainNode;
    if (!AudioContext.prototype.hasOwnProperty("createDelay")) AudioContext.prototype.createDelay = AudioContext.prototype.createDelayNode;
    if (!AudioContext.prototype.hasOwnProperty("createScriptProcessor")) AudioContext.prototype.createScriptProcessor = AudioContext.prototype.createJavaScriptNode;
    if (!AudioContext.prototype.hasOwnProperty("createPeriodicWave")) AudioContext.prototype.createPeriodicWave = AudioContext.prototype.createWaveTable;

    AudioContext.prototype.internal_createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      var node = this.internal_createGain();
      fixSetTarget(node.gain);
      return node;
    };

    AudioContext.prototype.internal_createDelay = AudioContext.prototype.createDelay;
    AudioContext.prototype.createDelay = function (maxDelayTime) {
      var node = maxDelayTime ? this.internal_createDelay(maxDelayTime) : this.internal_createDelay();
      fixSetTarget(node.delayTime);
      return node;
    };

    AudioContext.prototype.internal_createBufferSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      var node = this.internal_createBufferSource();
      if (!node.start) {
        node.start = function (when, offset, duration) {
          if (offset || duration) this.noteGrainOn(when, offset, duration);else this.noteOn(when);
        };
      }
      if (!node.stop) node.stop = node.noteOff;
      fixSetTarget(node.playbackRate);
      return node;
    };

    AudioContext.prototype.internal_createDynamicsCompressor = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function () {
      var node = this.internal_createDynamicsCompressor();
      fixSetTarget(node.threshold);
      fixSetTarget(node.knee);
      fixSetTarget(node.ratio);
      fixSetTarget(node.reduction);
      fixSetTarget(node.attack);
      fixSetTarget(node.release);
      return node;
    };

    AudioContext.prototype.internal_createBiquadFilter = AudioContext.prototype.createBiquadFilter;
    AudioContext.prototype.createBiquadFilter = function () {
      var node = this.internal_createBiquadFilter();
      fixSetTarget(node.frequency);
      fixSetTarget(node.detune);
      fixSetTarget(node.Q);
      fixSetTarget(node.gain);
      return node;
    };

    if (AudioContext.prototype.hasOwnProperty("createOscillator")) {
      AudioContext.prototype.internal_createOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        var node = this.internal_createOscillator();
        if (!node.start) node.start = node.noteOn;
        if (!node.stop) node.stop = node.noteOff;
        if (!node.setPeriodicWave) node.setPeriodicWave = node.setWaveTable;
        fixSetTarget(node.frequency);
        fixSetTarget(node.detune);
        return node;
      };
    }
  }
})(window);

},{}],92:[function(require,module,exports){
"use strict";

// monkeypatch old webAudioAPI
require("./ac-monkeypatch");

// exposes a single instance
var audioContext;

if (window.AudioContext) audioContext = new window.AudioContext();

module.exports = audioContext;

},{"./ac-monkeypatch":91}],93:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var TimeEngine = require("./time-engine");
var defaultAudioContext = require("./audio-context");

/**
 * @class AudioTimeEngine
 */

var AudioTimeEngine = (function (_TimeEngine) {
  function AudioTimeEngine() {
    var audioContext = arguments[0] === undefined ? defaultAudioContext : arguments[0];

    _classCallCheck(this, AudioTimeEngine);

    _get(_core.Object.getPrototypeOf(AudioTimeEngine.prototype), "constructor", this).call(this);

    this.audioContext = audioContext;
    this.outputNode = null;
  }

  _inherits(AudioTimeEngine, _TimeEngine);

  _createClass(AudioTimeEngine, {
    connect: {
      value: function connect(target) {
        this.outputNode.connect(target);
        return this;
      }
    },
    disconnect: {
      value: function disconnect(connection) {
        this.outputNode.disconnect(connection);
        return this;
      }
    }
  });

  return AudioTimeEngine;
})(TimeEngine);

module.exports = AudioTimeEngine;

},{"./audio-context":92,"./time-engine":94,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],94:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

/**
 * @class TimeEngine
 */

var TimeEngine = (function () {
  function TimeEngine() {
    _classCallCheck(this, TimeEngine);

    this.master = null;
    this.outputNode = null;
  }

  _createClass(TimeEngine, {
    currentTime: {
      get: function () {
        if (this.master) return this.master.currentTime;

        return undefined;
      }
    },
    currentPosition: {
      get: function () {
        var master = this.master;

        if (master && master.currentPosition !== undefined) return master.currentPosition;

        return undefined;
      }
    },
    implementsScheduled: {

      /**
       * Scheduled interface
       *   - advanceTime(time), called to generate next event at given time, returns next time
       */

      value: function implementsScheduled() {
        return this.advanceTime && this.advanceTime instanceof Function;
      }
    },
    resetTime: {
      value: function resetTime() {
        var time = arguments[0] === undefined ? undefined : arguments[0];

        if (this.master) this.master.resetEngineTime(this, time);
      }
    },
    implementsTransported: {

      /**
       * Transported interface
       *   - syncPosition(time, position, speed), called to reposition TimeEngine, returns next position
       *   - advancePosition(time, position, speed), called to generate next event at given time and position, returns next position
       */

      value: function implementsTransported() {
        return this.syncPosition && this.syncPosition instanceof Function && this.advancePosition && this.advancePosition instanceof Function;
      }
    },
    resetPosition: {
      value: function resetPosition() {
        var position = arguments[0] === undefined ? undefined : arguments[0];

        if (this.master) this.master.resetEnginePosition(this, position);
      }
    },
    implementsSpeedControlled: {

      /**
       * Speed-controlled interface
       *   - syncSpeed(time, position, speed, ), called to
       */

      value: function implementsSpeedControlled() {
        return this.syncSpeed && this.syncSpeed instanceof Function;
      }
    }
  });

  return TimeEngine;
})();

module.exports = TimeEngine;

},{"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108}],95:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var AudioTimeEngine = require("../core/audio-time-engine");

function optOrDef(opt, def) {
  if (opt !== undefined) {
    return opt;
  }return def;
}

/**
 * @class GranularEngine
 */

var GranularEngine = (function (_AudioTimeEngine) {
  /**
   * @constructor
   * @param {AudioBuffer} buffer initial audio buffer for granular synthesis
   *
   * The engine implements the "scheduled" interface.
   * The grain position (grain onset or center time in the audio buffer) is optionally
   * determined by the engine's currentPosition attribute.
   */

  function GranularEngine() {
    var options = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, GranularEngine);

    _get(_core.Object.getPrototypeOf(GranularEngine.prototype), "constructor", this).call(this, options.audioContext);

    /**
     * Audio buffer
     * @type {AudioBuffer}
     */
    this.buffer = optOrDef(options.buffer, null);

    /**
     * Absolute grain period in sec
     * @type {Number}
     */
    this.periodAbs = optOrDef(options.periodAbs, 0.01);

    /**
     * Grain period relative to absolute duration
     * @type {Number}
     */
    this.periodRel = optOrDef(options.periodRel, 0);

    /**
     * Amout of random grain period variation relative to grain period
     * @type {Number}
     */
    this.periodVar = optOrDef(options.periodVar, 0);

    /**
     * Grain position (onset time in audio buffer) in sec
     * @type {Number}
     */
    this.position = optOrDef(options.position, 0);

    /**
     * Amout of random grain position variation in sec
     * @type {Number}
     */
    this.positionVar = optOrDef(options.positionVar, 0.003);

    /**
     * Absolute grain duration in sec
     * @type {Number}
     */
    this.durationAbs = optOrDef(options.durationAbs, 0.1); // absolute grain duration

    /**
     * Grain duration relative to grain period (overlap)
     * @type {Number}
     */
    this.durationRel = optOrDef(options.durationRel, 0);

    /**
     * Absolute attack time in sec
     * @type {Number}
     */
    this.attackAbs = optOrDef(options.attackAbs, 0);

    /**
     * Attack time relative to grain duration
     * @type {Number}
     */
    this.attackRel = optOrDef(options.attackRel, 0.5);

    /**
     * Shape of attack
     * @type {String} 'lin' for linear ramp, 'exp' for exponential
     */
    this.attackShape = optOrDef(options.attackShape, "lin");

    /**
     * Absolute release time in sec
     * @type {Number}
     */
    this.releaseAbs = optOrDef(options.releaseAbs, 0);

    /**
     * Release time relative to grain duration
     * @type {Number}
     */
    this.releaseRel = optOrDef(options.releaseRel, 0.5);

    /**
     * Shape of release
     * @type {String} 'lin' for linear ramp, 'exp' for exponential
     */
    this.releaseShape = optOrDef(options.releaseShape, "lin");

    /**
     * Offset (start/end value) for exponential attack/release
     * @type {Number} offset
     */
    this.expRampOffset = optOrDef(options.expRampOffset, 0.0001);

    /**
     * Grain resampling in cent
     * @type {Number}
     */
    this.resampling = optOrDef(options.resampling, 0);

    /**
     * Amout of random resampling variation in cent
     * @type {Number}
     */
    this.resamplingVar = optOrDef(options.resamplingVar, 0);

    /**
     * Linear gain factor
     * @type {Number}
     */
    this.gain = optOrDef(options.gain, 1);

    /**
     * Whether the grain position refers to the center of the grain (or the beginning)
     * @type {Bool}
     */
    this.centered = optOrDef(options.centered, true);

    /**
     * Whether the audio buffer and grain position are considered as cyclic
     * @type {Bool}
     */
    this.cyclic = optOrDef(options.cyclic, false);

    /**
     * Portion at the end of the audio buffer that has been copied from the beginning to assure cyclic behavior
     * @type {Number}
     */
    this.wrapAroundExtension = optOrDef(options.wrapAroundExtension, 0);

    this.outputNode = this.audioContext.createGain();
  }

  _inherits(GranularEngine, _AudioTimeEngine);

  _createClass(GranularEngine, {
    bufferDuration: {

      /**
       * Get buffer duration (excluding wrapAroundExtension)
       * @return {Number} current buffer duration
       */

      get: function () {
        if (this.buffer) {
          var bufferDuration = this.buffer.duration;

          if (this.wrapAroundExtension) bufferDuration -= this.wrapAroundExtension;

          return bufferDuration;
        }

        return 0;
      }
    },
    currentPosition: {

      // TimeEngine attribute

      get: function () {
        var master = this.master;

        if (master && master.currentPosition !== undefined) return master.currentPosition;

        return this.position;
      }
    },
    advanceTime: {

      // TimeEngine method (scheduled interface)

      value: function advanceTime(time) {
        time = Math.max(time, this.audioContext.currentTime);
        return time + this.trigger(time);
      }
    },
    trigger: {

      /**
       * Trigger a grain
       * @param {Number} time grain synthesis audio time
       * @return {Number} period to next grain
       *
       * This function can be called at any time (whether the engine is scheduled or not)
       * to generate a single grain according to the current grain parameters.
       */

      value: function trigger(time) {
        var audioContext = this.audioContext;
        var grainTime = time || audioContext.currentTime;
        var grainPeriod = this.periodAbs;
        var grainPosition = this.currentPosition;
        var grainDuration = this.durationAbs;

        if (this.buffer) {
          var resamplingRate = 1;

          // calculate resampling
          if (this.resampling !== 0 || this.resamplingVar > 0) {
            var randomResampling = (Math.random() - 0.5) * 2 * this.resamplingVar;
            resamplingRate = Math.pow(2, (this.resampling + randomResampling) / 1200);
          }

          grainPeriod += this.periodRel * grainDuration;
          grainDuration += this.durationRel * grainPeriod;

          // grain period randon variation
          if (this.periodVar > 0) grainPeriod += 2 * (Math.random() - 0.5) * this.periodVar * grainPeriod;

          // center grain
          if (this.centered) grainPosition -= 0.5 * grainDuration;

          // randomize grain position
          if (this.positionVar > 0) grainPosition += (2 * Math.random() - 1) * this.positionVar;

          var bufferDuration = this.bufferDuration;

          // wrap or clip grain position and duration into buffer duration
          if (grainPosition < 0 || grainPosition >= bufferDuration) {
            if (this.cyclic) {
              var cycles = grainPosition / bufferDuration;
              grainPosition = (cycles - Math.floor(cycles)) * bufferDuration;

              if (grainPosition + grainDuration > this.buffer.duration) grainDuration = this.buffer.duration - grainPosition;
            } else {
              if (grainPosition < 0) {
                grainTime -= grainPosition;
                grainDuration += grainPosition;
                grainPosition = 0;
              }

              if (grainPosition + grainDuration > bufferDuration) grainDuration = bufferDuration - grainPosition;
            }
          }

          // make grain
          if (this.gain > 0 && grainDuration >= 0.001) {
            // make grain envelope
            var envelope = audioContext.createGain();
            var attack = this.attackAbs + this.attackRel * grainDuration;
            var release = this.releaseAbs + this.releaseRel * grainDuration;

            if (attack + release > grainDuration) {
              var factor = grainDuration / (attack + release);
              attack *= factor;
              release *= factor;
            }

            var attackEndTime = grainTime + attack;
            var grainEndTime = grainTime + grainDuration;
            var releaseStartTime = grainEndTime - release;

            envelope.gain.value = 0;

            if (this.attackShape === "lin") {
              envelope.gain.setValueAtTime(0, grainTime);
              envelope.gain.linearRampToValueAtTime(this.gain, attackEndTime);
            } else {
              envelope.gain.setValueAtTime(this.expRampOffset, grainTime);
              envelope.gain.exponentialRampToValueAtTime(this.gain, attackEndTime);
            }

            if (releaseStartTime > attackEndTime) envelope.gain.setValueAtTime(this.gain, releaseStartTime);

            if (this.releaseShape === "lin") {
              envelope.gain.linearRampToValueAtTime(0, grainEndTime);
            } else {
              envelope.gain.exponentialRampToValueAtTime(this.expRampOffset, grainEndTime);
            }

            envelope.connect(this.outputNode);

            // make source
            var source = audioContext.createBufferSource();

            source.buffer = this.buffer;
            source.playbackRate.value = resamplingRate;
            source.connect(envelope);

            source.start(grainTime, grainPosition);
            source.stop(grainTime + grainDuration / resamplingRate);
          }
        }

        return grainPeriod;
      }
    }
  });

  return GranularEngine;
})(AudioTimeEngine);

module.exports = GranularEngine;

},{"../core/audio-time-engine":93,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],96:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var AudioTimeEngine = require("../core/audio-time-engine");

function optOrDef(opt, def) {
  if (opt !== undefined) {
    return opt;
  }return def;
}

var Metronome = (function (_AudioTimeEngine) {
  function Metronome() {
    var options = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Metronome);

    _get(_core.Object.getPrototypeOf(Metronome.prototype), "constructor", this).call(this, options.audioContext);

    /**
     * Metronome period
     * @type {Number}
     */
    this.__period = optOrDef(options.period, 1);

    /**
     * Metronome click frequency
     * @type {Number}
     */
    this.clickFreq = optOrDef(options.clickFreq, 600);

    /**
     * Metronome click attack time
     * @type {Number}
     */
    this.clickAttack = optOrDef(options.clickAttack, 0.002);

    /**
     * Metronome click release time
     * @type {Number}
     */
    this.clickRelease = optOrDef(options.clickRelease, 0.098);

    this.__lastTime = 0;
    this.__phase = 0;

    this.__gainNode = this.audioContext.createGain();
    this.__gainNode.gain.value = optOrDef(options.gain, 1);

    this.outputNode = this.__gainNode;
  }

  _inherits(Metronome, _AudioTimeEngine);

  _createClass(Metronome, {
    advanceTime: {

      // TimeEngine method (scheduled interface)

      value: function advanceTime(time) {
        this.trigger(time);
        this.__lastTime = time;
        return time + this.__period;
      }
    },
    syncPosition: {

      // TimeEngine method (transported interface)

      value: function syncPosition(time, position, speed) {
        if (this.__period > 0) {
          var nextPosition = (Math.floor(position / this.__period) + this.__phase) * this.__period;

          if (speed > 0 && nextPosition < position) nextPosition += this.__period;else if (speed < 0 && nextPosition > position) nextPosition -= this.__period;

          return nextPosition;
        }

        return Infinity;
      }
    },
    advancePosition: {

      // TimeEngine method (transported interface)

      value: function advancePosition(time, position, speed) {
        this.trigger(time);

        if (speed < 0) {
          return position - this.__period;
        }return position + this.__period;
      }
    },
    trigger: {

      /**
       * Trigger metronome click
       * @param {Number} time metronome click synthesis audio time
       */

      value: function trigger(time) {
        var audioContext = this.audioContext;
        var clickAttack = this.clickAttack;
        var clickRelease = this.clickRelease;

        var env = audioContext.createGain();
        env.gain.value = 0;
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(1, time + clickAttack);
        env.gain.exponentialRampToValueAtTime(1e-7, time + clickAttack + clickRelease);
        env.gain.setValueAtTime(0, time);
        env.connect(this.outputNode);

        var osc = audioContext.createOscillator();
        osc.frequency.value = this.clickFreq;
        osc.start(time);
        osc.stop(time + clickAttack + clickRelease);
        osc.connect(env);
      }
    },
    gain: {

      /**
       * Set gain
       * @param {Number} value linear gain factor
       */

      set: function (value) {
        this.__gainNode.gain.value = value;
      },

      /**
       * Get gain
       * @return {Number} current gain
       */
      get: function () {
        return this.__gainNode.gain.value;
      }
    },
    period: {

      /**
       * Set period parameter
       * @param {Number} period metronome period
       */

      set: function (period) {
        this.__period = period;

        var master = this.master;

        if (master) {
          if (master.resetEngineTime) master.resetEngineTime(this, this.__lastTime + period);else if (master.resetEnginePosition) master.resetEnginePosition(this);
        }
      },

      /**
       * Get period parameter
       * @return {Number} value of period parameter
       */
      get: function () {
        return this.__period;
      }
    },
    phase: {

      /**
       * Set phase parameter (available only when 'transported')
       * @param {Number} phase metronome phase [0, 1[
       */

      set: function (phase) {
        this.__phase = phase - Math.floor(phase);

        var master = this.master;

        if (master && master.resetEnginePosition !== undefined) master.resetEnginePosition(this);
      },

      /**
       * Get phase parameter
       * @return {Number} value of phase parameter
       */
      get: function () {
        return this.__phase;
      }
    }
  });

  return Metronome;
})(AudioTimeEngine);

module.exports = Metronome;

},{"../core/audio-time-engine":93,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],97:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var AudioTimeEngine = require("../core/audio-time-engine");

function optOrDef(opt, def) {
  if (opt !== undefined) {
    return opt;
  }return def;
}

var PlayerEngine = (function (_AudioTimeEngine) {
  function PlayerEngine() {
    var options = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, PlayerEngine);

    _get(_core.Object.getPrototypeOf(PlayerEngine.prototype), "constructor", this).call(this, options.audioContext);

    this.transport = null; // set when added to transporter

    /**
     * Audio buffer
     * @type {AudioBuffer}
     */
    this.buffer = optOrDef(options.buffer, null);

    /**
     * Fade time for chaining segments (e.g. in start, stop, and seek)
     * @type {AudioBuffer}
     */
    this.fadeTime = optOrDef(options.fadeTime, 0.005);

    this.__time = 0;
    this.__position = 0;
    this.__speed = 0;

    this.__bufferSource = null;
    this.__envNode = null;

    this.__gainNode = this.audioContext.createGain();
    this.__gainNode.gain.value = optOrDef(options.gain, 1);

    this.__cyclic = optOrDef(options.cyclic, false);

    this.outputNode = this.__gainNode;
  }

  _inherits(PlayerEngine, _AudioTimeEngine);

  _createClass(PlayerEngine, {
    __start: {
      value: function __start(time, position, speed) {
        var audioContext = this.audioContext;

        if (this.buffer) {
          var bufferDuration = this.buffer.duration;

          if (this.__cyclic && (position < 0 || position >= bufferDuration)) {
            var phase = position / bufferDuration;
            position = (phase - Math.floor(phase)) * bufferDuration;
          }

          if (position >= 0 && position < bufferDuration && speed > 0) {
            this.__envNode = audioContext.createGain();
            this.__envNode.gain.setValueAtTime(0, time);
            this.__envNode.gain.linearRampToValueAtTime(1, time + this.fadeTime);
            this.__envNode.connect(this.__gainNode);

            this.__bufferSource = audioContext.createBufferSource();
            this.__bufferSource.buffer = this.buffer;
            this.__bufferSource.playbackRate.value = speed;
            this.__bufferSource.loop = this.__cyclic;
            this.__bufferSource.loopStart = 0;
            this.__bufferSource.loopEnd = bufferDuration;
            this.__bufferSource.start(time, position);
            this.__bufferSource.connect(this.__envNode);
          }
        }
      }
    },
    __halt: {
      value: function __halt(time) {
        if (this.__bufferSource) {
          this.__envNode.gain.cancelScheduledValues(time);
          this.__envNode.gain.setValueAtTime(this.__envNode.gain.value, time);
          this.__envNode.gain.linearRampToValueAtTime(0, time + this.fadeTime);
          this.__bufferSource.stop(time + this.fadeTime);

          this.__bufferSource = null;
          this.__envNode = null;
        }
      }
    },
    syncSpeed: {

      // TimeEngine method (speed-controlled interface)

      value: function syncSpeed(time, position, speed) {
        var seek = arguments[3] === undefined ? false : arguments[3];

        var lastSpeed = this.__speed;

        if (speed !== lastSpeed || seek) {
          if (seek || lastSpeed * speed < 0) {
            this.__halt(time);
            this.__start(time, position, speed);
          } else if (lastSpeed === 0 || seek) {
            this.__start(time, position, speed);
          } else if (speed === 0) {
            this.__halt(time);
          } else if (this.__bufferSource) {
            this.__bufferSource.playbackRate.setValueAtTime(speed, time);
          }

          this.__speed = speed;
        }
      }
    },
    cyclic: {

      /**
       * Set whether the audio buffer is considered as cyclic
       * @param {Bool} cyclic whether the audio buffer is considered as cyclic
       */

      set: function (cyclic) {
        if (cyclic !== this.__cyclic) {
          var time = this.currentTime;
          var position = this.currentosition;

          this.__halt(time);
          this.__cyclic = cyclic;

          if (this.__speed !== 0) this.__start(time, position, this.__speed);
        }
      },

      /**
       * Get whether the audio buffer is considered as cyclic
       * @return {Bool} whether the audio buffer is considered as cyclic
       */
      get: function () {
        return this.__cyclic;
      }
    },
    gain: {

      /**
       * Set gain
       * @param {Number} value linear gain factor
       */

      set: function (value) {
        var time = this.currentTime;
        this.__gainNode.cancelScheduledValues(time);
        this.__gainNode.setValueAtTime(this.__gainNode.gain.value, time);
        this.__gainNode.linearRampToValueAtTime(0, time + this.fadeTime);
      },

      /**
       * Get gain
       * @return {Number} current gain
       */
      get: function () {
        return this.__gainNode.gain.value;
      }
    },
    bufferDuration: {

      /**
       * Get buffer duration
       * @return {Number} current buffer duration
       */

      get: function () {
        if (this.buffer) return this.buffer.duration;

        return 0;
      }
    }
  });

  return PlayerEngine;
})(AudioTimeEngine);

module.exports = PlayerEngine;

},{"../core/audio-time-engine":93,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],98:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var AudioTimeEngine = require("../core/audio-time-engine");

function optOrDef(opt, def) {
  if (opt !== undefined) {
    return opt;
  }return def;
}

function getCurrentOrPreviousIndex(sortedArray, value) {
  var index = arguments[2] === undefined ? 0 : arguments[2];

  var size = sortedArray.length;

  if (size > 0) {
    var firstVal = sortedArray[0];
    var lastVal = sortedArray[size - 1];

    if (value < firstVal) index = -1;else if (value >= lastVal) index = size - 1;else {
      if (index < 0 || index >= size) index = Math.floor((size - 1) * (value - firstVal) / (lastVal - firstVal));

      while (sortedArray[index] > value) index--;

      while (sortedArray[index + 1] <= value) index++;
    }
  }

  return index;
}

function getCurrentOrNextIndex(sortedArray, value) {
  var index = arguments[2] === undefined ? 0 : arguments[2];

  var size = sortedArray.length;

  if (size > 0) {
    var firstVal = sortedArray[0];
    var lastVal = sortedArray[size - 1];

    if (value <= firstVal) index = 0;else if (value >= lastVal) index = size;else {
      if (index < 0 || index >= size) index = Math.floor((size - 1) * (value - firstVal) / (lastVal - firstVal));

      while (sortedArray[index] < value) index++;

      while (sortedArray[index + 1] >= value) index--;
    }
  }

  return index;
}

/**
 * @class SegmentEngine
 */

var SegmentEngine = (function (_AudioTimeEngine) {
  /**
   * @constructor
   * @param {AudioBuffer} buffer initial audio buffer for granular synthesis
   *
   * The engine implements the "scheduled" and "transported" interfaces.
   * When "scheduled", the engine  generates segments more or less periodically
   * (controlled by the periodAbs, periodRel, and perioVar attributes).
   * When "transported", the engine generates segments at the position of their onset time.
   */

  function SegmentEngine() {
    var options = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, SegmentEngine);

    _get(_core.Object.getPrototypeOf(SegmentEngine.prototype), "constructor", this).call(this, options.audioContext);

    /**
     * Audio buffer
     * @type {AudioBuffer}
     */
    this.buffer = optOrDef(options.buffer, null);

    /**
     * Absolute segment period in sec
     * @type {Number}
     */
    this.periodAbs = optOrDef(options.periodAbs, 0);

    /**
     * Segment period relative to inter-segment distance
     * @type {Number}
     */
    this.periodRel = optOrDef(options.periodRel, 1);

    /**
     * Amout of random segment period variation relative to segment period
     * @type {Number}
     */
    this.periodVar = optOrDef(options.periodVar, 0);

    /**
     * Array of segment positions (onset times in audio buffer) in sec
     * @type {Number}
     */
    this.positionArray = optOrDef(options.positionArray, [0]);

    /**
     * Amout of random segment position variation in sec
     * @type {Number}
     */
    this.positionVar = optOrDef(options.positionVar, 0);

    /**
     * Array of segment durations in sec
     * @type {Number}
     */
    this.durationArray = optOrDef(options.durationArray, [0]);

    /**
     * Absolute segment duration in sec
     * @type {Number}
     */
    this.durationAbs = optOrDef(options.durationAbs, 0);

    /**
     * Segment duration relative to given segment duration or inter-segment distance
     * @type {Number}
     */
    this.durationRel = optOrDef(options.durationRel, 1);

    /**
     * Array of segment offsets in sec
     * @type {Number}
     *
     * offset > 0: the segment's reference position is after the given segment position
     * offset < 0: the given segment position is the segment's reference position and the duration has to be corrected by the offset
     */
    this.offsetArray = optOrDef(options.offsetArray, [0]);

    /**
     * Absolute segment offset in sec
     * @type {Number}
     */
    this.offsetAbs = optOrDef(options.offsetAbs, -0.005);

    /**
     * Segment offset relative to segment duration
     * @type {Number}
     */
    this.offsetRel = optOrDef(options.offsetRel, 0);

    /**
     * Time by which all segments are delayed (especially to realize segment offsets)
     * @type {Number}
     */
    this.delay = optOrDef(options.delay, 0.005);

    /**
     * Absolute attack time in sec
     * @type {Number}
     */
    this.attackAbs = optOrDef(options.attackAbs, 0.005);

    /**
     * Attack time relative to segment duration
     * @type {Number}
     */
    this.attackRel = optOrDef(options.attackRel, 0);

    /**
     * Absolute release time in sec
     * @type {Number}
     */
    this.releaseAbs = optOrDef(options.releaseAbs, 0.005);

    /**
     * Release time relative to segment duration
     * @type {Number}
     */
    this.releaseRel = optOrDef(options.releaseRel, 0);

    /**
     * Segment resampling in cent
     * @type {Number}
     */
    this.resampling = optOrDef(options.resampling, 0);

    /**
     * Amout of random resampling variation in cent
     * @type {Number}
     */
    this.resamplingVar = optOrDef(options.resamplingVar, 0);

    /**
     * Linear gain factor
     * @type {Number}
     */
    this.gain = optOrDef(options.gain, 1);

    /**
     * Index of the segment to synthesize (i.e. of this.positionArray/durationArray/offsetArray)
     * @type {Number}
     */
    this.segmentIndex = optOrDef(options.segmentIndex, 0);

    /**
     * Whether the audio buffer and segment indices are considered as cyclic
     * @type {Bool}
     */
    this.cyclic = optOrDef(options.cyclic, false);
    this.__cyclicOffset = 0;

    /**
     * Portion at the end of the audio buffer that has been copied from the beginning to assure cyclic behavior
     * @type {Number}
     */
    this.wrapAroundExtension = optOrDef(options.wrapAroundExtension, 0);

    this.outputNode = this.audioContext.createGain();
  }

  _inherits(SegmentEngine, _AudioTimeEngine);

  _createClass(SegmentEngine, {
    bufferDuration: {

      /**
       * Get buffer duration (excluding wrapAroundExtension)
       * @return {Number} current buffer duration
       */

      get: function () {
        if (this.buffer) {
          var bufferDuration = this.buffer.duration;

          if (this.wrapAroundExtension) bufferDuration -= this.wrapAroundExtension;

          return bufferDuration;
        }

        return 0;
      }
    },
    advanceTime: {

      // TimeEngine method (transported interface)

      value: function advanceTime(time) {
        time = Math.max(time, this.audioContext.currentTime);
        return time + this.trigger(time);
      }
    },
    syncPosition: {

      // TimeEngine method (transported interface)

      value: function syncPosition(time, position, speed) {
        var index = this.segmentIndex;
        var cyclicOffset = 0;
        var bufferDuration = this.bufferDuration;

        if (this.cyclic) {
          var cycles = position / bufferDuration;

          cyclicOffset = Math.floor(cycles) * bufferDuration;
          position -= cyclicOffset;
        }

        if (speed > 0) {
          index = getCurrentOrNextIndex(this.positionArray, position);

          if (index >= this.positionArray.length) {
            index = 0;
            cyclicOffset += bufferDuration;

            if (!this.cyclic) {
              return Infinity;
            }
          }
        } else if (speed < 0) {
          index = getCurrentOrPreviousIndex(this.positionArray, position);

          if (index < 0) {
            index = this.positionArray.length - 1;
            cyclicOffset -= bufferDuration;

            if (!this.cyclic) {
              return -Infinity;
            }
          }
        } else {
          return Infinity;
        }

        this.segmentIndex = index;
        this.__cyclicOffset = cyclicOffset;

        return cyclicOffset + this.positionArray[index];
      }
    },
    advancePosition: {

      // TimeEngine method (transported interface)

      value: function advancePosition(time, position, speed) {
        var index = this.segmentIndex;
        var cyclicOffset = this.__cyclicOffset;

        this.trigger(time);

        if (speed > 0) {
          index++;

          if (index >= this.positionArray.length) {
            index = 0;
            cyclicOffset += this.bufferDuration;

            if (!this.cyclic) {
              return Infinity;
            }
          }
        } else {
          index--;

          if (index < 0) {
            index = this.positionArray.length - 1;
            cyclicOffset -= this.bufferDuration;

            if (!this.cyclic) {
              return -Infinity;
            }
          }
        }

        this.segmentIndex = index;
        this.__cyclicOffset = cyclicOffset;

        return cyclicOffset + this.positionArray[index];
      }
    },
    trigger: {

      /**
       * Trigger a segment
       * @param {Number} time segment synthesis audio time
       * @return {Number} period to next segment
       *
       * This function can be called at any time (whether the engine is scheduled/transported or not)
       * to generate a single segment according to the current segment parameters.
       */

      value: function trigger(time) {
        var audioContext = this.audioContext;
        var segmentTime = (time || audioContext.currentTime) + this.delay;
        var segmentPeriod = this.periodAbs;
        var segmentIndex = this.segmentIndex;

        if (this.buffer) {
          var segmentPosition = 0;
          var segmentDuration = 0;
          var segmentOffset = 0;
          var resamplingRate = 1;
          var bufferDuration = this.bufferDuration;

          if (this.cyclic) segmentIndex = segmentIndex % this.positionArray.length;else segmentIndex = Math.max(0, Math.min(segmentIndex, this.positionArray.length - 1));

          if (this.positionArray) segmentPosition = this.positionArray[segmentIndex] || 0;

          if (this.durationArray) segmentDuration = this.durationArray[segmentIndex] || 0;

          if (this.offsetArray) segmentOffset = this.offsetArray[segmentIndex] || 0;

          // calculate resampling
          if (this.resampling !== 0 || this.resamplingVar > 0) {
            var randomResampling = (Math.random() - 0.5) * 2 * this.resamplingVar;
            resamplingRate = Math.pow(2, (this.resampling + randomResampling) / 1200);
          }

          // calculate inter-segment distance
          if (segmentDuration === 0 || this.periodRel > 0) {
            var nextSegementIndex = segmentIndex + 1;
            var nextPosition, nextOffset;

            if (nextSegementIndex === this.positionArray.length) {
              if (this.cyclic) {
                nextPosition = this.positionArray[0] + bufferDuration;
                nextOffset = this.offsetArray[0];
              } else {
                nextPosition = bufferDuration;
                nextOffset = 0;
              }
            } else {
              nextPosition = this.positionArray[nextSegementIndex];
              nextOffset = this.offsetArray[nextSegementIndex];
            }

            var interSegmentDistance = nextPosition - segmentPosition;

            // correct inter-segment distance by offsets
            //   offset > 0: the segment's reference position is after the given segment position
            if (segmentOffset > 0) interSegmentDistance -= segmentOffset;

            if (nextOffset > 0) interSegmentDistance += nextOffset;

            if (interSegmentDistance < 0) interSegmentDistance = 0;

            // use inter-segment distance instead of segment duration
            if (segmentDuration === 0) segmentDuration = interSegmentDistance;

            // calculate period relative to inter marker distance
            segmentPeriod += this.periodRel * interSegmentDistance;
          }

          // add relative and absolute segment duration
          segmentDuration *= this.durationRel;
          segmentDuration += this.durationAbs;

          // add relative and absolute segment offset
          segmentOffset *= this.offsetRel;
          segmentOffset += this.offsetAbs;

          // apply segment offset
          //   offset > 0: the segment's reference position is after the given segment position
          //   offset < 0: the given segment position is the segment's reference position and the duration has to be corrected by the offset
          if (segmentOffset < 0) {
            segmentDuration -= segmentOffset;
            segmentPosition += segmentOffset;
            segmentTime += segmentOffset / resamplingRate;
          } else {
            segmentTime -= segmentOffset / resamplingRate;
          }

          // randomize segment position
          if (this.positionVar > 0) segmentPosition += 2 * (Math.random() - 0.5) * this.positionVar;

          // shorten duration of segments over the edges of the buffer
          if (segmentPosition < 0) {
            segmentDuration += segmentPosition;
            segmentPosition = 0;
          }

          if (segmentPosition + segmentDuration > this.buffer.duration) segmentDuration = this.buffer.duration - segmentPosition;

          // make segment
          if (this.gain > 0 && segmentDuration > 0) {
            // make segment envelope
            var envelope = audioContext.createGain();
            var attack = this.attackAbs + this.attackRel * segmentDuration;
            var release = this.releaseAbs + this.releaseRel * segmentDuration;

            if (attack + release > segmentDuration) {
              var factor = segmentDuration / (attack + release);
              attack *= factor;
              release *= factor;
            }

            var attackEndTime = segmentTime + attack;
            var segmentEndTime = segmentTime + segmentDuration;
            var releaseStartTime = segmentEndTime - release;

            envelope.gain.setValueAtTime(0, segmentTime);
            envelope.gain.linearRampToValueAtTime(this.gain, attackEndTime);

            if (releaseStartTime > attackEndTime) envelope.gain.setValueAtTime(this.gain, releaseStartTime);

            envelope.gain.linearRampToValueAtTime(0, segmentEndTime);
            envelope.connect(this.outputNode);

            // make source
            var source = audioContext.createBufferSource();

            source.buffer = this.buffer;
            source.playbackRate.value = resamplingRate;
            source.connect(envelope);

            source.start(segmentTime, segmentPosition);
            source.stop(segmentTime + segmentDuration / resamplingRate);
          }
        }

        return segmentPeriod;
      }
    }
  });

  return SegmentEngine;
})(AudioTimeEngine);

module.exports = SegmentEngine;

},{"../core/audio-time-engine":93,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],99:[function(require,module,exports){
"use strict";

var _core = require("babel-runtime/core-js")["default"];

// schedulers should be singletons
var defaultAudioContext = require("../core/audio-context");
var Scheduler = require("./scheduler");
var SimpleScheduler = require("./simple-scheduler");
var schedulerMap = new _core.WeakMap();
var simpleSchedulerMap = new _core.WeakMap();

// scheduler factory
module.exports.getScheduler = function () {
  var audioContext = arguments[0] === undefined ? defaultAudioContext : arguments[0];

  var scheduler = schedulerMap.get(audioContext);

  if (!scheduler) {
    scheduler = new Scheduler({ audioContext: audioContext });
    schedulerMap.set(audioContext, scheduler);
  }

  return scheduler;
};

module.exports.getSimpleScheduler = function () {
  var audioContext = arguments[0] === undefined ? defaultAudioContext : arguments[0];

  var simpleScheduler = simpleSchedulerMap.get(audioContext);

  if (!simpleScheduler) {
    simpleScheduler = new SimpleScheduler({ audioContext: audioContext });
    simpleSchedulerMap.set(audioContext, simpleScheduler);
  }

  return simpleScheduler;
};

},{"../core/audio-context":92,"./scheduler":101,"./simple-scheduler":102,"babel-runtime/core-js":106}],100:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var defaultAudioContext = require("../core/audio-context");
var TimeEngine = require("../core/time-engine");
var SchedulingQueue = require("../utils/scheduling-queue");
var getScheduler = require("./factories").getScheduler;

var LoopControl = (function (_TimeEngine) {
  function LoopControl(playControl) {
    _classCallCheck(this, LoopControl);

    _get(_core.Object.getPrototypeOf(LoopControl.prototype), "constructor", this).call(this);

    this.__playControl = playControl;
    this.lower = -Infinity;
    this.upper = Infinity;
  }

  _inherits(LoopControl, _TimeEngine);

  _createClass(LoopControl, {
    advanceTime: {

      // TimeEngine method (scheduled interface)

      value: function advanceTime(time) {
        var playControl = this.__playControl;
        var speed = playControl.speed;
        var lower = this.lower;
        var upper = this.upper;

        if (speed > 0) {
          playControl.syncSpeed(time, lower, speed, true);
          return playControl.__getTimeAtPosition(upper);
        } else if (speed < 0) {
          playControl.syncSpeed(time, upper, speed, true);
          return playControl.__getTimeAtPosition(lower);
        }

        return Infinity;
      }
    },
    reschedule: {
      value: function reschedule(speed) {
        var playControl = this.__playControl;
        var lower = Math.min(playControl.__loopStart, playControl.__loopEnd);
        var upper = Math.max(playControl.__loopStart, playControl.__loopEnd);

        this.speed = speed;
        this.lower = lower;
        this.upper = upper;

        if (lower === upper) speed = 0;

        if (speed > 0) this.resetTime(playControl.__getTimeAtPosition(upper - 0.000001));else if (speed < 0) this.resetTime(playControl.__getTimeAtPosition(lower + 0.000001));else this.resetTime(Infinity);
      }
    },
    applyLoopBoundaries: {
      value: function applyLoopBoundaries(position, speed) {
        var lower = this.lower;
        var upper = this.upper;

        if (speed > 0 && position >= upper) {
          return lower + (position - lower) % (upper - lower);
        } else if (speed < 0 && position < lower) {
          return upper - (upper - position) % (upper - lower);
        }return position;
      }
    }
  });

  return LoopControl;
})(TimeEngine);

var PlayControlled = (function () {
  function PlayControlled(playControl, engine) {
    _classCallCheck(this, PlayControlled);

    this.__playControl = playControl;
    this.__engine = engine;

    engine.master = this;
  }

  _createClass(PlayControlled, {
    syncSpeed: {
      value: function syncSpeed(time, position, speed, seek, lastSpeed) {
        this.__engine.syncSpeed(time, position, speed, seek);
      }
    },
    currentTime: {
      get: function () {
        return this.__playControl.currentTime;
      }
    },
    currentPosition: {
      get: function () {
        return this.__playControl.currentPosition;
      }
    },
    destroy: {
      value: function destroy() {
        this.__engine.master = null;

        this.__playControl = null;
        this.__engine = null;
      }
    }
  });

  return PlayControlled;
})();

var PlayControlledSpeedControlled = (function (_PlayControlled) {
  function PlayControlledSpeedControlled(playControl, engine) {
    _classCallCheck(this, PlayControlledSpeedControlled);

    _get(_core.Object.getPrototypeOf(PlayControlledSpeedControlled.prototype), "constructor", this).call(this, playControl, engine);
  }

  _inherits(PlayControlledSpeedControlled, _PlayControlled);

  return PlayControlledSpeedControlled;
})(PlayControlled);

var TransportedSchedulerHook = (function (_TimeEngine2) {
  function TransportedSchedulerHook(playControl, engine) {
    _classCallCheck(this, TransportedSchedulerHook);

    _get(_core.Object.getPrototypeOf(TransportedSchedulerHook.prototype), "constructor", this).call(this);

    this.__playControl = playControl;
    this.__engine = engine;

    this.__nextPosition = Infinity;
    playControl.__scheduler.add(this, Infinity);
  }

  _inherits(TransportedSchedulerHook, _TimeEngine2);

  _createClass(TransportedSchedulerHook, {
    advanceTime: {
      value: function advanceTime(time) {
        var playControl = this.__playControl;
        var engine = this.__engine;
        var position = this.__nextPosition;
        var nextPosition = engine.advancePosition(time, position, playControl.__speed);
        var nextTime = playControl.__getTimeAtPosition(nextPosition);

        while (nextTime <= time) {
          nextPosition = engine.advancePosition(time, position, playControl.__speed);
          nextTime = playControl.__getTimeAtPosition(nextPosition);
        }

        this.__nextPosition = nextPosition;
        return nextTime;
      }
    },
    resetPosition: {
      value: function resetPosition() {
        var position = arguments[0] === undefined ? this.__nextPosition : arguments[0];

        var time = this.__playControl.__getTimeAtPosition(position);
        this.__nextPosition = position;
        this.resetTime(time);
      }
    },
    destroy: {
      value: function destroy() {
        this.__playControl.__scheduler.remove(this);

        this.__playControl = null;
        this.__engine = null;
      }
    }
  });

  return TransportedSchedulerHook;
})(TimeEngine);

var PlayControlledTransported = (function (_PlayControlled2) {
  function PlayControlledTransported(playControl, engine) {
    _classCallCheck(this, PlayControlledTransported);

    _get(_core.Object.getPrototypeOf(PlayControlledTransported.prototype), "constructor", this).call(this, playControl, engine);

    this.__schedulerHook = new TransportedSchedulerHook(playControl, engine);
  }

  _inherits(PlayControlledTransported, _PlayControlled2);

  _createClass(PlayControlledTransported, {
    syncSpeed: {
      value: function syncSpeed(time, position, speed, seek, lastSpeed) {
        var nextPosition = this.__nextPosition;

        if (seek) {
          nextPosition = this.__engine.syncPosition(time, position, speed);
        } else if (lastSpeed === 0) {
          // start
          nextPosition = this.__engine.syncPosition(time, position, speed);
        } else if (speed === 0) {
          // stop
          nextPosition = Infinity;

          if (this.__engine.syncSpeed) this.__engine.syncSpeed(time, position, 0);
        } else if (speed * lastSpeed < 0) {
          // change transport direction
          nextPosition = this.__engine.syncPosition(time, position, speed);
        } else if (this.__engine.syncSpeed) {
          // change speed
          this.__engine.syncSpeed(time, position, speed);
        }

        this.__schedulerHook.resetPosition(nextPosition);
      }
    },
    resetEnginePosition: {
      value: function resetEnginePosition(engine) {
        var position = arguments[1] === undefined ? undefined : arguments[1];

        if (position === undefined) {
          var playControl = this.__playControl;
          var time = playControl.__sync();

          position = this.__engine.syncPosition(time, playControl.__position, playControl.__speed);
        }

        this.__schedulerHook.resetPosition(position);
      }
    },
    destroy: {
      value: function destroy() {
        this.__schedulerHook.destroy();
        this.__schedulerHook = null;

        _get(_core.Object.getPrototypeOf(PlayControlledTransported.prototype), "destroy", this).call(this);
      }
    }
  });

  return PlayControlledTransported;
})(PlayControlled);

var ScheduledSchedulingQueue = (function (_SchedulingQueue) {
  function ScheduledSchedulingQueue(playControl, engine) {
    _classCallCheck(this, ScheduledSchedulingQueue);

    _get(_core.Object.getPrototypeOf(ScheduledSchedulingQueue.prototype), "constructor", this).call(this);
    this.__playControl = playControl;
    this.__engine = engine;

    this.add(engine, Infinity);
    playControl.__scheduler.add(this, Infinity);
  }

  _inherits(ScheduledSchedulingQueue, _SchedulingQueue);

  _createClass(ScheduledSchedulingQueue, {
    currentTime: {
      get: function () {
        return this.__playControl.currentTime;
      }
    },
    currentPosition: {
      get: function () {
        return this.__playControl.currentPosition;
      }
    },
    destroy: {
      value: function destroy() {
        this.__playControl.__scheduler.remove(this);
        this.remove(this.__engine);

        this.__playControl = null;
        this.__engine = null;
      }
    }
  });

  return ScheduledSchedulingQueue;
})(SchedulingQueue);

var PlayControlledScheduled = (function (_PlayControlled3) {
  function PlayControlledScheduled(playControl, engine) {
    _classCallCheck(this, PlayControlledScheduled);

    _get(_core.Object.getPrototypeOf(PlayControlledScheduled.prototype), "constructor", this).call(this, playControl, engine);
    this.__schedulingQueue = new ScheduledSchedulingQueue(playControl, engine);
  }

  _inherits(PlayControlledScheduled, _PlayControlled3);

  _createClass(PlayControlledScheduled, {
    syncSpeed: {
      value: function syncSpeed(time, position, speed, seek, lastSpeed) {
        if (lastSpeed === 0 && speed !== 0) // start or seek
          this.__engine.resetTime();else if (lastSpeed !== 0 && speed === 0) // stop
          this.__engine.resetTime(Infinity);
      }
    },
    destroy: {
      value: function destroy() {
        this.__schedulingQueue.destroy();
        _get(_core.Object.getPrototypeOf(PlayControlledScheduled.prototype), "destroy", this).call(this);
      }
    }
  });

  return PlayControlledScheduled;
})(PlayControlled);

var PlayControl = (function (_TimeEngine3) {
  function PlayControl(engine) {
    var options = arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, PlayControl);

    _get(_core.Object.getPrototypeOf(PlayControl.prototype), "constructor", this).call(this);

    this.audioContext = options.audioContext || defaultAudioContext;
    this.__scheduler = getScheduler(this.audioContext);

    this.__playControlled = null;

    this.__loopControl = null;
    this.__loopStart = 0;
    this.__loopEnd = Infinity;

    // synchronized tie, position, and speed
    this.__time = 0;
    this.__position = 0;
    this.__speed = 0;

    // non-zero "user" speed
    this.__playingSpeed = 1;

    if (engine) this.__setEngine(engine);
  }

  _inherits(PlayControl, _TimeEngine3);

  _createClass(PlayControl, {
    __setEngine: {
      value: function __setEngine(engine) {
        if (engine.master) throw new Error("object has already been added to a master");

        if (engine.implementsSpeedControlled()) this.__playControlled = new PlayControlledSpeedControlled(this, engine);else if (engine.implementsTransported()) this.__playControlled = new PlayControlledTransported(this, engine);else if (engine.implementsScheduled()) this.__playControlled = new PlayControlledScheduled(this, engine);else throw new Error("object cannot be added to play control");
      }
    },
    __resetEngine: {
      value: function __resetEngine() {
        this.__playControlled.destroy();
        this.__playControlled = null;
      }
    },
    __getTimeAtPosition: {

      /**
       * Calculate/extrapolate playing time for given position
       * @param {Number} position position
       * @return {Number} extrapolated time
       */

      value: function __getTimeAtPosition(position) {
        return this.__time + (position - this.__position) / this.__speed;
      }
    },
    __getPositionAtTime: {

      /**
       * Calculate/extrapolate playing position for given time
       * @param {Number} time time
       * @return {Number} extrapolated position
       */

      value: function __getPositionAtTime(time) {
        return this.__position + (time - this.__time) * this.__speed;
      }
    },
    __sync: {
      value: function __sync() {
        var now = this.currentTime;
        this.__position += (now - this.__time) * this.__speed;
        this.__time = now;
        return now;
      }
    },
    currentTime: {

      /**
       * Get current master time
       * @return {Number} current time
       *
       * This function will be replaced when the play-control is added to a master.
       */

      get: function () {
        return this.__scheduler.currentTime;
      }
    },
    currentPosition: {

      /**
       * Get current master position
       * @return {Number} current playing position
       *
       * This function will be replaced when the play-control is added to a master.
       */

      get: function () {
        return this.__position + (this.__scheduler.currentTime - this.__time) * this.__speed;
      }
    },
    set: {
      value: function set() {
        var engine = arguments[0] === undefined ? null : arguments[0];

        var time = this.__sync();
        var speed = this.__speed;

        if (this.__playControlled !== null && this.__playControlled.__engine !== engine) {

          this.syncSpeed(time, this.__position, 0);

          if (this.__playControlled) this.__resetEngine();

          if (this.__playControlled === null && engine !== null) {
            this.__setEngine(engine);

            if (speed !== 0) this.syncSpeed(time, this.__position, speed);
          }
        }
      }
    },
    loop: {
      set: function (enable) {
        if (enable && this.__loopStart > -Infinity && this.__loopEnd < Infinity) {
          if (!this.__loopControl) {
            this.__loopControl = new LoopControl(this);
            this.__scheduler.add(this.__loopControl, Infinity);
          }

          if (this.__speed !== 0) this.__loopControl.reschedule(this.__speed);
        } else if (this.__loopControl) {
          this.__scheduler.remove(this.__loopControl);
          this.__loopControl = null;
        }
      },
      get: function () {
        return !!this.__loopControl;
      }
    },
    setLoopBoundaries: {
      value: function setLoopBoundaries(loopStart, loopEnd) {
        this.__loopStart = loopStart;
        this.__loopEnd = loopEnd;

        this.loop = this.loop;
      }
    },
    loopStart: {
      set: function (loopStart) {
        this.setLoopBoundaries(loopStart, this.__loopEnd);
      },
      get: function () {
        return this.__loopStart;
      }
    },
    loopEnd: {
      set: function (loopEnd) {
        this.setLoopBoundaries(this.__loopStart, loopEnd);
      },
      get: function () {
        return this.__loopEnd;
      }
    },
    syncSpeed: {

      // TimeEngine method (speed-controlled interface)

      value: function syncSpeed(time, position, speed) {
        var seek = arguments[3] === undefined ? false : arguments[3];

        var lastSpeed = this.__speed;

        if (speed !== lastSpeed || seek) {
          if ((seek || lastSpeed === 0) && this.__loopControl) position = this.__loopControl.applyLoopBoundaries(position, speed);

          this.__time = time;
          this.__position = position;
          this.__speed = speed;

          if (this.__playControlled) this.__playControlled.syncSpeed(time, position, speed, seek, lastSpeed);

          if (this.__loopControl) this.__loopControl.reschedule(speed);
        }
      }
    },
    start: {

      /**
       * Start playing
       */

      value: function start() {
        var time = this.__sync();
        this.syncSpeed(time, this.__position, this.__playingSpeed);
      }
    },
    pause: {

      /**
       * Pause playing
       */

      value: function pause() {
        var time = this.__sync();
        this.syncSpeed(time, this.__position, 0);
      }
    },
    stop: {

      /**
       * Stop playing
       */

      value: function stop() {
        var time = this.__sync();
        this.syncSpeed(time, this.__position, 0);
        this.seek(0);
      }
    },
    speed: {

      /**
       * Set playing speed
       * @param {Number} speed playing speed (non-zero speed between -16 and -1/16 or between 1/16 and 16)
       */

      set: function (speed) {
        var time = this.__sync();

        if (speed >= 0) {
          if (speed < 0.01) speed = 0.01;else if (speed > 100) speed = 100;
        } else {
          if (speed < -100) speed = -100;else if (speed > -0.01) speed = -0.01;
        }

        this.__playingSpeed = speed;

        if (this.__speed !== 0) this.syncSpeed(time, this.__position, speed);
      },

      /**
       * Get playing speed
       * @return current playing speed
       */
      get: function () {
        return this.__playingSpeed;
      }
    },
    seek: {

      /**
       * Set (jump to) playing position
       * @param {Number} position target position
       */

      value: function seek(position) {
        if (position !== this.__position) {
          var time = this.__sync();
          this.__position = position;
          this.syncSpeed(time, position, this.__speed, true);
        }
      }
    }
  });

  return PlayControl;
})(TimeEngine);

module.exports = PlayControl;

},{"../core/audio-context":92,"../core/time-engine":94,"../utils/scheduling-queue":105,"./factories":99,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],101:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var defaultAudioContext = require("../core/audio-context");
var TimeEngine = require("../core/time-engine");
var PriorityQueue = require("../utils/priority-queue");
var SchedulingQueue = require("../utils/scheduling-queue");

var Scheduler = (function (_SchedulingQueue) {
  function Scheduler() {
    var options = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Scheduler);

    _get(_core.Object.getPrototypeOf(Scheduler.prototype), "constructor", this).call(this);

    this.audioContext = options.audioContext || defaultAudioContext;

    this.__currentTime = null;
    this.__nextTime = Infinity;
    this.__timeout = null;

    /**
     * scheduler (setTimeout) period
     * @type {Number}
     */
    this.period = options.period || 0.025;

    /**
     * scheduler lookahead time (> period)
     * @type {Number}
     */
    this.lookahead = options.lookahead || 0.1;
  }

  _inherits(Scheduler, _SchedulingQueue);

  _createClass(Scheduler, {
    __tick: {

      // setTimeout scheduling loop

      value: function __tick() {
        var audioContext = this.audioContext;
        var time = this.__nextTime;

        this.__timeout = null;

        while (time <= audioContext.currentTime + this.lookahead) {
          this.__currentTime = time;
          time = this.advanceTime(time);
        }

        this.__currentTime = null;
        this.resetTime(time);
      }
    },
    resetTime: {
      value: function resetTime() {
        var _this = this;

        var time = arguments[0] === undefined ? this.currentTime : arguments[0];

        if (this.master) {
          this.master.reset(this, time);
        } else {
          if (this.__timeout) {
            clearTimeout(this.__timeout);
            this.__timeout = null;
          }

          if (time !== Infinity) {
            if (this.__nextTime === Infinity) console.log("Scheduler Start");

            var timeOutDelay = Math.max(time - this.lookahead - this.audioContext.currentTime, this.period);

            this.__timeout = setTimeout(function () {
              _this.__tick();
            }, timeOutDelay * 1000);
          } else if (this.__nextTime !== Infinity) {
            console.log("Scheduler Stop");
          }

          this.__nextTime = time;
        }
      }
    },
    currentTime: {
      get: function () {
        if (this.master) return this.master.currentTime;

        return this.__currentTime || this.audioContext.currentTime + this.lookahead;
      }
    },
    currentPosition: {
      get: function () {
        var master = this.master;

        if (master && master.currentPosition !== undefined) return master.currentPosition;

        return undefined;
      }
    },
    add: {

      // add a time engine to the queue and return the engine

      value: function add(engineOrFunction) {
        var time = arguments[1] === undefined ? this.currentTime : arguments[1];

        var engine;

        if (engineOrFunction instanceof Function) {
          // construct minimal scheduled engine
          engine = {
            advanceTime: engineOrFunction
          };
        } else {
          engine = engineOrFunction;

          if (!engine.implementsScheduled()) throw new Error("object cannot be added to scheduler");

          if (engine.master) throw new Error("object has already been added to a master");
        }

        _get(_core.Object.getPrototypeOf(Scheduler.prototype), "add", this).call(this, engine, time);
      }
    },
    remove: {
      value: function remove(engine) {
        if (engine.master !== this) throw new Error("object has not been added to this scheduler");

        _get(_core.Object.getPrototypeOf(Scheduler.prototype), "remove", this).call(this, engine);
      }
    },
    resetEngineTime: {
      value: function resetEngineTime(engine) {
        var time = arguments[1] === undefined ? this.currentTime : arguments[1];

        if (engine.master !== this) throw new Error("object has not been added to this scheduler");

        _get(_core.Object.getPrototypeOf(Scheduler.prototype), "resetEngineTime", this).call(this, engine, time);
      }
    }
  });

  return Scheduler;
})(SchedulingQueue);

module.exports = Scheduler;

},{"../core/audio-context":92,"../core/time-engine":94,"../utils/priority-queue":104,"../utils/scheduling-queue":105,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],102:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var defaultAudioContext = require("../core/audio-context");
var TimeEngine = require("../core/time-engine");

function arrayRemove(array, value) {
  var index = array.indexOf(value);

  if (index >= 0) {
    array.splice(index, 1);
    return true;
  }

  return false;
}

var SimpleScheduler = (function () {
  function SimpleScheduler() {
    var options = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, SimpleScheduler);

    this.audioContext = options.audioContext || defaultAudioContext;

    this.__engines = [];

    this.__schedEngines = [];
    this.__schedTimes = [];

    this.__currentTime = null;
    this.__timeout = null;

    /**
     * scheduler (setTimeout) period
     * @type {Number}
     */
    this.period = options.period || 0.025;

    /**
     * scheduler lookahead time (> period)
     * @type {Number}
     */
    this.lookahead = options.lookahead || 0.1;
  }

  _createClass(SimpleScheduler, {
    __scheduleEngine: {
      value: function __scheduleEngine(engine, time) {
        this.__schedEngines.push(engine);
        this.__schedTimes.push(time);
      }
    },
    __rescheduleEngine: {
      value: function __rescheduleEngine(engine, time) {
        var index = this.__schedEngines.indexOf(engine);

        if (index >= 0) {
          if (time !== Infinity) {
            this.__schedTimes[index] = time;
          } else {
            this.__schedEngines.splice(index, 1);
            this.__schedTimes.splice(index, 1);
          }
        } else if (time < Infinity) {
          this.__schedEngines.push(engine);
          this.__schedTimes.push(time);
        }
      }
    },
    __unscheduleEngine: {
      value: function __unscheduleEngine(engine) {
        var index = this.__schedEngines.indexOf(engine);

        if (index >= 0) {
          this.__schedEngines.splice(index, 1);
          this.__schedTimes.splice(index, 1);
        }
      }
    },
    __resetTick: {
      value: function __resetTick() {
        if (this.__schedEngines.length > 0) {
          if (!this.__timeout) {
            console.log("SimpleScheduler Start");
            this.__tick();
          }
        } else if (this.__timeout) {
          console.log("SimpleScheduler Stop");
          clearTimeout(this.__timeout);
          this.__timeout = null;
        }
      }
    },
    __tick: {
      value: function __tick() {
        var _this = this;

        var audioContext = this.audioContext;
        var i = 0;

        while (i < this.__schedEngines.length) {
          var engine = this.__schedEngines[i];
          var time = this.__schedTimes[i];

          while (time && time <= audioContext.currentTime + this.lookahead) {
            time = Math.max(time, audioContext.currentTime);
            this.__currentTime = time;
            time = engine.advanceTime(time);
          }

          if (time && time < Infinity) {
            this.__schedTimes[i++] = time;
          } else {
            this.__unscheduleEngine(engine);

            // remove engine from scheduler
            if (!time) {
              engine.master = null;
              arrayRemove(this.__engines, engine);
            }
          }
        }

        this.__currentTime = null;
        this.__timeout = null;

        if (this.__schedEngines.length > 0) {
          this.__timeout = setTimeout(function () {
            _this.__tick();
          }, this.period * 1000);
        }
      }
    },
    currentTime: {
      get: function () {
        return this.__currentTime || this.audioContext.currentTime + this.lookahead;
      }
    },
    currentPosition: {
      get: function () {
        return undefined;
      }
    },
    add: {
      value: function add(engineOrFunction) {
        var time = arguments[1] === undefined ? this.currentTime : arguments[1];
        var getCurrentPosition = arguments[2] === undefined ? null : arguments[2];

        var engine = engineOrFunction;

        if (engineOrFunction instanceof Function) engine = {
          advanceTime: engineOrFunction
        };else if (!engineOrFunction.implementsScheduled()) throw new Error("object cannot be added to scheduler");else if (engineOrFunction.master) throw new Error("object has already been added to a master");

        // set master and add to array
        engine.master = this;
        this.__engines.push(engine);

        // schedule engine
        this.__scheduleEngine(engine, time);
        this.__resetTick();

        return engine;
      }
    },
    remove: {
      value: function remove(engine) {
        if (!engine.master || engine.master !== this) throw new Error("engine has not been added to this scheduler");

        // reset master and remove from array
        engine.master = null;
        arrayRemove(this.__engines, engine);

        // unschedule engine
        this.__unscheduleEngine(engine);
        this.__resetTick();
      }
    },
    resetEngineTime: {
      value: function resetEngineTime(engine) {
        var time = arguments[1] === undefined ? this.currentTime : arguments[1];

        this.__rescheduleEngine(engine, time);
        this.__resetTick();
      }
    },
    clear: {
      value: function clear() {
        if (this.__timeout) {
          clearTimeout(this.__timeout);
          this.__timeout = null;
        }

        this.__schedEngines.length = 0;
        this.__schedTimes.length = 0;
      }
    }
  });

  return SimpleScheduler;
})();

// export scheduler singleton
module.exports = SimpleScheduler;

},{"../core/audio-context":92,"../core/time-engine":94,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108}],103:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _core = require("babel-runtime/core-js")["default"];

var defaultAudioContext = require("../core/audio-context");
var TimeEngine = require("../core/time-engine");
var PriorityQueue = require("../utils/priority-queue");
var SchedulingQueue = require("../utils/scheduling-queue");
var getScheduler = require("./factories").getScheduler;

function addDuplet(firstArray, secondArray, firstElement, secondElement) {
  firstArray.push(firstElement);
  secondArray.push(secondElement);
}

function removeDuplet(firstArray, secondArray, firstElement) {
  var index = firstArray.indexOf(firstElement);

  if (index >= 0) {
    var secondElement = secondArray[index];

    firstArray.splice(index, 1);
    secondArray.splice(index, 1);

    return secondElement;
  }

  return null;
}

// The Transported call is the base class of the adapters between
// different types of engines (i.e. transported, scheduled, play-controlled)
// The adapters are at the same time masters for the engines added to the transport
// and transported TimeEngines inserted into the transport's position-based pritority queue.

var Transported = (function (_TimeEngine) {
  function Transported(transport, engine, start, duration, offset) {
    var stretch = arguments[5] === undefined ? 1 : arguments[5];

    _classCallCheck(this, Transported);

    this.master = transport;

    engine.master = this;
    this.__engine = engine;

    this.__startPosition = start;
    this.__endPosition = start + duration;
    this.__offsetPosition = start + offset;
    this.__stretchPosition = stretch;
    this.__haltPosition = Infinity; // engine's next halt position when not running (is null when engine hes been started)
  }

  _inherits(Transported, _TimeEngine);

  _createClass(Transported, {
    setBoundaries: {
      value: function setBoundaries(start, duration) {
        var offset = arguments[2] === undefined ? 0 : arguments[2];
        var stretch = arguments[3] === undefined ? 1 : arguments[3];

        this.__startPosition = start;
        this.__endPosition = start + duration;
        this.__offsetPosition = start + offset;
        this.__stretchPosition = stretch;
        this.resetPosition();
      }
    },
    start: {
      value: function start(time, position, speed) {}
    },
    stop: {
      value: function stop(time, position) {}
    },
    currentTime: {
      get: function () {
        return this.master.currentTime;
      }
    },
    currentPosition: {
      get: function () {
        return this.master.currentPosition - this.__offsetPosition;
      }
    },
    resetPosition: {
      value: function resetPosition(position) {
        if (position !== undefined) position += this.__offsetPosition;

        this.master.resetEnginePosition(this, position);
      }
    },
    syncPosition: {
      value: function syncPosition(time, position, speed) {
        if (speed > 0) {
          if (position < this.__startPosition) {

            if (this.__haltPosition === null) this.stop(time, position - this.__offsetPosition);

            this.__haltPosition = this.__endPosition;

            return this.__startPosition;
          } else if (position <= this.__endPosition) {
            this.start(time, position - this.__offsetPosition, speed);

            this.__haltPosition = null; // engine is active

            return this.__endPosition;
          }
        } else {
          if (position >= this.__endPosition) {
            if (this.__haltPosition === null) this.stop(time, position - this.__offsetPosition);

            this.__haltPosition = this.__startPosition;

            return this.__endPosition;
          } else if (position > this.__startPosition) {
            this.start(time, position - this.__offsetPosition, speed);

            this.__haltPosition = null; // engine is active

            return this.__startPosition;
          }
        }

        if (this.__haltPosition === null) this.stop(time, position);

        this.__haltPosition = Infinity;

        return Infinity;
      }
    },
    advancePosition: {
      value: function advancePosition(time, position, speed) {
        var haltPosition = this.__haltPosition;

        if (haltPosition !== null) {
          this.start(time, position - this.__offsetPosition, speed);

          this.__haltPosition = null;

          return haltPosition;
        }

        // stop engine
        if (this.__haltPosition === null) this.stop(time, position - this.__offsetPosition);

        this.__haltPosition = Infinity;

        return Infinity;
      }
    },
    syncSpeed: {
      value: function syncSpeed(time, position, speed) {
        if (speed === 0) this.stop(time, position - this.__offsetPosition);
      }
    },
    destroy: {
      value: function destroy() {
        this.master = null;
        this.__engine.master = null;
        this.__engine = null;
      }
    }
  });

  return Transported;
})(TimeEngine);

// TransportedScheduled
// has to switch on and off the scheduled engines when the transport hits the engine's start and end position

var TransportedTransported = (function (_Transported) {
  function TransportedTransported(transport, engine, startPosition, endPosition, offsetPosition) {
    _classCallCheck(this, TransportedTransported);

    _get(_core.Object.getPrototypeOf(TransportedTransported.prototype), "constructor", this).call(this, transport, engine, startPosition, endPosition, offsetPosition);
  }

  _inherits(TransportedTransported, _Transported);

  _createClass(TransportedTransported, {
    syncPosition: {
      value: function syncPosition(time, position, speed) {
        if (speed > 0 && position < this.__endPosition) position = Math.max(position, this.__startPosition);else if (speed < 0 && position >= this.__startPosition) position = Math.min(position, this.__endPosition);

        return this.__offsetPosition + this.__engine.syncPosition(time, position - this.__offsetPosition, speed);
      }
    },
    advancePosition: {
      value: function advancePosition(time, position, speed) {
        position = this.__offsetPosition + this.__engine.advancePosition(time, position - this.__offsetPosition, speed);

        if (speed > 0 && position < this.__endPosition || speed < 0 && position >= this.__startPosition) {
          return position;
        }return Infinity;
      }
    },
    syncSpeed: {
      value: function syncSpeed(time, position, speed) {
        if (this.__engine.syncSpeed) this.__engine.syncSpeed(time, position, speed);
      }
    },
    resetEnginePosition: {
      value: function resetEnginePosition(engine) {
        var position = arguments[1] === undefined ? undefined : arguments[1];

        if (position !== undefined) position += this.__offsetPosition;

        this.resetPosition(position);
      }
    }
  });

  return TransportedTransported;
})(Transported);

// TransportedSpeedControlled
// has to start and stop the speed-controlled engines when the transport hits the engine's start and end position

var TransportedSpeedControlled = (function (_Transported2) {
  function TransportedSpeedControlled(transport, engine, startPosition, endPosition, offsetPosition) {
    _classCallCheck(this, TransportedSpeedControlled);

    _get(_core.Object.getPrototypeOf(TransportedSpeedControlled.prototype), "constructor", this).call(this, transport, engine, startPosition, endPosition, offsetPosition);
  }

  _inherits(TransportedSpeedControlled, _Transported2);

  _createClass(TransportedSpeedControlled, {
    start: {
      value: function start(time, position, speed) {
        this.__engine.syncSpeed(time, position, speed, true);
      }
    },
    stop: {
      value: function stop(time, position) {
        this.__engine.syncSpeed(time, position, 0);
      }
    },
    syncSpeed: {
      value: function syncSpeed(time, position, speed) {
        if (this.__haltPosition === null) // engine is active
          this.__engine.syncSpeed(time, position, speed);
      }
    },
    destroy: {
      value: function destroy() {
        this.__engine.syncSpeed(this.master.currentTime, this.master.currentPosition - this.__offsetPosition, 0);
        _get(_core.Object.getPrototypeOf(TransportedSpeedControlled.prototype), "destroy", this).call(this);
      }
    }
  });

  return TransportedSpeedControlled;
})(Transported);

// TransportedScheduled
// has to switch on and off the scheduled engines when the transport hits the engine's start and end position

var TransportedScheduled = (function (_Transported3) {
  function TransportedScheduled(transport, engine, startPosition, endPosition, offsetPosition) {
    _classCallCheck(this, TransportedScheduled);

    _get(_core.Object.getPrototypeOf(TransportedScheduled.prototype), "constructor", this).call(this, transport, engine, startPosition, endPosition, offsetPosition);
    transport.__schedulingQueue.add(engine, Infinity);
  }

  _inherits(TransportedScheduled, _Transported3);

  _createClass(TransportedScheduled, {
    start: {
      value: function start(time, position, speed) {
        this.master.__schedulingQueue.resetEngineTime(this.__engine, time);
      }
    },
    stop: {
      value: function stop(time, position) {
        this.master.__schedulingQueue.resetEngineTime(this.__engine, Infinity);
      }
    },
    destroy: {
      value: function destroy() {
        this.master.__schedulingQueue.remove(this.__engine);
        _get(_core.Object.getPrototypeOf(TransportedScheduled.prototype), "destroy", this).call(this);
      }
    }
  });

  return TransportedScheduled;
})(Transported);

var TransportSchedulerHook = (function (_TimeEngine2) {
  function TransportSchedulerHook(transport) {
    _classCallCheck(this, TransportSchedulerHook);

    _get(_core.Object.getPrototypeOf(TransportSchedulerHook.prototype), "constructor", this).call(this);

    this.__transport = transport;

    this.__nextPosition = Infinity;
    this.__nextTime = Infinity;
    transport.__scheduler.add(this, Infinity);
  }

  _inherits(TransportSchedulerHook, _TimeEngine2);

  _createClass(TransportSchedulerHook, {
    advanceTime: {

      // TimeEngine method (scheduled interface)

      value: function advanceTime(time) {
        var transport = this.__transport;
        var position = this.__nextPosition;
        var speed = transport.__speed;
        var nextPosition = transport.advancePosition(time, position, speed);
        var nextTime = transport.__getTimeAtPosition(nextPosition);

        while (nextTime <= time) {
          nextPosition = transport.advancePosition(nextTime, nextPosition, speed);
          nextTime = transport.__getTimeAtPosition(nextPosition);
        }

        this.__nextPosition = nextPosition;
        this.__nextTime = nextTime;
        return nextTime;
      }
    },
    resetPosition: {
      value: function resetPosition() {
        var position = arguments[0] === undefined ? this.__nextPosition : arguments[0];

        var transport = this.__transport;
        var time = transport.__getTimeAtPosition(position);

        this.__nextPosition = position;
        this.__nextTime = time;
        this.resetTime(time);
      }
    },
    destroy: {
      value: function destroy() {
        this.__transport.__scheduler.remove(this);
        this.__transport = null;
      }
    }
  });

  return TransportSchedulerHook;
})(TimeEngine);

var TransportSchedulingQueue = (function (_SchedulingQueue) {
  function TransportSchedulingQueue(transport) {
    _classCallCheck(this, TransportSchedulingQueue);

    _get(_core.Object.getPrototypeOf(TransportSchedulingQueue.prototype), "constructor", this).call(this);

    this.__transport = transport;
    transport.__scheduler.add(this, Infinity);
  }

  _inherits(TransportSchedulingQueue, _SchedulingQueue);

  _createClass(TransportSchedulingQueue, {
    currentTime: {
      get: function () {
        return this.__transport.currentTime;
      }
    },
    currentPosition: {
      get: function () {
        return this.__transport.currentPosition;
      }
    },
    destroy: {
      value: function destroy() {
        this.__transport.__scheduler.remove(this);
        this.__transport = null;
      }
    }
  });

  return TransportSchedulingQueue;
})(SchedulingQueue);

/**
 * Transport class
 */

var Transport = (function (_TimeEngine3) {
  function Transport() {
    var options = arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Transport);

    _get(_core.Object.getPrototypeOf(Transport.prototype), "constructor", this).call(this);

    this.audioContext = options.audioContext || defaultAudioContext;

    this.__engines = [];
    this.__transported = [];

    this.__scheduler = getScheduler(this.audioContext);
    this.__schedulerHook = new TransportSchedulerHook(this);
    this.__transportedQueue = new PriorityQueue();
    this.__schedulingQueue = new TransportSchedulingQueue(this);

    // syncronized time, position, and speed
    this.__time = 0;
    this.__position = 0;
    this.__speed = 0;
  }

  _inherits(Transport, _TimeEngine3);

  _createClass(Transport, {
    __getTimeAtPosition: {
      value: function __getTimeAtPosition(position) {
        return this.__time + (position - this.__position) / this.__speed;
      }
    },
    __getPositionAtTime: {
      value: function __getPositionAtTime(time) {
        return this.__position + (time - this.__time) * this.__speed;
      }
    },
    __syncTransportedPosition: {
      value: function __syncTransportedPosition(time, position, speed) {
        var numTransportedEngines = this.__transported.length;
        var nextPosition = Infinity;

        if (numTransportedEngines > 0) {
          var engine, nextEnginePosition;

          this.__transportedQueue.clear();
          this.__transportedQueue.reverse = speed < 0;

          for (var i = numTransportedEngines - 1; i > 0; i--) {
            engine = this.__transported[i];
            nextEnginePosition = engine.syncPosition(time, position, speed);
            this.__transportedQueue.insert(engine, nextEnginePosition, false); // insert but don't sort
          }

          engine = this.__transported[0];
          nextEnginePosition = engine.syncPosition(time, position, speed);
          nextPosition = this.__transportedQueue.insert(engine, nextEnginePosition, true); // insert and sort
        }

        return nextPosition;
      }
    },
    __syncTransportedSpeed: {
      value: function __syncTransportedSpeed(time, position, speed) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = _core.$for.getIterator(this.__transported), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var transported = _step.value;

            transported.syncSpeed(time, position, speed);
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator["return"]) {
              _iterator["return"]();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    },
    currentTime: {

      /**
       * Get current master time
       * @return {Number} current time
       *
       * This function will be replaced when the transport is added to a master (i.e. transport or play-control).
       */

      get: function () {
        return this.__scheduler.currentTime;
      }
    },
    currentPosition: {

      /**
       * Get current master position
       * @return {Number} current playing position
       *
       * This function will be replaced when the transport is added to a master (i.e. transport or play-control).
       */

      get: function () {
        var master = this.master;

        if (master && master.currentPosition !== undefined) return master.currentPosition;

        return this.__position + (this.__scheduler.currentTime - this.__time) * this.__speed;
      }
    },
    resetPosition: {

      /**
       * Reset next transport position
       * @param {Number} next transport position
       */

      value: function resetPosition(position) {
        var master = this.master;

        if (master && master.resetEnginePosition !== undefined) master.resetEnginePosition(this, position);else this.__schedulerHook.resetPosition(position);
      }
    },
    syncPosition: {

      // TimeEngine method (transported interface)

      value: function syncPosition(time, position, speed) {
        this.__time = time;
        this.__position = position;
        this.__speed = speed;

        return this.__syncTransportedPosition(time, position, speed);
      }
    },
    advancePosition: {

      // TimeEngine method (transported interface)

      value: function advancePosition(time, position, speed) {
        var nextPosition = this.__transportedQueue.time;

        while (nextPosition === position) {
          var engine = this.__transportedQueue.head;
          var nextEnginePosition = engine.advancePosition(time, position, speed);

          if ((speed > 0 && nextEnginePosition > position || speed < 0 && nextEnginePosition < position) && (nextEnginePosition < Infinity && nextEnginePosition > -Infinity)) {
            nextPosition = this.__transportedQueue.move(engine, nextEnginePosition);
          } else {
            nextPosition = this.__transportedQueue.remove(engine);
          }
        }

        return nextPosition;
      }
    },
    syncSpeed: {

      // TimeEngine method (speed-controlled interface)

      value: function syncSpeed(time, position, speed) {
        var seek = arguments[3] === undefined ? false : arguments[3];

        var lastSpeed = this.__speed;

        this.__time = time;
        this.__position = position;
        this.__speed = speed;

        if (speed !== lastSpeed || seek && speed !== 0) {
          var nextPosition;

          // resync transported engines
          if (seek || speed * lastSpeed < 0) {
            // seek or reverse direction
            nextPosition = this.__syncTransportedPosition(time, position, speed);
          } else if (lastSpeed === 0) {
            // start
            nextPosition = this.__syncTransportedPosition(time, position, speed);
          } else if (speed === 0) {
            // stop
            nextPosition = Infinity;
            this.__syncTransportedSpeed(time, position, 0);
          } else {
            // change speed without reversing direction
            this.__syncTransportedSpeed(time, position, speed);
          }

          this.resetPosition(nextPosition);
        }
      }
    },
    add: {

      /**
       * Add a time engine to the transport
       * @param {Object} engine engine to be added to the transport
       * @param {Number} position start position
       */

      value: function add(engine) {
        var _this = this;

        var startPosition = arguments[1] === undefined ? -Infinity : arguments[1];
        var endPosition = arguments[2] === undefined ? Infinity : arguments[2];
        var offsetPosition = arguments[3] === undefined ? startPosition : arguments[3];
        return (function () {
          var transported = null;

          if (offsetPosition === -Infinity) offsetPosition = 0;

          if (engine.master) throw new Error("object has already been added to a master");

          if (engine.implementsTransported()) transported = new TransportedTransported(_this, engine, startPosition, endPosition, offsetPosition);else if (engine.implementsSpeedControlled()) transported = new TransportedSpeedControlled(_this, engine, startPosition, endPosition, offsetPosition);else if (engine.implementsScheduled()) transported = new TransportedScheduled(_this, engine, startPosition, endPosition, offsetPosition);else throw new Error("object cannot be added to a transport");

          if (transported) {
            var speed = _this.__speed;

            addDuplet(_this.__engines, _this.__transported, engine, transported);

            if (speed !== 0) {
              // sync and start
              var nextEnginePosition = transported.syncPosition(_this.currentTime, _this.currentPosition, speed);
              var nextPosition = _this.__transportedQueue.insert(transported, nextEnginePosition);

              _this.resetPosition(nextPosition);
            }
          }

          return transported;
        })();
      }
    },
    remove: {

      /**
       * Remove a time engine from the transport
       * @param {object} engineOrTransported engine or transported to be removed from the transport
       */

      value: function remove(engineOrTransported) {
        var engine = engineOrTransported;
        var transported = removeDuplet(this.__engines, this.__transported, engineOrTransported);

        if (!transported) {
          engine = removeDuplet(this.__transported, this.__engines, engineOrTransported);
          transported = engineOrTransported;
        }

        if (engine && transported) {
          var nextPosition = this.__transportedQueue.remove(transported);

          transported.destroy();

          if (this.__speed !== 0) this.resetPosition(nextPosition);
        } else {
          throw new Error("object has not been added to this transport");
        }
      }
    },
    resetEnginePosition: {
      value: function resetEnginePosition(transported) {
        var position = arguments[1] === undefined ? undefined : arguments[1];

        var speed = this.__speed;

        if (speed !== 0) {
          if (position === undefined) position = transported.syncPosition(this.currentTime, this.currentPosition, speed);

          var nextPosition = this.__transportedQueue.move(transported, position);
          this.resetPosition(nextPosition);
        }
      }
    },
    clear: {

      /**
       * Remove all time engines from the transport
       */

      value: function clear() {
        this.syncSpeed(this.currentTime, this.currentPosition, 0);

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = _core.$for.getIterator(this.__transported), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var transported = _step.value;

            transported.destroy();
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator["return"]) {
              _iterator["return"]();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    }
  });

  return Transport;
})(TimeEngine);

module.exports = Transport;

},{"../core/audio-context":92,"../core/time-engine":94,"../utils/priority-queue":104,"../utils/scheduling-queue":105,"./factories":99,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],104:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

/* written in ECMAscript 6 */
/**
 * @fileoverview WAVE audio priority queue used by scheduler and transports
 * @author Norbert Schnell <Norbert.Schnell@ircam.fr>
 *
 * First rather stupid implementation to be optimized...
 */

var PriorityQueue = (function () {
  function PriorityQueue() {
    _classCallCheck(this, PriorityQueue);

    this.__objects = [];
    this.reverse = false;
  }

  _createClass(PriorityQueue, {
    __objectIndex: {

      /**
       *  Get the index of an object in the object list
       */

      value: function __objectIndex(object) {
        for (var i = 0; i < this.__objects.length; i++) {
          if (object === this.__objects[i][0]) {
            return i;
          }
        }
        return -1;
      }
    },
    __removeObject: {

      /** 
       * Withdraw an object from the object list
       */

      value: function __removeObject(object) {
        var index = this.__objectIndex(object);

        if (index >= 0) this.__objects.splice(index, 1);

        if (this.__objects.length > 0) {
          return this.__objects[0][1];
        } // return time of first object

        return Infinity;
      }
    },
    __sortObjects: {
      value: function __sortObjects() {
        if (!this.reverse) this.__objects.sort(function (a, b) {
          return a[1] - b[1];
        });else this.__objects.sort(function (a, b) {
          return b[1] - a[1];
        });
      }
    },
    insert: {

      /**
       * Insert an object to the queue
       * (for this primitive version: prevent sorting for each element by calling with "false" as third argument)
       */

      value: function insert(object, time) {
        var sort = arguments[2] === undefined ? true : arguments[2];

        if (time !== Infinity && time != -Infinity) {
          // add new object
          this.__objects.push([object, time]);

          if (sort) this.__sortObjects();

          return this.__objects[0][1]; // return time of first object
        }

        return this.__removeObject(object);
      }
    },
    move: {

      /**
       * Move an object to another time in the queue
       */

      value: function move(object, time) {
        if (time !== Infinity && time != -Infinity) {

          var index = this.__objectIndex(object);

          if (index < 0) this.__objects.push([object, time]); // add new object
          else this.__objects[index][1] = time; // update time of existing object

          this.__sortObjects();

          return this.__objects[0][1]; // return time of first object
        }

        return this.__removeObject(object);
      }
    },
    remove: {

      /**
       * Remove an object from the queue
       */

      value: function remove(object) {
        return this.__removeObject(object);
      }
    },
    clear: {

      /**
       * Clear queue
       */

      value: function clear() {
        this.__objects.length = 0; // clear object list
        return Infinity;
      }
    },
    head: {

      /**
       * Get first object in queue
       */

      get: function () {
        if (this.__objects.length > 0) return this.__objects[0][0];

        return null;
      }
    },
    time: {

      /**
       * Get time of first object in queue
       */

      get: function () {
        if (this.__objects.length > 0) return this.__objects[0][1];

        return Infinity;
      }
    }
  });

  return PriorityQueue;
})();

module.exports = PriorityQueue;

},{"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108}],105:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

var _inherits = require("babel-runtime/helpers/inherits")["default"];

var _get = require("babel-runtime/helpers/get")["default"];

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _core = require("babel-runtime/core-js")["default"];

var PriorityQueue = require("../utils/priority-queue");
var TimeEngine = require("../core/time-engine");
var defaultAudioContext = require("../core/audio-context");

function arrayRemove(array, value) {
  var index = array.indexOf(value);

  if (index >= 0) {
    array.splice(index, 1);
    return true;
  }

  return false;
}

/**
 * @class SchedulingQueue
 */

var SchedulingQueue = (function (_TimeEngine) {
  function SchedulingQueue() {
    _classCallCheck(this, SchedulingQueue);

    _get(_core.Object.getPrototypeOf(SchedulingQueue.prototype), "constructor", this).call(this);

    this.__queue = new PriorityQueue();
    this.__engines = [];
  }

  _inherits(SchedulingQueue, _TimeEngine);

  _createClass(SchedulingQueue, {
    advanceTime: {

      // TimeEngine 'scheduled' interface

      value: function advanceTime(time) {
        var nextTime = this.__queue.time;

        while (nextTime <= time) {
          var engine = this.__queue.head;
          var nextEngineTime = engine.advanceTime(time);

          if (!nextEngineTime) {
            engine.master = null;
            arrayRemove(this.__engines, engine);
            nextTime = this.__queue.remove(engine);
          } else if (nextEngineTime > time && nextEngineTime < Infinity) {
            nextTime = this.__queue.move(engine, nextEngineTime);
          } else {
            nextTime = this.__queue.remove(engine);
          }
        }

        return nextTime;
      }
    },
    currentTime: {

      // TimeEngine master method to be implemented by derived class

      get: function () {
        return 0;
      }
    },
    add: {

      // add a time engine to the queue and return the engine

      value: function add(engine) {
        var time = arguments[1] === undefined ? this.currentTime : arguments[1];

        engine.master = this;

        // add to engines and queue
        this.__engines.push(engine);
        var nextTime = this.__queue.insert(engine, time);

        // reschedule queue
        this.resetTime(nextTime);
      }
    },
    remove: {

      // remove a time engine from the queue

      value: function remove(engine) {
        engine.master = null;

        // remove from array and queue
        arrayRemove(this.__engines, engine);
        var nextTime = this.__queue.remove(engine);

        // reschedule queue
        this.resetTime(nextTime);
      }
    },
    resetEngineTime: {

      // reset next engine time

      value: function resetEngineTime(engine) {
        var time = arguments[1] === undefined ? this.currentTime : arguments[1];

        var nextTime = this.__queue.move(engine, time);
        this.resetTime(nextTime);
      }
    },
    clear: {

      // clear queue

      value: function clear() {
        this.__queue.clear();
        this.__engines.length = 0;
        this.resetTime(Infinity);
      }
    }
  });

  return SchedulingQueue;
})(TimeEngine);

module.exports = SchedulingQueue;
/**
 * SchedulingQueue base class
 * http://wavesjs.github.io/audio/#audio-scheduling-queue
 *
 * Norbert.Schnell@ircam.fr
 * Copyright 2014, 2015 IRCAM – Centre Pompidou
 */

},{"../core/audio-context":92,"../core/time-engine":94,"../utils/priority-queue":104,"babel-runtime/core-js":106,"babel-runtime/helpers/class-call-check":107,"babel-runtime/helpers/create-class":108,"babel-runtime/helpers/get":109,"babel-runtime/helpers/inherits":110}],106:[function(require,module,exports){
/**
 * Core.js 0.6.1
 * https://github.com/zloirock/core-js
 * License: http://rock.mit-license.org
 * © 2015 Denis Pushkarev
 */
!function(global, framework, undefined){
'use strict';

/******************************************************************************
 * Module : common                                                            *
 ******************************************************************************/

  // Shortcuts for [[Class]] & property names
var OBJECT          = 'Object'
  , FUNCTION        = 'Function'
  , ARRAY           = 'Array'
  , STRING          = 'String'
  , NUMBER          = 'Number'
  , REGEXP          = 'RegExp'
  , DATE            = 'Date'
  , MAP             = 'Map'
  , SET             = 'Set'
  , WEAKMAP         = 'WeakMap'
  , WEAKSET         = 'WeakSet'
  , SYMBOL          = 'Symbol'
  , PROMISE         = 'Promise'
  , MATH            = 'Math'
  , ARGUMENTS       = 'Arguments'
  , PROTOTYPE       = 'prototype'
  , CONSTRUCTOR     = 'constructor'
  , TO_STRING       = 'toString'
  , TO_STRING_TAG   = TO_STRING + 'Tag'
  , TO_LOCALE       = 'toLocaleString'
  , HAS_OWN         = 'hasOwnProperty'
  , FOR_EACH        = 'forEach'
  , ITERATOR        = 'iterator'
  , FF_ITERATOR     = '@@' + ITERATOR
  , PROCESS         = 'process'
  , CREATE_ELEMENT  = 'createElement'
  // Aliases global objects and prototypes
  , Function        = global[FUNCTION]
  , Object          = global[OBJECT]
  , Array           = global[ARRAY]
  , String          = global[STRING]
  , Number          = global[NUMBER]
  , RegExp          = global[REGEXP]
  , Date            = global[DATE]
  , Map             = global[MAP]
  , Set             = global[SET]
  , WeakMap         = global[WEAKMAP]
  , WeakSet         = global[WEAKSET]
  , Symbol          = global[SYMBOL]
  , Math            = global[MATH]
  , TypeError       = global.TypeError
  , RangeError      = global.RangeError
  , setTimeout      = global.setTimeout
  , setImmediate    = global.setImmediate
  , clearImmediate  = global.clearImmediate
  , parseInt        = global.parseInt
  , isFinite        = global.isFinite
  , process         = global[PROCESS]
  , nextTick        = process && process.nextTick
  , document        = global.document
  , html            = document && document.documentElement
  , navigator       = global.navigator
  , define          = global.define
  , console         = global.console || {}
  , ArrayProto      = Array[PROTOTYPE]
  , ObjectProto     = Object[PROTOTYPE]
  , FunctionProto   = Function[PROTOTYPE]
  , Infinity        = 1 / 0
  , DOT             = '.';

// http://jsperf.com/core-js-isobject
function isObject(it){
  return it !== null && (typeof it == 'object' || typeof it == 'function');
}
function isFunction(it){
  return typeof it == 'function';
}
// Native function?
var isNative = ctx(/./.test, /\[native code\]\s*\}\s*$/, 1);

// Object internal [[Class]] or toStringTag
// http://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring
var toString = ObjectProto[TO_STRING];
function setToStringTag(it, tag, stat){
  if(it && !has(it = stat ? it : it[PROTOTYPE], SYMBOL_TAG))hidden(it, SYMBOL_TAG, tag);
}
function cof(it){
  return toString.call(it).slice(8, -1);
}
function classof(it){
  var O, T;
  return it == undefined ? it === undefined ? 'Undefined' : 'Null'
    : typeof (T = (O = Object(it))[SYMBOL_TAG]) == 'string' ? T : cof(O);
}

// Function
var call  = FunctionProto.call
  , apply = FunctionProto.apply
  , REFERENCE_GET;
// Partial apply
function part(/* ...args */){
  var fn     = assertFunction(this)
    , length = arguments.length
    , args   = Array(length)
    , i      = 0
    , _      = path._
    , holder = false;
  while(length > i)if((args[i] = arguments[i++]) === _)holder = true;
  return function(/* ...args */){
    var that    = this
      , _length = arguments.length
      , i = 0, j = 0, _args;
    if(!holder && !_length)return invoke(fn, args, that);
    _args = args.slice();
    if(holder)for(;length > i; i++)if(_args[i] === _)_args[i] = arguments[j++];
    while(_length > j)_args.push(arguments[j++]);
    return invoke(fn, _args, that);
  }
}
// Optional / simple context binding
function ctx(fn, that, length){
  assertFunction(fn);
  if(~length && that === undefined)return fn;
  switch(length){
    case 1: return function(a){
      return fn.call(that, a);
    }
    case 2: return function(a, b){
      return fn.call(that, a, b);
    }
    case 3: return function(a, b, c){
      return fn.call(that, a, b, c);
    }
  } return function(/* ...args */){
      return fn.apply(that, arguments);
  }
}
// Fast apply
// http://jsperf.lnkit.com/fast-apply/5
function invoke(fn, args, that){
  var un = that === undefined;
  switch(args.length | 0){
    case 0: return un ? fn()
                      : fn.call(that);
    case 1: return un ? fn(args[0])
                      : fn.call(that, args[0]);
    case 2: return un ? fn(args[0], args[1])
                      : fn.call(that, args[0], args[1]);
    case 3: return un ? fn(args[0], args[1], args[2])
                      : fn.call(that, args[0], args[1], args[2]);
    case 4: return un ? fn(args[0], args[1], args[2], args[3])
                      : fn.call(that, args[0], args[1], args[2], args[3]);
    case 5: return un ? fn(args[0], args[1], args[2], args[3], args[4])
                      : fn.call(that, args[0], args[1], args[2], args[3], args[4]);
  } return              fn.apply(that, args);
}

// Object:
var create           = Object.create
  , getPrototypeOf   = Object.getPrototypeOf
  , setPrototypeOf   = Object.setPrototypeOf
  , defineProperty   = Object.defineProperty
  , defineProperties = Object.defineProperties
  , getOwnDescriptor = Object.getOwnPropertyDescriptor
  , getKeys          = Object.keys
  , getNames         = Object.getOwnPropertyNames
  , getSymbols       = Object.getOwnPropertySymbols
  , isFrozen         = Object.isFrozen
  , has              = ctx(call, ObjectProto[HAS_OWN], 2)
  // Dummy, fix for not array-like ES3 string in es5 module
  , ES5Object        = Object
  , Dict;
function toObject(it){
  return ES5Object(assertDefined(it));
}
function returnIt(it){
  return it;
}
function returnThis(){
  return this;
}
function get(object, key){
  if(has(object, key))return object[key];
}
function ownKeys(it){
  assertObject(it);
  return getSymbols ? getNames(it).concat(getSymbols(it)) : getNames(it);
}
// 19.1.2.1 Object.assign(target, source, ...)
var assign = Object.assign || function(target, source){
  var T = Object(assertDefined(target))
    , l = arguments.length
    , i = 1;
  while(l > i){
    var S      = ES5Object(arguments[i++])
      , keys   = getKeys(S)
      , length = keys.length
      , j      = 0
      , key;
    while(length > j)T[key = keys[j++]] = S[key];
  }
  return T;
}
function keyOf(object, el){
  var O      = toObject(object)
    , keys   = getKeys(O)
    , length = keys.length
    , index  = 0
    , key;
  while(length > index)if(O[key = keys[index++]] === el)return key;
}

// Array
// array('str1,str2,str3') => ['str1', 'str2', 'str3']
function array(it){
  return String(it).split(',');
}
var push    = ArrayProto.push
  , unshift = ArrayProto.unshift
  , slice   = ArrayProto.slice
  , splice  = ArrayProto.splice
  , indexOf = ArrayProto.indexOf
  , forEach = ArrayProto[FOR_EACH];
/*
 * 0 -> forEach
 * 1 -> map
 * 2 -> filter
 * 3 -> some
 * 4 -> every
 * 5 -> find
 * 6 -> findIndex
 */
function createArrayMethod(type){
  var isMap       = type == 1
    , isFilter    = type == 2
    , isSome      = type == 3
    , isEvery     = type == 4
    , isFindIndex = type == 6
    , noholes     = type == 5 || isFindIndex;
  return function(callbackfn/*, that = undefined */){
    var O      = Object(assertDefined(this))
      , that   = arguments[1]
      , self   = ES5Object(O)
      , f      = ctx(callbackfn, that, 3)
      , length = toLength(self.length)
      , index  = 0
      , result = isMap ? Array(length) : isFilter ? [] : undefined
      , val, res;
    for(;length > index; index++)if(noholes || index in self){
      val = self[index];
      res = f(val, index, O);
      if(type){
        if(isMap)result[index] = res;             // map
        else if(res)switch(type){
          case 3: return true;                    // some
          case 5: return val;                     // find
          case 6: return index;                   // findIndex
          case 2: result.push(val);               // filter
        } else if(isEvery)return false;           // every
      }
    }
    return isFindIndex ? -1 : isSome || isEvery ? isEvery : result;
  }
}
function createArrayContains(isContains){
  return function(el /*, fromIndex = 0 */){
    var O      = toObject(this)
      , length = toLength(O.length)
      , index  = toIndex(arguments[1], length);
    if(isContains && el != el){
      for(;length > index; index++)if(sameNaN(O[index]))return isContains || index;
    } else for(;length > index; index++)if(isContains || index in O){
      if(O[index] === el)return isContains || index;
    } return !isContains && -1;
  }
}
function generic(A, B){
  // strange IE quirks mode bug -> use typeof vs isFunction
  return typeof A == 'function' ? A : B;
}

// Math
var MAX_SAFE_INTEGER = 0x1fffffffffffff // pow(2, 53) - 1 == 9007199254740991
  , pow    = Math.pow
  , abs    = Math.abs
  , ceil   = Math.ceil
  , floor  = Math.floor
  , max    = Math.max
  , min    = Math.min
  , random = Math.random
  , trunc  = Math.trunc || function(it){
      return (it > 0 ? floor : ceil)(it);
    }
// 20.1.2.4 Number.isNaN(number)
function sameNaN(number){
  return number != number;
}
// 7.1.4 ToInteger
function toInteger(it){
  return isNaN(it) ? 0 : trunc(it);
}
// 7.1.15 ToLength
function toLength(it){
  return it > 0 ? min(toInteger(it), MAX_SAFE_INTEGER) : 0;
}
function toIndex(index, length){
  var index = toInteger(index);
  return index < 0 ? max(index + length, 0) : min(index, length);
}
function lz(num){
  return num > 9 ? num : '0' + num;
}

function createReplacer(regExp, replace, isStatic){
  var replacer = isObject(replace) ? function(part){
    return replace[part];
  } : replace;
  return function(it){
    return String(isStatic ? it : this).replace(regExp, replacer);
  }
}
function createPointAt(toString){
  return function(pos){
    var s = String(assertDefined(this))
      , i = toInteger(pos)
      , l = s.length
      , a, b;
    if(i < 0 || i >= l)return toString ? '' : undefined;
    a = s.charCodeAt(i);
    return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
      ? toString ? s.charAt(i) : a
      : toString ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
  }
}

// Assertion & errors
var REDUCE_ERROR = 'Reduce of empty object with no initial value';
function assert(condition, msg1, msg2){
  if(!condition)throw TypeError(msg2 ? msg1 + msg2 : msg1);
}
function assertDefined(it){
  if(it == undefined)throw TypeError('Function called on null or undefined');
  return it;
}
function assertFunction(it){
  assert(isFunction(it), it, ' is not a function!');
  return it;
}
function assertObject(it){
  assert(isObject(it), it, ' is not an object!');
  return it;
}
function assertInstance(it, Constructor, name){
  assert(it instanceof Constructor, name, ": use the 'new' operator!");
}

// Property descriptors & Symbol
function descriptor(bitmap, value){
  return {
    enumerable  : !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable    : !(bitmap & 4),
    value       : value
  }
}
function simpleSet(object, key, value){
  object[key] = value;
  return object;
}
function createDefiner(bitmap){
  return DESC ? function(object, key, value){
    return defineProperty(object, key, descriptor(bitmap, value));
  } : simpleSet;
}
function uid(key){
  return SYMBOL + '(' + key + ')_' + (++sid + random())[TO_STRING](36);
}
function getWellKnownSymbol(name, setter){
  return (Symbol && Symbol[name]) || (setter ? Symbol : safeSymbol)(SYMBOL + DOT + name);
}
// The engine works fine with descriptors? Thank's IE8 for his funny defineProperty.
var DESC = !!function(){
      try {
        return defineProperty({}, 'a', {get: function(){ return 2 }}).a == 2;
      } catch(e){}
    }()
  , sid    = 0
  , hidden = createDefiner(1)
  , set    = Symbol ? simpleSet : hidden
  , safeSymbol = Symbol || uid;
function assignHidden(target, src){
  for(var key in src)hidden(target, key, src[key]);
  return target;
}

var SYMBOL_UNSCOPABLES = getWellKnownSymbol('unscopables')
  , ArrayUnscopables   = ArrayProto[SYMBOL_UNSCOPABLES] || {}
  , SYMBOL_TAG         = getWellKnownSymbol(TO_STRING_TAG)
  , SYMBOL_SPECIES     = getWellKnownSymbol('species')
  , SYMBOL_ITERATOR;
function setSpecies(C){
  if(DESC && (framework || !isNative(C)))defineProperty(C, SYMBOL_SPECIES, {
    configurable: true,
    get: returnThis
  });
}

/******************************************************************************
 * Module : common.export                                                     *
 ******************************************************************************/

var NODE = cof(process) == PROCESS
  , core = {}
  , path = framework ? global : core
  , old  = global.core
  , exportGlobal
  // type bitmap
  , FORCED = 1
  , GLOBAL = 2
  , STATIC = 4
  , PROTO  = 8
  , BIND   = 16
  , WRAP   = 32;
function $define(type, name, source){
  var key, own, out, exp
    , isGlobal = type & GLOBAL
    , target   = isGlobal ? global : (type & STATIC)
        ? global[name] : (global[name] || ObjectProto)[PROTOTYPE]
    , exports  = isGlobal ? core : core[name] || (core[name] = {});
  if(isGlobal)source = name;
  for(key in source){
    // there is a similar native
    own = !(type & FORCED) && target && key in target
      && (!isFunction(target[key]) || isNative(target[key]));
    // export native or passed
    out = (own ? target : source)[key];
    // prevent global pollution for namespaces
    if(!framework && isGlobal && !isFunction(target[key]))exp = source[key];
    // bind timers to global for call from export context
    else if(type & BIND && own)exp = ctx(out, global);
    // wrap global constructors for prevent change them in library
    else if(type & WRAP && !framework && target[key] == out){
      exp = function(param){
        return this instanceof out ? new out(param) : out(param);
      }
      exp[PROTOTYPE] = out[PROTOTYPE];
    } else exp = type & PROTO && isFunction(out) ? ctx(call, out) : out;
    // extend global
    if(framework && target && !own){
      if(isGlobal)target[key] = out;
      else delete target[key] && hidden(target, key, out);
    }
    // export
    if(exports[key] != out)hidden(exports, key, exp);
  }
}
// CommonJS export
if(typeof module != 'undefined' && module.exports)module.exports = core;
// RequireJS export
else if(isFunction(define) && define.amd)define(function(){return core});
// Export to global object
else exportGlobal = true;
if(exportGlobal || framework){
  core.noConflict = function(){
    global.core = old;
    return core;
  }
  global.core = core;
}

/******************************************************************************
 * Module : common.iterators                                                  *
 ******************************************************************************/

SYMBOL_ITERATOR = getWellKnownSymbol(ITERATOR);
var ITER  = safeSymbol('iter')
  , KEY   = 1
  , VALUE = 2
  , Iterators = {}
  , IteratorPrototype = {}
    // Safari has byggy iterators w/o `next`
  , BUGGY_ITERATORS = 'keys' in ArrayProto && !('next' in [].keys());
// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
setIterator(IteratorPrototype, returnThis);
function setIterator(O, value){
  hidden(O, SYMBOL_ITERATOR, value);
  // Add iterator for FF iterator protocol
  FF_ITERATOR in ArrayProto && hidden(O, FF_ITERATOR, value);
}
function createIterator(Constructor, NAME, next, proto){
  Constructor[PROTOTYPE] = create(proto || IteratorPrototype, {next: descriptor(1, next)});
  setToStringTag(Constructor, NAME + ' Iterator');
}
function defineIterator(Constructor, NAME, value, DEFAULT){
  var proto = Constructor[PROTOTYPE]
    , iter  = get(proto, SYMBOL_ITERATOR) || get(proto, FF_ITERATOR) || (DEFAULT && get(proto, DEFAULT)) || value;
  if(framework){
    // Define iterator
    setIterator(proto, iter);
    if(iter !== value){
      var iterProto = getPrototypeOf(iter.call(new Constructor));
      // Set @@toStringTag to native iterators
      setToStringTag(iterProto, NAME + ' Iterator', true);
      // FF fix
      has(proto, FF_ITERATOR) && setIterator(iterProto, returnThis);
    }
  }
  // Plug for library
  Iterators[NAME] = iter;
  // FF & v8 fix
  Iterators[NAME + ' Iterator'] = returnThis;
  return iter;
}
function defineStdIterators(Base, NAME, Constructor, next, DEFAULT, IS_SET){
  function createIter(kind){
    return function(){
      return new Constructor(this, kind);
    }
  }
  createIterator(Constructor, NAME, next);
  var entries = createIter(KEY+VALUE)
    , values  = createIter(VALUE);
  if(DEFAULT == VALUE)values = defineIterator(Base, NAME, values, 'values');
  else entries = defineIterator(Base, NAME, entries, 'entries');
  if(DEFAULT){
    $define(PROTO + FORCED * BUGGY_ITERATORS, NAME, {
      entries: entries,
      keys: IS_SET ? values : createIter(KEY),
      values: values
    });
  }
}
function iterResult(done, value){
  return {value: value, done: !!done};
}
function isIterable(it){
  var O      = Object(it)
    , Symbol = global[SYMBOL]
    , hasExt = (Symbol && Symbol[ITERATOR] || FF_ITERATOR) in O;
  return hasExt || SYMBOL_ITERATOR in O || has(Iterators, classof(O));
}
function getIterator(it){
  var Symbol  = global[SYMBOL]
    , ext     = it[Symbol && Symbol[ITERATOR] || FF_ITERATOR]
    , getIter = ext || it[SYMBOL_ITERATOR] || Iterators[classof(it)];
  return assertObject(getIter.call(it));
}
function stepCall(fn, value, entries){
  return entries ? invoke(fn, value) : fn(value);
}
function checkDangerIterClosing(fn){
  var danger = true;
  var O = {
    next: function(){ throw 1 },
    'return': function(){ danger = false }
  };
  O[SYMBOL_ITERATOR] = returnThis;
  try {
    fn(O);
  } catch(e){}
  return danger;
}
function closeIterator(iterator){
  var ret = iterator['return'];
  if(ret !== undefined)ret.call(iterator);
}
function safeIterClose(exec, iterator){
  try {
    exec(iterator);
  } catch(e){
    closeIterator(iterator);
    throw e;
  }
}
function forOf(iterable, entries, fn, that){
  safeIterClose(function(iterator){
    var f = ctx(fn, that, entries ? 2 : 1)
      , step;
    while(!(step = iterator.next()).done)if(stepCall(f, step.value, entries) === false){
      return closeIterator(iterator);
    }
  }, getIterator(iterable));
}

/******************************************************************************
 * Module : es6.symbol                                                        *
 ******************************************************************************/

// ECMAScript 6 symbols shim
!function(TAG, SymbolRegistry, AllSymbols, setter){
  // 19.4.1.1 Symbol([description])
  if(!isNative(Symbol)){
    Symbol = function(description){
      assert(!(this instanceof Symbol), SYMBOL + ' is not a ' + CONSTRUCTOR);
      var tag = uid(description)
        , sym = set(create(Symbol[PROTOTYPE]), TAG, tag);
      AllSymbols[tag] = sym;
      DESC && setter && defineProperty(ObjectProto, tag, {
        configurable: true,
        set: function(value){
          hidden(this, tag, value);
        }
      });
      return sym;
    }
    hidden(Symbol[PROTOTYPE], TO_STRING, function(){
      return this[TAG];
    });
  }
  $define(GLOBAL + WRAP, {Symbol: Symbol});
  
  var symbolStatics = {
    // 19.4.2.1 Symbol.for(key)
    'for': function(key){
      return has(SymbolRegistry, key += '')
        ? SymbolRegistry[key]
        : SymbolRegistry[key] = Symbol(key);
    },
    // 19.4.2.4 Symbol.iterator
    iterator: SYMBOL_ITERATOR || getWellKnownSymbol(ITERATOR),
    // 19.4.2.5 Symbol.keyFor(sym)
    keyFor: part.call(keyOf, SymbolRegistry),
    // 19.4.2.10 Symbol.species
    species: SYMBOL_SPECIES,
    // 19.4.2.13 Symbol.toStringTag
    toStringTag: SYMBOL_TAG = getWellKnownSymbol(TO_STRING_TAG, true),
    // 19.4.2.14 Symbol.unscopables
    unscopables: SYMBOL_UNSCOPABLES,
    pure: safeSymbol,
    set: set,
    useSetter: function(){setter = true},
    useSimple: function(){setter = false}
  };
  // 19.4.2.2 Symbol.hasInstance
  // 19.4.2.3 Symbol.isConcatSpreadable
  // 19.4.2.6 Symbol.match
  // 19.4.2.8 Symbol.replace
  // 19.4.2.9 Symbol.search
  // 19.4.2.11 Symbol.split
  // 19.4.2.12 Symbol.toPrimitive
  forEach.call(array('hasInstance,isConcatSpreadable,match,replace,search,split,toPrimitive'),
    function(it){
      symbolStatics[it] = getWellKnownSymbol(it);
    }
  );
  $define(STATIC, SYMBOL, symbolStatics);
  
  setToStringTag(Symbol, SYMBOL);
  
  $define(STATIC + FORCED * !isNative(Symbol), OBJECT, {
    // 19.1.2.7 Object.getOwnPropertyNames(O)
    getOwnPropertyNames: function(it){
      var names = getNames(toObject(it)), result = [], key, i = 0;
      while(names.length > i)has(AllSymbols, key = names[i++]) || result.push(key);
      return result;
    },
    // 19.1.2.8 Object.getOwnPropertySymbols(O)
    getOwnPropertySymbols: function(it){
      var names = getNames(toObject(it)), result = [], key, i = 0;
      while(names.length > i)has(AllSymbols, key = names[i++]) && result.push(AllSymbols[key]);
      return result;
    }
  });
  
  // 20.2.1.9 Math[@@toStringTag]
  setToStringTag(Math, MATH, true);
  // 24.3.3 JSON[@@toStringTag]
  setToStringTag(global.JSON, 'JSON', true);
}(safeSymbol('tag'), {}, {}, true);

/******************************************************************************
 * Module : es6.object.statics                                                *
 ******************************************************************************/

!function(){
  var objectStatic = {
    // 19.1.3.1 Object.assign(target, source)
    assign: assign,
    // 19.1.3.10 Object.is(value1, value2)
    is: function(x, y){
      return x === y ? x !== 0 || 1 / x === 1 / y : x != x && y != y;
    }
  };
  // 19.1.3.19 Object.setPrototypeOf(O, proto)
  // Works with __proto__ only. Old v8 can't works with null proto objects.
  '__proto__' in ObjectProto && function(buggy, set){
    try {
      set = ctx(call, getOwnDescriptor(ObjectProto, '__proto__').set, 2);
      set({}, ArrayProto);
    } catch(e){ buggy = true }
    objectStatic.setPrototypeOf = setPrototypeOf = setPrototypeOf || function(O, proto){
      assertObject(O);
      assert(proto === null || isObject(proto), proto, ": can't set as prototype!");
      if(buggy)O.__proto__ = proto;
      else set(O, proto);
      return O;
    }
  }();
  $define(STATIC, OBJECT, objectStatic);
}();

/******************************************************************************
 * Module : es6.object.statics-accept-primitives                              *
 ******************************************************************************/

!function(){
  // Object static methods accept primitives
  function wrapObjectMethod(key, MODE){
    var fn  = Object[key]
      , exp = core[OBJECT][key]
      , f   = 0
      , o   = {};
    if(!exp || isNative(exp)){
      o[key] = MODE == 1 ? function(it){
        return isObject(it) ? fn(it) : it;
      } : MODE == 2 ? function(it){
        return isObject(it) ? fn(it) : true;
      } : MODE == 3 ? function(it){
        return isObject(it) ? fn(it) : false;
      } : MODE == 4 ? function(it, key){
        return fn(toObject(it), key);
      } : function(it){
        return fn(toObject(it));
      };
      try { fn(DOT) }
      catch(e){ f = 1 }
      $define(STATIC + FORCED * f, OBJECT, o);
    }
  }
  wrapObjectMethod('freeze', 1);
  wrapObjectMethod('seal', 1);
  wrapObjectMethod('preventExtensions', 1);
  wrapObjectMethod('isFrozen', 2);
  wrapObjectMethod('isSealed', 2);
  wrapObjectMethod('isExtensible', 3);
  wrapObjectMethod('getOwnPropertyDescriptor', 4);
  wrapObjectMethod('getPrototypeOf');
  wrapObjectMethod('keys');
  wrapObjectMethod('getOwnPropertyNames');
}();

/******************************************************************************
 * Module : es6.number.statics                                                *
 ******************************************************************************/

!function(isInteger){
  $define(STATIC, NUMBER, {
    // 20.1.2.1 Number.EPSILON
    EPSILON: pow(2, -52),
    // 20.1.2.2 Number.isFinite(number)
    isFinite: function(it){
      return typeof it == 'number' && isFinite(it);
    },
    // 20.1.2.3 Number.isInteger(number)
    isInteger: isInteger,
    // 20.1.2.4 Number.isNaN(number)
    isNaN: sameNaN,
    // 20.1.2.5 Number.isSafeInteger(number)
    isSafeInteger: function(number){
      return isInteger(number) && abs(number) <= MAX_SAFE_INTEGER;
    },
    // 20.1.2.6 Number.MAX_SAFE_INTEGER
    MAX_SAFE_INTEGER: MAX_SAFE_INTEGER,
    // 20.1.2.10 Number.MIN_SAFE_INTEGER
    MIN_SAFE_INTEGER: -MAX_SAFE_INTEGER,
    // 20.1.2.12 Number.parseFloat(string)
    parseFloat: parseFloat,
    // 20.1.2.13 Number.parseInt(string, radix)
    parseInt: parseInt
  });
// 20.1.2.3 Number.isInteger(number)
}(Number.isInteger || function(it){
  return !isObject(it) && isFinite(it) && floor(it) === it;
});

/******************************************************************************
 * Module : es6.math                                                          *
 ******************************************************************************/

// ECMAScript 6 shim
!function(){
  // 20.2.2.28 Math.sign(x)
  var E    = Math.E
    , exp  = Math.exp
    , log  = Math.log
    , sqrt = Math.sqrt
    , sign = Math.sign || function(x){
        return (x = +x) == 0 || x != x ? x : x < 0 ? -1 : 1;
      };
  
  // 20.2.2.5 Math.asinh(x)
  function asinh(x){
    return !isFinite(x = +x) || x == 0 ? x : x < 0 ? -asinh(-x) : log(x + sqrt(x * x + 1));
  }
  // 20.2.2.14 Math.expm1(x)
  function expm1(x){
    return (x = +x) == 0 ? x : x > -1e-6 && x < 1e-6 ? x + x * x / 2 : exp(x) - 1;
  }
    
  $define(STATIC, MATH, {
    // 20.2.2.3 Math.acosh(x)
    acosh: function(x){
      return (x = +x) < 1 ? NaN : isFinite(x) ? log(x / E + sqrt(x + 1) * sqrt(x - 1) / E) + 1 : x;
    },
    // 20.2.2.5 Math.asinh(x)
    asinh: asinh,
    // 20.2.2.7 Math.atanh(x)
    atanh: function(x){
      return (x = +x) == 0 ? x : log((1 + x) / (1 - x)) / 2;
    },
    // 20.2.2.9 Math.cbrt(x)
    cbrt: function(x){
      return sign(x = +x) * pow(abs(x), 1 / 3);
    },
    // 20.2.2.11 Math.clz32(x)
    clz32: function(x){
      return (x >>>= 0) ? 32 - x[TO_STRING](2).length : 32;
    },
    // 20.2.2.12 Math.cosh(x)
    cosh: function(x){
      return (exp(x = +x) + exp(-x)) / 2;
    },
    // 20.2.2.14 Math.expm1(x)
    expm1: expm1,
    // 20.2.2.16 Math.fround(x)
    // TODO: fallback for IE9-
    fround: function(x){
      return new Float32Array([x])[0];
    },
    // 20.2.2.17 Math.hypot([value1[, value2[, … ]]])
    hypot: function(value1, value2){
      var sum  = 0
        , len1 = arguments.length
        , len2 = len1
        , args = Array(len1)
        , larg = -Infinity
        , arg;
      while(len1--){
        arg = args[len1] = +arguments[len1];
        if(arg == Infinity || arg == -Infinity)return Infinity;
        if(arg > larg)larg = arg;
      }
      larg = arg || 1;
      while(len2--)sum += pow(args[len2] / larg, 2);
      return larg * sqrt(sum);
    },
    // 20.2.2.18 Math.imul(x, y)
    imul: function(x, y){
      var UInt16 = 0xffff
        , xn = +x
        , yn = +y
        , xl = UInt16 & xn
        , yl = UInt16 & yn;
      return 0 | xl * yl + ((UInt16 & xn >>> 16) * yl + xl * (UInt16 & yn >>> 16) << 16 >>> 0);
    },
    // 20.2.2.20 Math.log1p(x)
    log1p: function(x){
      return (x = +x) > -1e-8 && x < 1e-8 ? x - x * x / 2 : log(1 + x);
    },
    // 20.2.2.21 Math.log10(x)
    log10: function(x){
      return log(x) / Math.LN10;
    },
    // 20.2.2.22 Math.log2(x)
    log2: function(x){
      return log(x) / Math.LN2;
    },
    // 20.2.2.28 Math.sign(x)
    sign: sign,
    // 20.2.2.30 Math.sinh(x)
    sinh: function(x){
      return (abs(x = +x) < 1) ? (expm1(x) - expm1(-x)) / 2 : (exp(x - 1) - exp(-x - 1)) * (E / 2);
    },
    // 20.2.2.33 Math.tanh(x)
    tanh: function(x){
      var a = expm1(x = +x)
        , b = expm1(-x);
      return a == Infinity ? 1 : b == Infinity ? -1 : (a - b) / (exp(x) + exp(-x));
    },
    // 20.2.2.34 Math.trunc(x)
    trunc: trunc
  });
}();

/******************************************************************************
 * Module : es6.string                                                        *
 ******************************************************************************/

!function(fromCharCode){
  function assertNotRegExp(it){
    if(cof(it) == REGEXP)throw TypeError();
  }
  
  $define(STATIC, STRING, {
    // 21.1.2.2 String.fromCodePoint(...codePoints)
    fromCodePoint: function(x){
      var res = []
        , len = arguments.length
        , i   = 0
        , code
      while(len > i){
        code = +arguments[i++];
        if(toIndex(code, 0x10ffff) !== code)throw RangeError(code + ' is not a valid code point');
        res.push(code < 0x10000
          ? fromCharCode(code)
          : fromCharCode(((code -= 0x10000) >> 10) + 0xd800, code % 0x400 + 0xdc00)
        );
      } return res.join('');
    },
    // 21.1.2.4 String.raw(callSite, ...substitutions)
    raw: function(callSite){
      var raw = toObject(callSite.raw)
        , len = toLength(raw.length)
        , sln = arguments.length
        , res = []
        , i   = 0;
      while(len > i){
        res.push(String(raw[i++]));
        if(i < sln)res.push(String(arguments[i]));
      } return res.join('');
    }
  });
  
  $define(PROTO, STRING, {
    // 21.1.3.3 String.prototype.codePointAt(pos)
    codePointAt: createPointAt(false),
    // 21.1.3.6 String.prototype.endsWith(searchString [, endPosition])
    endsWith: function(searchString /*, endPosition = @length */){
      assertNotRegExp(searchString);
      var that = String(assertDefined(this))
        , endPosition = arguments[1]
        , len = toLength(that.length)
        , end = endPosition === undefined ? len : min(toLength(endPosition), len);
      searchString += '';
      return that.slice(end - searchString.length, end) === searchString;
    },
    // 21.1.3.7 String.prototype.includes(searchString, position = 0)
    includes: function(searchString /*, position = 0 */){
      assertNotRegExp(searchString);
      return !!~String(assertDefined(this)).indexOf(searchString, arguments[1]);
    },
    // 21.1.3.13 String.prototype.repeat(count)
    repeat: function(count){
      var str = String(assertDefined(this))
        , res = ''
        , n   = toInteger(count);
      if(0 > n || n == Infinity)throw RangeError("Count can't be negative");
      for(;n > 0; (n >>>= 1) && (str += str))if(n & 1)res += str;
      return res;
    },
    // 21.1.3.18 String.prototype.startsWith(searchString [, position ])
    startsWith: function(searchString /*, position = 0 */){
      assertNotRegExp(searchString);
      var that  = String(assertDefined(this))
        , index = toLength(min(arguments[1], that.length));
      searchString += '';
      return that.slice(index, index + searchString.length) === searchString;
    }
  });
}(String.fromCharCode);

/******************************************************************************
 * Module : es6.array.statics                                                 *
 ******************************************************************************/

!function(){
  $define(STATIC + FORCED * checkDangerIterClosing(Array.from), ARRAY, {
    // 22.1.2.1 Array.from(arrayLike, mapfn = undefined, thisArg = undefined)
    from: function(arrayLike/*, mapfn = undefined, thisArg = undefined*/){
      var O       = Object(assertDefined(arrayLike))
        , mapfn   = arguments[1]
        , mapping = mapfn !== undefined
        , f       = mapping ? ctx(mapfn, arguments[2], 2) : undefined
        , index   = 0
        , length, result, step;
      if(isIterable(O)){
        result = new (generic(this, Array));
        safeIterClose(function(iterator){
          for(; !(step = iterator.next()).done; index++){
            result[index] = mapping ? f(step.value, index) : step.value;
          }
        }, getIterator(O));
      } else {
        result = new (generic(this, Array))(length = toLength(O.length));
        for(; length > index; index++){
          result[index] = mapping ? f(O[index], index) : O[index];
        }
      }
      result.length = index;
      return result;
    }
  });
  
  $define(STATIC, ARRAY, {
    // 22.1.2.3 Array.of( ...items)
    of: function(/* ...args */){
      var index  = 0
        , length = arguments.length
        , result = new (generic(this, Array))(length);
      while(length > index)result[index] = arguments[index++];
      result.length = length;
      return result;
    }
  });
  
  setSpecies(Array);
}();

/******************************************************************************
 * Module : es6.array.prototype                                               *
 ******************************************************************************/

!function(){
  $define(PROTO, ARRAY, {
    // 22.1.3.3 Array.prototype.copyWithin(target, start, end = this.length)
    copyWithin: function(target /* = 0 */, start /* = 0, end = @length */){
      var O     = Object(assertDefined(this))
        , len   = toLength(O.length)
        , to    = toIndex(target, len)
        , from  = toIndex(start, len)
        , end   = arguments[2]
        , fin   = end === undefined ? len : toIndex(end, len)
        , count = min(fin - from, len - to)
        , inc   = 1;
      if(from < to && to < from + count){
        inc  = -1;
        from = from + count - 1;
        to   = to + count - 1;
      }
      while(count-- > 0){
        if(from in O)O[to] = O[from];
        else delete O[to];
        to += inc;
        from += inc;
      } return O;
    },
    // 22.1.3.6 Array.prototype.fill(value, start = 0, end = this.length)
    fill: function(value /*, start = 0, end = @length */){
      var O      = Object(assertDefined(this))
        , length = toLength(O.length)
        , index  = toIndex(arguments[1], length)
        , end    = arguments[2]
        , endPos = end === undefined ? length : toIndex(end, length);
      while(endPos > index)O[index++] = value;
      return O;
    },
    // 22.1.3.8 Array.prototype.find(predicate, thisArg = undefined)
    find: createArrayMethod(5),
    // 22.1.3.9 Array.prototype.findIndex(predicate, thisArg = undefined)
    findIndex: createArrayMethod(6)
  });
  
  if(framework){
    // 22.1.3.31 Array.prototype[@@unscopables]
    forEach.call(array('find,findIndex,fill,copyWithin,entries,keys,values'), function(it){
      ArrayUnscopables[it] = true;
    });
    SYMBOL_UNSCOPABLES in ArrayProto || hidden(ArrayProto, SYMBOL_UNSCOPABLES, ArrayUnscopables);
  }
}();

/******************************************************************************
 * Module : es6.iterators                                                     *
 ******************************************************************************/

!function(at){
  // 22.1.3.4 Array.prototype.entries()
  // 22.1.3.13 Array.prototype.keys()
  // 22.1.3.29 Array.prototype.values()
  // 22.1.3.30 Array.prototype[@@iterator]()
  defineStdIterators(Array, ARRAY, function(iterated, kind){
    set(this, ITER, {o: toObject(iterated), i: 0, k: kind});
  // 22.1.5.2.1 %ArrayIteratorPrototype%.next()
  }, function(){
    var iter  = this[ITER]
      , O     = iter.o
      , kind  = iter.k
      , index = iter.i++;
    if(!O || index >= O.length){
      iter.o = undefined;
      return iterResult(1);
    }
    if(kind == KEY)  return iterResult(0, index);
    if(kind == VALUE)return iterResult(0, O[index]);
                     return iterResult(0, [index, O[index]]);
  }, VALUE);
  
  // argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
  Iterators[ARGUMENTS] = Iterators[ARRAY];
  
  // 21.1.3.27 String.prototype[@@iterator]()
  defineStdIterators(String, STRING, function(iterated){
    set(this, ITER, {o: String(iterated), i: 0});
  // 21.1.5.2.1 %StringIteratorPrototype%.next()
  }, function(){
    var iter  = this[ITER]
      , O     = iter.o
      , index = iter.i
      , point;
    if(index >= O.length)return iterResult(1);
    point = at.call(O, index);
    iter.i += point.length;
    return iterResult(0, point);
  });
}(createPointAt(true));

/******************************************************************************
 * Module : web.immediate                                                     *
 ******************************************************************************/

// setImmediate shim
// Node.js 0.9+ & IE10+ has setImmediate, else:
isFunction(setImmediate) && isFunction(clearImmediate) || function(ONREADYSTATECHANGE){
  var postMessage      = global.postMessage
    , addEventListener = global.addEventListener
    , MessageChannel   = global.MessageChannel
    , counter          = 0
    , queue            = {}
    , defer, channel, port;
  setImmediate = function(fn){
    var args = [], i = 1;
    while(arguments.length > i)args.push(arguments[i++]);
    queue[++counter] = function(){
      invoke(isFunction(fn) ? fn : Function(fn), args);
    }
    defer(counter);
    return counter;
  }
  clearImmediate = function(id){
    delete queue[id];
  }
  function run(id){
    if(has(queue, id)){
      var fn = queue[id];
      delete queue[id];
      fn();
    }
  }
  function listner(event){
    run(event.data);
  }
  // Node.js 0.8-
  if(NODE){
    defer = function(id){
      nextTick(part.call(run, id));
    }
  // Modern browsers, skip implementation for WebWorkers
  // IE8 has postMessage, but it's sync & typeof its postMessage is object
  } else if(addEventListener && isFunction(postMessage) && !global.importScripts){
    defer = function(id){
      postMessage(id, '*');
    }
    addEventListener('message', listner, false);
  // WebWorkers
  } else if(isFunction(MessageChannel)){
    channel = new MessageChannel;
    port    = channel.port2;
    channel.port1.onmessage = listner;
    defer = ctx(port.postMessage, port, 1);
  // IE8-
  } else if(document && ONREADYSTATECHANGE in document[CREATE_ELEMENT]('script')){
    defer = function(id){
      html.appendChild(document[CREATE_ELEMENT]('script'))[ONREADYSTATECHANGE] = function(){
        html.removeChild(this);
        run(id);
      }
    }
  // Rest old browsers
  } else {
    defer = function(id){
      setTimeout(run, 0, id);
    }
  }
}('onreadystatechange');
$define(GLOBAL + BIND, {
  setImmediate:   setImmediate,
  clearImmediate: clearImmediate
});

/******************************************************************************
 * Module : es6.promise                                                       *
 ******************************************************************************/

// ES6 promises shim
// Based on https://github.com/getify/native-promise-only/
!function(Promise, test){
  isFunction(Promise) && isFunction(Promise.resolve)
  && Promise.resolve(test = new Promise(function(){})) == test
  || function(asap, RECORD){
    function isThenable(it){
      var then;
      if(isObject(it))then = it.then;
      return isFunction(then) ? then : false;
    }
    function handledRejectionOrHasOnRejected(promise){
      var record = promise[RECORD]
        , chain  = record.c
        , i      = 0
        , react;
      if(record.h)return true;
      while(chain.length > i){
        react = chain[i++];
        if(react.fail || handledRejectionOrHasOnRejected(react.P))return true;
      }
    }
    function notify(record, reject){
      var chain = record.c;
      if(reject || chain.length)asap(function(){
        var promise = record.p
          , value   = record.v
          , ok      = record.s == 1
          , i       = 0;
        if(reject && !handledRejectionOrHasOnRejected(promise)){
          setTimeout(function(){
            if(!handledRejectionOrHasOnRejected(promise)){
              if(NODE){
                if(!process.emit('unhandledRejection', value, promise)){
                  // default node.js behavior
                }
              } else if(isFunction(console.error)){
                console.error('Unhandled promise rejection', value);
              }
            }
          }, 1e3);
        } else while(chain.length > i)!function(react){
          var cb = ok ? react.ok : react.fail
            , ret, then;
          try {
            if(cb){
              if(!ok)record.h = true;
              ret = cb === true ? value : cb(value);
              if(ret === react.P){
                react.rej(TypeError(PROMISE + '-chain cycle'));
              } else if(then = isThenable(ret)){
                then.call(ret, react.res, react.rej);
              } else react.res(ret);
            } else react.rej(value);
          } catch(err){
            react.rej(err);
          }
        }(chain[i++]);
        chain.length = 0;
      });
    }
    function resolve(value){
      var record = this
        , then, wrapper;
      if(record.d)return;
      record.d = true;
      record = record.r || record; // unwrap
      try {
        if(then = isThenable(value)){
          wrapper = {r: record, d: false}; // wrap
          then.call(value, ctx(resolve, wrapper, 1), ctx(reject, wrapper, 1));
        } else {
          record.v = value;
          record.s = 1;
          notify(record);
        }
      } catch(err){
        reject.call(wrapper || {r: record, d: false}, err); // wrap
      }
    }
    function reject(value){
      var record = this;
      if(record.d)return;
      record.d = true;
      record = record.r || record; // unwrap
      record.v = value;
      record.s = 2;
      notify(record, true);
    }
    function getConstructor(C){
      var S = assertObject(C)[SYMBOL_SPECIES];
      return S != undefined ? S : C;
    }
    // 25.4.3.1 Promise(executor)
    Promise = function(executor){
      assertFunction(executor);
      assertInstance(this, Promise, PROMISE);
      var record = {
        p: this,      // promise
        c: [],        // chain
        s: 0,         // state
        d: false,     // done
        v: undefined, // value
        h: false      // handled rejection
      };
      hidden(this, RECORD, record);
      try {
        executor(ctx(resolve, record, 1), ctx(reject, record, 1));
      } catch(err){
        reject.call(record, err);
      }
    }
    assignHidden(Promise[PROTOTYPE], {
      // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
      then: function(onFulfilled, onRejected){
        var S = assertObject(assertObject(this)[CONSTRUCTOR])[SYMBOL_SPECIES];
        var react = {
          ok:   isFunction(onFulfilled) ? onFulfilled : true,
          fail: isFunction(onRejected)  ? onRejected  : false
        } , P = react.P = new (S != undefined ? S : Promise)(function(resolve, reject){
          react.res = assertFunction(resolve);
          react.rej = assertFunction(reject);
        }), record = this[RECORD];
        record.c.push(react);
        record.s && notify(record);
        return P;
      },
      // 25.4.5.1 Promise.prototype.catch(onRejected)
      'catch': function(onRejected){
        return this.then(undefined, onRejected);
      }
    });
    assignHidden(Promise, {
      // 25.4.4.1 Promise.all(iterable)
      all: function(iterable){
        var Promise = getConstructor(this)
          , values  = [];
        return new Promise(function(resolve, reject){
          forOf(iterable, false, push, values);
          var remaining = values.length
            , results   = Array(remaining);
          if(remaining)forEach.call(values, function(promise, index){
            Promise.resolve(promise).then(function(value){
              results[index] = value;
              --remaining || resolve(results);
            }, reject);
          });
          else resolve(results);
        });
      },
      // 25.4.4.4 Promise.race(iterable)
      race: function(iterable){
        var Promise = getConstructor(this);
        return new Promise(function(resolve, reject){
          forOf(iterable, false, function(promise){
            Promise.resolve(promise).then(resolve, reject);
          });
        });
      },
      // 25.4.4.5 Promise.reject(r)
      reject: function(r){
        return new (getConstructor(this))(function(resolve, reject){
          reject(r);
        });
      },
      // 25.4.4.6 Promise.resolve(x)
      resolve: function(x){
        return isObject(x) && RECORD in x && getPrototypeOf(x) === this[PROTOTYPE]
          ? x : new (getConstructor(this))(function(resolve, reject){
            resolve(x);
          });
      }
    });
  }(nextTick || setImmediate, safeSymbol('record'));
  setToStringTag(Promise, PROMISE);
  setSpecies(Promise);
  $define(GLOBAL + FORCED * !isNative(Promise), {Promise: Promise});
}(global[PROMISE]);

/******************************************************************************
 * Module : es6.collections                                                   *
 ******************************************************************************/

// ECMAScript 6 collections shim
!function(){
  var UID   = safeSymbol('uid')
    , O1    = safeSymbol('O1')
    , WEAK  = safeSymbol('weak')
    , LEAK  = safeSymbol('leak')
    , LAST  = safeSymbol('last')
    , FIRST = safeSymbol('first')
    , SIZE  = DESC ? safeSymbol('size') : 'size'
    , uid   = 0
    , tmp   = {};
  
  function getCollection(C, NAME, methods, commonMethods, isMap, isWeak){
    var ADDER = isMap ? 'set' : 'add'
      , proto = C && C[PROTOTYPE]
      , O     = {};
    function initFromIterable(that, iterable){
      if(iterable != undefined)forOf(iterable, isMap, that[ADDER], that);
      return that;
    }
    function fixSVZ(key, chain){
      var method = proto[key];
      if(framework)proto[key] = function(a, b){
        var result = method.call(this, a === 0 ? 0 : a, b);
        return chain ? this : result;
      };
    }
    if(!isNative(C) || !(isWeak || (!BUGGY_ITERATORS && has(proto, FOR_EACH) && has(proto, 'entries')))){
      // create collection constructor
      C = isWeak
        ? function(iterable){
            assertInstance(this, C, NAME);
            set(this, UID, uid++);
            initFromIterable(this, iterable);
          }
        : function(iterable){
            var that = this;
            assertInstance(that, C, NAME);
            set(that, O1, create(null));
            set(that, SIZE, 0);
            set(that, LAST, undefined);
            set(that, FIRST, undefined);
            initFromIterable(that, iterable);
          };
      assignHidden(assignHidden(C[PROTOTYPE], methods), commonMethods);
      isWeak || !DESC || defineProperty(C[PROTOTYPE], 'size', {get: function(){
        return assertDefined(this[SIZE]);
      }});
    } else {
      var Native = C
        , inst   = new C
        , chain  = inst[ADDER](isWeak ? {} : -0, 1)
        , buggyZero;
      // wrap to init collections from iterable
      if(checkDangerIterClosing(function(O){ new C(O) })){
        C = function(iterable){
          assertInstance(this, C, NAME);
          return initFromIterable(new Native, iterable);
        }
        C[PROTOTYPE] = proto;
        if(framework)proto[CONSTRUCTOR] = C;
      }
      isWeak || inst[FOR_EACH](function(val, key){
        buggyZero = 1 / key === -Infinity;
      });
      // fix converting -0 key to +0
      if(buggyZero){
        fixSVZ('delete');
        fixSVZ('has');
        isMap && fixSVZ('get');
      }
      // + fix .add & .set for chaining
      if(buggyZero || chain !== inst)fixSVZ(ADDER, true);
    }
    setToStringTag(C, NAME);
    setSpecies(C);
    
    O[NAME] = C;
    $define(GLOBAL + WRAP + FORCED * !isNative(C), O);
    
    // add .keys, .values, .entries, [@@iterator]
    // 23.1.3.4, 23.1.3.8, 23.1.3.11, 23.1.3.12, 23.2.3.5, 23.2.3.8, 23.2.3.10, 23.2.3.11
    isWeak || defineStdIterators(C, NAME, function(iterated, kind){
      set(this, ITER, {o: iterated, k: kind});
    }, function(){
      var iter  = this[ITER]
        , kind  = iter.k
        , entry = iter.l;
      // revert to the last existing entry
      while(entry && entry.r)entry = entry.p;
      // get next entry
      if(!iter.o || !(iter.l = entry = entry ? entry.n : iter.o[FIRST])){
        // or finish the iteration
        iter.o = undefined;
        return iterResult(1);
      }
      // return step by kind
      if(kind == KEY)  return iterResult(0, entry.k);
      if(kind == VALUE)return iterResult(0, entry.v);
                       return iterResult(0, [entry.k, entry.v]);   
    }, isMap ? KEY+VALUE : VALUE, !isMap);
    
    return C;
  }
  
  function fastKey(it, create){
    // return primitive with prefix
    if(!isObject(it))return (typeof it == 'string' ? 'S' : 'P') + it;
    // can't set id to frozen object
    if(isFrozen(it))return 'F';
    if(!has(it, UID)){
      // not necessary to add id
      if(!create)return 'E';
      // add missing object id
      hidden(it, UID, ++uid);
    // return object id with prefix
    } return 'O' + it[UID];
  }
  function getEntry(that, key){
    // fast case
    var index = fastKey(key), entry;
    if(index != 'F')return that[O1][index];
    // frozen object case
    for(entry = that[FIRST]; entry; entry = entry.n){
      if(entry.k == key)return entry;
    }
  }
  function def(that, key, value){
    var entry = getEntry(that, key)
      , prev, index;
    // change existing entry
    if(entry)entry.v = value;
    // create new entry
    else {
      that[LAST] = entry = {
        i: index = fastKey(key, true), // <- index
        k: key,                        // <- key
        v: value,                      // <- value
        p: prev = that[LAST],          // <- previous entry
        n: undefined,                  // <- next entry
        r: false                       // <- removed
      };
      if(!that[FIRST])that[FIRST] = entry;
      if(prev)prev.n = entry;
      that[SIZE]++;
      // add to index
      if(index != 'F')that[O1][index] = entry;
    } return that;
  }

  var collectionMethods = {
    // 23.1.3.1 Map.prototype.clear()
    // 23.2.3.2 Set.prototype.clear()
    clear: function(){
      for(var that = this, data = that[O1], entry = that[FIRST]; entry; entry = entry.n){
        entry.r = true;
        if(entry.p)entry.p = entry.p.n = undefined;
        delete data[entry.i];
      }
      that[FIRST] = that[LAST] = undefined;
      that[SIZE] = 0;
    },
    // 23.1.3.3 Map.prototype.delete(key)
    // 23.2.3.4 Set.prototype.delete(value)
    'delete': function(key){
      var that  = this
        , entry = getEntry(that, key);
      if(entry){
        var next = entry.n
          , prev = entry.p;
        delete that[O1][entry.i];
        entry.r = true;
        if(prev)prev.n = next;
        if(next)next.p = prev;
        if(that[FIRST] == entry)that[FIRST] = next;
        if(that[LAST] == entry)that[LAST] = prev;
        that[SIZE]--;
      } return !!entry;
    },
    // 23.2.3.6 Set.prototype.forEach(callbackfn, thisArg = undefined)
    // 23.1.3.5 Map.prototype.forEach(callbackfn, thisArg = undefined)
    forEach: function(callbackfn /*, that = undefined */){
      var f = ctx(callbackfn, arguments[1], 3)
        , entry;
      while(entry = entry ? entry.n : this[FIRST]){
        f(entry.v, entry.k, this);
        // revert to the last existing entry
        while(entry && entry.r)entry = entry.p;
      }
    },
    // 23.1.3.7 Map.prototype.has(key)
    // 23.2.3.7 Set.prototype.has(value)
    has: function(key){
      return !!getEntry(this, key);
    }
  }
  
  // 23.1 Map Objects
  Map = getCollection(Map, MAP, {
    // 23.1.3.6 Map.prototype.get(key)
    get: function(key){
      var entry = getEntry(this, key);
      return entry && entry.v;
    },
    // 23.1.3.9 Map.prototype.set(key, value)
    set: function(key, value){
      return def(this, key === 0 ? 0 : key, value);
    }
  }, collectionMethods, true);
  
  // 23.2 Set Objects
  Set = getCollection(Set, SET, {
    // 23.2.3.1 Set.prototype.add(value)
    add: function(value){
      return def(this, value = value === 0 ? 0 : value, value);
    }
  }, collectionMethods);
  
  function defWeak(that, key, value){
    if(isFrozen(assertObject(key)))leakStore(that).set(key, value);
    else {
      has(key, WEAK) || hidden(key, WEAK, {});
      key[WEAK][that[UID]] = value;
    } return that;
  }
  function leakStore(that){
    return that[LEAK] || hidden(that, LEAK, new Map)[LEAK];
  }
  
  var weakMethods = {
    // 23.3.3.2 WeakMap.prototype.delete(key)
    // 23.4.3.3 WeakSet.prototype.delete(value)
    'delete': function(key){
      if(!isObject(key))return false;
      if(isFrozen(key))return leakStore(this)['delete'](key);
      return has(key, WEAK) && has(key[WEAK], this[UID]) && delete key[WEAK][this[UID]];
    },
    // 23.3.3.4 WeakMap.prototype.has(key)
    // 23.4.3.4 WeakSet.prototype.has(value)
    has: function(key){
      if(!isObject(key))return false;
      if(isFrozen(key))return leakStore(this).has(key);
      return has(key, WEAK) && has(key[WEAK], this[UID]);
    }
  };
  
  // 23.3 WeakMap Objects
  WeakMap = getCollection(WeakMap, WEAKMAP, {
    // 23.3.3.3 WeakMap.prototype.get(key)
    get: function(key){
      if(isObject(key)){
        if(isFrozen(key))return leakStore(this).get(key);
        if(has(key, WEAK))return key[WEAK][this[UID]];
      }
    },
    // 23.3.3.5 WeakMap.prototype.set(key, value)
    set: function(key, value){
      return defWeak(this, key, value);
    }
  }, weakMethods, true, true);
  
  // IE11 WeakMap frozen keys fix
  if(framework && new WeakMap().set(Object.freeze(tmp), 7).get(tmp) != 7){
    forEach.call(array('delete,has,get,set'), function(key){
      var method = WeakMap[PROTOTYPE][key];
      WeakMap[PROTOTYPE][key] = function(a, b){
        // store frozen objects on leaky map
        if(isObject(a) && isFrozen(a)){
          var result = leakStore(this)[key](a, b);
          return key == 'set' ? this : result;
        // store all the rest on native weakmap
        } return method.call(this, a, b);
      };
    });
  }
  
  // 23.4 WeakSet Objects
  WeakSet = getCollection(WeakSet, WEAKSET, {
    // 23.4.3.1 WeakSet.prototype.add(value)
    add: function(value){
      return defWeak(this, value, true);
    }
  }, weakMethods, false, true);
}();

/******************************************************************************
 * Module : es6.reflect                                                       *
 ******************************************************************************/

!function(){
  function Enumerate(iterated){
    var keys = [], key;
    for(key in iterated)keys.push(key);
    set(this, ITER, {o: iterated, a: keys, i: 0});
  }
  createIterator(Enumerate, OBJECT, function(){
    var iter = this[ITER]
      , keys = iter.a
      , key;
    do {
      if(iter.i >= keys.length)return iterResult(1);
    } while(!((key = keys[iter.i++]) in iter.o));
    return iterResult(0, key);
  });
  
  function wrap(fn){
    return function(it){
      assertObject(it);
      try {
        return fn.apply(undefined, arguments), true;
      } catch(e){
        return false;
      }
    }
  }
  
  function reflectGet(target, propertyKey/*, receiver*/){
    var receiver = arguments.length < 3 ? target : arguments[2]
      , desc = getOwnDescriptor(assertObject(target), propertyKey), proto;
    if(desc)return has(desc, 'value')
      ? desc.value
      : desc.get === undefined
        ? undefined
        : desc.get.call(receiver);
    return isObject(proto = getPrototypeOf(target))
      ? reflectGet(proto, propertyKey, receiver)
      : undefined;
  }
  function reflectSet(target, propertyKey, V/*, receiver*/){
    var receiver = arguments.length < 4 ? target : arguments[3]
      , ownDesc  = getOwnDescriptor(assertObject(target), propertyKey)
      , existingDescriptor, proto;
    if(!ownDesc){
      if(isObject(proto = getPrototypeOf(target))){
        return reflectSet(proto, propertyKey, V, receiver);
      }
      ownDesc = descriptor(0);
    }
    if(has(ownDesc, 'value')){
      if(ownDesc.writable === false || !isObject(receiver))return false;
      existingDescriptor = getOwnDescriptor(receiver, propertyKey) || descriptor(0);
      existingDescriptor.value = V;
      return defineProperty(receiver, propertyKey, existingDescriptor), true;
    }
    return ownDesc.set === undefined
      ? false
      : (ownDesc.set.call(receiver, V), true);
  }
  var isExtensible = Object.isExtensible || returnIt;
  
  var reflect = {
    // 26.1.1 Reflect.apply(target, thisArgument, argumentsList)
    apply: ctx(call, apply, 3),
    // 26.1.2 Reflect.construct(target, argumentsList [, newTarget])
    construct: function(target, argumentsList /*, newTarget*/){
      var proto    = assertFunction(arguments.length < 3 ? target : arguments[2])[PROTOTYPE]
        , instance = create(isObject(proto) ? proto : ObjectProto)
        , result   = apply.call(target, instance, argumentsList);
      return isObject(result) ? result : instance;
    },
    // 26.1.3 Reflect.defineProperty(target, propertyKey, attributes)
    defineProperty: wrap(defineProperty),
    // 26.1.4 Reflect.deleteProperty(target, propertyKey)
    deleteProperty: function(target, propertyKey){
      var desc = getOwnDescriptor(assertObject(target), propertyKey);
      return desc && !desc.configurable ? false : delete target[propertyKey];
    },
    // 26.1.5 Reflect.enumerate(target)
    enumerate: function(target){
      return new Enumerate(assertObject(target));
    },
    // 26.1.6 Reflect.get(target, propertyKey [, receiver])
    get: reflectGet,
    // 26.1.7 Reflect.getOwnPropertyDescriptor(target, propertyKey)
    getOwnPropertyDescriptor: function(target, propertyKey){
      return getOwnDescriptor(assertObject(target), propertyKey);
    },
    // 26.1.8 Reflect.getPrototypeOf(target)
    getPrototypeOf: function(target){
      return getPrototypeOf(assertObject(target));
    },
    // 26.1.9 Reflect.has(target, propertyKey)
    has: function(target, propertyKey){
      return propertyKey in target;
    },
    // 26.1.10 Reflect.isExtensible(target)
    isExtensible: function(target){
      return !!isExtensible(assertObject(target));
    },
    // 26.1.11 Reflect.ownKeys(target)
    ownKeys: ownKeys,
    // 26.1.12 Reflect.preventExtensions(target)
    preventExtensions: wrap(Object.preventExtensions || returnIt),
    // 26.1.13 Reflect.set(target, propertyKey, V [, receiver])
    set: reflectSet
  }
  // 26.1.14 Reflect.setPrototypeOf(target, proto)
  if(setPrototypeOf)reflect.setPrototypeOf = function(target, proto){
    return setPrototypeOf(assertObject(target), proto), true;
  };
  
  $define(GLOBAL, {Reflect: {}});
  $define(STATIC, 'Reflect', reflect);
}();

/******************************************************************************
 * Module : es7.proposals                                                     *
 ******************************************************************************/

!function(){
  $define(PROTO, ARRAY, {
    // https://github.com/domenic/Array.prototype.includes
    includes: createArrayContains(true)
  });
  $define(PROTO, STRING, {
    // https://github.com/mathiasbynens/String.prototype.at
    at: createPointAt(true)
  });
  
  function createObjectToArray(isEntries){
    return function(object){
      var O      = toObject(object)
        , keys   = getKeys(object)
        , length = keys.length
        , i      = 0
        , result = Array(length)
        , key;
      if(isEntries)while(length > i)result[i] = [key = keys[i++], O[key]];
      else while(length > i)result[i] = O[keys[i++]];
      return result;
    }
  }
  $define(STATIC, OBJECT, {
    // https://gist.github.com/WebReflection/9353781
    getOwnPropertyDescriptors: function(object){
      var O      = toObject(object)
        , result = {};
      forEach.call(ownKeys(O), function(key){
        defineProperty(result, key, descriptor(0, getOwnDescriptor(O, key)));
      });
      return result;
    },
    // https://github.com/rwaldron/tc39-notes/blob/master/es6/2014-04/apr-9.md#51-objectentries-objectvalues
    values:  createObjectToArray(false),
    entries: createObjectToArray(true)
  });
  $define(STATIC, REGEXP, {
    // https://gist.github.com/kangax/9698100
    escape: createReplacer(/([\\\-[\]{}()*+?.,^$|])/g, '\\$1', true)
  });
}();

/******************************************************************************
 * Module : es7.abstract-refs                                                 *
 ******************************************************************************/

// https://github.com/zenparsing/es-abstract-refs
!function(REFERENCE){
  REFERENCE_GET = getWellKnownSymbol(REFERENCE+'Get', true);
  var REFERENCE_SET = getWellKnownSymbol(REFERENCE+SET, true)
    , REFERENCE_DELETE = getWellKnownSymbol(REFERENCE+'Delete', true);
  
  $define(STATIC, SYMBOL, {
    referenceGet: REFERENCE_GET,
    referenceSet: REFERENCE_SET,
    referenceDelete: REFERENCE_DELETE
  });
  
  hidden(FunctionProto, REFERENCE_GET, returnThis);
  
  function setMapMethods(Constructor){
    if(Constructor){
      var MapProto = Constructor[PROTOTYPE];
      hidden(MapProto, REFERENCE_GET, MapProto.get);
      hidden(MapProto, REFERENCE_SET, MapProto.set);
      hidden(MapProto, REFERENCE_DELETE, MapProto['delete']);
    }
  }
  setMapMethods(Map);
  setMapMethods(WeakMap);
}('reference');

/******************************************************************************
 * Module : core.dict                                                         *
 ******************************************************************************/

!function(DICT){
  Dict = function(iterable){
    var dict = create(null);
    if(iterable != undefined){
      if(isIterable(iterable)){
        forOf(iterable, true, function(key, value){
          dict[key] = value;
        });
      } else assign(dict, iterable);
    }
    return dict;
  }
  Dict[PROTOTYPE] = null;
  
  function DictIterator(iterated, kind){
    set(this, ITER, {o: toObject(iterated), a: getKeys(iterated), i: 0, k: kind});
  }
  createIterator(DictIterator, DICT, function(){
    var iter = this[ITER]
      , O    = iter.o
      , keys = iter.a
      , kind = iter.k
      , key;
    do {
      if(iter.i >= keys.length){
        iter.o = undefined;
        return iterResult(1);
      }
    } while(!has(O, key = keys[iter.i++]));
    if(kind == KEY)  return iterResult(0, key);
    if(kind == VALUE)return iterResult(0, O[key]);
                     return iterResult(0, [key, O[key]]);
  });
  function createDictIter(kind){
    return function(it){
      return new DictIterator(it, kind);
    }
  }
  
  /*
   * 0 -> forEach
   * 1 -> map
   * 2 -> filter
   * 3 -> some
   * 4 -> every
   * 5 -> find
   * 6 -> findKey
   * 7 -> mapPairs
   */
  function createDictMethod(type){
    var isMap    = type == 1
      , isEvery  = type == 4;
    return function(object, callbackfn, that /* = undefined */){
      var f      = ctx(callbackfn, that, 3)
        , O      = toObject(object)
        , result = isMap || type == 7 || type == 2 ? new (generic(this, Dict)) : undefined
        , key, val, res;
      for(key in O)if(has(O, key)){
        val = O[key];
        res = f(val, key, object);
        if(type){
          if(isMap)result[key] = res;             // map
          else if(res)switch(type){
            case 2: result[key] = val; break      // filter
            case 3: return true;                  // some
            case 5: return val;                   // find
            case 6: return key;                   // findKey
            case 7: result[res[0]] = res[1];      // mapPairs
          } else if(isEvery)return false;         // every
        }
      }
      return type == 3 || isEvery ? isEvery : result;
    }
  }
  function createDictReduce(isTurn){
    return function(object, mapfn, init){
      assertFunction(mapfn);
      var O      = toObject(object)
        , keys   = getKeys(O)
        , length = keys.length
        , i      = 0
        , memo, key, result;
      if(isTurn)memo = init == undefined ? new (generic(this, Dict)) : Object(init);
      else if(arguments.length < 3){
        assert(length, REDUCE_ERROR);
        memo = O[keys[i++]];
      } else memo = Object(init);
      while(length > i)if(has(O, key = keys[i++])){
        result = mapfn(memo, O[key], key, object);
        if(isTurn){
          if(result === false)break;
        } else memo = result;
      }
      return memo;
    }
  }
  var findKey = createDictMethod(6);
  function includes(object, el){
    return (el == el ? keyOf(object, el) : findKey(object, sameNaN)) !== undefined;
  }
  
  var dictMethods = {
    keys:    createDictIter(KEY),
    values:  createDictIter(VALUE),
    entries: createDictIter(KEY+VALUE),
    forEach: createDictMethod(0),
    map:     createDictMethod(1),
    filter:  createDictMethod(2),
    some:    createDictMethod(3),
    every:   createDictMethod(4),
    find:    createDictMethod(5),
    findKey: findKey,
    mapPairs:createDictMethod(7),
    reduce:  createDictReduce(false),
    turn:    createDictReduce(true),
    keyOf:   keyOf,
    includes:includes,
    // Has / get / set own property
    has: has,
    get: get,
    set: createDefiner(0),
    isDict: function(it){
      return isObject(it) && getPrototypeOf(it) === Dict[PROTOTYPE];
    }
  };
  
  if(REFERENCE_GET)for(var key in dictMethods)!function(fn){
    function method(){
      for(var args = [this], i = 0; i < arguments.length;)args.push(arguments[i++]);
      return invoke(fn, args);
    }
    fn[REFERENCE_GET] = function(){
      return method;
    }
  }(dictMethods[key]);
  
  $define(GLOBAL + FORCED, {Dict: assignHidden(Dict, dictMethods)});
}('Dict');

/******************************************************************************
 * Module : core.$for                                                         *
 ******************************************************************************/

!function(ENTRIES, FN){  
  function $for(iterable, entries){
    if(!(this instanceof $for))return new $for(iterable, entries);
    this[ITER]    = getIterator(iterable);
    this[ENTRIES] = !!entries;
  }
  
  createIterator($for, 'Wrapper', function(){
    return this[ITER].next();
  });
  var $forProto = $for[PROTOTYPE];
  setIterator($forProto, function(){
    return this[ITER]; // unwrap
  });
  
  function createChainIterator(next){
    function Iter(I, fn, that){
      this[ITER]    = getIterator(I);
      this[ENTRIES] = I[ENTRIES];
      this[FN]      = ctx(fn, that, I[ENTRIES] ? 2 : 1);
    }
    createIterator(Iter, 'Chain', next, $forProto);
    setIterator(Iter[PROTOTYPE], returnThis); // override $forProto iterator
    return Iter;
  }
  
  var MapIter = createChainIterator(function(){
    var step = this[ITER].next();
    return step.done ? step : iterResult(0, stepCall(this[FN], step.value, this[ENTRIES]));
  });
  
  var FilterIter = createChainIterator(function(){
    for(;;){
      var step = this[ITER].next();
      if(step.done || stepCall(this[FN], step.value, this[ENTRIES]))return step;
    }
  });
  
  assignHidden($forProto, {
    of: function(fn, that){
      forOf(this, this[ENTRIES], fn, that);
    },
    array: function(fn, that){
      var result = [];
      forOf(fn != undefined ? this.map(fn, that) : this, false, push, result);
      return result;
    },
    filter: function(fn, that){
      return new FilterIter(this, fn, that);
    },
    map: function(fn, that){
      return new MapIter(this, fn, that);
    }
  });
  
  $for.isIterable  = isIterable;
  $for.getIterator = getIterator;
  
  $define(GLOBAL + FORCED, {$for: $for});
}('entries', safeSymbol('fn'));

/******************************************************************************
 * Module : core.delay                                                        *
 ******************************************************************************/

// https://esdiscuss.org/topic/promise-returning-delay-function
$define(GLOBAL + FORCED, {
  delay: function(time){
    return new Promise(function(resolve){
      setTimeout(resolve, time, true);
    });
  }
});

/******************************************************************************
 * Module : core.binding                                                      *
 ******************************************************************************/

!function(_, toLocaleString){
  // Placeholder
  core._ = path._ = path._ || {};

  $define(PROTO + FORCED, FUNCTION, {
    part: part,
    only: function(numberArguments, that /* = @ */){
      var fn     = assertFunction(this)
        , n      = toLength(numberArguments)
        , isThat = arguments.length > 1;
      return function(/* ...args */){
        var length = min(n, arguments.length)
          , args   = Array(length)
          , i      = 0;
        while(length > i)args[i] = arguments[i++];
        return invoke(fn, args, isThat ? that : this);
      }
    }
  });
  
  function tie(key){
    var that  = this
      , bound = {};
    return hidden(that, _, function(key){
      if(key === undefined || !(key in that))return toLocaleString.call(that);
      return has(bound, key) ? bound[key] : (bound[key] = ctx(that[key], that, -1));
    })[_](key);
  }
  
  hidden(path._, TO_STRING, function(){
    return _;
  });
  
  hidden(ObjectProto, _, tie);
  DESC || hidden(ArrayProto, _, tie);
  // IE8- dirty hack - redefined toLocaleString is not enumerable
}(DESC ? uid('tie') : TO_LOCALE, ObjectProto[TO_LOCALE]);

/******************************************************************************
 * Module : core.object                                                       *
 ******************************************************************************/

!function(){
  function define(target, mixin){
    var keys   = ownKeys(toObject(mixin))
      , length = keys.length
      , i = 0, key;
    while(length > i)defineProperty(target, key = keys[i++], getOwnDescriptor(mixin, key));
    return target;
  };
  $define(STATIC + FORCED, OBJECT, {
    isObject: isObject,
    classof: classof,
    define: define,
    make: function(proto, mixin){
      return define(create(proto), mixin);
    }
  });
}();

/******************************************************************************
 * Module : core.array                                                        *
 ******************************************************************************/

$define(PROTO + FORCED, ARRAY, {
  turn: function(fn, target /* = [] */){
    assertFunction(fn);
    var memo   = target == undefined ? [] : Object(target)
      , O      = ES5Object(this)
      , length = toLength(O.length)
      , index  = 0;
    while(length > index)if(fn(memo, O[index], index++, this) === false)break;
    return memo;
  }
});
if(framework)ArrayUnscopables.turn = true;

/******************************************************************************
 * Module : core.number                                                       *
 ******************************************************************************/

!function(numberMethods){  
  function NumberIterator(iterated){
    set(this, ITER, {l: toLength(iterated), i: 0});
  }
  createIterator(NumberIterator, NUMBER, function(){
    var iter = this[ITER]
      , i    = iter.i++;
    return i < iter.l ? iterResult(0, i) : iterResult(1);
  });
  defineIterator(Number, NUMBER, function(){
    return new NumberIterator(this);
  });
  
  numberMethods.random = function(lim /* = 0 */){
    var a = +this
      , b = lim == undefined ? 0 : +lim
      , m = min(a, b);
    return random() * (max(a, b) - m) + m;
  };

  forEach.call(array(
      // ES3:
      'round,floor,ceil,abs,sin,asin,cos,acos,tan,atan,exp,sqrt,max,min,pow,atan2,' +
      // ES6:
      'acosh,asinh,atanh,cbrt,clz32,cosh,expm1,hypot,imul,log1p,log10,log2,sign,sinh,tanh,trunc'
    ), function(key){
      var fn = Math[key];
      if(fn)numberMethods[key] = function(/* ...args */){
        // ie9- dont support strict mode & convert `this` to object -> convert it to number
        var args = [+this]
          , i    = 0;
        while(arguments.length > i)args.push(arguments[i++]);
        return invoke(fn, args);
      }
    }
  );
  
  $define(PROTO + FORCED, NUMBER, numberMethods);
}({});

/******************************************************************************
 * Module : core.string                                                       *
 ******************************************************************************/

!function(){
  var escapeHTMLDict = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }, unescapeHTMLDict = {}, key;
  for(key in escapeHTMLDict)unescapeHTMLDict[escapeHTMLDict[key]] = key;
  $define(PROTO + FORCED, STRING, {
    escapeHTML:   createReplacer(/[&<>"']/g, escapeHTMLDict),
    unescapeHTML: createReplacer(/&(?:amp|lt|gt|quot|apos);/g, unescapeHTMLDict)
  });
}();

/******************************************************************************
 * Module : core.date                                                         *
 ******************************************************************************/

!function(formatRegExp, flexioRegExp, locales, current, SECONDS, MINUTES, HOURS, MONTH, YEAR){
  function createFormat(prefix){
    return function(template, locale /* = current */){
      var that = this
        , dict = locales[has(locales, locale) ? locale : current];
      function get(unit){
        return that[prefix + unit]();
      }
      return String(template).replace(formatRegExp, function(part){
        switch(part){
          case 's'  : return get(SECONDS);                  // Seconds : 0-59
          case 'ss' : return lz(get(SECONDS));              // Seconds : 00-59
          case 'm'  : return get(MINUTES);                  // Minutes : 0-59
          case 'mm' : return lz(get(MINUTES));              // Minutes : 00-59
          case 'h'  : return get(HOURS);                    // Hours   : 0-23
          case 'hh' : return lz(get(HOURS));                // Hours   : 00-23
          case 'D'  : return get(DATE);                     // Date    : 1-31
          case 'DD' : return lz(get(DATE));                 // Date    : 01-31
          case 'W'  : return dict[0][get('Day')];           // Day     : Понедельник
          case 'N'  : return get(MONTH) + 1;                // Month   : 1-12
          case 'NN' : return lz(get(MONTH) + 1);            // Month   : 01-12
          case 'M'  : return dict[2][get(MONTH)];           // Month   : Январь
          case 'MM' : return dict[1][get(MONTH)];           // Month   : Января
          case 'Y'  : return get(YEAR);                     // Year    : 2014
          case 'YY' : return lz(get(YEAR) % 100);           // Year    : 14
        } return part;
      });
    }
  }
  function addLocale(lang, locale){
    function split(index){
      var result = [];
      forEach.call(array(locale.months), function(it){
        result.push(it.replace(flexioRegExp, '$' + index));
      });
      return result;
    }
    locales[lang] = [array(locale.weekdays), split(1), split(2)];
    return core;
  }
  $define(PROTO + FORCED, DATE, {
    format:    createFormat('get'),
    formatUTC: createFormat('getUTC')
  });
  addLocale(current, {
    weekdays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
    months: 'January,February,March,April,May,June,July,August,September,October,November,December'
  });
  addLocale('ru', {
    weekdays: 'Воскресенье,Понедельник,Вторник,Среда,Четверг,Пятница,Суббота',
    months: 'Январ:я|ь,Феврал:я|ь,Март:а|,Апрел:я|ь,Ма:я|й,Июн:я|ь,' +
            'Июл:я|ь,Август:а|,Сентябр:я|ь,Октябр:я|ь,Ноябр:я|ь,Декабр:я|ь'
  });
  core.locale = function(locale){
    return has(locales, locale) ? current = locale : current;
  };
  core.addLocale = addLocale;
}(/\b\w\w?\b/g, /:(.*)\|(.*)$/, {}, 'en', 'Seconds', 'Minutes', 'Hours', 'Month', 'FullYear');

/******************************************************************************
 * Module : core.global                                                       *
 ******************************************************************************/

$define(GLOBAL + FORCED, {global: global});

/******************************************************************************
 * Module : js.array.statics                                                  *
 ******************************************************************************/

// JavaScript 1.6 / Strawman array statics shim
!function(arrayStatics){
  function setArrayStatics(keys, length){
    forEach.call(array(keys), function(key){
      if(key in ArrayProto)arrayStatics[key] = ctx(call, ArrayProto[key], length);
    });
  }
  setArrayStatics('pop,reverse,shift,keys,values,entries', 1);
  setArrayStatics('indexOf,every,some,forEach,map,filter,find,findIndex,includes', 3);
  setArrayStatics('join,slice,concat,push,splice,unshift,sort,lastIndexOf,' +
                  'reduce,reduceRight,copyWithin,fill,turn');
  $define(STATIC, ARRAY, arrayStatics);
}({});

/******************************************************************************
 * Module : web.dom.itarable                                                  *
 ******************************************************************************/

!function(NodeList){
  if(framework && NodeList && !(SYMBOL_ITERATOR in NodeList[PROTOTYPE])){
    hidden(NodeList[PROTOTYPE], SYMBOL_ITERATOR, Iterators[ARRAY]);
  }
  Iterators.NodeList = Iterators[ARRAY];
}(global.NodeList);

/******************************************************************************
 * Module : core.log                                                          *
 ******************************************************************************/

!function(log, enabled){
  // Methods from https://github.com/DeveloperToolsWG/console-object/blob/master/api.md
  forEach.call(array('assert,clear,count,debug,dir,dirxml,error,exception,' +
      'group,groupCollapsed,groupEnd,info,isIndependentlyComposed,log,' +
      'markTimeline,profile,profileEnd,table,time,timeEnd,timeline,' +
      'timelineEnd,timeStamp,trace,warn'), function(key){
    log[key] = function(){
      if(enabled && key in console)return apply.call(console[key], console, arguments);
    };
  });
  $define(GLOBAL + FORCED, {log: assign(log.log, log, {
    enable: function(){
      enabled = true;
    },
    disable: function(){
      enabled = false;
    }
  })});
}({}, true);
}(typeof self != 'undefined' && self.Math === Math ? self : Function('return this')(), false);
module.exports = { "default": module.exports, __esModule: true };

},{}],107:[function(require,module,exports){
arguments[4][12][0].apply(exports,arguments)
},{"dup":12}],108:[function(require,module,exports){
"use strict";

exports["default"] = (function () {
  function defineProperties(target, props) {
    for (var key in props) {
      var prop = props[key];
      prop.configurable = true;
      if (prop.value) prop.writable = true;
    }

    Object.defineProperties(target, props);
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();

exports.__esModule = true;
},{}],109:[function(require,module,exports){
"use strict";

var _core = require("babel-runtime/core-js")["default"];

exports["default"] = function get(_x, _x2, _x3) {
  var _again = true;

  _function: while (_again) {
    _again = false;
    var object = _x,
        property = _x2,
        receiver = _x3;
    desc = parent = getter = undefined;

    var desc = _core.Object.getOwnPropertyDescriptor(object, property);

    if (desc === undefined) {
      var parent = _core.Object.getPrototypeOf(object);

      if (parent === null) {
        return undefined;
      } else {
        _x = parent;
        _x2 = property;
        _x3 = receiver;
        _again = true;
        continue _function;
      }
    } else if ("value" in desc && desc.writable) {
      return desc.value;
    } else {
      var getter = desc.get;

      if (getter === undefined) {
        return undefined;
      }

      return getter.call(receiver);
    }
  }
};

exports.__esModule = true;
},{"babel-runtime/core-js":106}],110:[function(require,module,exports){
"use strict";

exports["default"] = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

exports.__esModule = true;
},{}],111:[function(require,module,exports){
'use strict';

var wavesAudio = {
  // core
  audioContext: require('./dist/core/audio-context'),
  TimeEngine: require('./dist/core/time-engine'),
  AudioTimeEngine: require('./dist/core/audio-time-engine'),
  // engines
  GranularEngine: require('./dist/engines/granular-engine'),
  Metronome: require('./dist/engines/metronome'),
  PlayerEngine: require('./dist/engines/player-engine'),
  SegmentEngine: require('./dist/engines/segment-engine'),
  // masters
  PlayControl: require('./dist/masters/play-control'),
  Transport: require('./dist/masters/transport'),
  // expose these ?
  Scheduler: require('./dist/masters/scheduler'),
  SimpleScheduler: require('./dist/masters/simple-scheduler'),
  // utils
  PriorityQueue: require('./dist/utils/priority-queue'),
  SchedulingQueue: require('./dist/utils/scheduling-queue'),
  // factories
  getScheduler: require('./dist/masters/factories').getScheduler,
  getSimpleScheduler: require('./dist/masters/factories').getSimpleScheduler
};



module.exports = wavesAudio;
},{"./dist/core/audio-context":92,"./dist/core/audio-time-engine":93,"./dist/core/time-engine":94,"./dist/engines/granular-engine":95,"./dist/engines/metronome":96,"./dist/engines/player-engine":97,"./dist/engines/segment-engine":98,"./dist/masters/factories":99,"./dist/masters/play-control":100,"./dist/masters/scheduler":101,"./dist/masters/simple-scheduler":102,"./dist/masters/transport":103,"./dist/utils/priority-queue":104,"./dist/utils/scheduling-queue":105}],112:[function(require,module,exports){
'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _loader = require('./loader');

/**
 * Gets called if a parameter is missing and the expression
 * specifying the default value is evaluated.
 * @function
 */

var _loader2 = _interopRequireDefault(_loader);

function throwIfMissing() {
  throw new Error('Missing parameter');
}

var audioContext = undefined;

window.AudioContext = window.AudioContext || window.webkitAudioContext;

try {
  audioContext = new window.AudioContext();
} catch (e) {}

/**
 * AudioBufferLoader
 * @class
 * @classdesc Promise based implementation of XMLHttpRequest Level 2 for GET method and decode audio data for arraybuffer.
 * Inherit from Loader class
 */

var AudioBufferLoader = (function (_Loader) {
  _inherits(AudioBufferLoader, _Loader);

  /**
   * @constructs
   * Set the responseType to 'arraybuffer' and initialize options.
   */

  function AudioBufferLoader() {
    var responseType = arguments.length <= 0 || arguments[0] === undefined ? 'arraybuffer' : arguments[0];

    _classCallCheck(this, AudioBufferLoader);

    _get(Object.getPrototypeOf(AudioBufferLoader.prototype), 'constructor', this).call(this, responseType);
    this.options = {
      "wrapAroundExtension": 0
    };
    this.responseType = responseType;
  }

  /**
   * @function - Method for promise audio file loading and decoding.
   * @param {(string|string[])} fileURLs - The URL(s) of the audio files to load. Accepts a URL pointing to the file location or an array of URLs.
   * @param {{wrapAroundExtension: number}} [options] - Object with a wrapAroundExtension key which set the length, in seconds to be copied from the begining
   * at the end of the returned AudioBuffer
   * @returns {Promise}
   */

  _createClass(AudioBufferLoader, [{
    key: 'load',
    value: function load() {
      var fileURLs = arguments.length <= 0 || arguments[0] === undefined ? throwIfMissing() : arguments[0];
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      this.options = options;
      this.options.wrapAroundExtension = this.options.wrapAroundExtension || 0;
      return _get(Object.getPrototypeOf(AudioBufferLoader.prototype), 'load', this).call(this, fileURLs);
    }

    /**
     * @function - Load a single audio file, decode it in an AudioBuffer, return a Promise
     * @private
     * @param {string} fileURL - The URL of the audio file location to load.
     * @returns {Promise}
     */
  }, {
    key: 'loadOne',
    value: function loadOne(fileURL) {
      return _get(Object.getPrototypeOf(AudioBufferLoader.prototype), 'loadOne', this).call(this, fileURL).then(this.decodeAudioData.bind(this), function (error) {
        throw error;
      });
    }

    /**
     * @function - Load all audio files at once in a single array, decode them in an array of AudioBuffers, and return a Promise.
     * @private
     * @param {string[]} fileURLs - The URLs array of the audio files to load.
     * @returns {Promise}
     */
  }, {
    key: 'loadAll',
    value: function loadAll(fileURLs) {
      var _this = this;

      return _get(Object.getPrototypeOf(AudioBufferLoader.prototype), 'loadAll', this).call(this, fileURLs).then(function (arraybuffers) {
        return _Promise.all(arraybuffers.map(function (arraybuffer) {
          return _this.decodeAudioData.bind(_this)(arraybuffer);
        }));
      }, function (error) {
        throw error; // TODO: better error handler
      });
    }

    /**
     * @function - Decode Audio Data, return a Promise
     * @private
     * @param {arraybuffer} - The arraybuffer of the loaded audio file to be decoded.
     * @returns {Promise}
     */
  }, {
    key: 'decodeAudioData',
    value: function decodeAudioData(arraybuffer) {
      var _this2 = this;

      if (arraybuffer instanceof ArrayBuffer) {
        return new _Promise(function (resolve, reject) {
          audioContext.decodeAudioData(arraybuffer, // returned audio data array
          function (buffer) {
            if (_this2.options.wrapAroundExtension === 0) resolve(buffer);else resolve(_this2.__wrapAround(buffer));
          }, function (error) {
            reject(new Error("DecodeAudioData error"));
          });
        });
      } else {
        return new _Promise(function (resolve, reject) {
          resolve(arraybuffer);
        });
      }
    }

    /**
     * @function - WrapAround, copy the begining input buffer to the end of an output buffer
     * @private
     * @param {arraybuffer} inBuffer {arraybuffer} - The input buffer
     * @returns {arraybuffer} - The processed buffer (with frame copied from the begining to the end)
     */
  }, {
    key: '__wrapAround',
    value: function __wrapAround(inBuffer) {
      var length = inBuffer.length + this.options.wrapAroundExtension * inBuffer.sampleRate;

      var outBuffer = audioContext.createBuffer(inBuffer.numberOfChannels, length, inBuffer.sampleRate);
      var arrayChData, arrayOutChData;

      for (var channel = 0; channel < inBuffer.numberOfChannels; channel++) {
        arrayChData = inBuffer.getChannelData(channel);
        arrayOutChData = outBuffer.getChannelData(channel);

        arrayOutChData.forEach(function (sample, index) {
          if (index < inBuffer.length) arrayOutChData[index] = arrayChData[index];else arrayOutChData[index] = arrayChData[index - inBuffer.length];
        });
      }

      return outBuffer;
    }
  }]);

  return AudioBufferLoader;
})(_loader2['default']);

exports['default'] = AudioBufferLoader;
module.exports = exports['default'];

},{"./loader":113,"babel-runtime/core-js/promise":11,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15,"babel-runtime/helpers/interop-require-default":16}],113:[function(require,module,exports){
/**
 * Gets called if a parameter is missing and the expression
 * specifying the default value is evaluated.
 * @function
 */
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});
function throwIfMissing() {
  throw new Error('Missing parameter');
}

/**
 * Loader
 * @class
 * @classdesc Promise based implementation of XMLHttpRequest Level 2 for GET method.
 */

var Loader = (function () {
  /**
   * @constructs
   * @param {string} [responseType=""] - responseType's value, "text" (equal to ""), "arraybuffer", "blob", "document" or "json"
   */

  function Loader() {
    var responseType = arguments.length <= 0 || arguments[0] === undefined ? undefined : arguments[0];

    _classCallCheck(this, Loader);

    this.responseType = responseType;
    // rename to `onProgress` ?
    this.progressCb = undefined;
  }

  /**
   * Method for a promise based file loading.
   * Internally switch between loadOne and loadAll.
   * @public
   * @param {(string|string[])} fileURLs - The URL(s) of the files to load. Accepts a URL pointing to the file location or an array of URLs.
   * @returns {Promise}
   */

  _createClass(Loader, [{
    key: 'load',
    value: function load() {
      var fileURLs = arguments.length <= 0 || arguments[0] === undefined ? throwIfMissing() : arguments[0];

      if (fileURLs === undefined) throw new Error('load needs at least a url to load');
      if (Array.isArray(fileURLs)) {
        return this.loadAll(fileURLs);
      } else {
        return this.loadOne(fileURLs);
      }
    }

    /**
     * @function - Load a single file
     * @private
     * @param {string} fileURL - The URL of the file to load.
     * @returns {Promise}
     */
  }, {
    key: 'loadOne',
    value: function loadOne(fileURL) {
      return this.fileLoadingRequest(fileURL);
    }

    /**
     * @function - Load all files at once in a single array and return a Promise
     * @private
     * @param {string[]} fileURLs - The URLs array of the files to load.
     * @returns {Promise}
     */
  }, {
    key: 'loadAll',
    value: function loadAll(fileURLs) {
      var urlsCount = fileURLs.length,
          promises = [];

      for (var i = 0; i < urlsCount; ++i) {
        promises.push(this.fileLoadingRequest(fileURLs[i], i));
      }

      return _Promise.all(promises);
    }

    /**
     * @function - Load a file asynchronously, return a Promise.
     * @private
     * @param {string} url - The URL of the file to load
     * @param {string} [index] - The index of the file in the array of files to load
     * @returns {Promise}
     */
  }, {
    key: 'fileLoadingRequest',
    value: function fileLoadingRequest(url, index) {
      var _this = this;

      var promise = new _Promise(function (resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.index = index;
        if (_this.responseType) {
          request.responseType = _this.responseType;
        } else {
          var suffix = '.json';
          if (url.indexOf(suffix, _this.length - suffix.length) !== -1) {
            request.responseType = 'json';
          } else {
            request.responseType = 'arraybuffer';
          }
        }
        request.addEventListener('load', function () {
          // Test request.status value, as 404 will also get there
          if (request.status === 200 || request.status === 304) {
            // Hack for iOS 7, to remove as soon as possible
            if (this.responseType === 'json' && typeof request.response === 'string') {
              request.response = JSON.parse(request.response);
            }
            resolve(request.response);
          } else {
            reject(new Error(request.statusText));
          }
        });
        request.addEventListener('progress', function (evt) {
          if (_this.progressCallback) {
            if (index !== undefined) {
              _this.progressCallback({
                index: index,
                value: evt.loaded / evt.total,
                loaded: evt.loaded,
                total: evt.total
              });
            } else {
              _this.progressCallback({
                value: evt.loaded / evt.total,
                loaded: evt.loaded,
                total: evt.total
              });
            }
          }
        });
        // Manage network errors
        request.addEventListener('error', function () {
          reject(new Error('Network Error'));
        });

        request.send();
      });
      return promise;
    }

    /**
     * @function - Get the callback function to get the progress of file loading process.
     * This is only for the file loading progress as decodeAudioData doesn't
     * expose a decode progress value.
     * @returns {Loader~progressCallback}
     */
  }, {
    key: 'progressCallback',
    get: function get() {
      return this.progressCb;
    },

    /**
     * @function - Set the callback function to get the progress of file loading process.
     * This is only for the file loading progress as decodeAudioData doesn't
     * expose a decode progress value.
     * @param {Loader~progressCallback} callback - The callback that handles the response.
     */
    set: function set(callback) {
      this.progressCb = callback;
    }
  }]);

  return Loader;
})();

exports['default'] = Loader;
module.exports = exports['default'];

},{"babel-runtime/core-js/promise":11,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/create-class":13}],114:[function(require,module,exports){
'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _audioBufferLoader = require('./audio-buffer-loader');

/**
 * SuperLoader
 * @class
 * @classdesc Helper to load multiple type of files, and get them in their useful type, json for json files, AudioBuffer for audio files.
 */

var _audioBufferLoader2 = _interopRequireDefault(_audioBufferLoader);

var SuperLoader = (function (_AudioBufferLoader) {
  _inherits(SuperLoader, _AudioBufferLoader);

  /**
   * @constructs
   * Use composition to setup appropriate file loaders
   */

  function SuperLoader() {
    _classCallCheck(this, SuperLoader);

    _get(Object.getPrototypeOf(SuperLoader.prototype), 'constructor', this).call(this, null);
    // bypass AudioBufferLoader constructor. This is bad but it works.
  }

  return SuperLoader;
})(_audioBufferLoader2['default']);

exports['default'] = SuperLoader;
module.exports = exports['default'];

},{"./audio-buffer-loader":112,"babel-runtime/helpers/class-call-check":12,"babel-runtime/helpers/get":14,"babel-runtime/helpers/inherits":15,"babel-runtime/helpers/interop-require-default":16}],115:[function(require,module,exports){
/**
 * @file Loaders: AudioBuffer loader and utilities
 * @author Samuel Goldszmidt
 * @version 0.1.1
 */

// CommonJS function export
module.exports = {
  Loader: require('./dist/loader'),
  AudioBufferLoader: require('./dist/audio-buffer-loader'),
  SuperLoader: require('./dist/super-loader')
};

},{"./dist/audio-buffer-loader":112,"./dist/loader":113,"./dist/super-loader":114}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJidWlsZC9zcmMvanMvRG90TmF2LmpzIiwiYnVpbGQvc3JjL3Njc3MvbWFpbi5zY3NzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvY29yZS1qcy9nZXQtaXRlcmF0b3IuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9jb3JlLWpzL2lzLWl0ZXJhYmxlLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvY29yZS1qcy9vYmplY3QvY3JlYXRlLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvY29yZS1qcy9vYmplY3QvZGVmaW5lLXByb3BlcnR5LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvY29yZS1qcy9vYmplY3QvZ2V0LW93bi1wcm9wZXJ0eS1kZXNjcmlwdG9yLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvY29yZS1qcy9vYmplY3Qvc2V0LXByb3RvdHlwZS1vZi5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL2NvcmUtanMvcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL2hlbHBlcnMvY2xhc3MtY2FsbC1jaGVjay5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL2hlbHBlcnMvY3JlYXRlLWNsYXNzLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvaGVscGVycy9nZXQuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9oZWxwZXJzL2luaGVyaXRzLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvaGVscGVycy9pbnRlcm9wLXJlcXVpcmUtZGVmYXVsdC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL2hlbHBlcnMvc2xpY2VkLXRvLWFycmF5LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9mbi9nZXQtaXRlcmF0b3IuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L2ZuL2lzLWl0ZXJhYmxlLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9mbi9vYmplY3QvY3JlYXRlLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9mbi9vYmplY3QvZGVmaW5lLXByb3BlcnR5LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9mbi9vYmplY3QvZ2V0LW93bi1wcm9wZXJ0eS1kZXNjcmlwdG9yLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9mbi9vYmplY3Qvc2V0LXByb3RvdHlwZS1vZi5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvZm4vcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLmEtZnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5hbi1vYmplY3QuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5jbGFzc29mLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuY29mLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuY29yZS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLmN0eC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLmRlZi5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLmRlZmluZWQuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5kb20tY3JlYXRlLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuZmFpbHMuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5mb3Itb2YuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5nbG9iYWwuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5oYXMuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5oaWRlLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuaHRtbC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLmludm9rZS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLmlvYmplY3QuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5pcy1hcnJheS1pdGVyLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuaXMtb2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuaXRlci1jYWxsLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuaXRlci1jcmVhdGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5pdGVyLWRlZmluZS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLml0ZXItZGV0ZWN0LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuaXRlci1zdGVwLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuaXRlcmF0b3JzLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5saWJyYXJ5LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQubWljcm90YXNrLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQubWl4LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQub2JqZWN0LXNhcC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnByb3BlcnR5LWRlc2MuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5yZWRlZi5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnNhbWUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5zZXQtcHJvdG8uanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5zaGFyZWQuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC5zcGVjaWVzLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuc3RyaWN0LW5ldy5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnN0cmluZy1hdC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnN1cHBvcnQtZGVzYy5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnRhZy5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnRhc2suanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC50by1pbnRlZ2VyLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQudG8taW9iamVjdC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnRvLWxlbmd0aC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnVpZC5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy8kLnVuc2NvcGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvJC53a3MuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvY29yZS5nZXQtaXRlcmF0b3ItbWV0aG9kLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzL2NvcmUuZ2V0LWl0ZXJhdG9yLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzL2NvcmUuaXMtaXRlcmFibGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9ub2RlX21vZHVsZXMvY29yZS1qcy9saWJyYXJ5L21vZHVsZXMvZXM2LmFycmF5Lml0ZXJhdG9yLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzL2VzNi5vYmplY3QuZ2V0LW93bi1wcm9wZXJ0eS1kZXNjcmlwdG9yLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzL2VzNi5vYmplY3Quc2V0LXByb3RvdHlwZS1vZi5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy9lczYub2JqZWN0LnRvLXN0cmluZy5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy9lczYucHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL25vZGVfbW9kdWxlcy9jb3JlLWpzL2xpYnJhcnkvbW9kdWxlcy9lczYuc3RyaW5nLml0ZXJhdG9yLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzL3dlYi5kb20uaXRlcmFibGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9tb3Rpb24taW5wdXQvZGlzdC9zcmMvRE9NRXZlbnRTdWJtb2R1bGUuanMiLCJub2RlX21vZHVsZXMvbW90aW9uLWlucHV0L2Rpc3Qvc3JjL0RldmljZU1vdGlvbk1vZHVsZS5qcyIsIm5vZGVfbW9kdWxlcy9tb3Rpb24taW5wdXQvZGlzdC9zcmMvRGV2aWNlT3JpZW50YXRpb25Nb2R1bGUuanMiLCJub2RlX21vZHVsZXMvbW90aW9uLWlucHV0L2Rpc3Qvc3JjL0VuZXJneU1vZHVsZS5qcyIsIm5vZGVfbW9kdWxlcy9tb3Rpb24taW5wdXQvZGlzdC9zcmMvSW5wdXRNb2R1bGUuanMiLCJub2RlX21vZHVsZXMvbW90aW9uLWlucHV0L2Rpc3Qvc3JjL01vdGlvbklucHV0LmpzIiwibm9kZV9tb2R1bGVzL21vdGlvbi1pbnB1dC9tb3Rpb24taW5wdXQuanMiLCJub2RlX21vZHVsZXMvbW90aW9uLWlucHV0L25vZGVfbW9kdWxlcy9wbGF0Zm9ybS9wbGF0Zm9ybS5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1hdWRpby9kaXN0L2NvcmUvZXM2L3V0aWxzL3NjaGVkdWxpbmctcXVldWUuanMiLCJub2RlX21vZHVsZXMvd2F2ZXMtYXVkaW8vZGlzdC9jb3JlL2VzNi9jb3JlL2F1ZGlvLWNvbnRleHQuanMiLCJub2RlX21vZHVsZXMvd2F2ZXMtYXVkaW8vZGlzdC9lbmdpbmVzL2VzNi91dGlscy9zY2hlZHVsaW5nLXF1ZXVlLmpzIiwibm9kZV9tb2R1bGVzL3dhdmVzLWF1ZGlvL2Rpc3QvbWFzdGVycy9lczYvdXRpbHMvc2NoZWR1bGluZy1xdWV1ZS5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1hdWRpby9kaXN0L21hc3RlcnMvZXM2L21hc3RlcnMvdHJhbnNwb3J0LmpzIiwibm9kZV9tb2R1bGVzL3dhdmVzLWF1ZGlvL2Rpc3QvdXRpbHMvZXM2L3V0aWxzL3NjaGVkdWxpbmctcXVldWUuanMiLCJub2RlX21vZHVsZXMvd2F2ZXMtYXVkaW8vbm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvY29yZS1qcy5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1hdWRpby9ub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9oZWxwZXJzL2NyZWF0ZS1jbGFzcy5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1hdWRpby9ub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9oZWxwZXJzL2dldC5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1hdWRpby9ub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9oZWxwZXJzL2luaGVyaXRzLmpzIiwibm9kZV9tb2R1bGVzL3dhdmVzLWF1ZGlvL3dhdmVzLWF1ZGlvLmpzIiwibm9kZV9tb2R1bGVzL3dhdmVzLWxvYWRlcnMvZGlzdC9lczYvYXVkaW8tYnVmZmVyLWxvYWRlci5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1sb2FkZXJzL2Rpc3QvZXM2L2xvYWRlci5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1sb2FkZXJzL2Rpc3QvZXM2L3N1cGVyLWxvYWRlci5qcyIsIm5vZGVfbW9kdWxlcy93YXZlcy1sb2FkZXJzL3dhdmVzLWxvYWRlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0FDT0EsWUFBWSxDQUFDOzs7Ozs7SUFDUCxNQUFNO0FBQ0MsV0FEUCxNQUFNLEdBQ2dCO1FBQWQsT0FBTyx5REFBRyxFQUFFOzswQkFEcEIsTUFBTTs7QUFFUixRQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7QUFDakMsUUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDO0FBQ3ZCLFFBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQzs7QUFFakMsUUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0dBQ2I7O2VBUEcsTUFBTTs7V0FTTixnQkFBRzs7O0FBQ0wsVUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7QUFFN0MsVUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDOzs0QkFFckMsQ0FBQztBQUNSLFlBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFcEIsV0FBRyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFNO0FBQ2xDLGNBQUksQ0FBQyxLQUFLLE1B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QUM7S0FDbkUsTUFBTTtBQUNMLFdBQUssQ0FBQyxTQUFTLEdBQUcsNENBQTRDLENBQUM7S0FDaEU7R0FDRixDQUFDLENBQUM7Q0FDSixDQUFBLEVBQUUsQ0FBRTs7O0FDbkpMOztBQ0FBOztBQ0FBOztBQ0FBOztBQ0FBOztBQ0FBOztBQ0FBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBOztBQ0ZBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7O0FDQUE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTs7QUNGQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7OztBQ3hTQSxZQUFZLENBQUM7Ozs7Ozs7Ozs7QUFFYixJQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsZUFBZSxD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R0FBSSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBLEdBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BMLFlBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUEsR0FBSSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBLEdBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BMLFlBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUEsR0FBSSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBLEdBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUVwTCxZQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQyxDQUFDLEdBQUcsNEJBQTRCLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUUsWUFBSSxDQUFDLGlDQUFpQyxDQUFDLENBQUMsQ0FBQyxHQUFHLDRCQUE0QixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVFLFlBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDLENBQUMsR0FBRyw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFNUUsZ0JBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMs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RUFBRSxHQUFHLEdBQUcsQ0FBQztDQUM1Qjs7Ozs7Ozs7QUFRRCxTQUFTLFFBQVEsQ0FBQyxHQUFHLEVBQUU7QUFDckIsU0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7Q0FDNUI7Ozs7Ozs7O0FBUUQsU0FBUyxTQUFTLENBQUMsQ0FBQyxFQUFFO0FBQ3BCLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUV4SSxPQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7QUFDL0IsS0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQztHQUFBLEFBRWQsT0FBTyxDQUFDLENBQUM7Q0FDVjs7Ozs7Ozs7Ozs7QUFXRCxTQUFTLEtBQUssQ0FBQyxVQUFVLEVBQUU7Ozs7Ozs7OztBQVN6QixNQUFNLFlBQVksR0FBSSxPQUFPLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLEFBQUMsQ0FBQzs7QUFFekQsTUFBTSxNQUFNLEdBQUksWUFBWSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEFBQUMsQ0FBQztBQUM1RCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEMsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUV2QyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM1QixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQzs7QUFFNUIsTUFBSSxLQUFLLFlBQUE7TUFBRSxJQUFJLFlBQUE7TUFBRSxLQUFLLFlBQUEsQ0FBQzs7QUFFdkIsTUFBSSxDQUFDLEdBQUcsQ0FDTixFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUN0QixDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQ1IsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFDdEIsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFDdEIsRUFBRSxHQUFHLEVBQUUsRUFDUCxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUN0QixDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQ1IsRUFBRSxF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QUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQ3RCLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFDUixFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUN0QixFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUN0QixFQUFFLEdBQUcsRUFBRSxFQUNQLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQ3RCLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFDUixFQUFFLEVBQ0YsRUFBRSxHQUFHLEVBQUUsQ0FDUixDQUFDO0FBQ0YsV0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUViLE9BQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLE9BQUssSUFBSSxBQUFDLEtBQUssR0FBRyxDQUFDLEdBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZDLE1BQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLE9BQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUVoQyxZQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUksWUFBWSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLEFBQUMsQ0FBQztBQUN4RCxZQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9CLFlBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDakM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUF3QkssdUJBQXVCO1lBQXZCLHVCQUF1Qjs7Ozs7Ozs7QUFPaEIsV0FQUCx1QkFBdUIsR0FPYjswQkFQVix1QkFBdUI7O0FBUXpCLCtCQVJFLHVCQUF1Qiw2Q0FRbkIsbUJBQW1CLEVBQUU7Ozs7Ozs7OztBQVMzQixRQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQzs7Ozs7Ozs7Ozs7QUFXaEMsUUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLGlCQUFpQixDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQzs7Ozs7Ozs7OztBQVU5RCxRQUFJLENBQUMsY0FBYyxHQUFHLElBQUksaUJBQWlCLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7Ozs7Ozs7Ozs7QUFVcEUsUUFBSSxDQUFDLFFBQVEsR0FBRztBQUNkLGlCQUFXLEVBQUUsS0FBSztBQUNsQixvQkFBYyxFQUFFLEtBQUs7S0FDdEIsQ0FBQzs7Ozs7Ozs7QUFRRixRQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQzs7Ozs7Ozs7OztBQVV2QixRQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQzs7Ozs7Ozs7O0FBUzVCLFFBQUksQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Ozs7Ozs7O0FBUW5DLFFBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOzs7Ozs7OztBQVF2RSxRQUFJLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztHQUM5RTs7Ozs7Ozs7Ozs7OztlQS9GRyx1QkFBdUI7O1dBMkdKLGlDQUFDLENBQUMsRUFBRTtBQUN6QixVQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQzs7O0FBR3ZCLFVBQU0saUJBQWlCLEdBQUksQUFBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssUUFBUSxJQUFNLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLEFBQUMsSUFBSyxPQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssUUFBUSxBQUFDLEFBQUMsQ0FBQztBQUMzSCxVQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQztBQUNoRCxVQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQzs7Ozs7QUFLbkQsWUFBTSxDQUFDLG1CQUFtQixDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxLQUFLLENBQUMsQ0FBQzs7OztBQUlyRixVQUFJLEFBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsSUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxBQUFDLEVBQ2xJLElBQUksQ0FBQyx3Q0FBd0MsRUFBRSxDQUFDLEtBRWhELElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDOUI7Ozs7Ozs7Ozs7OztXQVV5QixvQ0FBQyxDQUFDLEVBQUU7O0FBRTVCLFVBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7O0FBRTFCLGNBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3RCLGNBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ3JCLGNBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDOztBQUV0QixVQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDOzs7QUFHcEIsVUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRTs7O0FBRzVELFlBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLDhCQUE4QixJQUFJLENBQUMsQ0FBQyxvQkFBb0IsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLE1BQU0sS0FBSyxLQUFLLEVBQzVHLElBQUksQ0FBQyxXQUFXLENBQUMsOEJBQThCLEdBQUcsQ0FBQyxDQUFDLG9CQUFvQixDQUFDOztBQUUzRSxZQUFJLFNBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQzs7QUFFdEMsaUJBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3RCLGlCQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNyQixpQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7Ozs7QUFJdEIsWUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLDhCQUE4QixJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRTtBQUNuRixtQkFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLDhCQUE4QixDQUFDO0FBQ3JFLGVBQUssQ0FBQyxTQUFRLENBQUMsQ0FBQztTQUNqQjs7QUFFRCxZQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFRLENBQUMsQ0FBQztPQUNqQzs7O0FBR0QsVUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRTs7O0FBR2xFLFlBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLDhCQUE4QixJQUFJLENBQUMsQ0FBQyxvQkFBb0IsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLE1BQU0sS0FBSyxLQUFLLEVBQy9HLElBQUksQ0FBQyxjQUFjLENBQUMsOEJBQThCLEdBQUcsQ0FBQyxDQUFDLG9CQUFvQixDQUFDOztBQUU5RSxZQUFJLFVBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQzs7QUFFekMsa0JBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3RCLGtCQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNyQixrQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7Ozs7QUFJdEIsWUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLDhCQUE4QixJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBQztBQUNyRixvQkFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsOEJBQThCLENBQUM7QUFDbEUsb0JBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxBQUFDLFVBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztTQUM1Qzs7OztBQUlELFlBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUNsQyxRQUFRLENBQUMsVUFBUSxDQUFDLENBQUM7O0FBRXJCLFlBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFVBQVEsQ0FBQyxDQUFDO09BQ3BDO0tBQ0Y7Ozs7Ozs7V0FLdUMsb0RBQUc7OztBQUN6QyxpQkFBVyxDQUFDLGFBQWEsQ0FBQyw4QkFBOEIsQ0FBQyxDQUN0RCxJQUFJLENBQUMsVUFBQyw0QkFBNEIsRUFBSztBQUN0QyxZQUFJLDRCQUE0QixDQUFDLE9BQU8sRUFBRTtBQUN4QyxpQkFBTyxDQUFDLEdBQUcsQ0FBQyxpVUFBaVUsQ0FBQyxDQUFDOztBQUUvVSxjQUFJLE1BQUssUUFBUSxDQUFDLFdBQVcsRUFBRTtBQUM3QixrQkFBSyxXQUFXLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztBQUNyQyxrQkFBSyxXQUFXLENBQUMsTUFBTSxHQUFHLDRCQUE0QixDQUFDLE1BQU0sQ0FBQzs7QUFFOUQsdUJBQVcsQ0FBQyxXQUFXLENBQUMsOEJBQThCLEVBQUUsVUFBQyw0QkFBNEIsRUFBSztBQUN4RixvQkFBSyxzREFBc0QsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO2FBQzNGLENBQUMsQ0FBQztXQUNKOztBQUVELGNBQUksTUFBSyxRQUFRLENBQUMsY0FBYyxFQUFFO0FBQ2hDLGtCQUFLLGNBQWMsQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO0FBQ3hDLGtCQUFLLGNBQWMsQ0FBQyxNQUFNLEdBQUcsNEJBQTRCLENBQUMsTUFBTSxDQUFDOztBQUVqRSx1QkFBVyxDQUFDLFdBQVcsQ0FBQyw4QkFBOEIsRUFBRSxVQUFDLDRCQUE0QixFQUFLO0FBQ3hGLG9CQUFLLHNEQUFzRCxDQUFDLDRCQUE0QixFQUFFLElBQUksQ0FBQyxDQUFDO2FBQ2pHLENBQUMsQ0FBQztXQUNKO1NBQ0Y7O0FBRUQsY0FBSyxlQUFlLE9BQU0sQ0FBQztPQUM1QixDQUFDLENBQUM7S0FDTjs7Ozs7Ozs7OztXQVFxRCxnRUFBQyw0QkFBNEIsRUFBZTtVQUFiLEdBQUcseURBQUcsS0FBSzs7QUFDOUYsVUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDOzs7QUFHZCxVQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUEsR0FBSSw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RyxVQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUEsR0FBSSw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RyxVQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUEsR0FBSSw0QkFBNEIsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFdEcsVUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLFVBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQyxVQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXBDLFVBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQzs7QUFFMUQsU0FBRyxJQUFJLElBQUksQ0FBQztBQUNaLFNBQUcsSUFBSSxJQUFJLENBQUM7QUFDWixTQUFHLElBQUksSUFBSSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3QlosVUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNwQyxVQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDOztBQUU1QyxVQUFJLEdBQUcsRUFBRTs7QUFFUCxZQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQztBQUN6QyxnQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUNuQixnQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUNuQixnQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQzs7QUFFcEIsWUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7T0FDcEMsTUFBTTs7QUFFTCxZQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztBQUN0QyxnQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUNuQixnQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUNuQixnQkFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUNwQixhQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7O0FBRWhCLFlBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO09BQ2pDO0tBQ0Y7Ozs7Ozs7Ozs7Ozs7O1dBWVcsd0JBQUc7QUFDYixVQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7O0FBRXJCLFVBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxDQUFDLEVBQzFCLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsMEJBQTBCLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDeEY7Ozs7Ozs7Ozs7Ozs7O1dBWWMsMkJBQUc7QUFDaEIsVUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDOztBQUVyQixVQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssQ0FBQyxFQUFFO0FBQzVCLGNBQU0sQ0FBQyxtQkFBbUIsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsMEJBQTBCLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDeEYsWUFBSSxDQUFDLFdBQVcsQ0FBQyw4QkFBOEIsR0FBRyxJQUFJLENBQUM7T0FDeEQ7S0FDRjs7Ozs7Ozs7O1dBT0csZ0JBQUc7OztBQUNMLHdDQXJWRSx1QkFBdUIsc0NBcVZQLFVBQUMsT0FBTyxFQUFLO0FBQzdCLGVBQUssZUFBZSxHQUFHLE9BQU8sQ0FBQzs7QUFFL0IsWUFBSSxNQUFNLENBQUMsc0JBQXNCLEVBQy9CLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsRUFBRSxPQUFLLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxDQUFDLEtBQy9FLElBQUksT0FBSyxRQUFRLENBQUMsV0FBVyxFQUNoQyxPQUFLLHdDQUF3QyxFQUFFLENBQUMsS0FFaEQsT0FBTyxRQUFNLENBQUM7T0FDakIsRUFBRTtLQUNKOzs7Ozs7Ozs7V0FPVSxxQkFBQyxRQUFRLEVBQUU7QUFDcEIsaUNBdldFLHVCQUF1Qiw2Q0F1V1AsUUFBUSxFQUFFO0FBQzVCLFVBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztLQUNyQjs7Ozs7Ozs7O1dBT2Esd0JBQUMsUUFBUSxFQUFFO0FBQ3ZCLGlDQWpYRSx1QkFBdUIsZ0RBaVhKLFFBQVEsRUFBRTtBQUMvQixVQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7S0FDeEI7OztTQW5YRyx1QkFBdUI7R0FBUyxXQUFXOztBQXNYakQsTUFBTSxDQUFDLE9BQU8sR0FBRyxJQUFJLHVCQUF1QixFQUFFLENBQUM7Ozs7Ozs7O0FDbGxCL0MsWUFBWSxDQUFDOzs7Ozs7Ozs7Ozs7OztBQUViLElBQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUM3QyxJQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7Ozs7Ozs7Ozs7Ozs7SUFZdkMsWUFBWTtZQUFaLFlBQVk7Ozs7Ozs7O0FBT0wsV0FQUCxZQUFZLEdBT0Y7MEJBUFYsWUFBWTs7QUFRZCwrQkFSRSxZQUFZLDZDQVFSLFFBQVEsRUFBRTs7Ozs7Ozs7O0FBU2hCLFFBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDOzs7Ozs7Ozs7O0FBVWYsUUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQzs7Ozs7Ozs7O0FBU2hDLFFBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUM7Ozs7Ozs7OztBQVNoQyxRQUFJLENBQUMsZ0NBQWdDLEdBQUcsSUFBSSxDQUFDOzs7Ozs7Ozs7O0FBVTdDLFFBQUksQ0FBQywrQkFBK0IsR0FBRyxFQUFFLENBQUM7Ozs7Ozs7Ozs7QUFVMUMsUUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQzs7Ozs7Ozs7O0FBU2hDLFFBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUM7Ozs7Ozs7OztBQVNoQyxRQUFJLENBQUMsZ0NBQWdDLEdBQUcsR0FBRyxDQUFDOzs7Ozs7Ozs7O0FBVTVDLFFBQUksQ0FBQywrQkFBK0IsR0FBRyxHQUFHLENBQUM7Ozs7Ozs7Ozs7QUFVM0MsUUFBSSxDQUFDLG1CQUFtQixHQUFHLEdBQUcsQ0FBQzs7Ozs7Ozs7QUFRL0IsUUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs7Ozs7Ozs7QUFRdkQsUUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztHQUN4RDs7Ozs7Ozs7O2VBeEhHLFlBQVk7Ozs7Ozs7O1dBeUlaLGdCQUFHOzs7QUFDTCx3Q0ExSUUsWUFBWSxzQ0EwSUksVUFBQyxPQUFPLEVBQUs7O0FBRTdCLGlCQUFRLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLEVBQUUsV0FBVyxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQ2hHLElBQUksQ0FBQyxVQUFDLE9BQU8sRUFBSzt3Q0FDb0IsT0FBTzs7Y0FBckMsWUFBWTtjQUFFLFlBQVk7O0FBRWpDLGdCQUFLLG1CQUFtQixHQUFHLFlBQVksQ0FBQztBQUN4QyxnQkFBSyxtQkFBbUIsR0FBRyxZQUFZLENBQUM7QUFDeEMsZ0JBQUssWUFBWSxHQUFHLE1BQUssbUJBQW1CLENBQUMsT0FBTyxJQUFJLE1BQUssbUJBQW1CLENBQUMsT0FBTyxDQUFDOztBQUV6RixjQUFJLE1BQUssbUJBQW1CLENBQUMsT0FBTyxFQUNsQyxNQUFLLE1BQU0sR0FBRyxNQUFLLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxLQUMzQyxJQUFJLE1BQUssbUJBQW1CLENBQUMsT0FBTyxFQUN2QyxNQUFLLE1BQU0sR0FBRyxNQUFLLG1CQUFtQixDQUFDLE1BQU0sQ0FBQzs7QUFFaEQsaUJBQU8sT0FBTSxDQUFDO1NBQ2YsQ0FBQyxDQUFDO09BQ04sRUFBRTtLQUNKOzs7Ozs7O1dBS0ksaUJBQUc7O0FBRU4sVUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUNsQyxXQUFXLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDaEUsVUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUNsQyxXQUFXLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7S0FDakU7Ozs7Ozs7V0FLRyxnQkFBRzs7QUFFTCxVQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQ2xDLFdBQVcsQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUNuRSxVQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQ2xDLFdBQVcsQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztLQUNwRTs7Ozs7Ozs7O1dBT2MseUJBQUMsWUFBWSxFQUFFO0FBQzVCLFVBQUksQ0FBQyxtQkFBbUIsR0FBRyxZQUFZLENBQUM7OztBQUd4QyxVQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFDbkMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7S0FDM0I7Ozs7Ozs7OztXQU9jLHlCQUFDLFlBQVksRUFBRTtBQUM1QixVQUFJLENBQUMsbUJBQW1CLEdBQUcsWUFBWSxDQUFDOzs7Ozs7QUFNeEMsVUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7S0FDekI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztXQW1CZSw0QkFBRztBQUNqQixVQUFJLGtCQUFrQixHQUFHLENBQUMsQ0FBQztBQUMzQixVQUFJLGtCQUFrQixHQUFHLENBQUMsQ0FBQzs7O0FBRzNCLFVBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRTtBQUNwQyxZQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckMsWUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLFlBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQyxZQUFJLHFCQUFxQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQzs7O0FBR25FLFlBQUksSUFBSSxDQUFDLGdDQUFnQyxHQUFHLHFCQUFxQixFQUMvRCxJQUFJLENBQUMsZ0NBQWdDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUMsK0JBQStCLENBQUMsQ0FBQzs7OztBQUloSCwwQkFBa0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDLENBQUMsQ0FBQztPQUNqRzs7O0FBR0QsVUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFO0FBQ3BDLFlBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQyxZQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckMsWUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLFlBQUkscUJBQXFCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDOzs7QUFHbkUsWUFBSSxJQUFJLENBQUMsZ0NBQWdDLEdBQUcscUJBQXFCLEVBQy9ELElBQUksQ0FBQyxnQ0FBZ0MsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDOztBQUVoSCwwQkFBa0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxDQUFDLENBQUMsQ0FBQztPQUNqRzs7QUFFRCxVQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLGtCQUFrQixDQUFDLENBQUM7OztBQUc5RCxVQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO0FBQzVCLFVBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBLEdBQUksTUFBTSxDQUFDOzs7QUFHL0MsVUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDdkI7OztTQTNJZSxlQUFHO0FBQ2pCLGFBQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7S0FDeEU7OztTQWxJRyxZQUFZO0dBQVMsV0FBVzs7QUE4UXRDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQzs7Ozs7Ozs7QUM3UnBDLFlBQVksQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQVVQLFdBQVc7Ozs7Ozs7OztBQVFKLFdBUlAsV0FBVyxDQVFILFNBQVMsRUFBRTswQkFSbkIsV0FBVzs7Ozs7Ozs7O0FBaUJiLFFBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDOzs7Ozs7Ozs7QUFTM0IsUUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7Ozs7Ozs7OztBQVNwQixRQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQzs7Ozs7Ozs7O0FBU2xCLFFBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDOzs7Ozs7Ozs7QUFTcEIsUUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7Ozs7Ozs7Ozs7QUFVMUIsUUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7Ozs7Ozs7OztBQVN4QixRQUFJLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztHQUN6Qjs7Ozs7Ozs7O2VBekVHLFdBQVc7Ozs7Ozs7OztXQTJGWCxjQUFDLFVBQVUsRUFBRTtBQUNmLFVBQUksQ0FBQyxPQUFPLEdBQUcsYUFBWSxVQUFVLENBQUMsQ0FBQztBQUN2QyxhQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7S0FDckI7Ozs7Ozs7V0FLSSxpQkFBRyxFQUVQOzs7Ozs7QUFBQTs7O1dBS0csZ0JBQUcsRUFFTjs7Ozs7Ozs7QUFBQTs7O1dBT1UscUJBQUMsUUFBUSxFQUFFO0FBQ3BCLFVBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDOzs7QUFHOUIsVUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQzdCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztLQUNoQjs7Ozs7Ozs7O1dBT2Esd0JBQUMsUUFBUSxFQUFFO0FBQ3ZCLFVBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzdDLFVBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQzs7O0FBR2hDLFVBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUM3QixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDZjs7Ozs7Ozs7O1dBT0csZ0JBQXFCO1VBQXBCLEtBQUsseURBQUcsSUFBSSxDQUFDLEtBQUs7Ozs7OztBQUNyQiwwQ0FBcUIsSUFBSSxDQUFDLFNBQVM7Y0FBMUIsUUFBUTs7QUFDZixrQkFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQUE7Ozs7Ozs7Ozs7Ozs7OztLQUNuQjs7O1NBaEVVLGVBQUc7QUFDWixhQUFRLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBRTtLQUMvQzs7O1NBbkZHLFdBQVc7OztBQW9KakIsTUFBTSxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUM7Ozs7Ozs7O0FDOUo3QixZQUFZLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7SUFTUCxXQUFXOzs7Ozs7OztBQU9KLFdBUFAsV0FBVyxHQU9EOzBCQVBWLFdBQVc7Ozs7Ozs7OztBQWdCYixRQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztHQUNuQjs7Ozs7Ozs7O2VBakJHLFdBQVc7O1dBeUJOLG1CQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUU7QUFDM0IsVUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxNQUFNLENBQUM7S0FDbEM7Ozs7Ozs7Ozs7V0FRUSxtQkFBQyxTQUFTLEVBQUU7QUFDbkIsYUFBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQ2hDOzs7Ozs7Ozs7Ozs7V0FVWSx1QkFBQyxTQUFTLEVBQUU7QUFDdkIsVUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQzs7QUFFdkMsVUFBRyxNQUFNLENBQUMsT0FBTyxFQUNmLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQzs7QUFFeEIsYUFBTyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDdEI7Ozs7Ozs7Ozs7V0FRRyxnQkFBZ0I7Ozt3Q0FBWixVQUFVO0FBQVYsa0JBQVU7OztBQUNoQixVQUFJLGNBQWMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQUMsS0FBSyxFQUFLO0FBQzdDLFlBQUksTUFBTSxHQUFHLE1BQUssU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ25DLGVBQU8sTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO09BQ3RCLENBQUMsQ0FBQzs7QUFFSCxhQUFPLFNBQVEsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0tBQ3BDOzs7Ozs7Ozs7O1dBUVUscUJBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRTtBQUMvQixVQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3ZDLFlBQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDOUI7Ozs7Ozs7Ozs7V0FRYSx3QkFBQyxTQUFTLEVBQUUsUUFBUSxFQUFFO0FBQ2xDLFVBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDdkMsWUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNqQzs7O1NBM0ZHLFdBQVc7OztBQThGakIsTUFBTSxDQUFDLE9BQU8sR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDOzs7QUM1R25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUM5akNBLEFBQUMsQ0FBQSxVQUFVLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO0FBQ2hDLGNBQVksQ0FBQzs7QUFFYixXQUFTLFlBQVksQ0FBQyxLQUFLLEVBQUU7QUFDM0IsUUFBSSxDQUFDLEtBQUs7O0FBQ1IsYUFBTztLQUFBLEFBQ1QsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQ3hCLEtBQUssQ0FBQyxlQUFlLEdBQUcsS0FB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OztBQU01RCxRQUFJLENBQUMsV0FBVyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDOzs7Ozs7QUFNcEQsUUFBSSxDQUFDLGFBQWEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUcsQ0FBQyxDQUFDLENBQUM7Ozs7OztBQU01RCxRQUFJLENBQUMsV0FBVyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDOzs7Ozs7QUFNcEQsUUFBSSxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQzs7Ozs7Ozs7O0FBU3BELFFBQUksQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFHLENBQUMsQ0FBQyxDQUFDOzs7Ozs7QUFNeEQsUUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDOzs7Ozs7QUFNckQsUUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQzs7Ozs7O0FBTWhELFFBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7Ozs7OztBQU01QyxRQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDOzs7Ozs7QUFNcEQsUUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQzs7Ozs7O0FBTWhELFFBQUksQ0FBQyxVQUFVLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7Ozs7OztBQU10RCxRQUFJLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FB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QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNweUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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OztxQkFBTixNQUFNOzs7Ozs7Ozs7Ozs7Ozs7Ozs7aUNDZkcsdUJBQXVCOzs7Ozs7Ozs7O0lBUWhDLFdBQVc7WUFBWCxXQUFXOzs7Ozs7O0FBS25CLFdBTFEsV0FBVyxHQUtoQjswQkFMSyxXQUFXOztBQU01QiwrQkFOaUIsV0FBVyw2Q0FNdEIsSUFBSSxFQUFFOztHQUViOztTQVJrQixXQUFXOzs7cUJBQVgsV0FBVzs7OztBQ1JoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIEBmaWxlIERvdCBuYXZpZ2F0aW9uLlxuICogQGRlc2NyaXB0aW9uIEJhc2VkIG9uIENvZHJvcHMnIGFydGljbGUgW0RvdCBOYXZpZ2F0aW9uIFN0eWxlc11cbiAqIChodHRwOi8vdHltcGFudXMubmV0L2NvZHJvcHMvMjAxNC8wMS8yMS9kb3QtbmF2aWdhdGlvbi1zdHlsZXMvKS5cbiAqIEBhdXRob3IgU8OpYmFzdGllbiBSb2Jhc3praWV3aWN6IFtzZWJhc3RpZW5Acm9iYXN6a2lld2ljei5jb21dXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuY2xhc3MgRG90TmF2IHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5jYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgdGhpcy5uYXYgPSBvcHRpb25zLm5hdjtcbiAgICB0aGlzLnNlbGVjdGVkID0gb3B0aW9ucy5zZWxlY3RlZDtcblxuICAgIHRoaXMuaW5pdCgpO1xuICB9XG5cbiAgaW5pdCgpIHtcbiAgICBjb25zdCBkb3RzID0gdGhpcy5uYXYucXVlcnlTZWxlY3RvckFsbCgnbGknKTtcblxuICAgIGRvdHNbdGhpcy5zZWxlY3RlZF0uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG90cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZG90ID0gZG90c1tpXTtcblxuICAgICAgZG90LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoaSAhPT0gdGhpcy5zZWxlY3RlZCkge1xuICAgICAgICAgIGRvdHNbdGhpcy5zZWxlY3RlZF0uY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKTtcblxuICAgICAgICAgIGRvdC5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpO1xuICAgICAgICAgIHRoaXMuY2FsbGJhY2soaSk7XG4gICAgICAgICAgdGhpcy5zZWxlY3RlZCA9IGk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IERvdE5hdjtcbiIsIi8qKlxuICogQGZpbGUgSW50ZXJhY3RpdmUgdmVyc2lvbiBvZiBEYWZ0IFB1bmsncyBMb3NlIFlvdXJzZWxmIFRvIERhbmNlLlxuICogQGF1dGhvciBTw6liYXN0aWVuIFJvYmFzemtpZXdpY3ogW2hlbGxvQHJvYmkubWVdXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBMaWJyYXJpZXMgYW5kIGZpbGVzXG5jb25zdCBhdWRpb0NvbnRleHQgPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpLmF1ZGlvQ29udGV4dDtcbmNvbnN0IERvdE5hdiA9IHJlcXVpcmUoJy4vRG90TmF2Jyk7XG5jb25zdCBHdWl0YXJFbmdpbmUgPSByZXF1aXJlKCcuL0d1aXRhckVuZ2luZScpO1xuY29uc3QgaW5wdXQgPSByZXF1aXJlKCdtb3Rpb24taW5wdXQnKTtcbmNvbnN0IFN1cGVyTG9hZGVyID0gcmVxdWlyZSgnd2F2ZXMtbG9hZGVycycpLlN1cGVyTG9hZGVyO1xuY29uc3QgUGxheUNvbnRyb2wgPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpLlBsYXlDb250cm9sO1xuY29uc3QgUGxheWVyRW5naW5lID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKS5QbGF5ZXJFbmdpbmU7XG5jb25zdCBTY3JhdGNoID0gcmVxdWlyZSgnLi9TY3JhdGNoJyk7XG5jb25zdCBUcmFuc3BvcnQgPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpLlRyYW5zcG9ydDtcblxuLy8gSGVscGVyIGZ1bmN0aW9uc1xuZnVuY3Rpb24gc3RhcnRXZWJBdWRpbygpIHtcbiAgY29uc3QgbyA9IGF1ZGlvQ29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gIGNvbnN0IGcgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICBjb25zdCBub3cgPSBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4gIG8uY29ubmVjdChnKTtcbiAgZy5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gIG8uc3RhcnQobm93KTtcbiAgby5zdG9wKG5vdyArIDAuMDAwMDAxKTtcbn1cblxuLy8gSGVscGVyIHZhcmlhYmxlc1xubGV0IHdlYkF1ZGlvU3RhcnRlZCA9IGZhbHNlO1xubGV0IHBsYXlpbmcgPSBmYWxzZTtcbmxldCB0aW1lb3V0ID0gbnVsbDtcblxuLy8gQ29uc3RhbnRzIChzb25nIHNwZWNpZmljKVxuY29uc3QgbW9kZSA9IDA7XG5jb25zdCBvZmZzZXQgPSAyLjQwMDtcbmNvbnN0IHBlcmlvZCA9IDAuMTUwO1xuXG4vLyBTY3JpcHRcbihmdW5jdGlvbigpIHtcbiAgY29uc3QgbG9hZGVyID0gbmV3IFN1cGVyTG9hZGVyKCk7XG5cbiAgLy8gUHJldmVudCBzY3JvbGxpbmdcbiAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfSk7XG5cbiAgUHJvbWlzZS5hbGwoW1xuICAgIGxvYWRlci5sb2FkKFsnYXNzZXRzL2JhY2t0cmFjay5tcDMnLCAnYXNzZXRzL2d1aXRhci5tcDMnLCAnYXNzZXRzL2d1aXRhci1tYXJrZXJzLmpzb24nXSksXG4gICAgaW5wdXQuaW5pdCgnZW5lcmd5JylcbiAgXSkudGhlbigoW2xvYWRlZEZpbGVzLCBpbnB1dE1vZHVsZXNdKSA9PiB7XG4gICAgLy8gRmlsZXMgYW5kIGVuZXJneSBtb2R1bGVcbiAgICBjb25zdCBiYWNrdHJhY2tCdWZmZXIgPSBsb2FkZWRGaWxlc1swXTtcbiAgICBjb25zdCBndWl0YXJCdWZmZXIgPSBsb2FkZWRGaWxlc1sxXTtcbiAgICBjb25zdCBndWl0YXJNYXJrZXJzID0gbG9hZGVkRmlsZXNbMl07XG4gICAgY29uc3QgZW5lcmd5ID0gaW5wdXRNb2R1bGVzWzBdO1xuXG4gICAgLy8gUGxheWVyIGVuZ2luZSAoYmFja3RyYWNrKVxuICAgIGNvbnN0IGJhY2t0cmFja1BsYXllciA9IG5ldyBQbGF5ZXJFbmdpbmUoe1xuICAgICAgYnVmZmVyOiBiYWNrdHJhY2tCdWZmZXIsXG4gICAgICBnYWluOiAwLjVcbiAgICB9KTtcbiAgICBiYWNrdHJhY2tQbGF5ZXIuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xuXG4gICAgLy8gSW5zdHJ1bWVudCBlbmdpbmUgKGd1aXRhcilcbiAgICBjb25zdCBndWl0YXJFbmdpbmUgPSBuZXcgR3VpdGFyRW5naW5lKHtcbiAgICAgIGF1ZGlvQnVmZmVyOiBndWl0YXJCdWZmZXIsXG4gICAgICBtb2RlOiBtb2RlLFxuICAgICAgbnVtQmVhdHM6IDIwMCxcbiAgICAgIG9mZnNldDogb2Zmc2V0LFxuICAgICAgcGVyaW9kOiBwZXJpb2QsXG4gICAgICBzZWdtZW50TWFya2VyczogZ3VpdGFyTWFya2Vyc1xuICAgIH0pO1xuICAgIGd1aXRhckVuZ2luZS5jb25uZWN0KGF1ZGlvQ29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAvLyBUcmFuc3BvcnRcbiAgICBjb25zdCB0cmFuc3BvcnQgPSBuZXcgVHJhbnNwb3J0KCk7XG4gICAgdHJhbnNwb3J0LmFkZChiYWNrdHJhY2tQbGF5ZXIsIDAsIEluZmluaXR5KTtcbiAgICB0cmFuc3BvcnQuYWRkKGd1aXRhckVuZ2luZSwgMCwgSW5maW5pdHkpO1xuXG4gICAgLy8gUGxheSBjb250cm9sXG4gICAgY29uc3QgcGxheUNvbnRyb2wgPSBuZXcgUGxheUNvbnRyb2wodHJhbnNwb3J0KTtcblxuICAgIC8vIERvdCBuYXZpZ2F0aW9uXG4gICAgY29uc3QgbmF2ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmRvdC1uYXYnKTtcbiAgICBjb25zdCBkb3ROYXYgPSBuZXcgRG90TmF2KHtcbiAgICAgIGNhbGxiYWNrOiBndWl0YXJFbmdpbmUuY2hhbmdlTW9kZS5iaW5kKGd1aXRhckVuZ2luZSksXG4gICAgICBuYXY6IG5hdixcbiAgICAgIHNlbGVjdGVkOiBtb2RlXG4gICAgfSk7XG5cbiAgICAvLyBCdXR0b25cbiAgICBsZXQgYnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J1dHRvbicpLnF1ZXJ5U2VsZWN0b3IoJ2knKTtcbiAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBpZiAoIXdlYkF1ZGlvU3RhcnRlZCkge1xuICAgICAgICBzdGFydFdlYkF1ZGlvKCk7XG4gICAgICAgIHdlYkF1ZGlvU3RhcnRlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghcGxheWluZykge1xuICAgICAgICBwbGF5Q29udHJvbC5zdGFydCgpO1xuICAgICAgICBndWl0YXJFbmdpbmUuc3RhcnQoKTtcbiAgICAgICAgcGxheWluZyA9IHRydWU7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHBsYXlDb250cm9sLnN0b3AoKTtcbiAgICAgICAgICBndWl0YXJFbmdpbmUuc3RvcCgpOyAvLyBUT0RPOiByZW1vdmUgaWYgZW1wdHlcbiAgICAgICAgICBidXR0b24uY2xhc3NMaXN0LnRvZ2dsZSgnaWNvbi1wbGF5Jyk7XG4gICAgICAgICAgYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoJ2ljb24tc3RvcCcpO1xuICAgICAgICAgIHBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgfSwgYmFja3RyYWNrQnVmZmVyLmR1cmF0aW9uICogMTAwMClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYXlDb250cm9sLnN0b3AoKTtcbiAgICAgICAgZ3VpdGFyRW5naW5lLnN0b3AoKTsgLy8gVE9ETzogcmVtb3ZlIGlmIGVtcHR5XG4gICAgICAgIHBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgfVxuXG4gICAgICBidXR0b24uY2xhc3NMaXN0LnRvZ2dsZSgnaWNvbi1wbGF5Jyk7XG4gICAgICBidXR0b24uY2xhc3NMaXN0LnRvZ2dsZSgnaWNvbi1zdG9wJyk7XG4gICAgfSk7XG5cbiAgICAvLyBUb2dnbGUgbG9hZGluZyAvIGJ1dHRvblxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2FkZXInKS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnV0dG9uJykuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJyk7XG5cbiAgICAvLyBTY3JhdGNoXG4gICAgY29uc3Qgc2NyYXRjaCA9IG5ldyBTY3JhdGNoKCk7XG4gICAgc2NyYXRjaC5vbignc2NyYXRjaCcsICh2YWwpID0+IHtcbiAgICAgIGd1aXRhckVuZ2luZS5vblNjcmF0Y2godmFsKTtcbiAgICB9KTtcblxuICAgIC8vIElucHV0IG1vZHVsZSBsaXN0ZW5lclxuICAgIGNvbnN0IGluc3RyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmluc3RydWN0aW9ucycpXG4gICAgaWYgKGVuZXJneS5pc1ZhbGlkKSB7XG4gICAgICBpbnN0ci5pbm5lckhUTUwgPSBgaGl0ICZsc3F1bztwbGF5JnJzcXVvOyBhbmQgc2hha2UgeW91ciBkZXZpY2VcbiAgICAgICAgPC9icj4ob3Igc2NyYXRjaCB0aGUgc2NyZWVuKWA7XG4gICAgICBpbnB1dC5hZGRMaXN0ZW5lcignZW5lcmd5JywgKHZhbCkgPT4ge1xuICAgICAgICBndWl0YXJFbmdpbmUub25FbmVyZ3kodmFsKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoJ29udG91Y2hzdGFydCcgaW4gd2luZG93KSB7XG4gICAgICBpbnN0ci5pbm5lckhUTUwgPSAnaGl0ICZsc3F1bztwbGF5JnJzcXVvOyBhbmQgc2NyYXRjaCB0aGUgc2NyZWVuJztcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zdHIuaW5uZXJIVE1MID0gJ2hpdCAmbHNxdW87cGxheSZyc3F1bzsgYW5kIG1vdmUgeW91ciBtb3VzZSc7XG4gICAgfVxuICB9KTtcbn0oKSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHsgXCJkZWZhdWx0XCI6IHJlcXVpcmUoXCJjb3JlLWpzL2xpYnJhcnkvZm4vZ2V0LWl0ZXJhdG9yXCIpLCBfX2VzTW9kdWxlOiB0cnVlIH07IiwibW9kdWxlLmV4cG9ydHMgPSB7IFwiZGVmYXVsdFwiOiByZXF1aXJlKFwiY29yZS1qcy9saWJyYXJ5L2ZuL2lzLWl0ZXJhYmxlXCIpLCBfX2VzTW9kdWxlOiB0cnVlIH07IiwibW9kdWxlLmV4cG9ydHMgPSB7IFwiZGVmYXVsdFwiOiByZXF1aXJlKFwiY29yZS1qcy9saWJyYXJ5L2ZuL29iamVjdC9jcmVhdGVcIiksIF9fZXNNb2R1bGU6IHRydWUgfTsiLCJtb2R1bGUuZXhwb3J0cyA9IHsgXCJkZWZhdWx0XCI6IHJlcXVpcmUoXCJjb3JlLWpzL2xpYnJhcnkvZm4vb2JqZWN0L2RlZmluZS1wcm9wZXJ0eVwiKSwgX19lc01vZHVsZTogdHJ1ZSB9OyIsIm1vZHVsZS5leHBvcnRzID0geyBcImRlZmF1bHRcIjogcmVxdWlyZShcImNvcmUtanMvbGlicmFyeS9mbi9vYmplY3QvZ2V0LW93bi1wcm9wZXJ0eS1kZXNjcmlwdG9yXCIpLCBfX2VzTW9kdWxlOiB0cnVlIH07IiwibW9kdWxlLmV4cG9ydHMgPSB7IFwiZGVmYXVsdFwiOiByZXF1aXJlKFwiY29yZS1qcy9saWJyYXJ5L2ZuL29iamVjdC9zZXQtcHJvdG90eXBlLW9mXCIpLCBfX2VzTW9kdWxlOiB0cnVlIH07IiwibW9kdWxlLmV4cG9ydHMgPSB7IFwiZGVmYXVsdFwiOiByZXF1aXJlKFwiY29yZS1qcy9saWJyYXJ5L2ZuL3Byb21pc2VcIiksIF9fZXNNb2R1bGU6IHRydWUgfTsiLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBmdW5jdGlvbiAoaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7XG4gIGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTtcbiAgfVxufTtcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIF9PYmplY3QkZGVmaW5lUHJvcGVydHkgPSByZXF1aXJlKFwiYmFiZWwtcnVudGltZS9jb3JlLWpzL29iamVjdC9kZWZpbmUtcHJvcGVydHlcIilbXCJkZWZhdWx0XCJdO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07XG4gICAgICBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7XG4gICAgICBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG4gICAgICBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlO1xuXG4gICAgICBfT2JqZWN0JGRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gICAgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcbiAgICBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTtcbiAgICByZXR1cm4gQ29uc3RydWN0b3I7XG4gIH07XG59KSgpO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgPSByZXF1aXJlKFwiYmFiZWwtcnVudGltZS9jb3JlLWpzL29iamVjdC9nZXQtb3duLXByb3BlcnR5LWRlc2NyaXB0b3JcIilbXCJkZWZhdWx0XCJdO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IGZ1bmN0aW9uIGdldChfeCwgX3gyLCBfeDMpIHtcbiAgdmFyIF9hZ2FpbiA9IHRydWU7XG5cbiAgX2Z1bmN0aW9uOiB3aGlsZSAoX2FnYWluKSB7XG4gICAgdmFyIG9iamVjdCA9IF94LFxuICAgICAgICBwcm9wZXJ0eSA9IF94MixcbiAgICAgICAgcmVjZWl2ZXIgPSBfeDM7XG4gICAgZGVzYyA9IHBhcmVudCA9IGdldHRlciA9IHVuZGVmaW5lZDtcbiAgICBfYWdhaW4gPSBmYWxzZTtcbiAgICBpZiAob2JqZWN0ID09PSBudWxsKSBvYmplY3QgPSBGdW5jdGlvbi5wcm90b3R5cGU7XG5cbiAgICB2YXIgZGVzYyA9IF9PYmplY3QkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwgcHJvcGVydHkpO1xuXG4gICAgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIHBhcmVudCA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmplY3QpO1xuXG4gICAgICBpZiAocGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfeCA9IHBhcmVudDtcbiAgICAgICAgX3gyID0gcHJvcGVydHk7XG4gICAgICAgIF94MyA9IHJlY2VpdmVyO1xuICAgICAgICBfYWdhaW4gPSB0cnVlO1xuICAgICAgICBjb250aW51ZSBfZnVuY3Rpb247XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChcInZhbHVlXCIgaW4gZGVzYykge1xuICAgICAgcmV0dXJuIGRlc2MudmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBnZXR0ZXIgPSBkZXNjLmdldDtcblxuICAgICAgaWYgKGdldHRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBnZXR0ZXIuY2FsbChyZWNlaXZlcik7XG4gICAgfVxuICB9XG59O1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgX09iamVjdCRjcmVhdGUgPSByZXF1aXJlKFwiYmFiZWwtcnVudGltZS9jb3JlLWpzL29iamVjdC9jcmVhdGVcIilbXCJkZWZhdWx0XCJdO1xuXG52YXIgX09iamVjdCRzZXRQcm90b3R5cGVPZiA9IHJlcXVpcmUoXCJiYWJlbC1ydW50aW1lL2NvcmUtanMvb2JqZWN0L3NldC1wcm90b3R5cGUtb2ZcIilbXCJkZWZhdWx0XCJdO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IGZ1bmN0aW9uIChzdWJDbGFzcywgc3VwZXJDbGFzcykge1xuICBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09IFwiZnVuY3Rpb25cIiAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgXCIgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7XG4gIH1cblxuICBzdWJDbGFzcy5wcm90b3R5cGUgPSBfT2JqZWN0JGNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHtcbiAgICAgIHZhbHVlOiBzdWJDbGFzcyxcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuICBpZiAoc3VwZXJDbGFzcykgX09iamVjdCRzZXRQcm90b3R5cGVPZiA/IF9PYmplY3Qkc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzcztcbn07XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDoge1xuICAgIFwiZGVmYXVsdFwiOiBvYmpcbiAgfTtcbn07XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBfZ2V0SXRlcmF0b3IgPSByZXF1aXJlKFwiYmFiZWwtcnVudGltZS9jb3JlLWpzL2dldC1pdGVyYXRvclwiKVtcImRlZmF1bHRcIl07XG5cbnZhciBfaXNJdGVyYWJsZSA9IHJlcXVpcmUoXCJiYWJlbC1ydW50aW1lL2NvcmUtanMvaXMtaXRlcmFibGVcIilbXCJkZWZhdWx0XCJdO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIHNsaWNlSXRlcmF0b3IoYXJyLCBpKSB7XG4gICAgdmFyIF9hcnIgPSBbXTtcbiAgICB2YXIgX24gPSB0cnVlO1xuICAgIHZhciBfZCA9IGZhbHNlO1xuICAgIHZhciBfZSA9IHVuZGVmaW5lZDtcblxuICAgIHRyeSB7XG4gICAgICBmb3IgKHZhciBfaSA9IF9nZXRJdGVyYXRvcihhcnIpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkge1xuICAgICAgICBfYXJyLnB1c2goX3MudmFsdWUpO1xuXG4gICAgICAgIGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhaztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIF9kID0gdHJ1ZTtcbiAgICAgIF9lID0gZXJyO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoIV9uICYmIF9pW1wicmV0dXJuXCJdKSBfaVtcInJldHVyblwiXSgpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKF9kKSB0aHJvdyBfZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gX2FycjtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoYXJyLCBpKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkge1xuICAgICAgcmV0dXJuIGFycjtcbiAgICB9IGVsc2UgaWYgKF9pc0l0ZXJhYmxlKE9iamVjdChhcnIpKSkge1xuICAgICAgcmV0dXJuIHNsaWNlSXRlcmF0b3IoYXJyLCBpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2VcIik7XG4gICAgfVxuICB9O1xufSkoKTtcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTsiLCJyZXF1aXJlKCcuLi9tb2R1bGVzL3dlYi5kb20uaXRlcmFibGUnKTtcbnJlcXVpcmUoJy4uL21vZHVsZXMvZXM2LnN0cmluZy5pdGVyYXRvcicpO1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLi9tb2R1bGVzL2NvcmUuZ2V0LWl0ZXJhdG9yJyk7IiwicmVxdWlyZSgnLi4vbW9kdWxlcy93ZWIuZG9tLml0ZXJhYmxlJyk7XG5yZXF1aXJlKCcuLi9tb2R1bGVzL2VzNi5zdHJpbmcuaXRlcmF0b3InKTtcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi4vbW9kdWxlcy9jb3JlLmlzLWl0ZXJhYmxlJyk7IiwidmFyICQgPSByZXF1aXJlKCcuLi8uLi9tb2R1bGVzLyQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlKFAsIEQpe1xuICByZXR1cm4gJC5jcmVhdGUoUCwgRCk7XG59OyIsInZhciAkID0gcmVxdWlyZSgnLi4vLi4vbW9kdWxlcy8kJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlZmluZVByb3BlcnR5KGl0LCBrZXksIGRlc2Mpe1xuICByZXR1cm4gJC5zZXREZXNjKGl0LCBrZXksIGRlc2MpO1xufTsiLCJ2YXIgJCA9IHJlcXVpcmUoJy4uLy4uL21vZHVsZXMvJCcpO1xucmVxdWlyZSgnLi4vLi4vbW9kdWxlcy9lczYub2JqZWN0LmdldC1vd24tcHJvcGVydHktZGVzY3JpcHRvcicpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoaXQsIGtleSl7XG4gIHJldHVybiAkLmdldERlc2MoaXQsIGtleSk7XG59OyIsInJlcXVpcmUoJy4uLy4uL21vZHVsZXMvZXM2Lm9iamVjdC5zZXQtcHJvdG90eXBlLW9mJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4uLy4uL21vZHVsZXMvJC5jb3JlJykuT2JqZWN0LnNldFByb3RvdHlwZU9mOyIsInJlcXVpcmUoJy4uL21vZHVsZXMvZXM2Lm9iamVjdC50by1zdHJpbmcnKTtcbnJlcXVpcmUoJy4uL21vZHVsZXMvZXM2LnN0cmluZy5pdGVyYXRvcicpO1xucmVxdWlyZSgnLi4vbW9kdWxlcy93ZWIuZG9tLml0ZXJhYmxlJyk7XG5yZXF1aXJlKCcuLi9tb2R1bGVzL2VzNi5wcm9taXNlJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4uL21vZHVsZXMvJC5jb3JlJykuUHJvbWlzZTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGl0KXtcbiAgaWYodHlwZW9mIGl0ICE9ICdmdW5jdGlvbicpdGhyb3cgVHlwZUVycm9yKGl0ICsgJyBpcyBub3QgYSBmdW5jdGlvbiEnKTtcbiAgcmV0dXJuIGl0O1xufTsiLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKCcuLyQuaXMtb2JqZWN0Jyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGl0KXtcbiAgaWYoIWlzT2JqZWN0KGl0KSl0aHJvdyBUeXBlRXJyb3IoaXQgKyAnIGlzIG5vdCBhbiBvYmplY3QhJyk7XG4gIHJldHVybiBpdDtcbn07IiwiLy8gZ2V0dGluZyB0YWcgZnJvbSAxOS4xLjMuNiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nKClcbnZhciBjb2YgPSByZXF1aXJlKCcuLyQuY29mJylcbiAgLCBUQUcgPSByZXF1aXJlKCcuLyQud2tzJykoJ3RvU3RyaW5nVGFnJylcbiAgLy8gRVMzIHdyb25nIGhlcmVcbiAgLCBBUkcgPSBjb2YoZnVuY3Rpb24oKXsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKSA9PSAnQXJndW1lbnRzJztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihpdCl7XG4gIHZhciBPLCBULCBCO1xuICByZXR1cm4gaXQgPT09IHVuZGVmaW5lZCA/ICdVbmRlZmluZWQnIDogaXQgPT09IG51bGwgPyAnTnVsbCdcbiAgICAvLyBAQHRvU3RyaW5nVGFnIGNhc2VcbiAgICA6IHR5cGVvZiAoVCA9IChPID0gT2JqZWN0KGl0KSlbVEFHXSkgPT0gJ3N0cmluZycgPyBUXG4gICAgLy8gYnVpbHRpblRhZyBjYXNlXG4gICAgOiBBUkcgPyBjb2YoTylcbiAgICAvLyBFUzMgYXJndW1lbnRzIGZhbGxiYWNrXG4gICAgOiAoQiA9IGNvZihPKSkgPT0gJ09iamVjdCcgJiYgdHlwZW9mIE8uY2FsbGVlID09ICdmdW5jdGlvbicgPyAnQXJndW1lbnRzJyA6IEI7XG59OyIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGl0KXtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpLnNsaWNlKDgsIC0xKTtcbn07IiwidmFyIGNvcmUgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuaWYodHlwZW9mIF9fZSA9PSAnbnVtYmVyJylfX2UgPSBjb3JlOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmIiwiLy8gb3B0aW9uYWwgLyBzaW1wbGUgY29udGV4dCBiaW5kaW5nXG52YXIgYUZ1bmN0aW9uID0gcmVxdWlyZSgnLi8kLmEtZnVuY3Rpb24nKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZm4sIHRoYXQsIGxlbmd0aCl7XG4gIGFGdW5jdGlvbihmbik7XG4gIGlmKHRoYXQgPT09IHVuZGVmaW5lZClyZXR1cm4gZm47XG4gIHN3aXRjaChsZW5ndGgpe1xuICAgIGNhc2UgMTogcmV0dXJuIGZ1bmN0aW9uKGEpe1xuICAgICAgcmV0dXJuIGZuLmNhbGwodGhhdCwgYSk7XG4gICAgfTtcbiAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbihhLCBiKXtcbiAgICAgIHJldHVybiBmbi5jYWxsKHRoYXQsIGEsIGIpO1xuICAgIH07XG4gICAgY2FzZSAzOiByZXR1cm4gZnVuY3Rpb24oYSwgYiwgYyl7XG4gICAgICByZXR1cm4gZm4uY2FsbCh0aGF0LCBhLCBiLCBjKTtcbiAgICB9O1xuICB9IHJldHVybiBmdW5jdGlvbigvKiAuLi5hcmdzICovKXtcbiAgICAgIHJldHVybiBmbi5hcHBseSh0aGF0LCBhcmd1bWVudHMpO1xuICAgIH07XG59OyIsInZhciBnbG9iYWwgICAgPSByZXF1aXJlKCcuLyQuZ2xvYmFsJylcbiAgLCBjb3JlICAgICAgPSByZXF1aXJlKCcuLyQuY29yZScpXG4gICwgUFJPVE9UWVBFID0gJ3Byb3RvdHlwZSc7XG52YXIgY3R4ID0gZnVuY3Rpb24oZm4sIHRoYXQpe1xuICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gZm4uYXBwbHkodGhhdCwgYXJndW1lbnRzKTtcbiAgfTtcbn07XG52YXIgJGRlZiA9IGZ1bmN0aW9uKHR5cGUsIG5hbWUsIHNvdXJjZSl7XG4gIHZhciBrZXksIG93biwgb3V0LCBleHBcbiAgICAsIGlzR2xvYmFsID0gdHlwZSAmICRkZWYuR1xuICAgICwgaXNQcm90byAgPSB0eXBlICYgJGRlZi5QXG4gICAgLCB0YXJnZXQgICA9IGlzR2xvYmFsID8gZ2xvYmFsIDogdHlwZSAmICRkZWYuU1xuICAgICAgICA/IGdsb2JhbFtuYW1lXSA6IChnbG9iYWxbbmFtZV0gfHwge30pW1BST1RPVFlQRV1cbiAgICAsIGV4cG9ydHMgID0gaXNHbG9iYWwgPyBjb3JlIDogY29yZVtuYW1lXSB8fCAoY29yZVtuYW1lXSA9IHt9KTtcbiAgaWYoaXNHbG9iYWwpc291cmNlID0gbmFtZTtcbiAgZm9yKGtleSBpbiBzb3VyY2Upe1xuICAgIC8vIGNvbnRhaW5zIGluIG5hdGl2ZVxuICAgIG93biA9ICEodHlwZSAmICRkZWYuRikgJiYgdGFyZ2V0ICYmIGtleSBpbiB0YXJnZXQ7XG4gICAgaWYob3duICYmIGtleSBpbiBleHBvcnRzKWNvbnRpbnVlO1xuICAgIC8vIGV4cG9ydCBuYXRpdmUgb3IgcGFzc2VkXG4gICAgb3V0ID0gb3duID8gdGFyZ2V0W2tleV0gOiBzb3VyY2Vba2V5XTtcbiAgICAvLyBwcmV2ZW50IGdsb2JhbCBwb2xsdXRpb24gZm9yIG5hbWVzcGFjZXNcbiAgICBpZihpc0dsb2JhbCAmJiB0eXBlb2YgdGFyZ2V0W2tleV0gIT0gJ2Z1bmN0aW9uJylleHAgPSBzb3VyY2Vba2V5XTtcbiAgICAvLyBiaW5kIHRpbWVycyB0byBnbG9iYWwgZm9yIGNhbGwgZnJvbSBleHBvcnQgY29udGV4dFxuICAgIGVsc2UgaWYodHlwZSAmICRkZWYuQiAmJiBvd24pZXhwID0gY3R4KG91dCwgZ2xvYmFsKTtcbiAgICAvLyB3cmFwIGdsb2JhbCBjb25zdHJ1Y3RvcnMgZm9yIHByZXZlbnQgY2hhbmdlIHRoZW0gaW4gbGlicmFyeVxuICAgIGVsc2UgaWYodHlwZSAmICRkZWYuVyAmJiB0YXJnZXRba2V5XSA9PSBvdXQpIWZ1bmN0aW9uKEMpe1xuICAgICAgZXhwID0gZnVuY3Rpb24ocGFyYW0pe1xuICAgICAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIEMgPyBuZXcgQyhwYXJhbSkgOiBDKHBhcmFtKTtcbiAgICAgIH07XG4gICAgICBleHBbUFJPVE9UWVBFXSA9IENbUFJPVE9UWVBFXTtcbiAgICB9KG91dCk7XG4gICAgZWxzZSBleHAgPSBpc1Byb3RvICYmIHR5cGVvZiBvdXQgPT0gJ2Z1bmN0aW9uJyA/IGN0eChGdW5jdGlvbi5jYWxsLCBvdXQpIDogb3V0O1xuICAgIC8vIGV4cG9ydFxuICAgIGV4cG9ydHNba2V5XSA9IGV4cDtcbiAgICBpZihpc1Byb3RvKShleHBvcnRzW1BST1RPVFlQRV0gfHwgKGV4cG9ydHNbUFJPVE9UWVBFXSA9IHt9KSlba2V5XSA9IG91dDtcbiAgfVxufTtcbi8vIHR5cGUgYml0bWFwXG4kZGVmLkYgPSAxOyAgLy8gZm9yY2VkXG4kZGVmLkcgPSAyOyAgLy8gZ2xvYmFsXG4kZGVmLlMgPSA0OyAgLy8gc3RhdGljXG4kZGVmLlAgPSA4OyAgLy8gcHJvdG9cbiRkZWYuQiA9IDE2OyAvLyBiaW5kXG4kZGVmLlcgPSAzMjsgLy8gd3JhcFxubW9kdWxlLmV4cG9ydHMgPSAkZGVmOyIsIi8vIDcuMi4xIFJlcXVpcmVPYmplY3RDb2VyY2libGUoYXJndW1lbnQpXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGl0KXtcbiAgaWYoaXQgPT0gdW5kZWZpbmVkKXRocm93IFR5cGVFcnJvcihcIkNhbid0IGNhbGwgbWV0aG9kIG9uICBcIiArIGl0KTtcbiAgcmV0dXJuIGl0O1xufTsiLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKCcuLyQuaXMtb2JqZWN0JylcbiAgLCBkb2N1bWVudCA9IHJlcXVpcmUoJy4vJC5nbG9iYWwnKS5kb2N1bWVudFxuICAvLyBpbiBvbGQgSUUgdHlwZW9mIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQgaXMgJ29iamVjdCdcbiAgLCBpcyA9IGlzT2JqZWN0KGRvY3VtZW50KSAmJiBpc09iamVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50KTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXQpe1xuICByZXR1cm4gaXMgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGl0KSA6IHt9O1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGV4ZWMpe1xuICB0cnkge1xuICAgIHJldHVybiAhIWV4ZWMoKTtcbiAgfSBjYXRjaChlKXtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufTsiLCJ2YXIgY3R4ICAgICAgICAgPSByZXF1aXJlKCcuLyQuY3R4JylcbiAgLCBjYWxsICAgICAgICA9IHJlcXVpcmUoJy4vJC5pdGVyLWNhbGwnKVxuICAsIGlzQXJyYXlJdGVyID0gcmVxdWlyZSgnLi8kLmlzLWFycmF5LWl0ZXInKVxuICAsIGFuT2JqZWN0ICAgID0gcmVxdWlyZSgnLi8kLmFuLW9iamVjdCcpXG4gICwgdG9MZW5ndGggICAgPSByZXF1aXJlKCcuLyQudG8tbGVuZ3RoJylcbiAgLCBnZXRJdGVyRm4gICA9IHJlcXVpcmUoJy4vY29yZS5nZXQtaXRlcmF0b3ItbWV0aG9kJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGl0ZXJhYmxlLCBlbnRyaWVzLCBmbiwgdGhhdCl7XG4gIHZhciBpdGVyRm4gPSBnZXRJdGVyRm4oaXRlcmFibGUpXG4gICAgLCBmICAgICAgPSBjdHgoZm4sIHRoYXQsIGVudHJpZXMgPyAyIDogMSlcbiAgICAsIGluZGV4ICA9IDBcbiAgICAsIGxlbmd0aCwgc3RlcCwgaXRlcmF0b3I7XG4gIGlmKHR5cGVvZiBpdGVyRm4gIT0gJ2Z1bmN0aW9uJyl0aHJvdyBUeXBlRXJyb3IoaXRlcmFibGUgKyAnIGlzIG5vdCBpdGVyYWJsZSEnKTtcbiAgLy8gZmFzdCBjYXNlIGZvciBhcnJheXMgd2l0aCBkZWZhdWx0IGl0ZXJhdG9yXG4gIGlmKGlzQXJyYXlJdGVyKGl0ZXJGbikpZm9yKGxlbmd0aCA9IHRvTGVuZ3RoKGl0ZXJhYmxlLmxlbmd0aCk7IGxlbmd0aCA+IGluZGV4OyBpbmRleCsrKXtcbiAgICBlbnRyaWVzID8gZihhbk9iamVjdChzdGVwID0gaXRlcmFibGVbaW5kZXhdKVswXSwgc3RlcFsxXSkgOiBmKGl0ZXJhYmxlW2luZGV4XSk7XG4gIH0gZWxzZSBmb3IoaXRlcmF0b3IgPSBpdGVyRm4uY2FsbChpdGVyYWJsZSk7ICEoc3RlcCA9IGl0ZXJhdG9yLm5leHQoKSkuZG9uZTsgKXtcbiAgICBjYWxsKGl0ZXJhdG9yLCBmLCBzdGVwLnZhbHVlLCBlbnRyaWVzKTtcbiAgfVxufTsiLCIvLyBodHRwczovL2dpdGh1Yi5jb20vemxvaXJvY2svY29yZS1qcy9pc3N1ZXMvODYjaXNzdWVjb21tZW50LTExNTc1OTAyOFxudmFyIFVOREVGSU5FRCA9ICd1bmRlZmluZWQnO1xudmFyIGdsb2JhbCA9IG1vZHVsZS5leHBvcnRzID0gdHlwZW9mIHdpbmRvdyAhPSBVTkRFRklORUQgJiYgd2luZG93Lk1hdGggPT0gTWF0aFxuICA/IHdpbmRvdyA6IHR5cGVvZiBzZWxmICE9IFVOREVGSU5FRCAmJiBzZWxmLk1hdGggPT0gTWF0aCA/IHNlbGYgOiBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuaWYodHlwZW9mIF9fZyA9PSAnbnVtYmVyJylfX2cgPSBnbG9iYWw7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW5kZWYiLCJ2YXIgaGFzT3duUHJvcGVydHkgPSB7fS5oYXNPd25Qcm9wZXJ0eTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXQsIGtleSl7XG4gIHJldHVybiBoYXNPd25Qcm9wZXJ0eS5jYWxsKGl0LCBrZXkpO1xufTsiLCJ2YXIgJCAgICAgICAgICA9IHJlcXVpcmUoJy4vJCcpXG4gICwgY3JlYXRlRGVzYyA9IHJlcXVpcmUoJy4vJC5wcm9wZXJ0eS1kZXNjJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vJC5zdXBwb3J0LWRlc2MnKSA/IGZ1bmN0aW9uKG9iamVjdCwga2V5LCB2YWx1ZSl7XG4gIHJldHVybiAkLnNldERlc2Mob2JqZWN0LCBrZXksIGNyZWF0ZURlc2MoMSwgdmFsdWUpKTtcbn0gOiBmdW5jdGlvbihvYmplY3QsIGtleSwgdmFsdWUpe1xuICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICByZXR1cm4gb2JqZWN0O1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vJC5nbG9iYWwnKS5kb2N1bWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7IiwiLy8gZmFzdCBhcHBseSwgaHR0cDovL2pzcGVyZi5sbmtpdC5jb20vZmFzdC1hcHBseS81XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZuLCBhcmdzLCB0aGF0KXtcbiAgdmFyIHVuID0gdGhhdCA9PT0gdW5kZWZpbmVkO1xuICBzd2l0Y2goYXJncy5sZW5ndGgpe1xuICAgIGNhc2UgMDogcmV0dXJuIHVuID8gZm4oKVxuICAgICAgICAgICAgICAgICAgICAgIDogZm4uY2FsbCh0aGF0KTtcbiAgICBjYXNlIDE6IHJldHVybiB1biA/IGZuKGFyZ3NbMF0pXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQsIGFyZ3NbMF0pO1xuICAgIGNhc2UgMjogcmV0dXJuIHVuID8gZm4oYXJnc1swXSwgYXJnc1sxXSlcbiAgICAgICAgICAgICAgICAgICAgICA6IGZuLmNhbGwodGhhdCwgYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgY2FzZSAzOiByZXR1cm4gdW4gPyBmbihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKVxuICAgICAgICAgICAgICAgICAgICAgIDogZm4uY2FsbCh0aGF0LCBhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKTtcbiAgICBjYXNlIDQ6IHJldHVybiB1biA/IGZuKGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10pXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQsIGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10pO1xuICB9IHJldHVybiAgICAgICAgICAgICAgZm4uYXBwbHkodGhhdCwgYXJncyk7XG59OyIsIi8vIGluZGV4ZWQgb2JqZWN0LCBmYWxsYmFjayBmb3Igbm9uLWFycmF5LWxpa2UgRVMzIHN0cmluZ3NcbnZhciBjb2YgPSByZXF1aXJlKCcuLyQuY29mJyk7XG5tb2R1bGUuZXhwb3J0cyA9IDAgaW4gT2JqZWN0KCd6JykgPyBPYmplY3QgOiBmdW5jdGlvbihpdCl7XG4gIHJldHVybiBjb2YoaXQpID09ICdTdHJpbmcnID8gaXQuc3BsaXQoJycpIDogT2JqZWN0KGl0KTtcbn07IiwiLy8gY2hlY2sgb24gZGVmYXVsdCBBcnJheSBpdGVyYXRvclxudmFyIEl0ZXJhdG9ycyA9IHJlcXVpcmUoJy4vJC5pdGVyYXRvcnMnKVxuICAsIElURVJBVE9SICA9IHJlcXVpcmUoJy4vJC53a3MnKSgnaXRlcmF0b3InKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXQpe1xuICByZXR1cm4gKEl0ZXJhdG9ycy5BcnJheSB8fCBBcnJheS5wcm90b3R5cGVbSVRFUkFUT1JdKSA9PT0gaXQ7XG59OyIsIi8vIGh0dHA6Ly9qc3BlcmYuY29tL2NvcmUtanMtaXNvYmplY3Rcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXQpe1xuICByZXR1cm4gaXQgIT09IG51bGwgJiYgKHR5cGVvZiBpdCA9PSAnb2JqZWN0JyB8fCB0eXBlb2YgaXQgPT0gJ2Z1bmN0aW9uJyk7XG59OyIsIi8vIGNhbGwgc29tZXRoaW5nIG9uIGl0ZXJhdG9yIHN0ZXAgd2l0aCBzYWZlIGNsb3Npbmcgb24gZXJyb3JcbnZhciBhbk9iamVjdCA9IHJlcXVpcmUoJy4vJC5hbi1vYmplY3QnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXRlcmF0b3IsIGZuLCB2YWx1ZSwgZW50cmllcyl7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGVudHJpZXMgPyBmbihhbk9iamVjdCh2YWx1ZSlbMF0sIHZhbHVlWzFdKSA6IGZuKHZhbHVlKTtcbiAgLy8gNy40LjYgSXRlcmF0b3JDbG9zZShpdGVyYXRvciwgY29tcGxldGlvbilcbiAgfSBjYXRjaChlKXtcbiAgICB2YXIgcmV0ID0gaXRlcmF0b3JbJ3JldHVybiddO1xuICAgIGlmKHJldCAhPT0gdW5kZWZpbmVkKWFuT2JqZWN0KHJldC5jYWxsKGl0ZXJhdG9yKSk7XG4gICAgdGhyb3cgZTtcbiAgfVxufTsiLCIndXNlIHN0cmljdCc7XG52YXIgJCA9IHJlcXVpcmUoJy4vJCcpXG4gICwgSXRlcmF0b3JQcm90b3R5cGUgPSB7fTtcblxuLy8gMjUuMS4yLjEuMSAlSXRlcmF0b3JQcm90b3R5cGUlW0BAaXRlcmF0b3JdKClcbnJlcXVpcmUoJy4vJC5oaWRlJykoSXRlcmF0b3JQcm90b3R5cGUsIHJlcXVpcmUoJy4vJC53a3MnKSgnaXRlcmF0b3InKSwgZnVuY3Rpb24oKXsgcmV0dXJuIHRoaXM7IH0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKENvbnN0cnVjdG9yLCBOQU1FLCBuZXh0KXtcbiAgQ29uc3RydWN0b3IucHJvdG90eXBlID0gJC5jcmVhdGUoSXRlcmF0b3JQcm90b3R5cGUsIHtuZXh0OiByZXF1aXJlKCcuLyQucHJvcGVydHktZGVzYycpKDEsbmV4dCl9KTtcbiAgcmVxdWlyZSgnLi8kLnRhZycpKENvbnN0cnVjdG9yLCBOQU1FICsgJyBJdGVyYXRvcicpO1xufTsiLCIndXNlIHN0cmljdCc7XG52YXIgTElCUkFSWSAgICAgICAgID0gcmVxdWlyZSgnLi8kLmxpYnJhcnknKVxuICAsICRkZWYgICAgICAgICAgICA9IHJlcXVpcmUoJy4vJC5kZWYnKVxuICAsICRyZWRlZiAgICAgICAgICA9IHJlcXVpcmUoJy4vJC5yZWRlZicpXG4gICwgaGlkZSAgICAgICAgICAgID0gcmVxdWlyZSgnLi8kLmhpZGUnKVxuICAsIGhhcyAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vJC5oYXMnKVxuICAsIFNZTUJPTF9JVEVSQVRPUiA9IHJlcXVpcmUoJy4vJC53a3MnKSgnaXRlcmF0b3InKVxuICAsIEl0ZXJhdG9ycyAgICAgICA9IHJlcXVpcmUoJy4vJC5pdGVyYXRvcnMnKVxuICAsIEJVR0dZICAgICAgICAgICA9ICEoW10ua2V5cyAmJiAnbmV4dCcgaW4gW10ua2V5cygpKSAvLyBTYWZhcmkgaGFzIGJ1Z2d5IGl0ZXJhdG9ycyB3L28gYG5leHRgXG4gICwgRkZfSVRFUkFUT1IgICAgID0gJ0BAaXRlcmF0b3InXG4gICwgS0VZUyAgICAgICAgICAgID0gJ2tleXMnXG4gICwgVkFMVUVTICAgICAgICAgID0gJ3ZhbHVlcyc7XG52YXIgcmV0dXJuVGhpcyA9IGZ1bmN0aW9uKCl7IHJldHVybiB0aGlzOyB9O1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihCYXNlLCBOQU1FLCBDb25zdHJ1Y3RvciwgbmV4dCwgREVGQVVMVCwgSVNfU0VULCBGT1JDRSl7XG4gIHJlcXVpcmUoJy4vJC5pdGVyLWNyZWF0ZScpKENvbnN0cnVjdG9yLCBOQU1FLCBuZXh0KTtcbiAgdmFyIGNyZWF0ZU1ldGhvZCA9IGZ1bmN0aW9uKGtpbmQpe1xuICAgIHN3aXRjaChraW5kKXtcbiAgICAgIGNhc2UgS0VZUzogcmV0dXJuIGZ1bmN0aW9uIGtleXMoKXsgcmV0dXJuIG5ldyBDb25zdHJ1Y3Rvcih0aGlzLCBraW5kKTsgfTtcbiAgICAgIGNhc2UgVkFMVUVTOiByZXR1cm4gZnVuY3Rpb24gdmFsdWVzKCl7IHJldHVybiBuZXcgQ29uc3RydWN0b3IodGhpcywga2luZCk7IH07XG4gICAgfSByZXR1cm4gZnVuY3Rpb24gZW50cmllcygpeyByZXR1cm4gbmV3IENvbnN0cnVjdG9yKHRoaXMsIGtpbmQpOyB9O1xuICB9O1xuICB2YXIgVEFHICAgICAgPSBOQU1FICsgJyBJdGVyYXRvcidcbiAgICAsIHByb3RvICAgID0gQmFzZS5wcm90b3R5cGVcbiAgICAsIF9uYXRpdmUgID0gcHJvdG9bU1lNQk9MX0lURVJBVE9SXSB8fCBwcm90b1tGRl9JVEVSQVRPUl0gfHwgREVGQVVMVCAmJiBwcm90b1tERUZBVUxUXVxuICAgICwgX2RlZmF1bHQgPSBfbmF0aXZlIHx8IGNyZWF0ZU1ldGhvZChERUZBVUxUKVxuICAgICwgbWV0aG9kcywga2V5O1xuICAvLyBGaXggbmF0aXZlXG4gIGlmKF9uYXRpdmUpe1xuICAgIHZhciBJdGVyYXRvclByb3RvdHlwZSA9IHJlcXVpcmUoJy4vJCcpLmdldFByb3RvKF9kZWZhdWx0LmNhbGwobmV3IEJhc2UpKTtcbiAgICAvLyBTZXQgQEB0b1N0cmluZ1RhZyB0byBuYXRpdmUgaXRlcmF0b3JzXG4gICAgcmVxdWlyZSgnLi8kLnRhZycpKEl0ZXJhdG9yUHJvdG90eXBlLCBUQUcsIHRydWUpO1xuICAgIC8vIEZGIGZpeFxuICAgIGlmKCFMSUJSQVJZICYmIGhhcyhwcm90bywgRkZfSVRFUkFUT1IpKWhpZGUoSXRlcmF0b3JQcm90b3R5cGUsIFNZTUJPTF9JVEVSQVRPUiwgcmV0dXJuVGhpcyk7XG4gIH1cbiAgLy8gRGVmaW5lIGl0ZXJhdG9yXG4gIGlmKCFMSUJSQVJZIHx8IEZPUkNFKWhpZGUocHJvdG8sIFNZTUJPTF9JVEVSQVRPUiwgX2RlZmF1bHQpO1xuICAvLyBQbHVnIGZvciBsaWJyYXJ5XG4gIEl0ZXJhdG9yc1tOQU1FXSA9IF9kZWZhdWx0O1xuICBJdGVyYXRvcnNbVEFHXSAgPSByZXR1cm5UaGlzO1xuICBpZihERUZBVUxUKXtcbiAgICBtZXRob2RzID0ge1xuICAgICAga2V5czogICAgSVNfU0VUICAgICAgICAgICAgPyBfZGVmYXVsdCA6IGNyZWF0ZU1ldGhvZChLRVlTKSxcbiAgICAgIHZhbHVlczogIERFRkFVTFQgPT0gVkFMVUVTID8gX2RlZmF1bHQgOiBjcmVhdGVNZXRob2QoVkFMVUVTKSxcbiAgICAgIGVudHJpZXM6IERFRkFVTFQgIT0gVkFMVUVTID8gX2RlZmF1bHQgOiBjcmVhdGVNZXRob2QoJ2VudHJpZXMnKVxuICAgIH07XG4gICAgaWYoRk9SQ0UpZm9yKGtleSBpbiBtZXRob2RzKXtcbiAgICAgIGlmKCEoa2V5IGluIHByb3RvKSkkcmVkZWYocHJvdG8sIGtleSwgbWV0aG9kc1trZXldKTtcbiAgICB9IGVsc2UgJGRlZigkZGVmLlAgKyAkZGVmLkYgKiBCVUdHWSwgTkFNRSwgbWV0aG9kcyk7XG4gIH1cbn07IiwidmFyIFNZTUJPTF9JVEVSQVRPUiA9IHJlcXVpcmUoJy4vJC53a3MnKSgnaXRlcmF0b3InKVxuICAsIFNBRkVfQ0xPU0lORyAgICA9IGZhbHNlO1xudHJ5IHtcbiAgdmFyIHJpdGVyID0gWzddW1NZTUJPTF9JVEVSQVRPUl0oKTtcbiAgcml0ZXJbJ3JldHVybiddID0gZnVuY3Rpb24oKXsgU0FGRV9DTE9TSU5HID0gdHJ1ZTsgfTtcbiAgQXJyYXkuZnJvbShyaXRlciwgZnVuY3Rpb24oKXsgdGhyb3cgMjsgfSk7XG59IGNhdGNoKGUpeyAvKiBlbXB0eSAqLyB9XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGV4ZWMpe1xuICBpZighU0FGRV9DTE9TSU5HKXJldHVybiBmYWxzZTtcbiAgdmFyIHNhZmUgPSBmYWxzZTtcbiAgdHJ5IHtcbiAgICB2YXIgYXJyICA9IFs3XVxuICAgICAgLCBpdGVyID0gYXJyW1NZTUJPTF9JVEVSQVRPUl0oKTtcbiAgICBpdGVyLm5leHQgPSBmdW5jdGlvbigpeyBzYWZlID0gdHJ1ZTsgfTtcbiAgICBhcnJbU1lNQk9MX0lURVJBVE9SXSA9IGZ1bmN0aW9uKCl7IHJldHVybiBpdGVyOyB9O1xuICAgIGV4ZWMoYXJyKTtcbiAgfSBjYXRjaChlKXsgLyogZW1wdHkgKi8gfVxuICByZXR1cm4gc2FmZTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkb25lLCB2YWx1ZSl7XG4gIHJldHVybiB7dmFsdWU6IHZhbHVlLCBkb25lOiAhIWRvbmV9O1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHt9OyIsInZhciAkT2JqZWN0ID0gT2JqZWN0O1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNyZWF0ZTogICAgICRPYmplY3QuY3JlYXRlLFxuICBnZXRQcm90bzogICAkT2JqZWN0LmdldFByb3RvdHlwZU9mLFxuICBpc0VudW06ICAgICB7fS5wcm9wZXJ0eUlzRW51bWVyYWJsZSxcbiAgZ2V0RGVzYzogICAgJE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IsXG4gIHNldERlc2M6ICAgICRPYmplY3QuZGVmaW5lUHJvcGVydHksXG4gIHNldERlc2NzOiAgICRPYmplY3QuZGVmaW5lUHJvcGVydGllcyxcbiAgZ2V0S2V5czogICAgJE9iamVjdC5rZXlzLFxuICBnZXROYW1lczogICAkT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMsXG4gIGdldFN5bWJvbHM6ICRPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzLFxuICBlYWNoOiAgICAgICBbXS5mb3JFYWNoXG59OyIsIm1vZHVsZS5leHBvcnRzID0gdHJ1ZTsiLCJ2YXIgZ2xvYmFsICAgID0gcmVxdWlyZSgnLi8kLmdsb2JhbCcpXHJcbiAgLCBtYWNyb3Rhc2sgPSByZXF1aXJlKCcuLyQudGFzaycpLnNldFxyXG4gICwgT2JzZXJ2ZXIgID0gZ2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgZ2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXJcclxuICAsIHByb2Nlc3MgICA9IGdsb2JhbC5wcm9jZXNzXHJcbiAgLCBpc05vZGUgICAgPSByZXF1aXJlKCcuLyQuY29mJykocHJvY2VzcykgPT0gJ3Byb2Nlc3MnXHJcbiAgLCBoZWFkLCBsYXN0LCBub3RpZnk7XHJcblxyXG52YXIgZmx1c2ggPSBmdW5jdGlvbigpe1xyXG4gIHZhciBwYXJlbnQsIGRvbWFpbjtcclxuICBpZihpc05vZGUgJiYgKHBhcmVudCA9IHByb2Nlc3MuZG9tYWluKSl7XHJcbiAgICBwcm9jZXNzLmRvbWFpbiA9IG51bGw7XHJcbiAgICBwYXJlbnQuZXhpdCgpO1xyXG4gIH1cclxuICB3aGlsZShoZWFkKXtcclxuICAgIGRvbWFpbiA9IGhlYWQuZG9tYWluO1xyXG4gICAgaWYoZG9tYWluKWRvbWFpbi5lbnRlcigpO1xyXG4gICAgaGVhZC5mbi5jYWxsKCk7IC8vIDwtIGN1cnJlbnRseSB3ZSB1c2UgaXQgb25seSBmb3IgUHJvbWlzZSAtIHRyeSAvIGNhdGNoIG5vdCByZXF1aXJlZFxyXG4gICAgaWYoZG9tYWluKWRvbWFpbi5leGl0KCk7XHJcbiAgICBoZWFkID0gaGVhZC5uZXh0O1xyXG4gIH0gbGFzdCA9IHVuZGVmaW5lZDtcclxuICBpZihwYXJlbnQpcGFyZW50LmVudGVyKCk7XHJcbn1cclxuXHJcbi8vIE5vZGUuanNcclxuaWYoaXNOb2RlKXtcclxuICBub3RpZnkgPSBmdW5jdGlvbigpe1xyXG4gICAgcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XHJcbiAgfTtcclxuLy8gYnJvd3NlcnMgd2l0aCBNdXRhdGlvbk9ic2VydmVyXHJcbn0gZWxzZSBpZihPYnNlcnZlcil7XHJcbiAgdmFyIHRvZ2dsZSA9IDFcclxuICAgICwgbm9kZSAgID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xyXG4gIG5ldyBPYnNlcnZlcihmbHVzaCkub2JzZXJ2ZShub2RlLCB7Y2hhcmFjdGVyRGF0YTogdHJ1ZX0pOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ld1xyXG4gIG5vdGlmeSA9IGZ1bmN0aW9uKCl7XHJcbiAgICBub2RlLmRhdGEgPSB0b2dnbGUgPSAtdG9nZ2xlO1xyXG4gIH07XHJcbi8vIGZvciBvdGhlciBlbnZpcm9ubWVudHMgLSBtYWNyb3Rhc2sgYmFzZWQgb246XHJcbi8vIC0gc2V0SW1tZWRpYXRlXHJcbi8vIC0gTWVzc2FnZUNoYW5uZWxcclxuLy8gLSB3aW5kb3cucG9zdE1lc3NhZ1xyXG4vLyAtIG9ucmVhZHlzdGF0ZWNoYW5nZVxyXG4vLyAtIHNldFRpbWVvdXRcclxufSBlbHNlIHtcclxuICBub3RpZnkgPSBmdW5jdGlvbigpe1xyXG4gICAgLy8gc3RyYW5nZSBJRSArIHdlYnBhY2sgZGV2IHNlcnZlciBidWcgLSB1c2UgLmNhbGwoZ2xvYmFsKVxyXG4gICAgbWFjcm90YXNrLmNhbGwoZ2xvYmFsLCBmbHVzaCk7XHJcbiAgfTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhc2FwKGZuKXtcclxuICB2YXIgdGFzayA9IHtmbjogZm4sIG5leHQ6IHVuZGVmaW5lZCwgZG9tYWluOiBpc05vZGUgJiYgcHJvY2Vzcy5kb21haW59O1xyXG4gIGlmKGxhc3QpbGFzdC5uZXh0ID0gdGFzaztcclxuICBpZighaGVhZCl7XHJcbiAgICBoZWFkID0gdGFzaztcclxuICAgIG5vdGlmeSgpO1xyXG4gIH0gbGFzdCA9IHRhc2s7XHJcbn07IiwidmFyICRyZWRlZiA9IHJlcXVpcmUoJy4vJC5yZWRlZicpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIHNyYyl7XG4gIGZvcih2YXIga2V5IGluIHNyYykkcmVkZWYodGFyZ2V0LCBrZXksIHNyY1trZXldKTtcbiAgcmV0dXJuIHRhcmdldDtcbn07IiwiLy8gbW9zdCBPYmplY3QgbWV0aG9kcyBieSBFUzYgc2hvdWxkIGFjY2VwdCBwcmltaXRpdmVzXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKEtFWSwgZXhlYyl7XG4gIHZhciAkZGVmID0gcmVxdWlyZSgnLi8kLmRlZicpXG4gICAgLCBmbiAgID0gKHJlcXVpcmUoJy4vJC5jb3JlJykuT2JqZWN0IHx8IHt9KVtLRVldIHx8IE9iamVjdFtLRVldXG4gICAgLCBleHAgID0ge307XG4gIGV4cFtLRVldID0gZXhlYyhmbik7XG4gICRkZWYoJGRlZi5TICsgJGRlZi5GICogcmVxdWlyZSgnLi8kLmZhaWxzJykoZnVuY3Rpb24oKXsgZm4oMSk7IH0pLCAnT2JqZWN0JywgZXhwKTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihiaXRtYXAsIHZhbHVlKXtcbiAgcmV0dXJuIHtcbiAgICBlbnVtZXJhYmxlICA6ICEoYml0bWFwICYgMSksXG4gICAgY29uZmlndXJhYmxlOiAhKGJpdG1hcCAmIDIpLFxuICAgIHdyaXRhYmxlICAgIDogIShiaXRtYXAgJiA0KSxcbiAgICB2YWx1ZSAgICAgICA6IHZhbHVlXG4gIH07XG59OyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi8kLmhpZGUnKTsiLCJtb2R1bGUuZXhwb3J0cyA9IE9iamVjdC5pcyB8fCBmdW5jdGlvbiBpcyh4LCB5KXtcbiAgcmV0dXJuIHggPT09IHkgPyB4ICE9PSAwIHx8IDEgLyB4ID09PSAxIC8geSA6IHggIT0geCAmJiB5ICE9IHk7XG59OyIsIi8vIFdvcmtzIHdpdGggX19wcm90b19fIG9ubHkuIE9sZCB2OCBjYW4ndCB3b3JrIHdpdGggbnVsbCBwcm90byBvYmplY3RzLlxuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cbnZhciBnZXREZXNjICA9IHJlcXVpcmUoJy4vJCcpLmdldERlc2NcbiAgLCBpc09iamVjdCA9IHJlcXVpcmUoJy4vJC5pcy1vYmplY3QnKVxuICAsIGFuT2JqZWN0ID0gcmVxdWlyZSgnLi8kLmFuLW9iamVjdCcpO1xudmFyIGNoZWNrID0gZnVuY3Rpb24oTywgcHJvdG8pe1xuICBhbk9iamVjdChPKTtcbiAgaWYoIWlzT2JqZWN0KHByb3RvKSAmJiBwcm90byAhPT0gbnVsbCl0aHJvdyBUeXBlRXJyb3IocHJvdG8gKyBcIjogY2FuJ3Qgc2V0IGFzIHByb3RvdHlwZSFcIik7XG59O1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHNldDogT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8ICgnX19wcm90b19fJyBpbiB7fSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgPyBmdW5jdGlvbihidWdneSwgc2V0KXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBzZXQgPSByZXF1aXJlKCcuLyQuY3R4JykoRnVuY3Rpb24uY2FsbCwgZ2V0RGVzYyhPYmplY3QucHJvdG90eXBlLCAnX19wcm90b19fJykuc2V0LCAyKTtcbiAgICAgICAgICBzZXQoe30sIFtdKTtcbiAgICAgICAgfSBjYXRjaChlKXsgYnVnZ3kgPSB0cnVlOyB9XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBzZXRQcm90b3R5cGVPZihPLCBwcm90byl7XG4gICAgICAgICAgY2hlY2soTywgcHJvdG8pO1xuICAgICAgICAgIGlmKGJ1Z2d5KU8uX19wcm90b19fID0gcHJvdG87XG4gICAgICAgICAgZWxzZSBzZXQoTywgcHJvdG8pO1xuICAgICAgICAgIHJldHVybiBPO1xuICAgICAgICB9O1xuICAgICAgfSgpXG4gICAgOiB1bmRlZmluZWQpLFxuICBjaGVjazogY2hlY2tcbn07IiwidmFyIGdsb2JhbCA9IHJlcXVpcmUoJy4vJC5nbG9iYWwnKVxuICAsIFNIQVJFRCA9ICdfX2NvcmUtanNfc2hhcmVkX18nXG4gICwgc3RvcmUgID0gZ2xvYmFsW1NIQVJFRF0gfHwgKGdsb2JhbFtTSEFSRURdID0ge30pO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihrZXkpe1xuICByZXR1cm4gc3RvcmVba2V5XSB8fCAoc3RvcmVba2V5XSA9IHt9KTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xudmFyICQgICAgICAgPSByZXF1aXJlKCcuLyQnKVxuICAsIFNQRUNJRVMgPSByZXF1aXJlKCcuLyQud2tzJykoJ3NwZWNpZXMnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oQyl7XG4gIGlmKHJlcXVpcmUoJy4vJC5zdXBwb3J0LWRlc2MnKSAmJiAhKFNQRUNJRVMgaW4gQykpJC5zZXREZXNjKEMsIFNQRUNJRVMsIHtcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0OiBmdW5jdGlvbigpeyByZXR1cm4gdGhpczsgfVxuICB9KTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihpdCwgQ29uc3RydWN0b3IsIG5hbWUpe1xuICBpZighKGl0IGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKXRocm93IFR5cGVFcnJvcihuYW1lICsgXCI6IHVzZSB0aGUgJ25ldycgb3BlcmF0b3IhXCIpO1xuICByZXR1cm4gaXQ7XG59OyIsIi8vIHRydWUgIC0+IFN0cmluZyNhdFxuLy8gZmFsc2UgLT4gU3RyaW5nI2NvZGVQb2ludEF0XG52YXIgdG9JbnRlZ2VyID0gcmVxdWlyZSgnLi8kLnRvLWludGVnZXInKVxuICAsIGRlZmluZWQgICA9IHJlcXVpcmUoJy4vJC5kZWZpbmVkJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKFRPX1NUUklORyl7XG4gIHJldHVybiBmdW5jdGlvbih0aGF0LCBwb3Mpe1xuICAgIHZhciBzID0gU3RyaW5nKGRlZmluZWQodGhhdCkpXG4gICAgICAsIGkgPSB0b0ludGVnZXIocG9zKVxuICAgICAgLCBsID0gcy5sZW5ndGhcbiAgICAgICwgYSwgYjtcbiAgICBpZihpIDwgMCB8fCBpID49IGwpcmV0dXJuIFRPX1NUUklORyA/ICcnIDogdW5kZWZpbmVkO1xuICAgIGEgPSBzLmNoYXJDb2RlQXQoaSk7XG4gICAgcmV0dXJuIGEgPCAweGQ4MDAgfHwgYSA+IDB4ZGJmZiB8fCBpICsgMSA9PT0gbFxuICAgICAgfHwgKGIgPSBzLmNoYXJDb2RlQXQoaSArIDEpKSA8IDB4ZGMwMCB8fCBiID4gMHhkZmZmXG4gICAgICAgID8gVE9fU1RSSU5HID8gcy5jaGFyQXQoaSkgOiBhXG4gICAgICAgIDogVE9fU1RSSU5HID8gcy5zbGljZShpLCBpICsgMikgOiAoYSAtIDB4ZDgwMCA8PCAxMCkgKyAoYiAtIDB4ZGMwMCkgKyAweDEwMDAwO1xuICB9O1xufTsiLCIvLyBUaGFuaydzIElFOCBmb3IgaGlzIGZ1bm55IGRlZmluZVByb3BlcnR5XG5tb2R1bGUuZXhwb3J0cyA9ICFyZXF1aXJlKCcuLyQuZmFpbHMnKShmdW5jdGlvbigpe1xuICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHt9LCAnYScsIHtnZXQ6IGZ1bmN0aW9uKCl7IHJldHVybiA3OyB9fSkuYSAhPSA3O1xufSk7IiwidmFyIGhhcyAgPSByZXF1aXJlKCcuLyQuaGFzJylcbiAgLCBoaWRlID0gcmVxdWlyZSgnLi8kLmhpZGUnKVxuICAsIFRBRyAgPSByZXF1aXJlKCcuLyQud2tzJykoJ3RvU3RyaW5nVGFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXQsIHRhZywgc3RhdCl7XG4gIGlmKGl0ICYmICFoYXMoaXQgPSBzdGF0ID8gaXQgOiBpdC5wcm90b3R5cGUsIFRBRykpaGlkZShpdCwgVEFHLCB0YWcpO1xufTsiLCIndXNlIHN0cmljdCc7XG52YXIgY3R4ICAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi8kLmN0eCcpXG4gICwgaW52b2tlICAgICAgICAgICAgID0gcmVxdWlyZSgnLi8kLmludm9rZScpXG4gICwgaHRtbCAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi8kLmh0bWwnKVxuICAsIGNlbCAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vJC5kb20tY3JlYXRlJylcbiAgLCBnbG9iYWwgICAgICAgICAgICAgPSByZXF1aXJlKCcuLyQuZ2xvYmFsJylcbiAgLCBwcm9jZXNzICAgICAgICAgICAgPSBnbG9iYWwucHJvY2Vzc1xuICAsIHNldFRhc2sgICAgICAgICAgICA9IGdsb2JhbC5zZXRJbW1lZGlhdGVcbiAgLCBjbGVhclRhc2sgICAgICAgICAgPSBnbG9iYWwuY2xlYXJJbW1lZGlhdGVcbiAgLCBNZXNzYWdlQ2hhbm5lbCAgICAgPSBnbG9iYWwuTWVzc2FnZUNoYW5uZWxcbiAgLCBjb3VudGVyICAgICAgICAgICAgPSAwXG4gICwgcXVldWUgICAgICAgICAgICAgID0ge31cbiAgLCBPTlJFQURZU1RBVEVDSEFOR0UgPSAnb25yZWFkeXN0YXRlY2hhbmdlJ1xuICAsIGRlZmVyLCBjaGFubmVsLCBwb3J0O1xudmFyIHJ1biA9IGZ1bmN0aW9uKCl7XG4gIHZhciBpZCA9ICt0aGlzO1xuICBpZihxdWV1ZS5oYXNPd25Qcm9wZXJ0eShpZCkpe1xuICAgIHZhciBmbiA9IHF1ZXVlW2lkXTtcbiAgICBkZWxldGUgcXVldWVbaWRdO1xuICAgIGZuKCk7XG4gIH1cbn07XG52YXIgbGlzdG5lciA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgcnVuLmNhbGwoZXZlbnQuZGF0YSk7XG59O1xuLy8gTm9kZS5qcyAwLjkrICYgSUUxMCsgaGFzIHNldEltbWVkaWF0ZSwgb3RoZXJ3aXNlOlxuaWYoIXNldFRhc2sgfHwgIWNsZWFyVGFzayl7XG4gIHNldFRhc2sgPSBmdW5jdGlvbiBzZXRJbW1lZGlhdGUoZm4pe1xuICAgIHZhciBhcmdzID0gW10sIGkgPSAxO1xuICAgIHdoaWxlKGFyZ3VtZW50cy5sZW5ndGggPiBpKWFyZ3MucHVzaChhcmd1bWVudHNbaSsrXSk7XG4gICAgcXVldWVbKytjb3VudGVyXSA9IGZ1bmN0aW9uKCl7XG4gICAgICBpbnZva2UodHlwZW9mIGZuID09ICdmdW5jdGlvbicgPyBmbiA6IEZ1bmN0aW9uKGZuKSwgYXJncyk7XG4gICAgfTtcbiAgICBkZWZlcihjb3VudGVyKTtcbiAgICByZXR1cm4gY291bnRlcjtcbiAgfTtcbiAgY2xlYXJUYXNrID0gZnVuY3Rpb24gY2xlYXJJbW1lZGlhdGUoaWQpe1xuICAgIGRlbGV0ZSBxdWV1ZVtpZF07XG4gIH07XG4gIC8vIE5vZGUuanMgMC44LVxuICBpZihyZXF1aXJlKCcuLyQuY29mJykocHJvY2VzcykgPT0gJ3Byb2Nlc3MnKXtcbiAgICBkZWZlciA9IGZ1bmN0aW9uKGlkKXtcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soY3R4KHJ1biwgaWQsIDEpKTtcbiAgICB9O1xuICAvLyBCcm93c2VycyB3aXRoIE1lc3NhZ2VDaGFubmVsLCBpbmNsdWRlcyBXZWJXb3JrZXJzXG4gIH0gZWxzZSBpZihNZXNzYWdlQ2hhbm5lbCl7XG4gICAgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbDtcbiAgICBwb3J0ICAgID0gY2hhbm5lbC5wb3J0MjtcbiAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGxpc3RuZXI7XG4gICAgZGVmZXIgPSBjdHgocG9ydC5wb3N0TWVzc2FnZSwgcG9ydCwgMSk7XG4gIC8vIEJyb3dzZXJzIHdpdGggcG9zdE1lc3NhZ2UsIHNraXAgV2ViV29ya2Vyc1xuICAvLyBJRTggaGFzIHBvc3RNZXNzYWdlLCBidXQgaXQncyBzeW5jICYgdHlwZW9mIGl0cyBwb3N0TWVzc2FnZSBpcyAnb2JqZWN0J1xuICB9IGVsc2UgaWYoZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIgJiYgdHlwZW9mIHBvc3RNZXNzYWdlID09ICdmdW5jdGlvbicgJiYgIWdsb2JhbC5pbXBvcnRTY3JpcHQpe1xuICAgIGRlZmVyID0gZnVuY3Rpb24oaWQpe1xuICAgICAgZ2xvYmFsLnBvc3RNZXNzYWdlKGlkICsgJycsICcqJyk7XG4gICAgfTtcbiAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGxpc3RuZXIsIGZhbHNlKTtcbiAgLy8gSUU4LVxuICB9IGVsc2UgaWYoT05SRUFEWVNUQVRFQ0hBTkdFIGluIGNlbCgnc2NyaXB0Jykpe1xuICAgIGRlZmVyID0gZnVuY3Rpb24oaWQpe1xuICAgICAgaHRtbC5hcHBlbmRDaGlsZChjZWwoJ3NjcmlwdCcpKVtPTlJFQURZU1RBVEVDSEFOR0VdID0gZnVuY3Rpb24oKXtcbiAgICAgICAgaHRtbC5yZW1vdmVDaGlsZCh0aGlzKTtcbiAgICAgICAgcnVuLmNhbGwoaWQpO1xuICAgICAgfTtcbiAgICB9O1xuICAvLyBSZXN0IG9sZCBicm93c2Vyc1xuICB9IGVsc2Uge1xuICAgIGRlZmVyID0gZnVuY3Rpb24oaWQpe1xuICAgICAgc2V0VGltZW91dChjdHgocnVuLCBpZCwgMSksIDApO1xuICAgIH07XG4gIH1cbn1cbm1vZHVsZS5leHBvcnRzID0ge1xuICBzZXQ6ICAgc2V0VGFzayxcbiAgY2xlYXI6IGNsZWFyVGFza1xufTsiLCIvLyA3LjEuNCBUb0ludGVnZXJcbnZhciBjZWlsICA9IE1hdGguY2VpbFxuICAsIGZsb29yID0gTWF0aC5mbG9vcjtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXQpe1xuICByZXR1cm4gaXNOYU4oaXQgPSAraXQpID8gMCA6IChpdCA+IDAgPyBmbG9vciA6IGNlaWwpKGl0KTtcbn07IiwiLy8gdG8gaW5kZXhlZCBvYmplY3QsIHRvT2JqZWN0IHdpdGggZmFsbGJhY2sgZm9yIG5vbi1hcnJheS1saWtlIEVTMyBzdHJpbmdzXHJcbnZhciBJT2JqZWN0ID0gcmVxdWlyZSgnLi8kLmlvYmplY3QnKVxyXG4gICwgZGVmaW5lZCA9IHJlcXVpcmUoJy4vJC5kZWZpbmVkJyk7XHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaXQpe1xyXG4gIHJldHVybiBJT2JqZWN0KGRlZmluZWQoaXQpKTtcclxufTsiLCIvLyA3LjEuMTUgVG9MZW5ndGhcbnZhciB0b0ludGVnZXIgPSByZXF1aXJlKCcuLyQudG8taW50ZWdlcicpXG4gICwgbWluICAgICAgID0gTWF0aC5taW47XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGl0KXtcbiAgcmV0dXJuIGl0ID4gMCA/IG1pbih0b0ludGVnZXIoaXQpLCAweDFmZmZmZmZmZmZmZmZmKSA6IDA7IC8vIHBvdygyLCA1MykgLSAxID09IDkwMDcxOTkyNTQ3NDA5OTFcbn07IiwidmFyIGlkID0gMFxuICAsIHB4ID0gTWF0aC5yYW5kb20oKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oa2V5KXtcbiAgcmV0dXJuICdTeW1ib2woJy5jb25jYXQoa2V5ID09PSB1bmRlZmluZWQgPyAnJyA6IGtleSwgJylfJywgKCsraWQgKyBweCkudG9TdHJpbmcoMzYpKTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpeyAvKiBlbXB0eSAqLyB9OyIsInZhciBzdG9yZSAgPSByZXF1aXJlKCcuLyQuc2hhcmVkJykoJ3drcycpXG4gICwgU3ltYm9sID0gcmVxdWlyZSgnLi8kLmdsb2JhbCcpLlN5bWJvbDtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obmFtZSl7XG4gIHJldHVybiBzdG9yZVtuYW1lXSB8fCAoc3RvcmVbbmFtZV0gPVxuICAgIFN5bWJvbCAmJiBTeW1ib2xbbmFtZV0gfHwgKFN5bWJvbCB8fCByZXF1aXJlKCcuLyQudWlkJykpKCdTeW1ib2wuJyArIG5hbWUpKTtcbn07IiwidmFyIGNsYXNzb2YgICA9IHJlcXVpcmUoJy4vJC5jbGFzc29mJylcbiAgLCBJVEVSQVRPUiAgPSByZXF1aXJlKCcuLyQud2tzJykoJ2l0ZXJhdG9yJylcbiAgLCBJdGVyYXRvcnMgPSByZXF1aXJlKCcuLyQuaXRlcmF0b3JzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vJC5jb3JlJykuZ2V0SXRlcmF0b3JNZXRob2QgPSBmdW5jdGlvbihpdCl7XG4gIGlmKGl0ICE9IHVuZGVmaW5lZClyZXR1cm4gaXRbSVRFUkFUT1JdIHx8IGl0WydAQGl0ZXJhdG9yJ10gfHwgSXRlcmF0b3JzW2NsYXNzb2YoaXQpXTtcbn07IiwidmFyIGFuT2JqZWN0ID0gcmVxdWlyZSgnLi8kLmFuLW9iamVjdCcpXG4gICwgZ2V0ICAgICAgPSByZXF1aXJlKCcuL2NvcmUuZ2V0LWl0ZXJhdG9yLW1ldGhvZCcpO1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLyQuY29yZScpLmdldEl0ZXJhdG9yID0gZnVuY3Rpb24oaXQpe1xuICB2YXIgaXRlckZuID0gZ2V0KGl0KTtcbiAgaWYodHlwZW9mIGl0ZXJGbiAhPSAnZnVuY3Rpb24nKXRocm93IFR5cGVFcnJvcihpdCArICcgaXMgbm90IGl0ZXJhYmxlIScpO1xuICByZXR1cm4gYW5PYmplY3QoaXRlckZuLmNhbGwoaXQpKTtcbn07IiwidmFyIGNsYXNzb2YgICA9IHJlcXVpcmUoJy4vJC5jbGFzc29mJylcbiAgLCBJVEVSQVRPUiAgPSByZXF1aXJlKCcuLyQud2tzJykoJ2l0ZXJhdG9yJylcbiAgLCBJdGVyYXRvcnMgPSByZXF1aXJlKCcuLyQuaXRlcmF0b3JzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vJC5jb3JlJykuaXNJdGVyYWJsZSA9IGZ1bmN0aW9uKGl0KXtcbiAgdmFyIE8gPSBPYmplY3QoaXQpO1xuICByZXR1cm4gSVRFUkFUT1IgaW4gTyB8fCAnQEBpdGVyYXRvcicgaW4gTyB8fCBJdGVyYXRvcnMuaGFzT3duUHJvcGVydHkoY2xhc3NvZihPKSk7XG59OyIsIid1c2Ugc3RyaWN0JztcbnZhciBzZXRVbnNjb3BlID0gcmVxdWlyZSgnLi8kLnVuc2NvcGUnKVxuICAsIHN0ZXAgICAgICAgPSByZXF1aXJlKCcuLyQuaXRlci1zdGVwJylcbiAgLCBJdGVyYXRvcnMgID0gcmVxdWlyZSgnLi8kLml0ZXJhdG9ycycpXG4gICwgdG9JT2JqZWN0ICA9IHJlcXVpcmUoJy4vJC50by1pb2JqZWN0Jyk7XG5cbi8vIDIyLjEuMy40IEFycmF5LnByb3RvdHlwZS5lbnRyaWVzKClcbi8vIDIyLjEuMy4xMyBBcnJheS5wcm90b3R5cGUua2V5cygpXG4vLyAyMi4xLjMuMjkgQXJyYXkucHJvdG90eXBlLnZhbHVlcygpXG4vLyAyMi4xLjMuMzAgQXJyYXkucHJvdG90eXBlW0BAaXRlcmF0b3JdKClcbnJlcXVpcmUoJy4vJC5pdGVyLWRlZmluZScpKEFycmF5LCAnQXJyYXknLCBmdW5jdGlvbihpdGVyYXRlZCwga2luZCl7XG4gIHRoaXMuX3QgPSB0b0lPYmplY3QoaXRlcmF0ZWQpOyAvLyB0YXJnZXRcbiAgdGhpcy5faSA9IDA7ICAgICAgICAgICAgICAgICAgIC8vIG5leHQgaW5kZXhcbiAgdGhpcy5fayA9IGtpbmQ7ICAgICAgICAgICAgICAgIC8vIGtpbmRcbi8vIDIyLjEuNS4yLjEgJUFycmF5SXRlcmF0b3JQcm90b3R5cGUlLm5leHQoKVxufSwgZnVuY3Rpb24oKXtcbiAgdmFyIE8gICAgID0gdGhpcy5fdFxuICAgICwga2luZCAgPSB0aGlzLl9rXG4gICAgLCBpbmRleCA9IHRoaXMuX2krKztcbiAgaWYoIU8gfHwgaW5kZXggPj0gTy5sZW5ndGgpe1xuICAgIHRoaXMuX3QgPSB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHN0ZXAoMSk7XG4gIH1cbiAgaWYoa2luZCA9PSAna2V5cycgIClyZXR1cm4gc3RlcCgwLCBpbmRleCk7XG4gIGlmKGtpbmQgPT0gJ3ZhbHVlcycpcmV0dXJuIHN0ZXAoMCwgT1tpbmRleF0pO1xuICByZXR1cm4gc3RlcCgwLCBbaW5kZXgsIE9baW5kZXhdXSk7XG59LCAndmFsdWVzJyk7XG5cbi8vIGFyZ3VtZW50c0xpc3RbQEBpdGVyYXRvcl0gaXMgJUFycmF5UHJvdG9fdmFsdWVzJSAoOS40LjQuNiwgOS40LjQuNylcbkl0ZXJhdG9ycy5Bcmd1bWVudHMgPSBJdGVyYXRvcnMuQXJyYXk7XG5cbnNldFVuc2NvcGUoJ2tleXMnKTtcbnNldFVuc2NvcGUoJ3ZhbHVlcycpO1xuc2V0VW5zY29wZSgnZW50cmllcycpOyIsIi8vIDE5LjEuMi42IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoTywgUClcbnZhciB0b0lPYmplY3QgPSByZXF1aXJlKCcuLyQudG8taW9iamVjdCcpO1xuXG5yZXF1aXJlKCcuLyQub2JqZWN0LXNhcCcpKCdnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3InLCBmdW5jdGlvbigkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKXtcbiAgcmV0dXJuIGZ1bmN0aW9uIGdldE93blByb3BlcnR5RGVzY3JpcHRvcihpdCwga2V5KXtcbiAgICByZXR1cm4gJGdldE93blByb3BlcnR5RGVzY3JpcHRvcih0b0lPYmplY3QoaXQpLCBrZXkpO1xuICB9O1xufSk7IiwiLy8gMTkuMS4zLjE5IE9iamVjdC5zZXRQcm90b3R5cGVPZihPLCBwcm90bylcbnZhciAkZGVmID0gcmVxdWlyZSgnLi8kLmRlZicpO1xuJGRlZigkZGVmLlMsICdPYmplY3QnLCB7c2V0UHJvdG90eXBlT2Y6IHJlcXVpcmUoJy4vJC5zZXQtcHJvdG8nKS5zZXR9KTsiLG51bGwsIid1c2Ugc3RyaWN0JztcbnZhciAkICAgICAgICAgID0gcmVxdWlyZSgnLi8kJylcbiAgLCBMSUJSQVJZICAgID0gcmVxdWlyZSgnLi8kLmxpYnJhcnknKVxuICAsIGdsb2JhbCAgICAgPSByZXF1aXJlKCcuLyQuZ2xvYmFsJylcbiAgLCBjdHggICAgICAgID0gcmVxdWlyZSgnLi8kLmN0eCcpXG4gICwgY2xhc3NvZiAgICA9IHJlcXVpcmUoJy4vJC5jbGFzc29mJylcbiAgLCAkZGVmICAgICAgID0gcmVxdWlyZSgnLi8kLmRlZicpXG4gICwgaXNPYmplY3QgICA9IHJlcXVpcmUoJy4vJC5pcy1vYmplY3QnKVxuICAsIGFuT2JqZWN0ICAgPSByZXF1aXJlKCcuLyQuYW4tb2JqZWN0JylcbiAgLCBhRnVuY3Rpb24gID0gcmVxdWlyZSgnLi8kLmEtZnVuY3Rpb24nKVxuICAsIHN0cmljdE5ldyAgPSByZXF1aXJlKCcuLyQuc3RyaWN0LW5ldycpXG4gICwgZm9yT2YgICAgICA9IHJlcXVpcmUoJy4vJC5mb3Itb2YnKVxuICAsIHNldFByb3RvICAgPSByZXF1aXJlKCcuLyQuc2V0LXByb3RvJykuc2V0XG4gICwgc2FtZSAgICAgICA9IHJlcXVpcmUoJy4vJC5zYW1lJylcbiAgLCBzcGVjaWVzICAgID0gcmVxdWlyZSgnLi8kLnNwZWNpZXMnKVxuICAsIFNQRUNJRVMgICAgPSByZXF1aXJlKCcuLyQud2tzJykoJ3NwZWNpZXMnKVxuICAsIFJFQ09SRCAgICAgPSByZXF1aXJlKCcuLyQudWlkJykoJ3JlY29yZCcpXG4gICwgYXNhcCAgICAgICA9IHJlcXVpcmUoJy4vJC5taWNyb3Rhc2snKVxuICAsIFBST01JU0UgICAgPSAnUHJvbWlzZSdcbiAgLCBwcm9jZXNzICAgID0gZ2xvYmFsLnByb2Nlc3NcbiAgLCBpc05vZGUgICAgID0gY2xhc3NvZihwcm9jZXNzKSA9PSAncHJvY2VzcydcbiAgLCBQICAgICAgICAgID0gZ2xvYmFsW1BST01JU0VdXG4gICwgV3JhcHBlcjtcblxudmFyIHRlc3RSZXNvbHZlID0gZnVuY3Rpb24oc3ViKXtcbiAgdmFyIHRlc3QgPSBuZXcgUChmdW5jdGlvbigpe30pO1xuICBpZihzdWIpdGVzdC5jb25zdHJ1Y3RvciA9IE9iamVjdDtcbiAgcmV0dXJuIFAucmVzb2x2ZSh0ZXN0KSA9PT0gdGVzdDtcbn07XG5cbnZhciB1c2VOYXRpdmUgPSBmdW5jdGlvbigpe1xuICB2YXIgd29ya3MgPSBmYWxzZTtcbiAgZnVuY3Rpb24gUDIoeCl7XG4gICAgdmFyIHNlbGYgPSBuZXcgUCh4KTtcbiAgICBzZXRQcm90byhzZWxmLCBQMi5wcm90b3R5cGUpO1xuICAgIHJldHVybiBzZWxmO1xuICB9XG4gIHRyeSB7XG4gICAgd29ya3MgPSBQICYmIFAucmVzb2x2ZSAmJiB0ZXN0UmVzb2x2ZSgpO1xuICAgIHNldFByb3RvKFAyLCBQKTtcbiAgICBQMi5wcm90b3R5cGUgPSAkLmNyZWF0ZShQLnByb3RvdHlwZSwge2NvbnN0cnVjdG9yOiB7dmFsdWU6IFAyfX0pO1xuICAgIC8vIGFjdHVhbCBGaXJlZm94IGhhcyBicm9rZW4gc3ViY2xhc3Mgc3VwcG9ydCwgdGVzdCB0aGF0XG4gICAgaWYoIShQMi5yZXNvbHZlKDUpLnRoZW4oZnVuY3Rpb24oKXt9KSBpbnN0YW5jZW9mIFAyKSl7XG4gICAgICB3b3JrcyA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBhY3R1YWwgVjggYnVnLCBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9NDE2MlxuICAgIGlmKHdvcmtzICYmIHJlcXVpcmUoJy4vJC5zdXBwb3J0LWRlc2MnKSl7XG4gICAgICB2YXIgdGhlbmFibGVUaGVuR290dGVuID0gZmFsc2U7XG4gICAgICBQLnJlc29sdmUoJC5zZXREZXNjKHt9LCAndGhlbicsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpeyB0aGVuYWJsZVRoZW5Hb3R0ZW4gPSB0cnVlOyB9XG4gICAgICB9KSk7XG4gICAgICB3b3JrcyA9IHRoZW5hYmxlVGhlbkdvdHRlbjtcbiAgICB9XG4gIH0gY2F0Y2goZSl7IHdvcmtzID0gZmFsc2U7IH1cbiAgcmV0dXJuIHdvcmtzO1xufSgpO1xuXG4vLyBoZWxwZXJzXG52YXIgaXNQcm9taXNlID0gZnVuY3Rpb24oaXQpe1xuICByZXR1cm4gaXNPYmplY3QoaXQpICYmICh1c2VOYXRpdmUgPyBjbGFzc29mKGl0KSA9PSAnUHJvbWlzZScgOiBSRUNPUkQgaW4gaXQpO1xufTtcbnZhciBzYW1lQ29uc3RydWN0b3IgPSBmdW5jdGlvbihhLCBiKXtcbiAgLy8gbGlicmFyeSB3cmFwcGVyIHNwZWNpYWwgY2FzZVxuICBpZihMSUJSQVJZICYmIGEgPT09IFAgJiYgYiA9PT0gV3JhcHBlcilyZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIHNhbWUoYSwgYik7XG59O1xudmFyIGdldENvbnN0cnVjdG9yID0gZnVuY3Rpb24oQyl7XG4gIHZhciBTID0gYW5PYmplY3QoQylbU1BFQ0lFU107XG4gIHJldHVybiBTICE9IHVuZGVmaW5lZCA/IFMgOiBDO1xufTtcbnZhciBpc1RoZW5hYmxlID0gZnVuY3Rpb24oaXQpe1xuICB2YXIgdGhlbjtcbiAgcmV0dXJuIGlzT2JqZWN0KGl0KSAmJiB0eXBlb2YgKHRoZW4gPSBpdC50aGVuKSA9PSAnZnVuY3Rpb24nID8gdGhlbiA6IGZhbHNlO1xufTtcbnZhciBub3RpZnkgPSBmdW5jdGlvbihyZWNvcmQsIGlzUmVqZWN0KXtcbiAgaWYocmVjb3JkLm4pcmV0dXJuO1xuICByZWNvcmQubiA9IHRydWU7XG4gIHZhciBjaGFpbiA9IHJlY29yZC5jO1xuICBhc2FwKGZ1bmN0aW9uKCl7XG4gICAgdmFyIHZhbHVlID0gcmVjb3JkLnZcbiAgICAgICwgb2sgICAgPSByZWNvcmQucyA9PSAxXG4gICAgICAsIGkgICAgID0gMDtcbiAgICB2YXIgcnVuID0gZnVuY3Rpb24ocmVhY3Qpe1xuICAgICAgdmFyIGNiID0gb2sgPyByZWFjdC5vayA6IHJlYWN0LmZhaWxcbiAgICAgICAgLCByZXQsIHRoZW47XG4gICAgICB0cnkge1xuICAgICAgICBpZihjYil7XG4gICAgICAgICAgaWYoIW9rKXJlY29yZC5oID0gdHJ1ZTtcbiAgICAgICAgICByZXQgPSBjYiA9PT0gdHJ1ZSA/IHZhbHVlIDogY2IodmFsdWUpO1xuICAgICAgICAgIGlmKHJldCA9PT0gcmVhY3QuUCl7XG4gICAgICAgICAgICByZWFjdC5yZWooVHlwZUVycm9yKCdQcm9taXNlLWNoYWluIGN5Y2xlJykpO1xuICAgICAgICAgIH0gZWxzZSBpZih0aGVuID0gaXNUaGVuYWJsZShyZXQpKXtcbiAgICAgICAgICAgIHRoZW4uY2FsbChyZXQsIHJlYWN0LnJlcywgcmVhY3QucmVqKTtcbiAgICAgICAgICB9IGVsc2UgcmVhY3QucmVzKHJldCk7XG4gICAgICAgIH0gZWxzZSByZWFjdC5yZWoodmFsdWUpO1xuICAgICAgfSBjYXRjaChlcnIpe1xuICAgICAgICByZWFjdC5yZWooZXJyKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHdoaWxlKGNoYWluLmxlbmd0aCA+IGkpcnVuKGNoYWluW2krK10pOyAvLyB2YXJpYWJsZSBsZW5ndGggLSBjYW4ndCB1c2UgZm9yRWFjaFxuICAgIGNoYWluLmxlbmd0aCA9IDA7XG4gICAgcmVjb3JkLm4gPSBmYWxzZTtcbiAgICBpZihpc1JlamVjdClzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICBpZihpc1VuaGFuZGxlZChyZWNvcmQucCkpe1xuICAgICAgICBpZihpc05vZGUpe1xuICAgICAgICAgIHByb2Nlc3MuZW1pdCgndW5oYW5kbGVkUmVqZWN0aW9uJywgdmFsdWUsIHJlY29yZC5wKTtcbiAgICAgICAgfSBlbHNlIGlmKGdsb2JhbC5jb25zb2xlICYmIGNvbnNvbGUuZXJyb3Ipe1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1VuaGFuZGxlZCBwcm9taXNlIHJlamVjdGlvbicsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfSByZWNvcmQuYSA9IHVuZGVmaW5lZDtcbiAgICB9LCAxKTtcbiAgfSk7XG59O1xudmFyIGlzVW5oYW5kbGVkID0gZnVuY3Rpb24ocHJvbWlzZSl7XG4gIHZhciByZWNvcmQgPSBwcm9taXNlW1JFQ09SRF1cbiAgICAsIGNoYWluICA9IHJlY29yZC5hIHx8IHJlY29yZC5jXG4gICAgLCBpICAgICAgPSAwXG4gICAgLCByZWFjdDtcbiAgaWYocmVjb3JkLmgpcmV0dXJuIGZhbHNlO1xuICB3aGlsZShjaGFpbi5sZW5ndGggPiBpKXtcbiAgICByZWFjdCA9IGNoYWluW2krK107XG4gICAgaWYocmVhY3QuZmFpbCB8fCAhaXNVbmhhbmRsZWQocmVhY3QuUCkpcmV0dXJuIGZhbHNlO1xuICB9IHJldHVybiB0cnVlO1xufTtcbnZhciAkcmVqZWN0ID0gZnVuY3Rpb24odmFsdWUpe1xuICB2YXIgcmVjb3JkID0gdGhpcztcbiAgaWYocmVjb3JkLmQpcmV0dXJuO1xuICByZWNvcmQuZCA9IHRydWU7XG4gIHJlY29yZCA9IHJlY29yZC5yIHx8IHJlY29yZDsgLy8gdW53cmFwXG4gIHJlY29yZC52ID0gdmFsdWU7XG4gIHJlY29yZC5zID0gMjtcbiAgcmVjb3JkLmEgPSByZWNvcmQuYy5zbGljZSgpO1xuICBub3RpZnkocmVjb3JkLCB0cnVlKTtcbn07XG52YXIgJHJlc29sdmUgPSBmdW5jdGlvbih2YWx1ZSl7XG4gIHZhciByZWNvcmQgPSB0aGlzXG4gICAgLCB0aGVuO1xuICBpZihyZWNvcmQuZClyZXR1cm47XG4gIHJlY29yZC5kID0gdHJ1ZTtcbiAgcmVjb3JkID0gcmVjb3JkLnIgfHwgcmVjb3JkOyAvLyB1bndyYXBcbiAgdHJ5IHtcbiAgICBpZih0aGVuID0gaXNUaGVuYWJsZSh2YWx1ZSkpe1xuICAgICAgYXNhcChmdW5jdGlvbigpe1xuICAgICAgICB2YXIgd3JhcHBlciA9IHtyOiByZWNvcmQsIGQ6IGZhbHNlfTsgLy8gd3JhcFxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoZW4uY2FsbCh2YWx1ZSwgY3R4KCRyZXNvbHZlLCB3cmFwcGVyLCAxKSwgY3R4KCRyZWplY3QsIHdyYXBwZXIsIDEpKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAkcmVqZWN0LmNhbGwod3JhcHBlciwgZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWNvcmQudiA9IHZhbHVlO1xuICAgICAgcmVjb3JkLnMgPSAxO1xuICAgICAgbm90aWZ5KHJlY29yZCwgZmFsc2UpO1xuICAgIH1cbiAgfSBjYXRjaChlKXtcbiAgICAkcmVqZWN0LmNhbGwoe3I6IHJlY29yZCwgZDogZmFsc2V9LCBlKTsgLy8gd3JhcFxuICB9XG59O1xuXG4vLyBjb25zdHJ1Y3RvciBwb2x5ZmlsbFxuaWYoIXVzZU5hdGl2ZSl7XG4gIC8vIDI1LjQuMy4xIFByb21pc2UoZXhlY3V0b3IpXG4gIFAgPSBmdW5jdGlvbiBQcm9taXNlKGV4ZWN1dG9yKXtcbiAgICBhRnVuY3Rpb24oZXhlY3V0b3IpO1xuICAgIHZhciByZWNvcmQgPSB7XG4gICAgICBwOiBzdHJpY3ROZXcodGhpcywgUCwgUFJPTUlTRSksICAgICAgICAgLy8gPC0gcHJvbWlzZVxuICAgICAgYzogW10sICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDwtIGF3YWl0aW5nIHJlYWN0aW9uc1xuICAgICAgYTogdW5kZWZpbmVkLCAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDwtIGNoZWNrZWQgaW4gaXNVbmhhbmRsZWQgcmVhY3Rpb25zXG4gICAgICBzOiAwLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gPC0gc3RhdGVcbiAgICAgIGQ6IGZhbHNlLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA8LSBkb25lXG4gICAgICB2OiB1bmRlZmluZWQsICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gPC0gdmFsdWVcbiAgICAgIGg6IGZhbHNlLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyA8LSBoYW5kbGVkIHJlamVjdGlvblxuICAgICAgbjogZmFsc2UgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDwtIG5vdGlmeVxuICAgIH07XG4gICAgdGhpc1tSRUNPUkRdID0gcmVjb3JkO1xuICAgIHRyeSB7XG4gICAgICBleGVjdXRvcihjdHgoJHJlc29sdmUsIHJlY29yZCwgMSksIGN0eCgkcmVqZWN0LCByZWNvcmQsIDEpKTtcbiAgICB9IGNhdGNoKGVycil7XG4gICAgICAkcmVqZWN0LmNhbGwocmVjb3JkLCBlcnIpO1xuICAgIH1cbiAgfTtcbiAgcmVxdWlyZSgnLi8kLm1peCcpKFAucHJvdG90eXBlLCB7XG4gICAgLy8gMjUuNC41LjMgUHJvbWlzZS5wcm90b3R5cGUudGhlbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZClcbiAgICB0aGVuOiBmdW5jdGlvbiB0aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKXtcbiAgICAgIHZhciBTID0gYW5PYmplY3QoYW5PYmplY3QodGhpcykuY29uc3RydWN0b3IpW1NQRUNJRVNdO1xuICAgICAgdmFyIHJlYWN0ID0ge1xuICAgICAgICBvazogICB0eXBlb2Ygb25GdWxmaWxsZWQgPT0gJ2Z1bmN0aW9uJyA/IG9uRnVsZmlsbGVkIDogdHJ1ZSxcbiAgICAgICAgZmFpbDogdHlwZW9mIG9uUmVqZWN0ZWQgPT0gJ2Z1bmN0aW9uJyAgPyBvblJlamVjdGVkICA6IGZhbHNlXG4gICAgICB9O1xuICAgICAgdmFyIHByb21pc2UgPSByZWFjdC5QID0gbmV3IChTICE9IHVuZGVmaW5lZCA/IFMgOiBQKShmdW5jdGlvbihyZXMsIHJlail7XG4gICAgICAgIHJlYWN0LnJlcyA9IGFGdW5jdGlvbihyZXMpO1xuICAgICAgICByZWFjdC5yZWogPSBhRnVuY3Rpb24ocmVqKTtcbiAgICAgIH0pO1xuICAgICAgdmFyIHJlY29yZCA9IHRoaXNbUkVDT1JEXTtcbiAgICAgIHJlY29yZC5jLnB1c2gocmVhY3QpO1xuICAgICAgaWYocmVjb3JkLmEpcmVjb3JkLmEucHVzaChyZWFjdCk7XG4gICAgICBpZihyZWNvcmQucylub3RpZnkocmVjb3JkLCBmYWxzZSk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9LFxuICAgIC8vIDI1LjQuNS4xIFByb21pc2UucHJvdG90eXBlLmNhdGNoKG9uUmVqZWN0ZWQpXG4gICAgJ2NhdGNoJzogZnVuY3Rpb24ob25SZWplY3RlZCl7XG4gICAgICByZXR1cm4gdGhpcy50aGVuKHVuZGVmaW5lZCwgb25SZWplY3RlZCk7XG4gICAgfVxuICB9KTtcbn1cblxuLy8gZXhwb3J0XG4kZGVmKCRkZWYuRyArICRkZWYuVyArICRkZWYuRiAqICF1c2VOYXRpdmUsIHtQcm9taXNlOiBQfSk7XG5yZXF1aXJlKCcuLyQudGFnJykoUCwgUFJPTUlTRSk7XG5zcGVjaWVzKFApO1xuc3BlY2llcyhXcmFwcGVyID0gcmVxdWlyZSgnLi8kLmNvcmUnKVtQUk9NSVNFXSk7XG5cbi8vIHN0YXRpY3NcbiRkZWYoJGRlZi5TICsgJGRlZi5GICogIXVzZU5hdGl2ZSwgUFJPTUlTRSwge1xuICAvLyAyNS40LjQuNSBQcm9taXNlLnJlamVjdChyKVxuICByZWplY3Q6IGZ1bmN0aW9uIHJlamVjdChyKXtcbiAgICByZXR1cm4gbmV3IHRoaXMoZnVuY3Rpb24ocmVzLCByZWopeyByZWoocik7IH0pO1xuICB9XG59KTtcbiRkZWYoJGRlZi5TICsgJGRlZi5GICogKCF1c2VOYXRpdmUgfHwgdGVzdFJlc29sdmUodHJ1ZSkpLCBQUk9NSVNFLCB7XG4gIC8vIDI1LjQuNC42IFByb21pc2UucmVzb2x2ZSh4KVxuICByZXNvbHZlOiBmdW5jdGlvbiByZXNvbHZlKHgpe1xuICAgIHJldHVybiBpc1Byb21pc2UoeCkgJiYgc2FtZUNvbnN0cnVjdG9yKHguY29uc3RydWN0b3IsIHRoaXMpXG4gICAgICA/IHggOiBuZXcgdGhpcyhmdW5jdGlvbihyZXMpeyByZXMoeCk7IH0pO1xuICB9XG59KTtcbiRkZWYoJGRlZi5TICsgJGRlZi5GICogISh1c2VOYXRpdmUgJiYgcmVxdWlyZSgnLi8kLml0ZXItZGV0ZWN0JykoZnVuY3Rpb24oaXRlcil7XG4gIFAuYWxsKGl0ZXIpWydjYXRjaCddKGZ1bmN0aW9uKCl7fSk7XG59KSksIFBST01JU0UsIHtcbiAgLy8gMjUuNC40LjEgUHJvbWlzZS5hbGwoaXRlcmFibGUpXG4gIGFsbDogZnVuY3Rpb24gYWxsKGl0ZXJhYmxlKXtcbiAgICB2YXIgQyAgICAgID0gZ2V0Q29uc3RydWN0b3IodGhpcylcbiAgICAgICwgdmFsdWVzID0gW107XG4gICAgcmV0dXJuIG5ldyBDKGZ1bmN0aW9uKHJlcywgcmVqKXtcbiAgICAgIGZvck9mKGl0ZXJhYmxlLCBmYWxzZSwgdmFsdWVzLnB1c2gsIHZhbHVlcyk7XG4gICAgICB2YXIgcmVtYWluaW5nID0gdmFsdWVzLmxlbmd0aFxuICAgICAgICAsIHJlc3VsdHMgICA9IEFycmF5KHJlbWFpbmluZyk7XG4gICAgICBpZihyZW1haW5pbmcpJC5lYWNoLmNhbGwodmFsdWVzLCBmdW5jdGlvbihwcm9taXNlLCBpbmRleCl7XG4gICAgICAgIEMucmVzb2x2ZShwcm9taXNlKS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgICByZXN1bHRzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgICAgIC0tcmVtYWluaW5nIHx8IHJlcyhyZXN1bHRzKTtcbiAgICAgICAgfSwgcmVqKTtcbiAgICAgIH0pO1xuICAgICAgZWxzZSByZXMocmVzdWx0cyk7XG4gICAgfSk7XG4gIH0sXG4gIC8vIDI1LjQuNC40IFByb21pc2UucmFjZShpdGVyYWJsZSlcbiAgcmFjZTogZnVuY3Rpb24gcmFjZShpdGVyYWJsZSl7XG4gICAgdmFyIEMgPSBnZXRDb25zdHJ1Y3Rvcih0aGlzKTtcbiAgICByZXR1cm4gbmV3IEMoZnVuY3Rpb24ocmVzLCByZWope1xuICAgICAgZm9yT2YoaXRlcmFibGUsIGZhbHNlLCBmdW5jdGlvbihwcm9taXNlKXtcbiAgICAgICAgQy5yZXNvbHZlKHByb21pc2UpLnRoZW4ocmVzLCByZWopO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn0pOyIsIid1c2Ugc3RyaWN0JztcbnZhciAkYXQgID0gcmVxdWlyZSgnLi8kLnN0cmluZy1hdCcpKHRydWUpO1xuXG4vLyAyMS4xLjMuMjcgU3RyaW5nLnByb3RvdHlwZVtAQGl0ZXJhdG9yXSgpXG5yZXF1aXJlKCcuLyQuaXRlci1kZWZpbmUnKShTdHJpbmcsICdTdHJpbmcnLCBmdW5jdGlvbihpdGVyYXRlZCl7XG4gIHRoaXMuX3QgPSBTdHJpbmcoaXRlcmF0ZWQpOyAvLyB0YXJnZXRcbiAgdGhpcy5faSA9IDA7ICAgICAgICAgICAgICAgIC8vIG5leHQgaW5kZXhcbi8vIDIxLjEuNS4yLjEgJVN0cmluZ0l0ZXJhdG9yUHJvdG90eXBlJS5uZXh0KClcbn0sIGZ1bmN0aW9uKCl7XG4gIHZhciBPICAgICA9IHRoaXMuX3RcbiAgICAsIGluZGV4ID0gdGhpcy5faVxuICAgICwgcG9pbnQ7XG4gIGlmKGluZGV4ID49IE8ubGVuZ3RoKXJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZX07XG4gIHBvaW50ID0gJGF0KE8sIGluZGV4KTtcbiAgdGhpcy5faSArPSBwb2ludC5sZW5ndGg7XG4gIHJldHVybiB7dmFsdWU6IHBvaW50LCBkb25lOiBmYWxzZX07XG59KTsiLCJyZXF1aXJlKCcuL2VzNi5hcnJheS5pdGVyYXRvcicpO1xudmFyIEl0ZXJhdG9ycyA9IHJlcXVpcmUoJy4vJC5pdGVyYXRvcnMnKTtcbkl0ZXJhdG9ycy5Ob2RlTGlzdCA9IEl0ZXJhdG9ycy5IVE1MQ29sbGVjdGlvbiA9IEl0ZXJhdG9ycy5BcnJheTsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgYERPTUV2ZW50U3VibW9kdWxlYCBtb2R1bGVcbiAqIEBhdXRob3IgPGEgaHJlZj0nbWFpbHRvOnNlYmFzdGllbkByb2Jhc3praWV3aWN6LmNvbSc+U8OpYmFzdGllbiBSb2Jhc3praWV3aWN6PC9hPiwgPGEgaHJlZj0nbWFpbHRvOk5vcmJlcnQuU2NobmVsbEBpcmNhbS5mcic+Tm9yYmVydCBTY2huZWxsPC9hPlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuY29uc3QgSW5wdXRNb2R1bGUgPSByZXF1aXJlKCcuL0lucHV0TW9kdWxlJyk7XG5cbi8qKlxuICogYERPTUV2ZW50U3VibW9kdWxlYCBjbGFzcy5cbiAqIFRoZSBgRE9NRXZlbnRTdWJtb2R1bGVgIGNsYXNzIGFsbG93cyB0byBpbnN0YW50aWF0ZSBtb2R1bGVzIHRoYXQgcHJvdmlkZVxuICogdW5pZmllZCB2YWx1ZXMgKHN1Y2ggYXMgYEFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgLCBgQWNjZWxlcmF0aW9uYCxcbiAqIGBSb3RhdGlvblJhdGVgLCBgT3JpZW50YXRpb25gLCBgT3JpZW50YXRpb25BbHQpIGZyb20gdGhlIGBkZXZpY2Vtb3Rpb25gXG4gKiBvciBgZGV2aWNlb3JpZW50YXRpb25gIERPTSBldmVudHMuXG4gKlxuICogQGNsYXNzIERPTUV2ZW50U3VibW9kdWxlXG4gKiBAZXh0ZW5kcyBJbnB1dE1vZHVsZVxuICovXG5jbGFzcyBET01FdmVudFN1Ym1vZHVsZSBleHRlbmRzIElucHV0TW9kdWxlIHtcblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGBET01FdmVudFN1Ym1vZHVsZWAgbW9kdWxlIGluc3RhbmNlLlxuICAgKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtEZXZpY2VNb3Rpb25Nb2R1bGV8RGV2aWNlT3JpZW50YXRpb25Nb2R1bGV9IERPTUV2ZW50TW9kdWxlIC0gVGhlIHBhcmVudCBET00gZXZlbnQgbW9kdWxlLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlIC0gVGhlIG5hbWUgb2YgdGhlIHN1Ym1vZHVsZSAvIGV2ZW50ICgqZS5nLiogJ2FjY2VsZXJhdGlvbicgb3IgJ29yaWVudGF0aW9uQWx0JykuXG4gICAqIEBzZWUgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAqIEBzZWUgRGV2aWNlT3JpZW50YXRpb25Nb2R1bGVcbiAgICovXG4gIGNvbnN0cnVjdG9yKERPTUV2ZW50TW9kdWxlLCBldmVudFR5cGUpIHtcbiAgICBzdXBlcihldmVudFR5cGUpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIERPTSBldmVudCBwYXJlbnQgbW9kdWxlIGZyb20gd2hpY2ggdGhpcyBtb2R1bGUgZ2V0cyB0aGUgcmF3IHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEB0aGlzIERPTUV2ZW50U3VibW9kdWxlXG4gICAgICogQHR5cGUge0RldmljZU1vdGlvbk1vZHVsZXxEZXZpY2VPcmllbnRhdGlvbk1vZHVsZX1cbiAgICAgKiBAY29uc3RhbnRcbiAgICAgKi9cbiAgICB0aGlzLkRPTUV2ZW50TW9kdWxlID0gRE9NRXZlbnRNb2R1bGU7XG5cbiAgICAvKipcbiAgICAgKiBSYXcgdmFsdWVzIGNvbWluZyBmcm9tIHRoZSBgZGV2aWNlbW90aW9uYCBldmVudCBzZW50IGJ5IHRoaXMgbW9kdWxlLlxuICAgICAqXG4gICAgICogQHRoaXMgRE9NRXZlbnRTdWJtb2R1bGVcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICogQGRlZmF1bHQgWzAsIDAsIDBdXG4gICAgICovXG4gICAgdGhpcy5ldmVudCA9IFswLCAwLCAwXTtcblxuICAgIC8qKlxuICAgICAqIENvbXBhc3MgaGVhZGluZyByZWZlcmVuY2UgKGlPUyBkZXZpY2VzIG9ubHksIGBPcmllbnRhdGlvbmAgYW5kIGBPcmllbnRhdGlvbkFsdGAgc3VibW9kdWxlcyBvbmx5KS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERPTUV2ZW50U3VibW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZGVmYXVsdCBudWxsXG4gICAgICovXG4gICAgdGhpcy5fd2Via2l0Q29tcGFzc0hlYWRpbmdSZWZlcmVuY2UgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0cyB0aGUgbW9kdWxlLlxuICAgKi9cbiAgc3RhcnQoKSB7XG4gICAgdGhpcy5ET01FdmVudE1vZHVsZS5fYWRkTGlzdGVuZXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wcyB0aGUgbW9kdWxlLlxuICAgKi9cbiAgc3RvcCgpIHtcbiAgICB0aGlzLkRPTUV2ZW50TW9kdWxlLl9yZW1vdmVMaXN0ZW5lcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemVzIG9mIHRoZSBtb2R1bGUuXG4gICAqXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICBpbml0KCkge1xuICAgIC8vIEluZGljYXRlIHRvIHRoZSBwYXJlbnQgbW9kdWxlIHRoYXQgdGhpcyBldmVudCBpcyByZXF1aXJlZFxuICAgIHRoaXMuRE9NRXZlbnRNb2R1bGUucmVxdWlyZWRbdGhpcy5ldmVudFR5cGVdID0gdHJ1ZTtcblxuICAgIC8vIElmIHRoZSBwYXJlbnQgZXZlbnQgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldCwgaW5pdGlhbGl6ZSBpdFxuICAgIGxldCBET01FdmVudFByb21pc2UgPSB0aGlzLkRPTUV2ZW50TW9kdWxlLnByb21pc2U7XG4gICAgaWYgKCFET01FdmVudFByb21pc2UpXG4gICAgICBET01FdmVudFByb21pc2UgPSB0aGlzLkRPTUV2ZW50TW9kdWxlLmluaXQoKTtcblxuICAgIHJldHVybiBET01FdmVudFByb21pc2UudGhlbigobW9kdWxlKSA9PiB0aGlzKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IERPTUV2ZW50U3VibW9kdWxlOyIsIi8qKlxuICogQGZpbGVvdmVydmlldyBgRGV2aWNlTW90aW9uYCBtb2R1bGVcbiAqIEBhdXRob3IgPGEgaHJlZj0nbWFpbHRvOnNlYmFzdGllbkByb2Jhc3praWV3aWN6LmNvbSc+U8OpYmFzdGllbiBSb2Jhc3praWV3aWN6PC9hPiwgPGEgaHJlZj0nbWFpbHRvOk5vcmJlcnQuU2NobmVsbEBpcmNhbS5mcic+Tm9yYmVydCBTY2huZWxsPC9hPlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuY29uc3QgSW5wdXRNb2R1bGUgPSByZXF1aXJlKCcuL0lucHV0TW9kdWxlJyk7XG5jb25zdCBET01FdmVudFN1Ym1vZHVsZSA9IHJlcXVpcmUoJy4vRE9NRXZlbnRTdWJtb2R1bGUnKTtcbmNvbnN0IE1vdGlvbklucHV0ID0gcmVxdWlyZSgnLi9Nb3Rpb25JbnB1dCcpO1xuY29uc3QgcGxhdGZvcm0gPSByZXF1aXJlKCdwbGF0Zm9ybScpO1xuXG4vKipcbiAqIEdldHMgdGhlIGN1cnJlbnQgbG9jYWwgdGltZSBpbiBzZWNvbmRzLlxuICogVXNlcyBgd2luZG93LnBlcmZvcm1hbmNlLm5vdygpYCBpZiBhdmFpbGFibGUsIGFuZCBgRGF0ZS5ub3coKWAgb3RoZXJ3aXNlLlxuICogXG4gKiBAcmV0dXJuIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIGdldExvY2FsVGltZSgpIHtcbiAgaWYgKHdpbmRvdy5wZXJmb3JtYW5jZSlcbiAgICByZXR1cm4gd2luZG93LnBlcmZvcm1hbmNlLm5vdygpIC8gMTAwMDtcbiAgcmV0dXJuIERhdGUubm93KCkgLyAxMDAwO1xufVxuXG4vKipcbiAqIGBEZXZpY2VNb3Rpb25gIG1vZHVsZSBzaW5nbGV0b24uXG4gKiBUaGUgYERldmljZU1vdGlvbk1vZHVsZWAgc2luZ2xldG9uIHByb3ZpZGVzIHRoZSByYXcgdmFsdWVzXG4gKiBvZiB0aGUgYWNjZWxlcmF0aW9uIGluY2x1ZGluZyBncmF2aXR5LCBhY2NlbGVyYXRpb24sIGFuZCByb3RhdGlvblxuICogcmF0ZSBwcm92aWRlZCBieSB0aGUgYERldmljZU1vdGlvbmAgZXZlbnQuXG4gKiBJdCBhbHNvIGluc3RhbnRpYXRlIHRoZSBgQWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAsXG4gKiBgQWNjZWxlcmF0aW9uYCBhbmQgYFJvdGF0aW9uUmF0ZWAgc3VibW9kdWxlcyB0aGF0IHVuaWZ5IHRob3NlIHZhbHVlc1xuICogYWNyb3NzIHBsYXRmb3JtcyBieSBtYWtpbmcgdGhlbSBjb21wbGlhbnQgd2l0aCB7QGxpbmtcbiAqIGh0dHA6Ly93d3cudzMub3JnL1RSL29yaWVudGF0aW9uLWV2ZW50L3x0aGUgVzNDIHN0YW5kYXJkfS5cbiAqIFdoZW4gcmF3IHZhbHVlcyBhcmUgbm90IHByb3ZpZGVkIGJ5IHRoZSBzZW5zb3JzLCB0aGlzIG1vZHVsZXMgdHJpZXNcbiAqIHRvIHJlY2FsY3VsYXRlIHRoZW0gZnJvbSBhdmFpbGFibGUgdmFsdWVzOlxuICogLSBgYWNjZWxlcmF0aW9uYCBpcyBjYWxjdWxhdGVkIGZyb20gYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgXG4gKiAgIHdpdGggYSBoaWdoLXBhc3MgZmlsdGVyO1xuICogLSAoY29taW5nIHNvb24g4oCUIHdhaXRpbmcgZm9yIGEgYnVnIG9uIENocm9tZSB0byBiZSByZXNvbHZlZClcbiAqICAgYHJvdGF0aW9uUmF0ZWAgaXMgY2FsY3VsYXRlZCBmcm9tIGBvcmllbnRhdGlvbmAuXG4gKlxuICogQGNsYXNzIERldmljZU1vdGlvbk1vZHVsZVxuICogQGV4dGVuZHMgSW5wdXRNb2R1bGVcbiAqL1xuY2xhc3MgRGV2aWNlTW90aW9uTW9kdWxlIGV4dGVuZHMgSW5wdXRNb2R1bGUge1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIHRoZSBgRGV2aWNlTW90aW9uYCBtb2R1bGUgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoJ2RldmljZW1vdGlvbicpO1xuXG4gICAgLyoqXG4gICAgICogUmF3IHZhbHVlcyBjb21pbmcgZnJvbSB0aGUgYGRldmljZW1vdGlvbmAgZXZlbnQgc2VudCBieSB0aGlzIG1vZHVsZS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU1vdGlvbk1vZHVsZVxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKiBAZGVmYXVsdCBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF1cbiAgICAgKi9cbiAgICB0aGlzLmV2ZW50ID0gW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGBBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5YCBtb2R1bGUuXG4gICAgICogUHJvdmlkZXMgdW5pZmllZCB2YWx1ZXMgb2YgdGhlIGFjY2VsZXJhdGlvbiBpbmNsdWRpbmcgZ3Jhdml0eS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU1vdGlvbk1vZHVsZVxuICAgICAqIEB0eXBlIHtET01FdmVudFN1Ym1vZHVsZX1cbiAgICAgKi9cbiAgICB0aGlzLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkgPSBuZXcgRE9NRXZlbnRTdWJtb2R1bGUodGhpcywgJ2FjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHknKTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBUaGUgYEFjY2VsZXJhdGlvbmAgc3VibW9kdWxlLlxuICAgICAqIFByb3ZpZGVzIHVuaWZpZWQgdmFsdWVzIG9mIHRoZSBhY2NlbGVyYXRpb24uXG4gICAgICogRXN0aW1hdGVzIHRoZSBhY2NlbGVyYXRpb24gdmFsdWVzIGZyb20gYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgXG4gICAgICogcmF3IHZhbHVlcyBpZiB0aGUgYWNjZWxlcmF0aW9uIHJhdyB2YWx1ZXMgYXJlIG5vdCBhdmFpbGFibGUgb24gdGhlXG4gICAgICogZGV2aWNlLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge0RPTUV2ZW50U3VibW9kdWxlfVxuICAgICAqL1xuICAgIHRoaXMuYWNjZWxlcmF0aW9uID0gbmV3IERPTUV2ZW50U3VibW9kdWxlKHRoaXMsICdhY2NlbGVyYXRpb24nKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBgUm90YXRpb25SYXRlYCBzdWJtb2R1bGUuXG4gICAgICogUHJvdmlkZXMgdW5pZmllZCB2YWx1ZXMgb2YgdGhlIHJvdGF0aW9uIHJhdGUuXG4gICAgICogKGNvbWluZyBzb29uLCB3YWl0aW5nIGZvciBhIGJ1ZyBvbiBDaHJvbWUgdG8gYmUgcmVzb2x2ZWQpXG4gICAgICogRXN0aW1hdGVzIHRoZSByb3RhdGlvbiByYXRlIHZhbHVlcyBmcm9tIGBvcmllbnRhdGlvbmAgdmFsdWVzIGlmXG4gICAgICogdGhlIHJvdGF0aW9uIHJhdGUgcmF3IHZhbHVlcyBhcmUgbm90IGF2YWlsYWJsZSBvbiB0aGUgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge0RPTUV2ZW50U3VibW9kdWxlfVxuICAgICAqL1xuICAgIHRoaXMucm90YXRpb25SYXRlID0gbmV3IERPTUV2ZW50U3VibW9kdWxlKHRoaXMsICdyb3RhdGlvblJhdGUnKTtcblxuICAgIC8qKlxuICAgICAqIFJlcXVpcmVkIHN1Ym1vZHVsZXMgLyBldmVudHMuXG4gICAgICpcbiAgICAgKiBAdGhpcyBEZXZpY2VNb3Rpb25Nb2R1bGVcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbH0gYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eSAtIEluZGljYXRlcyB3aGV0aGVyIHRoZSBgYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAgdW5pZmllZCB2YWx1ZXMgYXJlIHJlcXVpcmVkIG9yIG5vdCAoZGVmYXVsdHMgdG8gYGZhbHNlYCkuXG4gICAgICogQHByb3BlcnR5IHtib29sfSBhY2NlbGVyYXRpb24gLSBJbmRpY2F0ZXMgd2hldGhlciB0aGUgYGFjY2VsZXJhdGlvbmAgdW5pZmllZCB2YWx1ZXMgYXJlIHJlcXVpcmVkIG9yIG5vdCAoZGVmYXVsdHMgdG8gYGZhbHNlYCkuXG4gICAgICogQHByb3BlcnR5IHtib29sfSByb3RhdGlvblJhdGUgLSBJbmRpY2F0ZXMgd2hldGhlciB0aGUgYHJvdGF0aW9uUmF0ZWAgdW5pZmllZCB2YWx1ZXMgYXJlIHJlcXVpcmVkIG9yIG5vdCAoZGVmYXVsdHMgdG8gYGZhbHNlYCkuXG4gICAgICovXG4gICAgdGhpcy5yZXF1aXJlZCA9IHtcbiAgICAgIGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHk6IGZhbHNlLFxuICAgICAgYWNjZWxlcmF0aW9uOiBmYWxzZSxcbiAgICAgIHJvdGF0aW9uUmF0ZTogZmFsc2VcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIGxpc3RlbmVycyBzdWJzY3JpYmVkIHRvIHRoZSBgRGV2aWNlTW90aW9uYCBtb2R1bGUuXG4gICAgICpcbiAgICAgKiBAdGhpcyBEZXZpY2VNb3Rpb25Nb2R1bGVcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuX251bUxpc3RlbmVycyA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIGZ1bmN0aW9uIG9mIHRoZSBtb2R1bGUncyBwcm9taXNlLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqIEBkZWZhdWx0IG51bGxcbiAgICAgKiBAc2VlIERldmljZU1vdGlvbk1vZHVsZSNpbml0XG4gICAgICovXG4gICAgdGhpcy5fcHJvbWlzZVJlc29sdmUgPSBudWxsO1xuICAgIFxuICAgIC8qKlxuICAgICAqIFVuaWZ5aW5nIGZhY3RvciBvZiB0aGUgbW90aW9uIGRhdGEgdmFsdWVzIChgMWAgb24gQW5kcm9pZCwgYC0xYCBvbiBpT1MpLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLl91bmlmeU1vdGlvbkRhdGEgPSAocGxhdGZvcm0ub3MuZmFtaWx5ID09PSAnaU9TJyA/IC0xIDogMSk7XG5cbiAgICAvKipcbiAgICAgKiBVbmlmeWluZyBmYWN0b3Igb2YgdGhlIHBlcmlvZCAoYDAuMDAxYCBvbiBBbmRyb2lkLCBgMWAgb24gaU9TKS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU1vdGlvbk1vZHVsZVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fdW5pZnlQZXJpb2QgPSAocGxhdGZvcm0ub3MuZmFtaWx5ID09PSAnQW5kcm9pZCcgPyAwLjAwMSA6IDEpO1xuXG4gICAgLyoqXG4gICAgICogQWNjZWxlcmF0aW9uIGNhbGN1bGF0ZWQgZnJvbSB0aGUgYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgIHJhdyB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAdGhpcyBEZXZpY2VNb3Rpb25Nb2R1bGVcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICogQGRlZmF1bHQgWzAsIDAsIDBdXG4gICAgICovXG4gICAgdGhpcy5fY2FsY3VsYXRlZEFjY2VsZXJhdGlvbiA9IFswLCAwLCAwXTtcblxuICAgIC8qKlxuICAgICAqIFRpbWUgY29uc3RhbnQgKGhhbGYtbGlmZSkgb2YgdGhlIGhpZ2gtcGFzcyBmaWx0ZXIgdXNlZCB0byBzbW9vdGggdGhlIGFjY2VsZXJhdGlvbiB2YWx1ZXMgY2FsY3VsYXRlZCBmcm9tIHRoZSBhY2NlbGVyYXRpb24gaW5jbHVkaW5nIGdyYXZpdHkgcmF3IHZhbHVlcyAoaW4gc2Vjb25kcykuXG4gICAgICpcbiAgICAgKiBAdGhpcyBEZXZpY2VNb3Rpb25Nb2R1bGVcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBkZWZhdWx0IDAuMVxuICAgICAqIEBjb25zdGFudFxuICAgICAqL1xuICAgIHRoaXMuX2NhbGN1bGF0ZWRBY2NlbGVyYXRpb25UaW1lQ29uc3RhbnQgPSAwLjE7XG5cbiAgICAvKipcbiAgICAgKiBMYXRlc3QgYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgIHJhdyB2YWx1ZSwgdXNlZCBpbiB0aGUgaGlnaC1wYXNzIGZpbHRlciB0byBjYWxjdWxhdGUgdGhlIGFjY2VsZXJhdGlvbiAoaWYgdGhlIGBhY2NlbGVyYXRpb25gIHZhbHVlcyBhcmUgbm90IHByb3ZpZGVkIGJ5IGAnZGV2aWNlbW90aW9uJ2ApLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBkZWZhdWx0IFswLCAwLCAwXVxuICAgICAqL1xuICAgIHRoaXMuX2xhc3RBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5ID0gWzAsIDAsIDBdO1xuICBcbiAgICAvKipcbiAgICAgKiBSb3RhdGlvbiByYXRlIGNhbGN1bGF0ZWQgZnJvbSB0aGUgb3JpZW50YXRpb24gdmFsdWVzLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBkZWZhdWx0IFswLCAwLCAwXVxuICAgICAqL1xuICAgIHRoaXMuX2NhbGN1bGF0ZWRSb3RhdGlvblJhdGUgPSBbMCwgMCwgMF07XG5cbiAgICAvKipcbiAgICAgKiBMYXRlc3Qgb3JpZW50YXRpb24gdmFsdWUsIHVzZWQgdG8gY2FsY3VsYXRlIHRoZSByb3RhdGlvbiByYXRlICAoaWYgdGhlIGByb3RhdGlvblJhdGVgIHZhbHVlcyBhcmUgbm90IHByb3ZpZGVkIGJ5IGAnZGV2aWNlbW90aW9uJ2ApLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBkZWZhdWx0IFswLCAwLCAwXVxuICAgICAqL1xuICAgIHRoaXMuX2xhc3RPcmllbnRhdGlvbiA9IFswLCAwLCAwXTtcblxuICAgIC8qKlxuICAgICAqIExhdGVzdCBvcmllbnRhdGlvbiB0aW1lc3RhbXBzLCB1c2VkIHRvIGNhbGN1bGF0ZSB0aGUgcm90YXRpb24gcmF0ZSAoaWYgdGhlIGByb3RhdGlvblJhdGVgIHZhbHVlcyBhcmUgbm90IHByb3ZpZGVkIGJ5IGAnZGV2aWNlbW90aW9uJ2ApLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBkZWZhdWx0IFswLCAwLCAwXVxuICAgICAqL1xuICAgIHRoaXMuX2xhc3RPcmllbnRhdGlvblRpbWVzdGFtcCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBNZXRob2QgYmluZGluZyBvZiB0aGUgc2Vuc29yIGNoZWNrLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX2RldmljZW1vdGlvbkNoZWNrID0gdGhpcy5fZGV2aWNlbW90aW9uQ2hlY2suYmluZCh0aGlzKTtcblxuICAgIC8qKlxuICAgICAqIE1ldGhvZCBiaW5kaW5nIG9mIHRoZSBgJ2RldmljZW1vdGlvbidgIGV2ZW50IGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlTW90aW9uTW9kdWxlXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX2RldmljZW1vdGlvbkxpc3RlbmVyID0gdGhpcy5fZGV2aWNlbW90aW9uTGlzdGVuZXIuYmluZCh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNheSBmYWN0b3Igb2YgdGhlIGhpZ2gtcGFzcyBmaWx0ZXIgdXNlZCB0byBjYWxjdWxhdGUgdGhlIGFjY2VsZXJhdGlvbiBmcm9tIHRoZSBgYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAgcmF3IHZhbHVlcy5cbiAgICpcbiAgICogQHR5cGUge251bWJlcn1cbiAgICogQHJlYWRvbmx5XG4gICAqL1xuICBnZXQgX2NhbGN1bGF0ZWRBY2NlbGVyYXRpb25EZWNheSgpIHtcbiAgICByZXR1cm4gTWF0aC5leHAoLTIgKiBNYXRoLlBJICogdGhpcy5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5LnBlcmlvZCAvIHRoaXMuX2NhbGN1bGF0ZWRBY2NlbGVyYXRpb25UaW1lQ29uc3RhbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbnNvciBjaGVjayBvbiBpbml0aWFsaXphdGlvbiBvZiB0aGUgbW9kdWxlLlxuICAgKiBUaGlzIG1ldGhvZDpcbiAgICogLSBjaGVja3Mgd2hldGhlciB0aGUgYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgLCB0aGUgYGFjY2VsZXJhdGlvbmAsXG4gICAqICAgYW5kIHRoZSBgcm90YXRpb25SYXRlYCB2YWx1ZXMgYXJlIHZhbGlkIG9yIG5vdDtcbiAgICogLSBnZXRzIHRoZSBwZXJpb2Qgb2YgdGhlIGAnZGV2aWNlbW90aW9uJ2AgZXZlbnQgYW5kIHNldHMgdGhlIHBlcmlvZCBvZlxuICAgKiAgIHRoZSBgQWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAsIGBBY2NlbGVyYXRpb25gLCBhbmQgYFJvdGF0aW9uUmF0ZWBcbiAgICogICBzdWJtb2R1bGVzO1xuICAgKiAtIChpbiB0aGUgY2FzZSB3aGVyZSBhY2NlbGVyYXRpb24gcmF3IHZhbHVlcyBhcmUgbm90IHByb3ZpZGVkKVxuICAgKiAgIGluZGljYXRlcyB3aGV0aGVyIHRoZSBhY2NlbGVyYXRpb24gY2FuIGJlIGNhbGN1bGF0ZWQgZnJvbSB0aGVcbiAgICogICBgYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAgdW5pZmllZCB2YWx1ZXMgb3Igbm90LlxuICAgKlxuICAgKiBAcGFyYW0ge0RldmljZU1vdGlvbkV2ZW50fSBlIC0gVGhlIGZpcnN0IGAnZGV2aWNlbW90aW9uJ2AgZXZlbnQgY2F1Z2h0LlxuICAgKi9cbiAgX2RldmljZW1vdGlvbkNoZWNrKGUpIHtcbiAgICB0aGlzLmlzUHJvdmlkZWQgPSB0cnVlO1xuICAgIHRoaXMucGVyaW9kID0gZS5pbnRlcnZhbCAvIDEwMDA7XG5cbiAgICAvLyBTZW5zb3IgYXZhaWxhYmlsaXR5IGZvciB0aGUgYWNjZWxlcmF0aW9uIGluY2x1ZGluZyBncmF2aXR5XG4gICAgdGhpcy5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5LmlzUHJvdmlkZWQgPSAoXG4gICAgICBlLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkgJiZcbiAgICAgICh0eXBlb2YgZS5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5LnggPT09ICdudW1iZXInKSAmJlxuICAgICAgKHR5cGVvZiBlLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkueSA9PT0gJ251bWJlcicpICYmXG4gICAgICAodHlwZW9mIGUuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS56ID09PSAnbnVtYmVyJylcbiAgICApO1xuICAgIHRoaXMuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS5wZXJpb2QgPSBlLmludGVydmFsICogdGhpcy5fdW5pZnlQZXJpb2Q7XG5cbiAgICAvLyBTZW5zb3IgYXZhaWxhYmlsaXR5IGZvciB0aGUgYWNjZWxlcmF0aW9uXG4gICAgdGhpcy5hY2NlbGVyYXRpb24uaXNQcm92aWRlZCA9IChcbiAgICAgIGUuYWNjZWxlcmF0aW9uICYmXG4gICAgICAodHlwZW9mIGUuYWNjZWxlcmF0aW9uLnggPT09ICdudW1iZXInKSAmJlxuICAgICAgKHR5cGVvZiBlLmFjY2VsZXJhdGlvbi55ID09PSAnbnVtYmVyJykgJiZcbiAgICAgICh0eXBlb2YgZS5hY2NlbGVyYXRpb24ueiA9PT0gJ251bWJlcicpXG4gICAgKTtcbiAgICB0aGlzLmFjY2VsZXJhdGlvbi5wZXJpb2QgPSBlLmludGVydmFsICogdGhpcy5fdW5pZnlQZXJpb2Q7XG5cbiAgICAvLyBTZW5zb3IgYXZhaWxhYmlsaXR5IGZvciB0aGUgcm90YXRpb24gcmF0ZVxuICAgIHRoaXMucm90YXRpb25SYXRlLmlzUHJvdmlkZWQgPSAoXG4gICAgICBlLnJvdGF0aW9uUmF0ZSAmJlxuICAgICAgKHR5cGVvZiBlLnJvdGF0aW9uUmF0ZS5hbHBoYSA9PT0gJ251bWJlcicpICYmXG4gICAgICAodHlwZW9mIGUucm90YXRpb25SYXRlLmJldGEgPT09ICdudW1iZXInKSAmJlxuICAgICAgKHR5cGVvZiBlLnJvdGF0aW9uUmF0ZS5nYW1tYSA9PT0gJ251bWJlcicpXG4gICAgKTtcbiAgICB0aGlzLnJvdGF0aW9uUmF0ZS5wZXJpb2QgPSBlLmludGVydmFsICogdGhpcy5fdW5pZnlQZXJpb2Q7XG5cbiAgICAvLyBXZSBvbmx5IG5lZWQgdG8gbGlzdGVuIHRvIG9uZSBldmVudCAoPT4gcmVtb3ZlIHRoZSBsaXN0ZW5lcilcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignZGV2aWNlbW90aW9uJywgdGhpcy5fZGV2aWNlbW90aW9uQ2hlY2ssIGZhbHNlKTtcblxuICAgIC8vIElmIGFjY2VsZXJhdGlvbiBpcyBub3QgcHJvdmlkZWQgYnkgcmF3IHNlbnNvcnMsIGluZGljYXRlIHdoZXRoZXIgaXRcbiAgICAvLyBjYW4gYmUgY2FsY3VsYXRlZCB3aXRoIGBhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5YCBvciBub3RcbiAgICBpZiAoIXRoaXMuYWNjZWxlcmF0aW9uLmlzUHJvdmlkZWQpXG4gICAgICB0aGlzLmFjY2VsZXJhdGlvbi5pc0NhbGN1bGF0ZWQgPSB0aGlzLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkuaXNQcm92aWRlZDtcblxuICAgIC8vIFdBUk5JTkdcbiAgICAvLyBUaGUgbGluZXMgb2YgY29kZSBiZWxvdyBhcmUgY29tbWVudGVkIGJlY2F1c2Ugb2YgYSBidWcgb2YgQ2hyb21lXG4gICAgLy8gb24gc29tZSBBbmRyb2lkIGRldmljZXMsIHdoZXJlICdkZXZpY2Vtb3Rpb24nIGV2ZW50cyBhcmUgbm90IHNlbnRcbiAgICAvLyBvciBjYXVnaHQgaWYgdGhlIGxpc3RlbmVyIGlzIHNldCB1cCBhZnRlciBhICdkZXZpY2VvcmllbnRhdGlvbidcbiAgICAvLyBsaXN0ZW5lci4gSGVyZSwgdGhlIF90cnlPcmllbnRhdGlvbkZhbGxiYWNrIG1ldGhvZCB3b3VsZCBhZGQgYVxuICAgIC8vICdkZXZpY2VvcmllbnRhdGlvbicgbGlzdGVuZXIgYW5kIGJsb2NrIGFsbCBzdWJzZXF1ZW50ICdkZXZpY2Vtb3Rpb24nXG4gICAgLy8gZXZlbnRzIG9uIHRoZXNlIGRldmljZXMuIENvbW1lbnRzIHdpbGwgYmUgcmVtb3ZlZCBvbmNlIHRoZSBidWcgb2ZcbiAgICAvLyBDaHJvbWUgaXMgY29ycmVjdGVkLlxuXG4gICAgLy8gaWYgKHRoaXMucmVxdWlyZWQucm90YXRpb25SYXRlICYmICF0aGlzLnJvdGF0aW9uUmF0ZS5pc1Byb3ZpZGVkKVxuICAgIC8vICAgdGhpcy5fdHJ5T3JpZW50YXRpb25GYWxsYmFjaygpO1xuICAgIC8vIGVsc2VcbiAgICB0aGlzLl9wcm9taXNlUmVzb2x2ZSh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBgJ2RldmljZW1vdGlvbidgIGV2ZW50IGNhbGxiYWNrLlxuICAgKiBUaGlzIG1ldGhvZCBlbWl0cyBhbiBldmVudCB3aXRoIHRoZSByYXcgYCdkZXZpY2Vtb3Rpb24nYCB2YWx1ZXMsIGFuZCBlbWl0c1xuICAgKiBldmVudHMgd2l0aCB0aGUgdW5pZmllZCBgYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAsIGBhY2NlbGVyYXRpb25gLCBcbiAgICogYW5kIC8gb3IgYHJvdGF0aW9uUmF0ZWAgdmFsdWVzIGlmIHRoZXkgYXJlIHJlcXVpcmVkLlxuICAgKlxuICAgKiBAcGFyYW0ge0RldmljZU1vdGlvbkV2ZW50fSBlIC0gYCdkZXZpY2Vtb3Rpb24nYCBldmVudCB0aGUgdmFsdWVzIGFyZSBjYWxjdWxhdGVkIGZyb20uXG4gICAqL1xuICBfZGV2aWNlbW90aW9uTGlzdGVuZXIoZSkge1xuICAgIC8vICdkZXZpY2Vtb3Rpb24nIGV2ZW50IChyYXcgdmFsdWVzKVxuICAgIHRoaXMuX2VtaXREZXZpY2VNb3Rpb25FdmVudChlKTtcblxuICAgIC8vICdhY2NlbGVyYXRpb24nIGV2ZW50ICh1bmlmaWVkIHZhbHVlcylcbiAgICBpZiAodGhpcy5yZXF1aXJlZC5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5ICYmIHRoaXMuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS5pc1ZhbGlkKVxuICAgICAgdGhpcy5fZW1pdEFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlFdmVudChlKTtcblxuICAgIC8vICdhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5JyBldmVudCAodW5pZmllZCB2YWx1ZXMpXG4gICAgaWYgKHRoaXMucmVxdWlyZWQuYWNjZWxlcmF0aW9uICYmIHRoaXMuYWNjZWxlcmF0aW9uLmlzVmFsaWQpIC8vIHRoZSBmYWxsYmFjayBjYWxjdWxhdGlvbiBvZiB0aGUgYWNjZWxlcmF0aW9uIGhhcHBlbnMgaW4gdGhlIGBfZW1pdEFjY2VsZXJhdGlvbmAgbWV0aG9kLCBzbyB3ZSBjaGVjayBpZiB0aGlzLmFjY2VsZXJhdGlvbi5pc1ZhbGlkXG4gICAgICB0aGlzLl9lbWl0QWNjZWxlcmF0aW9uRXZlbnQoZSk7XG5cbiAgICAvLyAncm90YXRpb25SYXRlJyBldmVudCAodW5pZmllZCB2YWx1ZXMpXG4gICAgaWYgKHRoaXMucmVxdWlyZWQucm90YXRpb25SYXRlICYmIHRoaXMucm90YXRpb25SYXRlLmlzUHJvdmlkZWQpIC8vIHRoZSBmYWxsYmFjayBjYWxjdWxhdGlvbiBvZiB0aGUgcm90YXRpb24gcmF0ZSBkb2VzIE5PVCBoYXBwZW4gaW4gdGhlIGBfZW1pdFJvdGF0aW9uUmF0ZWAgbWV0aG9kLCBzbyB3ZSBvbmx5IGNoZWNrIGlmIHRoaXMucm90YXRpb25SYXRlLmlzUHJvdmlkZWRcbiAgICAgIHRoaXMuX2VtaXRSb3RhdGlvblJhdGVFdmVudChlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbWl0cyB0aGUgYCdkZXZpY2Vtb3Rpb24nYCByYXcgdmFsdWVzLlxuICAgKlxuICAgKiBAcGFyYW0ge0RldmljZU1vdGlvbkV2ZW50fSBlIC0gYCdkZXZpY2Vtb3Rpb24nYCBldmVudCB0aGUgdmFsdWVzIGFyZSBjYWxjdWxhdGVkIGZyb20uXG4gICAqL1xuICBfZW1pdERldmljZU1vdGlvbkV2ZW50KGUpIHtcbiAgICBsZXQgb3V0RXZlbnQgPSB0aGlzLmV2ZW50O1xuXG4gICAgaWYgKGUuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eSkge1xuICAgICAgb3V0RXZlbnRbMF0gPSBlLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkueDtcbiAgICAgIG91dEV2ZW50WzFdID0gZS5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5Lnk7XG4gICAgICBvdXRFdmVudFsyXSA9IGUuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS56O1xuICAgIH1cblxuICAgIGlmIChlLmFjY2VsZXJhdGlvbikge1xuICAgICAgb3V0RXZlbnRbM10gPSBlLmFjY2VsZXJhdGlvbi54O1xuICAgICAgb3V0RXZlbnRbNF0gPSBlLmFjY2VsZXJhdGlvbi55O1xuICAgICAgb3V0RXZlbnRbNV0gPSBlLmFjY2VsZXJhdGlvbi56O1xuICAgIH1cblxuICAgIGlmIChlLnJvdGF0aW9uUmF0ZSkge1xuICAgICAgb3V0RXZlbnRbNl0gPSBlLnJvdGF0aW9uUmF0ZS5hbHBoYTtcbiAgICAgIG91dEV2ZW50WzddID0gZS5yb3RhdGlvblJhdGUuYmV0YTtcbiAgICAgIG91dEV2ZW50WzhdID0gZS5yb3RhdGlvblJhdGUuZ2FtbWE7XG4gICAgfVxuXG4gICAgdGhpcy5lbWl0KG91dEV2ZW50KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbWl0cyB0aGUgYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgIHVuaWZpZWQgdmFsdWVzLlxuICAgKlxuICAgKiBAcGFyYW0ge0RldmljZU1vdGlvbkV2ZW50fSBlIC0gYCdkZXZpY2Vtb3Rpb24nYCBldmVudCB0aGUgdmFsdWVzIGFyZSBjYWxjdWxhdGVkIGZyb20uXG4gICAqL1xuICBfZW1pdEFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlFdmVudChlKSB7XG4gICAgbGV0IG91dEV2ZW50ID0gdGhpcy5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5LmV2ZW50O1xuXG4gICAgb3V0RXZlbnRbMF0gPSBlLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkueCAqIHRoaXMuX3VuaWZ5TW90aW9uRGF0YTtcbiAgICBvdXRFdmVudFsxXSA9IGUuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS55ICogdGhpcy5fdW5pZnlNb3Rpb25EYXRhO1xuICAgIG91dEV2ZW50WzJdID0gZS5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5LnogKiB0aGlzLl91bmlmeU1vdGlvbkRhdGE7XG5cbiAgICB0aGlzLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkuZW1pdChvdXRFdmVudCk7XG4gIH1cblxuICAvKipcbiAgICogRW1pdHMgdGhlIGBhY2NlbGVyYXRpb25gIHVuaWZpZWQgdmFsdWVzLlxuICAgKiBXaGVuIHRoZSBgYWNjZWxlcmF0aW9uYCByYXcgdmFsdWVzIGFyZSBub3QgYXZhaWxhYmxlLCB0aGUgbWV0aG9kXG4gICAqIGFsc28gY2FsY3VsYXRlcyB0aGUgYWNjZWxlcmF0aW9uIGZyb20gdGhlXG4gICAqIGBhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5YCByYXcgdmFsdWVzLlxuICAgKlxuICAgKiBAcGFyYW0ge0RldmljZU1vdGlvbkV2ZW50fSBlIC0gVGhlIGAnZGV2aWNlbW90aW9uJ2AgZXZlbnQuXG4gICAqL1xuICBfZW1pdEFjY2VsZXJhdGlvbkV2ZW50KGUpIHtcbiAgICBsZXQgb3V0RXZlbnQgPSB0aGlzLmFjY2VsZXJhdGlvbi5ldmVudDtcblxuICAgIGlmICh0aGlzLmFjY2VsZXJhdGlvbi5pc1Byb3ZpZGVkKSB7XG4gICAgICAvLyBJZiByYXcgYWNjZWxlcmF0aW9uIHZhbHVlcyBhcmUgcHJvdmlkZWRcbiAgICAgIG91dEV2ZW50WzBdID0gZS5hY2NlbGVyYXRpb24ueCAqIHRoaXMuX3VuaWZ5TW90aW9uRGF0YTtcbiAgICAgIG91dEV2ZW50WzFdID0gZS5hY2NlbGVyYXRpb24ueSAqIHRoaXMuX3VuaWZ5TW90aW9uRGF0YTtcbiAgICAgIG91dEV2ZW50WzJdID0gZS5hY2NlbGVyYXRpb24ueiAqIHRoaXMuX3VuaWZ5TW90aW9uRGF0YTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS5pc1ZhbGlkKSB7XG4gICAgICAvLyBPdGhlcndpc2UsIGlmIGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkgdmFsdWVzIGFyZSBwcm92aWRlZCxcbiAgICAgIC8vIGVzdGltYXRlIHRoZSBhY2NlbGVyYXRpb24gd2l0aCBhIGhpZ2gtcGFzcyBmaWx0ZXJcbiAgICAgIGNvbnN0IGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkgPSBbXG4gICAgICAgIGUuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS54ICogdGhpcy5fdW5pZnlNb3Rpb25EYXRhLFxuICAgICAgICBlLmFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkueSAqIHRoaXMuX3VuaWZ5TW90aW9uRGF0YSxcbiAgICAgICAgZS5hY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5LnogKiB0aGlzLl91bmlmeU1vdGlvbkRhdGFcbiAgICAgIF07XG4gICAgICBjb25zdCBrID0gdGhpcy5fY2FsY3VsYXRlZEFjY2VsZXJhdGlvbkRlY2F5O1xuXG4gICAgICAvLyBIaWdoLXBhc3MgZmlsdGVyIHRvIGVzdGltYXRlIHRoZSBhY2NlbGVyYXRpb24gKHdpdGhvdXQgdGhlIGdyYXZpdHkpXG4gICAgICB0aGlzLl9jYWxjdWxhdGVkQWNjZWxlcmF0aW9uWzBdID0gKDEgKyBrKSAqIDAuNSAqIGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlbMF0gLSAoMSArIGspICogMC41ICogdGhpcy5fbGFzdEFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlbMF0gKyBrICogdGhpcy5fY2FsY3VsYXRlZEFjY2VsZXJhdGlvblswXTtcbiAgICAgIHRoaXMuX2NhbGN1bGF0ZWRBY2NlbGVyYXRpb25bMV0gPSAoMSArIGspICogMC41ICogYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eVsxXSAtICgxICsgaykgKiAwLjUgKiB0aGlzLl9sYXN0QWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eVsxXSArIGsgKiB0aGlzLl9jYWxjdWxhdGVkQWNjZWxlcmF0aW9uWzFdO1xuICAgICAgdGhpcy5fY2FsY3VsYXRlZEFjY2VsZXJhdGlvblsyXSA9ICgxICsgaykgKiAwLjUgKiBhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5WzJdIC0gKDEgKyBrKSAqIDAuNSAqIHRoaXMuX2xhc3RBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5WzJdICsgayAqIHRoaXMuX2NhbGN1bGF0ZWRBY2NlbGVyYXRpb25bMl07XG5cbiAgICAgIHRoaXMuX2xhc3RBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5WzBdID0gYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eVswXTtcbiAgICAgIHRoaXMuX2xhc3RBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5WzFdID0gYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eVsxXTtcbiAgICAgIHRoaXMuX2xhc3RBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5WzJdID0gYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eVsyXTtcblxuICAgICAgb3V0RXZlbnRbMF0gPSB0aGlzLl9jYWxjdWxhdGVkQWNjZWxlcmF0aW9uWzBdO1xuICAgICAgb3V0RXZlbnRbMV0gPSB0aGlzLl9jYWxjdWxhdGVkQWNjZWxlcmF0aW9uWzFdO1xuICAgICAgb3V0RXZlbnRbMl0gPSB0aGlzLl9jYWxjdWxhdGVkQWNjZWxlcmF0aW9uWzJdO1xuICAgIH1cblxuICAgIHRoaXMuYWNjZWxlcmF0aW9uLmVtaXQob3V0RXZlbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEVtaXRzIHRoZSBgcm90YXRpb25SYXRlYCB1bmlmaWVkIHZhbHVlcy5cbiAgICpcbiAgICogQHBhcmFtIHtEZXZpY2VNb3Rpb25FdmVudH0gZSAtIGAnZGV2aWNlbW90aW9uJ2AgZXZlbnQgdGhlIHZhbHVlcyBhcmUgY2FsY3VsYXRlZCBmcm9tLlxuICAgKi9cbiAgX2VtaXRSb3RhdGlvblJhdGVFdmVudChlKSB7XG4gICAgbGV0IG91dEV2ZW50ID0gdGhpcy5yb3RhdGlvblJhdGUuZXZlbnQ7XG5cbiAgICBvdXRFdmVudFswXSA9IGUucm90YXRpb25SYXRlLmFscGhhO1xuICAgIG91dEV2ZW50WzFdID0gZS5yb3RhdGlvblJhdGUuYmV0YTtcbiAgICBvdXRFdmVudFsyXSA9IGUucm90YXRpb25SYXRlLmdhbW1hO1xuXG4gICAgLy8gVE9ETyg/KTogdW5pZnlcblxuICAgIHRoaXMucm90YXRpb25SYXRlLmVtaXQob3V0RXZlbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgYW5kIGVtaXRzIHRoZSBgcm90YXRpb25SYXRlYCB1bmlmaWVkIHZhbHVlcyBmcm9tIHRoZSBgb3JpZW50YXRpb25gIHZhbHVlcy5cbiAgICpcbiAgICogQHBhcmFtIHtudW1iZXJbXX0gb3JpZW50YXRpb24gLSBMYXRlc3QgYG9yaWVudGF0aW9uYCByYXcgdmFsdWVzLlxuICAgKi9cbiAgX2NhbGN1bGF0ZVJvdGF0aW9uUmF0ZUZyb21PcmllbnRhdGlvbihvcmllbnRhdGlvbikge1xuICAgIGNvbnN0IG5vdyA9IGdldExvY2FsVGltZSgpO1xuICAgIGNvbnN0IGsgPSAwLjg7IC8vIFRPRE86IGltcHJvdmUgbG93IHBhc3MgZmlsdGVyIChmcmFtZXMgYXJlIG5vdCByZWd1bGFyKVxuICAgIGNvbnN0IGFscGhhSXNWYWxpZCA9ICh0eXBlb2Ygb3JpZW50YXRpb25bMF0gPT09ICdudW1iZXInKTtcblxuICAgIGlmICh0aGlzLl9sYXN0T3JpZW50YXRpb25UaW1lc3RhbXApIHtcbiAgICAgIGxldCByQWxwaGEgPSBudWxsO1xuICAgICAgbGV0IHJCZXRhO1xuICAgICAgbGV0IHJHYW1tYTtcblxuICAgICAgbGV0IGFscGhhRGlzY29udGludWl0eUZhY3RvciA9IDA7XG4gICAgICBsZXQgYmV0YURpc2NvbnRpbnVpdHlGYWN0b3IgPSAwO1xuICAgICAgbGV0IGdhbW1hRGlzY29udGludWl0eUZhY3RvciA9IDA7XG5cbiAgICAgIGNvbnN0IGRlbHRhVCA9IG5vdyAtIHRoaXMuX2xhc3RPcmllbnRhdGlvblRpbWVzdGFtcDtcblxuICAgICAgaWYgKGFscGhhSXNWYWxpZCkge1xuICAgICAgICAvLyBhbHBoYSBkaXNjb250aW51aXR5ICgrMzYwIC0+IDAgb3IgMCAtPiArMzYwKVxuICAgICAgICBpZiAodGhpcy5fbGFzdE9yaWVudGF0aW9uWzBdID4gMzIwICYmIG9yaWVudGF0aW9uWzBdIDwgNDApXG4gICAgICAgICAgYWxwaGFEaXNjb250aW51aXR5RmFjdG9yID0gMzYwO1xuICAgICAgICBlbHNlIGlmICh0aGlzLl9sYXN0T3JpZW50YXRpb25bMF0gPCA0MCAmJiBvcmllbnRhdGlvblswXSA+IDMyMClcbiAgICAgICAgICBhbHBoYURpc2NvbnRpbnVpdHlGYWN0b3IgPSAtMzYwO1xuICAgICAgfVxuXG4gICAgICAvLyBiZXRhIGRpc2NvbnRpbnVpdHkgKCsxODAgLT4gLTE4MCBvciAtMTgwIC0+ICsxODApXG4gICAgICBpZiAodGhpcy5fbGFzdE9yaWVudGF0aW9uWzFdID4gMTQwICYmIG9yaWVudGF0aW9uWzFdIDwgLTE0MClcbiAgICAgICAgYmV0YURpc2NvbnRpbnVpdHlGYWN0b3IgPSAzNjA7XG4gICAgICBlbHNlIGlmICh0aGlzLl9sYXN0T3JpZW50YXRpb25bMV0gPCAtMTQwICYmIG9yaWVudGF0aW9uWzFdID4gMTQwKVxuICAgICAgICBiZXRhRGlzY29udGludWl0eUZhY3RvciA9IC0zNjA7XG5cbiAgICAgIC8vIGdhbW1hIGRpc2NvbnRpbnVpdGllcyAoKzE4MCAtPiAtMTgwIG9yIC0xODAgLT4gKzE4MClcbiAgICAgIGlmICh0aGlzLl9sYXN0T3JpZW50YXRpb25bMl0gPiA1MCAmJiBvcmllbnRhdGlvblsyXSA8IC01MClcbiAgICAgICAgZ2FtbWFEaXNjb250aW51aXR5RmFjdG9yID0gMTgwO1xuICAgICAgZWxzZSBpZiAodGhpcy5fbGFzdE9yaWVudGF0aW9uWzJdIDwgLTUwICYmIG9yaWVudGF0aW9uWzJdID4gNTApXG4gICAgICAgIGdhbW1hRGlzY29udGludWl0eUZhY3RvciA9IC0xODA7XG5cbiAgICAgIGlmIChkZWx0YVQgPiAwKSB7XG4gICAgICAgIC8vIExvdyBwYXNzIGZpbHRlciB0byBzbW9vdGggdGhlIGRhdGFcbiAgICAgICAgaWYgKGFscGhhSXNWYWxpZClcbiAgICAgICAgICByQWxwaGEgPSBrICogdGhpcy5fY2FsY3VsYXRlZFJvdGF0aW9uUmF0ZVswXSArICgxIC0gaykgKiAob3JpZW50YXRpb25bMF0gLSB0aGlzLl9sYXN0T3JpZW50YXRpb25bMF0gKyBhbHBoYURpc2NvbnRpbnVpdHlGYWN0b3IpIC8gZGVsdGFUO1xuICAgICAgICByQmV0YSA9IGsgKiB0aGlzLl9jYWxjdWxhdGVkUm90YXRpb25SYXRlWzFdICsgKDEgLSBrKSAqIChvcmllbnRhdGlvblsxXSAtIHRoaXMuX2xhc3RPcmllbnRhdGlvblsxXSArIGJldGFEaXNjb250aW51aXR5RmFjdG9yKSAvIGRlbHRhVDtcbiAgICAgICAgckdhbW1hID0gayAqIHRoaXMuX2NhbGN1bGF0ZWRSb3RhdGlvblJhdGVbMl0gKyAoMSAtIGspICogKG9yaWVudGF0aW9uWzJdIC0gdGhpcy5fbGFzdE9yaWVudGF0aW9uWzJdICsgZ2FtbWFEaXNjb250aW51aXR5RmFjdG9yKSAvIGRlbHRhVDtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVkUm90YXRpb25SYXRlWzBdID0gckFscGhhO1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVkUm90YXRpb25SYXRlWzFdID0gckJldGE7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZWRSb3RhdGlvblJhdGVbMl0gPSByR2FtbWE7XG4gICAgICB9XG5cbiAgICAgIC8vIFRPRE86IHJlc2FtcGxlIHRoZSBlbWlzc2lvbiByYXRlIHRvIG1hdGNoIHRoZSBkZXZpY2Vtb3Rpb24gcmF0ZVxuICAgICAgdGhpcy5yb3RhdGlvblJhdGUuZW1pdCh0aGlzLl9jYWxjdWxhdGVkUm90YXRpb25SYXRlKTtcbiAgICB9XG5cbiAgICB0aGlzLl9sYXN0T3JpZW50YXRpb25UaW1lc3RhbXAgPSBub3c7XG4gICAgdGhpcy5fbGFzdE9yaWVudGF0aW9uWzBdID0gb3JpZW50YXRpb25bMF07XG4gICAgdGhpcy5fbGFzdE9yaWVudGF0aW9uWzFdID0gb3JpZW50YXRpb25bMV07XG4gICAgdGhpcy5fbGFzdE9yaWVudGF0aW9uWzJdID0gb3JpZW50YXRpb25bMl07XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHJvdGF0aW9uIHJhdGUgY2FuIGJlIGNhbGN1bGF0ZWQgZnJvbSB0aGUgYG9yaWVudGF0aW9uYCB2YWx1ZXMgb3Igbm90LlxuICAgKi9cbiAgX3RyeU9yaWVudGF0aW9uRmFsbGJhY2soKSB7XG4gICAgTW90aW9uSW5wdXQucmVxdWlyZU1vZHVsZSgnb3JpZW50YXRpb24nKVxuICAgICAgLnRoZW4oKG9yaWVudGF0aW9uKSA9PiB7XG4gICAgICAgIGlmIChvcmllbnRhdGlvbi5pc1ZhbGlkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJXQVJOSU5HIChtb3Rpb24taW5wdXQpOiBUaGUgJ2RldmljZW1vdGlvbicgZXZlbnQgZG9lcyBub3QgZXhpc3RzIG9yIGRvZXMgbm90IHByb3ZpZGUgcm90YXRpb24gcmF0ZSB2YWx1ZXMgaW4geW91ciBicm93c2VyLCBzbyB0aGUgcm90YXRpb24gcmF0ZSBvZiB0aGUgZGV2aWNlIGlzIGVzdGltYXRlZCBmcm9tIHRoZSAnb3JpZW50YXRpb24nLCBjYWxjdWxhdGVkIGZyb20gdGhlICdkZXZpY2VvcmllbnRhdGlvbicgZXZlbnQuIFNpbmNlIHRoZSBjb21wYXNzIG1pZ2h0IG5vdCBiZSBhdmFpbGFibGUsIG9ubHkgYGJldGFgIGFuZCBgZ2FtbWFgIGFuZ2xlcyBtYXkgYmUgcHJvdmlkZWQgKGBhbHBoYWAgd291bGQgYmUgbnVsbCkuXCIpO1xuXG4gICAgICAgICAgdGhpcy5yb3RhdGlvblJhdGUuaXNDYWxjdWxhdGVkID0gdHJ1ZTtcblxuICAgICAgICAgIE1vdGlvbklucHV0LmFkZExpc3RlbmVyKCdvcmllbnRhdGlvbicsIChvcmllbnRhdGlvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlUm90YXRpb25SYXRlRnJvbU9yaWVudGF0aW9uKG9yaWVudGF0aW9uKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Byb21pc2VSZXNvbHZlKHRoaXMpO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSW5jcmVhc2VzIHRoZSBudW1iZXIgb2YgbGlzdGVuZXJzIHRvIHRoaXMgbW9kdWxlIChlaXRoZXIgYmVjYXVzZSBzb21lb25lIGxpc3RlbnNcbiAgICogdG8gdGhpcyBtb2R1bGUsIG9yIG9uZSBvZiB0aGUgdGhyZWUgYERPTUV2ZW50U3VibW9kdWxlc2BcbiAgICogKGBBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5YCwgYEFjY2VsZXJhdGlvbmAsIGBSb3RhdGlvblJhdGVgKS5cbiAgICogV2hlbiB0aGUgbnVtYmVyIG9mIGxpc3RlbmVycyByZWFjaGVzIGAxYCwgYWRkcyBhIGAnZGV2aWNlbW90aW9uJ2AgZXZlbnQgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBzZWUgRGV2aWNlTW90aW9uTW9kdWxlI2FkZExpc3RlbmVyXG4gICAqIEBzZWUgRE9NRXZlbnRTdWJtb2R1bGUjc3RhcnRcbiAgICovXG4gIF9hZGRMaXN0ZW5lcigpIHtcbiAgICB0aGlzLl9udW1MaXN0ZW5lcnMrKztcblxuICAgIGlmICh0aGlzLl9udW1MaXN0ZW5lcnMgPT09IDEpXG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZGV2aWNlbW90aW9uJywgdGhpcy5fZGV2aWNlbW90aW9uTGlzdGVuZXIsIGZhbHNlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNyZWFzZXMgdGhlIG51bWJlciBvZiBsaXN0ZW5lcnMgdG8gdGhpcyBtb2R1bGUgKGVpdGhlciBiZWNhdXNlIHNvbWVvbmUgc3RvcHNcbiAgICogbGlzdGVuaW5nIHRvIHRoaXMgbW9kdWxlLCBvciBvbmUgb2YgdGhlIHRocmVlIGBET01FdmVudFN1Ym1vZHVsZXNgXG4gICAqIChgQWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAsIGBBY2NlbGVyYXRpb25gLCBgUm90YXRpb25SYXRlYCkuXG4gICAqIFdoZW4gdGhlIG51bWJlciBvZiBsaXN0ZW5lcnMgcmVhY2hlcyBgMGAsIHJlbW92ZXMgdGhlIGAnZGV2aWNlbW90aW9uJ2AgZXZlbnQgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBzZWUgRGV2aWNlTW90aW9uTW9kdWxlI3JlbW92ZUxpc3RlbmVyXG4gICAqIEBzZWUgRE9NRXZlbnRTdWJtb2R1bGUjc3RvcFxuICAgKi9cbiAgX3JlbW92ZUxpc3RlbmVyKCkge1xuICAgIHRoaXMuX251bUxpc3RlbmVycy0tO1xuXG4gICAgaWYgKHRoaXMuX251bUxpc3RlbmVycyA9PT0gMClcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdkZXZpY2Vtb3Rpb24nLCB0aGlzLl9kZXZpY2Vtb3Rpb25MaXN0ZW5lciwgZmFsc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemVzIG9mIHRoZSBtb2R1bGUuXG4gICAqXG4gICAqIEByZXR1cm4ge3Byb21pc2V9XG4gICAqL1xuICBpbml0KCkge1xuICAgIHJldHVybiBzdXBlci5pbml0KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLl9wcm9taXNlUmVzb2x2ZSA9IHJlc29sdmU7XG5cbiAgICAgIGlmICh3aW5kb3cuRGV2aWNlTW90aW9uRXZlbnQpXG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2Vtb3Rpb24nLCB0aGlzLl9kZXZpY2Vtb3Rpb25DaGVjaywgZmFsc2UpO1xuXG4gICAgICAvLyBXQVJOSU5HXG4gICAgICAvLyBUaGUgbGluZXMgb2YgY29kZSBiZWxvdyBhcmUgY29tbWVudGVkIGJlY2F1c2Ugb2YgYSBidWcgb2YgQ2hyb21lXG4gICAgICAvLyBvbiBzb21lIEFuZHJvaWQgZGV2aWNlcywgd2hlcmUgJ2RldmljZW1vdGlvbicgZXZlbnRzIGFyZSBub3Qgc2VudFxuICAgICAgLy8gb3IgY2F1Z2h0IGlmIHRoZSBsaXN0ZW5lciBpcyBzZXQgdXAgYWZ0ZXIgYSAnZGV2aWNlb3JpZW50YXRpb24nXG4gICAgICAvLyBsaXN0ZW5lci4gSGVyZSwgdGhlIF90cnlPcmllbnRhdGlvbkZhbGxiYWNrIG1ldGhvZCB3b3VsZCBhZGQgYVxuICAgICAgLy8gJ2RldmljZW9yaWVudGF0aW9uJyBsaXN0ZW5lciBhbmQgYmxvY2sgYWxsIHN1YnNlcXVlbnQgJ2RldmljZW1vdGlvbidcbiAgICAgIC8vIGV2ZW50cyBvbiB0aGVzZSBkZXZpY2VzLiBDb21tZW50cyB3aWxsIGJlIHJlbW92ZWQgb25jZSB0aGUgYnVnIG9mXG4gICAgICAvLyBDaHJvbWUgaXMgY29ycmVjdGVkLlxuXG4gICAgICAvLyBlbHNlIGlmICh0aGlzLnJlcXVpcmVkLnJvdGF0aW9uUmF0ZSlcbiAgICAgIC8vIHRoaXMuX3RyeU9yaWVudGF0aW9uRmFsbGJhY2soKTtcblxuICAgICAgZWxzZVxuICAgICAgICByZXNvbHZlKHRoaXMpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBsaXN0ZW5lciB0byB0aGlzIG1vZHVsZS5cbiAgICogXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gTGlzdGVuZXIgdG8gYWRkLlxuICAgKi9cbiAgYWRkTGlzdGVuZXIobGlzdGVuZXIpIHtcbiAgICBzdXBlci5hZGRMaXN0ZW5lcihsaXN0ZW5lcik7XG4gICAgdGhpcy5fYWRkTGlzdGVuZXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgbGlzdGVuZXIgZnJvbSB0aGlzIG1vZHVsZS5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlzdGVuZXIgLSBMaXN0ZW5lciB0byByZW1vdmUuXG4gICAqL1xuICByZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcikge1xuICAgIHN1cGVyLnJlbW92ZUxpc3RlbmVyKGxpc3RlbmVyKTtcbiAgICB0aGlzLl9yZW1vdmVMaXN0ZW5lcigpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IERldmljZU1vdGlvbk1vZHVsZSgpOyIsIi8qKlxuICogQGZpbGVvdmVydmlldyBgRGV2aWNlT3JpZW50YXRpb25gIG1vZHVsZVxuICogQGF1dGhvciA8YSBocmVmPSdtYWlsdG86c2ViYXN0aWVuQHJvYmFzemtpZXdpY3ouY29tJz5Tw6liYXN0aWVuIFJvYmFzemtpZXdpY3o8L2E+LCA8YSBocmVmPSdtYWlsdG86Tm9yYmVydC5TY2huZWxsQGlyY2FtLmZyJz5Ob3JiZXJ0IFNjaG5lbGw8L2E+XG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBET01FdmVudFN1Ym1vZHVsZSA9IHJlcXVpcmUoJy4vRE9NRXZlbnRTdWJtb2R1bGUnKTtcbmNvbnN0IElucHV0TW9kdWxlID0gcmVxdWlyZSgnLi9JbnB1dE1vZHVsZScpO1xuY29uc3QgTW90aW9uSW5wdXQgPSByZXF1aXJlKCcuL01vdGlvbklucHV0Jyk7XG5jb25zdCBwbGF0Zm9ybSA9IHJlcXVpcmUoJ3BsYXRmb3JtJyk7XG5cbi8qKlxuICogQ29udmVydHMgZGVncmVlcyB0byByYWRpYW5zLlxuICogXG4gKiBAcGFyYW0ge251bWJlcn0gZGVnIC0gQW5nbGUgaW4gZGVncmVlcy5cbiAqIEByZXR1cm4ge251bWJlcn1cbiAqL1xuZnVuY3Rpb24gZGVnVG9SYWQoZGVnKSB7XG4gIHJldHVybiBkZWcgKiBNYXRoLlBJIC8gMTgwO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIHJhZGlhbnMgdG8gZGVncmVlcy5cbiAqIFxuICogQHBhcmFtIHtudW1iZXJ9IHJhZCAtIEFuZ2xlIGluIHJhZGlhbnMuXG4gKiBAcmV0dXJuIHtudW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIHJhZFRvRGVnKHJhZCkge1xuICByZXR1cm4gcmFkICogMTgwIC8gTWF0aC5QSTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemVzIGEgMyB4IDMgbWF0cml4LlxuICogXG4gKiBAcGFyYW0ge251bWJlcltdfSBtIC0gTWF0cml4IHRvIG5vcm1hbGl6ZSwgcmVwcmVzZW50ZWQgYnkgYW4gYXJyYXkgb2YgbGVuZ3RoIDkuXG4gKiBAcmV0dXJuIHtudW1iZXJbXX1cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplKG0pIHtcbiAgY29uc3QgZGV0ID0gbVswXSAqIG1bNF0gKiBtWzhdICsgbVsxXSAqIG1bNV0gKiBtWzZdICsgbVsyXSAqIG1bM10gKiBtWzddIC0gbVswXSAqIG1bNV0gKiBtWzddIC0gbVsxXSAqIG1bM10gKiBtWzhdIC0gbVsyXSAqIG1bNF0gKiBtWzZdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbS5sZW5ndGg7IGkrKylcbiAgICBtW2ldIC89IGRldDtcblxuICByZXR1cm4gbTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIEV1bGVyIGFuZ2xlIGBbYWxwaGEsIGJldGEsIGdhbW1hXWAgdG8gdGhlIFczQyBzcGVjaWZpY2F0aW9uLCB3aGVyZTpcbiAqIC0gYGFscGhhYCBpcyBpbiBbMDsgKzM2MFs7XG4gKiAtIGBiZXRhYCBpcyBpbiBbLTE4MDsgKzE4MFs7XG4gKiAtIGBnYW1tYWAgaXMgaW4gWy05MDsgKzkwWy5cbiAqIFxuICogQHBhcmFtIHtudW1iZXJbXX0gZXVsZXJBbmdsZSAtIEV1bGVyIGFuZ2xlIHRvIHVuaWZ5LCByZXByZXNlbnRlZCBieSBhbiBhcnJheSBvZiBsZW5ndGggMyAoYFthbHBoYSwgYmV0YSwgZ2FtbWFdYCkuXG4gKiBAc2VlIHtAbGluayBodHRwOi8vd3d3LnczLm9yZy9UUi9vcmllbnRhdGlvbi1ldmVudC99XG4gKi9cbmZ1bmN0aW9uIHVuaWZ5KGV1bGVyQW5nbGUpIHtcbiAgLy8gQ2YuIFczQyBzcGVjaWZpY2F0aW9uIChodHRwOi8vdzNjLmdpdGh1Yi5pby9kZXZpY2VvcmllbnRhdGlvbi9zcGVjLXNvdXJjZS1vcmllbnRhdGlvbi5odG1sKVxuICAvLyBhbmQgRXVsZXIgYW5nbGVzIFdpa2lwZWRpYSBwYWdlIChodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0V1bGVyX2FuZ2xlcykuXG4gIC8vXG4gIC8vIFczQyBjb252ZW50aW9uOiBUYWl04oCTQnJ5YW4gYW5nbGVzIFotWCctWScnLCB3aGVyZTpcbiAgLy8gICBhbHBoYSBpcyBpbiBbMDsgKzM2MFssXG4gIC8vICAgYmV0YSBpcyBpbiBbLTE4MDsgKzE4MFssXG4gIC8vICAgZ2FtbWEgaXMgaW4gWy05MDsgKzkwWy5cblxuICBjb25zdCBhbHBoYUlzVmFsaWQgPSAodHlwZW9mIGV1bGVyQW5nbGVbMF0gPT09ICdudW1iZXInKTtcblxuICBjb25zdCBfYWxwaGEgPSAoYWxwaGFJc1ZhbGlkID8gZGVnVG9SYWQoZXVsZXJBbmdsZVswXSkgOiAwKTtcbiAgY29uc3QgX2JldGEgPSBkZWdUb1JhZChldWxlckFuZ2xlWzFdKTtcbiAgY29uc3QgX2dhbW1hID0gZGVnVG9SYWQoZXVsZXJBbmdsZVsyXSk7XG5cbiAgY29uc3QgY0EgPSBNYXRoLmNvcyhfYWxwaGEpO1xuICBjb25zdCBjQiA9IE1hdGguY29zKF9iZXRhKTtcbiAgY29uc3QgY0cgPSBNYXRoLmNvcyhfZ2FtbWEpO1xuICBjb25zdCBzQSA9IE1hdGguc2luKF9hbHBoYSk7XG4gIGNvbnN0IHNCID0gTWF0aC5zaW4oX2JldGEpO1xuICBjb25zdCBzRyA9IE1hdGguc2luKF9nYW1tYSk7XG5cbiAgbGV0IGFscGhhLCBiZXRhLCBnYW1tYTtcblxuICBsZXQgbSA9IFtcbiAgICBjQSAqIGNHIC0gc0EgKiBzQiAqIHNHLFxuICAgIC1jQiAqIHNBLFxuICAgIGNBICogc0cgKyBjRyAqIHNBICogc0IsXG4gICAgY0cgKiBzQSArIGNBICogc0IgKiBzRyxcbiAgICBjQSAqIGNCLFxuICAgIHNBICogc0cgLSBjQSAqIGNHICogc0IsXG4gICAgLWNCICogc0csXG4gICAgc0IsXG4gICAgY0IgKiBjR1xuICBdO1xuICBub3JtYWxpemUobSk7XG5cbiAgLy8gU2luY2Ugd2Ugd2FudCBnYW1tYSBpbiBbLTkwOyArOTBbLCBjRyA+PSAwLlxuICBpZiAobVs4XSA+IDApIHtcbiAgICAvLyBDYXNlIDE6IG1bOF0gPiAwIDw9PiBjQiA+IDAgICAgICAgICAgICAgICAgIChhbmQgY0cgIT0gMClcbiAgICAvLyAgICAgICAgICAgICAgICAgIDw9PiBiZXRhIGluIF0tcGkvMjsgK3BpLzJbIChhbmQgY0cgIT0gMClcbiAgICBhbHBoYSA9IE1hdGguYXRhbjIoLW1bMV0sIG1bNF0pO1xuICAgIGJldGEgPSBNYXRoLmFzaW4obVs3XSk7IC8vIGFzaW4gcmV0dXJucyBhIG51bWJlciBiZXR3ZWVuIC1waS8yIGFuZCArcGkvMiA9PiBPS1xuICAgIGdhbW1hID0gTWF0aC5hdGFuMigtbVs2XSwgbVs4XSk7XG4gIH0gZWxzZSBpZiAobVs4XSA8IDApIHtcbiAgICAvLyBDYXNlIDI6IG1bOF0gPCAwIDw9PiBjQiA8IDAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGFuZCBjRyAhPSAwKVxuICAgIC8vICAgICAgICAgICAgICAgICAgPD0+IGJldGEgaW4gWy1waTsgLXBpLzJbIFUgXStwaS8yOyArcGldIChhbmQgY0cgIT0gMClcblxuICAgIC8vIFNpbmNlIGNCIDwgMCBhbmQgY0IgaXMgaW4gbVsxXSBhbmQgbVs0XSwgdGhlIHBvaW50IGlzIGZsaXBwZWQgYnkgMTgwIGRlZ3JlZXMuXG4gICAgLy8gSGVuY2UsIHdlIGhhdmUgdG8gbXVsdGlwbHkgYm90aCBhcmd1bWVudHMgb2YgYXRhbjIgYnkgLTEgaW4gb3JkZXIgdG8gcmV2ZXJ0XG4gICAgLy8gdGhlIHBvaW50IGluIGl0cyBvcmlnaW5hbCBwb3NpdGlvbiAoPT4gYW5vdGhlciBmbGlwIGJ5IDE4MCBkZWdyZWVzKS5cbiAgICBhbHBoYSA9IE1hdGguYXRhbjIobVsxXSwgLW1bNF0pO1xuICAgIGJldGEgPSAtTWF0aC5hc2luKG1bN10pO1xuICAgIGJldGEgKz0gKGJldGEgPj0gMCkgPyAtTWF0aC5QSSA6IE1hdGguUEk7IC8vIGFzaW4gcmV0dXJucyBhIG51bWJlciBiZXR3ZWVuIC1waS8yIGFuZCBwaS8yID0+IG1ha2Ugc3VyZSBiZXRhIGluIFstcGk7IC1waS8yWyBVIF0rcGkvMjsgK3BpXVxuICAgIGdhbW1hID0gTWF0aC5hdGFuMihtWzZdLCAtbVs4XSk7IC8vIHNhbWUgcmVtYXJrIGFzIGZvciBhbHBoYSwgbXVsdGlwbGljYXRpb24gYnkgLTFcbiAgfSBlbHNlIHtcbiAgICAvLyBDYXNlIDM6IG1bOF0gPSAwIDw9PiBjQiA9IDAgb3IgY0cgPSAwXG4gICAgaWYgKG1bNl0gPiAwKSB7XG4gICAgICAvLyBTdWJjYXNlIDE6IGNHID0gMCBhbmQgY0IgPiAwXG4gICAgICAvLyAgICAgICAgICAgIGNHID0gMCA8PT4gc0cgPSAtMSA8PT4gZ2FtbWEgPSAtcGkvMiA9PiBtWzZdID0gY0JcbiAgICAgIC8vICAgICAgICAgICAgSGVuY2UsIG1bNl0gPiAwIDw9PiBjQiA+IDAgPD0+IGJldGEgaW4gXS1waS8yOyArcGkvMltcbiAgICAgIGFscGhhID0gTWF0aC5hdGFuMigtbVsxXSwgbVs0XSk7XG4gICAgICBiZXRhID0gTWF0aC5hc2luKG1bN10pOyAvLyBhc2luIHJldHVybnMgYSBudW1iZXIgYmV0d2VlbiAtcGkvMiBhbmQgK3BpLzIgPT4gT0tcbiAgICAgIGdhbW1hID0gLU1hdGguUEkgLyAyO1xuICAgIH0gZWxzZSBpZiAobVs2XSA8IDApIHtcbiAgICAgIC8vIFN1YmNhc2UgMjogY0cgPSAwIGFuZCBjQiA8IDBcbiAgICAgIC8vICAgICAgICAgICAgY0cgPSAwIDw9PiBzRyA9IC0xIDw9PiBnYW1tYSA9IC1waS8yID0+IG1bNl0gPSBjQlxuICAgICAgLy8gICAgICAgICAgICBIZW5jZSwgbVs2XSA8IDAgPD0+IGNCIDwgMCA8PT4gYmV0YSBpbiBbLXBpOyAtcGkvMlsgVSBdK3BpLzI7ICtwaV1cbiAgICAgIGFscGhhID0gTWF0aC5hdGFuMihtWzFdLCAtbVs0XSk7IC8vIHNhbWUgcmVtYXJrIGFzIGZvciBhbHBoYSBpbiBhIGNhc2UgYWJvdmVcbiAgICAgIGJldGEgPSAtTWF0aC5hc2luKG1bN10pO1xuICAgICAgYmV0YSArPSAoYmV0YSA+PSAwKSA/IC1NYXRoLlBJIDogTWF0aC5QSTsgLy8gYXNpbiByZXR1cm5zIGEgbnVtYmVyIGJldHdlZW4gLXBpLzIgYW5kICtwaS8yID0+IG1ha2Ugc3VyZSBiZXRhIGluIFstcGk7IC1waS8yWyBVIF0rcGkvMjsgK3BpXVxuICAgICAgZ2FtbWEgPSAtTWF0aC5QSSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN1YmNhc2UgMzogY0IgPSAwXG4gICAgICAvLyBJbiB0aGUgY2FzZSB3aGVyZSBjb3MoYmV0YSkgPSAwIChpLmUuIGJldGEgPSAtcGkvMiBvciBiZXRhID0gcGkvMiksXG4gICAgICAvLyB3ZSBoYXZlIHRoZSBnaW1iYWwgbG9jayBwcm9ibGVtOiBpbiB0aGF0IGNvbmZpZ3VyYXRpb24sIG9ubHkgdGhlIGFuZ2xlXG4gICAgICAvLyBhbHBoYSArIGdhbW1hIChpZiBiZXRhID0gK3BpLzIpIG9yIGFscGhhIC0gZ2FtbWEgKGlmIGJldGEgPSAtcGkvMilcbiAgICAgIC8vIGFyZSB1bmlxdWVseSBkZWZpbmVkOiBhbHBoYSBhbmQgZ2FtbWEgY2FuIHRha2UgYW4gaW5maW5pdHkgb2YgdmFsdWVzLlxuICAgICAgLy8gRm9yIGNvbnZlbmllbmNlLCBsZXQncyBzZXQgZ2FtbWEgPSAwIChhbmQgdGh1cyBzaW4oZ2FtbWEpID0gMCkuXG4gICAgICAvLyAoQXMgYSBjb25zZXF1ZW5jZSBvZiB0aGUgZ2ltYmFsIGxvY2sgcHJvYmxlbSwgdGhlcmUgaXMgYSBkaXNjb250aW51aXR5XG4gICAgICAvLyBpbiBhbHBoYSBhbmQgZ2FtbWEuKVxuICAgICAgYWxwaGEgPSBNYXRoLmF0YW4yKG1bM10sIG1bMF0pO1xuICAgICAgYmV0YSA9IChtWzddID4gMCkgPyBNYXRoLlBJIC8gMiA6IC1NYXRoLlBJIC8gMjtcbiAgICAgIGdhbW1hID0gMDtcbiAgICB9XG4gIH1cblxuICAvLyBhdGFuMiByZXR1cm5zIGEgbnVtYmVyIGJldHdlZW4gLXBpIGFuZCBwaSA9PiBtYWtlIHN1cmUgdGhhdCBhbHBoYSBpcyBpbiBbMCwgMipwaVsuXG4gIGFscGhhICs9IChhbHBoYSA8IDApID8gMiAqIE1hdGguUEkgOiAwO1xuXG4gIGV1bGVyQW5nbGVbMF0gPSAoYWxwaGFJc1ZhbGlkID8gcmFkVG9EZWcoYWxwaGEpIDogbnVsbCk7XG4gIGV1bGVyQW5nbGVbMV0gPSByYWRUb0RlZyhiZXRhKTtcbiAgZXVsZXJBbmdsZVsyXSA9IHJhZFRvRGVnKGdhbW1hKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIEV1bGVyIGFuZ2xlIGBbYWxwaGEsIGJldGEsIGdhbW1hXWAgdG8gYSBFdWxlciBhbmdsZSB3aGVyZTpcbiAqIC0gYGFscGhhYCBpcyBpbiBbMDsgKzM2MFs7XG4gKiAtIGBiZXRhYCBpcyBpbiBbLTkwOyArOTBbO1xuICogLSBgZ2FtbWFgIGlzIGluIFstMTgwOyArMTgwWy5cbiAqIFxuICogQHBhcmFtIHtudW1iZXJbXX0gZXVsZXJBbmdsZSAtIEV1bGVyIGFuZ2xlIHRvIGNvbnZlcnQsIHJlcHJlc2VudGVkIGJ5IGFuIGFycmF5IG9mIGxlbmd0aCAzIChgW2FscGhhLCBiZXRhLCBnYW1tYV1gKS5cbiAqL1xuZnVuY3Rpb24gdW5pZnlBbHQoZXVsZXJBbmdsZSkge1xuICAvLyBDb252ZW50aW9uIGhlcmU6IFRhaXTigJNCcnlhbiBhbmdsZXMgWi1YJy1ZJycsIHdoZXJlOlxuICAvLyAgIGFscGhhIGlzIGluIFswOyArMzYwWyxcbiAgLy8gICBiZXRhIGlzIGluIFstOTA7ICs5MFssXG4gIC8vICAgZ2FtbWEgaXMgaW4gWy0xODA7ICsxODBbLlxuXG4gIGNvbnN0IGFscGhhSXNWYWxpZCA9ICh0eXBlb2YgZXVsZXJBbmdsZVswXSA9PT0gJ251bWJlcicpO1xuXG4gIGNvbnN0IF9hbHBoYSA9IChhbHBoYUlzVmFsaWQgPyBkZWdUb1JhZChldWxlckFuZ2xlWzBdKSA6IDApO1xuICBjb25zdCBfYmV0YSA9IGRlZ1RvUmFkKGV1bGVyQW5nbGVbMV0pO1xuICBjb25zdCBfZ2FtbWEgPSBkZWdUb1JhZChldWxlckFuZ2xlWzJdKTtcblxuICBjb25zdCBjQSA9IE1hdGguY29zKF9hbHBoYSk7XG4gIGNvbnN0IGNCID0gTWF0aC5jb3MoX2JldGEpO1xuICBjb25zdCBjRyA9IE1hdGguY29zKF9nYW1tYSk7XG4gIGNvbnN0IHNBID0gTWF0aC5zaW4oX2FscGhhKTtcbiAgY29uc3Qgc0IgPSBNYXRoLnNpbihfYmV0YSk7XG4gIGNvbnN0IHNHID0gTWF0aC5zaW4oX2dhbW1hKTtcblxuICBsZXQgYWxwaGEsIGJldGEsIGdhbW1hO1xuXG4gIGxldCBtID0gW1xuICAgIGNBICogY0cgLSBzQSAqIHNCICogc0csXG4gICAgLWNCICogc0EsXG4gICAgY0EgKiBzRyArIGNHICogc0EgKiBzQixcbiAgICBjRyAqIHNBICsgY0EgKiBzQiAqIHNHLFxuICAgIGNBICogY0IsXG4gICAgc0EgKiBzRyAtIGNBICogY0cgKiBzQixcbiAgICAtY0IgKiBzRyxcbiAgICBzQixcbiAgICBjQiAqIGNHXG4gIF07XG4gIG5vcm1hbGl6ZShtKTtcblxuICBhbHBoYSA9IE1hdGguYXRhbjIoLW1bMV0sIG1bNF0pO1xuICBhbHBoYSArPSAoYWxwaGEgPCAwKSA/IDIgKiBNYXRoLlBJIDogMDsgLy8gYXRhbjIgcmV0dXJucyBhIG51bWJlciBiZXR3ZWVuIC1waSBhbmQgK3BpID0+IG1ha2Ugc3VyZSBhbHBoYSBpcyBpbiBbMCwgMipwaVsuXG4gIGJldGEgPSBNYXRoLmFzaW4obVs3XSk7IC8vIGFzaW4gcmV0dXJucyBhIG51bWJlciBiZXR3ZWVuIC1waS8yIGFuZCBwaS8yID0+IE9LXG4gIGdhbW1hID0gTWF0aC5hdGFuMigtbVs2XSwgbVs4XSk7IC8vIGF0YW4yIHJldHVybnMgYSBudW1iZXIgYmV0d2VlbiAtcGkgYW5kICtwaSA9PiBPS1xuXG4gIGV1bGVyQW5nbGVbMF0gPSAoYWxwaGFJc1ZhbGlkID8gcmFkVG9EZWcoYWxwaGEpIDogbnVsbCk7XG4gIGV1bGVyQW5nbGVbMV0gPSByYWRUb0RlZyhiZXRhKTtcbiAgZXVsZXJBbmdsZVsyXSA9IHJhZFRvRGVnKGdhbW1hKTtcbn1cblxuLyoqXG4gKiBgRGV2aWNlT3JpZW50YXRpb25Nb2R1bGVgIHNpbmdsZXRvbi5cbiAqIFRoZSBgRGV2aWNlT3JpZW50YXRpb25Nb2R1bGVgIHNpbmdsZXRvbiBwcm92aWRlcyB0aGUgcmF3IHZhbHVlc1xuICogb2YgdGhlIG9yaWVudGF0aW9uIHByb3ZpZGVkIGJ5IHRoZSBgRGV2aWNlTW90aW9uYCBldmVudC5cbiAqIEl0IGFsc28gaW5zdGFudGlhdGUgdGhlIGBPcmllbnRhdGlvbmAgc3VibW9kdWxlIHRoYXQgdW5pZmllcyB0aG9zZVxuICogdmFsdWVzIGFjcm9zcyBwbGF0Zm9ybXMgYnkgbWFraW5nIHRoZW0gY29tcGxpYW50IHdpdGgge0BsaW5rXG4gKiBodHRwOi8vd3d3LnczLm9yZy9UUi9vcmllbnRhdGlvbi1ldmVudC98dGhlIFczQyBzdGFuZGFyZH0gKCppLmUuKlxuICogdGhlIGBhbHBoYWAgYW5nbGUgYmV0d2VlbiBgMGAgYW5kIGAzNjBgIGRlZ3JlZXMsIHRoZSBgYmV0YWAgYW5nbGVcbiAqIGJldHdlZW4gYC0xODBgIGFuZCBgMTgwYCBkZWdyZWVzLCBhbmQgYGdhbW1hYCBiZXR3ZWVuIGAtOTBgIGFuZFxuICogYDkwYCBkZWdyZWVzKSwgYXMgd2VsbCBhcyB0aGUgYE9yaWVudGF0aW9uQWx0YCBzdWJtb2R1bGVzICh3aXRoXG4gKiB0aGUgYGFscGhhYCBhbmdsZSBiZXR3ZWVuIGAwYCBhbmQgYDM2MGAgZGVncmVlcywgdGhlIGBiZXRhYCBhbmdsZVxuICogYmV0d2VlbiBgLTkwYCBhbmQgYDkwYCBkZWdyZWVzLCBhbmQgYGdhbW1hYCBiZXR3ZWVuIGAtMTgwYCBhbmRcbiAqIGAxODBgIGRlZ3JlZXMpLlxuICogV2hlbiB0aGUgYG9yaWVudGF0aW9uYCByYXcgdmFsdWVzIGFyZSBub3QgcHJvdmlkZWQgYnkgdGhlIHNlbnNvcnMsXG4gKiB0aGlzIG1vZHVsZXMgdHJpZXMgdG8gcmVjYWxjdWxhdGUgYGJldGFgIGFuZCBgZ2FtbWFgIGZyb20gdGhlXG4gKiBgQWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAgbW9kdWxlLCBpZiBhdmFpbGFibGUgKGluIHRoYXQgY2FzZSxcbiAqIHRoZSBgYWxwaGFgIGFuZ2xlIGlzIGltcG9zc2libGUgdG8gcmV0cmlldmUgc2luY2UgdGhlIGNvbXBhc3MgaXNcbiAqIG5vdCBhdmFpbGFibGUpLlxuICpcbiAqIEBjbGFzcyBEZXZpY2VNb3Rpb25Nb2R1bGVcbiAqIEBleHRlbmRzIElucHV0TW9kdWxlXG4gKi9cbmNsYXNzIERldmljZU9yaWVudGF0aW9uTW9kdWxlIGV4dGVuZHMgSW5wdXRNb2R1bGUge1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIHRoZSBgRGV2aWNlT3JpZW50YXRpb25gIG1vZHVsZSBpbnN0YW5jZS5cbiAgICpcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcignZGV2aWNlb3JpZW50YXRpb24nKTtcblxuICAgIC8qKlxuICAgICAqIFJhdyB2YWx1ZXMgY29taW5nIGZyb20gdGhlIGBkZXZpY2VvcmllbnRhdGlvbmAgZXZlbnQgc2VudCBieSB0aGlzIG1vZHVsZS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU9yaWVudGF0aW9uTW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBkZWZhdWx0IFtudWxsLCBudWxsLCBudWxsXVxuICAgICAqL1xuICAgIHRoaXMuZXZlbnQgPSBbbnVsbCwgbnVsbCwgbnVsbF07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYE9yaWVudGF0aW9uYCBtb2R1bGUuXG4gICAgICogUHJvdmlkZXMgdW5pZmllZCB2YWx1ZXMgb2YgdGhlIG9yaWVudGF0aW9uIGNvbXBsaWFudCB3aXRoIHtAbGlua1xuICAgICAqIGh0dHA6Ly93d3cudzMub3JnL1RSL29yaWVudGF0aW9uLWV2ZW50L3x0aGUgVzNDIHN0YW5kYXJkfVxuICAgICAqIChgYWxwaGFgIGluIGBbMCwgMzYwXWAsIGJldGEgaW4gYFstMTgwLCArMTgwXWAsIGBnYW1tYWAgaW4gYFstOTAsICs5MF1gKS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU9yaWVudGF0aW9uTW9kdWxlXG4gICAgICogQHR5cGUge0RPTUV2ZW50U3VibW9kdWxlfVxuICAgICAqL1xuICAgIHRoaXMub3JpZW50YXRpb24gPSBuZXcgRE9NRXZlbnRTdWJtb2R1bGUodGhpcywgJ29yaWVudGF0aW9uJyk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYE9yaWVudGF0aW9uQWx0YCBtb2R1bGUuXG4gICAgICogUHJvdmlkZXMgYWx0ZXJuYXRpdmUgdmFsdWVzIG9mIHRoZSBvcmllbnRhdGlvblxuICAgICAqIChgYWxwaGFgIGluIGBbMCwgMzYwXWAsIGJldGEgaW4gYFstOTAsICs5MF1gLCBgZ2FtbWFgIGluIGBbLTE4MCwgKzE4MF1gKS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU9yaWVudGF0aW9uTW9kdWxlXG4gICAgICogQHR5cGUge0RPTUV2ZW50U3VibW9kdWxlfVxuICAgICAqL1xuICAgIHRoaXMub3JpZW50YXRpb25BbHQgPSBuZXcgRE9NRXZlbnRTdWJtb2R1bGUodGhpcywgJ29yaWVudGF0aW9uQWx0Jyk7XG5cbiAgICAvKipcbiAgICAgKiBSZXF1aXJlZCBzdWJtb2R1bGVzIC8gZXZlbnRzLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlT3JpZW50YXRpb25Nb2R1bGVcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbH0gb3JpZW50YXRpb24gLSBJbmRpY2F0ZXMgd2hldGhlciB0aGUgYG9yaWVudGF0aW9uYCB1bmlmaWVkIHZhbHVlcyBhcmUgcmVxdWlyZWQgb3Igbm90IChkZWZhdWx0cyB0byBgZmFsc2VgKS5cbiAgICAgKiBAcHJvcGVydHkge2Jvb2x9IG9yaWVudGF0aW9uQWx0IC0gSW5kaWNhdGVzIHdoZXRoZXIgdGhlIGBvcmllbnRhdGlvbkFsdGAgdmFsdWVzIGFyZSByZXF1aXJlZCBvciBub3QgKGRlZmF1bHRzIHRvIGBmYWxzZWApLlxuICAgICAqL1xuICAgIHRoaXMucmVxdWlyZWQgPSB7XG4gICAgICBvcmllbnRhdGlvbjogZmFsc2UsXG4gICAgICBvcmllbnRhdGlvbkFsdDogZmFsc2VcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIGxpc3RlbmVycyBzdWJzY3JpYmVkIHRvIHRoZSBgRGV2aWNlT3JpZW50YXRpb25gIG1vZHVsZS5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU9yaWVudGF0aW9uTW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLl9udW1MaXN0ZW5lcnMgPSAwO1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgZnVuY3Rpb24gb2YgdGhlIG1vZHVsZSdzIHByb21pc2UuXG4gICAgICpcbiAgICAgKiBAdGhpcyBEZXZpY2VPcmllbnRhdGlvbk1vZHVsZVxuICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgKiBAZGVmYXVsdCBudWxsXG4gICAgICogQHNlZSBEZXZpY2VPcmllbnRhdGlvbk1vZHVsZSNpbml0XG4gICAgICovXG4gICAgdGhpcy5fcHJvbWlzZVJlc29sdmUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogR3Jhdml0eSB2ZWN0b3IgY2FsY3VsYXRlZCBmcm9tIHRoZSBgYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eWAgdW5pZmllZCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAdGhpcyBEZXZpY2VPcmllbnRhdGlvbk1vZHVsZVxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKiBAZGVmYXVsdCBbMCwgMCwgMF1cbiAgICAgKi9cbiAgICB0aGlzLl9lc3RpbWF0ZWRHcmF2aXR5ID0gWzAsIDAsIDBdO1xuXG4gICAgLyoqXG4gICAgICogTWV0aG9kIGJpbmRpbmcgb2YgdGhlIHNlbnNvciBjaGVjay5cbiAgICAgKlxuICAgICAqIEB0aGlzIERldmljZU9yaWVudGF0aW9uTW9kdWxlXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX2RldmljZW9yaWVudGF0aW9uQ2hlY2sgPSB0aGlzLl9kZXZpY2VvcmllbnRhdGlvbkNoZWNrLmJpbmQodGhpcyk7XG5cbiAgICAvKipcbiAgICAgKiBNZXRob2QgYmluZGluZyBvZiB0aGUgYCdkZXZpY2VvcmllbnRhdGlvbidgIGV2ZW50IGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHRoaXMgRGV2aWNlT3JpZW50YXRpb25Nb2R1bGVcbiAgICAgKiBAdHlwZSB7ZnVuY3Rpb259XG4gICAgICovXG4gICAgdGhpcy5fZGV2aWNlb3JpZW50YXRpb25MaXN0ZW5lciA9IHRoaXMuX2RldmljZW9yaWVudGF0aW9uTGlzdGVuZXIuYmluZCh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5zb3IgY2hlY2sgb24gaW5pdGlhbGl6YXRpb24gb2YgdGhlIG1vZHVsZS5cbiAgICogVGhpcyBtZXRob2Q6XG4gICAqIC0gY2hlY2tzIHdoZXRoZXIgdGhlIGBvcmllbnRhdGlvbmAgdmFsdWVzIGFyZSB2YWxpZCBvciBub3Q7XG4gICAqIC0gKGluIHRoZSBjYXNlIHdoZXJlIG9yaWVudGF0aW9uIHJhdyB2YWx1ZXMgYXJlIG5vdCBwcm92aWRlZClcbiAgICogICB0cmllcyB0byBjYWxjdWxhdGUgdGhlIG9yaWVudGF0aW9uIGZyb20gdGhlXG4gICAqICAgYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgIHVuaWZpZWQgdmFsdWVzLlxuICAgKlxuICAgKiBAcGFyYW0ge0RldmljZU1vdGlvbkV2ZW50fSBlIC0gRmlyc3QgYCdkZXZpY2Vtb3Rpb24nYCBldmVudCBjYXVnaHQsIG9uIHdoaWNoIHRoZSBjaGVjayBpcyBkb25lLlxuICAgKi9cbiAgX2RldmljZW9yaWVudGF0aW9uQ2hlY2soZSkge1xuICAgIHRoaXMuaXNQcm92aWRlZCA9IHRydWU7XG5cbiAgICAvLyBTZW5zb3IgYXZhaWxhYmlsaXR5IGZvciB0aGUgb3JpZW50YXRpb24gYW5kIGFsdGVybmF0aXZlIG9yaWVudGF0aW9uXG4gICAgY29uc3QgcmF3VmFsdWVzUHJvdmlkZWQgPSAoKHR5cGVvZiBlLmFscGhhID09PSAnbnVtYmVyJykgJiYgKHR5cGVvZiBlLmJldGEgPT09ICdudW1iZXInKSAmJiAodHlwZW9mIGUuZ2FtbWEgPT09ICdudW1iZXInKSk7XG4gICAgdGhpcy5vcmllbnRhdGlvbi5pc1Byb3ZpZGVkID0gcmF3VmFsdWVzUHJvdmlkZWQ7XG4gICAgdGhpcy5vcmllbnRhdGlvbkFsdC5pc1Byb3ZpZGVkID0gcmF3VmFsdWVzUHJvdmlkZWQ7XG5cbiAgICAvLyBUT0RPKD8pOiBnZXQgcHNldWRvLXBlcmlvZFxuXG4gICAgLy8gV2Ugb25seSBuZWVkIHRvIGxpc3RlbiB0byBvbmUgZXZlbnQgKD0+IHJlbW92ZSB0aGUgbGlzdGVuZXIpXG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJywgdGhpcy5fZGV2aWNlb3JpZW50YXRpb25DaGVjaywgZmFsc2UpO1xuXG4gICAgLy8gSWYgb3JpZW50YXRpb24gb3IgYWx0ZXJuYXRpdmUgb3JpZW50YXRpb24gYXJlIG5vdCBwcm92aWRlZCBieSByYXcgc2Vuc29ycyBidXQgcmVxdWlyZWQsXG4gICAgLy8gdHJ5IHRvIGNhbGN1bGF0ZSB0aGVtIHdpdGggYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgIHVuaWZpZWQgdmFsdWVzXG4gICAgaWYgKCh0aGlzLnJlcXVpcmVkLm9yaWVudGF0aW9uICYmICF0aGlzLm9yaWVudGF0aW9uLmlzUHJvdmlkZWQpIHx8ICh0aGlzLnJlcXVpcmVkLm9yaWVudGF0aW9uQWx0ICYmICF0aGlzLm9yaWVudGF0aW9uQWx0LmlzUHJvdmlkZWQpKVxuICAgICAgdGhpcy5fdHJ5QWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eUZhbGxiYWNrKCk7XG4gICAgZWxzZVxuICAgICAgdGhpcy5fcHJvbWlzZVJlc29sdmUodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogYCdkZXZpY2VvcmllbnRhdGlvbidgIGV2ZW50IGNhbGxiYWNrLlxuICAgKiBUaGlzIG1ldGhvZCBlbWl0cyBhbiBldmVudCB3aXRoIHRoZSByYXcgYCdkZXZpY2VvcmllbnRhdGlvbidgIHZhbHVlcyxcbiAgICogYW5kIGVtaXRzIGV2ZW50cyB3aXRoIHRoZSB1bmlmaWVkIGBvcmllbnRhdGlvbmAgYW5kIC8gb3IgdGhlXG4gICAqIGBvcmllbnRhdGlvbkFsdGAgdmFsdWVzIGlmIHRoZXkgYXJlIHJlcXVpcmVkLlxuICAgKlxuICAgKiBAcGFyYW0ge0RldmljZU9yaWVudGF0aW9uRXZlbnR9IGUgLSBgJ2RldmljZW9yaWVudGF0aW9uJ2AgZXZlbnQgdGhlIHZhbHVlcyBhcmUgY2FsY3VsYXRlZCBmcm9tLlxuICAgKi9cbiAgX2RldmljZW9yaWVudGF0aW9uTGlzdGVuZXIoZSkge1xuICAgIC8vICdkZXZpY2VvcmllbnRhdGlvbicgZXZlbnQgKHJhdyB2YWx1ZXMpXG4gICAgbGV0IG91dEV2ZW50ID0gdGhpcy5ldmVudDtcblxuICAgIG91dEV2ZW50WzBdID0gZS5hbHBoYTtcbiAgICBvdXRFdmVudFsxXSA9IGUuYmV0YTtcbiAgICBvdXRFdmVudFsyXSA9IGUuZ2FtbWE7XG4gICAgXG4gICAgdGhpcy5lbWl0KG91dEV2ZW50KTtcblxuICAgIC8vICdvcmllbnRhdGlvbicgZXZlbnQgKHVuaWZpZWQgdmFsdWVzKVxuICAgIGlmICh0aGlzLnJlcXVpcmVkLm9yaWVudGF0aW9uICYmIHRoaXMub3JpZW50YXRpb24uaXNQcm92aWRlZCkge1xuICAgICAgLy8gT24gaU9TLCB0aGUgYGFscGhhYCB2YWx1ZSBpcyBpbml0aWFsaXplZCBhdCBgMGAgb24gdGhlIGZpcnN0IGBkZXZpY2VvcmllbnRhdGlvbmAgZXZlbnRcbiAgICAgIC8vIHNvIHdlIGtlZXAgdGhhdCByZWZlcmVuY2UgaW4gbWVtb3J5IHRvIGNhbGN1bGF0ZSB0aGUgTm9ydGggbGF0ZXIgb25cbiAgICAgIGlmICghdGhpcy5vcmllbnRhdGlvbi5fd2Via2l0Q29tcGFzc0hlYWRpbmdSZWZlcmVuY2UgJiYgZS53ZWJraXRDb21wYXNzSGVhZGluZyAmJiBwbGF0Zm9ybS5vcy5mYW1pbHkgPT09ICdpT1MnKVxuICAgICAgICB0aGlzLm9yaWVudGF0aW9uLl93ZWJraXRDb21wYXNzSGVhZGluZ1JlZmVyZW5jZSA9IGUud2Via2l0Q29tcGFzc0hlYWRpbmc7XG5cbiAgICAgIGxldCBvdXRFdmVudCA9IHRoaXMub3JpZW50YXRpb24uZXZlbnQ7XG5cbiAgICAgIG91dEV2ZW50WzBdID0gZS5hbHBoYTtcbiAgICAgIG91dEV2ZW50WzFdID0gZS5iZXRhO1xuICAgICAgb3V0RXZlbnRbMl0gPSBlLmdhbW1hO1xuXG4gICAgICAvLyBPbiBpT1MsIHJlcGxhY2UgdGhlIGBhbHBoYWAgdmFsdWUgYnkgdGhlIE5vcnRoIHZhbHVlIGFuZCB1bmlmeSB0aGUgYW5nbGVzXG4gICAgICAvLyAodGhlIGRlZmF1bHQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGFuZ2xlcyBvbiBpT1MgaXMgbm90IGNvbXBsaWFudCB3aXRoIHRoZSBXM0Mgc3BlY2lmaWNhdGlvbilcbiAgICAgIGlmICh0aGlzLm9yaWVudGF0aW9uLl93ZWJraXRDb21wYXNzSGVhZGluZ1JlZmVyZW5jZSAmJiBwbGF0Zm9ybS5vcy5mYW1pbHkgPT09ICdpT1MnKSB7XG4gICAgICAgIG91dEV2ZW50WzBdICs9IDM2MCAtIHRoaXMub3JpZW50YXRpb24uX3dlYmtpdENvbXBhc3NIZWFkaW5nUmVmZXJlbmNlO1xuICAgICAgICB1bmlmeShvdXRFdmVudCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMub3JpZW50YXRpb24uZW1pdChvdXRFdmVudCk7XG4gICAgfVxuXG4gICAgLy8gJ29yaWVudGF0aW9uQWx0JyBldmVudFxuICAgIGlmICh0aGlzLnJlcXVpcmVkLm9yaWVudGF0aW9uQWx0ICYmIHRoaXMub3JpZW50YXRpb25BbHQuaXNQcm92aWRlZCkge1xuICAgICAgLy8gT24gaU9TLCB0aGUgYGFscGhhYCB2YWx1ZSBpcyBpbml0aWFsaXplZCBhdCBgMGAgb24gdGhlIGZpcnN0IGBkZXZpY2VvcmllbnRhdGlvbmAgZXZlbnRcbiAgICAgIC8vIHNvIHdlIGtlZXAgdGhhdCByZWZlcmVuY2UgaW4gbWVtb3J5IHRvIGNhbGN1bGF0ZSB0aGUgTm9ydGggbGF0ZXIgb25cbiAgICAgIGlmICghdGhpcy5vcmllbnRhdGlvbkFsdC5fd2Via2l0Q29tcGFzc0hlYWRpbmdSZWZlcmVuY2UgJiYgZS53ZWJraXRDb21wYXNzSGVhZGluZyAmJiBwbGF0Zm9ybS5vcy5mYW1pbHkgPT09ICdpT1MnKVxuICAgICAgICB0aGlzLm9yaWVudGF0aW9uQWx0Ll93ZWJraXRDb21wYXNzSGVhZGluZ1JlZmVyZW5jZSA9IGUud2Via2l0Q29tcGFzc0hlYWRpbmc7XG5cbiAgICAgIGxldCBvdXRFdmVudCA9IHRoaXMub3JpZW50YXRpb25BbHQuZXZlbnQ7XG5cbiAgICAgIG91dEV2ZW50WzBdID0gZS5hbHBoYTtcbiAgICAgIG91dEV2ZW50WzFdID0gZS5iZXRhO1xuICAgICAgb3V0RXZlbnRbMl0gPSBlLmdhbW1hO1xuXG4gICAgICAvLyBPbiBpT1MsIHJlcGxhY2UgdGhlIGBhbHBoYWAgdmFsdWUgYnkgdGhlIE5vcnRoIHZhbHVlIGJ1dCBkbyBub3QgY29udmVydCB0aGUgYW5nbGVzXG4gICAgICAvLyAodGhlIGRlZmF1bHQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGFuZ2xlcyBvbiBpT1MgaXMgY29tcGxpYW50IHdpdGggdGhlIGFsdGVybmF0aXZlIHJlcHJlc2VudGF0aW9uKVxuICAgICAgaWYgKHRoaXMub3JpZW50YXRpb25BbHQuX3dlYmtpdENvbXBhc3NIZWFkaW5nUmVmZXJlbmNlICYmIHBsYXRmb3JtLm9zLmZhbWlseSA9PT0gJ2lPUycpe1xuICAgICAgICBvdXRFdmVudFswXSAtPSB0aGlzLm9yaWVudGF0aW9uQWx0Ll93ZWJraXRDb21wYXNzSGVhZGluZ1JlZmVyZW5jZTtcbiAgICAgICAgb3V0RXZlbnRbMF0gKz0gKG91dEV2ZW50WzBdIDwgMCkgPyAzNjAgOiAwOyAvLyBtYWtlIHN1cmUgYGFscGhhYCBpcyBpbiBbMCwgKzM2MFtcbiAgICAgIH1cblxuICAgICAgLy8gT24gQW5kcm9pZCwgdHJhbnNmb3JtIHRoZSBhbmdsZXMgdG8gdGhlIGFsdGVybmF0aXZlIHJlcHJlc2VudGF0aW9uXG4gICAgICAvLyAodGhlIGRlZmF1bHQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGFuZ2xlcyBvbiBBbmRyb2lkIGlzIGNvbXBsaWFudCB3aXRoIHRoZSBXM0Mgc3BlY2lmaWNhdGlvbilcbiAgICAgIGlmIChwbGF0Zm9ybS5vcy5mYW1pbHkgPT09ICdBbmRyb2lkJylcbiAgICAgICAgdW5pZnlBbHQob3V0RXZlbnQpO1xuXG4gICAgICB0aGlzLm9yaWVudGF0aW9uQWx0LmVtaXQob3V0RXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3Mgd2hldGhlciBgYmV0YWAgYW5kIGBnYW1tYWAgY2FuIGJlIGNhbGN1bGF0ZWQgZnJvbSB0aGUgYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgIHZhbHVlcyBvciBub3QuXG4gICAqL1xuICBfdHJ5QWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eUZhbGxiYWNrKCkge1xuICAgIE1vdGlvbklucHV0LnJlcXVpcmVNb2R1bGUoJ2FjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHknKVxuICAgICAgLnRoZW4oKGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkpID0+IHtcbiAgICAgICAgaWYgKGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkuaXNWYWxpZCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiV0FSTklORyAobW90aW9uLWlucHV0KTogVGhlICdkZXZpY2VvcmllbnRhdGlvbicgZXZlbnQgZG9lcyBub3QgZXhpc3Qgb3IgZG9lcyBub3QgcHJvdmlkZSB2YWx1ZXMgaW4geW91ciBicm93c2VyLCBzbyB0aGUgb3JpZW50YXRpb24gb2YgdGhlIGRldmljZSBpcyBlc3RpbWF0ZWQgZnJvbSBEZXZpY2VNb3Rpb24ncyAnYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eScgZXZlbnQuIFNpbmNlIHRoZSBjb21wYXNzIGlzIG5vdCBhdmFpbGFibGUsIG9ubHkgdGhlIGBiZXRhYCBhbmQgYGdhbW1hYCBhbmdsZXMgYXJlIHByb3ZpZGVkIChgYWxwaGFgIGlzIG51bGwpLlwiKTtcblxuICAgICAgICAgIGlmICh0aGlzLnJlcXVpcmVkLm9yaWVudGF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLm9yaWVudGF0aW9uLmlzQ2FsY3VsYXRlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLm9yaWVudGF0aW9uLnBlcmlvZCA9IGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkucGVyaW9kO1xuXG4gICAgICAgICAgICBNb3Rpb25JbnB1dC5hZGRMaXN0ZW5lcignYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eScsIChhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5KSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMuX2NhbGN1bGF0ZUJldGFBbmRHYW1tYUZyb21BY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5KGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHRoaXMucmVxdWlyZWQub3JpZW50YXRpb25BbHQpIHtcbiAgICAgICAgICAgIHRoaXMub3JpZW50YXRpb25BbHQuaXNDYWxjdWxhdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMub3JpZW50YXRpb25BbHQucGVyaW9kID0gYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eS5wZXJpb2Q7XG5cbiAgICAgICAgICAgIE1vdGlvbklucHV0LmFkZExpc3RlbmVyKCdhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5JywgKGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkpID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlQmV0YUFuZEdhbW1hRnJvbUFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkoYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eSwgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wcm9taXNlUmVzb2x2ZSh0aGlzKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZXMgYW5kIGVtaXRzIGBiZXRhYCBhbmQgYGdhbW1hYCB2YWx1ZXMgYXMgYSBmYWxsYmFjayBvZiB0aGUgYG9yaWVudGF0aW9uYCBhbmQgLyBvciBgb3JpZW50YXRpb25BbHRgIGV2ZW50cywgZnJvbSB0aGUgYGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlgIHVuaWZpZWQgdmFsdWVzLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcltdfSBhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5IC0gTGF0ZXN0IGBhY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5IHJhdyB2YWx1ZXMuXG4gICAqIEBwYXJhbSB7Ym9vbH0gW2FsdD1mYWxzZV0gLSBJbmRpY2F0ZXMgd2hldGhlciB3ZSBuZWVkIHRoZSBhbHRlcm5hdGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGFuZ2xlcyBvciBub3QuXG4gICAqL1xuICBfY2FsY3VsYXRlQmV0YUFuZEdhbW1hRnJvbUFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHkoYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eSwgYWx0ID0gZmFsc2UpIHtcbiAgICBjb25zdCBrID0gMC44O1xuXG4gICAgLy8gTG93IHBhc3MgZmlsdGVyIHRvIGVzdGltYXRlIHRoZSBncmF2aXR5XG4gICAgdGhpcy5fZXN0aW1hdGVkR3Jhdml0eVswXSA9IGsgKiB0aGlzLl9lc3RpbWF0ZWRHcmF2aXR5WzBdICsgKDEgLSBrKSAqIGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlbMF07XG4gICAgdGhpcy5fZXN0aW1hdGVkR3Jhdml0eVsxXSA9IGsgKiB0aGlzLl9lc3RpbWF0ZWRHcmF2aXR5WzFdICsgKDEgLSBrKSAqIGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlbMV07XG4gICAgdGhpcy5fZXN0aW1hdGVkR3Jhdml0eVsyXSA9IGsgKiB0aGlzLl9lc3RpbWF0ZWRHcmF2aXR5WzJdICsgKDEgLSBrKSAqIGFjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHlbMl07XG5cbiAgICBsZXQgX2dYID0gdGhpcy5fZXN0aW1hdGVkR3Jhdml0eVswXTtcbiAgICBsZXQgX2dZID0gdGhpcy5fZXN0aW1hdGVkR3Jhdml0eVsxXTtcbiAgICBsZXQgX2daID0gdGhpcy5fZXN0aW1hdGVkR3Jhdml0eVsyXTtcblxuICAgIGNvbnN0IG5vcm0gPSBNYXRoLnNxcnQoX2dYICogX2dYICsgX2dZICogX2dZICsgX2daICogX2daKTtcblxuICAgIF9nWCAvPSBub3JtO1xuICAgIF9nWSAvPSBub3JtO1xuICAgIF9nWiAvPSBub3JtO1xuXG4gICAgLy8gQWRvcHRpbmcgdGhlIGZvbGxvd2luZyBjb252ZW50aW9uczpcbiAgICAvLyAtIGVhY2ggbWF0cml4IG9wZXJhdGVzIGJ5IHByZS1tdWx0aXBseWluZyBjb2x1bW4gdmVjdG9ycyxcbiAgICAvLyAtIGVhY2ggbWF0cml4IHJlcHJlc2VudHMgYW4gYWN0aXZlIHJvdGF0aW9uLFxuICAgIC8vIC0gZWFjaCBtYXRyaXggcmVwcmVzZW50cyB0aGUgY29tcG9zaXRpb24gb2YgaW50cmluc2ljIHJvdGF0aW9ucyxcbiAgICAvLyB0aGUgcm90YXRpb24gbWF0cml4IHJlcHJlc2VudGluZyB0aGUgY29tcG9zaXRpb24gb2YgYSByb3RhdGlvblxuICAgIC8vIGFib3V0IHRoZSB4LWF4aXMgYnkgYW4gYW5nbGUgYmV0YSBhbmQgYSByb3RhdGlvbiBhYm91dCB0aGUgeS1heGlzXG4gICAgLy8gYnkgYW4gYW5nbGUgZ2FtbWEgaXM6XG4gICAgLy9cbiAgICAvLyBbIGNvcyhnYW1tYSkgICAgICAgICAgICAgICAsICAwICAgICAgICAgICwgIHNpbihnYW1tYSkgICAgICAgICAgICAgICxcbiAgICAvLyAgIHNpbihiZXRhKSAqIHNpbihnYW1tYSkgICAsICBjb3MoYmV0YSkgICwgIC1jb3MoZ2FtbWEpICogc2luKGJldGEpICxcbiAgICAvLyAgIC1jb3MoYmV0YSkgKiBzaW4oZ2FtbWEpICAsICBzaW4oYmV0YSkgICwgIGNvcyhiZXRhKSAqIGNvcyhnYW1tYSkgIF0uXG4gICAgLy9cbiAgICAvLyBIZW5jZSwgdGhlIHByb2plY3Rpb24gb2YgdGhlIG5vcm1hbGl6ZWQgZ3Jhdml0eSBnID0gWzAsIDAsIDFdXG4gICAgLy8gaW4gdGhlIGRldmljZSdzIHJlZmVyZW5jZSBmcmFtZSBjb3JyZXNwb25kcyB0bzpcbiAgICAvL1xuICAgIC8vIGdYID0gLWNvcyhiZXRhKSAqIHNpbihnYW1tYSksXG4gICAgLy8gZ1kgPSBzaW4oYmV0YSksXG4gICAgLy8gZ1ogPSBjb3MoYmV0YSkgKiBjb3MoZ2FtbWEpLFxuICAgIC8vXG4gICAgLy8gc28gYmV0YSA9IGFzaW4oZ1kpIGFuZCBnYW1tYSA9IGF0YW4yKC1nWCwgZ1opLlxuXG4gICAgLy8gQmV0YSAmIGdhbW1hIGVxdWF0aW9ucyAod2UgYXBwcm94aW1hdGUgW2dYLCBnWSwgZ1pdIGJ5IFtfZ1gsIF9nWSwgX2daXSlcbiAgICBsZXQgYmV0YSA9IHJhZFRvRGVnKE1hdGguYXNpbihfZ1kpKTsgLy8gYmV0YSBpcyBpbiBbLXBpLzI7IHBpLzJbXG4gICAgbGV0IGdhbW1hID0gcmFkVG9EZWcoTWF0aC5hdGFuMigtX2dYLCBfZ1opKTsgLy8gZ2FtbWEgaXMgaW4gWy1waTsgcGlbXG5cbiAgICBpZiAoYWx0KSB7XG4gICAgICAvLyBJbiB0aGF0IGNhc2UsIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG8gc2luY2UgdGhlIGNhbGN1bGF0aW9ucyBhYm92ZSBnYXZlIHRoZSBhbmdsZSBpbiB0aGUgcmlnaHQgcmFuZ2VzXG4gICAgICBsZXQgb3V0RXZlbnQgPSB0aGlzLm9yaWVudGF0aW9uQWx0LmV2ZW50O1xuICAgICAgb3V0RXZlbnRbMF0gPSBudWxsO1xuICAgICAgb3V0RXZlbnRbMV0gPSBiZXRhO1xuICAgICAgb3V0RXZlbnRbMl0gPSBnYW1tYTtcblxuICAgICAgdGhpcy5vcmllbnRhdGlvbkFsdC5lbWl0KG91dEV2ZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSGVyZSB3ZSBoYXZlIHRvIHVuaWZ5IHRoZSBhbmdsZXMgdG8gZ2V0IHRoZSByYW5nZXMgY29tcGxpYW50IHdpdGggdGhlIFczQyBzcGVjaWZpY2F0aW9uXG4gICAgICBsZXQgb3V0RXZlbnQgPSB0aGlzLm9yaWVudGF0aW9uLmV2ZW50O1xuICAgICAgb3V0RXZlbnRbMF0gPSBudWxsO1xuICAgICAgb3V0RXZlbnRbMV0gPSBiZXRhO1xuICAgICAgb3V0RXZlbnRbMl0gPSBnYW1tYTtcbiAgICAgIHVuaWZ5KG91dEV2ZW50KTtcbiAgICAgIFxuICAgICAgdGhpcy5vcmllbnRhdGlvbi5lbWl0KG91dEV2ZW50KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5jcmVhc2VzIHRoZSBudW1iZXIgb2YgbGlzdGVuZXJzIHRvIHRoaXMgbW9kdWxlIChlaXRoZXIgYmVjYXVzZSBzb21lb25lIGxpc3RlbnNcbiAgICogdG8gdGhpcyBtb2R1bGUsIG9yIG9uZSBvZiB0aGUgdHdvIGBET01FdmVudFN1Ym1vZHVsZXNgIChgT3JpZW50YXRpb25gLFxuICAgKiBgT3JpZW50YXRpb25BbHRgKS5cbiAgICogV2hlbiB0aGUgbnVtYmVyIG9mIGxpc3RlbmVycyByZWFjaGVzIGAxYCwgYWRkcyBhIGAnZGV2aWNlb3JpZW50YXRpb24nYFxuICAgKiBldmVudCBsaXN0ZW5lci5cbiAgICpcbiAgICogQHNlZSBEZXZpY2VPcmllbnRhdGlvbk1vZHVsZSNhZGRMaXN0ZW5lclxuICAgKiBAc2VlIERPTUV2ZW50U3VibW9kdWxlI3N0YXJ0XG4gICAqL1xuICBfYWRkTGlzdGVuZXIoKSB7XG4gICAgdGhpcy5fbnVtTGlzdGVuZXJzKys7XG5cbiAgICBpZiAodGhpcy5fbnVtTGlzdGVuZXJzID09PSAxKVxuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJywgdGhpcy5fZGV2aWNlb3JpZW50YXRpb25MaXN0ZW5lciwgZmFsc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlY3JlYXNlcyB0aGUgbnVtYmVyIG9mIGxpc3RlbmVycyB0byB0aGlzIG1vZHVsZSAoZWl0aGVyIGJlY2F1c2Ugc29tZW9uZSBzdG9wc1xuICAgKiBsaXN0ZW5pbmcgdG8gdGhpcyBtb2R1bGUsIG9yIG9uZSBvZiB0aGUgdGhyZWUgYERPTUV2ZW50U3VibW9kdWxlc2BcbiAgICogKGBPcmllbnRhdGlvbmAsIGBPcmllbnRhdGlvbkFsdGApLlxuICAgKiBXaGVuIHRoZSBudW1iZXIgb2YgbGlzdGVuZXJzIHJlYWNoZXMgYDBgLCByZW1vdmVzIHRoZSBgJ2RldmljZW9yaWVudGF0aW9uJ2BcbiAgICogZXZlbnQgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBzZWUgRGV2aWNlT3JpZW50YXRpb25Nb2R1bGUjcmVtb3ZlTGlzdGVuZXJcbiAgICogQHNlZSBET01FdmVudFN1Ym1vZHVsZSNzdG9wXG4gICAqL1xuICBfcmVtb3ZlTGlzdGVuZXIoKSB7XG4gICAgdGhpcy5fbnVtTGlzdGVuZXJzLS07XG5cbiAgICBpZiAodGhpcy5fbnVtTGlzdGVuZXJzID09PSAwKSB7XG4gICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignZGV2aWNlb3JpZW50YXRpb24nLCB0aGlzLl9kZXZpY2VvcmllbnRhdGlvbkxpc3RlbmVyLCBmYWxzZSk7XG4gICAgICB0aGlzLm9yaWVudGF0aW9uLl93ZWJraXRDb21wYXNzSGVhZGluZ1JlZmVyZW5jZSA9IG51bGw7IC8vIGRvbid0IGZvcmdldCB0byByZXNldCB0aGUgY29tcGFzcyByZWZlcmVuY2Ugc2luY2UgdGhpcyByZWZlcmVuY2UgaXMgc2V0IGVhY2ggdGltZSB3ZSBzdGFydCBsaXN0ZW5pbmcgdG8gYSBgJ2RldmljZW9yaWVudGF0aW9uJ2AgZXZlbnRcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgb2YgdGhlIG1vZHVsZS5cbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gIGluaXQoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmluaXQoKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuX3Byb21pc2VSZXNvbHZlID0gcmVzb2x2ZTtcblxuICAgICAgaWYgKHdpbmRvdy5EZXZpY2VPcmllbnRhdGlvbkV2ZW50KVxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZGV2aWNlb3JpZW50YXRpb24nLCB0aGlzLl9kZXZpY2VvcmllbnRhdGlvbkNoZWNrLCBmYWxzZSk7XG4gICAgICBlbHNlIGlmICh0aGlzLnJlcXVpcmVkLm9yaWVudGF0aW9uKVxuICAgICAgICB0aGlzLl90cnlBY2NlbGVyYXRpb25JbmNsdWRpbmdHcmF2aXR5RmFsbGJhY2soKTtcbiAgICAgIGVsc2VcbiAgICAgICAgcmVzb2x2ZSh0aGlzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbGlzdGVuZXIgdG8gdGhpcyBtb2R1bGUuXG4gICAqIFxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIExpc3RlbmVyIHRvIGFkZC5cbiAgICovXG4gIGFkZExpc3RlbmVyKGxpc3RlbmVyKSB7XG4gICAgc3VwZXIuYWRkTGlzdGVuZXIobGlzdGVuZXIpO1xuICAgIHRoaXMuX2FkZExpc3RlbmVyKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyBhIGxpc3RlbmVyIGZyb20gdGhpcyBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gTGlzdGVuZXIgdG8gcmVtb3ZlLlxuICAgKi9cbiAgcmVtb3ZlTGlzdGVuZXIobGlzdGVuZXIpIHtcbiAgICBzdXBlci5yZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcik7XG4gICAgdGhpcy5fcmVtb3ZlTGlzdGVuZXIoKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBEZXZpY2VPcmllbnRhdGlvbk1vZHVsZSgpOyIsIi8qKlxuICogQGZpbGVvdmVydmlldyBFbmVyZ3kgbW9kdWxlXG4gKiBAYXV0aG9yIDxhIGhyZWY9J21haWx0bzpzZWJhc3RpZW5Acm9iYXN6a2lld2ljei5jb20nPlPDqWJhc3RpZW4gUm9iYXN6a2lld2ljejwvYT4sIDxhIGhyZWY9J21haWx0bzpOb3JiZXJ0LlNjaG5lbGxAaXJjYW0uZnInPk5vcmJlcnQgU2NobmVsbDwvYT5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbmNvbnN0IElucHV0TW9kdWxlID0gcmVxdWlyZSgnLi9JbnB1dE1vZHVsZScpO1xuY29uc3QgTW90aW9uSW5wdXQgPSByZXF1aXJlKCcuL01vdGlvbklucHV0Jyk7XG5cbi8qKlxuICogRW5lcmd5IG1vZHVsZSBzaW5nbGV0b24uXG4gKiBUaGUgZW5lcmd5IG1vZHVsZSBzaW5nbGV0b24gcHJvdmlkZXMgZW5lcmd5IHZhbHVlcyAoYmV0d2VlbiAwIGFuZCAxKVxuICogYmFzZWQgb24gdGhlIGFjY2VsZXJhdGlvbiBhbmQgdGhlIHJvdGF0aW9uIHJhdGUgb2YgdGhlIGRldmljZS5cbiAqIFRoZSBwZXJpb2Qgb2YgdGhlIGVuZXJneSB2YWx1ZXMgaXMgdGhlIHNhbWUgYXMgdGhlIHBlcmlvZCBvZiB0aGVcbiAqIGFjY2VsZXJhdGlvbiBhbmQgdGhlIHJvdGF0aW9uIHJhdGUgdmFsdWVzLlxuICpcbiAqIEBjbGFzcyBFbmVyZ3lNb2R1bGVcbiAqIEBleHRlbmRzIElucHV0TW9kdWxlXG4gKi9cbmNsYXNzIEVuZXJneU1vZHVsZSBleHRlbmRzIElucHV0TW9kdWxlIHtcblxuICAvKipcbiAgICogQ3JlYXRlcyB0aGUgZW5lcmd5IG1vZHVsZSBpbnN0YW5jZS5cbiAgICpcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcignZW5lcmd5Jyk7XG5cbiAgICAvKipcbiAgICAgKiBFdmVudCBjb250YWluaW5nIHRoZSB2YWx1ZSBvZiB0aGUgZW5lcmd5LCBzZW50IGJ5IHRoZSBlbmVyZ3kgbW9kdWxlLlxuICAgICAqXG4gICAgICogQHRoaXMgRW5lcmd5TW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZGVmYXVsdCAwXG4gICAgICovXG4gICAgdGhpcy5ldmVudCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWNjZWxlcmF0aW9uIG1vZHVsZSwgdXNlZCBpbiB0aGUgY2FsY3VsYXRpb24gb2YgdGhlIGVuZXJneS5cbiAgICAgKlxuICAgICAqIEB0aGlzIEVuZXJneU1vZHVsZVxuICAgICAqIEB0eXBlIHtET01FdmVudFN1Ym1vZHVsZX1cbiAgICAgKiBAZGVmYXVsdCBudWxsXG4gICAgICogQHNlZSBEZXZpY2Vtb3Rpb25Nb2R1bGVcbiAgICAgKi9cbiAgICB0aGlzLl9hY2NlbGVyYXRpb25Nb2R1bGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogTGF0ZXN0IGFjY2VsZXJhdGlvbiB2YWx1ZSBzZW50IGJ5IHRoZSBhY2NlbGVyYXRpb24gbW9kdWxlLlxuICAgICAqXG4gICAgICogQHRoaXMgRW5lcmd5TW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBkZWZhdWx0IG51bGxcbiAgICAgKi9cbiAgICB0aGlzLl9hY2NlbGVyYXRpb25WYWx1ZXMgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogTWF4aW11bSB2YWx1ZSByZWFjaGVkIGJ5IHRoZSBhY2NlbGVyYXRpb24gbWFnbml0dWRlLCBjbGlwcGVkIGF0IGB0aGlzLl9hY2NlbGVyYXRpb25NYWduaXR1ZGVUaHJlc2hvbGRgLlxuICAgICAqXG4gICAgICogQHRoaXMgRW5lcmd5TW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZGVmYXVsdCA5LjgxXG4gICAgICovXG4gICAgdGhpcy5fYWNjZWxlcmF0aW9uTWFnbml0dWRlQ3VycmVudE1heCA9IDkuODE7XG5cbiAgICAvKipcbiAgICAgKiBDbGlwcGluZyB2YWx1ZSBvZiB0aGUgYWNjZWxlcmF0aW9uIG1hZ25pdHVkZS5cbiAgICAgKlxuICAgICAqIEB0aGlzIEVuZXJneU1vZHVsZVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGRlZmF1bHQgMjBcbiAgICAgKiBAY29uc3RhbnRcbiAgICAgKi9cbiAgICB0aGlzLl9hY2NlbGVyYXRpb25NYWduaXR1ZGVUaHJlc2hvbGQgPSAyMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSByb3RhdGlvbiByYXRlIG1vZHVsZSwgdXNlZCBpbiB0aGUgY2FsY3VsYXRpb24gb2YgdGhlIGVuZXJneS5cbiAgICAgKlxuICAgICAqIEB0aGlzIEVuZXJneU1vZHVsZVxuICAgICAqIEB0eXBlIHtET01FdmVudFN1Ym1vZHVsZX1cbiAgICAgKiBAZGVmYXVsdCBudWxsXG4gICAgICogQHNlZSBEZXZpY2Vtb3Rpb25Nb2R1bGVcbiAgICAgKi9cbiAgICB0aGlzLl9yb3RhdGlvblJhdGVNb2R1bGUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogTGF0ZXN0IHJvdGF0aW9uIHJhdGUgdmFsdWUgc2VudCBieSB0aGUgcm90YXRpb24gcmF0ZSBtb2R1bGUuXG4gICAgICpcbiAgICAgKiBAdGhpcyBFbmVyZ3lNb2R1bGVcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICogQGRlZmF1bHQgbnVsbFxuICAgICAqL1xuICAgIHRoaXMuX3JvdGF0aW9uUmF0ZVZhbHVlcyA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBNYXhpbXVtIHZhbHVlIHJlYWNoZWQgYnkgdGhlIHJvdGF0aW9uIHJhdGUgbWFnbml0dWRlLCBjbGlwcGVkIGF0IGB0aGlzLl9yb3RhdGlvblJhdGVNYWduaXR1ZGVUaHJlc2hvbGRgLlxuICAgICAqXG4gICAgICogQHRoaXMgRW5lcmd5TW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZGVmYXVsdCAyMDBcbiAgICAgKi9cbiAgICB0aGlzLl9yb3RhdGlvblJhdGVNYWduaXR1ZGVDdXJyZW50TWF4ID0gMjAwO1xuXG4gICAgLyoqXG4gICAgICogQ2xpcHBpbmcgdmFsdWUgb2YgdGhlIHJvdGF0aW9uIHJhdGUgbWFnbml0dWRlLlxuICAgICAqXG4gICAgICogQHRoaXMgRW5lcmd5TW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZGVmYXVsdCA2MDBcbiAgICAgKiBAY29uc3RhbnRcbiAgICAgKi9cbiAgICB0aGlzLl9yb3RhdGlvblJhdGVNYWduaXR1ZGVUaHJlc2hvbGQgPSA2MDA7XG5cbiAgICAvKipcbiAgICAgKiBUaW1lIGNvbnN0YW50IChoYWxmLWxpZmUpIG9mIHRoZSBsb3ctcGFzcyBmaWx0ZXIgdXNlZCB0byBzbW9vdGggdGhlIGVuZXJneSB2YWx1ZXMgKGluIHNlY29uZHMpLlxuICAgICAqXG4gICAgICogQHRoaXMgRW5lcmd5TW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZGVmYXVsdCAwLjFcbiAgICAgKiBAY29uc3RhbnRcbiAgICAgKi9cbiAgICB0aGlzLl9lbmVyZ3lUaW1lQ29uc3RhbnQgPSAwLjE7XG5cbiAgICAvKipcbiAgICAgKiBNZXRob2QgYmluZGluZyBvZiB0aGUgYWNjZWxlcmF0aW9uIHZhbHVlcyBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIEB0aGlzIEVuZXJneU1vZHVsZVxuICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgKi9cbiAgICB0aGlzLl9vbkFjY2VsZXJhdGlvbiA9IHRoaXMuX29uQWNjZWxlcmF0aW9uLmJpbmQodGhpcyk7XG4gICAgXG4gICAgLyoqXG4gICAgICogTWV0aG9kIGJpbmRpbmcgb2YgdGhlIHJvdGF0aW9uIHJhdGUgdmFsdWVzIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHRoaXMgRW5lcmd5TW9kdWxlXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX29uUm90YXRpb25SYXRlID0gdGhpcy5fb25Sb3RhdGlvblJhdGUuYmluZCh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNheSBmYWN0b3Igb2YgdGhlIGxvdy1wYXNzIGZpbHRlciB1c2VkIHRvIHNtb290aCB0aGUgZW5lcmd5IHZhbHVlcy5cbiAgICpcbiAgICogQHR5cGUge251bWJlcn1cbiAgICogQHJlYWRvbmx5XG4gICAqL1xuICBnZXQgX2VuZXJneURlY2F5KCkge1xuICAgIHJldHVybiBNYXRoLmV4cCgtMiAqIE1hdGguUEkgKiB0aGlzLnBlcmlvZCAvIHRoaXMuX2VuZXJneVRpbWVDb25zdGFudCk7XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgb2YgdGhlIG1vZHVsZS5cbiAgICpcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gIGluaXQoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmluaXQoKHJlc29sdmUpID0+IHtcbiAgICAgIC8vIFRoZSBlbmVyZ3kgbW9kdWxlIHJlcXVpcmVzIHRoZSBhY2NlbGVyYXRpb24gYW5kIHRoZSByb3RhdGlvbiByYXRlIG1vZHVsZXNcbiAgICAgIFByb21pc2UuYWxsKFtNb3Rpb25JbnB1dC5yZXF1aXJlTW9kdWxlKCdhY2NlbGVyYXRpb24nKSwgTW90aW9uSW5wdXQucmVxdWlyZU1vZHVsZSgncm90YXRpb25SYXRlJyldKVxuICAgICAgICAudGhlbigobW9kdWxlcykgPT4ge1xuICAgICAgICAgIGNvbnN0IFthY2NlbGVyYXRpb24sIHJvdGF0aW9uUmF0ZV0gPSBtb2R1bGVzO1xuXG4gICAgICAgICAgdGhpcy5fYWNjZWxlcmF0aW9uTW9kdWxlID0gYWNjZWxlcmF0aW9uO1xuICAgICAgICAgIHRoaXMuX3JvdGF0aW9uUmF0ZU1vZHVsZSA9IHJvdGF0aW9uUmF0ZTtcbiAgICAgICAgICB0aGlzLmlzQ2FsY3VsYXRlZCA9IHRoaXMuX2FjY2VsZXJhdGlvbk1vZHVsZS5pc1ZhbGlkIHx8IHRoaXMuX3JvdGF0aW9uUmF0ZU1vZHVsZS5pc1ZhbGlkO1xuXG4gICAgICAgICAgaWYgKHRoaXMuX2FjY2VsZXJhdGlvbk1vZHVsZS5pc1ZhbGlkKVxuICAgICAgICAgICAgdGhpcy5wZXJpb2QgPSB0aGlzLl9hY2NlbGVyYXRpb25Nb2R1bGUucGVyaW9kO1xuICAgICAgICAgIGVsc2UgaWYgKHRoaXMuX3JvdGF0aW9uUmF0ZU1vZHVsZS5pc1ZhbGlkKVxuICAgICAgICAgICAgdGhpcy5wZXJpb2QgPSB0aGlzLl9yb3RhdGlvblJhdGVNb2R1bGUucGVyaW9kO1xuXG4gICAgICAgICAgcmVzb2x2ZSh0aGlzKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgdGhlIG1vZHVsZS5cbiAgICovXG4gIHN0YXJ0KCkge1xuICAgIC8vIFRPRE8oPyk6IG1ha2UgdGhpcyBtZXRob2QgcHJpdmF0ZVxuICAgIGlmICh0aGlzLl9hY2NlbGVyYXRpb25Nb2R1bGUuaXNWYWxpZClcbiAgICAgIE1vdGlvbklucHV0LmFkZExpc3RlbmVyKCdhY2NlbGVyYXRpb24nLCB0aGlzLl9vbkFjY2VsZXJhdGlvbik7XG4gICAgaWYgKHRoaXMuX3JvdGF0aW9uUmF0ZU1vZHVsZS5pc1ZhbGlkKVxuICAgICAgTW90aW9uSW5wdXQuYWRkTGlzdGVuZXIoJ3JvdGF0aW9uUmF0ZScsIHRoaXMuX29uUm90YXRpb25SYXRlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wIHRoZSBtb2R1bGUuXG4gICAqL1xuICBzdG9wKCkge1xuICAgIC8vIFRPRE8oPyk6IG1ha2UgdGhpcyBtZXRob2QgcHJpdmF0ZVxuICAgIGlmICh0aGlzLl9hY2NlbGVyYXRpb25Nb2R1bGUuaXNWYWxpZClcbiAgICAgIE1vdGlvbklucHV0LnJlbW92ZUxpc3RlbmVyKCdhY2NlbGVyYXRpb24nLCB0aGlzLl9vbkFjY2VsZXJhdGlvbik7XG4gICAgaWYgKHRoaXMuX3JvdGF0aW9uUmF0ZU1vZHVsZS5pc1ZhbGlkKVxuICAgICAgTW90aW9uSW5wdXQucmVtb3ZlTGlzdGVuZXIoJ3JvdGF0aW9uUmF0ZScsIHRoaXMuX29uUm90YXRpb25SYXRlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBY2NlbGVyYXRpb24gdmFsdWVzIGhhbmRsZXIuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyW119IGFjY2VsZXJhdGlvbiAtIExhdGVzdCBhY2NlbGVyYXRpb24gdmFsdWUuXG4gICAqL1xuICBfb25BY2NlbGVyYXRpb24oYWNjZWxlcmF0aW9uKSB7XG4gICAgdGhpcy5fYWNjZWxlcmF0aW9uVmFsdWVzID0gYWNjZWxlcmF0aW9uO1xuXG4gICAgLy8gSWYgdGhlIHJvdGF0aW9uIHJhdGUgdmFsdWVzIGFyZSBub3QgYXZhaWxhYmxlLCB3ZSBjYWxjdWxhdGUgdGhlIGVuZXJneSByaWdodCBhd2F5LlxuICAgIGlmICghdGhpcy5fcm90YXRpb25SYXRlTW9kdWxlLmlzVmFsaWQpXG4gICAgICB0aGlzLl9jYWxjdWxhdGVFbmVyZ3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSb3RhdGlvbiByYXRlIHZhbHVlcyBoYW5kbGVyLlxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcltdfSByb3RhdGlvblJhdGUgLSBMYXRlc3Qgcm90YXRpb24gcmF0ZSB2YWx1ZS5cbiAgICovXG4gIF9vblJvdGF0aW9uUmF0ZShyb3RhdGlvblJhdGUpIHtcbiAgICB0aGlzLl9yb3RhdGlvblJhdGVWYWx1ZXMgPSByb3RhdGlvblJhdGU7XG5cbiAgICAvLyBXZSBrbm93IHRoYXQgdGhlIGFjY2VsZXJhdGlvbiBhbmQgcm90YXRpb24gcmF0ZSB2YWx1ZXMgY29taW5nIGZyb20gdGhlXG4gICAgLy8gc2FtZSBgZGV2aWNlbW90aW9uYCBldmVudCBhcmUgc2VudCBpbiB0aGF0IG9yZGVyIChhY2NlbGVyYXRpb24gPiByb3RhdGlvbiByYXRlKVxuICAgIC8vIHNvIHdoZW4gdGhlIHJvdGF0aW9uIHJhdGUgaXMgcHJvdmlkZWQsIHdlIGNhbGN1bGF0ZSB0aGUgZW5lcmd5IHZhbHVlIG9mIHRoZVxuICAgIC8vIGxhdGVzdCBgZGV2aWNlbW90aW9uYCBldmVudCB3aGVuIHdlIHJlY2VpdmUgdGhlIHJvdGF0aW9uIHJhdGUgdmFsdWVzLlxuICAgIHRoaXMuX2NhbGN1bGF0ZUVuZXJneSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEVuZXJneSBjYWxjdWxhdGlvbjogZW1pdHMgYW4gZW5lcmd5IHZhbHVlIGJldHdlZW4gMCBhbmQgMS5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgY2hlY2tzIGlmIHRoZSBhY2NlbGVyYXRpb24gbW9kdWxlcyBpcyB2YWxpZC4gSWYgdGhhdCBpcyB0aGUgY2FzZSxcbiAgICogaXQgY2FsY3VsYXRlcyBhbiBlc3RpbWF0aW9uIG9mIHRoZSBlbmVyZ3kgKGJldHdlZW4gMCBhbmQgMSkgYmFzZWQgb24gdGhlIHJhdGlvXG4gICAqIG9mIHRoZSBjdXJyZW50IGFjY2VsZXJhdGlvbiBtYWduaXR1ZGUgYW5kIHRoZSBtYXhpbXVtIGFjY2VsZXJhdGlvbiBtYWduaXR1ZGVcbiAgICogcmVhY2hlZCBzbyBmYXIgKGNsaXBwZWQgYXQgdGhlIGB0aGlzLl9hY2NlbGVyYXRpb25NYWduaXR1ZGVUaHJlc2hvbGRgIHZhbHVlKS5cbiAgICogKFdlIHVzZSB0aGlzIHRyaWNrIHRvIGdldCB1bmlmb3JtIGJlaGF2aW9ycyBhbW9uZyBkZXZpY2VzLiBJZiB3ZSBjYWxjdWxhdGVkXG4gICAqIHRoZSByYXRpbyBiYXNlZCBvbiBhIGZpeGVkIHZhbHVlIGluZGVwZW5kZW50IG9mIHdoYXQgdGhlIGRldmljZSBpcyBjYXBhYmxlIG9mXG4gICAqIHByb3ZpZGluZywgd2UgY291bGQgZ2V0IGluY29uc2lzdGVudCBiZWhhdmlvcnMuIEZvciBpbnN0YW5jZSwgdGhlIGRldmljZXNcbiAgICogd2hvc2UgYWNjZWxlcm9tZXRlcnMgYXJlIGxpbWl0ZWQgYXQgMmcgd291bGQgYWx3YXlzIHByb3ZpZGUgdmVyeSBsb3cgdmFsdWVzXG4gICAqIGNvbXBhcmVkIHRvIGRldmljZXMgd2l0aCBhY2NlbGVyb21ldGVycyBjYXBhYmxlIG9mIG1lYXN1cmluZyA0ZyBhY2NlbGVyYXRpb25zLilcbiAgICogVGhlIHNhbWUgY2hlY2tzIGFuZCBjYWxjdWxhdGlvbnMgYXJlIG1hZGUgb24gdGhlIHJvdGF0aW9uIHJhdGUgbW9kdWxlLlxuICAgKiBGaW5hbGx5LCB0aGUgZW5lcmd5IHZhbHVlIGlzIHRoZSBtYXhpbXVtIGJldHdlZW4gdGhlIGVuZXJneSB2YWx1ZSBlc3RpbWF0ZWRcbiAgICogZnJvbSB0aGUgYWNjZWxlcmF0aW9uLCBhbmQgdGhlIG9uZSBlc3RpbWF0ZWQgZnJvbSB0aGUgcm90YXRpb24gcmF0ZS4gSXQgaXNcbiAgICogc21vb3RoZWQgdGhyb3VnaCBhIGxvdy1wYXNzIGZpbHRlci5cbiAgICovXG4gIF9jYWxjdWxhdGVFbmVyZ3koKSB7XG4gICAgbGV0IGFjY2VsZXJhdGlvbkVuZXJneSA9IDA7XG4gICAgbGV0IHJvdGF0aW9uUmF0ZUVuZXJneSA9IDA7XG5cbiAgICAvLyBDaGVjayB0aGUgYWNjZWxlcmF0aW9uIG1vZHVsZSBhbmQgY2FsY3VsYXRlIGFuIGVzdGltYXRpb24gb2YgdGhlIGVuZXJneSB2YWx1ZSBmcm9tIHRoZSBsYXRlc3QgYWNjZWxlcmF0aW9uIHZhbHVlXG4gICAgaWYgKHRoaXMuX2FjY2VsZXJhdGlvbk1vZHVsZS5pc1ZhbGlkKSB7XG4gICAgICBsZXQgYVggPSB0aGlzLl9hY2NlbGVyYXRpb25WYWx1ZXNbMF07XG4gICAgICBsZXQgYVkgPSB0aGlzLl9hY2NlbGVyYXRpb25WYWx1ZXNbMV07XG4gICAgICBsZXQgYVogPSB0aGlzLl9hY2NlbGVyYXRpb25WYWx1ZXNbMl07XG4gICAgICBsZXQgYWNjZWxlcmF0aW9uTWFnbml0dWRlID0gTWF0aC5zcXJ0KGFYICogYVggKyBhWSAqIGFZICsgYVogKiBhWik7XG5cbiAgICAgIC8vIFN0b3JlIHRoZSBtYXhpbXVtIGFjY2VsZXJhdGlvbiBtYWduaXR1ZGUgcmVhY2hlZCBzbyBmYXIsIGNsaXBwZWQgYXQgYHRoaXMuX2FjY2VsZXJhdGlvbk1hZ25pdHVkZVRocmVzaG9sZGBcbiAgICAgIGlmICh0aGlzLl9hY2NlbGVyYXRpb25NYWduaXR1ZGVDdXJyZW50TWF4IDwgYWNjZWxlcmF0aW9uTWFnbml0dWRlKVxuICAgICAgICB0aGlzLl9hY2NlbGVyYXRpb25NYWduaXR1ZGVDdXJyZW50TWF4ID0gTWF0aC5taW4oYWNjZWxlcmF0aW9uTWFnbml0dWRlLCB0aGlzLl9hY2NlbGVyYXRpb25NYWduaXR1ZGVUaHJlc2hvbGQpO1xuICAgICAgLy8gVE9ETyg/KTogcmVtb3ZlIG91bGllcnMgLS0tIG9uIHNvbWUgQW5kcm9pZCBkZXZpY2VzLCB0aGUgbWFnbml0dWRlIGlzIHZlcnkgaGlnaCBvbiBhIGZldyBpc29sYXRlZCBkYXRhcG9pbnRzLFxuICAgICAgLy8gd2hpY2ggbWFrZSB0aGUgdGhyZXNob2xkIHZlcnkgaGlnaCBhcyB3ZWxsID0+IHRoZSBlbmVyZ3kgcmVtYWlucyBhcm91bmQgMC41LCBldmVuIHdoZW4geW91IHNoYWtlIHZlcnkgaGFyZC5cblxuICAgICAgYWNjZWxlcmF0aW9uRW5lcmd5ID0gTWF0aC5taW4oYWNjZWxlcmF0aW9uTWFnbml0dWRlIC8gdGhpcy5fYWNjZWxlcmF0aW9uTWFnbml0dWRlQ3VycmVudE1heCwgMSk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdGhlIHJvdGF0aW9uIHJhdGUgbW9kdWxlIGFuZCBjYWxjdWxhdGUgYW4gZXN0aW1hdGlvbiBvZiB0aGUgZW5lcmd5IHZhbHVlIGZyb20gdGhlIGxhdGVzdCByb3RhdGlvbiByYXRlIHZhbHVlXG4gICAgaWYgKHRoaXMuX3JvdGF0aW9uUmF0ZU1vZHVsZS5pc1ZhbGlkKSB7XG4gICAgICBsZXQgckEgPSB0aGlzLl9yb3RhdGlvblJhdGVWYWx1ZXNbMF07XG4gICAgICBsZXQgckIgPSB0aGlzLl9yb3RhdGlvblJhdGVWYWx1ZXNbMV07XG4gICAgICBsZXQgckcgPSB0aGlzLl9yb3RhdGlvblJhdGVWYWx1ZXNbMl07XG4gICAgICBsZXQgcm90YXRpb25SYXRlTWFnbml0dWRlID0gTWF0aC5zcXJ0KHJBICogckEgKyByQiAqIHJCICsgckcgKiByRyk7XG5cbiAgICAgIC8vIFN0b3JlIHRoZSBtYXhpbXVtIHJvdGF0aW9uIHJhdGUgbWFnbml0dWRlIHJlYWNoZWQgc28gZmFyLCBjbGlwcGVkIGF0IGB0aGlzLl9yb3RhdGlvblJhdGVNYWduaXR1ZGVUaHJlc2hvbGRgXG4gICAgICBpZiAodGhpcy5fcm90YXRpb25SYXRlTWFnbml0dWRlQ3VycmVudE1heCA8IHJvdGF0aW9uUmF0ZU1hZ25pdHVkZSlcbiAgICAgICAgdGhpcy5fcm90YXRpb25SYXRlTWFnbml0dWRlQ3VycmVudE1heCA9IE1hdGgubWluKHJvdGF0aW9uUmF0ZU1hZ25pdHVkZSwgdGhpcy5fcm90YXRpb25SYXRlTWFnbml0dWRlVGhyZXNob2xkKTtcblxuICAgICAgcm90YXRpb25SYXRlRW5lcmd5ID0gTWF0aC5taW4ocm90YXRpb25SYXRlTWFnbml0dWRlIC8gdGhpcy5fcm90YXRpb25SYXRlTWFnbml0dWRlQ3VycmVudE1heCwgMSk7XG4gICAgfVxuXG4gICAgbGV0IGVuZXJneSA9IE1hdGgubWF4KGFjY2VsZXJhdGlvbkVuZXJneSwgcm90YXRpb25SYXRlRW5lcmd5KTtcblxuICAgIC8vIExvdy1wYXNzIGZpbHRlciB0byBzbW9vdGggdGhlIGVuZXJneSB2YWx1ZXNcbiAgICBjb25zdCBrID0gdGhpcy5fZW5lcmd5RGVjYXk7XG4gICAgdGhpcy5ldmVudCA9IGsgKiB0aGlzLmV2ZW50ICsgKDEgLSBrKSAqIGVuZXJneTtcblxuICAgIC8vIEVtaXQgdGhlIGVuZXJneSB2YWx1ZVxuICAgIHRoaXMuZW1pdCh0aGlzLmV2ZW50KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBFbmVyZ3lNb2R1bGUoKTsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgYElucHV0TW9kdWxlYCBtb2R1bGVcbiAqIEBhdXRob3IgPGEgaHJlZj0nbWFpbHRvOnNlYmFzdGllbkByb2Jhc3praWV3aWN6LmNvbSc+U8OpYmFzdGllbiBSb2Jhc3praWV3aWN6PC9hPiwgPGEgaHJlZj0nbWFpbHRvOk5vcmJlcnQuU2NobmVsbEBpcmNhbS5mcic+Tm9yYmVydCBTY2huZWxsPC9hPlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBgSW5wdXRNb2R1bGVgIGNsYXNzLlxuICogVGhlIGBJbnB1dE1vZHVsZWAgY2xhc3MgYWxsb3dzIHRvIGluc3RhbnRpYXRlIG1vZHVsZXMgdGhhdCBhcmUgcGFydCBvZiB0aGVcbiAqIG1vdGlvbiBpbnB1dCBtb2R1bGUsIGFuZCB0aGF0IHByb3ZpZGUgdmFsdWVzIChmb3IgaW5zdGFuY2UsIGBkZXZpY2VvcmllbnRhdGlvbmAsXG4gKiBgYWNjZWxlcmF0aW9uYCwgYGVuZXJneWApLlxuICpcbiAqIEBjbGFzcyBJbnB1dE1vZHVsZVxuICovXG5jbGFzcyBJbnB1dE1vZHVsZSB7XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW4gYElucHV0TW9kdWxlYCBtb2R1bGUgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlIC0gTmFtZSBvZiB0aGUgbW9kdWxlIC8gZXZlbnQgKCplLmcuKiBgZGV2aWNlb3JpZW50YXRpb24sICdhY2NlbGVyYXRpb24nLCAnZW5lcmd5JykuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihldmVudFR5cGUpIHtcblxuICAgIC8qKlxuICAgICAqIEV2ZW50IHR5cGUgb2YgdGhlIG1vZHVsZS5cbiAgICAgKlxuICAgICAqIEB0aGlzIElucHV0TW9kdWxlXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAY29uc3RhbnRcbiAgICAgKi9cbiAgICB0aGlzLmV2ZW50VHlwZSA9IGV2ZW50VHlwZTtcblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIGxpc3RlbmVycyBhdHRhY2hlZCB0byB0aGlzIG1vZHVsZSAvIGV2ZW50LlxuICAgICAqXG4gICAgICogQHRoaXMgSW5wdXRNb2R1bGVcbiAgICAgKiBAdHlwZSB7ZnVuY3Rpb25bXX1cbiAgICAgKiBAZGVmYXVsdCBbXVxuICAgICAqL1xuICAgIHRoaXMubGlzdGVuZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBFdmVudCBzZW50IGJ5IHRoaXMgbW9kdWxlLlxuICAgICAqXG4gICAgICogQHRoaXMgSW5wdXRNb2R1bGVcbiAgICAgKiBAdHlwZSB7bnVtYmVyfG51bWJlcltdfVxuICAgICAqIEBkZWZhdWx0IG51bGxcbiAgICAgKi9cbiAgICB0aGlzLmV2ZW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIE1vZHVsZSBwcm9taXNlIChyZXNvbHZlZCB3aGVuIHRoZSBtb2R1bGUgaXMgaW5pdGlhbGl6ZWQpLlxuICAgICAqXG4gICAgICogQHRoaXMgSW5wdXRNb2R1bGVcbiAgICAgKiBAdHlwZSB7UHJvbWlzZX1cbiAgICAgKiBAZGVmYXVsdCBudWxsXG4gICAgICovXG4gICAgdGhpcy5wcm9taXNlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEluZGljYXRlcyBpZiB0aGUgbW9kdWxlJ3MgZXZlbnQgdmFsdWVzIGFyZSBjYWxjdWxhdGVkIGZyb20gcGFyZW50IG1vZHVsZXMgLyBldmVudHMuXG4gICAgICpcbiAgICAgKiBAdGhpcyBJbnB1dE1vZHVsZVxuICAgICAqIEB0eXBlIHtib29sfVxuICAgICAqIEBkZWZhdWx0IGZhbHNlXG4gICAgICovXG4gICAgdGhpcy5pc0NhbGN1bGF0ZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEluZGljYXRlcyBpZiB0aGUgbW9kdWxlJ3MgZXZlbnQgdmFsdWVzIGFyZSBwcm92aWRlZCBieSB0aGUgZGV2aWNlJ3Mgc2Vuc29ycy5cbiAgICAgKiAoKkkuZS4qIGluZGljYXRlcyBpZiB0aGUgYCdkZXZpY2Vtb3Rpb24nYCBvciBgJ2RldmljZW9yaWVudGF0aW9uJ2AgZXZlbnRzIHByb3ZpZGUgdGhlIHJlcXVpcmVkIHJhdyB2YWx1ZXMuKVxuICAgICAqXG4gICAgICogQHRoaXMgSW5wdXRNb2R1bGVcbiAgICAgKiBAdHlwZSB7Ym9vbH1cbiAgICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgICAqL1xuICAgIHRoaXMuaXNQcm92aWRlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogUGVyaW9kIGF0IHdoaWNoIHRoZSBtb2R1bGUncyBldmVudHMgYXJlIHNlbnQgKGB1bmRlZmluZWRgIGlmIHRoZSBldmVudHMgYXJlIG5vdCBzZW50IGF0IHJlZ3VsYXIgaW50ZXJ2YWxzKS5cbiAgICAgKlxuICAgICAqIEB0aGlzIElucHV0TW9kdWxlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZGVmYXVsdCB1bmRlZmluZWRcbiAgICAgKi9cbiAgICB0aGlzLnBlcmlvZCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgd2hldGhlciB0aGUgbW9kdWxlIGNhbiBwcm92aWRlIHZhbHVlcyBvciBub3QuXG4gICAqXG4gICAqIEB0eXBlIHtib29sfVxuICAgKiBAcmVhZG9ubHlcbiAgICovXG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAodGhpcy5pc1Byb3ZpZGVkIHx8IHRoaXMuaXNDYWxjdWxhdGVkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyB0aGUgbW9kdWxlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBwcm9taXNlRnVuIC0gUHJvbWlzZSBmdW5jdGlvbiB0aGF0IHRha2VzIHRoZSBgcmVzb2x2ZWAgYW5kIGByZWplY3RgIGZ1bmN0aW9ucyBhcyBhcmd1bWVudHMuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICBpbml0KHByb21pc2VGdW4pIHtcbiAgICB0aGlzLnByb21pc2UgPSBuZXcgUHJvbWlzZShwcm9taXNlRnVuKTtcbiAgICByZXR1cm4gdGhpcy5wcm9taXNlO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0cyB0aGUgbW9kdWxlLlxuICAgKi9cbiAgc3RhcnQoKSB7XG4gICAgLy8gYWJzdHJhY3QgbWV0aG9kXG4gIH1cblxuICAvKipcbiAgICogU3RvcHMgdGhlIG1vZHVsZS5cbiAgICovXG4gIHN0b3AoKSB7XG4gICAgLy8gYWJzdHJhY3QgbWV0aG9kXG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIGxpc3RlbmVyIHRvIHRoZSBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gTGlzdGVuZXIgdG8gYWRkLlxuICAgKi9cbiAgYWRkTGlzdGVuZXIobGlzdGVuZXIpIHtcbiAgICB0aGlzLmxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblxuICAgIC8vIFN0YXJ0IHRoZSBtb2R1bGUgYXMgc29vbiBhcyB0aGVyZSBpcyBhIGxpc3RlbmVyXG4gICAgaWYgKHRoaXMubGlzdGVuZXJzLmxlbmd0aCA9PT0gMSlcbiAgICAgIHRoaXMuc3RhcnQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgbGlzdGVuZXIgZnJvbSB0aGUgbW9kdWxlLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIExpc3RlbmVyIHRvIHJlbW92ZS5cbiAgICovXG4gIHJlbW92ZUxpc3RlbmVyKGxpc3RlbmVyKSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5saXN0ZW5lcnMuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgdGhpcy5saXN0ZW5lcnMuc3BsaWNlKGluZGV4LCAxKTtcblxuICAgIC8vIFN0b3AgdGhlIG1vZHVsZSBpZCB0aGVyZSBhcmUgbm8gbGlzdGVuZXJzXG4gICAgaWYgKHRoaXMubGlzdGVuZXJzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuc3RvcCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb3BhZ2F0ZXMgYW4gZXZlbnQgdG8gYWxsIHRoZSBtb2R1bGUncyBsaXN0ZW5lcnMuXG4gICAqXG4gICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfSBbZXZlbnQ9dGhpcy5ldmVudF0gLSBFdmVudCB2YWx1ZXMgdG8gcHJvcGFnYXRlIHRvIHRoZSBtb2R1bGUncyBsaXN0ZW5lcnMuXG4gICAqL1xuICBlbWl0KGV2ZW50ID0gdGhpcy5ldmVudCkge1xuICAgIGZvciAobGV0IGxpc3RlbmVyIG9mIHRoaXMubGlzdGVuZXJzKVxuICAgICAgbGlzdGVuZXIoZXZlbnQpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXRNb2R1bGU7IiwiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IGBNb3Rpb25JbnB1dGAgbW9kdWxlXG4gKiBAYXV0aG9yIDxhIGhyZWY9J21haWx0bzpzZWJhc3RpZW5Acm9iYXN6a2lld2ljei5jb20nPlPDqWJhc3RpZW4gUm9iYXN6a2lld2ljejwvYT4sIDxhIGhyZWY9J21haWx0bzpOb3JiZXJ0LlNjaG5lbGxAaXJjYW0uZnInPk5vcmJlcnQgU2NobmVsbDwvYT5cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogYE1vdGlvbklucHV0YCBzaW5nbGV0b24uXG4gKiBUaGUgYE1vdGlvbklucHV0YCBzaW5nbGV0b24gYWxsb3dzIHRvIGluaXRpYWxpemUgbW90aW9uIGV2ZW50c1xuICogYW5kIHRvIGxpc3RlbiB0byB0aGVtLlxuICogXG4gKiBAY2xhc3MgTW90aW9uSW5wdXRcbiAqL1xuY2xhc3MgTW90aW9uSW5wdXQge1xuXG4gIC8qKlxuICAgKiBDcmVhdGVzIHRoZSBgTW90aW9uSW5wdXRgIG1vZHVsZSBpbnN0YW5jZS5cbiAgICpcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBjb25zdHJ1Y3RvcigpIHtcblxuICAgIC8qKlxuICAgICAqIFBvb2wgb2YgYWxsIGF2YWlsYWJsZSBtb2R1bGVzLlxuICAgICAqXG4gICAgICogQHRoaXMgTW90aW9uSW5wdXRcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBkZWZhdWx0IHt9XG4gICAgICovXG4gICAgdGhpcy5tb2R1bGVzID0ge307XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIG1vZHVsZSB0byB0aGUgYE1vdGlvbklucHV0YCBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0eXBlLlxuICAgKiBAcGFyYW0ge0lucHV0TW9kdWxlfSBtb2R1bGUgLSBNb2R1bGUgdG8gYWRkIHRvIHRoZSBgTW90aW9uSW5wdXRgIG1vZHVsZS5cbiAgICovXG4gIGFkZE1vZHVsZShldmVudFR5cGUsIG1vZHVsZSkge1xuICAgIHRoaXMubW9kdWxlc1tldmVudFR5cGVdID0gbW9kdWxlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYSBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0eXBlIChtb2R1bGUpIHRvIHJldHJpZXZlLlxuICAgKiBAcmV0dXJuIHtJbnB1dE1vZHVsZX1cbiAgICovXG4gIGdldE1vZHVsZShldmVudFR5cGUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2R1bGVzW2V2ZW50VHlwZV07XG4gIH1cblxuICAvKipcbiAgICogUmVxdWlyZXMgYSBtb2R1bGUuXG4gICAqIElmIHRoZSBtb2R1bGUgaGFzIGJlZW4gaW5pdGlhbGl6ZWQgYWxyZWFkLCByZXR1cm5zIGl0cyBwcm9taXNlLiBPdGhlcndpc2UsXG4gICAqIGluaXRpYWxpemVzIHRoZSBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0eXBlIChtb2R1bGUpIHRvIHJlcXVpcmUuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICByZXF1aXJlTW9kdWxlKGV2ZW50VHlwZSkge1xuICAgIGxldCBtb2R1bGUgPSB0aGlzLmdldE1vZHVsZShldmVudFR5cGUpO1xuXG4gICAgaWYobW9kdWxlLnByb21pc2UpXG4gICAgICByZXR1cm4gbW9kdWxlLnByb21pc2U7XG5cbiAgICByZXR1cm4gbW9kdWxlLmluaXQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyB0aGUgYE1vdGlvbklucHV0YCBtb2R1bGUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nW119IC4uLmV2ZW50VHlwZXMgLSBBcnJheSBvZiB0aGUgZXZlbnQgdHlwZXMgdG8gaW5pdGlhbGl6ZS5cbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gIGluaXQoLi4uZXZlbnRUeXBlcykge1xuICAgIGxldCBtb2R1bGVQcm9taXNlcyA9IGV2ZW50VHlwZXMubWFwKCh2YWx1ZSkgPT4ge1xuICAgICAgbGV0IG1vZHVsZSA9IHRoaXMuZ2V0TW9kdWxlKHZhbHVlKTtcbiAgICAgIHJldHVybiBtb2R1bGUuaW5pdCgpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKG1vZHVsZVByb21pc2VzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0eXBlIChtb2R1bGUpIHRvIGFkZCBhIGxpc3RlbmVyIHRvLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIExpc3RlbmVyIHRvIGFkZC5cbiAgICovXG4gIGFkZExpc3RlbmVyKGV2ZW50VHlwZSwgbGlzdGVuZXIpIHtcbiAgICBsZXQgbW9kdWxlID0gdGhpcy5nZXRNb2R1bGUoZXZlbnRUeXBlKTtcbiAgICBtb2R1bGUuYWRkTGlzdGVuZXIobGlzdGVuZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBsaXN0ZW5lci5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZSAtIE5hbWUgb2YgdGhlIGV2ZW50IHR5cGUgKG1vZHVsZSkgdG8gYWRkIGEgbGlzdGVuZXIgdG8uXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gTGlzdGVuZXIgdG8gcmVtb3ZlLlxuICAgKi9cbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnRUeXBlLCBsaXN0ZW5lcikge1xuICAgIGxldCBtb2R1bGUgPSB0aGlzLmdldE1vZHVsZShldmVudFR5cGUpO1xuICAgIG1vZHVsZS5yZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcik7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgTW90aW9uSW5wdXQoKTsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgTW90aW9uIGlucHV0IGluZGV4IGZpbGVcbiAqIEBhdXRob3IgPGEgaHJlZj0nbWFpbHRvOnNlYmFzdGllbkByb2Jhc3praWV3aWN6LmNvbSc+U8OpYmFzdGllbiBSb2Jhc3praWV3aWN6PC9hPiwgPGEgaHJlZj0nbWFpbHRvOk5vcmJlcnQuU2NobmVsbEBpcmNhbS5mcic+Tm9yYmVydCBTY2huZWxsPC9hPlxuICogQGRlc2NyaXB0aW9uIFRoZSBtb3Rpb24gaW5wdXQgbW9kdWxlIGNhbiBiZSB1c2VkIGFzIGZvbGxvd3M6XG4gKiBgYGBcbiAqIGNvbnN0IGlucHV0ID0gcmVxdWlyZSgnbW90aW9uLWlucHV0Jyk7XG4gKiBjb25zdCByZXF1aXJlZEV2ZW50cyA9IFsnYWNjZWxlcmF0aW9uJywgJ29yaWVudGF0aW9uJywgJ2VuZXJneSddO1xuICogXG4gKiBpbnB1dFxuICogIC5pbml0KHJlcXVpcmVkRXZlbnRzKVxuICogIC50aGVuKChtb2R1bGVzKSA9PiB7XG4gKiAgICBjb25zdCBbYWNjZWxlcmF0aW9uLCBvcmllbnRhdGlvbiwgZW5lcmd5XSA9IG1vZHVsZXM7XG4gKlxuICogICAgaWYgKGFjY2VsZXJhdGlvbi5pc1ZhbGlkKSB7XG4gKiAgICAgIGlucHV0LmFkZExpc3RlbmVyKCdhY2NlbGVyYXRpb24nLCAodmFsKSA9PiB7XG4gKiAgICAgICAgY29uc29sZS5sb2coJ2FjY2VsZXJhdGlvbicsIHZhbCk7XG4gKiAgICAgICAgLy8gZG8gc29tZXRoaW5nIHdpdGggdGhlIGFjY2VsZXJhdGlvbiB2YWx1ZXNcbiAqICAgICAgfSk7XG4gKiAgICB9XG4gKlxuICogICAgLy8gZG8gc29tZXRoaW5nIGVsc2Ugd2l0aCB0aGUgb3RoZXIgbW9kdWxlc1xuICogIH0pO1xuICogYGBgXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbW90aW9uSW5wdXQgPSByZXF1aXJlKCcuL2Rpc3QvTW90aW9uSW5wdXQnKTtcbnZhciBkZXZpY2VvcmllbnRhdGlvbk1vZHVsZSA9IHJlcXVpcmUoJy4vZGlzdC9EZXZpY2VPcmllbnRhdGlvbk1vZHVsZScpO1xudmFyIGRldmljZW1vdGlvbk1vZHVsZSA9IHJlcXVpcmUoJy4vZGlzdC9EZXZpY2VNb3Rpb25Nb2R1bGUnKTtcbnZhciBlbmVyZ3kgPSByZXF1aXJlKCcuL2Rpc3QvRW5lcmd5TW9kdWxlJyk7XG5cbm1vdGlvbklucHV0LmFkZE1vZHVsZSgnZGV2aWNlbW90aW9uJywgZGV2aWNlbW90aW9uTW9kdWxlKTtcbm1vdGlvbklucHV0LmFkZE1vZHVsZSgnZGV2aWNlb3JpZW50YXRpb24nLCBkZXZpY2VvcmllbnRhdGlvbk1vZHVsZSk7XG5tb3Rpb25JbnB1dC5hZGRNb2R1bGUoJ2FjY2VsZXJhdGlvbkluY2x1ZGluZ0dyYXZpdHknLCBkZXZpY2Vtb3Rpb25Nb2R1bGUuYWNjZWxlcmF0aW9uSW5jbHVkaW5nR3Jhdml0eSk7XG5tb3Rpb25JbnB1dC5hZGRNb2R1bGUoJ2FjY2VsZXJhdGlvbicsIGRldmljZW1vdGlvbk1vZHVsZS5hY2NlbGVyYXRpb24pO1xubW90aW9uSW5wdXQuYWRkTW9kdWxlKCdyb3RhdGlvblJhdGUnLCBkZXZpY2Vtb3Rpb25Nb2R1bGUucm90YXRpb25SYXRlKTtcbm1vdGlvbklucHV0LmFkZE1vZHVsZSgnb3JpZW50YXRpb24nLCBkZXZpY2VvcmllbnRhdGlvbk1vZHVsZS5vcmllbnRhdGlvbik7XG5tb3Rpb25JbnB1dC5hZGRNb2R1bGUoJ29yaWVudGF0aW9uQWx0JywgZGV2aWNlb3JpZW50YXRpb25Nb2R1bGUub3JpZW50YXRpb25BbHQpO1xubW90aW9uSW5wdXQuYWRkTW9kdWxlKCdlbmVyZ3knLCBlbmVyZ3kpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1vdGlvbklucHV0OyIsIi8qIVxuICogUGxhdGZvcm0uanMgdjEuMy4wIDxodHRwOi8vbXRocy5iZS9wbGF0Zm9ybT5cbiAqIENvcHlyaWdodCAyMDEwLTIwMTQgSm9obi1EYXZpZCBEYWx0b24gPGh0dHA6Ly9hbGx5b3VjYW5sZWV0LmNvbS8+XG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHA6Ly9tdGhzLmJlL21pdD5cbiAqL1xuOyhmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIC8qKiBVc2VkIHRvIGRldGVybWluZSBpZiB2YWx1ZXMgYXJlIG9mIHRoZSBsYW5ndWFnZSB0eXBlIGBPYmplY3RgICovXG4gIHZhciBvYmplY3RUeXBlcyA9IHtcbiAgICAnZnVuY3Rpb24nOiB0cnVlLFxuICAgICdvYmplY3QnOiB0cnVlXG4gIH07XG5cbiAgLyoqIFVzZWQgYXMgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QgKi9cbiAgdmFyIHJvb3QgPSAob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KSB8fCB0aGlzO1xuXG4gIC8qKiBCYWNrdXAgcG9zc2libGUgZ2xvYmFsIG9iamVjdCAqL1xuICB2YXIgb2xkUm9vdCA9IHJvb3Q7XG5cbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYCAqL1xuICB2YXIgZnJlZUV4cG9ydHMgPSBvYmplY3RUeXBlc1t0eXBlb2YgZXhwb3J0c10gJiYgZXhwb3J0cztcblxuICAvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAgKi9cbiAgdmFyIGZyZWVNb2R1bGUgPSBvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSAmJiBtb2R1bGU7XG5cbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcyBvciBCcm93c2VyaWZpZWQgY29kZSBhbmQgdXNlIGl0IGFzIGByb290YCAqL1xuICB2YXIgZnJlZUdsb2JhbCA9IGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWw7XG4gIGlmIChmcmVlR2xvYmFsICYmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLnNlbGYgPT09IGZyZWVHbG9iYWwpKSB7XG4gICAgcm9vdCA9IGZyZWVHbG9iYWw7XG4gIH1cblxuICAvKipcbiAgICogVXNlZCBhcyB0aGUgbWF4aW11bSBsZW5ndGggb2YgYW4gYXJyYXktbGlrZSBvYmplY3QuXG4gICAqIFNlZSB0aGUgW0VTNiBzcGVjXShodHRwOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy10b2xlbmd0aClcbiAgICogZm9yIG1vcmUgZGV0YWlscy5cbiAgICovXG4gIHZhciBtYXhTYWZlSW50ZWdlciA9IE1hdGgucG93KDIsIDUzKSAtIDE7XG5cbiAgLyoqIE9wZXJhIHJlZ2V4cCAqL1xuICB2YXIgcmVPcGVyYSA9IC9cXGJPcGVyYS87XG5cbiAgLyoqIFBvc3NpYmxlIGdsb2JhbCBvYmplY3QgKi9cbiAgdmFyIHRoaXNCaW5kaW5nID0gdGhpcztcblxuICAvKiogVXNlZCBmb3IgbmF0aXZlIG1ldGhvZCByZWZlcmVuY2VzICovXG4gIHZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbiAgLyoqIFVzZWQgdG8gY2hlY2sgZm9yIG93biBwcm9wZXJ0aWVzIG9mIGFuIG9iamVjdCAqL1xuICB2YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvKiogVXNlZCB0byByZXNvbHZlIHRoZSBpbnRlcm5hbCBgW1tDbGFzc11dYCBvZiB2YWx1ZXMgKi9cbiAgdmFyIHRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbiAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbiAgLyoqXG4gICAqIENhcGl0YWxpemVzIGEgc3RyaW5nIHZhbHVlLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nIFRoZSBzdHJpbmcgdG8gY2FwaXRhbGl6ZS5cbiAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGNhcGl0YWxpemVkIHN0cmluZy5cbiAgICovXG4gIGZ1bmN0aW9uIGNhcGl0YWxpemUoc3RyaW5nKSB7XG4gICAgc3RyaW5nID0gU3RyaW5nKHN0cmluZyk7XG4gICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHV0aWxpdHkgZnVuY3Rpb24gdG8gY2xlYW4gdXAgdGhlIE9TIG5hbWUuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBvcyBUaGUgT1MgbmFtZSB0byBjbGVhbiB1cC5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtwYXR0ZXJuXSBBIGBSZWdFeHBgIHBhdHRlcm4gbWF0Y2hpbmcgdGhlIE9TIG5hbWUuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbbGFiZWxdIEEgbGFiZWwgZm9yIHRoZSBPUy5cbiAgICovXG4gIGZ1bmN0aW9uIGNsZWFudXBPUyhvcywgcGF0dGVybiwgbGFiZWwpIHtcbiAgICAvLyBwbGF0Zm9ybSB0b2tlbnMgZGVmaW5lZCBhdFxuICAgIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9tczUzNzUwMyhWUy44NSkuYXNweFxuICAgIC8vIGh0dHA6Ly93ZWIuYXJjaGl2ZS5vcmcvd2ViLzIwMDgxMTIyMDUzOTUwL2h0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9tczUzNzUwMyhWUy44NSkuYXNweFxuICAgIHZhciBkYXRhID0ge1xuICAgICAgJzYuNCc6ICAnMTAnLFxuICAgICAgJzYuMyc6ICAnOC4xJyxcbiAgICAgICc2LjInOiAgJzgnLFxuICAgICAgJzYuMSc6ICAnU2VydmVyIDIwMDggUjIgLyA3JyxcbiAgICAgICc2LjAnOiAgJ1NlcnZlciAyMDA4IC8gVmlzdGEnLFxuICAgICAgJzUuMic6ICAnU2VydmVyIDIwMDMgLyBYUCA2NC1iaXQnLFxuICAgICAgJzUuMSc6ICAnWFAnLFxuICAgICAgJzUuMDEnOiAnMjAwMCBTUDEnLFxuICAgICAgJzUuMCc6ICAnMjAwMCcsXG4gICAgICAnNC4wJzogICdOVCcsXG4gICAgICAnNC45MCc6ICdNRSdcbiAgICB9O1xuICAgIC8vIGRldGVjdCBXaW5kb3dzIHZlcnNpb24gZnJvbSBwbGF0Zm9ybSB0b2tlbnNcbiAgICBpZiAocGF0dGVybiAmJiBsYWJlbCAmJiAvXldpbi9pLnRlc3Qob3MpICYmXG4gICAgICAgIChkYXRhID0gZGF0YVswLypPcGVyYSA5LjI1IGZpeCovLCAvW1xcZC5dKyQvLmV4ZWMob3MpXSkpIHtcbiAgICAgIG9zID0gJ1dpbmRvd3MgJyArIGRhdGE7XG4gICAgfVxuICAgIC8vIGNvcnJlY3QgY2hhcmFjdGVyIGNhc2UgYW5kIGNsZWFudXBcbiAgICBvcyA9IFN0cmluZyhvcyk7XG5cbiAgICBpZiAocGF0dGVybiAmJiBsYWJlbCkge1xuICAgICAgb3MgPSBvcy5yZXBsYWNlKFJlZ0V4cChwYXR0ZXJuLCAnaScpLCBsYWJlbCk7XG4gICAgfVxuXG4gICAgb3MgPSBmb3JtYXQoXG4gICAgICBvcy5yZXBsYWNlKC8gY2UkL2ksICcgQ0UnKVxuICAgICAgICAucmVwbGFjZSgvXFxiaHB3L2ksICd3ZWInKVxuICAgICAgICAucmVwbGFjZSgvXFxiTWFjaW50b3NoXFxiLywgJ01hYyBPUycpXG4gICAgICAgIC5yZXBsYWNlKC9fUG93ZXJQQ1xcYi9pLCAnIE9TJylcbiAgICAgICAgLnJlcGxhY2UoL1xcYihPUyBYKSBbXiBcXGRdKy9pLCAnJDEnKVxuICAgICAgICAucmVwbGFjZSgvXFxiTWFjIChPUyBYKVxcYi8sICckMScpXG4gICAgICAgIC5yZXBsYWNlKC9cXC8oXFxkKS8sICcgJDEnKVxuICAgICAgICAucmVwbGFjZSgvXy9nLCAnLicpXG4gICAgICAgIC5yZXBsYWNlKC8oPzogQmVQQ3xbIC5dKmZjWyBcXGQuXSspJC9pLCAnJylcbiAgICAgICAgLnJlcGxhY2UoL1xcYng4NlxcLjY0XFxiL2dpLCAneDg2XzY0JylcbiAgICAgICAgLnJlcGxhY2UoL1xcYihXaW5kb3dzIFBob25lKSBPU1xcYi8sICckMScpXG4gICAgICAgIC5zcGxpdCgnIG9uICcpWzBdXG4gICAgKTtcblxuICAgIHJldHVybiBvcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBbiBpdGVyYXRpb24gdXRpbGl0eSBmb3IgYXJyYXlzIGFuZCBvYmplY3RzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXG4gICAqL1xuICBmdW5jdGlvbiBlYWNoKG9iamVjdCwgY2FsbGJhY2spIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gb2JqZWN0ID8gb2JqZWN0Lmxlbmd0aCA6IDA7XG5cbiAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJyAmJiBsZW5ndGggPiAtMSAmJiBsZW5ndGggPD0gbWF4U2FmZUludGVnZXIpIHtcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKG9iamVjdFtpbmRleF0sIGluZGV4LCBvYmplY3QpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3JPd24ob2JqZWN0LCBjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRyaW0gYW5kIGNvbmRpdGlvbmFsbHkgY2FwaXRhbGl6ZSBzdHJpbmcgdmFsdWVzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nIFRoZSBzdHJpbmcgdG8gZm9ybWF0LlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIHN0cmluZy5cbiAgICovXG4gIGZ1bmN0aW9uIGZvcm1hdChzdHJpbmcpIHtcbiAgICBzdHJpbmcgPSB0cmltKHN0cmluZyk7XG4gICAgcmV0dXJuIC9eKD86d2ViT1N8aSg/Ok9TfFApKS8udGVzdChzdHJpbmcpXG4gICAgICA/IHN0cmluZ1xuICAgICAgOiBjYXBpdGFsaXplKHN0cmluZyk7XG4gIH1cblxuICAvKipcbiAgICogSXRlcmF0ZXMgb3ZlciBhbiBvYmplY3QncyBvd24gcHJvcGVydGllcywgZXhlY3V0aW5nIHRoZSBgY2FsbGJhY2tgIGZvciBlYWNoLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gZXhlY3V0ZWQgcGVyIG93biBwcm9wZXJ0eS5cbiAgICovXG4gIGZ1bmN0aW9uIGZvck93bihvYmplY3QsIGNhbGxiYWNrKSB7XG4gICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSB7XG4gICAgICAgIGNhbGxiYWNrKG9iamVjdFtrZXldLCBrZXksIG9iamVjdCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGludGVybmFsIGBbW0NsYXNzXV1gIG9mIGEgdmFsdWUuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlLlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgYFtbQ2xhc3NdXWAuXG4gICAqL1xuICBmdW5jdGlvbiBnZXRDbGFzc09mKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09IG51bGxcbiAgICAgID8gY2FwaXRhbGl6ZSh2YWx1ZSlcbiAgICAgIDogdG9TdHJpbmcuY2FsbCh2YWx1ZSkuc2xpY2UoOCwgLTEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhvc3Qgb2JqZWN0cyBjYW4gcmV0dXJuIHR5cGUgdmFsdWVzIHRoYXQgYXJlIGRpZmZlcmVudCBmcm9tIHRoZWlyIGFjdHVhbFxuICAgKiBkYXRhIHR5cGUuIFRoZSBvYmplY3RzIHdlIGFyZSBjb25jZXJuZWQgd2l0aCB1c3VhbGx5IHJldHVybiBub24tcHJpbWl0aXZlXG4gICAqIHR5cGVzIG9mIFwib2JqZWN0XCIsIFwiZnVuY3Rpb25cIiwgb3IgXCJ1bmtub3duXCIuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7Kn0gb2JqZWN0IFRoZSBvd25lciBvZiB0aGUgcHJvcGVydHkuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eSBUaGUgcHJvcGVydHkgdG8gY2hlY2suXG4gICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgcHJvcGVydHkgdmFsdWUgaXMgYSBub24tcHJpbWl0aXZlLCBlbHNlIGBmYWxzZWAuXG4gICAqL1xuICBmdW5jdGlvbiBpc0hvc3RUeXBlKG9iamVjdCwgcHJvcGVydHkpIHtcbiAgICB2YXIgdHlwZSA9IG9iamVjdCAhPSBudWxsID8gdHlwZW9mIG9iamVjdFtwcm9wZXJ0eV0gOiAnbnVtYmVyJztcbiAgICByZXR1cm4gIS9eKD86Ym9vbGVhbnxudW1iZXJ8c3RyaW5nfHVuZGVmaW5lZCkkLy50ZXN0KHR5cGUpICYmXG4gICAgICAodHlwZSA9PSAnb2JqZWN0JyA/ICEhb2JqZWN0W3Byb3BlcnR5XSA6IHRydWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmVzIGEgc3RyaW5nIGZvciB1c2UgaW4gYSBgUmVnRXhwYCBieSBtYWtpbmcgaHlwaGVucyBhbmQgc3BhY2VzIG9wdGlvbmFsLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nIFRoZSBzdHJpbmcgdG8gcXVhbGlmeS5cbiAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHF1YWxpZmllZCBzdHJpbmcuXG4gICAqL1xuICBmdW5jdGlvbiBxdWFsaWZ5KHN0cmluZykge1xuICAgIHJldHVybiBTdHJpbmcoc3RyaW5nKS5yZXBsYWNlKC8oWyAtXSkoPyEkKS9nLCAnJDE/Jyk7XG4gIH1cblxuICAvKipcbiAgICogQSBiYXJlLWJvbmVzIGBBcnJheSNyZWR1Y2VgIGxpa2UgdXRpbGl0eSBmdW5jdGlvbi5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxuICAgKiBAcmV0dXJucyB7Kn0gVGhlIGFjY3VtdWxhdGVkIHJlc3VsdC5cbiAgICovXG4gIGZ1bmN0aW9uIHJlZHVjZShhcnJheSwgY2FsbGJhY2spIHtcbiAgICB2YXIgYWNjdW11bGF0b3IgPSBudWxsO1xuICAgIGVhY2goYXJyYXksIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgYWNjdW11bGF0b3IgPSBjYWxsYmFjayhhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBhcnJheSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZSBmcm9tIGEgc3RyaW5nLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nIFRoZSBzdHJpbmcgdG8gdHJpbS5cbiAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHRyaW1tZWQgc3RyaW5nLlxuICAgKi9cbiAgZnVuY3Rpb24gdHJpbShzdHJpbmcpIHtcbiAgICByZXR1cm4gU3RyaW5nKHN0cmluZykucmVwbGFjZSgvXiArfCArJC9nLCAnJyk7XG4gIH1cblxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBwbGF0Zm9ybSBvYmplY3QuXG4gICAqXG4gICAqIEBtZW1iZXJPZiBwbGF0Zm9ybVxuICAgKiBAcGFyYW0ge09iamVjdHxzdHJpbmd9IFt1YT1uYXZpZ2F0b3IudXNlckFnZW50XSBUaGUgdXNlciBhZ2VudCBzdHJpbmcgb3JcbiAgICogIGNvbnRleHQgb2JqZWN0LlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBIHBsYXRmb3JtIG9iamVjdC5cbiAgICovXG4gIGZ1bmN0aW9uIHBhcnNlKHVhKSB7XG5cbiAgICAvKiogVGhlIGVudmlyb25tZW50IGNvbnRleHQgb2JqZWN0ICovXG4gICAgdmFyIGNvbnRleHQgPSByb290O1xuXG4gICAgLyoqIFVzZWQgdG8gZmxhZyB3aGVuIGEgY3VzdG9tIGNvbnRleHQgaXMgcHJvdmlkZWQgKi9cbiAgICB2YXIgaXNDdXN0b21Db250ZXh0ID0gdWEgJiYgdHlwZW9mIHVhID09ICdvYmplY3QnICYmIGdldENsYXNzT2YodWEpICE9ICdTdHJpbmcnO1xuXG4gICAgLy8ganVnZ2xlIGFyZ3VtZW50c1xuICAgIGlmIChpc0N1c3RvbUNvbnRleHQpIHtcbiAgICAgIGNvbnRleHQgPSB1YTtcbiAgICAgIHVhID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKiogQnJvd3NlciBuYXZpZ2F0b3Igb2JqZWN0ICovXG4gICAgdmFyIG5hdiA9IGNvbnRleHQubmF2aWdhdG9yIHx8IHt9O1xuXG4gICAgLyoqIEJyb3dzZXIgdXNlciBhZ2VudCBzdHJpbmcgKi9cbiAgICB2YXIgdXNlckFnZW50ID0gbmF2LnVzZXJBZ2VudCB8fCAnJztcblxuICAgIHVhIHx8ICh1YSA9IHVzZXJBZ2VudCk7XG5cbiAgICAvKiogVXNlZCB0byBmbGFnIHdoZW4gYHRoaXNCaW5kaW5nYCBpcyB0aGUgW01vZHVsZVNjb3BlXSAqL1xuICAgIHZhciBpc01vZHVsZVNjb3BlID0gaXNDdXN0b21Db250ZXh0IHx8IHRoaXNCaW5kaW5nID09IG9sZFJvb3Q7XG5cbiAgICAvKiogVXNlZCB0byBkZXRlY3QgaWYgYnJvd3NlciBpcyBsaWtlIENocm9tZSAqL1xuICAgIHZhciBsaWtlQ2hyb21lID0gaXNDdXN0b21Db250ZXh0XG4gICAgICA/ICEhbmF2Lmxpa2VDaHJvbWVcbiAgICAgIDogL1xcYkNocm9tZVxcYi8udGVzdCh1YSkgJiYgIS9pbnRlcm5hbHxcXG4vaS50ZXN0KHRvU3RyaW5nLnRvU3RyaW5nKCkpO1xuXG4gICAgLyoqIEludGVybmFsIGBbW0NsYXNzXV1gIHZhbHVlIHNob3J0Y3V0cyAqL1xuICAgIHZhciBvYmplY3RDbGFzcyA9ICdPYmplY3QnLFxuICAgICAgICBhaXJSdW50aW1lQ2xhc3MgPSBpc0N1c3RvbUNvbnRleHQgPyBvYmplY3RDbGFzcyA6ICdTY3JpcHRCcmlkZ2luZ1Byb3h5T2JqZWN0JyxcbiAgICAgICAgZW52aXJvQ2xhc3MgPSBpc0N1c3RvbUNvbnRleHQgPyBvYmplY3RDbGFzcyA6ICdFbnZpcm9ubWVudCcsXG4gICAgICAgIGphdmFDbGFzcyA9IChpc0N1c3RvbUNvbnRleHQgJiYgY29udGV4dC5qYXZhKSA/ICdKYXZhUGFja2FnZScgOiBnZXRDbGFzc09mKGNvbnRleHQuamF2YSksXG4gICAgICAgIHBoYW50b21DbGFzcyA9IGlzQ3VzdG9tQ29udGV4dCA/IG9iamVjdENsYXNzIDogJ1J1bnRpbWVPYmplY3QnO1xuXG4gICAgLyoqIERldGVjdCBKYXZhIGVudmlyb25tZW50ICovXG4gICAgdmFyIGphdmEgPSAvXFxiSmF2YS8udGVzdChqYXZhQ2xhc3MpICYmIGNvbnRleHQuamF2YTtcblxuICAgIC8qKiBEZXRlY3QgUmhpbm8gKi9cbiAgICB2YXIgcmhpbm8gPSBqYXZhICYmIGdldENsYXNzT2YoY29udGV4dC5lbnZpcm9ubWVudCkgPT0gZW52aXJvQ2xhc3M7XG5cbiAgICAvKiogQSBjaGFyYWN0ZXIgdG8gcmVwcmVzZW50IGFscGhhICovXG4gICAgdmFyIGFscGhhID0gamF2YSA/ICdhJyA6ICdcXHUwM2IxJztcblxuICAgIC8qKiBBIGNoYXJhY3RlciB0byByZXByZXNlbnQgYmV0YSAqL1xuICAgIHZhciBiZXRhID0gamF2YSA/ICdiJyA6ICdcXHUwM2IyJztcblxuICAgIC8qKiBCcm93c2VyIGRvY3VtZW50IG9iamVjdCAqL1xuICAgIHZhciBkb2MgPSBjb250ZXh0LmRvY3VtZW50IHx8IHt9O1xuXG4gICAgLyoqXG4gICAgICogRGV0ZWN0IE9wZXJhIGJyb3dzZXIgKFByZXN0by1iYXNlZClcbiAgICAgKiBodHRwOi8vd3d3Lmhvd3RvY3JlYXRlLmNvLnVrL29wZXJhU3R1ZmYvb3BlcmFPYmplY3QuaHRtbFxuICAgICAqIGh0dHA6Ly9kZXYub3BlcmEuY29tL2FydGljbGVzL3ZpZXcvb3BlcmEtbWluaS13ZWItY29udGVudC1hdXRob3JpbmctZ3VpZGVsaW5lcy8jb3BlcmFtaW5pXG4gICAgICovXG4gICAgdmFyIG9wZXJhID0gY29udGV4dC5vcGVyYW1pbmkgfHwgY29udGV4dC5vcGVyYTtcblxuICAgIC8qKiBPcGVyYSBgW1tDbGFzc11dYCAqL1xuICAgIHZhciBvcGVyYUNsYXNzID0gcmVPcGVyYS50ZXN0KG9wZXJhQ2xhc3MgPSAoaXNDdXN0b21Db250ZXh0ICYmIG9wZXJhKSA/IG9wZXJhWydbW0NsYXNzXV0nXSA6IGdldENsYXNzT2Yob3BlcmEpKVxuICAgICAgPyBvcGVyYUNsYXNzXG4gICAgICA6IChvcGVyYSA9IG51bGwpO1xuXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gICAgLyoqIFRlbXBvcmFyeSB2YXJpYWJsZSB1c2VkIG92ZXIgdGhlIHNjcmlwdCdzIGxpZmV0aW1lICovXG4gICAgdmFyIGRhdGE7XG5cbiAgICAvKiogVGhlIENQVSBhcmNoaXRlY3R1cmUgKi9cbiAgICB2YXIgYXJjaCA9IHVhO1xuXG4gICAgLyoqIFBsYXRmb3JtIGRlc2NyaXB0aW9uIGFycmF5ICovXG4gICAgdmFyIGRlc2NyaXB0aW9uID0gW107XG5cbiAgICAvKiogUGxhdGZvcm0gYWxwaGEvYmV0YSBpbmRpY2F0b3IgKi9cbiAgICB2YXIgcHJlcmVsZWFzZSA9IG51bGw7XG5cbiAgICAvKiogQSBmbGFnIHRvIGluZGljYXRlIHRoYXQgZW52aXJvbm1lbnQgZmVhdHVyZXMgc2hvdWxkIGJlIHVzZWQgdG8gcmVzb2x2ZSB0aGUgcGxhdGZvcm0gKi9cbiAgICB2YXIgdXNlRmVhdHVyZXMgPSB1YSA9PSB1c2VyQWdlbnQ7XG5cbiAgICAvKiogVGhlIGJyb3dzZXIvZW52aXJvbm1lbnQgdmVyc2lvbiAqL1xuICAgIHZhciB2ZXJzaW9uID0gdXNlRmVhdHVyZXMgJiYgb3BlcmEgJiYgdHlwZW9mIG9wZXJhLnZlcnNpb24gPT0gJ2Z1bmN0aW9uJyAmJiBvcGVyYS52ZXJzaW9uKCk7XG5cbiAgICAvKiogQSBmbGFnIHRvIGluZGljYXRlIGlmIHRoZSBPUyBlbmRzIHdpdGggXCIvIFZlcnNpb25cIiAqL1xuICAgIHZhciBpc1NwZWNpYWxDYXNlZE9TO1xuXG4gICAgLyogRGV0ZWN0YWJsZSBsYXlvdXQgZW5naW5lcyAob3JkZXIgaXMgaW1wb3J0YW50KSAqL1xuICAgIHZhciBsYXlvdXQgPSBnZXRMYXlvdXQoW1xuICAgICAgJ1RyaWRlbnQnLFxuICAgICAgeyAnbGFiZWwnOiAnV2ViS2l0JywgJ3BhdHRlcm4nOiAnQXBwbGVXZWJLaXQnIH0sXG4gICAgICAnaUNhYicsXG4gICAgICAnUHJlc3RvJyxcbiAgICAgICdOZXRGcm9udCcsXG4gICAgICAnVGFzbWFuJyxcbiAgICAgICdLSFRNTCcsXG4gICAgICAnR2Vja28nXG4gICAgXSk7XG5cbiAgICAvKiBEZXRlY3RhYmxlIGJyb3dzZXIgbmFtZXMgKG9yZGVyIGlzIGltcG9ydGFudCkgKi9cbiAgICB2YXIgbmFtZSA9IGdldE5hbWUoW1xuICAgICAgJ0Fkb2JlIEFJUicsXG4gICAgICAnQXJvcmEnLFxuICAgICAgJ0F2YW50IEJyb3dzZXInLFxuICAgICAgJ0JyZWFjaCcsXG4gICAgICAnQ2FtaW5vJyxcbiAgICAgICdFcGlwaGFueScsXG4gICAgICAnRmVubmVjJyxcbiAgICAgICdGbG9jaycsXG4gICAgICAnR2FsZW9uJyxcbiAgICAgICdHcmVlbkJyb3dzZXInLFxuICAgICAgJ2lDYWInLFxuICAgICAgJ0ljZXdlYXNlbCcsXG4gICAgICB7ICdsYWJlbCc6ICdTUldhcmUgSXJvbicsICdwYXR0ZXJuJzogJ0lyb24nIH0sXG4gICAgICAnSy1NZWxlb24nLFxuICAgICAgJ0tvbnF1ZXJvcicsXG4gICAgICAnTHVuYXNjYXBlJyxcbiAgICAgICdNYXh0aG9uJyxcbiAgICAgICdNaWRvcmknLFxuICAgICAgJ05vb2sgQnJvd3NlcicsXG4gICAgICAnUGhhbnRvbUpTJyxcbiAgICAgICdSYXZlbicsXG4gICAgICAnUmVrb25xJyxcbiAgICAgICdSb2NrTWVsdCcsXG4gICAgICAnU2VhTW9ua2V5JyxcbiAgICAgIHsgJ2xhYmVsJzogJ1NpbGsnLCAncGF0dGVybic6ICcoPzpDbG91ZDl8U2lsay1BY2NlbGVyYXRlZCknIH0sXG4gICAgICAnU2xlaXBuaXInLFxuICAgICAgJ1NsaW1Ccm93c2VyJyxcbiAgICAgICdTdW5yaXNlJyxcbiAgICAgICdTd2lmdGZveCcsXG4gICAgICAnV2ViUG9zaXRpdmUnLFxuICAgICAgJ09wZXJhIE1pbmknLFxuICAgICAgeyAnbGFiZWwnOiAnT3BlcmEgTWluaScsICdwYXR0ZXJuJzogJ09QaU9TJyB9LFxuICAgICAgJ09wZXJhJyxcbiAgICAgIHsgJ2xhYmVsJzogJ09wZXJhJywgJ3BhdHRlcm4nOiAnT1BSJyB9LFxuICAgICAgJ0Nocm9tZScsXG4gICAgICB7ICdsYWJlbCc6ICdDaHJvbWUgTW9iaWxlJywgJ3BhdHRlcm4nOiAnKD86Q3JpT1N8Q3JNbyknIH0sXG4gICAgICB7ICdsYWJlbCc6ICdGaXJlZm94JywgJ3BhdHRlcm4nOiAnKD86RmlyZWZveHxNaW5lZmllbGQpJyB9LFxuICAgICAgeyAnbGFiZWwnOiAnSUUnLCAncGF0dGVybic6ICdJRU1vYmlsZScgfSxcbiAgICAgIHsgJ2xhYmVsJzogJ0lFJywgJ3BhdHRlcm4nOiAnTVNJRScgfSxcbiAgICAgICdTYWZhcmknXG4gICAgXSk7XG5cbiAgICAvKiBEZXRlY3RhYmxlIHByb2R1Y3RzIChvcmRlciBpcyBpbXBvcnRhbnQpICovXG4gICAgdmFyIHByb2R1Y3QgPSBnZXRQcm9kdWN0KFtcbiAgICAgIHsgJ2xhYmVsJzogJ0JsYWNrQmVycnknLCAncGF0dGVybic6ICdCQjEwJyB9LFxuICAgICAgJ0JsYWNrQmVycnknLFxuICAgICAgeyAnbGFiZWwnOiAnR2FsYXh5IFMnLCAncGF0dGVybic6ICdHVC1JOTAwMCcgfSxcbiAgICAgIHsgJ2xhYmVsJzogJ0dhbGF4eSBTMicsICdwYXR0ZXJuJzogJ0dULUk5MTAwJyB9LFxuICAgICAgeyAnbGFiZWwnOiAnR2FsYXh5IFMzJywgJ3BhdHRlcm4nOiAnR1QtSTkzMDAnIH0sXG4gICAgICB7ICdsYWJlbCc6ICdHYWxheHkgUzQnLCAncGF0dGVybic6ICdHVC1JOTUwMCcgfSxcbiAgICAgICdHb29nbGUgVFYnLFxuICAgICAgJ0x1bWlhJyxcbiAgICAgICdpUGFkJyxcbiAgICAgICdpUG9kJyxcbiAgICAgICdpUGhvbmUnLFxuICAgICAgJ0tpbmRsZScsXG4gICAgICB7ICdsYWJlbCc6ICdLaW5kbGUgRmlyZScsICdwYXR0ZXJuJzogJyg/OkNsb3VkOXxTaWxrLUFjY2VsZXJhdGVkKScgfSxcbiAgICAgICdOb29rJyxcbiAgICAgICdQbGF5Qm9vaycsXG4gICAgICAnUGxheVN0YXRpb24gNCcsXG4gICAgICAnUGxheVN0YXRpb24gMycsXG4gICAgICAnUGxheVN0YXRpb24gVml0YScsXG4gICAgICAnVG91Y2hQYWQnLFxuICAgICAgJ1RyYW5zZm9ybWVyJyxcbiAgICAgIHsgJ2xhYmVsJzogJ1dpaSBVJywgJ3BhdHRlcm4nOiAnV2lpVScgfSxcbiAgICAgICdXaWknLFxuICAgICAgJ1hib3ggT25lJyxcbiAgICAgIHsgJ2xhYmVsJzogJ1hib3ggMzYwJywgJ3BhdHRlcm4nOiAnWGJveCcgfSxcbiAgICAgICdYb29tJ1xuICAgIF0pO1xuXG4gICAgLyogRGV0ZWN0YWJsZSBtYW51ZmFjdHVyZXJzICovXG4gICAgdmFyIG1hbnVmYWN0dXJlciA9IGdldE1hbnVmYWN0dXJlcih7XG4gICAgICAnQXBwbGUnOiB7ICdpUGFkJzogMSwgJ2lQaG9uZSc6IDEsICdpUG9kJzogMSB9LFxuICAgICAgJ0FtYXpvbic6IHsgJ0tpbmRsZSc6IDEsICdLaW5kbGUgRmlyZSc6IDEgfSxcbiAgICAgICdBc3VzJzogeyAnVHJhbnNmb3JtZXInOiAxIH0sXG4gICAgICAnQmFybmVzICYgTm9ibGUnOiB7ICdOb29rJzogMSB9LFxuICAgICAgJ0JsYWNrQmVycnknOiB7ICdQbGF5Qm9vayc6IDEgfSxcbiAgICAgICdHb29nbGUnOiB7ICdHb29nbGUgVFYnOiAxIH0sXG4gICAgICAnSFAnOiB7ICdUb3VjaFBhZCc6IDEgfSxcbiAgICAgICdIVEMnOiB7fSxcbiAgICAgICdMRyc6IHt9LFxuICAgICAgJ01pY3Jvc29mdCc6IHsgJ1hib3gnOiAxLCAnWGJveCBPbmUnOiAxIH0sXG4gICAgICAnTW90b3JvbGEnOiB7ICdYb29tJzogMSB9LFxuICAgICAgJ05pbnRlbmRvJzogeyAnV2lpIFUnOiAxLCAgJ1dpaSc6IDEgfSxcbiAgICAgICdOb2tpYSc6IHsgJ0x1bWlhJzogMSB9LFxuICAgICAgJ1NhbXN1bmcnOiB7ICdHYWxheHkgUyc6IDEsICdHYWxheHkgUzInOiAxLCAnR2FsYXh5IFMzJzogMSwgJ0dhbGF4eSBTNCc6IDEgfSxcbiAgICAgICdTb255JzogeyAnUGxheVN0YXRpb24gNCc6IDEsICdQbGF5U3RhdGlvbiAzJzogMSwgJ1BsYXlTdGF0aW9uIFZpdGEnOiAxIH1cbiAgICB9KTtcblxuICAgIC8qIERldGVjdGFibGUgT1NlcyAob3JkZXIgaXMgaW1wb3J0YW50KSAqL1xuICAgIHZhciBvcyA9IGdldE9TKFtcbiAgICAgICdXaW5kb3dzIFBob25lICcsXG4gICAgICAnQW5kcm9pZCcsXG4gICAgICAnQ2VudE9TJyxcbiAgICAgICdEZWJpYW4nLFxuICAgICAgJ0ZlZG9yYScsXG4gICAgICAnRnJlZUJTRCcsXG4gICAgICAnR2VudG9vJyxcbiAgICAgICdIYWlrdScsXG4gICAgICAnS3VidW50dScsXG4gICAgICAnTGludXggTWludCcsXG4gICAgICAnUmVkIEhhdCcsXG4gICAgICAnU3VTRScsXG4gICAgICAnVWJ1bnR1JyxcbiAgICAgICdYdWJ1bnR1JyxcbiAgICAgICdDeWd3aW4nLFxuICAgICAgJ1N5bWJpYW4gT1MnLFxuICAgICAgJ2hwd09TJyxcbiAgICAgICd3ZWJPUyAnLFxuICAgICAgJ3dlYk9TJyxcbiAgICAgICdUYWJsZXQgT1MnLFxuICAgICAgJ0xpbnV4JyxcbiAgICAgICdNYWMgT1MgWCcsXG4gICAgICAnTWFjaW50b3NoJyxcbiAgICAgICdNYWMnLFxuICAgICAgJ1dpbmRvd3MgOTg7JyxcbiAgICAgICdXaW5kb3dzICdcbiAgICBdKTtcblxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8qKlxuICAgICAqIFBpY2tzIHRoZSBsYXlvdXQgZW5naW5lIGZyb20gYW4gYXJyYXkgb2YgZ3Vlc3Nlcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtBcnJheX0gZ3Vlc3NlcyBBbiBhcnJheSBvZiBndWVzc2VzLlxuICAgICAqIEByZXR1cm5zIHtudWxsfHN0cmluZ30gVGhlIGRldGVjdGVkIGxheW91dCBlbmdpbmUuXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0TGF5b3V0KGd1ZXNzZXMpIHtcbiAgICAgIHJldHVybiByZWR1Y2UoZ3Vlc3NlcywgZnVuY3Rpb24ocmVzdWx0LCBndWVzcykge1xuICAgICAgICByZXR1cm4gcmVzdWx0IHx8IFJlZ0V4cCgnXFxcXGInICsgKFxuICAgICAgICAgIGd1ZXNzLnBhdHRlcm4gfHwgcXVhbGlmeShndWVzcylcbiAgICAgICAgKSArICdcXFxcYicsICdpJykuZXhlYyh1YSkgJiYgKGd1ZXNzLmxhYmVsIHx8IGd1ZXNzKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBpY2tzIHRoZSBtYW51ZmFjdHVyZXIgZnJvbSBhbiBhcnJheSBvZiBndWVzc2VzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBndWVzc2VzIEFuIG9iamVjdCBvZiBndWVzc2VzLlxuICAgICAqIEByZXR1cm5zIHtudWxsfHN0cmluZ30gVGhlIGRldGVjdGVkIG1hbnVmYWN0dXJlci5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRNYW51ZmFjdHVyZXIoZ3Vlc3Nlcykge1xuICAgICAgcmV0dXJuIHJlZHVjZShndWVzc2VzLCBmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICAgICAgLy8gbG9va3VwIHRoZSBtYW51ZmFjdHVyZXIgYnkgcHJvZHVjdCBvciBzY2FuIHRoZSBVQSBmb3IgdGhlIG1hbnVmYWN0dXJlclxuICAgICAgICByZXR1cm4gcmVzdWx0IHx8IChcbiAgICAgICAgICB2YWx1ZVtwcm9kdWN0XSB8fFxuICAgICAgICAgIHZhbHVlWzAvKk9wZXJhIDkuMjUgZml4Ki8sIC9eW2Etel0rKD86ICtbYS16XStcXGIpKi9pLmV4ZWMocHJvZHVjdCldIHx8XG4gICAgICAgICAgUmVnRXhwKCdcXFxcYicgKyBxdWFsaWZ5KGtleSkgKyAnKD86XFxcXGJ8XFxcXHcqXFxcXGQpJywgJ2knKS5leGVjKHVhKVxuICAgICAgICApICYmIGtleTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBpY2tzIHRoZSBicm93c2VyIG5hbWUgZnJvbSBhbiBhcnJheSBvZiBndWVzc2VzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBndWVzc2VzIEFuIGFycmF5IG9mIGd1ZXNzZXMuXG4gICAgICogQHJldHVybnMge251bGx8c3RyaW5nfSBUaGUgZGV0ZWN0ZWQgYnJvd3NlciBuYW1lLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldE5hbWUoZ3Vlc3Nlcykge1xuICAgICAgcmV0dXJuIHJlZHVjZShndWVzc2VzLCBmdW5jdGlvbihyZXN1bHQsIGd1ZXNzKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQgfHwgUmVnRXhwKCdcXFxcYicgKyAoXG4gICAgICAgICAgZ3Vlc3MucGF0dGVybiB8fCBxdWFsaWZ5KGd1ZXNzKVxuICAgICAgICApICsgJ1xcXFxiJywgJ2knKS5leGVjKHVhKSAmJiAoZ3Vlc3MubGFiZWwgfHwgZ3Vlc3MpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGlja3MgdGhlIE9TIG5hbWUgZnJvbSBhbiBhcnJheSBvZiBndWVzc2VzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBndWVzc2VzIEFuIGFycmF5IG9mIGd1ZXNzZXMuXG4gICAgICogQHJldHVybnMge251bGx8c3RyaW5nfSBUaGUgZGV0ZWN0ZWQgT1MgbmFtZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRPUyhndWVzc2VzKSB7XG4gICAgICByZXR1cm4gcmVkdWNlKGd1ZXNzZXMsIGZ1bmN0aW9uKHJlc3VsdCwgZ3Vlc3MpIHtcbiAgICAgICAgdmFyIHBhdHRlcm4gPSBndWVzcy5wYXR0ZXJuIHx8IHF1YWxpZnkoZ3Vlc3MpO1xuICAgICAgICBpZiAoIXJlc3VsdCAmJiAocmVzdWx0ID1cbiAgICAgICAgICAgICAgUmVnRXhwKCdcXFxcYicgKyBwYXR0ZXJuICsgJyg/Oi9bXFxcXGQuXSt8WyBcXFxcdy5dKiknLCAnaScpLmV4ZWModWEpXG4gICAgICAgICAgICApKSB7XG4gICAgICAgICAgcmVzdWx0ID0gY2xlYW51cE9TKHJlc3VsdCwgcGF0dGVybiwgZ3Vlc3MubGFiZWwgfHwgZ3Vlc3MpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQaWNrcyB0aGUgcHJvZHVjdCBuYW1lIGZyb20gYW4gYXJyYXkgb2YgZ3Vlc3Nlcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtBcnJheX0gZ3Vlc3NlcyBBbiBhcnJheSBvZiBndWVzc2VzLlxuICAgICAqIEByZXR1cm5zIHtudWxsfHN0cmluZ30gVGhlIGRldGVjdGVkIHByb2R1Y3QgbmFtZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRQcm9kdWN0KGd1ZXNzZXMpIHtcbiAgICAgIHJldHVybiByZWR1Y2UoZ3Vlc3NlcywgZnVuY3Rpb24ocmVzdWx0LCBndWVzcykge1xuICAgICAgICB2YXIgcGF0dGVybiA9IGd1ZXNzLnBhdHRlcm4gfHwgcXVhbGlmeShndWVzcyk7XG4gICAgICAgIGlmICghcmVzdWx0ICYmIChyZXN1bHQgPVxuICAgICAgICAgICAgICBSZWdFeHAoJ1xcXFxiJyArIHBhdHRlcm4gKyAnICpcXFxcZCtbLlxcXFx3X10qJywgJ2knKS5leGVjKHVhKSB8fFxuICAgICAgICAgICAgICBSZWdFeHAoJ1xcXFxiJyArIHBhdHRlcm4gKyAnKD86OyAqKD86W2Etel0rW18tXSk/W2Etel0rXFxcXGQrfFteICgpOy1dKiknLCAnaScpLmV4ZWModWEpXG4gICAgICAgICAgICApKSB7XG4gICAgICAgICAgLy8gc3BsaXQgYnkgZm9yd2FyZCBzbGFzaCBhbmQgYXBwZW5kIHByb2R1Y3QgdmVyc2lvbiBpZiBuZWVkZWRcbiAgICAgICAgICBpZiAoKHJlc3VsdCA9IFN0cmluZygoZ3Vlc3MubGFiZWwgJiYgIVJlZ0V4cChwYXR0ZXJuLCAnaScpLnRlc3QoZ3Vlc3MubGFiZWwpKSA/IGd1ZXNzLmxhYmVsIDogcmVzdWx0KS5zcGxpdCgnLycpKVsxXSAmJiAhL1tcXGQuXSsvLnRlc3QocmVzdWx0WzBdKSkge1xuICAgICAgICAgICAgcmVzdWx0WzBdICs9ICcgJyArIHJlc3VsdFsxXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gY29ycmVjdCBjaGFyYWN0ZXIgY2FzZSBhbmQgY2xlYW51cFxuICAgICAgICAgIGd1ZXNzID0gZ3Vlc3MubGFiZWwgfHwgZ3Vlc3M7XG4gICAgICAgICAgcmVzdWx0ID0gZm9ybWF0KHJlc3VsdFswXVxuICAgICAgICAgICAgLnJlcGxhY2UoUmVnRXhwKHBhdHRlcm4sICdpJyksIGd1ZXNzKVxuICAgICAgICAgICAgLnJlcGxhY2UoUmVnRXhwKCc7ICooPzonICsgZ3Vlc3MgKyAnW18tXSk/JywgJ2knKSwgJyAnKVxuICAgICAgICAgICAgLnJlcGxhY2UoUmVnRXhwKCcoJyArIGd1ZXNzICsgJylbLV8uXT8oXFxcXHcpJywgJ2knKSwgJyQxICQyJykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlcyB0aGUgdmVyc2lvbiB1c2luZyBhbiBhcnJheSBvZiBVQSBwYXR0ZXJucy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtBcnJheX0gcGF0dGVybnMgQW4gYXJyYXkgb2YgVUEgcGF0dGVybnMuXG4gICAgICogQHJldHVybnMge251bGx8c3RyaW5nfSBUaGUgZGV0ZWN0ZWQgdmVyc2lvbi5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBnZXRWZXJzaW9uKHBhdHRlcm5zKSB7XG4gICAgICByZXR1cm4gcmVkdWNlKHBhdHRlcm5zLCBmdW5jdGlvbihyZXN1bHQsIHBhdHRlcm4pIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCB8fCAoUmVnRXhwKHBhdHRlcm4gK1xuICAgICAgICAgICcoPzotW1xcXFxkLl0rL3woPzogZm9yIFtcXFxcdy1dKyk/WyAvLV0pKFtcXFxcZC5dK1teICgpOy9fLV0qKScsICdpJykuZXhlYyh1YSkgfHwgMClbMV0gfHwgbnVsbDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYHBsYXRmb3JtLmRlc2NyaXB0aW9uYCB3aGVuIHRoZSBwbGF0Zm9ybSBvYmplY3QgaXMgY29lcmNlZCB0byBhIHN0cmluZy5cbiAgICAgKlxuICAgICAqIEBuYW1lIHRvU3RyaW5nXG4gICAgICogQG1lbWJlck9mIHBsYXRmb3JtXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyBgcGxhdGZvcm0uZGVzY3JpcHRpb25gIGlmIGF2YWlsYWJsZSwgZWxzZSBhbiBlbXB0eSBzdHJpbmcuXG4gICAgICovXG4gICAgZnVuY3Rpb24gdG9TdHJpbmdQbGF0Zm9ybSgpIHtcbiAgICAgIHJldHVybiB0aGlzLmRlc2NyaXB0aW9uIHx8ICcnO1xuICAgIH1cblxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuICAgIC8vIGNvbnZlcnQgbGF5b3V0IHRvIGFuIGFycmF5IHNvIHdlIGNhbiBhZGQgZXh0cmEgZGV0YWlsc1xuICAgIGxheW91dCAmJiAobGF5b3V0ID0gW2xheW91dF0pO1xuXG4gICAgLy8gZGV0ZWN0IHByb2R1Y3QgbmFtZXMgdGhhdCBjb250YWluIHRoZWlyIG1hbnVmYWN0dXJlcidzIG5hbWVcbiAgICBpZiAobWFudWZhY3R1cmVyICYmICFwcm9kdWN0KSB7XG4gICAgICBwcm9kdWN0ID0gZ2V0UHJvZHVjdChbbWFudWZhY3R1cmVyXSk7XG4gICAgfVxuICAgIC8vIGNsZWFuIHVwIEdvb2dsZSBUVlxuICAgIGlmICgoZGF0YSA9IC9cXGJHb29nbGUgVFZcXGIvLmV4ZWMocHJvZHVjdCkpKSB7XG4gICAgICBwcm9kdWN0ID0gZGF0YVswXTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IHNpbXVsYXRvcnNcbiAgICBpZiAoL1xcYlNpbXVsYXRvclxcYi9pLnRlc3QodWEpKSB7XG4gICAgICBwcm9kdWN0ID0gKHByb2R1Y3QgPyBwcm9kdWN0ICsgJyAnIDogJycpICsgJ1NpbXVsYXRvcic7XG4gICAgfVxuICAgIC8vIGRldGVjdCBPcGVyYSBNaW5pIDgrIHJ1bm5pbmcgaW4gVHVyYm8vVW5jb21wcmVzc2VkIG1vZGUgb24gaU9TXG4gICAgaWYgKG5hbWUgPT0gJ09wZXJhIE1pbmknICYmIC9cXGJPUGlPU1xcYi8udGVzdCh1YSkpIHtcbiAgICAgIGRlc2NyaXB0aW9uLnB1c2goJ3J1bm5pbmcgaW4gVHVyYm8vVW5jb21wcmVzc2VkIG1vZGUnKTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IGlPU1xuICAgIGlmICgvXmlQLy50ZXN0KHByb2R1Y3QpKSB7XG4gICAgICBuYW1lIHx8IChuYW1lID0gJ1NhZmFyaScpO1xuICAgICAgb3MgPSAnaU9TJyArICgoZGF0YSA9IC8gT1MgKFtcXGRfXSspL2kuZXhlYyh1YSkpXG4gICAgICAgID8gJyAnICsgZGF0YVsxXS5yZXBsYWNlKC9fL2csICcuJylcbiAgICAgICAgOiAnJyk7XG4gICAgfVxuICAgIC8vIGRldGVjdCBLdWJ1bnR1XG4gICAgZWxzZSBpZiAobmFtZSA9PSAnS29ucXVlcm9yJyAmJiAhL2J1bnR1L2kudGVzdChvcykpIHtcbiAgICAgIG9zID0gJ0t1YnVudHUnO1xuICAgIH1cbiAgICAvLyBkZXRlY3QgQW5kcm9pZCBicm93c2Vyc1xuICAgIGVsc2UgaWYgKG1hbnVmYWN0dXJlciAmJiBtYW51ZmFjdHVyZXIgIT0gJ0dvb2dsZScgJiZcbiAgICAgICAgKCgvQ2hyb21lLy50ZXN0KG5hbWUpICYmICEvXFxiTW9iaWxlIFNhZmFyaVxcYi9pLnRlc3QodWEpKSB8fCAvXFxiVml0YVxcYi8udGVzdChwcm9kdWN0KSkpIHtcbiAgICAgIG5hbWUgPSAnQW5kcm9pZCBCcm93c2VyJztcbiAgICAgIG9zID0gL1xcYkFuZHJvaWRcXGIvLnRlc3Qob3MpID8gb3MgOiAnQW5kcm9pZCc7XG4gICAgfVxuICAgIC8vIGRldGVjdCBmYWxzZSBwb3NpdGl2ZXMgZm9yIEZpcmVmb3gvU2FmYXJpXG4gICAgZWxzZSBpZiAoIW5hbWUgfHwgKGRhdGEgPSAhL1xcYk1pbmVmaWVsZFxcYnxcXChBbmRyb2lkOy9pLnRlc3QodWEpICYmIC9cXGIoPzpGaXJlZm94fFNhZmFyaSlcXGIvLmV4ZWMobmFtZSkpKSB7XG4gICAgICAvLyBlc2NhcGUgdGhlIGAvYCBmb3IgRmlyZWZveCAxXG4gICAgICBpZiAobmFtZSAmJiAhcHJvZHVjdCAmJiAvW1xcLyxdfF5bXihdKz9cXCkvLnRlc3QodWEuc2xpY2UodWEuaW5kZXhPZihkYXRhICsgJy8nKSArIDgpKSkge1xuICAgICAgICAvLyBjbGVhciBuYW1lIG9mIGZhbHNlIHBvc2l0aXZlc1xuICAgICAgICBuYW1lID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIHJlYXNzaWduIGEgZ2VuZXJpYyBuYW1lXG4gICAgICBpZiAoKGRhdGEgPSBwcm9kdWN0IHx8IG1hbnVmYWN0dXJlciB8fCBvcykgJiZcbiAgICAgICAgICAocHJvZHVjdCB8fCBtYW51ZmFjdHVyZXIgfHwgL1xcYig/OkFuZHJvaWR8U3ltYmlhbiBPU3xUYWJsZXQgT1N8d2ViT1MpXFxiLy50ZXN0KG9zKSkpIHtcbiAgICAgICAgbmFtZSA9IC9bYS16XSsoPzogSGF0KT8vaS5leGVjKC9cXGJBbmRyb2lkXFxiLy50ZXN0KG9zKSA/IG9zIDogZGF0YSkgKyAnIEJyb3dzZXInO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBkZXRlY3QgRmlyZWZveCBPU1xuICAgIGlmICgoZGF0YSA9IC9cXCgoTW9iaWxlfFRhYmxldCkuKj9GaXJlZm94XFxiL2kuZXhlYyh1YSkpICYmIGRhdGFbMV0pIHtcbiAgICAgIG9zID0gJ0ZpcmVmb3ggT1MnO1xuICAgICAgaWYgKCFwcm9kdWN0KSB7XG4gICAgICAgIHByb2R1Y3QgPSBkYXRhWzFdO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBkZXRlY3Qgbm9uLU9wZXJhIHZlcnNpb25zIChvcmRlciBpcyBpbXBvcnRhbnQpXG4gICAgaWYgKCF2ZXJzaW9uKSB7XG4gICAgICB2ZXJzaW9uID0gZ2V0VmVyc2lvbihbXG4gICAgICAgICcoPzpDbG91ZDl8Q3JpT1N8Q3JNb3xJRU1vYmlsZXxJcm9ufE9wZXJhID9NaW5pfE9QaU9TfE9QUnxSYXZlbnxTaWxrKD8hL1tcXFxcZC5dKyQpKScsXG4gICAgICAgICdWZXJzaW9uJyxcbiAgICAgICAgcXVhbGlmeShuYW1lKSxcbiAgICAgICAgJyg/OkZpcmVmb3h8TWluZWZpZWxkfE5ldEZyb250KSdcbiAgICAgIF0pO1xuICAgIH1cbiAgICAvLyBkZXRlY3Qgc3R1YmJvcm4gbGF5b3V0IGVuZ2luZXNcbiAgICBpZiAobGF5b3V0ID09ICdpQ2FiJyAmJiBwYXJzZUZsb2F0KHZlcnNpb24pID4gMykge1xuICAgICAgbGF5b3V0ID0gWydXZWJLaXQnXTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBsYXlvdXQgIT0gJ1RyaWRlbnQnICYmXG4gICAgICAgIChkYXRhID1cbiAgICAgICAgICAvXFxiT3BlcmFcXGIvLnRlc3QobmFtZSkgJiYgKC9cXGJPUFJcXGIvLnRlc3QodWEpID8gJ0JsaW5rJyA6ICdQcmVzdG8nKSB8fFxuICAgICAgICAgIC9cXGIoPzpNaWRvcml8Tm9va3xTYWZhcmkpXFxiL2kudGVzdCh1YSkgJiYgJ1dlYktpdCcgfHxcbiAgICAgICAgICAhbGF5b3V0ICYmIC9cXGJNU0lFXFxiL2kudGVzdCh1YSkgJiYgKG9zID09ICdNYWMgT1MnID8gJ1Rhc21hbicgOiAnVHJpZGVudCcpXG4gICAgICAgIClcbiAgICApIHtcbiAgICAgIGxheW91dCA9IFtkYXRhXTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IE5ldEZyb250IG9uIFBsYXlTdGF0aW9uXG4gICAgZWxzZSBpZiAoL1xcYlBsYXlTdGF0aW9uXFxiKD8hIFZpdGFcXGIpL2kudGVzdChuYW1lKSAmJiBsYXlvdXQgPT0gJ1dlYktpdCcpIHtcbiAgICAgIGxheW91dCA9IFsnTmV0RnJvbnQnXTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IFdpbmRvd3MgUGhvbmUgNyBkZXNrdG9wIG1vZGVcbiAgICBpZiAobmFtZSA9PSAnSUUnICYmIChkYXRhID0gKC87ICooPzpYQkxXUHxadW5lV1ApKFxcZCspL2kuZXhlYyh1YSkgfHwgMClbMV0pKSB7XG4gICAgICBuYW1lICs9ICcgTW9iaWxlJztcbiAgICAgIG9zID0gJ1dpbmRvd3MgUGhvbmUgJyArICgvXFwrJC8udGVzdChkYXRhKSA/IGRhdGEgOiBkYXRhICsgJy54Jyk7XG4gICAgICBkZXNjcmlwdGlvbi51bnNoaWZ0KCdkZXNrdG9wIG1vZGUnKTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IFdpbmRvd3MgUGhvbmUgOCsgZGVza3RvcCBtb2RlXG4gICAgZWxzZSBpZiAoL1xcYldQRGVza3RvcFxcYi9pLnRlc3QodWEpKSB7XG4gICAgICBuYW1lID0gJ0lFIE1vYmlsZSc7XG4gICAgICBvcyA9ICdXaW5kb3dzIFBob25lIDgrJztcbiAgICAgIGRlc2NyaXB0aW9uLnVuc2hpZnQoJ2Rlc2t0b3AgbW9kZScpO1xuICAgICAgdmVyc2lvbiB8fCAodmVyc2lvbiA9ICgvXFxicnY6KFtcXGQuXSspLy5leGVjKHVhKSB8fCAwKVsxXSk7XG4gICAgfVxuICAgIC8vIGRldGVjdCBJRSAxMSBhbmQgYWJvdmVcbiAgICBlbHNlIGlmIChuYW1lICE9ICdJRScgJiYgbGF5b3V0ID09ICdUcmlkZW50JyAmJiAoZGF0YSA9IC9cXGJydjooW1xcZC5dKykvLmV4ZWModWEpKSkge1xuICAgICAgaWYgKCEvXFxiV1BEZXNrdG9wXFxiL2kudGVzdCh1YSkpIHtcbiAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICBkZXNjcmlwdGlvbi5wdXNoKCdpZGVudGlmeWluZyBhcyAnICsgbmFtZSArICh2ZXJzaW9uID8gJyAnICsgdmVyc2lvbiA6ICcnKSk7XG4gICAgICAgIH1cbiAgICAgICAgbmFtZSA9ICdJRSc7XG4gICAgICB9XG4gICAgICB2ZXJzaW9uID0gZGF0YVsxXTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IElFIFRlY2ggUHJldmlld1xuICAgIGVsc2UgaWYgKChuYW1lID09ICdDaHJvbWUnIHx8IG5hbWUgIT0gJ0lFJykgJiYgKGRhdGEgPSAvXFxiRWRnZVxcLyhbXFxkLl0rKS8uZXhlYyh1YSkpKSB7XG4gICAgICBuYW1lID0gJ0lFJztcbiAgICAgIHZlcnNpb24gPSBkYXRhWzFdO1xuICAgICAgbGF5b3V0ID0gWydUcmlkZW50J107XG4gICAgICBkZXNjcmlwdGlvbi51bnNoaWZ0KCdwbGF0Zm9ybSBwcmV2aWV3Jyk7XG4gICAgfVxuICAgIC8vIGxldmVyYWdlIGVudmlyb25tZW50IGZlYXR1cmVzXG4gICAgaWYgKHVzZUZlYXR1cmVzKSB7XG4gICAgICAvLyBkZXRlY3Qgc2VydmVyLXNpZGUgZW52aXJvbm1lbnRzXG4gICAgICAvLyBSaGlubyBoYXMgYSBnbG9iYWwgZnVuY3Rpb24gd2hpbGUgb3RoZXJzIGhhdmUgYSBnbG9iYWwgb2JqZWN0XG4gICAgICBpZiAoaXNIb3N0VHlwZShjb250ZXh0LCAnZ2xvYmFsJykpIHtcbiAgICAgICAgaWYgKGphdmEpIHtcbiAgICAgICAgICBkYXRhID0gamF2YS5sYW5nLlN5c3RlbTtcbiAgICAgICAgICBhcmNoID0gZGF0YS5nZXRQcm9wZXJ0eSgnb3MuYXJjaCcpO1xuICAgICAgICAgIG9zID0gb3MgfHwgZGF0YS5nZXRQcm9wZXJ0eSgnb3MubmFtZScpICsgJyAnICsgZGF0YS5nZXRQcm9wZXJ0eSgnb3MudmVyc2lvbicpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc01vZHVsZVNjb3BlICYmIGlzSG9zdFR5cGUoY29udGV4dCwgJ3N5c3RlbScpICYmIChkYXRhID0gW2NvbnRleHQuc3lzdGVtXSlbMF0pIHtcbiAgICAgICAgICBvcyB8fCAob3MgPSBkYXRhWzBdLm9zIHx8IG51bGwpO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBkYXRhWzFdID0gY29udGV4dC5yZXF1aXJlKCdyaW5nby9lbmdpbmUnKS52ZXJzaW9uO1xuICAgICAgICAgICAgdmVyc2lvbiA9IGRhdGFbMV0uam9pbignLicpO1xuICAgICAgICAgICAgbmFtZSA9ICdSaW5nb0pTJztcbiAgICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgIGlmIChkYXRhWzBdLmdsb2JhbC5zeXN0ZW0gPT0gY29udGV4dC5zeXN0ZW0pIHtcbiAgICAgICAgICAgICAgbmFtZSA9ICdOYXJ3aGFsJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIGNvbnRleHQucHJvY2VzcyA9PSAnb2JqZWN0JyAmJiAoZGF0YSA9IGNvbnRleHQucHJvY2VzcykpIHtcbiAgICAgICAgICBuYW1lID0gJ05vZGUuanMnO1xuICAgICAgICAgIGFyY2ggPSBkYXRhLmFyY2g7XG4gICAgICAgICAgb3MgPSBkYXRhLnBsYXRmb3JtO1xuICAgICAgICAgIHZlcnNpb24gPSAvW1xcZC5dKy8uZXhlYyhkYXRhLnZlcnNpb24pWzBdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHJoaW5vKSB7XG4gICAgICAgICAgbmFtZSA9ICdSaGlubyc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGRldGVjdCBBZG9iZSBBSVJcbiAgICAgIGVsc2UgaWYgKGdldENsYXNzT2YoKGRhdGEgPSBjb250ZXh0LnJ1bnRpbWUpKSA9PSBhaXJSdW50aW1lQ2xhc3MpIHtcbiAgICAgICAgbmFtZSA9ICdBZG9iZSBBSVInO1xuICAgICAgICBvcyA9IGRhdGEuZmxhc2guc3lzdGVtLkNhcGFiaWxpdGllcy5vcztcbiAgICAgIH1cbiAgICAgIC8vIGRldGVjdCBQaGFudG9tSlNcbiAgICAgIGVsc2UgaWYgKGdldENsYXNzT2YoKGRhdGEgPSBjb250ZXh0LnBoYW50b20pKSA9PSBwaGFudG9tQ2xhc3MpIHtcbiAgICAgICAgbmFtZSA9ICdQaGFudG9tSlMnO1xuICAgICAgICB2ZXJzaW9uID0gKGRhdGEgPSBkYXRhLnZlcnNpb24gfHwgbnVsbCkgJiYgKGRhdGEubWFqb3IgKyAnLicgKyBkYXRhLm1pbm9yICsgJy4nICsgZGF0YS5wYXRjaCk7XG4gICAgICB9XG4gICAgICAvLyBkZXRlY3QgSUUgY29tcGF0aWJpbGl0eSBtb2Rlc1xuICAgICAgZWxzZSBpZiAodHlwZW9mIGRvYy5kb2N1bWVudE1vZGUgPT0gJ251bWJlcicgJiYgKGRhdGEgPSAvXFxiVHJpZGVudFxcLyhcXGQrKS9pLmV4ZWModWEpKSkge1xuICAgICAgICAvLyB3ZSdyZSBpbiBjb21wYXRpYmlsaXR5IG1vZGUgd2hlbiB0aGUgVHJpZGVudCB2ZXJzaW9uICsgNCBkb2Vzbid0XG4gICAgICAgIC8vIGVxdWFsIHRoZSBkb2N1bWVudCBtb2RlXG4gICAgICAgIHZlcnNpb24gPSBbdmVyc2lvbiwgZG9jLmRvY3VtZW50TW9kZV07XG4gICAgICAgIGlmICgoZGF0YSA9ICtkYXRhWzFdICsgNCkgIT0gdmVyc2lvblsxXSkge1xuICAgICAgICAgIGRlc2NyaXB0aW9uLnB1c2goJ0lFICcgKyB2ZXJzaW9uWzFdICsgJyBtb2RlJyk7XG4gICAgICAgICAgbGF5b3V0ICYmIChsYXlvdXRbMV0gPSAnJyk7XG4gICAgICAgICAgdmVyc2lvblsxXSA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgdmVyc2lvbiA9IG5hbWUgPT0gJ0lFJyA/IFN0cmluZyh2ZXJzaW9uWzFdLnRvRml4ZWQoMSkpIDogdmVyc2lvblswXTtcbiAgICAgIH1cbiAgICAgIG9zID0gb3MgJiYgZm9ybWF0KG9zKTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IHByZXJlbGVhc2UgcGhhc2VzXG4gICAgaWYgKHZlcnNpb24gJiYgKGRhdGEgPVxuICAgICAgICAgIC8oPzpbYWJdfGRwfHByZXxbYWJdXFxkK3ByZSkoPzpcXGQrXFwrPyk/JC9pLmV4ZWModmVyc2lvbikgfHxcbiAgICAgICAgICAvKD86YWxwaGF8YmV0YSkoPzogP1xcZCk/L2kuZXhlYyh1YSArICc7JyArICh1c2VGZWF0dXJlcyAmJiBuYXYuYXBwTWlub3JWZXJzaW9uKSkgfHxcbiAgICAgICAgICAvXFxiTWluZWZpZWxkXFxiL2kudGVzdCh1YSkgJiYgJ2EnXG4gICAgICAgICkpIHtcbiAgICAgIHByZXJlbGVhc2UgPSAvYi9pLnRlc3QoZGF0YSkgPyAnYmV0YScgOiAnYWxwaGEnO1xuICAgICAgdmVyc2lvbiA9IHZlcnNpb24ucmVwbGFjZShSZWdFeHAoZGF0YSArICdcXFxcKz8kJyksICcnKSArXG4gICAgICAgIChwcmVyZWxlYXNlID09ICdiZXRhJyA/IGJldGEgOiBhbHBoYSkgKyAoL1xcZCtcXCs/Ly5leGVjKGRhdGEpIHx8ICcnKTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IEZpcmVmb3ggTW9iaWxlXG4gICAgaWYgKG5hbWUgPT0gJ0Zlbm5lYycgfHwgbmFtZSA9PSAnRmlyZWZveCcgJiYgL1xcYig/OkFuZHJvaWR8RmlyZWZveCBPUylcXGIvLnRlc3Qob3MpKSB7XG4gICAgICBuYW1lID0gJ0ZpcmVmb3ggTW9iaWxlJztcbiAgICB9XG4gICAgLy8gb2JzY3VyZSBNYXh0aG9uJ3MgdW5yZWxpYWJsZSB2ZXJzaW9uXG4gICAgZWxzZSBpZiAobmFtZSA9PSAnTWF4dGhvbicgJiYgdmVyc2lvbikge1xuICAgICAgdmVyc2lvbiA9IHZlcnNpb24ucmVwbGFjZSgvXFwuW1xcZC5dKy8sICcueCcpO1xuICAgIH1cbiAgICAvLyBkZXRlY3QgU2lsayBkZXNrdG9wL2FjY2VsZXJhdGVkIG1vZGVzXG4gICAgZWxzZSBpZiAobmFtZSA9PSAnU2lsaycpIHtcbiAgICAgIGlmICghL1xcYk1vYmkvaS50ZXN0KHVhKSkge1xuICAgICAgICBvcyA9ICdBbmRyb2lkJztcbiAgICAgICAgZGVzY3JpcHRpb24udW5zaGlmdCgnZGVza3RvcCBtb2RlJyk7XG4gICAgICB9XG4gICAgICBpZiAoL0FjY2VsZXJhdGVkICo9ICp0cnVlL2kudGVzdCh1YSkpIHtcbiAgICAgICAgZGVzY3JpcHRpb24udW5zaGlmdCgnYWNjZWxlcmF0ZWQnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZGV0ZWN0IFhib3ggMzYwIGFuZCBYYm94IE9uZVxuICAgIGVsc2UgaWYgKC9cXGJYYm94XFxiL2kudGVzdChwcm9kdWN0KSkge1xuICAgICAgb3MgPSBudWxsO1xuICAgICAgaWYgKHByb2R1Y3QgPT0gJ1hib3ggMzYwJyAmJiAvXFxiSUVNb2JpbGVcXGIvLnRlc3QodWEpKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uLnVuc2hpZnQoJ21vYmlsZSBtb2RlJyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGFkZCBtb2JpbGUgcG9zdGZpeFxuICAgIGVsc2UgaWYgKCgvXig/OkNocm9tZXxJRXxPcGVyYSkkLy50ZXN0KG5hbWUpIHx8IG5hbWUgJiYgIXByb2R1Y3QgJiYgIS9Ccm93c2VyfE1vYmkvLnRlc3QobmFtZSkpICYmXG4gICAgICAgIChvcyA9PSAnV2luZG93cyBDRScgfHwgL01vYmkvaS50ZXN0KHVhKSkpIHtcbiAgICAgIG5hbWUgKz0gJyBNb2JpbGUnO1xuICAgIH1cbiAgICAvLyBkZXRlY3QgSUUgcGxhdGZvcm0gcHJldmlld1xuICAgIGVsc2UgaWYgKG5hbWUgPT0gJ0lFJyAmJiB1c2VGZWF0dXJlcyAmJiBjb250ZXh0LmV4dGVybmFsID09PSBudWxsKSB7XG4gICAgICBkZXNjcmlwdGlvbi51bnNoaWZ0KCdwbGF0Zm9ybSBwcmV2aWV3Jyk7XG4gICAgfVxuICAgIC8vIGRldGVjdCBCbGFja0JlcnJ5IE9TIHZlcnNpb25cbiAgICAvLyBodHRwOi8vZG9jcy5ibGFja2JlcnJ5LmNvbS9lbi9kZXZlbG9wZXJzL2RlbGl2ZXJhYmxlcy8xODE2OS9IVFRQX2hlYWRlcnNfc2VudF9ieV9CQl9Ccm93c2VyXzEyMzQ5MTFfMTEuanNwXG4gICAgZWxzZSBpZiAoKC9cXGJCbGFja0JlcnJ5XFxiLy50ZXN0KHByb2R1Y3QpIHx8IC9cXGJCQjEwXFxiLy50ZXN0KHVhKSkgJiYgKGRhdGEgPVxuICAgICAgICAgIChSZWdFeHAocHJvZHVjdC5yZXBsYWNlKC8gKy9nLCAnIConKSArICcvKFsuXFxcXGRdKyknLCAnaScpLmV4ZWModWEpIHx8IDApWzFdIHx8XG4gICAgICAgICAgdmVyc2lvblxuICAgICAgICApKSB7XG4gICAgICBkYXRhID0gW2RhdGEsIC9CQjEwLy50ZXN0KHVhKV07XG4gICAgICBvcyA9IChkYXRhWzFdID8gKHByb2R1Y3QgPSBudWxsLCBtYW51ZmFjdHVyZXIgPSAnQmxhY2tCZXJyeScpIDogJ0RldmljZSBTb2Z0d2FyZScpICsgJyAnICsgZGF0YVswXTtcbiAgICAgIHZlcnNpb24gPSBudWxsO1xuICAgIH1cbiAgICAvLyBkZXRlY3QgT3BlcmEgaWRlbnRpZnlpbmcvbWFza2luZyBpdHNlbGYgYXMgYW5vdGhlciBicm93c2VyXG4gICAgLy8gaHR0cDovL3d3dy5vcGVyYS5jb20vc3VwcG9ydC9rYi92aWV3Lzg0My9cbiAgICBlbHNlIGlmICh0aGlzICE9IGZvck93biAmJiAoXG4gICAgICAgICAgcHJvZHVjdCAhPSAnV2lpJyAmJiAoXG4gICAgICAgICAgICAodXNlRmVhdHVyZXMgJiYgb3BlcmEpIHx8XG4gICAgICAgICAgICAoL09wZXJhLy50ZXN0KG5hbWUpICYmIC9cXGIoPzpNU0lFfEZpcmVmb3gpXFxiL2kudGVzdCh1YSkpIHx8XG4gICAgICAgICAgICAobmFtZSA9PSAnRmlyZWZveCcgJiYgL1xcYk9TIFggKD86XFxkK1xcLil7Mix9Ly50ZXN0KG9zKSkgfHxcbiAgICAgICAgICAgIChuYW1lID09ICdJRScgJiYgKFxuICAgICAgICAgICAgICAob3MgJiYgIS9eV2luLy50ZXN0KG9zKSAmJiB2ZXJzaW9uID4gNS41KSB8fFxuICAgICAgICAgICAgICAvXFxiV2luZG93cyBYUFxcYi8udGVzdChvcykgJiYgdmVyc2lvbiA+IDggfHxcbiAgICAgICAgICAgICAgdmVyc2lvbiA9PSA4ICYmICEvXFxiVHJpZGVudFxcYi8udGVzdCh1YSlcbiAgICAgICAgICAgICkpXG4gICAgICAgICAgKVxuICAgICAgICApICYmICFyZU9wZXJhLnRlc3QoKGRhdGEgPSBwYXJzZS5jYWxsKGZvck93biwgdWEucmVwbGFjZShyZU9wZXJhLCAnJykgKyAnOycpKSkgJiYgZGF0YS5uYW1lKSB7XG5cbiAgICAgIC8vIHdoZW4gXCJpbmRlbnRpZnlpbmdcIiwgdGhlIFVBIGNvbnRhaW5zIGJvdGggT3BlcmEgYW5kIHRoZSBvdGhlciBicm93c2VyJ3MgbmFtZVxuICAgICAgZGF0YSA9ICdpbmcgYXMgJyArIGRhdGEubmFtZSArICgoZGF0YSA9IGRhdGEudmVyc2lvbikgPyAnICcgKyBkYXRhIDogJycpO1xuICAgICAgaWYgKHJlT3BlcmEudGVzdChuYW1lKSkge1xuICAgICAgICBpZiAoL1xcYklFXFxiLy50ZXN0KGRhdGEpICYmIG9zID09ICdNYWMgT1MnKSB7XG4gICAgICAgICAgb3MgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGRhdGEgPSAnaWRlbnRpZnknICsgZGF0YTtcbiAgICAgIH1cbiAgICAgIC8vIHdoZW4gXCJtYXNraW5nXCIsIHRoZSBVQSBjb250YWlucyBvbmx5IHRoZSBvdGhlciBicm93c2VyJ3MgbmFtZVxuICAgICAgZWxzZSB7XG4gICAgICAgIGRhdGEgPSAnbWFzaycgKyBkYXRhO1xuICAgICAgICBpZiAob3BlcmFDbGFzcykge1xuICAgICAgICAgIG5hbWUgPSBmb3JtYXQob3BlcmFDbGFzcy5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmFtZSA9ICdPcGVyYSc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKC9cXGJJRVxcYi8udGVzdChkYXRhKSkge1xuICAgICAgICAgIG9zID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXVzZUZlYXR1cmVzKSB7XG4gICAgICAgICAgdmVyc2lvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxheW91dCA9IFsnUHJlc3RvJ107XG4gICAgICBkZXNjcmlwdGlvbi5wdXNoKGRhdGEpO1xuICAgIH1cbiAgICAvLyBkZXRlY3QgV2ViS2l0IE5pZ2h0bHkgYW5kIGFwcHJveGltYXRlIENocm9tZS9TYWZhcmkgdmVyc2lvbnNcbiAgICBpZiAoKGRhdGEgPSAoL1xcYkFwcGxlV2ViS2l0XFwvKFtcXGQuXStcXCs/KS9pLmV4ZWModWEpIHx8IDApWzFdKSkge1xuICAgICAgLy8gY29ycmVjdCBidWlsZCBmb3IgbnVtZXJpYyBjb21wYXJpc29uXG4gICAgICAvLyAoZS5nLiBcIjUzMi41XCIgYmVjb21lcyBcIjUzMi4wNVwiKVxuICAgICAgZGF0YSA9IFtwYXJzZUZsb2F0KGRhdGEucmVwbGFjZSgvXFwuKFxcZCkkLywgJy4wJDEnKSksIGRhdGFdO1xuICAgICAgLy8gbmlnaHRseSBidWlsZHMgYXJlIHBvc3RmaXhlZCB3aXRoIGEgYCtgXG4gICAgICBpZiAobmFtZSA9PSAnU2FmYXJpJyAmJiBkYXRhWzFdLnNsaWNlKC0xKSA9PSAnKycpIHtcbiAgICAgICAgbmFtZSA9ICdXZWJLaXQgTmlnaHRseSc7XG4gICAgICAgIHByZXJlbGVhc2UgPSAnYWxwaGEnO1xuICAgICAgICB2ZXJzaW9uID0gZGF0YVsxXS5zbGljZSgwLCAtMSk7XG4gICAgICB9XG4gICAgICAvLyBjbGVhciBpbmNvcnJlY3QgYnJvd3NlciB2ZXJzaW9uc1xuICAgICAgZWxzZSBpZiAodmVyc2lvbiA9PSBkYXRhWzFdIHx8XG4gICAgICAgICAgdmVyc2lvbiA9PSAoZGF0YVsyXSA9ICgvXFxiU2FmYXJpXFwvKFtcXGQuXStcXCs/KS9pLmV4ZWModWEpIHx8IDApWzFdKSkge1xuICAgICAgICB2ZXJzaW9uID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIHVzZSB0aGUgZnVsbCBDaHJvbWUgdmVyc2lvbiB3aGVuIGF2YWlsYWJsZVxuICAgICAgZGF0YVsxXSA9ICgvXFxiQ2hyb21lXFwvKFtcXGQuXSspL2kuZXhlYyh1YSkgfHwgMClbMV07XG4gICAgICAvLyBkZXRlY3QgQmxpbmsgbGF5b3V0IGVuZ2luZVxuICAgICAgaWYgKGRhdGFbMF0gPT0gNTM3LjM2ICYmIGRhdGFbMl0gPT0gNTM3LjM2ICYmIHBhcnNlRmxvYXQoZGF0YVsxXSkgPj0gMjggJiYgbmFtZSAhPSAnSUUnKSB7XG4gICAgICAgIGxheW91dCA9IFsnQmxpbmsnXTtcbiAgICAgIH1cbiAgICAgIC8vIGRldGVjdCBKYXZhU2NyaXB0Q29yZVxuICAgICAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy82NzY4NDc0L2hvdy1jYW4taS1kZXRlY3Qtd2hpY2gtamF2YXNjcmlwdC1lbmdpbmUtdjgtb3ItanNjLWlzLXVzZWQtYXQtcnVudGltZS1pbi1hbmRyb2lcbiAgICAgIGlmICghdXNlRmVhdHVyZXMgfHwgKCFsaWtlQ2hyb21lICYmICFkYXRhWzFdKSkge1xuICAgICAgICBsYXlvdXQgJiYgKGxheW91dFsxXSA9ICdsaWtlIFNhZmFyaScpO1xuICAgICAgICBkYXRhID0gKGRhdGEgPSBkYXRhWzBdLCBkYXRhIDwgNDAwID8gMSA6IGRhdGEgPCA1MDAgPyAyIDogZGF0YSA8IDUyNiA/IDMgOiBkYXRhIDwgNTMzID8gNCA6IGRhdGEgPCA1MzQgPyAnNCsnIDogZGF0YSA8IDUzNSA/IDUgOiBkYXRhIDwgNTM3ID8gNiA6IGRhdGEgPCA1MzggPyA3IDogZGF0YSA8IDYwMSA/IDggOiAnOCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGF5b3V0ICYmIChsYXlvdXRbMV0gPSAnbGlrZSBDaHJvbWUnKTtcbiAgICAgICAgZGF0YSA9IGRhdGFbMV0gfHwgKGRhdGEgPSBkYXRhWzBdLCBkYXRhIDwgNTMwID8gMSA6IGRhdGEgPCA1MzIgPyAyIDogZGF0YSA8IDUzMi4wNSA/IDMgOiBkYXRhIDwgNTMzID8gNCA6IGRhdGEgPCA1MzQuMDMgPyA1IDogZGF0YSA8IDUzNC4wNyA/IDYgOiBkYXRhIDwgNTM0LjEwID8gNyA6IGRhdGEgPCA1MzQuMTMgPyA4IDogZGF0YSA8IDUzNC4xNiA/IDkgOiBkYXRhIDwgNTM0LjI0ID8gMTAgOiBkYXRhIDwgNTM0LjMwID8gMTEgOiBkYXRhIDwgNTM1LjAxID8gMTIgOiBkYXRhIDwgNTM1LjAyID8gJzEzKycgOiBkYXRhIDwgNTM1LjA3ID8gMTUgOiBkYXRhIDwgNTM1LjExID8gMTYgOiBkYXRhIDwgNTM1LjE5ID8gMTcgOiBkYXRhIDwgNTM2LjA1ID8gMTggOiBkYXRhIDwgNTM2LjEwID8gMTkgOiBkYXRhIDwgNTM3LjAxID8gMjAgOiBkYXRhIDwgNTM3LjExID8gJzIxKycgOiBkYXRhIDwgNTM3LjEzID8gMjMgOiBkYXRhIDwgNTM3LjE4ID8gMjQgOiBkYXRhIDwgNTM3LjI0ID8gMjUgOiBkYXRhIDwgNTM3LjM2ID8gMjYgOiBsYXlvdXQgIT0gJ0JsaW5rJyA/ICcyNycgOiAnMjgnKTtcbiAgICAgIH1cbiAgICAgIC8vIGFkZCB0aGUgcG9zdGZpeCBvZiBcIi54XCIgb3IgXCIrXCIgZm9yIGFwcHJveGltYXRlIHZlcnNpb25zXG4gICAgICBsYXlvdXQgJiYgKGxheW91dFsxXSArPSAnICcgKyAoZGF0YSArPSB0eXBlb2YgZGF0YSA9PSAnbnVtYmVyJyA/ICcueCcgOiAvWy4rXS8udGVzdChkYXRhKSA/ICcnIDogJysnKSk7XG4gICAgICAvLyBvYnNjdXJlIHZlcnNpb24gZm9yIHNvbWUgU2FmYXJpIDEtMiByZWxlYXNlc1xuICAgICAgaWYgKG5hbWUgPT0gJ1NhZmFyaScgJiYgKCF2ZXJzaW9uIHx8IHBhcnNlSW50KHZlcnNpb24pID4gNDUpKSB7XG4gICAgICAgIHZlcnNpb24gPSBkYXRhO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBkZXRlY3QgT3BlcmEgZGVza3RvcCBtb2Rlc1xuICAgIGlmIChuYW1lID09ICdPcGVyYScgJiYgIChkYXRhID0gL1xcYnpib3Z8enZhdiQvLmV4ZWMob3MpKSkge1xuICAgICAgbmFtZSArPSAnICc7XG4gICAgICBkZXNjcmlwdGlvbi51bnNoaWZ0KCdkZXNrdG9wIG1vZGUnKTtcbiAgICAgIGlmIChkYXRhID09ICd6dmF2Jykge1xuICAgICAgICBuYW1lICs9ICdNaW5pJztcbiAgICAgICAgdmVyc2lvbiA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuYW1lICs9ICdNb2JpbGUnO1xuICAgICAgfVxuICAgICAgb3MgPSBvcy5yZXBsYWNlKFJlZ0V4cCgnIConICsgZGF0YSArICckJyksICcnKTtcbiAgICB9XG4gICAgLy8gZGV0ZWN0IENocm9tZSBkZXNrdG9wIG1vZGVcbiAgICBlbHNlIGlmIChuYW1lID09ICdTYWZhcmknICYmIC9cXGJDaHJvbWVcXGIvLmV4ZWMobGF5b3V0ICYmIGxheW91dFsxXSkpIHtcbiAgICAgIGRlc2NyaXB0aW9uLnVuc2hpZnQoJ2Rlc2t0b3AgbW9kZScpO1xuICAgICAgbmFtZSA9ICdDaHJvbWUgTW9iaWxlJztcbiAgICAgIHZlcnNpb24gPSBudWxsO1xuXG4gICAgICBpZiAoL1xcYk9TIFhcXGIvLnRlc3Qob3MpKSB7XG4gICAgICAgIG1hbnVmYWN0dXJlciA9ICdBcHBsZSc7XG4gICAgICAgIG9zID0gJ2lPUyA0LjMrJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9zID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gc3RyaXAgaW5jb3JyZWN0IE9TIHZlcnNpb25zXG4gICAgaWYgKHZlcnNpb24gJiYgdmVyc2lvbi5pbmRleE9mKChkYXRhID0gL1tcXGQuXSskLy5leGVjKG9zKSkpID09IDAgJiZcbiAgICAgICAgdWEuaW5kZXhPZignLycgKyBkYXRhICsgJy0nKSA+IC0xKSB7XG4gICAgICBvcyA9IHRyaW0ob3MucmVwbGFjZShkYXRhLCAnJykpO1xuICAgIH1cbiAgICAvLyBhZGQgbGF5b3V0IGVuZ2luZVxuICAgIGlmIChsYXlvdXQgJiYgIS9cXGIoPzpBdmFudHxOb29rKVxcYi8udGVzdChuYW1lKSAmJiAoXG4gICAgICAgIC9Ccm93c2VyfEx1bmFzY2FwZXxNYXh0aG9uLy50ZXN0KG5hbWUpIHx8XG4gICAgICAgIC9eKD86QWRvYmV8QXJvcmF8QnJlYWNofE1pZG9yaXxPcGVyYXxQaGFudG9tfFJla29ucXxSb2NrfFNsZWlwbmlyfFdlYikvLnRlc3QobmFtZSkgJiYgbGF5b3V0WzFdKSkge1xuICAgICAgLy8gZG9uJ3QgYWRkIGxheW91dCBkZXRhaWxzIHRvIGRlc2NyaXB0aW9uIGlmIHRoZXkgYXJlIGZhbHNleVxuICAgICAgKGRhdGEgPSBsYXlvdXRbbGF5b3V0Lmxlbmd0aCAtIDFdKSAmJiBkZXNjcmlwdGlvbi5wdXNoKGRhdGEpO1xuICAgIH1cbiAgICAvLyBjb21iaW5lIGNvbnRleHR1YWwgaW5mb3JtYXRpb25cbiAgICBpZiAoZGVzY3JpcHRpb24ubGVuZ3RoKSB7XG4gICAgICBkZXNjcmlwdGlvbiA9IFsnKCcgKyBkZXNjcmlwdGlvbi5qb2luKCc7ICcpICsgJyknXTtcbiAgICB9XG4gICAgLy8gYXBwZW5kIG1hbnVmYWN0dXJlclxuICAgIGlmIChtYW51ZmFjdHVyZXIgJiYgcHJvZHVjdCAmJiBwcm9kdWN0LmluZGV4T2YobWFudWZhY3R1cmVyKSA8IDApIHtcbiAgICAgIGRlc2NyaXB0aW9uLnB1c2goJ29uICcgKyBtYW51ZmFjdHVyZXIpO1xuICAgIH1cbiAgICAvLyBhcHBlbmQgcHJvZHVjdFxuICAgIGlmIChwcm9kdWN0KSB7XG4gICAgICBkZXNjcmlwdGlvbi5wdXNoKCgvXm9uIC8udGVzdChkZXNjcmlwdGlvbltkZXNjcmlwdGlvbi5sZW5ndGggLTFdKSA/ICcnIDogJ29uICcpICsgcHJvZHVjdCk7XG4gICAgfVxuICAgIC8vIHBhcnNlIE9TIGludG8gYW4gb2JqZWN0XG4gICAgaWYgKG9zKSB7XG4gICAgICBkYXRhID0gLyAoW1xcZC4rXSspJC8uZXhlYyhvcyk7XG4gICAgICBpc1NwZWNpYWxDYXNlZE9TID0gZGF0YSAmJiBvcy5jaGFyQXQob3MubGVuZ3RoIC0gZGF0YVswXS5sZW5ndGggLSAxKSA9PSAnLyc7XG4gICAgICBvcyA9IHtcbiAgICAgICAgJ2FyY2hpdGVjdHVyZSc6IDMyLFxuICAgICAgICAnZmFtaWx5JzogKGRhdGEgJiYgIWlzU3BlY2lhbENhc2VkT1MpID8gb3MucmVwbGFjZShkYXRhWzBdLCAnJykgOiBvcyxcbiAgICAgICAgJ3ZlcnNpb24nOiBkYXRhID8gZGF0YVsxXSA6IG51bGwsXG4gICAgICAgICd0b1N0cmluZyc6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciB2ZXJzaW9uID0gdGhpcy52ZXJzaW9uO1xuICAgICAgICAgIHJldHVybiB0aGlzLmZhbWlseSArICgodmVyc2lvbiAmJiAhaXNTcGVjaWFsQ2FzZWRPUykgPyAnICcgKyB2ZXJzaW9uIDogJycpICsgKHRoaXMuYXJjaGl0ZWN0dXJlID09IDY0ID8gJyA2NC1iaXQnIDogJycpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICAvLyBhZGQgYnJvd3Nlci9PUyBhcmNoaXRlY3R1cmVcbiAgICBpZiAoKGRhdGEgPSAvXFxiKD86QU1EfElBfFdpbnxXT1d8eDg2X3x4KTY0XFxiL2kuZXhlYyhhcmNoKSkgJiYgIS9cXGJpNjg2XFxiL2kudGVzdChhcmNoKSkge1xuICAgICAgaWYgKG9zKSB7XG4gICAgICAgIG9zLmFyY2hpdGVjdHVyZSA9IDY0O1xuICAgICAgICBvcy5mYW1pbHkgPSBvcy5mYW1pbHkucmVwbGFjZShSZWdFeHAoJyAqJyArIGRhdGEpLCAnJyk7XG4gICAgICB9XG4gICAgICBpZiAoXG4gICAgICAgICAgbmFtZSAmJiAoL1xcYldPVzY0XFxiL2kudGVzdCh1YSkgfHxcbiAgICAgICAgICAodXNlRmVhdHVyZXMgJiYgL1xcdyg/Ojg2fDMyKSQvLnRlc3QobmF2LmNwdUNsYXNzIHx8IG5hdi5wbGF0Zm9ybSkgJiYgIS9cXGJXaW42NDsgeDY0XFxiL2kudGVzdCh1YSkpKVxuICAgICAgKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uLnVuc2hpZnQoJzMyLWJpdCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHVhIHx8ICh1YSA9IG51bGwpO1xuXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gICAgLyoqXG4gICAgICogVGhlIHBsYXRmb3JtIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBuYW1lIHBsYXRmb3JtXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgdmFyIHBsYXRmb3JtID0ge307XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGxhdGZvcm0gZGVzY3JpcHRpb24uXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgcGxhdGZvcm1cbiAgICAgKiBAdHlwZSBzdHJpbmd8bnVsbFxuICAgICAqL1xuICAgIHBsYXRmb3JtLmRlc2NyaXB0aW9uID0gdWE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgYnJvd3NlcidzIGxheW91dCBlbmdpbmUuXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgcGxhdGZvcm1cbiAgICAgKiBAdHlwZSBzdHJpbmd8bnVsbFxuICAgICAqL1xuICAgIHBsYXRmb3JtLmxheW91dCA9IGxheW91dCAmJiBsYXlvdXRbMF07XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgcHJvZHVjdCdzIG1hbnVmYWN0dXJlci5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBwbGF0Zm9ybVxuICAgICAqIEB0eXBlIHN0cmluZ3xudWxsXG4gICAgICovXG4gICAgcGxhdGZvcm0ubWFudWZhY3R1cmVyID0gbWFudWZhY3R1cmVyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGJyb3dzZXIvZW52aXJvbm1lbnQuXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgcGxhdGZvcm1cbiAgICAgKiBAdHlwZSBzdHJpbmd8bnVsbFxuICAgICAqL1xuICAgIHBsYXRmb3JtLm5hbWUgPSBuYW1lO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGFscGhhL2JldGEgcmVsZWFzZSBpbmRpY2F0b3IuXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgcGxhdGZvcm1cbiAgICAgKiBAdHlwZSBzdHJpbmd8bnVsbFxuICAgICAqL1xuICAgIHBsYXRmb3JtLnByZXJlbGVhc2UgPSBwcmVyZWxlYXNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHByb2R1Y3QgaG9zdGluZyB0aGUgYnJvd3Nlci5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBwbGF0Zm9ybVxuICAgICAqIEB0eXBlIHN0cmluZ3xudWxsXG4gICAgICovXG4gICAgcGxhdGZvcm0ucHJvZHVjdCA9IHByb2R1Y3Q7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYnJvd3NlcidzIHVzZXIgYWdlbnQgc3RyaW5nLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIHBsYXRmb3JtXG4gICAgICogQHR5cGUgc3RyaW5nfG51bGxcbiAgICAgKi9cbiAgICBwbGF0Zm9ybS51YSA9IHVhO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGJyb3dzZXIvZW52aXJvbm1lbnQgdmVyc2lvbi5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBwbGF0Zm9ybVxuICAgICAqIEB0eXBlIHN0cmluZ3xudWxsXG4gICAgICovXG4gICAgcGxhdGZvcm0udmVyc2lvbiA9IG5hbWUgJiYgdmVyc2lvbjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBuYW1lIG9mIHRoZSBvcGVyYXRpbmcgc3lzdGVtLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIHBsYXRmb3JtXG4gICAgICogQHR5cGUgT2JqZWN0XG4gICAgICovXG4gICAgcGxhdGZvcm0ub3MgPSBvcyB8fCB7XG5cbiAgICAgIC8qKlxuICAgICAgICogVGhlIENQVSBhcmNoaXRlY3R1cmUgdGhlIE9TIGlzIGJ1aWx0IGZvci5cbiAgICAgICAqXG4gICAgICAgKiBAbWVtYmVyT2YgcGxhdGZvcm0ub3NcbiAgICAgICAqIEB0eXBlIG51bWJlcnxudWxsXG4gICAgICAgKi9cbiAgICAgICdhcmNoaXRlY3R1cmUnOiBudWxsLFxuXG4gICAgICAvKipcbiAgICAgICAqIFRoZSBmYW1pbHkgb2YgdGhlIE9TLlxuICAgICAgICpcbiAgICAgICAqIENvbW1vbiB2YWx1ZXMgaW5jbHVkZTpcbiAgICAgICAqIFwiV2luZG93c1wiLCBcIldpbmRvd3MgU2VydmVyIDIwMDggUjIgLyA3XCIsIFwiV2luZG93cyBTZXJ2ZXIgMjAwOCAvIFZpc3RhXCIsXG4gICAgICAgKiBcIldpbmRvd3MgWFBcIiwgXCJPUyBYXCIsIFwiVWJ1bnR1XCIsIFwiRGViaWFuXCIsIFwiRmVkb3JhXCIsIFwiUmVkIEhhdFwiLCBcIlN1U0VcIixcbiAgICAgICAqIFwiQW5kcm9pZFwiLCBcImlPU1wiIGFuZCBcIldpbmRvd3MgUGhvbmVcIlxuICAgICAgICpcbiAgICAgICAqIEBtZW1iZXJPZiBwbGF0Zm9ybS5vc1xuICAgICAgICogQHR5cGUgc3RyaW5nfG51bGxcbiAgICAgICAqL1xuICAgICAgJ2ZhbWlseSc6IG51bGwsXG5cbiAgICAgIC8qKlxuICAgICAgICogVGhlIHZlcnNpb24gb2YgdGhlIE9TLlxuICAgICAgICpcbiAgICAgICAqIEBtZW1iZXJPZiBwbGF0Zm9ybS5vc1xuICAgICAgICogQHR5cGUgc3RyaW5nfG51bGxcbiAgICAgICAqL1xuICAgICAgJ3ZlcnNpb24nOiBudWxsLFxuXG4gICAgICAvKipcbiAgICAgICAqIFJldHVybnMgdGhlIE9TIHN0cmluZy5cbiAgICAgICAqXG4gICAgICAgKiBAbWVtYmVyT2YgcGxhdGZvcm0ub3NcbiAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBPUyBzdHJpbmcuXG4gICAgICAgKi9cbiAgICAgICd0b1N0cmluZyc6IGZ1bmN0aW9uKCkgeyByZXR1cm4gJ251bGwnOyB9XG4gICAgfTtcblxuICAgIHBsYXRmb3JtLnBhcnNlID0gcGFyc2U7XG4gICAgcGxhdGZvcm0udG9TdHJpbmcgPSB0b1N0cmluZ1BsYXRmb3JtO1xuXG4gICAgaWYgKHBsYXRmb3JtLnZlcnNpb24pIHtcbiAgICAgIGRlc2NyaXB0aW9uLnVuc2hpZnQodmVyc2lvbik7XG4gICAgfVxuICAgIGlmIChwbGF0Zm9ybS5uYW1lKSB7XG4gICAgICBkZXNjcmlwdGlvbi51bnNoaWZ0KG5hbWUpO1xuICAgIH1cbiAgICBpZiAob3MgJiYgbmFtZSAmJiAhKG9zID09IFN0cmluZyhvcykuc3BsaXQoJyAnKVswXSAmJiAob3MgPT0gbmFtZS5zcGxpdCgnICcpWzBdIHx8IHByb2R1Y3QpKSkge1xuICAgICAgZGVzY3JpcHRpb24ucHVzaChwcm9kdWN0ID8gJygnICsgb3MgKyAnKScgOiAnb24gJyArIG9zKTtcbiAgICB9XG4gICAgaWYgKGRlc2NyaXB0aW9uLmxlbmd0aCkge1xuICAgICAgcGxhdGZvcm0uZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbi5qb2luKCcgJyk7XG4gICAgfVxuICAgIHJldHVybiBwbGF0Zm9ybTtcbiAgfVxuXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4gIC8vIGV4cG9ydCBwbGF0Zm9ybVxuICAvLyBzb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBjb25kaXRpb24gcGF0dGVybnMgbGlrZSB0aGUgZm9sbG93aW5nOlxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBkZWZpbmUgYXMgYW4gYW5vbnltb3VzIG1vZHVsZSBzbywgdGhyb3VnaCBwYXRoIG1hcHBpbmcsIGl0IGNhbiBiZSBhbGlhc2VkXG4gICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHBhcnNlKCk7XG4gICAgfSk7XG4gIH1cbiAgLy8gY2hlY2sgZm9yIGBleHBvcnRzYCBhZnRlciBgZGVmaW5lYCBpbiBjYXNlIGEgYnVpbGQgb3B0aW1pemVyIGFkZHMgYW4gYGV4cG9ydHNgIG9iamVjdFxuICBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XG4gICAgLy8gaW4gTmFyd2hhbCwgTm9kZS5qcywgUmhpbm8gLXJlcXVpcmUsIG9yIFJpbmdvSlNcbiAgICBmb3JPd24ocGFyc2UoKSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgZnJlZUV4cG9ydHNba2V5XSA9IHZhbHVlO1xuICAgIH0pO1xuICB9XG4gIC8vIGluIGEgYnJvd3NlciBvciBSaGlub1xuICBlbHNlIHtcbiAgICByb290LnBsYXRmb3JtID0gcGFyc2UoKTtcbiAgfVxufS5jYWxsKHRoaXMpKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY2xhc3MgVGltZUVuZ2luZVxuICovXG5jbGFzcyBUaW1lRW5naW5lIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5tYXN0ZXIgPSBudWxsO1xuICAgIHRoaXMub3V0cHV0Tm9kZSA9IG51bGw7XG4gIH1cblxuICBnZXQgY3VycmVudFRpbWUoKSB7XG4gICAgaWYgKHRoaXMubWFzdGVyKVxuICAgICAgcmV0dXJuIHRoaXMubWFzdGVyLmN1cnJlbnRUaW1lO1xuXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGdldCBjdXJyZW50UG9zaXRpb24oKSB7XG4gICAgdmFyIG1hc3RlciA9IHRoaXMubWFzdGVyO1xuXG4gICAgaWYgKG1hc3RlciAmJiBtYXN0ZXIuY3VycmVudFBvc2l0aW9uICE9PSB1bmRlZmluZWQpXG4gICAgICByZXR1cm4gbWFzdGVyLmN1cnJlbnRQb3NpdGlvbjtcblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogU2NoZWR1bGVkIGludGVyZmFjZVxuICAgKiAgIC0gYWR2YW5jZVRpbWUodGltZSksIGNhbGxlZCB0byBnZW5lcmF0ZSBuZXh0IGV2ZW50IGF0IGdpdmVuIHRpbWUsIHJldHVybnMgbmV4dCB0aW1lXG4gICAqL1xuICBpbXBsZW1lbnRzU2NoZWR1bGVkKCkge1xuICAgIHJldHVybiAodGhpcy5hZHZhbmNlVGltZSAmJiB0aGlzLmFkdmFuY2VUaW1lIGluc3RhbmNlb2YgRnVuY3Rpb24pO1xuICB9XG5cbiAgcmVzZXRUaW1lKHRpbWUgPSB1bmRlZmluZWQpIHtcbiAgICBpZiAodGhpcy5tYXN0ZXIpXG4gICAgICB0aGlzLm1hc3Rlci5yZXNldEVuZ2luZVRpbWUodGhpcywgdGltZSk7XG4gIH1cblxuICAvKipcbiAgICogVHJhbnNwb3J0ZWQgaW50ZXJmYWNlXG4gICAqICAgLSBzeW5jUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSwgY2FsbGVkIHRvIHJlcG9zaXRpb24gVGltZUVuZ2luZSwgcmV0dXJucyBuZXh0IHBvc2l0aW9uXG4gICAqICAgLSBhZHZhbmNlUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSwgY2FsbGVkIHRvIGdlbmVyYXRlIG5leHQgZXZlbnQgYXQgZ2l2ZW4gdGltZSBhbmQgcG9zaXRpb24sIHJldHVybnMgbmV4dCBwb3NpdGlvblxuICAgKi9cbiAgaW1wbGVtZW50c1RyYW5zcG9ydGVkKCkge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLnN5bmNQb3NpdGlvbiAmJiB0aGlzLnN5bmNQb3NpdGlvbiBpbnN0YW5jZW9mIEZ1bmN0aW9uICYmXG4gICAgICB0aGlzLmFkdmFuY2VQb3NpdGlvbiAmJiB0aGlzLmFkdmFuY2VQb3NpdGlvbiBpbnN0YW5jZW9mIEZ1bmN0aW9uXG4gICAgKTtcbiAgfVxuXG4gIHJlc2V0UG9zaXRpb24ocG9zaXRpb24gPSB1bmRlZmluZWQpIHtcbiAgICBpZiAodGhpcy5tYXN0ZXIpXG4gICAgICB0aGlzLm1hc3Rlci5yZXNldEVuZ2luZVBvc2l0aW9uKHRoaXMsIHBvc2l0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTcGVlZC1jb250cm9sbGVkIGludGVyZmFjZVxuICAgKiAgIC0gc3luY1NwZWVkKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCwgKSwgY2FsbGVkIHRvXG4gICAqL1xuICBpbXBsZW1lbnRzU3BlZWRDb250cm9sbGVkKCkge1xuICAgIHJldHVybiAodGhpcy5zeW5jU3BlZWQgJiYgdGhpcy5zeW5jU3BlZWQgaW5zdGFuY2VvZiBGdW5jdGlvbik7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBUaW1lRW5naW5lOyIsIi8vIG1vbmtleXBhdGNoIG9sZCB3ZWJBdWRpb0FQSVxucmVxdWlyZSgnLi9hYy1tb25rZXlwYXRjaCcpO1xuXG4vLyBleHBvc2VzIGEgc2luZ2xlIGluc3RhbmNlXG52YXIgYXVkaW9Db250ZXh0O1xuXG5pZiAod2luZG93LkF1ZGlvQ29udGV4dClcbiAgYXVkaW9Db250ZXh0ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBhdWRpb0NvbnRleHQ7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgQXVkaW9UaW1lRW5naW5lID0gcmVxdWlyZShcIi4uL2NvcmUvYXVkaW8tdGltZS1lbmdpbmVcIik7XG5cbmZ1bmN0aW9uIG9wdE9yRGVmKG9wdCwgZGVmKSB7XG4gIGlmKG9wdCAhPT0gdW5kZWZpbmVkKVxuICAgIHJldHVybiBvcHQ7XG5cbiAgcmV0dXJuIGRlZjtcbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudE9yUHJldmlvdXNJbmRleChzb3J0ZWRBcnJheSwgdmFsdWUsIGluZGV4ID0gMCkge1xuICB2YXIgc2l6ZSA9IHNvcnRlZEFycmF5Lmxlbmd0aDtcblxuICBpZiAoc2l6ZSA+IDApIHtcbiAgICB2YXIgZmlyc3RWYWwgPSBzb3J0ZWRBcnJheVswXTtcbiAgICB2YXIgbGFzdFZhbCA9IHNvcnRlZEFycmF5W3NpemUgLSAxXTtcblxuICAgIGlmICh2YWx1ZSA8IGZpcnN0VmFsKVxuICAgICAgaW5kZXggPSAtMTtcbiAgICBlbHNlIGlmICh2YWx1ZSA+PSBsYXN0VmFsKVxuICAgICAgaW5kZXggPSBzaXplIC0gMTtcbiAgICBlbHNlIHtcbiAgICAgIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gc2l6ZSlcbiAgICAgICAgaW5kZXggPSBNYXRoLmZsb29yKChzaXplIC0gMSkgKiAodmFsdWUgLSBmaXJzdFZhbCkgLyAobGFzdFZhbCAtIGZpcnN0VmFsKSk7XG5cbiAgICAgIHdoaWxlIChzb3J0ZWRBcnJheVtpbmRleF0gPiB2YWx1ZSlcbiAgICAgICAgaW5kZXgtLTtcblxuICAgICAgd2hpbGUgKHNvcnRlZEFycmF5W2luZGV4ICsgMV0gPD0gdmFsdWUpXG4gICAgICAgIGluZGV4Kys7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50T3JOZXh0SW5kZXgoc29ydGVkQXJyYXksIHZhbHVlLCBpbmRleCA9IDApIHtcbiAgdmFyIHNpemUgPSBzb3J0ZWRBcnJheS5sZW5ndGg7XG5cbiAgaWYgKHNpemUgPiAwKSB7XG4gICAgdmFyIGZpcnN0VmFsID0gc29ydGVkQXJyYXlbMF07XG4gICAgdmFyIGxhc3RWYWwgPSBzb3J0ZWRBcnJheVtzaXplIC0gMV07XG5cbiAgICBpZiAodmFsdWUgPD0gZmlyc3RWYWwpXG4gICAgICBpbmRleCA9IDA7XG4gICAgZWxzZSBpZiAodmFsdWUgPj0gbGFzdFZhbClcbiAgICAgIGluZGV4ID0gc2l6ZTtcbiAgICBlbHNlIHtcbiAgICAgIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gc2l6ZSlcbiAgICAgICAgaW5kZXggPSBNYXRoLmZsb29yKChzaXplIC0gMSkgKiAodmFsdWUgLSBmaXJzdFZhbCkgLyAobGFzdFZhbCAtIGZpcnN0VmFsKSk7XG5cbiAgICAgIHdoaWxlIChzb3J0ZWRBcnJheVtpbmRleF0gPCB2YWx1ZSlcbiAgICAgICAgaW5kZXgrKztcblxuICAgICAgd2hpbGUgKHNvcnRlZEFycmF5W2luZGV4ICsgMV0gPj0gdmFsdWUpXG4gICAgICAgIGluZGV4LS07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGluZGV4O1xufVxuXG4vKipcbiAqIEBjbGFzcyBTZWdtZW50RW5naW5lXG4gKi9cbmNsYXNzIFNlZ21lbnRFbmdpbmUgZXh0ZW5kcyBBdWRpb1RpbWVFbmdpbmUge1xuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSB7QXVkaW9CdWZmZXJ9IGJ1ZmZlciBpbml0aWFsIGF1ZGlvIGJ1ZmZlciBmb3IgZ3JhbnVsYXIgc3ludGhlc2lzXG4gICAqXG4gICAqIFRoZSBlbmdpbmUgaW1wbGVtZW50cyB0aGUgXCJzY2hlZHVsZWRcIiBhbmQgXCJ0cmFuc3BvcnRlZFwiIGludGVyZmFjZXMuXG4gICAqIFdoZW4gXCJzY2hlZHVsZWRcIiwgdGhlIGVuZ2luZSAgZ2VuZXJhdGVzIHNlZ21lbnRzIG1vcmUgb3IgbGVzc8KgcGVyaW9kaWNhbGx5XG4gICAqIChjb250cm9sbGVkIGJ5IHRoZSBwZXJpb2RBYnMsIHBlcmlvZFJlbCwgYW5kIHBlcmlvVmFyIGF0dHJpYnV0ZXMpLlxuICAgKiBXaGVuIFwidHJhbnNwb3J0ZWRcIiwgdGhlIGVuZ2luZSBnZW5lcmF0ZXMgc2VnbWVudHMgYXQgdGhlIHBvc2l0aW9uIG9mIHRoZWlyIG9uc2V0IHRpbWUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICBzdXBlcihvcHRpb25zLmF1ZGlvQ29udGV4dCk7XG5cbiAgICAvKipcbiAgICAgKiBBdWRpbyBidWZmZXJcbiAgICAgKiBAdHlwZSB7QXVkaW9CdWZmZXJ9XG4gICAgICovXG4gICAgdGhpcy5idWZmZXIgPSBvcHRPckRlZihvcHRpb25zLmJ1ZmZlciwgbnVsbCk7XG5cbiAgICAvKipcbiAgICAgKiBBYnNvbHV0ZSBzZWdtZW50IHBlcmlvZCBpbiBzZWNcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMucGVyaW9kQWJzID0gb3B0T3JEZWYob3B0aW9ucy5wZXJpb2RBYnMsIDApO1xuXG4gICAgLyoqXG4gICAgICogU2VnbWVudCBwZXJpb2QgcmVsYXRpdmUgdG8gaW50ZXItc2VnbWVudCBkaXN0YW5jZVxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5wZXJpb2RSZWwgPSBvcHRPckRlZihvcHRpb25zLnBlcmlvZFJlbCwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBBbW91dCBvZiByYW5kb20gc2VnbWVudCBwZXJpb2QgdmFyaWF0aW9uIHJlbGF0aXZlIHRvIHNlZ21lbnQgcGVyaW9kXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLnBlcmlvZFZhciA9IG9wdE9yRGVmKG9wdGlvbnMucGVyaW9kVmFyLCAwKTtcblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIHNlZ21lbnQgcG9zaXRpb25zIChvbnNldCB0aW1lcyBpbiBhdWRpbyBidWZmZXIpIGluIHNlY1xuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5wb3NpdGlvbkFycmF5ID0gb3B0T3JEZWYob3B0aW9ucy5wb3NpdGlvbkFycmF5LCBbMC4wXSk7XG5cbiAgICAvKipcbiAgICAgKiBBbW91dCBvZiByYW5kb20gc2VnbWVudCBwb3NpdGlvbiB2YXJpYXRpb24gaW4gc2VjXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLnBvc2l0aW9uVmFyID0gb3B0T3JEZWYob3B0aW9ucy5wb3NpdGlvblZhciwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBBcnJheSBvZiBzZWdtZW50IGR1cmF0aW9ucyBpbiBzZWNcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuZHVyYXRpb25BcnJheSA9IG9wdE9yRGVmKG9wdGlvbnMuZHVyYXRpb25BcnJheSwgWzAuMF0pO1xuXG4gICAgLyoqXG4gICAgICogQWJzb2x1dGUgc2VnbWVudCBkdXJhdGlvbiBpbiBzZWNcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuZHVyYXRpb25BYnMgPSBvcHRPckRlZihvcHRpb25zLmR1cmF0aW9uQWJzLCAwKTtcblxuICAgIC8qKlxuICAgICAqIFNlZ21lbnQgZHVyYXRpb24gcmVsYXRpdmUgdG8gZ2l2ZW4gc2VnbWVudCBkdXJhdGlvbiBvciBpbnRlci1zZWdtZW50IGRpc3RhbmNlXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLmR1cmF0aW9uUmVsID0gb3B0T3JEZWYob3B0aW9ucy5kdXJhdGlvblJlbCwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBBcnJheSBvZiBzZWdtZW50IG9mZnNldHMgaW4gc2VjXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKlxuICAgICAqIG9mZnNldCA+IDA6IHRoZSBzZWdtZW50J3MgcmVmZXJlbmNlIHBvc2l0aW9uIGlzIGFmdGVyIHRoZSBnaXZlbiBzZWdtZW50IHBvc2l0aW9uXG4gICAgICogb2Zmc2V0IDwgMDogdGhlIGdpdmVuIHNlZ21lbnQgcG9zaXRpb24gaXMgdGhlIHNlZ21lbnQncyByZWZlcmVuY2UgcG9zaXRpb24gYW5kIHRoZSBkdXJhdGlvbiBoYXMgdG8gYmUgY29ycmVjdGVkIGJ5IHRoZSBvZmZzZXRcbiAgICAgKi9cbiAgICB0aGlzLm9mZnNldEFycmF5ID0gb3B0T3JEZWYob3B0aW9ucy5vZmZzZXRBcnJheSwgWzAuMF0pO1xuXG4gICAgLyoqXG4gICAgICogQWJzb2x1dGUgc2VnbWVudCBvZmZzZXQgaW4gc2VjXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLm9mZnNldEFicyA9IG9wdE9yRGVmKG9wdGlvbnMub2Zmc2V0QWJzLCAtMC4wMDUpO1xuXG4gICAgLyoqXG4gICAgICogU2VnbWVudCBvZmZzZXQgcmVsYXRpdmUgdG8gc2VnbWVudCBkdXJhdGlvblxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5vZmZzZXRSZWwgPSBvcHRPckRlZihvcHRpb25zLm9mZnNldFJlbCwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBUaW1lIGJ5IHdoaWNoIGFsbCBzZWdtZW50cyBhcmUgZGVsYXllZCAoZXNwZWNpYWxseSB0byByZWFsaXplIHNlZ21lbnQgb2Zmc2V0cylcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuZGVsYXkgPSBvcHRPckRlZihvcHRpb25zLmRlbGF5LCAwLjAwNSk7XG5cbiAgICAvKipcbiAgICAgKiBBYnNvbHV0ZSBhdHRhY2sgdGltZSBpbiBzZWNcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuYXR0YWNrQWJzID0gb3B0T3JEZWYob3B0aW9ucy5hdHRhY2tBYnMsIDAuMDA1KTtcblxuICAgIC8qKlxuICAgICAqIEF0dGFjayB0aW1lIHJlbGF0aXZlIHRvIHNlZ21lbnQgZHVyYXRpb25cbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuYXR0YWNrUmVsID0gb3B0T3JEZWYob3B0aW9ucy5hdHRhY2tSZWwsIDApO1xuXG4gICAgLyoqXG4gICAgICogQWJzb2x1dGUgcmVsZWFzZSB0aW1lIGluIHNlY1xuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5yZWxlYXNlQWJzID0gb3B0T3JEZWYob3B0aW9ucy5yZWxlYXNlQWJzLCAwLjAwNSk7XG5cbiAgICAvKipcbiAgICAgKiBSZWxlYXNlIHRpbWUgcmVsYXRpdmUgdG8gc2VnbWVudCBkdXJhdGlvblxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5yZWxlYXNlUmVsID0gb3B0T3JEZWYob3B0aW9ucy5yZWxlYXNlUmVsLCAwKTtcblxuICAgIC8qKlxuICAgICAqIFNlZ21lbnQgcmVzYW1wbGluZyBpbiBjZW50XG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLnJlc2FtcGxpbmcgPSBvcHRPckRlZihvcHRpb25zLnJlc2FtcGxpbmcsIDApO1xuXG4gICAgLyoqXG4gICAgICogQW1vdXQgb2YgcmFuZG9tIHJlc2FtcGxpbmcgdmFyaWF0aW9uIGluIGNlbnRcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMucmVzYW1wbGluZ1ZhciA9IG9wdE9yRGVmKG9wdGlvbnMucmVzYW1wbGluZ1ZhciwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBMaW5lYXIgZ2FpbiBmYWN0b3JcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuZ2FpbiA9IG9wdE9yRGVmKG9wdGlvbnMuZ2FpbiwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBJbmRleCBvZiB0aGUgc2VnbWVudCB0byBzeW50aGVzaXplIChpLmUuIG9mIHRoaXMucG9zaXRpb25BcnJheS9kdXJhdGlvbkFycmF5L29mZnNldEFycmF5KVxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5zZWdtZW50SW5kZXggPSBvcHRPckRlZihvcHRpb25zLnNlZ21lbnRJbmRleCwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBhdWRpbyBidWZmZXIgYW5kIHNlZ21lbnQgaW5kaWNlcyBhcmUgY29uc2lkZXJlZCBhcyBjeWNsaWNcbiAgICAgKiBAdHlwZSB7Qm9vbH1cbiAgICAgKi9cbiAgICB0aGlzLmN5Y2xpYyA9IG9wdE9yRGVmKG9wdGlvbnMuY3ljbGljLCBmYWxzZSk7XG4gICAgdGhpcy5fX2N5Y2xpY09mZnNldCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBQb3J0aW9uIGF0IHRoZSBlbmQgb2YgdGhlIGF1ZGlvIGJ1ZmZlciB0aGF0IGhhcyBiZWVuIGNvcGllZCBmcm9tIHRoZSBiZWdpbm5pbmcgdG8gYXNzdXJlIGN5Y2xpYyBiZWhhdmlvclxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy53cmFwQXJvdW5kRXh0ZW5zaW9uID0gb3B0T3JEZWYob3B0aW9ucy53cmFwQXJvdW5kRXh0ZW5zaW9uLCAwKTtcblxuICAgIHRoaXMub3V0cHV0Tm9kZSA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYnVmZmVyIGR1cmF0aW9uIChleGNsdWRpbmcgd3JhcEFyb3VuZEV4dGVuc2lvbilcbiAgICogQHJldHVybiB7TnVtYmVyfSBjdXJyZW50IGJ1ZmZlciBkdXJhdGlvblxuICAgKi9cbiAgZ2V0IGJ1ZmZlckR1cmF0aW9uKCkge1xuICAgIGlmICh0aGlzLmJ1ZmZlcikge1xuICAgICAgdmFyIGJ1ZmZlckR1cmF0aW9uID0gdGhpcy5idWZmZXIuZHVyYXRpb247XG5cbiAgICAgIGlmICh0aGlzLndyYXBBcm91bmRFeHRlbnNpb24pXG4gICAgICAgIGJ1ZmZlckR1cmF0aW9uIC09IHRoaXMud3JhcEFyb3VuZEV4dGVuc2lvbjtcblxuICAgICAgcmV0dXJuIGJ1ZmZlckR1cmF0aW9uO1xuICAgIH1cblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLy8gVGltZUVuZ2luZSBtZXRob2QgKHRyYW5zcG9ydGVkIGludGVyZmFjZSlcbiAgYWR2YW5jZVRpbWUodGltZSkge1xuICAgIHRpbWUgPSBNYXRoLm1heCh0aW1lLCB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSk7XG4gICAgcmV0dXJuIHRpbWUgKyB0aGlzLnRyaWdnZXIodGltZSk7XG4gIH1cblxuICAvLyBUaW1lRW5naW5lIG1ldGhvZCAodHJhbnNwb3J0ZWQgaW50ZXJmYWNlKVxuICBzeW5jUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSB7XG4gICAgdmFyIGluZGV4ID0gdGhpcy5zZWdtZW50SW5kZXg7XG4gICAgdmFyIGN5Y2xpY09mZnNldCA9IDA7XG4gICAgdmFyIGJ1ZmZlckR1cmF0aW9uID0gdGhpcy5idWZmZXJEdXJhdGlvbjtcblxuICAgIGlmICh0aGlzLmN5Y2xpYykge1xuICAgICAgdmFyIGN5Y2xlcyA9IHBvc2l0aW9uIC8gYnVmZmVyRHVyYXRpb247XG5cbiAgICAgIGN5Y2xpY09mZnNldCA9IE1hdGguZmxvb3IoY3ljbGVzKSAqIGJ1ZmZlckR1cmF0aW9uO1xuICAgICAgcG9zaXRpb24gLT0gY3ljbGljT2Zmc2V0O1xuICAgIH1cblxuICAgIGlmIChzcGVlZCA+IDApIHtcbiAgICAgIGluZGV4ID0gZ2V0Q3VycmVudE9yTmV4dEluZGV4KHRoaXMucG9zaXRpb25BcnJheSwgcG9zaXRpb24pO1xuXG4gICAgICBpZiAoaW5kZXggPj0gdGhpcy5wb3NpdGlvbkFycmF5Lmxlbmd0aCkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICAgIGN5Y2xpY09mZnNldCArPSBidWZmZXJEdXJhdGlvbjtcblxuICAgICAgICBpZiAoIXRoaXMuY3ljbGljKVxuICAgICAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNwZWVkIDwgMCkge1xuICAgICAgaW5kZXggPSBnZXRDdXJyZW50T3JQcmV2aW91c0luZGV4KHRoaXMucG9zaXRpb25BcnJheSwgcG9zaXRpb24pO1xuXG4gICAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICAgIGluZGV4ID0gdGhpcy5wb3NpdGlvbkFycmF5Lmxlbmd0aCAtIDE7XG4gICAgICAgIGN5Y2xpY09mZnNldCAtPSBidWZmZXJEdXJhdGlvbjtcblxuICAgICAgICBpZiAoIXRoaXMuY3ljbGljKVxuICAgICAgICAgIHJldHVybiAtSW5maW5pdHk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICB9XG5cbiAgICB0aGlzLnNlZ21lbnRJbmRleCA9IGluZGV4O1xuICAgIHRoaXMuX19jeWNsaWNPZmZzZXQgPSBjeWNsaWNPZmZzZXQ7XG5cbiAgICByZXR1cm4gY3ljbGljT2Zmc2V0ICsgdGhpcy5wb3NpdGlvbkFycmF5W2luZGV4XTtcbiAgfVxuXG4gIC8vIFRpbWVFbmdpbmUgbWV0aG9kICh0cmFuc3BvcnRlZCBpbnRlcmZhY2UpXG4gIGFkdmFuY2VQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICB2YXIgaW5kZXggPSB0aGlzLnNlZ21lbnRJbmRleDtcbiAgICB2YXIgY3ljbGljT2Zmc2V0ID0gdGhpcy5fX2N5Y2xpY09mZnNldDtcblxuICAgIHRoaXMudHJpZ2dlcih0aW1lKTtcblxuICAgIGlmIChzcGVlZCA+IDApIHtcbiAgICAgIGluZGV4Kys7XG5cbiAgICAgIGlmIChpbmRleCA+PSB0aGlzLnBvc2l0aW9uQXJyYXkubGVuZ3RoKSB7XG4gICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgY3ljbGljT2Zmc2V0ICs9IHRoaXMuYnVmZmVyRHVyYXRpb247XG5cbiAgICAgICAgaWYgKCF0aGlzLmN5Y2xpYylcbiAgICAgICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGluZGV4LS07XG5cbiAgICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgICAgaW5kZXggPSB0aGlzLnBvc2l0aW9uQXJyYXkubGVuZ3RoIC0gMTtcbiAgICAgICAgY3ljbGljT2Zmc2V0IC09IHRoaXMuYnVmZmVyRHVyYXRpb247XG5cbiAgICAgICAgaWYgKCF0aGlzLmN5Y2xpYylcbiAgICAgICAgICByZXR1cm4gLUluZmluaXR5O1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2VnbWVudEluZGV4ID0gaW5kZXg7XG4gICAgdGhpcy5fX2N5Y2xpY09mZnNldCA9IGN5Y2xpY09mZnNldDtcblxuICAgIHJldHVybiBjeWNsaWNPZmZzZXQgKyB0aGlzLnBvc2l0aW9uQXJyYXlbaW5kZXhdO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyaWdnZXIgYSBzZWdtZW50XG4gICAqIEBwYXJhbSB7TnVtYmVyfSB0aW1lIHNlZ21lbnQgc3ludGhlc2lzIGF1ZGlvIHRpbWVcbiAgICogQHJldHVybiB7TnVtYmVyfSBwZXJpb2QgdG8gbmV4dCBzZWdtZW50XG4gICAqXG4gICAqIFRoaXMgZnVuY3Rpb24gY2FuIGJlIGNhbGxlZCBhdCBhbnkgdGltZSAod2hldGhlciB0aGUgZW5naW5lIGlzIHNjaGVkdWxlZC90cmFuc3BvcnRlZCBvciBub3QpXG4gICAqIHRvIGdlbmVyYXRlIGEgc2luZ2xlIHNlZ21lbnQgYWNjb3JkaW5nIHRvIHRoZSBjdXJyZW50IHNlZ21lbnQgcGFyYW1ldGVycy5cbiAgICovXG4gIHRyaWdnZXIodGltZSkge1xuICAgIHZhciBhdWRpb0NvbnRleHQgPSB0aGlzLmF1ZGlvQ29udGV4dDtcbiAgICB2YXIgc2VnbWVudFRpbWUgPSAodGltZSB8fCBhdWRpb0NvbnRleHQuY3VycmVudFRpbWUpICsgdGhpcy5kZWxheTtcbiAgICB2YXIgc2VnbWVudFBlcmlvZCA9IHRoaXMucGVyaW9kQWJzO1xuICAgIHZhciBzZWdtZW50SW5kZXggPSB0aGlzLnNlZ21lbnRJbmRleDtcbiBcbiAgICBpZiAodGhpcy5idWZmZXIpIHtcbiAgICAgIHZhciBzZWdtZW50UG9zaXRpb24gPSAwLjA7XG4gICAgICB2YXIgc2VnbWVudER1cmF0aW9uID0gMC4wO1xuICAgICAgdmFyIHNlZ21lbnRPZmZzZXQgPSAwLjA7XG4gICAgICB2YXIgcmVzYW1wbGluZ1JhdGUgPSAxLjA7XG4gICAgICB2YXIgYnVmZmVyRHVyYXRpb24gPSB0aGlzLmJ1ZmZlckR1cmF0aW9uO1xuXG4gICAgICBpZiAodGhpcy5jeWNsaWMpXG4gICAgICAgIHNlZ21lbnRJbmRleCA9IHNlZ21lbnRJbmRleCAlIHRoaXMucG9zaXRpb25BcnJheS5sZW5ndGg7XG4gICAgICBlbHNlXG4gICAgICAgIHNlZ21lbnRJbmRleCA9IE1hdGgubWF4KDAsIE1hdGgubWluKHNlZ21lbnRJbmRleCwgdGhpcy5wb3NpdGlvbkFycmF5Lmxlbmd0aCAtIDEpKTtcblxuICAgICAgaWYgKHRoaXMucG9zaXRpb25BcnJheSlcbiAgICAgICAgc2VnbWVudFBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbkFycmF5W3NlZ21lbnRJbmRleF0gfHwgMDtcblxuICAgICAgaWYgKHRoaXMuZHVyYXRpb25BcnJheSlcbiAgICAgICAgc2VnbWVudER1cmF0aW9uID0gdGhpcy5kdXJhdGlvbkFycmF5W3NlZ21lbnRJbmRleF0gfHwgMDtcblxuICAgICAgaWYgKHRoaXMub2Zmc2V0QXJyYXkpXG4gICAgICAgIHNlZ21lbnRPZmZzZXQgPSB0aGlzLm9mZnNldEFycmF5W3NlZ21lbnRJbmRleF0gfHwgMDtcblxuICAgICAgLy8gY2FsY3VsYXRlIHJlc2FtcGxpbmdcbiAgICAgIGlmICh0aGlzLnJlc2FtcGxpbmcgIT09IDAgfHwgdGhpcy5yZXNhbXBsaW5nVmFyID4gMCkge1xuICAgICAgICB2YXIgcmFuZG9tUmVzYW1wbGluZyA9IChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIDIuMCAqIHRoaXMucmVzYW1wbGluZ1ZhcjtcbiAgICAgICAgcmVzYW1wbGluZ1JhdGUgPSBNYXRoLnBvdygyLjAsICh0aGlzLnJlc2FtcGxpbmcgKyByYW5kb21SZXNhbXBsaW5nKSAvIDEyMDAuMCk7XG4gICAgICB9XG5cbiAgICAgIC8vIGNhbGN1bGF0ZSBpbnRlci1zZWdtZW50IGRpc3RhbmNlXG4gICAgICBpZiAoc2VnbWVudER1cmF0aW9uID09PSAwIHx8IHRoaXMucGVyaW9kUmVsID4gMCkge1xuICAgICAgICB2YXIgbmV4dFNlZ2VtZW50SW5kZXggPSBzZWdtZW50SW5kZXggKyAxO1xuICAgICAgICB2YXIgbmV4dFBvc2l0aW9uLCBuZXh0T2Zmc2V0O1xuXG4gICAgICAgIGlmIChuZXh0U2VnZW1lbnRJbmRleCA9PT0gdGhpcy5wb3NpdGlvbkFycmF5Lmxlbmd0aCkge1xuICAgICAgICAgIGlmICh0aGlzLmN5Y2xpYykge1xuICAgICAgICAgICAgbmV4dFBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbkFycmF5WzBdICsgYnVmZmVyRHVyYXRpb247XG4gICAgICAgICAgICBuZXh0T2Zmc2V0ID0gdGhpcy5vZmZzZXRBcnJheVswXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV4dFBvc2l0aW9uID0gYnVmZmVyRHVyYXRpb247XG4gICAgICAgICAgICBuZXh0T2Zmc2V0ID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV4dFBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbkFycmF5W25leHRTZWdlbWVudEluZGV4XTtcbiAgICAgICAgICBuZXh0T2Zmc2V0ID0gdGhpcy5vZmZzZXRBcnJheVtuZXh0U2VnZW1lbnRJbmRleF07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaW50ZXJTZWdtZW50RGlzdGFuY2UgPSBuZXh0UG9zaXRpb24gLSBzZWdtZW50UG9zaXRpb247XG5cbiAgICAgICAgLy8gY29ycmVjdCBpbnRlci1zZWdtZW50IGRpc3RhbmNlIGJ5IG9mZnNldHNcbiAgICAgICAgLy8gICBvZmZzZXQgPiAwOiB0aGUgc2VnbWVudCdzIHJlZmVyZW5jZSBwb3NpdGlvbiBpcyBhZnRlciB0aGUgZ2l2ZW4gc2VnbWVudCBwb3NpdGlvblxuICAgICAgICBpZiAoc2VnbWVudE9mZnNldCA+IDApXG4gICAgICAgICAgaW50ZXJTZWdtZW50RGlzdGFuY2UgLT0gc2VnbWVudE9mZnNldDtcblxuICAgICAgICBpZiAobmV4dE9mZnNldCA+IDApXG4gICAgICAgICAgaW50ZXJTZWdtZW50RGlzdGFuY2UgKz0gbmV4dE9mZnNldDtcblxuICAgICAgICBpZiAoaW50ZXJTZWdtZW50RGlzdGFuY2UgPCAwKVxuICAgICAgICAgIGludGVyU2VnbWVudERpc3RhbmNlID0gMDtcblxuICAgICAgICAvLyB1c2UgaW50ZXItc2VnbWVudCBkaXN0YW5jZSBpbnN0ZWFkIG9mIHNlZ21lbnQgZHVyYXRpb25cbiAgICAgICAgaWYgKHNlZ21lbnREdXJhdGlvbiA9PT0gMClcbiAgICAgICAgICBzZWdtZW50RHVyYXRpb24gPSBpbnRlclNlZ21lbnREaXN0YW5jZTtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgcGVyaW9kIHJlbGF0aXZlIHRvIGludGVyIG1hcmtlciBkaXN0YW5jZVxuICAgICAgICBzZWdtZW50UGVyaW9kICs9IHRoaXMucGVyaW9kUmVsICogaW50ZXJTZWdtZW50RGlzdGFuY2U7XG4gICAgICB9XG5cbiAgICAgIC8vIGFkZCByZWxhdGl2ZSBhbmQgYWJzb2x1dGUgc2VnbWVudCBkdXJhdGlvblxuICAgICAgc2VnbWVudER1cmF0aW9uICo9IHRoaXMuZHVyYXRpb25SZWw7XG4gICAgICBzZWdtZW50RHVyYXRpb24gKz0gdGhpcy5kdXJhdGlvbkFicztcblxuICAgICAgLy8gYWRkIHJlbGF0aXZlIGFuZCBhYnNvbHV0ZSBzZWdtZW50IG9mZnNldFxuICAgICAgc2VnbWVudE9mZnNldCAqPSB0aGlzLm9mZnNldFJlbDtcbiAgICAgIHNlZ21lbnRPZmZzZXQgKz0gdGhpcy5vZmZzZXRBYnM7XG5cbiAgICAgIC8vIGFwcGx5IHNlZ21lbnQgb2Zmc2V0XG4gICAgICAvLyAgIG9mZnNldCA+IDA6IHRoZSBzZWdtZW50J3MgcmVmZXJlbmNlIHBvc2l0aW9uIGlzIGFmdGVyIHRoZSBnaXZlbiBzZWdtZW50IHBvc2l0aW9uXG4gICAgICAvLyAgIG9mZnNldCA8IDA6IHRoZSBnaXZlbiBzZWdtZW50IHBvc2l0aW9uIGlzIHRoZSBzZWdtZW50J3MgcmVmZXJlbmNlIHBvc2l0aW9uIGFuZCB0aGUgZHVyYXRpb24gaGFzIHRvIGJlIGNvcnJlY3RlZCBieSB0aGUgb2Zmc2V0XG4gICAgICBpZiAoc2VnbWVudE9mZnNldCA8IDApIHtcbiAgICAgICAgc2VnbWVudER1cmF0aW9uIC09IHNlZ21lbnRPZmZzZXQ7XG4gICAgICAgIHNlZ21lbnRQb3NpdGlvbiArPSBzZWdtZW50T2Zmc2V0O1xuICAgICAgICBzZWdtZW50VGltZSArPSAoc2VnbWVudE9mZnNldCAvIHJlc2FtcGxpbmdSYXRlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlZ21lbnRUaW1lIC09IChzZWdtZW50T2Zmc2V0IC8gcmVzYW1wbGluZ1JhdGUpO1xuICAgICAgfVxuXG4gICAgICAvLyByYW5kb21pemUgc2VnbWVudCBwb3NpdGlvblxuICAgICAgaWYgKHRoaXMucG9zaXRpb25WYXIgPiAwKVxuICAgICAgICBzZWdtZW50UG9zaXRpb24gKz0gMi4wICogKE1hdGgucmFuZG9tKCkgLSAwLjUpICogdGhpcy5wb3NpdGlvblZhcjtcblxuICAgICAgLy8gc2hvcnRlbiBkdXJhdGlvbiBvZiBzZWdtZW50cyBvdmVyIHRoZSBlZGdlcyBvZiB0aGUgYnVmZmVyXG4gICAgICBpZiAoc2VnbWVudFBvc2l0aW9uIDwgMCkge1xuICAgICAgICBzZWdtZW50RHVyYXRpb24gKz0gc2VnbWVudFBvc2l0aW9uO1xuICAgICAgICBzZWdtZW50UG9zaXRpb24gPSAwO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VnbWVudFBvc2l0aW9uICsgc2VnbWVudER1cmF0aW9uID4gdGhpcy5idWZmZXIuZHVyYXRpb24pXG4gICAgICAgIHNlZ21lbnREdXJhdGlvbiA9IHRoaXMuYnVmZmVyLmR1cmF0aW9uIC0gc2VnbWVudFBvc2l0aW9uO1xuXG4gICAgICAvLyBtYWtlIHNlZ21lbnRcbiAgICAgIGlmICh0aGlzLmdhaW4gPiAwICYmIHNlZ21lbnREdXJhdGlvbiA+IDApIHtcbiAgICAgICAgLy8gbWFrZSBzZWdtZW50IGVudmVsb3BlXG4gICAgICAgIHZhciBlbnZlbG9wZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICAgIHZhciBhdHRhY2sgPSB0aGlzLmF0dGFja0FicyArIHRoaXMuYXR0YWNrUmVsICogc2VnbWVudER1cmF0aW9uO1xuICAgICAgICB2YXIgcmVsZWFzZSA9IHRoaXMucmVsZWFzZUFicyArIHRoaXMucmVsZWFzZVJlbCAqIHNlZ21lbnREdXJhdGlvbjtcblxuICAgICAgICBpZiAoYXR0YWNrICsgcmVsZWFzZSA+IHNlZ21lbnREdXJhdGlvbikge1xuICAgICAgICAgIHZhciBmYWN0b3IgPSBzZWdtZW50RHVyYXRpb24gLyAoYXR0YWNrICsgcmVsZWFzZSk7XG4gICAgICAgICAgYXR0YWNrICo9IGZhY3RvcjtcbiAgICAgICAgICByZWxlYXNlICo9IGZhY3RvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhdHRhY2tFbmRUaW1lID0gc2VnbWVudFRpbWUgKyBhdHRhY2s7XG4gICAgICAgIHZhciBzZWdtZW50RW5kVGltZSA9IHNlZ21lbnRUaW1lICsgc2VnbWVudER1cmF0aW9uO1xuICAgICAgICB2YXIgcmVsZWFzZVN0YXJ0VGltZSA9IHNlZ21lbnRFbmRUaW1lIC0gcmVsZWFzZTtcblxuICAgICAgICBlbnZlbG9wZS5nYWluLnNldFZhbHVlQXRUaW1lKDAuMCwgc2VnbWVudFRpbWUpO1xuICAgICAgICBlbnZlbG9wZS5nYWluLmxpbmVhclJhbXBUb1ZhbHVlQXRUaW1lKHRoaXMuZ2FpbiwgYXR0YWNrRW5kVGltZSk7XG5cbiAgICAgICAgaWYgKHJlbGVhc2VTdGFydFRpbWUgPiBhdHRhY2tFbmRUaW1lKVxuICAgICAgICAgIGVudmVsb3BlLmdhaW4uc2V0VmFsdWVBdFRpbWUodGhpcy5nYWluLCByZWxlYXNlU3RhcnRUaW1lKTtcblxuICAgICAgICBlbnZlbG9wZS5nYWluLmxpbmVhclJhbXBUb1ZhbHVlQXRUaW1lKDAuMCwgc2VnbWVudEVuZFRpbWUpO1xuICAgICAgICBlbnZlbG9wZS5jb25uZWN0KHRoaXMub3V0cHV0Tm9kZSk7XG5cbiAgICAgICAgLy8gbWFrZSBzb3VyY2VcbiAgICAgICAgdmFyIHNvdXJjZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcblxuICAgICAgICBzb3VyY2UuYnVmZmVyID0gdGhpcy5idWZmZXI7XG4gICAgICAgIHNvdXJjZS5wbGF5YmFja1JhdGUudmFsdWUgPSByZXNhbXBsaW5nUmF0ZTtcbiAgICAgICAgc291cmNlLmNvbm5lY3QoZW52ZWxvcGUpO1xuXG4gICAgICAgIHNvdXJjZS5zdGFydChzZWdtZW50VGltZSwgc2VnbWVudFBvc2l0aW9uKTtcbiAgICAgICAgc291cmNlLnN0b3Aoc2VnbWVudFRpbWUgKyBzZWdtZW50RHVyYXRpb24gLyByZXNhbXBsaW5nUmF0ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlZ21lbnRQZXJpb2Q7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTZWdtZW50RW5naW5lOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRlZmF1bHRBdWRpb0NvbnRleHQgPSByZXF1aXJlKFwiLi4vY29yZS9hdWRpby1jb250ZXh0XCIpO1xudmFyIFRpbWVFbmdpbmUgPSByZXF1aXJlKFwiLi4vY29yZS90aW1lLWVuZ2luZVwiKTtcblxuZnVuY3Rpb24gYXJyYXlSZW1vdmUoYXJyYXksIHZhbHVlKSB7XG4gIHZhciBpbmRleCA9IGFycmF5LmluZGV4T2YodmFsdWUpO1xuXG4gIGlmIChpbmRleCA+PSAwKSB7XG4gICAgYXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuY2xhc3MgU2ltcGxlU2NoZWR1bGVyIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5hdWRpb0NvbnRleHQgPSBvcHRpb25zLmF1ZGlvQ29udGV4dCB8fCDCoGRlZmF1bHRBdWRpb0NvbnRleHQ7XG5cbiAgICB0aGlzLl9fZW5naW5lcyA9IFtdO1xuXG4gICAgdGhpcy5fX3NjaGVkRW5naW5lcyA9IFtdO1xuICAgIHRoaXMuX19zY2hlZFRpbWVzID0gW107XG5cbiAgICB0aGlzLl9fY3VycmVudFRpbWUgPSBudWxsO1xuICAgIHRoaXMuX190aW1lb3V0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIHNjaGVkdWxlciAoc2V0VGltZW91dCkgcGVyaW9kXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLnBlcmlvZCA9IG9wdGlvbnMucGVyaW9kIHx8IDAuMDI1O1xuXG4gICAgLyoqXG4gICAgICogc2NoZWR1bGVyIGxvb2thaGVhZCB0aW1lICg+IHBlcmlvZClcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMubG9va2FoZWFkID0gb3B0aW9ucy5sb29rYWhlYWQgfHwgMC4xO1xuICB9XG5cbiAgX19zY2hlZHVsZUVuZ2luZShlbmdpbmUsIHRpbWUpIHtcbiAgICB0aGlzLl9fc2NoZWRFbmdpbmVzLnB1c2goZW5naW5lKTtcbiAgICB0aGlzLl9fc2NoZWRUaW1lcy5wdXNoKHRpbWUpO1xuICB9XG5cbiAgX19yZXNjaGVkdWxlRW5naW5lKGVuZ2luZSwgdGltZSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX19zY2hlZEVuZ2luZXMuaW5kZXhPZihlbmdpbmUpO1xuXG4gICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgIGlmICh0aW1lICE9PSBJbmZpbml0eSkge1xuICAgICAgICB0aGlzLl9fc2NoZWRUaW1lc1tpbmRleF0gPSB0aW1lO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fX3NjaGVkRW5naW5lcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB0aGlzLl9fc2NoZWRUaW1lcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGltZSA8IEluZmluaXR5KSB7XG4gICAgICB0aGlzLl9fc2NoZWRFbmdpbmVzLnB1c2goZW5naW5lKTtcbiAgICAgIHRoaXMuX19zY2hlZFRpbWVzLnB1c2godGltZSk7XG4gICAgfVxuICB9XG5cbiAgX191bnNjaGVkdWxlRW5naW5lKGVuZ2luZSkge1xuICAgIHZhciBpbmRleCA9IHRoaXMuX19zY2hlZEVuZ2luZXMuaW5kZXhPZihlbmdpbmUpO1xuXG4gICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgIHRoaXMuX19zY2hlZEVuZ2luZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIHRoaXMuX19zY2hlZFRpbWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxuICB9XG5cbiAgX19yZXNldFRpY2soKSB7XG4gICAgaWYgKHRoaXMuX19zY2hlZEVuZ2luZXMubGVuZ3RoID4gMCkge1xuICAgICAgaWYgKCF0aGlzLl9fdGltZW91dCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIlNpbXBsZVNjaGVkdWxlciBTdGFydFwiKTtcbiAgICAgICAgdGhpcy5fX3RpY2soKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuX190aW1lb3V0KSB7XG4gICAgICBjb25zb2xlLmxvZyhcIlNpbXBsZVNjaGVkdWxlciBTdG9wXCIpO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX190aW1lb3V0KTtcbiAgICAgIHRoaXMuX190aW1lb3V0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfX3RpY2soKSB7XG4gICAgdmFyIGF1ZGlvQ29udGV4dCA9IHRoaXMuYXVkaW9Db250ZXh0O1xuICAgIHZhciBpID0gMDtcblxuICAgIHdoaWxlIChpIDwgdGhpcy5fX3NjaGVkRW5naW5lcy5sZW5ndGgpIHtcbiAgICAgIHZhciBlbmdpbmUgPSB0aGlzLl9fc2NoZWRFbmdpbmVzW2ldO1xuICAgICAgdmFyIHRpbWUgPSB0aGlzLl9fc2NoZWRUaW1lc1tpXTtcblxuICAgICAgd2hpbGUgKHRpbWUgJiYgdGltZSA8PSBhdWRpb0NvbnRleHQuY3VycmVudFRpbWUgKyB0aGlzLmxvb2thaGVhZCkge1xuICAgICAgICB0aW1lID0gTWF0aC5tYXgodGltZSwgYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lKTtcbiAgICAgICAgdGhpcy5fX2N1cnJlbnRUaW1lID0gdGltZTtcbiAgICAgICAgdGltZSA9IGVuZ2luZS5hZHZhbmNlVGltZSh0aW1lKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRpbWUgJiYgdGltZSA8IEluZmluaXR5KSB7XG4gICAgICAgIHRoaXMuX19zY2hlZFRpbWVzW2krK10gPSB0aW1lO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fX3Vuc2NoZWR1bGVFbmdpbmUoZW5naW5lKTtcblxuICAgICAgICAvLyByZW1vdmUgZW5naW5lIGZyb20gc2NoZWR1bGVyXG4gICAgICAgIGlmICghdGltZSkge1xuICAgICAgICAgIGVuZ2luZS5tYXN0ZXIgPSBudWxsO1xuICAgICAgICAgIGFycmF5UmVtb3ZlKHRoaXMuX19lbmdpbmVzLCBlbmdpbmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fX2N1cnJlbnRUaW1lID0gbnVsbDtcbiAgICB0aGlzLl9fdGltZW91dCA9IG51bGw7XG5cbiAgICBpZiAodGhpcy5fX3NjaGVkRW5naW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLl9fdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9fdGljaygpO1xuICAgICAgfSwgdGhpcy5wZXJpb2QgKiAxMDAwKTtcbiAgICB9XG4gIH1cblxuICBnZXQgY3VycmVudFRpbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX19jdXJyZW50VGltZSB8fCB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSArIHRoaXMubG9va2FoZWFkO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnRQb3NpdGlvbigpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgYWRkKGVuZ2luZU9yRnVuY3Rpb24sIHRpbWUgPSB0aGlzLmN1cnJlbnRUaW1lLCBnZXRDdXJyZW50UG9zaXRpb24gPSBudWxsKSB7XG4gICAgdmFyIGVuZ2luZSA9IGVuZ2luZU9yRnVuY3Rpb247XG5cbiAgICBpZiAoZW5naW5lT3JGdW5jdGlvbiBpbnN0YW5jZW9mIEZ1bmN0aW9uKVxuICAgICAgZW5naW5lID0ge1xuICAgICAgICBhZHZhbmNlVGltZTogZW5naW5lT3JGdW5jdGlvblxuICAgICAgfTtcbiAgICBlbHNlIGlmICghZW5naW5lT3JGdW5jdGlvbi5pbXBsZW1lbnRzU2NoZWR1bGVkKCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvYmplY3QgY2Fubm90IGJlIGFkZGVkIHRvIHNjaGVkdWxlclwiKTtcbiAgICBlbHNlIGlmIChlbmdpbmVPckZ1bmN0aW9uLm1hc3RlcilcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIm9iamVjdCBoYXMgYWxyZWFkeSBiZWVuIGFkZGVkIHRvIGEgbWFzdGVyXCIpO1xuXG4gICAgLy8gc2V0IG1hc3RlciBhbmQgYWRkIHRvIGFycmF5XG4gICAgZW5naW5lLm1hc3RlciA9IHRoaXM7XG4gICAgdGhpcy5fX2VuZ2luZXMucHVzaChlbmdpbmUpO1xuXG4gICAgLy8gc2NoZWR1bGUgZW5naW5lXG4gICAgdGhpcy5fX3NjaGVkdWxlRW5naW5lKGVuZ2luZSwgdGltZSk7XG4gICAgdGhpcy5fX3Jlc2V0VGljaygpO1xuXG4gICAgcmV0dXJuIGVuZ2luZTtcbiAgfVxuXG4gIHJlbW92ZShlbmdpbmUpIHtcbiAgICBpZiAoIWVuZ2luZS5tYXN0ZXIgfHwgZW5naW5lLm1hc3RlciAhPT0gdGhpcylcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImVuZ2luZSBoYXMgbm90IGJlZW4gYWRkZWQgdG8gdGhpcyBzY2hlZHVsZXJcIik7XG5cbiAgICAvLyByZXNldCBtYXN0ZXIgYW5kIHJlbW92ZSBmcm9tIGFycmF5XG4gICAgZW5naW5lLm1hc3RlciA9IG51bGw7XG4gICAgYXJyYXlSZW1vdmUodGhpcy5fX2VuZ2luZXMsIGVuZ2luZSk7XG5cbiAgICAvLyB1bnNjaGVkdWxlIGVuZ2luZVxuICAgIHRoaXMuX191bnNjaGVkdWxlRW5naW5lKGVuZ2luZSk7XG4gICAgdGhpcy5fX3Jlc2V0VGljaygpO1xuICB9XG5cbiAgcmVzZXRFbmdpbmVUaW1lKGVuZ2luZSwgdGltZSA9IHRoaXMuY3VycmVudFRpbWUpIHtcbiAgICB0aGlzLl9fcmVzY2hlZHVsZUVuZ2luZShlbmdpbmUsIHRpbWUpO1xuICAgIHRoaXMuX19yZXNldFRpY2soKTtcbiAgfVxuXG4gIGNsZWFyKCkge1xuICAgIGlmICh0aGlzLl9fdGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX190aW1lb3V0KTtcbiAgICAgIHRoaXMuX190aW1lb3V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLl9fc2NoZWRFbmdpbmVzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5fX3NjaGVkVGltZXMubGVuZ3RoID0gMDtcbiAgfVxufVxuXG4vLyBleHBvcnQgc2NoZWR1bGVyIHNpbmdsZXRvblxubW9kdWxlLmV4cG9ydHMgPSBTaW1wbGVTY2hlZHVsZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZGVmYXVsdEF1ZGlvQ29udGV4dCA9IHJlcXVpcmUoXCIuLi9jb3JlL2F1ZGlvLWNvbnRleHRcIik7XG52YXIgVGltZUVuZ2luZSA9IHJlcXVpcmUoXCIuLi9jb3JlL3RpbWUtZW5naW5lXCIpO1xudmFyIFByaW9yaXR5UXVldWUgPSByZXF1aXJlKFwiLi4vdXRpbHMvcHJpb3JpdHktcXVldWVcIik7XG52YXIgU2NoZWR1bGluZ1F1ZXVlID0gcmVxdWlyZShcIi4uL3V0aWxzL3NjaGVkdWxpbmctcXVldWVcIik7XG52YXIgZ2V0U2NoZWR1bGVyID0gcmVxdWlyZSgnLi9mYWN0b3JpZXMnKS5nZXRTY2hlZHVsZXI7XG5cbmZ1bmN0aW9uIGFkZER1cGxldChmaXJzdEFycmF5LCBzZWNvbmRBcnJheSwgZmlyc3RFbGVtZW50LCBzZWNvbmRFbGVtZW50KSB7XG4gIGZpcnN0QXJyYXkucHVzaChmaXJzdEVsZW1lbnQpO1xuICBzZWNvbmRBcnJheS5wdXNoKHNlY29uZEVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVEdXBsZXQoZmlyc3RBcnJheSwgc2Vjb25kQXJyYXksIGZpcnN0RWxlbWVudCkge1xuICB2YXIgaW5kZXggPSBmaXJzdEFycmF5LmluZGV4T2YoZmlyc3RFbGVtZW50KTtcblxuICBpZiAoaW5kZXggPj0gMCkge1xuICAgIHZhciBzZWNvbmRFbGVtZW50ID0gc2Vjb25kQXJyYXlbaW5kZXhdO1xuXG4gICAgZmlyc3RBcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHNlY29uZEFycmF5LnNwbGljZShpbmRleCwgMSk7XG5cbiAgICByZXR1cm4gc2Vjb25kRWxlbWVudDtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG4vLyBUaGUgVHJhbnNwb3J0ZWQgY2FsbCBpcyB0aGUgYmFzZSBjbGFzcyBvZiB0aGUgYWRhcHRlcnMgYmV0d2VlblxuLy8gZGlmZmVyZW50IHR5cGVzIG9mIGVuZ2luZXMgKGkuZS4gdHJhbnNwb3J0ZWQsIHNjaGVkdWxlZCwgcGxheS1jb250cm9sbGVkKVxuLy8gVGhlIGFkYXB0ZXJzIGFyZSBhdCB0aGUgc2FtZSB0aW1lIG1hc3RlcnMgZm9yIHRoZSBlbmdpbmVzIGFkZGVkIHRvIHRoZSB0cmFuc3BvcnRcbi8vIGFuZCB0cmFuc3BvcnRlZCBUaW1lRW5naW5lcyBpbnNlcnRlZCBpbnRvIHRoZSB0cmFuc3BvcnQncyBwb3NpdGlvbi1iYXNlZCBwcml0b3JpdHkgcXVldWUuXG5jbGFzcyBUcmFuc3BvcnRlZCBleHRlbmRzIFRpbWVFbmdpbmUge1xuICBjb25zdHJ1Y3Rvcih0cmFuc3BvcnQsIGVuZ2luZSwgc3RhcnQsIGR1cmF0aW9uLCBvZmZzZXQsIHN0cmV0Y2ggPSAxKSB7XG4gICAgdGhpcy5tYXN0ZXIgPSB0cmFuc3BvcnQ7XG5cbiAgICBlbmdpbmUubWFzdGVyID0gdGhpcztcbiAgICB0aGlzLl9fZW5naW5lID0gZW5naW5lO1xuXG4gICAgdGhpcy5fX3N0YXJ0UG9zaXRpb24gPSBzdGFydDtcbiAgICB0aGlzLl9fZW5kUG9zaXRpb24gPSBzdGFydCArIGR1cmF0aW9uO1xuICAgIHRoaXMuX19vZmZzZXRQb3NpdGlvbiA9IHN0YXJ0ICsgb2Zmc2V0O1xuICAgIHRoaXMuX19zdHJldGNoUG9zaXRpb24gPSBzdHJldGNoO1xuICAgIHRoaXMuX19oYWx0UG9zaXRpb24gPSBJbmZpbml0eTsgLy8gZW5naW5lJ3MgbmV4dCBoYWx0IHBvc2l0aW9uIHdoZW4gbm90IHJ1bm5pbmcgKGlzIG51bGwgd2hlbiBlbmdpbmUgaGVzIGJlZW4gc3RhcnRlZClcbiAgfVxuXG4gIHNldEJvdW5kYXJpZXMoc3RhcnQsIGR1cmF0aW9uLCBvZmZzZXQgPSAwLCBzdHJldGNoID0gMSkge1xuICAgIHRoaXMuX19zdGFydFBvc2l0aW9uID0gc3RhcnQ7XG4gICAgdGhpcy5fX2VuZFBvc2l0aW9uID0gc3RhcnQgKyBkdXJhdGlvbjtcbiAgICB0aGlzLl9fb2Zmc2V0UG9zaXRpb24gPSBzdGFydCArIG9mZnNldDtcbiAgICB0aGlzLl9fc3RyZXRjaFBvc2l0aW9uID0gc3RyZXRjaDtcbiAgICB0aGlzLnJlc2V0UG9zaXRpb24oKTtcbiAgfVxuXG4gIHN0YXJ0KHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge31cbiAgc3RvcCh0aW1lLCBwb3NpdGlvbikge31cblxuICBnZXQgY3VycmVudFRpbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMubWFzdGVyLmN1cnJlbnRUaW1lO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnRQb3NpdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5tYXN0ZXIuY3VycmVudFBvc2l0aW9uIC0gdGhpcy5fX29mZnNldFBvc2l0aW9uO1xuICB9XG5cbiAgcmVzZXRQb3NpdGlvbihwb3NpdGlvbikge1xuICAgIGlmIChwb3NpdGlvbiAhPT0gdW5kZWZpbmVkKVxuICAgICAgcG9zaXRpb24gKz0gdGhpcy5fX29mZnNldFBvc2l0aW9uO1xuXG4gICAgdGhpcy5tYXN0ZXIucmVzZXRFbmdpbmVQb3NpdGlvbih0aGlzLCBwb3NpdGlvbik7XG4gIH1cblxuICBzeW5jUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSB7XG4gICAgaWYgKHNwZWVkID4gMCkge1xuICAgICAgaWYgKHBvc2l0aW9uIDwgdGhpcy5fX3N0YXJ0UG9zaXRpb24pIHtcblxuICAgICAgICBpZiAodGhpcy5fX2hhbHRQb3NpdGlvbiA9PT0gbnVsbClcbiAgICAgICAgICB0aGlzLnN0b3AodGltZSwgcG9zaXRpb24gLSB0aGlzLl9fb2Zmc2V0UG9zaXRpb24pO1xuXG4gICAgICAgIHRoaXMuX19oYWx0UG9zaXRpb24gPSB0aGlzLl9fZW5kUG9zaXRpb247XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX19zdGFydFBvc2l0aW9uO1xuICAgICAgfSBlbHNlIGlmIChwb3NpdGlvbiA8PSB0aGlzLl9fZW5kUG9zaXRpb24pIHtcbiAgICAgICAgdGhpcy5zdGFydCh0aW1lLCBwb3NpdGlvbiAtIHRoaXMuX19vZmZzZXRQb3NpdGlvbiwgc3BlZWQpO1xuXG4gICAgICAgIHRoaXMuX19oYWx0UG9zaXRpb24gPSBudWxsOyAvLyBlbmdpbmUgaXMgYWN0aXZlXG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX19lbmRQb3NpdGlvbjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHBvc2l0aW9uID49IHRoaXMuX19lbmRQb3NpdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fX2hhbHRQb3NpdGlvbiA9PT0gbnVsbClcbiAgICAgICAgICB0aGlzLnN0b3AodGltZSwgcG9zaXRpb24gLSB0aGlzLl9fb2Zmc2V0UG9zaXRpb24pO1xuXG4gICAgICAgIHRoaXMuX19oYWx0UG9zaXRpb24gPSB0aGlzLl9fc3RhcnRQb3NpdGlvbjtcblxuICAgICAgICByZXR1cm4gdGhpcy5fX2VuZFBvc2l0aW9uO1xuICAgICAgfSBlbHNlIGlmIChwb3NpdGlvbiA+IHRoaXMuX19zdGFydFBvc2l0aW9uKSB7XG4gICAgICAgIHRoaXMuc3RhcnQodGltZSwgcG9zaXRpb24gLSB0aGlzLl9fb2Zmc2V0UG9zaXRpb24sIHNwZWVkKTtcblxuICAgICAgICB0aGlzLl9faGFsdFBvc2l0aW9uID0gbnVsbDsgLy8gZW5naW5lIGlzIGFjdGl2ZVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9fc3RhcnRQb3NpdGlvbjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5fX2hhbHRQb3NpdGlvbiA9PT0gbnVsbClcbiAgICAgIHRoaXMuc3RvcCh0aW1lLCBwb3NpdGlvbik7XG5cbiAgICB0aGlzLl9faGFsdFBvc2l0aW9uID0gSW5maW5pdHk7XG5cbiAgICByZXR1cm4gSW5maW5pdHk7XG4gIH1cblxuICBhZHZhbmNlUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSB7XG4gICAgdmFyIGhhbHRQb3NpdGlvbiA9IHRoaXMuX19oYWx0UG9zaXRpb247XG5cbiAgICBpZiAoaGFsdFBvc2l0aW9uICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YXJ0KHRpbWUsIHBvc2l0aW9uIC0gdGhpcy5fX29mZnNldFBvc2l0aW9uLCBzcGVlZCk7XG5cbiAgICAgIHRoaXMuX19oYWx0UG9zaXRpb24gPSBudWxsO1xuXG4gICAgICByZXR1cm4gaGFsdFBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8vIHN0b3AgZW5naW5lXG4gICAgaWYgKHRoaXMuX19oYWx0UG9zaXRpb24gPT09IG51bGwpXG4gICAgICB0aGlzLnN0b3AodGltZSwgcG9zaXRpb24gLSB0aGlzLl9fb2Zmc2V0UG9zaXRpb24pO1xuXG4gICAgdGhpcy5fX2hhbHRQb3NpdGlvbiA9IEluZmluaXR5O1xuXG4gICAgcmV0dXJuIEluZmluaXR5O1xuICB9XG5cbiAgc3luY1NwZWVkKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIGlmIChzcGVlZCA9PT0gMClcbiAgICAgIHRoaXMuc3RvcCh0aW1lLCBwb3NpdGlvbiAtIHRoaXMuX19vZmZzZXRQb3NpdGlvbik7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMubWFzdGVyID0gbnVsbDtcbiAgICB0aGlzLl9fZW5naW5lLm1hc3RlciA9IG51bGw7XG4gICAgdGhpcy5fX2VuZ2luZSA9IG51bGw7XG4gIH1cbn1cblxuLy8gVHJhbnNwb3J0ZWRTY2hlZHVsZWRcbi8vIGhhcyB0byBzd2l0Y2ggb24gYW5kIG9mZiB0aGUgc2NoZWR1bGVkIGVuZ2luZXMgd2hlbiB0aGUgdHJhbnNwb3J0IGhpdHMgdGhlIGVuZ2luZSdzIHN0YXJ0IGFuZCBlbmQgcG9zaXRpb25cbmNsYXNzIFRyYW5zcG9ydGVkVHJhbnNwb3J0ZWQgZXh0ZW5kcyBUcmFuc3BvcnRlZCB7XG4gIGNvbnN0cnVjdG9yKHRyYW5zcG9ydCwgZW5naW5lLCBzdGFydFBvc2l0aW9uLCBlbmRQb3NpdGlvbiwgb2Zmc2V0UG9zaXRpb24pIHtcbiAgICBzdXBlcih0cmFuc3BvcnQsIGVuZ2luZSwgc3RhcnRQb3NpdGlvbiwgZW5kUG9zaXRpb24sIG9mZnNldFBvc2l0aW9uKTtcbiAgfVxuXG4gIHN5bmNQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICBpZiAoc3BlZWQgPiAwICYmIHBvc2l0aW9uIDwgdGhpcy5fX2VuZFBvc2l0aW9uKVxuICAgICAgcG9zaXRpb24gPSBNYXRoLm1heChwb3NpdGlvbiwgdGhpcy5fX3N0YXJ0UG9zaXRpb24pO1xuICAgIGVsc2UgaWYgKHNwZWVkIDwgMCAmJiBwb3NpdGlvbiA+PSB0aGlzLl9fc3RhcnRQb3NpdGlvbilcbiAgICAgIHBvc2l0aW9uID0gTWF0aC5taW4ocG9zaXRpb24sIHRoaXMuX19lbmRQb3NpdGlvbik7XG5cbiAgICByZXR1cm4gdGhpcy5fX29mZnNldFBvc2l0aW9uICsgdGhpcy5fX2VuZ2luZS5zeW5jUG9zaXRpb24odGltZSwgcG9zaXRpb24gLSB0aGlzLl9fb2Zmc2V0UG9zaXRpb24sIHNwZWVkKTtcbiAgfVxuXG4gIGFkdmFuY2VQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICBwb3NpdGlvbiA9IHRoaXMuX19vZmZzZXRQb3NpdGlvbiArIHRoaXMuX19lbmdpbmUuYWR2YW5jZVBvc2l0aW9uKHRpbWUsIHBvc2l0aW9uIC0gdGhpcy5fX29mZnNldFBvc2l0aW9uLCBzcGVlZCk7XG5cbiAgICBpZiAoc3BlZWQgPiAwICYmIHBvc2l0aW9uIDwgdGhpcy5fX2VuZFBvc2l0aW9uIHx8IHNwZWVkIDwgMCAmJiBwb3NpdGlvbiA+PSB0aGlzLl9fc3RhcnRQb3NpdGlvbilcbiAgICAgIHJldHVybiBwb3NpdGlvbjtcblxuICAgIHJldHVybiBJbmZpbml0eTtcbiAgfVxuXG4gIHN5bmNTcGVlZCh0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICBpZiAodGhpcy5fX2VuZ2luZS5zeW5jU3BlZWQpXG4gICAgICB0aGlzLl9fZW5naW5lLnN5bmNTcGVlZCh0aW1lLCBwb3NpdGlvbiwgc3BlZWQpO1xuICB9XG5cbiAgcmVzZXRFbmdpbmVQb3NpdGlvbihlbmdpbmUsIHBvc2l0aW9uID0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHBvc2l0aW9uICE9PSB1bmRlZmluZWQpXG4gICAgICBwb3NpdGlvbiArPSB0aGlzLl9fb2Zmc2V0UG9zaXRpb247XG5cbiAgICB0aGlzLnJlc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICB9XG59XG5cbi8vIFRyYW5zcG9ydGVkU3BlZWRDb250cm9sbGVkXG4vLyBoYXMgdG8gc3RhcnQgYW5kIHN0b3AgdGhlIHNwZWVkLWNvbnRyb2xsZWQgZW5naW5lcyB3aGVuIHRoZSB0cmFuc3BvcnQgaGl0cyB0aGUgZW5naW5lJ3Mgc3RhcnQgYW5kIGVuZCBwb3NpdGlvblxuY2xhc3MgVHJhbnNwb3J0ZWRTcGVlZENvbnRyb2xsZWQgZXh0ZW5kcyBUcmFuc3BvcnRlZCB7XG4gIGNvbnN0cnVjdG9yKHRyYW5zcG9ydCwgZW5naW5lLCBzdGFydFBvc2l0aW9uLCBlbmRQb3NpdGlvbiwgb2Zmc2V0UG9zaXRpb24pIHtcbiAgICBzdXBlcih0cmFuc3BvcnQsIGVuZ2luZSwgc3RhcnRQb3NpdGlvbiwgZW5kUG9zaXRpb24sIG9mZnNldFBvc2l0aW9uKTtcbiAgfVxuXG4gIHN0YXJ0KHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIHRoaXMuX19lbmdpbmUuc3luY1NwZWVkKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCwgdHJ1ZSk7XG4gIH1cblxuICBzdG9wKHRpbWUsIHBvc2l0aW9uKSB7XG4gICAgdGhpcy5fX2VuZ2luZS5zeW5jU3BlZWQodGltZSwgcG9zaXRpb24sIDApO1xuICB9XG5cbiAgc3luY1NwZWVkKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIGlmICh0aGlzLl9faGFsdFBvc2l0aW9uID09PSBudWxsKSAvLyBlbmdpbmUgaXMgYWN0aXZlXG4gICAgICB0aGlzLl9fZW5naW5lLnN5bmNTcGVlZCh0aW1lLCBwb3NpdGlvbiwgc3BlZWQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLl9fZW5naW5lLnN5bmNTcGVlZCh0aGlzLm1hc3Rlci5jdXJyZW50VGltZSwgdGhpcy5tYXN0ZXIuY3VycmVudFBvc2l0aW9uIC0gdGhpcy5fX29mZnNldFBvc2l0aW9uLCAwKTtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cbn1cblxuLy8gVHJhbnNwb3J0ZWRTY2hlZHVsZWRcbi8vIGhhcyB0byBzd2l0Y2ggb24gYW5kIG9mZiB0aGUgc2NoZWR1bGVkIGVuZ2luZXMgd2hlbiB0aGUgdHJhbnNwb3J0IGhpdHMgdGhlIGVuZ2luZSdzIHN0YXJ0IGFuZCBlbmQgcG9zaXRpb25cbmNsYXNzIFRyYW5zcG9ydGVkU2NoZWR1bGVkIGV4dGVuZHMgVHJhbnNwb3J0ZWQge1xuICBjb25zdHJ1Y3Rvcih0cmFuc3BvcnQsIGVuZ2luZSwgc3RhcnRQb3NpdGlvbiwgZW5kUG9zaXRpb24sIG9mZnNldFBvc2l0aW9uKSB7XG4gICAgc3VwZXIodHJhbnNwb3J0LCBlbmdpbmUsIHN0YXJ0UG9zaXRpb24sIGVuZFBvc2l0aW9uLCBvZmZzZXRQb3NpdGlvbik7XG4gICAgdHJhbnNwb3J0Ll9fc2NoZWR1bGluZ1F1ZXVlLmFkZChlbmdpbmUsIEluZmluaXR5KTtcbiAgfVxuXG4gIHN0YXJ0KHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIHRoaXMubWFzdGVyLl9fc2NoZWR1bGluZ1F1ZXVlLnJlc2V0RW5naW5lVGltZSh0aGlzLl9fZW5naW5lLCB0aW1lKTtcbiAgfVxuXG4gIHN0b3AodGltZSwgcG9zaXRpb24pIHtcbiAgICB0aGlzLm1hc3Rlci5fX3NjaGVkdWxpbmdRdWV1ZS5yZXNldEVuZ2luZVRpbWUodGhpcy5fX2VuZ2luZSwgSW5maW5pdHkpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLm1hc3Rlci5fX3NjaGVkdWxpbmdRdWV1ZS5yZW1vdmUodGhpcy5fX2VuZ2luZSk7XG4gICAgc3VwZXIuZGVzdHJveSgpO1xuICB9XG59XG5cbmNsYXNzIFRyYW5zcG9ydFNjaGVkdWxlckhvb2sgZXh0ZW5kcyBUaW1lRW5naW5lIHtcbiAgY29uc3RydWN0b3IodHJhbnNwb3J0KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMuX190cmFuc3BvcnQgPSB0cmFuc3BvcnQ7XG5cbiAgICB0aGlzLl9fbmV4dFBvc2l0aW9uID0gSW5maW5pdHk7XG4gICAgdGhpcy5fX25leHRUaW1lID0gSW5maW5pdHk7XG4gICAgdHJhbnNwb3J0Ll9fc2NoZWR1bGVyLmFkZCh0aGlzLCBJbmZpbml0eSk7XG4gIH1cblxuICAvLyBUaW1lRW5naW5lIG1ldGhvZCAoc2NoZWR1bGVkIGludGVyZmFjZSlcbiAgYWR2YW5jZVRpbWUodGltZSkge1xuICAgIHZhciB0cmFuc3BvcnQgPSB0aGlzLl9fdHJhbnNwb3J0O1xuICAgIHZhciBwb3NpdGlvbiA9IHRoaXMuX19uZXh0UG9zaXRpb247XG4gICAgdmFyIHNwZWVkID0gdHJhbnNwb3J0Ll9fc3BlZWQ7XG4gICAgdmFyIG5leHRQb3NpdGlvbiA9IHRyYW5zcG9ydC5hZHZhbmNlUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKTtcbiAgICB2YXIgbmV4dFRpbWUgPSB0cmFuc3BvcnQuX19nZXRUaW1lQXRQb3NpdGlvbihuZXh0UG9zaXRpb24pO1xuXG4gICAgd2hpbGUgKG5leHRUaW1lIDw9IHRpbWUpIHtcbiAgICAgIG5leHRQb3NpdGlvbiA9IHRyYW5zcG9ydC5hZHZhbmNlUG9zaXRpb24obmV4dFRpbWUsIG5leHRQb3NpdGlvbiwgc3BlZWQpO1xuICAgICAgbmV4dFRpbWUgPSB0cmFuc3BvcnQuX19nZXRUaW1lQXRQb3NpdGlvbihuZXh0UG9zaXRpb24pO1xuICAgIH1cblxuICAgIHRoaXMuX19uZXh0UG9zaXRpb24gPSBuZXh0UG9zaXRpb247XG4gICAgdGhpcy5fX25leHRUaW1lID0gbmV4dFRpbWU7XG4gICAgcmV0dXJuIG5leHRUaW1lO1xuICB9XG5cbiAgcmVzZXRQb3NpdGlvbihwb3NpdGlvbiA9IHRoaXMuX19uZXh0UG9zaXRpb24pIHtcbiAgICB2YXIgdHJhbnNwb3J0ID0gdGhpcy5fX3RyYW5zcG9ydDtcbiAgICB2YXIgdGltZSA9IHRyYW5zcG9ydC5fX2dldFRpbWVBdFBvc2l0aW9uKHBvc2l0aW9uKTtcblxuICAgIHRoaXMuX19uZXh0UG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICB0aGlzLl9fbmV4dFRpbWUgPSB0aW1lO1xuICAgIHRoaXMucmVzZXRUaW1lKHRpbWUpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLl9fdHJhbnNwb3J0Ll9fc2NoZWR1bGVyLnJlbW92ZSh0aGlzKTtcbiAgICB0aGlzLl9fdHJhbnNwb3J0ID0gbnVsbDtcbiAgfVxufVxuXG5jbGFzcyBUcmFuc3BvcnRTY2hlZHVsaW5nUXVldWUgZXh0ZW5kcyBTY2hlZHVsaW5nUXVldWUge1xuICBjb25zdHJ1Y3Rvcih0cmFuc3BvcnQpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5fX3RyYW5zcG9ydCA9IHRyYW5zcG9ydDtcbiAgICB0cmFuc3BvcnQuX19zY2hlZHVsZXIuYWRkKHRoaXMsIEluZmluaXR5KTtcbiAgfVxuXG4gIGdldCBjdXJyZW50VGltZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fX3RyYW5zcG9ydC5jdXJyZW50VGltZTtcbiAgfVxuXG4gIGdldCBjdXJyZW50UG9zaXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX190cmFuc3BvcnQuY3VycmVudFBvc2l0aW9uO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLl9fdHJhbnNwb3J0Ll9fc2NoZWR1bGVyLnJlbW92ZSh0aGlzKTtcbiAgICB0aGlzLl9fdHJhbnNwb3J0ID0gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIFRyYW5zcG9ydCBjbGFzc1xuICovXG5jbGFzcyBUcmFuc3BvcnQgZXh0ZW5kcyBUaW1lRW5naW5lIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMuYXVkaW9Db250ZXh0ID0gb3B0aW9ucy5hdWRpb0NvbnRleHQgfHwgZGVmYXVsdEF1ZGlvQ29udGV4dDtcblxuICAgIHRoaXMuX19lbmdpbmVzID0gW107XG4gICAgdGhpcy5fX3RyYW5zcG9ydGVkID0gW107XG5cbiAgICB0aGlzLl9fc2NoZWR1bGVyID0gZ2V0U2NoZWR1bGVyKHRoaXMuYXVkaW9Db250ZXh0KTtcbiAgICB0aGlzLl9fc2NoZWR1bGVySG9vayA9IG5ldyBUcmFuc3BvcnRTY2hlZHVsZXJIb29rKHRoaXMpO1xuICAgIHRoaXMuX190cmFuc3BvcnRlZFF1ZXVlID0gbmV3IFByaW9yaXR5UXVldWUoKTtcbiAgICB0aGlzLl9fc2NoZWR1bGluZ1F1ZXVlID0gbmV3IFRyYW5zcG9ydFNjaGVkdWxpbmdRdWV1ZSh0aGlzKTtcblxuICAgIC8vIHN5bmNyb25pemVkIHRpbWUsIHBvc2l0aW9uLCBhbmQgc3BlZWRcbiAgICB0aGlzLl9fdGltZSA9IDA7XG4gICAgdGhpcy5fX3Bvc2l0aW9uID0gMDtcbiAgICB0aGlzLl9fc3BlZWQgPSAwO1xuICB9XG5cbiAgX19nZXRUaW1lQXRQb3NpdGlvbihwb3NpdGlvbikge1xuICAgIHJldHVybiB0aGlzLl9fdGltZSArIChwb3NpdGlvbiAtIHRoaXMuX19wb3NpdGlvbikgLyB0aGlzLl9fc3BlZWQ7XG4gIH1cblxuICBfX2dldFBvc2l0aW9uQXRUaW1lKHRpbWUpIHtcbiAgICByZXR1cm4gdGhpcy5fX3Bvc2l0aW9uICsgKHRpbWUgLSB0aGlzLl9fdGltZSkgKiB0aGlzLl9fc3BlZWQ7XG4gIH1cblxuICBfX3N5bmNUcmFuc3BvcnRlZFBvc2l0aW9uKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIHZhciBudW1UcmFuc3BvcnRlZEVuZ2luZXMgPSB0aGlzLl9fdHJhbnNwb3J0ZWQubGVuZ3RoO1xuICAgIHZhciBuZXh0UG9zaXRpb24gPSBJbmZpbml0eTtcblxuICAgIGlmIChudW1UcmFuc3BvcnRlZEVuZ2luZXMgPiAwKSB7XG4gICAgICB2YXIgZW5naW5lLCBuZXh0RW5naW5lUG9zaXRpb247XG5cbiAgICAgIHRoaXMuX190cmFuc3BvcnRlZFF1ZXVlLmNsZWFyKCk7XG4gICAgICB0aGlzLl9fdHJhbnNwb3J0ZWRRdWV1ZS5yZXZlcnNlID0gKHNwZWVkIDwgMCk7XG5cbiAgICAgIGZvciAodmFyIGkgPSBudW1UcmFuc3BvcnRlZEVuZ2luZXMgLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICAgIGVuZ2luZSA9IHRoaXMuX190cmFuc3BvcnRlZFtpXTtcbiAgICAgICAgbmV4dEVuZ2luZVBvc2l0aW9uID0gZW5naW5lLnN5bmNQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpO1xuICAgICAgICB0aGlzLl9fdHJhbnNwb3J0ZWRRdWV1ZS5pbnNlcnQoZW5naW5lLCBuZXh0RW5naW5lUG9zaXRpb24sIGZhbHNlKTsgLy8gaW5zZXJ0IGJ1dCBkb24ndCBzb3J0XG4gICAgICB9XG5cbiAgICAgIGVuZ2luZSA9IHRoaXMuX190cmFuc3BvcnRlZFswXTtcbiAgICAgIG5leHRFbmdpbmVQb3NpdGlvbiA9IGVuZ2luZS5zeW5jUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKTtcbiAgICAgIG5leHRQb3NpdGlvbiA9IHRoaXMuX190cmFuc3BvcnRlZFF1ZXVlLmluc2VydChlbmdpbmUsIG5leHRFbmdpbmVQb3NpdGlvbiwgdHJ1ZSk7IC8vIGluc2VydCBhbmQgc29ydFxuICAgIH1cblxuICAgIHJldHVybiBuZXh0UG9zaXRpb247XG4gIH1cblxuICBfX3N5bmNUcmFuc3BvcnRlZFNwZWVkKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIGZvciAodmFyIHRyYW5zcG9ydGVkIG9mIHRoaXMuX190cmFuc3BvcnRlZClcbiAgICAgIHRyYW5zcG9ydGVkLnN5bmNTcGVlZCh0aW1lLCBwb3NpdGlvbiwgc3BlZWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjdXJyZW50IG1hc3RlciB0aW1lXG4gICAqIEByZXR1cm4ge051bWJlcn0gY3VycmVudCB0aW1lXG4gICAqXG4gICAqIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSByZXBsYWNlZCB3aGVuIHRoZSB0cmFuc3BvcnQgaXMgYWRkZWQgdG8gYSBtYXN0ZXIgKGkuZS4gdHJhbnNwb3J0IG9yIHBsYXktY29udHJvbCkuXG4gICAqL1xuICBnZXQgY3VycmVudFRpbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX19zY2hlZHVsZXIuY3VycmVudFRpbWU7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgbWFzdGVyIHBvc2l0aW9uXG4gICAqIEByZXR1cm4ge051bWJlcn0gY3VycmVudCBwbGF5aW5nIHBvc2l0aW9uXG4gICAqXG4gICAqIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSByZXBsYWNlZCB3aGVuIHRoZSB0cmFuc3BvcnQgaXMgYWRkZWQgdG8gYSBtYXN0ZXIgKGkuZS4gdHJhbnNwb3J0IG9yIHBsYXktY29udHJvbCkuXG4gICAqL1xuICBnZXQgY3VycmVudFBvc2l0aW9uKCkge1xuICAgIHZhciBtYXN0ZXIgPSB0aGlzLm1hc3RlcjtcblxuICAgIGlmIChtYXN0ZXIgJiYgbWFzdGVyLmN1cnJlbnRQb3NpdGlvbiAhPT0gdW5kZWZpbmVkKVxuICAgICAgcmV0dXJuIG1hc3Rlci5jdXJyZW50UG9zaXRpb247XG5cbiAgICByZXR1cm4gdGhpcy5fX3Bvc2l0aW9uICsgKHRoaXMuX19zY2hlZHVsZXIuY3VycmVudFRpbWUgLSB0aGlzLl9fdGltZSkgKiB0aGlzLl9fc3BlZWQ7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgbmV4dCB0cmFuc3BvcnQgcG9zaXRpb25cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG5leHQgdHJhbnNwb3J0IHBvc2l0aW9uXG4gICAqL1xuICByZXNldFBvc2l0aW9uKHBvc2l0aW9uKSB7XG4gICAgdmFyIG1hc3RlciA9IHRoaXMubWFzdGVyO1xuXG4gICAgaWYgKG1hc3RlciAmJiBtYXN0ZXIucmVzZXRFbmdpbmVQb3NpdGlvbiAhPT0gdW5kZWZpbmVkKVxuICAgICAgbWFzdGVyLnJlc2V0RW5naW5lUG9zaXRpb24odGhpcywgcG9zaXRpb24pO1xuICAgIGVsc2VcbiAgICAgIHRoaXMuX19zY2hlZHVsZXJIb29rLnJlc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICB9XG5cbiAgLy8gVGltZUVuZ2luZSBtZXRob2QgKHRyYW5zcG9ydGVkIGludGVyZmFjZSlcbiAgc3luY1Bvc2l0aW9uKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIHRoaXMuX190aW1lID0gdGltZTtcbiAgICB0aGlzLl9fcG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICB0aGlzLl9fc3BlZWQgPSBzcGVlZDtcblxuICAgIHJldHVybiB0aGlzLl9fc3luY1RyYW5zcG9ydGVkUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKTtcbiAgfVxuXG4gIC8vIFRpbWVFbmdpbmUgbWV0aG9kICh0cmFuc3BvcnRlZCBpbnRlcmZhY2UpXG4gIGFkdmFuY2VQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICB2YXIgbmV4dFBvc2l0aW9uID0gdGhpcy5fX3RyYW5zcG9ydGVkUXVldWUudGltZTtcblxuICAgIHdoaWxlIChuZXh0UG9zaXRpb24gPT09IHBvc2l0aW9uKSB7XG4gICAgICB2YXIgZW5naW5lID0gdGhpcy5fX3RyYW5zcG9ydGVkUXVldWUuaGVhZDtcbiAgICAgIHZhciBuZXh0RW5naW5lUG9zaXRpb24gPSBlbmdpbmUuYWR2YW5jZVBvc2l0aW9uKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCk7XG5cbiAgICAgIGlmICgoKHNwZWVkID4gMCAmJiBuZXh0RW5naW5lUG9zaXRpb24gPiBwb3NpdGlvbikgfHwgKHNwZWVkIDwgMCAmJiBuZXh0RW5naW5lUG9zaXRpb24gPCBwb3NpdGlvbikpICYmXG4gICAgICAgIChuZXh0RW5naW5lUG9zaXRpb24gPCBJbmZpbml0eSAmJiBuZXh0RW5naW5lUG9zaXRpb24gPiAtSW5maW5pdHkpKSB7XG4gICAgICAgIG5leHRQb3NpdGlvbiA9IHRoaXMuX190cmFuc3BvcnRlZFF1ZXVlLm1vdmUoZW5naW5lLCBuZXh0RW5naW5lUG9zaXRpb24pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV4dFBvc2l0aW9uID0gdGhpcy5fX3RyYW5zcG9ydGVkUXVldWUucmVtb3ZlKGVuZ2luZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5leHRQb3NpdGlvbjtcbiAgfVxuXG4gIC8vIFRpbWVFbmdpbmUgbWV0aG9kIChzcGVlZC1jb250cm9sbGVkIGludGVyZmFjZSlcbiAgc3luY1NwZWVkKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCwgc2VlayA9IGZhbHNlKSB7XG4gICAgdmFyIGxhc3RTcGVlZCA9IHRoaXMuX19zcGVlZDtcblxuICAgIHRoaXMuX190aW1lID0gdGltZTtcbiAgICB0aGlzLl9fcG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICB0aGlzLl9fc3BlZWQgPSBzcGVlZDtcblxuICAgIGlmIChzcGVlZCAhPT0gbGFzdFNwZWVkIHx8IChzZWVrICYmIHNwZWVkICE9PSAwKSkge1xuICAgICAgdmFyIG5leHRQb3NpdGlvbjtcblxuICAgICAgLy8gcmVzeW5jIHRyYW5zcG9ydGVkIGVuZ2luZXNcbiAgICAgIGlmIChzZWVrIHx8IHNwZWVkICogbGFzdFNwZWVkIDwgMCkge1xuICAgICAgICAvLyBzZWVrIG9yIHJldmVyc2UgZGlyZWN0aW9uXG4gICAgICAgIG5leHRQb3NpdGlvbiA9IHRoaXMuX19zeW5jVHJhbnNwb3J0ZWRQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpO1xuICAgICAgfSBlbHNlIGlmIChsYXN0U3BlZWQgPT09IDApIHtcbiAgICAgICAgLy8gc3RhcnRcbiAgICAgICAgbmV4dFBvc2l0aW9uID0gdGhpcy5fX3N5bmNUcmFuc3BvcnRlZFBvc2l0aW9uKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCk7XG4gICAgICB9IGVsc2UgaWYgKHNwZWVkID09PSAwKSB7XG4gICAgICAgIC8vIHN0b3BcbiAgICAgICAgbmV4dFBvc2l0aW9uID0gSW5maW5pdHk7XG4gICAgICAgIHRoaXMuX19zeW5jVHJhbnNwb3J0ZWRTcGVlZCh0aW1lLCBwb3NpdGlvbiwgMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjaGFuZ2Ugc3BlZWQgd2l0aG91dCByZXZlcnNpbmcgZGlyZWN0aW9uXG4gICAgICAgIHRoaXMuX19zeW5jVHJhbnNwb3J0ZWRTcGVlZCh0aW1lLCBwb3NpdGlvbiwgc3BlZWQpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJlc2V0UG9zaXRpb24obmV4dFBvc2l0aW9uKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgdGltZSBlbmdpbmUgdG8gdGhlIHRyYW5zcG9ydFxuICAgKiBAcGFyYW0ge09iamVjdH0gZW5naW5lIGVuZ2luZSB0byBiZSBhZGRlZCB0byB0aGUgdHJhbnNwb3J0XG4gICAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiBzdGFydCBwb3NpdGlvblxuICAgKi9cbiAgYWRkKGVuZ2luZSwgc3RhcnRQb3NpdGlvbiA9IC1JbmZpbml0eSwgZW5kUG9zaXRpb24gPSBJbmZpbml0eSwgb2Zmc2V0UG9zaXRpb24gPSBzdGFydFBvc2l0aW9uKSB7XG4gICAgdmFyIHRyYW5zcG9ydGVkID0gbnVsbDtcblxuICAgIGlmIChvZmZzZXRQb3NpdGlvbiA9PT0gLUluZmluaXR5KVxuICAgICAgb2Zmc2V0UG9zaXRpb24gPSAwO1xuXG4gICAgaWYgKGVuZ2luZS5tYXN0ZXIpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvYmplY3QgaGFzIGFscmVhZHkgYmVlbiBhZGRlZCB0byBhIG1hc3RlclwiKTtcblxuICAgIGlmIChlbmdpbmUuaW1wbGVtZW50c1RyYW5zcG9ydGVkKCkpXG4gICAgICB0cmFuc3BvcnRlZCA9IG5ldyBUcmFuc3BvcnRlZFRyYW5zcG9ydGVkKHRoaXMsIGVuZ2luZSwgc3RhcnRQb3NpdGlvbiwgZW5kUG9zaXRpb24sIG9mZnNldFBvc2l0aW9uKTtcbiAgICBlbHNlIGlmIChlbmdpbmUuaW1wbGVtZW50c1NwZWVkQ29udHJvbGxlZCgpKVxuICAgICAgdHJhbnNwb3J0ZWQgPSBuZXcgVHJhbnNwb3J0ZWRTcGVlZENvbnRyb2xsZWQodGhpcywgZW5naW5lLCBzdGFydFBvc2l0aW9uLCBlbmRQb3NpdGlvbiwgb2Zmc2V0UG9zaXRpb24pO1xuICAgIGVsc2UgaWYgKGVuZ2luZS5pbXBsZW1lbnRzU2NoZWR1bGVkKCkpXG4gICAgICB0cmFuc3BvcnRlZCA9IG5ldyBUcmFuc3BvcnRlZFNjaGVkdWxlZCh0aGlzLCBlbmdpbmUsIHN0YXJ0UG9zaXRpb24sIGVuZFBvc2l0aW9uLCBvZmZzZXRQb3NpdGlvbik7XG4gICAgZWxzZVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwib2JqZWN0IGNhbm5vdCBiZSBhZGRlZCB0byBhIHRyYW5zcG9ydFwiKTtcblxuICAgIGlmICh0cmFuc3BvcnRlZCkge1xuICAgICAgdmFyIHNwZWVkID0gdGhpcy5fX3NwZWVkO1xuXG4gICAgICBhZGREdXBsZXQodGhpcy5fX2VuZ2luZXMsIHRoaXMuX190cmFuc3BvcnRlZCwgZW5naW5lLCB0cmFuc3BvcnRlZCk7XG5cbiAgICAgIGlmIChzcGVlZCAhPT0gMCkge1xuICAgICAgICAvLyBzeW5jIGFuZCBzdGFydFxuICAgICAgICB2YXIgbmV4dEVuZ2luZVBvc2l0aW9uID0gdHJhbnNwb3J0ZWQuc3luY1Bvc2l0aW9uKHRoaXMuY3VycmVudFRpbWUsIHRoaXMuY3VycmVudFBvc2l0aW9uLCBzcGVlZCk7XG4gICAgICAgIHZhciBuZXh0UG9zaXRpb24gPSB0aGlzLl9fdHJhbnNwb3J0ZWRRdWV1ZS5pbnNlcnQodHJhbnNwb3J0ZWQsIG5leHRFbmdpbmVQb3NpdGlvbik7XG5cbiAgICAgICAgdGhpcy5yZXNldFBvc2l0aW9uKG5leHRQb3NpdGlvbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRyYW5zcG9ydGVkO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHRpbWUgZW5naW5lIGZyb20gdGhlIHRyYW5zcG9ydFxuICAgKiBAcGFyYW0ge29iamVjdH0gZW5naW5lT3JUcmFuc3BvcnRlZCBlbmdpbmUgb3IgdHJhbnNwb3J0ZWQgdG8gYmUgcmVtb3ZlZCBmcm9tIHRoZSB0cmFuc3BvcnRcbiAgICovXG4gIHJlbW92ZShlbmdpbmVPclRyYW5zcG9ydGVkKSB7XG4gICAgdmFyIGVuZ2luZSA9IGVuZ2luZU9yVHJhbnNwb3J0ZWQ7XG4gICAgdmFyIHRyYW5zcG9ydGVkID0gcmVtb3ZlRHVwbGV0KHRoaXMuX19lbmdpbmVzLCB0aGlzLl9fdHJhbnNwb3J0ZWQsIGVuZ2luZU9yVHJhbnNwb3J0ZWQpO1xuXG4gICAgaWYgKCF0cmFuc3BvcnRlZCkge1xuICAgICAgZW5naW5lID0gcmVtb3ZlRHVwbGV0KHRoaXMuX190cmFuc3BvcnRlZCwgdGhpcy5fX2VuZ2luZXMsIGVuZ2luZU9yVHJhbnNwb3J0ZWQpO1xuICAgICAgdHJhbnNwb3J0ZWQgPSBlbmdpbmVPclRyYW5zcG9ydGVkO1xuICAgIH1cblxuICAgIGlmIChlbmdpbmUgJiYgdHJhbnNwb3J0ZWQpIHtcbiAgICAgIHZhciBuZXh0UG9zaXRpb24gPSB0aGlzLl9fdHJhbnNwb3J0ZWRRdWV1ZS5yZW1vdmUodHJhbnNwb3J0ZWQpO1xuXG4gICAgICB0cmFuc3BvcnRlZC5kZXN0cm95KCk7XG5cbiAgICAgIGlmICh0aGlzLl9fc3BlZWQgIT09IDApXG4gICAgICAgIHRoaXMucmVzZXRQb3NpdGlvbihuZXh0UG9zaXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvYmplY3QgaGFzIG5vdCBiZWVuIGFkZGVkIHRvIHRoaXMgdHJhbnNwb3J0XCIpO1xuICAgIH1cbiAgfVxuXG4gIHJlc2V0RW5naW5lUG9zaXRpb24odHJhbnNwb3J0ZWQsIHBvc2l0aW9uID0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIHNwZWVkID0gdGhpcy5fX3NwZWVkO1xuXG4gICAgaWYgKHNwZWVkICE9PSAwKSB7XG4gICAgICBpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZClcbiAgICAgICAgcG9zaXRpb24gPSB0cmFuc3BvcnRlZC5zeW5jUG9zaXRpb24odGhpcy5jdXJyZW50VGltZSwgdGhpcy5jdXJyZW50UG9zaXRpb24sIHNwZWVkKTtcblxuICAgICAgdmFyIG5leHRQb3NpdGlvbiA9IHRoaXMuX190cmFuc3BvcnRlZFF1ZXVlLm1vdmUodHJhbnNwb3J0ZWQsIHBvc2l0aW9uKTtcbiAgICAgIHRoaXMucmVzZXRQb3NpdGlvbihuZXh0UG9zaXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIHRpbWUgZW5naW5lcyBmcm9tIHRoZSB0cmFuc3BvcnRcbiAgICovXG4gIGNsZWFyKCkge1xuICAgIHRoaXMuc3luY1NwZWVkKHRoaXMuY3VycmVudFRpbWUsIHRoaXMuY3VycmVudFBvc2l0aW9uLCAwKTtcblxuICAgIGZvciAodmFyIHRyYW5zcG9ydGVkIG9mIHRoaXMuX190cmFuc3BvcnRlZClcbiAgICAgIHRyYW5zcG9ydGVkLmRlc3Ryb3koKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYW5zcG9ydDsiLCIvKipcbiAqIFNjaGVkdWxpbmdRdWV1ZSBiYXNlIGNsYXNzXG4gKiBodHRwOi8vd2F2ZXNqcy5naXRodWIuaW8vYXVkaW8vI2F1ZGlvLXNjaGVkdWxpbmctcXVldWVcbiAqXG4gKiBOb3JiZXJ0LlNjaG5lbGxAaXJjYW0uZnJcbiAqIENvcHlyaWdodCAyMDE0LCAyMDE1IElSQ0FNIOKAk8KgQ2VudHJlIFBvbXBpZG91XG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIFByaW9yaXR5UXVldWUgPSByZXF1aXJlKFwiLi4vdXRpbHMvcHJpb3JpdHktcXVldWVcIik7XG52YXIgVGltZUVuZ2luZSA9IHJlcXVpcmUoXCIuLi9jb3JlL3RpbWUtZW5naW5lXCIpO1xudmFyIGRlZmF1bHRBdWRpb0NvbnRleHQgPSByZXF1aXJlKFwiLi4vY29yZS9hdWRpby1jb250ZXh0XCIpO1xuXG5mdW5jdGlvbiBhcnJheVJlbW92ZShhcnJheSwgdmFsdWUpIHtcbiAgdmFyIGluZGV4ID0gYXJyYXkuaW5kZXhPZih2YWx1ZSk7XG5cbiAgaWYgKGluZGV4ID49IDApIHtcbiAgICBhcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIEBjbGFzcyBTY2hlZHVsaW5nUXVldWVcbiAqL1xuY2xhc3MgU2NoZWR1bGluZ1F1ZXVlIGV4dGVuZHMgVGltZUVuZ2luZSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLl9fcXVldWUgPSBuZXcgUHJpb3JpdHlRdWV1ZSgpO1xuICAgIHRoaXMuX19lbmdpbmVzID0gW107XG4gIH1cblxuICAvLyBUaW1lRW5naW5lICdzY2hlZHVsZWQnIGludGVyZmFjZVxuICBhZHZhbmNlVGltZSh0aW1lKSB7XG4gICAgdmFyIG5leHRUaW1lID0gdGhpcy5fX3F1ZXVlLnRpbWU7XG5cbiAgICB3aGlsZSAobmV4dFRpbWUgPD0gdGltZSkge1xuICAgICAgdmFyIGVuZ2luZSA9IHRoaXMuX19xdWV1ZS5oZWFkO1xuICAgICAgdmFyIG5leHRFbmdpbmVUaW1lID0gZW5naW5lLmFkdmFuY2VUaW1lKHRpbWUpO1xuXG4gICAgICBpZiAoIW5leHRFbmdpbmVUaW1lKSB7XG4gICAgICAgIGVuZ2luZS5tYXN0ZXIgPSBudWxsO1xuICAgICAgICBhcnJheVJlbW92ZSh0aGlzLl9fZW5naW5lcywgZW5naW5lKTtcbiAgICAgICAgbmV4dFRpbWUgPSB0aGlzLl9fcXVldWUucmVtb3ZlKGVuZ2luZSk7XG4gICAgICB9IGVsc2UgaWYgKG5leHRFbmdpbmVUaW1lID4gdGltZSAmJiBuZXh0RW5naW5lVGltZSA8IEluZmluaXR5KSB7XG4gICAgICAgIG5leHRUaW1lID0gdGhpcy5fX3F1ZXVlLm1vdmUoZW5naW5lLCBuZXh0RW5naW5lVGltZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXh0VGltZSA9IHRoaXMuX19xdWV1ZS5yZW1vdmUoZW5naW5lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV4dFRpbWU7XG4gIH1cblxuICAvLyBUaW1lRW5naW5lIG1hc3RlciBtZXRob2QgdG8gYmUgaW1wbGVtZW50ZWQgYnkgZGVyaXZlZCBjbGFzc1xuICBnZXQgY3VycmVudFRpbWUoKSB7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvLyBhZGQgYSB0aW1lIGVuZ2luZSB0byB0aGUgcXVldWUgYW5kIHJldHVybiB0aGUgZW5naW5lXG4gIGFkZChlbmdpbmUsIHRpbWUgPSB0aGlzLmN1cnJlbnRUaW1lKSB7XG4gICAgZW5naW5lLm1hc3RlciA9IHRoaXM7XG5cbiAgICAvLyBhZGQgdG8gZW5naW5lcyBhbmQgcXVldWVcbiAgICB0aGlzLl9fZW5naW5lcy5wdXNoKGVuZ2luZSk7XG4gICAgdmFyIG5leHRUaW1lID0gdGhpcy5fX3F1ZXVlLmluc2VydChlbmdpbmUsIHRpbWUpO1xuXG4gICAgLy8gcmVzY2hlZHVsZSBxdWV1ZVxuICAgIHRoaXMucmVzZXRUaW1lKG5leHRUaW1lKTtcbiAgfVxuXG4gIC8vIHJlbW92ZSBhIHRpbWUgZW5naW5lIGZyb20gdGhlIHF1ZXVlXG4gIHJlbW92ZShlbmdpbmUpIHtcbiAgICBlbmdpbmUubWFzdGVyID0gbnVsbDtcblxuICAgIC8vIHJlbW92ZSBmcm9tIGFycmF5IGFuZCBxdWV1ZVxuICAgIGFycmF5UmVtb3ZlKHRoaXMuX19lbmdpbmVzLCBlbmdpbmUpO1xuICAgIHZhciBuZXh0VGltZSA9IHRoaXMuX19xdWV1ZS5yZW1vdmUoZW5naW5lKTtcblxuICAgIC8vIHJlc2NoZWR1bGUgcXVldWVcbiAgICB0aGlzLnJlc2V0VGltZShuZXh0VGltZSk7XG4gIH1cblxuICAvLyByZXNldCBuZXh0IGVuZ2luZSB0aW1lXG4gIHJlc2V0RW5naW5lVGltZShlbmdpbmUsIHRpbWUgPSB0aGlzLmN1cnJlbnRUaW1lKSB7XG4gICAgdmFyIG5leHRUaW1lID0gdGhpcy5fX3F1ZXVlLm1vdmUoZW5naW5lLCB0aW1lKTtcbiAgICB0aGlzLnJlc2V0VGltZShuZXh0VGltZSk7XG4gIH1cblxuICAvLyBjbGVhciBxdWV1ZVxuICBjbGVhcigpIHtcbiAgICB0aGlzLl9fcXVldWUuY2xlYXIoKTtcbiAgICB0aGlzLl9fZW5naW5lcy5sZW5ndGggPSAwO1xuICAgIHRoaXMucmVzZXRUaW1lKEluZmluaXR5KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNjaGVkdWxpbmdRdWV1ZTsiLCIvKipcbiAqIENvcmUuanMgMC42LjFcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS96bG9pcm9jay9jb3JlLWpzXG4gKiBMaWNlbnNlOiBodHRwOi8vcm9jay5taXQtbGljZW5zZS5vcmdcbiAqIMKpIDIwMTUgRGVuaXMgUHVzaGthcmV2XG4gKi9cbiFmdW5jdGlvbihnbG9iYWwsIGZyYW1ld29yaywgdW5kZWZpbmVkKXtcbid1c2Ugc3RyaWN0JztcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogY29tbW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAvLyBTaG9ydGN1dHMgZm9yIFtbQ2xhc3NdXSAmIHByb3BlcnR5IG5hbWVzXHJcbnZhciBPQkpFQ1QgICAgICAgICAgPSAnT2JqZWN0J1xyXG4gICwgRlVOQ1RJT04gICAgICAgID0gJ0Z1bmN0aW9uJ1xyXG4gICwgQVJSQVkgICAgICAgICAgID0gJ0FycmF5J1xyXG4gICwgU1RSSU5HICAgICAgICAgID0gJ1N0cmluZydcclxuICAsIE5VTUJFUiAgICAgICAgICA9ICdOdW1iZXInXHJcbiAgLCBSRUdFWFAgICAgICAgICAgPSAnUmVnRXhwJ1xyXG4gICwgREFURSAgICAgICAgICAgID0gJ0RhdGUnXHJcbiAgLCBNQVAgICAgICAgICAgICAgPSAnTWFwJ1xyXG4gICwgU0VUICAgICAgICAgICAgID0gJ1NldCdcclxuICAsIFdFQUtNQVAgICAgICAgICA9ICdXZWFrTWFwJ1xyXG4gICwgV0VBS1NFVCAgICAgICAgID0gJ1dlYWtTZXQnXHJcbiAgLCBTWU1CT0wgICAgICAgICAgPSAnU3ltYm9sJ1xyXG4gICwgUFJPTUlTRSAgICAgICAgID0gJ1Byb21pc2UnXHJcbiAgLCBNQVRIICAgICAgICAgICAgPSAnTWF0aCdcclxuICAsIEFSR1VNRU5UUyAgICAgICA9ICdBcmd1bWVudHMnXHJcbiAgLCBQUk9UT1RZUEUgICAgICAgPSAncHJvdG90eXBlJ1xyXG4gICwgQ09OU1RSVUNUT1IgICAgID0gJ2NvbnN0cnVjdG9yJ1xyXG4gICwgVE9fU1RSSU5HICAgICAgID0gJ3RvU3RyaW5nJ1xyXG4gICwgVE9fU1RSSU5HX1RBRyAgID0gVE9fU1RSSU5HICsgJ1RhZydcclxuICAsIFRPX0xPQ0FMRSAgICAgICA9ICd0b0xvY2FsZVN0cmluZydcclxuICAsIEhBU19PV04gICAgICAgICA9ICdoYXNPd25Qcm9wZXJ0eSdcclxuICAsIEZPUl9FQUNIICAgICAgICA9ICdmb3JFYWNoJ1xyXG4gICwgSVRFUkFUT1IgICAgICAgID0gJ2l0ZXJhdG9yJ1xyXG4gICwgRkZfSVRFUkFUT1IgICAgID0gJ0BAJyArIElURVJBVE9SXHJcbiAgLCBQUk9DRVNTICAgICAgICAgPSAncHJvY2VzcydcclxuICAsIENSRUFURV9FTEVNRU5UICA9ICdjcmVhdGVFbGVtZW50J1xyXG4gIC8vIEFsaWFzZXMgZ2xvYmFsIG9iamVjdHMgYW5kIHByb3RvdHlwZXNcclxuICAsIEZ1bmN0aW9uICAgICAgICA9IGdsb2JhbFtGVU5DVElPTl1cclxuICAsIE9iamVjdCAgICAgICAgICA9IGdsb2JhbFtPQkpFQ1RdXHJcbiAgLCBBcnJheSAgICAgICAgICAgPSBnbG9iYWxbQVJSQVldXHJcbiAgLCBTdHJpbmcgICAgICAgICAgPSBnbG9iYWxbU1RSSU5HXVxyXG4gICwgTnVtYmVyICAgICAgICAgID0gZ2xvYmFsW05VTUJFUl1cclxuICAsIFJlZ0V4cCAgICAgICAgICA9IGdsb2JhbFtSRUdFWFBdXHJcbiAgLCBEYXRlICAgICAgICAgICAgPSBnbG9iYWxbREFURV1cclxuICAsIE1hcCAgICAgICAgICAgICA9IGdsb2JhbFtNQVBdXHJcbiAgLCBTZXQgICAgICAgICAgICAgPSBnbG9iYWxbU0VUXVxyXG4gICwgV2Vha01hcCAgICAgICAgID0gZ2xvYmFsW1dFQUtNQVBdXHJcbiAgLCBXZWFrU2V0ICAgICAgICAgPSBnbG9iYWxbV0VBS1NFVF1cclxuICAsIFN5bWJvbCAgICAgICAgICA9IGdsb2JhbFtTWU1CT0xdXHJcbiAgLCBNYXRoICAgICAgICAgICAgPSBnbG9iYWxbTUFUSF1cclxuICAsIFR5cGVFcnJvciAgICAgICA9IGdsb2JhbC5UeXBlRXJyb3JcclxuICAsIFJhbmdlRXJyb3IgICAgICA9IGdsb2JhbC5SYW5nZUVycm9yXHJcbiAgLCBzZXRUaW1lb3V0ICAgICAgPSBnbG9iYWwuc2V0VGltZW91dFxyXG4gICwgc2V0SW1tZWRpYXRlICAgID0gZ2xvYmFsLnNldEltbWVkaWF0ZVxyXG4gICwgY2xlYXJJbW1lZGlhdGUgID0gZ2xvYmFsLmNsZWFySW1tZWRpYXRlXHJcbiAgLCBwYXJzZUludCAgICAgICAgPSBnbG9iYWwucGFyc2VJbnRcclxuICAsIGlzRmluaXRlICAgICAgICA9IGdsb2JhbC5pc0Zpbml0ZVxyXG4gICwgcHJvY2VzcyAgICAgICAgID0gZ2xvYmFsW1BST0NFU1NdXHJcbiAgLCBuZXh0VGljayAgICAgICAgPSBwcm9jZXNzICYmIHByb2Nlc3MubmV4dFRpY2tcclxuICAsIGRvY3VtZW50ICAgICAgICA9IGdsb2JhbC5kb2N1bWVudFxyXG4gICwgaHRtbCAgICAgICAgICAgID0gZG9jdW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XHJcbiAgLCBuYXZpZ2F0b3IgICAgICAgPSBnbG9iYWwubmF2aWdhdG9yXHJcbiAgLCBkZWZpbmUgICAgICAgICAgPSBnbG9iYWwuZGVmaW5lXHJcbiAgLCBjb25zb2xlICAgICAgICAgPSBnbG9iYWwuY29uc29sZSB8fCB7fVxyXG4gICwgQXJyYXlQcm90byAgICAgID0gQXJyYXlbUFJPVE9UWVBFXVxyXG4gICwgT2JqZWN0UHJvdG8gICAgID0gT2JqZWN0W1BST1RPVFlQRV1cclxuICAsIEZ1bmN0aW9uUHJvdG8gICA9IEZ1bmN0aW9uW1BST1RPVFlQRV1cclxuICAsIEluZmluaXR5ICAgICAgICA9IDEgLyAwXHJcbiAgLCBET1QgICAgICAgICAgICAgPSAnLic7XHJcblxyXG4vLyBodHRwOi8vanNwZXJmLmNvbS9jb3JlLWpzLWlzb2JqZWN0XHJcbmZ1bmN0aW9uIGlzT2JqZWN0KGl0KXtcclxuICByZXR1cm4gaXQgIT09IG51bGwgJiYgKHR5cGVvZiBpdCA9PSAnb2JqZWN0JyB8fCB0eXBlb2YgaXQgPT0gJ2Z1bmN0aW9uJyk7XHJcbn1cclxuZnVuY3Rpb24gaXNGdW5jdGlvbihpdCl7XHJcbiAgcmV0dXJuIHR5cGVvZiBpdCA9PSAnZnVuY3Rpb24nO1xyXG59XHJcbi8vIE5hdGl2ZSBmdW5jdGlvbj9cclxudmFyIGlzTmF0aXZlID0gY3R4KC8uLy50ZXN0LCAvXFxbbmF0aXZlIGNvZGVcXF1cXHMqXFx9XFxzKiQvLCAxKTtcclxuXHJcbi8vIE9iamVjdCBpbnRlcm5hbCBbW0NsYXNzXV0gb3IgdG9TdHJpbmdUYWdcclxuLy8gaHR0cDovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZ1xyXG52YXIgdG9TdHJpbmcgPSBPYmplY3RQcm90b1tUT19TVFJJTkddO1xyXG5mdW5jdGlvbiBzZXRUb1N0cmluZ1RhZyhpdCwgdGFnLCBzdGF0KXtcclxuICBpZihpdCAmJiAhaGFzKGl0ID0gc3RhdCA/IGl0IDogaXRbUFJPVE9UWVBFXSwgU1lNQk9MX1RBRykpaGlkZGVuKGl0LCBTWU1CT0xfVEFHLCB0YWcpO1xyXG59XHJcbmZ1bmN0aW9uIGNvZihpdCl7XHJcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoaXQpLnNsaWNlKDgsIC0xKTtcclxufVxyXG5mdW5jdGlvbiBjbGFzc29mKGl0KXtcclxuICB2YXIgTywgVDtcclxuICByZXR1cm4gaXQgPT0gdW5kZWZpbmVkID8gaXQgPT09IHVuZGVmaW5lZCA/ICdVbmRlZmluZWQnIDogJ051bGwnXHJcbiAgICA6IHR5cGVvZiAoVCA9IChPID0gT2JqZWN0KGl0KSlbU1lNQk9MX1RBR10pID09ICdzdHJpbmcnID8gVCA6IGNvZihPKTtcclxufVxyXG5cclxuLy8gRnVuY3Rpb25cclxudmFyIGNhbGwgID0gRnVuY3Rpb25Qcm90by5jYWxsXHJcbiAgLCBhcHBseSA9IEZ1bmN0aW9uUHJvdG8uYXBwbHlcclxuICAsIFJFRkVSRU5DRV9HRVQ7XHJcbi8vIFBhcnRpYWwgYXBwbHlcclxuZnVuY3Rpb24gcGFydCgvKiAuLi5hcmdzICovKXtcclxuICB2YXIgZm4gICAgID0gYXNzZXJ0RnVuY3Rpb24odGhpcylcclxuICAgICwgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aFxyXG4gICAgLCBhcmdzICAgPSBBcnJheShsZW5ndGgpXHJcbiAgICAsIGkgICAgICA9IDBcclxuICAgICwgXyAgICAgID0gcGF0aC5fXHJcbiAgICAsIGhvbGRlciA9IGZhbHNlO1xyXG4gIHdoaWxlKGxlbmd0aCA+IGkpaWYoKGFyZ3NbaV0gPSBhcmd1bWVudHNbaSsrXSkgPT09IF8paG9sZGVyID0gdHJ1ZTtcclxuICByZXR1cm4gZnVuY3Rpb24oLyogLi4uYXJncyAqLyl7XHJcbiAgICB2YXIgdGhhdCAgICA9IHRoaXNcclxuICAgICAgLCBfbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aFxyXG4gICAgICAsIGkgPSAwLCBqID0gMCwgX2FyZ3M7XHJcbiAgICBpZighaG9sZGVyICYmICFfbGVuZ3RoKXJldHVybiBpbnZva2UoZm4sIGFyZ3MsIHRoYXQpO1xyXG4gICAgX2FyZ3MgPSBhcmdzLnNsaWNlKCk7XHJcbiAgICBpZihob2xkZXIpZm9yKDtsZW5ndGggPiBpOyBpKyspaWYoX2FyZ3NbaV0gPT09IF8pX2FyZ3NbaV0gPSBhcmd1bWVudHNbaisrXTtcclxuICAgIHdoaWxlKF9sZW5ndGggPiBqKV9hcmdzLnB1c2goYXJndW1lbnRzW2orK10pO1xyXG4gICAgcmV0dXJuIGludm9rZShmbiwgX2FyZ3MsIHRoYXQpO1xyXG4gIH1cclxufVxyXG4vLyBPcHRpb25hbCAvIHNpbXBsZSBjb250ZXh0IGJpbmRpbmdcclxuZnVuY3Rpb24gY3R4KGZuLCB0aGF0LCBsZW5ndGgpe1xyXG4gIGFzc2VydEZ1bmN0aW9uKGZuKTtcclxuICBpZih+bGVuZ3RoICYmIHRoYXQgPT09IHVuZGVmaW5lZClyZXR1cm4gZm47XHJcbiAgc3dpdGNoKGxlbmd0aCl7XHJcbiAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbihhKXtcclxuICAgICAgcmV0dXJuIGZuLmNhbGwodGhhdCwgYSk7XHJcbiAgICB9XHJcbiAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbihhLCBiKXtcclxuICAgICAgcmV0dXJuIGZuLmNhbGwodGhhdCwgYSwgYik7XHJcbiAgICB9XHJcbiAgICBjYXNlIDM6IHJldHVybiBmdW5jdGlvbihhLCBiLCBjKXtcclxuICAgICAgcmV0dXJuIGZuLmNhbGwodGhhdCwgYSwgYiwgYyk7XHJcbiAgICB9XHJcbiAgfSByZXR1cm4gZnVuY3Rpb24oLyogLi4uYXJncyAqLyl7XHJcbiAgICAgIHJldHVybiBmbi5hcHBseSh0aGF0LCBhcmd1bWVudHMpO1xyXG4gIH1cclxufVxyXG4vLyBGYXN0IGFwcGx5XHJcbi8vIGh0dHA6Ly9qc3BlcmYubG5raXQuY29tL2Zhc3QtYXBwbHkvNVxyXG5mdW5jdGlvbiBpbnZva2UoZm4sIGFyZ3MsIHRoYXQpe1xyXG4gIHZhciB1biA9IHRoYXQgPT09IHVuZGVmaW5lZDtcclxuICBzd2l0Y2goYXJncy5sZW5ndGggfCAwKXtcclxuICAgIGNhc2UgMDogcmV0dXJuIHVuID8gZm4oKVxyXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQpO1xyXG4gICAgY2FzZSAxOiByZXR1cm4gdW4gPyBmbihhcmdzWzBdKVxyXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQsIGFyZ3NbMF0pO1xyXG4gICAgY2FzZSAyOiByZXR1cm4gdW4gPyBmbihhcmdzWzBdLCBhcmdzWzFdKVxyXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQsIGFyZ3NbMF0sIGFyZ3NbMV0pO1xyXG4gICAgY2FzZSAzOiByZXR1cm4gdW4gPyBmbihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKVxyXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQsIGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0pO1xyXG4gICAgY2FzZSA0OiByZXR1cm4gdW4gPyBmbihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdKVxyXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQsIGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10pO1xyXG4gICAgY2FzZSA1OiByZXR1cm4gdW4gPyBmbihhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdLCBhcmdzWzNdLCBhcmdzWzRdKVxyXG4gICAgICAgICAgICAgICAgICAgICAgOiBmbi5jYWxsKHRoYXQsIGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0sIGFyZ3NbM10sIGFyZ3NbNF0pO1xyXG4gIH0gcmV0dXJuICAgICAgICAgICAgICBmbi5hcHBseSh0aGF0LCBhcmdzKTtcclxufVxyXG5cclxuLy8gT2JqZWN0OlxyXG52YXIgY3JlYXRlICAgICAgICAgICA9IE9iamVjdC5jcmVhdGVcclxuICAsIGdldFByb3RvdHlwZU9mICAgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2ZcclxuICAsIHNldFByb3RvdHlwZU9mICAgPSBPYmplY3Quc2V0UHJvdG90eXBlT2ZcclxuICAsIGRlZmluZVByb3BlcnR5ICAgPSBPYmplY3QuZGVmaW5lUHJvcGVydHlcclxuICAsIGRlZmluZVByb3BlcnRpZXMgPSBPYmplY3QuZGVmaW5lUHJvcGVydGllc1xyXG4gICwgZ2V0T3duRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JcclxuICAsIGdldEtleXMgICAgICAgICAgPSBPYmplY3Qua2V5c1xyXG4gICwgZ2V0TmFtZXMgICAgICAgICA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzXHJcbiAgLCBnZXRTeW1ib2xzICAgICAgID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9sc1xyXG4gICwgaXNGcm96ZW4gICAgICAgICA9IE9iamVjdC5pc0Zyb3plblxyXG4gICwgaGFzICAgICAgICAgICAgICA9IGN0eChjYWxsLCBPYmplY3RQcm90b1tIQVNfT1dOXSwgMilcclxuICAvLyBEdW1teSwgZml4IGZvciBub3QgYXJyYXktbGlrZSBFUzMgc3RyaW5nIGluIGVzNSBtb2R1bGVcclxuICAsIEVTNU9iamVjdCAgICAgICAgPSBPYmplY3RcclxuICAsIERpY3Q7XHJcbmZ1bmN0aW9uIHRvT2JqZWN0KGl0KXtcclxuICByZXR1cm4gRVM1T2JqZWN0KGFzc2VydERlZmluZWQoaXQpKTtcclxufVxyXG5mdW5jdGlvbiByZXR1cm5JdChpdCl7XHJcbiAgcmV0dXJuIGl0O1xyXG59XHJcbmZ1bmN0aW9uIHJldHVyblRoaXMoKXtcclxuICByZXR1cm4gdGhpcztcclxufVxyXG5mdW5jdGlvbiBnZXQob2JqZWN0LCBrZXkpe1xyXG4gIGlmKGhhcyhvYmplY3QsIGtleSkpcmV0dXJuIG9iamVjdFtrZXldO1xyXG59XHJcbmZ1bmN0aW9uIG93bktleXMoaXQpe1xyXG4gIGFzc2VydE9iamVjdChpdCk7XHJcbiAgcmV0dXJuIGdldFN5bWJvbHMgPyBnZXROYW1lcyhpdCkuY29uY2F0KGdldFN5bWJvbHMoaXQpKSA6IGdldE5hbWVzKGl0KTtcclxufVxyXG4vLyAxOS4xLjIuMSBPYmplY3QuYXNzaWduKHRhcmdldCwgc291cmNlLCAuLi4pXHJcbnZhciBhc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uKHRhcmdldCwgc291cmNlKXtcclxuICB2YXIgVCA9IE9iamVjdChhc3NlcnREZWZpbmVkKHRhcmdldCkpXHJcbiAgICAsIGwgPSBhcmd1bWVudHMubGVuZ3RoXHJcbiAgICAsIGkgPSAxO1xyXG4gIHdoaWxlKGwgPiBpKXtcclxuICAgIHZhciBTICAgICAgPSBFUzVPYmplY3QoYXJndW1lbnRzW2krK10pXHJcbiAgICAgICwga2V5cyAgID0gZ2V0S2V5cyhTKVxyXG4gICAgICAsIGxlbmd0aCA9IGtleXMubGVuZ3RoXHJcbiAgICAgICwgaiAgICAgID0gMFxyXG4gICAgICAsIGtleTtcclxuICAgIHdoaWxlKGxlbmd0aCA+IGopVFtrZXkgPSBrZXlzW2orK11dID0gU1trZXldO1xyXG4gIH1cclxuICByZXR1cm4gVDtcclxufVxyXG5mdW5jdGlvbiBrZXlPZihvYmplY3QsIGVsKXtcclxuICB2YXIgTyAgICAgID0gdG9PYmplY3Qob2JqZWN0KVxyXG4gICAgLCBrZXlzICAgPSBnZXRLZXlzKE8pXHJcbiAgICAsIGxlbmd0aCA9IGtleXMubGVuZ3RoXHJcbiAgICAsIGluZGV4ICA9IDBcclxuICAgICwga2V5O1xyXG4gIHdoaWxlKGxlbmd0aCA+IGluZGV4KWlmKE9ba2V5ID0ga2V5c1tpbmRleCsrXV0gPT09IGVsKXJldHVybiBrZXk7XHJcbn1cclxuXHJcbi8vIEFycmF5XHJcbi8vIGFycmF5KCdzdHIxLHN0cjIsc3RyMycpID0+IFsnc3RyMScsICdzdHIyJywgJ3N0cjMnXVxyXG5mdW5jdGlvbiBhcnJheShpdCl7XHJcbiAgcmV0dXJuIFN0cmluZyhpdCkuc3BsaXQoJywnKTtcclxufVxyXG52YXIgcHVzaCAgICA9IEFycmF5UHJvdG8ucHVzaFxyXG4gICwgdW5zaGlmdCA9IEFycmF5UHJvdG8udW5zaGlmdFxyXG4gICwgc2xpY2UgICA9IEFycmF5UHJvdG8uc2xpY2VcclxuICAsIHNwbGljZSAgPSBBcnJheVByb3RvLnNwbGljZVxyXG4gICwgaW5kZXhPZiA9IEFycmF5UHJvdG8uaW5kZXhPZlxyXG4gICwgZm9yRWFjaCA9IEFycmF5UHJvdG9bRk9SX0VBQ0hdO1xyXG4vKlxyXG4gKiAwIC0+IGZvckVhY2hcclxuICogMSAtPiBtYXBcclxuICogMiAtPiBmaWx0ZXJcclxuICogMyAtPiBzb21lXHJcbiAqIDQgLT4gZXZlcnlcclxuICogNSAtPiBmaW5kXHJcbiAqIDYgLT4gZmluZEluZGV4XHJcbiAqL1xyXG5mdW5jdGlvbiBjcmVhdGVBcnJheU1ldGhvZCh0eXBlKXtcclxuICB2YXIgaXNNYXAgICAgICAgPSB0eXBlID09IDFcclxuICAgICwgaXNGaWx0ZXIgICAgPSB0eXBlID09IDJcclxuICAgICwgaXNTb21lICAgICAgPSB0eXBlID09IDNcclxuICAgICwgaXNFdmVyeSAgICAgPSB0eXBlID09IDRcclxuICAgICwgaXNGaW5kSW5kZXggPSB0eXBlID09IDZcclxuICAgICwgbm9ob2xlcyAgICAgPSB0eXBlID09IDUgfHwgaXNGaW5kSW5kZXg7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKGNhbGxiYWNrZm4vKiwgdGhhdCA9IHVuZGVmaW5lZCAqLyl7XHJcbiAgICB2YXIgTyAgICAgID0gT2JqZWN0KGFzc2VydERlZmluZWQodGhpcykpXHJcbiAgICAgICwgdGhhdCAgID0gYXJndW1lbnRzWzFdXHJcbiAgICAgICwgc2VsZiAgID0gRVM1T2JqZWN0KE8pXHJcbiAgICAgICwgZiAgICAgID0gY3R4KGNhbGxiYWNrZm4sIHRoYXQsIDMpXHJcbiAgICAgICwgbGVuZ3RoID0gdG9MZW5ndGgoc2VsZi5sZW5ndGgpXHJcbiAgICAgICwgaW5kZXggID0gMFxyXG4gICAgICAsIHJlc3VsdCA9IGlzTWFwID8gQXJyYXkobGVuZ3RoKSA6IGlzRmlsdGVyID8gW10gOiB1bmRlZmluZWRcclxuICAgICAgLCB2YWwsIHJlcztcclxuICAgIGZvcig7bGVuZ3RoID4gaW5kZXg7IGluZGV4KyspaWYobm9ob2xlcyB8fCBpbmRleCBpbiBzZWxmKXtcclxuICAgICAgdmFsID0gc2VsZltpbmRleF07XHJcbiAgICAgIHJlcyA9IGYodmFsLCBpbmRleCwgTyk7XHJcbiAgICAgIGlmKHR5cGUpe1xyXG4gICAgICAgIGlmKGlzTWFwKXJlc3VsdFtpbmRleF0gPSByZXM7ICAgICAgICAgICAgIC8vIG1hcFxyXG4gICAgICAgIGVsc2UgaWYocmVzKXN3aXRjaCh0eXBlKXtcclxuICAgICAgICAgIGNhc2UgMzogcmV0dXJuIHRydWU7ICAgICAgICAgICAgICAgICAgICAvLyBzb21lXHJcbiAgICAgICAgICBjYXNlIDU6IHJldHVybiB2YWw7ICAgICAgICAgICAgICAgICAgICAgLy8gZmluZFxyXG4gICAgICAgICAgY2FzZSA2OiByZXR1cm4gaW5kZXg7ICAgICAgICAgICAgICAgICAgIC8vIGZpbmRJbmRleFxyXG4gICAgICAgICAgY2FzZSAyOiByZXN1bHQucHVzaCh2YWwpOyAgICAgICAgICAgICAgIC8vIGZpbHRlclxyXG4gICAgICAgIH0gZWxzZSBpZihpc0V2ZXJ5KXJldHVybiBmYWxzZTsgICAgICAgICAgIC8vIGV2ZXJ5XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBpc0ZpbmRJbmRleCA/IC0xIDogaXNTb21lIHx8IGlzRXZlcnkgPyBpc0V2ZXJ5IDogcmVzdWx0O1xyXG4gIH1cclxufVxyXG5mdW5jdGlvbiBjcmVhdGVBcnJheUNvbnRhaW5zKGlzQ29udGFpbnMpe1xyXG4gIHJldHVybiBmdW5jdGlvbihlbCAvKiwgZnJvbUluZGV4ID0gMCAqLyl7XHJcbiAgICB2YXIgTyAgICAgID0gdG9PYmplY3QodGhpcylcclxuICAgICAgLCBsZW5ndGggPSB0b0xlbmd0aChPLmxlbmd0aClcclxuICAgICAgLCBpbmRleCAgPSB0b0luZGV4KGFyZ3VtZW50c1sxXSwgbGVuZ3RoKTtcclxuICAgIGlmKGlzQ29udGFpbnMgJiYgZWwgIT0gZWwpe1xyXG4gICAgICBmb3IoO2xlbmd0aCA+IGluZGV4OyBpbmRleCsrKWlmKHNhbWVOYU4oT1tpbmRleF0pKXJldHVybiBpc0NvbnRhaW5zIHx8IGluZGV4O1xyXG4gICAgfSBlbHNlIGZvcig7bGVuZ3RoID4gaW5kZXg7IGluZGV4KyspaWYoaXNDb250YWlucyB8fCBpbmRleCBpbiBPKXtcclxuICAgICAgaWYoT1tpbmRleF0gPT09IGVsKXJldHVybiBpc0NvbnRhaW5zIHx8IGluZGV4O1xyXG4gICAgfSByZXR1cm4gIWlzQ29udGFpbnMgJiYgLTE7XHJcbiAgfVxyXG59XHJcbmZ1bmN0aW9uIGdlbmVyaWMoQSwgQil7XHJcbiAgLy8gc3RyYW5nZSBJRSBxdWlya3MgbW9kZSBidWcgLT4gdXNlIHR5cGVvZiB2cyBpc0Z1bmN0aW9uXHJcbiAgcmV0dXJuIHR5cGVvZiBBID09ICdmdW5jdGlvbicgPyBBIDogQjtcclxufVxyXG5cclxuLy8gTWF0aFxyXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDB4MWZmZmZmZmZmZmZmZmYgLy8gcG93KDIsIDUzKSAtIDEgPT0gOTAwNzE5OTI1NDc0MDk5MVxyXG4gICwgcG93ICAgID0gTWF0aC5wb3dcclxuICAsIGFicyAgICA9IE1hdGguYWJzXHJcbiAgLCBjZWlsICAgPSBNYXRoLmNlaWxcclxuICAsIGZsb29yICA9IE1hdGguZmxvb3JcclxuICAsIG1heCAgICA9IE1hdGgubWF4XHJcbiAgLCBtaW4gICAgPSBNYXRoLm1pblxyXG4gICwgcmFuZG9tID0gTWF0aC5yYW5kb21cclxuICAsIHRydW5jICA9IE1hdGgudHJ1bmMgfHwgZnVuY3Rpb24oaXQpe1xyXG4gICAgICByZXR1cm4gKGl0ID4gMCA/IGZsb29yIDogY2VpbCkoaXQpO1xyXG4gICAgfVxyXG4vLyAyMC4xLjIuNCBOdW1iZXIuaXNOYU4obnVtYmVyKVxyXG5mdW5jdGlvbiBzYW1lTmFOKG51bWJlcil7XHJcbiAgcmV0dXJuIG51bWJlciAhPSBudW1iZXI7XHJcbn1cclxuLy8gNy4xLjQgVG9JbnRlZ2VyXHJcbmZ1bmN0aW9uIHRvSW50ZWdlcihpdCl7XHJcbiAgcmV0dXJuIGlzTmFOKGl0KSA/IDAgOiB0cnVuYyhpdCk7XHJcbn1cclxuLy8gNy4xLjE1IFRvTGVuZ3RoXHJcbmZ1bmN0aW9uIHRvTGVuZ3RoKGl0KXtcclxuICByZXR1cm4gaXQgPiAwID8gbWluKHRvSW50ZWdlcihpdCksIE1BWF9TQUZFX0lOVEVHRVIpIDogMDtcclxufVxyXG5mdW5jdGlvbiB0b0luZGV4KGluZGV4LCBsZW5ndGgpe1xyXG4gIHZhciBpbmRleCA9IHRvSW50ZWdlcihpbmRleCk7XHJcbiAgcmV0dXJuIGluZGV4IDwgMCA/IG1heChpbmRleCArIGxlbmd0aCwgMCkgOiBtaW4oaW5kZXgsIGxlbmd0aCk7XHJcbn1cclxuZnVuY3Rpb24gbHoobnVtKXtcclxuICByZXR1cm4gbnVtID4gOSA/IG51bSA6ICcwJyArIG51bTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlUmVwbGFjZXIocmVnRXhwLCByZXBsYWNlLCBpc1N0YXRpYyl7XHJcbiAgdmFyIHJlcGxhY2VyID0gaXNPYmplY3QocmVwbGFjZSkgPyBmdW5jdGlvbihwYXJ0KXtcclxuICAgIHJldHVybiByZXBsYWNlW3BhcnRdO1xyXG4gIH0gOiByZXBsYWNlO1xyXG4gIHJldHVybiBmdW5jdGlvbihpdCl7XHJcbiAgICByZXR1cm4gU3RyaW5nKGlzU3RhdGljID8gaXQgOiB0aGlzKS5yZXBsYWNlKHJlZ0V4cCwgcmVwbGFjZXIpO1xyXG4gIH1cclxufVxyXG5mdW5jdGlvbiBjcmVhdGVQb2ludEF0KHRvU3RyaW5nKXtcclxuICByZXR1cm4gZnVuY3Rpb24ocG9zKXtcclxuICAgIHZhciBzID0gU3RyaW5nKGFzc2VydERlZmluZWQodGhpcykpXHJcbiAgICAgICwgaSA9IHRvSW50ZWdlcihwb3MpXHJcbiAgICAgICwgbCA9IHMubGVuZ3RoXHJcbiAgICAgICwgYSwgYjtcclxuICAgIGlmKGkgPCAwIHx8IGkgPj0gbClyZXR1cm4gdG9TdHJpbmcgPyAnJyA6IHVuZGVmaW5lZDtcclxuICAgIGEgPSBzLmNoYXJDb2RlQXQoaSk7XHJcbiAgICByZXR1cm4gYSA8IDB4ZDgwMCB8fCBhID4gMHhkYmZmIHx8IGkgKyAxID09PSBsIHx8IChiID0gcy5jaGFyQ29kZUF0KGkgKyAxKSkgPCAweGRjMDAgfHwgYiA+IDB4ZGZmZlxyXG4gICAgICA/IHRvU3RyaW5nID8gcy5jaGFyQXQoaSkgOiBhXHJcbiAgICAgIDogdG9TdHJpbmcgPyBzLnNsaWNlKGksIGkgKyAyKSA6IChhIC0gMHhkODAwIDw8IDEwKSArIChiIC0gMHhkYzAwKSArIDB4MTAwMDA7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBBc3NlcnRpb24gJiBlcnJvcnNcclxudmFyIFJFRFVDRV9FUlJPUiA9ICdSZWR1Y2Ugb2YgZW1wdHkgb2JqZWN0IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XHJcbmZ1bmN0aW9uIGFzc2VydChjb25kaXRpb24sIG1zZzEsIG1zZzIpe1xyXG4gIGlmKCFjb25kaXRpb24pdGhyb3cgVHlwZUVycm9yKG1zZzIgPyBtc2cxICsgbXNnMiA6IG1zZzEpO1xyXG59XHJcbmZ1bmN0aW9uIGFzc2VydERlZmluZWQoaXQpe1xyXG4gIGlmKGl0ID09IHVuZGVmaW5lZCl0aHJvdyBUeXBlRXJyb3IoJ0Z1bmN0aW9uIGNhbGxlZCBvbiBudWxsIG9yIHVuZGVmaW5lZCcpO1xyXG4gIHJldHVybiBpdDtcclxufVxyXG5mdW5jdGlvbiBhc3NlcnRGdW5jdGlvbihpdCl7XHJcbiAgYXNzZXJ0KGlzRnVuY3Rpb24oaXQpLCBpdCwgJyBpcyBub3QgYSBmdW5jdGlvbiEnKTtcclxuICByZXR1cm4gaXQ7XHJcbn1cclxuZnVuY3Rpb24gYXNzZXJ0T2JqZWN0KGl0KXtcclxuICBhc3NlcnQoaXNPYmplY3QoaXQpLCBpdCwgJyBpcyBub3QgYW4gb2JqZWN0IScpO1xyXG4gIHJldHVybiBpdDtcclxufVxyXG5mdW5jdGlvbiBhc3NlcnRJbnN0YW5jZShpdCwgQ29uc3RydWN0b3IsIG5hbWUpe1xyXG4gIGFzc2VydChpdCBpbnN0YW5jZW9mIENvbnN0cnVjdG9yLCBuYW1lLCBcIjogdXNlIHRoZSAnbmV3JyBvcGVyYXRvciFcIik7XHJcbn1cclxuXHJcbi8vIFByb3BlcnR5IGRlc2NyaXB0b3JzICYgU3ltYm9sXHJcbmZ1bmN0aW9uIGRlc2NyaXB0b3IoYml0bWFwLCB2YWx1ZSl7XHJcbiAgcmV0dXJuIHtcclxuICAgIGVudW1lcmFibGUgIDogIShiaXRtYXAgJiAxKSxcclxuICAgIGNvbmZpZ3VyYWJsZTogIShiaXRtYXAgJiAyKSxcclxuICAgIHdyaXRhYmxlICAgIDogIShiaXRtYXAgJiA0KSxcclxuICAgIHZhbHVlICAgICAgIDogdmFsdWVcclxuICB9XHJcbn1cclxuZnVuY3Rpb24gc2ltcGxlU2V0KG9iamVjdCwga2V5LCB2YWx1ZSl7XHJcbiAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcclxuICByZXR1cm4gb2JqZWN0O1xyXG59XHJcbmZ1bmN0aW9uIGNyZWF0ZURlZmluZXIoYml0bWFwKXtcclxuICByZXR1cm4gREVTQyA/IGZ1bmN0aW9uKG9iamVjdCwga2V5LCB2YWx1ZSl7XHJcbiAgICByZXR1cm4gZGVmaW5lUHJvcGVydHkob2JqZWN0LCBrZXksIGRlc2NyaXB0b3IoYml0bWFwLCB2YWx1ZSkpO1xyXG4gIH0gOiBzaW1wbGVTZXQ7XHJcbn1cclxuZnVuY3Rpb24gdWlkKGtleSl7XHJcbiAgcmV0dXJuIFNZTUJPTCArICcoJyArIGtleSArICcpXycgKyAoKytzaWQgKyByYW5kb20oKSlbVE9fU1RSSU5HXSgzNik7XHJcbn1cclxuZnVuY3Rpb24gZ2V0V2VsbEtub3duU3ltYm9sKG5hbWUsIHNldHRlcil7XHJcbiAgcmV0dXJuIChTeW1ib2wgJiYgU3ltYm9sW25hbWVdKSB8fCAoc2V0dGVyID8gU3ltYm9sIDogc2FmZVN5bWJvbCkoU1lNQk9MICsgRE9UICsgbmFtZSk7XHJcbn1cclxuLy8gVGhlIGVuZ2luZSB3b3JrcyBmaW5lIHdpdGggZGVzY3JpcHRvcnM/IFRoYW5rJ3MgSUU4IGZvciBoaXMgZnVubnkgZGVmaW5lUHJvcGVydHkuXHJcbnZhciBERVNDID0gISFmdW5jdGlvbigpe1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHJldHVybiBkZWZpbmVQcm9wZXJ0eSh7fSwgJ2EnLCB7Z2V0OiBmdW5jdGlvbigpeyByZXR1cm4gMiB9fSkuYSA9PSAyO1xyXG4gICAgICB9IGNhdGNoKGUpe31cclxuICAgIH0oKVxyXG4gICwgc2lkICAgID0gMFxyXG4gICwgaGlkZGVuID0gY3JlYXRlRGVmaW5lcigxKVxyXG4gICwgc2V0ICAgID0gU3ltYm9sID8gc2ltcGxlU2V0IDogaGlkZGVuXHJcbiAgLCBzYWZlU3ltYm9sID0gU3ltYm9sIHx8IHVpZDtcclxuZnVuY3Rpb24gYXNzaWduSGlkZGVuKHRhcmdldCwgc3JjKXtcclxuICBmb3IodmFyIGtleSBpbiBzcmMpaGlkZGVuKHRhcmdldCwga2V5LCBzcmNba2V5XSk7XHJcbiAgcmV0dXJuIHRhcmdldDtcclxufVxyXG5cclxudmFyIFNZTUJPTF9VTlNDT1BBQkxFUyA9IGdldFdlbGxLbm93blN5bWJvbCgndW5zY29wYWJsZXMnKVxyXG4gICwgQXJyYXlVbnNjb3BhYmxlcyAgID0gQXJyYXlQcm90b1tTWU1CT0xfVU5TQ09QQUJMRVNdIHx8IHt9XHJcbiAgLCBTWU1CT0xfVEFHICAgICAgICAgPSBnZXRXZWxsS25vd25TeW1ib2woVE9fU1RSSU5HX1RBRylcclxuICAsIFNZTUJPTF9TUEVDSUVTICAgICA9IGdldFdlbGxLbm93blN5bWJvbCgnc3BlY2llcycpXHJcbiAgLCBTWU1CT0xfSVRFUkFUT1I7XHJcbmZ1bmN0aW9uIHNldFNwZWNpZXMoQyl7XHJcbiAgaWYoREVTQyAmJiAoZnJhbWV3b3JrIHx8ICFpc05hdGl2ZShDKSkpZGVmaW5lUHJvcGVydHkoQywgU1lNQk9MX1NQRUNJRVMsIHtcclxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcclxuICAgIGdldDogcmV0dXJuVGhpc1xyXG4gIH0pO1xyXG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGNvbW1vbi5leHBvcnQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbnZhciBOT0RFID0gY29mKHByb2Nlc3MpID09IFBST0NFU1NcclxuICAsIGNvcmUgPSB7fVxyXG4gICwgcGF0aCA9IGZyYW1ld29yayA/IGdsb2JhbCA6IGNvcmVcclxuICAsIG9sZCAgPSBnbG9iYWwuY29yZVxyXG4gICwgZXhwb3J0R2xvYmFsXHJcbiAgLy8gdHlwZSBiaXRtYXBcclxuICAsIEZPUkNFRCA9IDFcclxuICAsIEdMT0JBTCA9IDJcclxuICAsIFNUQVRJQyA9IDRcclxuICAsIFBST1RPICA9IDhcclxuICAsIEJJTkQgICA9IDE2XHJcbiAgLCBXUkFQICAgPSAzMjtcclxuZnVuY3Rpb24gJGRlZmluZSh0eXBlLCBuYW1lLCBzb3VyY2Upe1xyXG4gIHZhciBrZXksIG93biwgb3V0LCBleHBcclxuICAgICwgaXNHbG9iYWwgPSB0eXBlICYgR0xPQkFMXHJcbiAgICAsIHRhcmdldCAgID0gaXNHbG9iYWwgPyBnbG9iYWwgOiAodHlwZSAmIFNUQVRJQylcclxuICAgICAgICA/IGdsb2JhbFtuYW1lXSA6IChnbG9iYWxbbmFtZV0gfHwgT2JqZWN0UHJvdG8pW1BST1RPVFlQRV1cclxuICAgICwgZXhwb3J0cyAgPSBpc0dsb2JhbCA/IGNvcmUgOiBjb3JlW25hbWVdIHx8IChjb3JlW25hbWVdID0ge30pO1xyXG4gIGlmKGlzR2xvYmFsKXNvdXJjZSA9IG5hbWU7XHJcbiAgZm9yKGtleSBpbiBzb3VyY2Upe1xyXG4gICAgLy8gdGhlcmUgaXMgYSBzaW1pbGFyIG5hdGl2ZVxyXG4gICAgb3duID0gISh0eXBlICYgRk9SQ0VEKSAmJiB0YXJnZXQgJiYga2V5IGluIHRhcmdldFxyXG4gICAgICAmJiAoIWlzRnVuY3Rpb24odGFyZ2V0W2tleV0pIHx8IGlzTmF0aXZlKHRhcmdldFtrZXldKSk7XHJcbiAgICAvLyBleHBvcnQgbmF0aXZlIG9yIHBhc3NlZFxyXG4gICAgb3V0ID0gKG93biA/IHRhcmdldCA6IHNvdXJjZSlba2V5XTtcclxuICAgIC8vIHByZXZlbnQgZ2xvYmFsIHBvbGx1dGlvbiBmb3IgbmFtZXNwYWNlc1xyXG4gICAgaWYoIWZyYW1ld29yayAmJiBpc0dsb2JhbCAmJiAhaXNGdW5jdGlvbih0YXJnZXRba2V5XSkpZXhwID0gc291cmNlW2tleV07XHJcbiAgICAvLyBiaW5kIHRpbWVycyB0byBnbG9iYWwgZm9yIGNhbGwgZnJvbSBleHBvcnQgY29udGV4dFxyXG4gICAgZWxzZSBpZih0eXBlICYgQklORCAmJiBvd24pZXhwID0gY3R4KG91dCwgZ2xvYmFsKTtcclxuICAgIC8vIHdyYXAgZ2xvYmFsIGNvbnN0cnVjdG9ycyBmb3IgcHJldmVudCBjaGFuZ2UgdGhlbSBpbiBsaWJyYXJ5XHJcbiAgICBlbHNlIGlmKHR5cGUgJiBXUkFQICYmICFmcmFtZXdvcmsgJiYgdGFyZ2V0W2tleV0gPT0gb3V0KXtcclxuICAgICAgZXhwID0gZnVuY3Rpb24ocGFyYW0pe1xyXG4gICAgICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2Ygb3V0ID8gbmV3IG91dChwYXJhbSkgOiBvdXQocGFyYW0pO1xyXG4gICAgICB9XHJcbiAgICAgIGV4cFtQUk9UT1RZUEVdID0gb3V0W1BST1RPVFlQRV07XHJcbiAgICB9IGVsc2UgZXhwID0gdHlwZSAmIFBST1RPICYmIGlzRnVuY3Rpb24ob3V0KSA/IGN0eChjYWxsLCBvdXQpIDogb3V0O1xyXG4gICAgLy8gZXh0ZW5kIGdsb2JhbFxyXG4gICAgaWYoZnJhbWV3b3JrICYmIHRhcmdldCAmJiAhb3duKXtcclxuICAgICAgaWYoaXNHbG9iYWwpdGFyZ2V0W2tleV0gPSBvdXQ7XHJcbiAgICAgIGVsc2UgZGVsZXRlIHRhcmdldFtrZXldICYmIGhpZGRlbih0YXJnZXQsIGtleSwgb3V0KTtcclxuICAgIH1cclxuICAgIC8vIGV4cG9ydFxyXG4gICAgaWYoZXhwb3J0c1trZXldICE9IG91dCloaWRkZW4oZXhwb3J0cywga2V5LCBleHApO1xyXG4gIH1cclxufVxyXG4vLyBDb21tb25KUyBleHBvcnRcclxuaWYodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cyltb2R1bGUuZXhwb3J0cyA9IGNvcmU7XHJcbi8vIFJlcXVpcmVKUyBleHBvcnRcclxuZWxzZSBpZihpc0Z1bmN0aW9uKGRlZmluZSkgJiYgZGVmaW5lLmFtZClkZWZpbmUoZnVuY3Rpb24oKXtyZXR1cm4gY29yZX0pO1xyXG4vLyBFeHBvcnQgdG8gZ2xvYmFsIG9iamVjdFxyXG5lbHNlIGV4cG9ydEdsb2JhbCA9IHRydWU7XHJcbmlmKGV4cG9ydEdsb2JhbCB8fCBmcmFtZXdvcmspe1xyXG4gIGNvcmUubm9Db25mbGljdCA9IGZ1bmN0aW9uKCl7XHJcbiAgICBnbG9iYWwuY29yZSA9IG9sZDtcclxuICAgIHJldHVybiBjb3JlO1xyXG4gIH1cclxuICBnbG9iYWwuY29yZSA9IGNvcmU7XHJcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogY29tbW9uLml0ZXJhdG9ycyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuU1lNQk9MX0lURVJBVE9SID0gZ2V0V2VsbEtub3duU3ltYm9sKElURVJBVE9SKTtcclxudmFyIElURVIgID0gc2FmZVN5bWJvbCgnaXRlcicpXHJcbiAgLCBLRVkgICA9IDFcclxuICAsIFZBTFVFID0gMlxyXG4gICwgSXRlcmF0b3JzID0ge31cclxuICAsIEl0ZXJhdG9yUHJvdG90eXBlID0ge31cclxuICAgIC8vIFNhZmFyaSBoYXMgYnlnZ3kgaXRlcmF0b3JzIHcvbyBgbmV4dGBcclxuICAsIEJVR0dZX0lURVJBVE9SUyA9ICdrZXlzJyBpbiBBcnJheVByb3RvICYmICEoJ25leHQnIGluIFtdLmtleXMoKSk7XHJcbi8vIDI1LjEuMi4xLjEgJUl0ZXJhdG9yUHJvdG90eXBlJVtAQGl0ZXJhdG9yXSgpXHJcbnNldEl0ZXJhdG9yKEl0ZXJhdG9yUHJvdG90eXBlLCByZXR1cm5UaGlzKTtcclxuZnVuY3Rpb24gc2V0SXRlcmF0b3IoTywgdmFsdWUpe1xyXG4gIGhpZGRlbihPLCBTWU1CT0xfSVRFUkFUT1IsIHZhbHVlKTtcclxuICAvLyBBZGQgaXRlcmF0b3IgZm9yIEZGIGl0ZXJhdG9yIHByb3RvY29sXHJcbiAgRkZfSVRFUkFUT1IgaW4gQXJyYXlQcm90byAmJiBoaWRkZW4oTywgRkZfSVRFUkFUT1IsIHZhbHVlKTtcclxufVxyXG5mdW5jdGlvbiBjcmVhdGVJdGVyYXRvcihDb25zdHJ1Y3RvciwgTkFNRSwgbmV4dCwgcHJvdG8pe1xyXG4gIENvbnN0cnVjdG9yW1BST1RPVFlQRV0gPSBjcmVhdGUocHJvdG8gfHwgSXRlcmF0b3JQcm90b3R5cGUsIHtuZXh0OiBkZXNjcmlwdG9yKDEsIG5leHQpfSk7XHJcbiAgc2V0VG9TdHJpbmdUYWcoQ29uc3RydWN0b3IsIE5BTUUgKyAnIEl0ZXJhdG9yJyk7XHJcbn1cclxuZnVuY3Rpb24gZGVmaW5lSXRlcmF0b3IoQ29uc3RydWN0b3IsIE5BTUUsIHZhbHVlLCBERUZBVUxUKXtcclxuICB2YXIgcHJvdG8gPSBDb25zdHJ1Y3RvcltQUk9UT1RZUEVdXHJcbiAgICAsIGl0ZXIgID0gZ2V0KHByb3RvLCBTWU1CT0xfSVRFUkFUT1IpIHx8IGdldChwcm90bywgRkZfSVRFUkFUT1IpIHx8IChERUZBVUxUICYmIGdldChwcm90bywgREVGQVVMVCkpIHx8IHZhbHVlO1xyXG4gIGlmKGZyYW1ld29yayl7XHJcbiAgICAvLyBEZWZpbmUgaXRlcmF0b3JcclxuICAgIHNldEl0ZXJhdG9yKHByb3RvLCBpdGVyKTtcclxuICAgIGlmKGl0ZXIgIT09IHZhbHVlKXtcclxuICAgICAgdmFyIGl0ZXJQcm90byA9IGdldFByb3RvdHlwZU9mKGl0ZXIuY2FsbChuZXcgQ29uc3RydWN0b3IpKTtcclxuICAgICAgLy8gU2V0IEBAdG9TdHJpbmdUYWcgdG8gbmF0aXZlIGl0ZXJhdG9yc1xyXG4gICAgICBzZXRUb1N0cmluZ1RhZyhpdGVyUHJvdG8sIE5BTUUgKyAnIEl0ZXJhdG9yJywgdHJ1ZSk7XHJcbiAgICAgIC8vIEZGIGZpeFxyXG4gICAgICBoYXMocHJvdG8sIEZGX0lURVJBVE9SKSAmJiBzZXRJdGVyYXRvcihpdGVyUHJvdG8sIHJldHVyblRoaXMpO1xyXG4gICAgfVxyXG4gIH1cclxuICAvLyBQbHVnIGZvciBsaWJyYXJ5XHJcbiAgSXRlcmF0b3JzW05BTUVdID0gaXRlcjtcclxuICAvLyBGRiAmIHY4IGZpeFxyXG4gIEl0ZXJhdG9yc1tOQU1FICsgJyBJdGVyYXRvciddID0gcmV0dXJuVGhpcztcclxuICByZXR1cm4gaXRlcjtcclxufVxyXG5mdW5jdGlvbiBkZWZpbmVTdGRJdGVyYXRvcnMoQmFzZSwgTkFNRSwgQ29uc3RydWN0b3IsIG5leHQsIERFRkFVTFQsIElTX1NFVCl7XHJcbiAgZnVuY3Rpb24gY3JlYXRlSXRlcihraW5kKXtcclxuICAgIHJldHVybiBmdW5jdGlvbigpe1xyXG4gICAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKHRoaXMsIGtpbmQpO1xyXG4gICAgfVxyXG4gIH1cclxuICBjcmVhdGVJdGVyYXRvcihDb25zdHJ1Y3RvciwgTkFNRSwgbmV4dCk7XHJcbiAgdmFyIGVudHJpZXMgPSBjcmVhdGVJdGVyKEtFWStWQUxVRSlcclxuICAgICwgdmFsdWVzICA9IGNyZWF0ZUl0ZXIoVkFMVUUpO1xyXG4gIGlmKERFRkFVTFQgPT0gVkFMVUUpdmFsdWVzID0gZGVmaW5lSXRlcmF0b3IoQmFzZSwgTkFNRSwgdmFsdWVzLCAndmFsdWVzJyk7XHJcbiAgZWxzZSBlbnRyaWVzID0gZGVmaW5lSXRlcmF0b3IoQmFzZSwgTkFNRSwgZW50cmllcywgJ2VudHJpZXMnKTtcclxuICBpZihERUZBVUxUKXtcclxuICAgICRkZWZpbmUoUFJPVE8gKyBGT1JDRUQgKiBCVUdHWV9JVEVSQVRPUlMsIE5BTUUsIHtcclxuICAgICAgZW50cmllczogZW50cmllcyxcclxuICAgICAga2V5czogSVNfU0VUID8gdmFsdWVzIDogY3JlYXRlSXRlcihLRVkpLFxyXG4gICAgICB2YWx1ZXM6IHZhbHVlc1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbmZ1bmN0aW9uIGl0ZXJSZXN1bHQoZG9uZSwgdmFsdWUpe1xyXG4gIHJldHVybiB7dmFsdWU6IHZhbHVlLCBkb25lOiAhIWRvbmV9O1xyXG59XHJcbmZ1bmN0aW9uIGlzSXRlcmFibGUoaXQpe1xyXG4gIHZhciBPICAgICAgPSBPYmplY3QoaXQpXHJcbiAgICAsIFN5bWJvbCA9IGdsb2JhbFtTWU1CT0xdXHJcbiAgICAsIGhhc0V4dCA9IChTeW1ib2wgJiYgU3ltYm9sW0lURVJBVE9SXSB8fCBGRl9JVEVSQVRPUikgaW4gTztcclxuICByZXR1cm4gaGFzRXh0IHx8IFNZTUJPTF9JVEVSQVRPUiBpbiBPIHx8IGhhcyhJdGVyYXRvcnMsIGNsYXNzb2YoTykpO1xyXG59XHJcbmZ1bmN0aW9uIGdldEl0ZXJhdG9yKGl0KXtcclxuICB2YXIgU3ltYm9sICA9IGdsb2JhbFtTWU1CT0xdXHJcbiAgICAsIGV4dCAgICAgPSBpdFtTeW1ib2wgJiYgU3ltYm9sW0lURVJBVE9SXSB8fCBGRl9JVEVSQVRPUl1cclxuICAgICwgZ2V0SXRlciA9IGV4dCB8fCBpdFtTWU1CT0xfSVRFUkFUT1JdIHx8IEl0ZXJhdG9yc1tjbGFzc29mKGl0KV07XHJcbiAgcmV0dXJuIGFzc2VydE9iamVjdChnZXRJdGVyLmNhbGwoaXQpKTtcclxufVxyXG5mdW5jdGlvbiBzdGVwQ2FsbChmbiwgdmFsdWUsIGVudHJpZXMpe1xyXG4gIHJldHVybiBlbnRyaWVzID8gaW52b2tlKGZuLCB2YWx1ZSkgOiBmbih2YWx1ZSk7XHJcbn1cclxuZnVuY3Rpb24gY2hlY2tEYW5nZXJJdGVyQ2xvc2luZyhmbil7XHJcbiAgdmFyIGRhbmdlciA9IHRydWU7XHJcbiAgdmFyIE8gPSB7XHJcbiAgICBuZXh0OiBmdW5jdGlvbigpeyB0aHJvdyAxIH0sXHJcbiAgICAncmV0dXJuJzogZnVuY3Rpb24oKXsgZGFuZ2VyID0gZmFsc2UgfVxyXG4gIH07XHJcbiAgT1tTWU1CT0xfSVRFUkFUT1JdID0gcmV0dXJuVGhpcztcclxuICB0cnkge1xyXG4gICAgZm4oTyk7XHJcbiAgfSBjYXRjaChlKXt9XHJcbiAgcmV0dXJuIGRhbmdlcjtcclxufVxyXG5mdW5jdGlvbiBjbG9zZUl0ZXJhdG9yKGl0ZXJhdG9yKXtcclxuICB2YXIgcmV0ID0gaXRlcmF0b3JbJ3JldHVybiddO1xyXG4gIGlmKHJldCAhPT0gdW5kZWZpbmVkKXJldC5jYWxsKGl0ZXJhdG9yKTtcclxufVxyXG5mdW5jdGlvbiBzYWZlSXRlckNsb3NlKGV4ZWMsIGl0ZXJhdG9yKXtcclxuICB0cnkge1xyXG4gICAgZXhlYyhpdGVyYXRvcik7XHJcbiAgfSBjYXRjaChlKXtcclxuICAgIGNsb3NlSXRlcmF0b3IoaXRlcmF0b3IpO1xyXG4gICAgdGhyb3cgZTtcclxuICB9XHJcbn1cclxuZnVuY3Rpb24gZm9yT2YoaXRlcmFibGUsIGVudHJpZXMsIGZuLCB0aGF0KXtcclxuICBzYWZlSXRlckNsb3NlKGZ1bmN0aW9uKGl0ZXJhdG9yKXtcclxuICAgIHZhciBmID0gY3R4KGZuLCB0aGF0LCBlbnRyaWVzID8gMiA6IDEpXHJcbiAgICAgICwgc3RlcDtcclxuICAgIHdoaWxlKCEoc3RlcCA9IGl0ZXJhdG9yLm5leHQoKSkuZG9uZSlpZihzdGVwQ2FsbChmLCBzdGVwLnZhbHVlLCBlbnRyaWVzKSA9PT0gZmFsc2Upe1xyXG4gICAgICByZXR1cm4gY2xvc2VJdGVyYXRvcihpdGVyYXRvcik7XHJcbiAgICB9XHJcbiAgfSwgZ2V0SXRlcmF0b3IoaXRlcmFibGUpKTtcclxufVxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBlczYuc3ltYm9sICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBFQ01BU2NyaXB0IDYgc3ltYm9scyBzaGltXHJcbiFmdW5jdGlvbihUQUcsIFN5bWJvbFJlZ2lzdHJ5LCBBbGxTeW1ib2xzLCBzZXR0ZXIpe1xyXG4gIC8vIDE5LjQuMS4xIFN5bWJvbChbZGVzY3JpcHRpb25dKVxyXG4gIGlmKCFpc05hdGl2ZShTeW1ib2wpKXtcclxuICAgIFN5bWJvbCA9IGZ1bmN0aW9uKGRlc2NyaXB0aW9uKXtcclxuICAgICAgYXNzZXJ0KCEodGhpcyBpbnN0YW5jZW9mIFN5bWJvbCksIFNZTUJPTCArICcgaXMgbm90IGEgJyArIENPTlNUUlVDVE9SKTtcclxuICAgICAgdmFyIHRhZyA9IHVpZChkZXNjcmlwdGlvbilcclxuICAgICAgICAsIHN5bSA9IHNldChjcmVhdGUoU3ltYm9sW1BST1RPVFlQRV0pLCBUQUcsIHRhZyk7XHJcbiAgICAgIEFsbFN5bWJvbHNbdGFnXSA9IHN5bTtcclxuICAgICAgREVTQyAmJiBzZXR0ZXIgJiYgZGVmaW5lUHJvcGVydHkoT2JqZWN0UHJvdG8sIHRhZywge1xyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcclxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKXtcclxuICAgICAgICAgIGhpZGRlbih0aGlzLCB0YWcsIHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gc3ltO1xyXG4gICAgfVxyXG4gICAgaGlkZGVuKFN5bWJvbFtQUk9UT1RZUEVdLCBUT19TVFJJTkcsIGZ1bmN0aW9uKCl7XHJcbiAgICAgIHJldHVybiB0aGlzW1RBR107XHJcbiAgICB9KTtcclxuICB9XHJcbiAgJGRlZmluZShHTE9CQUwgKyBXUkFQLCB7U3ltYm9sOiBTeW1ib2x9KTtcclxuICBcclxuICB2YXIgc3ltYm9sU3RhdGljcyA9IHtcclxuICAgIC8vIDE5LjQuMi4xIFN5bWJvbC5mb3Ioa2V5KVxyXG4gICAgJ2Zvcic6IGZ1bmN0aW9uKGtleSl7XHJcbiAgICAgIHJldHVybiBoYXMoU3ltYm9sUmVnaXN0cnksIGtleSArPSAnJylcclxuICAgICAgICA/IFN5bWJvbFJlZ2lzdHJ5W2tleV1cclxuICAgICAgICA6IFN5bWJvbFJlZ2lzdHJ5W2tleV0gPSBTeW1ib2woa2V5KTtcclxuICAgIH0sXHJcbiAgICAvLyAxOS40LjIuNCBTeW1ib2wuaXRlcmF0b3JcclxuICAgIGl0ZXJhdG9yOiBTWU1CT0xfSVRFUkFUT1IgfHwgZ2V0V2VsbEtub3duU3ltYm9sKElURVJBVE9SKSxcclxuICAgIC8vIDE5LjQuMi41IFN5bWJvbC5rZXlGb3Ioc3ltKVxyXG4gICAga2V5Rm9yOiBwYXJ0LmNhbGwoa2V5T2YsIFN5bWJvbFJlZ2lzdHJ5KSxcclxuICAgIC8vIDE5LjQuMi4xMCBTeW1ib2wuc3BlY2llc1xyXG4gICAgc3BlY2llczogU1lNQk9MX1NQRUNJRVMsXHJcbiAgICAvLyAxOS40LjIuMTMgU3ltYm9sLnRvU3RyaW5nVGFnXHJcbiAgICB0b1N0cmluZ1RhZzogU1lNQk9MX1RBRyA9IGdldFdlbGxLbm93blN5bWJvbChUT19TVFJJTkdfVEFHLCB0cnVlKSxcclxuICAgIC8vIDE5LjQuMi4xNCBTeW1ib2wudW5zY29wYWJsZXNcclxuICAgIHVuc2NvcGFibGVzOiBTWU1CT0xfVU5TQ09QQUJMRVMsXHJcbiAgICBwdXJlOiBzYWZlU3ltYm9sLFxyXG4gICAgc2V0OiBzZXQsXHJcbiAgICB1c2VTZXR0ZXI6IGZ1bmN0aW9uKCl7c2V0dGVyID0gdHJ1ZX0sXHJcbiAgICB1c2VTaW1wbGU6IGZ1bmN0aW9uKCl7c2V0dGVyID0gZmFsc2V9XHJcbiAgfTtcclxuICAvLyAxOS40LjIuMiBTeW1ib2wuaGFzSW5zdGFuY2VcclxuICAvLyAxOS40LjIuMyBTeW1ib2wuaXNDb25jYXRTcHJlYWRhYmxlXHJcbiAgLy8gMTkuNC4yLjYgU3ltYm9sLm1hdGNoXHJcbiAgLy8gMTkuNC4yLjggU3ltYm9sLnJlcGxhY2VcclxuICAvLyAxOS40LjIuOSBTeW1ib2wuc2VhcmNoXHJcbiAgLy8gMTkuNC4yLjExIFN5bWJvbC5zcGxpdFxyXG4gIC8vIDE5LjQuMi4xMiBTeW1ib2wudG9QcmltaXRpdmVcclxuICBmb3JFYWNoLmNhbGwoYXJyYXkoJ2hhc0luc3RhbmNlLGlzQ29uY2F0U3ByZWFkYWJsZSxtYXRjaCxyZXBsYWNlLHNlYXJjaCxzcGxpdCx0b1ByaW1pdGl2ZScpLFxyXG4gICAgZnVuY3Rpb24oaXQpe1xyXG4gICAgICBzeW1ib2xTdGF0aWNzW2l0XSA9IGdldFdlbGxLbm93blN5bWJvbChpdCk7XHJcbiAgICB9XHJcbiAgKTtcclxuICAkZGVmaW5lKFNUQVRJQywgU1lNQk9MLCBzeW1ib2xTdGF0aWNzKTtcclxuICBcclxuICBzZXRUb1N0cmluZ1RhZyhTeW1ib2wsIFNZTUJPTCk7XHJcbiAgXHJcbiAgJGRlZmluZShTVEFUSUMgKyBGT1JDRUQgKiAhaXNOYXRpdmUoU3ltYm9sKSwgT0JKRUNULCB7XHJcbiAgICAvLyAxOS4xLjIuNyBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhPKVxyXG4gICAgZ2V0T3duUHJvcGVydHlOYW1lczogZnVuY3Rpb24oaXQpe1xyXG4gICAgICB2YXIgbmFtZXMgPSBnZXROYW1lcyh0b09iamVjdChpdCkpLCByZXN1bHQgPSBbXSwga2V5LCBpID0gMDtcclxuICAgICAgd2hpbGUobmFtZXMubGVuZ3RoID4gaSloYXMoQWxsU3ltYm9scywga2V5ID0gbmFtZXNbaSsrXSkgfHwgcmVzdWx0LnB1c2goa2V5KTtcclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH0sXHJcbiAgICAvLyAxOS4xLjIuOCBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKE8pXHJcbiAgICBnZXRPd25Qcm9wZXJ0eVN5bWJvbHM6IGZ1bmN0aW9uKGl0KXtcclxuICAgICAgdmFyIG5hbWVzID0gZ2V0TmFtZXModG9PYmplY3QoaXQpKSwgcmVzdWx0ID0gW10sIGtleSwgaSA9IDA7XHJcbiAgICAgIHdoaWxlKG5hbWVzLmxlbmd0aCA+IGkpaGFzKEFsbFN5bWJvbHMsIGtleSA9IG5hbWVzW2krK10pICYmIHJlc3VsdC5wdXNoKEFsbFN5bWJvbHNba2V5XSk7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbiAgfSk7XHJcbiAgXHJcbiAgLy8gMjAuMi4xLjkgTWF0aFtAQHRvU3RyaW5nVGFnXVxyXG4gIHNldFRvU3RyaW5nVGFnKE1hdGgsIE1BVEgsIHRydWUpO1xyXG4gIC8vIDI0LjMuMyBKU09OW0BAdG9TdHJpbmdUYWddXHJcbiAgc2V0VG9TdHJpbmdUYWcoZ2xvYmFsLkpTT04sICdKU09OJywgdHJ1ZSk7XHJcbn0oc2FmZVN5bWJvbCgndGFnJyksIHt9LCB7fSwgdHJ1ZSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGVzNi5vYmplY3Quc3RhdGljcyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbigpe1xyXG4gIHZhciBvYmplY3RTdGF0aWMgPSB7XHJcbiAgICAvLyAxOS4xLjMuMSBPYmplY3QuYXNzaWduKHRhcmdldCwgc291cmNlKVxyXG4gICAgYXNzaWduOiBhc3NpZ24sXHJcbiAgICAvLyAxOS4xLjMuMTAgT2JqZWN0LmlzKHZhbHVlMSwgdmFsdWUyKVxyXG4gICAgaXM6IGZ1bmN0aW9uKHgsIHkpe1xyXG4gICAgICByZXR1cm4geCA9PT0geSA/IHggIT09IDAgfHwgMSAvIHggPT09IDEgLyB5IDogeCAhPSB4ICYmIHkgIT0geTtcclxuICAgIH1cclxuICB9O1xyXG4gIC8vIDE5LjEuMy4xOSBPYmplY3Quc2V0UHJvdG90eXBlT2YoTywgcHJvdG8pXHJcbiAgLy8gV29ya3Mgd2l0aCBfX3Byb3RvX18gb25seS4gT2xkIHY4IGNhbid0IHdvcmtzIHdpdGggbnVsbCBwcm90byBvYmplY3RzLlxyXG4gICdfX3Byb3RvX18nIGluIE9iamVjdFByb3RvICYmIGZ1bmN0aW9uKGJ1Z2d5LCBzZXQpe1xyXG4gICAgdHJ5IHtcclxuICAgICAgc2V0ID0gY3R4KGNhbGwsIGdldE93bkRlc2NyaXB0b3IoT2JqZWN0UHJvdG8sICdfX3Byb3RvX18nKS5zZXQsIDIpO1xyXG4gICAgICBzZXQoe30sIEFycmF5UHJvdG8pO1xyXG4gICAgfSBjYXRjaChlKXsgYnVnZ3kgPSB0cnVlIH1cclxuICAgIG9iamVjdFN0YXRpYy5zZXRQcm90b3R5cGVPZiA9IHNldFByb3RvdHlwZU9mID0gc2V0UHJvdG90eXBlT2YgfHwgZnVuY3Rpb24oTywgcHJvdG8pe1xyXG4gICAgICBhc3NlcnRPYmplY3QoTyk7XHJcbiAgICAgIGFzc2VydChwcm90byA9PT0gbnVsbCB8fCBpc09iamVjdChwcm90byksIHByb3RvLCBcIjogY2FuJ3Qgc2V0IGFzIHByb3RvdHlwZSFcIik7XHJcbiAgICAgIGlmKGJ1Z2d5KU8uX19wcm90b19fID0gcHJvdG87XHJcbiAgICAgIGVsc2Ugc2V0KE8sIHByb3RvKTtcclxuICAgICAgcmV0dXJuIE87XHJcbiAgICB9XHJcbiAgfSgpO1xyXG4gICRkZWZpbmUoU1RBVElDLCBPQkpFQ1QsIG9iamVjdFN0YXRpYyk7XHJcbn0oKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogZXM2Lm9iamVjdC5zdGF0aWNzLWFjY2VwdC1wcmltaXRpdmVzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuIWZ1bmN0aW9uKCl7XHJcbiAgLy8gT2JqZWN0IHN0YXRpYyBtZXRob2RzIGFjY2VwdCBwcmltaXRpdmVzXHJcbiAgZnVuY3Rpb24gd3JhcE9iamVjdE1ldGhvZChrZXksIE1PREUpe1xyXG4gICAgdmFyIGZuICA9IE9iamVjdFtrZXldXHJcbiAgICAgICwgZXhwID0gY29yZVtPQkpFQ1RdW2tleV1cclxuICAgICAgLCBmICAgPSAwXHJcbiAgICAgICwgbyAgID0ge307XHJcbiAgICBpZighZXhwIHx8IGlzTmF0aXZlKGV4cCkpe1xyXG4gICAgICBvW2tleV0gPSBNT0RFID09IDEgPyBmdW5jdGlvbihpdCl7XHJcbiAgICAgICAgcmV0dXJuIGlzT2JqZWN0KGl0KSA/IGZuKGl0KSA6IGl0O1xyXG4gICAgICB9IDogTU9ERSA9PSAyID8gZnVuY3Rpb24oaXQpe1xyXG4gICAgICAgIHJldHVybiBpc09iamVjdChpdCkgPyBmbihpdCkgOiB0cnVlO1xyXG4gICAgICB9IDogTU9ERSA9PSAzID8gZnVuY3Rpb24oaXQpe1xyXG4gICAgICAgIHJldHVybiBpc09iamVjdChpdCkgPyBmbihpdCkgOiBmYWxzZTtcclxuICAgICAgfSA6IE1PREUgPT0gNCA/IGZ1bmN0aW9uKGl0LCBrZXkpe1xyXG4gICAgICAgIHJldHVybiBmbih0b09iamVjdChpdCksIGtleSk7XHJcbiAgICAgIH0gOiBmdW5jdGlvbihpdCl7XHJcbiAgICAgICAgcmV0dXJuIGZuKHRvT2JqZWN0KGl0KSk7XHJcbiAgICAgIH07XHJcbiAgICAgIHRyeSB7IGZuKERPVCkgfVxyXG4gICAgICBjYXRjaChlKXsgZiA9IDEgfVxyXG4gICAgICAkZGVmaW5lKFNUQVRJQyArIEZPUkNFRCAqIGYsIE9CSkVDVCwgbyk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHdyYXBPYmplY3RNZXRob2QoJ2ZyZWV6ZScsIDEpO1xyXG4gIHdyYXBPYmplY3RNZXRob2QoJ3NlYWwnLCAxKTtcclxuICB3cmFwT2JqZWN0TWV0aG9kKCdwcmV2ZW50RXh0ZW5zaW9ucycsIDEpO1xyXG4gIHdyYXBPYmplY3RNZXRob2QoJ2lzRnJvemVuJywgMik7XHJcbiAgd3JhcE9iamVjdE1ldGhvZCgnaXNTZWFsZWQnLCAyKTtcclxuICB3cmFwT2JqZWN0TWV0aG9kKCdpc0V4dGVuc2libGUnLCAzKTtcclxuICB3cmFwT2JqZWN0TWV0aG9kKCdnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3InLCA0KTtcclxuICB3cmFwT2JqZWN0TWV0aG9kKCdnZXRQcm90b3R5cGVPZicpO1xyXG4gIHdyYXBPYmplY3RNZXRob2QoJ2tleXMnKTtcclxuICB3cmFwT2JqZWN0TWV0aG9kKCdnZXRPd25Qcm9wZXJ0eU5hbWVzJyk7XHJcbn0oKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogZXM2Lm51bWJlci5zdGF0aWNzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuIWZ1bmN0aW9uKGlzSW50ZWdlcil7XHJcbiAgJGRlZmluZShTVEFUSUMsIE5VTUJFUiwge1xyXG4gICAgLy8gMjAuMS4yLjEgTnVtYmVyLkVQU0lMT05cclxuICAgIEVQU0lMT046IHBvdygyLCAtNTIpLFxyXG4gICAgLy8gMjAuMS4yLjIgTnVtYmVyLmlzRmluaXRlKG51bWJlcilcclxuICAgIGlzRmluaXRlOiBmdW5jdGlvbihpdCl7XHJcbiAgICAgIHJldHVybiB0eXBlb2YgaXQgPT0gJ251bWJlcicgJiYgaXNGaW5pdGUoaXQpO1xyXG4gICAgfSxcclxuICAgIC8vIDIwLjEuMi4zIE51bWJlci5pc0ludGVnZXIobnVtYmVyKVxyXG4gICAgaXNJbnRlZ2VyOiBpc0ludGVnZXIsXHJcbiAgICAvLyAyMC4xLjIuNCBOdW1iZXIuaXNOYU4obnVtYmVyKVxyXG4gICAgaXNOYU46IHNhbWVOYU4sXHJcbiAgICAvLyAyMC4xLjIuNSBOdW1iZXIuaXNTYWZlSW50ZWdlcihudW1iZXIpXHJcbiAgICBpc1NhZmVJbnRlZ2VyOiBmdW5jdGlvbihudW1iZXIpe1xyXG4gICAgICByZXR1cm4gaXNJbnRlZ2VyKG51bWJlcikgJiYgYWJzKG51bWJlcikgPD0gTUFYX1NBRkVfSU5URUdFUjtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4xLjIuNiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUlxyXG4gICAgTUFYX1NBRkVfSU5URUdFUjogTUFYX1NBRkVfSU5URUdFUixcclxuICAgIC8vIDIwLjEuMi4xMCBOdW1iZXIuTUlOX1NBRkVfSU5URUdFUlxyXG4gICAgTUlOX1NBRkVfSU5URUdFUjogLU1BWF9TQUZFX0lOVEVHRVIsXHJcbiAgICAvLyAyMC4xLjIuMTIgTnVtYmVyLnBhcnNlRmxvYXQoc3RyaW5nKVxyXG4gICAgcGFyc2VGbG9hdDogcGFyc2VGbG9hdCxcclxuICAgIC8vIDIwLjEuMi4xMyBOdW1iZXIucGFyc2VJbnQoc3RyaW5nLCByYWRpeClcclxuICAgIHBhcnNlSW50OiBwYXJzZUludFxyXG4gIH0pO1xyXG4vLyAyMC4xLjIuMyBOdW1iZXIuaXNJbnRlZ2VyKG51bWJlcilcclxufShOdW1iZXIuaXNJbnRlZ2VyIHx8IGZ1bmN0aW9uKGl0KXtcclxuICByZXR1cm4gIWlzT2JqZWN0KGl0KSAmJiBpc0Zpbml0ZShpdCkgJiYgZmxvb3IoaXQpID09PSBpdDtcclxufSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGVzNi5tYXRoICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8vIEVDTUFTY3JpcHQgNiBzaGltXHJcbiFmdW5jdGlvbigpe1xyXG4gIC8vIDIwLjIuMi4yOCBNYXRoLnNpZ24oeClcclxuICB2YXIgRSAgICA9IE1hdGguRVxyXG4gICAgLCBleHAgID0gTWF0aC5leHBcclxuICAgICwgbG9nICA9IE1hdGgubG9nXHJcbiAgICAsIHNxcnQgPSBNYXRoLnNxcnRcclxuICAgICwgc2lnbiA9IE1hdGguc2lnbiB8fCBmdW5jdGlvbih4KXtcclxuICAgICAgICByZXR1cm4gKHggPSAreCkgPT0gMCB8fCB4ICE9IHggPyB4IDogeCA8IDAgPyAtMSA6IDE7XHJcbiAgICAgIH07XHJcbiAgXHJcbiAgLy8gMjAuMi4yLjUgTWF0aC5hc2luaCh4KVxyXG4gIGZ1bmN0aW9uIGFzaW5oKHgpe1xyXG4gICAgcmV0dXJuICFpc0Zpbml0ZSh4ID0gK3gpIHx8IHggPT0gMCA/IHggOiB4IDwgMCA/IC1hc2luaCgteCkgOiBsb2coeCArIHNxcnQoeCAqIHggKyAxKSk7XHJcbiAgfVxyXG4gIC8vIDIwLjIuMi4xNCBNYXRoLmV4cG0xKHgpXHJcbiAgZnVuY3Rpb24gZXhwbTEoeCl7XHJcbiAgICByZXR1cm4gKHggPSAreCkgPT0gMCA/IHggOiB4ID4gLTFlLTYgJiYgeCA8IDFlLTYgPyB4ICsgeCAqIHggLyAyIDogZXhwKHgpIC0gMTtcclxuICB9XHJcbiAgICBcclxuICAkZGVmaW5lKFNUQVRJQywgTUFUSCwge1xyXG4gICAgLy8gMjAuMi4yLjMgTWF0aC5hY29zaCh4KVxyXG4gICAgYWNvc2g6IGZ1bmN0aW9uKHgpe1xyXG4gICAgICByZXR1cm4gKHggPSAreCkgPCAxID8gTmFOIDogaXNGaW5pdGUoeCkgPyBsb2coeCAvIEUgKyBzcXJ0KHggKyAxKSAqIHNxcnQoeCAtIDEpIC8gRSkgKyAxIDogeDtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4yLjIuNSBNYXRoLmFzaW5oKHgpXHJcbiAgICBhc2luaDogYXNpbmgsXHJcbiAgICAvLyAyMC4yLjIuNyBNYXRoLmF0YW5oKHgpXHJcbiAgICBhdGFuaDogZnVuY3Rpb24oeCl7XHJcbiAgICAgIHJldHVybiAoeCA9ICt4KSA9PSAwID8geCA6IGxvZygoMSArIHgpIC8gKDEgLSB4KSkgLyAyO1xyXG4gICAgfSxcclxuICAgIC8vIDIwLjIuMi45IE1hdGguY2JydCh4KVxyXG4gICAgY2JydDogZnVuY3Rpb24oeCl7XHJcbiAgICAgIHJldHVybiBzaWduKHggPSAreCkgKiBwb3coYWJzKHgpLCAxIC8gMyk7XHJcbiAgICB9LFxyXG4gICAgLy8gMjAuMi4yLjExIE1hdGguY2x6MzIoeClcclxuICAgIGNsejMyOiBmdW5jdGlvbih4KXtcclxuICAgICAgcmV0dXJuICh4ID4+Pj0gMCkgPyAzMiAtIHhbVE9fU1RSSU5HXSgyKS5sZW5ndGggOiAzMjtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4yLjIuMTIgTWF0aC5jb3NoKHgpXHJcbiAgICBjb3NoOiBmdW5jdGlvbih4KXtcclxuICAgICAgcmV0dXJuIChleHAoeCA9ICt4KSArIGV4cCgteCkpIC8gMjtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4yLjIuMTQgTWF0aC5leHBtMSh4KVxyXG4gICAgZXhwbTE6IGV4cG0xLFxyXG4gICAgLy8gMjAuMi4yLjE2IE1hdGguZnJvdW5kKHgpXHJcbiAgICAvLyBUT0RPOiBmYWxsYmFjayBmb3IgSUU5LVxyXG4gICAgZnJvdW5kOiBmdW5jdGlvbih4KXtcclxuICAgICAgcmV0dXJuIG5ldyBGbG9hdDMyQXJyYXkoW3hdKVswXTtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4yLjIuMTcgTWF0aC5oeXBvdChbdmFsdWUxWywgdmFsdWUyWywg4oCmIF1dXSlcclxuICAgIGh5cG90OiBmdW5jdGlvbih2YWx1ZTEsIHZhbHVlMil7XHJcbiAgICAgIHZhciBzdW0gID0gMFxyXG4gICAgICAgICwgbGVuMSA9IGFyZ3VtZW50cy5sZW5ndGhcclxuICAgICAgICAsIGxlbjIgPSBsZW4xXHJcbiAgICAgICAgLCBhcmdzID0gQXJyYXkobGVuMSlcclxuICAgICAgICAsIGxhcmcgPSAtSW5maW5pdHlcclxuICAgICAgICAsIGFyZztcclxuICAgICAgd2hpbGUobGVuMS0tKXtcclxuICAgICAgICBhcmcgPSBhcmdzW2xlbjFdID0gK2FyZ3VtZW50c1tsZW4xXTtcclxuICAgICAgICBpZihhcmcgPT0gSW5maW5pdHkgfHwgYXJnID09IC1JbmZpbml0eSlyZXR1cm4gSW5maW5pdHk7XHJcbiAgICAgICAgaWYoYXJnID4gbGFyZylsYXJnID0gYXJnO1xyXG4gICAgICB9XHJcbiAgICAgIGxhcmcgPSBhcmcgfHwgMTtcclxuICAgICAgd2hpbGUobGVuMi0tKXN1bSArPSBwb3coYXJnc1tsZW4yXSAvIGxhcmcsIDIpO1xyXG4gICAgICByZXR1cm4gbGFyZyAqIHNxcnQoc3VtKTtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4yLjIuMTggTWF0aC5pbXVsKHgsIHkpXHJcbiAgICBpbXVsOiBmdW5jdGlvbih4LCB5KXtcclxuICAgICAgdmFyIFVJbnQxNiA9IDB4ZmZmZlxyXG4gICAgICAgICwgeG4gPSAreFxyXG4gICAgICAgICwgeW4gPSAreVxyXG4gICAgICAgICwgeGwgPSBVSW50MTYgJiB4blxyXG4gICAgICAgICwgeWwgPSBVSW50MTYgJiB5bjtcclxuICAgICAgcmV0dXJuIDAgfCB4bCAqIHlsICsgKChVSW50MTYgJiB4biA+Pj4gMTYpICogeWwgKyB4bCAqIChVSW50MTYgJiB5biA+Pj4gMTYpIDw8IDE2ID4+PiAwKTtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4yLjIuMjAgTWF0aC5sb2cxcCh4KVxyXG4gICAgbG9nMXA6IGZ1bmN0aW9uKHgpe1xyXG4gICAgICByZXR1cm4gKHggPSAreCkgPiAtMWUtOCAmJiB4IDwgMWUtOCA/IHggLSB4ICogeCAvIDIgOiBsb2coMSArIHgpO1xyXG4gICAgfSxcclxuICAgIC8vIDIwLjIuMi4yMSBNYXRoLmxvZzEwKHgpXHJcbiAgICBsb2cxMDogZnVuY3Rpb24oeCl7XHJcbiAgICAgIHJldHVybiBsb2coeCkgLyBNYXRoLkxOMTA7XHJcbiAgICB9LFxyXG4gICAgLy8gMjAuMi4yLjIyIE1hdGgubG9nMih4KVxyXG4gICAgbG9nMjogZnVuY3Rpb24oeCl7XHJcbiAgICAgIHJldHVybiBsb2coeCkgLyBNYXRoLkxOMjtcclxuICAgIH0sXHJcbiAgICAvLyAyMC4yLjIuMjggTWF0aC5zaWduKHgpXHJcbiAgICBzaWduOiBzaWduLFxyXG4gICAgLy8gMjAuMi4yLjMwIE1hdGguc2luaCh4KVxyXG4gICAgc2luaDogZnVuY3Rpb24oeCl7XHJcbiAgICAgIHJldHVybiAoYWJzKHggPSAreCkgPCAxKSA/IChleHBtMSh4KSAtIGV4cG0xKC14KSkgLyAyIDogKGV4cCh4IC0gMSkgLSBleHAoLXggLSAxKSkgKiAoRSAvIDIpO1xyXG4gICAgfSxcclxuICAgIC8vIDIwLjIuMi4zMyBNYXRoLnRhbmgoeClcclxuICAgIHRhbmg6IGZ1bmN0aW9uKHgpe1xyXG4gICAgICB2YXIgYSA9IGV4cG0xKHggPSAreClcclxuICAgICAgICAsIGIgPSBleHBtMSgteCk7XHJcbiAgICAgIHJldHVybiBhID09IEluZmluaXR5ID8gMSA6IGIgPT0gSW5maW5pdHkgPyAtMSA6IChhIC0gYikgLyAoZXhwKHgpICsgZXhwKC14KSk7XHJcbiAgICB9LFxyXG4gICAgLy8gMjAuMi4yLjM0IE1hdGgudHJ1bmMoeClcclxuICAgIHRydW5jOiB0cnVuY1xyXG4gIH0pO1xyXG59KCk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGVzNi5zdHJpbmcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbihmcm9tQ2hhckNvZGUpe1xyXG4gIGZ1bmN0aW9uIGFzc2VydE5vdFJlZ0V4cChpdCl7XHJcbiAgICBpZihjb2YoaXQpID09IFJFR0VYUCl0aHJvdyBUeXBlRXJyb3IoKTtcclxuICB9XHJcbiAgXHJcbiAgJGRlZmluZShTVEFUSUMsIFNUUklORywge1xyXG4gICAgLy8gMjEuMS4yLjIgU3RyaW5nLmZyb21Db2RlUG9pbnQoLi4uY29kZVBvaW50cylcclxuICAgIGZyb21Db2RlUG9pbnQ6IGZ1bmN0aW9uKHgpe1xyXG4gICAgICB2YXIgcmVzID0gW11cclxuICAgICAgICAsIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGhcclxuICAgICAgICAsIGkgICA9IDBcclxuICAgICAgICAsIGNvZGVcclxuICAgICAgd2hpbGUobGVuID4gaSl7XHJcbiAgICAgICAgY29kZSA9ICthcmd1bWVudHNbaSsrXTtcclxuICAgICAgICBpZih0b0luZGV4KGNvZGUsIDB4MTBmZmZmKSAhPT0gY29kZSl0aHJvdyBSYW5nZUVycm9yKGNvZGUgKyAnIGlzIG5vdCBhIHZhbGlkIGNvZGUgcG9pbnQnKTtcclxuICAgICAgICByZXMucHVzaChjb2RlIDwgMHgxMDAwMFxyXG4gICAgICAgICAgPyBmcm9tQ2hhckNvZGUoY29kZSlcclxuICAgICAgICAgIDogZnJvbUNoYXJDb2RlKCgoY29kZSAtPSAweDEwMDAwKSA+PiAxMCkgKyAweGQ4MDAsIGNvZGUgJSAweDQwMCArIDB4ZGMwMClcclxuICAgICAgICApO1xyXG4gICAgICB9IHJldHVybiByZXMuam9pbignJyk7XHJcbiAgICB9LFxyXG4gICAgLy8gMjEuMS4yLjQgU3RyaW5nLnJhdyhjYWxsU2l0ZSwgLi4uc3Vic3RpdHV0aW9ucylcclxuICAgIHJhdzogZnVuY3Rpb24oY2FsbFNpdGUpe1xyXG4gICAgICB2YXIgcmF3ID0gdG9PYmplY3QoY2FsbFNpdGUucmF3KVxyXG4gICAgICAgICwgbGVuID0gdG9MZW5ndGgocmF3Lmxlbmd0aClcclxuICAgICAgICAsIHNsbiA9IGFyZ3VtZW50cy5sZW5ndGhcclxuICAgICAgICAsIHJlcyA9IFtdXHJcbiAgICAgICAgLCBpICAgPSAwO1xyXG4gICAgICB3aGlsZShsZW4gPiBpKXtcclxuICAgICAgICByZXMucHVzaChTdHJpbmcocmF3W2krK10pKTtcclxuICAgICAgICBpZihpIDwgc2xuKXJlcy5wdXNoKFN0cmluZyhhcmd1bWVudHNbaV0pKTtcclxuICAgICAgfSByZXR1cm4gcmVzLmpvaW4oJycpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG4gIFxyXG4gICRkZWZpbmUoUFJPVE8sIFNUUklORywge1xyXG4gICAgLy8gMjEuMS4zLjMgU3RyaW5nLnByb3RvdHlwZS5jb2RlUG9pbnRBdChwb3MpXHJcbiAgICBjb2RlUG9pbnRBdDogY3JlYXRlUG9pbnRBdChmYWxzZSksXHJcbiAgICAvLyAyMS4xLjMuNiBTdHJpbmcucHJvdG90eXBlLmVuZHNXaXRoKHNlYXJjaFN0cmluZyBbLCBlbmRQb3NpdGlvbl0pXHJcbiAgICBlbmRzV2l0aDogZnVuY3Rpb24oc2VhcmNoU3RyaW5nIC8qLCBlbmRQb3NpdGlvbiA9IEBsZW5ndGggKi8pe1xyXG4gICAgICBhc3NlcnROb3RSZWdFeHAoc2VhcmNoU3RyaW5nKTtcclxuICAgICAgdmFyIHRoYXQgPSBTdHJpbmcoYXNzZXJ0RGVmaW5lZCh0aGlzKSlcclxuICAgICAgICAsIGVuZFBvc2l0aW9uID0gYXJndW1lbnRzWzFdXHJcbiAgICAgICAgLCBsZW4gPSB0b0xlbmd0aCh0aGF0Lmxlbmd0aClcclxuICAgICAgICAsIGVuZCA9IGVuZFBvc2l0aW9uID09PSB1bmRlZmluZWQgPyBsZW4gOiBtaW4odG9MZW5ndGgoZW5kUG9zaXRpb24pLCBsZW4pO1xyXG4gICAgICBzZWFyY2hTdHJpbmcgKz0gJyc7XHJcbiAgICAgIHJldHVybiB0aGF0LnNsaWNlKGVuZCAtIHNlYXJjaFN0cmluZy5sZW5ndGgsIGVuZCkgPT09IHNlYXJjaFN0cmluZztcclxuICAgIH0sXHJcbiAgICAvLyAyMS4xLjMuNyBTdHJpbmcucHJvdG90eXBlLmluY2x1ZGVzKHNlYXJjaFN0cmluZywgcG9zaXRpb24gPSAwKVxyXG4gICAgaW5jbHVkZXM6IGZ1bmN0aW9uKHNlYXJjaFN0cmluZyAvKiwgcG9zaXRpb24gPSAwICovKXtcclxuICAgICAgYXNzZXJ0Tm90UmVnRXhwKHNlYXJjaFN0cmluZyk7XHJcbiAgICAgIHJldHVybiAhIX5TdHJpbmcoYXNzZXJ0RGVmaW5lZCh0aGlzKSkuaW5kZXhPZihzZWFyY2hTdHJpbmcsIGFyZ3VtZW50c1sxXSk7XHJcbiAgICB9LFxyXG4gICAgLy8gMjEuMS4zLjEzIFN0cmluZy5wcm90b3R5cGUucmVwZWF0KGNvdW50KVxyXG4gICAgcmVwZWF0OiBmdW5jdGlvbihjb3VudCl7XHJcbiAgICAgIHZhciBzdHIgPSBTdHJpbmcoYXNzZXJ0RGVmaW5lZCh0aGlzKSlcclxuICAgICAgICAsIHJlcyA9ICcnXHJcbiAgICAgICAgLCBuICAgPSB0b0ludGVnZXIoY291bnQpO1xyXG4gICAgICBpZigwID4gbiB8fCBuID09IEluZmluaXR5KXRocm93IFJhbmdlRXJyb3IoXCJDb3VudCBjYW4ndCBiZSBuZWdhdGl2ZVwiKTtcclxuICAgICAgZm9yKDtuID4gMDsgKG4gPj4+PSAxKSAmJiAoc3RyICs9IHN0cikpaWYobiAmIDEpcmVzICs9IHN0cjtcclxuICAgICAgcmV0dXJuIHJlcztcclxuICAgIH0sXHJcbiAgICAvLyAyMS4xLjMuMTggU3RyaW5nLnByb3RvdHlwZS5zdGFydHNXaXRoKHNlYXJjaFN0cmluZyBbLCBwb3NpdGlvbiBdKVxyXG4gICAgc3RhcnRzV2l0aDogZnVuY3Rpb24oc2VhcmNoU3RyaW5nIC8qLCBwb3NpdGlvbiA9IDAgKi8pe1xyXG4gICAgICBhc3NlcnROb3RSZWdFeHAoc2VhcmNoU3RyaW5nKTtcclxuICAgICAgdmFyIHRoYXQgID0gU3RyaW5nKGFzc2VydERlZmluZWQodGhpcykpXHJcbiAgICAgICAgLCBpbmRleCA9IHRvTGVuZ3RoKG1pbihhcmd1bWVudHNbMV0sIHRoYXQubGVuZ3RoKSk7XHJcbiAgICAgIHNlYXJjaFN0cmluZyArPSAnJztcclxuICAgICAgcmV0dXJuIHRoYXQuc2xpY2UoaW5kZXgsIGluZGV4ICsgc2VhcmNoU3RyaW5nLmxlbmd0aCkgPT09IHNlYXJjaFN0cmluZztcclxuICAgIH1cclxuICB9KTtcclxufShTdHJpbmcuZnJvbUNoYXJDb2RlKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogZXM2LmFycmF5LnN0YXRpY3MgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuIWZ1bmN0aW9uKCl7XHJcbiAgJGRlZmluZShTVEFUSUMgKyBGT1JDRUQgKiBjaGVja0Rhbmdlckl0ZXJDbG9zaW5nKEFycmF5LmZyb20pLCBBUlJBWSwge1xyXG4gICAgLy8gMjIuMS4yLjEgQXJyYXkuZnJvbShhcnJheUxpa2UsIG1hcGZuID0gdW5kZWZpbmVkLCB0aGlzQXJnID0gdW5kZWZpbmVkKVxyXG4gICAgZnJvbTogZnVuY3Rpb24oYXJyYXlMaWtlLyosIG1hcGZuID0gdW5kZWZpbmVkLCB0aGlzQXJnID0gdW5kZWZpbmVkKi8pe1xyXG4gICAgICB2YXIgTyAgICAgICA9IE9iamVjdChhc3NlcnREZWZpbmVkKGFycmF5TGlrZSkpXHJcbiAgICAgICAgLCBtYXBmbiAgID0gYXJndW1lbnRzWzFdXHJcbiAgICAgICAgLCBtYXBwaW5nID0gbWFwZm4gIT09IHVuZGVmaW5lZFxyXG4gICAgICAgICwgZiAgICAgICA9IG1hcHBpbmcgPyBjdHgobWFwZm4sIGFyZ3VtZW50c1syXSwgMikgOiB1bmRlZmluZWRcclxuICAgICAgICAsIGluZGV4ICAgPSAwXHJcbiAgICAgICAgLCBsZW5ndGgsIHJlc3VsdCwgc3RlcDtcclxuICAgICAgaWYoaXNJdGVyYWJsZShPKSl7XHJcbiAgICAgICAgcmVzdWx0ID0gbmV3IChnZW5lcmljKHRoaXMsIEFycmF5KSk7XHJcbiAgICAgICAgc2FmZUl0ZXJDbG9zZShmdW5jdGlvbihpdGVyYXRvcil7XHJcbiAgICAgICAgICBmb3IoOyAhKHN0ZXAgPSBpdGVyYXRvci5uZXh0KCkpLmRvbmU7IGluZGV4Kyspe1xyXG4gICAgICAgICAgICByZXN1bHRbaW5kZXhdID0gbWFwcGluZyA/IGYoc3RlcC52YWx1ZSwgaW5kZXgpIDogc3RlcC52YWx1ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LCBnZXRJdGVyYXRvcihPKSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmVzdWx0ID0gbmV3IChnZW5lcmljKHRoaXMsIEFycmF5KSkobGVuZ3RoID0gdG9MZW5ndGgoTy5sZW5ndGgpKTtcclxuICAgICAgICBmb3IoOyBsZW5ndGggPiBpbmRleDsgaW5kZXgrKyl7XHJcbiAgICAgICAgICByZXN1bHRbaW5kZXhdID0gbWFwcGluZyA/IGYoT1tpbmRleF0sIGluZGV4KSA6IE9baW5kZXhdO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXN1bHQubGVuZ3RoID0gaW5kZXg7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbiAgfSk7XHJcbiAgXHJcbiAgJGRlZmluZShTVEFUSUMsIEFSUkFZLCB7XHJcbiAgICAvLyAyMi4xLjIuMyBBcnJheS5vZiggLi4uaXRlbXMpXHJcbiAgICBvZjogZnVuY3Rpb24oLyogLi4uYXJncyAqLyl7XHJcbiAgICAgIHZhciBpbmRleCAgPSAwXHJcbiAgICAgICAgLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoXHJcbiAgICAgICAgLCByZXN1bHQgPSBuZXcgKGdlbmVyaWModGhpcywgQXJyYXkpKShsZW5ndGgpO1xyXG4gICAgICB3aGlsZShsZW5ndGggPiBpbmRleClyZXN1bHRbaW5kZXhdID0gYXJndW1lbnRzW2luZGV4KytdO1xyXG4gICAgICByZXN1bHQubGVuZ3RoID0gbGVuZ3RoO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG4gIH0pO1xyXG4gIFxyXG4gIHNldFNwZWNpZXMoQXJyYXkpO1xyXG59KCk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGVzNi5hcnJheS5wcm90b3R5cGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbigpe1xyXG4gICRkZWZpbmUoUFJPVE8sIEFSUkFZLCB7XHJcbiAgICAvLyAyMi4xLjMuMyBBcnJheS5wcm90b3R5cGUuY29weVdpdGhpbih0YXJnZXQsIHN0YXJ0LCBlbmQgPSB0aGlzLmxlbmd0aClcclxuICAgIGNvcHlXaXRoaW46IGZ1bmN0aW9uKHRhcmdldCAvKiA9IDAgKi8sIHN0YXJ0IC8qID0gMCwgZW5kID0gQGxlbmd0aCAqLyl7XHJcbiAgICAgIHZhciBPICAgICA9IE9iamVjdChhc3NlcnREZWZpbmVkKHRoaXMpKVxyXG4gICAgICAgICwgbGVuICAgPSB0b0xlbmd0aChPLmxlbmd0aClcclxuICAgICAgICAsIHRvICAgID0gdG9JbmRleCh0YXJnZXQsIGxlbilcclxuICAgICAgICAsIGZyb20gID0gdG9JbmRleChzdGFydCwgbGVuKVxyXG4gICAgICAgICwgZW5kICAgPSBhcmd1bWVudHNbMl1cclxuICAgICAgICAsIGZpbiAgID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB0b0luZGV4KGVuZCwgbGVuKVxyXG4gICAgICAgICwgY291bnQgPSBtaW4oZmluIC0gZnJvbSwgbGVuIC0gdG8pXHJcbiAgICAgICAgLCBpbmMgICA9IDE7XHJcbiAgICAgIGlmKGZyb20gPCB0byAmJiB0byA8IGZyb20gKyBjb3VudCl7XHJcbiAgICAgICAgaW5jICA9IC0xO1xyXG4gICAgICAgIGZyb20gPSBmcm9tICsgY291bnQgLSAxO1xyXG4gICAgICAgIHRvICAgPSB0byArIGNvdW50IC0gMTtcclxuICAgICAgfVxyXG4gICAgICB3aGlsZShjb3VudC0tID4gMCl7XHJcbiAgICAgICAgaWYoZnJvbSBpbiBPKU9bdG9dID0gT1tmcm9tXTtcclxuICAgICAgICBlbHNlIGRlbGV0ZSBPW3RvXTtcclxuICAgICAgICB0byArPSBpbmM7XHJcbiAgICAgICAgZnJvbSArPSBpbmM7XHJcbiAgICAgIH0gcmV0dXJuIE87XHJcbiAgICB9LFxyXG4gICAgLy8gMjIuMS4zLjYgQXJyYXkucHJvdG90eXBlLmZpbGwodmFsdWUsIHN0YXJ0ID0gMCwgZW5kID0gdGhpcy5sZW5ndGgpXHJcbiAgICBmaWxsOiBmdW5jdGlvbih2YWx1ZSAvKiwgc3RhcnQgPSAwLCBlbmQgPSBAbGVuZ3RoICovKXtcclxuICAgICAgdmFyIE8gICAgICA9IE9iamVjdChhc3NlcnREZWZpbmVkKHRoaXMpKVxyXG4gICAgICAgICwgbGVuZ3RoID0gdG9MZW5ndGgoTy5sZW5ndGgpXHJcbiAgICAgICAgLCBpbmRleCAgPSB0b0luZGV4KGFyZ3VtZW50c1sxXSwgbGVuZ3RoKVxyXG4gICAgICAgICwgZW5kICAgID0gYXJndW1lbnRzWzJdXHJcbiAgICAgICAgLCBlbmRQb3MgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbmd0aCA6IHRvSW5kZXgoZW5kLCBsZW5ndGgpO1xyXG4gICAgICB3aGlsZShlbmRQb3MgPiBpbmRleClPW2luZGV4KytdID0gdmFsdWU7XHJcbiAgICAgIHJldHVybiBPO1xyXG4gICAgfSxcclxuICAgIC8vIDIyLjEuMy44IEFycmF5LnByb3RvdHlwZS5maW5kKHByZWRpY2F0ZSwgdGhpc0FyZyA9IHVuZGVmaW5lZClcclxuICAgIGZpbmQ6IGNyZWF0ZUFycmF5TWV0aG9kKDUpLFxyXG4gICAgLy8gMjIuMS4zLjkgQXJyYXkucHJvdG90eXBlLmZpbmRJbmRleChwcmVkaWNhdGUsIHRoaXNBcmcgPSB1bmRlZmluZWQpXHJcbiAgICBmaW5kSW5kZXg6IGNyZWF0ZUFycmF5TWV0aG9kKDYpXHJcbiAgfSk7XHJcbiAgXHJcbiAgaWYoZnJhbWV3b3JrKXtcclxuICAgIC8vIDIyLjEuMy4zMSBBcnJheS5wcm90b3R5cGVbQEB1bnNjb3BhYmxlc11cclxuICAgIGZvckVhY2guY2FsbChhcnJheSgnZmluZCxmaW5kSW5kZXgsZmlsbCxjb3B5V2l0aGluLGVudHJpZXMsa2V5cyx2YWx1ZXMnKSwgZnVuY3Rpb24oaXQpe1xyXG4gICAgICBBcnJheVVuc2NvcGFibGVzW2l0XSA9IHRydWU7XHJcbiAgICB9KTtcclxuICAgIFNZTUJPTF9VTlNDT1BBQkxFUyBpbiBBcnJheVByb3RvIHx8IGhpZGRlbihBcnJheVByb3RvLCBTWU1CT0xfVU5TQ09QQUJMRVMsIEFycmF5VW5zY29wYWJsZXMpO1xyXG4gIH1cclxufSgpO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBlczYuaXRlcmF0b3JzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4hZnVuY3Rpb24oYXQpe1xyXG4gIC8vIDIyLjEuMy40IEFycmF5LnByb3RvdHlwZS5lbnRyaWVzKClcclxuICAvLyAyMi4xLjMuMTMgQXJyYXkucHJvdG90eXBlLmtleXMoKVxyXG4gIC8vIDIyLjEuMy4yOSBBcnJheS5wcm90b3R5cGUudmFsdWVzKClcclxuICAvLyAyMi4xLjMuMzAgQXJyYXkucHJvdG90eXBlW0BAaXRlcmF0b3JdKClcclxuICBkZWZpbmVTdGRJdGVyYXRvcnMoQXJyYXksIEFSUkFZLCBmdW5jdGlvbihpdGVyYXRlZCwga2luZCl7XHJcbiAgICBzZXQodGhpcywgSVRFUiwge286IHRvT2JqZWN0KGl0ZXJhdGVkKSwgaTogMCwgazoga2luZH0pO1xyXG4gIC8vIDIyLjEuNS4yLjEgJUFycmF5SXRlcmF0b3JQcm90b3R5cGUlLm5leHQoKVxyXG4gIH0sIGZ1bmN0aW9uKCl7XHJcbiAgICB2YXIgaXRlciAgPSB0aGlzW0lURVJdXHJcbiAgICAgICwgTyAgICAgPSBpdGVyLm9cclxuICAgICAgLCBraW5kICA9IGl0ZXIua1xyXG4gICAgICAsIGluZGV4ID0gaXRlci5pKys7XHJcbiAgICBpZighTyB8fCBpbmRleCA+PSBPLmxlbmd0aCl7XHJcbiAgICAgIGl0ZXIubyA9IHVuZGVmaW5lZDtcclxuICAgICAgcmV0dXJuIGl0ZXJSZXN1bHQoMSk7XHJcbiAgICB9XHJcbiAgICBpZihraW5kID09IEtFWSkgIHJldHVybiBpdGVyUmVzdWx0KDAsIGluZGV4KTtcclxuICAgIGlmKGtpbmQgPT0gVkFMVUUpcmV0dXJuIGl0ZXJSZXN1bHQoMCwgT1tpbmRleF0pO1xyXG4gICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlclJlc3VsdCgwLCBbaW5kZXgsIE9baW5kZXhdXSk7XHJcbiAgfSwgVkFMVUUpO1xyXG4gIFxyXG4gIC8vIGFyZ3VtZW50c0xpc3RbQEBpdGVyYXRvcl0gaXMgJUFycmF5UHJvdG9fdmFsdWVzJSAoOS40LjQuNiwgOS40LjQuNylcclxuICBJdGVyYXRvcnNbQVJHVU1FTlRTXSA9IEl0ZXJhdG9yc1tBUlJBWV07XHJcbiAgXHJcbiAgLy8gMjEuMS4zLjI3IFN0cmluZy5wcm90b3R5cGVbQEBpdGVyYXRvcl0oKVxyXG4gIGRlZmluZVN0ZEl0ZXJhdG9ycyhTdHJpbmcsIFNUUklORywgZnVuY3Rpb24oaXRlcmF0ZWQpe1xyXG4gICAgc2V0KHRoaXMsIElURVIsIHtvOiBTdHJpbmcoaXRlcmF0ZWQpLCBpOiAwfSk7XHJcbiAgLy8gMjEuMS41LjIuMSAlU3RyaW5nSXRlcmF0b3JQcm90b3R5cGUlLm5leHQoKVxyXG4gIH0sIGZ1bmN0aW9uKCl7XHJcbiAgICB2YXIgaXRlciAgPSB0aGlzW0lURVJdXHJcbiAgICAgICwgTyAgICAgPSBpdGVyLm9cclxuICAgICAgLCBpbmRleCA9IGl0ZXIuaVxyXG4gICAgICAsIHBvaW50O1xyXG4gICAgaWYoaW5kZXggPj0gTy5sZW5ndGgpcmV0dXJuIGl0ZXJSZXN1bHQoMSk7XHJcbiAgICBwb2ludCA9IGF0LmNhbGwoTywgaW5kZXgpO1xyXG4gICAgaXRlci5pICs9IHBvaW50Lmxlbmd0aDtcclxuICAgIHJldHVybiBpdGVyUmVzdWx0KDAsIHBvaW50KTtcclxuICB9KTtcclxufShjcmVhdGVQb2ludEF0KHRydWUpKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogd2ViLmltbWVkaWF0ZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy8gc2V0SW1tZWRpYXRlIHNoaW1cclxuLy8gTm9kZS5qcyAwLjkrICYgSUUxMCsgaGFzIHNldEltbWVkaWF0ZSwgZWxzZTpcclxuaXNGdW5jdGlvbihzZXRJbW1lZGlhdGUpICYmIGlzRnVuY3Rpb24oY2xlYXJJbW1lZGlhdGUpIHx8IGZ1bmN0aW9uKE9OUkVBRFlTVEFURUNIQU5HRSl7XHJcbiAgdmFyIHBvc3RNZXNzYWdlICAgICAgPSBnbG9iYWwucG9zdE1lc3NhZ2VcclxuICAgICwgYWRkRXZlbnRMaXN0ZW5lciA9IGdsb2JhbC5hZGRFdmVudExpc3RlbmVyXHJcbiAgICAsIE1lc3NhZ2VDaGFubmVsICAgPSBnbG9iYWwuTWVzc2FnZUNoYW5uZWxcclxuICAgICwgY291bnRlciAgICAgICAgICA9IDBcclxuICAgICwgcXVldWUgICAgICAgICAgICA9IHt9XHJcbiAgICAsIGRlZmVyLCBjaGFubmVsLCBwb3J0O1xyXG4gIHNldEltbWVkaWF0ZSA9IGZ1bmN0aW9uKGZuKXtcclxuICAgIHZhciBhcmdzID0gW10sIGkgPSAxO1xyXG4gICAgd2hpbGUoYXJndW1lbnRzLmxlbmd0aCA+IGkpYXJncy5wdXNoKGFyZ3VtZW50c1tpKytdKTtcclxuICAgIHF1ZXVlWysrY291bnRlcl0gPSBmdW5jdGlvbigpe1xyXG4gICAgICBpbnZva2UoaXNGdW5jdGlvbihmbikgPyBmbiA6IEZ1bmN0aW9uKGZuKSwgYXJncyk7XHJcbiAgICB9XHJcbiAgICBkZWZlcihjb3VudGVyKTtcclxuICAgIHJldHVybiBjb3VudGVyO1xyXG4gIH1cclxuICBjbGVhckltbWVkaWF0ZSA9IGZ1bmN0aW9uKGlkKXtcclxuICAgIGRlbGV0ZSBxdWV1ZVtpZF07XHJcbiAgfVxyXG4gIGZ1bmN0aW9uIHJ1bihpZCl7XHJcbiAgICBpZihoYXMocXVldWUsIGlkKSl7XHJcbiAgICAgIHZhciBmbiA9IHF1ZXVlW2lkXTtcclxuICAgICAgZGVsZXRlIHF1ZXVlW2lkXTtcclxuICAgICAgZm4oKTtcclxuICAgIH1cclxuICB9XHJcbiAgZnVuY3Rpb24gbGlzdG5lcihldmVudCl7XHJcbiAgICBydW4oZXZlbnQuZGF0YSk7XHJcbiAgfVxyXG4gIC8vIE5vZGUuanMgMC44LVxyXG4gIGlmKE5PREUpe1xyXG4gICAgZGVmZXIgPSBmdW5jdGlvbihpZCl7XHJcbiAgICAgIG5leHRUaWNrKHBhcnQuY2FsbChydW4sIGlkKSk7XHJcbiAgICB9XHJcbiAgLy8gTW9kZXJuIGJyb3dzZXJzLCBza2lwIGltcGxlbWVudGF0aW9uIGZvciBXZWJXb3JrZXJzXHJcbiAgLy8gSUU4IGhhcyBwb3N0TWVzc2FnZSwgYnV0IGl0J3Mgc3luYyAmIHR5cGVvZiBpdHMgcG9zdE1lc3NhZ2UgaXMgb2JqZWN0XHJcbiAgfSBlbHNlIGlmKGFkZEV2ZW50TGlzdGVuZXIgJiYgaXNGdW5jdGlvbihwb3N0TWVzc2FnZSkgJiYgIWdsb2JhbC5pbXBvcnRTY3JpcHRzKXtcclxuICAgIGRlZmVyID0gZnVuY3Rpb24oaWQpe1xyXG4gICAgICBwb3N0TWVzc2FnZShpZCwgJyonKTtcclxuICAgIH1cclxuICAgIGFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBsaXN0bmVyLCBmYWxzZSk7XHJcbiAgLy8gV2ViV29ya2Vyc1xyXG4gIH0gZWxzZSBpZihpc0Z1bmN0aW9uKE1lc3NhZ2VDaGFubmVsKSl7XHJcbiAgICBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsO1xyXG4gICAgcG9ydCAgICA9IGNoYW5uZWwucG9ydDI7XHJcbiAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGxpc3RuZXI7XHJcbiAgICBkZWZlciA9IGN0eChwb3J0LnBvc3RNZXNzYWdlLCBwb3J0LCAxKTtcclxuICAvLyBJRTgtXHJcbiAgfSBlbHNlIGlmKGRvY3VtZW50ICYmIE9OUkVBRFlTVEFURUNIQU5HRSBpbiBkb2N1bWVudFtDUkVBVEVfRUxFTUVOVF0oJ3NjcmlwdCcpKXtcclxuICAgIGRlZmVyID0gZnVuY3Rpb24oaWQpe1xyXG4gICAgICBodG1sLmFwcGVuZENoaWxkKGRvY3VtZW50W0NSRUFURV9FTEVNRU5UXSgnc2NyaXB0JykpW09OUkVBRFlTVEFURUNIQU5HRV0gPSBmdW5jdGlvbigpe1xyXG4gICAgICAgIGh0bWwucmVtb3ZlQ2hpbGQodGhpcyk7XHJcbiAgICAgICAgcnVuKGlkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIC8vIFJlc3Qgb2xkIGJyb3dzZXJzXHJcbiAgfSBlbHNlIHtcclxuICAgIGRlZmVyID0gZnVuY3Rpb24oaWQpe1xyXG4gICAgICBzZXRUaW1lb3V0KHJ1biwgMCwgaWQpO1xyXG4gICAgfVxyXG4gIH1cclxufSgnb25yZWFkeXN0YXRlY2hhbmdlJyk7XHJcbiRkZWZpbmUoR0xPQkFMICsgQklORCwge1xyXG4gIHNldEltbWVkaWF0ZTogICBzZXRJbW1lZGlhdGUsXHJcbiAgY2xlYXJJbW1lZGlhdGU6IGNsZWFySW1tZWRpYXRlXHJcbn0pO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBlczYucHJvbWlzZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBFUzYgcHJvbWlzZXMgc2hpbVxyXG4vLyBCYXNlZCBvbiBodHRwczovL2dpdGh1Yi5jb20vZ2V0aWZ5L25hdGl2ZS1wcm9taXNlLW9ubHkvXHJcbiFmdW5jdGlvbihQcm9taXNlLCB0ZXN0KXtcclxuICBpc0Z1bmN0aW9uKFByb21pc2UpICYmIGlzRnVuY3Rpb24oUHJvbWlzZS5yZXNvbHZlKVxyXG4gICYmIFByb21pc2UucmVzb2x2ZSh0ZXN0ID0gbmV3IFByb21pc2UoZnVuY3Rpb24oKXt9KSkgPT0gdGVzdFxyXG4gIHx8IGZ1bmN0aW9uKGFzYXAsIFJFQ09SRCl7XHJcbiAgICBmdW5jdGlvbiBpc1RoZW5hYmxlKGl0KXtcclxuICAgICAgdmFyIHRoZW47XHJcbiAgICAgIGlmKGlzT2JqZWN0KGl0KSl0aGVuID0gaXQudGhlbjtcclxuICAgICAgcmV0dXJuIGlzRnVuY3Rpb24odGhlbikgPyB0aGVuIDogZmFsc2U7XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBoYW5kbGVkUmVqZWN0aW9uT3JIYXNPblJlamVjdGVkKHByb21pc2Upe1xyXG4gICAgICB2YXIgcmVjb3JkID0gcHJvbWlzZVtSRUNPUkRdXHJcbiAgICAgICAgLCBjaGFpbiAgPSByZWNvcmQuY1xyXG4gICAgICAgICwgaSAgICAgID0gMFxyXG4gICAgICAgICwgcmVhY3Q7XHJcbiAgICAgIGlmKHJlY29yZC5oKXJldHVybiB0cnVlO1xyXG4gICAgICB3aGlsZShjaGFpbi5sZW5ndGggPiBpKXtcclxuICAgICAgICByZWFjdCA9IGNoYWluW2krK107XHJcbiAgICAgICAgaWYocmVhY3QuZmFpbCB8fCBoYW5kbGVkUmVqZWN0aW9uT3JIYXNPblJlamVjdGVkKHJlYWN0LlApKXJldHVybiB0cnVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBub3RpZnkocmVjb3JkLCByZWplY3Qpe1xyXG4gICAgICB2YXIgY2hhaW4gPSByZWNvcmQuYztcclxuICAgICAgaWYocmVqZWN0IHx8IGNoYWluLmxlbmd0aClhc2FwKGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgdmFyIHByb21pc2UgPSByZWNvcmQucFxyXG4gICAgICAgICAgLCB2YWx1ZSAgID0gcmVjb3JkLnZcclxuICAgICAgICAgICwgb2sgICAgICA9IHJlY29yZC5zID09IDFcclxuICAgICAgICAgICwgaSAgICAgICA9IDA7XHJcbiAgICAgICAgaWYocmVqZWN0ICYmICFoYW5kbGVkUmVqZWN0aW9uT3JIYXNPblJlamVjdGVkKHByb21pc2UpKXtcclxuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgaWYoIWhhbmRsZWRSZWplY3Rpb25Pckhhc09uUmVqZWN0ZWQocHJvbWlzZSkpe1xyXG4gICAgICAgICAgICAgIGlmKE5PREUpe1xyXG4gICAgICAgICAgICAgICAgaWYoIXByb2Nlc3MuZW1pdCgndW5oYW5kbGVkUmVqZWN0aW9uJywgdmFsdWUsIHByb21pc2UpKXtcclxuICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCBub2RlLmpzIGJlaGF2aW9yXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSBlbHNlIGlmKGlzRnVuY3Rpb24oY29uc29sZS5lcnJvcikpe1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uJywgdmFsdWUpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSwgMWUzKTtcclxuICAgICAgICB9IGVsc2Ugd2hpbGUoY2hhaW4ubGVuZ3RoID4gaSkhZnVuY3Rpb24ocmVhY3Qpe1xyXG4gICAgICAgICAgdmFyIGNiID0gb2sgPyByZWFjdC5vayA6IHJlYWN0LmZhaWxcclxuICAgICAgICAgICAgLCByZXQsIHRoZW47XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZihjYil7XHJcbiAgICAgICAgICAgICAgaWYoIW9rKXJlY29yZC5oID0gdHJ1ZTtcclxuICAgICAgICAgICAgICByZXQgPSBjYiA9PT0gdHJ1ZSA/IHZhbHVlIDogY2IodmFsdWUpO1xyXG4gICAgICAgICAgICAgIGlmKHJldCA9PT0gcmVhY3QuUCl7XHJcbiAgICAgICAgICAgICAgICByZWFjdC5yZWooVHlwZUVycm9yKFBST01JU0UgKyAnLWNoYWluIGN5Y2xlJykpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSBpZih0aGVuID0gaXNUaGVuYWJsZShyZXQpKXtcclxuICAgICAgICAgICAgICAgIHRoZW4uY2FsbChyZXQsIHJlYWN0LnJlcywgcmVhY3QucmVqKTtcclxuICAgICAgICAgICAgICB9IGVsc2UgcmVhY3QucmVzKHJldCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSByZWFjdC5yZWoodmFsdWUpO1xyXG4gICAgICAgICAgfSBjYXRjaChlcnIpe1xyXG4gICAgICAgICAgICByZWFjdC5yZWooZXJyKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KGNoYWluW2krK10pO1xyXG4gICAgICAgIGNoYWluLmxlbmd0aCA9IDA7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gcmVzb2x2ZSh2YWx1ZSl7XHJcbiAgICAgIHZhciByZWNvcmQgPSB0aGlzXHJcbiAgICAgICAgLCB0aGVuLCB3cmFwcGVyO1xyXG4gICAgICBpZihyZWNvcmQuZClyZXR1cm47XHJcbiAgICAgIHJlY29yZC5kID0gdHJ1ZTtcclxuICAgICAgcmVjb3JkID0gcmVjb3JkLnIgfHwgcmVjb3JkOyAvLyB1bndyYXBcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBpZih0aGVuID0gaXNUaGVuYWJsZSh2YWx1ZSkpe1xyXG4gICAgICAgICAgd3JhcHBlciA9IHtyOiByZWNvcmQsIGQ6IGZhbHNlfTsgLy8gd3JhcFxyXG4gICAgICAgICAgdGhlbi5jYWxsKHZhbHVlLCBjdHgocmVzb2x2ZSwgd3JhcHBlciwgMSksIGN0eChyZWplY3QsIHdyYXBwZXIsIDEpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVjb3JkLnYgPSB2YWx1ZTtcclxuICAgICAgICAgIHJlY29yZC5zID0gMTtcclxuICAgICAgICAgIG5vdGlmeShyZWNvcmQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaChlcnIpe1xyXG4gICAgICAgIHJlamVjdC5jYWxsKHdyYXBwZXIgfHwge3I6IHJlY29yZCwgZDogZmFsc2V9LCBlcnIpOyAvLyB3cmFwXHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSl7XHJcbiAgICAgIHZhciByZWNvcmQgPSB0aGlzO1xyXG4gICAgICBpZihyZWNvcmQuZClyZXR1cm47XHJcbiAgICAgIHJlY29yZC5kID0gdHJ1ZTtcclxuICAgICAgcmVjb3JkID0gcmVjb3JkLnIgfHwgcmVjb3JkOyAvLyB1bndyYXBcclxuICAgICAgcmVjb3JkLnYgPSB2YWx1ZTtcclxuICAgICAgcmVjb3JkLnMgPSAyO1xyXG4gICAgICBub3RpZnkocmVjb3JkLCB0cnVlKTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIGdldENvbnN0cnVjdG9yKEMpe1xyXG4gICAgICB2YXIgUyA9IGFzc2VydE9iamVjdChDKVtTWU1CT0xfU1BFQ0lFU107XHJcbiAgICAgIHJldHVybiBTICE9IHVuZGVmaW5lZCA/IFMgOiBDO1xyXG4gICAgfVxyXG4gICAgLy8gMjUuNC4zLjEgUHJvbWlzZShleGVjdXRvcilcclxuICAgIFByb21pc2UgPSBmdW5jdGlvbihleGVjdXRvcil7XHJcbiAgICAgIGFzc2VydEZ1bmN0aW9uKGV4ZWN1dG9yKTtcclxuICAgICAgYXNzZXJ0SW5zdGFuY2UodGhpcywgUHJvbWlzZSwgUFJPTUlTRSk7XHJcbiAgICAgIHZhciByZWNvcmQgPSB7XHJcbiAgICAgICAgcDogdGhpcywgICAgICAvLyBwcm9taXNlXHJcbiAgICAgICAgYzogW10sICAgICAgICAvLyBjaGFpblxyXG4gICAgICAgIHM6IDAsICAgICAgICAgLy8gc3RhdGVcclxuICAgICAgICBkOiBmYWxzZSwgICAgIC8vIGRvbmVcclxuICAgICAgICB2OiB1bmRlZmluZWQsIC8vIHZhbHVlXHJcbiAgICAgICAgaDogZmFsc2UgICAgICAvLyBoYW5kbGVkIHJlamVjdGlvblxyXG4gICAgICB9O1xyXG4gICAgICBoaWRkZW4odGhpcywgUkVDT1JELCByZWNvcmQpO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGV4ZWN1dG9yKGN0eChyZXNvbHZlLCByZWNvcmQsIDEpLCBjdHgocmVqZWN0LCByZWNvcmQsIDEpKTtcclxuICAgICAgfSBjYXRjaChlcnIpe1xyXG4gICAgICAgIHJlamVjdC5jYWxsKHJlY29yZCwgZXJyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgYXNzaWduSGlkZGVuKFByb21pc2VbUFJPVE9UWVBFXSwge1xyXG4gICAgICAvLyAyNS40LjUuMyBQcm9taXNlLnByb3RvdHlwZS50aGVuKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKVxyXG4gICAgICB0aGVuOiBmdW5jdGlvbihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCl7XHJcbiAgICAgICAgdmFyIFMgPSBhc3NlcnRPYmplY3QoYXNzZXJ0T2JqZWN0KHRoaXMpW0NPTlNUUlVDVE9SXSlbU1lNQk9MX1NQRUNJRVNdO1xyXG4gICAgICAgIHZhciByZWFjdCA9IHtcclxuICAgICAgICAgIG9rOiAgIGlzRnVuY3Rpb24ob25GdWxmaWxsZWQpID8gb25GdWxmaWxsZWQgOiB0cnVlLFxyXG4gICAgICAgICAgZmFpbDogaXNGdW5jdGlvbihvblJlamVjdGVkKSAgPyBvblJlamVjdGVkICA6IGZhbHNlXHJcbiAgICAgICAgfSAsIFAgPSByZWFjdC5QID0gbmV3IChTICE9IHVuZGVmaW5lZCA/IFMgOiBQcm9taXNlKShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xyXG4gICAgICAgICAgcmVhY3QucmVzID0gYXNzZXJ0RnVuY3Rpb24ocmVzb2x2ZSk7XHJcbiAgICAgICAgICByZWFjdC5yZWogPSBhc3NlcnRGdW5jdGlvbihyZWplY3QpO1xyXG4gICAgICAgIH0pLCByZWNvcmQgPSB0aGlzW1JFQ09SRF07XHJcbiAgICAgICAgcmVjb3JkLmMucHVzaChyZWFjdCk7XHJcbiAgICAgICAgcmVjb3JkLnMgJiYgbm90aWZ5KHJlY29yZCk7XHJcbiAgICAgICAgcmV0dXJuIFA7XHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIDI1LjQuNS4xIFByb21pc2UucHJvdG90eXBlLmNhdGNoKG9uUmVqZWN0ZWQpXHJcbiAgICAgICdjYXRjaCc6IGZ1bmN0aW9uKG9uUmVqZWN0ZWQpe1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRoZW4odW5kZWZpbmVkLCBvblJlamVjdGVkKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBhc3NpZ25IaWRkZW4oUHJvbWlzZSwge1xyXG4gICAgICAvLyAyNS40LjQuMSBQcm9taXNlLmFsbChpdGVyYWJsZSlcclxuICAgICAgYWxsOiBmdW5jdGlvbihpdGVyYWJsZSl7XHJcbiAgICAgICAgdmFyIFByb21pc2UgPSBnZXRDb25zdHJ1Y3Rvcih0aGlzKVxyXG4gICAgICAgICAgLCB2YWx1ZXMgID0gW107XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XHJcbiAgICAgICAgICBmb3JPZihpdGVyYWJsZSwgZmFsc2UsIHB1c2gsIHZhbHVlcyk7XHJcbiAgICAgICAgICB2YXIgcmVtYWluaW5nID0gdmFsdWVzLmxlbmd0aFxyXG4gICAgICAgICAgICAsIHJlc3VsdHMgICA9IEFycmF5KHJlbWFpbmluZyk7XHJcbiAgICAgICAgICBpZihyZW1haW5pbmcpZm9yRWFjaC5jYWxsKHZhbHVlcywgZnVuY3Rpb24ocHJvbWlzZSwgaW5kZXgpe1xyXG4gICAgICAgICAgICBQcm9taXNlLnJlc29sdmUocHJvbWlzZSkudGhlbihmdW5jdGlvbih2YWx1ZSl7XHJcbiAgICAgICAgICAgICAgcmVzdWx0c1tpbmRleF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAtLXJlbWFpbmluZyB8fCByZXNvbHZlKHJlc3VsdHMpO1xyXG4gICAgICAgICAgICB9LCByZWplY3QpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgICBlbHNlIHJlc29sdmUocmVzdWx0cyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIDI1LjQuNC40IFByb21pc2UucmFjZShpdGVyYWJsZSlcclxuICAgICAgcmFjZTogZnVuY3Rpb24oaXRlcmFibGUpe1xyXG4gICAgICAgIHZhciBQcm9taXNlID0gZ2V0Q29uc3RydWN0b3IodGhpcyk7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XHJcbiAgICAgICAgICBmb3JPZihpdGVyYWJsZSwgZmFsc2UsIGZ1bmN0aW9uKHByb21pc2Upe1xyXG4gICAgICAgICAgICBQcm9taXNlLnJlc29sdmUocHJvbWlzZSkudGhlbihyZXNvbHZlLCByZWplY3QpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIDI1LjQuNC41IFByb21pc2UucmVqZWN0KHIpXHJcbiAgICAgIHJlamVjdDogZnVuY3Rpb24ocil7XHJcbiAgICAgICAgcmV0dXJuIG5ldyAoZ2V0Q29uc3RydWN0b3IodGhpcykpKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XHJcbiAgICAgICAgICByZWplY3Qocik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIDI1LjQuNC42IFByb21pc2UucmVzb2x2ZSh4KVxyXG4gICAgICByZXNvbHZlOiBmdW5jdGlvbih4KXtcclxuICAgICAgICByZXR1cm4gaXNPYmplY3QoeCkgJiYgUkVDT1JEIGluIHggJiYgZ2V0UHJvdG90eXBlT2YoeCkgPT09IHRoaXNbUFJPVE9UWVBFXVxyXG4gICAgICAgICAgPyB4IDogbmV3IChnZXRDb25zdHJ1Y3Rvcih0aGlzKSkoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcclxuICAgICAgICAgICAgcmVzb2x2ZSh4KTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KG5leHRUaWNrIHx8IHNldEltbWVkaWF0ZSwgc2FmZVN5bWJvbCgncmVjb3JkJykpO1xyXG4gIHNldFRvU3RyaW5nVGFnKFByb21pc2UsIFBST01JU0UpO1xyXG4gIHNldFNwZWNpZXMoUHJvbWlzZSk7XHJcbiAgJGRlZmluZShHTE9CQUwgKyBGT1JDRUQgKiAhaXNOYXRpdmUoUHJvbWlzZSksIHtQcm9taXNlOiBQcm9taXNlfSk7XHJcbn0oZ2xvYmFsW1BST01JU0VdKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogZXM2LmNvbGxlY3Rpb25zICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy8gRUNNQVNjcmlwdCA2IGNvbGxlY3Rpb25zIHNoaW1cclxuIWZ1bmN0aW9uKCl7XHJcbiAgdmFyIFVJRCAgID0gc2FmZVN5bWJvbCgndWlkJylcclxuICAgICwgTzEgICAgPSBzYWZlU3ltYm9sKCdPMScpXHJcbiAgICAsIFdFQUsgID0gc2FmZVN5bWJvbCgnd2VhaycpXHJcbiAgICAsIExFQUsgID0gc2FmZVN5bWJvbCgnbGVhaycpXHJcbiAgICAsIExBU1QgID0gc2FmZVN5bWJvbCgnbGFzdCcpXHJcbiAgICAsIEZJUlNUID0gc2FmZVN5bWJvbCgnZmlyc3QnKVxyXG4gICAgLCBTSVpFICA9IERFU0MgPyBzYWZlU3ltYm9sKCdzaXplJykgOiAnc2l6ZSdcclxuICAgICwgdWlkICAgPSAwXHJcbiAgICAsIHRtcCAgID0ge307XHJcbiAgXHJcbiAgZnVuY3Rpb24gZ2V0Q29sbGVjdGlvbihDLCBOQU1FLCBtZXRob2RzLCBjb21tb25NZXRob2RzLCBpc01hcCwgaXNXZWFrKXtcclxuICAgIHZhciBBRERFUiA9IGlzTWFwID8gJ3NldCcgOiAnYWRkJ1xyXG4gICAgICAsIHByb3RvID0gQyAmJiBDW1BST1RPVFlQRV1cclxuICAgICAgLCBPICAgICA9IHt9O1xyXG4gICAgZnVuY3Rpb24gaW5pdEZyb21JdGVyYWJsZSh0aGF0LCBpdGVyYWJsZSl7XHJcbiAgICAgIGlmKGl0ZXJhYmxlICE9IHVuZGVmaW5lZClmb3JPZihpdGVyYWJsZSwgaXNNYXAsIHRoYXRbQURERVJdLCB0aGF0KTtcclxuICAgICAgcmV0dXJuIHRoYXQ7XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBmaXhTVlooa2V5LCBjaGFpbil7XHJcbiAgICAgIHZhciBtZXRob2QgPSBwcm90b1trZXldO1xyXG4gICAgICBpZihmcmFtZXdvcmspcHJvdG9ba2V5XSA9IGZ1bmN0aW9uKGEsIGIpe1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBtZXRob2QuY2FsbCh0aGlzLCBhID09PSAwID8gMCA6IGEsIGIpO1xyXG4gICAgICAgIHJldHVybiBjaGFpbiA/IHRoaXMgOiByZXN1bHQ7XHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICBpZighaXNOYXRpdmUoQykgfHwgIShpc1dlYWsgfHwgKCFCVUdHWV9JVEVSQVRPUlMgJiYgaGFzKHByb3RvLCBGT1JfRUFDSCkgJiYgaGFzKHByb3RvLCAnZW50cmllcycpKSkpe1xyXG4gICAgICAvLyBjcmVhdGUgY29sbGVjdGlvbiBjb25zdHJ1Y3RvclxyXG4gICAgICBDID0gaXNXZWFrXHJcbiAgICAgICAgPyBmdW5jdGlvbihpdGVyYWJsZSl7XHJcbiAgICAgICAgICAgIGFzc2VydEluc3RhbmNlKHRoaXMsIEMsIE5BTUUpO1xyXG4gICAgICAgICAgICBzZXQodGhpcywgVUlELCB1aWQrKyk7XHJcbiAgICAgICAgICAgIGluaXRGcm9tSXRlcmFibGUodGhpcywgaXRlcmFibGUpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIDogZnVuY3Rpb24oaXRlcmFibGUpe1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIGFzc2VydEluc3RhbmNlKHRoYXQsIEMsIE5BTUUpO1xyXG4gICAgICAgICAgICBzZXQodGhhdCwgTzEsIGNyZWF0ZShudWxsKSk7XHJcbiAgICAgICAgICAgIHNldCh0aGF0LCBTSVpFLCAwKTtcclxuICAgICAgICAgICAgc2V0KHRoYXQsIExBU1QsIHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgIHNldCh0aGF0LCBGSVJTVCwgdW5kZWZpbmVkKTtcclxuICAgICAgICAgICAgaW5pdEZyb21JdGVyYWJsZSh0aGF0LCBpdGVyYWJsZSk7XHJcbiAgICAgICAgICB9O1xyXG4gICAgICBhc3NpZ25IaWRkZW4oYXNzaWduSGlkZGVuKENbUFJPVE9UWVBFXSwgbWV0aG9kcyksIGNvbW1vbk1ldGhvZHMpO1xyXG4gICAgICBpc1dlYWsgfHwgIURFU0MgfHwgZGVmaW5lUHJvcGVydHkoQ1tQUk9UT1RZUEVdLCAnc2l6ZScsIHtnZXQ6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIGFzc2VydERlZmluZWQodGhpc1tTSVpFXSk7XHJcbiAgICAgIH19KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHZhciBOYXRpdmUgPSBDXHJcbiAgICAgICAgLCBpbnN0ICAgPSBuZXcgQ1xyXG4gICAgICAgICwgY2hhaW4gID0gaW5zdFtBRERFUl0oaXNXZWFrID8ge30gOiAtMCwgMSlcclxuICAgICAgICAsIGJ1Z2d5WmVybztcclxuICAgICAgLy8gd3JhcCB0byBpbml0IGNvbGxlY3Rpb25zIGZyb20gaXRlcmFibGVcclxuICAgICAgaWYoY2hlY2tEYW5nZXJJdGVyQ2xvc2luZyhmdW5jdGlvbihPKXsgbmV3IEMoTykgfSkpe1xyXG4gICAgICAgIEMgPSBmdW5jdGlvbihpdGVyYWJsZSl7XHJcbiAgICAgICAgICBhc3NlcnRJbnN0YW5jZSh0aGlzLCBDLCBOQU1FKTtcclxuICAgICAgICAgIHJldHVybiBpbml0RnJvbUl0ZXJhYmxlKG5ldyBOYXRpdmUsIGl0ZXJhYmxlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgQ1tQUk9UT1RZUEVdID0gcHJvdG87XHJcbiAgICAgICAgaWYoZnJhbWV3b3JrKXByb3RvW0NPTlNUUlVDVE9SXSA9IEM7XHJcbiAgICAgIH1cclxuICAgICAgaXNXZWFrIHx8IGluc3RbRk9SX0VBQ0hdKGZ1bmN0aW9uKHZhbCwga2V5KXtcclxuICAgICAgICBidWdneVplcm8gPSAxIC8ga2V5ID09PSAtSW5maW5pdHk7XHJcbiAgICAgIH0pO1xyXG4gICAgICAvLyBmaXggY29udmVydGluZyAtMCBrZXkgdG8gKzBcclxuICAgICAgaWYoYnVnZ3laZXJvKXtcclxuICAgICAgICBmaXhTVlooJ2RlbGV0ZScpO1xyXG4gICAgICAgIGZpeFNWWignaGFzJyk7XHJcbiAgICAgICAgaXNNYXAgJiYgZml4U1ZaKCdnZXQnKTtcclxuICAgICAgfVxyXG4gICAgICAvLyArIGZpeCAuYWRkICYgLnNldCBmb3IgY2hhaW5pbmdcclxuICAgICAgaWYoYnVnZ3laZXJvIHx8IGNoYWluICE9PSBpbnN0KWZpeFNWWihBRERFUiwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgICBzZXRUb1N0cmluZ1RhZyhDLCBOQU1FKTtcclxuICAgIHNldFNwZWNpZXMoQyk7XHJcbiAgICBcclxuICAgIE9bTkFNRV0gPSBDO1xyXG4gICAgJGRlZmluZShHTE9CQUwgKyBXUkFQICsgRk9SQ0VEICogIWlzTmF0aXZlKEMpLCBPKTtcclxuICAgIFxyXG4gICAgLy8gYWRkIC5rZXlzLCAudmFsdWVzLCAuZW50cmllcywgW0BAaXRlcmF0b3JdXHJcbiAgICAvLyAyMy4xLjMuNCwgMjMuMS4zLjgsIDIzLjEuMy4xMSwgMjMuMS4zLjEyLCAyMy4yLjMuNSwgMjMuMi4zLjgsIDIzLjIuMy4xMCwgMjMuMi4zLjExXHJcbiAgICBpc1dlYWsgfHwgZGVmaW5lU3RkSXRlcmF0b3JzKEMsIE5BTUUsIGZ1bmN0aW9uKGl0ZXJhdGVkLCBraW5kKXtcclxuICAgICAgc2V0KHRoaXMsIElURVIsIHtvOiBpdGVyYXRlZCwgazoga2luZH0pO1xyXG4gICAgfSwgZnVuY3Rpb24oKXtcclxuICAgICAgdmFyIGl0ZXIgID0gdGhpc1tJVEVSXVxyXG4gICAgICAgICwga2luZCAgPSBpdGVyLmtcclxuICAgICAgICAsIGVudHJ5ID0gaXRlci5sO1xyXG4gICAgICAvLyByZXZlcnQgdG8gdGhlIGxhc3QgZXhpc3RpbmcgZW50cnlcclxuICAgICAgd2hpbGUoZW50cnkgJiYgZW50cnkucillbnRyeSA9IGVudHJ5LnA7XHJcbiAgICAgIC8vIGdldCBuZXh0IGVudHJ5XHJcbiAgICAgIGlmKCFpdGVyLm8gfHwgIShpdGVyLmwgPSBlbnRyeSA9IGVudHJ5ID8gZW50cnkubiA6IGl0ZXIub1tGSVJTVF0pKXtcclxuICAgICAgICAvLyBvciBmaW5pc2ggdGhlIGl0ZXJhdGlvblxyXG4gICAgICAgIGl0ZXIubyA9IHVuZGVmaW5lZDtcclxuICAgICAgICByZXR1cm4gaXRlclJlc3VsdCgxKTtcclxuICAgICAgfVxyXG4gICAgICAvLyByZXR1cm4gc3RlcCBieSBraW5kXHJcbiAgICAgIGlmKGtpbmQgPT0gS0VZKSAgcmV0dXJuIGl0ZXJSZXN1bHQoMCwgZW50cnkuayk7XHJcbiAgICAgIGlmKGtpbmQgPT0gVkFMVUUpcmV0dXJuIGl0ZXJSZXN1bHQoMCwgZW50cnkudik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZXJSZXN1bHQoMCwgW2VudHJ5LmssIGVudHJ5LnZdKTsgICBcclxuICAgIH0sIGlzTWFwID8gS0VZK1ZBTFVFIDogVkFMVUUsICFpc01hcCk7XHJcbiAgICBcclxuICAgIHJldHVybiBDO1xyXG4gIH1cclxuICBcclxuICBmdW5jdGlvbiBmYXN0S2V5KGl0LCBjcmVhdGUpe1xyXG4gICAgLy8gcmV0dXJuIHByaW1pdGl2ZSB3aXRoIHByZWZpeFxyXG4gICAgaWYoIWlzT2JqZWN0KGl0KSlyZXR1cm4gKHR5cGVvZiBpdCA9PSAnc3RyaW5nJyA/ICdTJyA6ICdQJykgKyBpdDtcclxuICAgIC8vIGNhbid0IHNldCBpZCB0byBmcm96ZW4gb2JqZWN0XHJcbiAgICBpZihpc0Zyb3plbihpdCkpcmV0dXJuICdGJztcclxuICAgIGlmKCFoYXMoaXQsIFVJRCkpe1xyXG4gICAgICAvLyBub3QgbmVjZXNzYXJ5IHRvIGFkZCBpZFxyXG4gICAgICBpZighY3JlYXRlKXJldHVybiAnRSc7XHJcbiAgICAgIC8vIGFkZCBtaXNzaW5nIG9iamVjdCBpZFxyXG4gICAgICBoaWRkZW4oaXQsIFVJRCwgKyt1aWQpO1xyXG4gICAgLy8gcmV0dXJuIG9iamVjdCBpZCB3aXRoIHByZWZpeFxyXG4gICAgfSByZXR1cm4gJ08nICsgaXRbVUlEXTtcclxuICB9XHJcbiAgZnVuY3Rpb24gZ2V0RW50cnkodGhhdCwga2V5KXtcclxuICAgIC8vIGZhc3QgY2FzZVxyXG4gICAgdmFyIGluZGV4ID0gZmFzdEtleShrZXkpLCBlbnRyeTtcclxuICAgIGlmKGluZGV4ICE9ICdGJylyZXR1cm4gdGhhdFtPMV1baW5kZXhdO1xyXG4gICAgLy8gZnJvemVuIG9iamVjdCBjYXNlXHJcbiAgICBmb3IoZW50cnkgPSB0aGF0W0ZJUlNUXTsgZW50cnk7IGVudHJ5ID0gZW50cnkubil7XHJcbiAgICAgIGlmKGVudHJ5LmsgPT0ga2V5KXJldHVybiBlbnRyeTtcclxuICAgIH1cclxuICB9XHJcbiAgZnVuY3Rpb24gZGVmKHRoYXQsIGtleSwgdmFsdWUpe1xyXG4gICAgdmFyIGVudHJ5ID0gZ2V0RW50cnkodGhhdCwga2V5KVxyXG4gICAgICAsIHByZXYsIGluZGV4O1xyXG4gICAgLy8gY2hhbmdlIGV4aXN0aW5nIGVudHJ5XHJcbiAgICBpZihlbnRyeSllbnRyeS52ID0gdmFsdWU7XHJcbiAgICAvLyBjcmVhdGUgbmV3IGVudHJ5XHJcbiAgICBlbHNlIHtcclxuICAgICAgdGhhdFtMQVNUXSA9IGVudHJ5ID0ge1xyXG4gICAgICAgIGk6IGluZGV4ID0gZmFzdEtleShrZXksIHRydWUpLCAvLyA8LSBpbmRleFxyXG4gICAgICAgIGs6IGtleSwgICAgICAgICAgICAgICAgICAgICAgICAvLyA8LSBrZXlcclxuICAgICAgICB2OiB2YWx1ZSwgICAgICAgICAgICAgICAgICAgICAgLy8gPC0gdmFsdWVcclxuICAgICAgICBwOiBwcmV2ID0gdGhhdFtMQVNUXSwgICAgICAgICAgLy8gPC0gcHJldmlvdXMgZW50cnlcclxuICAgICAgICBuOiB1bmRlZmluZWQsICAgICAgICAgICAgICAgICAgLy8gPC0gbmV4dCBlbnRyeVxyXG4gICAgICAgIHI6IGZhbHNlICAgICAgICAgICAgICAgICAgICAgICAvLyA8LSByZW1vdmVkXHJcbiAgICAgIH07XHJcbiAgICAgIGlmKCF0aGF0W0ZJUlNUXSl0aGF0W0ZJUlNUXSA9IGVudHJ5O1xyXG4gICAgICBpZihwcmV2KXByZXYubiA9IGVudHJ5O1xyXG4gICAgICB0aGF0W1NJWkVdKys7XHJcbiAgICAgIC8vIGFkZCB0byBpbmRleFxyXG4gICAgICBpZihpbmRleCAhPSAnRicpdGhhdFtPMV1baW5kZXhdID0gZW50cnk7XHJcbiAgICB9IHJldHVybiB0aGF0O1xyXG4gIH1cclxuXHJcbiAgdmFyIGNvbGxlY3Rpb25NZXRob2RzID0ge1xyXG4gICAgLy8gMjMuMS4zLjEgTWFwLnByb3RvdHlwZS5jbGVhcigpXHJcbiAgICAvLyAyMy4yLjMuMiBTZXQucHJvdG90eXBlLmNsZWFyKClcclxuICAgIGNsZWFyOiBmdW5jdGlvbigpe1xyXG4gICAgICBmb3IodmFyIHRoYXQgPSB0aGlzLCBkYXRhID0gdGhhdFtPMV0sIGVudHJ5ID0gdGhhdFtGSVJTVF07IGVudHJ5OyBlbnRyeSA9IGVudHJ5Lm4pe1xyXG4gICAgICAgIGVudHJ5LnIgPSB0cnVlO1xyXG4gICAgICAgIGlmKGVudHJ5LnApZW50cnkucCA9IGVudHJ5LnAubiA9IHVuZGVmaW5lZDtcclxuICAgICAgICBkZWxldGUgZGF0YVtlbnRyeS5pXTtcclxuICAgICAgfVxyXG4gICAgICB0aGF0W0ZJUlNUXSA9IHRoYXRbTEFTVF0gPSB1bmRlZmluZWQ7XHJcbiAgICAgIHRoYXRbU0laRV0gPSAwO1xyXG4gICAgfSxcclxuICAgIC8vIDIzLjEuMy4zIE1hcC5wcm90b3R5cGUuZGVsZXRlKGtleSlcclxuICAgIC8vIDIzLjIuMy40IFNldC5wcm90b3R5cGUuZGVsZXRlKHZhbHVlKVxyXG4gICAgJ2RlbGV0ZSc6IGZ1bmN0aW9uKGtleSl7XHJcbiAgICAgIHZhciB0aGF0ICA9IHRoaXNcclxuICAgICAgICAsIGVudHJ5ID0gZ2V0RW50cnkodGhhdCwga2V5KTtcclxuICAgICAgaWYoZW50cnkpe1xyXG4gICAgICAgIHZhciBuZXh0ID0gZW50cnkublxyXG4gICAgICAgICAgLCBwcmV2ID0gZW50cnkucDtcclxuICAgICAgICBkZWxldGUgdGhhdFtPMV1bZW50cnkuaV07XHJcbiAgICAgICAgZW50cnkuciA9IHRydWU7XHJcbiAgICAgICAgaWYocHJldilwcmV2Lm4gPSBuZXh0O1xyXG4gICAgICAgIGlmKG5leHQpbmV4dC5wID0gcHJldjtcclxuICAgICAgICBpZih0aGF0W0ZJUlNUXSA9PSBlbnRyeSl0aGF0W0ZJUlNUXSA9IG5leHQ7XHJcbiAgICAgICAgaWYodGhhdFtMQVNUXSA9PSBlbnRyeSl0aGF0W0xBU1RdID0gcHJldjtcclxuICAgICAgICB0aGF0W1NJWkVdLS07XHJcbiAgICAgIH0gcmV0dXJuICEhZW50cnk7XHJcbiAgICB9LFxyXG4gICAgLy8gMjMuMi4zLjYgU2V0LnByb3RvdHlwZS5mb3JFYWNoKGNhbGxiYWNrZm4sIHRoaXNBcmcgPSB1bmRlZmluZWQpXHJcbiAgICAvLyAyMy4xLjMuNSBNYXAucHJvdG90eXBlLmZvckVhY2goY2FsbGJhY2tmbiwgdGhpc0FyZyA9IHVuZGVmaW5lZClcclxuICAgIGZvckVhY2g6IGZ1bmN0aW9uKGNhbGxiYWNrZm4gLyosIHRoYXQgPSB1bmRlZmluZWQgKi8pe1xyXG4gICAgICB2YXIgZiA9IGN0eChjYWxsYmFja2ZuLCBhcmd1bWVudHNbMV0sIDMpXHJcbiAgICAgICAgLCBlbnRyeTtcclxuICAgICAgd2hpbGUoZW50cnkgPSBlbnRyeSA/IGVudHJ5Lm4gOiB0aGlzW0ZJUlNUXSl7XHJcbiAgICAgICAgZihlbnRyeS52LCBlbnRyeS5rLCB0aGlzKTtcclxuICAgICAgICAvLyByZXZlcnQgdG8gdGhlIGxhc3QgZXhpc3RpbmcgZW50cnlcclxuICAgICAgICB3aGlsZShlbnRyeSAmJiBlbnRyeS5yKWVudHJ5ID0gZW50cnkucDtcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIC8vIDIzLjEuMy43IE1hcC5wcm90b3R5cGUuaGFzKGtleSlcclxuICAgIC8vIDIzLjIuMy43IFNldC5wcm90b3R5cGUuaGFzKHZhbHVlKVxyXG4gICAgaGFzOiBmdW5jdGlvbihrZXkpe1xyXG4gICAgICByZXR1cm4gISFnZXRFbnRyeSh0aGlzLCBrZXkpO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvLyAyMy4xIE1hcCBPYmplY3RzXHJcbiAgTWFwID0gZ2V0Q29sbGVjdGlvbihNYXAsIE1BUCwge1xyXG4gICAgLy8gMjMuMS4zLjYgTWFwLnByb3RvdHlwZS5nZXQoa2V5KVxyXG4gICAgZ2V0OiBmdW5jdGlvbihrZXkpe1xyXG4gICAgICB2YXIgZW50cnkgPSBnZXRFbnRyeSh0aGlzLCBrZXkpO1xyXG4gICAgICByZXR1cm4gZW50cnkgJiYgZW50cnkudjtcclxuICAgIH0sXHJcbiAgICAvLyAyMy4xLjMuOSBNYXAucHJvdG90eXBlLnNldChrZXksIHZhbHVlKVxyXG4gICAgc2V0OiBmdW5jdGlvbihrZXksIHZhbHVlKXtcclxuICAgICAgcmV0dXJuIGRlZih0aGlzLCBrZXkgPT09IDAgPyAwIDoga2V5LCB2YWx1ZSk7XHJcbiAgICB9XHJcbiAgfSwgY29sbGVjdGlvbk1ldGhvZHMsIHRydWUpO1xyXG4gIFxyXG4gIC8vIDIzLjIgU2V0IE9iamVjdHNcclxuICBTZXQgPSBnZXRDb2xsZWN0aW9uKFNldCwgU0VULCB7XHJcbiAgICAvLyAyMy4yLjMuMSBTZXQucHJvdG90eXBlLmFkZCh2YWx1ZSlcclxuICAgIGFkZDogZnVuY3Rpb24odmFsdWUpe1xyXG4gICAgICByZXR1cm4gZGVmKHRoaXMsIHZhbHVlID0gdmFsdWUgPT09IDAgPyAwIDogdmFsdWUsIHZhbHVlKTtcclxuICAgIH1cclxuICB9LCBjb2xsZWN0aW9uTWV0aG9kcyk7XHJcbiAgXHJcbiAgZnVuY3Rpb24gZGVmV2Vhayh0aGF0LCBrZXksIHZhbHVlKXtcclxuICAgIGlmKGlzRnJvemVuKGFzc2VydE9iamVjdChrZXkpKSlsZWFrU3RvcmUodGhhdCkuc2V0KGtleSwgdmFsdWUpO1xyXG4gICAgZWxzZSB7XHJcbiAgICAgIGhhcyhrZXksIFdFQUspIHx8IGhpZGRlbihrZXksIFdFQUssIHt9KTtcclxuICAgICAga2V5W1dFQUtdW3RoYXRbVUlEXV0gPSB2YWx1ZTtcclxuICAgIH0gcmV0dXJuIHRoYXQ7XHJcbiAgfVxyXG4gIGZ1bmN0aW9uIGxlYWtTdG9yZSh0aGF0KXtcclxuICAgIHJldHVybiB0aGF0W0xFQUtdIHx8IGhpZGRlbih0aGF0LCBMRUFLLCBuZXcgTWFwKVtMRUFLXTtcclxuICB9XHJcbiAgXHJcbiAgdmFyIHdlYWtNZXRob2RzID0ge1xyXG4gICAgLy8gMjMuMy4zLjIgV2Vha01hcC5wcm90b3R5cGUuZGVsZXRlKGtleSlcclxuICAgIC8vIDIzLjQuMy4zIFdlYWtTZXQucHJvdG90eXBlLmRlbGV0ZSh2YWx1ZSlcclxuICAgICdkZWxldGUnOiBmdW5jdGlvbihrZXkpe1xyXG4gICAgICBpZighaXNPYmplY3Qoa2V5KSlyZXR1cm4gZmFsc2U7XHJcbiAgICAgIGlmKGlzRnJvemVuKGtleSkpcmV0dXJuIGxlYWtTdG9yZSh0aGlzKVsnZGVsZXRlJ10oa2V5KTtcclxuICAgICAgcmV0dXJuIGhhcyhrZXksIFdFQUspICYmIGhhcyhrZXlbV0VBS10sIHRoaXNbVUlEXSkgJiYgZGVsZXRlIGtleVtXRUFLXVt0aGlzW1VJRF1dO1xyXG4gICAgfSxcclxuICAgIC8vIDIzLjMuMy40IFdlYWtNYXAucHJvdG90eXBlLmhhcyhrZXkpXHJcbiAgICAvLyAyMy40LjMuNCBXZWFrU2V0LnByb3RvdHlwZS5oYXModmFsdWUpXHJcbiAgICBoYXM6IGZ1bmN0aW9uKGtleSl7XHJcbiAgICAgIGlmKCFpc09iamVjdChrZXkpKXJldHVybiBmYWxzZTtcclxuICAgICAgaWYoaXNGcm96ZW4oa2V5KSlyZXR1cm4gbGVha1N0b3JlKHRoaXMpLmhhcyhrZXkpO1xyXG4gICAgICByZXR1cm4gaGFzKGtleSwgV0VBSykgJiYgaGFzKGtleVtXRUFLXSwgdGhpc1tVSURdKTtcclxuICAgIH1cclxuICB9O1xyXG4gIFxyXG4gIC8vIDIzLjMgV2Vha01hcCBPYmplY3RzXHJcbiAgV2Vha01hcCA9IGdldENvbGxlY3Rpb24oV2Vha01hcCwgV0VBS01BUCwge1xyXG4gICAgLy8gMjMuMy4zLjMgV2Vha01hcC5wcm90b3R5cGUuZ2V0KGtleSlcclxuICAgIGdldDogZnVuY3Rpb24oa2V5KXtcclxuICAgICAgaWYoaXNPYmplY3Qoa2V5KSl7XHJcbiAgICAgICAgaWYoaXNGcm96ZW4oa2V5KSlyZXR1cm4gbGVha1N0b3JlKHRoaXMpLmdldChrZXkpO1xyXG4gICAgICAgIGlmKGhhcyhrZXksIFdFQUspKXJldHVybiBrZXlbV0VBS11bdGhpc1tVSURdXTtcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIC8vIDIzLjMuMy41IFdlYWtNYXAucHJvdG90eXBlLnNldChrZXksIHZhbHVlKVxyXG4gICAgc2V0OiBmdW5jdGlvbihrZXksIHZhbHVlKXtcclxuICAgICAgcmV0dXJuIGRlZldlYWsodGhpcywga2V5LCB2YWx1ZSk7XHJcbiAgICB9XHJcbiAgfSwgd2Vha01ldGhvZHMsIHRydWUsIHRydWUpO1xyXG4gIFxyXG4gIC8vIElFMTEgV2Vha01hcCBmcm96ZW4ga2V5cyBmaXhcclxuICBpZihmcmFtZXdvcmsgJiYgbmV3IFdlYWtNYXAoKS5zZXQoT2JqZWN0LmZyZWV6ZSh0bXApLCA3KS5nZXQodG1wKSAhPSA3KXtcclxuICAgIGZvckVhY2guY2FsbChhcnJheSgnZGVsZXRlLGhhcyxnZXQsc2V0JyksIGZ1bmN0aW9uKGtleSl7XHJcbiAgICAgIHZhciBtZXRob2QgPSBXZWFrTWFwW1BST1RPVFlQRV1ba2V5XTtcclxuICAgICAgV2Vha01hcFtQUk9UT1RZUEVdW2tleV0gPSBmdW5jdGlvbihhLCBiKXtcclxuICAgICAgICAvLyBzdG9yZSBmcm96ZW4gb2JqZWN0cyBvbiBsZWFreSBtYXBcclxuICAgICAgICBpZihpc09iamVjdChhKSAmJiBpc0Zyb3plbihhKSl7XHJcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gbGVha1N0b3JlKHRoaXMpW2tleV0oYSwgYik7XHJcbiAgICAgICAgICByZXR1cm4ga2V5ID09ICdzZXQnID8gdGhpcyA6IHJlc3VsdDtcclxuICAgICAgICAvLyBzdG9yZSBhbGwgdGhlIHJlc3Qgb24gbmF0aXZlIHdlYWttYXBcclxuICAgICAgICB9IHJldHVybiBtZXRob2QuY2FsbCh0aGlzLCBhLCBiKTtcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG4gIH1cclxuICBcclxuICAvLyAyMy40IFdlYWtTZXQgT2JqZWN0c1xyXG4gIFdlYWtTZXQgPSBnZXRDb2xsZWN0aW9uKFdlYWtTZXQsIFdFQUtTRVQsIHtcclxuICAgIC8vIDIzLjQuMy4xIFdlYWtTZXQucHJvdG90eXBlLmFkZCh2YWx1ZSlcclxuICAgIGFkZDogZnVuY3Rpb24odmFsdWUpe1xyXG4gICAgICByZXR1cm4gZGVmV2Vhayh0aGlzLCB2YWx1ZSwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgfSwgd2Vha01ldGhvZHMsIGZhbHNlLCB0cnVlKTtcclxufSgpO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBlczYucmVmbGVjdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4hZnVuY3Rpb24oKXtcclxuICBmdW5jdGlvbiBFbnVtZXJhdGUoaXRlcmF0ZWQpe1xyXG4gICAgdmFyIGtleXMgPSBbXSwga2V5O1xyXG4gICAgZm9yKGtleSBpbiBpdGVyYXRlZClrZXlzLnB1c2goa2V5KTtcclxuICAgIHNldCh0aGlzLCBJVEVSLCB7bzogaXRlcmF0ZWQsIGE6IGtleXMsIGk6IDB9KTtcclxuICB9XHJcbiAgY3JlYXRlSXRlcmF0b3IoRW51bWVyYXRlLCBPQkpFQ1QsIGZ1bmN0aW9uKCl7XHJcbiAgICB2YXIgaXRlciA9IHRoaXNbSVRFUl1cclxuICAgICAgLCBrZXlzID0gaXRlci5hXHJcbiAgICAgICwga2V5O1xyXG4gICAgZG8ge1xyXG4gICAgICBpZihpdGVyLmkgPj0ga2V5cy5sZW5ndGgpcmV0dXJuIGl0ZXJSZXN1bHQoMSk7XHJcbiAgICB9IHdoaWxlKCEoKGtleSA9IGtleXNbaXRlci5pKytdKSBpbiBpdGVyLm8pKTtcclxuICAgIHJldHVybiBpdGVyUmVzdWx0KDAsIGtleSk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgZnVuY3Rpb24gd3JhcChmbil7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oaXQpe1xyXG4gICAgICBhc3NlcnRPYmplY3QoaXQpO1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIHJldHVybiBmbi5hcHBseSh1bmRlZmluZWQsIGFyZ3VtZW50cyksIHRydWU7XHJcbiAgICAgIH0gY2F0Y2goZSl7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIGZ1bmN0aW9uIHJlZmxlY3RHZXQodGFyZ2V0LCBwcm9wZXJ0eUtleS8qLCByZWNlaXZlciovKXtcclxuICAgIHZhciByZWNlaXZlciA9IGFyZ3VtZW50cy5sZW5ndGggPCAzID8gdGFyZ2V0IDogYXJndW1lbnRzWzJdXHJcbiAgICAgICwgZGVzYyA9IGdldE93bkRlc2NyaXB0b3IoYXNzZXJ0T2JqZWN0KHRhcmdldCksIHByb3BlcnR5S2V5KSwgcHJvdG87XHJcbiAgICBpZihkZXNjKXJldHVybiBoYXMoZGVzYywgJ3ZhbHVlJylcclxuICAgICAgPyBkZXNjLnZhbHVlXHJcbiAgICAgIDogZGVzYy5nZXQgPT09IHVuZGVmaW5lZFxyXG4gICAgICAgID8gdW5kZWZpbmVkXHJcbiAgICAgICAgOiBkZXNjLmdldC5jYWxsKHJlY2VpdmVyKTtcclxuICAgIHJldHVybiBpc09iamVjdChwcm90byA9IGdldFByb3RvdHlwZU9mKHRhcmdldCkpXHJcbiAgICAgID8gcmVmbGVjdEdldChwcm90bywgcHJvcGVydHlLZXksIHJlY2VpdmVyKVxyXG4gICAgICA6IHVuZGVmaW5lZDtcclxuICB9XHJcbiAgZnVuY3Rpb24gcmVmbGVjdFNldCh0YXJnZXQsIHByb3BlcnR5S2V5LCBWLyosIHJlY2VpdmVyKi8pe1xyXG4gICAgdmFyIHJlY2VpdmVyID0gYXJndW1lbnRzLmxlbmd0aCA8IDQgPyB0YXJnZXQgOiBhcmd1bWVudHNbM11cclxuICAgICAgLCBvd25EZXNjICA9IGdldE93bkRlc2NyaXB0b3IoYXNzZXJ0T2JqZWN0KHRhcmdldCksIHByb3BlcnR5S2V5KVxyXG4gICAgICAsIGV4aXN0aW5nRGVzY3JpcHRvciwgcHJvdG87XHJcbiAgICBpZighb3duRGVzYyl7XHJcbiAgICAgIGlmKGlzT2JqZWN0KHByb3RvID0gZ2V0UHJvdG90eXBlT2YodGFyZ2V0KSkpe1xyXG4gICAgICAgIHJldHVybiByZWZsZWN0U2V0KHByb3RvLCBwcm9wZXJ0eUtleSwgViwgcmVjZWl2ZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIG93bkRlc2MgPSBkZXNjcmlwdG9yKDApO1xyXG4gICAgfVxyXG4gICAgaWYoaGFzKG93bkRlc2MsICd2YWx1ZScpKXtcclxuICAgICAgaWYob3duRGVzYy53cml0YWJsZSA9PT0gZmFsc2UgfHwgIWlzT2JqZWN0KHJlY2VpdmVyKSlyZXR1cm4gZmFsc2U7XHJcbiAgICAgIGV4aXN0aW5nRGVzY3JpcHRvciA9IGdldE93bkRlc2NyaXB0b3IocmVjZWl2ZXIsIHByb3BlcnR5S2V5KSB8fCBkZXNjcmlwdG9yKDApO1xyXG4gICAgICBleGlzdGluZ0Rlc2NyaXB0b3IudmFsdWUgPSBWO1xyXG4gICAgICByZXR1cm4gZGVmaW5lUHJvcGVydHkocmVjZWl2ZXIsIHByb3BlcnR5S2V5LCBleGlzdGluZ0Rlc2NyaXB0b3IpLCB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG93bkRlc2Muc2V0ID09PSB1bmRlZmluZWRcclxuICAgICAgPyBmYWxzZVxyXG4gICAgICA6IChvd25EZXNjLnNldC5jYWxsKHJlY2VpdmVyLCBWKSwgdHJ1ZSk7XHJcbiAgfVxyXG4gIHZhciBpc0V4dGVuc2libGUgPSBPYmplY3QuaXNFeHRlbnNpYmxlIHx8IHJldHVybkl0O1xyXG4gIFxyXG4gIHZhciByZWZsZWN0ID0ge1xyXG4gICAgLy8gMjYuMS4xIFJlZmxlY3QuYXBwbHkodGFyZ2V0LCB0aGlzQXJndW1lbnQsIGFyZ3VtZW50c0xpc3QpXHJcbiAgICBhcHBseTogY3R4KGNhbGwsIGFwcGx5LCAzKSxcclxuICAgIC8vIDI2LjEuMiBSZWZsZWN0LmNvbnN0cnVjdCh0YXJnZXQsIGFyZ3VtZW50c0xpc3QgWywgbmV3VGFyZ2V0XSlcclxuICAgIGNvbnN0cnVjdDogZnVuY3Rpb24odGFyZ2V0LCBhcmd1bWVudHNMaXN0IC8qLCBuZXdUYXJnZXQqLyl7XHJcbiAgICAgIHZhciBwcm90byAgICA9IGFzc2VydEZ1bmN0aW9uKGFyZ3VtZW50cy5sZW5ndGggPCAzID8gdGFyZ2V0IDogYXJndW1lbnRzWzJdKVtQUk9UT1RZUEVdXHJcbiAgICAgICAgLCBpbnN0YW5jZSA9IGNyZWF0ZShpc09iamVjdChwcm90bykgPyBwcm90byA6IE9iamVjdFByb3RvKVxyXG4gICAgICAgICwgcmVzdWx0ICAgPSBhcHBseS5jYWxsKHRhcmdldCwgaW5zdGFuY2UsIGFyZ3VtZW50c0xpc3QpO1xyXG4gICAgICByZXR1cm4gaXNPYmplY3QocmVzdWx0KSA/IHJlc3VsdCA6IGluc3RhbmNlO1xyXG4gICAgfSxcclxuICAgIC8vIDI2LjEuMyBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgcHJvcGVydHlLZXksIGF0dHJpYnV0ZXMpXHJcbiAgICBkZWZpbmVQcm9wZXJ0eTogd3JhcChkZWZpbmVQcm9wZXJ0eSksXHJcbiAgICAvLyAyNi4xLjQgUmVmbGVjdC5kZWxldGVQcm9wZXJ0eSh0YXJnZXQsIHByb3BlcnR5S2V5KVxyXG4gICAgZGVsZXRlUHJvcGVydHk6IGZ1bmN0aW9uKHRhcmdldCwgcHJvcGVydHlLZXkpe1xyXG4gICAgICB2YXIgZGVzYyA9IGdldE93bkRlc2NyaXB0b3IoYXNzZXJ0T2JqZWN0KHRhcmdldCksIHByb3BlcnR5S2V5KTtcclxuICAgICAgcmV0dXJuIGRlc2MgJiYgIWRlc2MuY29uZmlndXJhYmxlID8gZmFsc2UgOiBkZWxldGUgdGFyZ2V0W3Byb3BlcnR5S2V5XTtcclxuICAgIH0sXHJcbiAgICAvLyAyNi4xLjUgUmVmbGVjdC5lbnVtZXJhdGUodGFyZ2V0KVxyXG4gICAgZW51bWVyYXRlOiBmdW5jdGlvbih0YXJnZXQpe1xyXG4gICAgICByZXR1cm4gbmV3IEVudW1lcmF0ZShhc3NlcnRPYmplY3QodGFyZ2V0KSk7XHJcbiAgICB9LFxyXG4gICAgLy8gMjYuMS42IFJlZmxlY3QuZ2V0KHRhcmdldCwgcHJvcGVydHlLZXkgWywgcmVjZWl2ZXJdKVxyXG4gICAgZ2V0OiByZWZsZWN0R2V0LFxyXG4gICAgLy8gMjYuMS43IFJlZmxlY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgcHJvcGVydHlLZXkpXHJcbiAgICBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I6IGZ1bmN0aW9uKHRhcmdldCwgcHJvcGVydHlLZXkpe1xyXG4gICAgICByZXR1cm4gZ2V0T3duRGVzY3JpcHRvcihhc3NlcnRPYmplY3QodGFyZ2V0KSwgcHJvcGVydHlLZXkpO1xyXG4gICAgfSxcclxuICAgIC8vIDI2LjEuOCBSZWZsZWN0LmdldFByb3RvdHlwZU9mKHRhcmdldClcclxuICAgIGdldFByb3RvdHlwZU9mOiBmdW5jdGlvbih0YXJnZXQpe1xyXG4gICAgICByZXR1cm4gZ2V0UHJvdG90eXBlT2YoYXNzZXJ0T2JqZWN0KHRhcmdldCkpO1xyXG4gICAgfSxcclxuICAgIC8vIDI2LjEuOSBSZWZsZWN0Lmhhcyh0YXJnZXQsIHByb3BlcnR5S2V5KVxyXG4gICAgaGFzOiBmdW5jdGlvbih0YXJnZXQsIHByb3BlcnR5S2V5KXtcclxuICAgICAgcmV0dXJuIHByb3BlcnR5S2V5IGluIHRhcmdldDtcclxuICAgIH0sXHJcbiAgICAvLyAyNi4xLjEwIFJlZmxlY3QuaXNFeHRlbnNpYmxlKHRhcmdldClcclxuICAgIGlzRXh0ZW5zaWJsZTogZnVuY3Rpb24odGFyZ2V0KXtcclxuICAgICAgcmV0dXJuICEhaXNFeHRlbnNpYmxlKGFzc2VydE9iamVjdCh0YXJnZXQpKTtcclxuICAgIH0sXHJcbiAgICAvLyAyNi4xLjExIFJlZmxlY3Qub3duS2V5cyh0YXJnZXQpXHJcbiAgICBvd25LZXlzOiBvd25LZXlzLFxyXG4gICAgLy8gMjYuMS4xMiBSZWZsZWN0LnByZXZlbnRFeHRlbnNpb25zKHRhcmdldClcclxuICAgIHByZXZlbnRFeHRlbnNpb25zOiB3cmFwKE9iamVjdC5wcmV2ZW50RXh0ZW5zaW9ucyB8fCByZXR1cm5JdCksXHJcbiAgICAvLyAyNi4xLjEzIFJlZmxlY3Quc2V0KHRhcmdldCwgcHJvcGVydHlLZXksIFYgWywgcmVjZWl2ZXJdKVxyXG4gICAgc2V0OiByZWZsZWN0U2V0XHJcbiAgfVxyXG4gIC8vIDI2LjEuMTQgUmVmbGVjdC5zZXRQcm90b3R5cGVPZih0YXJnZXQsIHByb3RvKVxyXG4gIGlmKHNldFByb3RvdHlwZU9mKXJlZmxlY3Quc2V0UHJvdG90eXBlT2YgPSBmdW5jdGlvbih0YXJnZXQsIHByb3RvKXtcclxuICAgIHJldHVybiBzZXRQcm90b3R5cGVPZihhc3NlcnRPYmplY3QodGFyZ2V0KSwgcHJvdG8pLCB0cnVlO1xyXG4gIH07XHJcbiAgXHJcbiAgJGRlZmluZShHTE9CQUwsIHtSZWZsZWN0OiB7fX0pO1xyXG4gICRkZWZpbmUoU1RBVElDLCAnUmVmbGVjdCcsIHJlZmxlY3QpO1xyXG59KCk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGVzNy5wcm9wb3NhbHMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbigpe1xyXG4gICRkZWZpbmUoUFJPVE8sIEFSUkFZLCB7XHJcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZG9tZW5pYy9BcnJheS5wcm90b3R5cGUuaW5jbHVkZXNcclxuICAgIGluY2x1ZGVzOiBjcmVhdGVBcnJheUNvbnRhaW5zKHRydWUpXHJcbiAgfSk7XHJcbiAgJGRlZmluZShQUk9UTywgU1RSSU5HLCB7XHJcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWF0aGlhc2J5bmVucy9TdHJpbmcucHJvdG90eXBlLmF0XHJcbiAgICBhdDogY3JlYXRlUG9pbnRBdCh0cnVlKVxyXG4gIH0pO1xyXG4gIFxyXG4gIGZ1bmN0aW9uIGNyZWF0ZU9iamVjdFRvQXJyYXkoaXNFbnRyaWVzKXtcclxuICAgIHJldHVybiBmdW5jdGlvbihvYmplY3Qpe1xyXG4gICAgICB2YXIgTyAgICAgID0gdG9PYmplY3Qob2JqZWN0KVxyXG4gICAgICAgICwga2V5cyAgID0gZ2V0S2V5cyhvYmplY3QpXHJcbiAgICAgICAgLCBsZW5ndGggPSBrZXlzLmxlbmd0aFxyXG4gICAgICAgICwgaSAgICAgID0gMFxyXG4gICAgICAgICwgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKVxyXG4gICAgICAgICwga2V5O1xyXG4gICAgICBpZihpc0VudHJpZXMpd2hpbGUobGVuZ3RoID4gaSlyZXN1bHRbaV0gPSBba2V5ID0ga2V5c1tpKytdLCBPW2tleV1dO1xyXG4gICAgICBlbHNlIHdoaWxlKGxlbmd0aCA+IGkpcmVzdWx0W2ldID0gT1trZXlzW2krK11dO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG4gIH1cclxuICAkZGVmaW5lKFNUQVRJQywgT0JKRUNULCB7XHJcbiAgICAvLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9XZWJSZWZsZWN0aW9uLzkzNTM3ODFcclxuICAgIGdldE93blByb3BlcnR5RGVzY3JpcHRvcnM6IGZ1bmN0aW9uKG9iamVjdCl7XHJcbiAgICAgIHZhciBPICAgICAgPSB0b09iamVjdChvYmplY3QpXHJcbiAgICAgICAgLCByZXN1bHQgPSB7fTtcclxuICAgICAgZm9yRWFjaC5jYWxsKG93bktleXMoTyksIGZ1bmN0aW9uKGtleSl7XHJcbiAgICAgICAgZGVmaW5lUHJvcGVydHkocmVzdWx0LCBrZXksIGRlc2NyaXB0b3IoMCwgZ2V0T3duRGVzY3JpcHRvcihPLCBrZXkpKSk7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfSxcclxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9yd2FsZHJvbi90YzM5LW5vdGVzL2Jsb2IvbWFzdGVyL2VzNi8yMDE0LTA0L2Fwci05Lm1kIzUxLW9iamVjdGVudHJpZXMtb2JqZWN0dmFsdWVzXHJcbiAgICB2YWx1ZXM6ICBjcmVhdGVPYmplY3RUb0FycmF5KGZhbHNlKSxcclxuICAgIGVudHJpZXM6IGNyZWF0ZU9iamVjdFRvQXJyYXkodHJ1ZSlcclxuICB9KTtcclxuICAkZGVmaW5lKFNUQVRJQywgUkVHRVhQLCB7XHJcbiAgICAvLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9rYW5nYXgvOTY5ODEwMFxyXG4gICAgZXNjYXBlOiBjcmVhdGVSZXBsYWNlcigvKFtcXFxcXFwtW1xcXXt9KCkqKz8uLF4kfF0pL2csICdcXFxcJDEnLCB0cnVlKVxyXG4gIH0pO1xyXG59KCk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGVzNy5hYnN0cmFjdC1yZWZzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS96ZW5wYXJzaW5nL2VzLWFic3RyYWN0LXJlZnNcclxuIWZ1bmN0aW9uKFJFRkVSRU5DRSl7XHJcbiAgUkVGRVJFTkNFX0dFVCA9IGdldFdlbGxLbm93blN5bWJvbChSRUZFUkVOQ0UrJ0dldCcsIHRydWUpO1xyXG4gIHZhciBSRUZFUkVOQ0VfU0VUID0gZ2V0V2VsbEtub3duU3ltYm9sKFJFRkVSRU5DRStTRVQsIHRydWUpXHJcbiAgICAsIFJFRkVSRU5DRV9ERUxFVEUgPSBnZXRXZWxsS25vd25TeW1ib2woUkVGRVJFTkNFKydEZWxldGUnLCB0cnVlKTtcclxuICBcclxuICAkZGVmaW5lKFNUQVRJQywgU1lNQk9MLCB7XHJcbiAgICByZWZlcmVuY2VHZXQ6IFJFRkVSRU5DRV9HRVQsXHJcbiAgICByZWZlcmVuY2VTZXQ6IFJFRkVSRU5DRV9TRVQsXHJcbiAgICByZWZlcmVuY2VEZWxldGU6IFJFRkVSRU5DRV9ERUxFVEVcclxuICB9KTtcclxuICBcclxuICBoaWRkZW4oRnVuY3Rpb25Qcm90bywgUkVGRVJFTkNFX0dFVCwgcmV0dXJuVGhpcyk7XHJcbiAgXHJcbiAgZnVuY3Rpb24gc2V0TWFwTWV0aG9kcyhDb25zdHJ1Y3Rvcil7XHJcbiAgICBpZihDb25zdHJ1Y3Rvcil7XHJcbiAgICAgIHZhciBNYXBQcm90byA9IENvbnN0cnVjdG9yW1BST1RPVFlQRV07XHJcbiAgICAgIGhpZGRlbihNYXBQcm90bywgUkVGRVJFTkNFX0dFVCwgTWFwUHJvdG8uZ2V0KTtcclxuICAgICAgaGlkZGVuKE1hcFByb3RvLCBSRUZFUkVOQ0VfU0VULCBNYXBQcm90by5zZXQpO1xyXG4gICAgICBoaWRkZW4oTWFwUHJvdG8sIFJFRkVSRU5DRV9ERUxFVEUsIE1hcFByb3RvWydkZWxldGUnXSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHNldE1hcE1ldGhvZHMoTWFwKTtcclxuICBzZXRNYXBNZXRob2RzKFdlYWtNYXApO1xyXG59KCdyZWZlcmVuY2UnKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogY29yZS5kaWN0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuIWZ1bmN0aW9uKERJQ1Qpe1xyXG4gIERpY3QgPSBmdW5jdGlvbihpdGVyYWJsZSl7XHJcbiAgICB2YXIgZGljdCA9IGNyZWF0ZShudWxsKTtcclxuICAgIGlmKGl0ZXJhYmxlICE9IHVuZGVmaW5lZCl7XHJcbiAgICAgIGlmKGlzSXRlcmFibGUoaXRlcmFibGUpKXtcclxuICAgICAgICBmb3JPZihpdGVyYWJsZSwgdHJ1ZSwgZnVuY3Rpb24oa2V5LCB2YWx1ZSl7XHJcbiAgICAgICAgICBkaWN0W2tleV0gPSB2YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSBlbHNlIGFzc2lnbihkaWN0LCBpdGVyYWJsZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZGljdDtcclxuICB9XHJcbiAgRGljdFtQUk9UT1RZUEVdID0gbnVsbDtcclxuICBcclxuICBmdW5jdGlvbiBEaWN0SXRlcmF0b3IoaXRlcmF0ZWQsIGtpbmQpe1xyXG4gICAgc2V0KHRoaXMsIElURVIsIHtvOiB0b09iamVjdChpdGVyYXRlZCksIGE6IGdldEtleXMoaXRlcmF0ZWQpLCBpOiAwLCBrOiBraW5kfSk7XHJcbiAgfVxyXG4gIGNyZWF0ZUl0ZXJhdG9yKERpY3RJdGVyYXRvciwgRElDVCwgZnVuY3Rpb24oKXtcclxuICAgIHZhciBpdGVyID0gdGhpc1tJVEVSXVxyXG4gICAgICAsIE8gICAgPSBpdGVyLm9cclxuICAgICAgLCBrZXlzID0gaXRlci5hXHJcbiAgICAgICwga2luZCA9IGl0ZXIua1xyXG4gICAgICAsIGtleTtcclxuICAgIGRvIHtcclxuICAgICAgaWYoaXRlci5pID49IGtleXMubGVuZ3RoKXtcclxuICAgICAgICBpdGVyLm8gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgcmV0dXJuIGl0ZXJSZXN1bHQoMSk7XHJcbiAgICAgIH1cclxuICAgIH0gd2hpbGUoIWhhcyhPLCBrZXkgPSBrZXlzW2l0ZXIuaSsrXSkpO1xyXG4gICAgaWYoa2luZCA9PSBLRVkpICByZXR1cm4gaXRlclJlc3VsdCgwLCBrZXkpO1xyXG4gICAgaWYoa2luZCA9PSBWQUxVRSlyZXR1cm4gaXRlclJlc3VsdCgwLCBPW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlclJlc3VsdCgwLCBba2V5LCBPW2tleV1dKTtcclxuICB9KTtcclxuICBmdW5jdGlvbiBjcmVhdGVEaWN0SXRlcihraW5kKXtcclxuICAgIHJldHVybiBmdW5jdGlvbihpdCl7XHJcbiAgICAgIHJldHVybiBuZXcgRGljdEl0ZXJhdG9yKGl0LCBraW5kKTtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLypcclxuICAgKiAwIC0+IGZvckVhY2hcclxuICAgKiAxIC0+IG1hcFxyXG4gICAqIDIgLT4gZmlsdGVyXHJcbiAgICogMyAtPiBzb21lXHJcbiAgICogNCAtPiBldmVyeVxyXG4gICAqIDUgLT4gZmluZFxyXG4gICAqIDYgLT4gZmluZEtleVxyXG4gICAqIDcgLT4gbWFwUGFpcnNcclxuICAgKi9cclxuICBmdW5jdGlvbiBjcmVhdGVEaWN0TWV0aG9kKHR5cGUpe1xyXG4gICAgdmFyIGlzTWFwICAgID0gdHlwZSA9PSAxXHJcbiAgICAgICwgaXNFdmVyeSAgPSB0eXBlID09IDQ7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0LCBjYWxsYmFja2ZuLCB0aGF0IC8qID0gdW5kZWZpbmVkICovKXtcclxuICAgICAgdmFyIGYgICAgICA9IGN0eChjYWxsYmFja2ZuLCB0aGF0LCAzKVxyXG4gICAgICAgICwgTyAgICAgID0gdG9PYmplY3Qob2JqZWN0KVxyXG4gICAgICAgICwgcmVzdWx0ID0gaXNNYXAgfHwgdHlwZSA9PSA3IHx8IHR5cGUgPT0gMiA/IG5ldyAoZ2VuZXJpYyh0aGlzLCBEaWN0KSkgOiB1bmRlZmluZWRcclxuICAgICAgICAsIGtleSwgdmFsLCByZXM7XHJcbiAgICAgIGZvcihrZXkgaW4gTylpZihoYXMoTywga2V5KSl7XHJcbiAgICAgICAgdmFsID0gT1trZXldO1xyXG4gICAgICAgIHJlcyA9IGYodmFsLCBrZXksIG9iamVjdCk7XHJcbiAgICAgICAgaWYodHlwZSl7XHJcbiAgICAgICAgICBpZihpc01hcClyZXN1bHRba2V5XSA9IHJlczsgICAgICAgICAgICAgLy8gbWFwXHJcbiAgICAgICAgICBlbHNlIGlmKHJlcylzd2l0Y2godHlwZSl7XHJcbiAgICAgICAgICAgIGNhc2UgMjogcmVzdWx0W2tleV0gPSB2YWw7IGJyZWFrICAgICAgLy8gZmlsdGVyXHJcbiAgICAgICAgICAgIGNhc2UgMzogcmV0dXJuIHRydWU7ICAgICAgICAgICAgICAgICAgLy8gc29tZVxyXG4gICAgICAgICAgICBjYXNlIDU6IHJldHVybiB2YWw7ICAgICAgICAgICAgICAgICAgIC8vIGZpbmRcclxuICAgICAgICAgICAgY2FzZSA2OiByZXR1cm4ga2V5OyAgICAgICAgICAgICAgICAgICAvLyBmaW5kS2V5XHJcbiAgICAgICAgICAgIGNhc2UgNzogcmVzdWx0W3Jlc1swXV0gPSByZXNbMV07ICAgICAgLy8gbWFwUGFpcnNcclxuICAgICAgICAgIH0gZWxzZSBpZihpc0V2ZXJ5KXJldHVybiBmYWxzZTsgICAgICAgICAvLyBldmVyeVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdHlwZSA9PSAzIHx8IGlzRXZlcnkgPyBpc0V2ZXJ5IDogcmVzdWx0O1xyXG4gICAgfVxyXG4gIH1cclxuICBmdW5jdGlvbiBjcmVhdGVEaWN0UmVkdWNlKGlzVHVybil7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0LCBtYXBmbiwgaW5pdCl7XHJcbiAgICAgIGFzc2VydEZ1bmN0aW9uKG1hcGZuKTtcclxuICAgICAgdmFyIE8gICAgICA9IHRvT2JqZWN0KG9iamVjdClcclxuICAgICAgICAsIGtleXMgICA9IGdldEtleXMoTylcclxuICAgICAgICAsIGxlbmd0aCA9IGtleXMubGVuZ3RoXHJcbiAgICAgICAgLCBpICAgICAgPSAwXHJcbiAgICAgICAgLCBtZW1vLCBrZXksIHJlc3VsdDtcclxuICAgICAgaWYoaXNUdXJuKW1lbW8gPSBpbml0ID09IHVuZGVmaW5lZCA/IG5ldyAoZ2VuZXJpYyh0aGlzLCBEaWN0KSkgOiBPYmplY3QoaW5pdCk7XHJcbiAgICAgIGVsc2UgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDMpe1xyXG4gICAgICAgIGFzc2VydChsZW5ndGgsIFJFRFVDRV9FUlJPUik7XHJcbiAgICAgICAgbWVtbyA9IE9ba2V5c1tpKytdXTtcclxuICAgICAgfSBlbHNlIG1lbW8gPSBPYmplY3QoaW5pdCk7XHJcbiAgICAgIHdoaWxlKGxlbmd0aCA+IGkpaWYoaGFzKE8sIGtleSA9IGtleXNbaSsrXSkpe1xyXG4gICAgICAgIHJlc3VsdCA9IG1hcGZuKG1lbW8sIE9ba2V5XSwga2V5LCBvYmplY3QpO1xyXG4gICAgICAgIGlmKGlzVHVybil7XHJcbiAgICAgICAgICBpZihyZXN1bHQgPT09IGZhbHNlKWJyZWFrO1xyXG4gICAgICAgIH0gZWxzZSBtZW1vID0gcmVzdWx0O1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBtZW1vO1xyXG4gICAgfVxyXG4gIH1cclxuICB2YXIgZmluZEtleSA9IGNyZWF0ZURpY3RNZXRob2QoNik7XHJcbiAgZnVuY3Rpb24gaW5jbHVkZXMob2JqZWN0LCBlbCl7XHJcbiAgICByZXR1cm4gKGVsID09IGVsID8ga2V5T2Yob2JqZWN0LCBlbCkgOiBmaW5kS2V5KG9iamVjdCwgc2FtZU5hTikpICE9PSB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIFxyXG4gIHZhciBkaWN0TWV0aG9kcyA9IHtcclxuICAgIGtleXM6ICAgIGNyZWF0ZURpY3RJdGVyKEtFWSksXHJcbiAgICB2YWx1ZXM6ICBjcmVhdGVEaWN0SXRlcihWQUxVRSksXHJcbiAgICBlbnRyaWVzOiBjcmVhdGVEaWN0SXRlcihLRVkrVkFMVUUpLFxyXG4gICAgZm9yRWFjaDogY3JlYXRlRGljdE1ldGhvZCgwKSxcclxuICAgIG1hcDogICAgIGNyZWF0ZURpY3RNZXRob2QoMSksXHJcbiAgICBmaWx0ZXI6ICBjcmVhdGVEaWN0TWV0aG9kKDIpLFxyXG4gICAgc29tZTogICAgY3JlYXRlRGljdE1ldGhvZCgzKSxcclxuICAgIGV2ZXJ5OiAgIGNyZWF0ZURpY3RNZXRob2QoNCksXHJcbiAgICBmaW5kOiAgICBjcmVhdGVEaWN0TWV0aG9kKDUpLFxyXG4gICAgZmluZEtleTogZmluZEtleSxcclxuICAgIG1hcFBhaXJzOmNyZWF0ZURpY3RNZXRob2QoNyksXHJcbiAgICByZWR1Y2U6ICBjcmVhdGVEaWN0UmVkdWNlKGZhbHNlKSxcclxuICAgIHR1cm46ICAgIGNyZWF0ZURpY3RSZWR1Y2UodHJ1ZSksXHJcbiAgICBrZXlPZjogICBrZXlPZixcclxuICAgIGluY2x1ZGVzOmluY2x1ZGVzLFxyXG4gICAgLy8gSGFzIC8gZ2V0IC8gc2V0IG93biBwcm9wZXJ0eVxyXG4gICAgaGFzOiBoYXMsXHJcbiAgICBnZXQ6IGdldCxcclxuICAgIHNldDogY3JlYXRlRGVmaW5lcigwKSxcclxuICAgIGlzRGljdDogZnVuY3Rpb24oaXQpe1xyXG4gICAgICByZXR1cm4gaXNPYmplY3QoaXQpICYmIGdldFByb3RvdHlwZU9mKGl0KSA9PT0gRGljdFtQUk9UT1RZUEVdO1xyXG4gICAgfVxyXG4gIH07XHJcbiAgXHJcbiAgaWYoUkVGRVJFTkNFX0dFVClmb3IodmFyIGtleSBpbiBkaWN0TWV0aG9kcykhZnVuY3Rpb24oZm4pe1xyXG4gICAgZnVuY3Rpb24gbWV0aG9kKCl7XHJcbiAgICAgIGZvcih2YXIgYXJncyA9IFt0aGlzXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOylhcmdzLnB1c2goYXJndW1lbnRzW2krK10pO1xyXG4gICAgICByZXR1cm4gaW52b2tlKGZuLCBhcmdzKTtcclxuICAgIH1cclxuICAgIGZuW1JFRkVSRU5DRV9HRVRdID0gZnVuY3Rpb24oKXtcclxuICAgICAgcmV0dXJuIG1ldGhvZDtcclxuICAgIH1cclxuICB9KGRpY3RNZXRob2RzW2tleV0pO1xyXG4gIFxyXG4gICRkZWZpbmUoR0xPQkFMICsgRk9SQ0VELCB7RGljdDogYXNzaWduSGlkZGVuKERpY3QsIGRpY3RNZXRob2RzKX0pO1xyXG59KCdEaWN0Jyk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGNvcmUuJGZvciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbihFTlRSSUVTLCBGTil7ICBcclxuICBmdW5jdGlvbiAkZm9yKGl0ZXJhYmxlLCBlbnRyaWVzKXtcclxuICAgIGlmKCEodGhpcyBpbnN0YW5jZW9mICRmb3IpKXJldHVybiBuZXcgJGZvcihpdGVyYWJsZSwgZW50cmllcyk7XHJcbiAgICB0aGlzW0lURVJdICAgID0gZ2V0SXRlcmF0b3IoaXRlcmFibGUpO1xyXG4gICAgdGhpc1tFTlRSSUVTXSA9ICEhZW50cmllcztcclxuICB9XHJcbiAgXHJcbiAgY3JlYXRlSXRlcmF0b3IoJGZvciwgJ1dyYXBwZXInLCBmdW5jdGlvbigpe1xyXG4gICAgcmV0dXJuIHRoaXNbSVRFUl0ubmV4dCgpO1xyXG4gIH0pO1xyXG4gIHZhciAkZm9yUHJvdG8gPSAkZm9yW1BST1RPVFlQRV07XHJcbiAgc2V0SXRlcmF0b3IoJGZvclByb3RvLCBmdW5jdGlvbigpe1xyXG4gICAgcmV0dXJuIHRoaXNbSVRFUl07IC8vIHVud3JhcFxyXG4gIH0pO1xyXG4gIFxyXG4gIGZ1bmN0aW9uIGNyZWF0ZUNoYWluSXRlcmF0b3IobmV4dCl7XHJcbiAgICBmdW5jdGlvbiBJdGVyKEksIGZuLCB0aGF0KXtcclxuICAgICAgdGhpc1tJVEVSXSAgICA9IGdldEl0ZXJhdG9yKEkpO1xyXG4gICAgICB0aGlzW0VOVFJJRVNdID0gSVtFTlRSSUVTXTtcclxuICAgICAgdGhpc1tGTl0gICAgICA9IGN0eChmbiwgdGhhdCwgSVtFTlRSSUVTXSA/IDIgOiAxKTtcclxuICAgIH1cclxuICAgIGNyZWF0ZUl0ZXJhdG9yKEl0ZXIsICdDaGFpbicsIG5leHQsICRmb3JQcm90byk7XHJcbiAgICBzZXRJdGVyYXRvcihJdGVyW1BST1RPVFlQRV0sIHJldHVyblRoaXMpOyAvLyBvdmVycmlkZSAkZm9yUHJvdG8gaXRlcmF0b3JcclxuICAgIHJldHVybiBJdGVyO1xyXG4gIH1cclxuICBcclxuICB2YXIgTWFwSXRlciA9IGNyZWF0ZUNoYWluSXRlcmF0b3IoZnVuY3Rpb24oKXtcclxuICAgIHZhciBzdGVwID0gdGhpc1tJVEVSXS5uZXh0KCk7XHJcbiAgICByZXR1cm4gc3RlcC5kb25lID8gc3RlcCA6IGl0ZXJSZXN1bHQoMCwgc3RlcENhbGwodGhpc1tGTl0sIHN0ZXAudmFsdWUsIHRoaXNbRU5UUklFU10pKTtcclxuICB9KTtcclxuICBcclxuICB2YXIgRmlsdGVySXRlciA9IGNyZWF0ZUNoYWluSXRlcmF0b3IoZnVuY3Rpb24oKXtcclxuICAgIGZvcig7Oyl7XHJcbiAgICAgIHZhciBzdGVwID0gdGhpc1tJVEVSXS5uZXh0KCk7XHJcbiAgICAgIGlmKHN0ZXAuZG9uZSB8fCBzdGVwQ2FsbCh0aGlzW0ZOXSwgc3RlcC52YWx1ZSwgdGhpc1tFTlRSSUVTXSkpcmV0dXJuIHN0ZXA7XHJcbiAgICB9XHJcbiAgfSk7XHJcbiAgXHJcbiAgYXNzaWduSGlkZGVuKCRmb3JQcm90bywge1xyXG4gICAgb2Y6IGZ1bmN0aW9uKGZuLCB0aGF0KXtcclxuICAgICAgZm9yT2YodGhpcywgdGhpc1tFTlRSSUVTXSwgZm4sIHRoYXQpO1xyXG4gICAgfSxcclxuICAgIGFycmF5OiBmdW5jdGlvbihmbiwgdGhhdCl7XHJcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcclxuICAgICAgZm9yT2YoZm4gIT0gdW5kZWZpbmVkID8gdGhpcy5tYXAoZm4sIHRoYXQpIDogdGhpcywgZmFsc2UsIHB1c2gsIHJlc3VsdCk7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9LFxyXG4gICAgZmlsdGVyOiBmdW5jdGlvbihmbiwgdGhhdCl7XHJcbiAgICAgIHJldHVybiBuZXcgRmlsdGVySXRlcih0aGlzLCBmbiwgdGhhdCk7XHJcbiAgICB9LFxyXG4gICAgbWFwOiBmdW5jdGlvbihmbiwgdGhhdCl7XHJcbiAgICAgIHJldHVybiBuZXcgTWFwSXRlcih0aGlzLCBmbiwgdGhhdCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbiAgXHJcbiAgJGZvci5pc0l0ZXJhYmxlICA9IGlzSXRlcmFibGU7XHJcbiAgJGZvci5nZXRJdGVyYXRvciA9IGdldEl0ZXJhdG9yO1xyXG4gIFxyXG4gICRkZWZpbmUoR0xPQkFMICsgRk9SQ0VELCB7JGZvcjogJGZvcn0pO1xyXG59KCdlbnRyaWVzJywgc2FmZVN5bWJvbCgnZm4nKSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGNvcmUuZGVsYXkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8vIGh0dHBzOi8vZXNkaXNjdXNzLm9yZy90b3BpYy9wcm9taXNlLXJldHVybmluZy1kZWxheS1mdW5jdGlvblxyXG4kZGVmaW5lKEdMT0JBTCArIEZPUkNFRCwge1xyXG4gIGRlbGF5OiBmdW5jdGlvbih0aW1lKXtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKXtcclxuICAgICAgc2V0VGltZW91dChyZXNvbHZlLCB0aW1lLCB0cnVlKTtcclxuICAgIH0pO1xyXG4gIH1cclxufSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGNvcmUuYmluZGluZyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbihfLCB0b0xvY2FsZVN0cmluZyl7XHJcbiAgLy8gUGxhY2Vob2xkZXJcclxuICBjb3JlLl8gPSBwYXRoLl8gPSBwYXRoLl8gfHwge307XHJcblxyXG4gICRkZWZpbmUoUFJPVE8gKyBGT1JDRUQsIEZVTkNUSU9OLCB7XHJcbiAgICBwYXJ0OiBwYXJ0LFxyXG4gICAgb25seTogZnVuY3Rpb24obnVtYmVyQXJndW1lbnRzLCB0aGF0IC8qID0gQCAqLyl7XHJcbiAgICAgIHZhciBmbiAgICAgPSBhc3NlcnRGdW5jdGlvbih0aGlzKVxyXG4gICAgICAgICwgbiAgICAgID0gdG9MZW5ndGgobnVtYmVyQXJndW1lbnRzKVxyXG4gICAgICAgICwgaXNUaGF0ID0gYXJndW1lbnRzLmxlbmd0aCA+IDE7XHJcbiAgICAgIHJldHVybiBmdW5jdGlvbigvKiAuLi5hcmdzICovKXtcclxuICAgICAgICB2YXIgbGVuZ3RoID0gbWluKG4sIGFyZ3VtZW50cy5sZW5ndGgpXHJcbiAgICAgICAgICAsIGFyZ3MgICA9IEFycmF5KGxlbmd0aClcclxuICAgICAgICAgICwgaSAgICAgID0gMDtcclxuICAgICAgICB3aGlsZShsZW5ndGggPiBpKWFyZ3NbaV0gPSBhcmd1bWVudHNbaSsrXTtcclxuICAgICAgICByZXR1cm4gaW52b2tlKGZuLCBhcmdzLCBpc1RoYXQgPyB0aGF0IDogdGhpcyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9KTtcclxuICBcclxuICBmdW5jdGlvbiB0aWUoa2V5KXtcclxuICAgIHZhciB0aGF0ICA9IHRoaXNcclxuICAgICAgLCBib3VuZCA9IHt9O1xyXG4gICAgcmV0dXJuIGhpZGRlbih0aGF0LCBfLCBmdW5jdGlvbihrZXkpe1xyXG4gICAgICBpZihrZXkgPT09IHVuZGVmaW5lZCB8fCAhKGtleSBpbiB0aGF0KSlyZXR1cm4gdG9Mb2NhbGVTdHJpbmcuY2FsbCh0aGF0KTtcclxuICAgICAgcmV0dXJuIGhhcyhib3VuZCwga2V5KSA/IGJvdW5kW2tleV0gOiAoYm91bmRba2V5XSA9IGN0eCh0aGF0W2tleV0sIHRoYXQsIC0xKSk7XHJcbiAgICB9KVtfXShrZXkpO1xyXG4gIH1cclxuICBcclxuICBoaWRkZW4ocGF0aC5fLCBUT19TVFJJTkcsIGZ1bmN0aW9uKCl7XHJcbiAgICByZXR1cm4gXztcclxuICB9KTtcclxuICBcclxuICBoaWRkZW4oT2JqZWN0UHJvdG8sIF8sIHRpZSk7XHJcbiAgREVTQyB8fCBoaWRkZW4oQXJyYXlQcm90bywgXywgdGllKTtcclxuICAvLyBJRTgtIGRpcnR5IGhhY2sgLSByZWRlZmluZWQgdG9Mb2NhbGVTdHJpbmcgaXMgbm90IGVudW1lcmFibGVcclxufShERVNDID8gdWlkKCd0aWUnKSA6IFRPX0xPQ0FMRSwgT2JqZWN0UHJvdG9bVE9fTE9DQUxFXSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGNvcmUub2JqZWN0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbigpe1xyXG4gIGZ1bmN0aW9uIGRlZmluZSh0YXJnZXQsIG1peGluKXtcclxuICAgIHZhciBrZXlzICAgPSBvd25LZXlzKHRvT2JqZWN0KG1peGluKSlcclxuICAgICAgLCBsZW5ndGggPSBrZXlzLmxlbmd0aFxyXG4gICAgICAsIGkgPSAwLCBrZXk7XHJcbiAgICB3aGlsZShsZW5ndGggPiBpKWRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5ID0ga2V5c1tpKytdLCBnZXRPd25EZXNjcmlwdG9yKG1peGluLCBrZXkpKTtcclxuICAgIHJldHVybiB0YXJnZXQ7XHJcbiAgfTtcclxuICAkZGVmaW5lKFNUQVRJQyArIEZPUkNFRCwgT0JKRUNULCB7XHJcbiAgICBpc09iamVjdDogaXNPYmplY3QsXHJcbiAgICBjbGFzc29mOiBjbGFzc29mLFxyXG4gICAgZGVmaW5lOiBkZWZpbmUsXHJcbiAgICBtYWtlOiBmdW5jdGlvbihwcm90bywgbWl4aW4pe1xyXG4gICAgICByZXR1cm4gZGVmaW5lKGNyZWF0ZShwcm90byksIG1peGluKTtcclxuICAgIH1cclxuICB9KTtcclxufSgpO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBjb3JlLmFycmF5ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4kZGVmaW5lKFBST1RPICsgRk9SQ0VELCBBUlJBWSwge1xyXG4gIHR1cm46IGZ1bmN0aW9uKGZuLCB0YXJnZXQgLyogPSBbXSAqLyl7XHJcbiAgICBhc3NlcnRGdW5jdGlvbihmbik7XHJcbiAgICB2YXIgbWVtbyAgID0gdGFyZ2V0ID09IHVuZGVmaW5lZCA/IFtdIDogT2JqZWN0KHRhcmdldClcclxuICAgICAgLCBPICAgICAgPSBFUzVPYmplY3QodGhpcylcclxuICAgICAgLCBsZW5ndGggPSB0b0xlbmd0aChPLmxlbmd0aClcclxuICAgICAgLCBpbmRleCAgPSAwO1xyXG4gICAgd2hpbGUobGVuZ3RoID4gaW5kZXgpaWYoZm4obWVtbywgT1tpbmRleF0sIGluZGV4KyssIHRoaXMpID09PSBmYWxzZSlicmVhaztcclxuICAgIHJldHVybiBtZW1vO1xyXG4gIH1cclxufSk7XHJcbmlmKGZyYW1ld29yaylBcnJheVVuc2NvcGFibGVzLnR1cm4gPSB0cnVlO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBjb3JlLm51bWJlciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4hZnVuY3Rpb24obnVtYmVyTWV0aG9kcyl7ICBcclxuICBmdW5jdGlvbiBOdW1iZXJJdGVyYXRvcihpdGVyYXRlZCl7XHJcbiAgICBzZXQodGhpcywgSVRFUiwge2w6IHRvTGVuZ3RoKGl0ZXJhdGVkKSwgaTogMH0pO1xyXG4gIH1cclxuICBjcmVhdGVJdGVyYXRvcihOdW1iZXJJdGVyYXRvciwgTlVNQkVSLCBmdW5jdGlvbigpe1xyXG4gICAgdmFyIGl0ZXIgPSB0aGlzW0lURVJdXHJcbiAgICAgICwgaSAgICA9IGl0ZXIuaSsrO1xyXG4gICAgcmV0dXJuIGkgPCBpdGVyLmwgPyBpdGVyUmVzdWx0KDAsIGkpIDogaXRlclJlc3VsdCgxKTtcclxuICB9KTtcclxuICBkZWZpbmVJdGVyYXRvcihOdW1iZXIsIE5VTUJFUiwgZnVuY3Rpb24oKXtcclxuICAgIHJldHVybiBuZXcgTnVtYmVySXRlcmF0b3IodGhpcyk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgbnVtYmVyTWV0aG9kcy5yYW5kb20gPSBmdW5jdGlvbihsaW0gLyogPSAwICovKXtcclxuICAgIHZhciBhID0gK3RoaXNcclxuICAgICAgLCBiID0gbGltID09IHVuZGVmaW5lZCA/IDAgOiArbGltXHJcbiAgICAgICwgbSA9IG1pbihhLCBiKTtcclxuICAgIHJldHVybiByYW5kb20oKSAqIChtYXgoYSwgYikgLSBtKSArIG07XHJcbiAgfTtcclxuXHJcbiAgZm9yRWFjaC5jYWxsKGFycmF5KFxyXG4gICAgICAvLyBFUzM6XHJcbiAgICAgICdyb3VuZCxmbG9vcixjZWlsLGFicyxzaW4sYXNpbixjb3MsYWNvcyx0YW4sYXRhbixleHAsc3FydCxtYXgsbWluLHBvdyxhdGFuMiwnICtcclxuICAgICAgLy8gRVM2OlxyXG4gICAgICAnYWNvc2gsYXNpbmgsYXRhbmgsY2JydCxjbHozMixjb3NoLGV4cG0xLGh5cG90LGltdWwsbG9nMXAsbG9nMTAsbG9nMixzaWduLHNpbmgsdGFuaCx0cnVuYydcclxuICAgICksIGZ1bmN0aW9uKGtleSl7XHJcbiAgICAgIHZhciBmbiA9IE1hdGhba2V5XTtcclxuICAgICAgaWYoZm4pbnVtYmVyTWV0aG9kc1trZXldID0gZnVuY3Rpb24oLyogLi4uYXJncyAqLyl7XHJcbiAgICAgICAgLy8gaWU5LSBkb250IHN1cHBvcnQgc3RyaWN0IG1vZGUgJiBjb252ZXJ0IGB0aGlzYCB0byBvYmplY3QgLT4gY29udmVydCBpdCB0byBudW1iZXJcclxuICAgICAgICB2YXIgYXJncyA9IFsrdGhpc11cclxuICAgICAgICAgICwgaSAgICA9IDA7XHJcbiAgICAgICAgd2hpbGUoYXJndW1lbnRzLmxlbmd0aCA+IGkpYXJncy5wdXNoKGFyZ3VtZW50c1tpKytdKTtcclxuICAgICAgICByZXR1cm4gaW52b2tlKGZuLCBhcmdzKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICk7XHJcbiAgXHJcbiAgJGRlZmluZShQUk9UTyArIEZPUkNFRCwgTlVNQkVSLCBudW1iZXJNZXRob2RzKTtcclxufSh7fSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1vZHVsZSA6IGNvcmUuc3RyaW5nICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiFmdW5jdGlvbigpe1xyXG4gIHZhciBlc2NhcGVIVE1MRGljdCA9IHtcclxuICAgICcmJzogJyZhbXA7JyxcclxuICAgICc8JzogJyZsdDsnLFxyXG4gICAgJz4nOiAnJmd0OycsXHJcbiAgICAnXCInOiAnJnF1b3Q7JyxcclxuICAgIFwiJ1wiOiAnJmFwb3M7J1xyXG4gIH0sIHVuZXNjYXBlSFRNTERpY3QgPSB7fSwga2V5O1xyXG4gIGZvcihrZXkgaW4gZXNjYXBlSFRNTERpY3QpdW5lc2NhcGVIVE1MRGljdFtlc2NhcGVIVE1MRGljdFtrZXldXSA9IGtleTtcclxuICAkZGVmaW5lKFBST1RPICsgRk9SQ0VELCBTVFJJTkcsIHtcclxuICAgIGVzY2FwZUhUTUw6ICAgY3JlYXRlUmVwbGFjZXIoL1smPD5cIiddL2csIGVzY2FwZUhUTUxEaWN0KSxcclxuICAgIHVuZXNjYXBlSFRNTDogY3JlYXRlUmVwbGFjZXIoLyYoPzphbXB8bHR8Z3R8cXVvdHxhcG9zKTsvZywgdW5lc2NhcGVIVE1MRGljdClcclxuICB9KTtcclxufSgpO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBjb3JlLmRhdGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4hZnVuY3Rpb24oZm9ybWF0UmVnRXhwLCBmbGV4aW9SZWdFeHAsIGxvY2FsZXMsIGN1cnJlbnQsIFNFQ09ORFMsIE1JTlVURVMsIEhPVVJTLCBNT05USCwgWUVBUil7XHJcbiAgZnVuY3Rpb24gY3JlYXRlRm9ybWF0KHByZWZpeCl7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24odGVtcGxhdGUsIGxvY2FsZSAvKiA9IGN1cnJlbnQgKi8pe1xyXG4gICAgICB2YXIgdGhhdCA9IHRoaXNcclxuICAgICAgICAsIGRpY3QgPSBsb2NhbGVzW2hhcyhsb2NhbGVzLCBsb2NhbGUpID8gbG9jYWxlIDogY3VycmVudF07XHJcbiAgICAgIGZ1bmN0aW9uIGdldCh1bml0KXtcclxuICAgICAgICByZXR1cm4gdGhhdFtwcmVmaXggKyB1bml0XSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBTdHJpbmcodGVtcGxhdGUpLnJlcGxhY2UoZm9ybWF0UmVnRXhwLCBmdW5jdGlvbihwYXJ0KXtcclxuICAgICAgICBzd2l0Y2gocGFydCl7XHJcbiAgICAgICAgICBjYXNlICdzJyAgOiByZXR1cm4gZ2V0KFNFQ09ORFMpOyAgICAgICAgICAgICAgICAgIC8vIFNlY29uZHMgOiAwLTU5XHJcbiAgICAgICAgICBjYXNlICdzcycgOiByZXR1cm4gbHooZ2V0KFNFQ09ORFMpKTsgICAgICAgICAgICAgIC8vIFNlY29uZHMgOiAwMC01OVxyXG4gICAgICAgICAgY2FzZSAnbScgIDogcmV0dXJuIGdldChNSU5VVEVTKTsgICAgICAgICAgICAgICAgICAvLyBNaW51dGVzIDogMC01OVxyXG4gICAgICAgICAgY2FzZSAnbW0nIDogcmV0dXJuIGx6KGdldChNSU5VVEVTKSk7ICAgICAgICAgICAgICAvLyBNaW51dGVzIDogMDAtNTlcclxuICAgICAgICAgIGNhc2UgJ2gnICA6IHJldHVybiBnZXQoSE9VUlMpOyAgICAgICAgICAgICAgICAgICAgLy8gSG91cnMgICA6IDAtMjNcclxuICAgICAgICAgIGNhc2UgJ2hoJyA6IHJldHVybiBseihnZXQoSE9VUlMpKTsgICAgICAgICAgICAgICAgLy8gSG91cnMgICA6IDAwLTIzXHJcbiAgICAgICAgICBjYXNlICdEJyAgOiByZXR1cm4gZ2V0KERBVEUpOyAgICAgICAgICAgICAgICAgICAgIC8vIERhdGUgICAgOiAxLTMxXHJcbiAgICAgICAgICBjYXNlICdERCcgOiByZXR1cm4gbHooZ2V0KERBVEUpKTsgICAgICAgICAgICAgICAgIC8vIERhdGUgICAgOiAwMS0zMVxyXG4gICAgICAgICAgY2FzZSAnVycgIDogcmV0dXJuIGRpY3RbMF1bZ2V0KCdEYXknKV07ICAgICAgICAgICAvLyBEYXkgICAgIDog0J/QvtC90LXQtNC10LvRjNC90LjQulxyXG4gICAgICAgICAgY2FzZSAnTicgIDogcmV0dXJuIGdldChNT05USCkgKyAxOyAgICAgICAgICAgICAgICAvLyBNb250aCAgIDogMS0xMlxyXG4gICAgICAgICAgY2FzZSAnTk4nIDogcmV0dXJuIGx6KGdldChNT05USCkgKyAxKTsgICAgICAgICAgICAvLyBNb250aCAgIDogMDEtMTJcclxuICAgICAgICAgIGNhc2UgJ00nICA6IHJldHVybiBkaWN0WzJdW2dldChNT05USCldOyAgICAgICAgICAgLy8gTW9udGggICA6INCv0L3QstCw0YDRjFxyXG4gICAgICAgICAgY2FzZSAnTU0nIDogcmV0dXJuIGRpY3RbMV1bZ2V0KE1PTlRIKV07ICAgICAgICAgICAvLyBNb250aCAgIDog0K/QvdCy0LDRgNGPXHJcbiAgICAgICAgICBjYXNlICdZJyAgOiByZXR1cm4gZ2V0KFlFQVIpOyAgICAgICAgICAgICAgICAgICAgIC8vIFllYXIgICAgOiAyMDE0XHJcbiAgICAgICAgICBjYXNlICdZWScgOiByZXR1cm4gbHooZ2V0KFlFQVIpICUgMTAwKTsgICAgICAgICAgIC8vIFllYXIgICAgOiAxNFxyXG4gICAgICAgIH0gcmV0dXJuIHBhcnQ7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuICBmdW5jdGlvbiBhZGRMb2NhbGUobGFuZywgbG9jYWxlKXtcclxuICAgIGZ1bmN0aW9uIHNwbGl0KGluZGV4KXtcclxuICAgICAgdmFyIHJlc3VsdCA9IFtdO1xyXG4gICAgICBmb3JFYWNoLmNhbGwoYXJyYXkobG9jYWxlLm1vbnRocyksIGZ1bmN0aW9uKGl0KXtcclxuICAgICAgICByZXN1bHQucHVzaChpdC5yZXBsYWNlKGZsZXhpb1JlZ0V4cCwgJyQnICsgaW5kZXgpKTtcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcbiAgICBsb2NhbGVzW2xhbmddID0gW2FycmF5KGxvY2FsZS53ZWVrZGF5cyksIHNwbGl0KDEpLCBzcGxpdCgyKV07XHJcbiAgICByZXR1cm4gY29yZTtcclxuICB9XHJcbiAgJGRlZmluZShQUk9UTyArIEZPUkNFRCwgREFURSwge1xyXG4gICAgZm9ybWF0OiAgICBjcmVhdGVGb3JtYXQoJ2dldCcpLFxyXG4gICAgZm9ybWF0VVRDOiBjcmVhdGVGb3JtYXQoJ2dldFVUQycpXHJcbiAgfSk7XHJcbiAgYWRkTG9jYWxlKGN1cnJlbnQsIHtcclxuICAgIHdlZWtkYXlzOiAnU3VuZGF5LE1vbmRheSxUdWVzZGF5LFdlZG5lc2RheSxUaHVyc2RheSxGcmlkYXksU2F0dXJkYXknLFxyXG4gICAgbW9udGhzOiAnSmFudWFyeSxGZWJydWFyeSxNYXJjaCxBcHJpbCxNYXksSnVuZSxKdWx5LEF1Z3VzdCxTZXB0ZW1iZXIsT2N0b2JlcixOb3ZlbWJlcixEZWNlbWJlcidcclxuICB9KTtcclxuICBhZGRMb2NhbGUoJ3J1Jywge1xyXG4gICAgd2Vla2RheXM6ICfQktC+0YHQutGA0LXRgdC10L3RjNC1LNCf0L7QvdC10LTQtdC70YzQvdC40Los0JLRgtC+0YDQvdC40Los0KHRgNC10LTQsCzQp9C10YLQstC10YDQsyzQn9GP0YLQvdC40YbQsCzQodGD0LHQsdC+0YLQsCcsXHJcbiAgICBtb250aHM6ICfQr9C90LLQsNGAOtGPfNGMLNCk0LXQstGA0LDQuzrRj3zRjCzQnNCw0YDRgjrQsHws0JDQv9GA0LXQuzrRj3zRjCzQnNCwOtGPfNC5LNCY0Y7QvTrRj3zRjCwnICtcclxuICAgICAgICAgICAgJ9CY0Y7QuzrRj3zRjCzQkNCy0LPRg9GB0YI60LB8LNCh0LXQvdGC0Y/QsdGAOtGPfNGMLNCe0LrRgtGP0LHRgDrRj3zRjCzQndC+0Y/QsdGAOtGPfNGMLNCU0LXQutCw0LHRgDrRj3zRjCdcclxuICB9KTtcclxuICBjb3JlLmxvY2FsZSA9IGZ1bmN0aW9uKGxvY2FsZSl7XHJcbiAgICByZXR1cm4gaGFzKGxvY2FsZXMsIGxvY2FsZSkgPyBjdXJyZW50ID0gbG9jYWxlIDogY3VycmVudDtcclxuICB9O1xyXG4gIGNvcmUuYWRkTG9jYWxlID0gYWRkTG9jYWxlO1xyXG59KC9cXGJcXHdcXHc/XFxiL2csIC86KC4qKVxcfCguKikkLywge30sICdlbicsICdTZWNvbmRzJywgJ01pbnV0ZXMnLCAnSG91cnMnLCAnTW9udGgnLCAnRnVsbFllYXInKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogY29yZS5nbG9iYWwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuJGRlZmluZShHTE9CQUwgKyBGT1JDRUQsIHtnbG9iYWw6IGdsb2JhbH0pO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBNb2R1bGUgOiBqcy5hcnJheS5zdGF0aWNzICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBKYXZhU2NyaXB0IDEuNiAvIFN0cmF3bWFuIGFycmF5IHN0YXRpY3Mgc2hpbVxyXG4hZnVuY3Rpb24oYXJyYXlTdGF0aWNzKXtcclxuICBmdW5jdGlvbiBzZXRBcnJheVN0YXRpY3Moa2V5cywgbGVuZ3RoKXtcclxuICAgIGZvckVhY2guY2FsbChhcnJheShrZXlzKSwgZnVuY3Rpb24oa2V5KXtcclxuICAgICAgaWYoa2V5IGluIEFycmF5UHJvdG8pYXJyYXlTdGF0aWNzW2tleV0gPSBjdHgoY2FsbCwgQXJyYXlQcm90b1trZXldLCBsZW5ndGgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG4gIHNldEFycmF5U3RhdGljcygncG9wLHJldmVyc2Usc2hpZnQsa2V5cyx2YWx1ZXMsZW50cmllcycsIDEpO1xyXG4gIHNldEFycmF5U3RhdGljcygnaW5kZXhPZixldmVyeSxzb21lLGZvckVhY2gsbWFwLGZpbHRlcixmaW5kLGZpbmRJbmRleCxpbmNsdWRlcycsIDMpO1xyXG4gIHNldEFycmF5U3RhdGljcygnam9pbixzbGljZSxjb25jYXQscHVzaCxzcGxpY2UsdW5zaGlmdCxzb3J0LGxhc3RJbmRleE9mLCcgK1xyXG4gICAgICAgICAgICAgICAgICAncmVkdWNlLHJlZHVjZVJpZ2h0LGNvcHlXaXRoaW4sZmlsbCx0dXJuJyk7XHJcbiAgJGRlZmluZShTVEFUSUMsIEFSUkFZLCBhcnJheVN0YXRpY3MpO1xyXG59KHt9KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogd2ViLmRvbS5pdGFyYWJsZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuIWZ1bmN0aW9uKE5vZGVMaXN0KXtcclxuICBpZihmcmFtZXdvcmsgJiYgTm9kZUxpc3QgJiYgIShTWU1CT0xfSVRFUkFUT1IgaW4gTm9kZUxpc3RbUFJPVE9UWVBFXSkpe1xyXG4gICAgaGlkZGVuKE5vZGVMaXN0W1BST1RPVFlQRV0sIFNZTUJPTF9JVEVSQVRPUiwgSXRlcmF0b3JzW0FSUkFZXSk7XHJcbiAgfVxyXG4gIEl0ZXJhdG9ycy5Ob2RlTGlzdCA9IEl0ZXJhdG9yc1tBUlJBWV07XHJcbn0oZ2xvYmFsLk5vZGVMaXN0KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTW9kdWxlIDogY29yZS5sb2cgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuIWZ1bmN0aW9uKGxvZywgZW5hYmxlZCl7XHJcbiAgLy8gTWV0aG9kcyBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9EZXZlbG9wZXJUb29sc1dHL2NvbnNvbGUtb2JqZWN0L2Jsb2IvbWFzdGVyL2FwaS5tZFxyXG4gIGZvckVhY2guY2FsbChhcnJheSgnYXNzZXJ0LGNsZWFyLGNvdW50LGRlYnVnLGRpcixkaXJ4bWwsZXJyb3IsZXhjZXB0aW9uLCcgK1xyXG4gICAgICAnZ3JvdXAsZ3JvdXBDb2xsYXBzZWQsZ3JvdXBFbmQsaW5mbyxpc0luZGVwZW5kZW50bHlDb21wb3NlZCxsb2csJyArXHJcbiAgICAgICdtYXJrVGltZWxpbmUscHJvZmlsZSxwcm9maWxlRW5kLHRhYmxlLHRpbWUsdGltZUVuZCx0aW1lbGluZSwnICtcclxuICAgICAgJ3RpbWVsaW5lRW5kLHRpbWVTdGFtcCx0cmFjZSx3YXJuJyksIGZ1bmN0aW9uKGtleSl7XHJcbiAgICBsb2dba2V5XSA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgIGlmKGVuYWJsZWQgJiYga2V5IGluIGNvbnNvbGUpcmV0dXJuIGFwcGx5LmNhbGwoY29uc29sZVtrZXldLCBjb25zb2xlLCBhcmd1bWVudHMpO1xyXG4gICAgfTtcclxuICB9KTtcclxuICAkZGVmaW5lKEdMT0JBTCArIEZPUkNFRCwge2xvZzogYXNzaWduKGxvZy5sb2csIGxvZywge1xyXG4gICAgZW5hYmxlOiBmdW5jdGlvbigpe1xyXG4gICAgICBlbmFibGVkID0gdHJ1ZTtcclxuICAgIH0sXHJcbiAgICBkaXNhYmxlOiBmdW5jdGlvbigpe1xyXG4gICAgICBlbmFibGVkID0gZmFsc2U7XHJcbiAgICB9XHJcbiAgfSl9KTtcclxufSh7fSwgdHJ1ZSk7XG59KHR5cGVvZiBzZWxmICE9ICd1bmRlZmluZWQnICYmIHNlbGYuTWF0aCA9PT0gTWF0aCA/IHNlbGYgOiBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpLCBmYWxzZSk7XG5tb2R1bGUuZXhwb3J0cyA9IHsgXCJkZWZhdWx0XCI6IG1vZHVsZS5leHBvcnRzLCBfX2VzTW9kdWxlOiB0cnVlIH07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gcHJvcHMpIHtcbiAgICAgIHZhciBwcm9wID0gcHJvcHNba2V5XTtcbiAgICAgIHByb3AuY29uZmlndXJhYmxlID0gdHJ1ZTtcbiAgICAgIGlmIChwcm9wLnZhbHVlKSBwcm9wLndyaXRhYmxlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gICAgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcbiAgICBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTtcbiAgICByZXR1cm4gQ29uc3RydWN0b3I7XG4gIH07XG59KSgpO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgX2NvcmUgPSByZXF1aXJlKFwiYmFiZWwtcnVudGltZS9jb3JlLWpzXCIpW1wiZGVmYXVsdFwiXTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBmdW5jdGlvbiBnZXQoX3gsIF94MiwgX3gzKSB7XG4gIHZhciBfYWdhaW4gPSB0cnVlO1xuXG4gIF9mdW5jdGlvbjogd2hpbGUgKF9hZ2Fpbikge1xuICAgIF9hZ2FpbiA9IGZhbHNlO1xuICAgIHZhciBvYmplY3QgPSBfeCxcbiAgICAgICAgcHJvcGVydHkgPSBfeDIsXG4gICAgICAgIHJlY2VpdmVyID0gX3gzO1xuICAgIGRlc2MgPSBwYXJlbnQgPSBnZXR0ZXIgPSB1bmRlZmluZWQ7XG5cbiAgICB2YXIgZGVzYyA9IF9jb3JlLk9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqZWN0LCBwcm9wZXJ0eSk7XG5cbiAgICBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgcGFyZW50ID0gX2NvcmUuT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iamVjdCk7XG5cbiAgICAgIGlmIChwYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF94ID0gcGFyZW50O1xuICAgICAgICBfeDIgPSBwcm9wZXJ0eTtcbiAgICAgICAgX3gzID0gcmVjZWl2ZXI7XG4gICAgICAgIF9hZ2FpbiA9IHRydWU7XG4gICAgICAgIGNvbnRpbnVlIF9mdW5jdGlvbjtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFwidmFsdWVcIiBpbiBkZXNjICYmIGRlc2Mud3JpdGFibGUpIHtcbiAgICAgIHJldHVybiBkZXNjLnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZ2V0dGVyID0gZGVzYy5nZXQ7XG5cbiAgICAgIGlmIChnZXR0ZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZ2V0dGVyLmNhbGwocmVjZWl2ZXIpO1xuICAgIH1cbiAgfVxufTtcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTsiLCJcInVzZSBzdHJpY3RcIjtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBmdW5jdGlvbiAoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHtcbiAgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSBcImZ1bmN0aW9uXCIgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90IFwiICsgdHlwZW9mIHN1cGVyQ2xhc3MpO1xuICB9XG5cbiAgc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHtcbiAgICAgIHZhbHVlOiBzdWJDbGFzcyxcbiAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuICBpZiAoc3VwZXJDbGFzcykgc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzcztcbn07XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgd2F2ZXNBdWRpbyA9IHtcbiAgLy8gY29yZVxuICBhdWRpb0NvbnRleHQ6IHJlcXVpcmUoJy4vZGlzdC9jb3JlL2F1ZGlvLWNvbnRleHQnKSxcbiAgVGltZUVuZ2luZTogcmVxdWlyZSgnLi9kaXN0L2NvcmUvdGltZS1lbmdpbmUnKSxcbiAgQXVkaW9UaW1lRW5naW5lOiByZXF1aXJlKCcuL2Rpc3QvY29yZS9hdWRpby10aW1lLWVuZ2luZScpLFxuICAvLyBlbmdpbmVzXG4gIEdyYW51bGFyRW5naW5lOiByZXF1aXJlKCcuL2Rpc3QvZW5naW5lcy9ncmFudWxhci1lbmdpbmUnKSxcbiAgTWV0cm9ub21lOiByZXF1aXJlKCcuL2Rpc3QvZW5naW5lcy9tZXRyb25vbWUnKSxcbiAgUGxheWVyRW5naW5lOiByZXF1aXJlKCcuL2Rpc3QvZW5naW5lcy9wbGF5ZXItZW5naW5lJyksXG4gIFNlZ21lbnRFbmdpbmU6IHJlcXVpcmUoJy4vZGlzdC9lbmdpbmVzL3NlZ21lbnQtZW5naW5lJyksXG4gIC8vIG1hc3RlcnNcbiAgUGxheUNvbnRyb2w6IHJlcXVpcmUoJy4vZGlzdC9tYXN0ZXJzL3BsYXktY29udHJvbCcpLFxuICBUcmFuc3BvcnQ6IHJlcXVpcmUoJy4vZGlzdC9tYXN0ZXJzL3RyYW5zcG9ydCcpLFxuICAvLyBleHBvc2UgdGhlc2UgP1xuICBTY2hlZHVsZXI6IHJlcXVpcmUoJy4vZGlzdC9tYXN0ZXJzL3NjaGVkdWxlcicpLFxuICBTaW1wbGVTY2hlZHVsZXI6IHJlcXVpcmUoJy4vZGlzdC9tYXN0ZXJzL3NpbXBsZS1zY2hlZHVsZXInKSxcbiAgLy8gdXRpbHNcbiAgUHJpb3JpdHlRdWV1ZTogcmVxdWlyZSgnLi9kaXN0L3V0aWxzL3ByaW9yaXR5LXF1ZXVlJyksXG4gIFNjaGVkdWxpbmdRdWV1ZTogcmVxdWlyZSgnLi9kaXN0L3V0aWxzL3NjaGVkdWxpbmctcXVldWUnKSxcbiAgLy8gZmFjdG9yaWVzXG4gIGdldFNjaGVkdWxlcjogcmVxdWlyZSgnLi9kaXN0L21hc3RlcnMvZmFjdG9yaWVzJykuZ2V0U2NoZWR1bGVyLFxuICBnZXRTaW1wbGVTY2hlZHVsZXI6IHJlcXVpcmUoJy4vZGlzdC9tYXN0ZXJzL2ZhY3RvcmllcycpLmdldFNpbXBsZVNjaGVkdWxlclxufTtcblxuXG5cbm1vZHVsZS5leHBvcnRzID0gd2F2ZXNBdWRpbzsiLCJpbXBvcnQgTG9hZGVyIGZyb20gJy4vbG9hZGVyJztcblxuXG4vKipcbiAqIEdldHMgY2FsbGVkIGlmIGEgcGFyYW1ldGVyIGlzIG1pc3NpbmcgYW5kIHRoZSBleHByZXNzaW9uXG4gKiBzcGVjaWZ5aW5nIHRoZSBkZWZhdWx0IHZhbHVlIGlzIGV2YWx1YXRlZC5cbiAqIEBmdW5jdGlvblxuICovXG5mdW5jdGlvbiB0aHJvd0lmTWlzc2luZygpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHBhcmFtZXRlcicpO1xufVxuXG5sZXQgYXVkaW9Db250ZXh0O1xuXG53aW5kb3cuQXVkaW9Db250ZXh0ID0gKHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCk7XG5cbnRyeSB7XG4gIGF1ZGlvQ29udGV4dCA9IG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KCk7XG59IGNhdGNoIChlKSB7fVxuXG5cbi8qKlxuICogQXVkaW9CdWZmZXJMb2FkZXJcbiAqIEBjbGFzc1xuICogQGNsYXNzZGVzYyBQcm9taXNlIGJhc2VkIGltcGxlbWVudGF0aW9uIG9mIFhNTEh0dHBSZXF1ZXN0IExldmVsIDIgZm9yIEdFVCBtZXRob2QgYW5kIGRlY29kZSBhdWRpbyBkYXRhIGZvciBhcnJheWJ1ZmZlci5cbiAqIEluaGVyaXQgZnJvbSBMb2FkZXIgY2xhc3NcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQXVkaW9CdWZmZXJMb2FkZXIgZXh0ZW5kcyBMb2FkZXIge1xuICAvKipcbiAgICogQGNvbnN0cnVjdHNcbiAgICogU2V0IHRoZSByZXNwb25zZVR5cGUgdG8gJ2FycmF5YnVmZmVyJyBhbmQgaW5pdGlhbGl6ZSBvcHRpb25zLlxuICAgKi9cbiAgY29uc3RydWN0b3IocmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJykge1xuICAgIHN1cGVyKHJlc3BvbnNlVHlwZSk7XG4gICAgdGhpcy5vcHRpb25zID0ge1xuICAgICAgXCJ3cmFwQXJvdW5kRXh0ZW5zaW9uXCI6IDBcbiAgICB9O1xuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuXG4gIH1cblxuICAvKipcbiAgICogQGZ1bmN0aW9uIC0gTWV0aG9kIGZvciBwcm9taXNlIGF1ZGlvIGZpbGUgbG9hZGluZyBhbmQgZGVjb2RpbmcuXG4gICAqIEBwYXJhbSB7KHN0cmluZ3xzdHJpbmdbXSl9IGZpbGVVUkxzIC0gVGhlIFVSTChzKSBvZiB0aGUgYXVkaW8gZmlsZXMgdG8gbG9hZC4gQWNjZXB0cyBhIFVSTCBwb2ludGluZyB0byB0aGUgZmlsZSBsb2NhdGlvbiBvciBhbiBhcnJheSBvZiBVUkxzLlxuICAgKiBAcGFyYW0ge3t3cmFwQXJvdW5kRXh0ZW5zaW9uOiBudW1iZXJ9fSBbb3B0aW9uc10gLSBPYmplY3Qgd2l0aCBhIHdyYXBBcm91bmRFeHRlbnNpb24ga2V5IHdoaWNoIHNldCB0aGUgbGVuZ3RoLCBpbiBzZWNvbmRzIHRvIGJlIGNvcGllZCBmcm9tIHRoZSBiZWdpbmluZ1xuICAgKiBhdCB0aGUgZW5kIG9mIHRoZSByZXR1cm5lZCBBdWRpb0J1ZmZlclxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gIGxvYWQoZmlsZVVSTHMgPSB0aHJvd0lmTWlzc2luZygpLCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMub3B0aW9ucy53cmFwQXJvdW5kRXh0ZW5zaW9uID0gdGhpcy5vcHRpb25zLndyYXBBcm91bmRFeHRlbnNpb24gfHwgMDtcbiAgICByZXR1cm4gc3VwZXIubG9hZChmaWxlVVJMcyk7XG4gIH1cblxuICAvKipcbiAgICogQGZ1bmN0aW9uIC0gTG9hZCBhIHNpbmdsZSBhdWRpbyBmaWxlLCBkZWNvZGUgaXQgaW4gYW4gQXVkaW9CdWZmZXIsIHJldHVybiBhIFByb21pc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZpbGVVUkwgLSBUaGUgVVJMIG9mIHRoZSBhdWRpbyBmaWxlIGxvY2F0aW9uIHRvIGxvYWQuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgbG9hZE9uZShmaWxlVVJMKSB7XG4gICAgcmV0dXJuIHN1cGVyLmxvYWRPbmUoZmlsZVVSTClcbiAgICAgIC50aGVuKFxuICAgICAgICB0aGlzLmRlY29kZUF1ZGlvRGF0YS5iaW5kKHRoaXMpLFxuICAgICAgICBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAZnVuY3Rpb24gLSBMb2FkIGFsbCBhdWRpbyBmaWxlcyBhdCBvbmNlIGluIGEgc2luZ2xlIGFycmF5LCBkZWNvZGUgdGhlbSBpbiBhbiBhcnJheSBvZiBBdWRpb0J1ZmZlcnMsIGFuZCByZXR1cm4gYSBQcm9taXNlLlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBmaWxlVVJMcyAtIFRoZSBVUkxzIGFycmF5IG9mIHRoZSBhdWRpbyBmaWxlcyB0byBsb2FkLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gIGxvYWRBbGwoZmlsZVVSTHMpIHtcbiAgICByZXR1cm4gc3VwZXIubG9hZEFsbChmaWxlVVJMcylcbiAgICAgIC50aGVuKFxuICAgICAgICAoYXJyYXlidWZmZXJzKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGFycmF5YnVmZmVycy5tYXAoKGFycmF5YnVmZmVyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kZWNvZGVBdWRpb0RhdGEuYmluZCh0aGlzKShhcnJheWJ1ZmZlcik7XG4gICAgICAgICAgfSkpO1xuICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjsgLy8gVE9ETzogYmV0dGVyIGVycm9yIGhhbmRsZXJcbiAgICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQGZ1bmN0aW9uIC0gRGVjb2RlIEF1ZGlvIERhdGEsIHJldHVybiBhIFByb21pc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHthcnJheWJ1ZmZlcn0gLSBUaGUgYXJyYXlidWZmZXIgb2YgdGhlIGxvYWRlZCBhdWRpbyBmaWxlIHRvIGJlIGRlY29kZWQuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgZGVjb2RlQXVkaW9EYXRhKGFycmF5YnVmZmVyKSB7XG4gICAgaWYgKGFycmF5YnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGF1ZGlvQ29udGV4dC5kZWNvZGVBdWRpb0RhdGEoXG4gICAgICAgICAgYXJyYXlidWZmZXIsIC8vIHJldHVybmVkIGF1ZGlvIGRhdGEgYXJyYXlcbiAgICAgICAgICAoYnVmZmVyKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLndyYXBBcm91bmRFeHRlbnNpb24gPT09IDApIHJlc29sdmUoYnVmZmVyKTtcbiAgICAgICAgICAgIGVsc2UgcmVzb2x2ZSh0aGlzLl9fd3JhcEFyb3VuZChidWZmZXIpKTtcbiAgICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJEZWNvZGVBdWRpb0RhdGEgZXJyb3JcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKGFycmF5YnVmZmVyKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAZnVuY3Rpb24gLSBXcmFwQXJvdW5kLCBjb3B5IHRoZSBiZWdpbmluZyBpbnB1dCBidWZmZXIgdG8gdGhlIGVuZCBvZiBhbiBvdXRwdXQgYnVmZmVyXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7YXJyYXlidWZmZXJ9IGluQnVmZmVyIHthcnJheWJ1ZmZlcn0gLSBUaGUgaW5wdXQgYnVmZmVyXG4gICAqIEByZXR1cm5zIHthcnJheWJ1ZmZlcn0gLSBUaGUgcHJvY2Vzc2VkIGJ1ZmZlciAod2l0aCBmcmFtZSBjb3BpZWQgZnJvbSB0aGUgYmVnaW5pbmcgdG8gdGhlIGVuZClcbiAgICovXG4gIF9fd3JhcEFyb3VuZChpbkJ1ZmZlcikge1xuICAgIHZhciBsZW5ndGggPSBpbkJ1ZmZlci5sZW5ndGggKyB0aGlzLm9wdGlvbnMud3JhcEFyb3VuZEV4dGVuc2lvbiAqIGluQnVmZmVyLnNhbXBsZVJhdGU7XG5cbiAgICB2YXIgb3V0QnVmZmVyID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJ1ZmZlcihpbkJ1ZmZlci5udW1iZXJPZkNoYW5uZWxzLCBsZW5ndGgsIGluQnVmZmVyLnNhbXBsZVJhdGUpO1xuICAgIHZhciBhcnJheUNoRGF0YSwgYXJyYXlPdXRDaERhdGE7XG5cbiAgICBmb3IgKHZhciBjaGFubmVsID0gMDsgY2hhbm5lbCA8IGluQnVmZmVyLm51bWJlck9mQ2hhbm5lbHM7IGNoYW5uZWwrKykge1xuICAgICAgYXJyYXlDaERhdGEgPSBpbkJ1ZmZlci5nZXRDaGFubmVsRGF0YShjaGFubmVsKTtcbiAgICAgIGFycmF5T3V0Q2hEYXRhID0gb3V0QnVmZmVyLmdldENoYW5uZWxEYXRhKGNoYW5uZWwpO1xuXG4gICAgICBhcnJheU91dENoRGF0YS5mb3JFYWNoKGZ1bmN0aW9uKHNhbXBsZSwgaW5kZXgpIHtcbiAgICAgICAgaWYgKGluZGV4IDwgaW5CdWZmZXIubGVuZ3RoKSBhcnJheU91dENoRGF0YVtpbmRleF0gPSBhcnJheUNoRGF0YVtpbmRleF07XG4gICAgICAgIGVsc2UgYXJyYXlPdXRDaERhdGFbaW5kZXhdID0gYXJyYXlDaERhdGFbaW5kZXggLSBpbkJ1ZmZlci5sZW5ndGhdO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dEJ1ZmZlcjtcbiAgfVxufVxuIiwiLyoqXG4gKiBHZXRzIGNhbGxlZCBpZiBhIHBhcmFtZXRlciBpcyBtaXNzaW5nIGFuZCB0aGUgZXhwcmVzc2lvblxuICogc3BlY2lmeWluZyB0aGUgZGVmYXVsdCB2YWx1ZSBpcyBldmFsdWF0ZWQuXG4gKiBAZnVuY3Rpb25cbiAqL1xuZnVuY3Rpb24gdGhyb3dJZk1pc3NpbmcoKSB7XG4gIHRocm93IG5ldyBFcnJvcignTWlzc2luZyBwYXJhbWV0ZXInKTtcbn1cblxuXG4vKipcbiAqIExvYWRlclxuICogQGNsYXNzXG4gKiBAY2xhc3NkZXNjIFByb21pc2UgYmFzZWQgaW1wbGVtZW50YXRpb24gb2YgWE1MSHR0cFJlcXVlc3QgTGV2ZWwgMiBmb3IgR0VUIG1ldGhvZC5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTG9hZGVyIHtcbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RzXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBbcmVzcG9uc2VUeXBlPVwiXCJdIC0gcmVzcG9uc2VUeXBlJ3MgdmFsdWUsIFwidGV4dFwiIChlcXVhbCB0byBcIlwiKSwgXCJhcnJheWJ1ZmZlclwiLCBcImJsb2JcIiwgXCJkb2N1bWVudFwiIG9yIFwianNvblwiXG4gICAqL1xuICBjb25zdHJ1Y3RvcihyZXNwb25zZVR5cGUgPSB1bmRlZmluZWQpIHtcbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICAvLyByZW5hbWUgdG8gYG9uUHJvZ3Jlc3NgID9cbiAgICB0aGlzLnByb2dyZXNzQ2IgPSB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogTWV0aG9kIGZvciBhIHByb21pc2UgYmFzZWQgZmlsZSBsb2FkaW5nLlxuICAgKiBJbnRlcm5hbGx5IHN3aXRjaCBiZXR3ZWVuIGxvYWRPbmUgYW5kIGxvYWRBbGwuXG4gICAqIEBwdWJsaWNcbiAgICogQHBhcmFtIHsoc3RyaW5nfHN0cmluZ1tdKX0gZmlsZVVSTHMgLSBUaGUgVVJMKHMpIG9mIHRoZSBmaWxlcyB0byBsb2FkLiBBY2NlcHRzIGEgVVJMIHBvaW50aW5nIHRvIHRoZSBmaWxlIGxvY2F0aW9uIG9yIGFuIGFycmF5IG9mIFVSTHMuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgbG9hZChmaWxlVVJMcyA9IHRocm93SWZNaXNzaW5nKCkpIHtcbiAgICBpZiAoZmlsZVVSTHMgPT09IHVuZGVmaW5lZCkgdGhyb3cgKG5ldyBFcnJvcignbG9hZCBuZWVkcyBhdCBsZWFzdCBhIHVybCB0byBsb2FkJykpO1xuICAgIGlmIChBcnJheS5pc0FycmF5KGZpbGVVUkxzKSkge1xuICAgICAgcmV0dXJuIHRoaXMubG9hZEFsbChmaWxlVVJMcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLmxvYWRPbmUoZmlsZVVSTHMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAZnVuY3Rpb24gLSBMb2FkIGEgc2luZ2xlIGZpbGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGZpbGVVUkwgLSBUaGUgVVJMIG9mIHRoZSBmaWxlIHRvIGxvYWQuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgbG9hZE9uZShmaWxlVVJMKSB7XG4gICAgcmV0dXJuIHRoaXMuZmlsZUxvYWRpbmdSZXF1ZXN0KGZpbGVVUkwpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBmdW5jdGlvbiAtIExvYWQgYWxsIGZpbGVzIGF0IG9uY2UgaW4gYSBzaW5nbGUgYXJyYXkgYW5kIHJldHVybiBhIFByb21pc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmdbXX0gZmlsZVVSTHMgLSBUaGUgVVJMcyBhcnJheSBvZiB0aGUgZmlsZXMgdG8gbG9hZC5cbiAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAqL1xuICBsb2FkQWxsKGZpbGVVUkxzKSB7XG4gICAgdmFyIHVybHNDb3VudCA9IGZpbGVVUkxzLmxlbmd0aCxcbiAgICAgIHByb21pc2VzID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHVybHNDb3VudDsgKytpKSB7XG4gICAgICBwcm9taXNlcy5wdXNoKHRoaXMuZmlsZUxvYWRpbmdSZXF1ZXN0KGZpbGVVUkxzW2ldLCBpKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAZnVuY3Rpb24gLSBMb2FkIGEgZmlsZSBhc3luY2hyb25vdXNseSwgcmV0dXJuIGEgUHJvbWlzZS5cbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgb2YgdGhlIGZpbGUgdG8gbG9hZFxuICAgKiBAcGFyYW0ge3N0cmluZ30gW2luZGV4XSAtIFRoZSBpbmRleCBvZiB0aGUgZmlsZSBpbiB0aGUgYXJyYXkgb2YgZmlsZXMgdG8gbG9hZFxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gIGZpbGVMb2FkaW5nUmVxdWVzdCh1cmwsIGluZGV4KSB7XG4gICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShcbiAgICAgIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgICAgICByZXF1ZXN0LmluZGV4ID0gaW5kZXg7XG4gICAgICAgIGlmICh0aGlzLnJlc3BvbnNlVHlwZSkge1xuICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gdGhpcy5yZXNwb25zZVR5cGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHN1ZmZpeCA9ICcuanNvbic7XG4gICAgICAgICAgaWYgKHVybC5pbmRleE9mKHN1ZmZpeCwgdGhpcy5sZW5ndGggLSBzdWZmaXgubGVuZ3RoKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIC8vIFRlc3QgcmVxdWVzdC5zdGF0dXMgdmFsdWUsIGFzIDQwNCB3aWxsIGFsc28gZ2V0IHRoZXJlXG4gICAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDAgfHwgcmVxdWVzdC5zdGF0dXMgPT09IDMwNCkge1xuICAgICAgICAgICAgLy8gSGFjayBmb3IgaU9TIDcsIHRvIHJlbW92ZSBhcyBzb29uIGFzIHBvc3NpYmxlXG4gICAgICAgICAgICBpZiAodGhpcy5yZXNwb25zZVR5cGUgPT09ICdqc29uJyAmJiB0eXBlb2YocmVxdWVzdC5yZXNwb25zZSkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2UgPSBKU09OLnBhcnNlKHJlcXVlc3QucmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZShyZXF1ZXN0LnJlc3BvbnNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihyZXF1ZXN0LnN0YXR1c1RleHQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgKGV2dCkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLnByb2dyZXNzQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmIChpbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3NDYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgIHZhbHVlOiBldnQubG9hZGVkIC8gZXZ0LnRvdGFsLFxuICAgICAgICAgICAgICAgIGxvYWRlZDogZXZ0LmxvYWRlZCxcbiAgICAgICAgICAgICAgICB0b3RhbDogZXZ0LnRvdGFsXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5wcm9ncmVzc0NhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICB2YWx1ZTogZXZ0LmxvYWRlZCAvIGV2dC50b3RhbCxcbiAgICAgICAgICAgICAgICBsb2FkZWQ6IGV2dC5sb2FkZWQsXG4gICAgICAgICAgICAgICAgdG90YWw6IGV2dC50b3RhbFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBNYW5hZ2UgbmV0d29yayBlcnJvcnNcbiAgICAgICAgcmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ05ldHdvcmsgRXJyb3InKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgICAgfSk7XG4gICAgcmV0dXJuIHByb21pc2U7XG4gIH1cblxuICAvKipcbiAgICogQGZ1bmN0aW9uIC0gR2V0IHRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byBnZXQgdGhlIHByb2dyZXNzIG9mIGZpbGUgbG9hZGluZyBwcm9jZXNzLlxuICAgKiBUaGlzIGlzIG9ubHkgZm9yIHRoZSBmaWxlIGxvYWRpbmcgcHJvZ3Jlc3MgYXMgZGVjb2RlQXVkaW9EYXRhIGRvZXNuJ3RcbiAgICogZXhwb3NlIGEgZGVjb2RlIHByb2dyZXNzIHZhbHVlLlxuICAgKiBAcmV0dXJucyB7TG9hZGVyfnByb2dyZXNzQ2FsbGJhY2t9XG4gICAqL1xuICBnZXQgcHJvZ3Jlc3NDYWxsYmFjaygpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9ncmVzc0NiO1xuICB9XG5cbiAgLyoqXG4gICAqIEBmdW5jdGlvbiAtIFNldCB0aGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gZ2V0IHRoZSBwcm9ncmVzcyBvZiBmaWxlIGxvYWRpbmcgcHJvY2Vzcy5cbiAgICogVGhpcyBpcyBvbmx5IGZvciB0aGUgZmlsZSBsb2FkaW5nIHByb2dyZXNzIGFzIGRlY29kZUF1ZGlvRGF0YSBkb2Vzbid0XG4gICAqIGV4cG9zZSBhIGRlY29kZSBwcm9ncmVzcyB2YWx1ZS5cbiAgICogQHBhcmFtIHtMb2FkZXJ+cHJvZ3Jlc3NDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgdGhhdCBoYW5kbGVzIHRoZSByZXNwb25zZS5cbiAgICovXG4gIHNldCBwcm9ncmVzc0NhbGxiYWNrKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5wcm9ncmVzc0NiID0gY2FsbGJhY2s7XG4gIH1cbn1cbiIsImltcG9ydCBBdWRpb0J1ZmZlckxvYWRlciBmcm9tICcuL2F1ZGlvLWJ1ZmZlci1sb2FkZXInO1xuXG5cbi8qKlxuICogU3VwZXJMb2FkZXJcbiAqIEBjbGFzc1xuICogQGNsYXNzZGVzYyBIZWxwZXIgdG8gbG9hZCBtdWx0aXBsZSB0eXBlIG9mIGZpbGVzLCBhbmQgZ2V0IHRoZW0gaW4gdGhlaXIgdXNlZnVsIHR5cGUsIGpzb24gZm9yIGpzb24gZmlsZXMsIEF1ZGlvQnVmZmVyIGZvciBhdWRpbyBmaWxlcy5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU3VwZXJMb2FkZXIgZXh0ZW5kcyBBdWRpb0J1ZmZlckxvYWRlciB7XG4gIC8qKlxuICAgKiBAY29uc3RydWN0c1xuICAgKiBVc2UgY29tcG9zaXRpb24gdG8gc2V0dXAgYXBwcm9wcmlhdGUgZmlsZSBsb2FkZXJzXG4gICAqL1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihudWxsKTtcbiAgICAvLyBieXBhc3MgQXVkaW9CdWZmZXJMb2FkZXIgY29uc3RydWN0b3IuIFRoaXMgaXMgYmFkIGJ1dCBpdCB3b3Jrcy5cbiAgfVxufVxuIiwiLyoqXG4gKiBAZmlsZSBMb2FkZXJzOiBBdWRpb0J1ZmZlciBsb2FkZXIgYW5kIHV0aWxpdGllc1xuICogQGF1dGhvciBTYW11ZWwgR29sZHN6bWlkdFxuICogQHZlcnNpb24gMC4xLjFcbiAqL1xuXG4vLyBDb21tb25KUyBmdW5jdGlvbiBleHBvcnRcbm1vZHVsZS5leHBvcnRzID0ge1xuICBMb2FkZXI6IHJlcXVpcmUoJy4vZGlzdC9sb2FkZXInKSxcbiAgQXVkaW9CdWZmZXJMb2FkZXI6IHJlcXVpcmUoJy4vZGlzdC9hdWRpby1idWZmZXItbG9hZGVyJyksXG4gIFN1cGVyTG9hZGVyOiByZXF1aXJlKCcuL2Rpc3Qvc3VwZXItbG9hZGVyJylcbn07XG4iXX0=
