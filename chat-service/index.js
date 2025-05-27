// chat-service/index.js (Microservizio di chat)
const amqp = require('amqplib');
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

async function start() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  const exchange = 'events';
  await channel.assertExchange(exchange, 'topic', { durable: false });

  // Coda per i messaggi chat (ascolta i messaggi inviati dall'utente)
  const q = await channel.assertQueue('chat_service_queue', { durable: false });
  await channel.bindQueue(q.queue, exchange, 'ChatMessageSent');
  console.log("ChatService: in ascolto di 'ChatMessageSent'");

  await channel.consume(q.queue, (msg) => {
    if (msg) {
      const chatMsg = JSON.parse(msg.content.toString());
      console.log("ChatService: ricevuto messaggio chat:", chatMsg);

      // Estrarre il testo inviato dall'utente
      const userText = chatMsg.text;

      // *** Logica di risposta del chatbot ***
      // Qui si potrebbe implementare un AI/ML oppure una semplice regola.
      // Per dimostrazione, facciamo una risposta fissa o basata sul testo.
      let botReplyText;
      if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('ciao')) {
        botReplyText = "Ciao! Come posso aiutarti?";
      } else {
        botReplyText = `Echo: ${userText}`;  // risponde ripetendo il messaggio
      }

      // Preparare l'evento di messaggio chat da inviare ai client.
      const userMessageEvent = { sender: 'user', text: userText };
      const botMessageEvent = { sender: 'bot', text: botReplyText };

      // Pubblica l'evento per il messaggio dell'utente (così tutti i client vedono il messaggio nella chat)
      channel.publish(exchange, 'ChatMessage', Buffer.from(JSON.stringify(userMessageEvent)));
      // Pubblica l'evento per la risposta del bot
      channel.publish(exchange, 'ChatMessage', Buffer.from(JSON.stringify(botMessageEvent)));
      console.log("ChatService: pubblicati eventi ChatMessage per utente e bot");

      channel.ack(msg);
    }
  }, { noAck: false });
}

start().catch(err => console.error(err));
