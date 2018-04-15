const mockStdin = require('mock-stdin');
const keys = require('./utils/keys');
const mockStdoutWrite = require('./utils/mockStdout');
const submitNewProjectTime = require("./submitNewProjectTime");

describe("actions", () => {
    describe("submitNewProjectTime", () => {
        test("default", async () => {
            const stdin = mockStdin.stdin();
            const stdoutMock = mockStdoutWrite();
            const postHandler = jest.fn((url, { data }) => {
                return {
                    data: {
                        attributes: {
                            ...data.attributes,
                            name: "Project name"
                        }
                    }
                };
            });
            
            const client = {
                post: postHandler
            }
            
            const projectTime = {
                user_id: '1',
                project_id: '1',
                date: '2018-01-01',
                duration_mins: 420
            };

            const projects = {
                data: [{
                    id: '1',
                    attributes: {
                        name: 'project',
                    }
                }]
            };
            
            process.nextTick(() => {
                stdin.send('Y');
                stdin.send(keys.enter);
            });
            
            const answer = await submitNewProjectTime(client, '2018-01-02', projectTime, 1, projects);

            expect(postHandler.mock.calls).toMatchSnapshot();
            expect(stdoutMock.flush()).toMatchSnapshot();
            expect(answer).toMatchSnapshot();

            stdoutMock.restore();
        })
    })
})