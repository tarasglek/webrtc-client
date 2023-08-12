
const chat = document.getElementById("chat");
const output = document.getElementById("output");

// const log = msg => output.innerHTML += `<br>${msg}`;
// append textarea for every message
const log = (msg) => {
    console.log(msg);
    let textarea = document.createElement("textarea");
    // make it full with and 3 rows
    // calculate number of lines in msg or max of strlen/80
    // calc number of chars that fits on screen
    let chars_per_line = Math.floor(window.innerWidth / 8);
    let lines = Math.max(Math.ceil(msg.length / chars_per_line), msg.split(/\r\n|\r|\n/).length);
    // log both
    console.log(`msg.length: ${msg.length} msg.split(/\r\n|\r|\n/).length: ${msg.split(/\r\n|\r|\n/).length} lines: ${lines}`);
    textarea.style = `width:100%;height:${lines + 1.2}em;`
    textarea.value = msg;
    output.appendChild(textarea);
    // output.appendChild(document.createElement('br'));
};
const config = {
    iceServers: [
        {
            urls: "stun:stun.1.google.com:19302",
        },
    ],
};

let pc = null
let dc = null

async function createOffer() {
    pc = new RTCPeerConnection(config);
    dc = pc.createDataChannel("chat", {
        negotiated: true,
        id: 0,
    });

    dc.onmessage = (e) => log(`${e.data}`);
    pc.oniceconnectionstatechange = (e) => log(pc.iceConnectionState);
    pc.onsignalingstatechange = () => {
        console.log(`onsignalingstatechange: signalingState: ${pc.signalingState}`);
    };
    pc.onconnectionstatechange = (ev) => handleChange();
    pc.oniceconnectionstatechange = (ev) => handleChange();

    button.disabled = true;
    await pc.setLocalDescription(await pc.createOffer());
    pc.onicecandidate = ({ candidate }) => {
        console.log(`[createOffer()] onicecandidate() signalingState: ${pc.signalingState} candidate: ${candidate}`);
        if (candidate) return;
        log(JSON.stringify(pc.localDescription));
    };
    handleChange();

}

async function handleInput(input) {
    // if got message and state is new, means message is offer from other node
    if (!pc) {
        await createOffer();
        return
    } else if (pc.connectionState != "connected") {
        if (pc.signalingState == "stable") {
            let offer = JSON.parse(input);

            console.log(`[pc.connectionState == "new"] prior to setRemoteDescription() signalingState: ${pc.signalingState}`);
            await pc.setRemoteDescription(offer);
            console.log(`[pc.connectionState == "new"] prior to setLocalDescription() signalingState: ${pc.signalingState}`);
            await pc.setLocalDescription(await pc.createAnswer());
            console.log(`setLocalDescription`);
            pc.onicecandidate = ({ candidate }) => {
                console.log(`[pc.connectionState == "new"] onicecandidate() signalingState: ${pc.signalingState} candidate: ${candidate}`);
                if (candidate) return;
                const answer = pc.localDescription;
                log(JSON.stringify(answer));
            };
        } else if (pc.signalingState == "have-local-offer") {
            const answer = JSON.parse(input);
            console.log(`[pc.connectionState == "connecting"] prior to setRemoteDescription() signalingState: ${pc.signalingState}`);
            // pc.setRemoteDescription(answer);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`[pc.connectionState == "connecting"] prior to createAnswer() signalingState: ${pc.signalingState}`);
            // await pc.createAnswer().then(answer => pc.setLocalDescription(answer));
        }
        return
    }
    dc.send(input);
}

chat.onkeypress = async function (e) {
    if (e.keyCode != 13) return;
    handleInput(chat.value);
    chat.value = "";
};


function handleChange() {
    let stat =
        "ConnectionState: <strong>" +
        pc.connectionState +
        "</strong> IceConnectionState: <strong>" +
        pc.iceConnectionState +
        "</strong>";
    document.getElementById("stat").innerHTML = stat;
    let msg =
        "%c" +
        new Date().toISOString() +
        ": ConnectionState: %c" +
        pc.connectionState +
        " %cIceConnectionState: %c" +
        pc.iceConnectionState;
    let colors = ["color:yellow", "color:orange", "color:yellow", "color:orange"];
    // add signalingState
    msg += " %csignalingState: %c" + pc.signalingState;
    colors.push("color:yellow", "color:orange");
    console.log(msg, ...colors);
}
handleInput("offer")
