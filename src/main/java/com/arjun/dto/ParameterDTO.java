package com.arjun.dto;

import lombok.Data;

@Data
public class ParameterDTO {
    private Long id;

    /** FreeMarker variable name — used as ${name} in the template. */
    private String name;

    /** Human-readable label for the UI. */
    private String label;

    /** Description of the parameter's purpose. */
    private String description;

    /** Default/sample value (used for preview). */
    private String defaultValue;

    /** Parameter type: STRING, NUMBER, DATE, BOOLEAN, LIST. */
    private String type = "STRING";

    /** Whether this parameter is required at runtime. */
    private boolean required = false;

    /** Display order in the parameters panel. */
    private int sortOrder = 0;
}
