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
		try {
			return await res.json();
		} catch (e) {
			// TODO: Handle that JSON parsing error properly, better way?
			// for now letting through FetchError to do with JSON formatting
			if (e.type === "invalid-json") {
				return res.ok;
			}

			throw e;
		}
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

	/**
	 * Delete a ProjectTime record
	 * 
	 * @param {string} id ID of the ProjectTime to be deleted
	 */
	async deleteProjectTime(id) {
		// curl 'https://api.dev.justinapp.io/v1/project-times/108ba53d-afdb-4aa4-9e8b-a331ac9fa48a' -X DELETE -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-25' --compressed
		
		return await this.post(`/project-times/${id}`, {}, 'DELETE');
	}
}
