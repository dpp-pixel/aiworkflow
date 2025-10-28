package com.example.util;

/**
 * 문자열 유틸리티 클래스
 */
public class StringUtils {
    
    public static boolean isEmpty(String str) {
        return str == null || str.length() == 0;
    }
    
    public static boolean isNotEmpty(String str) {
        return !isEmpty(str);
    }
    
    /**
     * 매우 긴 메서드 예제 - 확실히 접혀야 함
     */
    public static String processComplexString(String input, boolean normalize, boolean trim, String prefix) {
        if (input == null) {
            return null;
        }
        
        String result = input;
        
        // Step 1: Trimming
        if (trim) {
            result = result.trim();
        }
        
        // Step 2: Normalization  
        if (normalize) {
            result = result.toLowerCase();
            result = result.replaceAll("\\s+", " ");
            result = result.replaceAll("[^a-zA-Z0-9\\s]", "");
        }
        
        // Step 3: Prefix handling
        if (prefix != null && !prefix.isEmpty()) {
            if (!result.startsWith(prefix)) {
                result = prefix + result;
            }
        }
        
        // Step 4: Additional validations
        if (result.length() > 1000) {
            result = result.substring(0, 1000);
        }
        
        // Step 5: Final cleanup
        result = result.trim();
        
        return result;
    }
}