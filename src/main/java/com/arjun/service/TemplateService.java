package com.arjun.service;

import com.arjun.dto.ParameterDTO;
import com.arjun.dto.TemplateDTO;
import com.arjun.model.Template;
import com.arjun.model.TemplateParameter;
import com.arjun.repository.TemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class TemplateService {

    private final TemplateRepository templateRepository;

    public TemplateService(TemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    // ─── Read ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TemplateDTO> getAllTemplates() {
        return templateRepository.findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(this::toSummaryDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TemplateDTO getTemplateById(Long id) {
        Template t = findOrThrow(id);
        return toFullDTO(t);
    }

    // ─── Write ─────────────────────────────────────────────────────────────────

    public TemplateDTO createTemplate(TemplateDTO dto) {
        Template template = new Template();
        applyDTO(template, dto);
        return toFullDTO(templateRepository.save(template));
    }

    public TemplateDTO updateTemplate(Long id, TemplateDTO dto) {
        Template template = findOrThrow(id);
        applyDTO(template, dto);
        return toFullDTO(templateRepository.save(template));
    }

    public void deleteTemplate(Long id) {
        if (!templateRepository.existsById(id)) {
            throw new RuntimeException("Template not found: " + id);
        }
        templateRepository.deleteById(id);
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    private Template findOrThrow(Long id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));
    }

    private void applyDTO(Template template, TemplateDTO dto) {
        template.setName(dto.getName());
        template.setDescription(dto.getDescription());
        template.setHtmlContent(dto.getHtmlContent());

        // FTL content defaults to HTML content when not explicitly provided
        String ftl = dto.getFtlContent();
        template.setFtlContent((ftl != null && !ftl.isBlank()) ? ftl : dto.getHtmlContent());

        // Replace all parameters (orphan removal handles deletions)
        template.getParameters().clear();
        if (dto.getParameters() != null) {
            int order = 0;
            for (ParameterDTO pDto : dto.getParameters()) {
                TemplateParameter p = new TemplateParameter();
                p.setTemplate(template);
                p.setName(pDto.getName());
                p.setLabel(pDto.getLabel() != null ? pDto.getLabel() : pDto.getName());
                p.setDescription(pDto.getDescription());
                p.setDefaultValue(pDto.getDefaultValue());
                p.setType(pDto.getType() != null ? pDto.getType() : "STRING");
                p.setRequired(pDto.isRequired());
                p.setSortOrder(order++);
                template.getParameters().add(p);
            }
        }
    }

    /** Summary DTO — no HTML content (for the template list page). */
    private TemplateDTO toSummaryDTO(Template t) {
        TemplateDTO dto = new TemplateDTO();
        dto.setId(t.getId());
        dto.setName(t.getName());
        dto.setDescription(t.getDescription());
        dto.setCreatedAt(t.getCreatedAt());
        dto.setUpdatedAt(t.getUpdatedAt());
        if (t.getParameters() != null) {
            dto.setParameters(t.getParameters().stream()
                    .map(this::toParamDTO)
                    .collect(Collectors.toList()));
        }
        return dto;
    }

    /** Full DTO — includes HTML/FTL content. */
    private TemplateDTO toFullDTO(Template t) {
        TemplateDTO dto = toSummaryDTO(t);
        dto.setHtmlContent(t.getHtmlContent());
        dto.setFtlContent(t.getFtlContent());
        return dto;
    }

    private ParameterDTO toParamDTO(TemplateParameter p) {
        ParameterDTO dto = new ParameterDTO();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setLabel(p.getLabel());
        dto.setDescription(p.getDescription());
        dto.setDefaultValue(p.getDefaultValue());
        dto.setType(p.getType());
        dto.setRequired(p.isRequired());
        dto.setSortOrder(p.getSortOrder());
        return dto;
    }
}
