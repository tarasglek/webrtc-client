GOOS=darwin GOARCH=arm64 go build  -o webrtc-client-osx
./webrtc-client-osx 'bash --rcfile emptyrc -i  2>&1'