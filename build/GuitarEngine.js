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

  function GuitarEngine(options) {
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

    /**
     *
     */
  }, {
    key: 'advancePosition',
    value: function advancePosition(time, position, speed) {
      var currentBeat = Math.floor((time - this.startTime - this.offset) / this.period);
      var rand = Math.random();
      var eMax = Math.pow(getMaxOfArray(this._energyBuffer), 2); // TODO: update input module
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
        // WORK IN PROGRESS: Replacing play modes by different songs
        // case 0: // Stick to the original song
        //   this._p1Accent = 1;
        //   this._p1NoAccent = 0;
        //   this._p2BaseValue = 0;
        //   this._p2MultiplyingFactor = 0;
        //   break;
        // case 1: // A little guidance
        //   this._p1Accent = 1;
        //   this._p1NoAccent = 0.3;
        //   this._p2BaseValue = 0.4;
        //   this._p2MultiplyingFactor = 1.1;
        //   break;
        // case 2: // Complete freedom
        //   this._p1Accent = 1;
        //   this._p1NoAccent = 0.5;
        //   this._p2BaseValue = 0.5;
        //   this._p2MultiplyingFactor = 1.2;
        //   break;
        case 0:
          this._p1Accent = 1;
          this._p1NoAccent = 0.05;
          this._p2BaseValue = 0.1;
          this._p2MultiplyingFactor = 1.1;
          break;
      }
    }
  }]);

  return GuitarEngine;
})(TimeEngine);

module.exports = GuitarEngine;
//# sourceMappingURL=data:application/json;base64,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QyxDQUFDO0tBQy9COzs7Ozs7O1dBS1Msb0JBQUMsSUFBSSxFQUFFO0FBQ2YsVUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7O0FBRWxCLGNBQU8sSUFBSTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQlQsYUFBSyxDQUFDO0FBQ0osY0FBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDbkIsY0FBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7QUFDeEIsY0FBSSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUM7QUFDeEIsY0FBSSxDQUFDLG9CQUFvQixHQUFHLEdBQUcsQ0FBQztBQUNoQyxnQkFBTTtBQUFBLE9BQ1Q7S0FDRjs7O1NBak1HLFlBQVk7R0FBUyxVQUFVOztBQW9NckMsTUFBTSxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUMiLCJmaWxlIjoic3JjL3Njc3MvbWFpbi5zY3NzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZSBHdWl0YXIgZW5naW5lLlxuICogQGF1dGhvciBTw6liYXN0aWVuIFJvYmFzemtpZXdpY3ogW3NlYmFzdGllbkByb2Jhc3praWV3aWN6LmNvbV1cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIExpYnJhcmllc1xuY29uc3QgYXVkaW9Db250ZXh0ID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKS5hdWRpb0NvbnRleHQ7XG5jb25zdCBTZWdtZW50RW5naW5lID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKS5TZWdtZW50RW5naW5lO1xuY29uc3QgVGltZUVuZ2luZSA9IHJlcXVpcmUoJ3dhdmVzLWF1ZGlvJykuVGltZUVuZ2luZTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uc1xuZnVuY3Rpb24gZ2V0TWF4T2ZBcnJheShhcnJheSkge1xuICBpZiAoYXJyYXkubGVuZ3RoID4gMClcbiAgICByZXR1cm4gTWF0aC5tYXguYXBwbHkobnVsbCwgYXJyYXkpO1xuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0UmFuZG9tSW50KG1pbiwgbWF4KSB7XG4gIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSkgKyBtaW47XG59XG5cbmZ1bmN0aW9uIGdldFJhbmRvbVZhbHVlKGFycmF5KSB7XG4gIHJldHVybiBhcnJheVtnZXRSYW5kb21JbnQoMCwgYXJyYXkubGVuZ3RoIC0gMSldO1xufVxuXG5mdW5jdGlvbiBjaG9yZENvbnZlcnRlcihjaG9yZCwgdmFyaWF0aW9uKSB7XG4gIGlmIChjaG9yZCA9PT0gMClcbiAgICByZXR1cm4gJ211dGUnO1xuXG4gIHJldHVybiBjaG9yZHNbKGNob3JkIC0gMSkgKiAyICsgdmFyaWF0aW9uIC0gMV07XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQ2hvcmRQcm9ncmVzc2lvbigpIHtcbiAgbGV0IGNob3JkUHJvZ3Jlc3Npb24gPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IDIwMDsgaSsrKSB7IC8vICg0KzIpIGJhcnMgKiA4IGJlYXRzICogNCBlaWd0aC1ub3RlcyA9IDE5MlxuICAgIGxldCBjaG9yZDtcbiAgICBpZiAoaSAlIDEyOCA8IDMyKVxuICAgICAgY2hvcmQgPSAnQSNtJztcbiAgICBlbHNlIGlmIChpICUgMTI4IDwgNjQpXG4gICAgICBjaG9yZCA9ICdHIyc7XG4gICAgZWxzZSBpZiAoaSAlIDEyOCA8IDk2KVxuICAgICAgY2hvcmQgPSAnRCNtJztcbiAgICBlbHNlXG4gICAgICBjaG9yZCA9ICdGIyc7XG5cbiAgICBsZXQgdmFyaWF0aW9uO1xuICAgIGlmIChpICUgMTYgPCAzKVxuICAgICAgdmFyaWF0aW9uID0gJy1oaWdoJztcbiAgICBlbHNlXG4gICAgICB2YXJpYXRpb24gPSAnLWxvdyc7XG5cbiAgICBjaG9yZFByb2dyZXNzaW9uW2ldID0gY2hvcmQgKyB2YXJpYXRpb247XG4gIH1cblxuICByZXR1cm4gY2hvcmRQcm9ncmVzc2lvbjtcbn1cblxuZnVuY3Rpb24gc29ydE1hcmtlckluZGljZXMobWFya2Vycykge1xuICBsZXQgc29ydGVkSW5kaWNlcyA9IHt9O1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbWFya2Vycy5wb3NpdGlvbi5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNob3JkTmFtZSA9IGNob3JkQ29udmVydGVyKG1hcmtlcnMuY2hvcmRbaV0sXG4gICAgICBtYXJrZXJzLnZhcmlhdGlvbltpXSk7XG5cbiAgICBpZiAoIXNvcnRlZEluZGljZXNbY2hvcmROYW1lXSlcbiAgICAgIHNvcnRlZEluZGljZXNbY2hvcmROYW1lXSA9IFtdO1xuXG4gICAgaWYgKG1hcmtlcnMuc3RyZW5ndGhbaV0gPCAyKVxuICAgICAgc29ydGVkSW5kaWNlc1tjaG9yZE5hbWVdLnB1c2goaSk7XG4gIH1cblxuICByZXR1cm4gc29ydGVkSW5kaWNlcztcbn1cblxuLy8gSGVscGVyIGNvbnN0YW50c1xuY29uc3QgY2hvcmRzID0gW1xuICAnQSNtLWhpZ2gnLFxuICAnQSNtLWxvdycsXG4gICdHIy1oaWdoJyxcbiAgJ0cjLWxvdycsXG4gICdEI20taGlnaCcsXG4gICdEI20tbG93JyxcbiAgJ0YjLWhpZ2gnLFxuICAnRiMtbG93J1xuXTtcbmNvbnN0IGFjY2VudHMgPSBbMCwgMywgNiwgMTAsIDEyLCAxMywgMTQsIDE1XTtcblxuY2xhc3MgR3VpdGFyRW5naW5lIGV4dGVuZHMgVGltZUVuZ2luZSB7XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG5cbiAgICAvLyBQdWJsaWMgYXR0cmlidXRlc1xuICAgIHRoaXMub2Zmc2V0ID0gb3B0aW9ucy5vZmZzZXQgfHwgMDtcbiAgICB0aGlzLm91dHB1dE5vZGUgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgIHRoaXMucGVyaW9kID0gb3B0aW9ucy5wZXJpb2Q7XG4gICAgdGhpcy5zdGFydFRpbWUgPSBudWxsO1xuXG4gICAgLy8gUHJpdmF0ZSBhdHRyaWJ1dGVzXG4gICAgdGhpcy5fY2hvcmRQcm9ncmVzc2lvbiA9IGdlbmVyYXRlQ2hvcmRQcm9ncmVzc2lvbigpO1xuICAgIHRoaXMuX2VuZXJneUJ1ZmZlciA9IFtdO1xuICAgIHRoaXMuX2VuZXJneUJ1ZmZlck1heExlbmd0aCA9IDI7IC8vIFRPRE86IGF1dG9tYXRlXG4gICAgdGhpcy5fbGFzdEJlYXRQbGF5ZWQgPSBudWxsO1xuICAgIHRoaXMuX21vZGUgPSBvcHRpb25zLm1vZGU7XG4gICAgdGhpcy5fbnVtQmVhdHMgPSBvcHRpb25zLm51bUJlYXRzO1xuICAgIHRoaXMuX3AxID0gbnVsbDtcbiAgICB0aGlzLl9wMUFjY2VudCA9IG51bGw7XG4gICAgdGhpcy5fcDFOb0FjY2VudCA9IG51bGw7XG4gICAgdGhpcy5fcDIgPSBudWxsO1xuICAgIHRoaXMuX3AyQmFzZVZhbHVlID0gbnVsbDtcbiAgICB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yID0gbnVsbDtcbiAgICB0aGlzLl9zZWdtZW50RW5naW5lID0gbmV3IFNlZ21lbnRFbmdpbmUoKTtcbiAgICB0aGlzLl9zZWdtZW50SW5kaWNlcyA9IHNvcnRNYXJrZXJJbmRpY2VzKG9wdGlvbnMuc2VnbWVudE1hcmtlcnMpO1xuICAgIHRoaXMuX3NlZ21lbnRNYXJrZXJzID0gb3B0aW9ucy5zZWdtZW50TWFya2VycztcbiAgICB0aGlzLl9zY3JhdGNoQnVmZmVyID0gW107XG4gICAgdGhpcy5fc2NyYXRjaEJ1ZmZlck1heExlbmd0aCA9IDU7IC8vIFRPRE86IGF1dG9tYXRlXG5cbiAgICAvLyBTZWdtZW50IGVuZ2luZSBjb25maWd1cmF0aW9uXG4gICAgdGhpcy5fc2VnbWVudEVuZ2luZS5idWZmZXIgPSBvcHRpb25zLmF1ZGlvQnVmZmVyO1xuICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUucG9zaXRpb25BcnJheSA9IHRoaXMuX3NlZ21lbnRNYXJrZXJzLnBvc2l0aW9uO1xuICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUuZHVyYXRpb25BcnJheSA9IHRoaXMuX3NlZ21lbnRNYXJrZXJzLmR1cmF0aW9uO1xuICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUuY29ubmVjdCh0aGlzLm91dHB1dE5vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBzeW5jUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSB7XG4gICAgbGV0IG5leHRQb3NpdGlvbiA9IE1hdGguZmxvb3IocG9zaXRpb24gLyB0aGlzLnBlcmlvZCkgKiB0aGlzLnBlcmlvZDtcblxuICAgIGlmIChzcGVlZCA+IDAgJiYgbmV4dFBvc2l0aW9uIDwgcG9zaXRpb24pXG4gICAgICBuZXh0UG9zaXRpb24gKz0gdGhpcy5wZXJpb2Q7XG4gICAgZWxzZSBpZiAoc3BlZWQgPCAwICYmIG5leHRQb3NpdGlvbiA+IHBvc2l0aW9uKVxuICAgICAgbmV4dFBvc2l0aW9uIC09IHRoaXMucGVyaW9kO1xuXG4gICAgcmV0dXJuIG5leHRQb3NpdGlvbjtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYWR2YW5jZVBvc2l0aW9uKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIGNvbnN0IGN1cnJlbnRCZWF0ID0gTWF0aC5mbG9vcihcbiAgICAgICh0aW1lIC0gdGhpcy5zdGFydFRpbWUgLSB0aGlzLm9mZnNldCkgLyB0aGlzLnBlcmlvZFxuICAgICk7XG4gICAgY29uc3QgcmFuZCA9IE1hdGgucmFuZG9tKCk7XG4gICAgY29uc3QgZU1heCA9IE1hdGgucG93KGdldE1heE9mQXJyYXkodGhpcy5fZW5lcmd5QnVmZmVyKSwgMik7IC8vIFRPRE86IHVwZGF0ZSBpbnB1dCBtb2R1bGVcbiAgICBjb25zdCBzTWF4ID0gZ2V0TWF4T2ZBcnJheSh0aGlzLl9zY3JhdGNoQnVmZmVyKTtcbiAgICBjb25zdCBsZXZlbCA9IE1hdGgubWF4KGVNYXgsIHNNYXgpO1xuXG4gICAgLy8gSWYgdGhlIGJlYXQgaXMgb24gdGhlIG9yaWdpbmFsIHNvbmcncyBhY2NlbnRzLCBoaWdoIHByb2JhYmlsaXR5IHRvIHBsYXlcbiAgICBpZiAoYWNjZW50cy5pbmRleE9mKGN1cnJlbnRCZWF0ICUgMTYpID4gLTEpXG4gICAgICB0aGlzLl9wMSA9IHRoaXMuX3AxQWNjZW50O1xuICAgIGVsc2VcbiAgICAgIHRoaXMuX3AxID0gdGhpcy5fcDFOb0FjY2VudDtcblxuICAgIC8vIElmIHRoZSBsYXN0IGNob3JkIHdhcyBwbGF5ZWQgYXQgbGVhc3QgMyBiZWF0cyBiZWZvcmUgdGhlIGN1cnJlbnQgb25lLFxuICAgIC8vIGluY3JlYXNlIHByb2JhYmlsaXR5IHRvIHBsYXlcbiAgICBpZiAodGhpcy5fbGFzdEJlYXRQbGF5ZWQgJiYgdGhpcy5fbGFzdEJlYXRQbGF5ZWQgPCBjdXJyZW50QmVhdCAtIDIpXG4gICAgICB0aGlzLl9wMiAqPSB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yO1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBwcm9iYWJpbGl0eSB0byBwbGF5IGEgY2hvcmQgb24gdGhpcyBiZWF0XG4gICAgY29uc3QgcCA9IE1hdGgubWF4KHRoaXMuX3AxLCBNYXRoLm1pbih0aGlzLl9wMSAqIHRoaXMuX3AyLCAxKSk7XG5cbiAgICAvLyBEZWNpZGUgd2hhdCB0byBwbGF5XG4gICAgaWYgKGxldmVsID4gMC45ICYmIHJhbmQgPCBwKSB7XG4gICAgICB0aGlzLnRyaWdnZXIodGltZSwgJ2Nob3JkJyk7XG4gICAgICB0aGlzLl9sYXN0QmVhdFBsYXllZCA9IGN1cnJlbnRCZWF0O1xuICAgICAgdGhpcy5fcDIgPSB0aGlzLl9wMkJhc2VWYWx1ZTtcbiAgICB9IGVsc2UgaWYgKGxldmVsID4gMC41KVxuICAgICAgdGhpcy50cmlnZ2VyKHRpbWUsICdtdXRlJyk7XG5cbiAgICBpZiAoc3BlZWQgPCAwKVxuICAgICAgcmV0dXJuIHBvc2l0aW9uIC0gdGhpcy5wZXJpb2Q7XG5cbiAgICByZXR1cm4gcG9zaXRpb24gKyB0aGlzLnBlcmlvZDtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgdHJpZ2dlcih0aW1lLCB0eXBlKSB7XG4gICAgY29uc3QgY3VycmVudEJlYXQgPSBNYXRoLmZsb29yKCh0aW1lIC0gdGhpcy5zdGFydFRpbWUgLSB0aGlzLm9mZnNldCkgLyB0aGlzLnBlcmlvZCk7XG4gICAgbGV0IGN1cnJlbnRDaG9yZDtcbiAgICBsZXQgaW5kZXg7XG5cbiAgICBpZiAoY3VycmVudEJlYXQgPj0gMCAmJiBjdXJyZW50QmVhdCA8IHRoaXMuX251bUJlYXRzKVxuICAgICAgY3VycmVudENob3JkID0gdGhpcy5fY2hvcmRQcm9ncmVzc2lvbltjdXJyZW50QmVhdF07XG5cbiAgICBpZiAodHlwZSA9PT0gJ2Nob3JkJyAmJiBjdXJyZW50Q2hvcmQpXG4gICAgICBpbmRleCA9IGdldFJhbmRvbVZhbHVlKHRoaXMuX3NlZ21lbnRJbmRpY2VzW2N1cnJlbnRDaG9yZF0pO1xuICAgIGVsc2UgaWYgKHR5cGUgPT09ICdtdXRlJyB8fCBjdXJyZW50QmVhdCA8IDApXG4gICAgICBpbmRleCA9IGdldFJhbmRvbVZhbHVlKHRoaXMuX3NlZ21lbnRJbmRpY2VzWydtdXRlJ10pO1xuXG4gICAgLy8gU3RvcCBwbGF5aW5nIGFmdGVyIHRoZSBlbmQgb2YgdGhlIGJhY2t0cmFja1xuICAgIGlmIChjdXJyZW50QmVhdCA8IHRoaXMuX251bUJlYXRzKSB7XG4gICAgICB0aGlzLl9zZWdtZW50RW5naW5lLnNlZ21lbnRJbmRleCA9IGluZGV4O1xuICAgICAgdGhpcy5fc2VnbWVudEVuZ2luZS50cmlnZ2VyKHRpbWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgb25FbmVyZ3kodmFsKSB7XG4gICAgaWYgKHRoaXMuX2VuZXJneUJ1ZmZlci5sZW5ndGggPT09IHRoaXMuX2VuZXJneUJ1ZmZlck1heExlbmd0aClcbiAgICAgIHRoaXMuX2VuZXJneUJ1ZmZlci5wb3AoKTtcblxuICAgIHRoaXMuX2VuZXJneUJ1ZmZlci51bnNoaWZ0KHZhbCk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIG9uU2NyYXRjaCh2YWwpIHtcbiAgICBpZiAodGhpcy5fc2NyYXRjaEJ1ZmZlci5sZW5ndGggPT09IHRoaXMuX3NjcmF0Y2hCdWZmZXJNYXhMZW5ndGgpXG4gICAgICB0aGlzLl9zY3JhdGNoQnVmZmVyLnBvcCgpO1xuXG4gICAgdGhpcy5fc2NyYXRjaEJ1ZmZlci51bnNoaWZ0KHZhbCk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHN0YXJ0KCkge1xuICAgIHRoaXMuc3RhcnRUaW1lID0gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgIHRoaXMuY2hhbmdlTW9kZSh0aGlzLl9tb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgc3RvcCgpIHtcbiAgICAvLyBUT0RPOiByZW1vdmUgaWYgZW1wdHlcbiAgICB0aGlzLl9wMSA9IG51bGw7XG4gICAgdGhpcy5fcDIgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25uZWN0KG5vZGUpIHtcbiAgICB0aGlzLm91dHB1dE5vZGUuY29ubmVjdChub2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY2hhbmdlTW9kZShtb2RlKSB7XG4gICAgdGhpcy5fbW9kZSA9IG1vZGU7XG5cbiAgICBzd2l0Y2gobW9kZSkge1xuICAgICAgLy8gV09SSyBJTiBQUk9HUkVTUzogUmVwbGFjaW5nIHBsYXkgbW9kZXMgYnkgZGlmZmVyZW50IHNvbmdzXG4gICAgICAvLyBjYXNlIDA6IC8vIFN0aWNrIHRvIHRoZSBvcmlnaW5hbCBzb25nXG4gICAgICAvLyAgIHRoaXMuX3AxQWNjZW50ID0gMTtcbiAgICAgIC8vICAgdGhpcy5fcDFOb0FjY2VudCA9IDA7XG4gICAgICAvLyAgIHRoaXMuX3AyQmFzZVZhbHVlID0gMDtcbiAgICAgIC8vICAgdGhpcy5fcDJNdWx0aXBseWluZ0ZhY3RvciA9IDA7XG4gICAgICAvLyAgIGJyZWFrO1xuICAgICAgLy8gY2FzZSAxOiAvLyBBIGxpdHRsZSBndWlkYW5jZVxuICAgICAgLy8gICB0aGlzLl9wMUFjY2VudCA9IDE7XG4gICAgICAvLyAgIHRoaXMuX3AxTm9BY2NlbnQgPSAwLjM7XG4gICAgICAvLyAgIHRoaXMuX3AyQmFzZVZhbHVlID0gMC40O1xuICAgICAgLy8gICB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yID0gMS4xO1xuICAgICAgLy8gICBicmVhaztcbiAgICAgIC8vIGNhc2UgMjogLy8gQ29tcGxldGUgZnJlZWRvbVxuICAgICAgLy8gICB0aGlzLl9wMUFjY2VudCA9IDE7XG4gICAgICAvLyAgIHRoaXMuX3AxTm9BY2NlbnQgPSAwLjU7XG4gICAgICAvLyAgIHRoaXMuX3AyQmFzZVZhbHVlID0gMC41O1xuICAgICAgLy8gICB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yID0gMS4yO1xuICAgICAgLy8gICBicmVhaztcbiAgICAgIGNhc2UgMDpcbiAgICAgICAgdGhpcy5fcDFBY2NlbnQgPSAxO1xuICAgICAgICB0aGlzLl9wMU5vQWNjZW50ID0gMC4wNTtcbiAgICAgICAgdGhpcy5fcDJCYXNlVmFsdWUgPSAwLjE7XG4gICAgICAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSAxLjE7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEd1aXRhckVuZ2luZTtcbiJdfQ==