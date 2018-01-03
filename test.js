const inquirer = require('inquirer');

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
  });

inquirer.registerPrompt('test', require('./customPrompt'));


inquirer.prompt([{
	message: "Select a project",
	type: "test",
	name: "project_id",
	choices: ['a', 'b']
}]).then(function() { console.log("CALLBACK:", arguments) });