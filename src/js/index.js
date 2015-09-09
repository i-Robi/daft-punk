/**
 * @file Interactive version of Daft Punk's Lose Yourself To Dance.
 * @author Sébastien Robaszkiewicz [hello@robi.me]
 */

'use strict';

// Libraries and files
const audioContext = require('waves-audio').audioContext;
const DotNav = require('./DotNav');
const GuitarEngine = require('./GuitarEngine');
const input = require('motion-input');
const SuperLoader = require('waves-loaders').SuperLoader;
const PlayControl = require('waves-audio').PlayControl;
const PlayerEngine = require('waves-audio').PlayerEngine;
const Scratch = require('./Scratch');
const Transport = require('waves-audio').Transport;

// Helper functions
function startWebAudio() {
  const o = audioContext.createOscillator();
  const g = audioContext.createGain();
  const now = audioContext.currentTime;
  o.connect(g);
  g.connect(audioContext.destination);
  o.start(now);
  o.stop(now + 0.000001);
}

// Helper variables
let webAudioStarted = false;
let playing = false;
let timeout = null;

// Constants (song specific)
const mode = 0;
const offset = 2.400;
const period = 0.150;

// Script
(function() {
  const loader = new SuperLoader();

  // Prevent scrolling
  document.body.addEventListener('touchmove', (e) => {
    e.preventDefault();
  });

  Promise.all([
    loader.load(['assets/backtrack.mp3', 'assets/guitar.mp3', 'assets/guitar-markers.json']),
    input.init('energy')
  ]).then(([loadedFiles, inputModules]) => {
    // Files and energy module
    const backtrackBuffer = loadedFiles[0];
    const guitarBuffer = loadedFiles[1];
    const guitarMarkers = loadedFiles[2];
    const energy = inputModules[0];

    // Player engine (backtrack)
    const backtrackPlayer = new PlayerEngine({
      buffer: backtrackBuffer,
      gain: 0.5
    });
    backtrackPlayer.connect(audioContext.destination);

    // Instrument engine (guitar)
    const guitarEngine = new GuitarEngine({
      audioBuffer: guitarBuffer,
      mode: mode,
      numBeats: 200,
      offset: offset,
      period: period,
      segmentMarkers: guitarMarkers
    });
    guitarEngine.connect(audioContext.destination);

    // Transport
    const transport = new Transport();
    transport.add(backtrackPlayer, 0, Infinity);
    transport.add(guitarEngine, 0, Infinity);

    // Play control
    const playControl = new PlayControl(transport);

    // Dot navigation
    const nav = document.querySelector('.dot-nav');
    const dotNav = new DotNav({
      callback: guitarEngine.changeMode.bind(guitarEngine),
      nav: nav,
      selected: mode
    });

    // Button
    let button = document.getElementById('button').querySelector('i');
    button.addEventListener('click', () => {
      if (!webAudioStarted) {
        startWebAudio();
        webAudioStarted = true;
      }

      if (!playing) {
        playControl.start();
        guitarEngine.start();
        playing = true;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          playControl.stop();
          guitarEngine.stop(); // TODO: remove if empty
          button.classList.toggle('icon-play');
          button.classList.toggle('icon-stop');
          playing = false;
        }, backtrackBuffer.duration * 1000)
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
    const scratch = new Scratch();
    scratch.on('scratch', (val) => {
      guitarEngine.onScratch(val);
    });

    // Input module listener
    const instr = document.querySelector('.instructions')
    if (energy.isValid) {
      instr.innerHTML = `hit &lsquo;play&rsquo; and shake your device
        </br>(or scratch the screen)`;
      input.addListener('energy', (val) => {
        guitarEngine.onEnergy(val);
      });
    } else if ('ontouchstart' in window) {
      instr.innerHTML = 'hit &lsquo;play&rsquo; and scratch the screen';
    } else {
      instr.innerHTML = 'hit &lsquo;play&rsquo; and move your mouse';
    }
  });
}());
