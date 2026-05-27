package com.demo.model;

public enum Category {
    BOOK("도서"),
    MUSIC("음악"),
    VIDEO("영상");

    private final String label;

    Category(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isMedia() {
        return this == MUSIC || this == VIDEO;
    }
}
