package com.ecommerce.store;

import com.ecommerce.utils.DatabaseManager;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 제품 정보 관리 클래스
 * 제품 CRUD 작업과 검색 기능을 제공
 */
public class ProductManager {
    private DatabaseManager dbManager;
    private Map<String, Product> products;
    private int nextId;

    public ProductManager(DatabaseManager dbManager) {
        this.dbManager = dbManager;
        this.products = new ConcurrentHashMap<>();
        this.nextId = 1;
    }

    /**
     * 새 제품을 추가하고 제품 ID를 반환
     */
    public String addProduct(String name, double price, String category) {
        return addProduct(name, price, category, "");
    }

    /**
     * 새 제품을 추가하고 제품 ID를 반환 (설명 포함)
     */
    public String addProduct(String name, double price, String category, String description) {
        String productId = String.format("PROD_%04d", nextId++);

        Product product = new Product(productId, name, price, category, description);
        products.put(productId, product);
        dbManager.saveProduct(product);

        System.out.println("제품 추가: " + name + " (ID: " + productId + ")");
        return productId;
    }

    /**
     * 제품 정보 조회
     */
    public Product getProduct(String productId) {
        return products.get(productId);
    }

    /**
     * 모든 제품 목록 반환
     */
    public List<Product> getAllProducts() {
        return new ArrayList<>(products.values());
    }

    /**
     * 카테고리별 제품 검색
     */
    public List<Product> getProductsByCategory(String category) {
        return products.values().stream()
                .filter(product -> product.getCategory().equals(category))
                .collect(ArrayList::new, (list, product) -> list.add(product), ArrayList::addAll);
    }

    /**
     * 가격 범위로 제품 검색
     */
    public List<Product> getProductsByPriceRange(double minPrice, double maxPrice) {
        List<Product> result = new ArrayList<>();
        for (Product product : products.values()) {
            double price = product.getPrice();
            if (price >= minPrice && price <= maxPrice) {
                result.add(product);
            }
        }
        return result;
    }

    /**
     * 제품명으로 검색 (부분 일치)
     */
    public List<Product> searchProductsByName(String keyword) {
        List<Product> result = new ArrayList<>();
        String lowerKeyword = keyword.toLowerCase();

        for (Product product : products.values()) {
            if (product.getName().toLowerCase().contains(lowerKeyword)) {
                result.add(product);
            }
        }
        return result;
    }

    /**
     * 제품 정보 업데이트
     */
    public boolean updateProduct(String productId, String name, double price, String category) {
        Product product = products.get(productId);
        if (product == null) {
            return false;
        }

        product.setName(name);
        product.setPrice(price);
        product.setCategory(category);

        dbManager.updateProduct(product);
        System.out.println("제품 업데이트: " + productId);
        return true;
    }

    /**
     * 제품 삭제
     */
    public boolean deleteProduct(String productId) {
        Product removed = products.remove(productId);
        if (removed != null) {
            dbManager.deleteProduct(productId);
            System.out.println("제품 삭제: " + productId);
            return true;
        }
        return false;
    }

    /**
     * 제품 존재 여부 확인
     */
    public boolean productExists(String productId) {
        return products.containsKey(productId);
    }

    /**
     * 전체 제품 수 반환
     */
    public int getProductCount() {
        return products.size();
    }

    /**
     * 카테고리별 제품 수 반환
     */
    public Map<String, Integer> getProductCountByCategory() {
        Map<String, Integer> categoryCount = new HashMap<>();

        for (Product product : products.values()) {
            String category = product.getCategory();
            categoryCount.put(category, categoryCount.getOrDefault(category, 0) + 1);
        }

        return categoryCount;
    }
}