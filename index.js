require('dotenv').config()

const inquirer = require('inquirer');
const Table = require('cli-table2');
const DateUtil = require("./src/utils/date");
require('isomorphic-fetch');
const atob = require('atob');
const crypto = require('crypto');
const base64url = require('base64url');

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

const app_token = process.env.APP_TOKEN;
const basePath = process.env.API_BASE_PATH;
const authPath = '/auth';

const serverTokenEndpoint = basePath + authPath;
const serverTokenRefreshEndpoint = serverTokenEndpoint + '/refresh-token';
const identificationField = 'email';

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
  });

let token;

async function get(path) {
	const res = await fetch(basePath + path, {
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + token, 
			'Content-Type': 'application/x-www-form-urlencoded'
		}, 
	});

	return await res.json();
}

async function post(path, data, method = "POST") {
	const res = await fetch(basePath + path, {
		method,
		headers: {
			'Authorization': 'Bearer ' + token, 
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data)
	});

	return await res.json();
}

async function getUser(userId) {
	return await get('/users/' + userId);
}

async function getProjects() {
	return await get('/projects');
}

async function getProjectTimes(filters, includes) {
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

	return await get(uri);
}

async function getToken() {
	const res = await fetch(serverTokenEndpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			email: process.env.email,
			password: process.env.password,
			app_token
		})
	});

	return await res.json();
}

function getTokenData(e) {
    const token = e.split(".")[1]
    const response = decodeURIComponent(atob(token))
    try {
        return JSON.parse(response)
    } catch (e) {
    	console.log(e);
        return response
    }
};

async function main() {
	const tokenResponse = await getToken();
	token = tokenResponse.token;

	const tokenData = getTokenData(token);
	const userData = await getUser(tokenData['user_id']);

	const answers = await inquirer.prompt([{
		message: `Is this you: ${userData.data.id} ${userData.data.attributes.name}`,
		type: "confirm",
		name: "confirmIdentity",
	}]);
	
	const projects = await getProjects();

	// console.log(projects.data.map(project => project.attributes.name));

	const selectedProject = await inquirer.prompt([{
		message: "Select a project",
		type: "list",
		name: "selectedProject",
		choices: projects.data.map(project => ({
			name: project.attributes.name,
			value: project.id
		}))
	}]);

	console.log("Selected Project:", selectedProject);

	// GET project-times to check 
	// https://api.dev.justinapp.io/v1/project-times?filter%5Buser_id%5D=29e5bf60-f1c9-402b-a366-52afacc6765a&filter%5Bdate%3Astart%5D=2017-12-25&filter%5Bdate%3Aend%5D=2017-12-30&include=rejections

	const today = new Date();
	let weekBeginning = DateUtil.getDateTime(DateUtil.getStartOfWeek(today));
	let weekEnding = DateUtil.getDateTime(DateUtil.addDaysToDate(weekBeginning, 6));
	let lookEarlier = true;
	let projectTimes = [];

	while (lookEarlier) {
		console.log("Week:", weekBeginning, weekEnding);

		projectTimes = await getProjectTimes({
			user_id: userData.data.id,
			'date:start': weekBeginning,
			'date:end': weekEnding
		}, ['rejections']);

		const result = await inquirer.prompt([{
			type: "confirm",
			name: "lookEarlier",
			default: projectTimes.meta.total ? false : true,
			message: `Found ${projectTimes.meta.total} dates for this week. Look earlier?`
		}]);	

		lookEarlier = result.lookEarlier;
		weekBeginning = DateUtil.getDateTime(DateUtil.addDaysToDate(weekBeginning, -7));
		weekEnding = DateUtil.getDateTime(DateUtil.addDaysToDate(weekEnding, -7));
	}

	// instantiate 
	var table = new Table({
	    head: ['Day', 'Date', 'Project', 'Time']
	});

	projectTimes.data.forEach(projectTime => {
		const { date, duration_mins, project_id } = projectTime.attributes;
		const projectName = projects.data.find(project => project.id === project_id).attributes.name;
		table.push([ DateUtil.getNameOfDay(date), date, projectName, duration_mins / 60 ]);
	});
	console.log(table.toString());

	// get last input - project date and time
	// ask if you'd like to repeat it
	// POST for new Project time

	// POST: Create project time, time in minutes 420min -> 7h
	// curl 'https://api.dev.justinapp.io/v1/project-times' -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'content-type: application/vnd.api+json' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-18' --data-binary '{"data":{"attributes":{"project_id":"baa95e34-4008-4915-99ea-e5cde907b65c","user_id":"29e5bf60-f1c9-402b-a366-52afacc6765a","date":"2017-12-20","duration_mins":420,"approved_at":null,"created_at":null,"updated_at":null,"is_rejected":false},"type":"project-times"}}' --compressed

	// PATCH: update a project time...
	// curl 'https://api.dev.justinapp.io/v1/project-times/27bf79ca-a185-4fa7-9e20-5346149bae92' -X PATCH -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'content-type: application/vnd.api+json' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-18' --data-binary '{"data":{"id":"27bf79ca-a185-4fa7-9e20-5346149bae92","attributes":{"project_id":"baa95e34-4008-4915-99ea-e5cde907b65c","user_id":"29e5bf60-f1c9-402b-a366-52afacc6765a","date":"2017-12-20","duration_mins":300,"approved_at":null,"created_at":"2017-12-29T01:31:18.000Z","updated_at":"2017-12-29T01:31:18.000Z","is_rejected":false},"relationships":{"rejections":{"data":[]}},"type":"project-times"}}' --compressed

	const data = {
		"data": {
			"attributes": {
				// "approved_at": null,
				// "created_at": "2017-12-29T01:31:18.000Z",
				// "date": "2017-12-20",
				"duration_mins": 420,
				// "is_rejected": false,
				// "project_id": "baa95e34-4008-4915-99ea-e5cde907b65c",
				// "updated_at": "2017-12-29T01:31:18.000Z",
				// "user_id": "29e5bf60-f1c9-402b-a366-52afacc6765a"
			},
			// "id": "27bf79ca-a185-4fa7-9e20-5346149bae92",
			// "relationships": {
			// 	"rejections": {
			// 		"data": []
			// 	}
			// },
			"type": "project-times"
		}
	};

	// const res = await post("/project-times/27bf79ca-a185-4fa7-9e20-5346149bae92", data, "PATCH");
	// console.log(res);
}

main();
