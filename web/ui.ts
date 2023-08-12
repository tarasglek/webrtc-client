
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

function handleChange(pc: RTCPeerConnection) {
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

class RTC {
    pc: RTCPeerConnection;
    dc: RTCDataChannel;

    constructor() {
    }

    async createOffer() {
        const config = {
            iceServers: [
                {
                    urls: "stun:stun.1.google.com:19302",
                },
            ],
        };
        this.pc = new RTCPeerConnection(config);
        this.dc = this.pc.createDataChannel("chat", {
            negotiated: true,
            id: 0,
        });
        const dc = this.dc
        const pc = this.pc
        dc.onmessage = (e) => log(`${e.data}`);
        pc.oniceconnectionstatechange = (e) => log(pc.iceConnectionState);
        pc.onsignalingstatechange = () => {
            console.log(`onsignalingstatechange: signalingState: ${this.pc.signalingState}`);
        };
        pc.onconnectionstatechange = (ev) => handleChange(pc);
        pc.oniceconnectionstatechange = (ev) => handleChange(pc);

        await pc.setLocalDescription(await pc.createOffer());
        pc.onicecandidate = ({ candidate }) => {
            console.log(`[createOffer()] onicecandidate() signalingState: ${this.pc.signalingState} candidate: ${candidate}`);
            if (candidate) return;
            log(JSON.stringify(pc.localDescription));
        };
        handleChange(pc);

    }

    async handleInput(input) {
        // if got message and state is new, means message is offer from other node
        if (!this.pc) {
            await this.createOffer();
            return
        } else if (this.pc.connectionState != "connected") {
            if (this.pc.signalingState == "stable") {
                let offer = JSON.parse(input);

                console.log(`[pc.connectionState == "new"] prior to setRemoteDescription() signalingState: ${this.pc.signalingState}`);
                await this.pc.setRemoteDescription(offer);
                console.log(`[pc.connectionState == "new"] prior to setLocalDescription() signalingState: ${this.pc.signalingState}`);
                await this.pc.setLocalDescription(await this.pc.createAnswer());
                console.log(`setLocalDescription`);
                this.pc.onicecandidate = ({ candidate }) => {
                    console.log(`[pc.connectionState == "new"] onicecandidate() signalingState: ${this.pc.signalingState} candidate: ${candidate}`);
                    if (candidate) return;
                    const answer = this.pc.localDescription;
                    log(JSON.stringify(answer));
                };
            } else if (this.pc.signalingState == "have-local-offer") {
                const answer = JSON.parse(input);
                console.log(`[pc.connectionState == "connecting"] prior to setRemoteDescription() signalingState: ${this.pc.signalingState}`);
                // pc.setRemoteDescription(answer);
                await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`[pc.connectionState == "connecting"] prior to createAnswer() signalingState: ${this.pc.signalingState}`);
                // await pc.createAnswer().then(answer => pc.setLocalDescription(answer));
            }
            return
        }
        this.dc.send(input);
    }
}

const rtc = new RTC()

// handleInput("offer")
chat.onkeypress = async function (e) {
    if (e.keyCode != 13) return;
    rtc.handleInput(chat.value);
    chat.value = "";
};