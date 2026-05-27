package com.arjun.controller;

import com.arjun.dto.PreviewRequestDTO;
import com.arjun.dto.TemplateDTO;
import com.arjun.service.PreviewService;
import com.arjun.service.TemplateService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    private final TemplateService templateService;
    private final PreviewService previewService;

    public TemplateController(TemplateService templateService, PreviewService previewService) {
        this.templateService = templateService;
        this.previewService = previewService;
    }

    // ─── CRUD ──────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<TemplateDTO>> listTemplates() {
        return ResponseEntity.ok(templateService.getAllTemplates());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TemplateDTO> getTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(templateService.getTemplateById(id));
    }

    @PostMapping
    public ResponseEntity<TemplateDTO> createTemplate(@RequestBody TemplateDTO dto) {
        return ResponseEntity.ok(templateService.createTemplate(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TemplateDTO> updateTemplate(
            @PathVariable Long id, @RequestBody TemplateDTO dto) {
        return ResponseEntity.ok(templateService.updateTemplate(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        templateService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    // ─── Preview ───────────────────────────────────────────────────────────────

    /**
     * POST /api/templates/{id}/preview
     * Body: { "parameters": { "customerName": "John", "orderTotal": "150.00" } }
     * Returns: rendered HTML string
     */
    @PostMapping("/{id}/preview")
    public ResponseEntity<String> preview(
            @PathVariable Long id, @RequestBody PreviewRequestDTO request) {
        String rendered = previewService.renderPreview(id, request.getParameters());
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(rendered);
    }

    // ─── Export ────────────────────────────────────────────────────────────────

    /**
     * GET /api/templates/{id}/export
     * Downloads the template as a .ftl file.
     */
    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> exportFtl(@PathVariable Long id) {
        TemplateDTO template = templateService.getTemplateById(id);
        String ftlContent = template.getFtlContent() != null
                ? template.getFtlContent()
                : template.getHtmlContent();

        String filename = sanitizeFilename(template.getName()) + ".ftl";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", filename);

        return ResponseEntity.ok()
                .headers(headers)
                .body(ftlContent != null
                        ? ftlContent.getBytes(StandardCharsets.UTF_8)
                        : new byte[0]);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private String sanitizeFilename(String name) {
        if (name == null) return "template";
        return name.replaceAll("[^a-zA-Z0-9_\\-]", "_").toLowerCase();
    }

    // ─── Global error handler ──────────────────────────────────────────────────

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleError(RuntimeException ex) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", ex.getMessage()));
    }
}
