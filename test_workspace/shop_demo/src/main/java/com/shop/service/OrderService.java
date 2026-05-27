package com.shop.service;

import com.shop.model.Order;
import com.shop.model.Product;
import com.shop.repository.ProductRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class OrderService {
    private final ProductRepository productRepository;
    private final Map<Long, Order> orderStore = new HashMap<>();
    private long nextOrderId = 1;

    public OrderService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public Order createOrder(String customerName, Map<Long, Integer> productQtyMap) {
        Order order = new Order(nextOrderId++, customerName);
        for (Map.Entry<Long, Integer> entry : productQtyMap.entrySet()) {
            Product product = productRepository.findById(entry.getKey())
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
            order.addItem(product, entry.getValue());
        }
        order.confirm();
        orderStore.put(order.getId(), order);
        return order;
    }

    public List<Order> getAllOrders() {
        return new ArrayList<>(orderStore.values());
    }

    public Order getOrder(Long id) {
        Order order = orderStore.get(id);
        if (order == null) throw new IllegalArgumentException("Order not found: " + id);
        return order;
    }
}
