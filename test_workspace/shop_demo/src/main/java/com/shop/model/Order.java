package com.shop.model;

import java.util.List;
import java.util.ArrayList;

public class Order {
    private Long id;
    private String customerName;
    private List<OrderItem> items;
    private OrderStatus status;

    public Order(Long id, String customerName) {
        this.id = id;
        this.customerName = customerName;
        this.items = new ArrayList<>();
        this.status = OrderStatus.PENDING;
    }

    public void addItem(Product product, int qty) {
        product.decreaseStock(qty);
        items.add(new OrderItem(product, qty));
    }

    public double getTotalPrice() {
        return items.stream()
            .mapToDouble(item -> item.getProduct().getPrice() * item.getQty())
            .sum();
    }

    public void confirm() {
        if (items.isEmpty()) throw new IllegalStateException("Order has no items");
        this.status = OrderStatus.CONFIRMED;
    }

    public Long getId() { return id; }
    public String getCustomerName() { return customerName; }
    public List<OrderItem> getItems() { return items; }
    public OrderStatus getStatus() { return status; }
}
