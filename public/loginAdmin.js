import { auth, BACKEND_URL } from './firebase-config.js';
    import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loading = document.getElementById('loading');
    
    function showMessage(text, isError = false) {
      const icon = isError ? 'error' : 'success';
      const title = isError ? 'Error de Acceso' : 'Éxito';
      
      Swal.fire({
          icon: icon,
          title: title,
          text: text,
          showConfirmButton: isError, 
          timer: isError ? null : 3000, 
          confirmButtonColor: isError ? '#d33' : '#3085d6'
      });
    }

 
    
    function showLoading(show) {
      loading.style.display = show ? 'block' : 'none';
      loginBtn.disabled = show;
      loginBtn.textContent = show ? 'Iniciando sesión...' : 'Iniciar Sesión';
    }


    onAuthStateChanged(auth, (user) => {
      if (user) {
      }
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      showLoading(true);

      if (!email || !password) {
        showMessage('Por favor, ingresa email y contraseña.', true);
        showLoading(false);
        return;
      }

      try {
        // 1. Autenticar con Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Obtener el ID Token
        const idToken = await user.getIdToken(true); 

        // 3. Verificar privilegios de admin con el backend
        const response = await fetch(`${BACKEND_URL}/api/login/verify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
        });

        const responseData = await response.json();

        if (!response.ok) {
          // Si el backend deniega el acceso (no admin), forzar logout de Firebase
          await auth.signOut();
          const error = responseData.error || responseData.message || 'Acceso denegado. No tienes privilegios de administrador';
          throw new Error(error);
        }

        console.log('Verificación admin exitosa:', responseData);

        // 4. Guardar token en localStorage
        localStorage.setItem('firebaseIdToken', idToken);
        localStorage.setItem('adminData', JSON.stringify(responseData.admin));

        showMessage('¡Login exitoso! Redirigiendo...', false);

        // 5. Redirigir después de 2 segundos
        setTimeout(() => {
          window.location.href = 'adminDashboard.html';
        }, 2000);

      } catch (error) {
        console.error(' Error en login:', error);
        
        let errorMessage = 'Error desconocido';
        
        // Manejo de errores de Firebase
        if (error.code === 'auth/user-not-found') {
          errorMessage = 'Usuario no encontrado';
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = 'Credenciales incorrectas';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Credenciales incorrectas';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
        // Manejo de errores de Backend
        } else if (error.message.includes('Access denied') || error.message.includes('Acceso denegado')) {
          errorMessage = 'Acceso denegado. No tienes privilegios de administrador';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'No se puede conectar al servidor';
        } else {
          errorMessage = error.message;
        }
        
        showMessage(errorMessage, true);
        showLoading(false);

      } 
    });