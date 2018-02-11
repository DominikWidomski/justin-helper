const inquirer = require('inquirer');
const fuzzy = require('fuzzy');

const composeName = (project, lastInput) => {
	const attributes = project.original ? project.original.attributes : project.attributes;
	const isEnded = new Date(attributes.end_date) < new Date(lastInput.attributes.date);

	return `${attributes.name} ${isEnded ? '[ended]' : '' }`;
}

const getNextActionParams = async (lastInput, projects, options = {}) => {
	function makeChoices() {
		const choices = [];

		for	(let i = 1; i <= 7; ++i) {
			const mins = 60 * i;
			if (!options.maxMinutes || mins <= options.maxMinutes) {
				choices.push({ name: `${i}h`, value: ""+mins });
			}
		}

		return choices;
	}
	
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
			choices: makeChoices()
		}
	]);
};

export default getNextActionParams;