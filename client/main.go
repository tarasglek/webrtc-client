package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/pion/webrtc/v3"
)

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
				URLs: []string{"stun:sturn.1.google.com:19302"},
			},
		},
	}

	// Create a new RTCPeerConnection
	peerConnection, err := webrtc.NewPeerConnection(config)
	if err != nil {
		panic(err)
	}

	// Create a data channel
	dataChannel, err := peerConnection.CreateDataChannel("chat", nil)
	if err != nil {
		panic(err)
	}

	// Handle messages from the data channel
	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		fmt.Println(string(msg.Data))
	})

	// Handle ICE connection state changes
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Println("ICE Connection State has changed:", connectionState.String())
	})

	// Create an offer
	offer, err := peerConnection.CreateOffer(nil)
	if err != nil {
		panic(err)
	}

	// Set the local description
	err = peerConnection.SetLocalDescription(offer)
	if err != nil {
		panic(err)
	}

	// Output the offer in SDP format
	fmt.Println(offer.SDP)

	answerStr := promptAndRead("Enter offer from web: ")

	// Parse the answer
	var answer webrtc.SessionDescription
	json.Unmarshal([]byte(answerStr), &answer)

	// Set the remote description
	err = peerConnection.SetRemoteDescription(answer)
	if err != nil {
		panic(err)
	}

	// Send a message
	err = dataChannel.SendText("Hello, World!")
	if err != nil {
		panic(err)
	}

	// Close the peer connection
	err = peerConnection.Close()
	if err != nil {
		panic(err)
	}
}
