package com.ecommerce.utils;

import com.ecommerce.store.Order;

/**
 * 데이터 검증 유틸리티
 */
public class DataValidator {

    public DataValidator() {
        System.out.println("✅ 데이터 검증 서비스 초기화");
    }

    /**
     * 주문 검증
     */
    public boolean validateOrder(Order order) {
        if (order == null) {
            System.out.println("❌ 주문 검증 실패: null 주문");
            return false;
        }

        if (order.getItems().isEmpty()) {
            System.out.println("❌ 주문 검증 실패: 빈 주문");
            return false;
        }

        if (order.getTotalAmount() <= 0) {
            System.out.println("❌ 주문 검증 실패: 잘못된 금액");
            return false;
        }

        System.out.println("✅ 주문 검증 성공: " + order.getId());
        return true;
    }

    /**
     * 이메일 형식 검증
     */
    public boolean validateEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }
        return email.contains("@") && email.contains(".");
    }

    /**
     * 전화번호 형식 검증
     */
    public boolean validatePhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            return false;
        }
        // 간단한 한국 전화번호 형식 검증
        return phoneNumber.matches("^01[0-9]-[0-9]{4}-[0-9]{4}$");
    }

    /**
     * 가격 유효성 검증
     */
    public boolean validatePrice(double price) {
        return price > 0 && price <= 10000000; // 최대 천만원
    }

    /**
     * 재고 수량 검증
     */
    public boolean validateQuantity(int quantity) {
        return quantity > 0 && quantity <= 1000; // 최대 1000개
    }

    /**
     * 제품명 검증
     */
    public boolean validateProductName(String productName) {
        if (productName == null || productName.trim().isEmpty()) {
            return false;
        }
        return productName.length() >= 2 && productName.length() <= 100;
    }

    /**
     * 고객명 검증
     */
    public boolean validateCustomerName(String customerName) {
        if (customerName == null || customerName.trim().isEmpty()) {
            return false;
        }
        return customerName.length() >= 2 && customerName.length() <= 50;
    }

    /**
     * 종합 유효성 검사 결과
     */
    public ValidationResult validateCustomerData(String name, String email, String phone) {
        boolean isValid = validateCustomerName(name) &&
                         validateEmail(email) &&
                         validatePhoneNumber(phone);

        return new ValidationResult(isValid, isValid ? "검증 성공" : "데이터 형식 오류");
    }

    /**
     * 검증 결과 클래스
     */
    public static class ValidationResult {
        private boolean valid;
        private String message;

        public ValidationResult(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }

        public boolean isValid() { return valid; }
        public String getMessage() { return message; }
    }
}