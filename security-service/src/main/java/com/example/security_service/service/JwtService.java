package com.example.security_service.service;

import com.example.security_service.dto.CustomerAuthDto;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    public String generateToken(CustomerAuthDto customer) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", customer.getEmail());
        claims.put("role", customer.getRole());
        claims.put("id", customer.getId());

        Date now = new Date();
        Date expiration = new Date(now.getTime() + 24L * 60L * 60L * 1000L);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(customer.getEmail())
                .setIssuedAt(now)
                .setExpiration(expiration)
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    private Key getSignKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}