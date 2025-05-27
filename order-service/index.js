// order-service/index.js (Microservizio di gestione ordini)
const amqp = require('amqplib');
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

async function start() {
  // Connessione e canale RabbitMQ
  const conn = await amqp.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  const exchange = 'events';
  await channel.assertExchange(exchange, 'topic', { durable: false });

  // Coda dedicata a Order Service per gli eventi OrderSubmitted
  const qok = await channel.assertQueue('order_service_queue', { durable: false });
  const queueName = qok.queue;
  // Bind della coda all'exchange per ricevere solo eventi con routing key "OrderSubmitted"
  await channel.bindQueue(queueName, exchange, 'OrderSubmitted');

  console.log("OrderService: in ascolto di eventi 'OrderSubmitted'...");

  // Consuma i messaggi di ordine inviati
  await channel.consume(queueName, async (msg) => {
    if (msg) {
      const content = msg.content.toString();
      const orderEvent = JSON.parse(content);
      console.log("OrderService: ricevuto OrderSubmitted:", orderEvent);

      // Simula elaborazione ordine (es.: creazione ordine nel database)
      const newOrderId = Math.floor(Math.random() * 10000);  // id fittizio
      // Crea evento di conferma
      const resultEvent = { orderId: newOrderId, status: 'created', ...orderEvent };
      // Pubblica l'evento OrderCreated sull'exchange
      channel.publish(exchange, 'OrderCreated', Buffer.from(JSON.stringify(resultEvent)));
      console.log("OrderService: pubblicato evento OrderCreated:", resultEvent);

      channel.ack(msg);  // conferma messaggio originale come elaborato
    }
  }, { noAck: false });
}

start().catch(err => console.error("Errore OrderService:", err));
