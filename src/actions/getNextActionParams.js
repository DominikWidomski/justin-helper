const inquirer = require('inquirer');
const fuzzy = require('fuzzy');

const composeName = (project, lastInput) => {
	const attributes = project.original ? project.original.attributes : project.attributes;
	const isEnded = new Date(attributes.end_date) < new Date(lastInput.attributes.date);

	return `${attributes.name} ${isEnded ? '[ended]' : '' }`;
}

module.exports = getNextActionParams = async (lastInput, projects) => {
	return await inquirer.prompt([
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
							name: composeName(project, lastInput),
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
};