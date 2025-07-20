document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessageElement = document.getElementById('errorMessage');

    // Eğer zaten token varsa ve geçerliyse admin paneline yönlendir (opsiyonel)
    // Bu, daha gelişmiş bir kontrol gerektirebilir (token'ın geçerliliğini sunucuya sormak gibi)
    // Şimdilik basitçe token varsa yönlendirelim.
    if (localStorage.getItem('adminToken')) {
        // Token'ın geçerliliğini burada sunucuya sorup emin olmak daha iyi olur.
        // Şimdilik, token varsa admin.html'e yönlendirelim.
        // window.location.href = 'admin.html'; 
        // Daha iyi bir UX için, token kontrolünü admin.html'de yapıp, geçersizse login'e atabiliriz.
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
                    console.log('Admin token saved, redirecting to admin.html'); // Debug log
                    window.location.href = 'admin.html'; // Başarılı admin girişinde admin.html'e yönlendir
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