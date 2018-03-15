/* @flow */

// import type { RequestOptions } from 'https';

require('isomorphic-fetch');
// const fs = require('fs');
const path = require('path');
const atob = require('atob');
const chalk = require('chalk');

const DateUtil = require("../utils/date");
const fs = require('../utils/fileSystem');

import {
	type ProjectTime,
	type JustinResponse
} from "../types";

// const fetch = require("../utils/mockServerResponses")();

// const serverTokenEndpoint = basePath + authPath;
// const serverTokenRefreshEndpoint = serverTokenEndpoint + '/refresh-token';

// TODO: don't really like how this is union with null
// I'm doing this because otherwise Flow complains about process.env
// https://github.com/facebook/flow/issues/1192
// https://github.com/facebook/flow/issues/3399
type JustinClientConfigProp = {
	appToken?: string | null,
	basePath?: string | null,
	serverTokenEndpoint?: string | null
};

// TODO: Any way of doing this with a utility or something?
// apparently something like this can work:
// https://stackoverflow.com/questions/43564538/flowtype-subtype-that-makes-optional-property-required
// type JustinClientConfig = $Exact<JustinClientConfigProp>;
type JustinClientConfig = {
	appToken: string | null,
	basePath: string | null,
	serverTokenEndpoint: string | null
};

type ProjectTimesFilters = {
	user_id?: string,
	'date:start'?: string,
	'date:end'?: string
};

// const defaultProps = {
// 	appToken: '',
// 	basePath: '',
// 	serverTokenEndpoint: ''
// };

// some inspiration of a similar package:
// https://github.com/mpj/junction-example/blob/master/src/junction-file-cache.js
// Some use cases - whole LBX / AP client mocking this stuff.
// but also the alphapoint-playground, toggle whether you want to mock responses
// some UI showing that it's mocked, then busting that cache, I guess the package would need to signal status a bit to allow someone to build that.
function writeResponseToFile(content, url: string, method: string) {
	const filename = "." + url + "." + method;
	const responseFilepath = path.resolve(__dirname, "./responses/", filename);

	if (!fs.existsSync(responseFilepath)) {
		fs.writeFile(responseFilepath, JSON.stringify(content, null, 4), { mode: 0o666, flag: 'wx' }, function (err) {
			if (err) {
				console.log(err);
			} else {
				console.log("It's saved!");
			}
		});
	}
}

module.exports = class JustinClient {
	config: JustinClientConfig;
	token: string;
	
	constructor(config: JustinClientConfigProp) {
		// @TODO: Clean this up a bit
		this.config = Object.assign({}, config);

		// @TODO: Not used
		// this.config.identificationField = 'email';

		const { basePath } = this.config;

		// @TODO: Hack to avoid Flow error...
		this.config.serverTokenEndpoint = (basePath || '') + '/auth';
		this.config.serverTokenRefreshEndpoint = this.config.serverTokenEndpoint + '/refresh-token';
	}

	async authenticate(email?: string = '', password?: string = '') {
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

	async getToken(email: string = '', password: string = '') {
		// @TODO: Another flow null "workaround"
		const res = await fetch(this.config.serverTokenEndpoint || '', {
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

	get tokenData(): {[key: string]: any} {
	    const payload = this.token.split(".")[1]
	    const response = decodeURIComponent(atob(payload))
	    try {
	        return JSON.parse(response);
	    } catch (e) {
			throw e;
	        // return response;
	    }
	};

	// @TODO: Still work to do this properly
	// @TODO: res type to be of JustinResponse or JustinErrorResponse or something like that
	async _handleProjectTimesPostResponse(res: { errors: { title: any, detail: any, source: any}[] } | any) {
		if (res.errors) {
			const {
				title,
				detail
			} = res.errors[0];
			console.error(chalk.red(`${title}: ${detail}`));
			console.log("Source:", res.errors[0].source.pointer);

			// throw new Error(title);
		}

		return res;
	}

	async get(url: string): Promise<any> {
		// @TODO: Another flow null "workaround"
		let res = await fetch((this.config.basePath || '') + url, {
			method: 'GET',
			headers: {
				'Authorization': 'Bearer ' + this.token, 
				'Content-Type': 'application/x-www-form-urlencoded'
			}, 
		});

		const body = await res.json()

		writeResponseToFile(body, url, "GET");
		
		return await body;
	}

	async post(url: string, data: Object, method?: string = "POST") {
		const params: RequestOptions = {
			method,
			headers: {
				'Authorization': 'Bearer ' + this.token, 
				'Content-Type': 'application/json'
			}
		};

		if (data) {
			params.body = JSON.stringify(data);
		}

		// @TODO: Another flow null "workaround"
		const requestUrl = (this.config.basePath || '') + url;

		let res = await fetch(requestUrl, params);

		// @TODO: Uniform solution for html or JSON?
		try {
			let responseBody = await res.json();
			responseBody = this._handleProjectTimesPostResponse(responseBody);
			
			writeResponseToFile(responseBody, url, "POST");
			
			return responseBody;
		} catch (e) {
			// TODO: Handle that JSON parsing error properly, better way?
			// for now letting through FetchError to do with JSON formatting
			if (e.type === "invalid-json") {
				return res.ok;
			}

			throw e;
		}
	}

	async getUser(userId: string) {
		return await this.get('/users/' + userId);
	}

	async getProjects() {
		return await this.get('/projects');
	}

	// TODO: any way of doing this? JustinResponse<ProjectTime[]>
	// async getProjectTimes(filters: ProjectTimesFilters, includes: string[]): Promise<any> {
	async getProjectTimes(filters: ProjectTimesFilters, includes: string[]): Promise<JustinResponse<ProjectTime[]>> {
		let uri = '/project-times';

		let query = [];

		if (filters) {
			query = Object.keys(filters).map(key => {
				return `${encodeURIComponent(`filter[${key}]`)}=${filters[key] || "true"}`;
			});
		}

		if (includes) {
			query.push(`include=${includes.join(',')}`);
		}

		if (query.length) {
			query = query.join('&');
			uri += `?${query}`;
		}

		return this.get(uri);
	}

	/**
	 * Delete a ProjectTime record
	 * 
	 * @param {string} id ID of the ProjectTime to be deleted
	 */
	async deleteProjectTime(id: string) {
		// curl 'https://api.dev.justinapp.io/v1/project-times/108ba53d-afdb-4aa4-9e8b-a331ac9fa48a' -X DELETE -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-25' --compressed
		
		return await this.post(`/project-times/${id}`, {}, 'DELETE');
	}
}
