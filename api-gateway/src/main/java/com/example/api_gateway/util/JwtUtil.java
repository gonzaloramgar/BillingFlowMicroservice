package com.example.api_gateway.util;

// Nota: utilidades JWT para generar, validar y extraer claims.
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.security.Key;

@Component
public class JwtUtil {

    // Lee la clave secreta desde GitHub (vía Config-Server)
    @Value("${jwt.secret}")
    private String secret;

    public void validateToken(final String token) {
        // Si la firma, expiracion o formato son invalidos, JJWT lanza excepcion.
        Jwts.parserBuilder().setSigningKey(getSignKey()).build().parseClaimsJws(token);
    }

    private Key getSignKey() {
        // La clave llega en Base64 desde configuracion centralizada.
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}

