require('dotenv').config()

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const Table = require('cli-table2');
const fuzzy = require('fuzzy');
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
	const params = {
		method,
		headers: {
			'Authorization': 'Bearer ' + token, 
			'Content-Type': 'application/json'
		}
	};

	if (data) {
		params.body = JSON.stringify(data);
	}

	const res = await fetch(basePath + path, params);

	// @TODO: Uniform solution for html or JSON?
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

// @TODO: ERROR HANDLING! Should this throw inside `get`/`post`?
function handleProjectTimesPostResponse(res) {
	if (res.errors) {
		const {
			title,
			detail
		} = res.errors[0];
		console.error(chalk.red(`${title}: ${detail}`));
		console.log(res.errors[0].source);
	} else {
		const {
			duration_mins, project_id, date
		} = res.data.attributes;
		projectName = projects.data.find(project => project.id === project_id).attributes.name;
		console.log(`Submitted ${duration_mins / 60} to ${projectName} on ${DateUtil.getNameOfDay(date)} ${date}`);
	}
}

async function main() {
	const authTokenFilename = ".justinauthtoken";
	const homeDir = require('os').homedir();
	const authTokenFilepath = path.resolve(homeDir, authTokenFilename);
	
	if (fs.existsSync(authTokenFilepath)) {
		const data = fs.readFileSync(authTokenFilepath);
		token = data.toString()
	} else {
		// @TODO: Indicate progress of "Authenticating..."
		const tokenResponse = await getToken();
		token = tokenResponse.token;

		fs.appendFileSync(authTokenFilepath, token, {
			mode: 0o666,
			flags: 'w'
		});
	}

	const tokenData = getTokenData(token);
	const userData = await getUser(tokenData['user_id']);

	const answers = await inquirer.prompt([{
		message: `Is this you: ${userData.data.id} ${userData.data.attributes.name}`,
		type: "confirm",
		name: "confirmIdentity",
	}]);
	
	const projects = await getProjects();

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

	var table = new Table({
	    head: ['Day', 'Date', 'Project', 'Time']
	});

	// @TODO: Duplicated
	projectTimes.data
		.sort((a, b) => new Date(a.attributes.date) > new Date(b.attributes.date))
		.forEach(projectTime => {
			const { date, duration_mins, project_id } = projectTime.attributes;
			const projectName = projects.data.find(project => project.id === project_id).attributes.name;
			table.push([ DateUtil.getNameOfDay(date), date, projectName, duration_mins / 60 ]);
		});
	console.log(table.toString());

	// get last input - project date and time
	const lastInput = projectTimes.data.sort((a, b) => {
		return new Date(a.attributes.date) < new Date(b.attributes.date);
	}).filter(projectTime => {
		return projectTime.attributes.duration_mins > 0;
	})[0];

	// ask if you'd like to repeat it
	const queryNextAction = async (lastInput) => {
		const { date, duration_mins, project_id } = lastInput.attributes;
		const projectName = projects.data.find(project => project.id === project_id).attributes.name;
		const query = await inquirer.prompt([{
			message: `Most recent: ${[ DateUtil.getNameOfDay(date), date, projectName, duration_mins / 60 + 'h' ].join(', ')}. Repeat?`,
			type: "expand",
			name: "nextAction",
			choices: [
				{ key: 'y', name: "Yes, do the same on next day", value: 'repeat' },
				{ key: 'n', name: "No, do nothing for now", value: 'nothing' },
				{ key: 'e', name: "Edit", value: 'edit' }
			]
		}]);

		return query.nextAction;
	}

	const nextAction = await queryNextAction(lastInput);

	const lastDate = lastInput.attributes.date;
	let nextDate = DateUtil.addDaysToDate(lastDate, 1);

	while (DateUtil.getDateObject(nextDate).isWeekend) {
		nextDate = DateUtil.addDaysToDate(nextDate, 1);
	}

	// POST for new Project time
	if (nextAction === 'repeat') {
		// not in the future
		if (DateUtil.getDateTime(nextDate) <= DateUtil.getDateTime(new Date())) {
			let projectName = projects.data.find(project => project.id === lastInput.attributes.project_id).attributes.name;
			nextDate = DateUtil.getDateTime(nextDate);

			// @TODO: Duplicated
			const answer = await inquirer.prompt([{
				message: `About to submit ${lastInput.attributes.duration_mins / 60}h to "${projectName}" on ${DateUtil.getNameOfDay(nextDate)} ${nextDate}`,
				type: "confirm",
				name: "confirm",
				default: false
			}]);

			if (answer.confirm) {
				const data = {
					"data": {
						"attributes": {
							"project_id": lastInput.attributes.project_id,
							"user_id": userData.data.id,
							"date": nextDate,
							"duration_mins": lastInput.attributes.duration_mins,
						},
						"type": "project-times"
					}
				};

				// @TODO: this should maybe handle if the next day is a record already, to PATCH too...
				// Not sure but the server check could just be if there is a record for a project-to-user-to-date
				// so could check the same on client, provided we have sufficient info,
				// maybe we get more dates ahead of time?
				let res;
				try {
					res = await post("/project-times", data);

					handleProjectTimesPostResponse(res)
				} catch(e) {
					console.log(e);
				}
			}
		} else {
			// could probably do that before I even ask if you wanna do anything
			console.log(chalk.cyan("No more recent dates before today found to enter 👌"));
		}
	} else if (nextAction === 'edit') {
		const nextActionParams = await inquirer.prompt([
			{
				message: "Select a project",
				type: "autocomplete",
				name: "project_id",
				default: lastInput.attributes.project_id,
				source: (answers, input = "") => {
					const filteredProjects = fuzzy.filter(input, projects.data, {
						extract: project => project.attributes.name
					});

					return new Promise(resolve => {
						resolve(filteredProjects.map(project => {
							// @TODO: why the fuck is this different...! FUZZYYYY!!!
							return {
								name: project.original ? project.original.attributes.name : project.attributes.name,
								value: project.original ? project.original.id : project.id
							};
						}));
					});
				}
			},
			{
				message: "Duration",
				type: "list",
				name: "duration_mins",
				default: lastInput.attributes.duration_mins + "",
				choices: [
					{ name: "1h", value: "60" },
					{ name: "2h", value: "120" },
					{ name: "3h", value: "180" },
					{ name: "4h", value: "240" },
					{ name: "5h", value: "300" },
					{ name: "6h", value: "360" },
					{ name: "7h", value: "420" }
				]
			}
		]);

		// @TODO: Could combine this prompt with previous one, with dynamic prompts?
		let projectName = projects.data.find(project => project.id === nextActionParams.project_id).attributes.name;
		const answer = await inquirer.prompt([{
			message: `About to submit ${nextActionParams.duration_mins / 60}h to "${projectName}" on ${DateUtil.getNameOfDay(nextDate)} ${DateUtil.getDateTime(nextDate)}`,
			type: "confirm",
			name: "confirm",
			default: false
		}]);

		if (answer.confirm) {
			const data = {
				"data": {
					"attributes": {
						"project_id": nextActionParams.project_id,
						"user_id": userData.data.id,
						"date": nextDate,
						"duration_mins": nextActionParams.duration_mins,
					},
					"type": "project-times"
				}
			};

			// @TODO: Error handling here too!!!
			let res = await post("/project-times", data);

			handleProjectTimesPostResponse(res);
		}
	}

	// POST: Create project time, time in minutes 420min -> 7h
	// curl 'https://api.dev.justinapp.io/v1/project-times' -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'content-type: application/vnd.api+json' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-18' --data-binary '{"data":{"attributes":{"project_id":"baa95e34-4008-4915-99ea-e5cde907b65c","user_id":"29e5bf60-f1c9-402b-a366-52afacc6765a","date":"2017-12-20","duration_mins":420,"approved_at":null,"created_at":null,"updated_at":null,"is_rejected":false},"type":"project-times"}}' --compressed

	// PATCH: update a project time...
	// curl 'https://api.dev.justinapp.io/v1/project-times/27bf79ca-a185-4fa7-9e20-5346149bae92' -X PATCH -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'content-type: application/vnd.api+json' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-18' --data-binary '{"data":{"id":"27bf79ca-a185-4fa7-9e20-5346149bae92","attributes":{"project_id":"baa95e34-4008-4915-99ea-e5cde907b65c","user_id":"29e5bf60-f1c9-402b-a366-52afacc6765a","date":"2017-12-20","duration_mins":300,"approved_at":null,"created_at":"2017-12-29T01:31:18.000Z","updated_at":"2017-12-29T01:31:18.000Z","is_rejected":false},"relationships":{"rejections":{"data":[]}},"type":"project-times"}}' --compressed

	/*
	const data = {
		"data": {
			"attributes": {
				// "approved_at": null,
				// "created_at": "2017-12-29T01:31:18.000Z",
				// "date": "2017-12-20",
				"duration_mins": 0,
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

	const res = await post("/project-times/649055cb-aa8d-4c26-9762-898c498182b1", data, "PATCH");
	// console.log(res);
	//*/

	// DELETE project-times
	// curl 'https://api.dev.justinapp.io/v1/project-times/108ba53d-afdb-4aa4-9e8b-a331ac9fa48a' -X DELETE -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-25' --compressed
}

main();
