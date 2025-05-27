# Usa Node.js 18 leggero
FROM node:18-alpine   

WORKDIR /app
COPY package*.json ./
# Installa le dipendenze
RUN npm install       


COPY . .
CMD ["node", "index.js"]   
# Comando di avvio (esegue il file index.js)
