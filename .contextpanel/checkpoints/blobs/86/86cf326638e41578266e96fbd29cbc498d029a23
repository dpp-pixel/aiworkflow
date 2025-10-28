package com.ecommerce.analytics;

import com.ecommerce.store.InventorySystem;
import java.util.List;
import java.util.Map;

/**
 * 재고 분석 및 예측 클래스
 */
public class InventoryAnalytics {
    private InventorySystem inventorySystem;

    public InventoryAnalytics(InventorySystem inventorySystem) {
        this.inventorySystem = inventorySystem;
    }

    /**
     * 재고 현황 리포트 생성
     */
    public InventoryReport generateStockReport() {
        Map<String, InventorySystem.InventoryStatus> status = inventorySystem.getInventoryStatus();
        List<String> lowStockProducts = inventorySystem.getLowStockProducts();

        InventoryReport report = new InventoryReport(status, lowStockProducts);
        System.out.println("📦 재고 리포트: 총 " + status.size() + "개 상품, 부족 " + lowStockProducts.size() + "개");
        return report;
    }

    /**
     * 재고 회전율 분석
     */
    public double calculateTurnoverRate(String productId) {
        // 재고 회전율 계산 로직 (샘플)
        return 4.2; // 연 4.2회 회전
    }

    /**
     * 재고 예측 및 발주 제안
     */
    public Map<String, Integer> generateRestockSuggestions() {
        List<String> lowStockProducts = inventorySystem.getLowStockProducts();
        // 발주 제안 로직
        return Map.of("PROD_0001", 20, "PROD_0002", 50);
    }

    /**
     * 재고 리포트 데이터 클래스
     */
    public static class InventoryReport {
        private Map<String, InventorySystem.InventoryStatus> stockStatus;
        private List<String> lowStockProducts;

        public InventoryReport(Map<String, InventorySystem.InventoryStatus> stockStatus,
                              List<String> lowStockProducts) {
            this.stockStatus = stockStatus;
            this.lowStockProducts = lowStockProducts;
        }

        public Map<String, InventorySystem.InventoryStatus> getStockStatus() { return stockStatus; }
        public List<String> getLowStockProducts() { return lowStockProducts; }
    }
}