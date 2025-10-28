package com.ecommerce.store;

import com.ecommerce.utils.DataValidator;

public class PaymentProcessor {
    private DataValidator validator;

    public PaymentProcessor(DataValidator validator) {
        this.validator = validator;
    }

    public PaymentResult processPayment(Order order) {
        // 결제 로직 시뮬레이션
        if (order.getTotalAmount() > 0) {
            System.out.println("결제 처리: " + order.getId() + " (₩" + order.getTotalAmount() + ")");
            return new PaymentResult(true, "결제 성공");
        }
        return new PaymentResult(false, "결제 실패");
    }

    public static class PaymentResult {
        private boolean success;
        private String message;

        public PaymentResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public boolean isSuccess() { return success; }
        public String getMessage() { return message; }
    }
}