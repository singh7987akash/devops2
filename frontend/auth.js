const API_URL = 'http://localhost:5000/auth';

let isLogin = true;

const authForm = document.getElementById('authForm');
const nameGroup = document.getElementById('nameGroup');
const authName = document.getElementById('authName');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const toggleAuth = document.getElementById('toggleAuth');
const authError = document.getElementById('authError');

// If already logged in, redirect
if (localStorage.getItem('token')) {
  window.location.href = '/';
}

toggleAuth.addEventListener('click', (e) => {
  e.preventDefault();
  isLogin = !isLogin;
  if (isLogin) {
    nameGroup.style.display = 'none';
    authName.removeAttribute('required');
    authSubmitBtn.querySelector('.btn-text').textContent = 'Login';
    toggleAuth.textContent = 'Need an account? Register here.';
  } else {
    nameGroup.style.display = 'block';
    authName.setAttribute('required', 'true');
    authSubmitBtn.querySelector('.btn-text').textContent = 'Register';
    toggleAuth.textContent = 'Already have an account? Login here.';
  }
  authError.style.display = 'none';
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authEmail.value;
  const password = authPassword.value;
  const name = authName.value;

  const endpoint = isLogin ? '/login' : '/register';
  const payload = isLogin ? { email, password } : { name, email, password };

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/';
  } catch (err) {
    authError.textContent = err.message;
    authError.style.display = 'block';
  }
});
