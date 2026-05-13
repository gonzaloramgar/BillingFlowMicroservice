document.addEventListener('DOMContentLoaded', async () => {
    const btnComprar = document.getElementById('btn-comprar');
    const mensajeStatus = document.getElementById('mensaje-status');
    const appBaseUrl = `${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}`;
    const paymentEmailStorageKey = 'billingflowCheckoutEmail';

    const resolveRegisterUrl = async () => {
        const candidateUrls = [
            `${appBaseUrl}/register.html`,
            `${window.location.origin}/billingflow_frontal_prueba/register.html`,
            `${window.location.origin}/billingflow/register.html`
        ];

        for (const candidateUrl of candidateUrls) {
            try {
                const response = await fetch(candidateUrl, {
                    method: 'HEAD',
                    cache: 'no-store'
                });

                if (response.ok) {
                    return candidateUrl;
                }
            } catch (error) {
                // Probar siguiente ruta candidata
            }
        }

        return `${appBaseUrl}/register.html`;
    };

    const setStatusMessage = (text, className, display = 'block') => {
        if (!mensajeStatus) {
            return;
        }

        mensajeStatus.textContent = text;
        mensajeStatus.className = className;
        mensajeStatus.style.display = display;
    };

    // --- PARTE 1: Detectar avisos en la URL (Cancelación o Éxito) ---
    const urlParams = new URLSearchParams(window.location.search);
    
    // Compatibilidad con flujo antiguo (éxito que vuelve a checkout)
    if (urlParams.get('success') === 'true') {
        // Ocultar el contenido del checkout inmediatamente para evitar el parpadeo
        const checkoutLayout = document.querySelector('.checkout-layout');
        if (checkoutLayout) checkoutLayout.style.display = 'none';

        const successParams = new URLSearchParams();
        successParams.set('fromPayment', 'true');

        const sessionId = urlParams.get('session_id');
        const email = urlParams.get('email');
        if (sessionId) successParams.set('session_id', sessionId);
        if (email) {
            successParams.set('email', email);
            localStorage.setItem(paymentEmailStorageKey, email);
        }

        setStatusMessage(
            '¡Pago recibido! Redirigiendo al registro...',
            'status-msg success'
        );

        const registerBaseUrl = await resolveRegisterUrl();
        window.location.href = `${registerBaseUrl}?${successParams.toString()}`;
        return;
    }

    if (urlParams.get('error') === 'cancelado') {
        setStatusMessage(
            "El pago ha sido cancelado. Puedes intentarlo de nuevo cuando quieras.",
            'status-msg warning'
        );
    }

    // --- PARTE 2: Lógica del botón de compra ---
    if (btnComprar) {
        btnComprar.addEventListener('click', async () => {
            // Desactivamos el botón para evitar múltiples clics
            btnComprar.disabled = true;
            btnComprar.textContent = 'Conectando con Stripe...';
            if (mensajeStatus) {
                mensajeStatus.style.display = 'none';
            }

            try {
                const knownEmail = localStorage.getItem(paymentEmailStorageKey);
                const response = await fetch('http://localhost:8081/api/payments/create-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        amount: 1000,
                        email: knownEmail || undefined,
                        successUrl: `${appBaseUrl}/checkout.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
                        cancelUrl: `${appBaseUrl}/checkout.html?error=cancelado`
                    })
                });

                if (!response.ok) throw new Error("Error en la respuesta del servidor");

                const data = await response.json();

                if (data.url) {
                    window.location.href = data.url;
                } else {
                    throw new Error("No se recibió la URL de pago.");
                }

            } catch (error) {
                console.error('Error:', error);
                setStatusMessage(
                    "Error de conexión con la pasarela de pago. Revisa que el servidor esté activo.",
                    'status-msg error'
                );
                
                // Reactivamos el botón para que pueda reintentar
                btnComprar.disabled = false;
                btnComprar.textContent = 'Comprar ahora';
            }
        });
    }
});