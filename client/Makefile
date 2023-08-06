all: webrtc-client-osx-arm64.exe webrtc-client.exe webrtc-client-win-amd64.exe

webrtc-client-osx-arm64.exe: main.go
	GOOS=darwin GOARCH=arm64 go build  -o $@

webrtc-client-win-amd64.exe: main.go
	GOOS=windows GOARCH=amd64 go build  -o $@

webrtc-client.exe: main.go
	go build  -o $@

clean:
	rm -f *.exe