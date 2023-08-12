import { RTC } from "./rtc";

const chat = document.getElementById("chat");
const output = document.getElementById("output");
chat?.focus();
// const log = msg => output.innerHTML += `<br>${msg}`;
// append textarea for every message
const log = (msg) => {
    // console.log(msg);
    let textarea = document.createElement("textarea");
    // make it full with and 3 rows
    // calculate number of lines in msg or max of strlen/80
    // calc number of chars that fits on screen
    let chars_per_line = Math.floor(window.innerWidth / 8);
    let lines = Math.max(Math.ceil(msg.length / chars_per_line), msg.split(/\r\n|\r|\n/).length);
    // log both
    // console.log(`msg.length: ${msg.length} msg.split(/\r\n|\r|\n/).length: ${msg.split(/\r\n|\r|\n/).length} lines: ${lines}`);
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

const rtc = new RTC()

// handleInput("offer")
chat.onkeypress = async function (e) {
    if (e.keyCode != 13) return;
    const msgIn = chat.value
    chat.value = "";
    log(await rtc.handleInput(msgIn));
};