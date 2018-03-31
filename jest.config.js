module.exports = {
    "name": "Justin CLI",
    "testEnvironment": "node",
    "testPathIgnorePatterns": ["/node_modules/", "<rootDir>/build/"],
    "transform": {
        "^.+\\.jsx?$": "babel-jest"
    },
    "watchPathIgnorePatterns": [
        "<rootDir>/build/"
    ]
};