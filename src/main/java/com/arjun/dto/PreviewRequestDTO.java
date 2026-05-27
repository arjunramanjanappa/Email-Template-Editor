package com.arjun.dto;

import lombok.Data;

import java.util.Map;

/**
 * Request body for template preview.
 * Parameters map keys are the FTL variable names,
 * values are what gets substituted at runtime.
 *
 * Example JSON:
 * {
 *   "parameters": {
 *     "customerName": "John Doe",
 *     "orderTotal": "150.00",
 *     "orderDate": "2024-01-15"
 *   }
 * }
 */
@Data
public class PreviewRequestDTO {
    private Map<String, Object> parameters;
}
