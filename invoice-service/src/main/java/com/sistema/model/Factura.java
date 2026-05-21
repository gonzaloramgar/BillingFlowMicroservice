package com.sistema.model;

// Nota: modelo de dominio persistido en base de datos.
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "facturas")
public class Factura {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String cliente;

    @Column(name = "owner_email")
    private String ownerEmail;

    private Double montoBase;
    private Double iva;
    private Double irpf;
    private Double total;

    @Column(name = "fecha_emision")
    private LocalDate fechaEmision;

    // Asigna la fecha automáticamente antes de insertar en la DB
    @PrePersist
    protected void onCreate() {
        if (this.fechaEmision == null) {
            this.fechaEmision = LocalDate.now();
        }
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }

    public String getOwnerEmail() { return ownerEmail; }
    public void setOwnerEmail(String ownerEmail) { this.ownerEmail = ownerEmail; }

    public Double getMontoBase() { return montoBase; }
    public void setMontoBase(Double montoBase) { this.montoBase = montoBase; }

    public Double getIva() { return iva; }
    public void setIva(Double iva) { this.iva = iva; }

    public Double getIrpf() { return irpf; }
    public void setIrpf(Double irpf) { this.irpf = irpf; }
    
    public Double getTotal() { return total; }
    public void setTotal(Double total) { this.total = total; }

    public LocalDate getFechaEmision() { return fechaEmision; }
    public void setFechaEmision(LocalDate fechaEmision) { this.fechaEmision = fechaEmision; }
}

