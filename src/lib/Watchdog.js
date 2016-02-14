/**
 * Watchdog timer
 */

'use strict';

const DebugMixin = require('./DebugMixin');
const EventEmitter = require('events');

class Watchdog extends EventEmitter {

  constructor() {
    super();
    DebugMixin.call(this);
    this.name = null;
    this._timerId = null;
    this.timeout = 1;
  }

  start() {
    this._timerId = setTimeout(
      this._onTimeout.bind(this),
      this._timeout * 1000
    );
  }

  reset() {
    this.stop();
    this.start();
  }

  stop() {
    if (this._timerId) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  _onTimeout() {
    this.emit('timeout');
    this.emit('timeout', {name: this.name});
  }

  get timeout() {
    return this._timeout;
  }

  set timeout(value) {
    this._timeout = value;
  }

  get name() {
    return this._name;
  }

  set name(value) {
    this._name = value;
  }
}

module.exports = Watchdog;
