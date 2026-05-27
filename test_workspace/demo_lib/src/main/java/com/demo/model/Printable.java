package com.demo.model;

public interface Printable {
    void print();

    default String format(String prefix) {
        return prefix + toString();
    }
}
