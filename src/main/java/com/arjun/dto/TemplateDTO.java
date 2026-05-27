package com.arjun.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TemplateDTO {
    private Long id;
    private String name;
    private String description;
    private String htmlContent;
    private String ftlContent;
    private List<ParameterDTO> parameters;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
