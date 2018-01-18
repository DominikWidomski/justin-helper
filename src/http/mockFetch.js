const chalk = require('chalk');

module.exports = class MockFetch {
	constructor(config) {
		this.config = config;

		this._responses = {
			GET: {},
			POST: {}
		};
	}

	respondTo(method, url, response) {
		this._responses[method][url] = new Response(JSON.stringify(response));
	}

	fetch(url, options) {
		console.log(chalk.yellow("MOCK:", options.method, url));

		return this._responses[options.method][url];
	}

};