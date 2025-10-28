package com.ecommerce.store;

import java.util.List;
import java.util.ArrayList;

public class OrderProcessor {
    private InventorySystem inventorySystem;
    private PaymentProcessor paymentProcessor;
    private ShippingManager shippingManager;

    public OrderProcessor(InventorySystem inventorySystem,
                         PaymentProcessor paymentProcessor,
                         ShippingManager shippingManager) {
        this.inventorySystem = inventorySystem;
        this.paymentProcessor = paymentProcessor;
        this.shippingManager = shippingManager;
    }

    public List<Order> getPendingOrders() {
        // 샘플 주문 생성
        List<Order> orders = new ArrayList<>();
        Order sampleOrder = new Order("ORD_0001", "CUST_0001", "서울시 강남구");
        sampleOrder.addItem(new OrderItem("PROD_0001", 1, 1500000.0));
        orders.add(sampleOrder);
        return orders;
    }

    public boolean processOrder(Order order) {
        return inventorySystem.checkAvailability(order.getItems());
    }
}