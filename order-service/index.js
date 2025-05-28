// order-service/index.js (Microservizio di gestione ordini con validazione AJV)
const amqp = require('amqplib');
const Ajv = require('ajv');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const orderSchema = require('./schemas/OrderSubmitted.schema.json');

const ajv = new Ajv();
const validateOrder = ajv.compile(orderSchema);

async function start() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  const exchange = 'events';
  await channel.assertExchange(exchange, 'topic', { durable: false });

  const q = await channel.assertQueue('order_service_queue', { durable: false });
  await channel.bindQueue(q.queue, exchange, 'OrderSubmitted');
  console.log("OrderService: in ascolto di 'OrderSubmitted'...");

  await channel.consume(q.queue, async (msg) => {
    if (!msg) return;

    const orderEvent = JSON.parse(msg.content.toString());
    if (!validateOrder(orderEvent)) {
      console.error("Invalid OrderSubmitted:", validateOrder.errors);
      channel.ack(msg);
      return;
    }

    console.log("OrderService: ricevuto OrderSubmitted:", orderEvent);

    // Simula elaborazione ordine
    const newOrderId = Math.floor(Math.random() * 10000);
    const resultEvent = {
      orderId: newOrderId,
      status: 'created',
      ...orderEvent
    };

    // Pubblica evento di conferma OrderCreated
    channel.publish(exchange, 'OrderCreated', Buffer.from(JSON.stringify(resultEvent)));
    console.log("OrderService: pubblicato evento OrderCreated:", resultEvent);

    channel.ack(msg);
  }, { noAck: false });
}

start().catch(err => console.error("OrderService error:", err));
