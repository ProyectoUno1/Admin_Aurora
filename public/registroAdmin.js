 import { auth } from './firebase-config.js';
    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    const registerForm = document.getElementById('registerForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const registerBtn = document.getElementById('registerBtn');
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
      registerBtn.disabled = show;
      registerBtn.textContent = show ? 'Creando...' : 'Registrar Admin';
    }

    // Verificar si el usuario actual es admin (opcional)
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('Usuario autenticado:', user.email);
      }
    });

    // Manejar el registro 
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value;
      const password = passwordInput.value;
      const idToken = localStorage.getItem('firebaseIdToken');

      // URL del backend
      const BACKEND_URL = 'http://127.0.0.1:3000'; 

      if (!email || !password) {
        showMessage('Por favor, completa todos los campos.', true);
        return;
      }

      if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres.', true);
        return;
      }

      showLoading(true);
      hideMessage();

      try {
        console.log('Enviando petición a:', `${BACKEND_URL}/api/admin`);
        
        const response = await fetch(`${BACKEND_URL}/api/admin`, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` 
          },
          body: JSON.stringify({ email, password })
        });

        console.log(' Respuesta recibida:', response.status, response.statusText);

        // Verificar si la respuesta es válida antes de parsear JSON
        if (!response.ok) {
          const errorText = await response.text();
          console.error(' Error del servidor:', errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(' Datos recibidos:', data);

        showMessage(`Success: ${data.message}`, false);

        // Limpiar formulario
        registerForm.reset();

        // redirigir después de un tiempo
        setTimeout(() => {
          window.location.href = 'adminDashboard.html';
        }, 3000);
        
      } catch (error) {
        console.error('Error de registro fallido:', error);
        
        let errorMessage;
        
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Error: No se puede conectar al servidor. Verifica que esté corriendo en puerto 3000.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'Error: Problema de CORS. Verifica la configuración del servidor.';
        } else if (error.message.includes('500')) {
          if (error.message.includes('ya está en uso')) {
            errorMessage = 'Error: Este email ya está registrado. Usa otro email.';
          } else {
            errorMessage = 'Error del servidor. Revisa los logs para más detalles.';
          }
        } else {
          errorMessage = `Error: ${error.message}`;
        }
        
        showMessage(errorMessage, true);
      } finally {
        showLoading(false);
      }
    });