package com.example.api_gateway.filter;

import com.example.api_gateway.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class AuthenticationFilter extends AbstractGatewayFilterFactory<AuthenticationFilter.Config> {

    @Autowired
    private JwtUtil jwtUtil;

    public AuthenticationFilter() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            
            // 1. Si el usuario intenta ir al Login, le dejamos pasar sin pedirle Token
            if (exchange.getRequest().getURI().getPath().contains("/security-service")) {
                return chain.filter(exchange);
            }

            // 2. Para cualquier otra ruta, comprobamos si trae la cabecera "Authorization"
            if (exchange.getRequest().getHeaders().get(HttpHeaders.AUTHORIZATION) == null) {
                return onError(exchange, HttpStatus.UNAUTHORIZED); // Error 401
            }

            // 3. Extraemos el Token de la cabecera
            String authHeader = exchange.getRequest().getHeaders().get(HttpHeaders.AUTHORIZATION).get(0);
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                authHeader = authHeader.substring(7); // Quitamos la palabra "Bearer "
            }

            // 4. Validamos que el Token no esté caducado ni falsificado
            try {
                jwtUtil.validateToken(authHeader);
            } catch (Exception e) {
                return onError(exchange, HttpStatus.UNAUTHORIZED); // Error 401 si es falso
            }

            // 5. Si todo está correcto, dejamos que la petición continúe hacia el microservicio
            return chain.filter(exchange);
        };
    }

    // Método reactivo para devolver el error 401 sin bloquear el servidor
    private Mono<Void> onError(ServerWebExchange exchange, HttpStatus httpStatus) {
        exchange.getResponse().setStatusCode(httpStatus);
        return exchange.getResponse().setComplete();
    }

    public static class Config {
        // Clase de configuración vacía requerida por Spring Cloud Gateway
    }
}