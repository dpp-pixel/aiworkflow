package com.ecommerce.vo;

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

/**
 * 주문 클래스
 */
public class Order {
    public enum OrderStatus {
        PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
    }

    private String id;
    private String customerId;
    private List<OrderItem> items;
    private double totalAmount;
    private OrderStatus status;
    private LocalDateTime createdAt;
    private String shippingAddress;

    public Order(String id, String customerId, String shippingAddress) {
        this.id = id;
        this.customerId = customerId;
        this.shippingAddress = shippingAddress;
        this.items = new ArrayList<>();
        this.status = OrderStatus.PENDING;
        this.createdAt = LocalDateTime.now();
        this.totalAmount = 0.0;
    }

    public void addItem(OrderItem item) {
        items.add(item);
        recalculateTotal();
    }

    private void recalculateTotal() {
        totalAmount = items.stream()
                          .mapToDouble(OrderItem::getTotalPrice)
                          .sum();
    }

    // Getters
    public String getId() { return id; }
    public String getCustomer() { return customerId; }
    public List<OrderItem> getItems() { return new ArrayList<>(items); }
    public double getTotalAmount() { return totalAmount; }
    public OrderStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getShippingAddress() { return shippingAddress; }

    public void setStatus(OrderStatus status) { this.status = status; }
}