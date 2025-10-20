let taskId = 0;
let tasks = new Map();

let ttsWorker = new Worker("./speakWorker.js");

function play(text, options = {}, onend = () => {}, onstart = () => {}, signal = { aborted: false }) {
    let id = taskId++;
    tasks.set(id, { onstart, onend, signal });
    ttsWorker.postMessage({ id, text, options });
}

let speak = {
    play,
};

ttsWorker.addEventListener("message", async (e) => {
    let { id, wav } = e.data;
    let task = tasks.get(id);
    if(task.signal.aborted) {
        tasks.delete(id);
        return;
    }
    let audioCtx = new AudioContext();
    let buffer = await audioCtx.decodeAudioData(wav.buffer);
    let source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
    task.onstart(source); 
    source.addEventListener("ended", () => {
        task.onend();
        tasks.delete(id);
    });
});