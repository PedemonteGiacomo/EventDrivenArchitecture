# chat-service/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY chat-service/package*.json ./
COPY schemas ./schemas
RUN npm install
COPY chat-service/. ./
CMD ["node", "index.js"]
