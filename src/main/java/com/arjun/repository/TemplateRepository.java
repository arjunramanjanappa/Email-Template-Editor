package com.arjun.repository;

import com.arjun.model.Template;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemplateRepository extends JpaRepository<Template, Long> {

    /** Lightweight list query — excludes large HTML content for performance. */
    @Query("SELECT new com.arjun.model.Template() FROM Template t ORDER BY t.updatedAt DESC")
    List<Template> findAllSummary();

    List<Template> findAllByOrderByUpdatedAtDesc();
}
