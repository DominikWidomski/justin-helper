require('dotenv').config()

const inquirer = require('inquirer');
const chalk = require('chalk');
const fuzzy = require('fuzzy');
const DateUtil = require("./src/utils/date");

const JustinClient = require("./src/justin/JustinClient");
const submitNewProjectTime = require('./src/actions/submitNewProjectTime');
const showWeekTable = require('./src/actions/showWeekTable');
const getNextActionParams = require('./src/actions/getNextActionParams');

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
  });

const justin = new JustinClient({
	basePath: process.env.API_BASE_PATH,
	appToken: process.env.APP_TOKEN
});

async function main() {
	await justin.authenticate(process.env.email, process.env.password);
	const userData = await justin.getUser(justin.tokenData['user_id']);

	const answers = await inquirer.prompt([{
		message: `Is this you: ${userData.data.id} ${userData.data.attributes.name}`,
		type: "confirm",
		name: "confirmIdentity",
	}]);
	
	const projects = await justin.getProjects();

	// GET project-times to check 
	// https://api.dev.justinapp.io/v1/project-times?filter%5Buser_id%5D=29e5bf60-f1c9-402b-a366-52afacc6765a&filter%5Bdate%3Astart%5D=2017-12-25&filter%5Bdate%3Aend%5D=2017-12-30&include=rejections

	let weekBeginning = DateUtil.getDateTime(DateUtil.getStartOfWeek(new Date()));
	let weekEnding = DateUtil.getDateTime(DateUtil.addDaysToDate(weekBeginning, 6));
	let lookEarlier = true;
	// @TODO: Store all retrieved projectTimes in a cache, handle only a week at a time
	let projectTimes = [];

	const getProjectTimes = (userId, weekBeginning, weekEnding) => {
		return justin.getProjectTimes({
			user_id: userData.data.id,
			'date:start': weekBeginning,
			'date:end': weekEnding
		}, ['rejections']);
	}

	/**
	 * Groups two arrays of ProjectTime query response data and sorts them by date
	 * 
	 * @param {Array} oldCollection 
	 * @param {Array} newCollection
	 * 
	 * @returns {Array}
	 */
	function resolveOrderedProjectTimes(oldCollection = [], newCollection = []) {
		const seen = {};
		
		const data = [...oldCollection, ...newCollection]
			.filter(a => seen[a.id] ? false : (seen[a.id] = true))
			.sort((a, b) => new Date(a.attributes.date) - new Date(b.attributes.date));
		
		return data;
	}

	while (lookEarlier) {
		console.log("Week:", weekBeginning, weekEnding);

		const thisWeek = await getProjectTimes(userData.data.id, weekBeginning, weekEnding);
		const result = await inquirer.prompt([{
			type: "confirm",
			name: "lookEarlier",
			// if found times, stay in this week, otherwise move further back
			default: thisWeek.meta.total ? false : true,
			message: `Found ${thisWeek.meta.total} dates for this week. Look earlier?`
		}]);	

		projectTimes = resolveOrderedProjectTimes(projectTimes, thisWeek.data);

		({ lookEarlier } = result);
		if (lookEarlier) {
			weekBeginning = DateUtil.getDateTime(DateUtil.addDaysToDate(weekBeginning, -7));
			weekEnding = DateUtil.getDateTime(DateUtil.addDaysToDate(weekBeginning, 6));
		}
	}

	/**
	 * Retrieves the last chronologically projectTime with non-zero time entry
	 *
	 * @param {object} projectTimes
	 *
	 * @return {object}
	 */
	const getLastProjectTime = (projectTimes) => {
		return projectTimes
			.sort((a, b) => new Date(a.attributes.date) < new Date(b.attributes.date))
			.filter(projectTime => projectTime.attributes.duration_mins > 0)[0];
	}

	// ask if you'd like to repeat it
	/**
	 * Inquire user's next input based on last input
	 *
	 * @param {object} lastInput
	 *
	 * @return {object}
	 */
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
				{ key: 'e', name: "Edit", value: 'edit' },
				{ key: 'd', name: "Delete last time", value: 'delete' }
			]
		}]);

		return query.nextAction;
	}

	//========================================

	let nextAction = {
		type: "checkNext",
		showWeek: true
	};

	while (nextAction.type !== "exit") {
		if (nextAction.showWeek) {
			showWeekTable(projectTimes, projects, {
				startDate: weekBeginning,
				endDate: weekEnding
			});
		}

		// get last input - project date and time
		const lastInput = getLastProjectTime(projectTimes);

		const lastDate = lastInput.attributes.date;
		let nextDate = DateUtil.addDaysToDate(lastDate, 1);

		while (DateUtil.getDateObject(nextDate).isWeekend) {
			nextDate = DateUtil.addDaysToDate(nextDate, 1);
		}

		const action = await queryNextAction(lastInput);
		// POST for new Project time
		// @TODO: Unify with the { type: string } type
		if (action === 'repeat') {
			// not in the future
			if (DateUtil.getDateTime(nextDate) <= DateUtil.getDateTime(new Date())) {
				await submitNewProjectTime(justin, nextDate, lastInput.attributes, userData.data.id, projects);
			} else {
				// could probably do that before I even ask if you wanna do anything
				console.log(chalk.cyan("No more recent dates before today found to enter 👌"));
			}
		} else if (action === 'edit') {
			const nextActionParams = await getNextActionParams(lastInput, projects);

			// @TODO: If reply No, should try to get params again?
			// @TODO: Could combine this prompt with previous one, with dynamic prompts?
			// @TODO: Check if time exists, maybe try, and edit if it does
			const newProjectTime = await submitNewProjectTime(justin, nextDate, nextActionParams, userData.data.id, projects);
			if (newProjectTime) {
				projectTimes = resolveOrderedProjectTimes(projectTimes, [newProjectTime]);
			}
		} else if (action === 'delete') {
			const lastTime = projectTimes.sort((a, b) => new Date(a.attributes.date) - new Date(b.attributes.date))[projectTimes.length - 1];

			const projectName = projects.data.find(project => project.id === lastTime.attributes.project_id).attributes.name;
			const approved = lastTime.attributes.approved_at ? true : false;
			const message = `Deleting ${lastTime.attributes.duration_mins / 60}h on ${lastTime.attributes.date} for ${projectName} ${approved ? "[APPROVED]" : ""}`;
			
			const result = await inquirer.prompt([{
				type: "confirm",
				name: "continue",
				// if found times, stay in this week, otherwise move further back
				default: !approved,
				message
			}]);

			if (result.continue) {
				await justin.deleteProjectTime(lastTime.id);
				projectTimes = projectTimes.filter(a => a.id !== lastTime.id);
			}
		}

		// Refreshing projectTimes for current week
		// @TODO: get next week if we've moved on further
		nextDate = DateUtil.addDaysToDate(nextDate, 1);
		const isCurrentWeek = nextDate >= new Date(weekBeginning) && nextDate <= new Date(weekEnding);
		if (!isCurrentWeek) {
			weekBeginning = DateUtil.getStartOfWeek(nextDate);
			weekEnding = DateUtil.addDaysToDate(weekBeginning, 6);
		}
		try	{
			const newProjectTimes = (await getProjectTimes(userData.data.id, weekBeginning, weekEnding)).data;
			projectTimes = resolveOrderedProjectTimes(projectTimes, newProjectTimes);
		} catch (e) {
			console.log(e);
		}

		nextAction = {
			type: "checkNext",
			showWeek: true
		};
	}

	// POST: Create project time, time in minutes 420min -> 7h
	// curl 'https://api.dev.justinapp.io/v1/project-times' -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'content-type: application/vnd.api+json' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-18' --data-binary '{"data":{"attributes":{"project_id":"baa95e34-4008-4915-99ea-e5cde907b65c","user_id":"29e5bf60-f1c9-402b-a366-52afacc6765a","date":"2017-12-20","duration_mins":420,"approved_at":null,"created_at":null,"updated_at":null,"is_rejected":false},"type":"project-times"}}' --compressed

	// PATCH: update a project time...
	// curl 'https://api.dev.justinapp.io/v1/project-times/27bf79ca-a185-4fa7-9e20-5346149bae92' -X PATCH -H 'pragma: no-cache' -H 'origin: https://dev.justinapp.io' -H 'accept-encoding: gzip, deflate, br' -H 'accept-language: en-GB,en;q=0.9,en-US;q=0.8,pl;q=0.7,de;q=0.6' -H 'authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIyOWU1YmY2MC1mMWM5LTQwMmItYTM2Ni01MmFmYWNjNjc2NWEiLCJpc3MiOiJodHRwczovL2FwaS5kZXYuanVzdGluYXBwLmlvL3YxL2F1dGgiLCJpYXQiOjE1MTM2ODExNzMsImV4cCI6MTUxNDg5MDc3MywibmJmIjoxNTEzNjgxMTczLCJqdGkiOiJJY2tmM09XU0ZIVTA1UUpxIiwidXNlcl9pZCI6IjI5ZTViZjYwLWYxYzktNDAyYi1hMzY2LTUyYWZhY2M2NzY1YSJ9.laOXBJjy-f-5Cc5h0u9KDHuvu77BWdwdhy5LdRdA18M' -H 'content-type: application/vnd.api+json' -H 'accept: application/vnd.api+json' -H 'cache-control: no-cache' -H 'authority: api.dev.justinapp.io' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36' -H 'referer: https://dev.justinapp.io/times/2017-12-18' --data-binary '{"data":{"id":"27bf79ca-a185-4fa7-9e20-5346149bae92","attributes":{"project_id":"baa95e34-4008-4915-99ea-e5cde907b65c","user_id":"29e5bf60-f1c9-402b-a366-52afacc6765a","date":"2017-12-20","duration_mins":300,"approved_at":null,"created_at":"2017-12-29T01:31:18.000Z","updated_at":"2017-12-29T01:31:18.000Z","is_rejected":false},"relationships":{"rejections":{"data":[]}},"type":"project-times"}}' --compressed

	/*
	const data = {
		"data": {€
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
}

main();
