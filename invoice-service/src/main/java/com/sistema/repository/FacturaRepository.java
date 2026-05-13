package com.sistema.repository;

import com.sistema.model.Factura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FacturaRepository extends JpaRepository<Factura, Long> {
    // Spring Data JPA implementará automáticamente los métodos CRUD.
    // No necesitas añadir código aquí por ahora.
}