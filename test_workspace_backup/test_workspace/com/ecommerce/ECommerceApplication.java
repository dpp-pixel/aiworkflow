package com.ecommerce;

import com.ecommerce.store.*;
import com.ecommerce.analytics.*;
import com.ecommerce.utils.*;
import com.ecommerce.store.PaymentProcessor.PaymentResult;
import java.util.List;
import java.util.logging.Logger;
import java.util.logging.Level;

/**
 * E-Commerce 시스템 메인 애플리케이션
 * 다양한 클래스와 패키지 간의 관계를 보여주는 예시 프로그램
 */
public class ECommerceApplication {
    private static final Logger logger = Logger.getLogger(ECommerceApplication.class.getName());

    // 데이터베이스 및 유틸리티
    private DatabaseManager dbManager;
    private EmailService emailService;
    private SMSService smsService;
    private DataValidator validator;

    // 핵심 비즈니스 로직
    private ProductManager productManager;
    private InventorySystem inventorySystem;
    private CustomerManager customerManager;
    private LoyaltyProgram loyaltyProgram;

    // 주문 및 결제 시스템
    private PaymentProcessor paymentProcessor;
    private RefundManager refundManager;
    private ShippingManager shippingManager;
    private OrderProcessor orderProcessor;

    // 분석 및 추천 시스템
    private SalesAnalytics salesAnalytics;
    private InventoryAnalytics inventoryAnalytics;
    private RecommendationEngine recommendationEngine;

    /**
     * 메인 애플리케이션 클래스 생성자 - 모든 서브시스템을 조율
     */
    public ECommerceApplication() {
        initializeSystem();
        logger.info("E-Commerce 애플리케이션 초기화 완료");
    }

    /**
     * 시스템 초기화
     */
    private void initializeSystem() {
        // 데이터베이스 및 유틸리티 초기화
        this.dbManager = new DatabaseManager();
        this.emailService = new EmailService();
        this.smsService = new SMSService();
        this.validator = new DataValidator();

        // 핵심 비즈니스 로직 초기화
        this.productManager = new ProductManager(dbManager);
        this.inventorySystem = new InventorySystem(productManager);
        this.customerManager = new CustomerManager(dbManager, validator);
        this.loyaltyProgram = new LoyaltyProgram(customerManager);

        // 주문 및 결제 시스템
        this.paymentProcessor = new PaymentProcessor(validator);
        this.refundManager = new RefundManager(paymentProcessor);
        this.shippingManager = new ShippingManager(emailService);
        this.orderProcessor = new OrderProcessor(
            inventorySystem,
            paymentProcessor,
            shippingManager
        );

        // 분석 및 추천 시스템
        this.salesAnalytics = new SalesAnalytics(dbManager);
        this.inventoryAnalytics = new InventoryAnalytics(inventorySystem);
        this.recommendationEngine = new RecommendationEngine(
            customerManager,
            salesAnalytics
        );
    }

    /**
     * 애플리케이션 시작
     */
    public void startApplication() {
        System.out.println("🛒 E-Commerce 시스템 시작");

        // 시스템 상태 확인
        checkSystemHealth();

        // 샘플 데이터 로드
        loadSampleData();

        // 제품 추가 후 재고 초기화
        inventorySystem.initializeDefaultStock();

        // 메인 루프 실행
        runMainLoop();
    }

    /**
     * 시스템 건강성 체크
     */
    private void checkSystemHealth() {
        if (!dbManager.isConnected()) {
            throw new RuntimeException("데이터베이스 연결 실패");
        }

        System.out.println("✅ 모든 시스템이 정상 작동 중");
    }

    /**
     * 샘플 데이터 로드
     */
    private void loadSampleData() {
        // 제품 추가
        productManager.addProduct("노트북", 1500000.0, "전자제품");
        productManager.addProduct("마우스", 50000.0, "전자제품");
        productManager.addProduct("키보드", 150000.0, "전자제품");
        productManager.addProduct("모니터", 300000.0, "전자제품");
        productManager.addProduct("헤드폰", 200000.0, "전자제품");

        // 고객 추가
        customerManager.registerCustomer("김철수", "kim@email.com");
        customerManager.registerCustomer("이영희", "lee@email.com");
        customerManager.registerCustomer("박민수", "park@email.com");
        customerManager.registerCustomer("최수진", "choi@email.com");
    }

    /**
     * 메인 애플리케이션 루프
     */
    private void runMainLoop() {
        try {
            // 새 주문 처리
            List<Order> orders = orderProcessor.getPendingOrders();
            for (Order order : orders) {
                processOrder(order);
            }

            // 분석 리포트 생성
            generateDailyReports();

            // 추천 시스템 업데이트
            recommendationEngine.updateRecommendations();

            System.out.println("📈 시스템 처리 완료");

        } catch (Exception e) {
            logger.log(Level.SEVERE, "메인 루프 실행 중 오류 발생", e);
        }
    }

    /**
     * 주문 처리 프로세스
     */
    public boolean processOrder(Order order) {
        try {
            // 주문 검증
            if (!validator.validateOrder(order)) {
                return false;
            }

            // 재고 확인
            if (!inventorySystem.checkAvailability(order.getItems())) {
                emailService.sendOutOfStockNotification(order.getCustomer());
                return false;
            }

            // 결제 처리
            PaymentResult paymentResult = paymentProcessor.processPayment(order);
            if (!paymentResult.isSuccess()) {
                return false;
            }

            // 재고 차감
            inventorySystem.reserveItems(order.getItems());

            // 배송 준비
            shippingManager.prepareShipment(order);

            // 로열티 포인트 적립
            loyaltyProgram.awardPoints(order.getCustomer(), order.getTotalAmount());

            System.out.println("✅ 주문 " + order.getId() + " 처리 완료");
            return true;

        } catch (Exception e) {
            logger.log(Level.SEVERE, "주문 처리 실패: " + e.getMessage(), e);
            return false;
        }
    }

    /**
     * 일일 리포트 생성
     */
    private void generateDailyReports() {
        salesAnalytics.generateDailyReport();
        inventoryAnalytics.generateStockReport();

        System.out.println("📊 일일 리포트 생성 완료");
    }

    /**
     * 메인 메서드
     */
    public static void main(String[] args) {
        ECommerceApplication app = new ECommerceApplication();
        app.startApplication();
    }
}