const SECURITY_API_BASE = 'http://localhost:9000/api/auth';

const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginSuccessMessage = document.getElementById('loginSuccessMessage');
const loginErrorMessage = document.getElementById('loginErrorMessage');
const loginErrorText = document.getElementById('loginErrorText');
const loginRetryBtn = document.getElementById('loginRetryBtn');

const queryParams = new URLSearchParams(window.location.search);
const prefilledEmail = queryParams.get('email');

if (prefilledEmail) {
    loginEmail.value = prefilledEmail;
}

if (queryParams.get('verified') === 'true') {
    const banner = document.getElementById('verifiedBanner');
    if (banner) {
        banner.style.display = 'flex';
        setTimeout(() => banner.classList.add('verified-banner--hide'), 4000);
    }
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="btn-loader"></span> Entrando...';

    try {
        const response = await fetch(`${SECURITY_API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: loginEmail.value.trim(),
                password: loginPassword.value
            })
        });

        const responseText = await response.text();

        if (response.ok) {
            const user = responseText ? JSON.parse(responseText) : null;
            if (user) {
                localStorage.setItem('currentCustomer', JSON.stringify(user));
                localStorage.setItem('currentCustomerEmail', user.email || '');
                localStorage.setItem('currentCustomerRole', user.role || 'USER');
                localStorage.setItem('currentCustomerToken', user.token || '');
            }

            loginForm.style.display = 'none';
            loginErrorMessage.style.display = 'none';
            loginSuccessMessage.style.display = 'block';

            setTimeout(() => {
                window.location.href = 'app.html';
            }, 1400);
            return;
        }

        const message = normalizeApiMessage(responseText) || 'No se pudo iniciar sesión. Verifica tus credenciales.';

        if (response.status === 403 || isUnverifiedMessage(message)) {
            const email = loginEmail.value.trim();
            if (email) {
                localStorage.setItem('pendingVerificationEmail', email);
            }
            window.location.href = `verify-code.html?email=${encodeURIComponent(email)}`;
            return;
        }

        showError(message);
    } catch (error) {
        showError('Error de conexión con security-service en el puerto 9000.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Entrar';
    }
});

loginRetryBtn.addEventListener('click', () => {
    loginErrorMessage.style.display = 'none';
    loginForm.style.display = 'block';
});

function showError(message) {
    loginErrorText.textContent = message;
    loginErrorMessage.style.display = 'block';
}

function normalizeApiMessage(responseText) {
    if (!responseText) return '';
    try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed.message === 'string') {
            return parsed.message;
        }
    } catch (e) {
        // Response no es JSON, se trata como texto plano.
    }
    return responseText;
}

function isUnverifiedMessage(message) {
    return typeof message === 'string' && message.toLowerCase().includes('no verificada');
}
