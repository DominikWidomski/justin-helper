const bufferConsoleLog = require("./utils/consoleBuffer");
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

const inquirer = require('inquirer');

describe("actions", () => {    
    describe("getNextActionParams", () => {
        let mock;
        beforeEach(() => {
            mock = mockStdoutWrite();
        })

        afterEach(() => {
            mock.restore();
        })

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

            let prompts = [];
            let prompt;
            let output
            // prompt at the moment prevents stdout mock from capturing the output...
            // kinda would like both.
            // inquirer.prompt = function(...args) {
            //     prompts.push(args);
            //     // next the user chooses from available options
            //     // but something else would handle the output
            // };
            const buffer = bufferConsoleLog(async () => {
                getNextActionParams(projectTime, projects);
            });

            expect(buffer).toMatchSnapshot();
            expect(prompt).toMatchSnapshot();
            expect(prompts).toMatchSnapshot();
            expect(output).toMatchSnapshot();
            expect(mock.flush()).toMatchSnapshot();
        })
    })
})