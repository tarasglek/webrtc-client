package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"time"

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

	// Handle messages from the data channel
	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		fmt.Println(string(msg.Data))
	})

	// Handle ICE connection state changes
	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Println("ICE Connection State has changed:", connectionState.String())
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

	dataChannel.OnOpen(func() {
		err := dataChannel.SendText("Hello, World!")
		if err != nil {
			panic(err)
		}
	})

	// Infinite loop
	for {
		time.Sleep(time.Second)
	}
}
