/**
 * @file Scratch
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 * @description Converts the action of scratching the screen or moving the
 * mouse into an energy value between 0 and 1.
 */

'use strict';

const EventEmitter = require('events').EventEmitter;

function speed(startPosition, endPosition) {
  const dX = endPosition[0] - startPosition[0];
  const dY = endPosition[1] - startPosition[1];
  const dT = endPosition[2] - startPosition[2];
  const timestamp = endPosition[2];

  if (dT !== 0)
    return [Math.sqrt(dX * dX + dY * dY) / dT, timestamp];

  return [0, timestamp];
}

function acc(startSpeed, endSpeed) {
  const dS = endSpeed[0] - startSpeed[0];
  const dT = endSpeed[1] - startSpeed[1];
  const timestamp = endSpeed[1];

  if (dT !== 0)
    return [dS / dT, timestamp];

  return [0, timestamp];
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
    // /!\ BUG
    // As of Safari 9.0 (11601.1.56) for Mac OS X 10.11 (15A284), Safari
    // triggers each mousemove event twice unless the mouse button is down while
    // dragging).
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
      this._lastS = this._s; // remains null the first time onMotion is called
      this._s = speed(this._pos, pos);
    }

    if (this._lastS)
      this._acc = acc(this._lastS, this._s);

    this._pos = pos;

    if (this._acc) {
      const accValue = Math.min(Math.abs(this._acc[0] / 100000), 1);
      this.event = this._filter.input(accValue);
    }

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
