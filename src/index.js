/* @flow */

require('dotenv').config()

console.log("I AM IN: ", __dirname);

const inquirer = require('inquirer');
const chalk = require('chalk');
const fuzzy = require('fuzzy');
const DateUtil = require("./utils/date");

import JustinClient from "./justin/JustinClient";
// TODO: Can use `import` here instead of `.default`
import submitNewProjectTime from './actions/submitNewProjectTime';
import showWeekTable from './actions/showWeekTable';
import getNextActionParams from './actions/getNextActionParams';

import type { JustinResponse, Project, ProjectTime } from "./types.js";

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

const fullDayHours = 7;
const fullDayMinutes = 60 * fullDayHours;

async function main() {
	await justin.authenticate(process.env.email || '', process.env.password || '');
	const userData = await justin.getUser(justin.tokenData['user_id']);

	const answers = await inquirer.prompt([{
		message: `Is this you: ${userData.data.id} ${userData.data.attributes.name}`,
		type: "confirm",
		name: "confirmIdentity",
	}]);
	
	// Without explicitly typing this `const` I get:
	// 	Promise (This type is incompatible with the expected param type of union: `Promise` | `T`
	// 	Member 1: Promise Error: property `attributes` Property cannot be accessed on possibly undefined value
	// 	Member 2: T Error: property `data` Property not found in Promise)
	const projects: JustinResponse<Project[]> = await justin.getProjects();

	// GET project-times to check 
	// https://api.dev.justinapp.io/v1/project-times?filter%5Buser_id%5D=29e5bf60-f1c9-402b-a366-52afacc6765a&filter%5Bdate%3Astart%5D=2017-12-25&filter%5Bdate%3Aend%5D=2017-12-30&include=rejections

	let weekBeginning = DateUtil.getDateTime(DateUtil.getStartOfWeek(new Date()));
	let weekEnding = DateUtil.getDateTime(DateUtil.addDaysToDate(weekBeginning, 6));
	let lookEarlier = true;
	// @TODO: Store all retrieved projectTimes in a cache, handle only a week at a time
	let projectTimes = [];

	const getProjectTimes = (userId: string, weekBeginning: string, weekEnding: string) => {
		return justin.getProjectTimes({
			user_id: userData.data.id,
			'date:start': weekBeginning,
			'date:end': weekEnding
		}, ['rejections']);
	}

	/**
	 * Groups two arrays of ProjectTime query response data and sorts them by date
	 */
	function resolveOrderedProjectTimes(oldCollection = [], newCollection = []): ProjectTime[] {
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
	 */
	const getLastProjectTime = (projectTimes: Array<ProjectTime>): ProjectTime => {
		return projectTimes
			.sort((a, b) => new Date(b.attributes.date) - new Date(a.attributes.date))
			.filter(projectTime => projectTime.attributes.duration_mins > 0)[0];
	}

	const totalTimeForDate = (projectTimes, date) => {
		return projectTimes.filter((time, index, array) => {
			return time.attributes.date === DateUtil.getDateTime(date)
		}).reduce((total, time) => total + parseInt(time.attributes.duration_mins), 0)
	}

	// ask if you'd like to repeat it
	/**
	 * Inquire user's next input based on last input
	 *
	 * @param {object} lastInput
	 *
	 * @return {object}
	 */
	const queryNextAction = async (lastInput, projectTimes) => {
		const isFullDay = totalTimeForDate(projectTimes, lastInput.attributes.date) >= fullDayMinutes;
		const { date, duration_mins, project_id } = lastInput.attributes;
		const project = projects.data.find(project => project.id === project_id);
		const projectName = project && project.attributes.name;

		const choices = [
			{ key: 'r', name: "Repeat, do the same on next day", value: 'repeat' },
			{ key: 'n', name: "Nothing", value: 'nothing' },
			{ key: 'e', name: "Edit before submitting next day", value: 'edit' },
			{ key: 'd', name: "Delete last time", value: 'delete' }
		];

		if (!isFullDay) {
			choices.push({ key: 'c', name: 'Continue day', value: 'continue' });
		}
		
		const query = await inquirer.prompt([{
			message: `Most recent: ${[ DateUtil.getNameOfDay(date), date, projectName, duration_mins / 60 + 'h' ].join(', ')}. What do?`,
			type: "expand",
			name: "nextAction",
			choices
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
		let actedDate = nextDate;

		while (DateUtil.getDateObject(nextDate).isWeekend) {
			nextDate = DateUtil.addDaysToDate(nextDate, 1);
		}

		const action = await queryNextAction(lastInput, projectTimes);
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
		} else if (action === 'continue') {
			const totalTime = totalTimeForDate(projectTimes, lastInput.attributes.date);
			const nextActionParams = await getNextActionParams(lastInput, projects, {
				maxMinutes: fullDayMinutes - totalTime
			});

			const newProjectTime = await submitNewProjectTime(justin, lastDate, nextActionParams, userData.data.id, projects);
			if (newProjectTime) {
				projectTimes = resolveOrderedProjectTimes(projectTimes, [newProjectTime]);
			}
			actedDate = lastDate;
		} else if (action === 'delete') {
			// https://github.com/Microsoft/vscode/issues/5214
			// https://github.com/facebook/flow/issues/1853
			// ->>> LEFT HERE
			const lastTime = projectTimes.sort((a, b) => new Date(a.attributes.date) - new Date(b.attributes.date))[projectTimes.length - 1];

			// TODO: this is duplicated several times also in other files, could be a util or something
			const project = projects.data.find(project => project.id === lastTime.attributes.project_id)
			const projectName = project ? project.attributes.name : '';
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

			actedDate = DateUtil.getDateObject(lastTime.attributes.date);
		}

		// TODO: CHECK IF DAY IS COMPLETE
		// ASK IF WANTS TO MOVE TO NEXT DAY

		// const totalCurrentDateTime = totalTimeForDate(projectTimes, nextDate);

		// if (totalCurrentDateTime < fullDayMinutes) {
		// 	console.log(`${(fullDayMinutes - totalCurrentDateTime) / 60}h left in the day.`);
		// 	// const answer = await inquirer.prompt([{
		// 	// 	message: `${(fullDayMinutes - totalCurrentDateTime) / 60}h left in the day.`,
		// 	// 	type: "confirm",
		// 	// 	name: "addMore",
		// 	// }]);
		// }

		// Refreshing projectTimes for current week
		// @TODO: get next week if we've moved on further
		nextDate = DateUtil.addDaysToDate(actedDate, 1);
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
