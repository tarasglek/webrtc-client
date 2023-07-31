package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/pion/webrtc/v3"
)

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

	// Wait for the user to enter the answer
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Enter the answer: ")
	answerStr, _ := reader.ReadString('\n')

	// Parse the answer
	var answer webrtc.SessionDescription
	json.Unmarshal([]byte(answerStr), &answer)

	// Set the remote description
	err = peerConnection.SetRemoteDescription(answer)
	if err != nil {
		panic(err)
	}

	// Wait for the connection to be established
	<-peerConnection.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		return state == webrtc.ICEConnectionStateConnected
	})

	// Send a message
	err = dataChannel.SendText("Hello, World!")
	if err != nil {
		panic(err)
	}

	// Wait for a message to be received
	<-dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		return string(msg.Data) != ""
	})

	// Close the peer connection
	err = peerConnection.Close()
	if err != nil {
		panic(err)
	}
}