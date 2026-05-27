package com.demo.showcase;

public enum Status {
    ACTIVE("활성"),
    INACTIVE("비활성"),
    PENDING("대기"),
    DELETED("삭제");

    private final String label;

    Status(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isAlive() {
        return this == ACTIVE || this == PENDING;
    }
}
