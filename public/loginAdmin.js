import { auth, BACKEND_URL } from './firebase-config.js';
    import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loading = document.getElementById('loading');
    const messageElement = document.getElementById('message');

    function showMessage(text, isError = false) {
      messageElement.textContent = text;
      messageElement.className = `message ${isError ? 'message-error' : 'message-success'}`;
      messageElement.style.display = 'block';
    }

    function hideMessage() {
      messageElement.style.display = 'none';
    }

    function showLoading(show) {
      loading.style.display = show ? 'block' : 'none';
      loginBtn.disabled = show;
      loginBtn.textContent = show ? 'Iniciando sesión...' : 'Iniciar Sesión';
    }

    // Verificar si el usuario ya está logueado
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('Usuario ya autenticado:', user.email);
        // redirigir a dashboard
      }
    });

    // Manejar el login
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showMessage('Por favor, completa todos los campos.', true);
        return;
      }

      showLoading(true);
      hideMessage();

      try {
        console.log('Intentando login con Firebase...');
        
        // 1. Autenticar con Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Login exitoso en Firebase:', user.email);

        // 2. Obtener token de Firebase
        const idToken = await user.getIdToken();
        
        // 3. Verificar que es admin en el backend
        console.log(' Verificando privilegios de admin...');
        
        const response = await fetch(`${BACKEND_URL}/api/login/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error del servidor');
        }

        const data = await response.json();
        console.log('Verificación de admin exitosa:', data);

        // 4. Guardar token en localStorage
        localStorage.setItem('firebaseIdToken', idToken);
        localStorage.setItem('adminData', JSON.stringify(data.admin));

        showMessage('¡Login exitoso! Redirigiendo...', false);

        // 5. Redirigir después de 2 segundos
        setTimeout(() => {
          window.location.href = 'adminDashboard.html';
        }, 2000);

      } catch (error) {
        console.error(' Error en login:', error);
        
        let errorMessage = 'Error desconocido';
        
        if (error.code === 'auth/user-not-found') {
          errorMessage = 'Usuario no encontrado';
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = 'Credenciales incorrectas';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Credenciales incorrectas';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
        } else if (error.message.includes('Access denied')) {
          errorMessage = 'Acceso denegado. No tienes privilegios de administrador';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'No se puede conectar al servidor';
        } else {
          errorMessage = error.message;
        }
        
        showMessage(errorMessage, true);
      } finally {
        showLoading(false);
      }
    });