require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');
const atob = require('atob');

const DateUtil = require("../utils/date");

// const fetch = require("../utils/mockServerResponses")();

// const serverTokenEndpoint = basePath + authPath;
// const serverTokenRefreshEndpoint = serverTokenEndpoint + '/refresh-token';

module.exports = class JustinClient {
	constructor(config) {
		// @TODO: Clean this up a bit
		this.config = Object.assign({}, config);

		// @TODO: Not used
		this.config.identificationField = 'email';

		const { basePath } = this.config;

		this.config.serverTokenEndpoint = basePath + '/auth';
		this.config.serverTokenRefreshEndpoint = this.config.serverTokenEndpoint + '/refresh-token';
	}

	async authenticate(email = '', password = '') {
		const authTokenFilename = ".justinauthtoken";
		const homeDir = require('os').homedir();
		const authTokenFilepath = path.resolve(homeDir, authTokenFilename);
		
		if (fs.existsSync(authTokenFilepath)) {
			const data = fs.readFileSync(authTokenFilepath);
			this.token = data.toString()
		} else {
			// @TODO: Indicate progress of "Authenticating..."
			const tokenResponse = await this.getToken(email, password);
			this.token = tokenResponse.token;

			fs.appendFileSync(authTokenFilepath, this.token, {
				mode: 0o666,
				flags: 'w'
			});
		}
	}

	async getToken(email = '', password = '') {
		const res = await fetch(this.config.serverTokenEndpoint, {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				email,
				password,
				app_token: this.config.appToken
			})
		});

		return await res.json();
	}

	get tokenData() {
	    const payload = this.token.split(".")[1]
	    const response = decodeURIComponent(atob(payload))
	    try {
	        return JSON.parse(response)
	    } catch (e) {
	    	console.log(e);
	        return response
	    }
	};

	// @TODO: Still work to do this properly
	_handleProjectTimesPostResponse(res) {
		if (res.errors) {
			const {
				title,
				detail
			} = res.errors[0];
			console.error(chalk.red(`${title}: ${detail}`));
			console.log(res.errors[0].source);

			// throw new Error(title);
		}

		return res;
	}

	async get(path) {
		let res = await fetch(this.config.basePath + path, {
			method: 'GET',
			headers: {
				'Authorization': 'Bearer ' + this.token, 
				'Content-Type': 'application/x-www-form-urlencoded'
			}, 
		});

		res = this._handleProjectTimesPostResponse(res);

		return await res.json();
	}

	async post(path, data, method = "POST") {
		const params = {
			method,
			headers: {
				'Authorization': 'Bearer ' + this.token, 
				'Content-Type': 'application/json'
			}
		};

		if (data) {
			params.body = JSON.stringify(data);
		}

		let res = await fetch(this.config.basePath + path, params);

		res = this._handleProjectTimesPostResponse(res);

		// @TODO: Uniform solution for html or JSON?
		return await res.json();
	}

	async getUser(userId) {
		return await this.get('/users/' + userId);
	}

	async getProjects() {
		return await this.get('/projects');
	}

	async getProjectTimes(filters, includes) {
		let uri = '/project-times';

		let query = [];

		if (filters) {
			query = Object.keys(filters).map(key => {
				return `${encodeURIComponent(`filter[${key}]`)}=${filters[key]}`;
			});
		}

		if (includes) {
			query.push(`include=${includes.join(',')}`);
		}

		if (query.length) {
			query = query.join('&');
			uri += `?${query}`;
		}

		return await this.get(uri);
	}
}