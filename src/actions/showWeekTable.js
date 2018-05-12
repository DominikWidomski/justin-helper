/* @flow */

const Table = require('cli-table2');
const DateUtil = require("../utils/date");

import type { ProjectTime, Project, JustinResponse } from "../types.js";

type showWeekTableOptionsType = {
	startDate: string | Date,
	endDate: string | Date
};

// There was the idea of a .sandbox.js file...
// this file should allow me to test the input/output of the action in silo
// https://www.youtube.com/watch?v=aL6SouuO0_k
// I think in the video it's doing stuff over the network but I'd like to do it just locally, and mock things.
// And I don't like explicit dependency injection as much, for things like fetch, client etc.
// I'd like to be able to use the module without specifically structuring it for all that depencency injection
// but come to think of it, maybe the only thing I'd need to inject is the Justin client, as that potentially holds state, so that's reasonable.
// and we do exactly that in LBX I think.
// And perhaps I can use that for snapshot test source etc.

const showWeekTable = (
	projectTimes: ProjectTime[] = [],
	projects: JustinResponse<Project[]>,
	options: showWeekTableOptionsType = {startDate: '', endDate: ''}
) => {

	// TODO: Add a week heading before those headings, colspan: 4
	// Vertically span columns for same day
	const table = new Table({
	    head: ['Day', 'Date', 'Project', 'Time']
	});

	options.startDate = new Date(options.startDate);
	options.endDate = new Date(options.endDate);
	
	// Sort chronologically
	projectTimes 
		.sort((a, b) => new Date(a.attributes.date) - new Date(b.attributes.date))
		.filter(time => {
			const date = new Date(time.attributes.date);
			return new Date(date) >= new Date(options.startDate) && new Date(date) <= new Date(options.endDate);
		})
		.forEach((projectTime, index, arr) => {
			const { date, duration_mins, project_id } = projectTime.attributes;
			const project = projects.data.find(project => project.id === project_id);
			const projectName = project ? project.attributes.name : 'n/a';
			const firstOfProject = index === 0 || arr[index].attributes.date !== arr[index - 1].attributes.date;

			table.push([
				firstOfProject ? DateUtil.getNameOfDay(date) : '',
				firstOfProject ? date : '',
				projectName,
				duration_mins / 60
			]);
		});

	console.log(table.toString());
};

export default showWeekTable;