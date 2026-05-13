# BillingFlow — Sistema de Facturación para Autónomos

BillingFlow es una aplicación de facturación profesional diseñada para autónomos. Permite emitir facturas, visualizarlas y descargarlas en PDF mediante un modelo de pago único de **€10**. La aplicación está construida sobre una arquitectura de **microservicios con Spring Boot** y un frontend estático en HTML/CSS/JavaScript.

---

## Índice

- [Arquitectura general](#arquitectura-general)
- [Requisitos previos](#requisitos-previos)
- [Cómo arrancar el proyecto](#cómo-arrancar-el-proyecto)
- [Microservicios](#microservicios)
  - [Discovery Server](#1-discovery-server--puerto-8761)
  - [Config Server](#2-config-server--puerto-8888)
  - [API Gateway](#3-api-gateway--puerto-8080)
  - [Security Service](#4-security-service--puerto-9000)
  - [Payment Service](#5-payment-service--puerto-8081)
  - [Customer Service](#6-customer-service--puerto-8082)
- [Frontend](#frontend)
- [Flujos principales](#flujos-principales)
- [Seguridad](#seguridad)
- [Base de datos](#base-de-datos)
- [Variables y credenciales a configurar](#variables-y-credenciales-a-configurar)

---

## Arquitectura general

```
                        ┌─────────────────────────────────┐
                        │         Frontend Estático       │
                        │  (index / checkout / register / │
                        │   login / verify / faq / terms) │
                        └────────────┬────────────────────┘
                                     │ HTTP
                        ┌────────────▼────────────────────┐
                        │        API Gateway :8080        │
                        │   (Spring Cloud Gateway + JWT)  │
                        └──┬─────────────┬────────────────┘
                           │             │
             ┌─────────────▼─┐     ┌─────▼──────────────┐
             │ Security Svc  │     │  Customer Service  │
             │  :9000 (JWT)  │     │  :8082 (usuarios)  │
             └───────────────┘     └────────┬───────────┘
                                            │ MySQL
                                   ┌────────▼────────────┐
                                   │   billingflow_db    │
                                   └─────────────────────┘

             ┌─────────────────────────────────────────────┐
             │            Payment Service :8081            │
             │         (Stripe Sessions + Webhooks)        │
             └────────────┬────────────────────────────────┘
                          │ MySQL (payment_transactions)
                 ┌────────▼────────┐      ┌──────────────┐
                 │  billingflow_db │      │  Stripe CLI  │
                 └─────────────────┘      │  (webhook)   │
                                          └──────────────┘

             ┌─────────────────────────────────────────────┐
             │           Discovery Server :8761            │
             │              (Eureka Registry)              │
             └─────────────────────────────────────────────┘

             ┌─────────────────────────────────────────────┐
             │            Config Server :8888              │
             │       (configuración centralizada           │
             │          desde repositorio Git)             │
             └─────────────────────────────────────────────┘
```

Todos los microservicios se registran en Eureka. El API Gateway actúa como único punto de entrada para las rutas protegidas (`/customer/**`), validando el JWT antes de hacer el proxy.

---

## Requisitos previos

| Herramienta | Versión mínima | Uso |
|---|---|---|
| Java JDK | 17 | Todos los microservicios |
| Maven | 3.8+ | Build de cada servicio |
| MySQL | 8.0+ | Persistencia de usuarios y pagos |
| Stripe CLI | Última | Escuchar webhooks en local |
| VS Code + Live Server | — | Servir el frontend estático |
| Cuenta Stripe (modo test) | — | Pagos de prueba |
| Cuenta SendGrid | — | Envío de emails de verificación |

---

## Cómo arrancar el proyecto

El fichero `run-services.bat` arranca todos los servicios en el orden correcto con las pausas necesarias entre ellos:

```bat
run-services.bat
```

**Orden de arranque:**

1. **Discovery Server** (8761) — espera 10 s
2. **Config Server** (8888) — espera 10 s
3. **Security Service** (9000) — espera 8 s
4. **API Gateway** (8080) — espera 8 s
5. **Payment Service** (8081) — espera 8 s
6. **Stripe Webhook Listener** — espera 8 s
7. **Customer Service** (8082)

Tras el arranque, abre `static/index.html` con Live Server (o cualquier servidor HTTP local en el puerto `5500` o `5501`).

---

## Microservicios

### 1. Discovery Server — puerto `8761`

**Tecnología:** Spring Cloud Netflix Eureka Server

Actúa como **registro central de servicios**. Todos los demás microservicios se registran aquí al arrancar. Gracias a Eureka, el API Gateway puede resolver los nombres de servicio (`CUSTOMER-SERVICE`, `PAYMENT-SERVICE`, etc.) sin necesidad de IPs fijas.

- No se registra a sí mismo en Eureka.
- Interfaz web disponible en `http://localhost:8761`.

---

### 2. Config Server — puerto `8888`

**Tecnología:** Spring Cloud Config Server

Proporciona **configuración centralizada** para todos los microservicios. Lee las propiedades desde un **repositorio privado de GitHub** (HTTPS con token de acceso personal). 

- El Security Service lo utiliza para obtener el secreto JWT (`jwt.secret`) sin hardcodearlo localmente.
- Los demás servicios pueden importar configuración con `spring.config.import=optional:configserver:http://localhost:8888`.
- El repositorio Git se clona al arrancar (`clone-on-start=true`).

---

### 3. API Gateway — puerto `8080`

**Tecnología:** Spring Cloud Gateway (reactivo, WebFlux)

Es el **único punto de entrada** para el tráfico del frontend hacia los microservicios protegidos. Sus responsabilidades son:

- **Enrutamiento automático** mediante Eureka: detecta los servicios registrados y crea rutas `/{nombre-servicio}/**` automáticamente.
- **Ruta personalizada protegida**: cualquier petición a `/customer/**` pasa por el filtro `AuthenticationFilter` antes de ser reenviada al Customer Service.

#### Filtro `AuthenticationFilter`

1. Si la ruta contiene `/security-service`, deja pasar la petición sin validar (es el endpoint de login/generación de JWT).
2. Para el resto, comprueba que exista la cabecera `Authorization`.
3. Extrae el token `Bearer` y lo valida con `JwtUtil` usando la clave secreta obtenida del Config Server.
4. Si el token es inválido o está caducado, devuelve `401 Unauthorized`.
5. Si es válido, reenvía la petición al microservicio destino.

#### `JwtUtil`

Lee `jwt.secret` (Base64) desde el Config Server y usa JJWT para parsear y validar el token.

---

### 4. Security Service — puerto `9000`

**Tecnología:** Spring Boot + Spring Cloud Config Client + Eureka Client

Servicio encargado de la **generación de tokens JWT**. Sus credenciales y el secreto de firma se obtienen del Config Server al arrancar.

- Registrado en Eureka como `SECURITY-SERVICE`.
- El API Gateway le deja pasar tráfico sin validación de token (es el endpoint de autenticación).

---

### 5. Payment Service — puerto `8081`

**Tecnología:** Spring Boot + Stripe Java SDK + Spring Data JPA + MySQL

Gestiona todo el ciclo de vida del **pago con Stripe**. Expone dos grupos de endpoints:

#### Endpoints (`/api/payments`)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/create-session` | Crea una sesión de pago en Stripe y devuelve la URL de redirección |
| `GET` | `/checkout-session-email?sessionId=` | Recupera el email del cliente de una sesión de Stripe completada |
| `GET` | `/checkout-session/{sessionId}` | Igual que el anterior, por path variable |
| `POST` | `/webhook` (interno) | Endpoint alternativo de webhook |

#### Webhook (`/webhook/stripe`)

Escucha el evento `checkout.session.completed` enviado por la Stripe CLI. Al recibir el evento:
1. Valida la firma del webhook con `endpointSecret` para evitar peticiones falsificadas.
2. Deserializa el objeto `Session` de Stripe.
3. Extrae el email del cliente desde `session.getCustomerDetails().getEmail()`.
4. Persiste un registro `PaymentTransaction` en MySQL con estado `PAID`.

#### Modelo `PaymentTransaction`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | Long | PK autoincremental |
| `stripePaymentId` | String | ID de la sesión de Stripe (ej. `cs_test_...`) |
| `userEmail` | String | Email del comprador |
| `amount` | Long | Importe en céntimos (ej. `1000` = €10) |
| `status` | String | Estado del pago (`PAID`) |
| `createdAt` | LocalDateTime | Fecha de creación |

#### Configuración CORS

Permite peticiones desde `localhost:5500` y `localhost:5501` (Live Server) con todos los métodos HTTP.

---

### 6. Customer Service — puerto `8082`

**Tecnología:** Spring Boot + Spring Data JPA + MySQL + Spring Mail (SendGrid) + Spring Security Crypto (BCrypt) + RabbitMQ (configurado, pendiente de uso)

Es el **microservicio principal** del negocio. Gestiona el ciclo de vida completo de los usuarios.

#### Flujo de registro con verificación en dos pasos

El registro implementa una **sala de espera en memoria** (`ConcurrentHashMap`) antes de persistir en la base de datos:

1. `POST /api/customers/register` — recibe los datos del usuario.
2. La contraseña se **hashea con BCrypt** antes de almacenarse.
3. Se genera un código de verificación de 6 dígitos (válido 20 minutos).
4. Se envía el código al email del usuario vía SendGrid SMTP.
5. El usuario se guarda en memoria (`pendingCustomers`), **no en MySQL todavía**.
6. `POST /api/customers/verify` — el usuario introduce el código.
   - Máximo 3 intentos fallidos antes de cancelar el registro.
   - Si el código ha expirado, se elimina de memoria.
   - Si es correcto, el usuario se persiste en MySQL con `enabled = true`.
7. `POST /api/customers/resend-code` — reenvía un nuevo código si el usuario no lo recibió.

#### Endpoints

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| `POST` | `/api/customers/register` | Registra un nuevo usuario (inicia verificación) | Público |
| `POST` | `/api/customers/verify` | Verifica el código de 6 dígitos | Público |
| `POST` | `/api/customers/resend-code` | Reenvía el código de verificación | Público |
| `POST` | `/api/customers/login` | Autentica usuario con email + password | Público |
| `GET` | `/api/customers` | Lista todos los clientes | ADMIN |
| `GET` | `/api/customers/{id}` | Obtiene el perfil de un cliente | ADMIN |
| `PUT` | `/api/customers/{id}` | Actualiza datos de un cliente | ADMIN |
| `DELETE` | `/api/customers/{id}` | Elimina un cliente | ADMIN |

#### Modelo `Customer`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | Long | PK autoincremental |
| `firstName` | String | Nombre |
| `lastName` | String | Apellidos |
| `email` | String | Email único |
| `password` | String | Contraseña hasheada con BCrypt |
| `verificationCode` | String | Código 2FA temporal (null tras verificar) |
| `codeExpiration` | LocalDateTime | Expiración del código (20 min) |
| `enabled` | Boolean | `false` hasta verificar el email |
| `role` | String | `USER` o `ADMIN` |
| `failedAttemps` | Integer | Intentos fallidos de verificación |

#### Login

`POST /api/customers/login` verifica:
1. Que el email exista en base de datos.
2. Que la cuenta esté habilitada (`enabled = true`).
3. Que la contraseña introducida coincida con el hash BCrypt almacenado (`passwordEncoder.matches()`).

Devuelve el objeto `Customer` completo si todo es correcto, o `401` si las credenciales son inválidas.

---

## Frontend

El frontend es una SPA estática (HTML + CSS + JS vanilla) servida mediante Live Server. Todos los archivos están en la carpeta `static/`.

| Página | Archivo | Descripción |
|---|---|---|
| Landing | `index.html` | Página principal con hero, características, FAQ, comparativa y CTA. Incluye animación de intro (logo splash) que solo se muestra una vez por sesión |
| Compra | `checkout.html` | Página de pago con resumen del pedido (€10, licencia vitalicia). Inicia la sesión de Stripe y gestiona el retorno tras el pago |
| Registro | `register.html` | Formulario de registro. Si viene del flujo de pago, el email se bloquea automáticamente al email validado con Stripe |
| Verificación | `verify-code.html` | Introducción del código de 6 dígitos recibido por email. Permite reenvío del código |
| Login | `login.html` | Autenticación con email y contraseña. Almacena el usuario en `localStorage` tras el login |
| FAQ | `faq.html` | Preguntas frecuentes expandibles |
| Términos | `terms.html` | Condiciones de uso |
| Privacidad | `privacy.html` | Política de privacidad |

### Scripts JavaScript

| Archivo | Responsabilidad |
|---|---|
| `payments.js` | Llama a `/api/payments/create-session`, gestiona retorno de Stripe (`?success=true`), oculta el checkout inmediatamente al redirigir al registro |
| `register.js` | Gestiona el formulario de registro, valida la fortaleza de la contraseña, recupera el email de Stripe por `session_id`, bloquea el campo email si viene del flujo de pago |
| `login.js` | Envía credenciales al Customer Service, almacena el usuario en `localStorage`, redirige al inicio tras login exitoso |
| `verify-code.js` | Envía el código de verificación, reenvía código si el usuario lo solicita, redirige a login tras verificación exitosa |

---

## Flujos principales

### Flujo de compra y registro

```
1. Usuario visita index.html → hace clic en "Comprar"
2. checkout.html → hace clic en "Confirmar y Pagar"
3. payments.js llama a POST http://localhost:8081/api/payments/create-session
4. Payment Service crea sesión en Stripe y devuelve la URL de Stripe Checkout
5. Usuario completa el pago en la página de Stripe (tarjeta de prueba: 4242 4242 4242 4242)
6. Stripe redirige a checkout.html?success=true&session_id=cs_test_...
7. checkout.html oculta su contenido inmediatamente y redirige a register.html?fromPayment=true&session_id=...
8. register.js consulta GET /api/payments/checkout-session-email?sessionId=... para obtener el email
9. El email se bloquea en el formulario (no editable)
10. Usuario completa el formulario y envía → POST /api/customers/register
11. Customer Service hashea la contraseña, guarda en memoria temporal y envía código por email
12. Usuario es redirigido a verify-code.html
13. Usuario introduce el código → POST /api/customers/verify
14. Si es correcto, el usuario se persiste en MySQL y se redirige a login.html
```

### Flujo de login

```
1. Usuario visita login.html
2. Introduce email y contraseña → POST http://localhost:8082/api/customers/login
3. Customer Service verifica BCrypt hash y que la cuenta esté habilitada
4. Si es correcto, devuelve el objeto Customer
5. El frontend guarda usuario, email y rol en localStorage
6. Redirige a index.html?login=ok
```

### Flujo de protección JWT (rutas /customer/**)

```
1. Frontend envía petición a http://localhost:8080/customer/api/customers/...
   con cabecera: Authorization: Bearer <token>
2. API Gateway intercepta la petición
3. AuthenticationFilter valida el JWT con la clave secreta del Config Server
4. Si es válido → proxy al Customer Service
5. Si no → 401 Unauthorized
```

---

## Seguridad

- **Contraseñas**: hasheadas con **BCrypt** (strength 10 por defecto) mediante `spring-security-crypto`. Nunca se almacena la contraseña en texto plano.
- **Verificación en dos pasos**: ningún usuario queda activo en base de datos sin haber verificado su email. Máximo 3 intentos y expiración a los 20 minutos.
- **JWT**: el secreto de firma se almacena exclusivamente en el repositorio privado de Git, distribuido en runtime por el Config Server. El API Gateway valida el token en cada petición a rutas protegidas.
- **Webhooks de Stripe**: se valida la firma `Stripe-Signature` antes de procesar cualquier evento, evitando peticiones falsificadas.
- **CORS**: restringido a los orígenes del servidor de desarrollo (`localhost:5500`, `localhost:5501`).

---

## Base de datos

MySQL con base de datos `billingflow_db` (creada automáticamente si no existe).

**Tablas gestionadas por Hibernate (`ddl-auto=update`):**

| Tabla | Servicio | Descripción |
|---|---|---|
| `customers` | Customer Service | Usuarios registrados y verificados |
| `payment_transaction` | Payment Service | Transacciones de Stripe completadas |

---

## Variables y credenciales a configurar

Antes de arrancar el proyecto, revisar y actualizar los siguientes valores:

| Servicio | Fichero | Variable | Descripción |
|---|---|---|---|
| Config Server | `application.properties` | `spring.cloud.config.server.git.username` | Usuario de GitHub |
| Config Server | `application.properties` | `spring.cloud.config.server.git.password` | Token de acceso personal de GitHub |
| Customer Service | `application.properties` | `spring.datasource.password` | Contraseña de MySQL |
| Customer Service | `application.properties` | `spring.mail.password` | API Key de SendGrid (`SG.xxx...`) |
| Payment Service | `application.properties` | `stripe.api.key` | Clave secreta de Stripe (`sk_test_...`) |
| Payment Service | `application.properties` | `stripe.webhook.secret` | Secreto del webhook de Stripe CLI (`whsec_...`) |
| Repositorio Git del Config Server | — | `jwt.secret` | Clave Base64 para firmar los JWT |

> **Nota:** Para pruebas de pago en Stripe usa la tarjeta `4242 4242 4242 4242` con cualquier fecha futura y cualquier CVC.
