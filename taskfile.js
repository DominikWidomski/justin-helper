const { join } = require('path');

const paths = {
    build: 'build',
    source: 'src',
    sourceWatch: 'src/**/*.js',
    sourceRoot: join(__dirname, 'src'),
};

module.exports = {
    *default(task) {
        yield task.start('scripts');
        yield task.watch(paths.sourceWatch, 'scripts');
    },
    *clear(task) {
        yield task.clear(paths.build);
    },
    *scripts(task) {
        // yield task.source(paths.source).babel().target(`${paths.build}/src`);
        yield task.source(paths.sourceWatch).babel().target(paths.build);
    }
}