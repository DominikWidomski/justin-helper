const bufferConsoleLog = require("./utils/consoleBuffer");
const showWeekTable = require("./showWeekTable");

describe("actions", () => {    
    describe("showWeekTable", () => {
        test("default", () => {
            // There's a thing with Jest where I can customise the snapshot output right???
            // Check out the snapshot diffs thing
            expect(bufferConsoleLog(showWeekTable)).toMatchSnapshot();
        });

        test("single project", () => {
            const projectTimes = [{
                id: 1,
                attributes: {
                    user_id: '1',
                    project_id: '1',
                    date: '2018-01-01',
                    duration_mins: '420',
                    is_rejected: 'false'
                },
            }];

            const projects = {
                data: [{
                    id: '1',
                    attributes: {
                        name: 'project',
                    }
                }]
            };

            const options = {
                startDate: '2018-01-01',
                endDate: '2018-01-02'
            };

            expect(bufferConsoleLog(showWeekTable, projectTimes, projects, options)).toMatchSnapshot();
        })

        test("multiple times in a day", () => {
            const projectTimes = [{
                id: 1,
                attributes: {
                    user_id: '1',
                    project_id: '1',
                    date: '2018-01-01',
                    duration_mins: '300',
                    is_rejected: 'false'
                },
            }, {
                id: 2,
                attributes: {
                    user_id: '1',
                    project_id: '2',
                    date: '2018-01-01',
                    duration_mins: '120',
                    is_rejected: 'false'
                },
            }];

            const projects = {
                data: [{
                    id: '1',
                    attributes: {
                        name: 'project',
                    }
                }, {
                    id: '2',
                    attributes: {
                        name: 'project 2',
                    }
                }]
            };

            const options = {
                startDate: '2018-01-01',
                endDate: '2018-01-02'
            };

            expect(bufferConsoleLog(showWeekTable, projectTimes, projects, options)).toMatchSnapshot();
        })
    })
})