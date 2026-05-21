const CUSTOMER_API_BASE = 'http://localhost:8082/api/customers';

const verifyForm = document.getElementById('verifyForm');
const verifyBtn = document.getElementById('verifyBtn');
const resendBtn = document.getElementById('resendBtn');
const verifyEmailInput = document.getElementById('verifyEmail');
const verifyCodeInput = document.getElementById('verifyCode');
const verifySuccessMessage = document.getElementById('verifySuccessMessage');
const verifyErrorMessage = document.getElementById('verifyErrorMessage');
const verifyErrorText = document.getElementById('verifyErrorText');
const verifyRetryBtn = document.getElementById('verifyRetryBtn');
const verifyLoadingOverlay = document.getElementById('verifyLoadingOverlay');
const verifyLoadingText = document.getElementById('verifyLoadingText');

const urlParams = new URLSearchParams(window.location.search);
const emailFromUrl = urlParams.get('email');
const pendingEmail = localStorage.getItem('pendingVerificationEmail');

if (emailFromUrl) {
    verifyEmailInput.value = emailFromUrl;
} else if (pendingEmail) {
    verifyEmailInput.value = pendingEmail;
}

verifyCodeInput.addEventListener('input', () => {
    verifyCodeInput.value = verifyCodeInput.value.replace(/\D/g, '').slice(0, 6);
});

verifyForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = verifyEmailInput.value.trim();
    const code = verifyCodeInput.value.trim();

    if (!email || !code) {
        showError('Debes indicar el email y el código de verificación.');
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verificando...';
    setLoading(true, 'Verificando cuenta, espera un momento...');

    try {
        const response = await fetch(`${CUSTOMER_API_BASE}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, code })
        });

        const responseText = await response.text();

        if (response.ok) {
            localStorage.removeItem('pendingVerificationEmail');
            verifyForm.style.display = 'none';
            verifyErrorMessage.style.display = 'none';
            verifySuccessMessage.style.display = 'block';

            setTimeout(() => {
                window.location.href = `login.html?verified=true&email=${encodeURIComponent(email)}`;
            }, 1800);
            return;
        }

        showError(responseText || 'No se pudo verificar tu cuenta. Revisa el código e inténtalo otra vez.');
    } catch (error) {
        showError('Error de conexión con customer-service. Verifica que el servicio esté levantado en el puerto 8082.');
    } finally {
        setLoading(false);
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verificar cuenta';
    }
});

resendBtn.addEventListener('click', async () => {
    const email = verifyEmailInput.value.trim();

    if (!email) {
        showError('Indica tu email para reenviar el código.');
        return;
    }

    resendBtn.disabled = true;
    resendBtn.textContent = 'Reenviando...';
    setLoading(true, 'Reenviando código por correo, espera un momento...');

    try {
        const response = await fetch(`${CUSTOMER_API_BASE}/resend-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const message = await response.text();

        if (response.ok) {
            alert(message || 'Código reenviado correctamente.');
        } else {
            showError(message || 'No pudimos reenviar el código. Revisa el email y vuelve a intentarlo.');
        }
    } catch (error) {
        showError('Error de conexión al reenviar el código.');
    } finally {
        setLoading(false);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Reenviar código';
    }
});

verifyRetryBtn.addEventListener('click', () => {
    verifyErrorMessage.style.display = 'none';
    verifyForm.style.display = 'block';
});

function showError(message) {
    verifyErrorText.textContent = message;
    verifyErrorMessage.style.display = 'block';
}

function setLoading(isLoading, message = 'Procesando, espera un momento...') {
    if (!verifyLoadingOverlay || !verifyLoadingText) {
        return;
    }

    verifyLoadingText.textContent = message;
    verifyLoadingOverlay.style.display = isLoading ? 'flex' : 'none';
}
