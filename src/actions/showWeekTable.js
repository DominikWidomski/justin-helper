/* @flow */

const Table = require('cli-table2');
const DateUtil = require("../utils/date");

import type { ProjectTime } from "../types.js";

type showWeekTableOptionsType = {
	startDate: string | Date,
	endDate: string | Date
};

/**
 * Renders a table describing an array of projectTime objects
 *
 * @TODO: Render several projects for the day (don't show day name multiple times)
 * @TODO: Fix projectTimes type to be more accurate and specific
 */
const showWeekTable = (projectTimes: any, projects: Object, options: showWeekTableOptionsType) => {
	const table = new Table({
	    head: ['Day', 'Date', 'Project', 'Time']
	});

	options.startDate = new Date(options.startDate);
	options.endDate = new Date(options.endDate);
	
	// Sort chronologically
	projectTimes
		.sort((a, b) => new Date(a.attributes.date) > new Date(b.attributes.date))
		.filter(time => {
			const date = new Date(time.attributes.date);
			return date >= options.startDate && date <= options.endDate;
		})
		.forEach((projectTime, index, arr) => {
			const { date, duration_mins, project_id } = projectTime.attributes;
			const projectName = projects.data.find(project => project.id === project_id).attributes.name;
			const firstOfProject = index === 0 || arr[index].attributes.date !== arr[index - 1].attributes.date;

			table.push([ firstOfProject ? DateUtil.getNameOfDay(date) : '', date, projectName, duration_mins / 60 ]);
		});

	console.log(table.toString());
};

export default showWeekTable;