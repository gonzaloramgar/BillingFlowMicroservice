package com.sistema.controller;

// Nota: controlador REST, expone endpoints HTTP del servicio.
import com.sistema.dto.FacturaRequest;
import com.sistema.dto.FacturaResponse;
import com.sistema.model.Factura;
import com.sistema.repository.FacturaRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.apache.fop.apps.Fop;
import org.apache.fop.apps.FopFactory;
import org.apache.fop.apps.MimeConstants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import javax.xml.transform.*;
import javax.xml.transform.sax.SAXResult;
import javax.xml.transform.stream.StreamSource;
import java.io.*;
import java.security.Key;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@CrossOrigin(origins = {"http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5501", "http://localhost:5501"})
@RequestMapping("/api/facturas")
public class FacturaController {

    @Autowired
    private FacturaRepository repository;

    @Value("${jwt.secret}")
    private String jwtSecret;

    private static final int MAX_CLIENTE_LENGTH = 50;

    // 1. CREAR FACTURA Y GENERAR PDF (POST)
    @PostMapping
    public ResponseEntity<byte[]> crearFactura(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody FacturaRequest request) {
        try {
            // ownerEmail identifica al usuario autenticado que será dueño de la factura.
            String ownerEmail = extractAuthenticatedEmail(authHeader);
            if (ownerEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            String cliente = request.getCliente() == null ? "" : request.getCliente().trim();
            if (cliente.isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
            if (cliente.length() > MAX_CLIENTE_LENGTH) {
                cliente = cliente.substring(0, MAX_CLIENTE_LENGTH);
            }

            Factura factura = toEntity(request);
            factura.setCliente(cliente);
            // Seguridad: ownerEmail identifica al usuario dueño, cliente es el dato visible de la factura.
            factura.setOwnerEmail(ownerEmail);

            // Lógica de negocio: asegurar que los cálculos existan
            if (factura.getMontoBase() == null) factura.setMontoBase(0.0);
            if (factura.getIva() == null) factura.setIva(factura.getMontoBase() * 0.21);
            if (factura.getIrpf() == null) factura.setIrpf(0.0);
            if (factura.getTotal() == null) factura.setTotal(factura.getMontoBase() + factura.getIva() - factura.getIrpf());
            
            // La fecha se asigna en el Model (@PrePersist), pero la aseguramos para el XML inmediato
            if (factura.getFechaEmision() == null) {
                factura.setFechaEmision(LocalDate.now());
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
    public ResponseEntity<byte[]> obtenerPdfFactura(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id) {
        try {
            // Seguridad por recurso: solo el propietario puede recuperar el PDF por id.
            String ownerEmail = extractAuthenticatedEmail(authHeader);
            if (ownerEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            Optional<Factura> facturaOpt = repository.findVisibleByIdAndOwnerEmail(id, ownerEmail);
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
    public ResponseEntity<List<FacturaResponse>> listarTodas(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        String ownerEmail = extractAuthenticatedEmail(authHeader);
        if (ownerEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(null);
        }

        // Incluye fallback para facturas legacy donde ownerEmail era null y cliente guardaba el email.
        List<FacturaResponse> facturas = repository.findVisibleByOwnerEmail(ownerEmail)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(facturas);
    }

    private Key getSignKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    // 4. ELIMINAR FACTURA (DELETE)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarFactura(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id) {
        String ownerEmail = extractAuthenticatedEmail(authHeader);
        if (ownerEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Bloquea borrados por enumeración de IDs entre usuarios.
        if (!repository.existsVisibleByIdAndOwnerEmail(id, ownerEmail)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String extractAuthenticatedEmail(String authHeader) {
        if (authHeader == null || authHeader.isEmpty()) {
            return null;
        }

        try {
            // Admite formato Bearer y token plano para pruebas manuales.
            String token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
            Claims claims = Jwts.parserBuilder().setSigningKey(getSignKey()).build().parseClaimsJws(token).getBody();

            // Orden de prioridad para compatibilidad con distintos emisores de JWT.
            String subject = claims.getSubject();
            if (subject != null && !subject.isBlank()) {
                return subject;
            }

            String emailClaim = claims.get("email", String.class);
            if (emailClaim != null && !emailClaim.isBlank()) {
                return emailClaim;
            }

            return claims.get("correo", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    // --- MÉTODOS DE APOYO (PRIVATE) ---

    /**
     * Transforma el objeto Factura a un String XML compatible con la plantilla XSL-FO
     */
    private String convertirFacturaAXml(Factura f) {
        DateTimeFormatter formato = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        String fechaStr = f.getFechaEmision().format(formato);

        return "<factura>" +
                "<id>" + f.getId() + "</id>" +
                "<cliente>" + f.getCliente() + "</cliente>" +
                "<montoBase>" + String.format("%.2f", f.getMontoBase()) + "</montoBase>" +
                "<iva>" + String.format("%.2f", f.getIva()) + "</iva>" +
                "<irpf>" + String.format("%.2f", f.getIrpf()) + "</irpf>" +
                "<total>" + String.format("%.2f", f.getTotal()) + "</total>" +
                "<fecha>" + fechaStr + "</fecha>" +
               "</factura>";
    }

    /**
     * Procesa el XML con la plantilla XSL y devuelve un ResponseEntity con el PDF
     */
    private ResponseEntity<byte[]> generarPdfResponse(String xml, String filename) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        
        // Apache FOP: transforma XSL-FO a binario PDF.
        FopFactory fopFactory = FopFactory.newInstance(new File(".").toURI());
        Fop fop = fopFactory.newFop(MimeConstants.MIME_PDF, out);
        
        // La plantilla XSL define visualmente la factura final.
        TransformerFactory factory = TransformerFactory.newInstance();
        InputStream xslStream = getClass().getResourceAsStream("/plantilla.xsl");
        
        if (xslStream == null) {
            throw new FileNotFoundException("No se encontró el archivo plantilla.xsl en src/main/resources");
        }

        Transformer transformer = factory.newTransformer(new StreamSource(xslStream));
        
        // Pipeline: XML de factura -> XSL-FO -> PDF.
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

    private Factura toEntity(FacturaRequest request) {
        Factura factura = new Factura();
        factura.setCliente(request.getCliente());
        factura.setMontoBase(request.getMontoBase());
        factura.setIva(request.getIva());
        factura.setIrpf(request.getIrpf());
        factura.setTotal(request.getTotal());
        factura.setFechaEmision(request.getFechaEmision());
        return factura;
    }

    private FacturaResponse toResponse(Factura factura) {
        FacturaResponse response = new FacturaResponse();
        response.setId(factura.getId());
        response.setCliente(factura.getCliente());
        response.setMontoBase(factura.getMontoBase());
        response.setIva(factura.getIva());
        response.setIrpf(factura.getIrpf());
        response.setTotal(factura.getTotal());
        response.setFechaEmision(factura.getFechaEmision());
        return response;
    }
}

