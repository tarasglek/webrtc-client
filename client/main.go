package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/pion/webrtc/v3"
)

type CommandResult struct {
	Output string `json:"output"`
	Error  string `json:"error,omitempty"`
}

const PION_MAX_MSG_SIZE = 65535

func runCommandWithTimeout(shell []string, cmd string, timeout time.Duration) string {
	resultChan := make(chan CommandResult)

	go func() {
		var command *exec.Cmd

		shell_and_cmd := append(shell, cmd)
		command = exec.Command(shell_and_cmd[0], shell_and_cmd[1:]...)

		output, err := command.CombinedOutput()

		result := CommandResult{
			Output: string(output),
			Error:  "",
		}

		if err != nil {
			result.Error = err.Error()
		}

		resultChan <- result
	}()

	select {
	case result := <-resultChan:
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
	// Slice off the first argument (program name)

	// If args is empty, set it to ["/bin/sh", "-c"]
	var default_shell []string
	if runtime.GOOS == "windows" {
		default_shell = []string{"cmd", "/C"}
	} else {
		default_shell = []string{"/bin/sh", "-c"}
	}

	// handle -h
	if len(os.Args) == 2 && os.Args[1] == "-h" {
		fmt.Println("Usage: " + os.Args[0] + " [shell]")
		// println shell array joined as string as example
		// use strings.Join(shell, " ")
		fmt.Println("Example: " + os.Args[0] + " " + strings.Join(default_shell, " "))
		os.Exit(0)
	}
	shell := os.Args[1:]
	if len(shell) == 0 {
		shell = default_shell
	}

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
		ret := runCommandWithTimeout(default_shell, string(msg.Data), 90*time.Second)
		// split ret into chunks of PION_MAX_MSG_SIZE
		// and send each chunk
		for i := 0; i < len(ret); i += PION_MAX_MSG_SIZE {
			end := i + PION_MAX_MSG_SIZE
			if end > len(ret) {
				end = len(ret)
			}
			err := dataChannel.SendText(ret[i:end])
			if err != nil {
				panic(err)
			}
		}
	})

	// Handle ICE connection state changes
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Println("ICE Connection State has changed:", connectionState.String())
		if (connectionState == webrtc.ICEConnectionStateFailed) || (connectionState == webrtc.ICEConnectionStateDisconnected) {
			// exit with error message
			os.Exit(1)
		}
		// if connectionState == webrtc.ICEConnectionStateConnected {
		// }
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
