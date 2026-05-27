package com.arjun.service;

import com.arjun.model.Template;
import com.arjun.repository.TemplateRepository;
import freemarker.template.Configuration;
import freemarker.template.TemplateException;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringWriter;
import java.util.Map;

@Service
public class PreviewService {

    private final TemplateRepository templateRepository;

    public PreviewService(TemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    /**
     * Renders a stored FTL template with the provided parameter values.
     *
     * @param templateId  ID of the stored template
     * @param parameters  Map of FTL variable name → value
     * @return Rendered HTML string
     */
    public String renderPreview(Long templateId, Map<String, Object> parameters) {
        Template template = templateRepository.findById(templateId)
                .orElseThrow(() -> new RuntimeException("Template not found: " + templateId));

        // Prefer FTL content, fall back to HTML content
        String ftlContent = template.getFtlContent();
        if (ftlContent == null || ftlContent.isBlank()) {
            ftlContent = template.getHtmlContent();
        }
        if (ftlContent == null || ftlContent.isBlank()) {
            return "<html><body><p>Template has no content.</p></body></html>";
        }

        return renderFtl(ftlContent, parameters);
    }

    /**
     * Renders an FTL string directly (used for ad-hoc preview from raw content).
     */
    public String renderFtl(String ftlContent, Map<String, Object> parameters) {
        try {
            Configuration cfg = new Configuration(Configuration.VERSION_2_3_33);
            cfg.setDefaultEncoding("UTF-8");
            cfg.setLogTemplateExceptions(false);
            cfg.setWrapUncheckedExceptions(true);
            // Relax undefined variable handling so preview works even if params are missing
            cfg.setClassicCompatible(true);

            // Note: freemarker.template.Template (not com.arjun.model.Template)
            freemarker.template.Template ftl = new freemarker.template.Template(
                    "preview", ftlContent, cfg);

            StringWriter writer = new StringWriter();
            ftl.process(parameters != null ? parameters : Map.of(), writer);
            return writer.toString();

        } catch (IOException | TemplateException e) {
            throw new RuntimeException("Failed to render FTL template: " + e.getMessage(), e);
        }
    }
}
