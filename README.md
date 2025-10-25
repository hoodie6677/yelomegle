# 🚀 Serveur de Signalisation Yelomegle

Serveur WebSocket minimal pour remplacer Firebase.

## 📦 Déploiement sur Render.com (GRATUIT, sans carte bancaire)

### Étape 1 : Créer un compte Render

1. Va sur https://render.com/
2. Clique sur **"Get Started for Free"**
3. Inscris-toi avec **GitHub** (pas besoin de carte bancaire !)

### Étape 2 : Pousser le code sur GitHub

```bash
# Dans le dossier racine de ton projet
git add server/
git commit -m "Add WebSocket signaling server"
git push
```

### Étape 3 : Déployer sur Render

1. Sur Render.com, clique sur **"New +"** → **"Web Service"**
2. Connecte ton repository GitHub
3. Configure :
   - **Name** : `yelomegle-signaling`
   - **Root Directory** : `server`
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : **Free** ✅
4. Clique sur **"Create Web Service"**

### Étape 4 : Récupérer l'URL

Une fois déployé, Render te donne une URL :
```
https://yelomegle-signaling.onrender.com
```

**Note** : Le serveur gratuit se met en veille après 15 min d'inactivité. La première connexion prend ~30 secondes (c'est normal).

## 🧪 Tester localement

```bash
cd server
npm install
npm start
```

Le serveur démarre sur `ws://localhost:8080`

## 📝 Variables d'environnement

Aucune variable nécessaire ! Le serveur fonctionne out-of-the-box.

## 🔧 Utilisation

Le serveur accepte ces messages WebSocket :

```javascript
// Rejoindre la waiting room
ws.send(JSON.stringify({ type: 'join', peerId: 'mon-peer-id' }));

// Quitter la waiting room
ws.send(JSON.stringify({ type: 'leave', peerId: 'mon-peer-id' }));

// Ping (keep-alive)
ws.send(JSON.stringify({ type: 'ping' }));
```

Réponses du serveur :

```javascript
// Match trouvé
{ type: 'match', peerId: 'peer-id-du-match' }

// Pong
{ type: 'pong' }
```

## 💰 Coût

**0€ pour toujours** avec le plan gratuit Render :
- 750 heures/mois (suffisant pour un serveur qui tourne 24/7)
- Pas de carte bancaire requise
- Se met en veille après 15 min d'inactivité (se réveille automatiquement)

## 🆚 Alternative : Glitch.com

Si Render ne fonctionne pas, tu peux aussi utiliser **Glitch.com** :

1. Va sur https://glitch.com/
2. Clique sur **"New Project"** → **"Import from GitHub"**
3. Colle l'URL de ton repo
4. Glitch déploie automatiquement !

URL : `https://ton-projet.glitch.me`

