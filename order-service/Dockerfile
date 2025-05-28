# order-service/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY order-service/package*.json ./
COPY schemas ./schemas
RUN npm install
COPY order-service/. ./
CMD ["node", "index.js"]
