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
  return Math.max.apply(null, array);
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
    this._energyBufferMaxLength = 2; // TODO
    this._lastBeatPlayed = null;
    this._mode = options.mode;
    this._p1 = null;
    this._p1Accent = null;
    this._p1NoAccent = null;
    this._p2 = null;
    this._p2BaseValue = null;
    this._p2MultiplyingFactor = null;
    this._segmentEngine = new SegmentEngine();
    this._segmentIndices = sortMarkerIndices(options.segmentMarkers);
    this._segmentMarkers = options.segmentMarkers;

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

    /**
     *
     */
    // advancePosition(time, position, speed) {
    //   const currentBeat = Math.floor((time - this.startTime - this.offset) / this.period);
    //   const eMax = getMaxOfArray(this._energyBuffer);
    //   const rand = Math.random();
    //   let p = 0.5;
    //
    //   if (accents.indexOf(currentBeat % 16) === -1)
    //     p = 0.9;
    //
    //   if ((eMax > 0.9 && rand > p) || eMax === 1)
    //     this.trigger(time, 'chord');
    //   else if (eMax > 0.6)
    //     this.trigger(time, 'mute')
    //
    //   if (speed < 0)
    //     return position - this.period;
    //
    //   return position + this.period;
    // }

  }, {
    key: 'advancePosition',
    value: function advancePosition(time, position, speed) {
      var currentBeat = Math.floor((time - this.startTime - this.offset) / this.period);
      var eMax = Math.pow(getMaxOfArray(this._energyBuffer), 2); // TODO (inputM)
      var rand = Math.random();

      // If the beat is on the original song's accents, high probability to play
      if (accents.indexOf(currentBeat % 16) > -1) this._p1 = this._p1Accent;else this._p1 = this._p1NoAccent;

      // If the last chord was played at least 3 beats before the current one,
      // increase probability to play
      if (this._lastBeatPlayed && this._lastBeatPlayed < currentBeat - 2) this._p2 *= this._p2MultiplyingFactor;

      // Calculate the probability to play a chord on this beat
      var p = Math.max(this._p1, Math.min(this._p1 * this._p2, 1));

      // Decide what to play
      if (eMax > 0.9 && rand < p) {
        this.trigger(time, 'chord');
        this._lastBeatPlayed = currentBeat;
        this._p2 = this._p2BaseValue;
      } else if (eMax > 0.5) this.trigger(time, 'mute');

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

      if (currentBeat >= 0 && currentBeat < 200) currentChord = this._chordProgression[currentBeat];

      if (type === 'chord' && currentChord) index = getRandomValue(this._segmentIndices[currentChord]);else if (type === 'mute' || currentBeat < 0) index = getRandomValue(this._segmentIndices['mute']);

      // Stop playing after the end of the backtrack
      if (currentBeat < 200) {
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
//# sourceMappingURL=data:application/json;base64,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LGNBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ25CLGNBQUksQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDO0FBQ3ZCLGNBQUksQ0FBQyxZQUFZLEdBQUcsR0FBRyxDQUFDO0FBQ3hCLGNBQUksQ0FBQyxvQkFBb0IsR0FBRyxHQUFHLENBQUM7QUFDaEMsZ0JBQU07QUFBQSxPQUNUO0tBQ0Y7OztTQS9MRyxZQUFZO0dBQVMsVUFBVTs7QUFrTXJDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDIiwiZmlsZSI6InNyYy9zY3NzL21haW4uc2NzcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGZpbGUgR3VpdGFyIGVuZ2luZS5cbiAqIEBhdXRob3IgU8OpYmFzdGllbiBSb2Jhc3praWV3aWN6IFtzZWJhc3RpZW5Acm9iYXN6a2lld2ljei5jb21dXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBMaWJyYXJpZXNcbmNvbnN0IGF1ZGlvQ29udGV4dCA9IHJlcXVpcmUoJ3dhdmVzLWF1ZGlvJykuYXVkaW9Db250ZXh0O1xuY29uc3QgU2VnbWVudEVuZ2luZSA9IHJlcXVpcmUoJ3dhdmVzLWF1ZGlvJykuU2VnbWVudEVuZ2luZTtcbmNvbnN0IFRpbWVFbmdpbmUgPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpLlRpbWVFbmdpbmU7XG5cbi8vIEhlbHBlciBmdW5jdGlvbnNcbmZ1bmN0aW9uIGdldE1heE9mQXJyYXkoYXJyYXkpIHtcbiAgcmV0dXJuIE1hdGgubWF4LmFwcGx5KG51bGwsIGFycmF5KTtcbn1cblxuZnVuY3Rpb24gZ2V0UmFuZG9tSW50KG1pbiwgbWF4KSB7XG4gIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSkgKyBtaW47XG59XG5cbmZ1bmN0aW9uIGdldFJhbmRvbVZhbHVlKGFycmF5KSB7XG4gIHJldHVybiBhcnJheVtnZXRSYW5kb21JbnQoMCwgYXJyYXkubGVuZ3RoIC0gMSldO1xufVxuXG5mdW5jdGlvbiBjaG9yZENvbnZlcnRlcihjaG9yZCwgdmFyaWF0aW9uKSB7XG4gIGlmIChjaG9yZCA9PT0gMClcbiAgICByZXR1cm4gJ211dGUnO1xuXG4gIHJldHVybiBjaG9yZHNbKGNob3JkIC0gMSkgKiAyICsgdmFyaWF0aW9uIC0gMV07XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQ2hvcmRQcm9ncmVzc2lvbigpIHtcbiAgbGV0IGNob3JkUHJvZ3Jlc3Npb24gPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IDIwMDsgaSsrKSB7IC8vICg0KzIpIGJhcnMgKiA4IGJlYXRzICogNCBlaWd0aC1ub3RlcyA9IDE5MlxuICAgIGxldCBjaG9yZDtcbiAgICBpZiAoaSAlIDEyOCA8IDMyKVxuICAgICAgY2hvcmQgPSAnQSNtJztcbiAgICBlbHNlIGlmIChpICUgMTI4IDwgNjQpXG4gICAgICBjaG9yZCA9ICdHIyc7XG4gICAgZWxzZSBpZiAoaSAlIDEyOCA8IDk2KVxuICAgICAgY2hvcmQgPSAnRCNtJztcbiAgICBlbHNlXG4gICAgICBjaG9yZCA9ICdGIyc7XG5cbiAgICBsZXQgdmFyaWF0aW9uO1xuICAgIGlmIChpICUgMTYgPCAzKVxuICAgICAgdmFyaWF0aW9uID0gJy1oaWdoJztcbiAgICBlbHNlXG4gICAgICB2YXJpYXRpb24gPSAnLWxvdyc7XG5cbiAgICBjaG9yZFByb2dyZXNzaW9uW2ldID0gY2hvcmQgKyB2YXJpYXRpb247XG4gIH1cblxuICByZXR1cm4gY2hvcmRQcm9ncmVzc2lvbjtcbn1cblxuZnVuY3Rpb24gc29ydE1hcmtlckluZGljZXMobWFya2Vycykge1xuICBsZXQgc29ydGVkSW5kaWNlcyA9IHt9O1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbWFya2Vycy5wb3NpdGlvbi5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNob3JkTmFtZSA9IGNob3JkQ29udmVydGVyKG1hcmtlcnMuY2hvcmRbaV0sXG4gICAgICBtYXJrZXJzLnZhcmlhdGlvbltpXSk7XG5cbiAgICBpZiAoIXNvcnRlZEluZGljZXNbY2hvcmROYW1lXSlcbiAgICAgIHNvcnRlZEluZGljZXNbY2hvcmROYW1lXSA9IFtdO1xuXG4gICAgaWYgKG1hcmtlcnMuc3RyZW5ndGhbaV0gPCAyKVxuICAgICAgc29ydGVkSW5kaWNlc1tjaG9yZE5hbWVdLnB1c2goaSk7XG4gIH1cblxuICByZXR1cm4gc29ydGVkSW5kaWNlcztcbn1cblxuLy8gSGVscGVyIGNvbnN0YW50c1xuY29uc3QgY2hvcmRzID0gW1xuICAnQSNtLWhpZ2gnLFxuICAnQSNtLWxvdycsXG4gICdHIy1oaWdoJyxcbiAgJ0cjLWxvdycsXG4gICdEI20taGlnaCcsXG4gICdEI20tbG93JyxcbiAgJ0YjLWhpZ2gnLFxuICAnRiMtbG93J1xuXTtcbmNvbnN0IGFjY2VudHMgPSBbMCwgMywgNiwgMTAsIDEyLCAxMywgMTQsIDE1XTtcblxuY2xhc3MgR3VpdGFyRW5naW5lIGV4dGVuZHMgVGltZUVuZ2luZSB7XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIC8vIFB1YmxpYyBhdHRyaWJ1dGVzXG4gICAgdGhpcy5vZmZzZXQgPSBvcHRpb25zLm9mZnNldCB8fCAwO1xuICAgIHRoaXMub3V0cHV0Tm9kZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgdGhpcy5wZXJpb2QgPSBvcHRpb25zLnBlcmlvZDtcbiAgICB0aGlzLnN0YXJ0VGltZSA9IG51bGw7XG5cbiAgICAvLyBQcml2YXRlIGF0dHJpYnV0ZXNcbiAgICB0aGlzLl9jaG9yZFByb2dyZXNzaW9uID0gZ2VuZXJhdGVDaG9yZFByb2dyZXNzaW9uKCk7XG4gICAgdGhpcy5fZW5lcmd5QnVmZmVyID0gW107XG4gICAgdGhpcy5fZW5lcmd5QnVmZmVyTWF4TGVuZ3RoID0gMjsgLy8gVE9ET1xuICAgIHRoaXMuX2xhc3RCZWF0UGxheWVkID0gbnVsbDtcbiAgICB0aGlzLl9tb2RlID0gb3B0aW9ucy5tb2RlO1xuICAgIHRoaXMuX3AxID0gbnVsbDtcbiAgICB0aGlzLl9wMUFjY2VudCA9IG51bGw7XG4gICAgdGhpcy5fcDFOb0FjY2VudCA9IG51bGw7XG4gICAgdGhpcy5fcDIgPSBudWxsO1xuICAgIHRoaXMuX3AyQmFzZVZhbHVlID0gbnVsbDtcbiAgICB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yID0gbnVsbDtcbiAgICB0aGlzLl9zZWdtZW50RW5naW5lID0gbmV3IFNlZ21lbnRFbmdpbmUoKTtcbiAgICB0aGlzLl9zZWdtZW50SW5kaWNlcyA9IHNvcnRNYXJrZXJJbmRpY2VzKG9wdGlvbnMuc2VnbWVudE1hcmtlcnMpO1xuICAgIHRoaXMuX3NlZ21lbnRNYXJrZXJzID0gb3B0aW9ucy5zZWdtZW50TWFya2VycztcblxuICAgIC8vIFNlZ21lbnQgZW5naW5lIGNvbmZpZ3VyYXRpb25cbiAgICB0aGlzLl9zZWdtZW50RW5naW5lLmJ1ZmZlciA9IG9wdGlvbnMuYXVkaW9CdWZmZXI7XG4gICAgdGhpcy5fc2VnbWVudEVuZ2luZS5wb3NpdGlvbkFycmF5ID0gdGhpcy5fc2VnbWVudE1hcmtlcnMucG9zaXRpb247XG4gICAgdGhpcy5fc2VnbWVudEVuZ2luZS5kdXJhdGlvbkFycmF5ID0gdGhpcy5fc2VnbWVudE1hcmtlcnMuZHVyYXRpb247XG4gICAgdGhpcy5fc2VnbWVudEVuZ2luZS5jb25uZWN0KHRoaXMub3V0cHV0Tm9kZSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHN5bmNQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICBsZXQgbmV4dFBvc2l0aW9uID0gTWF0aC5mbG9vcihwb3NpdGlvbiAvIHRoaXMucGVyaW9kKSAqIHRoaXMucGVyaW9kO1xuXG4gICAgaWYgKHNwZWVkID4gMCAmJiBuZXh0UG9zaXRpb24gPCBwb3NpdGlvbilcbiAgICAgIG5leHRQb3NpdGlvbiArPSB0aGlzLnBlcmlvZDtcbiAgICBlbHNlIGlmIChzcGVlZCA8IDAgJiYgbmV4dFBvc2l0aW9uID4gcG9zaXRpb24pXG4gICAgICBuZXh0UG9zaXRpb24gLT0gdGhpcy5wZXJpb2Q7XG5cbiAgICByZXR1cm4gbmV4dFBvc2l0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICAvLyBhZHZhbmNlUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSB7XG4gIC8vICAgY29uc3QgY3VycmVudEJlYXQgPSBNYXRoLmZsb29yKCh0aW1lIC0gdGhpcy5zdGFydFRpbWUgLSB0aGlzLm9mZnNldCkgLyB0aGlzLnBlcmlvZCk7XG4gIC8vICAgY29uc3QgZU1heCA9IGdldE1heE9mQXJyYXkodGhpcy5fZW5lcmd5QnVmZmVyKTtcbiAgLy8gICBjb25zdCByYW5kID0gTWF0aC5yYW5kb20oKTtcbiAgLy8gICBsZXQgcCA9IDAuNTtcbiAgLy9cbiAgLy8gICBpZiAoYWNjZW50cy5pbmRleE9mKGN1cnJlbnRCZWF0ICUgMTYpID09PSAtMSlcbiAgLy8gICAgIHAgPSAwLjk7XG4gIC8vXG4gIC8vICAgaWYgKChlTWF4ID4gMC45ICYmIHJhbmQgPiBwKSB8fCBlTWF4ID09PSAxKVxuICAvLyAgICAgdGhpcy50cmlnZ2VyKHRpbWUsICdjaG9yZCcpO1xuICAvLyAgIGVsc2UgaWYgKGVNYXggPiAwLjYpXG4gIC8vICAgICB0aGlzLnRyaWdnZXIodGltZSwgJ211dGUnKVxuICAvL1xuICAvLyAgIGlmIChzcGVlZCA8IDApXG4gIC8vICAgICByZXR1cm4gcG9zaXRpb24gLSB0aGlzLnBlcmlvZDtcbiAgLy9cbiAgLy8gICByZXR1cm4gcG9zaXRpb24gKyB0aGlzLnBlcmlvZDtcbiAgLy8gfVxuXG4gIGFkdmFuY2VQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICBjb25zdCBjdXJyZW50QmVhdCA9IE1hdGguZmxvb3IoXG4gICAgICAodGltZSAtIHRoaXMuc3RhcnRUaW1lIC0gdGhpcy5vZmZzZXQpIC8gdGhpcy5wZXJpb2RcbiAgICApO1xuICAgIGNvbnN0IGVNYXggPSBNYXRoLnBvdyhnZXRNYXhPZkFycmF5KHRoaXMuX2VuZXJneUJ1ZmZlciksIDIpIC8vIFRPRE8gKGlucHV0TSlcbiAgICBjb25zdCByYW5kID0gTWF0aC5yYW5kb20oKTtcblxuICAgIC8vIElmIHRoZSBiZWF0IGlzIG9uIHRoZSBvcmlnaW5hbCBzb25nJ3MgYWNjZW50cywgaGlnaCBwcm9iYWJpbGl0eSB0byBwbGF5XG4gICAgaWYgKGFjY2VudHMuaW5kZXhPZihjdXJyZW50QmVhdCAlIDE2KSA+IC0xKVxuICAgICAgdGhpcy5fcDEgPSB0aGlzLl9wMUFjY2VudDtcbiAgICBlbHNlXG4gICAgICB0aGlzLl9wMSA9IHRoaXMuX3AxTm9BY2NlbnQ7XG5cbiAgICAvLyBJZiB0aGUgbGFzdCBjaG9yZCB3YXMgcGxheWVkIGF0IGxlYXN0IDMgYmVhdHMgYmVmb3JlIHRoZSBjdXJyZW50IG9uZSxcbiAgICAvLyBpbmNyZWFzZSBwcm9iYWJpbGl0eSB0byBwbGF5XG4gICAgaWYgKHRoaXMuX2xhc3RCZWF0UGxheWVkICYmIHRoaXMuX2xhc3RCZWF0UGxheWVkIDwgY3VycmVudEJlYXQgLSAyKVxuICAgICAgdGhpcy5fcDIgKj0gdGhpcy5fcDJNdWx0aXBseWluZ0ZhY3RvcjtcblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgcHJvYmFiaWxpdHkgdG8gcGxheSBhIGNob3JkIG9uIHRoaXMgYmVhdFxuICAgIGNvbnN0IHAgPSBNYXRoLm1heCh0aGlzLl9wMSwgTWF0aC5taW4odGhpcy5fcDEgKiB0aGlzLl9wMiwgMSkpO1xuXG4gICAgLy8gRGVjaWRlIHdoYXQgdG8gcGxheVxuICAgIGlmIChlTWF4ID4gMC45ICYmIHJhbmQgPCBwKSB7XG4gICAgICB0aGlzLnRyaWdnZXIodGltZSwgJ2Nob3JkJyk7XG4gICAgICB0aGlzLl9sYXN0QmVhdFBsYXllZCA9IGN1cnJlbnRCZWF0O1xuICAgICAgdGhpcy5fcDIgPSB0aGlzLl9wMkJhc2VWYWx1ZTtcbiAgICB9IGVsc2UgaWYgKGVNYXggPiAwLjUpXG4gICAgICB0aGlzLnRyaWdnZXIodGltZSwgJ211dGUnKTtcblxuICAgIGlmIChzcGVlZCA8IDApXG4gICAgICByZXR1cm4gcG9zaXRpb24gLSB0aGlzLnBlcmlvZDtcblxuICAgIHJldHVybiBwb3NpdGlvbiArIHRoaXMucGVyaW9kO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICB0cmlnZ2VyKHRpbWUsIHR5cGUpIHtcbiAgICBjb25zdCBjdXJyZW50QmVhdCA9IE1hdGguZmxvb3IoKHRpbWUgLSB0aGlzLnN0YXJ0VGltZSAtIHRoaXMub2Zmc2V0KSAvIHRoaXMucGVyaW9kKTtcbiAgICBsZXQgY3VycmVudENob3JkO1xuICAgIGxldCBpbmRleDtcblxuICAgIGlmIChjdXJyZW50QmVhdCA+PSAwICYmIGN1cnJlbnRCZWF0IDwgMjAwKVxuICAgICAgY3VycmVudENob3JkID0gdGhpcy5fY2hvcmRQcm9ncmVzc2lvbltjdXJyZW50QmVhdF07XG5cbiAgICBpZiAodHlwZSA9PT0gJ2Nob3JkJyAmJiBjdXJyZW50Q2hvcmQpXG4gICAgICBpbmRleCA9IGdldFJhbmRvbVZhbHVlKHRoaXMuX3NlZ21lbnRJbmRpY2VzW2N1cnJlbnRDaG9yZF0pO1xuICAgIGVsc2UgaWYgKHR5cGUgPT09ICdtdXRlJyB8fCBjdXJyZW50QmVhdCA8IDApXG4gICAgICBpbmRleCA9IGdldFJhbmRvbVZhbHVlKHRoaXMuX3NlZ21lbnRJbmRpY2VzWydtdXRlJ10pO1xuXG4gICAgLy8gU3RvcCBwbGF5aW5nIGFmdGVyIHRoZSBlbmQgb2YgdGhlIGJhY2t0cmFja1xuICAgIGlmIChjdXJyZW50QmVhdCA8IDIwMCkge1xuICAgICAgdGhpcy5fc2VnbWVudEVuZ2luZS5zZWdtZW50SW5kZXggPSBpbmRleDtcbiAgICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUudHJpZ2dlcih0aW1lKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIG9uRW5lcmd5KHZhbCkge1xuICAgIGlmICh0aGlzLl9lbmVyZ3lCdWZmZXIubGVuZ3RoID09PSB0aGlzLl9lbmVyZ3lCdWZmZXJNYXhMZW5ndGgpXG4gICAgICB0aGlzLl9lbmVyZ3lCdWZmZXIucG9wKCk7XG5cbiAgICB0aGlzLl9lbmVyZ3lCdWZmZXIudW5zaGlmdCh2YWwpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBzdGFydCgpIHtcbiAgICB0aGlzLnN0YXJ0VGltZSA9IGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcbiAgICB0aGlzLmNoYW5nZU1vZGUodGhpcy5fbW9kZSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHN0b3AoKSB7XG4gICAgLy8gVE9ETzogcmVtb3ZlIGlmIGVtcHR5XG4gICAgdGhpcy5fcDEgPSBudWxsO1xuICAgIHRoaXMuX3AyID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29ubmVjdChub2RlKSB7XG4gICAgdGhpcy5vdXRwdXROb2RlLmNvbm5lY3Qobm9kZSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGNoYW5nZU1vZGUobW9kZSkge1xuICAgIHRoaXMuX21vZGUgPSBtb2RlO1xuXG4gICAgc3dpdGNoKG1vZGUpIHtcbiAgICAgIGNhc2UgMDogLy8gU3RpY2sgdG8gdGhlIG9yaWdpbmFsIHNvbmdcbiAgICAgICAgdGhpcy5fcDFBY2NlbnQgPSAxO1xuICAgICAgICB0aGlzLl9wMU5vQWNjZW50ID0gMDtcbiAgICAgICAgdGhpcy5fcDJCYXNlVmFsdWUgPSAwO1xuICAgICAgICB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yID0gMDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDE6IC8vIEEgbGl0dGxlIGd1aWRhbmNlXG4gICAgICAgIHRoaXMuX3AxQWNjZW50ID0gMTtcbiAgICAgICAgdGhpcy5fcDFOb0FjY2VudCA9IDAuMztcbiAgICAgICAgdGhpcy5fcDJCYXNlVmFsdWUgPSAwLjQ7XG4gICAgICAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSAxLjE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOiAvLyBDb21wbGV0ZSBmcmVlZG9tXG4gICAgICAgIHRoaXMuX3AxQWNjZW50ID0gMTtcbiAgICAgICAgdGhpcy5fcDFOb0FjY2VudCA9IDAuNTtcbiAgICAgICAgdGhpcy5fcDJCYXNlVmFsdWUgPSAwLjU7XG4gICAgICAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSAxLjI7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEd1aXRhckVuZ2luZTtcbiJdfQ==