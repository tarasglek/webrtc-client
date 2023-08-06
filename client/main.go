package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/pion/webrtc/v3"
)

func printAsJSON(kind string, msg string) string {
	msgJSON, _ := json.Marshal(msg)
	fmt.Println(kind, string(msgJSON))
	return msg
}

type CommandResult struct {
	Output string `json:"output"`
	Error  string `json:"error,omitempty"`
}

func runCommandWithTimeout(cmd string, timeout time.Duration) string {
	resultChan := make(chan CommandResult)
	errorChan := make(chan error)
	// Run the command in a goroutine so we can kill it if it times out
	go func() {
		var command *exec.Cmd

		if runtime.GOOS == "windows" {
			command = exec.Command("cmd", "/C", cmd)
		} else {
			command = exec.Command("/bin/sh", "-c", cmd)
		}

		output, err := command.CombinedOutput()
		if err != nil {
			errorChan <- err
			return
		}

		resultChan <- CommandResult{Output: string(output)}
	}()

	select {
	case result := <-resultChan:
		jsonResult, err := json.Marshal(result)
		if err != nil {
			panic(err)
		}
		return string(jsonResult)
	case err := <-errorChan:
		result := CommandResult{Error: err.Error()}
		jsonResult, err := json.Marshal(result)
		if err != nil {
			panic(err)
		}
		return string(jsonResult)
	case <-time.After(timeout):
		result := CommandResult{Error: "Command timed out"}
		jsonResult, err := json.Marshal(result)
		if err != nil {
			panic(err)
		}
		return string(jsonResult)
	}
}

func promptAndRead(prompt string) string {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(prompt)
	response, _ := reader.ReadString('\n')
	return response
}

func main() {
	// Prepare the configuration
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs:           []string{"stun:stun.1.google.com:19302"},
				CredentialType: webrtc.ICECredentialTypeOauth,
			},
		},
	}

	// Create a new RTCPeerConnection
	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		panic(err)
	}

	// Create a data channel
	dataChannel, err := peerConnection.CreateDataChannel("chat", &webrtc.DataChannelInit{
		MaxPacketLifeTime: new(uint16),
	})
	if err != nil {
		panic(err)
	}

	dataChannel.OnOpen(func() {
		fmt.Println("Data channel is open")
	})

	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		msgStr := string(msg.Data)
		msgJSON, _ := json.Marshal(msgStr)
		fmt.Println("OnMessage", string(msgJSON))
		ret := runCommandWithTimeout(string(msg.Data), 1*time.Second)
		dataChannel.SendText(ret)
	})

	// Handle ICE connection state changes
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Println("ICE Connection State has changed:", connectionState.String())
		if connectionState == webrtc.ICEConnectionStateConnected {
			// send fake bash prompt
			dataChannel.SendText("bash$ ")
		}

	})

	offerJSON := promptAndRead("Enter offer from web: ")

	// Parse the offer
	offer := webrtc.SessionDescription{}
	json.Unmarshal([]byte(offerJSON), &offer)

	err = peerConnection.SetRemoteDescription(offer)
	if err != nil {
		panic(err)
	}

	// Create an answer
	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		panic(err)
	}

	// Set the answer as the local description
	err = peerConnection.SetLocalDescription(answer)
	if err != nil {
		panic(err)
	}

	peerConnection.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate != nil {
			return
		}
		answer := peerConnection.LocalDescription()
		answerJSON, err := json.Marshal(answer)
		if err != nil {
			panic(err)
		}
		fmt.Println("paste this answer in web:")
		fmt.Println(string(answerJSON))
	})
	// infinite loop
	select {}
}
