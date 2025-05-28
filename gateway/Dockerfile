# gateway/Dockerfile
FROM node:18-alpine

WORKDIR /app

# 1) Copio solo il package.json del gateway
COPY gateway/package*.json ./

# 2) Copio la cartella dei JSON Schema (dalla root del contesto)
COPY schemas ./schemas

# 3) Installo dipendenze
RUN npm install

# 4) Copio **solo** il codice del gateway
COPY gateway/. ./

CMD ["node", "index.js"]
