package com.ecommerce.store;

/**
 * 주문 아이템 클래스
 * 주문에 포함된 개별 상품 정보를 나타냄
 */
public class OrderItem {
    private String productId;
    private int quantity;
    private double unitPrice;

    public OrderItem(String productId, int quantity, double unitPrice) {
        this.productId = productId;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public String getProductId() { return productId; }
    public int getQuantity() { return quantity; }
    public double getUnitPrice() { return unitPrice; }
    public double getTotalPrice() { return quantity * unitPrice; }

    @Override
    public String toString() {
        return String.format("OrderItem{productId='%s', quantity=%d, unitPrice=%.2f, total=%.2f}",
                           productId, quantity, unitPrice, getTotalPrice());
    }
}