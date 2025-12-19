const fetch = require('node-fetch');

async function handleMessage(msg, supabase, establishmentId) {
    // Basic filter: only process if it looks like an order or message.
    const sender = msg.from;
    const content = msg.body;

    if (!establishmentId) {
        console.error('ESTABLISHMENT_ID not provided');
        return;
    }

    console.log(`Processing message from ${sender} for establishment ${establishmentId}`);
    msg.reply('Recebi sua mensagem! Estou processando seu pedido...');

    // Call Supabase Edge Function to interpret message
    try {
        const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/import-whatsapp-order`;

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                whatsappText: content,
                establishmentId: establishmentId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge Function error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        if (data.success) {
            let replyText = `✅ *Pedido Criado!* #${data.order_number}\n\n`;

            // Format Items
            if (data.parsed_order && data.parsed_order.items) {
                data.parsed_order.items.forEach(item => {
                    if (item.product_name) {
                        replyText += `- ${item.quantity || 1}x ${item.product_name}\n`;
                    }
                });
            }

            replyText += `\n💰 *Total: R$ ${data.total_amount.toFixed(2)}*`;

            if (data.parsed_order && data.parsed_order.delivery_info && data.parsed_order.delivery_info.average_time) {
                replyText += `\n🕒 Tempo estimado: ${data.parsed_order.delivery_info.average_time}`;
            }

            msg.reply(replyText);

            // Server-side printing removed for SaaS architecture. 
            // Printing is now handled by the frontend client via Supabase Realtime of new orders.

        } else {
            msg.reply('Não consegui entender seu pedido perfeitamente. Poderia reformular?');
        }

    } catch (error) {
        console.error('Error executing Edge Function:', error);
        msg.reply('Tive um problema técnico. Por favor, tente novamente ou ligue para nós.');
    }
}

module.exports = {
    handleMessage
};
