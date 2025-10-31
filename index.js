import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT });

// Salle d'attente : Map<peerId, { ws, timestamp }>
const waitingRoom = new Map();
// Connexions actives : Map<ws, { peerId, isAlive }>
const connections = new Map();
const EXPIRY_TIME = 30000; // 30 secondes
const HEARTBEAT_INTERVAL = 10000; // 10 secondes

console.log(`🚀 WebSocket server running on port ${PORT}`);

// Fonction heartbeat
function heartbeat() {
  this.isAlive = true;
}

// Nettoyer les entrées expirées et vérifier les connexions
setInterval(() => {
  const now = Date.now();
  
  // Nettoyer la waiting room
  for (const [peerId, data] of waitingRoom.entries()) {
    if (now - data.timestamp > EXPIRY_TIME) {
      console.log(`🧹 Cleaning expired peer: ${peerId}`);
      waitingRoom.delete(peerId);
      if (data.ws.readyState === 1) { // OPEN
        data.ws.send(JSON.stringify({ type: 'timeout' }));
      }
    }
  }
  
  // Vérifier les connexions actives (heartbeat)
  wss.clients.forEach((ws) => {
    const conn = connections.get(ws);
    if (conn && conn.isAlive === false) {
      console.log(`💔 Terminating inactive connection: ${conn.peerId}`);
      cleanupConnection(ws);
      return ws.terminate();
    }
    
    if (conn) {
      conn.isAlive = false;
      if (ws.readyState === 1) { // OPEN
        ws.ping();
      }
    }
  });
  
  console.log(`📊 Status - Waiting: ${waitingRoom.size}, Connected: ${connections.size}`);
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws) => {
  console.log('📱 New connection established');
  
  // Initialiser la connexion
  const connectionData = {
    peerId: null,
    isAlive: true
  };
  connections.set(ws, connectionData);
  
  // Configurer le heartbeat
  ws.on('pong', () => {
    const conn = connections.get(ws);
    if (conn) conn.isAlive = true;
  });
  
  // Envoyer un message de bienvenue
  ws.send(JSON.stringify({ 
    type: 'connected',
    message: 'Connected to signaling server'
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'join':
          handleJoin(ws, data.peerId);
          break;
        case 'leave':
          handleLeave(ws, data.peerId);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'signal':
          // Relayer les signaux WebRTC
          handleSignal(ws, data);
          break;
        default:
          console.log('❓ Unknown message type:', data.type);
      }
    } catch (e) {
      console.error('❌ Error parsing message:', e.message);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`📴 Connection closed - Code: ${code}, Reason: ${reason || 'No reason'}`);
    cleanupConnection(ws);
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    cleanupConnection(ws);
  });
});

function handleJoin(ws, peerId) {
  if (!peerId) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'peerId is required' 
    }));
    return;
  }
  
  console.log(`👋 Peer joining: ${peerId}`);
  
  // Mettre à jour la connexion
  const conn = connections.get(ws);
  if (conn) {
    conn.peerId = peerId;
  }
  
  // Vérifier si déjà dans la waiting room
  if (waitingRoom.has(peerId)) {
    console.log(`⚠️ Peer ${peerId} already in waiting room, updating connection`);
    waitingRoom.get(peerId).ws = ws;
    waitingRoom.get(peerId).timestamp = Date.now();
    return;
  }
  
  // Chercher un match dans la waiting room
  for (const [waitingPeerId, data] of waitingRoom.entries()) {
    if (waitingPeerId !== peerId && data.ws.readyState === 1) { // WebSocket.OPEN
      // Match trouvé !
      console.log(`🎉 Match found: ${peerId} <-> ${waitingPeerId}`);
      
      try {
        // Envoyer le match aux deux peers
        ws.send(JSON.stringify({
          type: 'match',
          peerId: waitingPeerId,
          initiator: true
        }));
        
        data.ws.send(JSON.stringify({
          type: 'match',
          peerId: peerId,
          initiator: false
        }));
        
        // Retirer le peer matché de la waiting room
        waitingRoom.delete(waitingPeerId);
        
        console.log(`✅ Match sent successfully`);
      } catch (error) {
        console.error(`❌ Error sending match:`, error.message);
        // Si erreur, ajouter quand même à la waiting room
        addToWaitingRoom(ws, peerId);
      }
      return;
    }
  }
  
  // Pas de match, ajouter à la waiting room
  addToWaitingRoom(ws, peerId);
}

function addToWaitingRoom(ws, peerId) {
  waitingRoom.set(peerId, {
    ws,
    timestamp: Date.now()
  });
  
  ws.send(JSON.stringify({
    type: 'waiting',
    message: 'Waiting for a match...'
  }));
  
  console.log(`⏳ Added to waiting room: ${peerId} (${waitingRoom.size} waiting)`);
}

function handleLeave(ws, peerId) {
  if (waitingRoom.has(peerId)) {
    waitingRoom.delete(peerId);
    console.log(`👋 Peer left waiting room: ${peerId}`);
  }
  
  ws.send(JSON.stringify({
    type: 'left',
    message: 'You have left the waiting room'
  }));
}

function handleSignal(ws, data) {
  // Relayer les signaux WebRTC entre peers
  const { targetPeerId, signal } = data;
  
  if (!targetPeerId || !signal) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Invalid signal data' 
    }));
    return;
  }
  
  // Trouver le peer cible
  for (const [targetWs, conn] of connections.entries()) {
    if (conn.peerId === targetPeerId && targetWs.readyState === 1) {
      targetWs.send(JSON.stringify({
        type: 'signal',
        signal: signal,
        fromPeerId: connections.get(ws)?.peerId
      }));
      console.log(`📡 Signal relayed from ${connections.get(ws)?.peerId} to ${targetPeerId}`);
      return;
    }
  }
  
  console.log(`⚠️ Target peer not found: ${targetPeerId}`);
  ws.send(JSON.stringify({ 
    type: 'error', 
    message: 'Target peer not found' 
  }));
}

function cleanupConnection(ws) {
  const conn = connections.get(ws);
  if (conn && conn.peerId) {
    console.log(`🗑️ Cleaning up connection for: ${conn.peerId}`);
    
    // Retirer de la waiting room si présent
    if (waitingRoom.has(conn.peerId)) {
      waitingRoom.delete(conn.peerId);
      console.log(`  - Removed from waiting room`);
    }
  }
  
  connections.delete(ws);
}

// Gestion propre de l'arrêt du serveur
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  // Notifier tous les clients
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ 
        type: 'server-closing',
        message: 'Server is shutting down' 
      }));
      ws.close();
    }
  });
  
  wss.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

// Health check endpoint (si nécessaire pour le déploiement)
if (process.env.HEALTH_CHECK) {
  import('http').then(({ createServer }) => {
    const healthServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy',
          connections: connections.size,
          waiting: waitingRoom.size
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    const HEALTH_PORT = process.env.HEALTH_PORT || 10001;
    healthServer.listen(HEALTH_PORT, () => {
      console.log(`🏥 Health check server on port ${HEALTH_PORT}`);
    });
  });
}