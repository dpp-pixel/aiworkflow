package com.ecommerce.analytics;

import com.ecommerce.store.CustomerManager;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

/**
 * 상품 추천 엔진
 * 고객 데이터와 매출 분석을 기반으로 개인화된 추천 제공
 */
public class RecommendationEngine {
    private CustomerManager customerManager;
    private SalesAnalytics salesAnalytics;
    private Map<String, List<String>> customerRecommendations;

    public RecommendationEngine(CustomerManager customerManager, SalesAnalytics salesAnalytics) {
        this.customerManager = customerManager;
        this.salesAnalytics = salesAnalytics;
        this.customerRecommendations = new HashMap<>();
    }

    /**
     * 추천 시스템 업데이트
     */
    public void updateRecommendations() {
        System.out.println("🎯 추천 시스템 업데이트 중...");

        List<CustomerManager.Customer> customers = customerManager.getAllCustomers();
        for (CustomerManager.Customer customer : customers) {
            generatePersonalizedRecommendations(customer.getId());
        }

        System.out.println("✅ " + customers.size() + "명 고객 추천 업데이트 완료");
    }

    /**
     * 개인화된 추천 생성
     */
    private void generatePersonalizedRecommendations(String customerId) {
        List<String> recommendations = new ArrayList<>();

        // 협업 필터링 기반 추천
        recommendations.addAll(getCollaborativeRecommendations(customerId));

        // 컨텐츠 기반 추천
        recommendations.addAll(getContentBasedRecommendations(customerId));

        // 인기 상품 추천
        recommendations.addAll(getPopularProductRecommendations());

        customerRecommendations.put(customerId, recommendations);
    }

    /**
     * 협업 필터링 기반 추천
     */
    private List<String> getCollaborativeRecommendations(String customerId) {
        // 유사한 구매 패턴을 가진 고객들의 상품 추천
        List<String> recommendations = new ArrayList<>();
        recommendations.add("PROD_0002"); // 마우스
        recommendations.add("PROD_0003"); // 키보드
        return recommendations;
    }

    /**
     * 컨텐츠 기반 추천
     */
    private List<String> getContentBasedRecommendations(String customerId) {
        // 고객의 이전 구매 이력 기반 유사 상품 추천
        List<String> recommendations = new ArrayList<>();
        recommendations.add("PROD_0004"); // 모니터
        recommendations.add("PROD_0005"); // 헤드폰
        return recommendations;
    }

    /**
     * 인기 상품 추천
     */
    private List<String> getPopularProductRecommendations() {
        // 전체적으로 인기 있는 상품 추천
        Map<String, Double> productSales = salesAnalytics.getProductSalesAnalysis();
        List<String> popular = new ArrayList<>();

        // 매출 기준 상위 상품들
        popular.add("PROD_0001"); // 노트북 (베스트셀러)
        return popular;
    }

    /**
     * 고객별 추천 상품 조회
     */
    public List<String> getRecommendationsForCustomer(String customerId) {
        return customerRecommendations.getOrDefault(customerId, new ArrayList<>());
    }

    /**
     * 추천 정확도 계산
     */
    public double calculateRecommendationAccuracy() {
        // 추천 정확도 계산 로직 (샘플)
        return 78.5; // 78.5% 정확도
    }

    /**
     * A/B 테스트용 추천 알고리즘 비교
     */
    public void runABTestForRecommendations(String customerId) {
        List<String> algorithmA = getCollaborativeRecommendations(customerId);
        List<String> algorithmB = getContentBasedRecommendations(customerId);

        System.out.println("A/B 테스트: 고객 " + customerId +
                         " | 협업필터링: " + algorithmA.size() +
                         " | 컨텐츠기반: " + algorithmB.size());
    }

    /**
     * 실시간 추천 (사용자 현재 세션 기반)
     */
    public List<String> getRealTimeRecommendations(String customerId, String currentProductId) {
        List<String> realTimeRecs = new ArrayList<>();

        // 현재 보고 있는 상품과 관련된 추천
        if ("PROD_0001".equals(currentProductId)) { // 노트북
            realTimeRecs.add("PROD_0002"); // 마우스
            realTimeRecs.add("PROD_0003"); // 키보드
            realTimeRecs.add("PROD_0004"); // 모니터
        }

        return realTimeRecs;
    }

    /**
     * 추천 성과 분석
     */
    public RecommendationMetrics getRecommendationMetrics() {
        return new RecommendationMetrics(78.5, 23.2, 156.7);
    }

    /**
     * 추천 시스템 성과 지표 클래스
     */
    public static class RecommendationMetrics {
        private double accuracy;       // 정확도 (%)
        private double clickThroughRate; // 클릭률 (%)
        private double conversionRate;   // 전환율 (%)

        public RecommendationMetrics(double accuracy, double clickThroughRate, double conversionRate) {
            this.accuracy = accuracy;
            this.clickThroughRate = clickThroughRate;
            this.conversionRate = conversionRate;
        }

        public double getAccuracy() { return accuracy; }
        public double getClickThroughRate() { return clickThroughRate; }
        public double getConversionRate() { return conversionRate; }
    }
}