const API_BASE = 'http://localhost:8082/api/customers';
const PAYMENTS_API_BASE = 'http://localhost:8081/api/payments';
const PAYMENT_EMAIL_STORAGE_KEY = 'billingflowCheckoutEmail';

const registerForm = document.getElementById('registerForm');
const submitBtn = document.getElementById('submitBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const retryBtn = document.getElementById('retryBtn');
const strengthBar = document.getElementById('strengthBar');
const strengthText = document.getElementById('strengthText');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const emailInput = document.getElementById('email');
const emailLockNotice = document.getElementById('emailLockNotice');

const urlParams = new URLSearchParams(window.location.search);
const paymentSessionId = urlParams.get('session_id');
const fromPaymentFlow = urlParams.get('fromPayment') === 'true' || Boolean(paymentSessionId);

let paymentEmailVerified = false;
let emailHydrationDone = false;

initPaymentEmailFlow();

function setEmailLockNotice(message, tone = 'info') {
    if (!emailLockNotice) {
        return;
    }

    emailLockNotice.textContent = message;
    emailLockNotice.className = `email-lock-note ${tone}`;
    emailLockNotice.style.display = message ? 'block' : 'none';
}

async function initPaymentEmailFlow() {
    if (fromPaymentFlow) {
        submitBtn.disabled = true;
        emailInput.readOnly = true;
        setEmailLockNotice('Validando el email del pago...', 'info');
    }

    await hydrateEmailFromPayment();
    emailHydrationDone = true;

    if (fromPaymentFlow && !paymentEmailVerified) {
        submitBtn.disabled = true;
        setEmailLockNotice(
            'No pudimos validar el email del pago. Reintenta desde el enlace de confirmacion de Stripe.',
            'error'
        );
        return;
    }

    if (fromPaymentFlow && paymentEmailVerified) {
        setEmailLockNotice('Email validado desde Stripe y bloqueado para seguridad.', 'success');
    } else {
        setEmailLockNotice('');
    }

    submitBtn.disabled = false;
}

function setEmailValue(email, options = {}) {
    const { lock = false } = options;

    if (!email || !email.includes('@')) {
        return false;
    }

    emailInput.value = email;
    localStorage.setItem(PAYMENT_EMAIL_STORAGE_KEY, email);

    if (lock) {
        emailInput.readOnly = true;
        emailInput.classList.add('locked-email');
        paymentEmailVerified = true;
    }

    return true;
}

async function hydrateEmailFromPayment() {
    const emailFromUrl = urlParams.get('email');
    const storedEmail = localStorage.getItem(PAYMENT_EMAIL_STORAGE_KEY);

    if (fromPaymentFlow && setEmailValue(emailFromUrl, { lock: true })) {
        return;
    }

    if (paymentSessionId) {
        const endpoints = [
            `${PAYMENTS_API_BASE}/checkout-session-email?sessionId=${encodeURIComponent(paymentSessionId)}`,
            `${PAYMENTS_API_BASE}/checkout-session/${encodeURIComponent(paymentSessionId)}`,
            `${PAYMENTS_API_BASE}/checkout-session-email/${encodeURIComponent(paymentSessionId)}`,
            `${PAYMENTS_API_BASE}/session-email/${encodeURIComponent(paymentSessionId)}`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (!response.ok) {
                    continue;
                }

                const data = await response.json();
                const recoveredEmail =
                    data.email ||
                    data.customerEmail ||
                    data.customer_email ||
                    data.customer_details?.email ||
                    data.session?.customer_details?.email;

                if (setEmailValue(recoveredEmail, { lock: true })) {
                    return;
                }
            } catch (error) {
                // Intentamos el siguiente endpoint disponible
            }
        }
    }

    // Flujo no-pago: se permite prefilling pero editable
    if (!fromPaymentFlow && setEmailValue(storedEmail)) {
        emailInput.readOnly = false;
        emailInput.classList.remove('locked-email');
        return;
    }

    // Flujo pago sin validacion: no marcar como verificado
    if (fromPaymentFlow && storedEmail) {
        emailInput.value = storedEmail;
    }
}

// Validación de fortaleza de contraseña
passwordInput.addEventListener('input', updatePasswordStrength);

function updatePasswordStrength() {
    const password = passwordInput.value;
    let strength = 0;
    const feedback = [];

    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 20;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

    strengthBar.style.width = strength + '%';

    if (strength < 40) {
        strengthBar.className = 'strength-bar weak';
        strengthText.textContent = 'Contraseña débil';
        strengthText.className = 'strength-text weak';
    } else if (strength < 70) {
        strengthBar.className = 'strength-bar medium';
        strengthText.textContent = 'Contraseña media';
        strengthText.className = 'strength-text medium';
    } else {
        strengthBar.className = 'strength-bar strong';
        strengthText.textContent = 'Contraseña fuerte';
        strengthText.className = 'strength-text strong';
    }
}

// Validación de coincidencia de contraseñas
confirmPasswordInput.addEventListener('blur', () => {
    if (confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordInput.classList.add('error');
    } else {
        confirmPasswordInput.classList.remove('error');
    }
});

// Manejo del envío del formulario
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (fromPaymentFlow && !emailHydrationDone) {
        setEmailLockNotice('Aun estamos validando el email del pago. Espera un segundo.', 'info');
        return;
    }

    if (fromPaymentFlow && !paymentEmailVerified) {
        setEmailLockNotice(
            'Debes completar el registro con el mismo email validado en Stripe.',
            'error'
        );
        return;
    }

    // Validaciones básicas
    if (passwordInput.value !== confirmPasswordInput.value) {
        showError('Las contraseñas no coinciden');
        return;
    }

    if (passwordInput.value.length < 8) {
        showError('La contraseña debe tener al menos 8 caracteres');
        return;
    }

    // Mostrar estado de carga
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-loader"></span> Creando cuenta...';

    try {
        const fullName = document.getElementById('fullName').value.trim();
        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts.shift() || fullName;
        const lastName = nameParts.join(' ') || 'Cliente';

        const formData = {
            firstName,
            lastName,
            email: emailInput.value,
            password: passwordInput.value,
            role: 'USER'
        };

        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const responseText = await response.text();
        let data = null;
        try {
            data = responseText ? JSON.parse(responseText) : null;
        } catch (jsonError) {
            data = null;
        }

        if (response.ok) {
            // Éxito
            registerForm.style.display = 'none';
            successMessage.style.display = 'block';
            localStorage.setItem('pendingVerificationEmail', emailInput.value);
            localStorage.removeItem(PAYMENT_EMAIL_STORAGE_KEY);

            // Redirigir a verificación de código
            setTimeout(() => {
                window.location.href = `verify-code.html?email=${encodeURIComponent(emailInput.value)}`;
            }, 2500);
        } else {
            // Error de respuesta del servidor
            showError((data && (data.message || data.error)) || responseText || 'No se pudo crear la cuenta. Por favor, intenta de nuevo.');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error de conexión. Verifica que el servidor esté disponible.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Crear mi cuenta';
    }
});

function showError(message) {
    errorText.textContent = message;
    registerForm.style.display = 'none';
    errorMessage.style.display = 'block';
}

retryBtn.addEventListener('click', () => {
    errorMessage.style.display = 'none';
    registerForm.style.display = 'block';
    successMessage.style.display = 'none';
    registerForm.reset();
    strengthBar.style.width = '0%';
    strengthText.textContent = '';
});

