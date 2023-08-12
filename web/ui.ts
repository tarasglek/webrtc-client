
const chat = document.getElementById("chat");
const output = document.getElementById("output");
chat?.focus();
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
    return msg
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
    _onMessage_cb: Function | null = null;
    _onConnected_cb: Function | null = null;

    constructor() {
    }

    onMessage(msg: string) {
        if (this._onMessage_cb) {
            this._onMessage_cb(msg);
        }
        this._onMessage_cb = null;
    }

    onConnectionStateChange() {
        console.log(`onConnectionStateChange() signalingState: ${this.pc.connectionState}`);
        handleChange(this.pc);
        if (this.pc.connectionState == "connected") {
            if (this._onConnected_cb) {
                this._onConnected_cb();
            }
            this._onConnected_cb = null;
        }
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
        let self = this;
        pc.oniceconnectionstatechange = (ev) => handleChange(pc);
        pc.onconnectionstatechange = (ev) => self.onConnectionStateChange()
        dc.onmessage = (ev) => self.onMessage(ev.data);

        await pc.setLocalDescription(await pc.createOffer());
        return new Promise((resolve, reject) => {
            pc.onicecandidate = ({ candidate }) => {
                console.log(`[createOffer()] onicecandidate() signalingState: ${this.pc.signalingState} candidate: ${candidate}`);
                if (candidate) return;
                const offer = JSON.stringify(pc.localDescription)
                resolve(offer);
            };
        });
    }

    async handleInput(input) {
        // if got message and state is new, means message is offer from other node
        if (!this.pc) {
            return await this.createOffer();
        } else if (this.pc.connectionState != "connected") {
            if (this.pc.signalingState == "stable") {
                let offer = JSON.parse(input);

                console.log(`[pc.connectionState == "new"] prior to setRemoteDescription() signalingState: ${this.pc.signalingState}`);
                await this.pc.setRemoteDescription(offer);
                console.log(`[pc.connectionState == "new"] prior to setLocalDescription() signalingState: ${this.pc.signalingState}`);
                await this.pc.setLocalDescription(await this.pc.createAnswer());
                console.log(`setLocalDescription`);
                const ret = new Promise((resolve, reject) => {
                    this.pc.onicecandidate = ({ candidate }) => {
                        console.log(`[pc.connectionState == "new"] onicecandidate() signalingState: ${this.pc.signalingState} candidate: ${candidate}`);
                        if (candidate) return;
                        const answer = JSON.stringify(this.pc.localDescription);
                        resolve(answer);
                    };
                });
                return await ret;
            } else if (this.pc.signalingState == "have-local-offer") {
                const answer = JSON.parse(input);
                console.log(`[pc.connectionState == "connecting"] prior to setRemoteDescription() signalingState: ${this.pc.signalingState}`);
                // pc.setRemoteDescription(answer);
                const ret = new Promise((resolve, reject) => {
                    this._onConnected_cb = () => resolve("connected");
                    this.pc.setRemoteDescription(new RTCSessionDescription(answer));
                })
                return await ret;
            }
            throw new Error(`[handleInput()] unexpected signalingState: ${this.pc.signalingState}`);
        }
        // if we got here we are connected
        // send message
        // wait for response
        const ret = new Promise((resolve, reject) => {
            this.dc.send(input);
            this._onMessage_cb = resolve;
        });
        return await ret;
    }
}

const rtc = new RTC()

// handleInput("offer")
chat.onkeypress = async function (e) {
    if (e.keyCode != 13) return;
    const msgIn = chat.value
    chat.value = "";
    log(await rtc.handleInput(msgIn));
};