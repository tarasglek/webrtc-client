package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/pion/webrtc/v3"
)

func printAsJSON(kind string, msg string) string {
	msgJSON, _ := json.Marshal(msg)
	fmt.Println(kind, string(msgJSON))
	return msg
}

func runCommandAndPipeToDataChannel(dataChannel *webrtc.DataChannel, cmdString string) {
	// Create a new command
	fmt.Println("running command", cmdString)
	command := exec.Command("/bin/sh", "-c", cmdString)

	// Get the input/output pipes
	stdin, _ := command.StdinPipe()
	stdout, _ := command.StdoutPipe()
	stderr, _ := command.StderrPipe()

	// Handle incoming DataChannel messages
	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		// Write the incoming message to the command's stdin
		// convert data to string and print as json
		msgStr := string(msg.Data)
		msgJSON, _ := json.Marshal(msgStr)
		fmt.Println("OnMessage", string(msgJSON))
		stdin.Write(msg.Data)
	})

	// Read from the command's stdout and stderr and send the output over the DataChannel
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			dataChannel.SendText(printAsJSON("stdout", scanner.Text()))
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			dataChannel.SendText(printAsJSON("stderr", scanner.Text()))

		}
	}()

	fmt.Println("starting command:", cmdString)
	// Start the command
	command.Start()
	// Wait for the command to finish
	command.Wait()
}

func promptAndRead(prompt string) string {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(prompt)
	response, _ := reader.ReadString('\n')
	return response
}

func main() {
	// Check command line arguments
	if len(os.Args) != 2 {
		fmt.Printf("Usage: %s <cmd_string>\n", os.Args[0])
		os.Exit(1)
	}

	// Get the command string
	cmdString := os.Args[1]

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

	// Handle messages from the data channel
	// dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
	// 	fmt.Println(string(msg.Data))
	// })

	// Handle ICE connection state changes
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Println("ICE Connection State has changed:", connectionState.String())
		if connectionState == webrtc.ICEConnectionStateConnected {
			runCommandAndPipeToDataChannel(dataChannel, cmdString)
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

	/*
			      pc.onicecandidate = ({ candidate }) => {
		        if (candidate) return;
		        const answer = pc.localDescription;
		        log(JSON.stringify(answer));
		      };
	*/
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
	// Create a channel to signal when ICE gathering is complete
	// gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

	// Wait for ICE gathering to complete
	// <-gatherComplete

	// // Get the final session description
	// finalAnswer := peerConnection.LocalDescription()

	// // Print the answer.SDP as JSON
	// answerJSON, err := json.Marshal(finalAnswer)
	// if err != nil {
	// 	panic(err)
	// }
	// fmt.Println("paste this answer in web:")
	// fmt.Println(string(answerJSON))

	// Infinite loop
	for {
		time.Sleep(time.Second)
	}
}
