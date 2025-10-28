# Java E-Commerce 시스템

복잡한 클래스 간의 상호 연결과 의존성을 보여주는 종합적인 Java E-Commerce 시스템입니다.

## 🏗️ 프로젝트 구조

```
test_workspace/
└── com/ecommerce/
    ├── ECommerceApplication.java     # 메인 애플리케이션
    ├── store/                        # 핵심 비즈니스 로직 패키지
    │   ├── Product.java              # 제품 정보 클래스
    │   ├── ProductManager.java       # 제품 관리
    │   ├── InventorySystem.java      # 재고 관리 시스템
    │   ├── CustomerManager.java      # 고객 관리
    │   ├── LoyaltyProgram.java       # 로열티 프로그램
    │   ├── Order.java                # 주문 정보
    │   ├── OrderItem.java            # 주문 아이템
    │   ├── OrderProcessor.java       # 주문 처리
    │   ├── PaymentProcessor.java     # 결제 처리
    │   ├── RefundManager.java        # 환불 관리
    │   └── ShippingManager.java      # 배송 관리
    ├── analytics/                    # 분석 및 리포팅 패키지
    │   ├── SalesAnalytics.java       # 매출 분석
    │   ├── InventoryAnalytics.java   # 재고 분석
    │   └── RecommendationEngine.java # 추천 시스템
    └── utils/                        # 유틸리티 패키지
        ├── DatabaseManager.java      # 데이터베이스 관리
        ├── EmailService.java         # 이메일 알림
        ├── SMSService.java           # SMS 알림
        └── DataValidator.java        # 데이터 검증
```

## 🔗 클래스 간 의존성 관계

### 메인 애플리케이션
- **`ECommerceApplication`**
  - 모든 서브시스템을 조율하는 메인 애플리케이션
  - 19개의 다른 클래스를 직접 의존

### Store 패키지 (핵심 도메인)
- **`ProductManager`** ← `DatabaseManager`
- **`InventorySystem`** ← `ProductManager`
- **`CustomerManager`** ← `DatabaseManager`, `DataValidator`
- **`LoyaltyProgram`** ← `CustomerManager`
- **`OrderProcessor`** ← `InventorySystem`, `PaymentProcessor`, `ShippingManager`
- **`PaymentProcessor`** ← `DataValidator`
- **`RefundManager`** ← `PaymentProcessor`
- **`ShippingManager`** ← `EmailService`

### Analytics 패키지 (분석 레이어)
- **`SalesAnalytics`** ← `DatabaseManager`
- **`InventoryAnalytics`** ← `InventorySystem`
- **`RecommendationEngine`** ← `CustomerManager`, `SalesAnalytics`

### Utils 패키지 (인프라 레이어)
- **`DatabaseManager`** - 데이터 저장소
- **`EmailService`** - 이메일 알림
- **`SMSService`** - SMS 알림
- **`DataValidator`** - 데이터 검증

## 🎯 주요 특징

### 1. 복잡한 의존성 그래프
- **19개의 주요 클래스**가 서로 복잡하게 연결
- 단일 주문 처리에 **8개 클래스**가 협력
- **3단계 계층구조** (인프라 → 도메인 → 애플리케이션)

### 2. 실제 비즈니스 로직
- 재고 관리 (예약, 확정, 취소)
- 결제 처리 (검증, 처리, 환불)
- 고객 관리 및 로열티 시스템
- 추천 알고리즘 (협업필터링, 컨텐츠기반)

### 3. 풍부한 데이터 구조
- **Enum 클래스**: OrderStatus 등
- **데이터 클래스**: Product, Order, Customer, Payment 등
- **내부 클래스**: PaymentResult, InventoryStatus 등

### 4. 현실적인 복잡성
- 오류 처리 및 검증 로직
- 동시성 처리 (ConcurrentHashMap)
- 이벤트 기반 알림 시스템
- 분석 및 리포팅 기능

## 🚀 실행 방법

```bash
cd test_workspace
javac com/ecommerce/ECommerceApplication.java
java com.ecommerce.ECommerceApplication
```

## 📊 클래스 분석에 적합한 이유

1. **규모**: 19개 주요 클래스, 100+ 메서드
2. **복잡성**: 다층 의존성, 실제 비즈니스 로직
3. **현실성**: 실제 E-Commerce 도메인 모델링
4. **다양성**: 다양한 Java 패턴 및 구조
5. **확장성**: 모듈식 구조로 확장 가능

현재 개발 중인 앱의 그래프 뷰와 메인 패널에서 이 복잡한 Java 클래스 구조를 시각적으로 탐색하고 분석할 수 있습니다.