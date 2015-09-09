/**
 * @file Scratch
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 * @description Converts the action of scratching the screen or moving the
 * mouse into an energy value between 0 and 1.
 */

'use strict';

const EventEmitter = require('events').EventEmitter;

function speed(a, b) {
  const dX = a[0] - b[0];
  const dY = a[1] - b[1];
  const dT = b[2] - a[2];

  if (dX !== 0 && dY !== 0 && dT !== 0)
    return [Math.sqrt(dX * dX + dY * dY) / dT, b[2]];

  return [0, b[2]];
}

function acc(a, b) {
  const dS = b[0] - a[0];
  const dT = b[1] - a[1];

  if (dS !== 0 && dT !== 0)
    return [dS / dT, b[1]];

  return [0, b[1]];
}

function getTime() {
  return (window.performance && window.performance.now) ?
    window.performance.now() / 1000 : new Date().getTime() / 1000;
}

/**
 * @class LowPassFilter
 * @description Applies a low-pass filter.
 */
class LowPassFilter {
  constructor(timeConstant) {
    this._XFiltered;
    this._previousTimestamp;
    this._timeConstant = timeConstant;
  }

  _decay(dt) {
    return Math.exp(-2 * Math.PI * dt / this._timeConstant);
  }

  input(x) {
    const now = getTime();

    if (this._previousTimestamp) {
      const dt = now - this._previousTimestamp;
      const k = this._decay(dt);

      this._XFiltered = k * this._XFiltered + (1 - k) * x;
      this._previousTimestamp = now;

      return this._XFiltered;
    } else {
      this._previousTimestamp = now;
      this._XFiltered = x;
      return;
    }
  }
}

class Scratch extends EventEmitter {
  constructor(options = {}) {
    super();

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

  onMotion(e) {
    const timestamp = e.timeStamp / 1000;
    let x;
    let y;

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

    const pos = [x, y, timestamp];

    if (this._pos) {
      this._lastS = this._s;
      this._s = speed(pos, this._pos);
    }

    if (this._lastS)
      this._acc = acc(this._s, this._lastS);

    this._pos = [x, y, timestamp];

    if (this._acc) {
      this.event = this._filter.input(
        Math.min(Math.abs(this._acc[0] / 100000), 1)
      );
    }

    // Weird bug on Safari desktop (it looks like that displaying something in
    // the console prevents the guitar from blocking).
    // console.log(pos[0]);

    this.emit('scratch', this.event);

    clearTimeout(this._timeout);
    this._timeout = this.timeoutFun();
  }

  timeoutFun() {
    return setTimeout(() => {
      this.event = this._filter.input(0);
      this.emit('scratch', this.event);
      this._timeout = this.timeoutFun();
    }, 50);
  }

}

module.exports = Scratch;
