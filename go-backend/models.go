package main

import (
	"sync"

	"github.com/gorilla/websocket"
)

// SignalingMessage represents a signaling message with type, sender, receiver, and data.
type SignalingMessage struct {
	Type     string      `json:"type"`
	Sender   string      `json:"sender"`
	Receiver string      `json:"receiver"`
	Data     interface{} `json:"data"`
}

// JoinResult represents the result of a join attempt
type JoinResult struct {
	Result bool `json:"result"`
}

// ActiveUser represents an active user in the system
type ActiveUser struct {
	Name   string `json:"name"`
	InCall bool   `json:"inCall"`
}

// ActiveUsers represents the list of active users
type ActiveUsers struct {
	Users []ActiveUser `json:"users"`
}

// UserSession represents a user's WebSocket session and call state.
type UserSession struct {
	Name   string
	Conn   *websocket.Conn
	InCall bool
	mu     sync.Mutex
}

// Send sends a JSON message to the user's WebSocket connection.
func (u *UserSession) Send(msg SignalingMessage) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.Conn.WriteJSON(msg)
}

// SetInCall sets the user's call state.
func (u *UserSession) SetInCall(inCall bool) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.InCall = inCall
}
