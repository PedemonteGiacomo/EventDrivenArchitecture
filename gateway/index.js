// gateway/index.js (Event Gateway con validazione AJV per tutti gli eventi)
const amqp = require('amqplib');
const http = require('http');
const socketio = require('socket.io');
const Ajv = require('ajv');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const PORT = process.env.PORT || 4000;

// Carica tutti gli schemi dal folder ../schemas
const eventNames = ['ChatMessageSent', 'ChatMessage', 'OrderSubmitted'];
const schemas = eventNames.reduce((acc, name) => {
  acc[name] = require(`./schemas/${name}.schema.json`);
  return acc;
}, {});

const ajv = new Ajv();
const validators = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)])
);

const server = http.createServer();
const io = socketio(server, { cors: { origin: '*' } });

let channel;

// Connessione a RabbitMQ e setup
async function setupRabbitMQ() {
  const conn = await amqp.connect(RABBITMQ_URL);
  channel = await conn.createChannel();

  const exchange = 'events';
  await channel.assertExchange(exchange, 'topic', { durable: false });

  const { queue } = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(queue, exchange, '#');

  await channel.consume(queue, (msg) => {
    if (!msg) return;
    const eventName = msg.fields.routingKey;
    const data = JSON.parse(msg.content.toString());

    // Validazione in entrata
    if (validators[eventName] && !validators[eventName](data)) {
      console.error(`Invalid ${eventName}:`, validators[eventName].errors);
      channel.ack(msg);
      return;
    }

    // Inoltra via WebSocket
    io.emit(eventName, data);
    channel.ack(msg);
  }, { noAck: false });

  console.log("Gateway collegato a RabbitMQ, in attesa di eventi...");
}

// WebSocket → RabbitMQ
io.on('connection', (socket) => {
  console.log('Client WebSocket connesso:', socket.id);

  socket.onAny((eventName, data) => {
    // Validazione in uscita
    const validate = validators[eventName];
    if (validate && !validate(data)) {
      console.error(`Invalid outgoing ${eventName}:`, validate.errors);
      return;
    }

    channel.publish('events', eventName, Buffer.from(JSON.stringify(data)));
    console.log(`Gateway: inoltrato evento ${eventName} a RabbitMQ`, data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnesso:', socket.id);
  });
});

// Avvia server HTTP/WebSocket e RabbitMQ
server.listen(PORT, async () => {
  console.log(`Event Gateway in ascolto su ws://localhost:${PORT}`);
  try {
    await setupRabbitMQ();
  } catch (err) {
    console.error("Errore connessione RabbitMQ:", err);
  }
});
