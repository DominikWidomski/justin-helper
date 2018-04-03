const bufferConsoleLog = require("./utils/consoleBuffer");
const mockStdin = require('mock-stdin');
const inquirer = require('inquirer');
const getNextActionParams = require("./getNextActionParams");

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
    data: [{
        id: '1',
        attributes: {
            name: 'project',
        }
    }]
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
            // jest.mock("inquirer", () => {
            //     console.log('mocking')
                
            //     return {
            //         prompt: async (...options) => {
            //             console.log('inside mock');
            
            //             // response
            //             return input => {
            //                 return options;
            //             };
            //         }
            //     }
            // });

            const stdin = mockStdin.stdin();
            process.nextTick(function mockResponse() {
                stdin.send('\u001b[B');
                stdin.send('\n');
            });

            var question = {
                type: 'list',
                name: 'choice',
                message: 'pick three',
                choices: ['one', 'two', 'three']
            };
            const _prompt = inquirer.prompt;
            // problem with the 1st inquirer.prompt question in this case is that it has a dynamic output, callback
            // so still have to call real prompt to trigger that functionality
            inquirer.prompt = function (questions, cb) {
                console.log('question');
                if (questions.length === 1 &&
                  questions[0].name === 'all') {
                  setTimeout(function () {
                    cb({
                      all: ['one']
                    });
                  }, 0);
                  return;
                }
          
                setTimeout(function () {
                  _prompt(question, cb);
                }, 0);
            };
            
            inquirer.prompt([{
                type: 'checkbox',
                name: 'all',
                message: 'pick options',
                choices: ['one', 'two', 'three']
            }], function (answers) {
                console.log('user picked', answers.choice);
            });
            
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
                // const answer = await getNextActionParams(projectTime, projects)
                // console.log('prompt out:', answer);
            // });

            // expect(consoleLogBuffer).toMatchSnapshot();
            // expect(prompts).toMatchSnapshot();
            expect(mock.flush()).toMatchSnapshot();
        })
    })
})