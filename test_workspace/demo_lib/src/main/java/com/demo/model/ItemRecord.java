package com.demo.model;

public record ItemRecord(String id, String title, Category category, int price) {

    public boolean isExpensive() {
        return price > 50000;
    }

    public String summary() {
        return "[" + category.getLabel() + "] " + title + " (" + price + "원)";
    }
}
