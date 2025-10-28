package com.ecommerce.analytics;

import com.ecommerce.utils.DatabaseManager;
import java.util.Map;
import java.util.HashMap;

/**
 * 매출 분석 및 리포팅 클래스
 */
public class SalesAnalytics {
    private DatabaseManager dbManager;
    private Map<String, Double> dailySales;

    public SalesAnalytics(DatabaseManager dbManager) {
        this.dbManager = dbManager;
        this.dailySales = new HashMap<>();
    }

    /**
     * 일일 매출 리포트 생성
     */
    public SalesReport generateDailyReport() {
        double totalSales = calculateDailySales();
        int orderCount = getOrderCount();
        double averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0.0;

        SalesReport report = new SalesReport(totalSales, orderCount, averageOrderValue);
        System.out.println("📊 일일 매출 리포트: 총매출 ₩" + totalSales + ", 주문수 " + orderCount);
        return report;
    }

    private double calculateDailySales() {
        // 샘플 매출 데이터
        return 2500000.0; // 250만원
    }

    private int getOrderCount() {
        return 15; // 15건
    }

    /**
     * 제품별 매출 분석
     */
    public Map<String, Double> getProductSalesAnalysis() {
        Map<String, Double> productSales = new HashMap<>();
        productSales.put("PROD_0001", 1500000.0); // 노트북
        productSales.put("PROD_0002", 300000.0);  // 마우스 (6개)
        productSales.put("PROD_0003", 450000.0);  // 키보드 (3개)
        return productSales;
    }

    /**
     * 매출 성장률 계산
     */
    public double calculateGrowthRate() {
        // 이전 기간 대비 성장률 (샘플)
        return 15.5; // 15.5% 성장
    }

    /**
     * 매출 리포트 데이터 클래스
     */
    public static class SalesReport {
        private double totalSales;
        private int orderCount;
        private double averageOrderValue;

        public SalesReport(double totalSales, int orderCount, double averageOrderValue) {
            this.totalSales = totalSales;
            this.orderCount = orderCount;
            this.averageOrderValue = averageOrderValue;
        }

        public double getTotalSales() { return totalSales; }
        public int getOrderCount() { return orderCount; }
        public double getAverageOrderValue() { return averageOrderValue; }
    }
}