# BillingFlow — Sistema de Facturación para Autónomos

BillingFlow es una plataforma de facturación para autónomos construida con arquitectura de microservicios. Incluye:

- Pago único con Stripe para habilitar el registro.
- Registro con verificación por correo (código de 6 dígitos).
- Login con JWT.
- Gestión de clientes (panel ADMIN).
- Generación de facturas PDF con Apache FOP (incluyendo IVA e IRPF).

## Índice

- [Arquitectura](#arquitectura)
- [Requisitos](#requisitos)
- [Configuración y secretos (repo externo)](#configuración-y-secretos-repo-externo)
- [Arranque local](#arranque-local)
- [Proceso obligatorio de testing en Stripe](#proceso-obligatorio-de-testing-en-stripe)
- [Qué hace cada servicio](#qué-hace-cada-servicio)
- [Flujos funcionales](#flujos-funcionales)
- [Reglas de negocio y seguridad](#reglas-de-negocio-y-seguridad)
- [Base de datos](#base-de-datos)
- [Troubleshooting](#troubleshooting)

## Arquitectura

```
Frontend estático (static/*, Live Server 5500/5501)
        |
        +--> Payment Service (8081) --------> Stripe Checkout + Webhooks
        |
        +--> Security Service (9000) -------> Login + emisión JWT
        |
        +--> Invoice Service (8083) --------> Facturas + PDF (FOP)
        |
        +--> Customer Service (8082) -------> Registro/Verificación/Usuarios

Todos los servicios se registran en Discovery Server (8761)
Todos consumen configuración desde Config Server (8888)
Configuración central en repositorio externo privado
```

## Requisitos

| Herramienta | Versión recomendada |
|---|---|
| Java | 17 |
| Maven | 3.8+ |
| MySQL | 8.0+ |
| Stripe CLI | Última |
| VS Code + Live Server | Última |

## Configuración y secretos (repo externo)

Este proyecto usa Spring Cloud Config Server con un repositorio de configuración **externo/privado**. Los secretos no deben quedarse en este repositorio de código.

### Importante

1. Las claves (JWT, Stripe, SMTP, passwords) se gestionan en el repo de configuración externo.
2. En este repositorio solo deben quedar propiedades de bootstrap y configuración no sensible.
3. El token para que Config Server lea el repo externo debe ir por variable de entorno (por ejemplo `GITHUB_CONFIG_TOKEN`) o en un fichero local ignorado por Git.

### Ficheros de configuración esperados en repo externo

- `api-gateway.properties`
- `security-service.properties`
- `payment-service.properties`
- `customer-service.properties`
- `invoice-service.properties`

### Variables sensibles típicas en repo externo

- `jwt.secret`
- `spring.datasource.password`
- `spring.mail.password`
- `stripe.api.key`
- `stripe.webhook.secret`

## Arranque local

### 1) Preparar entorno

```powershell
cd BillingFlowMicroservice
java -version
mvn -v
```

Arranca MySQL en `3306`.

### 2) Arranque recomendado de todo el stack

Ejecuta:

```bat
run-services.bat
```

Orden de arranque del script:

1. discovery-server (`8761`)
2. config-server (`8888`)
3. security-service (`9000`)
4. api-gateway (`8080`)
5. payment-service (`8081`)
6. stripe webhook listener
7. customer-service (`8082`)
8. invoice-service (`8083`)

## Proceso obligatorio de testing en Stripe

Para probar compras y onboarding **es obligatorio** hacer login de Stripe CLI antes de testear.

### Paso A: iniciar sesión Stripe CLI

```powershell
.\stripe.exe logout
.\stripe.exe login
```

Debe terminar con un mensaje tipo `Done!`.

### Paso B: listener de webhook

Si usas `run-services.bat`, el listener ya se lanza automáticamente.

Manual (solo debug):

```powershell
.\stripe.exe listen --forward-to http://localhost:8081/api/payments/webhook
```

### Paso C: prueba de compra

1. Abre `static/index.html` con Live Server.
2. Inicia compra.
3. Usa tarjeta test `4242 4242 4242 4242`.
4. Verifica en logs de Payment Service el evento `checkout.session.completed`.

Si no se sigue este proceso de Stripe, los tests de pago/registro pueden fallar aunque el código esté bien.

## Qué hace cada servicio

### Discovery Server (`8761`)

- Registro de servicios (Eureka).

### Config Server (`8888`)

- Sirve configuración centralizada desde repo externo privado.
- Evita hardcodear secretos en cada microservicio.

### API Gateway (`8080`)

- Punto de entrada para rutas protegidas.
- Validación JWT antes de enrutar.

### Security Service (`9000`)

- Endpoint de login.
- Emisión de JWT para el frontend.

### Payment Service (`8081`)

- Crea sesión Stripe Checkout.
- Consume webhooks de Stripe y persiste transacción pagada.
- Permite recuperar email por `session_id` para bloquear el registro al email comprador.

### Customer Service (`8082`)

- Registro de usuario.
- Envío de código de verificación por email.
- Verificación de código y reenvío.
- Login delegado al Security Service.
- Operaciones ADMIN (listar/editar/eliminar usuarios) con reglas de seguridad.

### Invoice Service (`8083`)

- CRUD de facturas por usuario autenticado.
- Generación de PDF con Apache FOP (`plantilla.xsl`).
- Factura con base imponible, IVA, IRPF y total.

## Flujos funcionales

### Compra -> Registro -> Verificación -> Login

1. Usuario paga en Stripe.
2. Payment Service confirma pago por webhook.
3. Registro bloqueado al email de la sesión Stripe.
4. Se envía código de verificación por correo.
5. Verificación de cuenta y acceso a login.
6. Si la cuenta no está verificada, se redirige a verificación y se puede reenviar código.

### Facturación PDF (FOP)

1. Frontend envía datos de factura a Invoice Service.
2. Invoice Service construye XML.
3. FOP transforma XML + XSL-FO (`plantilla.xsl`) a PDF.
4. Se descarga la factura con desglose de base, IVA, IRPF y total.

## Reglas de negocio y seguridad

- Contraseñas con BCrypt.
- Verificación de email obligatoria para activar cuenta.
- JWT para autenticación entre frontend y backend.
- Validación de firma en webhooks Stripe.
- Restricciones ADMIN:
  - Una cuenta ADMIN no puede quitarse privilegios.
  - No se puede eliminar una cuenta ADMIN.
  - Un ADMIN no puede desverificarse a sí mismo.

## Base de datos

Base: `billingflow_db`.

Tablas principales:

- `customers` (Customer Service)
- `payment_transaction` / `payment_transactions` (según naming del módulo de pagos)
- `facturas` (Invoice Service)

`ddl-auto=update` crea/actualiza estructura automáticamente en desarrollo.

## Troubleshooting

### No llega webhook de Stripe

- Revisa que Stripe CLI esté logueada.
- Revisa que el listener esté activo y apuntando a `http://localhost:8081/api/payments/webhook`.

### No llega correo de verificación

- Revisa SMTP y secretos en el repo externo de configuración.
- Verifica que `customer-service` recibe esas propiedades desde Config Server.

### Login devuelve no verificada

- Completa `verify-code.html`.
- Usa reenvío de código si es necesario.

### Config Server no levanta configuración

- Verifica token de acceso al repo externo (variable de entorno).
- Verifica URL/branch del repo externo en config-server.

