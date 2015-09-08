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
//# sourceMappingURL=data:application/json;base64,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QUFDSixjQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNuQixjQUFJLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQztBQUN2QixjQUFJLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQztBQUN4QixjQUFJLENBQUMsb0JBQW9CLEdBQUcsR0FBRyxDQUFDO0FBQ2hDLGdCQUFNO0FBQUEsT0FDVDtLQUNGOzs7U0EvTEcsWUFBWTtHQUFTLFVBQVU7O0FBa01yQyxNQUFNLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyIsImZpbGUiOiJzcmMvanMvR3VpdGFyRW5naW5lLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZSBHdWl0YXIgZW5naW5lLlxuICogQGF1dGhvciBTw6liYXN0aWVuIFJvYmFzemtpZXdpY3ogW3NlYmFzdGllbkByb2Jhc3praWV3aWN6LmNvbV1cbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIExpYnJhcmllc1xuY29uc3QgYXVkaW9Db250ZXh0ID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKS5hdWRpb0NvbnRleHQ7XG5jb25zdCBTZWdtZW50RW5naW5lID0gcmVxdWlyZSgnd2F2ZXMtYXVkaW8nKS5TZWdtZW50RW5naW5lO1xuY29uc3QgVGltZUVuZ2luZSA9IHJlcXVpcmUoJ3dhdmVzLWF1ZGlvJykuVGltZUVuZ2luZTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uc1xuZnVuY3Rpb24gZ2V0TWF4T2ZBcnJheShhcnJheSkge1xuICByZXR1cm4gTWF0aC5tYXguYXBwbHkobnVsbCwgYXJyYXkpO1xufVxuXG5mdW5jdGlvbiBnZXRSYW5kb21JbnQobWluLCBtYXgpIHtcbiAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pKSArIG1pbjtcbn1cblxuZnVuY3Rpb24gZ2V0UmFuZG9tVmFsdWUoYXJyYXkpIHtcbiAgcmV0dXJuIGFycmF5W2dldFJhbmRvbUludCgwLCBhcnJheS5sZW5ndGggLSAxKV07XG59XG5cbmZ1bmN0aW9uIGNob3JkQ29udmVydGVyKGNob3JkLCB2YXJpYXRpb24pIHtcbiAgaWYgKGNob3JkID09PSAwKVxuICAgIHJldHVybiAnbXV0ZSc7XG5cbiAgcmV0dXJuIGNob3Jkc1soY2hvcmQgLSAxKSAqIDIgKyB2YXJpYXRpb24gLSAxXTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhdGVDaG9yZFByb2dyZXNzaW9uKCkge1xuICBsZXQgY2hvcmRQcm9ncmVzc2lvbiA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgMjAwOyBpKyspIHsgLy8gKDQrMikgYmFycyAqIDggYmVhdHMgKiA0IGVpZ3RoLW5vdGVzID0gMTkyXG4gICAgbGV0IGNob3JkO1xuICAgIGlmIChpICUgMTI4IDwgMzIpXG4gICAgICBjaG9yZCA9ICdBI20nO1xuICAgIGVsc2UgaWYgKGkgJSAxMjggPCA2NClcbiAgICAgIGNob3JkID0gJ0cjJztcbiAgICBlbHNlIGlmIChpICUgMTI4IDwgOTYpXG4gICAgICBjaG9yZCA9ICdEI20nO1xuICAgIGVsc2VcbiAgICAgIGNob3JkID0gJ0YjJztcblxuICAgIGxldCB2YXJpYXRpb247XG4gICAgaWYgKGkgJSAxNiA8IDMpXG4gICAgICB2YXJpYXRpb24gPSAnLWhpZ2gnO1xuICAgIGVsc2VcbiAgICAgIHZhcmlhdGlvbiA9ICctbG93JztcblxuICAgIGNob3JkUHJvZ3Jlc3Npb25baV0gPSBjaG9yZCArIHZhcmlhdGlvbjtcbiAgfVxuXG4gIHJldHVybiBjaG9yZFByb2dyZXNzaW9uO1xufVxuXG5mdW5jdGlvbiBzb3J0TWFya2VySW5kaWNlcyhtYXJrZXJzKSB7XG4gIGxldCBzb3J0ZWRJbmRpY2VzID0ge307XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXJrZXJzLnBvc2l0aW9uLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hvcmROYW1lID0gY2hvcmRDb252ZXJ0ZXIobWFya2Vycy5jaG9yZFtpXSxcbiAgICAgIG1hcmtlcnMudmFyaWF0aW9uW2ldKTtcblxuICAgIGlmICghc29ydGVkSW5kaWNlc1tjaG9yZE5hbWVdKVxuICAgICAgc29ydGVkSW5kaWNlc1tjaG9yZE5hbWVdID0gW107XG5cbiAgICBpZiAobWFya2Vycy5zdHJlbmd0aFtpXSA8IDIpXG4gICAgICBzb3J0ZWRJbmRpY2VzW2Nob3JkTmFtZV0ucHVzaChpKTtcbiAgfVxuXG4gIHJldHVybiBzb3J0ZWRJbmRpY2VzO1xufVxuXG4vLyBIZWxwZXIgY29uc3RhbnRzXG5jb25zdCBjaG9yZHMgPSBbXG4gICdBI20taGlnaCcsXG4gICdBI20tbG93JyxcbiAgJ0cjLWhpZ2gnLFxuICAnRyMtbG93JyxcbiAgJ0QjbS1oaWdoJyxcbiAgJ0QjbS1sb3cnLFxuICAnRiMtaGlnaCcsXG4gICdGIy1sb3cnXG5dO1xuY29uc3QgYWNjZW50cyA9IFswLCAzLCA2LCAxMCwgMTIsIDEzLCAxNCwgMTVdO1xuXG5jbGFzcyBHdWl0YXJFbmdpbmUgZXh0ZW5kcyBUaW1lRW5naW5lIHtcbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gUHVibGljIGF0dHJpYnV0ZXNcbiAgICB0aGlzLm9mZnNldCA9IG9wdGlvbnMub2Zmc2V0IHx8IDA7XG4gICAgdGhpcy5vdXRwdXROb2RlID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICB0aGlzLnBlcmlvZCA9IG9wdGlvbnMucGVyaW9kO1xuICAgIHRoaXMuc3RhcnRUaW1lID0gbnVsbDtcblxuICAgIC8vIFByaXZhdGUgYXR0cmlidXRlc1xuICAgIHRoaXMuX2Nob3JkUHJvZ3Jlc3Npb24gPSBnZW5lcmF0ZUNob3JkUHJvZ3Jlc3Npb24oKTtcbiAgICB0aGlzLl9lbmVyZ3lCdWZmZXIgPSBbXTtcbiAgICB0aGlzLl9lbmVyZ3lCdWZmZXJNYXhMZW5ndGggPSAyOyAvLyBUT0RPXG4gICAgdGhpcy5fbGFzdEJlYXRQbGF5ZWQgPSBudWxsO1xuICAgIHRoaXMuX21vZGUgPSBvcHRpb25zLm1vZGU7XG4gICAgdGhpcy5fcDEgPSBudWxsO1xuICAgIHRoaXMuX3AxQWNjZW50ID0gbnVsbDtcbiAgICB0aGlzLl9wMU5vQWNjZW50ID0gbnVsbDtcbiAgICB0aGlzLl9wMiA9IG51bGw7XG4gICAgdGhpcy5fcDJCYXNlVmFsdWUgPSBudWxsO1xuICAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSBudWxsO1xuICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUgPSBuZXcgU2VnbWVudEVuZ2luZSgpO1xuICAgIHRoaXMuX3NlZ21lbnRJbmRpY2VzID0gc29ydE1hcmtlckluZGljZXMob3B0aW9ucy5zZWdtZW50TWFya2Vycyk7XG4gICAgdGhpcy5fc2VnbWVudE1hcmtlcnMgPSBvcHRpb25zLnNlZ21lbnRNYXJrZXJzO1xuXG4gICAgLy8gU2VnbWVudCBlbmdpbmUgY29uZmlndXJhdGlvblxuICAgIHRoaXMuX3NlZ21lbnRFbmdpbmUuYnVmZmVyID0gb3B0aW9ucy5hdWRpb0J1ZmZlcjtcbiAgICB0aGlzLl9zZWdtZW50RW5naW5lLnBvc2l0aW9uQXJyYXkgPSB0aGlzLl9zZWdtZW50TWFya2Vycy5wb3NpdGlvbjtcbiAgICB0aGlzLl9zZWdtZW50RW5naW5lLmR1cmF0aW9uQXJyYXkgPSB0aGlzLl9zZWdtZW50TWFya2Vycy5kdXJhdGlvbjtcbiAgICB0aGlzLl9zZWdtZW50RW5naW5lLmNvbm5lY3QodGhpcy5vdXRwdXROb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgc3luY1Bvc2l0aW9uKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIGxldCBuZXh0UG9zaXRpb24gPSBNYXRoLmZsb29yKHBvc2l0aW9uIC8gdGhpcy5wZXJpb2QpICogdGhpcy5wZXJpb2Q7XG5cbiAgICBpZiAoc3BlZWQgPiAwICYmIG5leHRQb3NpdGlvbiA8IHBvc2l0aW9uKVxuICAgICAgbmV4dFBvc2l0aW9uICs9IHRoaXMucGVyaW9kO1xuICAgIGVsc2UgaWYgKHNwZWVkIDwgMCAmJiBuZXh0UG9zaXRpb24gPiBwb3NpdGlvbilcbiAgICAgIG5leHRQb3NpdGlvbiAtPSB0aGlzLnBlcmlvZDtcblxuICAgIHJldHVybiBuZXh0UG9zaXRpb247XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIC8vIGFkdmFuY2VQb3NpdGlvbih0aW1lLCBwb3NpdGlvbiwgc3BlZWQpIHtcbiAgLy8gICBjb25zdCBjdXJyZW50QmVhdCA9IE1hdGguZmxvb3IoKHRpbWUgLSB0aGlzLnN0YXJ0VGltZSAtIHRoaXMub2Zmc2V0KSAvIHRoaXMucGVyaW9kKTtcbiAgLy8gICBjb25zdCBlTWF4ID0gZ2V0TWF4T2ZBcnJheSh0aGlzLl9lbmVyZ3lCdWZmZXIpO1xuICAvLyAgIGNvbnN0IHJhbmQgPSBNYXRoLnJhbmRvbSgpO1xuICAvLyAgIGxldCBwID0gMC41O1xuICAvL1xuICAvLyAgIGlmIChhY2NlbnRzLmluZGV4T2YoY3VycmVudEJlYXQgJSAxNikgPT09IC0xKVxuICAvLyAgICAgcCA9IDAuOTtcbiAgLy9cbiAgLy8gICBpZiAoKGVNYXggPiAwLjkgJiYgcmFuZCA+IHApIHx8IGVNYXggPT09IDEpXG4gIC8vICAgICB0aGlzLnRyaWdnZXIodGltZSwgJ2Nob3JkJyk7XG4gIC8vICAgZWxzZSBpZiAoZU1heCA+IDAuNilcbiAgLy8gICAgIHRoaXMudHJpZ2dlcih0aW1lLCAnbXV0ZScpXG4gIC8vXG4gIC8vICAgaWYgKHNwZWVkIDwgMClcbiAgLy8gICAgIHJldHVybiBwb3NpdGlvbiAtIHRoaXMucGVyaW9kO1xuICAvL1xuICAvLyAgIHJldHVybiBwb3NpdGlvbiArIHRoaXMucGVyaW9kO1xuICAvLyB9XG5cbiAgYWR2YW5jZVBvc2l0aW9uKHRpbWUsIHBvc2l0aW9uLCBzcGVlZCkge1xuICAgIGNvbnN0IGN1cnJlbnRCZWF0ID0gTWF0aC5mbG9vcihcbiAgICAgICh0aW1lIC0gdGhpcy5zdGFydFRpbWUgLSB0aGlzLm9mZnNldCkgLyB0aGlzLnBlcmlvZFxuICAgICk7XG4gICAgY29uc3QgZU1heCA9IE1hdGgucG93KGdldE1heE9mQXJyYXkodGhpcy5fZW5lcmd5QnVmZmVyKSwgMikgLy8gVE9ETyAoaW5wdXRNKVxuICAgIGNvbnN0IHJhbmQgPSBNYXRoLnJhbmRvbSgpO1xuXG4gICAgLy8gSWYgdGhlIGJlYXQgaXMgb24gdGhlIG9yaWdpbmFsIHNvbmcncyBhY2NlbnRzLCBoaWdoIHByb2JhYmlsaXR5IHRvIHBsYXlcbiAgICBpZiAoYWNjZW50cy5pbmRleE9mKGN1cnJlbnRCZWF0ICUgMTYpID4gLTEpXG4gICAgICB0aGlzLl9wMSA9IHRoaXMuX3AxQWNjZW50O1xuICAgIGVsc2VcbiAgICAgIHRoaXMuX3AxID0gdGhpcy5fcDFOb0FjY2VudDtcblxuICAgIC8vIElmIHRoZSBsYXN0IGNob3JkIHdhcyBwbGF5ZWQgYXQgbGVhc3QgMyBiZWF0cyBiZWZvcmUgdGhlIGN1cnJlbnQgb25lLFxuICAgIC8vIGluY3JlYXNlIHByb2JhYmlsaXR5IHRvIHBsYXlcbiAgICBpZiAodGhpcy5fbGFzdEJlYXRQbGF5ZWQgJiYgdGhpcy5fbGFzdEJlYXRQbGF5ZWQgPCBjdXJyZW50QmVhdCAtIDIpXG4gICAgICB0aGlzLl9wMiAqPSB0aGlzLl9wMk11bHRpcGx5aW5nRmFjdG9yO1xuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBwcm9iYWJpbGl0eSB0byBwbGF5IGEgY2hvcmQgb24gdGhpcyBiZWF0XG4gICAgY29uc3QgcCA9IE1hdGgubWF4KHRoaXMuX3AxLCBNYXRoLm1pbih0aGlzLl9wMSAqIHRoaXMuX3AyLCAxKSk7XG5cbiAgICAvLyBEZWNpZGUgd2hhdCB0byBwbGF5XG4gICAgaWYgKGVNYXggPiAwLjkgJiYgcmFuZCA8IHApIHtcbiAgICAgIHRoaXMudHJpZ2dlcih0aW1lLCAnY2hvcmQnKTtcbiAgICAgIHRoaXMuX2xhc3RCZWF0UGxheWVkID0gY3VycmVudEJlYXQ7XG4gICAgICB0aGlzLl9wMiA9IHRoaXMuX3AyQmFzZVZhbHVlO1xuICAgIH0gZWxzZSBpZiAoZU1heCA+IDAuNSlcbiAgICAgIHRoaXMudHJpZ2dlcih0aW1lLCAnbXV0ZScpO1xuXG4gICAgaWYgKHNwZWVkIDwgMClcbiAgICAgIHJldHVybiBwb3NpdGlvbiAtIHRoaXMucGVyaW9kO1xuXG4gICAgcmV0dXJuIHBvc2l0aW9uICsgdGhpcy5wZXJpb2Q7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHRyaWdnZXIodGltZSwgdHlwZSkge1xuICAgIGNvbnN0IGN1cnJlbnRCZWF0ID0gTWF0aC5mbG9vcigodGltZSAtIHRoaXMuc3RhcnRUaW1lIC0gdGhpcy5vZmZzZXQpIC8gdGhpcy5wZXJpb2QpO1xuICAgIGxldCBjdXJyZW50Q2hvcmQ7XG4gICAgbGV0IGluZGV4O1xuXG4gICAgaWYgKGN1cnJlbnRCZWF0ID49IDAgJiYgY3VycmVudEJlYXQgPCAyMDApXG4gICAgICBjdXJyZW50Q2hvcmQgPSB0aGlzLl9jaG9yZFByb2dyZXNzaW9uW2N1cnJlbnRCZWF0XTtcblxuICAgIGlmICh0eXBlID09PSAnY2hvcmQnICYmIGN1cnJlbnRDaG9yZClcbiAgICAgIGluZGV4ID0gZ2V0UmFuZG9tVmFsdWUodGhpcy5fc2VnbWVudEluZGljZXNbY3VycmVudENob3JkXSk7XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gJ211dGUnIHx8IGN1cnJlbnRCZWF0IDwgMClcbiAgICAgIGluZGV4ID0gZ2V0UmFuZG9tVmFsdWUodGhpcy5fc2VnbWVudEluZGljZXNbJ211dGUnXSk7XG5cbiAgICAvLyBTdG9wIHBsYXlpbmcgYWZ0ZXIgdGhlIGVuZCBvZiB0aGUgYmFja3RyYWNrXG4gICAgaWYgKGN1cnJlbnRCZWF0IDwgMjAwKSB7XG4gICAgICB0aGlzLl9zZWdtZW50RW5naW5lLnNlZ21lbnRJbmRleCA9IGluZGV4O1xuICAgICAgdGhpcy5fc2VnbWVudEVuZ2luZS50cmlnZ2VyKHRpbWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgb25FbmVyZ3kodmFsKSB7XG4gICAgaWYgKHRoaXMuX2VuZXJneUJ1ZmZlci5sZW5ndGggPT09IHRoaXMuX2VuZXJneUJ1ZmZlck1heExlbmd0aClcbiAgICAgIHRoaXMuX2VuZXJneUJ1ZmZlci5wb3AoKTtcblxuICAgIHRoaXMuX2VuZXJneUJ1ZmZlci51bnNoaWZ0KHZhbCk7XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHN0YXJ0KCkge1xuICAgIHRoaXMuc3RhcnRUaW1lID0gYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuICAgIHRoaXMuY2hhbmdlTW9kZSh0aGlzLl9tb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgc3RvcCgpIHtcbiAgICAvLyBUT0RPOiByZW1vdmUgaWYgZW1wdHlcbiAgICB0aGlzLl9wMSA9IG51bGw7XG4gICAgdGhpcy5fcDIgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBjb25uZWN0KG5vZGUpIHtcbiAgICB0aGlzLm91dHB1dE5vZGUuY29ubmVjdChub2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY2hhbmdlTW9kZShtb2RlKSB7XG4gICAgdGhpcy5fbW9kZSA9IG1vZGU7XG5cbiAgICBzd2l0Y2gobW9kZSkge1xuICAgICAgY2FzZSAwOiAvLyBTdGljayB0byB0aGUgb3JpZ2luYWwgc29uZ1xuICAgICAgICB0aGlzLl9wMUFjY2VudCA9IDE7XG4gICAgICAgIHRoaXMuX3AxTm9BY2NlbnQgPSAwO1xuICAgICAgICB0aGlzLl9wMkJhc2VWYWx1ZSA9IDA7XG4gICAgICAgIHRoaXMuX3AyTXVsdGlwbHlpbmdGYWN0b3IgPSAwO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTogLy8gQSBsaXR0bGUgZ3VpZGFuY2VcbiAgICAgICAgdGhpcy5fcDFBY2NlbnQgPSAxO1xuICAgICAgICB0aGlzLl9wMU5vQWNjZW50ID0gMC4zO1xuICAgICAgICB0aGlzLl9wMkJhc2VWYWx1ZSA9IDAuNDtcbiAgICAgICAgdGhpcy5fcDJNdWx0aXBseWluZ0ZhY3RvciA9IDEuMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6IC8vIENvbXBsZXRlIGZyZWVkb21cbiAgICAgICAgdGhpcy5fcDFBY2NlbnQgPSAxO1xuICAgICAgICB0aGlzLl9wMU5vQWNjZW50ID0gMC41O1xuICAgICAgICB0aGlzLl9wMkJhc2VWYWx1ZSA9IDAuNTtcbiAgICAgICAgdGhpcy5fcDJNdWx0aXBseWluZ0ZhY3RvciA9IDEuMjtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gR3VpdGFyRW5naW5lO1xuIl19