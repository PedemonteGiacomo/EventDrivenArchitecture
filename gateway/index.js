// gateway/index.js (Server Node.js Event Gateway)
const amqp = require('amqplib');
const http = require('http');
const socketio = require('socket.io');

// Legge l'URL RabbitMQ dall'env (es. "amqp://guest:guest@rabbitmq:5672")
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

// Configura il server HTTP e Socket.IO
const server = http.createServer();
const io = socketio(server, {
  cors: { origin: '*' }  // abilita CORS per dev (da evitare in produzione senza restrizioni appropriate)
});
const PORT = process.env.PORT || 4000;

// Connessione a RabbitMQ e setup code ed exchange
async function setupRabbitMQ() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  const exchange = 'events';
  await channel.assertExchange(exchange, 'topic', { durable: false });

  // Coda esclusiva per il gateway per ricevere tutti gli eventi (pattern '#')
  const qok = await channel.assertQueue('', { exclusive: true });
  const queueName = qok.queue;
  await channel.bindQueue(queueName, exchange, '#');   // sottoscrive a tutti gli eventi dell'exchange

  // Consuma messaggi dalla coda e inoltra via WebSocket ai client
  await channel.consume(queueName, (msg) => {
    if (msg) {
      const routingKey = msg.fields.routingKey;                  // tipo di evento
      const content = msg.content.toString();
      console.log(`Gateway: ricevuto evento ${routingKey} da RabbitMQ -> inoltro ai client WebSocket`);
      // Inoltra a *tutti* i client connessi un evento col nome routingKey
      io.emit(routingKey, JSON.parse(content));
      channel.ack(msg);  // conferma messaggio come elaborato
    }
  }, { noAck: false });

  console.log("Gateway collegato a RabbitMQ, in attesa di eventi...");
  return channel;
}

// Gestione delle connessioni client WebSocket
io.on('connection', (socket) => {
  console.log('Client WebSocket connesso:', socket.id);

  // Ricezione di un evento generico dal client
  socket.onAny((eventName, data) => {
    console.log(`Gateway: evento ricevuto dal client -> ${eventName}`, data);
    // Pubblica l'evento ricevuto sull'exchange RabbitMQ
    channel.publish('events', eventName, Buffer.from(JSON.stringify(data)));
    console.log(`Gateway: inoltrato evento ${eventName} a RabbitMQ`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnesso:', socket.id);
  });
});

// Avvia sia il server HTTP/WebSocket che la connessione RabbitMQ
let channel;
server.listen(PORT, async () => {
  console.log(`Event Gateway in ascolto su ws://localhost:${PORT}`);
  try {
    channel = await setupRabbitMQ();
  } catch (err) {
    console.error("Errore connessione RabbitMQ:", err);
  }
});
