package com.arjun.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api/upload")
public class FileUploadController {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"
    );

    /**
     * Upload an image file.
     * Returns JSON compatible with GrapesJS Asset Manager:
     * { "data": [{ "src": "/uploads/uuid.jpg", "type": "image" }] }
     */
    @PostMapping("/image")
    public ResponseEntity<Map<String, Object>> uploadImage(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Only image files are allowed (jpeg, png, gif, webp, svg)"));
        }

        try {
            Path dir = Paths.get(uploadDir);
            Files.createDirectories(dir);

            String originalFilename = file.getOriginalFilename();
            String ext = (originalFilename != null && originalFilename.contains("."))
                    ? originalFilename.substring(originalFilename.lastIndexOf('.'))
                    : ".jpg";
            String filename = UUID.randomUUID() + ext;

            Path dest = dir.resolve(filename);
            Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

            String url = "/uploads/" + filename;

            // GrapesJS asset manager response format
            Map<String, Object> asset = new LinkedHashMap<>();
            asset.put("src", url);
            asset.put("type", "image");
            asset.put("name", filename);

            return ResponseEntity.ok(Map.of("data", List.of(asset)));

        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    /** List all uploaded images (for asset manager gallery). */
    @GetMapping("/images")
    public ResponseEntity<Map<String, Object>> listImages() {
        try {
            Path dir = Paths.get(uploadDir);
            if (!Files.exists(dir)) {
                return ResponseEntity.ok(Map.of("data", List.of()));
            }

            List<Map<String, String>> assets = new ArrayList<>();
            try (var stream = Files.list(dir)) {
                stream.filter(p -> {
                    String name = p.getFileName().toString().toLowerCase();
                    return name.endsWith(".jpg") || name.endsWith(".jpeg")
                            || name.endsWith(".png") || name.endsWith(".gif")
                            || name.endsWith(".webp") || name.endsWith(".svg");
                }).forEach(p -> assets.add(Map.of(
                        "src", "/uploads/" + p.getFileName(),
                        "type", "image",
                        "name", p.getFileName().toString()
                )));
            }

            return ResponseEntity.ok(Map.of("data", assets));
        } catch (IOException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
