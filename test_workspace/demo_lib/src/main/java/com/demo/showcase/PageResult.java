package com.demo.showcase;

import java.util.List;

public record PageResult<T>(List<T> items, int page, int totalPages, int totalCount) {

    public boolean hasNext() {
        return page < totalPages - 1;
    }

    public boolean hasPrev() {
        return page > 0;
    }

    public boolean isEmpty() {
        return items == null || items.isEmpty();
    }
}
