const chalk = require('chalk');
const URL = require('url');

module.exports = class MockFetch {
	constructor(config) {
		this.config = config;

		this._responses = {
			GET: {},
			POST: {}
		};
	}

	// @TODO: accept response to be a callback to allow dynamic responses
	// how to match against a specific request body
	// at the same time as allowing to provide response body and params separately?
	respondTo(method, url, response) {
		this._responses[method][url] = new Response(JSON.stringify(response));
	}

	fetch(url, options) {
		console.log(chalk.yellow("MOCK:", options.method, url));

		const {
			protocol,
			hostname,
			pathname
		} = URL.parse(url);

		url = protocol + "//" + hostname + pathname;

		return this._responses[options.method][url].clone();
	}

};