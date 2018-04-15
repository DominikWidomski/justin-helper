// Originally found the https://github.com/neoziro/std-mocks/
// but wasn't really doing it for me, was easier to write new one
// I'm curious to Proxy the stdin to see how it clears the output to hook into that maybe
module.exports = function mockStdoutWrite() {
    const config = {
        stripColors: true
    };
    
    let lastFlushIndex = 0;
    const originalStdoutWrite = process.stdout.write;
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
            process.stdout.write = originalStdoutWrite;
        },
        // bypasses the capturing, useful for debugging
        debug: (...args) => originalStdoutWrite(...args), // this was working, but I think in conjunction with the console.log stuff it wasn't
        flushAll: () => buffer,
        flush: () => {
            const flushIndex = lastFlushIndex || 0;
            lastFlushIndex = buffer.length;

            return buffer.slice(flushIndex);
        }
    }
}