package com.ecommerce.store;

import com.ecommerce.vo.Product;
import com.ecommerce.vo.OrderItem;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 재고 관리 시스템
 * 제품별 재고 수량 관리와 예약 시스템을 제공
 */
public class InventorySystem {
    private ProductManager productManager;
    private Map<String, Integer> stockLevels;
    private Map<String, Integer> reservedStock;
    private Map<String, Integer> minStockLevels;

    public InventorySystem(ProductManager productManager) {
        this.productManager = productManager;
        this.stockLevels = new ConcurrentHashMap<>();
        this.reservedStock = new ConcurrentHashMap<>();
        this.minStockLevels = new ConcurrentHashMap<>();

        initializeDefaultStock();
    }

    /**
     * 기본 재고 초기화 (제품이 추가된 후에 호출)
     */
    public void initializeDefaultStock() {
        // 제품이 존재하는 경우에만 재고 설정
        if (productManager.productExists("PROD_0001")) {
            setStockLevel("PROD_0001", 50);  // 노트북
            setMinStockLevel("PROD_0001", 5);
        }
        if (productManager.productExists("PROD_0002")) {
            setStockLevel("PROD_0002", 100); // 마우스
            setMinStockLevel("PROD_0002", 20);
        }
        if (productManager.productExists("PROD_0003")) {
            setStockLevel("PROD_0003", 75);  // 키보드
            setMinStockLevel("PROD_0003", 15);
        }
        if (productManager.productExists("PROD_0004")) {
            setStockLevel("PROD_0004", 30);  // 모니터
            setMinStockLevel("PROD_0004", 5);
        }
        if (productManager.productExists("PROD_0005")) {
            setStockLevel("PROD_0005", 60);  // 헤드폰
            setMinStockLevel("PROD_0005", 10);
        }
    }

    /**
     * 재고 수량 설정
     */
    public void setStockLevel(String productId, int quantity) {
        if (!productManager.productExists(productId)) {
            throw new IllegalArgumentException("존재하지 않는 제품: " + productId);
        }

        stockLevels.put(productId, quantity);
        System.out.println("재고 설정: " + productId + " = " + quantity + "개");
    }

    /**
     * 현재 재고 수량 조회
     */
    public int getStockLevel(String productId) {
        return stockLevels.getOrDefault(productId, 0);
    }

    /**
     * 사용 가능한 재고 수량 (총 재고 - 예약된 재고)
     */
    public int getAvailableStock(String productId) {
        int total = getStockLevel(productId);
        int reserved = reservedStock.getOrDefault(productId, 0);
        return Math.max(0, total - reserved);
    }

    /**
     * 재고 가용성 확인
     */
    public boolean checkAvailability(List<OrderItem> items) {
        for (OrderItem item : items) {
            int available = getAvailableStock(item.getProductId());
            if (available < item.getQuantity()) {
                System.out.println("재고 부족: " + item.getProductId() +
                                 " (요청: " + item.getQuantity() + ", 가능: " + available + ")");
                return false;
            }
        }
        return true;
    }

    /**
     * 재고 예약 (주문 시 임시로 재고를 차단)
     */
    public boolean reserveItems(List<OrderItem> items) {
        // 먼저 모든 아이템의 가용성 확인
        if (!checkAvailability(items)) {
            return false;
        }

        // 모든 아이템을 예약
        for (OrderItem item : items) {
            String productId = item.getProductId();
            int currentReserved = reservedStock.getOrDefault(productId, 0);
            reservedStock.put(productId, currentReserved + item.getQuantity());
        }

        System.out.println("재고 예약 완료: " + items.size() + "개 상품");
        return true;
    }

    /**
     * 예약된 재고를 확정 (실제 재고에서 차감)
     */
    public boolean confirmReservation(List<OrderItem> items) {
        for (OrderItem item : items) {
            String productId = item.getProductId();
            int quantity = item.getQuantity();

            // 실제 재고에서 차감
            int currentStock = stockLevels.getOrDefault(productId, 0);
            stockLevels.put(productId, currentStock - quantity);

            // 예약에서 제거
            int currentReserved = reservedStock.getOrDefault(productId, 0);
            reservedStock.put(productId, Math.max(0, currentReserved - quantity));
        }

        System.out.println("재고 확정: " + items.size() + "개 상품");
        checkLowStockAlerts();
        return true;
    }

    /**
     * 재고 예약 취소
     */
    public void cancelReservation(List<OrderItem> items) {
        for (OrderItem item : items) {
            String productId = item.getProductId();
            int quantity = item.getQuantity();

            int currentReserved = reservedStock.getOrDefault(productId, 0);
            reservedStock.put(productId, Math.max(0, currentReserved - quantity));
        }

        System.out.println("재고 예약 취소: " + items.size() + "개 상품");
    }

    /**
     * 재고 보충
     */
    public void restockProduct(String productId, int quantity) {
        if (!productManager.productExists(productId)) {
            throw new IllegalArgumentException("존재하지 않는 제품: " + productId);
        }

        int currentStock = stockLevels.getOrDefault(productId, 0);
        stockLevels.put(productId, currentStock + quantity);

        System.out.println("재고 보충: " + productId + " +" + quantity + "개 (총: " +
                         stockLevels.get(productId) + "개)");
    }

    /**
     * 최소 재고 레벨 설정
     */
    public void setMinStockLevel(String productId, int minLevel) {
        minStockLevels.put(productId, minLevel);
    }

    /**
     * 재고 부족 경고 확인
     */
    private void checkLowStockAlerts() {
        for (Map.Entry<String, Integer> entry : stockLevels.entrySet()) {
            String productId = entry.getKey();
            int currentStock = entry.getValue();
            int minLevel = minStockLevels.getOrDefault(productId, 0);

            if (currentStock <= minLevel) {
                Product product = productManager.getProduct(productId);
                String productName = product != null ? product.getName() : productId;
                System.out.println("⚠️ 재고 부족 경고: " + productName +
                                 " (현재: " + currentStock + "개, 최소: " + minLevel + "개)");
            }
        }
    }

    /**
     * 재고 부족 제품 목록 반환
     */
    public List<String> getLowStockProducts() {
        List<String> lowStockProducts = new ArrayList<>();

        for (Map.Entry<String, Integer> entry : stockLevels.entrySet()) {
            String productId = entry.getKey();
            int currentStock = entry.getValue();
            int minLevel = minStockLevels.getOrDefault(productId, 0);

            if (currentStock <= minLevel) {
                lowStockProducts.add(productId);
            }
        }

        return lowStockProducts;
    }

    /**
     * 전체 재고 현황 반환
     */
    public Map<String, InventoryStatus> getInventoryStatus() {
        Map<String, InventoryStatus> status = new HashMap<>();

        for (String productId : stockLevels.keySet()) {
            int total = stockLevels.get(productId);
            int reserved = reservedStock.getOrDefault(productId, 0);
            int available = total - reserved;
            int minLevel = minStockLevels.getOrDefault(productId, 0);

            status.put(productId, new InventoryStatus(total, reserved, available, minLevel));
        }

        return status;
    }

    /**
     * 재고 상태 정보 클래스
     */
    public static class InventoryStatus {
        private final int totalStock;
        private final int reservedStock;
        private final int availableStock;
        private final int minStockLevel;

        public InventoryStatus(int totalStock, int reservedStock, int availableStock, int minStockLevel) {
            this.totalStock = totalStock;
            this.reservedStock = reservedStock;
            this.availableStock = availableStock;
            this.minStockLevel = minStockLevel;
        }

        public int getTotalStock() { return totalStock; }
        public int getReservedStock() { return reservedStock; }
        public int getAvailableStock() { return availableStock; }
        public int getMinStockLevel() { return minStockLevel; }
        public boolean isLowStock() { return totalStock <= minStockLevel; }
    }
}