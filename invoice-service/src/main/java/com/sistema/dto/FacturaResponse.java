package com.sistema.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
import java.time.LocalDateTime;

public class FacturaResponse {
    private Long id;
    private String cliente;
    private Double montoBase;
    private Double iva;
    private Double irpf;
    private Double total;
    private LocalDateTime fechaEmision;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCliente() {
        return cliente;
    }

    public void setCliente(String cliente) {
        this.cliente = cliente;
    }

    public Double getMontoBase() {
        return montoBase;
    }

    public void setMontoBase(Double montoBase) {
        this.montoBase = montoBase;
    }

    public Double getIva() {
        return iva;
    }

    public void setIva(Double iva) {
        this.iva = iva;
    }

    public Double getIrpf() {
        return irpf;
    }

    public void setIrpf(Double irpf) {
        this.irpf = irpf;
    }

    public Double getTotal() {
        return total;
    }

    public void setTotal(Double total) {
        this.total = total;
    }

    public LocalDateTime getFechaEmision() {
        return fechaEmision;
    }

    public void setFechaEmision(LocalDateTime fechaEmision) {
        this.fechaEmision = fechaEmision;
    }
}


