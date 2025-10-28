package com.ecommerce.utils;

/**
 * SMS 알림 서비스
 */
public class SMSService {

    public SMSService() {
        System.out.println("📱 SMS 서비스 초기화");
    }

    /**
     * 주문 확인 SMS 발송
     */
    public void sendOrderConfirmationSMS(String customerId, String orderId) {
        System.out.println("📱 주문 확인 SMS: 고객 " + customerId + ", 주문 " + orderId);
    }

    /**
     * 배송 완료 SMS 발송
     */
    public void sendDeliveryCompleteSMS(String customerId, String orderId) {
        System.out.println("📱 배송 완료 SMS: 고객 " + customerId + ", 주문 " + orderId);
    }

    /**
     * 긴급 재고 부족 알림
     */
    public void sendUrgentStockAlert(String managerId, String productId) {
        System.out.println("📱 긴급 재고 부족 SMS: 관리자 " + managerId + ", 상품 " + productId);
    }
}