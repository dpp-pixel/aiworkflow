package com.ecommerce.utils;

import com.ecommerce.store.Product;
import com.ecommerce.store.CustomerManager.Customer;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 데이터베이스 관리 클래스
 * SQLite 기반 데이터 저장소 시뮬레이션
 */
public class DatabaseManager {
    private Map<String, Product> productDatabase;
    private Map<String, Customer> customerDatabase;
    private boolean connected;

    public DatabaseManager() {
        this.productDatabase = new ConcurrentHashMap<>();
        this.customerDatabase = new ConcurrentHashMap<>();
        this.connected = true;
        System.out.println("📊 데이터베이스 연결 완료");
    }

    /**
     * 연결 상태 확인
     */
    public boolean isConnected() {
        return connected;
    }

    /**
     * 제품 저장
     */
    public void saveProduct(Product product) {
        productDatabase.put(product.getId(), product);
        System.out.println("💾 제품 저장: " + product.getId());
    }

    /**
     * 제품 업데이트
     */
    public void updateProduct(Product product) {
        productDatabase.put(product.getId(), product);
        System.out.println("🔄 제품 업데이트: " + product.getId());
    }

    /**
     * 제품 삭제
     */
    public void deleteProduct(String productId) {
        productDatabase.remove(productId);
        System.out.println("🗑️ 제품 삭제: " + productId);
    }

    /**
     * 고객 저장
     */
    public void saveCustomer(Customer customer) {
        customerDatabase.put(customer.getId(), customer);
        System.out.println("💾 고객 저장: " + customer.getId());
    }

    /**
     * 데이터베이스 백업
     */
    public boolean backupDatabase() {
        System.out.println("💾 데이터베이스 백업 중...");
        // 백업 로직 시뮬레이션
        return true;
    }

    /**
     * 트랜잭션 시작
     */
    public void beginTransaction() {
        System.out.println("🔄 트랜잭션 시작");
    }

    /**
     * 트랜잭션 커밋
     */
    public void commitTransaction() {
        System.out.println("✅ 트랜잭션 커밋");
    }

    /**
     * 트랜잭션 롤백
     */
    public void rollbackTransaction() {
        System.out.println("↩️ 트랜잭션 롤백");
    }

    /**
     * 연결 종료
     */
    public void close() {
        connected = false;
        System.out.println("📊 데이터베이스 연결 종료");
    }
}