import { auth, BACKEND_URL } from './firebase-config.js'; // Asumo que BACKEND_URL es necesario
    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    const registerForm = document.getElementById('registerForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const registerBtn = document.getElementById('registerBtn');
    const loading = document.getElementById('loading');
    // const messageElement = document.getElementById('message'); // ELIMINADO

    // REEMPLAZO DE showMessage por SweetAlert2
    function showMessage(text, isError = false) {
      const icon = isError ? 'error' : 'success';
      const title = isError ? 'Error de Registro' : 'Éxito';
      
      Swal.fire({
          icon: icon,
          title: title,
          text: text,
          showConfirmButton: isError, 
          timer: isError ? null : 3000, 
          confirmButtonColor: isError ? '#d33' : '#3085d6'
      });
    }

    // function hideMessage() { /* ELIMINADO: ya no es necesario */ }

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

      // hideMessage(); // ELIMINADO
      showLoading(true);

      try {
        if (!email || !password) {
            showMessage('Por favor, completa ambos campos.', true);
            showLoading(false);
            return;
        }
        
        if (!auth.currentUser) {
            showMessage('Error: Debes estar autenticado como administrador para registrar uno nuevo.', true);
            showLoading(false);
            return;
        }
        
        // Usar la función de backend para el registro de admin
        const idToken = await auth.currentUser.getIdToken();
        
        const response = await fetch(`${BACKEND_URL}/api/admin/register`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          // Intentar obtener un mensaje de error detallado del backend
          let errorText = await response.text();
          let responseData = {};
          try {
             responseData = JSON.parse(errorText);
          } catch(e) {
             console.log("No se pudo parsear el error como JSON");
          }
          const errorMessage = responseData.error || responseData.message || `Error al registrar. Código HTTP ${response.status}.`;
          
          console.error(' Error del servidor:', errorMessage);
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log(' Datos recibidos:', data);

        showMessage(`¡Admin creado con éxito! ${data.message}`, false);

        // Limpiar formulario
        registerForm.reset();

        // redirigir después de un tiempo
        setTimeout(() => {
          window.location.href = 'adminDashboard.html';
        }, 3000);
        
      } catch (error) {
        console.error('Error de registro fallido:', error);
        
        let errorMessage = `Error: ${error.message}`;
        
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Error: No se puede conectar al servidor.';
        } else if (error.message.includes('403')) {
          errorMessage = 'Error: No tienes permisos para registrar un nuevo administrador.';
        } else if (error.message.includes('ya está en uso')) {
          errorMessage = 'Error: Este email ya está registrado. Usa otro email.';
        }
        
        showMessage(errorMessage, true);
      } finally {
        showLoading(false);
      }
    });