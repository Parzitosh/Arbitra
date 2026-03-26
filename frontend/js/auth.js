document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const btnShowLogin = document.getElementById('show-login');
    const btnShowSignup = document.getElementById('show-signup');
    
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // --- UI TOGGLE LOGIC ---
    btnShowSignup.addEventListener('click', () => {
        loginSection.classList.add('hidden');
        signupSection.classList.remove('hidden');
    });

    btnShowLogin.addEventListener('click', () => {
        signupSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });

    // --- SIGN UP SUBMISSION ---
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop page reload
        
        // Gather data from inputs
        const userData = {
            username: document.getElementById('signup-username').value,
            email: document.getElementById('signup-email').value,
            password: document.getElementById('signup-password').value,
            wallet_address: document.getElementById('signup-wallet').value || null
        };

        try {
            // Change button text to show loading state
            const submitBtn = signupForm.querySelector('.btn-submit');
            submitBtn.innerText = 'Creating Account...';

            await api.registerUser(userData);
            
            alert('Account created successfully! Please sign in.');
            signupForm.reset();
            submitBtn.innerText = 'Sign Up';
            
            // Switch back to login view automatically
            btnShowLogin.click();
        } catch (error) {
            alert(`Error: ${error.message}`);
            signupForm.querySelector('.btn-submit').innerText = 'Sign Up';
        }
    });

    // --- SIGN IN SUBMISSION & ROUTING ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const credentials = {
            username: document.getElementById('login-identifier').value, // Acts as username or email
            password: document.getElementById('login-password').value
        };

        try {
            const submitBtn = loginForm.querySelector('.btn-submit');
            submitBtn.innerText = 'Verifying...';

            const response = await api.loginUser(credentials);
            
            // Save the user ID in the browser so the dashboard knows who is logged in
            localStorage.setItem('escrow_user_id', response.user.id);
            localStorage.setItem('escrow_username', response.user.username);

            // THE POLISH: Check the admin flag and redirect accordingly
            if (response.user.is_admin === true) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }

        } catch (error) {
            alert(`Error: ${error.message}`);
            loginForm.querySelector('.btn-submit').innerText = 'Sign In';
        }
    });
});