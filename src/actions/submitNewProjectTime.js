/* @flow */

const inquirer = require('inquirer');

const DateUtil = require('../utils/date');

import type JustinClient from '../justin/JustinClient';

function showSuccessfulSubmissionResponse(res, projects) {
	const {
		duration_mins, project_id, date
	} = res.data.attributes;
	
	const projectName = projects.data.find(project => project.id === project_id).attributes.name;
	
	process.stdout.write(`Submitted ${duration_mins / 60} to ${projectName} on ${DateUtil.getNameOfDay(date)} ${date}`);
}

/**
 * Submits a new projectTime to Justin, handles prompt to confirm.
 *
 * @TODO: Refactor this API... jeeeez
 */
export default async function submitNewProjectTime(
	justin: JustinClient,
	date: string,
	attributes: Object,
	userId: string,
	projects: Object
) {
	const projectName = projects.data.find(project => project.id === attributes.project_id).attributes.name;
	date = DateUtil.getDateTime(date);

	const answer = await inquirer.prompt([{
		message: `About to submit ${attributes.duration_mins / 60}h to "${projectName}" on ${DateUtil.getNameOfDay(date)} ${date}`,
		type: "confirm",
		name: "confirm",
		default: false
	}]);

	if (answer.confirm) {
		const data = {
			"data": {
				"attributes": {
					"project_id": attributes.project_id,
					"user_id": userId,
					date,
					"duration_mins": attributes.duration_mins,
				},
				"type": "project-times"
			}
		};

		// @TODO: this should maybe handle if the next day is a record already, to PATCH too...
		// Not sure but the server check could just be if there is a record for a project-to-user-to-date
		// so could check the same on client, provided we have sufficient info,
		// maybe we get more dates ahead of time?
		try {
			const res = await justin.post("/project-times", data);

			if (!res.errors) {
				showSuccessfulSubmissionResponse(res, projects);
				return res.data;
			}
		} catch(e) {
			console.log(e);
		}
	}
};