document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessageElement = document.getElementById('errorMessage');
    const redirectInfoElement = document.getElementById('redirectInfo');
    const redirectTargetElement = document.getElementById('redirectTarget');

    // Check for redirect parameter and show information
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirect');
    
    if (redirectTo && redirectInfoElement && redirectTargetElement) {
        // Show redirect information to user
        const panelNames = {
            'admin.html': 'Admin Yönetim',
            'monitoring.html': 'Sistem Monitoring',
            'test-socket.html': 'Socket Test'
        };
        
        const panelName = panelNames[redirectTo] || redirectTo;
        redirectTargetElement.textContent = panelName;
        redirectInfoElement.style.display = 'block';
    }

    // Check if already logged in
    if (localStorage.getItem('adminToken')) {
        // If already logged in and there's a redirect, go directly there
        if (redirectTo) {
            window.location.href = redirectTo;
        } else {
            window.location.href = 'admin.html';
        }
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageElement.textContent = '';

        const username = loginForm.username.value;
        const password = loginForm.password.value;

        console.log('Login attempt for username:', username); // Debug log

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            console.log('Response status:', response.status); // Debug log
            console.log('Response headers:', response.headers); // Debug log

            const data = await response.json();
            console.log('Response data:', data); // Debug log

            if (response.ok && data.accessToken) {
                console.log('Login successful, user data:', data.user); // Debug log
                if (data.user && data.user.role === 'admin') {
                    localStorage.setItem('adminToken', data.accessToken);
                    localStorage.setItem('adminUser', JSON.stringify(data.user));
                    console.log('Admin token saved, determining redirect...'); // Debug log
                    
                    // Smart redirect - use already parsed redirect parameter
                    
                    if (redirectTo) {
                        console.log('Redirecting to requested page:', redirectTo);
                        window.location.href = redirectTo;
                    } else {
                        console.log('No redirect parameter, going to default admin.html');
                        window.location.href = 'admin.html'; // Default admin panel
                    }
                } else {
                    console.log('User role is not admin:', data.user?.role); // Debug log
                    errorMessageElement.textContent = 'Admin yetkisine sahip değilsiniz.';
                    alert('Admin yetkisine sahip değilsiniz.');
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUser');
                }
            } else {
                console.log('Login failed - response not ok or no token'); // Debug log
                console.log('Data message:', data.message); // Debug log
                errorMessageElement.textContent = data.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
                alert('Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessageElement.textContent = 'Bir hata oluştu. Lütfen tekrar deneyin. Hata: ' + error.message;
        }
    });
}); 