all: webrtc-client-osx-arm64.bin webrtc-client.bin

webrtc-client-osx-arm64.bin: main.go
	GOOS=darwin GOARCH=arm64 go build  -o $@

webrtc-client.bin: main.go
	go build  -o $@

clean:
	rm -f *.bin