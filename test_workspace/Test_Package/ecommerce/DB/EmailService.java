package com.ecommerce.utils;

/**
 * 이메일 알림 서비스
 */
public class EmailService {

    public EmailService() {
        System.out.println("📧 이메일 서비스 초기화");
    }

    /**
     * 재고 부족 알림 발송
     */
    public void sendOutOfStockNotification(String customerId) {
        System.out.println("📧 재고 부족 알림 발송: " + customerId);
    }

    /**
     * 배송 알림 발송
     */
    public void sendShippingNotification(String customerId, String orderId) {
        System.out.println("📧 배송 알림 발송: 고객 " + customerId + ", 주문 " + orderId);
    }

    /**
     * 주문 확인 이메일 발송
     */
    public void sendOrderConfirmation(String customerId, String orderId) {
        System.out.println("📧 주문 확인 이메일: 고객 " + customerId + ", 주문 " + orderId);
    }

    /**
     * 프로모션 이메일 발송
     */
    public void sendPromotionalEmail(String customerId, String promoContent) {
        System.out.println("📧 프로모션 이메일 발송: " + customerId);
    }

    /**
     * 환불 처리 알림
     */
    public void sendRefundNotification(String customerId, double refundAmount) {
        System.out.println("📧 환불 알림: 고객 " + customerId + ", ₩" + refundAmount);
    }
}