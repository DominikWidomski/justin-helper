const bufferConsoleLog = require("./utils/consoleBuffer");
const mockStdin = require('mock-stdin');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const keys = require('./utils/keys');
const mockStdoutWrite = require('./utils/mockStdout');
const { wait } = require('./utils/wait');
const getNextActionParams = require("./getNextActionParams");

if (!('describe' in global)) {
    global.describe = (description, fn) => fn();
    global.test = (description, fn) => fn();
    global.beforeEach = () => {};
    global.afterEach = () => {};
    global.expect = () => {};
}

const projectTime = {
    id: 1,
    attributes: {
        user_id: '1',
        project_id: '1',
        date: '2018-01-01',
        duration_mins: '420',
        is_rejected: 'false'
    },
};

const projects = {
    data: [
        {
            id: '1',
            attributes: {
                name: 'project',
            }
        }, {
            id: '2',
            attributes: {
                name: 'private project',
            }
        }
    ]
};

describe("actions", () => {    
    describe("getNextActionParams", () => {
        let mock;
        var stdin;

        beforeEach(() => {
            stdin = mockStdin.stdin();
            mock = mockStdoutWrite();
        })

        afterEach(() => {
            mock.restore();
        })

        /**
         * What I want this test to do is
         * to be able to run the action that asks for user input
         * and somehow simulate user input via stdin or by highjacking the prompt fully (not sure how viable this is as it doesn't do a callback in the action)
         * 
         * I think if the action had several separate prompts inside it that I'd want to interact with, I'd HAVE to simulate actual stdin,
         * as otherwise the function doesn't forfeit its control to the caller to be able to return to it at any certain step...
         * 
         * I'd like to be able to queue up some actions that would work across several prompts, several questions etc.
         * 
         * The final output or capture of the snapshots should include the prompts arguments, prompts in the console itself, and the final output of the action
         * The idea is that I can capture in snapshots the output to the user and to the application separately, imagine running the app with the `-f` or without `-i` flag
         * (whichever way) to have it run automatically, the user might not see output on screen from specific actions etc.
         */
        test("default", async () => {
            process.nextTick(async function mockResponse() {
                stdin.send(keys.up);
                // mock.flush() // checkpoint, next flush will be from here
                stdin.send(keys.up);
                // expect(mock.flush()).toMatchSnapshot(); // before 'ENTER', question one final state
                stdin.send(keys.enter);
                
                process.nextTick(async function mockResponse() {
                    // await wait(0); // this alows the thing to update, but not quite, sometimes it's not timed right                     

                    // TODO: inquirer autocomplete has source: async callback, gotta wait for it to update
                    // but there is probably a more correct way of doing that.
                    // i.e. wait for a promise to resolve somewhere to have the certainty
                    // TODO: Also, silence inquirer output
                    
                    // this is to try to capture only the settle down output of the question
                    // question one response
                    // expect(mock.flush()).toMatchSnapshot();
                    
                    await wait(100); // TODO: It's like I need to wait here for inquirer to update (async sources?)
                    stdin.send('private'); // TODO: ignore all the output while typing (a lot) and snapshot directly after input, and after confirming
                    await wait(100); // TODO: It's like I need to wait here for inquirer to update (async sources?)
                    stdin.send(keys.enter);

                    // TODO: Had a thought. Maybe it's cool to capture console output manually at certan points.
                    // literally do like buffer += stdOutMock.flush() or something.
                    // this is to capture the console output at certain points when we're expecting changes,
                    // not the whole thing while it's in flux.
                    // This would be alongside the general catch-all.
                });
            });
            const answer = await getNextActionParams(projectTime, projects);

            expect(mock.flush()).toMatchSnapshot();
            expect(answer).toMatchSnapshot();
        })
    })
})