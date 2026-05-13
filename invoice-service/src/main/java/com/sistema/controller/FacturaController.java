package com.sistema.controller;

import com.sistema.model.Factura;
import com.sistema.repository.FacturaRepository;
import org.apache.fop.apps.Fop;
import org.apache.fop.apps.FopFactory;
import org.apache.fop.apps.MimeConstants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import javax.xml.transform.*;
import javax.xml.transform.sax.SAXResult;
import javax.xml.transform.stream.StreamSource;
import java.io.*;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/facturas")
public class FacturaController {

    @Autowired
    private FacturaRepository repository;

    // 1. CREAR FACTURA Y GENERAR PDF (POST)
    @PostMapping
    public ResponseEntity<byte[]> crearFactura(@RequestBody Factura factura) {
        try {
            // Lógica de negocio: asegurar que los cálculos existan
            if (factura.getMontoBase() == null) factura.setMontoBase(0.0);
            if (factura.getIva() == null) factura.setIva(factura.getMontoBase() * 0.21);
            if (factura.getTotal() == null) factura.setTotal(factura.getMontoBase() + factura.getIva());
            
            // La fecha se asigna en el Model (@PrePersist), pero la aseguramos para el XML inmediato
            if (factura.getFechaEmision() == null) {
                factura.setFechaEmision(java.time.LocalDateTime.now());
            }

            // Guardar en MySQL
            Factura facturaGuardada = repository.save(factura);

            // Generar el PDF
            String xml = convertirFacturaAXml(facturaGuardada);
            return generarPdfResponse(xml, "factura_" + facturaGuardada.getId() + ".pdf");

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 2. RECUPERAR PDF DE UNA FACTURA EXISTENTE (GET)
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> obtenerPdfFactura(@PathVariable Long id) {
        try {
            Optional<Factura> facturaOpt = repository.findById(id);
            if (facturaOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

            String xml = convertirFacturaAXml(facturaOpt.get());
            return generarPdfResponse(xml, "factura_recuperada_" + id + ".pdf");

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 3. LISTAR TODAS LAS FACTURAS EN JSON (GET)
    @GetMapping
    public List<Factura> listarTodas() {
        return repository.findAll();
    }

    // 4. ELIMINAR FACTURA (DELETE)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarFactura(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // --- MÉTODOS DE APOYO (PRIVATE) ---

    /**
     * Transforma el objeto Factura a un String XML compatible con la plantilla XSL-FO
     */
    private String convertirFacturaAXml(Factura f) {
        DateTimeFormatter formato = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        String fechaStr = f.getFechaEmision().format(formato);

        return "<factura>" +
                "<id>" + f.getId() + "</id>" +
                "<cliente>" + f.getCliente() + "</cliente>" +
                "<montoBase>" + String.format("%.2f", f.getMontoBase()) + "</montoBase>" +
                "<iva>" + String.format("%.2f", f.getIva()) + "</iva>" +
                "<total>" + String.format("%.2f", f.getTotal()) + "</total>" +
                "<fecha>" + fechaStr + "</fecha>" +
               "</factura>";
    }

    /**
     * Procesa el XML con la plantilla XSL y devuelve un ResponseEntity con el PDF
     */
    private ResponseEntity<byte[]> generarPdfResponse(String xml, String filename) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        
        // Configurar FOP
        FopFactory fopFactory = FopFactory.newInstance(new File(".").toURI());
        Fop fop = fopFactory.newFop(MimeConstants.MIME_PDF, out);
        
        // Configurar Transformación
        TransformerFactory factory = TransformerFactory.newInstance();
        InputStream xslStream = getClass().getResourceAsStream("/plantilla.xsl");
        
        if (xslStream == null) {
            throw new FileNotFoundException("No se encontró el archivo plantilla.xsl en src/main/resources");
        }

        Transformer transformer = factory.newTransformer(new StreamSource(xslStream));
        
        // Ejecutar transformación
        Source src = new StreamSource(new StringReader(xml));
        Result res = new SAXResult(fop.getDefaultHandler());
        transformer.transform(src, res);

        // Preparar respuesta HTTP
        byte[] pdfBytes = out.toByteArray();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.builder("attachment").filename(filename).build());

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }
}