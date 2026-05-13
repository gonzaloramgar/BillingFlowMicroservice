package com.sistema.repository;

// Nota: repositorio JPA para consultas y persistencia.
import com.sistema.model.Factura;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FacturaRepository extends JpaRepository<Factura, Long> {
    // Spring Data JPA implementará automáticamente los métodos CRUD.
    // Filtrado por propietario autenticado (email del usuario que creó la factura).
    // Compatibilidad: si ownerEmail aún es null (datos antiguos), se usa cliente=email como fallback.
    @Query("SELECT f FROM Factura f WHERE f.ownerEmail = :ownerEmail OR (f.ownerEmail IS NULL AND f.cliente = :ownerEmail)")
    List<Factura> findVisibleByOwnerEmail(@Param("ownerEmail") String ownerEmail);

    // Búsqueda segura por id + propietario para evitar acceso por enumeración de IDs.
    @Query("SELECT f FROM Factura f WHERE f.id = :id AND (f.ownerEmail = :ownerEmail OR (f.ownerEmail IS NULL AND f.cliente = :ownerEmail))")
    Optional<Factura> findVisibleByIdAndOwnerEmail(@Param("id") Long id, @Param("ownerEmail") String ownerEmail);

    // EXISTS se usa para comprobaciones rápidas de autorización antes de borrar.
    @Query("SELECT COUNT(f) > 0 FROM Factura f WHERE f.id = :id AND (f.ownerEmail = :ownerEmail OR (f.ownerEmail IS NULL AND f.cliente = :ownerEmail))")
    boolean existsVisibleByIdAndOwnerEmail(@Param("id") Long id, @Param("ownerEmail") String ownerEmail);
}

