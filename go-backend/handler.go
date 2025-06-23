package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer func() {
		// Handle disconnection
		handleDisconnect(conn)
		conn.Close()
	}()

	for {
		var msg SignalingMessage
		if err := conn.ReadJSON(&msg); err != nil {
			log.Println("Read error:", err)
			break
		}

		// Add debug logging for all messages
		log.Printf("Received message: %+v", msg)

		switch msg.Type {
		case "join":
			handleJoin(conn, msg)
		case "activeUsers":
			handleActiveUsers(conn, msg)
		case "call":
			handleCall(conn, msg)
		case "cancelCall":
			handleCancelCall(conn, msg)
		case "acceptCall":
			handleAcceptCall(conn, msg)
		case "offer":
			handleOffer(conn, msg)
		case "answer":
			handleAnswer(conn, msg)
		case "candidate":
			handleIceCandidate(conn, msg)
		case "hangUp":
			handleHangUp(conn, msg)
		case "leave":
			handleDisconnect(conn)
			conn.Close()
		default:
			log.Printf("Unknown message type: %s", msg.Type)
		}
	}
}
