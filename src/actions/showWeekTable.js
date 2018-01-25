const Table = require('cli-table2');
const DateUtil = require("../utils/date");

/**
 * Renders a table describing an array of projectTime objects
 *
 * @TODO: Render several projects for the day (don't show day name multiple times)
 * 
 * @param {object} projectTimes
 * @param {object} projects
 */
module.exports = showWeekTable = (projectTimes, projects) => {
	const table = new Table({
	    head: ['Day', 'Date', 'Project', 'Time']
	});
	
	// Sort chronologically
	projectTimes.data
		.sort((a, b) => new Date(a.attributes.date) > new Date(b.attributes.date))
		.forEach(projectTime => {
			const { date, duration_mins, project_id } = projectTime.attributes;
			const projectName = projects.data.find(project => project.id === project_id).attributes.name;
			table.push([ DateUtil.getNameOfDay(date), date, projectName, duration_mins / 60 ]);
		});

	console.log(table.toString());
};