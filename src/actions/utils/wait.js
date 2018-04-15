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

module.exports = { wait, waitTicks };