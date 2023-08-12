
export class RTC {
    pc: RTCPeerConnection;
    dc: RTCDataChannel;
    _onMessage_cb: Function | null = null;
    _onConnected_cb: Function | null = null;
    _wip_msg: string | null = null;

    constructor() {
    }

    onMessage(msg: string) {
        if (this._onMessage_cb) {
            this._onMessage_cb(msg);
        }
        this._onMessage_cb = null;
    }

    async connectAndcreateOffer() {
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

    async handleInput(input: string) {
        if (!this.pc) {
            this._wip_msg = input;
            return await this.connectAndcreateOffer();
        } else if (this.pc.connectionState != "connected") {
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
                const ret = new Promise((resolve, reject) => {
                    this._onConnected_cb = () => {
                        if (self._wip_msg) {
                            self.handleInput(self._wip_msg).then(resolve);
                            self._wip_msg = null;
                        } else {
                            resolve("connected");
                        }
                    }
                    this.pc.setRemoteDescription(new RTCSessionDescription(answer));
                })
                return await ret;
            }
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
