package com.arjun.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "template_parameters")
@Data
@NoArgsConstructor
public class TemplateParameter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", nullable = false)
    private Template template;

    /**
     * FreeMarker variable name (e.g., "customerName").
     * Used as ${customerName} in the template.
     */
    @Column(nullable = false)
    private String name;

    /** Display label shown in the UI (e.g., "Customer Name"). */
    private String label;

    /** Description of what this parameter represents. */
    private String description;

    /** Default / sample value used for preview. */
    private String defaultValue;

    /** Parameter type: STRING, NUMBER, DATE, BOOLEAN, LIST. */
    @Column(name = "param_type", nullable = false)
    private String type = "STRING";

    /** Whether this parameter must be provided at runtime. */
    private boolean required = false;

    /** Sort order within the template parameter list. */
    @Column(name = "sort_order")
    private int sortOrder = 0;
}
