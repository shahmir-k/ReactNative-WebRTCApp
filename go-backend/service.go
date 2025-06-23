package main

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

var (
	nameToUserSession = make(map[string]*UserSession)
	sessionIdToName   = make(map[string]string)
	mu                sync.RWMutex
)

// handleJoin handles a join request from a user.
func handleJoin(conn *websocket.Conn, msg SignalingMessage) {
	name := msg.Sender
	log.Printf("Handling join request from user: %s", name)

	mu.Lock()

	// Check if user already has a valid session
	if existingSession, exists := nameToUserSession[name]; exists {
		// Check if the existing connection is still valid
		if existingSession.Conn != nil {
			log.Printf("User %s already has an active session, rejecting join", name)
			mu.Unlock()
			conn.WriteJSON(SignalingMessage{
				Type:     "join",
				Receiver: name,
				Data:     JoinResult{Result: false},
			})
			return
		}
	}

	// Remove any existing session for this user (force rejoin only if connection was invalid)
	if _, exists := nameToUserSession[name]; exists {
		log.Printf("Removing existing session for user %s to allow rejoin", name)
		delete(nameToUserSession, name)
		// Clean up sessionIdToName entries for this user
		var keysToDelete []string
		for sessionId, userName := range sessionIdToName {
			if userName == name {
				keysToDelete = append(keysToDelete, sessionId)
			}
		}
		// Delete collected keys
		for _, sessionId := range keysToDelete {
			delete(sessionIdToName, sessionId)
		}
	}

	userSession := &UserSession{Name: name, Conn: conn}
	nameToUserSession[name] = userSession
	sessionIdToName[conn.RemoteAddr().String()] = name
	log.Printf("User %s joined successfully", name)
	mu.Unlock()

	conn.WriteJSON(SignalingMessage{
		Type:     "join",
		Receiver: name,
		Data:     JoinResult{Result: true},
	})
	log.Printf("Broadcasting active users after %s joined", name)
	broadcastActiveUsers()
}

// handleActiveUsers sends the list of active users to the requesting user.
func handleActiveUsers(conn *websocket.Conn, msg SignalingMessage) {
	mu.RLock()
	activeUsers := make([]ActiveUser, 0, len(nameToUserSession))
	for name, session := range nameToUserSession {
		activeUsers = append(activeUsers, ActiveUser{
			Name:   name,
			InCall: session.InCall,
		})
	}
	mu.RUnlock()

	conn.WriteJSON(SignalingMessage{
		Type: "activeUsers",
		Data: ActiveUsers{Users: activeUsers},
	})
}

// handleCall initiates a call between two users.
func handleCall(conn *websocket.Conn, msg SignalingMessage) {
	sender := msg.Sender
	receiver := msg.Receiver
	mu.Lock()
	senderSession, senderExists := nameToUserSession[sender]
	receiverSession, receiverExists := nameToUserSession[receiver]
	if !senderExists || !receiverExists || senderSession.InCall || receiverSession.InCall {
		mu.Unlock()
		return
	}
	senderSession.SetInCall(true)
	receiverSession.SetInCall(true)
	mu.Unlock()

	receiverSession.Send(SignalingMessage{
		Type:     "call",
		Sender:   sender,
		Receiver: receiver,
	})
	broadcastActiveUsers()
}

// handleCancelCall cancels an ongoing call between two users.
func handleCancelCall(conn *websocket.Conn, msg SignalingMessage) {
	sender := msg.Sender
	receiver := msg.Receiver
	mu.Lock()
	senderSession, senderExists := nameToUserSession[sender]
	receiverSession, receiverExists := nameToUserSession[receiver]
	if !senderExists || !receiverExists {
		mu.Unlock()
		return
	}
	senderSession.SetInCall(false)
	receiverSession.SetInCall(false)
	mu.Unlock()

	receiverSession.Send(SignalingMessage{
		Type:     "cancelCall",
		Sender:   sender,
		Receiver: receiver,
	})
	broadcastActiveUsers()
}

// handleAcceptCall marks the call as accepted by the receiver.
func handleAcceptCall(conn *websocket.Conn, msg SignalingMessage) {
	sender := msg.Sender
	receiver := msg.Receiver
	mu.RLock()
	receiverSession, receiverExists := nameToUserSession[receiver]
	mu.RUnlock()
	if !receiverExists {
		return
	}

	receiverSession.Send(SignalingMessage{
		Type:     "acceptCall",
		Sender:   sender,
		Receiver: receiver,
	})
}

// handleOffer forwards an SDP offer from the sender to the receiver.
func handleOffer(conn *websocket.Conn, msg SignalingMessage) {
	sender := msg.Sender
	receiver := msg.Receiver
	offer := msg.Data

	log.Printf("Received offer from %s to %s: %+v", sender, receiver, offer)

	mu.RLock()
	receiverSession, receiverExists := nameToUserSession[receiver]
	mu.RUnlock()

	if !receiverExists {
		log.Printf("Receiver %s not found for offer from %s", receiver, sender)
		return
	}

	err := receiverSession.Send(SignalingMessage{
		Type:     "offer",
		Sender:   sender,
		Receiver: receiver,
		Data:     offer,
	})
	if err != nil {
		log.Printf("Error sending offer from %s to %s: %v", sender, receiver, err)
		return
	}

	log.Printf("Offer forwarded from %s to %s", sender, receiver)
}

// handleAnswer forwards an SDP answer from the sender to the receiver.
func handleAnswer(conn *websocket.Conn, msg SignalingMessage) {
	sender := msg.Sender
	receiver := msg.Receiver
	answer := msg.Data

	log.Printf("Received answer from %s to %s: %+v", sender, receiver, answer)

	mu.RLock()
	receiverSession, receiverExists := nameToUserSession[receiver]
	mu.RUnlock()

	if !receiverExists {
		log.Printf("Receiver %s not found for answer from %s", receiver, sender)
		return
	}

	err := receiverSession.Send(SignalingMessage{
		Type:     "answer",
		Sender:   sender,
		Receiver: receiver,
		Data:     answer,
	})
	if err != nil {
		log.Printf("Error sending answer from %s to %s: %v", sender, receiver, err)
		return
	}

	log.Printf("Answer forwarded from %s to %s", sender, receiver)
}

// handleIceCandidate forwards an ICE candidate from the sender to the receiver.
func handleIceCandidate(conn *websocket.Conn, msg SignalingMessage) {
	sender := msg.Sender
	receiver := msg.Receiver

	// Log the incoming candidate for debugging
	log.Printf("Received ICE candidate from %s to %s: %+v", sender, receiver, msg.Data)

	mu.RLock()
	receiverSession, receiverExists := nameToUserSession[receiver]
	mu.RUnlock()

	if !receiverExists {
		log.Printf("ERROR: Receiver %s not found for ICE candidate from %s", receiver, sender)
		return
	}

	// Forward the candidate exactly as received
	err := receiverSession.Send(SignalingMessage{
		Type:     "candidate",
		Sender:   sender,
		Receiver: receiver,
		Data:     msg.Data,
	})
	if err != nil {
		log.Printf("ERROR: Failed to send ICE candidate from %s to %s: %v", sender, receiver, err)
		return
	}

	log.Printf("Successfully forwarded ICE candidate from %s to %s", sender, receiver)
}

// handleHangUp handles a hang-up request from one user.
func handleHangUp(conn *websocket.Conn, msg SignalingMessage) {
	sender := msg.Sender
	receiver := msg.Receiver
	mu.Lock()
	senderSession, senderExists := nameToUserSession[sender]
	receiverSession, receiverExists := nameToUserSession[receiver]
	if !senderExists || !receiverExists {
		mu.Unlock()
		return
	}
	senderSession.SetInCall(false)
	receiverSession.SetInCall(false)
	mu.Unlock()

	receiverSession.Send(SignalingMessage{
		Type:     "hangUp",
		Sender:   sender,
		Receiver: receiver,
	})
	broadcastActiveUsers()
}

// handleDisconnect handles a user disconnection by removing their session and broadcasting updated active users.
func handleDisconnect(conn *websocket.Conn) {
	mu.Lock()
	name, exists := sessionIdToName[conn.RemoteAddr().String()]
	if !exists {
		mu.Unlock()
		return
	}

	delete(nameToUserSession, name)
	delete(sessionIdToName, conn.RemoteAddr().String())
	mu.Unlock()

	log.Printf("User %s disconnected", name)
	broadcastActiveUsers()
}

// broadcastActiveUsers broadcasts the updated list of active users to all connected clients.
func broadcastActiveUsers() {
	mu.RLock()
	activeUsers := make([]ActiveUser, 0, len(nameToUserSession))
	for name, session := range nameToUserSession {
		activeUsers = append(activeUsers, ActiveUser{
			Name:   name,
			InCall: session.InCall,
		})
	}
	mu.RUnlock()

	msg := SignalingMessage{
		Type: "activeUsers",
		Data: ActiveUsers{Users: activeUsers},
	}

	mu.RLock()
	for _, session := range nameToUserSession {
		if err := session.Send(msg); err != nil {
			log.Println("Broadcast error:", err)
		}
	}
	mu.RUnlock()
}
