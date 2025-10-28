package com.example;

import java.util.List;
import java.util.ArrayList;

/**
 * 간단한 텍스트 파서 클래스
 */
public class Parser {
    private String content;
    private int position;
    
    public Parser(String content) {
        this.content = content;
        this.position = 0;
    }
    
    /**
     * 짧은 메서드 - 접히지 않음
     */
    public String getContent() {
        return content;
    }
    
    /**
     * 긴 메서드 - 접혀야 함 (20줄 이상)
     */
    public List<String> parseTokens(String delimiter) {
        List<String> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            
            if (delimiter.indexOf(c) >= 0) {
                if (current.length() > 0) {
                    tokens.add(current.toString());
                    current = new StringBuilder();
                }
            } else {
                current.append(c);
            }
        }
        
        if (current.length() > 0) {
            tokens.add(current.toString());
        }
        
        // 추가 처리 로직들...
        for (String token : tokens) {
            token = token.trim();
            if (token.isEmpty()) {
                continue;
            }
            // 더 많은 처리...
        }
        
        return tokens;
    }
    
    public void reset() {
        position = 0;
    }
    
    public boolean hasNext() {
        return position < content.length();
    }
    
    /**
     * 이 메서드는 baseline에만 있음 - removed로 표시되어야 함
     */
    public String getDebugInfo() {
        return "Position: " + position + ", Length: " + content.length();
    }
}