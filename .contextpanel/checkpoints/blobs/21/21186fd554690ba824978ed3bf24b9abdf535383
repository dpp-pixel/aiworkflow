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
     * 짧은 메서드 - 접히지 않음 (수정됨)
     */
    public String getContent() {
        // 새로운 로직 추가
        if (content == null) {
            return "";
        }
        return content.trim();
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
     * 새로 추가된 메서드 - added 상태로 표시되어야 함
     */
    public int getPosition() {
        return position;
    }
    
    /**
     * 또 다른 새 메서드
     */
    public void setPosition(int newPosition) {
        if (newPosition >= 0 && newPosition <= content.length()) {
            this.position = newPosition;
        }
    }
}