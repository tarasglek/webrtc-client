export const name = "webrtc_shell_cmd";

export const description = "This executes shell commands over webrtc connection. It's not able to execute interactive commands like vim, prefer to use tee, etc instead";

/**
* 3. A JSON Schema defining the function's parameters. See:
*
* - https://platform.openai.com/docs/guides/gpt/function-calling
* - https://json-schema.org/learn/getting-started-step-by-step
*/
export const parameters = {
    type: "object",
    properties: {
        cmd: {
            type: "string",
            description: "Valid shell command",
        }
    },
    required: ["cmd"],
};


class RTC {
    pc: RTCPeerConnection;
    dc: RTCDataChannel;
    _onMessage_cb: Function | null = null;
    _onConnected_cb: Function | null = null;

    constructor() {
        this.pc = null as any;
        this.dc = null as any;
    }

    onMessage(msg: string) {
        if (this._onMessage_cb) {
            this._onMessage_cb(msg);
        }
        this._onMessage_cb = null;
    }

    get connected() {
        return this.pc && this.pc.connectionState == "connected";
    }

    async connectAndcreateOffer(): Promise<string> {
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
        // pc.oniceconnectionstatechange = (ev) => handleChange(pc);
        // pc.onconnectionstatechange = (ev) => handleChange(pc)
        dc.onmessage = (ev) => self.onMessage(ev.data);
        dc.onopen = (ev) => {
            if (self._onConnected_cb) {
                self._onConnected_cb();
            }
            self._onConnected_cb = null;
        };
        dc.onerror = (ev) => console.log(`dc.onerror() ${ev}`);

        await pc.setLocalDescription(await pc.createOffer());
        return new Promise((resolve, reject) => {
            pc.onicecandidate = ({ candidate }) => {
                // console.log(`[createOffer()] onicecandidate() signalingState: ${this.pc.signalingState} candidate: ${candidate}`);
                if (candidate) return;
                const offer = JSON.stringify(pc.localDescription)
                resolve(offer);
            };
        });
    }

    async handleInput(input: string): Promise<string> {
        console.log(`[handleInput()] input: ${input}`);
        if (!this.pc) {
            return await this.connectAndcreateOffer();
        } else if (this.pc.connectionState != "connected") {
            console.log(`[pc.connectionState == "${this.pc.connectionState}"]`);
            // this is js code for handling case where offer first arrives from elsewhere
            // if (this.pc.signalingState == "stable") {
            //     let offer = JSON.parse(input);

            //     console.log(`[pc.connectionState == "new"] prior to setRemoteDescription() signalingState: ${this.pc.signalingState}`);
            //     await this.pc.setRemoteDescription(offer);
            //     console.log(`[pc.connectionState == "new"] prior to setLocalDescription() signalingState: ${this.pc.signalingState}`);
            //     await this.pc.setLocalDescription(await this.pc.createAnswer());
            //     console.log(`setLocalDescription`);
            //     const ret = new Promise((resolve, reject) => {
            //         this.pc.onicecandidate = ({ candidate }) => {
            //             console.log(`[pc.connectionState == "new"] onicecandidate() signalingState: ${this.pc.signalingState} candidate: ${candidate}`);
            //             if (candidate) return;
            //             const answer = JSON.stringify(this.pc.localDescription);
            //             resolve(answer);
            //         };
            //     });
            //     return await ret;
            // }

            // here expecting input to be JSON offer reply from other node
            // receive counter offer, and try to connect
            // if (this.pc.signalingState == "have-local-offer")
            {
                const answer = JSON.parse(input);
                let self = this;
                const ret = new Promise<string>((resolve, reject) => {
                    this._onConnected_cb = () => {
                        resolve("connected");
                    }
                    this.pc.setRemoteDescription(new RTCSessionDescription(answer));
                })
                return await ret;
            }
        }
        // if we got here we are connected
        // send message
        // wait for response
        const retP = new Promise<string>((resolve, reject) => {
            this.dc.send(input);
            this._onMessage_cb = resolve;
        });
        let ret = await retP;
        console.log(`[handleInput()] ret: ${ret}`);
        return ret;
    }
}


export default async function (value: any) {
    console.log(value);
    const cmd = value.cmd;
    // cache the connection
    let rtc = (window as any).rtc as RTC;
    if (!rtc) {
        (window as any).rtc = rtc = new RTC();
        const offer = await rtc.handleInput("")
        let reply = prompt("Copy this offer to other node, and paste reply", offer);
        console.log("reply", reply);
        const replyReply = await rtc.handleInput(reply!);
        console.log(`rtc.connected: ${rtc.connected}`);
        if (!rtc.connected) {
            return replyReply;
        }

        return await rtc.handleInput(cmd);
    }
    const replyStr = await rtc.handleInput(cmd);
    let output = undefined
    try {
        const reply = JSON.parse(replyStr);
        if (reply.error) {
            return replyStr;
        }
        output = reply.output.trim();
    } catch (e) {
    }
    return '```\n' + (output ? output : replyStr) + '\n```';
}