package com.ecommerce.store;

import java.util.HashMap;
import java.util.Map;

public class LoyaltyProgram {
    private CustomerManager customerManager;
    private Map<String, Integer> loyaltyPoints;

    public LoyaltyProgram(CustomerManager customerManager) {
        this.customerManager = customerManager;
        this.loyaltyPoints = new HashMap<>();
    }

    public void awardPoints(String customerId, double purchaseAmount) {
        int points = (int) (purchaseAmount / 1000); // 1000원당 1포인트
        loyaltyPoints.put(customerId, loyaltyPoints.getOrDefault(customerId, 0) + points);
        System.out.println("포인트 적립: " + customerId + " +" + points + "P");
    }

    public int getPoints(String customerId) {
        return loyaltyPoints.getOrDefault(customerId, 0);
    }
}