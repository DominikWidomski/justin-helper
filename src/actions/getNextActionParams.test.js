const bufferConsoleLog = require("./utils/consoleBuffer");
const mockStdin = require('mock-stdin');
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const getNextActionParams = require("./getNextActionParams");

if (!('describe' in global)) {
    global.describe = (description, fn) => fn();
    global.test = (description, fn) => fn();
    global.beforeEach = () => {};
    global.afterEach = () => {};
    global.expect = () => {};
}

// Thanks https://github.com/bahmutov/bdd-stdin/blob/master/index.js
const keys = Object.freeze({
    up: '\u001b[A',
    down: '\u001b[B',
    left: '\u001b[D',
    right: '\u001b[C',
    enter: '\n',
    space: ' '
});

// Originally found the https://github.com/neoziro/std-mocks/
// but wasn't really doing it for me, was easier to write new one
function mockStdoutWrite() {
    const config = {
        stripColors: true
    };
    
    const originalWrite = process.stdout.write;
    const buffer = [];

    process.stdout.write = function (data) {
        if ((typeof data === "string") && config.stripColors) {
            const exp = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
            data = data.replace(exp, '');
        }
        
        buffer.push(data);
    }

    return {
        restore: () => {
            process.stdout.write = originalWrite;
        },
        flush: () => buffer
    }
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
            // stdin = mockStdin.stdin();
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
            // jest.mock("inquirer", () => ({
            //     prompt: async (...options) => input => options
            // });
            const stdin = mockStdin.stdin();
            const wait = time => {
                return new Promise(resolve => setTimeout(resolve, time));
            }
            const waitTicks = (ticks, waitTime = 0) => {
                if (ticks > 0) {
                    process.nextTick(async () => {
                        console.log('Waiting', ticks, waitTime);
                        if (waitTime > 0) await wait(waitTime);
                        waitTicks(--ticks, waitTime);
                    })
                }
            };

            function mockInput() {
                process.nextTick(async function mockResponse() {
                    // await wait(1000);
                    stdin.send(keys.down);
                    stdin.send(keys.space);
                    // await wait(1000);
                    stdin.send(keys.down);
                    // await wait(1000);
                    stdin.send(keys.enter);
                });
            }

            // mockInput();

            // const _prompt = inquirer.prompt;
            // problem with the 1st inquirer.prompt question in this case is that it has a dynamic output, callback
            // so still have to call real prompt to trigger that functionality
            // inquirer.prompt = function (questions) {
                // if (false && questions.length === 1 && questions[0].name === 'all') {
                //     console.log('GONNA RESOLVE WITH ANSWER "one"');

                //     return new Promise(resolve => {
                //         setTimeout(function () {
                //             resolve({
                //                 [questions[0].name]: ['one']
                //             });
                //         }, 0);
                //     });

                //     return Promise.reject();
                // }

                // this is now just a pointless empty proxy
                // return new Promise(resolve => { 
                    // setTimeout(async function() {
                        // mockInput();
                        // process.nextTick(function mockResponse() {
                            // stdin.send('\u001b[B'); // down arrow
                            // stdin.send('\n');
                            // waitTicks(3, 2000);
                        // });
                        
                        // const ans = await _prompt(questions);
                        // resolve(ans);
                    // }, 0);
                // });
            // };
            
            const questionCheckbox = {
                type: 'checkbox',
                name: 'all',
                message: 'pick options',
                choices: ['one', 'two', 'three']
            };
            const questionList = {
                type: 'list',
                name: 'choice',
                message: 'pick third option',
                choices: ['one', 'two', 'three']
            };
            // const ans = await inquirer.prompt([questionList]);

            // console.log('ANSWER:', ans);
            
            let prompts = [];
            let output
            // prompt at the moment prevents stdout mock from capturing the output...
            // kinda would like both.
            // const originalPrompt = inquirer.prompt;
            // inquirer.prompt = function(...args) {
            //     prompts.push(args);
            //     // next the user chooses from available options
            //     // but something else would handle the output
            //     originalPrompt(...args);
            // };
            // const consoleLogBuffer = bufferConsoleLog(async () => {
                // const stdin = mockStdin.stdin();

                // process.nextTick(function mockResponse() {
                //     stdin.send('p');
                //     stdin.send('\n');
                // });
                process.nextTick(async function mockResponse() {
                    stdin.send(keys.up);
                    stdin.send(keys.up);
                    stdin.send(keys.enter);

                    process.nextTick(async function mockResponse() {
                        // TODO: inquirer autocomplete has source: async callback, gotta wait for it to update
                        // but there is probably a more correct way of doing that.
                        // i.e. wait for a promise to resolve somewhere to have the certainty
                        // TODO: Also, silence inquirer output
                        await wait(100); // TODO: It's like I need to wait here for inquirer to update
                        stdin.send('private');
                        await wait(100); // TODO: It's like I need to wait here for inquirer to update
                        stdin.send(keys.enter);
                    });
                });
                const answer = await getNextActionParams(projectTime, projects)
                console.log('ANSWERS:', answer);
            // });

            // expect(consoleLogBuffer).toMatchSnapshot();
            // expect(prompts).toMatchSnapshot();
            if (mock && mock.flush) { // temp
                expect(mock.flush()).toMatchSnapshot();
            }
        })
    })
})