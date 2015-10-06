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
//# sourceMappingURL=data:application/json;base64,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LENBQUMsQ0FBQztLQUMvQjs7Ozs7OztXQUtTLG9CQUFDLElBQUksRUFBRTtBQUNmLFVBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDOztBQUVsQixjQUFPLElBQUk7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JULGFBQUssQ0FBQztBQUNKLGNBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ25CLGNBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLGNBQUksQ0FBQyxZQUFZLEdBQUcsR0FBRyxDQUFDO0FBQ3hCLGNBQUksQ0FBQyxvQkFBb0IsR0FBRyxHQUFHLENBQUM7QUFDaEMsZ0JBQU07QUFBQSxPQUNUO0tBQ0Y7OztTQWpNRyxZQUFZO0dBQVMsVUFBVTs7QUFvTXJDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDIiwiZmlsZSI6InNyYy9qcy9HdWl0YXJFbmdpbmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlIEd1aXRhciBlbmdpbmUuXG4gKiBAYXV0aG9yIFPDqWJhc3RpZW4gUm9iYXN6a2lld2ljeiBbc2ViYXN0aWVuQHJvYmFzemtpZXdpY3ouY29tXVxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gTGlicmFyaWVzXG5jb25zdCBhdWRpb0NvbnRleHQgPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpLmF1ZGlvQ29udGV4dDtcbmNvbnN0IFNlZ21lbnRFbmdpbmUgPSByZXF1aXJlKCd3YXZlcy1hdWRpbycpLlNlZ21lbnRFbmdpbmU7XG5jb25zdCBUaW1lRW5naW5lID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKS5UaW1lRW5naW5lO1xuXG4vLyBIZWxwZXIgZnVuY3Rpb25zXG5mdW5jdGlvbiBnZXRNYXhPZkFycmF5KGFycmF5KSB7XG4gIGlmIChhcnJheS5sZW5ndGggPiAwKVxuICAgIHJldHVybiBNYXRoLm1heC5hcHBseShudWxsLCBhcnJheSk7XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRSYW5kb21JbnQobWluLCBtYXgpIHtcbiAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pKSArIG1pbjtcbn1cblxuZnVuY3Rpb24gZ2V0UmFuZG9tVmFsdWUoYXJyYXkpIHtcbiAgcmV0dXJuIGFycmF5W2dldFJhbmRvbUludCgwLCBhcnJheS5sZW5ndGggLSAxKV07XG59XG5cbmZ1bmN0aW9uIGNob3JkQ29udmVydGVyKGNob3JkLCB2YXJpYXRpb24pIHtcbiAgaWYgKGNob3JkID09PSAwKVxuICAgIHJldHVybiAnbXV0ZSc7XG5cbiAgcmV0dXJuIGNob3Jkc1soY2hvcmQgLSAxKSAqIDIgKyB2YXJpYXRpb24gLSAxXTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVDaG9yZFByb2dyZXNzaW9uKCkge1xuICBsZXQgY2hvcmRQcm9ncmVzc2lvbiA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgMjAwOyBpKyspIHsgLy8gKDQrMikgYmFycyAqIDggYmVhdHMgKiA0IGVpZ3RoLW5vdGVzID0gMTkyXG4gICAgbGV0IGNob3JkO1xuICAgIGlmIChpICUgMTI4IDwgMzIpXG4gICAgICBjaG9yZCA9ICdBI20nO1xuICAgIGVsc2UgaWYgKGkgJSAxMjggPCA2NClcbiAgICAgIGNob3JkID0gJ0cjJztcbiAgICBlbHNlIGlmIChpICUgMTI4IDwgOTYpXG4gICAgICBjaG9yZCA9ICdEI20nO1xuICAgIGVsc2VcbiAgICAgIGNob3JkID0gJ0YjJztcblxuICAgIGxldCB2YXJpYXRpb247XG4gICAgaWYgKGkgJSAxNiA8IDMpXG4gICAgICB2YXJpYXRpb24gPSAnLWhpZ2gnO1xuICAgIGVsc2VcbiAgICAgIHZhcmlhdGlvbiA9ICctbG93JztcblxuICAgIGNob3JkUHJvZ3Jlc3Npb25baV0gPSBjaG9yZCArIHZhcmlhdGlvbjtcbiAgfVxuXG4gIHJldHVybiBjaG9yZFByb2dyZXNzaW9uO1xufVxuXG5mdW5jdGlvbiBzb3J0TWFya2VySW5kaWNlcyhtYXJrZXJzKSB7XG4gIGxldCBzb3J0ZWRJbmRpY2VzID0ge307XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXJrZXJzLnBvc2l0aW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hvcmROYW1lID0gY2hvcmRDb252ZXJ0ZXIobWFya2Vycy5jaG9yZFtpXSxcbiAgICAgIG1hcmtlcnMudmFyaWF0aW9uW2ldKTtcblxuICAgIGlmICghc29ydGVkSW5kaWNlc1tjaG9yZE5hbWVdKVxuICAgICAgc29ydGVkSW5kaWNlc1tjaG9yZE5hbWVdID0gW107XG5cbiAgICBpZiAobWFya2Vycy5zdHJlbmd0aFtpXSA8IDIpXG4gICAgICBzb3J0ZWRJbmRpY2VzW2Nob3JkTmFtZV0ucHVzaChpKTtcbiAgfVxuXG4gIHJldHVybiBzb3J0ZWRJbmRpY2VzO1xufVxuXG4vLyBIZWxwZXIgY29uc3RhbnRzXG5jb25zdCBjaG9yZHMgPSBbXG4gICdBI20taGlnaCcsXG4gICdBI20tbG93JyxcbiAgJ0cjLWhpZ2gnLFxuICAnRyMtbG93JyxcbiAgJ0QjbS1oaWdoJyxcbiAgJ0QjbS1sb3cnLFxuICAnRiMtaGlnaCcsXG4gICdGIy1sb3cnXG5dO1xuY29uc3QgYWNjZW50cyA9IFswLCAzLCA2LCAxMCwgMTIsIDEzLCAxNCwgMTVdO1xuXG5jbGFzcyBHdWl0YXJFbmdpbmUgZXh0ZW5kcyBUaW1lRW5naW5lIHtcbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIC8vIFB1YmxpYyBhdHRyaWJ1dGVzXG4gICAgdGhpcy5vZmZzZXQgPSBvcHRpb25zLm9mZnNldCB8fCAwO1xuICAgIHRoaXMub3V0cHV0Tm9kZSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgdGhpcy5wZXJpb2QgPSBvcHRpb25zLnBlcmlvZDtcbiAgICB0aGlzLnN0YXJ0VGltZSA9IG51bGw7XG5cbiAgICAvLyBQcml2YXRlIGF0dHJpYnV0ZXNcbiAgICB0aGlzLl9jaG9yZFByb2dyZXNzaW9uID0gZ2VuZXJhdGVDaG9yZFByb2dyZXNzaW9uKCk7XG4gICAgdGhpcy5fZW5lcmd5QnVmZmVyID0gW107XG4gICAgdGhpcy5fZW5lcmd5QnVmZmVyTWF4TGVuZ3RoID0gMjsgLy8gVE9ETzogYXV0b21hdGVcbiAgICB0aGlzLl9sYXN0QmVhdFBsYXllZCA9IG51bGw7XG4gICAgdGhpcy5fbW9kZSA9IG9wdGlvbnMubW9kZTtcbiAgICB0aGlzLl9udW1CZWF0cyA9IG9wdGlvbnMubnVtQmVhdHM7XG4gICAgdGhpcy5fcDEgPSBudWxsO1xuICAgIHRoaXMuX3AxQWNjZW50ID0gbnVsbDtcbiAgICB0aGlzLl9wMU5vQWNjZW50ID0gbnVsbDtcbiAgICB0aGlzLl9wMiA9IG51bGw7XG4gICAgdGhpcy5fcDJCYXNlVmFsdWUgPSBudWxsO1xuICAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSBudWxsO1xuICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUgPSBuZXcgU2VnbWVudEVuZ2luZSgpO1xuICAgIHRoaXMuX3NlZ21lbnRJbmRpY2VzID0gc29ydE1hcmtlckluZGljZXMob3B0aW9ucy5zZWdtZW50TWFya2Vycyk7XG4gICAgdGhpcy5fc2VnbWVudE1hcmtlcnMgPSBvcHRpb25zLnNlZ21lbnRNYXJrZXJzO1xuICAgIHRoaXMuX3NjcmF0Y2hCdWZmZXIgPSBbXTtcbiAgICB0aGlzLl9zY3JhdGNoQnVmZmVyTWF4TGVuZ3RoID0gNTsgLy8gVE9ETzogYXV0b21hdGVcblxuICAgIC8vIFNlZ21lbnQgZW5naW5lIGNvbmZpZ3VyYXRpb25cbiAgICB0aGlzLl9zZWdtZW50RW5naW5lLmJ1ZmZlciA9IG9wdGlvbnMuYXVkaW9CdWZmZXI7XG4gICAgdGhpcy5fc2VnbWVudEVuZ2luZS5wb3NpdGlvbkFycmF5ID0gdGhpcy5fc2VnbWVudE1hcmtlcnMucG9zaXRpb247XG4gICAgdGhpcy5fc2VnbWVudEVuZ2luZS5kdXJhdGlvbkFycmF5ID0gdGhpcy5fc2VnbWVudE1hcmtlcnMuZHVyYXRpb247XG4gICAgdGhpcy5fc2VnbWVudEVuZ2luZS5jb25uZWN0KHRoaXMub3V0cHV0Tm9kZSk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHN5bmNQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgICBsZXQgbmV4dFBvc2l0aW9uID0gTWF0aC5mbG9vcihwb3NpdGlvbiAvIHRoaXMucGVyaW9kKSAqIHRoaXMucGVyaW9kO1xuXG4gICAgaWYgKHNwZWVkID4gMCAmJiBuZXh0UG9zaXRpb24gPCBwb3NpdGlvbilcbiAgICAgIG5leHRQb3NpdGlvbiArPSB0aGlzLnBlcmlvZDtcbiAgICBlbHNlIGlmIChzcGVlZCA8IDAgJiYgbmV4dFBvc2l0aW9uID4gcG9zaXRpb24pXG4gICAgICBuZXh0UG9zaXRpb24gLT0gdGhpcy5wZXJpb2Q7XG5cbiAgICByZXR1cm4gbmV4dFBvc2l0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBhZHZhbmNlUG9zaXRpb24odGltZSwgcG9zaXRpb24sIHNwZWVkKSB7XG4gICAgY29uc3QgY3VycmVudEJlYXQgPSBNYXRoLmZsb29yKFxuICAgICAgKHRpbWUgLSB0aGlzLnN0YXJ0VGltZSAtIHRoaXMub2Zmc2V0KSAvIHRoaXMucGVyaW9kXG4gICAgKTtcbiAgICBjb25zdCByYW5kID0gTWF0aC5yYW5kb20oKTtcbiAgICBjb25zdCBlTWF4ID0gTWF0aC5wb3coZ2V0TWF4T2ZBcnJheSh0aGlzLl9lbmVyZ3lCdWZmZXIpLCAyKTsgLy8gVE9ETzogdXBkYXRlIGlucHV0IG1vZHVsZVxuICAgIGNvbnN0IHNNYXggPSBnZXRNYXhPZkFycmF5KHRoaXMuX3NjcmF0Y2hCdWZmZXIpO1xuICAgIGNvbnN0IGxldmVsID0gTWF0aC5tYXgoZU1heCwgc01heCk7XG5cbiAgICAvLyBJZiB0aGUgYmVhdCBpcyBvbiB0aGUgb3JpZ2luYWwgc29uZydzIGFjY2VudHMsIGhpZ2ggcHJvYmFiaWxpdHkgdG8gcGxheVxuICAgIGlmIChhY2NlbnRzLmluZGV4T2YoY3VycmVudEJlYXQgJSAxNikgPiAtMSlcbiAgICAgIHRoaXMuX3AxID0gdGhpcy5fcDFBY2NlbnQ7XG4gICAgZWxzZVxuICAgICAgdGhpcy5fcDEgPSB0aGlzLl9wMU5vQWNjZW50O1xuXG4gICAgLy8gSWYgdGhlIGxhc3QgY2hvcmQgd2FzIHBsYXllZCBhdCBsZWFzdCAzIGJlYXRzIGJlZm9yZSB0aGUgY3VycmVudCBvbmUsXG4gICAgLy8gaW5jcmVhc2UgcHJvYmFiaWxpdHkgdG8gcGxheVxuICAgIGlmICh0aGlzLl9sYXN0QmVhdFBsYXllZCAmJiB0aGlzLl9sYXN0QmVhdFBsYXllZCA8IGN1cnJlbnRCZWF0IC0gMilcbiAgICAgIHRoaXMuX3AyICo9IHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3I7XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIHByb2JhYmlsaXR5IHRvIHBsYXkgYSBjaG9yZCBvbiB0aGlzIGJlYXRcbiAgICBjb25zdCBwID0gTWF0aC5tYXgodGhpcy5fcDEsIE1hdGgubWluKHRoaXMuX3AxICogdGhpcy5fcDIsIDEpKTtcblxuICAgIC8vIERlY2lkZSB3aGF0IHRvIHBsYXlcbiAgICBpZiAobGV2ZWwgPiAwLjkgJiYgcmFuZCA8IHApIHtcbiAgICAgIHRoaXMudHJpZ2dlcih0aW1lLCAnY2hvcmQnKTtcbiAgICAgIHRoaXMuX2xhc3RCZWF0UGxheWVkID0gY3VycmVudEJlYXQ7XG4gICAgICB0aGlzLl9wMiA9IHRoaXMuX3AyQmFzZVZhbHVlO1xuICAgIH0gZWxzZSBpZiAobGV2ZWwgPiAwLjUpXG4gICAgICB0aGlzLnRyaWdnZXIodGltZSwgJ211dGUnKTtcblxuICAgIGlmIChzcGVlZCA8IDApXG4gICAgICByZXR1cm4gcG9zaXRpb24gLSB0aGlzLnBlcmlvZDtcblxuICAgIHJldHVybiBwb3NpdGlvbiArIHRoaXMucGVyaW9kO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICB0cmlnZ2VyKHRpbWUsIHR5cGUpIHtcbiAgICBjb25zdCBjdXJyZW50QmVhdCA9IE1hdGguZmxvb3IoKHRpbWUgLSB0aGlzLnN0YXJ0VGltZSAtIHRoaXMub2Zmc2V0KSAvIHRoaXMucGVyaW9kKTtcbiAgICBsZXQgY3VycmVudENob3JkO1xuICAgIGxldCBpbmRleDtcblxuICAgIGlmIChjdXJyZW50QmVhdCA+PSAwICYmIGN1cnJlbnRCZWF0IDwgdGhpcy5fbnVtQmVhdHMpXG4gICAgICBjdXJyZW50Q2hvcmQgPSB0aGlzLl9jaG9yZFByb2dyZXNzaW9uW2N1cnJlbnRCZWF0XTtcblxuICAgIGlmICh0eXBlID09PSAnY2hvcmQnICYmIGN1cnJlbnRDaG9yZClcbiAgICAgIGluZGV4ID0gZ2V0UmFuZG9tVmFsdWUodGhpcy5fc2VnbWVudEluZGljZXNbY3VycmVudENob3JkXSk7XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gJ211dGUnIHx8IGN1cnJlbnRCZWF0IDwgMClcbiAgICAgIGluZGV4ID0gZ2V0UmFuZG9tVmFsdWUodGhpcy5fc2VnbWVudEluZGljZXNbJ211dGUnXSk7XG5cbiAgICAvLyBTdG9wIHBsYXlpbmcgYWZ0ZXIgdGhlIGVuZCBvZiB0aGUgYmFja3RyYWNrXG4gICAgaWYgKGN1cnJlbnRCZWF0IDwgdGhpcy5fbnVtQmVhdHMpIHtcbiAgICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUuc2VnbWVudEluZGV4ID0gaW5kZXg7XG4gICAgICB0aGlzLl9zZWdtZW50RW5naW5lLnRyaWdnZXIodGltZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBvbkVuZXJneSh2YWwpIHtcbiAgICBpZiAodGhpcy5fZW5lcmd5QnVmZmVyLmxlbmd0aCA9PT0gdGhpcy5fZW5lcmd5QnVmZmVyTWF4TGVuZ3RoKVxuICAgICAgdGhpcy5fZW5lcmd5QnVmZmVyLnBvcCgpO1xuXG4gICAgdGhpcy5fZW5lcmd5QnVmZmVyLnVuc2hpZnQodmFsKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgb25TY3JhdGNoKHZhbCkge1xuICAgIGlmICh0aGlzLl9zY3JhdGNoQnVmZmVyLmxlbmd0aCA9PT0gdGhpcy5fc2NyYXRjaEJ1ZmZlck1heExlbmd0aClcbiAgICAgIHRoaXMuX3NjcmF0Y2hCdWZmZXIucG9wKCk7XG5cbiAgICB0aGlzLl9zY3JhdGNoQnVmZmVyLnVuc2hpZnQodmFsKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgc3RhcnQoKSB7XG4gICAgdGhpcy5zdGFydFRpbWUgPSBhdWRpb0NvbnRleHQuY3VycmVudFRpbWU7XG4gICAgdGhpcy5jaGFuZ2VNb2RlKHRoaXMuX21vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBzdG9wKCkge1xuICAgIC8vIFRPRE86IHJlbW92ZSBpZiBlbXB0eVxuICAgIHRoaXMuX3AxID0gbnVsbDtcbiAgICB0aGlzLl9wMiA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbm5lY3Qobm9kZSkge1xuICAgIHRoaXMub3V0cHV0Tm9kZS5jb25uZWN0KG5vZGUpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjaGFuZ2VNb2RlKG1vZGUpIHtcbiAgICB0aGlzLl9tb2RlID0gbW9kZTtcblxuICAgIHN3aXRjaChtb2RlKSB7XG4gICAgICAvLyBXT1JLIElOIFBST0dSRVNTOiBSZXBsYWNpbmcgcGxheSBtb2RlcyBieSBkaWZmZXJlbnQgc29uZ3NcbiAgICAgIC8vIGNhc2UgMDogLy8gU3RpY2sgdG8gdGhlIG9yaWdpbmFsIHNvbmdcbiAgICAgIC8vICAgdGhpcy5fcDFBY2NlbnQgPSAxO1xuICAgICAgLy8gICB0aGlzLl9wMU5vQWNjZW50ID0gMDtcbiAgICAgIC8vICAgdGhpcy5fcDJCYXNlVmFsdWUgPSAwO1xuICAgICAgLy8gICB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yID0gMDtcbiAgICAgIC8vICAgYnJlYWs7XG4gICAgICAvLyBjYXNlIDE6IC8vIEEgbGl0dGxlIGd1aWRhbmNlXG4gICAgICAvLyAgIHRoaXMuX3AxQWNjZW50ID0gMTtcbiAgICAgIC8vICAgdGhpcy5fcDFOb0FjY2VudCA9IDAuMztcbiAgICAgIC8vICAgdGhpcy5fcDJCYXNlVmFsdWUgPSAwLjQ7XG4gICAgICAvLyAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSAxLjE7XG4gICAgICAvLyAgIGJyZWFrO1xuICAgICAgLy8gY2FzZSAyOiAvLyBDb21wbGV0ZSBmcmVlZG9tXG4gICAgICAvLyAgIHRoaXMuX3AxQWNjZW50ID0gMTtcbiAgICAgIC8vICAgdGhpcy5fcDFOb0FjY2VudCA9IDAuNTtcbiAgICAgIC8vICAgdGhpcy5fcDJCYXNlVmFsdWUgPSAwLjU7XG4gICAgICAvLyAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSAxLjI7XG4gICAgICAvLyAgIGJyZWFrO1xuICAgICAgY2FzZSAwOlxuICAgICAgICB0aGlzLl9wMUFjY2VudCA9IDE7XG4gICAgICAgIHRoaXMuX3AxTm9BY2NlbnQgPSAwLjA1O1xuICAgICAgICB0aGlzLl9wMkJhc2VWYWx1ZSA9IDAuMTtcbiAgICAgICAgdGhpcy5fcDJNdWx0aXBseWluZ0ZhY3RvciA9IDEuMTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gR3VpdGFyRW5naW5lO1xuIl19