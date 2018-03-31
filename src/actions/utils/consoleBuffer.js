// I'm thinking this thing would need to handle out of order, async, logging into the buffer.
// WeakMap of functions (new anonymous function inside the util) or something that gets
// the buffer specifically only for that execution. Not sure how yet because it's a global replace
// this is so that tests can run independently of each other I guess, in parallel, although not sure Jest does that anyway.
// perhaps the global thing can lookup the thing calling it?... seems flaky with JS.
// one sure thing would be to inject the console dep I guess... 🤔
const bufferConsoleLog = (fn, ...args) => {
    const consoleLog = global.console.log;
    const config = {
        stripColors: true
    };
    let buffer = '';

    global.console.log = function makeCaptureConsoleLogFunc(args) {
        if ((typeof args === "string") && config.stripColors) {
            // Thanks https://stackoverflow.com/a/29497680
            // There's a module for this: strip-ansi
            const exp = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
            args = args.replace(exp, '');
        }
    
        buffer += '\n' + args;
    };
    
    fn(...args);

    global.console.log = consoleLog;

    return buffer + '\n';
}

export default bufferConsoleLog;