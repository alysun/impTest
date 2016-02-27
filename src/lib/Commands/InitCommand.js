/**
 * Init command
 *
 * @author Mikhail Yurasov <mikhail@electricimp.com>
 */

'use strict';

const c = require('colors');
const glob = require('glob');
const prompt = require('cli-prompt');
const AbstractCommand = require('./AbstractCommand');
const CliTable = require('cli-table');

/**
 * Name for BuildAPI key env var
 */
const BUILD_API_KEY_ENV_VAR = 'IMP_BUILD_API_KEY';

class InitCommand extends AbstractCommand {

  _init() {
    super._init();
    this._values = {};
  }

  _run() {
    return super._run()
      .then(this._promt.bind(this));
  }

  /**
   * Log message
   * @param {string} type
   * @param {[*]} params
   * @protected
   */
  _log(type, colorFn, params) {
    // convert params to true array (from arguments)
    params = Array.prototype.slice.call(params);
    console.log.apply(this, params);
  }

  /**
   * Prompt for values
   * @return {Promise}
   * @private
   */
  _promt() {
    return new Promise((resolve, reject) => {
      if (!this.force && this._impTestFile.exists()) {
        reject(new Error('Config file already exists, use -f option to overwrite'));
      } else {
        return this
          ._promptApiKey()
          .then(() => this._promptDevices())
          .then(() => this._promptFiles())
          .then(() => this._promtpOptions())
          .catch((err) => {
            this._onError(err);
          });
      }
    });
  }

  /**
   * Prompt apiKey
   * @return {Promise}
   * @private
   */
  _promptApiKey() {
    return new Promise((resolve, reject) => {
      prompt.multi([{
        key: 'apiKey',
        label: c.yellow('> Build API key (IMP_BULD_API_KEY environment variable is used if blank)'),
        type: 'string',
        'default': ''
      }], (input) => {
        this._impTestFile.values.apiKey = input.apiKey
          ? input.apiKey
          : null;
        resolve(this._getAccount().catch((e) => {
          this._onError(e);
          return this._promptApiKey();
        }));
      });
    });
  }

  /**
   * Get account info
   * @return {Promise}
   * @private
   */
  _getAccount() {
    return new Promise((resolve, reject) => {

      console.log(c.grey('Retrieving your devices...'));

      this._buildAPIClient.apiKey =
        this._impTestFile.values.apiKey
        || process.env[BUILD_API_KEY_ENV_VAR];

      this._buildAPIClient
        .getDevices().then((res) => {
          this._devices = {};
          for (const device of res.devices) {
            this._devices[device.id] = device;
          }
        })
        .then(() => this._buildAPIClient.getModels().then((res) => {
          this._models = {};
          for (const model of res.models) {
            this._models[model.id] = model;
          }
        }))
        .then(() => this._displayAccount())
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Display account devices/models
   * @private
   */
  _displayAccount() {
    const table = new CliTable({
      head: [
        c.blue('Device ID'),
        c.blue('Device Name'),
        c.blue('Model ID'),
        c.blue('Model Name'),
        c.blue('State')
      ]
    });

    for (const modelId in this._models) {
      for (const deviceId of  this._models[modelId].devices) {
        table.push([
          deviceId,
          this._devices[deviceId].name,
          this._models[modelId].id,
          this._models[modelId].name,
          this._devices[deviceId].powerstate === 'online'
            ? c.green(this._devices[deviceId].powerstate)
            : c.red(this._devices[deviceId].powerstate)
        ]);
      }
    }

    this._info(table.toString());
  }

  /**
   * Prompt device ids/model id
   * @return {Promise}
   * @private
   */
  _promptDevices() {
    return new Promise((resolve, reject) => {

      let defaultModelId = '';

      prompt.multi([
        {
          key: 'devices',
          label: c.yellow('> Device IDs to run tests on (comma-separated)'),
          type: 'string',
          'default': this._impTestFile.values.devices.join(','),
          validate: (value) => {
            if (!value) return false;

            const modelIds = new Set();

            for (const deviceId of value.split(',').map((v) => v.trim())) {
              if (!this._devices[deviceId]) {
                this._error('Device ID ' + deviceId + ' not found on your account');
                return false;
              }

              if (!modelIds.has(this._devices[deviceId].model_id)) {
                modelIds.add(this._devices[deviceId].model_id);
                defaultModelId = this._devices[deviceId].model_id;
              }

              if (modelIds.size > 1) {
                this._error('Devices should be attached to the same model');
                return false;
              }
            }

            return true;
          }
        },
        {
          key: 'modelId',
          label: c.yellow('> Model ID'),
          type: 'string',
          'default': () => defaultModelId,
          validate: (value) => {
            if (!value) return false;

            if (!this._models[value]) {
              this._error('Model ID ' + value + ' not found on your account');
              return false;
            }

            return true;
          }
        },
      ], (input) => {
        const devices = input.devices.split(',').map((v) => v.trim());
        this._impTestFile.values.devices = devices;
        this._impTestFile.values.modelId = input.modelId;
        resolve();
      });

    });
  }

  /**
   * Proimpt files
   * @return {Promise}
   * @private
   */
  _promptFiles() {
    return new Promise((resolve, reject) => {

      const deviceFiles = glob.sync('**/*device*.nut', {cwd: this._impTestFile.dir});
      const agentFiles = glob.sync('**/*agent*.nut', {cwd: this._impTestFile.dir});

      prompt.multi([
          {
            key: 'deviceFile',
            label: c.yellow('> Device file' + (deviceFiles[0] ? ' (type "-" for no device file)' : '')),
            type: 'string',
            'default': () => deviceFiles[0] || '<no file>'
          },
          {
            key: 'agentFile',
            label: c.yellow('> Agent file' + (agentFiles[0] ? ' (type "-" for no agent file)' : '')),
            type: 'string',
            'default': () => agentFiles[0] || '<no file>'
          }
        ],
        (input) => {
          this._impTestFile.values.deviceFile =
            input.deviceFile && input.deviceFile !== '-'
            && input.deviceFile !== '<no file>'
              ? input.deviceFile : null;
          this._impTestFile.values.agentFile =
            input.agentFile && input.agentFile !== '-'
            && input.agentFile !== '<no file>'
              ? input.agentFile : null;
          resolve();
        });
    });
  }

  /**
   * Prompt options
   * @return {Promise}
   * @private
   */
  _promtpOptions() {
    return new Promise((resolve, reject) => {
      prompt.multi([
          {
            key: 'stopOnFailure',
            label: c.yellow('> Stop testing on failures?'),
            type: 'boolean',
            'default': this._impTestFile.values.stopOnFailure ? 'yes' : 'no'
          },
          {
            key: 'timeout',
            label: c.yellow('> Test methods timeout, seconds'),
            type: 'integer',
            'default': this._impTestFile.values.timeout
          },
        ],
        (input) => {
          this._impTestFile.values.stopOnFailure = input.stopOnFailure;
          this._impTestFile.values.timeout = input.timeout;
          resolve();
        });
    });
  }

  get force() {
    return this._force;
  }

  set force(value) {
    this._force = value;
  }
}

module.exports = InitCommand;
