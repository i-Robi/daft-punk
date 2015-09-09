/**
 * @file Guitar engine.
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 */

'use strict';

// Libraries
const audioContext = require('waves-audio').audioContext;
const SegmentEngine = require('waves-audio').SegmentEngine;
const TimeEngine = require('waves-audio').TimeEngine;

// Helper functions
function getMaxOfArray(array) {
  if (array.length > 0)
    return Math.max.apply(null, array);
  return null;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function getRandomValue(array) {
  return array[getRandomInt(0, array.length - 1)];
}

function chordConverter(chord, variation) {
  if (chord === 0)
    return 'mute';

  return chords[(chord - 1) * 2 + variation - 1];
}

function generateChordProgression() {
  let chordProgression = [];

  for (let i = 0; i < 200; i++) { // (4+2) bars * 8 beats * 4 eigth-notes = 192
    let chord;
    if (i % 128 < 32)
      chord = 'A#m';
    else if (i % 128 < 64)
      chord = 'G#';
    else if (i % 128 < 96)
      chord = 'D#m';
    else
      chord = 'F#';

    let variation;
    if (i % 16 < 3)
      variation = '-high';
    else
      variation = '-low';

    chordProgression[i] = chord + variation;
  }

  return chordProgression;
}

function sortMarkerIndices(markers) {
  let sortedIndices = {};

  for (let i = 0; i < markers.position.length; i++) {
    const chordName = chordConverter(markers.chord[i],
      markers.variation[i]);

    if (!sortedIndices[chordName])
      sortedIndices[chordName] = [];

    if (markers.strength[i] < 2)
      sortedIndices[chordName].push(i);
  }

  return sortedIndices;
}

// Helper constants
const chords = [
  'A#m-high',
  'A#m-low',
  'G#-high',
  'G#-low',
  'D#m-high',
  'D#m-low',
  'F#-high',
  'F#-low'
];
const accents = [0, 3, 6, 10, 12, 13, 14, 15];

class GuitarEngine extends TimeEngine {
  /**
   *
   */
  constructor(options = {}) {
    super();

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
  syncPosition(time, position, speed) {
    let nextPosition = Math.floor(position / this.period) * this.period;

    if (speed > 0 && nextPosition < position)
      nextPosition += this.period;
    else if (speed < 0 && nextPosition > position)
      nextPosition -= this.period;

    return nextPosition;
  }

  advancePosition(time, position, speed) {
    const currentBeat = Math.floor(
      (time - this.startTime - this.offset) / this.period
    );
    const rand = Math.random();
    const eMax = Math.pow(getMaxOfArray(this._energyBuffer), 2); // TODO (inputM)
    const sMax = getMaxOfArray(this._scratchBuffer);
    const level = Math.max(eMax, sMax);

    // If the beat is on the original song's accents, high probability to play
    if (accents.indexOf(currentBeat % 16) > -1)
      this._p1 = this._p1Accent;
    else
      this._p1 = this._p1NoAccent;

    // If the last chord was played at least 3 beats before the current one,
    // increase probability to play
    if (this._lastBeatPlayed && this._lastBeatPlayed < currentBeat - 2)
      this._p2 *= this._p2MultiplyingFactor;

    // Calculate the probability to play a chord on this beat
    const p = Math.max(this._p1, Math.min(this._p1 * this._p2, 1));

    // Decide what to play
    if (level > 0.9 && rand < p) {
      this.trigger(time, 'chord');
      this._lastBeatPlayed = currentBeat;
      this._p2 = this._p2BaseValue;
    } else if (level > 0.5)
      this.trigger(time, 'mute');

    if (speed < 0)
      return position - this.period;

    return position + this.period;
  }

  /**
   *
   */
  trigger(time, type) {
    const currentBeat = Math.floor((time - this.startTime - this.offset) / this.period);
    let currentChord;
    let index;

    if (currentBeat >= 0 && currentBeat < this._numBeats)
      currentChord = this._chordProgression[currentBeat];

    if (type === 'chord' && currentChord)
      index = getRandomValue(this._segmentIndices[currentChord]);
    else if (type === 'mute' || currentBeat < 0)
      index = getRandomValue(this._segmentIndices['mute']);

    // Stop playing after the end of the backtrack
    if (currentBeat < this._numBeats) {
      this._segmentEngine.segmentIndex = index;
      this._segmentEngine.trigger(time);
    }
  }

  /**
   *
   */
  onEnergy(val) {
    if (this._energyBuffer.length === this._energyBufferMaxLength)
      this._energyBuffer.pop();

    this._energyBuffer.unshift(val);
  }

  /**
   *
   */
  onScratch(val) {
    if (this._scratchBuffer.length === this._scratchBufferMaxLength)
      this._scratchBuffer.pop();

    this._scratchBuffer.unshift(val);
  }

  /**
   *
   */
  start() {
    this.startTime = audioContext.currentTime;
    this.changeMode(this._mode);
  }

  /**
   *
   */
  stop() {
    // TODO: remove if empty
    this._p1 = null;
    this._p2 = null;
  }

  /**
   *
   */
  connect(node) {
    this.outputNode.connect(node);
  }

  /**
   *
   */
  changeMode(mode) {
    this._mode = mode;

    switch(mode) {
      case 0: // Stick to the original song
        this._p1Accent = 1;
        this._p1NoAccent = 0;
        this._p2BaseValue = 0;
        this._p2MultiplyingFactor = 0;
        break;
      case 1: // A little guidance
        this._p1Accent = 1;
        this._p1NoAccent = 0.3;
        this._p2BaseValue = 0.4;
        this._p2MultiplyingFactor = 1.1;
        break;
      case 2: // Complete freedom
        this._p1Accent = 1;
        this._p1NoAccent = 0.5;
        this._p2BaseValue = 0.5;
        this._p2MultiplyingFactor = 1.2;
        break;
    }
  }
}

module.exports = GuitarEngine;
