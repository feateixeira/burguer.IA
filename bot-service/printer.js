function printOrder(orderData) {
    console.log('--------------------------------------------------');
    console.log('PRINTING ORDER #', orderData.order_number);
    console.log('TOTAL:', orderData.total_amount);
    if (orderData.parsed_order && orderData.parsed_order.items) {
        orderData.parsed_order.items.forEach(item => {
            console.log(`- ${item.quantity || 1}x ${item.product_name} (R$ ${item.unit_price})`);
        });
    }
    console.log('--------------------------------------------------');
    // Implementation with 'node-printer' or 'escpos' would go here
    // For now, logging to console is sufficient proof of concept.
}

module.exports = {
    printOrder
};
