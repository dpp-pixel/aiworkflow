package com.ecommerce.store;

public class RefundManager {
    private PaymentProcessor paymentProcessor;

    public RefundManager(PaymentProcessor paymentProcessor) {
        this.paymentProcessor = paymentProcessor;
    }

    public boolean processRefund(String orderId, double amount) {
        System.out.println("환불 처리: " + orderId + " (₩" + amount + ")");
        return true;
    }
}