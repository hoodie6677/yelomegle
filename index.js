import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Salle d'attente : Map<peerId, { ws, timestamp }>
const waitingRoom = new Map();
const EXPIRY_TIME = 30000; // 30 secondes

console.log(`🚀 WebSocket server running on port ${PORT}`);

// Nettoyer les entrées expirées toutes les 10 secondes
setInterval(() => {
  const now = Date.now();
  for (const [peerId, data] of waitingRoom.entries()) {
    if (now - data.timestamp > EXPIRY_TIME) {
      console.log(`🧹 Cleaning expired peer: ${peerId}`);
      waitingRoom.delete(peerId);
    }
  }
}, 10000);

wss.on('connection', (ws) => {
  console.log('📱 New connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'join':
          handleJoin(ws, data.peerId);
          break;
        case 'leave':
          handleLeave(data.peerId);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('❓ Unknown message type:', data.type);
      }
    } catch (e) {
      console.error('❌ Error parsing message:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('📴 Connection closed');
    // Nettoyer le peer de la waiting room
    for (const [peerId, data] of waitingRoom.entries()) {
      if (data.ws === ws) {
        waitingRoom.delete(peerId);
        console.log(`🗑️ Removed ${peerId} from waiting room`);
        break;
      }
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

function handleJoin(ws, peerId) {
  console.log(`👋 Peer joining: ${peerId}`);
  
  // Chercher un match dans la waiting room
  for (const [waitingPeerId, data] of waitingRoom.entries()) {
    if (waitingPeerId !== peerId) {
      // Match trouvé !
      console.log(`🎉 Match found: ${peerId} <-> ${waitingPeerId}`);
      
      // Envoyer le match aux deux peers
      ws.send(JSON.stringify({
        type: 'match',
        peerId: waitingPeerId
      }));
      
      data.ws.send(JSON.stringify({
        type: 'match',
        peerId: peerId
      }));
      
      // Retirer le peer matché de la waiting room
      waitingRoom.delete(waitingPeerId);
      return;
    }
  }
  
  // Pas de match, ajouter à la waiting room
  waitingRoom.set(peerId, {
    ws,
    timestamp: Date.now()
  });
  
  console.log(`⏳ Added to waiting room: ${peerId} (${waitingRoom.size} waiting)`);
}

function handleLeave(peerId) {
  if (waitingRoom.has(peerId)) {
    waitingRoom.delete(peerId);
    console.log(`👋 Peer left: ${peerId}`);
  }
}

