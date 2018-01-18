const MockFetch = require("../http/mockFetch");

module.exports = () => {
    const mock = new MockFetch();

    mock.respondTo("GET", "https://api.dev.justinapp.io/v1/users/29e5bf60-f1c9-402b-a366-52afacc6765a", {
        data: {
            id: "123456",
            attributes: {
                name: 'Test User'
            }
        }
    });

    mock.respondTo("GET", "https://api.dev.justinapp.io/v1/projects", {
        data: [
            {
                id: 1,
                attributes: {
                    name: 'Fake Project 1'
                }
            }
        ]
    });

    mock.respondTo("GET", "https://api.dev.justinapp.io/v1/project-times", {
        data: [
            {
                id: 1,
                attributes: {
                    project_id: 1,
                    date: '2018-01-01',
                    duration_mins: '420'
                }
            }
        ]
    });

    return mock.fetch.bind(mock);
};