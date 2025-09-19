import { auth, BACKEND_URL } from './firebase-config.js';
    import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    // Verificar autenticación al cargar la página
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Si no está autenticado, redirigir al login
        window.location.href = 'loginAdmin.html';
        return;
      }

      try {
        // Verificar que tiene privilegios de admin
        const idToken = await user.getIdToken();
        
        const response = await fetch(`${BACKEND_URL}/api/login/profile`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          throw new Error('No es administrador');
        }

        const adminData = await response.json();
        
        // Mostrar información del admin
        document.getElementById('userEmail').textContent = adminData.email;
        document.getElementById('adminEmail').textContent = adminData.email;
        document.getElementById('adminUid').textContent = adminData.uid;
        document.getElementById('adminCreated').textContent = new Date(adminData.createdAt).toLocaleDateString();
        
        // Ocultar loading y mostrar dashboard
        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';

      } catch (error) {
        console.error('Error verificando admin:', error);
        alert('Error: No tienes privilegios de administrador');
        window.location.href = 'loginAdmin.html';
      }
    });

    // Función global para logout
    window.logout = async () => {
      try {
        await signOut(auth);
        localStorage.removeItem('firebaseIdToken');
        localStorage.removeItem('adminData');
        window.location.href = 'loginAdmin.html';
      } catch (error) {
        console.error('Error en logout:', error);
      }
    };