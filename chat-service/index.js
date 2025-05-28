// chat-service/index.js (Microservizio di chat con validazione AJV)
const amqp = require('amqplib');
const Ajv = require('ajv');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const chatSentSchema = require('./schemas/ChatMessageSent.schema.json');
const chatSchema     = require('./schemas/ChatMessage.schema.json');

const ajv = new Ajv();
const validateIn  = ajv.compile(chatSentSchema);
const validateOut = ajv.compile(chatSchema);

async function start() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  const exchange = 'events';
  await channel.assertExchange(exchange, 'topic', { durable: false });

  const q = await channel.assertQueue('chat_service_queue', { durable: false });
  await channel.bindQueue(q.queue, exchange, 'ChatMessageSent');
  console.log("ChatService: in ascolto di 'ChatMessageSent'");

  await channel.consume(q.queue, (msg) => {
    if (!msg) return;

    const data = JSON.parse(msg.content.toString());
    if (!validateIn(data)) {
      console.error("Invalid ChatMessageSent:", validateIn.errors);
      channel.ack(msg);
      return;
    }

    // Estrazione del payload validato
    const { sender, text: userText } = data;
    console.log("ChatService: ricevuto messaggio chat:", data);

    // Logica di risposta del chatbot
    let botReplyText;
    if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('ciao')) {
      botReplyText = "Ciao! Come posso aiutarti?";
    } else {
      botReplyText = `Echo: ${userText}`;
    }

    // Prepara eventi in uscita
    const userMessageEvent = { sender: 'user', text: userText };
    const botMessageEvent  = { sender: 'bot', text: botReplyText };

    // Validazione output e pubblicazione
    if (!validateOut(userMessageEvent) || !validateOut(botMessageEvent)) {
      console.error("Invalid ChatMessage payload:", validateOut.errors || validateOut.errors);
    } else {
      channel.publish(exchange, 'ChatMessage', Buffer.from(JSON.stringify(userMessageEvent)));
      channel.publish(exchange, 'ChatMessage', Buffer.from(JSON.stringify(botMessageEvent)));
      console.log("ChatService: pubblicati eventi ChatMessage per utente e bot");
    }

    channel.ack(msg);
  }, { noAck: false });
}

start().catch(err => console.error("ChatService error:", err));
