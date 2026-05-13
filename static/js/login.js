const CUSTOMER_API_BASE = 'http://localhost:8082/api/customers';

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
    loginBtn.textContent = 'Entrando...';

    try {
        const response = await fetch(`${CUSTOMER_API_BASE}/login`, {
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
            }

            loginForm.style.display = 'none';
            loginErrorMessage.style.display = 'none';
            loginSuccessMessage.style.display = 'block';

            setTimeout(() => {
                window.location.href = 'app.html';
            }, 1400);
            return;
        }

        showError(responseText || 'No se pudo iniciar sesión. Verifica tus credenciales.');
    } catch (error) {
        showError('Error de conexión con customer-service en el puerto 8082.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Entrar';
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
