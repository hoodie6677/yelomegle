# Utiliser Node.js 18 (LTS)
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier le code source
COPY . .

# Exposer le port 8080
EXPOSE 8080

# Démarrer le serveur
CMD ["npm", "start"]

